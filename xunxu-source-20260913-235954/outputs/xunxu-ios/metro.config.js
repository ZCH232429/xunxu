const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);
const existing=config.server.enhanceMiddleware;
config.server.enhanceMiddleware=(middleware,server)=>{const next=existing?existing(middleware,server):middleware;const api=require('./server/native-api.cjs');return(req,res,done)=>api(req,res,()=>next(req,res,done))};
module.exports=config;
