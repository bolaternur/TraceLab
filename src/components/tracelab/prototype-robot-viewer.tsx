"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type ViewerState = "loading" | "ready" | "error";

export function PrototypeRobotViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ViewerState>("loading");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    camera.position.set(5.7, 3.8, 7.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4.2;
    controls.maxDistance = 12;
    controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotateSpeed = 0.65;

    scene.add(new THREE.HemisphereLight(0xdfe7ff, 0x111315, 2.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x6f8bff, 3.1);
    rimLight.position.set(-5, 2, -4);
    scene.add(rimLight);
    const signalLight = new THREE.PointLight(0xc8f36d, 18, 14);
    signalLight.position.set(1.5, -1.5, 3);
    scene.add(signalLight);

    const grid = new THREE.GridHelper(12, 24, 0x4169ff, 0x29303c);
    grid.position.y = -1.65;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.32;
    });
    scene.add(grid);

    let robot: THREE.Object3D | null = null;
    let disposed = false;

    new GLTFLoader().load(
      "/models/prototype-999.glb",
      (gltf) => {
        if (disposed) return;
        robot = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(robot);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        const scale = 2.85 / Math.max(maxDimension, 0.001);
        robot.scale.setScalar(scale);
        robot.position.set(-center.x * scale, -center.y * scale - 0.15, -center.z * scale);
        robot.rotation.set(-0.08, -0.55, 0);
        robot.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = false;
          object.receiveShadow = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.metalness = Math.max(material.metalness, 0.42);
              material.roughness = Math.min(Math.max(material.roughness, 0.34), 0.72);
            }
          });
        });
        scene.add(robot);
        controls.target.set(0, -0.2, 0);
        controls.update();
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

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="prototype-viewer" aria-label="Interactive 3D model of Prototype 999">
      <div ref={mountRef} className="absolute inset-0" />
      {state === "loading" ? (
        <div className="prototype-viewer-status"><span className="prototype-loader" /> Calibrating model</div>
      ) : null}
      {state === "error" ? (
        <div className="prototype-viewer-status text-failure">3D model unavailable</div>
      ) : null}
      <div className="prototype-viewer-hint">Drag to inspect · Scroll to zoom</div>
    </div>
  );
}
