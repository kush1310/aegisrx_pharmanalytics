import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ── SceneContent rendering the beating heart and green ECG line ──
function SceneContent() {
  const heartRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.LineSegments>(null);
  const { viewport } = useThree();

  // Beating Heart geometry (perfectly symmetrical Bezier heart)
  const heartGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.35);
    shape.bezierCurveTo(0.15, 0.65, 0.55, 0.65, 0.55, 0.25);
    shape.bezierCurveTo(0.55, -0.1, 0.15, -0.4, 0, -0.7);
    shape.bezierCurveTo(-0.15, -0.4, -0.55, -0.1, -0.55, 0.25);
    shape.bezierCurveTo(-0.55, 0.65, -0.15, 0.65, 0, 0.35);

    const extrudeSettings = {
      depth: 0.16,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    return geometry;
  }, []);

  // Glowing green ECG pulse line segments
  const ecgGeometry = useMemo(() => {
    const points = [
      new THREE.Vector3(-0.8, 0.0, 0.0),
      new THREE.Vector3(-0.4, 0.0, 0.0),
      new THREE.Vector3(-0.35, 0.03, 0.0),  // P wave
      new THREE.Vector3(-0.3, 0.0, 0.0),
      new THREE.Vector3(-0.25, -0.08, 0.0), // Q wave
      new THREE.Vector3(-0.18, 0.45, 0.0),  // R wave spike
      new THREE.Vector3(-0.12, -0.25, 0.0), // S wave spike
      new THREE.Vector3(-0.06, 0.0, 0.0),
      new THREE.Vector3(0.05, 0.08, 0.0),   // T wave
      new THREE.Vector3(0.15, 0.0, 0.0),
      new THREE.Vector3(0.8, 0.0, 0.0)
    ];

    const vertices: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      vertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geo;
  }, []);

  useFrame((state) => {
    // 1. Double pulse heartbeat loop ("lub-dub" scale pulse)
    if (heartRef.current) {
      const t = state.clock.getElapsedTime() * 1.5;
      const doubleBeat = 
        Math.pow(Math.sin(t * Math.PI), 10) * 0.12 + 
        Math.pow(Math.sin((t - 0.22) * Math.PI), 10) * 0.05;
      const s = 1.0 + doubleBeat;
      heartRef.current.scale.set(s, s, s);
      
      // Gentle breathing rotation
      heartRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.4) * 0.15;
    }

    // 2. Pulsing ECG neon opacity
    if (pulseRef.current) {
      const material = pulseRef.current.material as THREE.LineBasicMaterial;
      if (material) {
        const beatVal = Math.sin(state.clock.getElapsedTime() * 1.5 * Math.PI);
        material.opacity = 0.45 + Math.max(0, beatVal) * 0.55;
      }
    }
  });

  // Responsive scale factor to fit cleanly in the transparent container
  const scaleFactor = Math.min(viewport.width / 2.0, 1.3);

  return (
    <group scale={[scaleFactor, scaleFactor, scaleFactor]}>
      {/* ── Beating Medical Heart (Physical Glowing Red Mesh) ── */}
      <mesh ref={heartRef} geometry={heartGeometry} castShadow>
        <meshPhysicalMaterial
          color="#f43f5e"
          emissive="#be123c"
          emissiveIntensity={0.2}
          roughness={0.12}
          metalness={0.7}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          transmission={0.3}
          thickness={0.5}
        />
      </mesh>

      {/* ── Glowing Neon ECG Line (Analytics Pulse) ── */}
      <lineSegments ref={pulseRef} geometry={ecgGeometry} position={[0, -0.05, 0.18]}>
        <lineBasicMaterial 
          color="#10b981" 
          linewidth={2} 
          transparent 
          opacity={0.85} 
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

// ── Main Canvas Component ──
export default function Medical3DHeart() {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.5], fov: 42 }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1.5} />
      
      {/* Studio lighting highlights */}
      <pointLight position={[5, 5, 5]} intensity={4.5} color="#ffffff" />
      <pointLight position={[-5, 3, 2]} intensity={2.5} color="#fffbeb" />
      <pointLight position={[0, -5, 3]} intensity={1.5} color="#f43f5e" />
      <directionalLight position={[0, 5, 2]} intensity={2} color="#ffffff" />

      <SceneContent />
      
      <OrbitControls 
        enableZoom={false} 
        enablePan={false} 
        maxPolarAngle={Math.PI / 1.7} 
        minPolarAngle={Math.PI / 2.3} 
      />
    </Canvas>
  );
}
