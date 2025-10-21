import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function InteractiveTON618() {
  const mountRef = useRef(null);

  // Visual toggles
  const [showJets, setShowJets] = useState(true);
  const [showDisk, setShowDisk] = useState(true);
  const [showNebula, setShowNebula] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  // Physics parameters
  const [diskSpeed, setDiskSpeed] = useState(1.0);
  const [jetIntensity, setJetIntensity] = useState(1.0);
  const [timeScale, setTimeScale] = useState(1.0);

  // UI state
  const [uiCollapsed, setUiCollapsed] = useState(false);
  const [uiSize, setUiSize] = useState('medium');
  const [isPaused, setIsPaused] = useState(false);

  // Visual modes
  const [visualMode, setVisualMode] = useState('realistic'); // realistic, temperature, velocity, xray

  // Camera state
  const [cameraPreset, setCameraPreset] = useState('default');
  const cameraAnimating = useRef(false);

  // Stats
  const [stats, setStats] = useState({
    fps: 60,
    particles: 15000,
    camera: { distance: 150, angle: '45°' }
  });

  // Keyboard shortcuts help
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000008);

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      10000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Enhanced starfield
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    const starColors = [];
    for (let i = 0; i < 5000; i++) {
      const x = (Math.random() - 0.5) * 3000;
      const y = (Math.random() - 0.5) * 3000;
      const z = (Math.random() - 0.5) * 3000;
      starVertices.push(x, y, z);
      const color = new THREE.Color();
      color.setHSL(0.6, 0.2, Math.random() * 0.5 + 0.5);
      starColors.push(color.r, color.g, color.b);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Black hole event horizon
    const bhGeometry = new THREE.SphereGeometry(8, 64, 64);
    const bhMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blackHole = new THREE.Mesh(bhGeometry, bhMaterial);
    scene.add(blackHole);

    // Photon sphere glow
    const photonGeometry = new THREE.SphereGeometry(12, 64, 64);
    const photonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
          float flicker = sin(time * 2.0 + vPosition.x * 0.5) * 0.1 + 0.9;
          vec3 color = vec3(1.0, 0.6, 0.2);
          gl_FragColor = vec4(color, intensity * flicker * 0.8);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    const photonSphere = new THREE.Mesh(photonGeometry, photonMaterial);
    scene.add(photonSphere);

    // ADVANCED ACCRETION DISK SYSTEM
    const diskGroup = new THREE.Group();

    // Particle system for turbulent gas clouds
    const diskParticleCount = 15000;
    const diskPositions = new Float32Array(diskParticleCount * 3);
    const diskVelocities = [];
    const diskColors = new Float32Array(diskParticleCount * 3);
    const diskSizes = new Float32Array(diskParticleCount);
    const diskRadii = new Float32Array(diskParticleCount);
    const diskTemps = new Float32Array(diskParticleCount);
    const diskAngles = new Float32Array(diskParticleCount);

    for (let i = 0; i < diskParticleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 12 + Math.pow(Math.random(), 0.6) * 50;

      diskRadii[i] = radius;
      diskAngles[i] = angle;

      const aspectRatio = 0.01 + (radius / 62) * 0.05;
      const scaleHeight = radius * aspectRatio;
      const gaussianHeight = (Math.random() + Math.random() + Math.random() - 1.5) * scaleHeight;

      diskPositions[i * 3] = Math.cos(angle) * radius;
      diskPositions[i * 3 + 1] = gaussianHeight;
      diskPositions[i * 3 + 2] = Math.sin(angle) * radius;

      const omega = 0.35 * Math.pow(radius / 12, -1.5);
      const turbulence = {
        radial: (Math.random() - 0.5) * 0.02,
        azimuthal: (Math.random() - 0.5) * 0.05 * omega,
        vertical: (Math.random() - 0.5) * 0.01
      };

      diskVelocities.push({
        omega: omega,
        angle: angle,
        radius: radius,
        turbRadial: turbulence.radial,
        turbAzimuthal: turbulence.azimuthal,
        turbVertical: turbulence.vertical
      });

      const tempFactor = Math.pow(12 / radius, 0.75);
      diskTemps[i] = tempFactor;
      const temperature = tempFactor;

      const color = new THREE.Color();
      if (temperature > 0.85) {
        color.setRGB(0.85 + temperature * 0.15, 0.92 + temperature * 0.08, 1.0);
      } else if (temperature > 0.6) {
        color.setRGB(1.0, 0.9 + temperature * 0.1, 0.75 + temperature * 0.25);
      } else if (temperature > 0.35) {
        color.setRGB(1.0, 0.65 + temperature * 0.35, 0.3 + temperature * 0.4);
      } else {
        color.setRGB(1.0, 0.35 + temperature * 0.3, 0.15 + temperature * 0.2);
      }

      diskColors[i * 3] = color.r;
      diskColors[i * 3 + 1] = color.g;
      diskColors[i * 3 + 2] = color.b;

      diskSizes[i] = (0.6 + Math.random() * 1.0) * (1 + temperature * 1.5);
    }

    const diskGeometry = new THREE.BufferGeometry();
    diskGeometry.setAttribute('position', new THREE.BufferAttribute(diskPositions, 3));
    diskGeometry.setAttribute('color', new THREE.BufferAttribute(diskColors, 3));
    diskGeometry.setAttribute('size', new THREE.BufferAttribute(diskSizes, 1));

    const diskMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pointTexture: { value: createCircleTexture() },
        visualMode: { value: 0 } // 0=realistic, 1=temperature, 2=velocity, 3=xray
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        varying float vIntensity;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vIntensity = 1.0 / (1.0 + length(mvPosition.xyz) * 0.008);
          gl_PointSize = size * (400.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D pointTexture;
        uniform int visualMode;
        varying vec3 vColor;
        varying float vIntensity;
        void main() {
          vec4 texColor = texture2D(pointTexture, gl_PointCoord);
          vec3 finalColor = vColor;

          // Visual mode adjustments
          if (visualMode == 1) { // Temperature mode
            finalColor = mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), vIntensity);
          } else if (visualMode == 2) { // Velocity mode
            finalColor = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), vIntensity);
          } else if (visualMode == 3) { // X-ray mode
            finalColor = vec3(0.5, 0.8, 1.0) * vIntensity * 1.5;
          }

          vec3 bloom = finalColor * 1.3;
          vec3 blendedColor = mix(finalColor, bloom, vIntensity * 0.4);
          gl_FragColor = vec4(blendedColor, texColor.a * (0.6 + vIntensity * 0.4));
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      vertexColors: true
    });

    const diskParticles = new THREE.Points(diskGeometry, diskMaterial);
    diskGroup.add(diskParticles);

    scene.add(diskGroup);

    // Relativistic jets
    const createRealisticJet = (direction) => {
      const jetGroup = new THREE.Group();

      const beamParticles = 1500;
      const beamPositions = new Float32Array(beamParticles * 3);
      const beamColors = new Float32Array(beamParticles * 3);
      const beamSizes = new Float32Array(beamParticles);
      const beamVelocities = [];

      for (let i = 0; i < beamParticles; i++) {
        const t = i / beamParticles;
        const z = direction * (15 + t * 120);
        const spread = 0.5 + t * 2.5;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * spread;

        beamPositions[i * 3] = Math.cos(angle) * radius;
        beamPositions[i * 3 + 1] = z;
        beamPositions[i * 3 + 2] = Math.sin(angle) * radius;

        beamVelocities.push({
          vx: Math.cos(angle) * 0.01,
          vy: direction * (0.5 + Math.random() * 0.3),
          vz: Math.sin(angle) * 0.01
        });

        const intensity = 1.0 - t * 0.7;
        const color = new THREE.Color();
        color.setRGB(0.5 + intensity * 0.5, 0.7 + intensity * 0.3, 1.0);
        beamColors[i * 3] = color.r;
        beamColors[i * 3 + 1] = color.g;
        beamColors[i * 3 + 2] = color.b;

        beamSizes[i] = (1 + t * 2) * (Math.random() * 0.5 + 0.5);
      }

      const beamGeometry = new THREE.BufferGeometry();
      beamGeometry.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3));
      beamGeometry.setAttribute('color', new THREE.BufferAttribute(beamColors, 3));
      beamGeometry.setAttribute('size', new THREE.BufferAttribute(beamSizes, 1));

      const beamMaterial = new THREE.ShaderMaterial({
        uniforms: {
          pointTexture: { value: createCircleTexture() }
        },
        vertexShader: `
          attribute float size;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (200.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D pointTexture;
          varying vec3 vColor;
          void main() {
            vec4 texColor = texture2D(pointTexture, gl_PointCoord);
            gl_FragColor = vec4(vColor, 1.0) * texColor;
          }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true
      });

      const beam = new THREE.Points(beamGeometry, beamMaterial);
      beam.userData.velocities = beamVelocities;
      beam.userData.direction = direction;
      jetGroup.add(beam);

      return jetGroup;
    };

    const topJet = createRealisticJet(1);
    const bottomJet = createRealisticJet(-1);
    scene.add(topJet);
    scene.add(bottomJet);

    // Lyman-alpha nebula
    const nebulaGeometry = new THREE.SphereGeometry(150, 64, 64);
    const nebulaMaterial = new THREE.ShaderMaterial({
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

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
          vec3 p = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(p + vec3(0,0,0)), hash(p + vec3(1,0,0)), f.x),
                mix(hash(p + vec3(0,1,0)), hash(p + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(p + vec3(0,0,1)), hash(p + vec3(1,0,1)), f.x),
                mix(hash(p + vec3(0,1,1)), hash(p + vec3(1,1,1)), f.x), f.y),
            f.z);
        }

        void main() {
          float n1 = noise(vPosition * 0.08 + time * 0.05);
          float n2 = noise(vPosition * 0.15 + time * 0.08);
          float density = n1 * 0.6 + n2 * 0.4;

          float edge = pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1.0))), 1.5);

          vec3 color1 = vec3(0.5, 0.3, 0.9);
          vec3 color2 = vec3(0.3, 0.5, 1.0);
          vec3 nebulaColor = mix(color1, color2, n2);

          float alpha = density * edge * 0.12;
          gl_FragColor = vec4(nebulaColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    scene.add(nebula);

    // Reference orbits
    const createOrbit = (radius, color) => {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI);
      const points = curve.getPoints(100);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.4
      });
      const orbit = new THREE.Line(geometry, material);
      orbit.rotation.x = Math.PI / 2;
      return orbit;
    };

    const orbitGroup = new THREE.Group();
    orbitGroup.add(createOrbit(20, 0x00ff88));
    orbitGroup.add(createOrbit(30, 0x4488ff));
    orbitGroup.add(createOrbit(50, 0xff8844));
    scene.add(orbitGroup);

    // Camera setup
    camera.position.set(100, 80, 100);
    camera.lookAt(0, 0, 0);

    let cameraRadius = Math.sqrt(100*100 + 80*80 + 100*100);
    let cameraTheta = Math.atan2(100, 100);
    let cameraPhi = Math.acos(80 / cameraRadius);

    // Camera presets with smooth animation
    const cameraPresets = {
      default: { radius: 150, theta: Math.PI/4, phi: Math.PI/3 },
      top: { radius: 200, theta: 0, phi: 0.1 },
      side: { radius: 180, theta: 0, phi: Math.PI/2 },
      front: { radius: 160, theta: Math.PI/2, phi: Math.PI/2 },
      closeup: { radius: 50, theta: Math.PI/4, phi: Math.PI/3 },
      bird: { radius: 250, theta: Math.PI/6, phi: 0.3 },
      jet: { radius: 100, theta: 0, phi: 0.2 }
    };

    // Helper function to create circle texture
    function createCircleTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
      const texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    // Animate camera to preset
    const animateToPreset = (preset) => {
      if (cameraAnimating.current) return;

      const target = cameraPresets[preset];
      if (!target) return;

      cameraAnimating.current = true;
      const startRadius = cameraRadius;
      const startTheta = cameraTheta;
      const startPhi = cameraPhi;
      const duration = 1000; // ms
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic

        cameraRadius = startRadius + (target.radius - startRadius) * eased;
        cameraTheta = startTheta + (target.theta - startTheta) * eased;
        cameraPhi = startPhi + (target.phi - startPhi) * eased;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          cameraAnimating.current = false;
        }
      };

      animate();
    };

    // Watch for camera preset changes
    const presetWatcher = () => {
      animateToPreset(cameraPreset);
    };

    // Animation loop
    let time = 0;
    let frameCount = 0;
    let lastFpsUpdate = Date.now();

    const animate = () => {
      requestAnimationFrame(animate);

      if (!isPaused) {
        time += 0.016 * timeScale;
      }

      // FPS counter
      frameCount++;
      const now = Date.now();
      if (now - lastFpsUpdate >= 1000) {
        setStats(prev => ({
          ...prev,
          fps: frameCount,
          camera: {
            distance: Math.round(cameraRadius),
            angle: Math.round(cameraPhi * 180 / Math.PI) + '°'
          }
        }));
        frameCount = 0;
        lastFpsUpdate = now;
      }

      // Update photon sphere
      photonMaterial.uniforms.time.value = time;

      // Update disk based on visual mode
      let modeValue = 0;
      if (visualMode === 'temperature') modeValue = 1;
      else if (visualMode === 'velocity') modeValue = 2;
      else if (visualMode === 'xray') modeValue = 3;
      diskMaterial.uniforms.visualMode.value = modeValue;

      // Update disk particles with Keplerian motion
      if (!isPaused) {
        const positions = diskGeometry.attributes.position.array;
        for (let i = 0; i < diskParticleCount; i++) {
          const x = positions[i * 3];
          const y = positions[i * 3 + 1];
          const z = positions[i * 3 + 2];
          const radius = Math.sqrt(x * x + z * z);

          if (radius > 10) {
            let angle = Math.atan2(z, x);
            const omega = diskVelocities[i].omega;
            angle += omega * 0.016 * diskSpeed / radius;

            let newRadius = radius - 0.015 * diskSpeed;
            const verticalSpeed = diskVelocities[i].turbVertical;
            const newY = y + verticalSpeed * diskSpeed;
            const scaleHeight = 0.3 + (newRadius - 12) * 0.04;

            if (Math.abs(newY) > scaleHeight) {
              diskVelocities[i].turbVertical = -verticalSpeed * 0.9;
            }

            if (newRadius < 11) {
              const resetAngle = Math.random() * Math.PI * 2;
              const resetRadius = 12 + Math.pow(Math.random(), 0.7) * 48;
              newRadius = resetRadius;
              angle = resetAngle;

              const newSpeed = 0.35 * Math.pow(12 / resetRadius, 1.5);
              diskVelocities[i].omega = newSpeed;
              diskVelocities[i].turbVertical = (Math.random() - 0.5) * 0.02;

              positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * (0.3 + (resetRadius - 12) * 0.04);
            } else {
              positions[i * 3 + 1] = newY;
            }

            positions[i * 3] = Math.cos(angle) * newRadius;
            positions[i * 3 + 2] = Math.sin(angle) * newRadius;
          }
        }
        diskGeometry.attributes.position.needsUpdate = true;

        // Update jet particles
        [topJet, bottomJet].forEach(jet => {
          const beam = jet.children[0];
          if (beam && beam.geometry) {
            const positions = beam.geometry.attributes.position.array;
            const velocities = beam.userData.velocities;
            const direction = beam.userData.direction;

            for (let i = 0; i < velocities.length; i++) {
              positions[i * 3] += velocities[i].vx * jetIntensity;
              positions[i * 3 + 1] += velocities[i].vy * jetIntensity;
              positions[i * 3 + 2] += velocities[i].vz * jetIntensity;

              if (Math.abs(positions[i * 3 + 1]) > 135) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * 0.5;
                positions[i * 3] = Math.cos(angle) * radius;
                positions[i * 3 + 1] = direction * 15;
                positions[i * 3 + 2] = Math.sin(angle) * radius;
              }
            }
            beam.geometry.attributes.position.needsUpdate = true;
          }
        });

        // Update nebula
        nebulaMaterial.uniforms.time.value = time * 0.3;
      }

      // Visibility controls
      diskGroup.visible = showDisk;
      topJet.visible = showJets;
      bottomJet.visible = showJets;
      nebula.visible = showNebula;
      orbitGroup.visible = showOrbits;

      // Update camera position
      camera.position.x = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
      camera.position.y = cameraRadius * Math.cos(cameraPhi);
      camera.position.z = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    // Mouse controls
    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMouseX;
      const deltaY = e.clientY - previousMouseY;

      cameraTheta -= deltaX * 0.01;
      cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi + deltaY * 0.01));

      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      cameraRadius = Math.max(30, Math.min(500, cameraRadius + e.deltaY * 0.1));
    };

    // Keyboard controls
    const onKeyDown = (e) => {
      switch(e.key) {
        case ' ':
          e.preventDefault();
          setIsPaused(p => !p);
          break;
        case '1':
          setCameraPreset('default');
          break;
        case '2':
          setCameraPreset('top');
          break;
        case '3':
          setCameraPreset('side');
          break;
        case '4':
          setCameraPreset('closeup');
          break;
        case '5':
          setCameraPreset('jet');
          break;
        case 'd':
          setShowDisk(d => !d);
          break;
        case 'j':
          setShowJets(j => !j);
          break;
        case 'n':
          setShowNebula(n => !n);
          break;
        case 'o':
          setShowOrbits(o => !o);
          break;
        case 'l':
          setShowLabels(l => !l);
          break;
        case 'h':
        case '?':
          setShowHelp(h => !h);
          break;
        case 'm':
          // Cycle visual modes
          setVisualMode(m => {
            const modes = ['realistic', 'temperature', 'velocity', 'xray'];
            const idx = modes.indexOf(m);
            return modes[(idx + 1) % modes.length];
          });
          break;
        case '+':
        case '=':
          setTimeScale(t => Math.min(5, t + 0.5));
          break;
        case '-':
        case '_':
          setTimeScale(t => Math.max(0.1, t - 0.5));
          break;
      }
    };

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', onKeyDown);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Trigger preset animation when changed
    if (cameraPreset !== 'default') {
      animateToPreset(cameraPreset);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [showJets, showDisk, showNebula, showOrbits, diskSpeed, jetIntensity, isPaused, timeScale, visualMode, cameraPreset]);

  const getSizeClasses = () => {
    switch(uiSize) {
      case 'small':
        return { title: 'text-lg', heading: 'text-xs', text: 'text-xs', button: 'text-xs px-2 py-0.5' };
      case 'large':
        return { title: 'text-3xl', heading: 'text-base', text: 'text-base', button: 'text-base px-4 py-2' };
      default:
        return { title: 'text-2xl', heading: 'text-sm', text: 'text-sm', button: 'text-sm px-3 py-1' };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className="w-full h-screen bg-black flex flex-col relative">
      <div ref={mountRef} className="flex-1" />

      {/* Stats Panel */}
      <div className="absolute top-4 left-4 bg-black/80 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-blue-500/30">
        <div className="text-xs space-y-1">
          <div>FPS: <span className="text-green-400 font-mono">{stats.fps}</span></div>
          <div>Particles: <span className="text-cyan-400 font-mono">{stats.particles.toLocaleString()}</span></div>
          <div>Distance: <span className="text-yellow-400 font-mono">{stats.camera.distance}</span></div>
          <div>Angle: <span className="text-purple-400 font-mono">{stats.camera.angle}</span></div>
          <div>Mode: <span className="text-pink-400 font-mono">{visualMode}</span></div>
        </div>
      </div>

      {/* Interactive Labels */}
      {showLabels && (
        <>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="text-white text-xs bg-black/60 px-2 py-1 rounded animate-pulse">
              Event Horizon
            </div>
          </div>
        </>
      )}

      {/* Time Controls */}
      <div className="absolute top-4 right-4 bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur-sm border border-purple-500/30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
          >
            {isPaused ? '▶ Play' : '⏸ Pause'}
          </button>
          <div className="text-xs">
            <div>Time: <span className="text-green-400 font-mono">{timeScale.toFixed(1)}x</span></div>
            <div className="text-gray-400">Space: Pause</div>
          </div>
        </div>
      </div>

      {/* Camera Presets */}
      <div className="absolute bottom-24 right-4 bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur-sm border border-green-500/30">
        <h3 className="text-xs font-bold mb-2">Camera Views</h3>
        <div className="grid grid-cols-2 gap-1">
          {Object.keys({ default: 1, top: 2, side: 3, front: 4, closeup: 4, bird: 5, jet: 5 }).map((preset, idx) => (
            <button
              key={preset}
              onClick={() => setCameraPreset(preset)}
              className={`text-xs px-2 py-1 rounded transition ${
                cameraPreset === preset ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={`Press ${idx + 1}`}
            >
              {preset} {idx < 5 && `(${idx + 1})`}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Mode Selector */}
      <div className="absolute bottom-24 left-4 bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur-sm border border-orange-500/30">
        <h3 className="text-xs font-bold mb-2">Visual Mode (M)</h3>
        <div className="flex flex-col gap-1">
          {['realistic', 'temperature', 'velocity', 'xray'].map(mode => (
            <button
              key={mode}
              onClick={() => setVisualMode(mode)}
              className={`text-xs px-3 py-1 rounded transition ${
                visualMode === mode ? 'bg-orange-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      {showHelp && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setShowHelp(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4">Keyboard Shortcuts</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="text-cyan-400 font-bold mb-2">Camera</h3>
                <div className="space-y-1 text-gray-300">
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">1-5</kbd> Camera presets</div>
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">Drag</kbd> Rotate view</div>
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">Scroll</kbd> Zoom in/out</div>
                </div>
              </div>
              <div>
                <h3 className="text-green-400 font-bold mb-2">Time & Playback</h3>
                <div className="space-y-1 text-gray-300">
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">Space</kbd> Play/Pause</div>
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">+/-</kbd> Time scale</div>
                </div>
              </div>
              <div>
                <h3 className="text-purple-400 font-bold mb-2">Visibility</h3>
                <div className="space-y-1 text-gray-300">
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">D</kbd> Toggle disk</div>
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">J</kbd> Toggle jets</div>
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">N</kbd> Toggle nebula</div>
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">O</kbd> Toggle orbits</div>
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">L</kbd> Toggle labels</div>
                </div>
              </div>
              <div>
                <h3 className="text-orange-400 font-bold mb-2">Visual Modes</h3>
                <div className="space-y-1 text-gray-300">
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">M</kbd> Cycle modes</div>
                  <div><kbd className="bg-gray-800 px-2 py-1 rounded">H or ?</kbd> This help</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Collapse/Expand Button */}
      <button
        onClick={() => setUiCollapsed(!uiCollapsed)}
        className="absolute bottom-4 right-4 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full shadow-lg transition z-10"
        title={uiCollapsed ? "Show Controls" : "Hide Controls"}
      >
        {uiCollapsed ? '▲ Show' : '▼ Hide'}
      </button>

      <div
        className={`bg-gray-900 text-white transition-all duration-300 ease-in-out ${
          uiCollapsed ? 'max-h-0 overflow-hidden' : 'max-h-96 overflow-y-auto'
        }`}
      >
        <div className="p-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className={`${sizeClasses.title} font-bold`}>TON 618 - Interactive Simulation</h2>

              <div className="flex gap-1">
                <button onClick={() => setShowHelp(true)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm mr-2">
                  ? Help
                </button>
                <button
                  onClick={() => setUiSize('small')}
                  className={`px-2 py-1 text-xs rounded ${uiSize === 'small' ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  A
                </button>
                <button
                  onClick={() => setUiSize('medium')}
                  className={`px-2 py-1 text-sm rounded ${uiSize === 'medium' ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  A
                </button>
                <button
                  onClick={() => setUiSize('large')}
                  className={`px-2 py-1 text-base rounded ${uiSize === 'large' ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  A
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1">
                <h3 className={`${sizeClasses.heading} font-semibold text-blue-300`}>Physical Properties</h3>
                <p className={sizeClasses.text}>Mass: 66 billion M☉</p>
                <p className={sizeClasses.text}>Schwarzschild radius: 1,300 AU</p>
                <p className={sizeClasses.text}>Luminosity: 4×10⁴⁰ W</p>
                <p className={sizeClasses.text}>Redshift: z = 2.219</p>
              </div>

              <div className="space-y-1">
                <h3 className={`${sizeClasses.heading} font-semibold text-orange-300`}>Accretion Dynamics</h3>
                <p className={sizeClasses.text}>Infall velocity: ~10,500 km/s</p>
                <p className={sizeClasses.text}>Disk temp: 10⁴-10⁷ K gradient</p>
                <p className={sizeClasses.text}>Spiral density waves visible</p>
                <p className={sizeClasses.text}>Doppler beaming active</p>
              </div>

              <div className="space-y-1">
                <h3 className={`${sizeClasses.heading} font-semibold text-cyan-300`}>Interaction</h3>
                <p className={sizeClasses.text}>Press H for keyboard shortcuts</p>
                <p className={sizeClasses.text}>4 visual modes available</p>
                <p className={sizeClasses.text}>7 camera presets</p>
                <p className={sizeClasses.text}>Real-time physics</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className={`${sizeClasses.text} block mb-1`}>Accretion Speed: {diskSpeed.toFixed(1)}x</label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={diskSpeed}
                  onChange={(e) => setDiskSpeed(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className={`${sizeClasses.text} block mb-1`}>Jet Intensity: {jetIntensity.toFixed(1)}x</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={jetIntensity}
                  onChange={(e) => setJetIntensity(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowDisk(!showDisk)}
                className={`${sizeClasses.button} rounded transition ${showDisk ? 'bg-orange-600' : 'bg-gray-700'}`}
              >
                Accretion Disk (D)
              </button>
              <button
                onClick={() => setShowJets(!showJets)}
                className={`${sizeClasses.button} rounded transition ${showJets ? 'bg-cyan-600' : 'bg-gray-700'}`}
              >
                Jets (J)
              </button>
              <button
                onClick={() => setShowNebula(!showNebula)}
                className={`${sizeClasses.button} rounded transition ${showNebula ? 'bg-purple-600' : 'bg-gray-700'}`}
              >
                Nebula (N)
              </button>
              <button
                onClick={() => setShowOrbits(!showOrbits)}
                className={`${sizeClasses.button} rounded transition ${showOrbits ? 'bg-green-600' : 'bg-gray-700'}`}
              >
                References (O)
              </button>
              <button
                onClick={() => setShowLabels(!showLabels)}
                className={`${sizeClasses.button} rounded transition ${showLabels ? 'bg-yellow-600' : 'bg-gray-700'}`}
              >
                Labels (L)
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-3">
              Press <kbd className="bg-gray-800 px-2 py-1 rounded">H</kbd> or <kbd className="bg-gray-800 px-2 py-1 rounded">?</kbd> for full keyboard shortcuts •
              Drag to rotate • Scroll to zoom • Space to pause • M to change visual mode
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
