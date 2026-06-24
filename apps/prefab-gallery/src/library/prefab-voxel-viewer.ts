import * as THREE from "three";
import { buildVoxelMesh, enrichPreviewRgb, setInstanceColor } from "./build-voxel-mesh";
import type { UnpackedVoxels, ViewerOptions, VoxelViewer, VoxelViewerMode } from "./types";

const CAMERA_AZIMUTH = 0;
const CAMERA_ELEVATION = Math.PI / 4;
const HOME_ROTATION_X = 0;
const HOME_ROTATION_Y = 0;

export function placePreviewCamera(camera: THREE.PerspectiveCamera, maxDim: number) {
  const radius = maxDim * 2.35;
  const horiz = radius * Math.cos(CAMERA_ELEVATION);
  const x = horiz * Math.sin(CAMERA_AZIMUTH);
  const z = horiz * Math.cos(CAMERA_AZIMUTH);
  const y = radius * Math.sin(CAMERA_ELEVATION);
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
}

function placeViewerCamera(camera: THREE.PerspectiveCamera, maxDim: number, mode: VoxelViewerMode) {
  const radius = maxDim * 2.35;

  if (mode === "front") {
    camera.position.set(0, 0, radius);
  } else if (mode === "right") {
    camera.position.set(radius, 0, 0);
  } else {
    const elevation = Math.PI / 5;
    const horiz = radius * Math.cos(elevation);
    camera.position.set(horiz * 0.72, radius * Math.sin(elevation), horiz * 0.72);
  }

  camera.lookAt(0, 0, 0);
}

export { unpackVoxelsJson as unpackVoxels } from "./load-voxel-payload";

export function installPreviewLighting(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight(0xb8c6dc, 0x4a443c, 0.48);
  const key = new THREE.DirectionalLight(0xfff0dc, 0.78);
  key.position.set(7, 11, 5);
  const fill = new THREE.DirectionalLight(0x8ea0b8, 0.12);
  fill.position.set(-6, 5, -5);
  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(-1, 7, 9);
  scene.add(hemi, key, fill, rim);
}

export function configureRenderer(renderer: THREE.WebGLRenderer) {
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
}

