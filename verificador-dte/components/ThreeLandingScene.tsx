'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const NOVA = {
  cyan: 0x00d1ff,
  green: 0x10b981,
  purple: 0x8b5cf6,
  darkBg: 0x1e2227,
  lightBg: 0xf8fafc,
} as const;

function getCardContentColors(isDark: boolean) {
  return {
    face: isDark ? '#e5e7eb' : '#f8fafc',
    mini: isDark ? '#e5e7eb' : '#f8fafc',
    line: isDark ? '#0f1419' : '#d4d4d8',
    border: isDark ? '#374151' : '#cbd5e1',
    miniLines: isDark ? '#0f1419' : '#cbd5e1',
    text: '#18181b',
    muted: '#64748b',
  };
}

type SceneRefs = { frameId: number; renderer: THREE.WebGLRenderer };

type DragState = {
  active: boolean;
  pointerId: number | null;
  lastX: number;
  lastY: number;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
};

type ThemeSceneObjects = {
  scene: THREE.Scene;
  ambient: THREE.AmbientLight;
  keyLight: THREE.PointLight;
  accentLight: THREE.PointLight;
  documentMaterial: THREE.MeshPhysicalMaterial;
  miniMaterials: THREE.MeshStandardMaterial[];
  particleMaterial: THREE.PointsMaterial;
  particles: THREE.Points;
  documentTexture: THREE.CanvasTexture | null;
  miniTextures: THREE.CanvasTexture[];
};

function isDarkTheme() {
  return (
    document.documentElement.classList.contains('dark') ||
    document.querySelector('.private-app')?.classList.contains('dark') === true
  );
}

