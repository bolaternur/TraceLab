"use client";
import { useEffect, useRef, useState } from "react";

export type ModelLabels={loading:string;error:string;retry:string;cancel:string;reset:string;wireframe:string;solid:string;fullscreen:string;hint:string;download:string;zoomIn:string;zoomOut:string;viewer:string};
export function WorkspaceModelViewer({src,title,labels}:{src:string;title:string;labels:ModelLabels}) {
  const mount=useRef<HTMLDivElement>(null),controller=useRef<AbortController|null>(null);
  const actions=useRef({reset:()=>{},wireframe:(_value:boolean)=>{},zoom:(_factor:number)=>{}});
  const [attempt,setAttempt]=useState(0),[status,setStatus]=useState<"loading"|"ready"|"error"|"cancelled">("loading");
  const [progress,setProgress]=useState(0),[wireframe,setWireframe]=useState(false);
  useEffect(()=>{
    const host=mount.current;if(!host)return;
    let disposed=false,cleanup=()=>{};
    const abort=new AbortController();controller.current=abort;
    setStatus("loading");setProgress(0);setWireframe(false);
    void(async()=>{
      const [THREE,{GLTFLoader},{OrbitControls},response]=await Promise.all([
        import("three"),import("three/examples/jsm/loaders/GLTFLoader.js"),import("three/examples/jsm/controls/OrbitControls.js"),
        fetch(src,{credentials:"same-origin",cache:"no-store",signal:abort.signal})]);
      if(!response.ok || !response.body)throw new Error("model unavailable");
      const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
      const total=Number(response.headers.get("content-length"));
      try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;
        if(size>25*1024*1024){await reader.cancel();throw new Error("model too large");}
        chunks.push(chunk.value);if(!disposed)setProgress(total>0?Math.min(95,Math.round(size/total*95)):0);
      }}finally{reader.releaseLock();}
      if(disposed || abort.signal.aborted)return;
      const bytes=new Uint8Array(size);let offset=0;chunks.forEach(chunk=>{bytes.set(chunk,offset);offset+=chunk.length;});
      const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;host.appendChild(renderer.domElement);
      renderer.domElement.tabIndex=0;renderer.domElement.setAttribute("aria-label",title);
      const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.01,1000);
      const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;
      scene.add(new THREE.HemisphereLight(0xffffff,0x544759,2.5));
      const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(5,7,6);scene.add(light);
      let frame=0,settle=0,rendering=false;let model:import("three").Object3D|undefined;
      const geometries=new Set<import("three").BufferGeometry>(),materials=new Set<import("three").Material>(),textures=new Set<import("three").Texture>();
      function release(object:import("three").Object3D){object.traverse(child=>{
        const mesh=child as import("three").Mesh;if(mesh.geometry)geometries.add(mesh.geometry);
        if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
          materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
        }});}
      // OrbitControls emits change during update(). Never schedule a second RAF
      // or reset the settling budget from inside our own render callback.
      const render=()=>{frame=0;if(disposed || document.hidden)return;rendering=true;controls.update();renderer.render(scene,camera);rendering=false;if(settle-->0)frame=requestAnimationFrame(render);};
      const draw=()=>{if(rendering)return;settle=20;if(!frame&&!disposed)frame=requestAnimationFrame(render);};
      controls.addEventListener("change",draw);
      const resize=()=>{const width=Math.max(host.clientWidth,1),height=Math.max(host.clientHeight,1);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();};
      const observer=new ResizeObserver(resize);observer.observe(host);
      const visible=()=>{if(!document.hidden)draw();};document.addEventListener("visibilitychange",visible);
      cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener("visibilitychange",visible);controls.dispose();
        if(model)release(model);geometries.forEach(g=>g.dispose());textures.forEach(t=>{const image=t.source?.data as {close?:()=>void}|undefined;if(typeof image?.close==="function")image.close();t.dispose();});
        materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
      const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith("blob:"))return url;throw new Error("external model resource refused");});
      const gltf=await new GLTFLoader(manager).parseAsync(bytes.buffer,"");
      if(disposed || abort.signal.aborted){model=gltf.scene;cleanup();if(!disposed)setStatus("cancelled");return;}
      model=gltf.scene;scene.add(model);
      const bounds=new THREE.Box3().setFromObject(model),size3=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      const radius=Math.max(size3.x,size3.y,size3.z,.01);model.position.sub(center);
      const home=new THREE.Vector3(radius*1.3,radius*.8,radius*1.7);
      camera.near=Math.max(radius/1000,.001);camera.far=Math.max(radius*40,100);camera.updateProjectionMatrix();
      controls.minDistance=radius*.2;controls.maxDistance=radius*10;
      const reset=()=>{camera.position.copy(home);controls.target.set(0,0,0);controls.update();draw();};
      actions.current={reset,zoom:factor=>{camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();draw();},
        wireframe:enabled=>{model?.traverse(child=>{const mesh=child as import("three").Mesh;if(!mesh.material)return;
          for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])if("wireframe" in mat)mat.wireframe=enabled;});draw();}};
      resize();reset();setProgress(100);setStatus("ready");
    })().catch(()=>{if(!disposed){cleanup();setStatus(abort.signal.aborted?"cancelled":"error");}});
    return()=>{disposed=true;abort.abort();cleanup();actions.current={reset:()=>{},wireframe:()=>{},zoom:()=>{}};};
  },[src,title,attempt]);
  return <section className="wm-model" aria-label={labels.viewer+": "+title}>
    <div className="wm-model-stage" ref={mount}/>
    <div className="wm-model-tools">
      <button onClick={()=>actions.current.reset()} disabled={status!=="ready"}>{labels.reset}</button>
      <button onClick={()=>{actions.current.wireframe(!wireframe);setWireframe(value=>!value);}} disabled={status!=="ready"} aria-pressed={wireframe}>{wireframe?labels.solid:labels.wireframe}</button>
      <button onClick={()=>actions.current.zoom(.8)} disabled={status!=="ready"} aria-label={labels.zoomIn}>+</button>
      <button onClick={()=>actions.current.zoom(1.25)} disabled={status!=="ready"} aria-label={labels.zoomOut}>−</button>
      <button onClick={()=>void mount.current?.parentElement?.requestFullscreen().catch(()=>{})}>{labels.fullscreen}</button>
    </div>
    {status==="loading"?<div className="wm-model-status" role="status"><p>{labels.loading} {progress?`${progress}%`:""}</p><progress max="100" value={progress||undefined}/><button onClick={()=>controller.current?.abort()}>{labels.cancel}</button></div>:null}
    {status==="error"||status==="cancelled"?<div className="wm-model-status" role="status"><p>{labels.error}</p><button onClick={()=>setAttempt(n=>n+1)}>{labels.retry}</button><a href={src} download>{labels.download}</a></div>:null}
    <p className="wm-model-hint">{labels.hint}</p>
  </section>;
}
