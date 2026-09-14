import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import { FridgeProvider, useFridge } from "../fridge/FridgeContext";
import { Button, s } from "../fridge/ui";
import { VisionScannerService } from "../../lib/fridge/VisionScannerService";
import { videoTargets } from "../../lib/nutrition-plan";
import { localDay } from "../../lib/health/calculations";
import type { PlannedMeal, VerifiedMealResult } from "../../lib/fridge/models";
import type { HealthDashboardState } from "../../lib/health/model";

const mealNames = {
  BREAKFAST: "早餐",
  LUNCH: "午餐",
  DINNER: "晚餐",
  SNACK: "加餐",
} as const;
function IntakeRing({ value, target }: { value: number; target: number }) {
  const size = 222,
    r = 86,
    c = 2 * Math.PI * r,
    p = Math.min(1, target ? value / target : 0);
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={111}
          cy={111}
          r={r}
          stroke="#b0d367"
          strokeWidth={16}
          fill="none"
        />
        <Circle
          cx={111}
          cy={111}
          r={r}
          stroke="#111"
          strokeWidth={16}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={[c, c]}
          strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 111 111)"
        />
      </Svg>
      <Text style={[s.title, { fontSize: 46 }]}>
        {Math.round(Math.max(0, target - value))}
      </Text>
      <Text style={todayStyles.ringCaption}>kcal · 今日剩余额度</Text>
    </View>
  );
}
export function TodayMealCard({ plan }: { plan: PlannedMeal }) {
  const { fridgeInventory, verifyMeal, saving } = useFridge();
  const [text, setText] = useState(""),
    [image, setImage] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [result, setResult] = useState<VerifiedMealResult | null>(null),
    [expanded, setExpanded] = useState(false);
  async function camera() {
    try {
      setError("");
      if (!(await ImagePicker.requestCameraPermissionsAsync()).granted)
        throw Error("请在系统设置中允许相机访问");
      const picked = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (picked.canceled) return;
      const a = picked.assets[0],
        ctx = ImageManipulator.ImageManipulator.manipulate(a.uri);
      if (Math.max(a.width, a.height) > 1400)
        ctx.resize(a.width > a.height ? { width: 1400 } : { height: 1400 });
      const img = await ctx.renderAsync(),
        saved = await img.saveAsync({
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.8,
          base64: true,
        });
      if (!saved.base64) throw Error("餐盘照片读取失败");
      setImage("data:image/jpeg;base64," + saved.base64);
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法打开相机");
    }
  }
  async function run() {
    if (!image) {
      setError("请先拍摄餐盘现场照片");
      return;
    }
    setBusy(true);
    setError("");
    setProgress("正在比对计划克重与餐盘…");
    try {
      setResult(
        await new VisionScannerService(setProgress).verifyMeal(
          plan,
          image,
          text,
          fridgeInventory,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "核销失败");
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!result) return;
    try {
      await verifyMeal(plan.id, result, Crypto.randomUUID());
      setResult(null);
      setImage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }
  return (
    <View
      style={[
        todayStyles.mealCard,
        { backgroundColor: plan.status === "VERIFIED" ? "#242424" : "#f6c9dd" },
      ]}
    >
      <View style={todayStyles.mealHeading}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={
              plan.status === "VERIFIED"
                ? todayStyles.lightKicker
                : todayStyles.kicker
            }
          >
            {mealNames[plan.mealType]}
          </Text>
          <Text
            style={[
              s.title,
              {
                fontSize: 20,
                color: plan.status === "VERIFIED" ? "#fff" : "#111",
              },
            ]}
          >
            {plan.dishName}
          </Text>
        </View>
        <Text
          style={[
            todayStyles.statusPill,
            plan.status === "VERIFIED" && { color: "#baf3dd" },
          ]}
        >
          {plan.status === "VERIFIED" ? "已完成" : "待核销"}
        </Text>
      </View>
      <Text style={plan.status === "VERIFIED" ? s.white : s.copy}>
        {plan.ingredients.map((x) => `${x.name} ${x.targetGrams}g`).join(" + ")}
      </Text>
      {plan.status === "VERIFIED" ? (
        <Text style={[s.white, { color: "#baf3dd" }]}>
          已核销并计入今日摄入
        </Text>
      ) : (
        <>
          {!expanded && (
            <Button label="核销这一餐" onPress={() => setExpanded(true)} />
          )}
          {expanded && (
            <>
              <TextInput
                accessibilityLabel={`${mealNames[plan.mealType]}补充说明`}
                value={text}
                onChangeText={setText}
                placeholder="例如：米饭剩约 1/4，牛肉全部吃完"
                placeholderTextColor="#777"
                style={s.input}
              />
              <Button
                label={image ? "重新拍摄餐盘" : "拍摄餐盘"}
                disabled={busy || saving}
                onPress={() => void camera()}
              />
              {!!image && (
                <Image
                  source={{ uri: image }}
                  style={{ height: 160, borderRadius: 22 }}
                  resizeMode="cover"
                />
              )}
              <Button
                label={busy ? "正在核销…" : "AI 核销这餐"}
                disabled={busy || saving || !image}
                onPress={() => void run()}
              />
              {busy && (
                <View style={s.row}>
                  <ActivityIndicator color="#111" />
                  <Text style={s.copy}>{progress}</Text>
                </View>
              )}
              {result && (
                <View style={[s.card, { backgroundColor: "#baf3dd" }]}>
                  <Text style={[s.title, { fontSize: 20 }]}>估算实际摄入</Text>
                  <Text style={s.copy}>
                    {result.ingredients
                      .map((x) => `${x.name} ${x.actualGrams}g`)
                      .join(" + ")}
                  </Text>
                  <Text style={s.copy}>
                    {Math.round(result.macros.calories)} kcal · 蛋白{" "}
                    {result.macros.protein.toFixed(1)}g · 碳水{" "}
                    {result.macros.carbs.toFixed(1)}g · 脂肪{" "}
                    {result.macros.fat.toFixed(1)}g
                  </Text>
                  <Text style={s.small}>
                    置信度 {result.confidence} · {result.notes.join("；")}
                  </Text>
                  <Text style={s.small}>
                    照片不能测量人体实际吸收率；这里只估算吃下的食物和营养。
                  </Text>
                  <Button
                    label="确认核销并计入今日"
                    disabled={saving}
                    onPress={() => void confirm()}
                  />
                </View>
              )}
              {!!error && (
                <Text accessibilityLiveRegion="polite" style={s.copy}>
                  {error}
                </Text>
              )}
              <Pressable
                onPress={() => setExpanded(false)}
                style={{ alignItems: "center", padding: 6 }}
              >
                <Text style={todayStyles.kicker}>收起</Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
}
function TodayContent({
  active,
  onBusyChange,
  healthState,
}: {
  active: boolean;
  onBusyChange?: (x: boolean) => void;
  healthState?: HealthDashboardState;
}) {
  const { workspace, loading, error, saving, reload } = useFridge();
  useEffect(() => {
    onBusyChange?.(saving);
    return () => onBusyChange?.(false);
  }, [saving, onBusyChange]);
  const date = localDay().date,
    plans: PlannedMeal[] = (workspace?.dailyPlans || []).filter(
      (p: PlannedMeal) => p.date === date,
    ),
    meals = (workspace?.meals || []).filter((m: any) => m.date === date),
    intake = meals.reduce((n: number, m: any) => n + Number(m.kcal || 0), 0),
    target = workspace ? videoTargets(workspace.profile) : { kcal: 0 },
    savedHealth = workspace?.health?.find((x: any) => x.date === date) || {},
    liveHealth = healthState?.status === "success" ? healthState.data : null,
    metrics = {
      fatBurn: liveHealth?.fatBurnZoneMinutes ?? savedHealth.heartZoneMinutes,
      activeEnergy: liveHealth?.activeEnergy ?? savedHealth.activeKcal,
      steps: liveHealth?.steps ?? savedHealth.steps,
      restingHeartRate: liveHealth?.restingHeartRate ?? savedHealth.rhr,
      sleep: liveHealth?.sleepDuration ?? savedHealth.coreDeepSleepHours,
    },
    pending = plans.filter((p) => p.status !== "VERIFIED").length;
  return (
    <ScrollView
      testID="today-scroll"
      style={{ flex: 1 }}
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={todayStyles.pageHeader}>
        <View>
          <Text style={todayStyles.lightKicker}>TODAY · {date}</Text>
          <Text style={[s.title, { color: "#fff" }]}>今天，按自己的节奏来</Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color="#d7ff7a" />
      ) : error ? (
        <View style={[s.card, { backgroundColor: "#f6c9dd" }]}>
          <Text style={s.copy}>{error}</Text>
          <Button label="重新加载" onPress={() => void reload()} />
        </View>
      ) : (
        workspace && (
          <>
            <View style={todayStyles.energyCard}>
              <Text style={todayStyles.kicker}>TODAY ENERGY</Text>
              <Text style={todayStyles.sectionTitle}>今日饮食预算</Text>
              <IntakeRing value={intake} target={target.kcal || 0} />
              <View style={todayStyles.energyFacts}>
                <View style={{ flex: 1 }}>
                  <Text style={todayStyles.kicker}>已记录摄入</Text>
                  <Text style={todayStyles.factValue}>
                    {Math.round(intake)}{" "}
                    <Text style={todayStyles.unit}>kcal</Text>
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={todayStyles.kicker}>目标摄入</Text>
                  <Text style={todayStyles.factValue}>
                    {Math.round(target.kcal || 0)}{" "}
                    <Text style={todayStyles.unit}>kcal</Text>
                  </Text>
                </View>
              </View>
              <Text style={todayStyles.note}>
                已核销 {meals.length} 餐 · 还有 {pending}{" "}
                餐待完成。圆环随饮食核销实时更新。
              </Text>
            </View>
            <View style={todayStyles.metricGrid}>
              <MetricCard
                color="#ff8a47"
                label="燃脂心率区间"
                value={metrics.fatBurn}
                unit="分钟"
              />
              <MetricCard
                color="#baf3dd"
                label="活动消耗"
                value={metrics.activeEnergy}
                unit="千卡"
              />
              <MetricCard
                color="#f6c9dd"
                label="今日步数"
                value={metrics.steps}
                unit="步"
              />
              <MetricCard
                color="#3155e7"
                dark
                label="静息心率"
                value={metrics.restingHeartRate}
                unit="次 / 分"
              />
            </View>
            <View style={todayStyles.sleepCard}>
              <Text style={todayStyles.kicker}>
                LAST NIGHT · 核心 + 深度睡眠
              </Text>
              <Text style={todayStyles.sleepValue}>
                {formatMetric(metrics.sleep, 1)}{" "}
                <Text style={todayStyles.unit}>小时</Text>
              </Text>
            </View>
            <View style={todayStyles.trainingCard}>
              <Text style={todayStyles.kicker}>MOVE TODAY</Text>
              <Text style={todayStyles.sectionTitle}>今天练什么</Text>
              <Text style={todayStyles.trainingName}>查看今日训练与指导</Text>
              <Text style={todayStyles.note}>
                训练安排、动作要点和当日完成情况都保留在训练板块。
              </Text>
            </View>
            <View style={todayStyles.mealsSection}>
              <Text style={todayStyles.lightKicker}>TODAY MEALS</Text>
              <Text style={[todayStyles.sectionTitle, { color: "#fff" }]}>
                今日三餐
              </Text>
            </View>
            {plans.length ? (
              plans.map((p) => <TodayMealCard key={p.id} plan={p} />)
            ) : (
              <View style={[s.card, { backgroundColor: "#baf3dd" }]}>
                <Text style={[s.title, { fontSize: 22 }]}>还没有今日规划</Text>
                <Text style={s.copy}>
                  到“饮食”打开 AI 推荐食谱，选择餐次后点“就这样吃！”。
                </Text>
              </View>
            )}
          </>
        )
      )}
    </ScrollView>
  );
}
export default function TodayPanel({
  active = true,
  managed = false,
  sharedRecord,
  onWorkspaceChange,
  onBusyChange,
  healthState,
}: {
  active?: boolean;
  managed?: boolean;
  sharedRecord?: any;
  onWorkspaceChange?: (r: any) => void;
  onBusyChange?: (x: boolean) => void;
  healthState?: HealthDashboardState;
}) {
  return (
    <FridgeProvider
      managed={managed}
      sharedRecord={sharedRecord}
      onWorkspaceChange={onWorkspaceChange}
    >
      <TodayContent
        active={active}
        onBusyChange={onBusyChange}
        healthState={healthState}
      />
    </FridgeProvider>
  );
}

function formatMetric(value: unknown, digits = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
}

function MetricCard({
  color,
  label,
  value,
  unit,
  dark = false,
}: {
  color: string;
  label: string;
  value: unknown;
  unit: string;
  dark?: boolean;
}) {
  return (
    <View style={[todayStyles.metricCard, { backgroundColor: color }]}>
      <Text style={dark ? todayStyles.lightKicker : todayStyles.kicker}>
        {label}
      </Text>
      <Text style={[todayStyles.metricValue, dark && { color: "#fff" }]}>
        {formatMetric(value)}
      </Text>
      <Text style={[todayStyles.unit, dark && { color: "#fff" }]}>{unit}</Text>
    </View>
  );
}

const todayStyles = StyleSheet.create({
  pageHeader: { paddingHorizontal: 6, paddingVertical: 8 },
  kicker: {
    fontFamily: "PingFang SC",
    color: "#111",
    fontSize: 11,
    letterSpacing: 1.1,
  },
  lightKicker: {
    fontFamily: "PingFang SC",
    color: "#fff",
    fontSize: 11,
    letterSpacing: 1.1,
  },
  energyCard: {
    backgroundColor: "#d7ff7a",
    borderRadius: 30,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "PingFang SC",
    color: "#111",
    fontWeight: "800",
    fontSize: 24,
    alignSelf: "stretch",
  },
  ringCaption: { fontFamily: "PingFang SC", color: "#111", fontSize: 11 },
  energyFacts: { flexDirection: "row", gap: 12, width: "100%" },
  factValue: {
    fontFamily: "PingFang SC",
    color: "#111",
    fontWeight: "800",
    fontSize: 23,
    marginTop: 5,
  },
  unit: {
    fontFamily: "PingFang SC",
    color: "#111",
    fontSize: 11,
    fontWeight: "400",
  },
  note: {
    fontFamily: "PingFang SC",
    color: "#111",
    fontSize: 12,
    lineHeight: 19,
    alignSelf: "stretch",
  },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    width: "48.5%",
    minHeight: 144,
    borderRadius: 28,
    padding: 18,
    justifyContent: "space-between",
  },
  metricValue: {
    fontFamily: "PingFang SC",
    color: "#111",
    fontWeight: "800",
    fontSize: 38,
    marginTop: 12,
  },
  sleepCard: {
    backgroundColor: "#f6c9dd",
    borderRadius: 30,
    padding: 22,
    gap: 8,
  },
  sleepValue: {
    fontFamily: "PingFang SC",
    color: "#111",
    fontWeight: "800",
    fontSize: 42,
  },
  trainingCard: {
    backgroundColor: "#ff8a47",
    borderRadius: 30,
    padding: 22,
    gap: 10,
  },
  trainingName: {
    fontFamily: "PingFang SC",
    color: "#111",
    fontWeight: "800",
    fontSize: 28,
  },
  mealsSection: { paddingHorizontal: 6, paddingTop: 10, gap: 5 },
  mealCard: { padding: 20, borderRadius: 28, gap: 12 },
  mealHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  statusPill: {
    fontFamily: "PingFang SC",
    color: "#111",
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.10)",
    overflow: "hidden",
  },
});
