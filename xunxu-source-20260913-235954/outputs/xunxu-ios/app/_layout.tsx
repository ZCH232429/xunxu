import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import AuthGate from '../components/auth-gate';

export default function RootLayout() {
  return <><StatusBar style="light" /><AuthGate><Stack screenOptions={{headerStyle:{backgroundColor:'#111111'},headerTintColor:'#ffffff',headerShadowVisible:false,contentStyle:{backgroundColor:'#111111'}}}>
    <Stack.Screen name="index" options={{title:'循序',headerShown:false}} />
    <Stack.Screen name="settings" options={{title:'我的设置'}} />
    <Stack.Screen name="nutrition" options={{title:'饮食与冰箱'}} />
  </Stack></AuthGate></>;
}
