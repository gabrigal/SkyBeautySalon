"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ParticleCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // --- Scene ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // --- Lights ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.3);
    pointLight.position.set(-5, -3, -2);
    scene.add(pointLight);

    // --- Hair strand particles (instanced capsules) ---
    const COUNT = 60;
    const geo = new THREE.CapsuleGeometry(0.018, 0.32, 3, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      roughness: 0.4,
      metalness: 0.2,
    });
    const strands = new THREE.InstancedMesh(geo, mat, COUNT);
    scene.add(strands);

    const particles = Array.from({ length: COUNT }, () => ({
      pos: [
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 4,
      ] as [number, number, number],
      rot: [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      ] as [number, number, number],
      speed: 0.08 + Math.random() * 0.15,
      offset: Math.random() * Math.PI * 2,
      scale: 0.6 + Math.random() * 0.8,
    }));

    // --- Floating orbs ---
    const orbGroup = new THREE.Group();
    scene.add(orbGroup);
    const orbGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.1,
      metalness: 0.6,
    });
    for (let i = 0; i < 5; i++) {
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(
        Math.cos((i / 5) * Math.PI * 2) * 5,
        (Math.random() - 0.5) * 3,
        Math.sin((i / 5) * Math.PI * 2) * 2
      );
      orbGroup.add(orb);
    }

    const dummy = new THREE.Object3D();
    const clock = new THREE.Clock();
    let animId: number;

    // --- Resize ---
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // --- Animation loop ---
    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Update strand matrices
      particles.forEach((p, i) => {
        const wave = t * p.speed + p.offset;
        dummy.position.set(
          p.pos[0] + Math.sin(wave * 0.7) * 0.4,
          p.pos[1] + Math.cos(wave * 0.5) * 0.25,
          p.pos[2]
        );
        dummy.rotation.set(
          p.rot[0] + Math.sin(wave * 0.3) * 0.15,
          p.rot[1] + t * 0.04,
          p.rot[2] + Math.cos(wave * 0.2) * 0.1
        );
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        strands.setMatrixAt(i, dummy.matrix);
      });
      strands.instanceMatrix.needsUpdate = true;

      // Rotate orb group gently
      orbGroup.rotation.y = t * 0.03;
      orbGroup.rotation.x = Math.sin(t * 0.02) * 0.05;

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      geo.dispose();
      mat.dispose();
      orbGeo.dispose();
      orbMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 pointer-events-none" />;
}
