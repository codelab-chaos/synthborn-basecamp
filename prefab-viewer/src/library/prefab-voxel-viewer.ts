import * as THREE from "three";
import type { UnpackedVoxels, ViewerOptions, VoxelViewer } from "./types";

const VOXEL_RECORD_BYTES = 8;
const ISO_AZIMUTH = Math.PI / 4;
const ISO_ELEVATION = Math.PI / 4;
const HOME_ROTATION_X = 0;
const HOME_ROTATION_Y = 0;

function placeCornerCamera(camera: THREE.PerspectiveCamera, maxDim: number) {
  const radius = maxDim * 2.35;
  const horiz = radius * Math.cos(ISO_ELEVATION);
  const x = horiz * Math.sin(ISO_AZIMUTH);
  const z = horiz * Math.cos(ISO_AZIMUTH);
  const y = radius * Math.sin(ISO_ELEVATION);
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
}

export function unpackVoxels(payload: Record<string, unknown>): UnpackedVoxels {
  if (payload.v === 2 && typeof payload.d === "string") {
    const binary = atob(payload.d);
    const stride =
      binary.length % VOXEL_RECORD_BYTES === 0 && binary.length % 7 !== 0
        ? VOXEL_RECORD_BYTES
        : 7;
    const voxels: number[] = [];
    for (let off = 0; off < binary.length; off += stride) {
      const byte = (index: number) => binary.charCodeAt(off + index);
      voxels.push(
        byte(0) | (byte(1) << 8),
        byte(2) | (byte(3) << 8),
        byte(4) | (byte(5) << 8),
        stride === VOXEL_RECORD_BYTES ? byte(6) | (byte(7) << 8) : byte(6),
      );
    }
    return {
      size: payload.s as number[],
      palette: payload.p as number[][],
      voxels,
      materials: (payload.materials as unknown[]) || [],
    };
  }

  if (Array.isArray(payload.voxels) && Array.isArray(payload.palette)) {
    const palette = (payload.palette as Array<number[] | string>).map((entry) => {
      if (Array.isArray(entry)) return entry;
      const hex = String(entry).replace("#", "");
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ];
    });
    return {
      size: payload.size as number[],
      palette,
      voxels: payload.voxels as number[],
      materials: (payload.materials as unknown[]) || [],
    };
  }

  throw new Error("Unsupported voxel payload");
}

function liftPreviewRgb(rgb: number[]) {
  const gain = 1.08;
  const lift = 12;
  return [
    Math.min(255, Math.round(rgb[0] * gain + lift)),
    Math.min(255, Math.round(rgb[1] * gain + lift)),
    Math.min(255, Math.round(rgb[2] * gain + lift)),
  ];
}

function installPreviewLighting(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight(0xdce8f5, 0x8a8078, 0.9);
  const ambient = new THREE.AmbientLight(0xf4f6fa, 0.32);
  const key = new THREE.DirectionalLight(0xfff4e8, 0.58);
  key.position.set(7, 11, 5);
  const fill = new THREE.DirectionalLight(0xc8d8ef, 0.3);
  fill.position.set(-6, 5, -5);
  const rim = new THREE.DirectionalLight(0xffffff, 0.16);
  rim.position.set(-1, 7, 9);
  scene.add(hemi, ambient, key, fill, rim);
}

function configureRenderer(renderer: THREE.WebGLRenderer) {
  renderer.setClearColor(0x000000, 0);
  renderer.premultipliedAlpha = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
}

function setInstanceColor(
  mesh: THREE.InstancedMesh,
  slot: number,
  rgb: number[],
  colorScratch: THREE.Color,
) {
  colorScratch.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  mesh.setColorAt(slot, colorScratch);
}

