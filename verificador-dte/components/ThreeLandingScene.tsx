'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const NOVA = {
  cyan: 0x00d1ff,
  green: 0x10b981,
  purple: 0x8b5cf6,
  darkBg: 0x1e2227,
  lightBg: 0xf8fafc,
  cardGray: 0xe5e7eb,
} as const;

/** La tarjeta DTE siempre es gris claro; el esqueleto cambia según el tema. */
const CARD_FACE = '#e5e7eb';

function getCardContentColors(isDark: boolean) {
  return {
    face: CARD_FACE,
    qr: '#d1d5db',
    edge: 0xc4c9d0,
    back: 0xd1d5db,
    mini: CARD_FACE,
    line: isDark ? '#0f1419' : '#cbd5e1',
    border: isDark ? '#374151' : '#b0b8c4',
    miniLines: isDark ? '#0f1419' : '#b0b8c4',
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
  fillLight: THREE.PointLight;
  rimLight: THREE.PointLight;
  documentMaterial: THREE.MeshPhysicalMaterial;
  glowMaterial: THREE.MeshBasicMaterial;
  miniMaterials: THREE.MeshStandardMaterial[];
  particleMaterial: THREE.PointsMaterial;
  particleGeometry: THREE.BufferGeometry;
  particleBasePositions: Float32Array;
  particleCount: number;
  documentTexture: THREE.CanvasTexture | null;
  glowTexture: THREE.CanvasTexture | null;
  miniTextures: THREE.CanvasTexture[];
  miniMeshes: THREE.Mesh[];
  cardGroup: THREE.Group;
};

function isDarkTheme() {
  return (
    document.documentElement.classList.contains('dark') ||
    document.querySelector('.private-app')?.classList.contains('dark') === true
  );
}

function createGlowTexture(isDark: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const g = ctx.createRadialGradient(256, 256, 8, 256, 256, 250);
  if (isDark) {
    g.addColorStop(0, 'rgba(0, 209, 255, 0.42)');
    g.addColorStop(0.45, 'rgba(0, 209, 255, 0.12)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  } else {
    g.addColorStop(0, 'rgba(0, 209, 255, 0.28)');
    g.addColorStop(0.5, 'rgba(0, 209, 255, 0.06)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawVerifiedStamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  grad.addColorStop(0, '#34d399');
  grad.addColorStop(1, '#059669');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.32, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.06, cy + r * 0.28);
  ctx.lineTo(cx + r * 0.36, cy - r * 0.24);
  ctx.stroke();
}

function createDocumentTexture(isDark: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const palette = getCardContentColors(isDark);

  ctx.fillStyle = palette.face;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#00d1ff55';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  const headerGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  headerGrad.addColorStop(0, '#00d1ff');
  headerGrad.addColorStop(1, '#0099bb');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(20, 20, canvas.width - 40, 108);

  ctx.fillStyle = '#0f1419';
  ctx.font = 'bold 58px system-ui, sans-serif';
  ctx.fillText('DTE', 52, 92);

  ctx.fillStyle = palette.text;
  ctx.font = '600 36px system-ui, sans-serif';
  ctx.fillText('Verificacion tributaria', 52, 188);

  ctx.fillStyle = palette.muted;
  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillText('Documento electronico · El Salvador', 52, 228);

  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = palette.line;
    ctx.fillRect(52, 280 + i * 48, 480 + Math.sin(i) * 60, 14);
  }

  const qrX = 600;
  const qrY = 320;
  const qrSize = 340;
  ctx.fillStyle = palette.qr;
  ctx.fillRect(qrX, qrY, qrSize, qrSize);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = isDark ? '#0f1419' : palette.text;
  const cell = 28;
  const qrInner = 260;
  const ox = qrX + 40;
  const oy = qrY + 40;
  for (let y = 0; y < 9; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      if ((x + y) % 2 === 0 || x === 0 || y === 0 || x === 8 || y === 8) {
        ctx.fillRect(ox + x * cell, oy + y * cell, cell - 4, cell - 4);
      }
    }
  }

  drawVerifiedStamp(ctx, qrX + qrSize - 64, qrY + qrSize - 64, 44);

  ctx.fillStyle = palette.muted;
  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillText('Kaiser DTE', 52, 1220);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
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
  ctx.fillRect(0, 0, 256, 340);
  ctx.fillStyle = '#00d1ff';
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = '#0f1419';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText(label, 18, 34);
  ctx.fillStyle = palette.miniLines;
  for (let i = 0; i < 3; i += 1) ctx.fillRect(18, 78 + i * 38, 140 + i * 20, 10);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function applySceneTheme(objects: ThemeSceneObjects, isDark: boolean) {
  objects.scene.fog = new THREE.FogExp2(isDark ? NOVA.darkBg : NOVA.lightBg, isDark ? 0.028 : 0.024);
  objects.ambient.intensity = isDark ? 0.6 : 0.9;
  objects.keyLight.intensity = isDark ? 12 : 10;
  objects.fillLight.intensity = isDark ? 5 : 4;
  objects.rimLight.intensity = isDark ? 8 : 6;
  objects.documentMaterial.clearcoat = isDark ? 0.72 : 0.8;
  objects.documentMaterial.roughness = isDark ? 0.22 : 0.18;
  objects.documentMaterial.emissive.set(0x000000);
  objects.documentMaterial.emissiveIntensity = 0;
  objects.glowMaterial.opacity = isDark ? 0.85 : 0.55;
  objects.particleMaterial.opacity = isDark ? 0.82 : 0.45;
  objects.particleMaterial.size = isDark ? 0.048 : 0.038;
  objects.particleMaterial.color.set(isDark ? NOVA.cyan : 0x00b8d9);
  objects.miniMaterials.forEach((m) => {
    m.color.set(NOVA.cardGray);
    m.emissive.set(0x000000);
    m.emissiveIntensity = 0;
  });
}

function refreshDocumentTextures(objects: ThemeSceneObjects, isDark: boolean) {
  objects.documentTexture?.dispose();
  objects.glowTexture?.dispose();
  objects.miniTextures.forEach((t) => t.dispose());

  objects.documentTexture = createDocumentTexture(isDark);
  objects.glowTexture = createGlowTexture(isDark);
  objects.documentMaterial.map = objects.documentTexture ?? undefined;
  objects.glowMaterial.map = objects.glowTexture ?? undefined;

  const labels = ['CCF', 'FCF', 'NC', 'JSON'];
  objects.miniTextures.length = 0;
  objects.miniMaterials.forEach((material, index) => {
    const texture = createMiniDocumentTexture(labels[index % labels.length], isDark);
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
    scene.fog = new THREE.FogExp2(dark ? NOVA.darkBg : NOVA.lightBg, dark ? 0.028 : 0.024);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.15, 7.4);
    camera.lookAt(0, 0.05, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = dark ? 1.12 : 1.02;
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const cardGroup = new THREE.Group();
    root.add(cardGroup);

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

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const keyLight = new THREE.PointLight(NOVA.cyan, 12, 22);
    keyLight.position.set(-3.5, 3.5, 5);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0xffffff, 5, 18);
    fillLight.position.set(2.5, -1.5, 4);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(NOVA.cyan, 8, 16);
    rimLight.position.set(4, 1.5, -2);
    scene.add(rimLight);

    const glowTexture = createGlowTexture(dark);
    const glowMaterial = new THREE.MeshBasicMaterial({
      map: glowTexture ?? undefined,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), glowMaterial);
    glowPlane.position.z = -0.6;
    cardGroup.add(glowPlane);

    const documentTexture = createDocumentTexture(dark);
    const documentMaterial = new THREE.MeshPhysicalMaterial({
      map: documentTexture ?? undefined,
      roughness: 0.22,
      metalness: 0.04,
      clearcoat: 0.72,
      clearcoatRoughness: 0.12,
      side: THREE.FrontSide,
    });

    const cardW = 2.55;
    const cardH = 3.25;
    const cardDepth = 0.08;

    const mainDocument = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), documentMaterial);
    mainDocument.position.z = cardDepth / 2;
    cardGroup.add(mainDocument);

    const backMaterial = new THREE.MeshStandardMaterial({
      color: getCardContentColors(dark).back,
      roughness: 0.8,
    });
    const cardBack = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), backMaterial);
    cardBack.position.z = -cardDepth / 2;
    cardBack.rotation.y = Math.PI;
    cardGroup.add(cardBack);

    const edgeMat = new THREE.MeshStandardMaterial({
      color: getCardContentColors(dark).edge,
      roughness: 0.6,
    });
    const t = 0.035;
    [
      [cardW, t, cardDepth, 0, cardH / 2],
      [cardW, t, cardDepth, 0, -cardH / 2],
      [t, cardH, cardDepth, -cardW / 2, 0],
      [t, cardH, cardDepth, cardW / 2, 0],
    ].forEach(([w, h, d, x, y]) => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), edgeMat);
      edge.position.set(x, y, 0);
      cardGroup.add(edge);
    });

    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: dark ? 0.35 : 0.12,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.1), shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -1.85, 0.2);
    root.add(shadowPlane);

    const orbitGroup = new THREE.Group();
    root.add(orbitGroup);

    const miniTextures: THREE.CanvasTexture[] = [];
    const miniMaterials: THREE.MeshStandardMaterial[] = [];
    const miniMeshes: THREE.Mesh[] = [];
    const labels = ['CCF', 'FCF', 'NC', 'JSON'];

    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + 0.4;
      const texture = createMiniDocumentTexture(labels[i], dark);
      if (texture) miniTextures.push(texture);
      const material = new THREE.MeshStandardMaterial({
        map: texture ?? undefined,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      miniMaterials.push(material);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.6), material);
      mesh.position.set(Math.cos(angle) * 3.8, Math.sin(angle) * 0.7, Math.sin(angle) * 1.8 - 1.2);
      mesh.rotation.set(0.1, angle + Math.PI / 2, 0);
      orbitGroup.add(mesh);
      miniMeshes.push(mesh);
    }

    const particleCount = 120;
    const particleBasePositions = new Float32Array(particleCount * 3);
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      particleBasePositions[i * 3] = (Math.random() - 0.5) * 8;
      particleBasePositions[i * 3 + 1] = (Math.random() - 0.5) * 5;
      particleBasePositions[i * 3 + 2] = (Math.random() - 0.5) * 5;
      positions[i * 3] = particleBasePositions[i * 3];
      positions[i * 3 + 1] = particleBasePositions[i * 3 + 1];
      positions[i * 3 + 2] = particleBasePositions[i * 3 + 2];
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: NOVA.cyan,
      size: dark ? 0.048 : 0.038,
      sizeAttenuation: true,
      transparent: true,
      opacity: dark ? 0.82 : 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new THREE.Points(particleGeometry, particleMaterial));

    const themeObjects: ThemeSceneObjects = {
      scene,
      ambient,
      keyLight,
      fillLight,
      rimLight,
      documentMaterial,
      glowMaterial,
      miniMaterials,
      particleMaterial,
      particleGeometry,
      particleBasePositions,
      particleCount,
      documentTexture,
      glowTexture,
      miniTextures,
      miniMeshes,
      cardGroup,
    };

    const syncTheme = () => {
      const nextDark = isDarkTheme();
      refreshDocumentTextures(themeObjects, nextDark);
      applySceneTheme(themeObjects, nextDark);
      renderer.toneMappingExposure = nextDark ? 1.12 : 1.02;
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

    const onPointerDown = (e: PointerEvent) => {
      drag.active = true;
      drag.pointerId = e.pointerId;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      renderer.domElement.style.cursor = 'grabbing';
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag.active || drag.pointerId !== e.pointerId) return;
      drag.targetY += (e.clientX - drag.lastX) * 0.004;
      drag.targetX += (e.clientY - drag.lastY) * 0.003;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.targetX = THREE.MathUtils.clamp(drag.targetX, -0.35, 0.35);
      drag.targetY = THREE.MathUtils.clamp(drag.targetY, -0.55, 0.55);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (drag.pointerId !== e.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
      renderer.domElement.style.cursor = 'grab';
      renderer.domElement.releasePointerCapture(e.pointerId);
    };

    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      const m = prefersReducedMotion ? 0.1 : 1;
      if (!drag.active) {
        drag.targetX *= 0.93;
        drag.targetY *= 0.93;
      }
      drag.currentX = THREE.MathUtils.lerp(drag.currentX, drag.targetX, 0.07);
      drag.currentY = THREE.MathUtils.lerp(drag.currentY, drag.targetY, 0.07);

      cardGroup.rotation.y = drag.currentY + Math.sin(t * 0.2 * m) * 0.1;
      cardGroup.rotation.x = drag.currentX + Math.sin(t * 0.14 * m) * 0.05;
      cardGroup.position.y = Math.sin(t * 0.65 * m) * 0.08;
      orbitGroup.rotation.y = t * 0.18 * m;

      miniMeshes.forEach((mesh) => {
        const z = mesh.getWorldPosition(new THREE.Vector3()).z;
        (mesh.material as THREE.MeshStandardMaterial).opacity = THREE.MathUtils.clamp(0.15 + (z + 1.5) / 5, 0.12, 0.5);
      });

      const posAttr = themeObjects.particleGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < themeObjects.particleCount; i += 1) {
        const bx = themeObjects.particleBasePositions[i * 3];
        const by = themeObjects.particleBasePositions[i * 3 + 1];
        const bz = themeObjects.particleBasePositions[i * 3 + 2];
        const phase = i * 0.7;
        posAttr.setXYZ(
          i,
          bx + Math.sin(t * 0.55 * m + phase) * 0.12,
          by + Math.sin(t * 0.85 * m + phase * 1.3) * 0.18,
          bz + Math.cos(t * 0.45 * m + phase * 0.9) * 0.1,
        );
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
      refs.current = { renderer, frameId: requestAnimationFrame(animate) };
    };

    resize();
    window.addEventListener('resize', resize);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    refs.current = { renderer, frameId: requestAnimationFrame(animate) };

    return () => {
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      themeObserver.disconnect();
      if (refs.current) cancelAnimationFrame(refs.current.frameId);
      documentTexture?.dispose();
      glowTexture?.dispose();
      miniTextures.forEach((t) => t.dispose());
      particleGeometry.dispose();
      documentMaterial.dispose();
      glowMaterial.dispose();
      backMaterial.dispose();
      edgeMat.dispose();
      miniMaterials.forEach((mat) => mat.dispose());
      particleMaterial.dispose();
      mainDocument.geometry.dispose();
      cardBack.geometry.dispose();
      glowPlane.geometry.dispose();
      miniMeshes.forEach((mesh) => mesh.geometry.dispose());
      cardGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj !== mainDocument && obj !== cardBack && obj !== glowPlane && !miniMeshes.includes(obj)) {
          obj.geometry.dispose();
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 h-full w-full pointer-events-auto [mask-image:radial-gradient(ellipse_at_center,black_62%,transparent_96%)]"
      aria-hidden="true"
    />
  );
}
