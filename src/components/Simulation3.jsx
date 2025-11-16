import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Star from '../physics/Star';
import StellarDebris from '../physics/StellarDebris';
import OrbitalMechanics from '../physics/OrbitalMechanics';
import LymanAlphaBlob from '../physics/LymanAlphaBlob';
import CompanionStar from '../physics/CompanionStar';
import HawkingRadiation from '../physics/HawkingRadiation';

const Ton618Observatory = () => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const animationRef = useRef(null);
  const diskInstanceRef = useRef(null);
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3 });

  // TDE (Tidal Disruption Event) refs
  const starRef = useRef(null);
  const debrisRef = useRef(null);
  const orbitalMechanicsRef = useRef(null);
  const lymanAlphaBlobRef = useRef(null);
  const companionStarRef = useRef(null);
  const hawkingRadiationRef = useRef(null);

  // Light curve data
  const lightCurveDataRef = useRef({
    radio: [],
    infrared: [],
    optical: [],
    ultraviolet: [],
    xray: [],
    gamma: []
  });

  const [params, setParams] = useState({
    observerDistance: 2.5, // billion light years (TON 618 actual distance)
    viewingAngle: 45, // degrees from face-on
    accretionRate: 1.0,
    variabilityAmplitude: 0.3,
    cameraDistance: 200,
    showJets: true,
    showDisk: true,
    showLightCurves: true,
    // TDE parameters
    showTDE: true,
    starMass: 1.0,
    starVelocity: 0.5,
    // Advanced physics
    enableGravity: true,
    showLymanAlphaBlob: true,
    blobIntensity: 1.0,
    // Companion star parameters
    showCompanionStar: true,
    companionStarDistance: 250,
    companionStarMass: 40, // Solar masses
    companionStarTemperature: 40000, // Kelvin
    companionStarVelocity: 0, // Will be calculated
    orbitalSpeedMultiplier: 0.1, // Slow orbital motion
    // Stellar wind physics
    enableStellarWind: true,
    windVelocity: 2000, // km/s
    windDensity: 1.0,
    enableGravitationalForce: true,
    gravitationalStrength: 1.0,
    showInfluenceSphere: false,
    // Quantum effects
    enableQuantumEffects: true,
    hawkingRadiationIntensity: 0.5,
    // Black hole parameters
    blackHoleMass: 66, // billions of solar masses
    blackHoleSpin: 0.9 // 0 to 1
  });

  const [starStats, setStarStats] = useState({
    windParticleCount: 0,
    quantumParticleCount: 0,
    influenceRadius: 0,
    massLossRate: 0
  });

  const [tdeStats, setTdeStats] = useState({
    starHealth: 1.0,
    debrisCount: 0,
    streamCount: 0,
    diskCount: 0
  });

  const [blobStats, setBlobStats] = useState({
    particleCount: 0,
    avgTemperature: 0,
    avgIonization: 0
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(60);

  // Physical constants
  const TON618_MASS = 66e9; // solar masses
  const EVENT_HORIZON = 13;
  const ISCO = 18;
  const ACTUAL_DISTANCE_GLY = 2.5; // billion light years

  // Calculate apparent magnitude based on distance
  const getApparentMagnitude = (distance) => {
    // TON 618 absolute magnitude ~ -30.7
    const absoluteMag = -30.7;
    const distanceParsecs = distance * 1e9 * 306.6; // Gly to parsecs
    const distanceModulus = 5 * Math.log10(distanceParsecs / 10);
    return absoluteMag + distanceModulus;
  };

  // Calculate angular size
  const getAngularSize = (distance) => {
    // Schwarzschild radius of TON 618 ~ 1300 AU
    const radiusAU = 1300;
    const distanceAU = distance * 1e9 * 63241; // Gly to AU
    const radians = radiusAU / distanceAU;
    return radians * 206265000; // to milliarcseconds
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    camera.position.set(200, 120, 200);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x0a0a20, 0.2);
    scene.add(ambientLight);

    // Dynamic disk lights (will track hot particles)
    const diskLights = [];
    for (let i = 0; i < 6; i++) {
      const light = new THREE.PointLight(0xffffff, 8, 150);
      light.position.set(
        Math.cos(i * Math.PI / 3) * 30,
        (Math.random() - 0.5) * 5,
        Math.sin(i * Math.PI / 3) * 30
      );
      scene.add(light);
      diskLights.push(light);
    }

    // Inner disk intense light
    const innerDiskLight = new THREE.PointLight(0xaaccff, 12, 80);
    innerDiskLight.position.set(0, 0, 0);
    scene.add(innerDiskLight);

    const jetLight1 = new THREE.PointLight(0x00ffff, 4, 400);
    jetLight1.position.set(0, 120, 0);
    scene.add(jetLight1);

    const jetLight2 = new THREE.PointLight(0x00ffff, 4, 400);
    jetLight2.position.set(0, -120, 0);
    scene.add(jetLight2);

    // Black Hole Event Horizon
    const horizonGeometry = new THREE.SphereGeometry(EVENT_HORIZON, 64, 64);
    const horizonMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const horizon = new THREE.Mesh(horizonGeometry, horizonMaterial);
    scene.add(horizon);

    // Event horizon glow
    const glowGeometry = new THREE.SphereGeometry(EVENT_HORIZON * 1.1, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // ISCO Ring
    const iscoGeometry = new THREE.RingGeometry(ISCO - 0.5, ISCO + 0.5, 128);
    const iscoMaterial = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const iscoRing = new THREE.Mesh(iscoGeometry, iscoMaterial);
    iscoRing.rotation.x = Math.PI / 2;
    scene.add(iscoRing);

    // Accretion Disk - smaller, glowing particles
    const particleCount = 25000;
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
      const radius = ISCO + Math.pow(Math.random(), 0.7) * 100;
      const height = (Math.random() - 0.5) * radius * 0.1;
      const speed = 0.01 * Math.pow(80 / radius, 1.5);

      diskData.push({
        angle: angle,
        radius: radius,
        initialRadius: radius,
        height: height,
        speed: speed,
        infallSpeed: 0.02 * (1 / radius),
        temp: Math.pow(1 - (radius - ISCO) / 100, 0.75),
        phase: Math.random() * Math.PI * 2,
        // Velocity fields for proper F=ma integration
        vRadial: 0,      // Radial velocity (inward/outward)
        vTangential: 0,  // Tangential velocity (orbital motion)
        vVertical: 0     // Vertical velocity (perpendicular to disk)
      });

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      tempMatrix.setPosition(x, height, z);
      diskInstance.setMatrixAt(i, tempMatrix);

      const temp = diskData[i].temp;
      tempColor.setHSL(0.6 - temp * 0.6, 1, 0.4 + temp * 0.4);
      diskInstance.setColorAt(i, tempColor);
    }

    // Jets - simple cone geometry
    const jetGeometry = new THREE.CylinderGeometry(0.5, 8, 200, 32);
    const jetMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });

    const jetUpper = new THREE.Mesh(jetGeometry, jetMaterial);
    jetUpper.position.y = 100;
    scene.add(jetUpper);

    const jetLower = new THREE.Mesh(jetGeometry, jetMaterial);
    jetLower.position.y = -100;
    jetLower.rotation.z = Math.PI;
    scene.add(jetLower);

    // Background stars
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    const starColors = [];

    for (let i = 0; i < 5000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 500 + Math.random() * 1500;

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
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

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
        cameraDistance: Math.max(50, Math.min(500, prev.cameraDistance + e.deltaY * 0.2))
      }));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Initialize TDE (Tidal Disruption Event)
    const star = new Star(scene, TON618_MASS);
    starRef.current = star;

    const debris = new StellarDebris(scene, TON618_MASS);
    debrisRef.current = debris;

    // Initialize orbital mechanics
    const orbitalMechanics = new OrbitalMechanics(TON618_MASS);
    orbitalMechanicsRef.current = orbitalMechanics;

    // Initialize Lyman-alpha blob
    const lymanAlphaBlob = new LymanAlphaBlob(scene, TON618_MASS);
    lymanAlphaBlobRef.current = lymanAlphaBlob;
    lymanAlphaBlob.setVisible(params.showLymanAlphaBlob);

    // Initialize companion star (massive O-type supergiant)
    // Note: Quantum effects removed from star, now at black hole event horizon
    const companionStar = new CompanionStar(scene, TON618_MASS, {
      mass: params.companionStarMass,
      temperature: params.companionStarTemperature,
      orbitalRadius: params.companionStarDistance,
      orbitalSpeedMultiplier: params.orbitalSpeedMultiplier,
      enableWind: params.enableStellarWind,
      windVelocity: params.windVelocity,
      windDensity: params.windDensity,
      enableGravity: params.enableGravitationalForce,
      gravitationalStrength: params.gravitationalStrength,
      showInfluenceSphere: params.showInfluenceSphere
    });
    companionStarRef.current = companionStar;

    // Initialize Hawking radiation (quantum effects at black hole event horizon)
    // This is where Hawking radiation actually occurs - NOT at stellar surfaces!
    const hawkingRadiation = new HawkingRadiation(scene, TON618_MASS, EVENT_HORIZON, {
      intensity: params.hawkingRadiationIntensity,
      particleCount: 1000,
      enabled: params.enableQuantumEffects
    });
    hawkingRadiationRef.current = hawkingRadiation;

    // Animation loop
    let time = 0;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsUpdateTime = 0;

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

        // Update disk particles
        const updateMatrix = new THREE.Matrix4();
        const updateColor = new THREE.Color();

        // Reusable vectors to avoid per-frame allocations (performance optimization)
        const reusableParticlePos = new THREE.Vector3();
        const reusableToParticle = new THREE.Vector2();
        const reusableRadialDir = new THREE.Vector2();
        const reusableTangentialDir = new THREE.Vector2();
        const reusableForceXZ = new THREE.Vector2();

        let totalLuminosity = {
          radio: 0,
          infrared: 0,
          optical: 0,
          ultraviolet: 0,
          xray: 0,
          gamma: 0
        };

        for (let i = 0; i < diskData.length; i++) {
          const p = diskData[i];

          // === PHYSICS: PROPER VELOCITY-BASED FORCE INTEGRATION ===
          // F = ma → a = F/m → v += a×Δt → x += v×Δt

          // 1. Calculate intrinsic forces (gravity, viscosity)
          const baseRadialAccel = -p.infallSpeed * params.accretionRate * 60; // Inward acceleration
          const baseTangentialVel = p.speed * params.accretionRate * 60; // Orbital velocity
          const baseVerticalAccel = 0; // No base vertical forces

          // 2. Apply companion star gravitational/magnetic influence
          let starInfluence = null;
          let radialForce = 0;
          let tangentialForce = 0;
          let verticalForce = 0;

          if (params.showCompanionStar && companionStar) {
            // Get current position
            reusableParticlePos.set(
              Math.cos(p.angle) * p.radius,
              p.height,
              Math.sin(p.angle) * p.radius
            );

            // Get influence data (Roche lobe, Hill sphere, etc.)
            starInfluence = companionStar.getParticleInfluence(reusableParticlePos);

            const force = companionStar.getParticleForce(reusableParticlePos);

            // Calculate force components if significant
            if (force.length() > 0) {
              // Convert force to cylindrical coordinates (reuse vectors)
              reusableToParticle.set(reusableParticlePos.x, reusableParticlePos.z);
              reusableRadialDir.copy(reusableToParticle).normalize();
              reusableTangentialDir.set(-reusableRadialDir.y, reusableRadialDir.x);

              // Project force onto radial and tangential directions
              reusableForceXZ.set(force.x, force.z);
              radialForce = reusableForceXZ.dot(reusableRadialDir);
              tangentialForce = reusableForceXZ.dot(reusableTangentialDir);
              verticalForce = force.y;

              // Stronger effect when within Roche lobe
              const forceMultiplier = starInfluence.isWithinRocheLobe ? 1.5 : 1.0;
              radialForce *= forceMultiplier;
              tangentialForce *= forceMultiplier;
              verticalForce *= forceMultiplier;
            }
          }

          // 3. Calculate total acceleration (F/m, assuming m=1 for particles)
          const totalRadialAccel = baseRadialAccel + radialForce * 30; // Scale factor for visual effect
          const totalTangentialAccel = tangentialForce * 1.2; // Tangential acceleration from star
          const totalVerticalAccel = baseVerticalAccel + verticalForce * 18;

          // 4. Update velocities: v += a × Δt
          const dt = 0.016; // Assume ~60 FPS
          p.vRadial += totalRadialAccel * dt;
          p.vTangential = baseTangentialVel + totalTangentialAccel; // Mix with base orbital velocity
          p.vVertical += totalVerticalAccel * dt;

          // 5. Apply damping to prevent runaway velocities
          p.vRadial *= 0.95;
          p.vVertical *= 0.90;

          // 6. Update positions: x += v × Δt
          p.radius += p.vRadial * dt;
          p.angle += (p.vTangential / (p.radius + 1)) * dt; // Convert linear to angular velocity
          p.height += p.vVertical * dt;

          // Clamp height to reasonable bounds
          p.height = Math.max(-10, Math.min(10, p.height));

          // Variability
          p.phase += 0.02;
          const variability = 1 + Math.sin(p.phase + time * 2) * params.variabilityAmplitude;

          // Reset if fallen in
          if (p.radius < ISCO) {
            p.radius = p.initialRadius;
            p.angle = Math.random() * Math.PI * 2;
          }

          // Position
          const x = Math.cos(p.angle) * p.radius;
          const z = Math.sin(p.angle) * p.radius;

          updateMatrix.setPosition(x, p.height, z);
          diskInstance.setMatrixAt(i, updateMatrix);

          // Temperature-based emission
          const temp = Math.pow(1 - (p.radius - ISCO) / 100, 0.75);
          const brightness = (0.5 + temp * 0.5) * variability;

          // Multi-wavelength contributions
          if (temp > 0.8) {
            totalLuminosity.xray += brightness * 2;
            totalLuminosity.gamma += brightness * 0.5;
            totalLuminosity.ultraviolet += brightness * 1.5;
          } else if (temp > 0.5) {
            totalLuminosity.ultraviolet += brightness * 1.2;
            totalLuminosity.optical += brightness * 1.5;
            totalLuminosity.xray += brightness * 0.8;
          } else if (temp > 0.3) {
            totalLuminosity.optical += brightness * 2;
            totalLuminosity.infrared += brightness * 1.2;
          } else {
            totalLuminosity.infrared += brightness * 1.5;
            totalLuminosity.radio += brightness * 1.0;
          }

          // Temperature-based color (blackbody radiation)
          // Blue-white (hot) -> Yellow-orange -> Red (cool)
          if (temp > 0.8) {
            // Very hot - blue-white (10000K+)
            updateColor.setRGB(0.8, 0.9, 1.0).multiplyScalar(1.5 + brightness);
          } else if (temp > 0.6) {
            // Hot - white (6000-10000K)
            updateColor.setRGB(1.0, 1.0, 0.95).multiplyScalar(1.3 + brightness);
          } else if (temp > 0.4) {
            // Warm - yellow-white (4000-6000K)
            updateColor.setRGB(1.0, 0.95, 0.7).multiplyScalar(1.2 + brightness * 0.8);
          } else if (temp > 0.2) {
            // Cool - orange (3000-4000K)
            updateColor.setRGB(1.0, 0.7, 0.4).multiplyScalar(1.0 + brightness * 0.6);
          } else {
            // Very cool - red (2000-3000K)
            updateColor.setRGB(1.0, 0.5, 0.2).multiplyScalar(0.8 + brightness * 0.4);
          }

          // Add visual feedback for companion star influence
          if (starInfluence && starInfluence.influenceStrength > 0.1) {
            // Purple/magenta tint for particles under star's gravitational influence
            const influenceColor = new THREE.Color(0.8, 0.3, 1.0); // Purple
            const blendFactor = starInfluence.captureStrength * 0.4; // Max 40% blend

            // Blend the temperature color with the influence color
            updateColor.lerp(influenceColor, blendFactor);

            // Extra brightness for captured particles (within Roche lobe)
            if (starInfluence.isWithinRocheLobe) {
              updateColor.multiplyScalar(1.2);
            }
          }

          diskInstance.setColorAt(i, updateColor);
        }

        diskInstance.instanceMatrix.needsUpdate = true;
        if (diskInstance.instanceColor) {
          diskInstance.instanceColor.needsUpdate = true;
        }

        // Update light curves (keep last 100 points)
        const maxPoints = 100;
        Object.keys(totalLuminosity).forEach(band => {
          const data = lightCurveDataRef.current[band];
          data.push({ time: time, flux: totalLuminosity[band] / particleCount });
          if (data.length > maxPoints) data.shift();
        });

        // Update TDE (Tidal Disruption Event)
        if (params.showTDE && star && debris) {
          star.update(deltaTime);

          // Check if star should be disrupted
          if (star.shouldDisrupt()) {
            const starState = star.getState();
            debris.generateDebrisFromStar(starState);
          }

          debris.update(deltaTime);

          // Update TDE stats
          const debrisStats = debris.getStats();
          setTdeStats({
            starHealth: star.health,
            debrisCount: debrisStats.total,
            streamCount: debrisStats.inStream,
            diskCount: debrisStats.inDisk
          });

          // Add debris contribution to light curves
          const debrisTemp = debrisStats.avgTemperature;
          if (debrisStats.total > 0) {
            totalLuminosity.xray += debrisTemp * debrisStats.total * 0.001;
            totalLuminosity.ultraviolet += debrisTemp * debrisStats.total * 0.0008;
            totalLuminosity.optical += debrisStats.total * 0.0005;
          }
        }

        // Update Lyman-alpha blob
        if (params.showLymanAlphaBlob && lymanAlphaBlob) {
          const quasarLuminosity = (totalLuminosity.optical + totalLuminosity.ultraviolet + totalLuminosity.xray) * params.blobIntensity;
          lymanAlphaBlob.update(deltaTime, quasarLuminosity);

          // Update blob stats
          const blobStatsData = lymanAlphaBlob.getStats();
          setBlobStats({
            particleCount: blobStatsData.particleCount,
            avgTemperature: blobStatsData.avgTemperature,
            avgIonization: blobStatsData.avgIonization
          });

          // Lyman-alpha emission contribution to light curves
          totalLuminosity.ultraviolet += blobStatsData.avgIonization * 0.5;
          totalLuminosity.optical += blobStatsData.avgIonization * 0.3;
        }

        // Update companion star
        if (params.showCompanionStar && companionStar) {
          companionStar.update(deltaTime);

          // Update star statistics (quantum particles now from Hawking radiation)
          const stats = companionStar.getStats();
          setStarStats({
            windParticleCount: stats.windParticleCount,
            quantumParticleCount: hawkingRadiation ? hawkingRadiation.getStats().totalParticles : 0,
            influenceRadius: parseFloat(stats.influenceRadius),
            massLossRate: parseFloat(stats.massLossRate)
          });
        }

        // Update Hawking radiation (quantum effects at event horizon)
        if (hawkingRadiation) {
          hawkingRadiation.update(deltaTime);
        }

        // Update dynamic disk lights to track hot particles
        diskLights.forEach((light, index) => {
          // Find hot particles in different regions
          const regionAngle = (index / diskLights.length) * Math.PI * 2;
          let maxTemp = 0;
          let hotParticle = null;

          for (let i = 0; i < diskData.length; i++) {
            const p = diskData[i];
            const angleDiff = Math.abs(p.angle - regionAngle);
            if (angleDiff < 1.0 && p.temp > maxTemp && p.radius < 50) {
              maxTemp = p.temp;
              hotParticle = p;
            }
          }

          if (hotParticle) {
            const x = Math.cos(hotParticle.angle) * hotParticle.radius;
            const z = Math.sin(hotParticle.angle) * hotParticle.radius;
            light.position.set(x, hotParticle.height, z);

            // Color based on temperature
            if (maxTemp > 0.8) {
              light.color.setRGB(0.8, 0.9, 1.0); // Blue-white
              light.intensity = 10;
            } else if (maxTemp > 0.6) {
              light.color.setRGB(1.0, 1.0, 0.95); // White
              light.intensity = 8;
            } else {
              light.color.setRGB(1.0, 0.8, 0.6); // Yellow-orange
              light.intensity = 6;
            }
          }
        });

        // Pulsing inner disk light
        innerDiskLight.intensity = 10 + Math.sin(time * 3) * 2;

        // Animate jets
        jetUpper.visible = params.showJets;
        jetLower.visible = params.showJets;
        if (params.showJets) {
          jetUpper.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
          jetLower.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
        }

        // Disk visibility
        diskInstance.visible = params.showDisk;
      }

      // Update camera
      const distance = params.cameraDistance;
      camera.position.x = distance * Math.sin(cameraAngleRef.current.phi) * Math.cos(cameraAngleRef.current.theta);
      camera.position.y = distance * Math.cos(cameraAngleRef.current.phi);
      camera.position.z = distance * Math.sin(cameraAngleRef.current.phi) * Math.sin(cameraAngleRef.current.theta);
      camera.lookAt(0, 0, 0);

      // Apply viewing angle to disk
      diskInstance.rotation.x = (params.viewingAngle / 180) * Math.PI;
      iscoRing.rotation.x = Math.PI / 2 + (params.viewingAngle / 180) * Math.PI;

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
      // Cleanup TDE
      if (star) star.destroy();
      if (debris) debris.destroy();
      if (lymanAlphaBlob) lymanAlphaBlob.destroy();
      if (companionStar) companionStar.destroy();
      if (hawkingRadiation) hawkingRadiation.destroy();

      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [params, isPlaying]);

  // Light curve canvas rendering
  useEffect(() => {
    if (!params.showLightCurves) return;

    const interval = setInterval(() => {
      const canvas = document.getElementById('lightCurveCanvas');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const y = (i / 10) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw light curves
      const bands = [
        { key: 'gamma', color: '#9933ff', label: 'γ-ray' },
        { key: 'xray', color: '#3366ff', label: 'X-ray' },
        { key: 'ultraviolet', color: '#6633ff', label: 'UV' },
        { key: 'optical', color: '#66ff66', label: 'Optical' },
        { key: 'infrared', color: '#ff6633', label: 'IR' },
        { key: 'radio', color: '#ff3333', label: 'Radio' }
      ];

      bands.forEach((band, index) => {
        const data = lightCurveDataRef.current[band.key];
        if (data.length < 2) return;

        ctx.strokeStyle = band.color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        data.forEach((point, i) => {
          const x = (i / 100) * width;
          const y = height - (point.flux * height * 0.8);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });

        ctx.stroke();

        // Label
        ctx.fillStyle = band.color;
        ctx.font = '10px monospace';
        ctx.fillText(band.label, 5, 15 + index * 12);
      });

      // Axes labels
      ctx.fillStyle = '#888';
      ctx.font = '11px monospace';
      ctx.fillText('Time →', width - 60, height - 5);
      ctx.save();
      ctx.translate(15, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Flux', 0, 0);
      ctx.restore();

    }, 100);

    return () => clearInterval(interval);
  }, [params.showLightCurves]);

  const apparentMag = getApparentMagnitude(params.observerDistance);
  const angularSize = getAngularSize(params.observerDistance);

  return (
    <div className="w-full h-screen bg-black flex">
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" />

        {/* Info Panel */}
        <div className="absolute top-4 left-4 bg-black/90 text-white px-5 py-4 rounded-lg backdrop-blur-sm border border-blue-500/50 shadow-xl max-w-md">
          <h1 className="text-2xl font-bold text-blue-300 mb-1">TON 618</h1>
          <p className="text-xs text-gray-400 mb-3">Observable Universe View</p>

          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-x-4">
              <p className="text-gray-300">Mass:</p>
              <p className="text-white font-mono">66 billion M☉</p>

              <p className="text-gray-300">Distance:</p>
              <p className="text-white font-mono">{params.observerDistance.toFixed(2)} Gly</p>

              <p className="text-gray-300">Redshift:</p>
              <p className="text-white font-mono">z = 2.219</p>

              <p className="text-gray-300">App. Magnitude:</p>
              <p className="text-white font-mono">{apparentMag.toFixed(1)}</p>

              <p className="text-gray-300">Angular Size:</p>
              <p className="text-white font-mono">{angularSize.toFixed(2)} mas</p>

              <p className="text-gray-300">FPS:</p>
              <p className="text-green-400 font-mono">{fps}</p>
            </div>

            {params.showTDE && (
              <div className="mt-3 pt-3 border-t border-blue-500/30">
                <p className="text-blue-400 font-semibold mb-2">Tidal Disruption Event</p>
                <div className="grid grid-cols-2 gap-x-4">
                  <p className="text-gray-300">Star Health:</p>
                  <p className="text-yellow-400 font-mono">{(tdeStats.starHealth * 100).toFixed(0)}%</p>

                  <p className="text-gray-300">Debris:</p>
                  <p className="text-orange-400 font-mono">{tdeStats.debrisCount}</p>

                  <p className="text-gray-300">In Stream:</p>
                  <p className="text-cyan-400 font-mono">{tdeStats.streamCount}</p>

                  <p className="text-gray-300">In Disk:</p>
                  <p className="text-purple-400 font-mono">{tdeStats.diskCount}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Light Curves */}
        {params.showLightCurves && (
          <div className="absolute bottom-4 left-4 bg-black/95 rounded-lg border border-cyan-500/50 shadow-xl">
            <div className="px-4 py-2 border-b border-cyan-500/30">
              <h3 className="text-sm font-bold text-cyan-400">Multi-Wavelength Light Curves</h3>
            </div>
            <canvas
              id="lightCurveCanvas"
              width="500"
              height="220"
              className="rounded-b-lg"
            />
          </div>
        )}

        {/* Controls hint */}
        <div className="absolute top-4 right-4 bg-black/80 text-white px-4 py-3 rounded-lg text-xs">
          <p className="text-gray-400">🖱️ Drag to rotate</p>
          <p className="text-gray-400">🖱️ Scroll to zoom</p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="w-80 bg-gray-950 border-l border-gray-800 overflow-y-auto">
        <div className="p-5 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white mb-3">Observatory Controls</h2>
            <Button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-200 text-sm">Observer Distance: {params.observerDistance.toFixed(2)} Gly</Label>
              <Slider
                value={[params.observerDistance]}
                onValueChange={(v) => setParams(p => ({ ...p, observerDistance: v[0] }))}
                min={0.5}
                max={10}
                step={0.1}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">TON 618 actual: 2.5 Gly</p>
            </div>

            <div>
              <Label className="text-gray-200 text-sm">Viewing Angle: {params.viewingAngle}°</Label>
              <Slider
                value={[params.viewingAngle]}
                onValueChange={(v) => setParams(p => ({ ...p, viewingAngle: v[0] }))}
                min={0}
                max={90}
                step={5}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">0° = face-on, 90° = edge-on</p>
            </div>

            <div>
              <Label className="text-gray-200 text-sm">Accretion Rate: {params.accretionRate.toFixed(1)}×</Label>
              <Slider
                value={[params.accretionRate]}
                onValueChange={(v) => setParams(p => ({ ...p, accretionRate: v[0] }))}
                min={0.1}
                max={3}
                step={0.1}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Controls overall luminosity</p>
            </div>

            <div>
              <Label className="text-gray-200 text-sm">Variability: {params.variabilityAmplitude.toFixed(1)}</Label>
              <Slider
                value={[params.variabilityAmplitude]}
                onValueChange={(v) => setParams(p => ({ ...p, variabilityAmplitude: v[0] }))}
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Flux variability amplitude</p>
            </div>

            <div>
              <Label className="text-gray-200 text-sm">Camera Distance: {params.cameraDistance.toFixed(0)}</Label>
              <Slider
                value={[params.cameraDistance]}
                onValueChange={(v) => setParams(p => ({ ...p, cameraDistance: v[0] }))}
                min={50}
                max={500}
                step={10}
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-gray-700">
            <h3 className="text-sm font-bold text-gray-300 mb-2">Visibility</h3>

            <Button
              variant={params.showDisk ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showDisk: !p.showDisk }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showDisk ? "✓" : "○"} Accretion Disk
            </Button>

            <Button
              variant={params.showJets ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showJets: !p.showJets }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showJets ? "✓" : "○"} Relativistic Jets
            </Button>

            <Button
              variant={params.showLightCurves ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showLightCurves: !p.showLightCurves }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showLightCurves ? "✓" : "○"} Light Curves
            </Button>

            <Button
              variant={params.showTDE ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showTDE: !p.showTDE }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showTDE ? "✓" : "○"} Tidal Disruption Event
            </Button>
          </div>

          {params.showTDE && (
            <div className="pt-3 border-t border-gray-700 space-y-3">
              <h3 className="text-sm font-bold text-gray-300">TDE Controls</h3>

              <Button
                onClick={() => {
                  if (starRef.current && debrisRef.current) {
                    starRef.current.reset(
                      new THREE.Vector3(300, 0, 0),
                      new THREE.Vector3(-params.starVelocity, 0, params.starVelocity * 0.6)
                    );
                    debrisRef.current.clear();
                  }
                }}
                className="w-full bg-orange-600 hover:bg-orange-700 text-xs"
                size="sm"
              >
                🌟 Reset Star
              </Button>

              <div>
                <Label className="text-gray-200 text-sm">Star Velocity: {params.starVelocity.toFixed(1)}</Label>
                <Slider
                  value={[params.starVelocity]}
                  onValueChange={(v) => setParams(p => ({ ...p, starVelocity: v[0] }))}
                  min={0.1}
                  max={2}
                  step={0.1}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">Initial approach velocity</p>
              </div>

              <div>
                <Label className="text-gray-200 text-sm">Star Mass: {params.starMass.toFixed(1)} M☉</Label>
                <Slider
                  value={[params.starMass]}
                  onValueChange={(v) => setParams(p => ({ ...p, starMass: v[0] }))}
                  min={0.5}
                  max={10}
                  step={0.5}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">Larger stars disrupt farther out</p>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-gray-700 space-y-3">
            <h3 className="text-sm font-bold text-gray-300">Companion Star (O-type)</h3>

            <Button
              variant={params.showCompanionStar ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, showCompanionStar: !p.showCompanionStar }))}
              className="w-full text-xs justify-start"
              size="sm"
            >
              {params.showCompanionStar ? "✓" : "○"} Show Companion Star
            </Button>

            {params.showCompanionStar && (
              <>
                <div>
                  <Label className="text-gray-200 text-sm">Orbital Distance: {params.companionStarDistance}</Label>
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
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Distance from black hole (ISCO=18)</p>
                </div>

                <div>
                  <Label className="text-gray-200 text-sm">Star Mass: {params.companionStarMass} M☉</Label>
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
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">O-type supergiant: 15-90 M☉</p>
                </div>

                <div>
                  <Label className="text-gray-200 text-sm">Temperature: {params.companionStarTemperature.toLocaleString()} K</Label>
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
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">O-type: 30,000-50,000K</p>
                </div>

                <div>
                  <Label className="text-gray-200 text-sm">Orbital Speed: {params.orbitalSpeedMultiplier.toFixed(3)}×</Label>
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
                    className="mt-2"
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
                      if (hawkingRadiationRef.current) {
                        hawkingRadiationRef.current.setParameters({ enabled: !params.enableQuantumEffects });
                      }
                    }}
                    className="w-full text-xs justify-start mb-2"
                    size="sm"
                  >
                    {params.enableQuantumEffects ? "✓" : "○"} Enable Hawking Radiation
                  </Button>

                  {params.enableQuantumEffects && (
                    <div>
                      <Label className="text-gray-200 text-xs">Intensity: {params.hawkingRadiationIntensity.toFixed(1)}×</Label>
                      <Slider
                        value={[params.hawkingRadiationIntensity]}
                        onValueChange={(v) => {
                          setParams(p => ({ ...p, hawkingRadiationIntensity: v[0] }));
                          if (hawkingRadiationRef.current) {
                            hawkingRadiationRef.current.setParameters({ intensity: v[0] });
                          }
                        }}
                        min={0.1}
                        max={2.0}
                        step={0.1}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Particle/antiparticle pairs at event horizon</p>
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
              </>
            )}
          </div>

          <div className="pt-3 border-t border-gray-700 space-y-3">
            <h3 className="text-sm font-bold text-gray-300">Black Hole Parameters</h3>

            <div>
              <Label className="text-gray-200 text-sm">Mass: {params.blackHoleMass} billion M☉</Label>
              <Slider
                value={[params.blackHoleMass]}
                onValueChange={(v) => setParams(p => ({ ...p, blackHoleMass: v[0] }))}
                min={10}
                max={100}
                step={1}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">TON 618 actual: 66 billion M☉</p>
            </div>

            <div>
              <Label className="text-gray-200 text-sm">Spin Parameter: {params.blackHoleSpin.toFixed(2)}</Label>
              <Slider
                value={[params.blackHoleSpin]}
                onValueChange={(v) => setParams(p => ({ ...p, blackHoleSpin: v[0] }))}
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">0 = no rotation, 1 = maximum</p>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-700 text-xs text-gray-400 space-y-2">
            <h3 className="font-semibold text-white mb-2">About TON 618</h3>
            <p>TON 618 is one of the most luminous known quasars, powered by a supermassive black hole of 66 billion solar masses.</p>
            <p className="text-cyan-400">• Discovered in 1957</p>
            <p className="text-cyan-400">• Distance: 10.4 billion light-years</p>
            <p className="text-cyan-400">• Luminosity: 4×10⁴⁰ watts</p>
            <p className="text-cyan-400">• Type: Hyperluminous quasar</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ton618Observatory;
