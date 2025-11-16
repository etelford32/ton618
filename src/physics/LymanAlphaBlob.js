import * as THREE from 'three';

/**
 * LymanAlphaBlob - Giant cloud of ionized hydrogen around TON 618
 * Realistic representation of the quasar environment
 * Lyman-alpha blobs are enormous (~100-300 kpc) clouds of hydrogen
 */
export class LymanAlphaBlob {
  constructor(scene, quasarMass = 66e9) {
    this.scene = scene;
    this.quasarMass = quasarMass;

    // Blob properties
    this.particleCount = 50000; // Massive cloud
    this.blobRadius = 400; // ~300 kpc scale
    this.coreRadius = 100; // Dense core region
    this.particles = [];

    // Visual
    this.particleSystem = null;

    this.createBlob();
  }

  /**
   * Create the Lyman-alpha blob particle cloud
   */
  createBlob() {
    const geometry = new THREE.SphereGeometry(0.2, 6, 6);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec3 vColor;
        varying float vOpacity;

        void main() {
          vColor = instanceColor;
          vOpacity = length(instanceColor);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vOpacity;

        void main() {
          // Lyman-alpha emission is primarily in UV/blue-green
          vec3 lymanColor = vec3(0.3, 0.8, 1.0);
          vec3 emission = mix(vColor, lymanColor, 0.5);

          gl_FragColor = vec4(emission, vOpacity * 0.3);
        }
      `
    });

    this.particleSystem = new THREE.InstancedMesh(geometry, material, this.particleCount);
    this.particleSystem.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.particleSystem);

    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    // Initialize particles with realistic distribution
    for (let i = 0; i < this.particleCount; i++) {
      // Use power-law distribution for more realistic cloud structure
      const r = this.generateRadialPosition();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const position = new THREE.Vector3(x, y, z);

      // Velocity - turbulent motion + rotation
      const turbulence = new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05
      );

      // Add rotational component
      const rotVel = new THREE.Vector3(-y, x, 0).normalize().multiplyScalar(0.02 / (r + 1));
      const velocity = turbulence.add(rotVel);

      // Density-based temperature (cooler in dense core, hotter outside)
      const density = this.calculateDensity(r);
      const temperature = 10000 + (1 - density) * 20000; // 10,000 - 30,000 K

      this.particles.push({
        position,
        velocity,
        initialRadius: r,
        temperature,
        density,
        ionization: 0.5 + Math.random() * 0.5, // Partially ionized
        phase: Math.random() * Math.PI * 2
      });

      // Initial matrix
      tempMatrix.setPosition(position);
      this.particleSystem.setMatrixAt(i, tempMatrix);

      // Color based on temperature/ionization
      this.updateParticleColor(i, temperature, density, tempColor);
      this.particleSystem.setColorAt(i, tempColor);
    }
  }

  /**
   * Generate radial position with power-law distribution
   * More particles in core, exponential falloff
   */
  generateRadialPosition() {
    const u = Math.random();
    // Exponential + core component
    const core = this.coreRadius * Math.pow(Math.random(), 0.5);
    const halo = this.blobRadius * Math.pow(u, 2);
    return Math.random() > 0.7 ? core : halo;
  }

  /**
   * Calculate gas density at radius (higher in core)
   */
  calculateDensity(r) {
    return Math.exp(-r / this.coreRadius);
  }

  /**
   * Update particle color based on physical properties
   */
  updateParticleColor(index, temperature, density, colorObj) {
    // Lyman-alpha emission (121.6 nm) appears blue-cyan
    // Mix with temperature (blackbody)

    if (temperature > 25000) {
      // Hot - blue-white
      colorObj.setRGB(0.6, 0.8, 1.0);
    } else if (temperature > 15000) {
      // Warm - cyan
      colorObj.setRGB(0.4, 0.9, 1.0);
    } else {
      // Cool - blue-green
      colorObj.setRGB(0.3, 0.8, 0.9);
    }

    // Brightness based on density
    colorObj.multiplyScalar(0.3 + density * 1.2);
  }

  /**
   * Update blob dynamics
   */
  update(deltaTime = 0.016, quasarLuminosity = 1.0) {
    const updateMatrix = new THREE.Matrix4();
    const updateColor = new THREE.Color();

    // Update shader time
    if (this.particleSystem.material.uniforms) {
      this.particleSystem.material.uniforms.time.value += deltaTime;
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Radiation pressure from quasar
      const distance = p.position.length();
      if (distance > 0.1) {
        const radiationPressure = (quasarLuminosity * 0.001) / Math.pow(distance, 2);
        const pushDirection = p.position.clone().normalize();
        p.velocity.add(pushDirection.multiplyScalar(radiationPressure * deltaTime));
      }

      // Turbulent motion
      p.phase += 0.01;
      const turbulence = new THREE.Vector3(
        Math.sin(p.phase) * 0.005,
        Math.cos(p.phase * 1.3) * 0.005,
        Math.sin(p.phase * 0.7) * 0.005
      );
      p.velocity.add(turbulence);

      // Damping (gas friction)
      p.velocity.multiplyScalar(0.98);

      // Update position
      p.position.add(p.velocity.clone().multiplyScalar(deltaTime));

      // Keep particles within blob (soft boundary)
      const distFromCenter = p.position.length();
      if (distFromCenter > this.blobRadius * 1.5) {
        const pullBack = p.position.clone().normalize().multiplyScalar(-0.1);
        p.velocity.add(pullBack);
      }

      // Update ionization based on distance from quasar
      const ionizationDistance = Math.min(1, distance / this.coreRadius);
      p.ionization = 1.0 - ionizationDistance * 0.5;

      // Update temperature (radiation heating)
      p.temperature = 10000 + (1 - p.density) * 20000 + quasarLuminosity * p.ionization * 5000;

      // Update visuals
      updateMatrix.setPosition(p.position);
      this.particleSystem.setMatrixAt(i, updateMatrix);

      this.updateParticleColor(i, p.temperature, p.density, updateColor);
      updateColor.multiplyScalar(0.5 + p.ionization * 0.5);
      this.particleSystem.setColorAt(i, updateColor);
    }

    this.particleSystem.instanceMatrix.needsUpdate = true;
    if (this.particleSystem.instanceColor) {
      this.particleSystem.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    let avgTemp = 0;
    let avgDensity = 0;
    let avgIonization = 0;

    this.particles.forEach(p => {
      avgTemp += p.temperature;
      avgDensity += p.density;
      avgIonization += p.ionization;
    });

    const count = this.particles.length;
    return {
      particleCount: count,
      avgTemperature: avgTemp / count,
      avgDensity: avgDensity / count,
      avgIonization: avgIonization / count,
      blobRadius: this.blobRadius
    };
  }

  /**
   * Toggle visibility
   */
  setVisible(visible) {
    if (this.particleSystem) {
      this.particleSystem.visible = visible;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.particleSystem) {
      this.scene.remove(this.particleSystem);
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.dispose();
    }
  }
}

export default LymanAlphaBlob;
