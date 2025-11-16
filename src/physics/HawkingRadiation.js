import * as THREE from 'three';

/**
 * HawkingRadiation - Quantum effects near black hole event horizon
 * Represents Hawking radiation and particle-antiparticle pair creation
 *
 * Physics: Hawking radiation occurs at the event horizon of black holes,
 * not at stellar surfaces. This creates particle-antiparticle pairs where
 * one escapes as radiation and one falls into the black hole.
 *
 * Temperature: T_H = ℏc³ / (8πGMk_B) ∝ 1/M
 * For TON 618 (66 billion M☉), T_H ≈ 9.3×10⁻¹⁷ K (essentially zero)
 *
 * Note: For visualization, we amplify this effect dramatically!
 */
export class HawkingRadiation {
  constructor(scene, blackHoleMass, eventHorizonRadius, params = {}) {
    this.scene = scene;
    this.blackHoleMass = blackHoleMass;
    this.eventHorizonRadius = eventHorizonRadius;

    // Quantum effect parameters
    this.intensity = params.intensity || 0.5;
    this.particleCount = params.particleCount || 1000;
    this.enabled = params.enabled !== undefined ? params.enabled : true;

    // Particle data
    this.particleData = [];
    this.particleInstance = null;

    // Center position (black hole center)
    this.position = new THREE.Vector3(0, 0, 0);

    this.createQuantumParticles();
  }

  /**
   * Create quantum particle system near event horizon
   */
  createQuantumParticles() {
    const particleGeometry = new THREE.SphereGeometry(0.15, 6, 6);

    const quantumMaterial = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = instanceColor;
          vAlpha = instanceColor.a;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          // Quantum glow effect
          vec3 emissive = vColor * 3.5;
          gl_FragColor = vec4(emissive, vAlpha);
        }
      `
    });

    this.particleInstance = new THREE.InstancedMesh(
      particleGeometry,
      quantumMaterial,
      this.particleCount
    );
    this.particleInstance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.particleInstance);

    // Initialize particles near event horizon (slightly outside)
    // Hawking radiation occurs at the horizon surface
    for (let i = 0; i < this.particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // Particles appear just outside event horizon
      const distance = this.eventHorizonRadius * (1.0 + Math.random() * 0.3);

      // Particle or antiparticle
      const isParticle = Math.random() > 0.5;

      // Particles escape outward, antiparticles fall inward
      const radialVelocity = isParticle ? 0.05 : -0.05;

      this.particleData.push({
        position: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * distance,
          Math.sin(phi) * Math.sin(theta) * distance,
          Math.cos(phi) * distance
        ),
        velocity: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * radialVelocity,
          Math.sin(phi) * Math.sin(theta) * radialVelocity,
          Math.cos(phi) * radialVelocity
        ),
        age: Math.random() * 100,
        maxAge: 100 + Math.random() * 50,
        type: isParticle ? 'particle' : 'antiparticle',
        color: isParticle ?
          new THREE.Color(0.3, 1.0, 0.3) :  // Green for escaping particles
          new THREE.Color(1.0, 0.3, 1.0)    // Magenta for infalling antiparticles
      });
    }

    this.updateParticles();
  }

  /**
   * Update quantum particle positions and states
   */
  updateParticles() {
    if (!this.particleInstance || !this.enabled) {
      if (this.particleInstance) this.particleInstance.visible = false;
      return;
    }

    this.particleInstance.visible = true;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < this.particleData.length; i++) {
      const particle = this.particleData[i];

      // Quantum uncertainty - jittery motion
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08
      );

      // Update position with velocity and quantum uncertainty
      particle.position.add(particle.velocity.clone().multiplyScalar(this.intensity)).add(jitter);
      particle.age++;

      // Pair annihilation/creation - reset particle
      if (particle.age > particle.maxAge) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const distance = this.eventHorizonRadius * (1.0 + Math.random() * 0.3);

        const isParticle = Math.random() > 0.5;
        const radialVelocity = isParticle ? 0.05 : -0.05;

        particle.position.set(
          Math.sin(phi) * Math.cos(theta) * distance,
          Math.sin(phi) * Math.sin(theta) * distance,
          Math.cos(phi) * distance
        );

        particle.velocity.set(
          Math.sin(phi) * Math.cos(theta) * radialVelocity,
          Math.sin(phi) * Math.sin(theta) * radialVelocity,
          Math.cos(phi) * radialVelocity
        );

        particle.age = 0;
        particle.type = isParticle ? 'particle' : 'antiparticle';
        particle.color = isParticle ?
          new THREE.Color(0.3, 1.0, 0.3) :
          new THREE.Color(1.0, 0.3, 1.0);
      }

      // Set instance matrix (position)
      matrix.setPosition(particle.position);
      this.particleInstance.setMatrixAt(i, matrix);

      // Set color with fade based on age
      const alpha = 1.0 - (particle.age / particle.maxAge);
      color.copy(particle.color);
      color.a = alpha * this.intensity;
      this.particleInstance.setColorAt(i, color);
    }

    this.particleInstance.instanceMatrix.needsUpdate = true;
    if (this.particleInstance.instanceColor) {
      this.particleInstance.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Update quantum effects each frame
   */
  update(deltaTime = 0.016) {
    this.updateParticles();
  }

  /**
   * Set parameters
   */
  setParameters(params) {
    if (params.intensity !== undefined) {
      this.intensity = params.intensity;
    }
    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    let escapingCount = 0;
    let infallingCount = 0;

    this.particleData.forEach(p => {
      if (p.type === 'particle') escapingCount++;
      else infallingCount++;
    });

    return {
      totalParticles: this.particleData.length,
      escapingParticles: escapingCount,
      infallingParticles: infallingCount,
      hawkingTemperature: (1 / this.blackHoleMass) * 1e-16 // Approximate, heavily scaled
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.particleInstance) {
      this.scene.remove(this.particleInstance);
      this.particleInstance.geometry.dispose();
      this.particleInstance.material.dispose();
    }
  }
}

export default HawkingRadiation;