function createDocumentTexture(isDark: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const palette = getCardContentColors(isDark);

  ctx.fillStyle = palette.face;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const headerGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  headerGrad.addColorStop(0, '#00d1ff');
  headerGrad.addColorStop(1, '#0099bb');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, canvas.width, 72);

  ctx.fillStyle = '#0f1419';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('DTE', 36, 48);

  ctx.fillStyle = palette.text;
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Verificacion tributaria', 36, 132);

  for (let index = 0; index < 8; index += 1) {
    ctx.fillStyle = palette.line;
    ctx.fillRect(36, 172 + index * 40, 310 + Math.sin(index) * 72, 12);
  }

  ctx.fillStyle = isDark ? '#0f1419' : palette.text;
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      if ((x + y) % 2 === 0 || x === 0 || y === 0 || x === 6 || y === 6) {
        ctx.fillRect(350 + x * 16, 420 + y * 16, 12, 12);
      }
    }
  }

  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(62, 516);
  ctx.lineTo(122, 576);
  ctx.lineTo(222, 460);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createMiniDocumentTexture(label: string, isDark: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const palette = getCardContentColors(isDark);

  ctx.fillStyle = palette.mini;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00d1ff';
  ctx.fillRect(0, 0, canvas.width, 54);
  ctx.fillStyle = '#0f1419';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(label, 20, 38);
  ctx.fillStyle = palette.miniLines;
  for (let index = 0; index < 5; index += 1) {
    ctx.fillRect(20, 92 + index * 34, 156 + (index % 2) * 34, 9);
  }

  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(46, 278);
  ctx.lineTo(80, 312);
  ctx.lineTo(136, 248);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function applySceneTheme(objects: ThemeSceneObjects, isDark: boolean) {
  objects.scene.fog = new THREE.Fog(isDark ? NOVA.darkBg : NOVA.lightBg, 8, 22);
  objects.ambient.intensity = isDark ? 0.7 : 1.15;
  objects.keyLight.color.set(NOVA.cyan);
  objects.keyLight.intensity = isDark ? 9 : 11;
  objects.accentLight.color.set(isDark ? NOVA.purple : 0x2563eb);
  objects.accentLight.intensity = isDark ? 8 : 7;
  objects.documentMaterial.clearcoat = isDark ? 0.35 : 0.55;
  objects.documentMaterial.needsUpdate = true;
  objects.miniMaterials.forEach((material) => {
    material.color.set(isDark ? 0xffffff : 0xf8fafc);
    material.emissive.set(isDark ? 0x001820 : 0x002233);
    material.emissiveIntensity = isDark ? 0.2 : 0.08;
  });
  objects.particleMaterial.color.set(isDark ? NOVA.cyan : 0x00b8d9);
  objects.particleMaterial.opacity = isDark ? 0.75 : 0.42;
}

function refreshDocumentTextures(objects: ThemeSceneObjects, isDark: boolean) {
  objects.documentTexture?.dispose();
  objects.miniTextures.forEach((t) => t.dispose());

  objects.documentTexture = createDocumentTexture(isDark);
  objects.documentMaterial.map = objects.documentTexture;

  const labels = ['CCF', 'FCF', 'NC', 'ND', 'FSE', 'JSON', 'CSV'];
  objects.miniTextures.length = 0;
  objects.miniMaterials.forEach((material, index) => {
    const label = labels[(index * 3 + 2) % labels.length];
    const texture = createMiniDocumentTexture(label, isDark);
    if (texture) {
      objects.miniTextures.push(texture);
      material.map = texture;
    }
  });
}

export default function ThreeLandingScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<SceneRefs | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark = isDarkTheme();
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(dark ? NOVA.darkBg : NOVA.lightBg, 8, 22);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.6, 10);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    root.position.x = 0.85;
    scene.add(root);

    const drag: DragState = {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
      targetX: 0,
      targetY: 0,
      currentX: 0,
      currentY: 0,
    };

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(NOVA.cyan, 9, 18);
    keyLight.position.set(-3.5, 3, 5);
    scene.add(keyLight);

    const accentLight = new THREE.PointLight(NOVA.purple, 8, 15);
    accentLight.position.set(4, -1, 4);
    scene.add(accentLight);

    const documentTexture = createDocumentTexture(dark);
    const documentMaterial = new THREE.MeshPhysicalMaterial({
      map: documentTexture,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.35,
      side: THREE.DoubleSide,
    });

    const mainDocument = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 3.05, 10, 10), documentMaterial);
    mainDocument.position.set(-0.2, 0.05, 0);
    root.add(mainDocument);

    const orbitGroup = new THREE.Group();
    root.add(orbitGroup);

    const miniDocumentLabels = ['CCF', 'FCF', 'NC', 'ND', 'FSE', 'JSON', 'CSV'];
    const miniTextures: THREE.CanvasTexture[] = [];
    const miniMaterials: THREE.MeshStandardMaterial[] = [];
    const miniMeshes: THREE.Mesh[] = [];

    for (let index = 0; index < 9; index += 1) {
      const angle = (index / 9) * Math.PI * 2;
      const label = miniDocumentLabels[(index * 3 + 2) % miniDocumentLabels.length];
      const texture = createMiniDocumentTexture(label, dark);
      if (texture) miniTextures.push(texture);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        color: dark ? 0xffffff : 0xf8fafc,
        emissive: dark ? 0x001820 : 0x002233,
        emissiveIntensity: dark ? 0.2 : 0.08,
        roughness: 0.55,
        side: THREE.DoubleSide,
      });
      miniMaterials.push(material);
      const miniDoc = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.64), material);
      miniDoc.position.set(Math.cos(angle) * 3.55, Math.sin(angle * 1.3) * 1.05, Math.sin(angle) * 1.9);
      miniDoc.rotation.set(0.25, angle + Math.PI / 2, -0.08);
      orbitGroup.add(miniDoc);
      miniMeshes.push(miniDoc);
    }

    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(180 * 3);
    for (let index = 0; index < positions.length; index += 3) {
      positions[index] = (Math.random() - 0.5) * 9;
      positions[index + 1] = (Math.random() - 0.5) * 5;
      positions[index + 2] = (Math.random() - 0.5) * 6;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: NOVA.cyan,
      size: 0.035,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const themeObjects: ThemeSceneObjects = {
      scene,
      ambient,
      keyLight,
      accentLight,
      documentMaterial,
      miniMaterials,
      particleMaterial,
      particles,
      documentTexture,
      miniTextures,
    };

    const syncTheme = () => {
      const nextDark = isDarkTheme();
      refreshDocumentTextures(themeObjects, nextDark);
      applySceneTheme(themeObjects, nextDark);
    };
    syncTheme();

    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const scopeEl = mount.closest('.private-app');
    if (scopeEl) themeObserver.observe(scopeEl, { attributes: true, attributeFilter: ['class'] });

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      drag.active = true;
      drag.pointerId = event.pointerId;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      renderer.domElement.style.cursor = 'grabbing';
      renderer.domElement.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.lastX;
      const deltaY = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.targetY += deltaX * 0.006;
      drag.targetX += deltaY * 0.004;
      drag.targetX = THREE.MathUtils.clamp(drag.targetX, -0.55, 0.55);
      drag.targetY = THREE.MathUtils.clamp(drag.targetY, -0.85, 0.85);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
      renderer.domElement.style.cursor = 'grab';
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const motionScale = prefersReducedMotion ? 0.12 : 1;
      if (!drag.active) {
        drag.targetX *= 0.95;
        drag.targetY *= 0.95;
      }
      drag.currentX = THREE.MathUtils.lerp(drag.currentX, drag.targetX, 0.1);
      drag.currentY = THREE.MathUtils.lerp(drag.currentY, drag.targetY, 0.1);

      root.rotation.y = Math.sin(elapsed * 0.28 * motionScale) * 0.2 + drag.currentY;
      root.rotation.x = Math.sin(elapsed * 0.18 * motionScale) * 0.08 + drag.currentX;
      mainDocument.position.y = 0.05 + Math.sin(elapsed * 0.8 * motionScale) * 0.12;
      orbitGroup.rotation.y = elapsed * 0.32 * motionScale;
      particles.rotation.y = elapsed * 0.05 * motionScale;

      renderer.render(scene, camera);
      refs.current = { renderer, frameId: window.requestAnimationFrame(animate) };
    };

    resize();
    window.addEventListener('resize', resize);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    refs.current = { renderer, frameId: window.requestAnimationFrame(animate) };

    return () => {
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      themeObserver.disconnect();
      if (refs.current) window.cancelAnimationFrame(refs.current.frameId);
      documentTexture?.dispose();
      miniTextures.forEach((texture) => texture.dispose());
      particleGeometry.dispose();
      documentMaterial.dispose();
      miniMaterials.forEach((material) => material.dispose());
      particleMaterial.dispose();
      mainDocument.geometry.dispose();
      miniMeshes.forEach((mesh) => mesh.geometry.dispose());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
