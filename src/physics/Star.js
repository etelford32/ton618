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
   * Create the visual mesh for the star with multiple layers
   */
  createStarMesh() {
    // Core star with shader material for dynamic appearance
    const geometry = new THREE.SphereGeometry(3, 64, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        temperature: { value: 1.0 },
        stretch: { value: new THREE.Vector3(1, 1, 1) }
      },
      vertexShader: `
        uniform vec3 stretch;
        varying vec3 vPosition;
        varying vec3 vNormal;

        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);

          // Apply tidal stretching
          vec3 stretchedPos = position * stretch;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(stretchedPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float temperature;
        varying vec3 vPosition;
        varying vec3 vNormal;

        // Simplex noise for surface detail
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          // Surface turbulence (convection cells)
          float noise1 = snoise(vPosition * 2.0 + time * 0.3);
          float noise2 = snoise(vPosition * 4.0 - time * 0.5);
          float surfaceDetail = noise1 * 0.3 + noise2 * 0.15;

          // Color based on temperature (blue-white hot to yellow-orange cool)
          vec3 coldColor = vec3(1.0, 0.85, 0.5);   // Yellow-orange
          vec3 hotColor = vec3(1.0, 0.95, 0.9);    // Blue-white
          vec3 baseColor = mix(coldColor, hotColor, temperature);

          // Add surface detail
          vec3 color = baseColor + surfaceDetail * 0.2;

          // Limb darkening (center-to-limb variation)
          float limbDarkening = 1.0 - pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 2.0);
          color *= 0.7 + 0.3 * limbDarkening;

          // Emission intensity
          float emission = 1.2 + surfaceDetail * 0.3 + temperature * 0.5;

          gl_FragColor = vec4(color * emission, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    // Chromosphere (outer atmosphere layer)
    const chromosphereGeometry = new THREE.SphereGeometry(3.3, 64, 64);
    const chromosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6644,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    this.chromosphere = new THREE.Mesh(chromosphereGeometry, chromosphereMaterial);
    this.mesh.add(this.chromosphere);

    // Multi-layer corona/glow
    this.coronaLayers = [];
    for (let i = 0; i < 3; i++) {
      const glowGeometry = new THREE.SphereGeometry(3.8 + i * 0.5, 32, 32);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xffaa44 : (i === 1 ? 0xff8844 : 0xff6644),
        transparent: true,
        opacity: 0.25 - i * 0.08,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      this.coronaLayers.push(glow);
      this.mesh.add(glow);
    }

    // Tidal tail indicators (will appear during stretching)
    this.tidalTails = [];
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
    const stretchAmount = Math.max(0, 1 - distance / this.tidalRadius);

    if (distance < this.tidalRadius && !this.isDisrupted) {
      // Star is being stretched by tidal forces

      // Stretch along radial direction, compress perpendicular
      const radialDirection = this.position.clone().normalize();
      this.stretchFactor.x = 1 + stretchAmount * 4;
      this.stretchFactor.y = 1 / Math.sqrt(1 + stretchAmount * 4);
      this.stretchFactor.z = 1 / Math.sqrt(1 + stretchAmount * 4);

      // Decrease health as it gets stretched
      this.health -= stretchAmount * 0.015;

      // Trigger disruption when health is low
      if (this.health < 0.3) {
        this.isDisrupted = true;
      }
    }

    // Update mesh position
    this.mesh.position.copy(this.position);

    // Align stretch direction with radial vector
    const radialDir = this.position.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    this.mesh.quaternion.setFromUnitVectors(up, radialDir);

    // Update shader uniforms
    if (this.mesh.material.uniforms) {
      this.mesh.material.uniforms.time.value += deltaTime;
      this.mesh.material.uniforms.stretch.value.copy(this.stretchFactor);

      // Temperature increases dramatically near tidal radius
      const heatFactor = Math.max(0, 1 - (distance / this.tidalRadius));
      const temperature = 0.3 + heatFactor * 0.7;
      this.mesh.material.uniforms.temperature.value = temperature;
    }

    // Rotate star (differential rotation faster at equator)
    this.mesh.rotation.z += 0.005 * (1 + stretchAmount);

    // Update chromosphere stretching
    if (this.chromosphere) {
      this.chromosphere.scale.copy(this.stretchFactor);
      this.chromosphere.material.opacity = 0.15 + stretchAmount * 0.3;
    }

    // Update corona layers with dramatic effects
    this.coronaLayers.forEach((glow, i) => {
      const pulseFactor = Math.sin(Date.now() * 0.002 + i) * 0.5 + 0.5;
      const stretchScale = new THREE.Vector3(
        1 + (this.stretchFactor.x - 1) * 1.2,
        1 + (this.stretchFactor.y - 1) * 1.2,
        1 + (this.stretchFactor.z - 1) * 1.2
      );
      glow.scale.copy(stretchScale);

      // Glow intensifies as star disrupts
      const baseOpacity = 0.25 - i * 0.08;
      const disruptionGlow = (1 - this.health) * 0.4;
      glow.material.opacity = baseOpacity + disruptionGlow + pulseFactor * 0.05;

      // Color shift to blue-white when heated
      if (stretchAmount > 0.3) {
        const heatColor = new THREE.Color().lerpColors(
          new THREE.Color(0xff6644),
          new THREE.Color(0xffffff),
          stretchAmount
        );
        glow.material.color = heatColor;
      }
    });

    // Create tidal tails when significantly stretched
    if (stretchAmount > 0.4 && this.tidalTails.length < 20) {
      this.createTidalTail(radialDir, stretchAmount);
    }

    // Cleanup old tidal tails
    for (let i = this.tidalTails.length - 1; i >= 0; i--) {
      const tail = this.tidalTails[i];
      tail.age++;
      tail.material.opacity *= 0.95;

      if (tail.age > 60 || tail.material.opacity < 0.01) {
        this.scene.remove(tail);
        tail.geometry.dispose();
        tail.material.dispose();
        this.tidalTails.splice(i, 1);
      }
    }
  }

  /**
   * Create visible tidal tail particles
   */
  createTidalTail(direction, intensity) {
    const geometry = new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffaa66,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    const tail = new THREE.Mesh(geometry, material);

    // Position along stretch axis
    const offset = (Math.random() - 0.5) * this.stretchFactor.x * 3;
    tail.position.copy(this.position).add(direction.clone().multiplyScalar(offset));

    // Add some perpendicular spread
    const perpDir = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();
    tail.position.add(perpDir.multiplyScalar((Math.random() - 0.5) * 2));

    tail.age = 0;
    this.scene.add(tail);
    this.tidalTails.push(tail);
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

    // Clear tidal tails
    this.tidalTails.forEach(tail => {
      this.scene.remove(tail);
      tail.geometry.dispose();
      tail.material.dispose();
    });
    this.tidalTails = [];

    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.rotation.set(0, 0, 0);
      this.mesh.quaternion.identity();

      // Reset shader uniforms
      if (this.mesh.material.uniforms) {
        this.mesh.material.uniforms.time.value = 0;
        this.mesh.material.uniforms.temperature.value = 1.0;
        this.mesh.material.uniforms.stretch.value.set(1, 1, 1);
      }
    }

    // Reset chromosphere
    if (this.chromosphere) {
      this.chromosphere.scale.set(1, 1, 1);
      this.chromosphere.material.opacity = 0.15;
    }

    // Reset corona layers
    this.coronaLayers.forEach((glow, i) => {
      glow.scale.set(1, 1, 1);
      glow.material.opacity = 0.25 - i * 0.08;
      glow.material.color.setHex(i === 0 ? 0xffaa44 : (i === 1 ? 0xff8844 : 0xff6644));
    });
  }

  /**
   * Remove star from scene
   */
  destroy() {
    // Cleanup tidal tails
    this.tidalTails.forEach(tail => {
      this.scene.remove(tail);
      tail.geometry.dispose();
      tail.material.dispose();
    });

    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();

      // Cleanup chromosphere
      if (this.chromosphere) {
        this.chromosphere.geometry.dispose();
        this.chromosphere.material.dispose();
      }

      // Cleanup corona layers
      this.coronaLayers.forEach(glow => {
        glow.geometry.dispose();
        glow.material.dispose();
      });
    }
  }
}

export default Star;
