'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type SceneRefs = {
  frameId: number;
  renderer: THREE.WebGLRenderer;
};

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
  ringMaterial: THREE.MeshStandardMaterial;
  checkMaterial: THREE.MeshStandardMaterial;
  miniMaterials: THREE.MeshStandardMaterial[];
  particleMaterial: THREE.PointsMaterial;
};

function applySceneTheme(objects: ThemeSceneObjects, isDark: boolean) {
  objects.scene.fog = new THREE.Fog(isDark ? 0x09090b : 0xf8fafc, 8, 22);
  objects.ambient.intensity = isDark ? 0.7 : 1.15;
  objects.keyLight.color.set(isDark ? 0xfacc15 : 0xf59e0b);
  objects.keyLight.intensity = isDark ? 9 : 11;
  objects.accentLight.color.set(isDark ? 0xef4444 : 0x2563eb);
  objects.accentLight.intensity = isDark ? 8 : 7;

  objects.documentMaterial.clearcoat = isDark ? 0.35 : 0.55;
  objects.documentMaterial.needsUpdate = true;

  objects.ringMaterial.color.set(isDark ? 0xfacc15 : 0xd97706);
  objects.ringMaterial.emissive.set(isDark ? 0x7c2d12 : 0x92400e);
  objects.ringMaterial.emissiveIntensity = isDark ? 0.7 : 0.25;

  objects.checkMaterial.color.set(isDark ? 0x22c55e : 0x16a34a);
  objects.checkMaterial.emissive.set(isDark ? 0x14532d : 0x166534);
  objects.checkMaterial.emissiveIntensity = isDark ? 0.85 : 0.25;

  objects.miniMaterials.forEach((material) => {
    material.color.set(isDark ? 0xffffff : 0xf8fafc);
    material.emissive.set(isDark ? 0x451a03 : 0x1e3a8a);
    material.emissiveIntensity = isDark ? 0.2 : 0.08;
  });

  objects.particleMaterial.color.set(isDark ? 0xfacc15 : 0x2563eb);
  objects.particleMaterial.opacity = isDark ? 0.75 : 0.42;
}

function createDocumentTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;

  const context = canvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#facc15';
  context.fillRect(0, 0, canvas.width, 72);
  context.fillStyle = '#18181b';
  context.font = 'bold 34px Arial';
  context.fillText('DTE', 36, 48);

  context.fillStyle = '#27272a';
  context.font = '22px Arial';
  context.fillText('Verificacion tributaria', 36, 132);

  context.fillStyle = '#d4d4d8';
  for (let index = 0; index < 8; index += 1) {
    context.fillRect(36, 172 + index * 40, 310 + Math.sin(index) * 72, 12);
  }

  context.fillStyle = '#18181b';
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      if ((x + y) % 2 === 0 || x === 0 || y === 0 || x === 6 || y === 6) {
        context.fillRect(350 + x * 16, 420 + y * 16, 12, 12);
      }
    }
  }

  context.strokeStyle = '#22c55e';
  context.lineWidth = 16;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(62, 516);
  context.lineTo(122, 576);
  context.lineTo(222, 460);
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createMiniDocumentTexture(label: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 340;

  const context = canvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#facc15';
  context.fillRect(0, 0, canvas.width, 54);
  context.fillStyle = '#18181b';
  context.font = 'bold 30px Arial';
  context.fillText(label, 20, 38);

  context.fillStyle = '#cbd5e1';
  for (let index = 0; index < 5; index += 1) {
    context.fillRect(20, 92 + index * 34, 156 + (index % 2) * 34, 9);
  }

  context.strokeStyle = '#16a34a';
  context.lineWidth = 10;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(46, 278);
  context.lineTo(80, 312);
  context.lineTo(136, 248);
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export default function ThreeLandingScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<SceneRefs | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const isDarkTheme = () => document.documentElement.classList.contains('dark');
    scene.fog = new THREE.Fog(0x09090b, 8, 22);

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

    const keyLight = new THREE.PointLight(0xfacc15, 9, 18);
    keyLight.position.set(-3.5, 3, 5);
    scene.add(keyLight);

    const accentLight = new THREE.PointLight(0xef4444, 8, 15);
    accentLight.position.set(4, -1, 4);
    scene.add(accentLight);

    const documentTexture = createDocumentTexture();
    const documentMaterial = new THREE.MeshPhysicalMaterial({
      map: documentTexture ?? undefined,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.35,
      side: THREE.DoubleSide,
    });

    const mainDocument = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 3.05, 10, 10), documentMaterial);
    mainDocument.position.set(-0.2, 0.05, 0);
    root.add(mainDocument);

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.7,
      metalness: 0.45,
      roughness: 0.22,
    });
    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.035, 16, 96), ringMaterial);
    seal.position.set(1.08, -0.95, 0.12);
    seal.rotation.z = -0.2;
    root.add(seal);

    const checkShape = new THREE.Shape();
    checkShape.moveTo(-0.35, -0.02);
    checkShape.lineTo(-0.1, -0.28);
    checkShape.lineTo(0.42, 0.3);
    checkShape.lineTo(0.32, 0.42);
    checkShape.lineTo(-0.1, -0.02);
    checkShape.lineTo(-0.25, 0.12);
    checkShape.closePath();
    const checkMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x14532d, emissiveIntensity: 0.85 });
    const check = new THREE.Mesh(
      new THREE.ExtrudeGeometry(checkShape, { depth: 0.04, bevelEnabled: false }),
      checkMaterial,
    );
    check.position.set(1.05, -0.98, 0.16);
    root.add(check);

    const orbitGroup = new THREE.Group();
    root.add(orbitGroup);

    const miniDocumentLabels = ['CCF', 'FCF', 'NC', 'ND', 'FSE', 'JSON', 'CSV'];
    const miniTextures: THREE.CanvasTexture[] = [];
    const miniMaterials: THREE.MeshStandardMaterial[] = [];
    for (let index = 0; index < 9; index += 1) {
      const angle = (index / 9) * Math.PI * 2;
      const label = miniDocumentLabels[(index * 3 + 2) % miniDocumentLabels.length];
      const texture = createMiniDocumentTexture(label);
      if (texture) miniTextures.push(texture);
      const material = new THREE.MeshStandardMaterial({
        map: texture ?? undefined,
        color: 0xffffff,
        emissive: 0x451a03,
        emissiveIntensity: 0.2,
        roughness: 0.55,
        side: THREE.DoubleSide,
      });
      miniMaterials.push(material);
      const miniDoc = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.64), material);
      miniDoc.position.set(Math.cos(angle) * 3.55, Math.sin(angle * 1.3) * 1.05, Math.sin(angle) * 1.9);
      miniDoc.rotation.set(0.25, angle + Math.PI / 2, -0.08);
      orbitGroup.add(miniDoc);
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
        color: 0xfacc15,
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
      ringMaterial,
      checkMaterial,
      miniMaterials,
      particleMaterial,
    };
    applySceneTheme(themeObjects, isDarkTheme());

    const themeObserver = new MutationObserver(() => {
      applySceneTheme(themeObjects, isDarkTheme());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

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
      mainDocument.position.y = Math.sin(elapsed * 0.8 * motionScale) * 0.12;
      seal.rotation.z = elapsed * 0.7 * motionScale;
      check.rotation.z = Math.sin(elapsed * 1.1 * motionScale) * 0.08;
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
      if (refs.current) {
        window.cancelAnimationFrame(refs.current.frameId);
      }
      documentTexture?.dispose();
      miniTextures.forEach((texture) => texture.dispose());
      particleGeometry.dispose();
      documentMaterial.dispose();
      ringMaterial.dispose();
      checkMaterial.dispose();
      miniMaterials.forEach((material) => material.dispose());
      particleMaterial.dispose();
      check.geometry.dispose();
      mainDocument.geometry.dispose();
      seal.geometry.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
