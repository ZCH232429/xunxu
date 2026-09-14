import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Session} from '@supabase/supabase-js';
import * as Apple from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase} from '../lib/supabase';
import {cancelUserReminders} from '../lib/fridge/SupplementReminders';
import BasicsGate from './basics-gate';

WebBrowser.maybeCompleteAuthSession();
const Account=createContext<Session|null>(null);
export const useAccount=()=>useContext(Account);
export default function AuthGate({children}:{children:React.ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true);
 const [method,setMethod]=useState<'email'|'phone'>('email'),[address,setAddress]=useState(''),[otp,setOtp]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[cooldown,setCooldown]=useState(0),[appleAvailable,setAppleAvailable]=useState(false),[showDirect,setShowDirect]=useState(true),[existingOnly,setExistingOnly]=useState(false);
 const lastUser=useRef<string|null>(null);
 const insets=useSafeAreaInsets();
 useEffect(()=>{
  let alive=true;
  Apple.isAvailableAsync().then(v=>{if(alive)setAppleAvailable(v)}).catch(()=>{});
  if(!supabase){setLoading(false);return()=>{alive=false}}
  const client=supabase;
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,value)=>{if(!value&&lastUser.current){void cancelUserReminders(lastUser.current).catch(()=>{});lastUser.current=null}if(value)lastUser.current=value.user.id;if(alive){setSession(value);setLoading(false)}});
  client.auth.getSession().then(({data,error})=>{if(alive){if(error)setNotice('登录状态读取失败，请重新登录');setSession(data.session);setLoading(false)}}).catch(()=>{if(alive){setNotice('无法读取登录状态');setLoading(false)}});
  if(AppState.currentState==='active')client.auth.startAutoRefresh();
  const listener=AppState.addEventListener('change',state=>state==='active'?client.auth.startAutoRefresh():client.auth.stopAutoRefresh());
  return()=>{alive=false;subscription.unsubscribe();listener.remove();client.auth.stopAutoRefresh()};
 },[]);
 useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(cooldown-1),1000);return()=>clearTimeout(timer)},[cooldown]);
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setNotice('');try{await action()}catch(e){setNotice(e instanceof Error?e.message:'登录失败，请重试')}finally{setBusy(false)}}
 async function send(){await run(async()=>{
  if(!supabase)throw Error('云服务尚未配置');
  const target=address.trim();
  if(method==='phone'&&!/^\+[1-9]\d{7,14}$/.test(target))throw Error('请输入带国家区号的手机号，例如 +821012345678');
  if(method==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))throw Error('请输入有效邮箱');
  const {error}=await supabase.auth.signInWithOtp(method==='email'?{email:target,options:{shouldCreateUser:!existingOnly}}:{phone:target,options:{shouldCreateUser:!existingOnly}});
  if(error)throw error;setSent(true);setCooldown(60);setNotice('验证码已发送，请查收。首次验证后自动创建账号。');
 })}
 async function verify(){await run(async()=>{
  if(!supabase)throw Error('云服务尚未配置');if(!/^\d{6,10}$/.test(otp.trim()))throw Error('请输入收到的验证码');
  const {error}=await supabase.auth.verifyOtp(method==='email'?{email:address.trim(),token:otp.trim(),type:'email'}:{phone:address.trim(),token:otp.trim(),type:'sms'});
  if(error)throw error;
 })}
 async function appleLogin(){await run(async()=>{
  if(!supabase)throw Error('云服务尚未配置');
  const nonce=Crypto.randomUUID();const hash=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,nonce);
  const credential=await Apple.signInAsync({requestedScopes:[Apple.AppleAuthenticationScope.EMAIL,Apple.AppleAuthenticationScope.FULL_NAME],nonce:hash});
  if(!credential.identityToken)throw Error('Apple 未返回登录凭据');
  const {error}=await supabase.auth.signInWithIdToken({provider:'apple',token:credential.identityToken,nonce});if(error)throw error;
 })}
 async function googleLogin(){await run(async()=>{
  if(!supabase)throw Error('云服务尚未配置');
  if(process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED!=='true')throw Error('Google 登录尚未完成配置，请先使用邮箱登录。');
  const redirectTo=Linking.createURL('auth/callback');
  const {data,error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true}});
  if(error)throw error;if(!data.url)throw Error('Google 登录地址生成失败');
  const result=await WebBrowser.openAuthSessionAsync(data.url,redirectTo);
  if(result.type!=='success')return;
  const params=new URLSearchParams(result.url.split('#')[1]||result.url.split('?')[1]||'');
  const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');
  if(!access_token||!refresh_token)throw Error('Google 登录回调缺少凭据，请检查 Supabase Redirect URL');
  const {error:setError}=await supabase.auth.setSession({access_token,refresh_token});if(setError)throw setError;
 })}
 if(loading)return <View style={s.loading}><ActivityIndicator color="#d7ff7a"/><Text style={s.light}>正在恢复登录…</Text></View>;
 if(session)return <Account.Provider value={session}><BasicsGate key={session.user.id} userId={session.user.id}>{children}</BasicsGate></Account.Provider>;
 const enabled=!!supabase&&(method==='email'||process.env.EXPO_PUBLIC_PHONE_AUTH_ENABLED==='true');
 return <KeyboardAvoidingView style={{flex:1,backgroundColor:'#111'}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,paddingTop:insets.top+24,paddingBottom:insets.bottom+24,gap:12}}>
  <View style={[s.card,{backgroundColor:'#d7ff7a'}]}><Text style={s.eyebrow}>循序 · YOUR PACE</Text><Text style={s.title}>自己的节奏。{'\n'}自己的档案。</Text><Text style={s.body}>登录后，将身体、训练与饮食记录保存在你的云端账户。</Text></View>
  {showDirect&&<View style={[s.card,{backgroundColor:'#baf3dd'}]}><Text style={s.heading}>{existingOnly?'账户登录':'注册 / 登录'}</Text><View style={{flexDirection:'row',gap:8}}>{(['email','phone'] as const).map(value=><Pressable key={value} disabled={busy} onPress={()=>{setMethod(value);setSent(false);setAddress('');setOtp('');setNotice('')}} style={[s.pill,{flex:1,backgroundColor:method===value?'#111':'#fff'}]}><Text style={{textAlign:'center',color:method===value?'#fff':'#111'}}>{value==='email'?'邮箱':'手机号'}</Text></Pressable>)}</View>
   {!supabase&&<Text style={s.body}>云服务尚未配置。完成 Supabase 项目接入后即可注册。</Text>}
   {method==='phone'&&process.env.EXPO_PUBLIC_PHONE_AUTH_ENABLED!=='true'&&<Text style={s.body}>短信注册尚未启用，请先使用邮箱。</Text>}
   <TextInput accessibilityLabel={method==='email'?'邮箱地址':'含国家区号的手机号'} style={s.input} value={address} editable={!busy&&!sent} onChangeText={setAddress} placeholder={method==='email'?'邮箱地址':'手机号（含 +86 / +82 等区号）'} placeholderTextColor="#666" autoCapitalize="none" autoCorrect={false} keyboardType={method==='email'?'email-address':'phone-pad'}/>
   {sent&&<><TextInput style={s.input} accessibilityLabel="验证码" value={otp} onChangeText={setOtp} placeholder="验证码" placeholderTextColor="#666" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"/><Pressable disabled={busy} style={[s.pill,{backgroundColor:'#111'}]} onPress={verify}><Text style={s.centerLight}>{busy?'正在验证…':'验证并进入'}</Text></Pressable><Pressable disabled={busy} onPress={()=>{setSent(false);setOtp('')}}><Text style={s.body}>修改邮箱 / 手机号</Text></Pressable></>}
   <Pressable disabled={!enabled||busy||cooldown>0} style={[s.pill,{backgroundColor:'#fff',opacity:!enabled||busy||cooldown>0?.5:1}]} onPress={send}><Text style={s.center}>{cooldown>0?`${cooldown} 秒后可重发`:sent?'重新发送验证码':'发送验证码'}</Text></Pressable>
   {!!notice&&<Text accessibilityLiveRegion="polite" selectable style={s.body}>{notice}</Text>}
   <Text style={s.body}>首次验证会创建新账号；已有账号直接登录。</Text>
  </View>}
  <View style={[s.card,{backgroundColor:'#f6c9dd'}]}><Text style={s.heading}>快捷登录</Text><Pressable disabled={busy||!supabase} style={[s.pill,{backgroundColor:'#fff'}]} onPress={googleLogin}><Text style={s.center}>G  使用 Google 账户继续</Text></Pressable>{appleAvailable&&supabase&&process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED==='true'?<View pointerEvents={busy?'none':'auto'}><Apple.AppleAuthenticationButton buttonType={Apple.AppleAuthenticationButtonType.CONTINUE} buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK} cornerRadius={26} style={{height:54,width:'100%'}} onPress={appleLogin}/></View>:<Pressable disabled style={[s.pill,{backgroundColor:'#111',opacity:.55}]}><Text style={s.centerLight}>使用 Apple 账户继续</Text></Pressable>}<Pressable onPress={()=>{setShowDirect(true);setExistingOnly(true);setSent(false);setOtp('');setNotice('请输入已有账户的邮箱或手机号')}} style={{padding:8}}><Text style={[s.body,{textAlign:'center',fontWeight:'700'}]}>已有账户，直接登录</Text></Pressable></View>
  {!!notice&&!showDirect&&<Text style={s.light}>{notice}</Text>}
  {!!notice&&!showDirect&&<Text style={s.light}>{notice}</Text>}

 </ScrollView></KeyboardAvoidingView>;
}
const s=StyleSheet.create({loading:{flex:1,backgroundColor:'#111',alignItems:'center',justifyContent:'center',gap:18},light:{color:'#fff'},centerLight:{color:'#fff',textAlign:'center',fontWeight:'700'},center:{color:'#111',textAlign:'center',fontWeight:'700'},card:{padding:24,borderRadius:32,gap:16},eyebrow:{color:'#111',fontSize:12},title:{fontFamily:'PingFang SC',fontSize:40,fontWeight:'800',color:'#111'},heading:{fontFamily:'PingFang SC',fontSize:26,fontWeight:'700',color:'#111'},body:{fontFamily:'PingFang SC',fontSize:14,lineHeight:22,color:'#111'},pill:{padding:17,borderRadius:999},input:{backgroundColor:'#fff',color:'#111',fontFamily:'PingFang SC',fontSize:16,padding:18,borderRadius:24}});
