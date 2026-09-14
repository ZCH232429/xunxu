import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { OmniInputBar, type InputTarget } from "./OmniInputBar";
import { SmartScannerView } from "./SmartScannerView";
import { useFridge } from "./FridgeContext";
import { useVoiceInput } from "../../lib/fridge/useVoiceInput";
import type { VisionScannerService } from "../../lib/fridge/VisionScannerService";

type ScanInput = Parameters<VisionScannerService["scan"]>[0];
export function InlineUploadStatusCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: "#242424",
        borderRadius: 28,
        padding: 12,
        maxHeight: 480,
      }}
    >
      {children}
    </View>
  );
}
export function OmniInputDock({
  active,
  disabled,
}: {
  active: boolean;
  disabled: boolean;
}) {
  const { saveFood, saveSupplement, saving } = useFridge();
  const [value, setValue] = useState(""),
    [target, setTarget] = useState<InputTarget>("food");
  const [menu, setMenu] = useState<"add" | "mode" | null>(null);
  const [pending, setPending] = useState<{
    target: InputTarget;
    input?: ScanInput;
  } | null>(null);
  const [picking, setPicking] = useState(false),
    [error, setError] = useState(""), [saved,setSaved]=useState("");
  const inputRef = useRef<TextInput>(null),
    base = useRef("");
  const pickerLock = useRef(false),
    alive = useRef(true),
    isActive = useRef(active);
  isActive.current = active;
  const afterDismiss = useRef<(() => void) | null>(null);
  const voice = useVoiceInput(active && !pending && !picking, (text) =>
    setValue(base.current + text),
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!active) {
      setMenu(null);
      afterDismiss.current = null;
      inputRef.current?.blur();
    }
  }, [active]);
  const blocked = disabled || picking || voice.starting || !!pending;
  function closeMenu(action?: () => void) {
    afterDismiss.current = action || null;
    setMenu(null);
    if (Platform.OS !== "ios") {
      afterDismiss.current = null;
      action?.();
    }
  }
  function openMenu(which: "add" | "mode") {
    Keyboard.dismiss();
    setMenu(which);
  }
  async function photo(camera: boolean) {
    if (pickerLock.current) return;
    pickerLock.current = true;
    setPicking(true);
    setError("");setSaved("");
    const destination = target;
    try {
      if (
        camera &&
        !(await ImagePicker.requestCameraPermissionsAsync()).granted
      )
        throw Error("请在系统设置中允许相机访问。");
      const options = {
        mediaTypes: ["images"] as ImagePicker.MediaType[],
        quality: 1,
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !alive.current || !isActive.current) return;
      const asset = result.assets[0],
        context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
      if (Math.max(asset.width, asset.height) > 1400)
        context.resize(
          asset.width > asset.height ? { width: 1400 } : { height: 1400 },
        );
      const image = await context.renderAsync();
      const saved = await image.saveAsync({
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.8,
        base64: true,
      });
      if (!saved.base64) throw Error("照片读取失败，请重新选择。");
      if (alive.current && isActive.current)
        setPending({
          target: destination,
          input: {
            mode: "photo",
            image: "data:image/jpeg;base64," + saved.base64,
            text: value,
          },
        });
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "无法打开照片。");
    } finally {
      pickerLock.current = false;
      if (alive.current) setPicking(false);
    }
  }
  return (
    <View style={{ backgroundColor: "#111", padding: 10, gap: 6 }}>
      {!!saved&&<Text accessibilityLiveRegion="polite" style={{color:"#baf3dd",paddingHorizontal:12}}>{saved}</Text>}
      {!!(error || voice.message || voice.starting || picking) && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: "#ccc", fontSize: 12, paddingHorizontal: 12 }}
        >
          {error ||
            voice.message ||
            (picking ? "正在读取照片…" : "正在准备麦克风…")}
        </Text>
      )}
      {pending && (
        <InlineUploadStatusCard>
          <SmartScannerView
            embedded
            active={active}
            target={pending.target}
            initialInput={pending.input}
            initialBarcode={!pending.input}
            saving={saving}
            onClose={() => setPending(null)}
            onSave={async (food) => {
              await saveFood(food);setSaved("已存入冰箱");
              setValue("");
            }}
            onSaveSupplement={async (log) => {
              await saveSupplement(log);setSaved("已存入补剂");
              setValue("");
            }}
          />
        </InlineUploadStatusCard>
      )}
      <OmniInputBar
        ref={inputRef}
        value={value}
        onChangeText={(text) => {setValue(text);setSaved("");setError("");}}
        target={target}
        listening={voice.listening}
        disabled={blocked}
        onAddPress={() => openMenu("add")}
        onModeSelectPress={() => openMenu("mode")}
        onVoicePress={() => {
          if (!voice.listening)
            base.current = value ? value.trimEnd() + " " : "";
          inputRef.current?.focus();
          void voice.toggle();
        }}
        onSend={() => {
          if (!value.trim() || blocked || pending) return;
          Keyboard.dismiss();
          setError("");
          setSaved("");
          setPending({ target, input: { mode: "manual", text: value.trim() } });
        }}
      />
      <Modal
        visible={!!menu && active}
        transparent
        animationType="fade"
        onRequestClose={() => closeMenu()}
        onDismiss={() => {
          const action = afterDismiss.current;
          afterDismiss.current = null;
          if (isActive.current) action?.();
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            padding: 16,
            backgroundColor: "rgba(0,0,0,.4)",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭录入菜单"
            onPress={() => closeMenu()}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: "#242424",
              borderRadius: 28,
              padding: 12,
              gap: 6,
              marginBottom: menu === "mode" ? 90 : 20,
              alignSelf: menu === "mode" ? "flex-end" : "stretch",
              minWidth: 210,
            }}
          >
            <Text style={{ color: "#aaa", padding: 12 }}>
              {menu === "mode"
                ? "选择录入目标"
                : `添加到${target === "food" ? "冰箱" : "补剂库"}`}
            </Text>
            {(menu === "mode"
              ? [
                  { label: "存入冰箱", action: () => setTarget("food") },
                  {
                    label: "存入补剂库",
                    action: () => setTarget("supplement"),
                  },
                ]
              : [
                  {
                    label: "拍照识别",
                    action: () => {
                      void photo(true);
                    },
                  },
                  {
                    label: "从相册上传",
                    action: () => {
                      void photo(false);
                    },
                  },
                  { label: "扫描条形码", action: () => {setSaved("");setError("");setPending({ target });} },
                ]
            ).map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={() => closeMenu(item.action)}
                style={{
                  padding: 16,
                  borderRadius: 9999,
                  backgroundColor: "#333",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16 }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => closeMenu()}
              style={{ padding: 16 }}
            >
              <Text style={{ color: "#ccc", textAlign: "center" }}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
