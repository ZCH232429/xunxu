import {useEffect,useRef,useState} from 'react';
import {AppState,Platform,Text,View} from 'react-native';
import {CameraView,useCameraPermissions,BarcodeType} from 'expo-camera';
import {Button,s} from './ui';

const types:BarcodeType[]=['ean13','ean8','upc_a','upc_e','code128','itf14'];
export function SDKBarcodeScanner({onResult,onCancel}:{onResult:(code:string,type:string)=>void;onCancel:()=>void}){
 const [permission,requestPermission]=useCameraPermissions();
 const [mode,setMode]=useState<'choice'|'camera'>('choice'),[torch,setTorch]=useState(false),[zoom,setZoom]=useState(0),[error,setError]=useState(''),[active,setActive]=useState(AppState.currentState==='active');
 const subscription=useRef<{remove:()=>void}|null>(null),used=useRef(false),alive=useRef(true),launching=useRef(false),ownsModern=useRef(false);
 useEffect(()=>{alive.current=true;const app=AppState.addEventListener('change',state=>setActive(state==='active'));return()=>{alive.current=false;app.remove();subscription.current?.remove();if(ownsModern.current)void CameraView.dismissScanner().catch(()=>{})}},[]);
 useEffect(()=>{void start(false)},[]);
 async function allow(){if(permission?.granted)return true;return (await requestPermission()).granted}
 function accept(code:string,type:string){if(!alive.current||used.current)return;if(!/^\d{8}$|^\d{12,14}$/.test(code)){setError('这不是支持的商品条码，请对准包装上的 EAN / UPC 条码');return}used.current=true;subscription.current?.remove();subscription.current=null;onResult(code,type)}
 async function start(system:boolean){
  if(launching.current)return;launching.current=true;setError('');
  try{
   if(!await allow())throw Error('请在 iPhone 设置中允许相机访问');
   used.current=false;subscription.current?.remove();subscription.current=null;
   if(system&&Platform.OS==='ios'&&CameraView.isModernBarcodeScannerAvailable){
    setMode('choice');
    subscription.current=CameraView.onModernBarcodeScanned(async result=>{
     if(used.current||!alive.current)return;
     if(!/^\d{8}$|^\d{12,14}$/.test(result.data))return;
     subscription.current?.remove();subscription.current=null;
     try{await CameraView.dismissScanner();ownsModern.current=false;accept(result.data,result.type)}catch{setError('请关闭系统扫描后重试')}
    });
    try{ownsModern.current=true;await CameraView.launchScanner({barcodeTypes:types,isGuidanceEnabled:true,isHighlightingEnabled:true,isPinchToZoomEnabled:true});}
    catch{ownsModern.current=false;subscription.current?.remove();subscription.current=null;setMode('camera');setError('系统增强扫描暂不可用，已切换相机扫码。')}
   }else{if(ownsModern.current){await CameraView.dismissScanner();ownsModern.current=false}setMode('camera')}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'无法打开扫码相机')}finally{launching.current=false}
 }
 return <View style={{gap:12}}><Text style={s.copy}>把完整条码置于画面中央，避开反光。读码成功后自动查询商品。</Text>
 
 {mode==='camera'&&permission?.granted&&active&&<View style={{height:280,borderRadius:24,overflow:'hidden'}}><CameraView style={{flex:1}} facing="back" enableTorch={torch} zoom={zoom} barcodeScannerSettings={{barcodeTypes:types}} onMountError={()=>setError('相机启动失败，请关闭其他相机应用后重试')} onBarcodeScanned={r=>accept(r.data,r.type)}/></View>}
 {mode==='camera'&&<View style={s.row}><Button label={torch?'关闭补光':'打开补光'} onPress={()=>setTorch(v=>!v)}/><Button label={zoom===0?'放大条码':'恢复视野'} onPress={()=>setZoom(v=>v===0?.15:0)}/></View>}
 {!!error&&<Text accessibilityLiveRegion="polite" style={s.copy}>{error}</Text>}<Button label="收起扫码" onPress={onCancel}/></View>;
}
