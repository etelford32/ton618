import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const Ton618Observatory = () => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const animationRef = useRef(null);
  const diskInstanceRef = useRef(null);
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3 });

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
    showLightCurves: true
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
    const ambientLight = new THREE.AmbientLight(0x0a0a20, 0.3);
    scene.add(ambientLight);

    const diskLight1 = new THREE.PointLight(0xff6600, 5, 300);
    diskLight1.position.set(40, 0, 0);
    scene.add(diskLight1);

    const diskLight2 = new THREE.PointLight(0x4466ff, 5, 300);
    diskLight2.position.set(-40, 0, 0);
    scene.add(diskLight2);

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

    // Accretion Disk
    const particleCount = 25000;
    const diskGeometry = new THREE.SphereGeometry(0.4, 8, 8);
    const diskMaterial = new THREE.MeshPhongMaterial({
      transparent: true,
      shininess: 100
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
        phase: Math.random() * Math.PI * 2
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

          // Orbital motion
          p.angle += p.speed * params.accretionRate;

          // Infall
          p.radius -= p.infallSpeed * params.accretionRate;

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

          // Color
          updateColor.setHSL(0.6 - temp * 0.6, 1, 0.4 + temp * 0.4);
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

        // Animate jets
        jetUpper.visible = params.showJets;
        jetLower.visible = params.showJets;
        if (params.showJets) {
          jetUpper.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
          jetLower.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
        }

        // Disk visibility
        diskInstance.visible = params.showDisk;

        // Animate lights
        diskLight1.position.x = Math.cos(time * 0.3) * 45;
        diskLight1.position.z = Math.sin(time * 0.3) * 45;
        diskLight2.position.x = Math.cos(time * 0.3 + Math.PI) * 45;
        diskLight2.position.z = Math.sin(time * 0.3 + Math.PI) * 45;
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
