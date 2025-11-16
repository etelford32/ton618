import * as THREE from 'three';

/**
 * CompanionStar - Massive O-type supergiant in stable orbit around TON 618
 * Enhanced with stellar wind, gravitational influence, and quantum effects
 * O-type supergiants: 15-90 solar masses, very hot (30,000-50,000K), blue-white
 */
export class CompanionStar {
  constructor(scene, blackHoleMass = 66e9, params = {}) {
    this.scene = scene;
    this.blackHoleMass = blackHoleMass;

    // Companion star properties (O-type supergiant defaults)
    this.mass = params.mass || 40; // Solar masses (O-type range: 15-90)
    this.radius = params.radius || 15; // Solar radii (O-type: 10-15 R☉)
    this.temperature = params.temperature || 40000; // Kelvin (O-type: 30,000-50,000K)
    this.orbitalRadius = params.orbitalRadius || 250; // Distance from black hole
    this.orbitalVelocity = params.orbitalVelocity || this.calculateOrbitalVelocity(this.orbitalRadius);

    // Stellar wind properties (O-type stars have powerful winds)
    this.windVelocity = params.windVelocity || 2000; // km/s (typical O-type: 1000-3000 km/s)
    this.windDensity = params.windDensity || 1.0; // Mass loss rate multiplier
    this.windParticleCount = params.windParticleCount || 5000;
    this.enableWind = params.enableWind !== undefined ? params.enableWind : true;

    // Gravitational influence
    this.gravitationalStrength = params.gravitationalStrength || 1.0;
    this.influenceRadius = this.calculateHillRadius(); // Hill sphere
    this.enableGravity = params.enableGravity !== undefined ? params.enableGravity : true;

    // Quantum effects
    this.hawkingRadiationIntensity = params.hawkingRadiationIntensity || 0.5;
    this.enableQuantumEffects = params.enableQuantumEffects !== undefined ? params.enableQuantumEffects : true;

    // Orbital elements
    this.angle = params.initialAngle || 0;
    this.inclination = params.inclination || 0; // Orbital plane tilt
    this.eccentricity = params.eccentricity || 0; // 0 = circular orbit

    // Position and velocity
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();

    // Wind particles
    this.windParticles = [];
    this.windInstance = null;
    this.windData = [];

    // Quantum effect particles (Hawking radiation, pair creation)
    this.quantumParticles = [];
    this.quantumInstance = null;
    this.quantumData = [];

    this.updateOrbitalPosition();

    // Visual
    this.mesh = null;
    this.coronaLayers = [];
    this.influenceSphere = null;
    this.bowShock = null;

    this.createStarMesh();
    this.createStellarWind();
    this.createInfluenceSphere();
    this.createQuantumEffects();
  }

  /**
   * Calculate Hill radius (sphere of gravitational influence)
   * r_H = a * (m / 3M)^(1/3)
   */
  calculateHillRadius() {
    const massRatio = this.mass / (this.blackHoleMass / 1e9); // Convert BH mass to solar masses
    return this.orbitalRadius * Math.pow(massRatio / 3, 1/3);
  }

  /**
   * Calculate orbital velocity for circular orbit
   * v = sqrt(G * M / r)
   */
  calculateOrbitalVelocity(radius) {
    const G = 0.1; // Scaled gravitational constant
    return Math.sqrt((G * this.blackHoleMass) / radius);
  }

  /**
   * Update position based on orbital angle
   */
  updateOrbitalPosition() {
    // Simple circular orbit for now
    this.position.set(
      Math.cos(this.angle) * this.orbitalRadius,
      Math.sin(this.inclination) * this.orbitalRadius * Math.sin(this.angle),
      Math.sin(this.angle) * this.orbitalRadius * Math.cos(this.inclination)
    );

    // Velocity is perpendicular to radius vector
    this.velocity.set(
      -Math.sin(this.angle) * this.orbitalVelocity,
      Math.cos(this.inclination) * this.orbitalVelocity * Math.cos(this.angle),
      Math.cos(this.angle) * this.orbitalVelocity * Math.cos(this.inclination)
    );
  }

