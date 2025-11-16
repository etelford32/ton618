import * as THREE from 'three';

/**
 * Star class - represents a star approaching TON 618
 * Handles star physics, tidal stretching, and disruption
 */
export class Star {
  constructor(scene, blackHoleMass = 66e9) {
    this.scene = scene;
    this.blackHoleMass = blackHoleMass;

    // Star properties
    this.mass = 1; // Solar masses
    this.radius = 1; // Solar radii (visual scale will be larger)
    this.position = new THREE.Vector3(300, 0, 0); // Start far away
    this.velocity = new THREE.Vector3(-0.5, 0, 0.3); // Initial velocity

    // Tidal disruption parameters
    this.isDisrupted = false;
    this.tidalRadius = this.calculateTidalRadius();
    this.stretchFactor = new THREE.Vector3(1, 1, 1);
    this.health = 1.0; // 1.0 = intact, 0.0 = fully disrupted

    // Visual representation
    this.mesh = null;
    this.debrisParticles = [];

    this.createStarMesh();
  }

  /**
   * Calculate tidal disruption radius (Roche limit)
   * R_t ≈ R_star * (M_bh / M_star)^(1/3)
   */
  calculateTidalRadius() {
    const schwarzschildRadius = 13; // TON 618 event horizon radius
    // Simplified tidal radius calculation
    const tidalRadius = schwarzschildRadius * 3 * Math.pow(this.blackHoleMass / this.mass, 1/3);
    return Math.min(tidalRadius, 80); // Cap for visualization
  }

  /**
   * Create the visual mesh for the star
   */
  createStarMesh() {
    const geometry = new THREE.SphereGeometry(3, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: 0xffdd88,
      emissive: 0xffaa44,
      emissiveIntensity: 0.5,
      shininess: 30
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    // Add glow
    const glowGeometry = new THREE.SphereGeometry(3.5, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd88,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.mesh.add(this.glow);
  }

  /**
   * Calculate tidal force at current position
   * F_tidal = 2 * G * M_bh * R_star / r^3
   */
  calculateTidalForce(distance) {
    if (distance < 0.1) distance = 0.1; // Prevent division by zero
    const G = 1; // Normalized gravitational constant
    const tidalForce = (2 * G * this.blackHoleMass * this.radius) / Math.pow(distance, 3);
    return tidalForce;
  }

  /**
   * Calculate gravitational acceleration
   * a = G * M / r^2
   */
  calculateGravity(distance) {
    if (distance < 0.1) distance = 0.1;
    const G = 0.1; // Scaled for visualization
    return (G * this.blackHoleMass) / Math.pow(distance, 2);
  }

  /**
   * Update star physics each frame
   */
  update(deltaTime = 0.016) {
    if (!this.mesh) return;

    const distance = this.position.length();

    // Gravitational acceleration toward black hole
    const gravity = this.calculateGravity(distance);
    const direction = this.position.clone().normalize().multiplyScalar(-1);
    const acceleration = direction.multiplyScalar(gravity);

    // Update velocity and position
    this.velocity.add(acceleration.multiplyScalar(deltaTime));
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // Calculate tidal stretching
    const tidalForce = this.calculateTidalForce(distance);

    if (distance < this.tidalRadius && !this.isDisrupted) {
      // Star is being stretched by tidal forces
      const stretchAmount = Math.max(0, 1 - distance / this.tidalRadius);

      // Stretch along radial direction, compress perpendicular
      const radialDirection = this.position.clone().normalize();
      this.stretchFactor.x = 1 + stretchAmount * 3;
      this.stretchFactor.y = 1 / Math.sqrt(1 + stretchAmount * 3);
      this.stretchFactor.z = 1 / Math.sqrt(1 + stretchAmount * 3);

      // Decrease health as it gets stretched
      this.health -= stretchAmount * 0.01;

      // Trigger disruption when health is low
      if (this.health < 0.3) {
        this.isDisrupted = true;
      }
    }

    // Update mesh
    this.mesh.position.copy(this.position);
    this.mesh.scale.copy(this.stretchFactor);

    // Change color as it heats up near black hole
    if (distance < this.tidalRadius * 2) {
      const heatFactor = 1 - (distance / (this.tidalRadius * 2));
      const newColor = new THREE.Color();
      newColor.setHSL(0.1 - heatFactor * 0.1, 1, 0.5 + heatFactor * 0.3);
      this.mesh.material.color = newColor;
      this.mesh.material.emissiveIntensity = 0.5 + heatFactor * 0.5;
    }

    // Update glow intensity
    if (this.glow) {
      this.glow.material.opacity = 0.3 + (1 - this.health) * 0.5;
    }
  }

  /**
   * Check if star should be disrupted
   */
  shouldDisrupt() {
    return this.isDisrupted;
  }

  /**
   * Get current state for debris generation
   */
  getState() {
    return {
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      mass: this.mass,
      health: this.health,
      stretchFactor: this.stretchFactor.clone()
    };
  }

  /**
   * Reset star to initial state
   */
  reset(newPosition, newVelocity) {
    this.position.copy(newPosition || new THREE.Vector3(300, 0, 0));
    this.velocity.copy(newVelocity || new THREE.Vector3(-0.5, 0, 0.3));
    this.health = 1.0;
    this.isDisrupted = false;
    this.stretchFactor.set(1, 1, 1);

    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.scale.set(1, 1, 1);
      this.mesh.material.color.setHex(0xffdd88);
      this.mesh.material.emissiveIntensity = 0.5;
    }
  }

  /**
   * Remove star from scene
   */
  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      if (this.glow) {
        this.glow.geometry.dispose();
        this.glow.material.dispose();
      }
    }
  }
}

export default Star;
