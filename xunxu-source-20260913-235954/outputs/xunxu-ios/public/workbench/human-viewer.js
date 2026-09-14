import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {guideDetails} from './guide-data.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),mix=(a,b,t)=>a+(b-a)*t;
export async function mountHuman(host,id){
 const info=guideDetails[id];if(!info)throw Error('未配置该动作的人体指导');
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e8ede6');
 const camera=new THREE.PerspectiveCamera(34,1,.01,60);camera.position.set(2.6,1.8,3.3);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;host.append(renderer.domElement);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.94,0);controls.enableDamping=true;controls.minDistance=1.6;controls.maxDistance=6;controls.maxPolarAngle=Math.PI*.53;controls.enablePan=true;
 scene.add(new THREE.HemisphereLight(0xffffff,0x738071,2.4));let sun=new THREE.DirectionalLight(0xfff5e6,3);sun.position.set(3,5,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-2;sun.shadow.camera.right=2;sun.shadow.camera.top=3;sun.shadow.camera.bottom=-2;sun.shadow.bias=-.00015;scene.add(sun);let fill=new THREE.DirectionalLight(0xd2e8ff,1.5);fill.position.set(-3,3,-2);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.CircleGeometry(2.1,80),new THREE.MeshStandardMaterial({color:0xd7dfd1,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.006;scene.add(floor);
 const grid=new THREE.GridHelper(3.2,16,0xb8c5ad,0xc6d0be);grid.position.y=-.004;grid.material.transparent=true;grid.material.opacity=.32;scene.add(grid);
 let disposed=false,raf;const gltf=await new GLTFLoader().loadAsync('/workbench/models/training-human.glb');if(disposed)return;
 const model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});scene.add(model);model.updateMatrixWorld(true);
 const bones={},rest={};model.traverse(b=>{if(b.isBone){bones[b.name]=b;rest[b.name]={pos:b.position.clone(),q:b.quaternion.clone(),world:b.getWorldQuaternion(new THREE.Quaternion()),dir:V(0,1,0).applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()))}}});
 // GLTFLoader sanitizes punctuation in node names; resolve both spellings.
 const bone=n=>bones[n]||bones[n.replaceAll('.','')];const restOf=n=>rest[bone(n).name];
 const wp=n=>bone(n).getWorldPosition(V());
 const setDir=(name,dir)=>{const b=bone(name),r=restOf(name),world=new THREE.Quaternion().setFromUnitVectors(r.dir,dir.clone().normalize()).multiply(r.world);b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));b.updateWorldMatrix(false,true)};
 const reset=()=>{for(const [n,b]of Object.entries(bones)){b.position.copy(rest[n].pos);b.quaternion.copy(rest[n].q)}model.updateMatrixWorld(true)};
 function ik(start,target,pole,a,b){let dir=target.clone().sub(start),d=THREE.MathUtils.clamp(dir.length(),Math.abs(a-b)+.001,a+b-.001);dir.normalize();const mid=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-mid*mid));let toward=pole.clone().sub(start);toward.addScaledVector(dir,-toward.dot(dir)).normalize();return {joint:start.clone().addScaledVector(dir,mid).addScaledVector(toward,height),end:start.clone().addScaledVector(dir,d)}}
 const metal=new THREE.MeshStandardMaterial({color:0x4d5653,metalness:.75,roughness:.3}),pad=new THREE.MeshStandardMaterial({color:0x253b34,roughness:.75}),weightMat=new THREE.MeshStandardMaterial({color:0x222b27,metalness:.2,roughness:.72});const frameMat=new THREE.MeshStandardMaterial({color:0x6f8774,transparent:true,opacity:.17,depthWrite:false,roughness:.6});const equipment=new THREE.Group();scene.add(equipment);
 function box(w,h,d,pos,mat=pad){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.copy(pos);o.castShadow=true;o.receiveShadow=true;equipment.add(o);return o}
 function cylinder(r,len,pos,axis=V(1,0,0),mat=metal){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,24),mat);o.position.copy(pos);o.quaternion.setFromUnitVectors(V(0,1,0),axis);o.castShadow=true;equipment.add(o);return o}
 const bar=new THREE.Group();equipment.add(bar);const rod=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,1.1,20),metal);rod.rotation.z=Math.PI/2;bar.add(rod);for(const s of [-1,1]){let p=new THREE.Mesh(new THREE.CylinderGeometry(.125,.125,.065,32),weightMat);p.rotation.z=Math.PI/2;p.position.x=s*.43;bar.add(p)}
 function dumbbell(){const g=new THREE.Group(),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.22,16),metal);shaft.rotation.z=Math.PI/2;g.add(shaft);for(const s of [-1,1]){let p=new THREE.Mesh(new THREE.CylinderGeometry(.062,.062,.07,12),weightMat);p.rotation.z=Math.PI/2;p.position.x=s*.09;g.add(p)}equipment.add(g);return g}
 const db=[dumbbell(),dumbbell()];const grips=[cylinder(.016,.12,V()),cylinder(.016,.12,V())];const vhandle=new THREE.Group();equipment.add(vhandle);for(const x of [-.13,.13]){let handle=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.18,16),metal);handle.rotation.x=Math.PI/2;handle.position.x=x;vhandle.add(handle)}const crossbar=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.26,16),metal);crossbar.rotation.z=Math.PI/2;vhandle.add(crossbar);
 const cableGeo=[new THREE.BufferGeometry().setFromPoints([V(),V()]),new THREE.BufferGeometry().setFromPoints([V(),V()])],cables=cableGeo.map(g=>{let l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x66736a}));equipment.add(l);return l});
 const seated=['row','wide','neutral'].includes(id),lying=['bench','incline','triceps'].includes(id);
 if(lying){camera.position.set(2.1,1.7,2.2);controls.target.set(0,.65,-.08);let bench=box(.34,.085,1.15,V(0,.455,-.28));if(id==='incline'){bench.rotation.x=-.60;bench.position.set(0,.67,-.27)}for(const z of [-.7,.2])box(.055,.42,.055,V(0,.21,z),metal)}
 if(seated){box(.40,.07,.35,V(0,.44,-.02));box(.055,.43,.055,V(0,.22,0),metal);if(id==='row')box(.27,.38,.07,V(0,1.0,.17))}
 if(id==='bulgarian'){box(.55,.07,.32,V(0,.38,-.58));for(const x of [-.20,.20])box(.04,.35,.04,V(x,.18,-.58),metal)}
 if(id==='dips'){for(const x of [-.29,.29]){cylinder(.027,.75,V(x,1.16,0),V(0,0,1));box(.035,1.15,.035,V(x,.575,-.23),metal)}}
 if(id==='extension'){let support=box(.44,.13,.30,V(0,.90,-.08));support.rotation.x=.62;box(.07,.85,.07,V(0,.43,-.23),metal);cylinder(.065,.45,V(0,.29,-.52))}
 if(['cablehigh','cablelow','cables','row'].includes(info.equipment)){for(const x of info.equipment==='cables'?[-1.05,1.05]:[-1.05]){box(.045,2.2,.045,V(x,1.1,.9),frameMat);box(.20,.06,.36,V(x,.03,.9),metal)}}
 let phase=0,playing=true,speed=.7,last=performance.now(),handPositions=[];
 function pose(t){const p=.5-.5*Math.cos(t*Math.PI*2);reset();let hip=V(0,.95,0),tilt=0,feet=[V(.105,.105,.035),V(-.105,.105,.035)];
 if(id==='goblet'){hip.set(0,mix(.94,.59,p),mix(0,-.23,p));tilt=.10+.35*p;feet=[V(.17,.105,.07),V(-.17,.105,.07)]}
 if(id==='rdl'){hip.set(0,.95-.075*p,-.25*p);tilt=.98*p}
 if(id==='singleRdl'){hip.set(.04,.95-.025*p,-.10*p);tilt=1.0*p;feet[1]=V(-.11,.105+.57*p,-.75*p)}
 if(id==='bulgarian'){hip.set(.05,.94-.32*p,-.02-.04*p);tilt=.12+.14*p;feet=[V(.11,.105,.34),V(-.09,.44,-.57)]}
 if(lying){hip.set(0,.56,.09);tilt=id==='incline'?-.96:-Math.PI/2;feet=[V(.22,.105,.43),V(-.22,.105,.43)]}
 if(id==='dips'){hip.set(0,1.08-.21*p,0);tilt=.17;feet=[V(.10,.35,-.26),V(-.10,.35,-.26)]}
 if(seated){hip.set(0,.65,0);tilt=.08;feet=[V(.15,.105,.47),V(-.15,.105,.47)]}
 if(id==='onepull'){hip.set(0,.66,0);tilt=.06;feet=[V(.15,.105,.41),V(-.12,.105,-.42)]}
 if(id==='extension'){hip.set(0,.95,-.04);tilt=.65+1.00*p;feet=[V(.1,.32,-.51),V(-.1,.32,-.51)]}
 bone('hips').position.copy(hip);model.updateMatrixWorld(true);const torso=V(0,Math.cos(tilt),Math.sin(tilt));for(const n of ['hips','spine','chest','neck','head'])setDir(n,torso);
 for(let i=0;i<2;i++){let s=i===0?'L':'R',h=wp('thigh.'+s),pole=h.clone().add(V(0,-.30,.9));if(id==='extension')pole=h.clone().add(V(0,-1,.3));const leg=ik(h,feet[i],pole,.4403,.4056);setDir('thigh.'+s,leg.joint.clone().sub(h));setDir('shin.'+s,leg.end.clone().sub(leg.joint));setDir('foot.'+s,V(0,-.045,.155))}
 handPositions=[];
 for(let i=0;i<2;i++){const sign=i===0?1:-1,s=i===0?'L':'R',shoulder=wp('upper_arm.'+s);let hand=shoulder.clone().add(V(sign*.065,-.478,.05)),pole=shoulder.clone().add(V(sign*.20,-.25,-.05)),elbowFixed=null;
 if(id==='rdl')hand.z=.13;if(id==='bench'||id==='incline'){hand=shoulder.clone().add(V(sign*(.025+.08*p),mix(.48,.14,p),mix(.01,.16,p)));pole=shoulder.clone().add(V(sign*.38,-.18,.25))}
 if(id==='triceps'){elbowFixed=shoulder.clone().add(V(sign*.015,.267,0));const theta=mix(0,1.85,p);hand=elbowFixed.clone().add(V(0,.223*Math.cos(theta),-.223*Math.sin(theta)))}
 if(id==='dips'){hand=V(sign*.29,1.16,.01);pole=shoulder.clone().add(V(sign*.32,-.15,-.28))}
 if(id==='yraise'){hand=shoulder.clone().add(V(sign*mix(.07,.34,p),mix(-.47,.29,p),mix(.06,.22,p)));pole=shoulder.clone().add(V(sign*.35,-.10,.15))}
 if(id==='onepull'&&i===0){hand=shoulder.clone().add(V(.03,mix(.43,-.20,p),mix(.18,.15,p)));pole=shoulder.clone().add(V(.26,-.12,-.03))}
 if(id==='row'&&i===0){hand=shoulder.clone().add(V(.035,mix(-.03,-.17,p),mix(.48,.16,p)));pole=shoulder.clone().add(V(.12,-.25,-.30))}
 if(id==='wide'){hand=shoulder.clone().add(V(sign*.07,-.06,mix(.47,.13,p)));pole=shoulder.clone().add(V(sign*.43,-.035,-.20))}
 if(id==='neutral'){hand=shoulder.clone().add(V(sign*.00,mix(.45,-.05,p),mix(.12,.23,p)));pole=shoulder.clone().add(V(sign*.18,-.30,-.10))}
 if(id==='curl'){elbowFixed=shoulder.clone().add(V(sign*.02,-.225,.151));const theta=mix(.10,2.35,p);hand=elbowFixed.clone().add(V(0,-.223*Math.cos(theta),.223*Math.sin(theta)))}
 if(id==='goblet'){hand=wp('chest').clone().add(V(sign*.083,.11,.22));pole=shoulder.clone().add(V(sign*.18,-.35,.20))}
 if(id==='extension'){hand=wp('chest').clone().addScaledVector(torso,.06).add(V(sign*.06,-Math.sin(tilt)*.17,Math.cos(tilt)*.17));pole=shoulder.clone().add(V(sign*.22,-.20,.17))}
 let arm=elbowFixed?{joint:elbowFixed,end:hand}:ik(shoulder,hand,pole,.27306,.225497);setDir('upper_arm.'+s,arm.joint.clone().sub(shoulder));setDir('forearm.'+s,arm.end.clone().sub(arm.joint));setDir('hand.'+s,arm.end.clone().sub(arm.joint));handPositions.push(wp('hand.'+s).add(V(sign*.009,-.044,.027).applyQuaternion(restOf('hand.'+s).world.clone().invert()).applyQuaternion(bone('hand.'+s).getWorldQuaternion(new THREE.Quaternion()))))}
 bar.visible=info.equipment==='barbell';if(bar.visible)bar.position.copy(handPositions[0]).add(handPositions[1]).multiplyScalar(.5);
 db.forEach((d,i)=>{d.visible=info.equipment==='dumbbells'||info.equipment==='goblet';d.position.copy(handPositions[i]);d.rotation.set(0,0,0);if(info.equipment==='goblet'){d.visible=i===0;d.position.copy(handPositions[0]).add(handPositions[1]).multiplyScalar(.5);d.rotation.z=Math.PI/2}});
 vhandle.visible=id==='neutral';vhandle.position.copy(handPositions[0]).add(handPositions[1]).multiplyScalar(.5);grips.forEach((g,i)=>{g.visible=['cablehigh','cablelow','cables','row'].includes(info.equipment)&&id!=='neutral'&&(i===0||['wide','curl','yraise'].includes(id));g.position.copy(handPositions[i])});cables.forEach((line,i)=>{line.visible=['cablehigh','cablelow','cables','row'].includes(info.equipment)&&(i===0||['neutral','wide','curl','yraise'].includes(id));let end=V(i===0?.65:-.65,info.equipment==='cablehigh'?2.15:.12,.90);if(id==='neutral')end=V(0,2.15,.45);if(info.equipment==='row')end=V(i===0?.65:-.65,1.03,.90);let a=line.geometry.attributes.position;a.setXYZ(0,handPositions[i].x,handPositions[i].y,handPositions[i].z);a.setXYZ(1,end.x,end.y,end.z);a.needsUpdate=true;line.geometry.computeBoundingSphere()});
 model.updateMatrixWorld(true);return p;
 }
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function tick(now){if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(playing)phase=(phase+dt*speed/6)%1;const p=pose(phase);controls.update();renderer.render(scene,camera);host.dispatchEvent(new CustomEvent('poseframe',{detail:{phase,p,step:phase<.08||phase>.93?0:phase<.5?1:2}}));raf=requestAnimationFrame(tick)}tick(performance.now());
 host.dataset.ready='true';
 const api={setPlaying(v){playing=v},setPhase(v){phase=v;playing=false;pose(phase)},setSpeed(v){speed=v},view(v){camera.position.copy(({front:V(0,1.3,3.8),side:V(3.8,1.2,0),back:V(0,1.3,-3.8),angle:V(2.6,1.8,3.3)})[v]);controls.target.set(0,lying?.75:.95,0);controls.update()},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())});renderer.dispose();renderer.domElement.remove()},debug(){return {bones:Object.keys(bones).length,vertices:15093,phase,handPositions:handPositions.map(v=>v.toArray()),hip:wp('hips').toArray()}}};
 return api;
}