  /**
   * Create massive blue supergiant mesh
   */
  createStarMesh() {
    const visualRadius = this.radius * 0.5; // Scale for visualization

    // Core star - O-type supergiants are very hot and blue
    const geometry = new THREE.SphereGeometry(visualRadius, 64, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        temperature: { value: this.temperature / 50000 } // Normalized
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
        uniform float temperature;
        varying vec3 vPosition;
        varying vec3 vNormal;

        // Simple noise function
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
                mix(hash(p + vec3(0,1,1)), hash(p + vec3(1,1,1)), f.x), f.y), f.z);
        }

        void main() {
          // Surface activity (less than the TDE star)
          float surfaceNoise = noise(vPosition * 1.5 + time * 0.2) * 0.2;

          // O-type stars are blue-white
          vec3 hotColor = vec3(0.7, 0.8, 1.0);   // Blue-white
          vec3 veryHotColor = vec3(0.9, 0.95, 1.0); // Nearly white

          vec3 baseColor = mix(hotColor, veryHotColor, temperature);
          vec3 color = baseColor + surfaceNoise * 0.15;

          // Limb darkening
          float limbDarkening = 1.0 - pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 1.5);
          color *= 0.8 + 0.2 * limbDarkening;

          // Very bright emission
          float emission = 1.5 + surfaceNoise * 0.3;

          gl_FragColor = vec4(color * emission, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    // Stellar wind / corona (blue-ish for hot star)
    for (let i = 0; i < 3; i++) {
      const glowGeometry = new THREE.SphereGeometry(visualRadius * (1.2 + i * 0.3), 32, 32);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x88aaff, // Blue glow
        transparent: true,
        opacity: 0.15 - i * 0.04,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      this.coronaLayers.push(glow);
      this.mesh.add(glow);
    }
  }

  /**
   * Create stellar wind particle system
   * O-type stars have mass loss rates of ~10^-6 M☉/year
   * Wind velocities: 1000-3000 km/s
   */
  createStellarWind() {
    const particleGeometry = new THREE.SphereGeometry(0.08, 6, 6);

    // Self-emissive shader for wind particles
    const windMaterial = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        baseColor: { value: new THREE.Color(0.7, 0.85, 1.0) }
      },
      vertexShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = instanceColor;
          vAlpha = instanceColor.r; // Use red channel for alpha
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec3 emissive = vColor * 2.0;
          gl_FragColor = vec4(emissive, vAlpha * 0.6);
        }
      `
    });

    this.windInstance = new THREE.InstancedMesh(
      particleGeometry,
      windMaterial,
      this.windParticleCount
    );
    this.windInstance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.windInstance);

    // Initialize wind particles
    const visualRadius = this.radius * 0.5;
    for (let i = 0; i < this.windParticleCount; i++) {
      // Random position on star surface
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);

      const startRadius = visualRadius * (1.0 + Math.random() * 0.2);

      this.windData.push({
        position: new THREE.Vector3(x * startRadius, y * startRadius, z * startRadius),
        direction: new THREE.Vector3(x, y, z).normalize(),
        velocity: this.windVelocity * 0.01 * (0.8 + Math.random() * 0.4),
        age: Math.random() * 200,
        maxAge: 200,
        color: new THREE.Color(0.7 + Math.random() * 0.2, 0.85, 1.0)
      });
    }

    this.updateWindParticles();
  }

  /**
   * Create gravitational influence sphere (Hill sphere visualization)
   */
  createInfluenceSphere() {
    const geometry = new THREE.SphereGeometry(this.influenceRadius, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.08,
      wireframe: true,
      side: THREE.BackSide
    });

    this.influenceSphere = new THREE.Mesh(geometry, material);
    this.influenceSphere.position.copy(this.position);
    this.influenceSphere.visible = false; // Can be toggled
    this.scene.add(this.influenceSphere);
  }

  /**
   * Create quantum effect particles
   * Hawking radiation, pair creation near event horizons
   */
  createQuantumEffects() {
    const particleCount = 1000;
    const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);

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
          vec3 emissive = vColor * 3.0;
          gl_FragColor = vec4(emissive, vAlpha);
        }
      `
    });

    this.quantumInstance = new THREE.InstancedMesh(
      particleGeometry,
      quantumMaterial,
      particleCount
    );
    this.quantumInstance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.quantumInstance);

    // Initialize quantum particles (near the star surface for now)
    const visualRadius = this.radius * 0.5;
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const distance = visualRadius * (1.0 + Math.random() * 0.5);

      this.quantumData.push({
        position: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * distance,
          Math.sin(phi) * Math.sin(theta) * distance,
          Math.cos(phi) * distance
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        ),
        age: Math.random() * 100,
        maxAge: 100,
        type: Math.random() > 0.5 ? 'particle' : 'antiparticle',
        color: Math.random() > 0.5 ?
          new THREE.Color(0.3, 1.0, 0.3) :  // Green for particles
          new THREE.Color(1.0, 0.3, 1.0)    // Magenta for antiparticles
      });
    }

    this.updateQuantumParticles();
  }

  /**
   * Update stellar wind particle positions
   */
  updateWindParticles() {
    if (!this.windInstance || !this.enableWind) {
      if (this.windInstance) this.windInstance.visible = false;
      return;
    }

    this.windInstance.visible = true;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < this.windData.length; i++) {
      const particle = this.windData[i];

      // Update position (radial outward flow)
      particle.position.addScaledVector(particle.direction, particle.velocity * this.windDensity);
      particle.age++;

      // Reset particle if too old
      if (particle.age > particle.maxAge) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);

        const visualRadius = this.radius * 0.5;
        particle.position.set(x * visualRadius, y * visualRadius, z * visualRadius);
        particle.direction.set(x, y, z).normalize();
        particle.age = 0;
        particle.velocity = this.windVelocity * 0.01 * (0.8 + Math.random() * 0.4);
      }

      // Set matrix (position relative to star)
      const worldPos = particle.position.clone().add(this.position);
      matrix.setPosition(worldPos);
      this.windInstance.setMatrixAt(i, matrix);

      // Set color with fade based on age
      const alpha = 1.0 - (particle.age / particle.maxAge);
      color.copy(particle.color);
      color.r = alpha; // Store alpha in red channel for shader
      this.windInstance.setColorAt(i, color);
    }

    this.windInstance.instanceMatrix.needsUpdate = true;
    if (this.windInstance.instanceColor) {
      this.windInstance.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Update quantum effect particles
   */
  updateQuantumParticles() {
    if (!this.quantumInstance || !this.enableQuantumEffects) {
      if (this.quantumInstance) this.quantumInstance.visible = false;
      return;
    }

    this.quantumInstance.visible = true;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < this.quantumData.length; i++) {
      const particle = this.quantumData[i];

      // Quantum uncertainty - jittery motion
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05
      );

      particle.position.add(particle.velocity).add(jitter);
      particle.age++;

      // Pair annihilation - reset particle
      if (particle.age > particle.maxAge) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const distance = this.radius * 0.5 * (1.0 + Math.random() * 0.5);

        particle.position.set(
          Math.sin(phi) * Math.cos(theta) * distance,
          Math.sin(phi) * Math.sin(theta) * distance,
          Math.cos(phi) * distance
        );
        particle.age = 0;
        particle.type = Math.random() > 0.5 ? 'particle' : 'antiparticle';
        particle.color = particle.type === 'particle' ?
          new THREE.Color(0.3, 1.0, 0.3) :
          new THREE.Color(1.0, 0.3, 1.0);
      }

      // Set matrix
      const worldPos = particle.position.clone().add(this.position);
      matrix.setPosition(worldPos);
      this.quantumInstance.setMatrixAt(i, matrix);

      // Set color with quantum fade
      const alpha = Math.sin(particle.age * 0.1) * 0.5 + 0.5; // Quantum flicker
      color.copy(particle.color);
      color.a = alpha * this.hawkingRadiationIntensity;
      this.quantumInstance.setColorAt(i, color);
    }

    this.quantumInstance.instanceMatrix.needsUpdate = true;
    if (this.quantumInstance.instanceColor) {
      this.quantumInstance.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Calculate gravitational force on a particle
   * Returns force vector
   */
  calculateGravitationalForce(particlePosition) {
    if (!this.enableGravity) return new THREE.Vector3(0, 0, 0);

    const toStar = new THREE.Vector3().subVectors(this.position, particlePosition);
    const distance = toStar.length();

    // Outside Hill sphere - no influence
    if (distance > this.influenceRadius) {
      return new THREE.Vector3(0, 0, 0);
    }

    // F = G * m1 * m2 / r^2
    // Simplified: F ∝ mass / r^2
    const forceMagnitude = (this.mass * this.gravitationalStrength) / (distance * distance + 1); // +1 to prevent singularity

    return toStar.normalize().multiplyScalar(forceMagnitude * 0.001); // Scale for simulation
  }

  /**
   * Check if particle is affected by stellar wind (repulsion)
   * Returns wind force vector
   */
  calculateWindForce(particlePosition) {
    if (!this.enableWind) return new THREE.Vector3(0, 0, 0);

    const fromStar = new THREE.Vector3().subVectors(particlePosition, this.position);
    const distance = fromStar.length();

    // Wind only affects particles within a certain range
    const windRange = this.radius * 2;
    if (distance > windRange) {
      return new THREE.Vector3(0, 0, 0);
    }

    // Wind force decreases with distance (inverse square)
    const windStrength = (this.windDensity * this.windVelocity) / (distance * distance + 1);

    return fromStar.normalize().multiplyScalar(windStrength * 0.0001);
  }

  /**
   * Get combined force (gravity + wind) on a particle
   */
  getParticleForce(particlePosition) {
    const gravityForce = this.calculateGravitationalForce(particlePosition);
    const windForce = this.calculateWindForce(particlePosition);

    return gravityForce.add(windForce);
  }

  /**
   * Update star orbit and visuals
   */
  update(deltaTime = 0.016) {
    if (!this.mesh) return;

    // Update orbital position
    this.angle += (this.orbitalVelocity / this.orbitalRadius) * deltaTime;
    this.updateOrbitalPosition();

    // Update mesh position
    this.mesh.position.copy(this.position);

    // Update influence sphere position
    if (this.influenceSphere) {
      this.influenceSphere.position.copy(this.position);
    }

    // Update shader time
    if (this.mesh.material.uniforms) {
      this.mesh.material.uniforms.time.value += deltaTime;
    }

    // Slow rotation
    this.mesh.rotation.y += 0.002;

    // Animate corona
    this.coronaLayers.forEach((glow, i) => {
      const pulseFactor = Math.sin(Date.now() * 0.001 + i) * 0.5 + 0.5;
      glow.material.opacity = (0.15 - i * 0.04) + pulseFactor * 0.05;
    });

    // Update stellar wind
    this.updateWindParticles();

    // Update quantum effects
    this.updateQuantumParticles();
  }

  /**
   * Set star parameters
   */
  setParameters(params) {
    if (params.mass !== undefined) {
      this.mass = params.mass;
      this.influenceRadius = this.calculateHillRadius();
      if (this.influenceSphere) {
        this.influenceSphere.geometry.dispose();
        this.influenceSphere.geometry = new THREE.SphereGeometry(this.influenceRadius, 32, 32);
      }
    }
    if (params.temperature !== undefined) {
      this.temperature = params.temperature;
      if (this.mesh && this.mesh.material.uniforms) {
        this.mesh.material.uniforms.temperature.value = this.temperature / 50000;
      }
    }
    if (params.orbitalRadius !== undefined) {
      this.orbitalRadius = params.orbitalRadius;
      this.orbitalVelocity = this.calculateOrbitalVelocity(this.orbitalRadius);
      this.influenceRadius = this.calculateHillRadius();
      if (this.influenceSphere) {
        this.influenceSphere.geometry.dispose();
        this.influenceSphere.geometry = new THREE.SphereGeometry(this.influenceRadius, 32, 32);
      }
      this.updateOrbitalPosition();
    }
    if (params.orbitalVelocity !== undefined) {
      this.orbitalVelocity = params.orbitalVelocity;
    }
    if (params.windVelocity !== undefined) {
      this.windVelocity = params.windVelocity;
    }
    if (params.windDensity !== undefined) {
      this.windDensity = params.windDensity;
    }
    if (params.gravitationalStrength !== undefined) {
      this.gravitationalStrength = params.gravitationalStrength;
    }
    if (params.hawkingRadiationIntensity !== undefined) {
      this.hawkingRadiationIntensity = params.hawkingRadiationIntensity;
    }
    if (params.enableWind !== undefined) {
      this.enableWind = params.enableWind;
    }
    if (params.enableGravity !== undefined) {
      this.enableGravity = params.enableGravity;
    }
    if (params.enableQuantumEffects !== undefined) {
      this.enableQuantumEffects = params.enableQuantumEffects;
    }
    if (params.showInfluenceSphere !== undefined && this.influenceSphere) {
      this.influenceSphere.visible = params.showInfluenceSphere;
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      mass: this.mass,
      radius: this.radius,
      temperature: this.temperature,
      orbitalRadius: this.orbitalRadius,
      orbitalVelocity: this.orbitalVelocity,
      angle: this.angle,
      influenceRadius: this.influenceRadius,
      windVelocity: this.windVelocity,
      windDensity: this.windDensity
    };
  }

  /**
   * Get statistics for UI display
   */
  getStats() {
    return {
      windParticleCount: this.windData.filter(p => p.age < p.maxAge).length,
      quantumParticleCount: this.quantumData.filter(p => p.age < p.maxAge).length,
      influenceRadius: this.influenceRadius.toFixed(1),
      massLossRate: (this.windDensity * this.windVelocity * 0.001).toFixed(3)
    };
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();

      this.coronaLayers.forEach(glow => {
        glow.geometry.dispose();
        glow.material.dispose();
      });
    }

    if (this.windInstance) {
      this.scene.remove(this.windInstance);
      this.windInstance.geometry.dispose();
      this.windInstance.material.dispose();
    }

    if (this.quantumInstance) {
      this.scene.remove(this.quantumInstance);
      this.quantumInstance.geometry.dispose();
      this.quantumInstance.material.dispose();
    }

    if (this.influenceSphere) {
      this.scene.remove(this.influenceSphere);
      this.influenceSphere.geometry.dispose();
      this.influenceSphere.material.dispose();
    }
  }
}

export default CompanionStar;
