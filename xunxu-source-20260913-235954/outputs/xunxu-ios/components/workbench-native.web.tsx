import { useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import NutritionPanel from "./fridge/NutritionPanel";
import TodayPanel from "./today/TodayPanel";
import { WorkbenchTabs, TabKey } from "./workbench-tabs";
import { Pressable, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { useBasics } from "./basics-gate";
export default function WorkbenchWeb() {
  const basics = useBasics();
  const params = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState<TabKey>(
    params.section === "nutrition" ? "nutrition" : "overview",
  );
  const [busy, setBusy] = useState(false);
  const [sharedRecord,setSharedRecord]=useState<any>(null);
  useEffect(() => {
    if (params.section === "nutrition") setTab("nutrition");
  }, [params.section]);
  return (
    <View style={{ flex: 1, backgroundColor: "#111" }}>
      <View
        pointerEvents={tab === "nutrition" ? "auto" : "none"}
        style={{
          position: "absolute",
          top: 0,
          bottom: 76,
          left: 0,
          right: 0,
          opacity: tab === "nutrition" ? 1 : 0,
        }}
      >
        <NutritionPanel active={tab === "nutrition"} onBusyChange={setBusy} onWorkspaceChange={setSharedRecord}/>
      </View>
      <View pointerEvents={tab === "overview" ? "auto" : "none"} style={{position:"absolute",top:0,bottom:76,left:0,right:0,opacity:tab === "overview" ? 1 : 0}}>
        <TodayPanel active={tab === "overview"} managed sharedRecord={sharedRecord} onBusyChange={setBusy} onWorkspaceChange={setSharedRecord}/>
      </View>
      {["nutrition","overview"].includes(tab) ? (
        <View style={{ flex: 1 }} pointerEvents="none" />
      ) : (
        <View
          style={{ flex: 1, backgroundColor: "#111", padding: 32, gap: 20 }}
        >
          <Text style={{ color: "#fff" }}>
            基础信息已保存到云端。完整工作台请在 iPhone 的 Expo Go 中测试。
          </Text>
          <Pressable onPress={basics.edit}>
            <Text style={{ color: "#d7ff7a" }}>
              查看 / 修改基础信息与饮食目标
            </Text>
          </Pressable>
          <Pressable onPress={() => supabase?.auth.signOut({ scope: "local" })}>
            <Text style={{ color: "#d7ff7a" }}>退出账号</Text>
          </Pressable>
        </View>
      )}
      <WorkbenchTabs selected={tab} onSelect={setTab} disabled={busy} />
    </View>
  );
}
