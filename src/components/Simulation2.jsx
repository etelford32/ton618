import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import CompanionStar from '../physics/CompanionStar';

const AdvancedAccretionPhysics = () => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const animationRef = useRef(null);
  const diskInstanceRef = useRef(null);
  const diskDataRef = useRef([]);
  const accretionTrailsRef = useRef([]);
  const jetParticlesRef = useRef([]);
  const photonOrbitersRef = useRef([]);
  const shockWavesRef = useRef([]);
  const magneticFieldRef = useRef([]);
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3 });
  const companionStarRef = useRef(null);
  
  const [params, setParams] = useState({
    blackHoleMass: 66,
    spinParameter: 0.95,
    accretionRate: 2.5,
    viscosity: 1.5,
    magneticFieldStrength: 2.5,
    turbulence: 2.0,
    jetLaunchRate: 2.0,
    jetAcceleration: 2.0,
    frameDragging: 1.5,
    tidalForce: 1.5,
    shockHeating: 2.0,
    verticalMotion: 1.5,
    cameraDistance: 180,
    showTrails: true,
    showJets: true,
    showMagneticField: true,
    showShockWaves: true,
    showFrameDragging: true,
    showSpaghettification: true,
    showPhotonOrbiters: true,
    timeScale: 1.0,
    // Companion star parameters
    showCompanionStar: true,
    companionStarDistance: 250,
    companionStarMass: 40,
    companionStarTemperature: 40000,
    orbitalSpeedMultiplier: 0.1,
    // Stellar wind physics
    enableStellarWind: true,
    windVelocity: 2000,
    windDensity: 1.0,
    enableGravitationalForce: true,
    gravitationalStrength: 1.0,
    showInfluenceSphere: false,
    // Quantum effects
    enableQuantumEffects: true,
    hawkingRadiationIntensity: 0.5
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [starStats, setStarStats] = useState({
    windParticleCount: 0,
    quantumParticleCount: 0,
    influenceRadius: 0,
    massLossRate: 0
  });
  const [stats, setStats] = useState({
    fps: 60,
    particlesAccreted: 0,
    jetsLaunched: 0,
    avgInfallSpeed: 0,
    maxTemperature: 0,
    powerOutput: 0,
    avgJetSpeed: 0
  });

  const EVENT_HORIZON = 13;
  const ISCO = 18;
  const PHOTON_SPHERE = 19.5;

  // Calculate position along magnetic field line
  const getFieldLinePosition = (fieldLineIndex, progress, spinParam, isUpper) => {
    const angle = (fieldLineIndex / 32) * Math.PI * 2;
    const t = Math.min(1, progress);
    
    const r = ISCO * 0.8 * (1 - t * 0.7);
    const z = t * 250 * Math.pow(t, 0.35) * (isUpper ? 1 : -1);
    const twist = angle + t * 0.25 * spinParam;
    const wobble = Math.sin(t * 10) * 3 * t;
    
    return new THREE.Vector3(
      r * Math.cos(twist) + wobble * Math.cos(twist + Math.PI / 2),
      z,
      r * Math.sin(twist) + wobble * Math.sin(twist + Math.PI / 2)
    );
  };

  const zoomIn = () => {
    setParams(prev => ({
      ...prev,
      cameraDistance: Math.max(30, prev.cameraDistance - 20)
    }));
  };

  const zoomOut = () => {
    setParams(prev => ({
      ...prev,
      cameraDistance: Math.min(1000, prev.cameraDistance + 20)
    }));
  };

  const resetSimulation = () => {
    const diskData = diskDataRef.current;
    const diskInstance = diskInstanceRef.current;
    if (!diskData || !diskInstance) return;

    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();
    
    for (let i = 0; i < diskData.length; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = ISCO * 1.5 + Math.pow(Math.random(), 0.8) * 150;
      const height = (Math.random() - 0.5) * radius * 0.15;
      const speed = 0.012 * Math.pow(100 / radius, 1.5);
      const verticalSpeed = (Math.random() - 0.5) * 0.1;
      
      diskData[i] = {
        angle: angle,
        radius: radius,
        initialRadius: radius,
        height: height,
        speed: speed,
        verticalSpeed: verticalSpeed,
        infallSpeed: 0.04 * (1 / radius),
        temp: 0.3,
        angularMomentum: radius * speed,
        stretchFactor: 1.0,
        brightness: 0.5,
        age: 0,
        orbitalTilt: (Math.random() - 0.5) * 0.3,
        verticalPhase: Math.random() * Math.PI * 2,
        trail: []
      };
      
      tempMatrix.setPosition(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      diskInstance.setMatrixAt(i, tempMatrix);
      // Initial blackbody color
      tempColor.setRGB(1.0, 0.7, 0.4).multiplyScalar(1.0);
      diskInstance.setColorAt(i, tempColor);
    }
    
    diskInstance.instanceMatrix.needsUpdate = true;
    diskInstance.instanceColor?.needsUpdate && (diskInstance.instanceColor.needsUpdate = true);
    
    // Clear effects
    accretionTrailsRef.current.forEach(trail => {
      sceneRef.current.remove(trail);
      trail.geometry.dispose();
      trail.material.dispose();
    });
    accretionTrailsRef.current = [];
    
    jetParticlesRef.current.forEach(jet => {
      if (jet.mesh) sceneRef.current.remove(jet.mesh);
    });
    jetParticlesRef.current = [];
    
    photonOrbitersRef.current.forEach(photon => {
      if (photon.mesh) sceneRef.current.remove(photon.mesh);
    });
    photonOrbitersRef.current = [];
    
    shockWavesRef.current.forEach(wave => {
      sceneRef.current.remove(wave);
      wave.geometry.dispose();
      wave.material.dispose();
    });
    shockWavesRef.current = [];
    
    setStats({ fps: 60, particlesAccreted: 0, jetsLaunched: 0, avgInfallSpeed: 0, maxTemperature: 0, powerOutput: 0, avgJetSpeed: 0 });
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 15000);
    camera.position.set(180, 120, 180);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Intense lighting
    const ambientLight = new THREE.AmbientLight(0x0a0515, 0.2);
    scene.add(ambientLight);

    const centralLight = new THREE.PointLight(0xffffff, 10, 2000);
    scene.add(centralLight);

    // Multiple disk lights
    const diskLights = [];
    for (let i = 0; i < 6; i++) {
      const light = new THREE.PointLight(0xff4400, 6, 400);
      const angle = (i / 6) * Math.PI * 2;
      light.position.set(Math.cos(angle) * 50, 0, Math.sin(angle) * 50);
      scene.add(light);
      diskLights.push(light);
    }

    // Jet lights
    const jetLight1 = new THREE.PointLight(0x00ffff, 8, 1000);
    jetLight1.position.set(0, 150, 0);
    scene.add(jetLight1);

    const jetLight2 = new THREE.PointLight(0x00ffff, 8, 1000);
    jetLight2.position.set(0, -150, 0);
    scene.add(jetLight2);

    // Black Hole Event Horizon
    const horizonGeometry = new THREE.SphereGeometry(EVENT_HORIZON, 64, 64);
    const horizonMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const horizon = new THREE.Mesh(horizonGeometry, horizonMaterial);
    scene.add(horizon);

    // Multi-layered glow
    for (let i = 0; i < 3; i++) {
      const glowGeometry = new THREE.SphereGeometry(EVENT_HORIZON * (1.05 + i * 0.03), 64, 64);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xff0000 : (i === 1 ? 0xff4400 : 0xff8800),
        transparent: true,
        opacity: 0.3 - i * 0.08,
        side: THREE.BackSide
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      scene.add(glow);
    }

    // Ergosphere
    const ergoGeometry = new THREE.SphereGeometry(EVENT_HORIZON * 1.4, 64, 64);
    const ergoMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.05,
      wireframe: true
    });
    const ergosphere = new THREE.Mesh(ergoGeometry, ergoMaterial);
    ergosphere.scale.y = 0.7;
    scene.add(ergosphere);

    // ISCO Ring
    const iscoGeometry = new THREE.RingGeometry(ISCO - 1, ISCO + 1, 256);
    const iscoMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          float dist = abs(vUv.x - 0.5) * 2.0;
          float pulse = sin(time * 5.0 + dist * 20.0) * 0.5 + 0.5;
          float alpha = (1.0 - dist) * 0.8 * pulse;
          vec3 color = mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), pulse);
          gl_FragColor = vec4(color, alpha);
        }
      `
    });
    const iscoRing = new THREE.Mesh(iscoGeometry, iscoMaterial);
    iscoRing.rotation.x = Math.PI / 2;
    scene.add(iscoRing);

    // Enhanced Photon Sphere
    const photonGeometry = new THREE.SphereGeometry(PHOTON_SPHERE, 128, 128);
    const photonMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          float theta = atan(vPosition.z, vPosition.x);
          float phi = acos(vPosition.y / length(vPosition));
          
          float orbit1 = sin(theta * 15.0 - time * 12.0) * sin(phi * 8.0 - time * 8.0);
          float orbit2 = sin(theta * 20.0 + time * 15.0) * sin(phi * 12.0 + time * 10.0);
          float orbit3 = sin(theta * 25.0 - time * 18.0 + phi * 15.0);
          
          float intensity = max(max(orbit1, orbit2), orbit3) * 0.5 + 0.5;
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 3.0);
          
          float alpha = intensity * fresnel * 0.5;
          vec3 color = mix(vec3(1.0, 0.5, 0.0), vec3(0.0, 0.8, 1.0), intensity);
          
          gl_FragColor = vec4(color, alpha);
        }
      `
    });
    const photonSphere = new THREE.Mesh(photonGeometry, photonMaterial);
    scene.add(photonSphere);

    // 3D Magnetic Field Lines
    const magneticFieldLines = [];
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const points = [];
      
      for (let j = 0; j <= 100; j++) {
        const t = j / 100;
        const r = ISCO * 0.8 * (1 - t * 0.7);
        const z = t * 250 * Math.pow(t, 0.35);
        const twist = angle + t * 0.25 * params.spinParameter;
        const wobble = Math.sin(t * 10) * 3 * t;
        
        points.push(new THREE.Vector3(
          r * Math.cos(twist) + wobble * Math.cos(twist + Math.PI / 2),
          z,
          r * Math.sin(twist) + wobble * Math.sin(twist + Math.PI / 2)
        ));
      }
      
      // Lower hemisphere
      for (let j = 0; j <= 100; j++) {
        const t = j / 100;
        const r = ISCO * 0.8 * (1 - t * 0.7);
        const z = -t * 250 * Math.pow(t, 0.35);
        const twist = angle + t * 0.25 * params.spinParameter;
        const wobble = Math.sin(t * 10) * 3 * t;
        
        points.push(new THREE.Vector3(
          r * Math.cos(twist) + wobble * Math.cos(twist + Math.PI / 2),
          z,
          r * Math.sin(twist) + wobble * Math.sin(twist + Math.PI / 2)
        ));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x00ffaa,
        transparent: true,
        opacity: 0.6
      });
      
      const fieldLine = new THREE.Line(geometry, material);
      magneticFieldLines.push(fieldLine);
      scene.add(fieldLine);
    }
    magneticFieldRef.current = magneticFieldLines;

    // Frame Dragging
    const frameDraggingRings = [];
    for (let i = 0; i < 8; i++) {
      const radius = ISCO + i * 8;
      const segments = 64;
      const points = [];
      
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        ));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x44ff88,
        transparent: true,
        opacity: 0.4
      });
      
      const ring = new THREE.Line(geometry, material);
      ring.userData = { radius: radius, baseRotation: 0 };
      frameDraggingRings.push(ring);
      scene.add(ring);
    }

    // ACCRETION DISK
    const particleCount = 35000;
    const diskGeometry = new THREE.SphereGeometry(0.15, 8, 8);

    // Shader material for self-emissive glow
    const diskMaterial = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        baseColor: { value: new THREE.Color(1, 1, 1) }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vColor;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vColor = instanceColor;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vColor;

        void main() {
          // Fresnel glow effect (brighter at edges)
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 2.0);
          float glow = 0.6 + fresnel * 0.8;

          // Temperature-based emission
          vec3 emissive = vColor * glow * 2.0;

          gl_FragColor = vec4(emissive, 0.9);
        }
      `
    });

    const diskInstance = new THREE.InstancedMesh(diskGeometry, diskMaterial, particleCount);
    diskInstance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(diskInstance);
    diskInstanceRef.current = diskInstance;
    
    const diskData = [];
    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = ISCO * 1.5 + Math.pow(Math.random(), 0.8) * 150;
      const height = (Math.random() - 0.5) * radius * 0.15;
      const speed = 0.012 * Math.pow(100 / radius, 1.5);
      const verticalSpeed = (Math.random() - 0.5) * 0.1;
      
      diskData.push({
        angle: angle,
        radius: radius,
        initialRadius: radius,
        height: height,
        speed: speed,
        verticalSpeed: verticalSpeed,
        infallSpeed: 0.04 * (1 / radius),
        temp: 0.3,
        angularMomentum: radius * speed,
        stretchFactor: 1.0,
        brightness: 0.5,
        age: 0,
        orbitalTilt: (Math.random() - 0.5) * 0.3,
        verticalPhase: Math.random() * Math.PI * 2,
        trail: []
      });
      
      tempMatrix.setPosition(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      diskInstance.setMatrixAt(i, tempMatrix);
      // Initial blackbody color
      tempColor.setRGB(1.0, 0.7, 0.4).multiplyScalar(1.0);
      diskInstance.setColorAt(i, tempColor);
    }
    
    diskDataRef.current = diskData;

    // Background stars
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    const starColors = [];
    
    for (let i = 0; i < 8000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1500 + Math.random() * 2500;
      
      starPositions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      
      const brightness = 0.3 + Math.random() * 0.7;
      starColors.push(brightness, brightness, brightness * 1.1);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.7
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Initialize companion star (massive O-type supergiant)
    const blackHoleMass = 66e9; // 66 billion solar masses
    const companionStar = new CompanionStar(scene, blackHoleMass, {
      mass: params.companionStarMass,
      temperature: params.companionStarTemperature,
      orbitalRadius: params.companionStarDistance,
      orbitalSpeedMultiplier: params.orbitalSpeedMultiplier,
      enableWind: params.enableStellarWind,
      windVelocity: params.windVelocity,
      windDensity: params.windDensity,
      enableGravity: params.enableGravitationalForce,
      gravitationalStrength: params.gravitationalStrength,
      enableQuantumEffects: params.enableQuantumEffects,
      hawkingRadiationIntensity: params.hawkingRadiationIntensity,
      showInfluenceSphere: params.showInfluenceSphere
    });
    companionStarRef.current = companionStar;

    // Mouse controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const onMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      
      cameraAngleRef.current.theta -= deltaX * 0.005;
      cameraAngleRef.current.phi += deltaY * 0.005;
      cameraAngleRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraAngleRef.current.phi));
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      setParams(prev => ({
        ...prev,
        cameraDistance: Math.max(30, Math.min(1000, prev.cameraDistance + e.deltaY * 0.25))
      }));
    };
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Arrays
    const accretionTrails = [];
    accretionTrailsRef.current = accretionTrails;
    
    const jetParticles = [];
    jetParticlesRef.current = jetParticles;
    
    const photonOrbiters = [];
    photonOrbitersRef.current = photonOrbiters;
    
    const shockWaves = [];
    shockWavesRef.current = shockWaves;

    // Animation loop
    let time = 0;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsUpdateTime = 0;
    let particlesAccreted = 0;
    let jetsLaunched = 0;
    
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      const currentTime = performance.now();
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      
      frameCount++;
      fpsUpdateTime += deltaTime;
      if (fpsUpdateTime >= 0.5) {
        setStats(prev => ({ ...prev, fps: Math.round(frameCount / fpsUpdateTime) }));
        frameCount = 0;
        fpsUpdateTime = 0;
      }

      if (isPlaying) {
        time += 0.015 * params.timeScale;

        // Update shaders
        photonSphere.material.uniforms.time.value = time;
        iscoRing.material.uniforms.time.value = time;

        // Animate disk lights
        diskLights.forEach((light, i) => {
          const angle = (i / diskLights.length) * Math.PI * 2 + time * 0.5;
          light.position.x = Math.cos(angle) * 60;
          light.position.z = Math.sin(angle) * 60;
          light.position.y = Math.sin(time * 2 + i) * 15;
          light.intensity = 5 + Math.sin(time * 3 + i) * 2;
        });

        // Magnetic field animation
        magneticFieldRef.current.forEach((line, i) => {
          line.visible = params.showMagneticField;
          if (params.showMagneticField) {
            line.rotation.y = time * 0.15 * params.spinParameter * params.magneticFieldStrength;
            line.material.opacity = 0.5 + Math.sin(time * 2 + i * 0.3) * 0.2;
          }
        });

        // Frame dragging
        frameDraggingRings.forEach(ring => {
          ring.visible = params.showFrameDragging;
          if (params.showFrameDragging) {
            const dragRate = (2 * params.spinParameter * 100) / Math.pow(ring.userData.radius, 3);
            ring.rotation.y += dragRate * 0.01 * params.frameDragging * params.timeScale;
          }
        });

        // Spawn photon orbiters
        if (params.showPhotonOrbiters && Math.random() < 0.05) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          
          const photon = {
            position: new THREE.Vector3(
              PHOTON_SPHERE * Math.sin(phi) * Math.cos(theta),
              PHOTON_SPHERE * Math.cos(phi),
              PHOTON_SPHERE * Math.sin(phi) * Math.sin(theta)
            ),
            angle: theta,
            phi: phi,
            speed: 0.05,
            age: 0,
            maxAge: 200,
            mesh: null
          };
          
          const geom = new THREE.SphereGeometry(0.4, 8, 8);
          const mat = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xffaa00 : 0x00aaff,
            transparent: true,
            opacity: 0.9
          });
          
          photon.mesh = new THREE.Mesh(geom, mat);
          photon.mesh.position.copy(photon.position);
          scene.add(photon.mesh);
          photonOrbiters.push(photon);
        }

        // Update photon orbiters
        for (let i = photonOrbiters.length - 1; i >= 0; i--) {
          const photon = photonOrbiters[i];
          photon.age++;
          
          if (photon.age > photon.maxAge) {
            scene.remove(photon.mesh);
            photon.mesh.geometry.dispose();
            photon.mesh.material.dispose();
            photonOrbiters.splice(i, 1);
            continue;
          }
          
          photon.angle += photon.speed * params.spinParameter;
          photon.phi += Math.sin(time * 2 + photon.angle) * 0.01;
          
          photon.position.set(
            PHOTON_SPHERE * Math.sin(photon.phi) * Math.cos(photon.angle),
            PHOTON_SPHERE * Math.cos(photon.phi),
            PHOTON_SPHERE * Math.sin(photon.phi) * Math.sin(photon.angle)
          );
          
          photon.mesh.position.copy(photon.position);
          photon.mesh.material.opacity = 0.9 * (1 - photon.age / photon.maxAge);
        }

        // Update shock waves
        for (let i = shockWaves.length - 1; i >= 0; i--) {
          const wave = shockWaves[i];
          wave.userData.age++;
          wave.scale.multiplyScalar(1.05);
          wave.material.opacity *= 0.96;
          wave.rotation.z += 0.02;
          
          if (wave.userData.age > 50 || wave.material.opacity < 0.02) {
            scene.remove(wave);
            wave.geometry.dispose();
            wave.material.dispose();
            shockWaves.splice(i, 1);
          }
        }

        // Update jet particles - CONFINED BY MAGNETIC FIELD
        let totalJetSpeed = 0;
        for (let i = jetParticles.length - 1; i >= 0; i--) {
          const jet = jetParticles[i];
          jet.age++;
          
          if (jet.age > jet.maxAge) {
            if (jet.mesh) {
              scene.remove(jet.mesh);
              jet.mesh.geometry.dispose();
              jet.mesh.material.dispose();
            }
            jetParticles.splice(i, 1);
            continue;
          }
          
          // ACCELERATION along field line
          const baseProgress = jet.age / jet.maxAge;
          const accelFactor = Math.pow(jet.age / 30, 1.5) * params.jetAcceleration;
          const speedFactor = 1 + accelFactor * 5;
          
          jet.progress += 0.004 * speedFactor * params.timeScale;
          jet.progress = Math.min(1, jet.progress);
          
          // FOLLOW MAGNETIC FIELD LINE PRECISELY
          const newPos = getFieldLinePosition(
            jet.fieldLineIndex, 
            jet.progress, 
            params.spinParameter,
            jet.isUpper
          );
          
          jet.position.copy(newPos);
          
          const velocityMagnitude = 0.3 * speedFactor;
          totalJetSpeed += velocityMagnitude;
          
          if (jet.mesh) {
            jet.mesh.position.copy(jet.position);
            jet.mesh.material.opacity = (1 - jet.age / jet.maxAge) * 0.9;
            
            // Size increases with speed
            const sizeScale = 0.7 + accelFactor * 0.15;
            jet.mesh.scale.set(sizeScale, sizeScale * 1.5, sizeScale);
          }
        }

        // ACCRETION DISK PHYSICS
        const diskData = diskDataRef.current;
        const diskInstance = diskInstanceRef.current;
        const updateMatrix = new THREE.Matrix4();
        const updateColor = new THREE.Color();
        const updateScale = new THREE.Vector3();
        
        let totalInfallSpeed = 0;
        let maxTemp = 0;
        let powerOutput = 0;
        
        for (let i = 0; i < diskData.length; i++) {
          const p = diskData[i];
          p.age++;

          p.angle += p.speed * params.timeScale;

          const distToISCO = p.radius - ISCO;
          const infallAcceleration = distToISCO < 10 ? (1 + (10 - distToISCO) * 0.3) : 1;
          p.radius -= p.infallSpeed * params.accretionRate * params.viscosity * infallAcceleration * params.timeScale;

          totalInfallSpeed += p.infallSpeed * infallAcceleration;

          // Companion star gravitational/magnetic influence
          if (params.showCompanionStar && companionStarRef.current) {
            const particlePos = new THREE.Vector3(
              Math.cos(p.angle) * p.radius,
              p.height,
              Math.sin(p.angle) * p.radius
            );

            const force = companionStarRef.current.getParticleForce(particlePos);

            if (force.length() > 0) {
              // Convert force to cylindrical coordinates
              const toParticle = new THREE.Vector2(particlePos.x, particlePos.z);
              const radialDir = toParticle.clone().normalize();
              const tangentialDir = new THREE.Vector2(-radialDir.y, radialDir.x);

              // Project force onto radial and tangential directions
              const forceXZ = new THREE.Vector2(force.x, force.z);
              const radialForce = forceXZ.dot(radialDir);
              const tangentialForce = forceXZ.dot(tangentialDir);

              // Apply forces (scaled for simulation stability)
              p.radius += radialForce * 0.5 * params.timeScale;
              p.angle += tangentialForce / (p.radius + 1) * 0.02 * params.timeScale;
              p.height += force.y * 0.3 * params.timeScale;

              // Clamp height to reasonable bounds
              p.height = Math.max(-20, Math.min(20, p.height));
            }
          }

          // Vertical dynamics
          p.verticalPhase += 0.02 * params.timeScale * params.verticalMotion;
          const verticalOscillation = Math.sin(p.verticalPhase) * 3;
          const turbulentHeight = Math.sin(time * 2 + i * 0.01) * params.turbulence * 2;
          
          const heightFactor = Math.max(0.2, p.radius / p.initialRadius);
          p.height = (p.height * 0.98 + verticalOscillation * 0.02) * heightFactor + turbulentHeight;
          
          p.orbitalTilt += 0.001 * params.frameDragging * params.spinParameter * params.timeScale;
          const tiltedHeight = p.height * Math.cos(p.orbitalTilt);
          
          p.angularMomentum *= 0.999;
          p.speed = p.angularMomentum / p.radius;
          
          // Temperature
          const tempFactor = Math.pow(Math.max(0, (p.initialRadius - p.radius) / p.initialRadius), 2);
          const iscoProximity = Math.max(0, 1 - distToISCO / 20);
          p.temp = 0.3 + tempFactor * 0.4 + iscoProximity * 0.8 * params.shockHeating;
          
          const shearRate = Math.abs(p.speed - 0.012 * Math.pow(100 / p.radius, 1.5));
          p.temp += shearRate * params.viscosity * 0.5;
          p.temp = Math.min(1.5, p.temp);
          
          maxTemp = Math.max(maxTemp, p.temp);
          
          if (params.showSpaghettification && distToISCO < 5) {
            p.stretchFactor = 1 + (5 - distToISCO) * 0.4 * params.tidalForce;
          } else {
            p.stretchFactor = 1.0;
          }
          
          p.brightness = 0.5 + p.temp * 0.3 + iscoProximity * 1.5;
          powerOutput += p.brightness;
          
          // Trails
          if (params.showTrails && p.age % 3 === 0) {
            const pos = new THREE.Vector3(
              Math.cos(p.angle) * p.radius,
              tiltedHeight,
              Math.sin(p.angle) * p.radius
            );
            p.trail.push(pos);
            if (p.trail.length > 15) p.trail.shift();
            
            if (p.trail.length > 2 && distToISCO < 30) {
              const trailGeometry = new THREE.BufferGeometry().setFromPoints(p.trail);
              const trailMaterial = new THREE.LineBasicMaterial({
                color: p.temp > 0.7 ? 0xffff00 : (p.temp > 0.5 ? 0xff8800 : 0xff4400),
                transparent: true,
                opacity: 0.6 * Math.min(1, iscoProximity * 2),
                linewidth: 2
              });
              
              const trail = new THREE.Line(trailGeometry, trailMaterial);
              scene.add(trail);
              accretionTrails.push(trail);
              
              if (accretionTrails.length > 500) {
                const oldTrail = accretionTrails.shift();
                scene.remove(oldTrail);
                oldTrail.geometry.dispose();
                oldTrail.material.dispose();
              }
            }
          }
          
          // ACCRETION EVENT
          if (p.radius < ISCO) {
            particlesAccreted++;
            
            // Shock wave
            if (params.showShockWaves && Math.random() < 0.3) {
              const waveGeometry = new THREE.RingGeometry(0.5, 2, 32);
              const waveMaterial = new THREE.MeshBasicMaterial({
                color: p.temp > 0.8 ? 0xffffff : 0xff6600,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
              });
              const wave = new THREE.Mesh(waveGeometry, waveMaterial);
              wave.position.set(
                Math.cos(p.angle) * ISCO,
                tiltedHeight,
                Math.sin(p.angle) * ISCO
              );
              wave.rotation.x = Math.PI / 2 + p.orbitalTilt;
              wave.userData = { age: 0 };
              scene.add(wave);
              shockWaves.push(wave);
            }
            
            // JET LAUNCH - confined to magnetic field line
            if (params.showJets && Math.random() < 0.05 * params.jetLaunchRate) {
              const isUpper = Math.random() < 0.5;
              const fieldLineIndex = Math.floor(Math.random() * 32);
              
              const jetParticle = {
                position: new THREE.Vector3(
                  Math.cos(p.angle) * ISCO,
                  tiltedHeight,
                  Math.sin(p.angle) * ISCO
                ),
                fieldLineIndex: fieldLineIndex,
                isUpper: isUpper,
                progress: 0,
                age: 0,
                maxAge: 250,
                mesh: null
              };
              
              // SMALLER jet particles
              const jetGeom = new THREE.SphereGeometry(1, 6, 6);
              const jetMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.9
              });
              
              jetParticle.mesh = new THREE.Mesh(jetGeom, jetMat);
              jetParticle.mesh.position.copy(jetParticle.position);
              scene.add(jetParticle.mesh);
              jetParticles.push(jetParticle);
              jetsLaunched++;
            }
            
            // Reset
            p.radius = p.initialRadius;
            p.angle = Math.random() * Math.PI * 2;
            p.temp = 0.3;
            p.angularMomentum = p.radius * 0.012 * Math.pow(100 / p.radius, 1.5);
            p.stretchFactor = 1.0;
            p.brightness = 0.5;
            p.trail = [];
            p.orbitalTilt = (Math.random() - 0.5) * 0.3;
          }
          
          // Update position
          updateScale.set(
            p.stretchFactor,
            1.0 / Math.sqrt(p.stretchFactor),
            1.0 / Math.sqrt(p.stretchFactor)
          );
          
          const x = Math.cos(p.angle) * p.radius;
          const y = tiltedHeight;
          const z = Math.sin(p.angle) * p.radius;
          
          updateMatrix.makeRotationZ(p.orbitalTilt);
          updateMatrix.setPosition(x, y, z);
          
          const sizeFactor = (0.8 + p.brightness * 0.6) * (p.temp > 0.8 ? 1.5 : 1.0);
          updateMatrix.scale(new THREE.Vector3(
            sizeFactor * updateScale.x,
            sizeFactor * updateScale.y,
            sizeFactor * updateScale.z
          ));
          
          diskInstance.setMatrixAt(i, updateMatrix);
          
          // Blackbody temperature colors
          const brightness = 0.5 + p.brightness * 0.5;

          if (p.temp > 1.0 || p.temp > 0.8) {
            // Very hot - blue-white (10000K+)
            updateColor.setRGB(0.8, 0.9, 1.0).multiplyScalar(1.5 + brightness);
          } else if (p.temp > 0.6) {
            // Hot - white (6000-10000K)
            updateColor.setRGB(1.0, 1.0, 0.95).multiplyScalar(1.3 + brightness);
          } else if (p.temp > 0.4) {
            // Warm - yellow-white (4000-6000K)
            updateColor.setRGB(1.0, 0.95, 0.7).multiplyScalar(1.2 + brightness * 0.8);
          } else if (p.temp > 0.2) {
            // Cool - orange (3000-4000K)
            updateColor.setRGB(1.0, 0.7, 0.4).multiplyScalar(1.0 + brightness * 0.6);
          } else {
            // Very cool - red (2000-3000K)
            updateColor.setRGB(1.0, 0.5, 0.2).multiplyScalar(0.8 + brightness * 0.4);
          }

          diskInstance.setColorAt(i, updateColor);
        }
        
        diskInstance.instanceMatrix.needsUpdate = true;
        if (diskInstance.instanceColor) {
          diskInstance.instanceColor.needsUpdate = true;
        }
        
        // Update stats
        const avgJetSpeed = jetParticles.length > 0 ? totalJetSpeed / jetParticles.length : 0;
        setStats(prev => ({
          ...prev,
          particlesAccreted: particlesAccreted,
          jetsLaunched: jetsLaunched,
          avgInfallSpeed: (totalInfallSpeed / diskData.length).toFixed(2),
          maxTemperature: maxTemp.toFixed(2),
          powerOutput: (powerOutput / 1000).toFixed(1),
          avgJetSpeed: avgJetSpeed.toFixed(2)
        }));
      }

      // Update camera
      const distance = params.cameraDistance;
      camera.position.x = distance * Math.sin(cameraAngleRef.current.phi) * Math.cos(cameraAngleRef.current.theta);
      camera.position.y = distance * Math.cos(cameraAngleRef.current.phi);
      camera.position.z = distance * Math.sin(cameraAngleRef.current.phi) * Math.sin(cameraAngleRef.current.theta);
      camera.lookAt(0, 0, 0);

      // Update companion star
      if (params.showCompanionStar && companionStar) {
        companionStar.update(deltaTime);

        // Update star statistics
        const starStatsData = companionStar.getStats();
        setStarStats({
          windParticleCount: starStatsData.windParticleCount,
          quantumParticleCount: starStatsData.quantumParticleCount,
          influenceRadius: parseFloat(starStatsData.influenceRadius),
          massLossRate: parseFloat(starStatsData.massLossRate)
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      accretionTrailsRef.current.forEach(trail => scene.remove(trail));
      jetParticlesRef.current.forEach(jet => { if (jet.mesh) scene.remove(jet.mesh); });
      photonOrbitersRef.current.forEach(photon => { if (photon.mesh) scene.remove(photon.mesh); });
      shockWavesRef.current.forEach(wave => scene.remove(wave));

      // Cleanup companion star
      if (companionStar) companionStar.destroy();

      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [params, isPlaying]);

  return (
    <div className="w-full h-screen bg-black flex">
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" />
        
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <Button 
            onClick={zoomIn}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-2xl font-bold"
            title="Zoom In"
          >
            +
          </Button>
          <div className="bg-black/90 text-white px-2 py-1 rounded text-xs text-center border border-blue-500/50">
            {params.cameraDistance.toFixed(0)}
          </div>
          <Button 
            onClick={zoomOut}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-2xl font-bold"
            title="Zoom Out"
          >
            −
          </Button>
        </div>
        
        <div className="absolute top-4 left-4 bg-gradient-to-br from-black/95 to-purple-900/30 text-white px-6 py-4 rounded-xl backdrop-blur-md border border-cyan-400/50 shadow-2xl">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-1">
            TON 618 3D
          </h1>
          <p className="text-xs text-cyan-300 mb-3">Magnetically Confined Jets</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <p className="text-orange-300">⚡ Accreted: <span className="font-bold">{stats.particlesAccreted}</span></p>
            <p className="text-cyan-300">🚀 Jets: <span className="font-bold">{stats.jetsLaunched}</span></p>
            <p className="text-yellow-300">💨 Infall: <span className="font-bold">{stats.avgInfallSpeed}</span></p>
            <p className="text-red-300">🔥 Max T: <span className="font-bold">{stats.maxTemperature}</span></p>
            <p className="text-purple-300">💡 Power: <span className="font-bold">{stats.powerOutput}k</span></p>
            <p className="text-green-300">⚡ Jet v: <span className="font-bold">{stats.avgJetSpeed}</span></p>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 bg-black/95 text-white px-5 py-3 rounded-xl backdrop-blur-md border border-cyan-500/50 shadow-2xl max-w-md">
          <h3 className="text-sm font-bold text-cyan-400 mb-2">🧲 Magnetic Confinement:</h3>
          <ul className="text-xs space-y-1 text-gray-300">
            <li>• <span className="text-cyan-400">Jets follow magnetic field lines</span> precisely</li>
            <li>• <span className="text-green-400">Tiny particles</span> accelerate along B-fields</li>
            <li>• <span className="text-purple-400">Zoom out far</span> to see full jet extent</li>
            <li>• <span className="text-yellow-400">Zoom in close</span> to watch ISCO dynamics</li>
            <li>• <span className="text-orange-400">Use scroll wheel</span> or +/- buttons to zoom</li>
          </ul>
        </div>

        <div className="absolute bottom-4 right-4 bg-black/95 text-white px-4 py-3 rounded-xl backdrop-blur-md border border-green-500/50 shadow-2xl">
          <h3 className="text-sm font-bold text-green-400 mb-2">Performance</h3>
          <div className="text-xs font-mono space-y-1">
            <p className="text-gray-300">FPS: <span className="text-green-400 font-bold">{stats.fps}</span></p>
            <p className="text-gray-300">Zoom: <span className="text-cyan-400 font-bold">{params.cameraDistance.toFixed(0)}</span></p>
            <p className="text-gray-300">Jets: <span className="text-purple-400 font-bold">Confined</span></p>
          </div>
        </div>
      </div>

      <div className="w-80 bg-gray-950 border-l border-gray-800 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Controls</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-sm"
              >
                {isPlaying ? '⏸' : '▶'}
              </Button>
              <Button 
                onClick={resetSimulation}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-sm"
              >
                🔄
              </Button>
              <Button 
                onClick={zoomIn}
                className="bg-blue-600 hover:bg-blue-700 text-sm"
              >
                🔍+ Zoom In
              </Button>
              <Button 
                onClick={zoomOut}
                className="bg-blue-600 hover:bg-blue-700 text-sm"
              >
                🔍− Zoom Out
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-gray-200 text-xs font-semibold">Camera Distance: {params.cameraDistance.toFixed(0)}</Label>
              <Slider
                value={[params.cameraDistance]}
                onValueChange={(v) => setParams(p => ({ ...p, cameraDistance: v[0] }))}
                min={30}
                max={1000}
                step={5}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">30 = extreme closeup, 1000 = wide view</p>
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Accretion Rate: {params.accretionRate.toFixed(1)}×</Label>
              <Slider
                value={[params.accretionRate]}
                onValueChange={(v) => setParams(p => ({ ...p, accretionRate: v[0] }))}
                min={0.1}
                max={5}
                step={0.1}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Jet Acceleration: {params.jetAcceleration.toFixed(1)}×</Label>
              <Slider
                value={[params.jetAcceleration]}
                onValueChange={(v) => setParams(p => ({ ...p, jetAcceleration: v[0] }))}
                min={0.1}
                max={5}
                step={0.1}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Vertical Motion: {params.verticalMotion.toFixed(1)}×</Label>
              <Slider
                value={[params.verticalMotion]}
                onValueChange={(v) => setParams(p => ({ ...p, verticalMotion: v[0] }))}
                min={0}
                max={3}
                step={0.1}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Viscosity: {params.viscosity.toFixed(1)}×</Label>
              <Slider
                value={[params.viscosity]}
                onValueChange={(v) => setParams(p => ({ ...p, viscosity: v[0] }))}
                min={0.1}
                max={3}
                step={0.1}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Shock Heating: {params.shockHeating.toFixed(1)}×</Label>
              <Slider
                value={[params.shockHeating]}
                onValueChange={(v) => setParams(p => ({ ...p, shockHeating: v[0] }))}
                min={0}
                max={3}
                step={0.1}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Magnetic Field: {params.magneticFieldStrength.toFixed(1)}×</Label>
              <Slider
                value={[params.magneticFieldStrength]}
                onValueChange={(v) => setParams(p => ({ ...p, magneticFieldStrength: v[0] }))}
                min={0}
                max={3}
                step={0.1}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Jet Launch Rate: {params.jetLaunchRate.toFixed(1)}×</Label>
              <Slider
                value={[params.jetLaunchRate]}
                onValueChange={(v) => setParams(p => ({ ...p, jetLaunchRate: v[0] }))}
                min={0}
                max={5}
                step={0.1}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Turbulence: {params.turbulence.toFixed(1)}×</Label>
              <Slider
                value={[params.turbulence]}
                onValueChange={(v) => setParams(p => ({ ...p, turbulence: v[0] }))}
                min={0}
                max={3}
                step={0.1}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Tidal Force: {params.tidalForce.toFixed(1)}×</Label>
              <Slider
                value={[params.tidalForce]}
                onValueChange={(v) => setParams(p => ({ ...p, tidalForce: v[0] }))}
                min={0}
                max={3}
                step={0.1}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-200 text-xs font-semibold">Time Scale: {params.timeScale.toFixed(1)}×</Label>
              <Slider
                value={[params.timeScale]}
                onValueChange={(v) => setParams(p => ({ ...p, timeScale: v[0] }))}
                min={0.1}
                max={5}
                step={0.1}
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-gray-700">
            <h3 className="text-sm font-bold text-gray-300">Visual Effects</h3>
            <Button
              variant={params.showPhotonOrbiters ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showPhotonOrbiters: !p.showPhotonOrbiters }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showPhotonOrbiters ? "✓" : "○"} Photon Orbiters
            </Button>
            <Button
              variant={params.showTrails ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showTrails: !p.showTrails }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showTrails ? "✓" : "○"} Accretion Trails
            </Button>
            <Button
              variant={params.showJets ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showJets: !p.showJets }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showJets ? "✓" : "○"} Confined Jets
            </Button>
            <Button
              variant={params.showShockWaves ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showShockWaves: !p.showShockWaves }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showShockWaves ? "✓" : "○"} Shock Waves
            </Button>
            <Button
              variant={params.showMagneticField ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showMagneticField: !p.showMagneticField }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showMagneticField ? "✓" : "○"} Magnetic Field
            </Button>
            <Button
              variant={params.showFrameDragging ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showFrameDragging: !p.showFrameDragging }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showFrameDragging ? "✓" : "○"} Frame Dragging
            </Button>
            <Button
              variant={params.showSpaghettification ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showSpaghettification: !p.showSpaghettification }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showSpaghettification ? "✓" : "○"} Spaghettification
            </Button>
          </div>

          <div className="pt-3 border-t border-gray-700">
            <h3 className="font-semibold text-white mb-3 text-sm">Companion Star (O-type)</h3>

            <Button
              variant={params.showCompanionStar ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showCompanionStar: !p.showCompanionStar }))}
              className="w-full text-xs mb-3"
              size="sm"
            >
              {params.showCompanionStar ? "✓" : "○"} Show Companion Star
            </Button>

            {params.showCompanionStar && (
              <div className="space-y-3">
                <div>
                  <Label className="text-gray-200 text-xs">Orbital Distance: {params.companionStarDistance}</Label>
                  <Slider
                    value={[params.companionStarDistance]}
                    onValueChange={(v) => {
                      setParams(p => ({ ...p, companionStarDistance: v[0] }));
                      if (companionStarRef.current) {
                        companionStarRef.current.setParameters({ orbitalRadius: v[0] });
                      }
                    }}
                    min={25}
                    max={500}
                    step={5}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Distance from black hole (ISCO≈18)</p>
                </div>

                <div>
                  <Label className="text-gray-200 text-xs">Star Mass: {params.companionStarMass} M☉</Label>
                  <Slider
                    value={[params.companionStarMass]}
                    onValueChange={(v) => {
                      setParams(p => ({ ...p, companionStarMass: v[0] }));
                      if (companionStarRef.current) {
                        companionStarRef.current.setParameters({ mass: v[0] });
                      }
                    }}
                    min={15}
                    max={90}
                    step={5}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-gray-200 text-xs">Temperature: {params.companionStarTemperature.toLocaleString()} K</Label>
                  <Slider
                    value={[params.companionStarTemperature]}
                    onValueChange={(v) => {
                      setParams(p => ({ ...p, companionStarTemperature: v[0] }));
                      if (companionStarRef.current) {
                        companionStarRef.current.setParameters({ temperature: v[0] });
                      }
                    }}
                    min={30000}
                    max={50000}
                    step={1000}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-gray-200 text-xs">Orbital Speed: {params.orbitalSpeedMultiplier.toFixed(3)}×</Label>
                  <Slider
                    value={[params.orbitalSpeedMultiplier]}
                    onValueChange={(v) => {
                      setParams(p => ({ ...p, orbitalSpeedMultiplier: v[0] }));
                      if (companionStarRef.current) {
                        companionStarRef.current.setParameters({ orbitalSpeedMultiplier: v[0] });
                      }
                    }}
                    min={0.001}
                    max={2.0}
                    step={0.001}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">0.001 = ultra slow, 0.1 = slow, 1.0 = normal</p>
                </div>

                <div className="pt-2 border-t border-gray-600">
                  <h4 className="text-xs font-bold text-cyan-300 mb-2">Stellar Wind Physics</h4>

                  <Button
                    variant={params.enableStellarWind ? "default" : "outline"}
                    onClick={() => {
                      setParams(p => ({ ...p, enableStellarWind: !p.enableStellarWind }));
                      if (companionStarRef.current) {
                        companionStarRef.current.setParameters({ enableWind: !params.enableStellarWind });
                      }
                    }}
                    className="w-full text-xs justify-start mb-2"
                    size="sm"
                  >
                    {params.enableStellarWind ? "✓" : "○"} Enable Stellar Wind
                  </Button>

                  {params.enableStellarWind && (
                    <>
                      <div>
                        <Label className="text-gray-200 text-xs">Wind Velocity: {params.windVelocity} km/s</Label>
                        <Slider
                          value={[params.windVelocity]}
                          onValueChange={(v) => {
                            setParams(p => ({ ...p, windVelocity: v[0] }));
                            if (companionStarRef.current) {
                              companionStarRef.current.setParameters({ windVelocity: v[0] });
                            }
                          }}
                          min={1000}
                          max={3000}
                          step={100}
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">O-type: 1000-3000 km/s</p>
                      </div>

                      <div>
                        <Label className="text-gray-200 text-xs">Wind Density: {params.windDensity.toFixed(1)}×</Label>
                        <Slider
                          value={[params.windDensity]}
                          onValueChange={(v) => {
                            setParams(p => ({ ...p, windDensity: v[0] }));
                            if (companionStarRef.current) {
                              companionStarRef.current.setParameters({ windDensity: v[0] });
                            }
                          }}
                          min={0.1}
                          max={3.0}
                          step={0.1}
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">Mass loss rate</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-600">
                  <h4 className="text-xs font-bold text-purple-300 mb-2">Gravitational Influence</h4>

                  <Button
                    variant={params.enableGravitationalForce ? "default" : "outline"}
                    onClick={() => {
                      setParams(p => ({ ...p, enableGravitationalForce: !p.enableGravitationalForce }));
                      if (companionStarRef.current) {
                        companionStarRef.current.setParameters({ enableGravity: !params.enableGravitationalForce });
                      }
                    }}
                    className="w-full text-xs justify-start mb-2"
                    size="sm"
                  >
                    {params.enableGravitationalForce ? "✓" : "○"} Enable Gravity
                  </Button>

                  {params.enableGravitationalForce && (
                    <>
                      <div>
                        <Label className="text-gray-200 text-xs">Gravity Strength: {params.gravitationalStrength.toFixed(1)}×</Label>
                        <Slider
                          value={[params.gravitationalStrength]}
                          onValueChange={(v) => {
                            setParams(p => ({ ...p, gravitationalStrength: v[0] }));
                            if (companionStarRef.current) {
                              companionStarRef.current.setParameters({ gravitationalStrength: v[0] });
                            }
                          }}
                          min={0.1}
                          max={5.0}
                          step={0.1}
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">Attraction force multiplier</p>
                      </div>

                      <Button
                        variant={params.showInfluenceSphere ? "default" : "outline"}
                        onClick={() => {
                          setParams(p => ({ ...p, showInfluenceSphere: !p.showInfluenceSphere }));
                          if (companionStarRef.current) {
                            companionStarRef.current.setParameters({ showInfluenceSphere: !params.showInfluenceSphere });
                          }
                        }}
                        className="w-full text-xs justify-start"
                        size="sm"
                      >
                        {params.showInfluenceSphere ? "✓" : "○"} Show Hill Sphere
                      </Button>
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-600">
                  <h4 className="text-xs font-bold text-green-300 mb-2">Quantum Effects</h4>

                  <Button
                    variant={params.enableQuantumEffects ? "default" : "outline"}
                    onClick={() => {
                      setParams(p => ({ ...p, enableQuantumEffects: !p.enableQuantumEffects }));
                      if (companionStarRef.current) {
                        companionStarRef.current.setParameters({ enableQuantumEffects: !params.enableQuantumEffects });
                      }
                    }}
                    className="w-full text-xs justify-start mb-2"
                    size="sm"
                  >
                    {params.enableQuantumEffects ? "✓" : "○"} Enable Quantum Effects
                  </Button>

                  {params.enableQuantumEffects && (
                    <div>
                      <Label className="text-gray-200 text-xs">Intensity: {params.hawkingRadiationIntensity.toFixed(1)}×</Label>
                      <Slider
                        value={[params.hawkingRadiationIntensity]}
                        onValueChange={(v) => {
                          setParams(p => ({ ...p, hawkingRadiationIntensity: v[0] }));
                          if (companionStarRef.current) {
                            companionStarRef.current.setParameters({ hawkingRadiationIntensity: v[0] });
                          }
                        }}
                        min={0.1}
                        max={2.0}
                        step={0.1}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Pair creation rate</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-600 text-xs">
                  <h4 className="text-xs font-semibold text-white mb-1">Star Statistics</h4>
                  <p className="text-gray-400">Wind Particles: <span className="text-cyan-400">{starStats.windParticleCount}</span></p>
                  <p className="text-gray-400">Quantum Particles: <span className="text-green-400">{starStats.quantumParticleCount}</span></p>
                  <p className="text-gray-400">Hill Radius: <span className="text-purple-400">{starStats.influenceRadius} units</span></p>
                  <p className="text-gray-400">Mass Loss: <span className="text-yellow-400">{starStats.massLossRate} M☉/yr</span></p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-700 text-xs text-gray-400">
            <p className="font-semibold text-white mb-2">🧲 Jet Confinement:</p>
            <ul className="space-y-1">
              <li>• Jets now <span className="text-cyan-400">follow magnetic field lines</span></li>
              <li>• <span className="text-purple-400">Much smaller particles</span> (0.2 vs 0.6)</li>
              <li>• <span className="text-green-400">Zoom 30-1000</span> range (was 60-600)</li>
              <li>• <span className="text-yellow-400">Try zoom 30</span> for extreme closeup!</li>
              <li>• <span className="text-orange-400">Try zoom 800</span> to see full jets!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAccretionPhysics;
