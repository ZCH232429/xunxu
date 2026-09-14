(()=>{
 if(!window.ReactNativeWebView)return;
 document.documentElement.classList.add('native-tab-shell');
 let waitingTab=null;
 const applyTab=()=>{if(!waitingTab)return;const button=document.querySelector('[data-page="'+waitingTab+'"]');if(!button)return;waitingTab=null;window.__xunxuSelectingTab=true;try{button.click()}finally{window.__xunxuSelectingTab=false}};
 new MutationObserver(applyTab).observe(document.documentElement,{childList:true,subtree:true});
 window.__xunxuSelectTab=page=>{if(page==='nutrition')return;waitingTab=page;applyTab()};
 const pending=new Map();let serial=0;
 window.nativeRpc=(method,data)=>new Promise((resolve,reject)=>{const id=String(++serial);const timer=setTimeout(()=>{pending.delete(id);reject(Error('操作超时，请重试'))},150000);pending.set(id,{resolve,reject,timer});window.ReactNativeWebView.postMessage(JSON.stringify({id,method,data}))});
 window.__nativeReply=response=>{const p=pending.get(response.id);if(!p)return;clearTimeout(p.timer);pending.delete(response.id);response.error?p.reject(Error(response.error)):p.resolve(response.result)};
 document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-page],[data-action^="goto-"]');
  const page=target?.dataset.page||target?.dataset.action?.slice(5);
  if(page&&['overview','body','training','nutrition','review','settings'].includes(page)&&!window.__xunxuSelectingTab){event.preventDefault();event.stopImmediatePropagation();window.nativeRpc('tab',{page}).catch(e=>alert(e.message));return}
  const health=event.target.closest('[data-home-health]');if(health){event.preventDefault();health.disabled=true;try{await window.nativeRpc('health',{action:health.dataset.homeHealth})}catch(e){alert(e.message)}finally{health.disabled=false}return}
  const input=event.target.closest('input[type=file][name="cameraPhoto"],input[type=file][name="albumPhoto"]');
  const settings=event.target.closest('[data-native-settings]');if(settings){event.preventDefault();window.nativeRpc('settings',{});return}
  if(!input)return;event.preventDefault();const form=input.closest('form');const status=form.querySelector('#food-progress');try{const image=await window.nativeRpc('photo',{camera:input.name==='cameraPhoto'});if(image&&form.isConnected){form.dataset.nativeImage=image;status.textContent='照片已准备好，点击下方识别按钮';}}catch(e){status.textContent=e.message}
 },true);
 const originalOpen=window.open;window.open=(url,...args)=>{try{const u=new URL(url,location.href);if(u.origin!==location.origin){window.nativeRpc('open',{url:u.href});return null}}catch{}return originalOpen.call(window,url,...args)};
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const url=new URL(link.href,location.href);if(url.protocol==='https:'&&url.origin!==location.origin){event.preventDefault();window.nativeRpc('open',{url:url.href})}},true);
})();
