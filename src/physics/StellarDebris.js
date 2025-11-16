import * as THREE from 'three';

/**
 * StellarDebris class - represents disrupted stellar material
 * Handles debris streams, circularization, and accretion onto black hole
 */
export class StellarDebris {
  constructor(scene, blackHoleMass = 66e9) {
    this.scene = scene;
    this.blackHoleMass = blackHoleMass;

    // Debris properties
    this.particles = [];
    this.particleCount = 0;
    this.maxParticles = 5000;

    // Visual elements
    this.particleSystem = null;
    this.streamLines = [];

    // Physics parameters
    this.ISCO = 18; // Innermost stable circular orbit
    this.eventHorizon = 13;

    this.createParticleSystem();
  }

  /**
   * Create instanced particle system for debris
   */
  createParticleSystem() {
    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.8
    });

    this.particleSystem = new THREE.InstancedMesh(
      geometry,
      material,
      this.maxParticles
    );
    this.particleSystem.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Initialize all particles as invisible
    const matrix = new THREE.Matrix4();
    matrix.scale(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < this.maxParticles; i++) {
      this.particleSystem.setMatrixAt(i, matrix);
    }

    this.scene.add(this.particleSystem);
  }

  /**
   * Generate debris from disrupted star
   */
  generateDebrisFromStar(starState) {
    const { position, velocity, mass } = starState;

    // Create debris particles along the tidal stream
    const debrisCount = 200; // Particles per generation

    for (let i = 0; i < debrisCount; i++) {
      if (this.particleCount >= this.maxParticles) break;

      const spreadFactor = (Math.random() - 0.5) * 10;
      const perpVector = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();

      const particlePos = position.clone().add(
        perpVector.multiplyScalar(spreadFactor)
      );

      // Velocity inherits from star plus some spread
      const velocitySpread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      );
      const particleVel = velocity.clone().add(velocitySpread);

      // Calculate specific angular momentum
      const angularMomentum = particlePos.clone().cross(particleVel);

      this.particles.push({
        position: particlePos,
        velocity: particleVel,
        angularMomentum: angularMomentum,
        temperature: 0.3,
        age: 0,
        maxAge: 1000 + Math.random() * 500,
        mass: mass / debrisCount,
        inStream: true,
        circularized: false
      });

      this.particleCount++;
    }
  }

  /**
   * Calculate orbital velocity for circularization
   */
  calculateOrbitalVelocity(radius) {
    if (radius < this.ISCO) radius = this.ISCO;
    const G = 0.1; // Scaled gravitational constant
    return Math.sqrt((G * this.blackHoleMass) / radius);
  }

  /**
   * Update debris physics
   */
  update(deltaTime = 0.016) {
    const updateMatrix = new THREE.Matrix4();
    const updateColor = new THREE.Color();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += 1;

      // Remove old particles
      if (p.age > p.maxAge) {
        this.particles.splice(i, 1);
        this.particleCount--;
        continue;
      }

      const distance = p.position.length();

      // Particle fell into black hole
      if (distance < this.eventHorizon) {
        this.particles.splice(i, 1);
        this.particleCount--;
        continue;
      }

      // Gravitational force
      const gravity = (0.1 * this.blackHoleMass) / Math.pow(distance, 2);
      const gravDirection = p.position.clone().normalize().multiplyScalar(-1);
      const gravAccel = gravDirection.multiplyScalar(gravity);

      // Add drag/viscosity for circularization
      if (p.inStream && !p.circularized) {
        // Check if particle is near apocenter (farthest point)
        const radialVelocity = p.velocity.clone().dot(p.position.normalize());

        if (Math.abs(radialVelocity) < 0.1 && distance > this.ISCO * 1.5) {
          // Begin circularization
          p.circularized = true;
          p.inStream = false;

          // Adjust velocity to circular orbit
          const orbitalSpeed = this.calculateOrbitalVelocity(distance);
          const tangent = p.angularMomentum.clone().cross(p.position).normalize();
          p.velocity = tangent.multiplyScalar(orbitalSpeed);
        }
      }

      // Viscous angular momentum transport (spiral inward)
      if (p.circularized) {
        const angMomLoss = 0.0001; // Viscosity parameter
        p.angularMomentum.multiplyScalar(1 - angMomLoss);

        // Update velocity to maintain circular orbit at new radius
        const currentRadius = p.position.length();
        const newOrbitalSpeed = this.calculateOrbitalVelocity(currentRadius);
        const tangent = p.angularMomentum.clone().cross(p.position).normalize();
        p.velocity = tangent.multiplyScalar(newOrbitalSpeed);
      }

      // Update velocity and position
      p.velocity.add(gravAccel.multiplyScalar(deltaTime));
      p.position.add(p.velocity.clone().multiplyScalar(deltaTime));

      // Temperature increases as particle falls inward
      const tempFactor = Math.max(0, 1 - (distance - this.ISCO) / 100);
      p.temperature = 0.3 + tempFactor * 1.2;

      // Heating from shocks during circularization
      if (!p.circularized && p.inStream) {
        p.temperature += 0.3;
      }

      // Update visual representation
      const scale = 0.5 + p.temperature * 0.5;
      updateMatrix.identity();
      updateMatrix.setPosition(p.position);
      updateMatrix.scale(new THREE.Vector3(scale, scale, scale));

      // Color based on temperature (blue = cool, red = hot, white = very hot)
      if (p.temperature > 1.2) {
        updateColor.setRGB(1, 1, 1); // White hot
      } else if (p.temperature > 0.8) {
        updateColor.setHSL(0.05, 1, 0.6); // Orange-yellow
      } else if (p.temperature > 0.5) {
        updateColor.setHSL(0.1, 1, 0.5); // Orange
      } else {
        updateColor.setHSL(0.6, 1, 0.4); // Blue-ish
      }

      this.particleSystem.setMatrixAt(i, updateMatrix);
      this.particleSystem.setColorAt(i, updateColor);
    }

    // Update instance matrices
    if (this.particleSystem) {
      this.particleSystem.instanceMatrix.needsUpdate = true;
      if (this.particleSystem.instanceColor) {
        this.particleSystem.instanceColor.needsUpdate = true;
      }
    }
  }

  /**
   * Get statistics about debris
   */
  getStats() {
    let streamCount = 0;
    let diskCount = 0;
    let avgTemp = 0;
    let totalMass = 0;

    this.particles.forEach(p => {
      if (p.inStream) streamCount++;
      if (p.circularized) diskCount++;
      avgTemp += p.temperature;
      totalMass += p.mass;
    });

    return {
      total: this.particles.length,
      inStream: streamCount,
      inDisk: diskCount,
      avgTemperature: avgTemp / (this.particles.length || 1),
      totalMass: totalMass
    };
  }

  /**
   * Clear all debris
   */
  clear() {
    this.particles = [];
    this.particleCount = 0;

    // Reset all particle matrices to invisible
    const matrix = new THREE.Matrix4();
    matrix.scale(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < this.maxParticles; i++) {
      this.particleSystem.setMatrixAt(i, matrix);
    }
    this.particleSystem.instanceMatrix.needsUpdate = true;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.particleSystem) {
      this.scene.remove(this.particleSystem);
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.dispose();
    }
  }
}

export default StellarDebris;
