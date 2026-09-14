import {EditableFoodCard} from './EditableFoodCard';
import { LookupSources } from "./LookupSources";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  FoodItem,
  FoodCategory,
  MealSolution,
  MealTarget,
} from "../../lib/fridge/models";
import {
  CategorizationEngine,
  MealMathSolver,
  validateFood,
} from "../../lib/fridge/core";

export const categoryLabels: Record<FoodCategory, string> = {
  CARB: "碳水",
  PROTEIN: "蛋白",
  FAT: "脂肪",
  VEG: "蔬菜",
};
export const colors: Record<FoodCategory, string> = {
  CARB: "#d7ff7a",
  PROTEIN: "#ff8a47",
  FAT: "#f6c9dd",
  VEG: "#baf3dd",
};
export const s = StyleSheet.create({
  page: { backgroundColor: "#111", padding: 16, gap: 12, paddingBottom: 40 },
  card: { padding: 22, borderRadius: 30, gap: 12 },
  title: {
    fontFamily: "PingFang SC",
    fontWeight: "800",
    fontSize: 28,
    color: "#111",
  },
  copy: {
    fontFamily: "PingFang SC",
    fontSize: 14,
    lineHeight: 22,
    color: "#111",
  },
  small: {
    fontFamily: "PingFang SC",
    fontSize: 12,
    lineHeight: 19,
    color: "#111",
  },
  white: {
    fontFamily: "PingFang SC",
    color: "#fff",
    fontSize: 14,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#fff",
    color: "#111",
    fontSize: 16,
    padding: 14,
    borderRadius: 18,
    minHeight: 48,
  },
  pill: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 999,
    minHeight: 48,
    alignItems: "center",
  },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
});
export function Button({
  label,
  onPress,
  disabled = false,
  light = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  light?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({pressed}) => [
        s.pill,
        {
          backgroundColor: light ? "#d7ff7a" : "#111",
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[s.white, { color: light ? "#111" : "#fff", fontWeight: "700" }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.page, { paddingTop: 30 }]}
      >
        <View
          style={[
            s.row,
            { justifyContent: "space-between", alignItems: "center" },
          ]}
        >
          <Text style={[s.title, { color: "#fff", fontSize: 24 }]}>
            {title}
          </Text>
          <Button label="关闭" onPress={onClose} />
        </View>
        {children}
      </ScrollView>
    </Modal>
  );
}

export function ConfirmFoodSheet({
  food,
  onSave,
  onClose,
  saving,
  embedded = false,
}: {
  food: FoodItem;
  onSave: (f: FoodItem) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  embedded?: boolean;
}) {
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(food.name),
    [stock, setStock] = useState(
      String(food.stockGrams),
    ),
    [fields, setFields] = useState(
      Object.fromEntries(
        Object.entries(food.macrosPer100g).map(([k, v]) => [
          k,
          String(Math.round(v * 100) / 100),
        ]),
      ),
    ),
    [manualCategory, setManualCategory] = useState<FoodCategory | null>(food.category),
    [changingCategory, setChangingCategory] = useState(false),
    [error, setError] = useState("");
  const m = {
      calories: Number(fields.calories),
      protein: Number(fields.protein),
      carbs: Number(fields.carbs),
      fat: Number(fields.fat),
    },
    category = manualCategory || CategorizationEngine.categorize(name, m);
  async function save() {
    if (submitLock.current || saving) return;
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (!stock.trim() || Object.values(fields).some((v) => !v.trim()))
        throw Error("请确认库存克重和完整营养数据");
      const f = validateFood({
        ...food,
        name: name.trim(),
        stockGrams: Number(stock),
        macrosPer100g: m,
        category,
      });
      await onSave(f);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }
  const content = (
    <View style={[s.card, { backgroundColor: colors[category] }]}>
      <Text style={s.copy}>
        {food.kind === "label"
          ? food.lookup?.method === "photo-web"
            ? "照片联网匹配 · 请核对品牌与规格"
            : "包装 / 数据库标签 · 请核对"
          : "成分表估算 · 请核对生熟与规格"}
      </Text>
      <Text style={s.small}>
        {food.source} {food.note}
      </Text>
      <LookupSources sources={food.sources} />
      <TextInput
        accessibilityLabel="食材名称"
        value={name}
        onChangeText={setName}
        style={s.input}
      />
      <Text style={s.copy}>实际库存（克）</Text>
      <TextInput
        accessibilityLabel="实际库存克数"
        value={stock}
        onChangeText={setStock}
        keyboardType="number-pad"
        placeholder="请按净重或称重填写"
        style={s.input}
      />
      <View style={[s.row,{alignItems:"center",justifyContent:"space-between"}]}>
        <Text style={s.copy}>以下均为每 100g · {changingCategory?"更改分类":"分类"}：{categoryLabels[category]}</Text>
        <Pressable accessibilityRole="button" onPress={()=>setChangingCategory(v=>!v)} style={[s.pill,{minHeight:36,paddingVertical:8,paddingHorizontal:14}]}><Text style={s.white}>更改</Text></Pressable>
      </View>
      {changingCategory&&<View style={s.row}>{(Object.keys(categoryLabels) as FoodCategory[]).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:category===value}} onPress={()=>{setManualCategory(value);setChangingCategory(false)}} style={[s.pill,{padding:12,backgroundColor:category===value?'#111':'#fff'}]}><Text style={{color:category===value?'#fff':'#111'}}>{categoryLabels[value]}</Text></Pressable>)}</View>}
      {[
        ["calories", "热量 kcal"],
        ["protein", "蛋白质 g"],
        ["carbs", "碳水 g"],
        ["fat", "脂肪 g"],
      ].map(([key, label]) => (
        <View key={key}>
          <Text style={s.small}>{label}</Text>
          <TextInput
            accessibilityLabel={label}
            value={fields[key]}
            keyboardType="decimal-pad"
            onChangeText={(v) => setFields({ ...fields, [key]: v })}
            style={s.input}
          />
        </View>
      ))}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={s.copy}>
          {error}
        </Text>
      )}
      <Button
        disabled={saving || submitting}
        label={saving || submitting ? "正在保存…" : "确认食材与库存"}
        onPress={() => void save()}
      />
    </View>
  );
  return embedded ? (
    content
  ) : (
    <Sheet title="确认放入冰箱" onClose={() => {if (!saving && !submitLock.current) onClose();}}>
      {content}
    </Sheet>
  );
}

