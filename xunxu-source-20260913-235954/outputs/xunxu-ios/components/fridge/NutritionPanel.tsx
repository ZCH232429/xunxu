import { OmniInputDock } from "./OmniInputDock";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { FridgeProvider, useFridge } from "./FridgeContext";
import { Button, ConfirmFoodSheet, FridgeInventoryGrid, s } from "./ui";
import type { FoodItem } from "../../lib/fridge/models";
import { useEffect } from "react";
import { SupplementRecords } from "./SupplementRecords";
import { localDay } from "../../lib/health/calculations";
import {AIRecipePillBubble,CustomWheelWorkspace,useDailyRecommendations} from './DietPlanning';
export function DietMainScreen({
  onBusyChange,
  active,
}: {
  active: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const {
    workspace,
    fridgeInventory,
    loading,
    error,
    saving,
    reload,
    saveFood,
    toggleDay,
  } = useFridge();
  const [draft, setDraft] = useState<FoodItem | null>(null),
    [dayError, setDayError] = useState("");
  const {plans:recommendations,aiState}=useDailyRecommendations();
  useEffect(() => {
    onBusyChange?.(saving);
    return () => onBusyChange?.(false);
  }, [saving, onBusyChange]);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
      >
        <Text style={[s.title, { color: "#fff" }]}>饮食</Text>
        {loading ? (
          <ActivityIndicator color="#d7ff7a" />
        ) : error ? (
          <View style={[s.card, { backgroundColor: "#f6c9dd" }]}>
            <Text style={s.copy}>{error}</Text>
            <Button label="重新加载冰箱" onPress={() => void reload()} />
          </View>
        ) : (
          workspace && (
            <>
              <AIRecipePillBubble plans={recommendations} aiState={aiState}/>
              <CustomWheelWorkspace />
              <SupplementRecords />
              <FridgeInventoryGrid foods={fridgeInventory} onEdit={setDraft} />
              <Text style={s.white}>
                确认用餐会同时保存饮食记录并扣减库存。库存偏少提示以不足 100g
                为基准。
              </Text>
              <Button
                light
                label="刷新云端库存"
                disabled={saving}
                onPress={() => void reload()}
              />
              <View style={[s.card, { backgroundColor: "#242424" }]}>
                <Text style={s.white}>
                  已记录饮食 · {workspace.meals.length} 条
                </Text>
                {workspace.meals
                  .slice(-6)
                  .reverse()
                  .map((m: any) => (
                    <Text key={m.id} style={s.white}>
                      {m.date} {m.meal} · {m.name} · {Math.round(m.kcal)} kcal
                    </Text>
                  ))}
              </View>
            </>
          )
        )}
        {workspace && !loading && !error && (
          <>
            <Button
              light
              disabled={saving}
              label={
                workspace.closedDays.includes(localDay().date)
                  ? "今日饮食已记全 · 点击撤销"
                  : "确认今日饮食已记全"
              }
              onPress={() => {
                setDayError("");
                void toggleDay().catch((e) => setDayError(e.message));
              }}
            />
            {!!dayError && <Text style={s.white}>{dayError}</Text>}
          </>
        )}
        {draft && (
          <ConfirmFoodSheet
            food={draft}
            saving={saving}
            onSave={saveFood}
            onClose={() => setDraft(null)}
          />
        )}
      </ScrollView>
      <OmniInputDock
        active={active}
        disabled={loading || saving || !!error || !workspace}
      />
    </KeyboardAvoidingView>
  );
}
export default function NutritionPanel({
  onBusyChange,
  onWorkspaceChange,
  sharedRecord,
  managed = false,
  active = true,
}: {
  onBusyChange?: (busy: boolean) => void;
  onWorkspaceChange?: (record: any) => void;
  sharedRecord?: any;
  managed?: boolean;
  active?: boolean;
}) {
  return (
    <FridgeProvider
      managed={managed}
      sharedRecord={sharedRecord}
      onWorkspaceChange={onWorkspaceChange}
    >
      <DietMainScreen active={active} onBusyChange={onBusyChange} />
    </FridgeProvider>
  );
}
