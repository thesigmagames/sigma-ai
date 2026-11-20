import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface Scene3DStudioProps {
  onSendToChat: (prompt: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type ModelPresetId = 'mech_drone' | 'crystal_reactor' | 'star_viper';
type MaterialFinishId = 'titanium' | 'neon' | 'gold' | 'carbon';
type CameraPresetId = 'iso' | 'front' | 'top' | 'detail';

const MODEL_META: Record<ModelPresetId, { title: string; subtitle: string; icon: string }> = {
  mech_drone: {
    title: 'Sigma Mech Drone',
    subtitle: 'Çok parçalı zırhlı gövde, optik vizör ve çift itici modül',
    icon: 'fa-robot'
  },
  crystal_reactor: {
    title: 'Kuantum Reaktör',
    subtitle: 'Prizmatik enerji çekirdeği, halka türbinler ve Instanced parçacıklar',
    icon: 'fa-atom'
  },
  star_viper: {
    title: 'Sigma Viper Gemisi',
    subtitle: 'Delta kanat aerodinamiği, kokpit kubbesi ve iyon motorları',
    icon: 'fa-jet-fighter-up'
  }
};

const FINISH_META: Record<
  MaterialFinishId,
  { label: string; baseColor: number; accentColor: number; emissive: number; metalness: number; roughness: number }
> = {
  titanium: {
    label: 'Titanyum Mat',
    baseColor: 0x64748b,
    accentColor: 0x38bdf8,
    emissive: 0x0ea5e9,
    metalness: 0.72,
    roughness: 0.34
  },
  neon: {
    label: 'Cyber Neon',
    baseColor: 0x1e293b,
    accentColor: 0x22d3ee,
    emissive: 0x06b6d4,
    metalness: 0.82,
    roughness: 0.22
  },
  gold: {
    label: 'Altın Krom',
    baseColor: 0xd97706,
    accentColor: 0xfef08a,
    emissive: 0xf59e0b,
    metalness: 0.92,
    roughness: 0.16
  },
  carbon: {
    label: 'Karbon Fiber',
    baseColor: 0x18181b,
    accentColor: 0xa855f7,
    emissive: 0x9333ea,
    metalness: 0.55,
    roughness: 0.45
  }
};

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return false;
    const rendererStr = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|Software|Mesa OffScreen/i.test(rendererStr);
  } catch {
    return true;
  }
}

