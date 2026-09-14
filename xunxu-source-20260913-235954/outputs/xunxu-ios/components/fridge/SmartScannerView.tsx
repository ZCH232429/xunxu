import { ConfirmSupplementScan } from "./ConfirmSupplementScan";
import type {
  SupplementLabel,
  SupplementLog,
} from "../../lib/fridge/supplements";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { SDKBarcodeScanner } from "./SDKBarcodeScanner";
import { VisionScannerService } from "../../lib/fridge/VisionScannerService";
import type { FoodItem } from "../../lib/fridge/models";
import { Button, ConfirmFoodSheet, Sheet, s } from "./ui";

export function SmartScannerView({
  onSave,
  onClose,
  saving,
  target = "food",
  onSaveSupplement,
  initialInput,
  initialBarcode = false,
  embedded = false,
  active = true,
}: {
  active?: boolean;
  initialInput?: Parameters<VisionScannerService["scan"]>[0];
  initialBarcode?: boolean;
  embedded?: boolean;
  onSave?: (f: FoodItem) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  target?: "food" | "supplement";
  onSaveSupplement?: (log: SupplementLog) => Promise<void>;
}) {
  const [text, setText] = useState(initialInput?.text || ""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [camera, setCamera] = useState(initialBarcode);
  const [lastMode, setLastMode] = useState("");
  const [barcodeType, setBarcodeType] = useState("");
  const [draft, setDraft] = useState<FoodItem | null>(null);
  const [supplement, setSupplement] = useState<SupplementLabel | null>(null);
  const [progress, setProgress] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const lastInput = useRef<Parameters<VisionScannerService["scan"]>[0] | null>(null);
  const alive = useRef(true),
    locked = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function scan(input: Parameters<VisionScannerService["scan"]>[0]) {
    if (locked.current) return;
    locked.current = true;
    lastInput.current = input;
    setProgress("");
    setDiscarding(false);
    setLastMode(input.mode);
    Keyboard.dismiss();
    setBusy(true);
    setError("");
    setCamera(false);
    try {
      const service = new VisionScannerService((message) => {
        if (alive.current) setProgress(message);
      });
      if (target === "supplement") {
        const result = await service.request("food/resolve", {
          ...input,
          productType: "supplement",
        });
        if (alive.current) setSupplement(result);
      } else {
        const result = await service.scan(input);
        if (alive.current) setDraft(result.food);
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "识别失败");
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const initialized = useRef(false);
  useEffect(() => {
    if (initialInput && !initialized.current) {
      initialized.current = true;
      void scan(initialInput);
    }
  }, [initialInput]);
  async function photo(take: boolean) {
    try {
      if (take && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
        throw Error("请在 iPhone 设置中允许相机访问");
      const result = take
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
          });
      if (result.canceled) return;
      const a = result.assets[0],
        context = ImageManipulator.ImageManipulator.manipulate(a.uri);
      if (Math.max(a.width, a.height) > 1400)
        context.resize(a.width > a.height ? { width: 1400 } : { height: 1400 });
      const img = await context.renderAsync(),
        saved = await img.saveAsync({
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.8,
          base64: true,
        });
      await scan({
        mode: "photo",
        image: "data:image/jpeg;base64," + saved.base64,
        text,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "照片处理失败");
    }
  }
  const content = (
    <>
      {embedded && (
        <View style={[s.row, { justifyContent: "space-between", alignItems: "center" }]}> 
          <Text style={[s.white, { fontWeight: "800" }]}>{busy ? "正在解析" : draft || supplement ? "核对解析结果" : "录入结果"}</Text>
          {!camera && <Button label={collapsed ? "继续核对" : "收起"} onPress={() => { Keyboard.dismiss(); setCollapsed(v => !v); }} />}
        </View>
      )}
      {collapsed && <Text accessibilityLiveRegion="polite" style={s.white}>{busy ? progress || "正在识别，结果会保留在这里…" : error ? "识别未完成，展开后可重试。" : "录入草稿已保留，展开后继续编辑。"}</Text>}
      <View style={{ display: collapsed ? "none" : "flex", gap: 10 }}>
      {supplement ? (
        <ConfirmSupplementScan
          label={supplement}
          onSave={onSaveSupplement!}
          onClose={onClose}
          saving={saving}
        />
      ) : draft ? (
        <ConfirmFoodSheet
          embedded
          food={draft}
          onSave={onSave!}
          onClose={onClose}
          saving={saving}
        />
      ) : (
        <>
          {camera && active && <SDKBarcodeScanner onCancel={onClose} onResult={(value,type)=>void scan({mode:"barcode",code:value,barcodeType:type})}/>}
          {busy && (
            <View style={s.row}>
              <ActivityIndicator color="#d7ff7a" />
              <Text accessibilityLiveRegion="polite" style={s.white}>
                {progress || "正在识别并校验营养单位…"}
              </Text>
            </View>
          )}
          {!!error && (
            <View style={{ gap: 12 }}>
              <Text accessibilityLiveRegion="polite" style={s.white}>
                {error}
              </Text>
              {lastInput.current && <Button light disabled={busy} label="重新识别" onPress={() => { if (lastInput.current) void scan(lastInput.current); }} />}
              {lastMode === "barcode" && (
                <Button
                  light
                  disabled={busy}
                  label="拍摄产品正面 · 联网查找同款"
                  onPress={() => void photo(true)}
                />
              )}
            </View>
          )}
        </>
      )}
      </View>
      {embedded && !camera && (discarding ? <View style={{gap: 8}}><Text style={s.white}>放弃后会清除这次解析结果，原输入文字仍会保留。</Text><Button disabled={saving} label="确认放弃本次录入" onPress={onClose}/><Button label="继续编辑" onPress={() => {setDiscarding(false);setCollapsed(false);}}/></View> : <Button disabled={saving} label="放弃本次录入" onPress={() => setDiscarding(true)}/>)}
    </>
  );
  return embedded ? <ScrollView accessibilityLabel="原地录入状态" keyboardShouldPersistTaps="handled" style={{maxHeight: 460}} contentContainerStyle={{gap: 10}}>{content}</ScrollView> : <Sheet title={target === "supplement" ? "扫描补剂标签 / 条码" : draft ? "确认放入冰箱" : "放入冰箱"} onClose={onClose}>{content}</Sheet>;
}
