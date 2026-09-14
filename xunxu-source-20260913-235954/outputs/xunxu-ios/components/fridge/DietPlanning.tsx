import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { videoTargets } from "../../lib/nutrition-plan";
import { localDay } from "../../lib/health/calculations";
import { MealMathSolver } from "../../lib/fridge/core";
import type {
  MealSolution,
  MealTarget,
  MealType,
  PlannedMeal,
} from "../../lib/fridge/models";
import { useFridge } from "./FridgeContext";
import {
  Button,
  CalculatedPortionsCard,
  MacroSlotMachinePicker,
  Sheet,
  s,
} from "./ui";
import { VisionScannerService } from "../../lib/fridge/VisionScannerService";

const types: Array<[MealType, string, number]> = [
  ["BREAKFAST", "早餐", 0.25],
  ["LUNCH", "午餐", 0.4],
  ["DINNER", "晚餐", 0.35],
];
const typeName: Record<MealType, string> = {
  BREAKFAST: "早餐",
  LUNCH: "午餐",
  DINNER: "晚餐",
  SNACK: "加餐",
};
function dishName(portions: { name: string }[]) {
  if (!portions.length) return "待补充食材";
  if (portions.length === 1) return portions[0].name;
  return `${portions[0].name}配${portions[1].name}`.slice(0, 50);
}
function asPlan(
  type: MealType,
  date: string,
  solution: MealSolution,
): PlannedMeal {
  return {
    id: Crypto.randomUUID(),
    date,
    mealType: type,
    dishName: dishName(solution.portions),
    ingredients: solution.portions.map((x) => ({
      foodId: x.foodId,
      name: x.name,
      targetGrams: x.grams,
    })),
    isSelected: true,
  };
}
export function AIRecipeModalSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return open ? (
    <Sheet title="今日 AI 推荐食谱" onClose={onClose}>
      {children}
    </Sheet>
  ) : null;
}
export function ConfirmEatButton({
  saving,
  onPress,
}: {
  saving: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      light
      disabled={saving}
      label={saving ? "正在保存…" : "就这样吃！"}
      onPress={onPress}
    />
  );
}
export function useDailyRecommendations() {
  const { workspace, fridgeInventory } = useFridge(),
    date = localDay().date,
    target = workspace
      ? videoTargets(workspace.profile)
      : { kcal: 0, p: 0, c: 0, f: 0 };
  const local = useMemo(() => {
    if (!workspace) return [];
    const existing = (workspace.dailyPlans || []).filter(
      (p: PlannedMeal) => p.date === date,
    );
    let available = fridgeInventory.map((f) => ({ ...f }));
    return types.map(([mealType, , weight]) => {
      const stored = existing.find((p: PlannedMeal) => p.mealType === mealType);
      if (stored) return stored;
      const selected = ["CARB", "PROTEIN", "FAT", "VEG"].flatMap((category) =>
        available
          .filter((f) => f.category === category && f.stockGrams > 0)
          .sort((a, b) => b.stockGrams - a.stockGrams)
          .slice(0, 1),
      );
      const solution = MealMathSolver.solve(selected, {
        targetCalories: Math.max(1, Math.round((target.kcal || 1800) * weight)),
        targetProtein: Math.max(0, Math.round((target.p || 120) * weight)),
        targetCarbs: Math.max(0, Math.round((target.c || 180) * weight)),
        targetFat: Math.max(0, Math.round((target.f || 60) * weight)),
      });
      available = available.map((f) => ({
        ...f,
        stockGrams: Math.max(
          0,
          f.stockGrams -
            (solution.portions.find((x) => x.foodId === f.id)?.grams || 0),
        ),
      }));
      return asPlan(mealType, date, solution);
    });
  }, [
    JSON.stringify(fridgeInventory),
    JSON.stringify(workspace?.dailyPlans || []),
    date,
    target.kcal,
    target.p,
    target.c,
    target.f,
  ]);
  const [plans, setPlans] = useState<PlannedMeal[]>(local),
    [aiState, setAiState] = useState<"loading" | "ready" | "fallback">(
      "loading",
    );
  const run = useRef(0);
  useEffect(() => {
    setPlans(local);
    if (!local.length || local.every((p) => p.status)) {
      setAiState(local.length ? "ready" : "fallback");
      return;
    }
    const current = ++run.current;
    setAiState("loading");
    new VisionScannerService()
      .enrichMealPlans(local)
      .then((enriched) => {
        if (current !== run.current) return;
        const map = new Map(enriched.map((x) => [x.mealType, x]));
        setPlans(
          local.map((p) =>
            map.has(p.mealType) ? { ...p, ...map.get(p.mealType) } : p,
          ),
        );
        setAiState(enriched.length ? "ready" : "fallback");
      })
      .catch(() => {
        if (current === run.current) setAiState("fallback");
      });
    return () => {
      run.current++;
    };
  }, [local]);
  return { plans, aiState };
}
export function AIRecipePillBubble({
  plans,
  aiState,
}: {
  plans: PlannedMeal[];
  aiState: "loading" | "ready" | "fallback";
}) {
  const { savePlannedMeals, saving } = useFridge();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Record<string, boolean>>({}),
    [error, setError] = useState("");
  useEffect(
    () =>
      setSelected(
        Object.fromEntries(plans.map((p) => [p.id, p.status !== "VERIFIED"])),
      ),
    [plans.map((p) => p.id + ":" + p.status).join(",")],
  );
  async function confirm() {
    try {
      const chosen = plans
        .filter((p) => selected[p.id] && p.status !== "VERIFIED")
        .map((p) => ({ ...p, isSelected: true }));
      if (!chosen.length) throw Error("请至少选择一餐");
      await savePlannedMeals(chosen);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "今日规划保存失败");
    }
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setError("");
          setOpen(true);
        }}
        style={{
          backgroundColor: "#d7ff7a",
          borderRadius: 999,
          paddingHorizontal: 20,
          paddingVertical: 15,
          alignSelf: "stretch",
        }}
      >
        <Text style={[s.copy, { fontWeight: "800", textAlign: "center" }]}>
          {aiState === "loading"
            ? "✨ AI 正在检索做法…"
            : aiState === "ready"
              ? "✨ 今日 AI 推荐食谱已生成"
              : "今日基础配餐已生成 · AI 做法暂未返回"}
        </Text>
      </Pressable>
      <AIRecipeModalSheet open={open} onClose={() => setOpen(false)}>
        {plans.map((p) => (
          <View
            key={p.id}
            style={[
              s.card,
              {
                backgroundColor: p.mealType === "LUNCH" ? "#ff8a47" : "#baf3dd",
              },
            ]}
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!selected[p.id] }}
              disabled={p.status === "VERIFIED"}
              onPress={() => setSelected((x) => ({ ...x, [p.id]: !x[p.id] }))}
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  backgroundColor: selected[p.id] ? "#111" : "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff" }}>
                  {selected[p.id] ? "✓" : ""}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { fontSize: 21 }]}>
                  {typeName[p.mealType]} · {p.dishName}
                </Text>
                <Text style={s.small}>
                  {p.ingredients
                    .map((x) => `${x.name} ${x.targetGrams}g`)
                    .join(" + ")}
                </Text>
              </View>
            </Pressable>
            {p.cookingMethodUrl && (
              <Button
                label="做法 ↗"
                onPress={() => void Linking.openURL(p.cookingMethodUrl!)}
              />
            )}
            {p.status === "VERIFIED" && (
              <Text style={s.small}>已在今日完成核销</Text>
            )}
          </View>
        ))}
        {!!error && <Text style={s.white}>{error}</Text>}
        <ConfirmEatButton saving={saving} onPress={() => void confirm()} />
        <Text style={s.white}>
          保存后会出现在“今日”。此时不扣库存，实际吃完核销时再扣除。
        </Text>
      </AIRecipeModalSheet>
    </>
  );
}

