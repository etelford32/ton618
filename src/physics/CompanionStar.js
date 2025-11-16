import * as THREE from 'three';

/**
 * CompanionStar - Massive O-type supergiant in stable orbit around TON 618
 * Unlike the TDE star, this remains in orbit and provides gravitational influence
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

    // Orbital elements
    this.angle = params.initialAngle || 0;
    this.inclination = params.inclination || 0; // Orbital plane tilt
    this.eccentricity = params.eccentricity || 0; // 0 = circular orbit

    // Position and velocity
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();

    this.updateOrbitalPosition();

    // Visual
    this.mesh = null;
    this.coronaLayers = [];

    this.createStarMesh();
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
   * Update star orbit and visuals
   */
  update(deltaTime = 0.016) {
    if (!this.mesh) return;

    // Update orbital position
    this.angle += (this.orbitalVelocity / this.orbitalRadius) * deltaTime;
    this.updateOrbitalPosition();

    // Update mesh position
    this.mesh.position.copy(this.position);

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
  }

  /**
   * Set star parameters
   */
  setParameters(params) {
    if (params.mass !== undefined) {
      this.mass = params.mass;
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
      this.updateOrbitalPosition();
    }
    if (params.orbitalVelocity !== undefined) {
      this.orbitalVelocity = params.orbitalVelocity;
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
      angle: this.angle
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
  }
}

export default CompanionStar;
