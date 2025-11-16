import * as THREE from 'three';

/**
 * OrbitalMechanics - Handles gravitational interactions and orbital transfers
 * Simulates n-body gravity between star, debris, and black hole
 */
export class OrbitalMechanics {
  constructor(blackHoleMass = 66e9) {
    this.blackHoleMass = blackHoleMass;
    this.G = 0.1; // Scaled gravitational constant
    this.bodies = []; // All gravitating bodies
  }

  /**
   * Register a body that can exert gravitational influence
   */
  registerBody(body) {
    this.bodies.push({
      position: body.position,
      mass: body.mass || 1,
      velocity: body.velocity || new THREE.Vector3(),
      radius: body.radius || 1,
      type: body.type || 'particle'
    });
  }

  /**
   * Calculate gravitational force from black hole
   */
  calculateBlackHoleGravity(position) {
    const distance = position.length();
    if (distance < 0.1) return new THREE.Vector3();

    const forceMagnitude = (this.G * this.blackHoleMass) / Math.pow(distance, 2);
    const direction = position.clone().normalize().multiplyScalar(-1);
    return direction.multiplyScalar(forceMagnitude);
  }

  /**
   * Calculate gravitational force between two bodies
   */
  calculateGravityBetween(pos1, mass1, pos2, mass2) {
    const displacement = pos2.clone().sub(pos1);
    const distance = displacement.length();

    if (distance < 0.1) return new THREE.Vector3();

    const forceMagnitude = (this.G * mass1 * mass2) / Math.pow(distance, 2);
    const direction = displacement.normalize();
    return direction.multiplyScalar(forceMagnitude / mass1); // Acceleration
  }

  /**
   * Calculate Hill sphere radius (sphere of gravitational influence)
   * R_Hill = a * (m / 3M)^(1/3) where a = semi-major axis
   */
  calculateHillSphere(bodyMass, orbitalRadius) {
    return orbitalRadius * Math.pow(bodyMass / (3 * this.blackHoleMass), 1/3);
  }

  /**
   * Calculate Roche limit (tidal disruption radius)
   */
  calculateRocheLimit(bodyRadius, bodyDensity, blackHoleDensity) {
    return 2.44 * bodyRadius * Math.pow(blackHoleDensity / bodyDensity, 1/3);
  }

  /**
   * Orbital transfer calculation (Hohmann transfer-like)
   * Determines if particle should transfer from star orbit to disk orbit
   */
  calculateOrbitalTransfer(particlePos, particleVel, starPos, starMass) {
    // Distance from star and black hole
    const toStar = starPos.clone().sub(particlePos);
    const toBH = particlePos.clone().multiplyScalar(-1);

    const distToStar = toStar.length();
    const distToBH = toBH.length();

    // Calculate sphere of influence
    const hillRadius = this.calculateHillSphere(starMass, starPos.length());

    // Particle is within star's Hill sphere
    const inStarSphere = distToStar < hillRadius;

    // Particle is beyond Hill sphere - transitions to BH orbit
    const shouldTransfer = !inStarSphere && distToBH < distToStar * 2;

    return {
      shouldTransfer,
      hillRadius,
      inStarSphere,
      escapeVelocity: this.calculateEscapeVelocity(starMass, distToStar)
    };
  }

  /**
   * Calculate escape velocity from a body
   * v_esc = sqrt(2 * G * M / r)
   */
  calculateEscapeVelocity(mass, distance) {
    if (distance < 0.1) return 0;
    return Math.sqrt((2 * this.G * mass) / distance);
  }

  /**
   * Calculate orbital velocity for circular orbit
   * v_orb = sqrt(G * M / r)
   */
  calculateOrbitalVelocity(mass, radius) {
    if (radius < 0.1) return 0;
    return Math.sqrt((this.G * mass) / radius);
  }

  /**
   * Apply Runge-Kutta 4th order integration for accurate orbits
   */
  rk4Step(position, velocity, deltaTime, forceFunction) {
    // k1
    const k1v = forceFunction(position);
    const k1p = velocity.clone();

    // k2
    const k2v = forceFunction(position.clone().add(k1p.clone().multiplyScalar(deltaTime * 0.5)));
    const k2p = velocity.clone().add(k1v.clone().multiplyScalar(deltaTime * 0.5));

    // k3
    const k3v = forceFunction(position.clone().add(k2p.clone().multiplyScalar(deltaTime * 0.5)));
    const k3p = velocity.clone().add(k2v.clone().multiplyScalar(deltaTime * 0.5));

    // k4
    const k4v = forceFunction(position.clone().add(k3p.clone().multiplyScalar(deltaTime)));
    const k4p = velocity.clone().add(k3v.clone().multiplyScalar(deltaTime));

    // Combine
    const newVel = velocity.clone().add(
      k1v.add(k2v.multiplyScalar(2)).add(k3v.multiplyScalar(2)).add(k4v).multiplyScalar(deltaTime / 6)
    );

    const newPos = position.clone().add(
      k1p.add(k2p.multiplyScalar(2)).add(k3p.multiplyScalar(2)).add(k4p).multiplyScalar(deltaTime / 6)
    );

    return { position: newPos, velocity: newVel };
  }

  /**
   * Calculate L1 Lagrange point between star and black hole
   */
  calculateL1Point(starPos, starMass) {
    const r = starPos.length();
    const massRatio = starMass / this.blackHoleMass;

    // Approximate L1 distance from black hole
    const L1_distance = r * Math.pow(massRatio / 3, 1/3);

    return starPos.clone().normalize().multiplyScalar(L1_distance);
  }
}

export default OrbitalMechanics;