export function createViewer(container: HTMLElement, options: ViewerOptions = {}): VoxelViewer {
  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({
    antialias: options.antialias !== false,
    alpha: true,
  });
  configureRenderer(renderer);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.maxPixelRatio || 2));
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);
  installPreviewLighting(scene);

  const homeX = options.tiltX ?? HOME_ROTATION_X;
  const homeY = options.tiltY ?? HOME_ROTATION_Y;
  const springHome = options.interaction === "springIso";
  const dragGainX = 0.006;
  const dragGainY = 0.01;
  const flickGain = 1.25;
  const slowThreshold = 0.0012;
  const friction = 0.94;
  const springStrength = 0.1;
  const springDamping = 0.82;
  const tiltClamp = 1.1;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastMoveAt = 0;
  let velX = 0;
  let velY = 0;
  let frameId = 0;
  let disposed = false;
  let currentPayload: UnpackedVoxels | null = null;
  let pointerId: number | null = null;
  let windowDragBound = false;

  function isInsideCanvas(clientX: number, clientY: number) {
    const rect = renderer.domElement.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function bindWindowDrag() {
    if (windowDragBound) return;
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    window.addEventListener("mouseup", onWindowMouseUp);
    window.addEventListener("blur", onWindowBlur);
    windowDragBound = true;
  }

  function unbindWindowDrag() {
    if (!windowDragBound) return;
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerUp);
    window.removeEventListener("mouseup", onWindowMouseUp);
    window.removeEventListener("blur", onWindowBlur);
    windowDragBound = false;
  }

  function setDraggingUi(active: boolean) {
    for (const el of [renderer.domElement, container]) {
      el.classList.toggle("is-dragging", active);
      el.style.cursor = active ? "grabbing" : "grab";
    }
    if (!active) document.body.style.cursor = "";
  }

  function setHomeRotation() {
    root.rotation.set(homeX, homeY, 0);
    velX = 0;
    velY = 0;
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function stepPhysics() {
    if (dragging) return;

    const speed = Math.hypot(velX, velY);
    if (speed > slowThreshold) {
      root.rotation.x += velX;
      root.rotation.y += velY;
      root.rotation.x = Math.max(-tiltClamp, Math.min(tiltClamp, root.rotation.x));
      velX *= friction;
      velY *= friction;
      return;
    }

    if (!springHome) {
      velX = 0;
      velY = 0;
      return;
    }

    const dx = homeX - root.rotation.x;
    const dy = homeY - root.rotation.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 && speed < 0.00008) {
      setHomeRotation();
      return;
    }

    velX = velX * springDamping + dx * springStrength;
    velY = velY * springDamping + dy * springStrength;
    root.rotation.x += velX;
    root.rotation.y += velY;
    root.rotation.x = Math.max(-tiltClamp, Math.min(tiltClamp, root.rotation.x));
  }

  function animate() {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    stepPhysics();
    renderer.render(scene, camera);
  }

  function applyDragDelta(clientX: number, clientY: number) {
    const now = performance.now();
    const dt = Math.max(8, now - lastMoveAt);
    const deltaX = clientX - lastX;
    const deltaY = clientY - lastY;
    root.rotation.y += deltaX * dragGainY;
    root.rotation.x += deltaY * dragGainX;
    root.rotation.x = Math.max(-tiltClamp, Math.min(tiltClamp, root.rotation.x));
    velX = ((deltaY * dragGainX) / dt) * 16;
    velY = ((deltaX * dragGainY) / dt) * 16;
    lastX = clientX;
    lastY = clientY;
    lastMoveAt = now;
  }

  function endDrag(event: PointerEvent | null, force = false) {
    if (!dragging) return;
    if (!force && pointerId != null && event && event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    setDraggingUi(false);
    unbindWindowDrag();
    const flick = Math.hypot(velX, velY);
    if (flick < slowThreshold * 2) {
      velX = 0;
      velY = 0;
    } else {
      velX *= flickGain;
      velY *= flickGain;
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveAt = performance.now();
    velX = 0;
    velY = 0;
    setDraggingUi(true);
    bindWindowDrag();
    event.preventDefault();
  }

  function onWindowPointerMove(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    if (!isInsideCanvas(event.clientX, event.clientY)) {
      endDrag(event, true);
      return;
    }
    applyDragDelta(event.clientX, event.clientY);
  }

  function onWindowPointerUp(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    endDrag(event, true);
  }

  function onWindowMouseUp() {
    if (dragging) endDrag(null, true);
  }

  function onWindowBlur() {
    if (dragging) endDrag(null, true);
  }

  function onCanvasPointerLeave(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    endDrag(event, true);
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerleave", onCanvasPointerLeave);
  renderer.domElement.style.cursor = "grab";
  window.addEventListener("resize", resize);
  animate();

  return {
    load(rawPayload: unknown) {
      currentPayload = unpackVoxels(rawPayload as Record<string, unknown>);
      root.clear();

      const geom = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const voxelCount = currentPayload.voxels.length / 4;
      const mesh = new THREE.InstancedMesh(geom, mat, voxelCount);
      const matrix = new THREE.Matrix4();
      const color = new THREE.Color();

      for (let i = 0; i < currentPayload.voxels.length; i += 4) {
        const slot = i / 4;
        const x = currentPayload.voxels[i];
        const y = currentPayload.voxels[i + 1];
        const z = currentPayload.voxels[i + 2];
        const pi = currentPayload.voxels[i + 3];
        const rgb = liftPreviewRgb(currentPayload.palette[pi] || [145, 145, 145]);
        matrix.makeTranslation(
          x - currentPayload.size[0] / 2,
          y - currentPayload.size[1] / 2,
          z - currentPayload.size[2] / 2,
        );
        mesh.setMatrixAt(slot, matrix);
        setInstanceColor(mesh, slot, rgb, color);
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.userData.payload = currentPayload;
      root.add(mesh);

      const maxDim = Math.max(currentPayload.size[0], currentPayload.size[1], currentPayload.size[2]);
      placeCornerCamera(camera, maxDim);
      setHomeRotation();
      resize();
    },
    applySlices(top: number, side: number) {
      const mesh = root.children[0] as THREE.InstancedMesh | undefined;
      if (!mesh || !mesh.userData.payload) return;
      const payload = mesh.userData.payload as UnpackedVoxels;
      const matrix = new THREE.Matrix4();
      const color = new THREE.Color();
      let visible = 0;
      for (let i = 0; i < payload.voxels.length; i += 4) {
        const x = payload.voxels[i];
        const y = payload.voxels[i + 1];
        const z = payload.voxels[i + 2];
        const pi = payload.voxels[i + 3];
        if (y > top || x > side) continue;
        const rgb = liftPreviewRgb(payload.palette[pi] || [145, 145, 145]);
        matrix.makeTranslation(
          x - payload.size[0] / 2,
          y - payload.size[1] / 2,
          z - payload.size[2] / 2,
        );
        mesh.setMatrixAt(visible, matrix);
        setInstanceColor(mesh, visible, rgb, color);
        visible++;
      }
      mesh.count = visible;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    getPayload() {
      return currentPayload;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      endDrag(null, true);
      unbindWindowDrag();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerleave", onCanvasPointerLeave);
      window.removeEventListener("resize", resize);
      root.traverse((child) => {
        const meshChild = child as THREE.Mesh;
        if (meshChild.geometry) meshChild.geometry.dispose();
        if (meshChild.material) {
          const material = meshChild.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}

export function createPreviewPool(maxActive = 10) {
  const active = new Map<HTMLElement, { viewer: VoxelViewer; voxelUrl: string }>();
  const loadGeneration = new Map<HTMLElement, number>();

  function disposeOldest() {
    if (active.size < maxActive) return;
    const oldest = active.keys().next().value as HTMLElement;
    const entry = active.get(oldest);
    if (entry) entry.viewer.dispose();
    active.delete(oldest);
  }

  function bumpGeneration(container: HTMLElement) {
    loadGeneration.set(container, (loadGeneration.get(container) ?? 0) + 1);
  }

  return {
    async mount(container: HTMLElement, voxelUrl: string) {
      const existing = active.get(container);
      if (existing?.voxelUrl === voxelUrl) return existing.viewer;
      if (existing) {
        existing.viewer.dispose();
        active.delete(container);
      }

      disposeOldest();
      bumpGeneration(container);
      const generation = loadGeneration.get(container)!;

      const payload = await fetch(voxelUrl).then((response) => response.json());
      if (loadGeneration.get(container) !== generation) return null;

      const viewer = createViewer(container, {
        interaction: "springIso",
        maxPixelRatio: 1.5,
      });
      viewer.load(payload);
      if (loadGeneration.get(container) !== generation) {
        viewer.dispose();
        return null;
      }

      active.set(container, { viewer, voxelUrl });
      return viewer;
    },
    release(container: HTMLElement) {
      bumpGeneration(container);
      const entry = active.get(container);
      if (entry) {
        entry.viewer.dispose();
        active.delete(container);
      }
    },
    disposeAll() {
      for (const entry of active.values()) entry.viewer.dispose();
      active.clear();
      loadGeneration.clear();
    },
  };
}
