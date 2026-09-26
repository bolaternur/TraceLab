"use client";

import { useEffect, useRef, useState } from "react";

type ViewerState = "loading" | "ready" | "error";

export function SecureModelViewer({ src, title, labels }: { src: string; title: string; labels: { loading: string; error: string; reset: string; wireframe: string; solid: string; fullscreen: string; hint: string } }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<() => void>(() => undefined);
  const wireframeRef = useRef<(enabled: boolean) => void>(() => undefined);
  const [state, setState] = useState<ViewerState>("loading");
  const [wireframe, setWireframe] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let cleanup = () => undefined;
    setState("loading");
    setWireframe(false);

    void (async () => {
      const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/controls/OrbitControls.js"),
      ]);
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      mount.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.autoRotateSpeed = 0.5;
      scene.add(new THREE.HemisphereLight(0xe7efff, 0x101318, 2.8));
      const key = new THREE.DirectionalLight(0xffffff, 4.5);
      key.position.set(5, 8, 6);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x718cff, 3.4);
      rim.position.set(-6, 3, -5);
      scene.add(rim);
      const signal = new THREE.PointLight(0xc8f36d, 12, 18);
      signal.position.set(2, -1, 4);
      scene.add(signal);
      const grid = new THREE.GridHelper(12, 24, 0x5f7cff, 0x29313d);
      const gridMaterial = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMaterial.forEach((material) => {
        material.transparent = true;
        material.opacity = 0.22;
      });
      scene.add(grid);

      let object: import("three").Object3D | null = null;
      let homePosition = new THREE.Vector3(5, 3.4, 6.5);
      const fit = () => {
        if (!object) return;
        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z, 0.01);
        object.position.sub(center);
        grid.position.y = -size.y / 2;
        homePosition = new THREE.Vector3(radius * 1.4, radius * 0.9, radius * 1.7);
        camera.position.copy(homePosition);
        camera.near = Math.max(radius / 1000, 0.001);
        camera.far = Math.max(radius * 40, 100);
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.minDistance = radius * 0.35;
        controls.maxDistance = radius * 8;
        controls.update();
      };
      resetRef.current = () => {
        camera.position.copy(homePosition);
        controls.target.set(0, 0, 0);
        controls.update();
      };
      wireframeRef.current = (enabled) => {
        object?.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if (material instanceof THREE.MeshStandardMaterial) material.wireframe = enabled;
          });
        });
      };

      new GLTFLoader().load(
        src,
        (gltf) => {
          if (disposed) return;
          object = gltf.scene;
          object.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => {
              if (material instanceof THREE.MeshStandardMaterial) {
                material.metalness = Math.max(material.metalness, 0.22);
                material.roughness = Math.min(Math.max(material.roughness, 0.3), 0.72);
              }
            });
          });
          scene.add(object);
          fit();
          setState("ready");
        },
        undefined,
        () => {
          if (!disposed) setState("error");
        },
      );

      const resize = () => {
        const width = Math.max(mount.clientWidth, 1);
        const height = Math.max(mount.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(mount);
      resize();
      let frame = 0;
      const render = () => {
        controls.update();
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(render);
      };
      render();

      cleanup = () => {
        window.cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        scene.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => material.dispose());
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => {
      if (!disposed) setState("error");
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [src]);

  const toggleWireframe = () => {
    const next = !wireframe;
    setWireframe(next);
    wireframeRef.current(next);
  };

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-[22px] border border-border bg-[#101317] shadow-[0_28px_80px_rgba(0,0,0,0.24)] md:min-h-[560px]" aria-label={`Interactive 3D model: ${title}`}>
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm border-white/15 bg-black/45 text-white backdrop-blur" onClick={() => resetRef.current()} disabled={state !== "ready"}>{labels.reset}</button>
        <button type="button" className="btn btn-sm border-white/15 bg-black/45 text-white backdrop-blur" onClick={toggleWireframe} disabled={state !== "ready"}>{wireframe ? labels.solid : labels.wireframe}</button>
        <button type="button" className="btn btn-sm border-white/15 bg-black/45 text-white backdrop-blur" onClick={() => mountRef.current?.parentElement?.requestFullscreen()}>{labels.fullscreen}</button>
      </div>
      {state === "loading" ? <div className="absolute inset-0 grid place-items-center text-sm text-white/75"><span className="rounded-full border border-white/15 bg-black/35 px-4 py-2 backdrop-blur">{labels.loading}</span></div> : null}
      {state === "error" ? <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-red-300">{labels.error}</div> : null}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] text-white/65 backdrop-blur">{labels.hint}</div>
    </div>
  );
}