export function CustomWheelWorkspace() {
  const [mealType, setMealType] = useState<MealType>(() => {
    const hour = new Date().getHours();
    return hour < 10 ? "BREAKFAST" : hour < 15 ? "LUNCH" : "DINNER";
  });
  const weight = types.find(([type]) => type === mealType)![2];
  const addLock = useRef(false);
  const { workspace, fridgeInventory, savePlannedMeals, saving } = useFridge(),
    target = videoTargets(workspace.profile),
    date = localDay().date;
  const mealTarget: MealTarget = {
    targetCalories: Math.round((target.kcal || 1800) * weight),
    targetProtein: Math.round((target.p || 120) * weight),
    targetCarbs: Math.round((target.c || 180) * weight),
    targetFat: Math.round((target.f || 60) * weight),
  };
  const [solution, setSolution] = useState<MealSolution>(() =>
      MealMathSolver.solve([], mealTarget),
    ),
    [saved, setSaved] = useState(""),
    [recipeBusy, setRecipeBusy] = useState(false);
  async function add() {
    if (addLock.current || saving || !solution.portions.length) return;
    addLock.current = true;
    try {
      await savePlannedMeals([asPlan(mealType, date, solution)]);
      setSaved(`已加入今日${typeName[mealType]}规划，到“今日”核销。`);
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "保存失败");
    } finally {
      addLock.current = false;
    }
  }
  async function recipe() {
    if (!solution.portions.length || recipeBusy) return;
    setRecipeBusy(true);
    setSaved("豆包正在联网检索这组食材的做法…");
    try {
      const [result] = await new VisionScannerService().enrichMealPlans([
        asPlan(mealType, date, solution),
      ]);
      if (!result?.cookingMethodUrl)
        throw Error("豆包暂未找到可核对的做法来源，请稍后重试");
      setSaved("已由豆包找到做法来源。");
      await Linking.openURL(result.cookingMethodUrl);
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "豆包做法检索失败");
    } finally {
      setRecipeBusy(false);
    }
  }
  return (
    <View
      style={[s.card, { backgroundColor: "#315cff", paddingHorizontal: 16 }]}
    >
      <Text style={[s.small, { color: "#fff" }]}>CUSTOM MEAL WORKSPACE</Text>
      <Text style={[s.title, { color: "#fff", fontSize: 26 }]}>
        转动冰箱，配这一餐
      </Text>
      <Text style={[s.white, { color: "#e8ecff" }]}>
        滚轮停下后立即重新计算克重，食材不会在规划阶段扣减。
      </Text>
      <View style={s.row}>
        {types.map(([type, label]) => <Pressable key={type} accessibilityRole="tab" accessibilityLabel={`规划${label}`} accessibilityState={{selected:mealType===type, disabled:saving||recipeBusy}} disabled={saving||recipeBusy} onPress={() => {setMealType(type);setSaved("");}} style={[s.pill,{flex:1,padding:12,backgroundColor:mealType===type?'#d7ff7a':'#242424'}]}><Text style={{color:mealType===type?'#111':'#fff'}}>{label}</Text></Pressable>)}
      </View>
      <Text style={s.white}>{typeName[mealType]}目标 · {mealTarget.targetCalories} kcal</Text>
      <MacroSlotMachinePicker
        foods={fridgeInventory}
        target={mealTarget}
        onSolution={(next) => {setSolution(next);setSaved("");}}
      />
      <CalculatedPortionsCard
        solution={solution}
        busy={saving}
        recipeLabel={recipeBusy ? "豆包正在检索…" : "豆包检索做法 ↗"}
        consumeLabel="加入今日规划"
        onRecipe={() => void recipe()}
        onConsume={() => void add()}
      />
      {!!saved && (
        <Text accessibilityLiveRegion="polite" style={s.white}>
          {saved}
        </Text>
      )}
    </View>
  );
}