export function createViewer(container: HTMLElement, options: ViewerOptions = {}): VoxelViewer {
  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({
    antialias: options.antialias !== false,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: options.preserveDrawingBuffer === true,
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
  const returnDurationMs = 420;
  const tiltClamp = 1.1;
  const wheelZoomGain = 0.0012;
  const panGain = 0.012;
  const minZoomFactor = 1e-4;

  const homeDirection = new THREE.Vector3();
  const panTarget = new THREE.Vector3();
  const cameraScratch = new THREE.Vector3();
  const panRight = new THREE.Vector3();
  const panUp = new THREE.Vector3();

  let homeDistance = 10;
  let zoomFactor = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let middleDragging = false;
  let returningRotation = false;
  let returningZoom = false;
  let returningPan = false;
  let returnStartX = 0;
  let returnStartY = 0;
  let returnStartZoom = 1;
  let returnStartPanX = 0;
  let returnStartPanY = 0;
  let rotationReturnStartAt = 0;
  let zoomReturnStartAt = 0;
  let panReturnStartAt = 0;
  let lastX = 0;
  let lastY = 0;
  let lastMoveAt = 0;
  let velX = 0;
  let velY = 0;
  let frameId = 0;
  let disposed = false;
  let currentPayload: UnpackedVoxels | null = null;
  let currentViewMode: VoxelViewerMode | null = null;
  let pointerId: number | null = null;
  let middlePointerId: number | null = null;
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
      el.style.cursor = active ? "grabbing" : middleDragging ? "move" : "grab";
    }
    if (!active && !middleDragging) document.body.style.cursor = "";
  }

  function setMiddleDragUi(active: boolean) {
    for (const el of [renderer.domElement, container]) {
      el.classList.toggle("is-dragging", active);
      el.style.cursor = active ? "move" : dragging ? "grabbing" : "grab";
    }
    if (!active && !dragging) document.body.style.cursor = "";
  }

  function updatePanAxes() {
    const worldUp = new THREE.Vector3(0, 1, 0);
    panRight.crossVectors(worldUp, homeDirection);
    if (panRight.lengthSq() < 1e-6) panRight.set(1, 0, 0);
    panRight.normalize();
    panUp.crossVectors(homeDirection, panRight).normalize();
  }

  function applyCameraView() {
    updatePanAxes();
    panTarget.set(0, 0, 0);
    panTarget.addScaledVector(panRight, panX);
    panTarget.addScaledVector(panUp, panY);
    cameraScratch.copy(homeDirection).multiplyScalar(homeDistance * zoomFactor);
    camera.position.copy(panTarget).add(cameraScratch);
    camera.lookAt(panTarget);
  }

  function captureHomeCamera() {
    cameraScratch.copy(camera.position);
    homeDistance = cameraScratch.length();
    homeDirection.copy(cameraScratch).normalize();
    zoomFactor = 1;
    panX = 0;
    panY = 0;
    applyCameraView();
  }

  function setHomeRotation() {
    root.rotation.set(homeX, homeY, 0);
    velX = 0;
    velY = 0;
    returningRotation = false;
  }

  function setHomeZoom() {
    zoomFactor = 1;
    applyCameraView();
    returningZoom = false;
  }

  function setHomePan() {
    panX = 0;
    panY = 0;
    applyCameraView();
    returningPan = false;
  }

  function setHomeCamera() {
    setHomeZoom();
    setHomePan();
  }

  function setHomeView() {
    setHomeRotation();
    setHomeCamera();
  }

  function setCameraMode(mode: VoxelViewerMode) {
    currentViewMode = mode;
    if (!currentPayload) return;

    const maxDim = Math.max(currentPayload.size[0], currentPayload.size[1], currentPayload.size[2]);
    placeViewerCamera(camera, maxDim, mode);
    captureHomeCamera();
    setHomeView();
    resize();
  }

  function easeInCubic(t: number) {
    return t * t * t;
  }

  function startRotationReturnTween() {
    returningRotation = true;
    returnStartX = root.rotation.x;
    returnStartY = root.rotation.y;
    rotationReturnStartAt = performance.now();
    velX = 0;
    velY = 0;
  }

  function startZoomReturnTween() {
    if (Math.abs(zoomFactor - 1) < 0.001) return;
    returningZoom = true;
    returnStartZoom = zoomFactor;
    zoomReturnStartAt = performance.now();
  }

  function startPanReturnTween() {
    if (Math.abs(panX) < 0.001 && Math.abs(panY) < 0.001) return;
    returningPan = true;
    returnStartPanX = panX;
    returnStartPanY = panY;
    panReturnStartAt = performance.now();
  }

  function stepReturnTweens() {
    const now = performance.now();

    if (returningRotation) {
      const t = Math.min(1, (now - rotationReturnStartAt) / returnDurationMs);
      const eased = easeInCubic(t);
      root.rotation.x = returnStartX + (homeX - returnStartX) * eased;
      root.rotation.y = returnStartY + (homeY - returnStartY) * eased;
      if (t >= 1) setHomeRotation();
    }

    if (returningZoom) {
      const t = Math.min(1, (now - zoomReturnStartAt) / returnDurationMs);
      const eased = easeInCubic(t);
      zoomFactor = returnStartZoom + (1 - returnStartZoom) * eased;
      applyCameraView();
      if (t >= 1) setHomeZoom();
    }

    if (returningPan) {
      const t = Math.min(1, (now - panReturnStartAt) / returnDurationMs);
      const eased = easeInCubic(t);
      panX = returnStartPanX + (0 - returnStartPanX) * eased;
      panY = returnStartPanY + (0 - returnStartPanY) * eased;
      applyCameraView();
      if (t >= 1) setHomePan();
    }
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
    if (dragging || middleDragging) return;

    if (returningRotation || returningZoom || returningPan) {
      stepReturnTweens();
    }

    if (springHome) return;

    const speed = Math.hypot(velX, velY);
    if (speed <= slowThreshold) {
      velX = 0;
      velY = 0;
      return;
    }

    root.rotation.x += velX;
    root.rotation.y += velY;
    root.rotation.x = Math.max(-tiltClamp, Math.min(tiltClamp, root.rotation.x));
    velX *= friction;
    velY *= friction;
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
    if (springHome) {
      startRotationReturnTween();
      return;
    }

    const flick = Math.hypot(velX, velY);
    if (flick < slowThreshold * 2) {
      velX = 0;
      velY = 0;
    } else {
      velX *= flickGain;
      velY *= flickGain;
    }
  }

  function applyMiddleDragDelta(clientX: number, clientY: number) {
    const deltaX = clientX - lastX;
    const deltaY = clientY - lastY;
    const panScale = homeDistance * 0.004;
    panX += deltaX * panGain * panScale;
    panY -= deltaY * panGain * panScale;
    applyCameraView();
    lastX = clientX;
    lastY = clientY;
  }

  function applyWheelZoom(deltaY: number) {
    const zoomDelta = Math.exp(-deltaY * wheelZoomGain);
    zoomFactor = Math.max(minZoomFactor, zoomFactor * zoomDelta);
    applyCameraView();
  }

  function onWheel(event: WheelEvent) {
    if (!dragging) return;
    event.preventDefault();
    returningZoom = false;
    applyWheelZoom(event.deltaY);
  }

  function endMiddleDrag(event: PointerEvent | null, force = false) {
    if (!middleDragging) return;
    if (!force && middlePointerId != null && event && event.pointerId !== middlePointerId) return;
    middleDragging = false;
    middlePointerId = null;
    setMiddleDragUi(false);
    if (!dragging) unbindWindowDrag();
    startPanReturnTween();
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button === 1) {
      event.preventDefault();
      returningPan = false;
      middleDragging = true;
      middlePointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      setMiddleDragUi(true);
      bindWindowDrag();
      return;
    }
    if (event.button !== 0) return;
    returningRotation = false;
    returningZoom = false;
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
    if (middleDragging && event.pointerId === middlePointerId) {
      if (!isInsideCanvas(event.clientX, event.clientY)) {
        endMiddleDrag(event, true);
        return;
      }
      applyMiddleDragDelta(event.clientX, event.clientY);
      return;
    }
    if (!dragging || event.pointerId !== pointerId) return;
    if (!isInsideCanvas(event.clientX, event.clientY)) {
      endDrag(event, true);
      return;
    }
    applyDragDelta(event.clientX, event.clientY);
  }

  function onWindowPointerUp(event: PointerEvent) {
    if (middleDragging && event.pointerId === middlePointerId) {
      endMiddleDrag(event, true);
      return;
    }
    if (!dragging || event.pointerId !== pointerId) return;
    endDrag(event, true);
  }

  function onWindowMouseUp(event: MouseEvent) {
    if (event.button === 1 && middleDragging) {
      endMiddleDrag(null, true);
      return;
    }
    if (dragging) endDrag(null, true);
  }

  function onWindowBlur() {
    if (middleDragging) endMiddleDrag(null, true);
    if (dragging) endDrag(null, true);
  }

  function onCanvasPointerLeave(event: PointerEvent) {
    if (middleDragging && event.pointerId === middlePointerId) {
      endMiddleDrag(event, true);
      return;
    }
    if (!dragging || event.pointerId !== pointerId) return;
    endDrag(event, true);
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
  renderer.domElement.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
  renderer.domElement.addEventListener("pointerleave", onCanvasPointerLeave);
  renderer.domElement.style.cursor = "grab";
  window.addEventListener("resize", resize);
  animate();

  return {
    load(payload: UnpackedVoxels) {
      currentPayload = payload;
      root.clear();
      root.add(buildVoxelMesh(payload));

      const maxDim = Math.max(currentPayload.size[0], currentPayload.size[1], currentPayload.size[2]);
      if (currentViewMode) {
        placeViewerCamera(camera, maxDim, currentViewMode);
      } else {
        placePreviewCamera(camera, maxDim);
      }
      captureHomeCamera();
      setHomeView();
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
        const rgb = enrichPreviewRgb(payload.palette[pi] || [145, 145, 145]);
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
    setViewMode(mode: VoxelViewerMode) {
      setCameraMode(mode);
    },
    getPayload() {
      return currentPayload;
    },
    captureSnapshot(target) {
      if (disposed) return false;

      renderer.render(scene, camera);
      const source = renderer.domElement;
      const rect = source.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      target.width = width;
      target.height = height;

      const context = target.getContext("2d");
      if (!context) return false;

      try {
        context.drawImage(source, 0, 0, width, height);
        return true;
      } catch {
        return false;
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      endMiddleDrag(null, true);
      endDrag(null, true);
      unbindWindowDrag();
      const canvas = renderer.domElement;
      canvas.style.opacity = "0";
      canvas.style.pointerEvents = "none";
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
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
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    },
  };
}