export const Scene3DStudio: React.FC<Scene3DStudioProps> = ({ onSendToChat, onNotify }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [modelPreset, setModelPreset] = useState<ModelPresetId>('mech_drone');
  const [finish, setFinish] = useState<MaterialFinishId>('titanium');
  const [explodeRatio, setExplodeRatio] = useState(0); // 0..100
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(true);
  const [isSoftwareGpu, setIsSoftwareGpu] = useState(false);

  const explodeTargetRef = useRef(0);
  const autoRotateRef = useRef(true);
  const wireframeRef = useRef(false);
  const cameraGoalRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    explodeTargetRef.current = explodeRatio / 100;
  }, [explodeRatio]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    wireframeRef.current = wireframe;
    const scene = sceneRef.current;
    if (!scene) return;
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = wireframe;
          });
        } else if (mat && 'wireframe' in mat && !(obj as any).userData?.keepSolid) {
          (mat as THREE.MeshStandardMaterial).wireframe = wireframe;
        }
      }
    });
  }, [wireframe]);

  const applyCameraPreset = (preset: CameraPresetId) => {
    if (preset === 'iso') {
      cameraGoalRef.current = { pos: new THREE.Vector3(4.6, 3.2, 4.9), target: new THREE.Vector3(0, 0.3, 0) };
    } else if (preset === 'front') {
      cameraGoalRef.current = { pos: new THREE.Vector3(0, 1.3, 5.6), target: new THREE.Vector3(0, 0.35, 0) };
    } else if (preset === 'top') {
      cameraGoalRef.current = { pos: new THREE.Vector3(0.01, 6.2, 0.9), target: new THREE.Vector3(0, 0.2, 0) };
    } else {
      cameraGoalRef.current = { pos: new THREE.Vector3(2.4, 1.5, 2.7), target: new THREE.Vector3(0, 0.4, 0) };
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const softwareGl = detectSoftwareWebGL();
    setIsSoftwareGpu(softwareGl);

    const width = Math.max(300, container.clientWidth);
    const height = Math.max(300, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: !softwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(softwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !softwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const bgHex = 0x0b1220;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.045);
    sceneRef.current = scene;

    // Baked procedural RoomEnvironment IBL
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.72;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(4.6, 3.2, 4.9);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.0;
    controls.maxDistance = 12.0;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0.3, 0);
    controlsRef.current = controls;

    // 3-nokta sinematik ışıklandırma
    const hemi = new THREE.HemisphereLight(0xcbe2ff, 0x1e293b, 0.55);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(5, 7, 4);
    keyLight.castShadow = !softwareGl;
    keyLight.shadow.mapSize.set(softwareGl ? 512 : 1024, softwareGl ? 512 : 1024);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 20;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    // Zemin temas diski ve ince kılavuz ızgara
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.15
    });
    const floorDisc = new THREE.Mesh(new THREE.CircleGeometry(6.5, 48), floorMat);
    floorDisc.rotation.x = -Math.PI / 2;
    floorDisc.position.y = -1.25;
    floorDisc.receiveShadow = true;
    floorDisc.userData.keepSolid = true;
    scene.add(floorDisc);

    const grid = new THREE.GridHelper(12, 24, 0x1e3a8a, 0x1e293b);
    grid.position.y = -1.24;
    scene.add(grid);

    // Prosedürel çok parçalı hero model grubu
    const heroGroup = new THREE.Group();
    scene.add(heroGroup);

    const fSpec = FINISH_META[finish];
    const bodyMat = new THREE.MeshStandardMaterial({
      color: fSpec.baseColor,
      metalness: fSpec.metalness,
      roughness: fSpec.roughness,
      envMapIntensity: 1.0,
      wireframe: wireframeRef.current
    });
    const darkJointMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.65,
      roughness: 0.5,
      wireframe: wireframeRef.current
    });
    const accentGlowMat = new THREE.MeshStandardMaterial({
      color: fSpec.accentColor,
      emissive: fSpec.emissive,
      emissiveIntensity: 1.35,
      metalness: 0.2,
      roughness: 0.2,
      wireframe: wireframeRef.current
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.55,
      transparent: true,
      opacity: 0.85,
      wireframe: wireframeRef.current
    });

    const disposableGeos: THREE.BufferGeometry[] = [];
    const registerPart = (
      mesh: THREE.Object3D,
      basePos: [number, number, number],
      explodeVec: [number, number, number]
    ) => {
      mesh.position.set(...basePos);
      mesh.userData.basePos = new THREE.Vector3(...basePos);
      mesh.userData.explodeVec = new THREE.Vector3(...explodeVec);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      heroGroup.add(mesh);
    };

    if (modelPreset === 'mech_drone') {
      // 1. Zırhlı gövde çekirdeği
      const torsoGeo = new THREE.CylinderGeometry(0.62, 0.5, 0.88, 8);
      disposableGeos.push(torsoGeo);
      registerPart(new THREE.Mesh(torsoGeo, bodyMat), [0, 0.35, 0], [0, 0.45, 0]);

      // 2. Üst zırh plakası
      const capGeo = new THREE.CylinderGeometry(0.42, 0.62, 0.26, 8);
      disposableGeos.push(capGeo);
      registerPart(new THREE.Mesh(capGeo, bodyMat), [0, 0.9, 0], [0, 1.1, 0]);

      // 3. Parlayan optik vizör
      const visorGeo = new THREE.BoxGeometry(0.68, 0.16, 0.26);
      disposableGeos.push(visorGeo);
      registerPart(new THREE.Mesh(visorGeo, accentGlowMat), [0, 0.48, 0.5], [0, 0.2, 0.8]);

      // 4. Dönen jiroskop halkası
      const gyroGeo = new THREE.TorusGeometry(0.95, 0.05, 16, 48);
      disposableGeos.push(gyroGeo);
      const gyro = new THREE.Mesh(gyroGeo, accentGlowMat);
      gyro.rotation.x = Math.PI / 2.4;
      registerPart(gyro, [0, 0.28, 0], [0, -0.4, 0]);

      // 5-6. Sol ve sağ itici podlar
      const podGeo = new THREE.CapsuleGeometry(0.2, 0.58, 6, 14);
      disposableGeos.push(podGeo);
      const leftPod = new THREE.Mesh(podGeo, bodyMat);
      leftPod.rotation.z = 0.25;
      registerPart(leftPod, [-0.95, 0.42, -0.08], [-0.9, 0.25, 0]);

      const rightPod = new THREE.Mesh(podGeo, bodyMat);
      rightPod.rotation.z = -0.25;
      registerPart(rightPod, [0.95, 0.42, -0.08], [0.9, 0.25, 0]);

      // 7-8. İtici nozulları (egzoz halkaları)
      const nozzleGeo = new THREE.TorusGeometry(0.14, 0.04, 10, 20);
      disposableGeos.push(nozzleGeo);
      const nozL = new THREE.Mesh(nozzleGeo, accentGlowMat);
      nozL.rotation.x = Math.PI / 2;
      registerPart(nozL, [-1.05, 0.02, -0.08], [-1.05, -0.45, 0]);
      const nozR = new THREE.Mesh(nozzleGeo, accentGlowMat);
      nozR.rotation.x = Math.PI / 2;
      registerPart(nozR, [1.05, 0.02, -0.08], [1.05, -0.45, 0]);

      // 9. Alt sensör konisi
      const coreGeo = new THREE.ConeGeometry(0.36, 0.45, 8);
      disposableGeos.push(coreGeo);
      const coreMesh = new THREE.Mesh(coreGeo, darkJointMat);
      coreMesh.rotation.x = Math.PI;
      registerPart(coreMesh, [0, -0.25, 0], [0, -0.85, 0]);
    } else if (modelPreset === 'crystal_reactor') {
      // 1. Merkezi kuantum kristal
      const crystalGeo = new THREE.OctahedronGeometry(0.65, 0);
      disposableGeos.push(crystalGeo);
      const crystal = new THREE.Mesh(crystalGeo, accentGlowMat);
      crystal.scale.set(0.85, 1.35, 0.85);
      registerPart(crystal, [0, 0.35, 0], [0, 0.9, 0]);

      // 2-3. Dış ve iç manyetik containment halkaları
      const ringOuterGeo = new THREE.TorusGeometry(1.18, 0.065, 16, 56);
      const ringInnerGeo = new THREE.TorusGeometry(0.88, 0.045, 14, 48);
      disposableGeos.push(ringOuterGeo, ringInnerGeo);

      const ringOuter = new THREE.Mesh(ringOuterGeo, bodyMat);
      ringOuter.rotation.x = Math.PI / 3;
      registerPart(ringOuter, [0, 0.35, 0], [0, 0.25, 0.55]);

      const ringInner = new THREE.Mesh(ringInnerGeo, bodyMat);
      ringInner.rotation.y = Math.PI / 3;
      registerPart(ringInner, [0, 0.35, 0], [0.55, 0.25, -0.2]);

      // 4-7. 4 adet enerji pilonu
      const pylonGeo = new THREE.BoxGeometry(0.18, 1.3, 0.24);
      disposableGeos.push(pylonGeo);
      const dirs: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ];
      dirs.forEach(([dx, dz]) => {
        const p = new THREE.Mesh(pylonGeo, darkJointMat);
        p.lookAt(dx * 3, 0.35, dz * 3);
        registerPart(p, [dx * 1.15, 0.2, dz * 1.15], [dx * 0.95, 0, dz * 0.95]);
      });

      // 8. InstancedMesh yörünge parçacıkları (18 node)
      const instGeo = new THREE.IcosahedronGeometry(0.08, 0);
      disposableGeos.push(instGeo);
      const instMesh = new THREE.InstancedMesh(instGeo, accentGlowMat, 18);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        dummy.position.set(Math.cos(a) * 1.5, Math.sin(a * 2) * 0.25, Math.sin(a) * 1.5);
        dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);
      }
      instMesh.instanceMatrix.needsUpdate = true;
      registerPart(instMesh, [0, 0.35, 0], [0, -0.4, 0]);
    } else {
      // Sigma Viper Uzay Gemisi
      // 1. Ana burun ve gövde
      const noseGeo = new THREE.ConeGeometry(0.36, 1.8, 6);
      disposableGeos.push(noseGeo);
      const nose = new THREE.Mesh(noseGeo, bodyMat);
      nose.rotation.x = Math.PI / 2;
      registerPart(nose, [0, 0.3, 0.45], [0, 0, 0.9]);

      // 2. Arka motor gövdesi
      const aftGeo = new THREE.CylinderGeometry(0.36, 0.44, 1.1, 6);
      disposableGeos.push(aftGeo);
      const aft = new THREE.Mesh(aftGeo, darkJointMat);
      aft.rotation.x = Math.PI / 2;
      registerPart(aft, [0, 0.3, -0.8], [0, 0, -0.75]);

      // 3. Kokpit kubbesi
      const canopyGeo = new THREE.CapsuleGeometry(0.2, 0.55, 6, 12);
      disposableGeos.push(canopyGeo);
      const canopy = new THREE.Mesh(canopyGeo, glassMat);
      canopy.rotation.x = Math.PI / 2;
      registerPart(canopy, [0, 0.55, 0.05], [0, 0.85, 0.15]);

      // 4-5. Delta kanatlar
      const wingGeo = new THREE.BoxGeometry(1.15, 0.07, 0.95);
      disposableGeos.push(wingGeo);
      const leftWing = new THREE.Mesh(wingGeo, bodyMat);
      leftWing.rotation.y = 0.28;
      leftWing.rotation.z = -0.1;
      registerPart(leftWing, [-0.85, 0.24, -0.35], [-0.95, 0.1, -0.1]);

      const rightWing = new THREE.Mesh(wingGeo, bodyMat);
      rightWing.rotation.y = -0.28;
      rightWing.rotation.z = 0.1;
      registerPart(rightWing, [0.85, 0.24, -0.35], [0.95, 0.1, -0.1]);

      // 6-7. Kanat ucu lazer topları
      const gunGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.95, 10);
      disposableGeos.push(gunGeo);
      const gunL = new THREE.Mesh(gunGeo, accentGlowMat);
      gunL.rotation.x = Math.PI / 2;
      registerPart(gunL, [-1.42, 0.2, -0.2], [-1.3, 0.25, 0.4]);

      const gunR = new THREE.Mesh(gunGeo, accentGlowMat);
      gunR.rotation.x = Math.PI / 2;
      registerPart(gunR, [1.42, 0.2, -0.2], [1.3, 0.25, 0.4]);

      // 8. Arka egzoz iyon çekirdeği
      const thrusterGeo = new THREE.CylinderGeometry(0.22, 0.16, 0.2, 16);
      disposableGeos.push(thrusterGeo);
      const thruster = new THREE.Mesh(thrusterGeo, accentGlowMat);
      thruster.rotation.x = Math.PI / 2;
      registerPart(thruster, [0, 0.3, -1.42], [0, 0, -1.25]);

      // 9. Üst kuyruk dikmesi
      const finGeo = new THREE.BoxGeometry(0.07, 0.62, 0.65);
      disposableGeos.push(finGeo);
      const fin = new THREE.Mesh(finGeo, bodyMat);
      fin.rotation.x = -0.28;
      registerPart(fin, [0, 0.72, -0.82], [0, 0.95, -0.45]);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(300, container.clientWidth);
      const h = Math.max(300, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let disposed = false;
    let explodeCurrent = 0;
    let prevTime = performance.now();
    let rafId = 0;
    const gl2 = renderer.getContext() as WebGL2RenderingContext;

    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      if (softwareGl && typeof gl2?.fenceSync === 'function') {
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl2.flush();
          const poll = () => {
            if (disposed) {
              gl2.deleteSync(sync);
              return;
            }
            const status = gl2.clientWaitSync(sync, 0, 0);
            if (status === gl2.TIMEOUT_EXPIRED) {
              setTimeout(poll, 16);
            } else {
              gl2.deleteSync(sync);
              requestAnimationFrame(cb);
            }
          };
          setTimeout(poll, 16);
          return;
        }
      }
      rafId = requestAnimationFrame(cb);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.1);
      prevTime = now;

      // Damped Exploded View
      explodeCurrent = THREE.MathUtils.damp(explodeCurrent, explodeTargetRef.current, 6.5, dt);
      heroGroup.children.forEach((child) => {
        const bp = child.userData.basePos as THREE.Vector3 | undefined;
        const ev = child.userData.explodeVec as THREE.Vector3 | undefined;
        if (bp && ev) {
          child.position.copy(bp).addScaledVector(ev, explodeCurrent);
        }
      });

      if (autoRotateRef.current) {
        heroGroup.rotation.y += dt * 0.45;
      }

      if (cameraGoalRef.current) {
        camera.position.lerp(cameraGoalRef.current.pos, Math.min(1, dt * 6));
        controls.target.lerp(cameraGoalRef.current.target, Math.min(1, dt * 6));
        if (camera.position.distanceTo(cameraGoalRef.current.pos) < 0.04) {
          cameraGoalRef.current = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      afterDraw(tick);
    };

    afterDraw(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.dispose();
      disposableGeos.forEach((g) => g.dispose());
      floorDisc.geometry.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      floorMat.dispose();
      bodyMat.dispose();
      darkJointMat.dispose();
      accentGlowMat.dispose();
      glassMat.dispose();
      envRT.dispose();
      renderer.dispose();
    };
  }, [modelPreset, finish]);

  const handleScreenshot = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    try {
      const url = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `sigma-3d-${modelPreset}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onNotify('3D sahne PNG olarak indirildi.', 'success');
    } catch {
      onNotify('Ekran görüntüsü alınamadı.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 relative">
      {/* Üst Bilgi Barı (Canvas dışında temiz konum) */}
      <div className="shrink-0 px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(MODEL_META) as ModelPresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setModelPreset(id)}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                modelPreset === id
                  ? 'sigma-accent-bg text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <i className={`fa-solid ${MODEL_META[id].icon}`} />
              <span>{MODEL_META[id].title}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'iso', label: 'İzometrik' },
              { id: 'front', label: 'Ön' },
              { id: 'top', label: 'Üst' },
              { id: 'detail', label: 'Yakın' }
            ] as Array<{ id: CameraPresetId; label: string }>
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => applyCameraPreset(cam.id)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              {cam.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleScreenshot}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold cursor-pointer"
          >
            <i className="fa-solid fa-camera mr-1" />
            PNG Al
          </button>
          <button
            type="button"
            onClick={() => setDockExpanded((d) => !d)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
            title="Alt kontrol panelini aç/kapat"
          >
            <i className={`fa-solid ${dockExpanded ? 'fa-chevron-down' : 'fa-sliders'}`} />
          </button>
        </div>
      </div>

      {/* Three.js WebGL Sahne Alanı (Üzerinde backdrop-filter yoktur) */}
      <div ref={containerRef} className="flex-1 min-h-[340px] w-full relative" />

      {/* Daraltılabilir Alt Kontrol Rıhtımı (Opaq arka plan, backdrop-blur kullanmaz) */}
      {dockExpanded && (
        <div className="shrink-0 px-4 py-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-200">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-4 space-y-1">
              <div className="font-bold text-white">{MODEL_META[modelPreset].title}</div>
              <div className="text-[11px] text-slate-400">
                {MODEL_META[modelPreset].subtitle} · {isSoftwareGpu ? 'Uyumlu Render' : 'Donanım PBR'}
              </div>
            </div>

            <div className="md:col-span-3 space-y-1">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>Parça Ayrıştırma (Exploded)</span>
                <span className="font-mono tabular-nums">%{explodeRatio}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={explodeRatio}
                onChange={(e) => setExplodeRatio(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="md:col-span-3 flex flex-wrap gap-1">
              {(Object.keys(FINISH_META) as MaterialFinishId[]).map((fid) => (
                <button
                  key={fid}
                  type="button"
                  onClick={() => setFinish(fid)}
                  className={`px-2 py-1 rounded-md border text-[11px] font-medium cursor-pointer ${
                    finish === fid
                      ? 'border-blue-400 bg-blue-950 text-blue-200'
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  {FINISH_META[fid].label}
                </button>
              ))}
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setAutoRotate((r) => !r)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                  autoRotate ? 'border-emerald-500 bg-emerald-950 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-300'
                }`}
              >
                <i className="fa-solid fa-rotate mr-1" />
                {autoRotate ? 'Dönüyor' : 'Durdu'}
              </button>
              <button
                type="button"
                onClick={() => setWireframe((w) => !w)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                  wireframe ? 'border-amber-500 bg-amber-950 text-amber-300' : 'border-slate-700 bg-slate-800 text-slate-300'
                }`}
              >
                Tel Kafes
              </button>
              <button
                type="button"
                onClick={() =>
                  onSendToChat(
                    `Three.js 3D Stüdyosu için "${MODEL_META[modelPreset].title}" (${FINISH_META[finish].label} kaplamalı) modeline benzer veya daha gelişmiş tek dosya HTML Three.js sahnesi kodu yaz.`
                  )
                }
                title="AI ile yeni 3D model kodu üret"
                className="px-2.5 py-1.5 rounded-lg sigma-accent-bg text-white text-[11px] font-semibold cursor-pointer"
              >
                AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
