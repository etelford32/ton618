import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const Ton618Simulation = () => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const animationRef = useRef(null);
  const diskInstanceRef = useRef(null);
  const diskDataRef = useRef([]);
  const launchedParticlesRef = useRef([]);
  const particleTrailsRef = useRef([]);
  const magneticFieldLinesRef = useRef([]);
  const photonPathsRef = useRef([]);
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3 });
  const starPositionsRef = useRef([]);
  const spectrumCanvasRef = useRef(null);
  
  const [params, setParams] = useState({
    blackHoleMass: 66,
    spinParameter: 0.7,
    diskRotationSpeed: 1.0,
    diskTemperature: 1.0,
    magneticFieldStrength: 1.0,
    inclination: 60,
    lensingStrength: 1.0,
    cameraDistance: 200,
    showPhotonSphere: true,
    showGeodesics: true,
    showMagneticField: true,
    showISCO: true,
    showErgosphere: true,
    showFrameDragging: true,
    showReferenceFrames: true,
    showParticleTrails: true,
    jetLaunchRate: 1.0,
    spiralStrength: 1.0
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(60);
  const [launchedCount, setLaunchedCount] = useState(0);

  // Schwarzschild radius
  const getSchwarzschildRadius = (mass) => {
    return mass / 66 * 10;
  };

  // ISCO radius
  const getISCO = (mass, spin) => {
    const rs = getSchwarzschildRadius(mass);
    const iscoFactor = 6 - 5 * spin;
    return rs * iscoFactor / 6;
  };

  // Blandford-Znajek Energy Extraction
  // Power ∝ a²B²M² where a=spin, B=magnetic field, M=mass
  const getBlandfordZnajekPower = (radius, spin, bField) => {
    const rs = getSchwarzschildRadius(params.blackHoleMass);
    // Energy extraction peaks near horizon
    const horizonFactor = Math.exp(-(radius - rs) / rs);
    return spin * spin * bField * horizonFactor;
  };

  // Frame dragging rate: Ω = 2aM/r³
  const getFrameDraggingRate = (r, spin) => {
    const rs = getSchwarzschildRadius(params.blackHoleMass);
    const a = spin;
    return (2 * a * rs * rs * rs) / (r * r * r) * 0.01;
  };

  // Lorentz factor for particle in magnetic field
  const getLorentzFactor = (energy) => {
    return 1 + energy * 10; // γ = 1 + extracted energy
  };

  // Draw emission spectrum
  useEffect(() => {
    if (!spectrumCanvasRef.current) return;
    
    const canvas = spectrumCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#4400ff');
    gradient.addColorStop(0.3, '#0088ff');
    gradient.addColorStop(0.5, '#00ff88');
    gradient.addColorStop(0.7, '#ffff00');
    gradient.addColorStop(1, '#ff0000');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, h - 30, w, 20);
    
    const lines = [
      { pos: 0.15, label: 'H-β', color: '#4466ff', intensity: 0.8 },
      { pos: 0.28, label: 'O III', color: '#00aaff', intensity: 0.6 },
      { pos: 0.42, label: 'H-α', color: '#ff4444', intensity: 1.0 },
      { pos: 0.55, label: 'N II', color: '#ff6666', intensity: 0.5 },
      { pos: 0.72, label: 'S II', color: '#ff8844', intensity: 0.4 }
    ];
    
    lines.forEach(line => {
      const x = line.pos * w;
      const lineHeight = line.intensity * (h - 40);
      
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, h - 30);
      ctx.lineTo(x, h - 30 - lineHeight);
      ctx.stroke();
      
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(line.label, x - 15, h - 35 - lineHeight);
    });
    
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText('Blue shift ←', 10, h - 5);
    ctx.fillText('→ Red shift', w - 90, h - 5);
    
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000510);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000);
    camera.position.set(200, 120, 200);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x0a0a20, 0.4);
    scene.add(ambientLight);

    const diskLight1 = new THREE.PointLight(0xff6600, 3, 250);
    diskLight1.position.set(30, 0, 0);
    scene.add(diskLight1);

    const diskLight2 = new THREE.PointLight(0x4466ff, 3, 250);
    diskLight2.position.set(-30, 0, 0);
    scene.add(diskLight2);

    const jetLight1 = new THREE.PointLight(0x00ffff, 2, 300);
    jetLight1.position.set(0, 100, 0);
    scene.add(jetLight1);

    const jetLight2 = new THREE.PointLight(0x00ffff, 2, 300);
    jetLight2.position.set(0, -100, 0);
    scene.add(jetLight2);

    // Black Hole Event Horizon
    const blackHoleGeometry = new THREE.SphereGeometry(10, 64, 64);
    const blackHoleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
    scene.add(blackHole);

    // Event horizon glow
    const glowGeometry = new THREE.SphereGeometry(11, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.4,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // Ergosphere
    const ergosphereGeometry = new THREE.SphereGeometry(14, 64, 64);
    const ergosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.08,
      wireframe: true
    });
    const ergosphere = new THREE.Mesh(ergosphereGeometry, ergosphereMaterial);
    ergosphere.scale.y = 0.7;
    scene.add(ergosphere);

    // Reference Frame Grids
    const referenceFrames = [];
    const frameRadii = [20, 30, 45, 60];
    
    frameRadii.forEach((radius, idx) => {
      const segments = 32;
      const points = [];
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
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
        opacity: 0.3
      });
      
      const frame = new THREE.Line(geometry, material);
      frame.userData = { 
        radius: radius,
        baseRotation: 0,
        isDragged: true 
      };
      referenceFrames.push(frame);
      scene.add(frame);
      
      // Radial spokes
      for (let i = 0; i < 8; i++) {
        const spokeAngle = (i / 8) * Math.PI * 2;
        const spokePoints = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(
            Math.cos(spokeAngle) * radius,
            0,
            Math.sin(spokeAngle) * radius
          )
        ];
        
        const spokeGeom = new THREE.BufferGeometry().setFromPoints(spokePoints);
        const spokeMat = new THREE.LineBasicMaterial({
          color: 0x44ff88,
          transparent: true,
          opacity: 0.2
        });
        
        const spoke = new THREE.Line(spokeGeom, spokeMat);
        spoke.userData = { 
          radius: radius,
          baseAngle: spokeAngle,
          isDragged: true,
          isSpoke: true
        };
        referenceFrames.push(spoke);
        scene.add(spoke);
      }
    });

    // Photon Sphere
    const photonSphereGeometry = new THREE.SphereGeometry(15, 96, 96);
    const photonSphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x6688ff,
      transparent: true,
      opacity: 0.12,
      wireframe: true
    });
    const photonSphere = new THREE.Mesh(photonSphereGeometry, photonSphereMaterial);
    scene.add(photonSphere);

    // ISCO Ring
    const iscoGeometry = new THREE.RingGeometry(17, 18, 128);
    const iscoMaterial = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const iscoRing = new THREE.Mesh(iscoGeometry, iscoMaterial);
    iscoRing.rotation.x = Math.PI / 2;
    scene.add(iscoRing);

    // Magnetic Field Lines
    const magneticFieldLines = [];
    const numFieldLines = 16;
    
    for (let i = 0; i < numFieldLines; i++) {
      const angle = (i / numFieldLines) * Math.PI * 2;
      const points = [];
      
      for (let j = 0; j <= 50; j++) {
        const t = j / 50;
        const r = 18 * (1 - t * 0.8);
        const z = t * 150 * Math.pow(t, 0.5);
        const theta = angle + t * 0.1;
        
        const x = r * Math.cos(theta);
        const y = z;
        const zPos = r * Math.sin(theta);
        
        points.push(new THREE.Vector3(x, y, zPos));
      }
      
      for (let j = 0; j <= 50; j++) {
        const t = j / 50;
        const r = 18 * (1 - t * 0.8);
        const z = -t * 150 * Math.pow(t, 0.5);
        const theta = angle + t * 0.1;
        
        const x = r * Math.cos(theta);
        const y = z;
        const zPos = r * Math.sin(theta);
        
        points.push(new THREE.Vector3(x, y, zPos));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x00ffaa,
        transparent: true,
        opacity: 0.4
      });
      
      const fieldLine = new THREE.Line(geometry, material);
      fieldLine.userData = { angle: angle };
      magneticFieldLines.push(fieldLine);
      scene.add(fieldLine);
    }
    magneticFieldLinesRef.current = magneticFieldLines;

    // Photon Geodesics
    const geodesicPaths = [];
    const numGeodesics = 12;
    
    for (let i = 0; i < numGeodesics; i++) {
      const points = [];
      const steps = 200;
      const phi0 = (i / numGeodesics) * Math.PI * 2;
      
      for (let s = 0; s < steps; s++) {
        const t = (s / steps) * Math.PI * 4;
        const r = 15 + Math.sin(t * 3) * 0.5;
        const theta = Math.PI / 2 + Math.sin(t * 2) * 0.1;
        const phi = phi0 + t + Math.sin(t * 5) * 0.05;
        
        const x = r * Math.sin(theta) * Math.cos(phi);
        const y = r * Math.cos(theta);
        const z = r * Math.sin(theta) * Math.sin(phi);
        
        points.push(new THREE.Vector3(x, y, z));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.5
      });
      
      const path = new THREE.Line(geometry, material);
      path.userData = { phase: Math.random() * Math.PI * 2 };
      geodesicPaths.push(path);
      scene.add(path);
    }
    photonPathsRef.current = geodesicPaths;

    // Emission Zones
    const emissionZones = [];
    const zoneData = [
      { radius: 25, color: 0x4466ff },
      { radius: 40, color: 0x00aaff },
      { radius: 55, color: 0xff4444 },
      { radius: 70, color: 0xff6666 }
    ];
    
    zoneData.forEach(zone => {
      const ringGeometry = new THREE.RingGeometry(zone.radius - 2, zone.radius + 2, 96);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: zone.color,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      emissionZones.push(ring);
      scene.add(ring);
    });

    // ENHANCED 3D ACCRETION DISK with visible physics
    const particleCount = 15000;
    const diskGeometry = new THREE.SphereGeometry(0.35, 8, 8);
    const diskMaterial = new THREE.MeshPhongMaterial({
      transparent: true,
      shininess: 100,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0
    });
    
    const diskInstance = new THREE.InstancedMesh(diskGeometry, diskMaterial, particleCount);
    diskInstance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(diskInstance);
    diskInstanceRef.current = diskInstance;
    
    const diskData = [];
    let tempMatrix = new THREE.Matrix4();
    let tempColor = new THREE.Color();
    
    // Create multi-layered 3D disk structure
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radiusRandom = Math.random();
      
      // Power law distribution - more particles in inner regions (more physics!)
      const radius = 18 + Math.pow(radiusRandom, 1.5) * 80;
      
      // 3D disk thickness - follows H/R relationship (H = height scale)
      // Thinner near black hole due to higher gravity
      const aspectRatio = 0.1 * Math.pow(radius / 50, 0.5); // H/R ∝ √r
      const diskThickness = radius * aspectRatio;
      
      // Vertical distribution - Gaussian in height
      const heightRandom = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      const height = heightRandom * diskThickness;
      
      // Calculate orbital velocity using Keplerian motion: v ∝ 1/√r
      const keplerianSpeed = 0.007 * Math.pow(98 / radius, 1.5);
      
      // Temperature from Shakura-Sunyaev disk model: T ∝ r^(-3/4)
      const temp = Math.pow(1 - (radius - 18) / 80, 0.75);
      
      // Initial color based on temperature
      tempColor.setHSL(0.65 - temp * 0.65, 1, 0.35 + temp * 0.5);
      
      // Density falls off with radius and height
      const density = Math.exp(-Math.abs(height) / diskThickness) * Math.pow(50 / radius, 1.5);
      
      diskData.push({
        // Position
        angle: angle,
        radius: radius,
        initialRadius: radius,
        height: height,
        baseHeight: height,
        
        // Relativity
        orbitalPlaneAngle: 0, // Frame dragging precession
        frameDragAccumulated: 0,
        
        // Dynamics
        speed: keplerianSpeed,
        baseSpeed: keplerianSpeed,
        verticalPhase: Math.random() * Math.PI * 2,
        infallSpeed: 0.012 * (1 / radius), // Viscous infall
        
        // Thermodynamics
        temp: temp,
        baseTemp: temp,
        heatFromViscosity: 0,
        
        // Physical properties
        density: density,
        particleSize: 0.35 + density * 0.3,
        
        // State
        magneticFieldLine: Math.floor(Math.random() * numFieldLines),
        isInISCO: false,
        timeInISCO: 0
      });
      
      // Initial transform with size variation
      const sizeScale = 0.8 + density * 0.5;
      tempMatrix.makeScale(sizeScale, sizeScale, sizeScale);
      tempMatrix.setPosition(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      diskInstance.setMatrixAt(i, tempMatrix);
      diskInstance.setColorAt(i, tempColor);
    }
    
    diskDataRef.current = diskData;

    // Background Stars
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    const starColors = [];
    
    for (let i = 0; i < 5000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 400 + Math.random() * 900;
      
      starPositions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      
      const brightness = 0.3 + Math.random() * 0.7;
      const temp = Math.random();
      starColors.push(
        brightness * (0.7 + temp * 0.3),
        brightness * (0.7 + temp * 0.3),
        brightness
      );
    }
    
    starPositionsRef.current = starPositions;
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Mouse Controls
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
        cameraDistance: Math.max(60, Math.min(500, prev.cameraDistance + e.deltaY * 0.1))
      }));
    };
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Launched Particles Array
    const launchedParticles = [];
    launchedParticlesRef.current = launchedParticles;
    
    const particleTrails = [];
    particleTrailsRef.current = particleTrails;

    // ========================================
    // PARTICLE UPDATE FUNCTIONS
    // ========================================
    
    // Function: Update Disk Particles
    const updateDiskParticles = (diskData, diskInstance, iscoRadius, time, launchedParticles, particleTrails, scene) => {
      const updateMatrix = new THREE.Matrix4();
      const updatePosition = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scaleVec = new THREE.Vector3(1, 1, 1);
      const updateColor = new THREE.Color();
      
      let launchesThisFrame = 0;
      
      for (let i = 0; i < diskData.length; i++) {
        const p = diskData[i];
        
        // === KEPLERIAN ORBITAL MOTION ===
        p.angle += p.speed * params.diskRotationSpeed;
        
        // === VISCOUS INFALL ===
        p.radius -= p.infallSpeed * params.spiralStrength * 0.018;
        
        // === FRAME DRAGGING ===
        const frameDragRate = getFrameDraggingRate(p.radius, params.spinParameter);
        p.orbitalPlaneAngle += frameDragRate * params.showFrameDragging;
        p.frameDragAccumulated += frameDragRate * params.showFrameDragging;
        
        const precessionTilt = Math.sin(p.frameDragAccumulated) * 0.3;
        const draggedHeight = p.height * Math.cos(p.orbitalPlaneAngle) + 
                               p.radius * precessionTilt * Math.sin(p.orbitalPlaneAngle);
        
        // === ISCO REGION PHYSICS ===
        p.isInISCO = (p.radius >= iscoRadius - 3 && p.radius <= iscoRadius + 3);
        
        if (p.isInISCO) {
          p.timeInISCO++;
          p.heatFromViscosity = Math.min(1, p.timeInISCO / 50);
          
          // JET LAUNCH CONDITION - More aggressive
          const launchProbability = 0.015 * params.jetLaunchRate * (1 + p.heatFromViscosity);
          
          if (Math.random() < launchProbability) {
            const bzPower = getBlandfordZnajekPower(p.radius, params.spinParameter, params.magneticFieldStrength);
            const lorentzFactor = getLorentzFactor(bzPower);
            
            const launchParticle = {
              position: new THREE.Vector3(
                Math.cos(p.angle) * p.radius,
                draggedHeight,
                Math.sin(p.angle) * p.radius
              ),
              magneticFieldLine: p.magneticFieldLine,
              fieldProgress: 0,
              lorentzFactor: lorentzFactor,
              energy: bzPower,
              age: 0,
              maxAge: 250,
              isUpper: Math.random() < 0.5,
              color: new THREE.Color(0, 0.9 + bzPower * 0.1, 1),
              mesh: null
            };
            
            launchedParticles.push(launchParticle);
            launchesThisFrame++;
            
            if (params.showParticleTrails) {
              const trailGeometry = new THREE.BufferGeometry();
              const trailMaterial = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.7
              });
              const trail = new THREE.Line(trailGeometry, trailMaterial);
              trail.userData = { points: [], particle: launchParticle };
              scene.add(trail);
              particleTrails.push(trail);
            }
            
            // Reset particle
            p.radius = p.initialRadius;
            p.angle = Math.random() * Math.PI * 2;
            p.timeInISCO = 0;
            p.heatFromViscosity = 0;
          }
        } else {
          p.timeInISCO = 0;
          p.heatFromViscosity = 0;
        }
        
        // Fall into black hole
        if (p.radius < iscoRadius - 3) {
          p.radius = p.initialRadius;
          p.angle = Math.random() * Math.PI * 2;
          p.frameDragAccumulated = 0;
        }
        
        // === SPIRAL ARMS ===
        const spiralWaveNumber = 3;
        const spiralPattern = Math.sin(spiralWaveNumber * p.angle - p.radius * 0.09);
        const spiralOffset = params.spiralStrength * spiralPattern * 2;
        
        // === VERTICAL TURBULENCE ===
        p.verticalPhase += 0.018;
        const turbulenceAmplitude = 1.5 * (1 + p.heatFromViscosity);
        const verticalMotion = Math.sin(p.verticalPhase) * turbulenceAmplitude;
        
        const finalHeight = p.baseHeight + verticalMotion + draggedHeight;
        
        // === UPDATE POSITION ===
        updatePosition.set(
          Math.cos(p.angle) * (p.radius + spiralOffset),
          finalHeight,
          Math.sin(p.angle) * (p.radius + spiralOffset)
        );
        
        // === SIZE VARIATION ===
        const densityScale = 0.8 + p.density * 0.6;
        const iscoGlow = p.isInISCO ? 1.2 + Math.sin(time * 10) * 0.2 : 1.0;
        scaleVec.set(
          densityScale * iscoGlow,
          densityScale * iscoGlow,
          densityScale * iscoGlow
        );
        
        updateMatrix.compose(updatePosition, quaternion, scaleVec);
        diskInstance.setMatrixAt(i, updateMatrix);
        
        // === COLOR PHYSICS ===
        let temp = Math.pow(1 - (p.radius - 18) / 80, 0.75) * params.diskTemperature;
        temp += p.heatFromViscosity * 0.3;
        
        const dragStrength = Math.min(1, frameDragRate * 5);
        
        if (p.isInISCO) {
          const iscoIntensity = 0.5 + Math.sin(time * 8 + i * 0.1) * 0.3;
          updateColor.setRGB(
            0.8 + iscoIntensity * 0.2,
            0.8 + iscoIntensity * 0.2,
            1
          );
        } else {
          const baseHue = 0.65 - temp * 0.65;
          const frameDragHueShift = dragStrength * 0.12;
          const finalHue = baseHue + frameDragHueShift;
          const saturation = 1 - dragStrength * 0.25;
          const lightness = 0.35 + temp * 0.5 + p.heatFromViscosity * 0.15;
          updateColor.setHSL(finalHue, saturation, lightness);
        }
        
        diskInstance.setColorAt(i, updateColor);
      }
      
      diskInstance.instanceMatrix.needsUpdate = true;
      if (diskInstance.instanceColor) {
        diskInstance.instanceColor.needsUpdate = true;
      }
      
      return launchesThisFrame;
    };
    
    // Function: Update Jet Particles
    const updateJetParticles = (launchedParticles, particleTrails, scene, time) => {
      const magneticFieldLines = magneticFieldLinesRef.current;
      
      for (let i = launchedParticles.length - 1; i >= 0; i--) {
        const lp = launchedParticles[i];
        lp.age++;
        
        if (lp.age > lp.maxAge) {
          // Cleanup
          if (lp.mesh) {
            scene.remove(lp.mesh);
            lp.mesh.geometry.dispose();
            lp.mesh.material.dispose();
          }
          launchedParticles.splice(i, 1);
          
          const trailIndex = particleTrails.findIndex(t => t.userData.particle === lp);
          if (trailIndex !== -1) {
            scene.remove(particleTrails[trailIndex]);
            particleTrails[trailIndex].geometry.dispose();
            particleTrails[trailIndex].material.dispose();
            particleTrails.splice(trailIndex, 1);
          }
          continue;
        }
        
        // === MAGNETIC FIELD LINE TRAJECTORY ===
        lp.fieldProgress += 0.025 * lp.lorentzFactor * params.magneticFieldStrength;
        const t = Math.min(1, lp.fieldProgress);
        
        const fieldAngle = magneticFieldLines[lp.magneticFieldLine].userData.angle;
        
        // Helical path with acceleration
        const r = 18 * (1 - t * 0.8) + Math.sin(t * 20) * 1.5;
        const z = t * 180 * Math.pow(t, 0.4) * (lp.isUpper ? 1 : -1);
        const theta = fieldAngle + t * 0.15 + Math.sin(t * 15) * 0.1;
        
        lp.position.set(
          r * Math.cos(theta),
          z,
          r * Math.sin(theta)
        );
        
        // === RENDER JET PARTICLE ===
        if (lp.mesh) {
          lp.mesh.position.copy(lp.position);
          lp.mesh.material.opacity = 0.9 * (1 - (lp.age / lp.maxAge));
        } else {
          const particleGeom = new THREE.SphereGeometry(0.5 + lp.lorentzFactor * 0.3, 8, 8);
          const particleMat = new THREE.MeshBasicMaterial({
            color: lp.color,
            transparent: true,
            opacity: 0.9
          });
          
          lp.mesh = new THREE.Mesh(particleGeom, particleMat);
          lp.mesh.position.copy(lp.position);
          scene.add(lp.mesh);
        }
        
        // === UPDATE TRAIL ===
        const trail = particleTrails.find(t => t.userData.particle === lp);
        if (trail && params.showParticleTrails) {
          trail.userData.points.push(lp.position.clone());
          if (trail.userData.points.length > 40) {
            trail.userData.points.shift();
          }
          trail.geometry.setFromPoints(trail.userData.points);
          trail.material.opacity = 0.7 * (1 - lp.age / lp.maxAge);
        }
      }
    };
    
    // ========================================
    // MAIN ANIMATION LOOP
    // ========================================
    
    let time = 0;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsUpdateTime = 0;
    let launchCounter = 0;
    
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      frameCount++;
      fpsUpdateTime += deltaTime;
      if (fpsUpdateTime >= 0.5) {
        setFps(Math.round(frameCount / fpsUpdateTime));
        frameCount = 0;
        fpsUpdateTime = 0;
      }

      if (isPlaying) {
        time += 0.01;

        const iscoRadius = getISCO(params.blackHoleMass, params.spinParameter);
        const diskData = diskDataRef.current;
        const diskInstance = diskInstanceRef.current;

        // Update reference frames
        referenceFrames.forEach(frame => {
          frame.visible = params.showReferenceFrames;
          if (params.showReferenceFrames && frame.userData.isDragged) {
            const dragRate = getFrameDraggingRate(frame.userData.radius, params.spinParameter);
            
            if (frame.userData.isSpoke) {
              const currentAngle = frame.userData.baseAngle + frame.userData.baseRotation;
              const points = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(
                  Math.cos(currentAngle) * frame.userData.radius,
                  0,
                  Math.sin(currentAngle) * frame.userData.radius
                )
              ];
              frame.geometry.setFromPoints(points);
              frame.userData.baseRotation += dragRate * params.showFrameDragging;
            } else {
              frame.rotation.y += dragRate * params.showFrameDragging;
            }
            
            const dragStrength = Math.min(1, dragRate * 10);
            frame.material.opacity = params.showFrameDragging ? 0.2 + dragStrength * 0.3 : 0.3;
          }
        });

        photonPathsRef.current.forEach((path) => {
          path.visible = params.showGeodesics;
          if (params.showGeodesics) {
            path.userData.phase += 0.03;
            path.material.opacity = 0.4 + Math.sin(path.userData.phase) * 0.2;
          }
        });

        magneticFieldLinesRef.current.forEach((line, i) => {
          line.visible = params.showMagneticField;
          if (params.showMagneticField) {
            line.material.opacity = 0.3 + Math.sin(time * 2 + i * 0.5) * 0.1;
            line.rotation.y = time * 0.1 * params.spinParameter;
          }
        });

        // === UPDATE DISK PARTICLES ===
        const launchesThisFrame = updateDiskParticles(
          diskData, 
          diskInstance, 
          iscoRadius, 
          time,
          launchedParticles,
          particleTrails,
          scene
        );
        
        launchCounter += launchesThisFrame;
        
        // === UPDATE JET PARTICLES ===
        updateJetParticles(
          launchedParticles,
          particleTrails,
          scene,
          time
        );
        
        setLaunchedCount(launchCounter);

        emissionZones.forEach((ring, i) => {
          ring.material.opacity = 0.2 + Math.sin(time * 2 + i) * 0.08;
        });

        diskLight1.position.x = Math.cos(time * 0.4) * 35;
        diskLight1.position.z = Math.sin(time * 0.4) * 35;
        diskLight2.position.x = Math.cos(time * 0.4 + Math.PI) * 35;
        diskLight2.position.z = Math.sin(time * 0.4 + Math.PI) * 35;

        const lensing = params.lensingStrength;
        const starPos = stars.geometry.attributes.position;
        for (let i = 0; i < starPos.count; i++) {
          const x = starPositionsRef.current[i * 3];
          const y = starPositionsRef.current[i * 3 + 1];
          const z = starPositionsRef.current[i * 3 + 2];
          
          const dist = Math.sqrt(x * x + y * y + z * z);
          const lensFactor = (150 / dist) * lensing * 0.15;
          
          starPos.setXYZ(
            i,
            x - x * lensFactor,
            y - y * lensFactor,
            z - z * lensFactor
          );
        }
        starPos.needsUpdate = true;
      }

      const distance = params.cameraDistance;
      camera.position.x = distance * Math.sin(cameraAngleRef.current.phi) * Math.cos(cameraAngleRef.current.theta);
      camera.position.y = distance * Math.cos(cameraAngleRef.current.phi);
      camera.position.z = distance * Math.sin(cameraAngleRef.current.phi) * Math.sin(cameraAngleRef.current.theta);
      camera.lookAt(0, 0, 0);

      const bhScale = params.blackHoleMass / 66;
      blackHole.scale.setScalar(bhScale);
      glow.scale.setScalar(bhScale);
      
      const psScale = bhScale * 1.5;
      photonSphere.scale.setScalar(psScale);
      photonSphere.visible = params.showPhotonSphere;
      
      ergosphere.scale.set(bhScale * 1.4, bhScale * 1.4 * 0.7, bhScale * 1.4);
      ergosphere.visible = params.showErgosphere;
      
      const iscoRadius = getISCO(params.blackHoleMass, params.spinParameter);
      iscoRing.scale.setScalar(iscoRadius / 17);
      iscoRing.visible = params.showISCO;

      diskInstance.rotation.x = (params.inclination / 180) * Math.PI;
      iscoRing.rotation.x = Math.PI / 2 + (params.inclination / 180) * Math.PI;
      emissionZones.forEach(ring => {
        ring.rotation.x = Math.PI / 2 + (params.inclination / 180) * Math.PI;
      });

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
      
      // Cleanup launched particles
      launchedParticlesRef.current.forEach(lp => {
        if (lp.mesh) scene.remove(lp.mesh);
      });
      particleTrailsRef.current.forEach(trail => scene.remove(trail));
      
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [params, isPlaying]);

  return (
    <div className="w-full h-screen bg-gray-950 flex flex-row">
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" />
        
        <div className="absolute top-6 left-6 text-white bg-black/80 px-6 py-4 rounded-lg backdrop-blur-sm shadow-xl">
          <h1 className="text-3xl font-bold mb-1 text-blue-100">Ton 618</h1>
          <p className="text-sm text-gray-300">Full Relativistic Accretion Physics</p>
          <p className="text-xs text-gray-400 mt-3">Drag to rotate • Scroll to zoom</p>
          <p className="text-xs text-green-400 mt-2">FPS: {fps}</p>
          <p className="text-xs text-yellow-400 mt-1 font-bold">🚀 Jets Launched: {launchedCount}</p>
          <div className="text-xs mt-3 space-y-1">
            <p className="text-blue-300">🔵 Inner = Hotter (Shakura-Sunyaev)</p>
            <p className="text-green-300">🟢 Green = Frame Dragging</p>
            <p className="text-white">⚪ White Pulse = ISCO Region</p>
            <p className="text-cyan-300">🔷 Cyan = Jet Particles</p>
          </div>
        </div>

        <div className="absolute bottom-6 left-6 text-white bg-black/80 px-4 py-3 rounded-lg backdrop-blur-sm shadow-xl max-w-md">
          <h3 className="text-sm font-semibold mb-2">Accretion Disk Physics Layer</h3>
          <canvas ref={spectrumCanvasRef} width="400" height="80" className="rounded" />
          <div className="text-xs text-gray-300 mt-2 space-y-1">
            <p><strong>Keplerian Orbits:</strong> v ∝ 1/√r (inner faster)</p>
            <p><strong>Viscous Infall:</strong> Angular momentum → heat + inward drift</p>
            <p><strong>Frame Dragging:</strong> Ω_LT = 2aM/r³ (spacetime twist)</p>
            <p><strong>ISCO Launch:</strong> Magnetic capture → Blandford-Znajek → Jets</p>
            <p className="text-cyan-300 font-semibold">White pulsing = about to launch!</p>
          </div>
        </div>
      </div>
      
      <div className="w-96 bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Relativistic Disk Physics</h2>
            <Button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-200">Black Hole Mass: {params.blackHoleMass} billion M☉</Label>
              <Slider
                value={[params.blackHoleMass]}
                onValueChange={(v) => setParams(p => ({ ...p, blackHoleMass: v[0] }))}
                min={10}
                max={100}
                step={1}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-200">Kerr Spin (a/M): {params.spinParameter.toFixed(2)}</Label>
              <Slider
                value={[params.spinParameter]}
                onValueChange={(v) => setParams(p => ({ ...p, spinParameter: v[0] }))}
                min={0}
                max={0.998}
                step={0.01}
                className="mt-2"
              />
              <p className="text-xs text-gray-400 mt-1">Higher spin = more energy extraction</p>
            </div>

            <div>
              <Label className="text-gray-200">Magnetic Field (B): {params.magneticFieldStrength.toFixed(1)}x</Label>
              <Slider
                value={[params.magneticFieldStrength]}
                onValueChange={(v) => setParams(p => ({ ...p, magneticFieldStrength: v[0] }))}
                min={0.1}
                max={3}
                step={0.1}
                className="mt-2"
              />
              <p className="text-xs text-gray-400 mt-1">Power ∝ B² (magnetic field squared)</p>
            </div>

            <div>
              <Label className="text-gray-200">Jet Launch Rate: {params.jetLaunchRate.toFixed(1)}x</Label>
              <Slider
                value={[params.jetLaunchRate]}
                onValueChange={(v) => setParams(p => ({ ...p, jetLaunchRate: v[0] }))}
                min={0.1}
                max={5}
                step={0.1}
                className="mt-2"
              />
              <p className="text-xs text-gray-400 mt-1">Higher = more frequent launches from ISCO</p>
              <p className="text-xs text-cyan-300 mt-1">⚡ Try 3x+ to see lots of jets!</p>
            </div>

            <div>
              <Label className="text-gray-200">Frame Dragging: {params.showFrameDragging ? 'ON' : 'OFF'}</Label>
              <Slider
                value={[params.showFrameDragging ? 1 : 0]}
                onValueChange={(v) => setParams(p => ({ ...p, showFrameDragging: v[0] > 0.5 }))}
                min={0}
                max={1}
                step={1}
                className="mt-2"
              />
              <p className="text-xs text-gray-400 mt-1">Ω_fd = 2aM/r³</p>
            </div>

            <div>
              <Label className="text-gray-200">Inclination: {params.inclination}°</Label>
              <Slider
                value={[params.inclination]}
                onValueChange={(v) => setParams(p => ({ ...p, inclination: v[0] }))}
                min={0}
                max={90}
                step={5}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-200">Infall/Spiral: {params.spiralStrength.toFixed(1)}x</Label>
              <Slider
                value={[params.spiralStrength]}
                onValueChange={(v) => setParams(p => ({ ...p, spiralStrength: v[0] }))}
                min={0}
                max={3}
                step={0.1}
                className="mt-2"
              />
              <p className="text-xs text-gray-400 mt-1">Higher = particles reach ISCO faster</p>
            </div>

            <div>
              <Label className="text-gray-200">Rotation Speed: {params.diskRotationSpeed.toFixed(1)}x</Label>
              <Slider
                value={[params.diskRotationSpeed]}
                onValueChange={(v) => setParams(p => ({ ...p, diskRotationSpeed: v[0] }))}
                min={0}
                max={3}
                step={0.1}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-200">Temperature: {params.diskTemperature.toFixed(1)}x</Label>
              <Slider
                value={[params.diskTemperature]}
                onValueChange={(v) => setParams(p => ({ ...p, diskTemperature: v[0] }))}
                min={0.2}
                max={2}
                step={0.1}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-200">Lensing: {params.lensingStrength.toFixed(1)}x</Label>
              <Slider
                value={[params.lensingStrength]}
                onValueChange={(v) => setParams(p => ({ ...p, lensingStrength: v[0] }))}
                min={0}
                max={3}
                step={0.1}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-200">Camera: {params.cameraDistance.toFixed(0)}</Label>
              <Slider
                value={[params.cameraDistance]}
                onValueChange={(v) => setParams(p => ({ ...p, cameraDistance: v[0] }))}
                min={60}
                max={500}
                step={10}
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={params.showPhotonSphere ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showPhotonSphere: !p.showPhotonSphere }))}
              className="text-xs"
            >
              Photon Sphere
            </Button>
            <Button
              variant={params.showGeodesics ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showGeodesics: !p.showGeodesics }))}
              className="text-xs"
            >
              Geodesics
            </Button>
            <Button
              variant={params.showMagneticField ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showMagneticField: !p.showMagneticField }))}
              className="text-xs"
            >
              B-Field Lines
            </Button>
            <Button
              variant={params.showISCO ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showISCO: !p.showISCO }))}
              className="text-xs"
            >
              ISCO
            </Button>
            <Button
              variant={params.showErgosphere ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showErgosphere: !p.showErgosphere }))}
              className="text-xs"
            >
              Ergosphere
            </Button>
            <Button
              variant={params.showReferenceFrames ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showReferenceFrames: !p.showReferenceFrames }))}
              className="text-xs"
            >
              Ref. Frames
            </Button>
            <Button
              variant={params.showParticleTrails ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showParticleTrails: !p.showParticleTrails }))}
              className="text-xs col-span-2"
            >
              Particle Trails
            </Button>
          </div>

          <div className="pt-4 border-t border-gray-700">
            <h3 className="font-semibold text-white mb-3">Visible Disk Physics</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li>• <strong>Color Temperature:</strong> Blue/white = hot inner disk, Red/orange = cooler outer</li>
              <li>• <strong>Green Tint:</strong> Strong frame dragging (Ω = 2aM/r³)</li>
              <li>• <strong>White Glow (pulsing):</strong> Particles in ISCO region</li>
              <li>• <strong>Particle Size:</strong> Larger = higher density regions</li>
              <li>• <strong>Speed:</strong> Inner particles orbit faster (v ∝ 1/√r)</li>
              <li>• <strong>3D Thickness:</strong> H/R ∝ √r (thinner closer to BH)</li>
              <li>• <strong>Spiral Arms:</strong> 3-armed density waves from instabilities</li>
              <li>• <strong>Vertical Motion:</strong> Turbulence from magnetic fields</li>
              <li>• <strong>Inward Spiral:</strong> Viscous angular momentum transport</li>
            </ul>
            <div className="mt-3 p-2 bg-cyan-900/30 rounded border border-cyan-500/50">
              <p className="text-xs text-cyan-300 font-semibold">💡 TO SEE JETS LAUNCHING:</p>
              <p className="text-xs text-gray-300 mt-1">1. Increase "Jet Launch Rate" to 3-5x</p>
              <p className="text-xs text-gray-300">2. Increase "Infall/Spiral" to 2x+</p>
              <p className="text-xs text-gray-300">3. Watch pink ISCO ring for white particles</p>
              <p className="text-xs text-gray-300">4. Enable "Particle Trails" to see paths</p>
            </div>
            <p className="text-xs text-yellow-400 mt-2 font-semibold">
              Physics model: Shakura-Sunyaev α-disk + Kerr metric + MHD
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ton618Simulation;