export function FridgeInventoryGrid({
  foods,
  onEdit,
}: {
  foods: FoodItem[];
  onEdit: (f: FoodItem) => void;
}) {
  const [category, setCategory] = useState<FoodCategory>("CARB");
  const filtered = foods.filter((f) => f.category === category);
  return (
    <View style={{ gap: 12 }}>
      <Text style={[s.title, { color: "#fff", fontSize: 24 }]}>我的冰箱</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {(Object.keys(categoryLabels) as FoodCategory[]).map((c) => (
          <Pressable
            key={c}
            accessibilityRole="tab"
            accessibilityState={{ selected: c === category }}
            onPress={() => setCategory(c)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 999,
              backgroundColor: c === category ? colors[c] : "#242424",
              alignItems: "center",
            }}
          >
            <Text
              style={{ color: c === category ? "#111" : "#fff", fontSize: 13 }}
            >
              {categoryLabels[c]} {foods.filter((f) => f.category === c).length}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {filtered.map(f=><EditableFoodCard key={f.id} food={f} onDetails={()=>onEdit(f)}/>)}
      </View>
      {!filtered.length && (
        <View style={[s.card, { backgroundColor: "#242424" }]}>
          <Text style={s.white}>
            这一格还是空的，先放入{categoryLabels[category]}类食材。
          </Text>
        </View>
      )}
    </View>
  );
}

const ROW = 56;
function Wheel({
  label,
  foods,
  value,
  onChange,
}: {
  label: string;
  foods: FoodItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const rows = [{ id: "", name: "不选择" }, ...foods],
    ref = useRef<ScrollView>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const i = Math.max(
      0,
      rows.findIndex((f) => f.id === value),
    );
    ref.current?.scrollTo({ y: i * ROW, animated: false });
  }, [value, foods.map((f) => f.id).join(",")]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function settle(offset: number) {
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(offset / ROW)));
    if (rows[i].id !== latest.current) onChange(rows[i].id);
    if (Math.abs(offset - i * ROW) > 1)
      ref.current?.scrollTo({ y: i * ROW, animated: true });
  }
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text
        style={[
          s.white,
          { textAlign: "center", fontSize: 12, marginBottom: 10 },
        ]}
      >
        {label}
      </Text>
      <View
        style={{
          height: ROW * 3,
          borderRadius: 24,
          backgroundColor: "#242424",
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: ROW,
            left: 0,
            right: 0,
            height: ROW,
            backgroundColor: "#baf3dd",
            borderRadius: 18,
          }}
        />
        <ScrollView
          ref={ref}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ROW}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: ROW }}
          scrollEventThrottle={32}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => settle(y), 180);
          }}
          onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        >
          {rows.map((f) => (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityLabel={label + "：" + f.name}
              onPress={() => onChange(f.id)}
              style={{
                height: ROW,
                paddingHorizontal: 5,
                justifyContent: "center",
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  fontFamily: "PingFang SC",
                  fontSize: 13,
                  textAlign: "center",
                  color: f.id === value ? "#111" : "#fff",
                  fontWeight: f.id === value ? "700" : "400",
                }}
              >
                {f.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
export function MacroSlotMachinePicker({
  foods,
  target,
  onSolution,
}: {
  foods: FoodItem[];
  target: MealTarget;
  onSolution: (s: MealSolution) => void;
}) {
  const pools = (Object.keys(categoryLabels) as FoodCategory[]).map((c) =>
    foods.filter((f) => f.category === c && f.stockGrams > 0),
  );
  const [ids, setIds] = useState(() => pools.map((p) => p[0]?.id || ""));
  // A food can move category or run out while this screen stays mounted.
  const validIds = ids.map((id, i) => pools[i].some(f => f.id === id) ? id : "");
  useEffect(() => {
    if (ids.some((id, i) => id !== validIds[i])) setIds(validIds);
    const cleaned = validIds.filter(Boolean);
    onSolution(
      MealMathSolver.solve(
        foods.filter((f) => cleaned.includes(f.id)),
        target,
      ),
    );
  }, [ids.join(","), JSON.stringify(target), JSON.stringify(foods)]);
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.white}>上下滚动选择食材，可点选“不选择”跳过一列。</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {pools.map((pool, i) => (
          <Wheel
            key={i}
            label={Object.values(categoryLabels)[i]}
            foods={pool}
            value={validIds[i]}
            onChange={(id) =>
              setIds((old) => old.map((x, j) => (j === i ? id : x)))
            }
          />
        ))}
      </View>
    </View>
  );
}
export function CalculatedPortionsCard({
  solution,
  onRecipe,
  onConsume,
  busy,
  recipeLabel = "AI 做法推荐",
  consumeLabel = "确认吃掉这一餐",
}: {
  solution: MealSolution;
  onRecipe: () => void;
  onConsume: () => void;
  busy: boolean;
  recipeLabel?: string;
  consumeLabel?: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [JSON.stringify(solution.portions)]);
  return (
    <Animated.View style={[s.card, { backgroundColor: "#baf3dd", opacity }]}>
      <Text style={[s.title, { fontSize: 22 }]}>这一餐，建议这样配</Text>
      {solution.portions.map((p) => (
        <View
          key={p.foodId}
          style={[s.row, { justifyContent: "space-between" }]}
        >
          <Text style={s.copy}>{p.name}</Text>
          <Text style={[s.copy, { fontWeight: "800" }]}>{p.grams} g</Text>
        </View>
      ))}
      <Text style={s.copy}>
        {Math.round(solution.totals.calories)} kcal · 蛋白{" "}
        {solution.totals.protein.toFixed(1)}g · 碳水{" "}
        {solution.totals.carbs.toFixed(1)}g · 脂肪{" "}
        {solution.totals.fat.toFixed(1)}g
      </Text>
      {solution.warnings.map((w) => (
        <Text key={w} style={s.small}>
          {w}
        </Text>
      ))}
      <Text style={s.small}>
        按食材标签的生重 / 熟重称量，烹调油需作为食材选入。
      </Text>
      <Button
        disabled={busy || !solution.portions.length}
        label={recipeLabel}
        onPress={onRecipe}
      />
      <Button
        disabled={busy || !solution.portions.length}
        label={busy ? "正在处理…" : consumeLabel}
        onPress={onConsume}
      />
    </Animated.View>
  );
}
