import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { validState } from "../lib/validation";
import { useAccount } from "./auth-gate";
import { cloudState } from "../lib/cloud-state";
import { supabase } from "../lib/supabase";
import { useBasics } from "./basics-gate";
import { useHealthDashboard } from "../lib/health/useHealthDashboard";

import NutritionPanel from "./fridge/NutritionPanel";
import TodayPanel from "./today/TodayPanel";
import { WorkbenchTabs, TabKey } from "./workbench-tabs";

type RequestData = { id: string; method: string; data: any };
const version = "0.3.0";
export default function WorkbenchNative() {
  const account = useAccount();
  const params = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState<TabKey>(
    params.section === "nutrition" ? "nutrition" : "overview",
  );
  const activeTab = useRef<TabKey>(tab);
  const [nutritionBusy, setNutritionBusy] = useState(false);
  const nativeBusy = useRef(false);
  const nutritionSnapshot = useRef<any>(null);
  const [sharedRecord, setSharedRecord] = useState<any>(null);
  const receiveWorkspace = useCallback((snapshot: any) => {
    nutritionSnapshot.current = snapshot;
    setSharedRecord(snapshot);
  }, []);
  const updateBusy = useCallback((value: boolean) => {
    nativeBusy.current = value;
    setNutritionBusy(value);
  }, []);
  async function selectTab(next: TabKey) {
    if (nativeBusy.current || next === activeTab.current) return;
    await queue.current;
    const snapshot = ["nutrition", "overview"].includes(activeTab.current)
      ? nutritionSnapshot.current
      : null;
    if (!["nutrition", "overview"].includes(next))
      ref.current?.injectJavaScript(
        `${snapshot ? "window.__xunxuApplyWorkspace?.(" + JSON.stringify(snapshot) + ");" : ""}window.__xunxuSelectTab?.(${JSON.stringify(next)});true;`,
      );
    nutritionSnapshot.current = null;
    activeTab.current = next;
    setTab(next);
  }

  const health = useHealthDashboard(account?.user.id || "");
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current)
        ref.current?.injectJavaScript("window.__xunxuReloadData?.();true;");
      focusedOnce.current = true;
    }, []),
  );
  const basics = useBasics();
  const ref = useRef<WebView>(null),
    insets = useSafeAreaInsets();
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [settings, setSettings] = useState(false),
    [code, setCode] = useState(""),
    [connection, setConnection] = useState(
      "输入电脑提供的测试配对码，即可连接厨房 AI。",
    ),
    [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanResolve = useRef<((code: string | null) => void) | null>(null);
  const queue = useRef(Promise.resolve());
  const host = Constants.expoConfig?.hostUri;
  const origin = host
    ? `${host.includes(".exp.direct") ? "https" : "http"}://${host}`
    : "";
  const pageUrl = origin + "/workbench/index.html";
  const webSource = useMemo(() => ({ uri: pageUrl }), [pageUrl]);
  useEffect(() => {
    if (params.section === "nutrition") void selectTab("nutrition");
  }, [params.section]);
  useEffect(() => {
    SecureStore.getItemAsync("xunxu-native-pairing").then((v) =>
      setCode(v || ""),
    );
  }, []);
  useEffect(() => {
    if (ready && activeTab.current !== "nutrition")
      ref.current?.injectJavaScript(
        `window.__xunxuSelectTab?.(${JSON.stringify(activeTab.current)});true;`,
      );
  }, [ready]);
  useEffect(() => {
    if (ready)
      ref.current?.injectJavaScript(
        `window.__xunxuHealth=${JSON.stringify({ ...health.state, saveMessage: health.saveMessage, saving: health.saving })};window.dispatchEvent(new Event('xunxu-health'));true;`,
      );
  }, [ready, health.state, health.saveMessage, health.saving]);
  const reply = (id: string, result?: any, err?: string) =>
    ref.current?.injectJavaScript(
      `window.__nativeReply&&window.__nativeReply(${JSON.stringify({ id, result, error: err })});true;`,
    );
  async function api(url: string, opt: any = {}) {
    if (url === "/api/status")
      return { portable: true, vision: true, videoKeys: [] };
    if (
      ![
        "/api/food/resolve",
        "/api/assistant",
        "/api/assistant/status",
      ].includes(url)
    )
      throw Error("此接口尚未迁移到手机测试版");
    const token = await SecureStore.getItemAsync("xunxu-native-pairing");
    if (!token) {
      setSettings(true);
      throw Error("请先输入电脑提供的测试配对码");
    }
    const response = await fetch(
      origin + url.replace("/api/", "/native-api/"),
      {
        method: opt.method || "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: opt.body,
        signal: AbortSignal.timeout(140000),
      },
    );
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "请求失败");
    return data;
  }
  async function dispatch(request: RequestData) {
    const { id, method, data } = request;
    try {
      let result: any;
      if (method === "state") {
        if (!account) throw Error("请先登录");
        if (!["/api/state/demo", "/api/state/personal"].includes(data.url))
          throw Error("档案路径无效");
        if (data.url === "/api/state/personal") {
          result = await cloudState(account.user.id, data);
          setSharedRecord(
            data.opt?.method === "PUT"
              ? {
                  version: result.version,
                  state: JSON.parse(data.opt.body).state,
                }
              : result,
          );
        } else {
          const key = "xunxu-ios-demo:" + account.user.id;
          const old = JSON.parse(
            (await AsyncStorage.getItem(key)) || "null",
          ) || { version: 0, state: data.empty };
          if (data.opt?.method === "PUT") {
            const value = JSON.parse(data.opt.body);
            validState(value.state);
            if (value.version !== old.version)
              throw Error("档案已更新，请重新加载");
            await AsyncStorage.setItem(
              key,
              JSON.stringify({ version: old.version + 1, state: value.state }),
            );
            result = { version: old.version + 1 };
          } else result = old;
        }
      } else if (method === "api") result = await api(data.url, data.opt);
      else if (method === "health") {
        if (data.action === "save")
          Alert.alert(
            "保存健康汇总",
            "将今日健康汇总保存到当前账号云端档案，不上传原始心率样本。",
            [
              { text: "取消", style: "cancel" },
              {
                text: "保存汇总",
                onPress: async () => {
                  await queue.current;
                  if (await health.save())
                    ref.current?.injectJavaScript(
                      "window.__xunxuReloadData?.();true;",
                    );
                },
              },
            ],
          );
        else {
          await queue.current;
          await health.refresh(data.action === "request");
        }
        result = true;
      } else if (method === "settings") {
        setSettings(true);
        result = true;
      } else if (method === "nutrition") {
        await selectTab("nutrition");
        result = true;
      } else if (method === "tab") {
        if (
          [
            "overview",
            "body",
            "training",
            "nutrition",
            "review",
            "settings",
          ].includes(data.page)
        )
          await selectTab(data.page);
        result = true;
      } else if (method === "basics") {
        await queue.current;
        basics.edit();
        result = true;
      } else if (method === "open") {
        if (!/^https?:\/\//.test(data.url)) throw Error("不支持的链接");
        await Linking.openURL(data.url);
        result = true;
      } else if (method === "photo") {
        if (data.camera) {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted)
            throw Error("请在 iPhone 设置中允许 Expo Go 使用相机");
        }
        const selected = data.camera
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 1,
            });
        if (selected.canceled) result = null;
        else {
          const asset = selected.assets[0];
          const context = ImageManipulator.ImageManipulator.manipulate(
            asset.uri,
          );
          if (asset.width > 1400 || asset.height > 1400)
            context.resize(
              asset.width > asset.height ? { width: 1400 } : { height: 1400 },
            );
          const image = await context.renderAsync();
          const saved = await image.saveAsync({
            format: ImageManipulator.SaveFormat.JPEG,
            compress: 0.8,
            base64: true,
          });
          result = "data:image/jpeg;base64," + saved.base64;
        }
      } else if (method === "barcode") {
        const permission = cameraPermission?.granted
          ? cameraPermission
          : await requestCameraPermission();
        if (!permission.granted) throw Error("请允许 Expo Go 使用相机");
        if (scanResolve.current) throw Error("已有扫码操作");
        result = await new Promise((resolve) => {
          scanResolve.current = resolve;
          setScanning(true);
        });
      } else if (method === "export") {
        if (typeof data.text !== "string" || data.text.length > 20000000)
          throw Error("备份数据过大");
        const file = new File(
          Paths.cache,
          "xunxu-backup-" + Date.now() + ".json",
        );
        file.write(data.text);
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/json",
          UTI: "public.json",
        });
        result = true;
      } else if (method === "import") {
        const selected = await DocumentPicker.getDocumentAsync({
          type: ["application/json", "public.json"],
          copyToCacheDirectory: true,
        });
        result = selected.canceled
          ? null
          : await new File(selected.assets[0].uri).text();
      } else throw Error("不支持的手机操作");
      reply(id, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      if (method === "state") setError(msg);
      reply(id, undefined, msg);
    }
  }
  function message(e: WebViewMessageEvent) {
    if (!e.nativeEvent.url.startsWith(pageUrl)) return;
    try {
      const request = JSON.parse(e.nativeEvent.data) as RequestData;
      if (!request.id || !request.method) return;
      if (request.method === "state")
        queue.current = queue.current.then(() => dispatch(request));
      else void dispatch(request);
    } catch {}
  }
  const finishScan = (value: string | null) => {
    setScanning(false);
    scanResolve.current?.(value);
    scanResolve.current = null;
  };
  async function connect() {
    try {
      await SecureStore.setItemAsync("xunxu-native-pairing", code.trim());
      setConnection("正在连接…");
      await api("/api/assistant/status");
      setConnection("厨房 AI 已连接");
    } catch (e) {
      setConnection(e instanceof Error ? e.message : "连接失败");
    }
  }
  if (!origin)
    return (
      <View style={{ flex: 1, backgroundColor: "#111", padding: 30 }}>
        <Text style={{ color: "#fff" }}>
          请通过 Expo Go 打开当前测试服务器。独立安装包的在线服务将在后续配置。
        </Text>
      </View>
    );
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#111",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 12,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: "#baf3dd",
            fontFamily: "PingFang SC",
            fontSize: 12,
          }}
        >
          云端档案 ·{" "}
          {account?.user.email || account?.user.phone || "Apple 账号"}
        </Text>
        <Pressable
          disabled={nutritionBusy}
          accessibilityLabel="退出账号"
          onPress={() =>
            Alert.alert("退出账号", "已保存的数据会保留在云端。", [
              { text: "取消", style: "cancel" },
              {
                text: "退出",
                onPress: async () => {
                  await queue.current;
                  const result = await supabase?.auth.signOut({
                    scope: "local",
                  });
                  if (result?.error)
                    Alert.alert("退出失败", result.error.message);
                },
              },
            ])
          }
        >
          <Text style={{ color: "#fff", padding: 8 }}>退出</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <View
          pointerEvents={
            ["nutrition", "overview"].includes(tab) ? "none" : "auto"
          }
          accessibilityElementsHidden={["nutrition", "overview"].includes(tab)}
          importantForAccessibility={
            ["nutrition", "overview"].includes(tab)
              ? "no-hide-descendants"
              : "auto"
          }
          style={{
            flex: 1,
            opacity: ["nutrition", "overview"].includes(tab) ? 0 : 1,
          }}
        >
          <WebView
            ref={ref}
            source={webSource}
            style={{ flex: 1, backgroundColor: "#111" }}
            onMessage={message}
            onLoadStart={() => setReady(false)}
            onLoadEnd={() => setReady(true)}
            onError={(e) => setError(e.nativeEvent.description)}
            onHttpError={(e) => {
              if (e.nativeEvent.url === pageUrl)
                setError("页面暂不可用（" + e.nativeEvent.statusCode + "）");
            }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={true}
            bounces={false}
            textZoom={100}
            setSupportMultipleWindows={false}
            contentInsetAdjustmentBehavior="never"
            onShouldStartLoadWithRequest={(r) => {
              if (
                r.url.startsWith(origin + "/workbench/") ||
                r.url === "about:blank"
              )
                return true;
              if (/^https?:/.test(r.url))
                Linking.openURL(r.url).catch(() => {});
              return false;
            }}
          />
        </View>
        <View
          pointerEvents={tab === "nutrition" ? "auto" : "none"}
          accessibilityElementsHidden={tab !== "nutrition"}
          importantForAccessibility={
            tab === "nutrition" ? "auto" : "no-hide-descendants"
          }
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#111",
            opacity: tab === "nutrition" ? 1 : 0,
          }}
        >
          <NutritionPanel
            active={tab === "nutrition"}
            managed
            sharedRecord={sharedRecord}
            onBusyChange={updateBusy}
            onWorkspaceChange={receiveWorkspace}
          />
        </View>
        <View
          pointerEvents={tab === "overview" ? "auto" : "none"}
          accessibilityElementsHidden={tab !== "overview"}
          importantForAccessibility={
            tab === "overview" ? "auto" : "no-hide-descendants"
          }
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#111",
            opacity: tab === "overview" ? 1 : 0,
          }}
        >
          <TodayPanel
            active={tab === "overview"}
            managed
            sharedRecord={sharedRecord}
            healthState={health.state}
            onBusyChange={updateBusy}
            onWorkspaceChange={receiveWorkspace}
          />
        </View>
      </View>
      <WorkbenchTabs
        selected={tab}
        onSelect={(next) => void selectTab(next)}
        disabled={
          nutritionBusy || (!ready && !["nutrition", "overview"].includes(tab))
        }
      />
      {!["nutrition", "overview"].includes(tab) && !ready && !error && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 30,
            left: 20,
            right: 20,
            backgroundColor: "#baf3dd",
            borderRadius: 24,
            padding: 24,
          }}
        >
          <ActivityIndicator color="#111" />
          <Text
            style={{
              color: "#111",
              textAlign: "center",
              marginTop: 12,
              fontFamily: "PingFang SC",
            }}
          >
            正在打开循序…
          </Text>
        </View>
      )}
      {!["nutrition", "overview"].includes(tab) && !!error && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 30,
            left: 20,
            right: 20,
            backgroundColor: "#f6c9dd",
            borderRadius: 24,
            padding: 24,
            gap: 14,
          }}
        >
          <Text style={{ color: "#111" }}>{error}</Text>
          <Pressable
            onPress={() => {
              setError("");
              setReady(false);
              ref.current?.reload();
            }}
          >
            <Text style={{ color: "#111", fontWeight: "700" }}>重新连接</Text>
          </Pressable>
        </View>
      )}
      <Modal
        visible={settings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettings(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#111",
            padding: 28,
            paddingTop: 48,
            gap: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "PingFang SC",
              fontSize: 28,
              fontWeight: "700",
              color: "#fff",
            }}
          >
            循序 · iOS 测试版
          </Text>
          <Text style={{ color: "#baf3dd" }}>
            版本 {version} · 登录账号的云端档案
          </Text>
          <Text style={{ color: "#fff", lineHeight: 23 }}>
            配对码只用于连接这台电脑的测试服务，不是豆包密钥。
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="电脑端测试配对码"
            placeholderTextColor="#666"
            style={{
              backgroundColor: "#fff",
              color: "#111",
              padding: 18,
              borderRadius: 24,
              fontSize: 17,
            }}
          />
          <Pressable
            onPress={connect}
            style={{
              backgroundColor: "#d7ff7a",
              borderRadius: 999,
              padding: 18,
            }}
          >
            <Text
              style={{ color: "#111", textAlign: "center", fontWeight: "700" }}
            >
              连接厨房 AI
            </Text>
          </Pressable>
          <Text selectable style={{ color: "#fff", lineHeight: 23 }}>
            {connection}
          </Text>
          <Text style={{ color: "#fff", lineHeight: 23 }}>
            在“我的设置”导入电脑备份，或导出手机档案。Apple
            健康需安装循序开发版后授权。
          </Text>
          <Pressable onPress={() => setSettings(false)} style={{ padding: 18 }}>
            <Text style={{ color: "#fff", textAlign: "center" }}>
              返回工作台
            </Text>
          </Pressable>
        </View>
      </Modal>
      <Modal visible={scanning} onRequestClose={() => finishScan(null)}>
        <View
          style={{ flex: 1, backgroundColor: "#111", paddingTop: insets.top }}
        >
          <Text style={{ color: "#fff", fontSize: 22, padding: 24 }}>
            扫描商品条形码
          </Text>
          {scanning && (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "itf14",
                  "code128",
                ],
              }}
              onBarcodeScanned={(r) => finishScan(r.data)}
            />
          )}
          <Pressable
            onPress={() => finishScan(null)}
            style={{ padding: 30, paddingBottom: insets.bottom + 24 }}
          >
            <Text style={{ color: "#fff", textAlign: "center" }}>取消</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
