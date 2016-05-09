#version 300 es

/////////////////////////////////////////////
// Fragment Shader for particle calculations

// #extension GL_EXT_draw_buffers : require
precision highp float;

uniform sampler2D uParticlePosTex;	// Holds particle positions and the inverse mass
uniform sampler2D uParticleVelTex;	// Holds particle velocities and the phase

uniform vec2 uResolution;

uniform vec3 uExitVelocity;

uniform float uTextureSize;
uniform float uTime;
uniform float uBoundingBox[9];
uniform float uGravity;

uniform bool uCollisionResponse;

layout(location=0) out vec4 output0;
layout(location=1) out vec4 output1;
layout(location=2) out vec4 output2;

const float EPSILON = 0.00001;
const float RESTITUTION = 0.2;

// Gravitational force constant
const vec3 G_FORCE = vec3(0.0, -1.0, 0.0);

// Collision plane
struct collisionPlane {
	vec3 pos;
	vec3 n;
};


/***************************
 * Define collision planes
 */
collisionPlane[6] setCollisionPlanes() {
	collisionPlane cpy1, cpy2, cpx1, cpx2, cpz1, cpz2;
	cpy1.pos = vec3(0.0, -0.5, 0.0);
	cpy1.n = vec3(0.0, 1.0, 0.0);
	cpy2.pos = vec3(0.0, uBoundingBox[6], 0.0);
	cpy2.n = vec3(0.0, -1.0, 0.0);
	cpx1.pos = vec3(uBoundingBox[3], 0.0, 0.0);
	cpx1.n = vec3(1.0, 0.0, 0.0);
	cpx2.pos = vec3(uBoundingBox[4], 0.0, 0.0);
	cpx2.n = vec3(-1.0, 0.0, 0.0);
	cpz1.pos = vec3(0.0, 0.0, uBoundingBox[8]-1.0);
	cpz1.n = vec3(.0, 0.0, -1.0);
	cpz2.pos = vec3(0.0, 0.0, uBoundingBox[7]-1.0);
	cpz2.n = vec3(.0, 0.0, 1.0);
	collisionPlane planes[6];
	planes[0] = cpy1; planes[1] = cpy2; planes[2] = cpx1;
	planes[3] = cpx2; planes[4] = cpz1; planes[5] = cpz2;
	return planes;
}



/************************************************************************
 * Function to solve a collision constraint for particle-plane collisions
 */
bool solveCollisionConstraint(in vec3 positionOld, in vec3 positionNew, in collisionPlane cp) {
	vec3 l = positionNew - positionOld;	// Line segment between two positions
	float t = distance(positionOld, positionNew);	
	float denom = dot(cp.n, l);
	float t2 = 0.0;
	vec3 iP = vec3(0);
	// Compare intersection point with line segment
	if(denom < EPSILON) {
		vec3 p0_l0 = cp.pos - positionOld;
		t2 = dot(p0_l0, cp.n) / denom;
		if(t2 < t) {
			return true;
		}
	}

	return false;
}



/**************************************************************************
 * Perform an integration step for a particle using the semi-implicit Euler
 * Each fragment represents a particle
 */
vec4 semiImplicitEuler(in vec2 uv, out vec3 particleVelocityNew, out vec3 particlePositionOld) {

	// Get the pixel values
	particlePositionOld = texture(uParticlePosTex, uv).rgb;
	float particleMassInverse = texture(uParticlePosTex, uv).a;	
	vec3 particleVelocityOld = texture(uParticleVelTex, uv).rgb;	

	// Don't compute anything if there is no particle in the current pixel
	if(particleMassInverse <= 0.0) {
		discard;
	}

	// Set exit velocity of the emitter if the particle is new
	if(particleVelocityOld == vec3(0)) {
		particleVelocityOld = uExitVelocity;
	};

	// First compute the acceleration from force and mass
	vec3 particleAcceleration = vec3(0.0, uGravity, 0.0) * particleMassInverse;

	// Now compute the resulting velocity and add it up
	particleVelocityNew = particleVelocityOld + particleAcceleration * uTime;

	// Finally predict the new particle position
	vec3 particlePositionNew = particlePositionOld + particleVelocityNew * uTime;

	if(uCollisionResponse) {
		// Wall collision
		collisionPlane planes[6] = setCollisionPlanes(); 

		for(int i=0; i<6; i++) {
			if(solveCollisionConstraint(particlePositionOld, particlePositionNew, planes[i])) {
				// Collision resolution
				particleVelocityNew = reflect(particleVelocityNew, planes[i].n) * RESTITUTION;
				// vec3 tempPos = particlePositionNew;
				particlePositionNew = particlePositionOld + particleVelocityNew * uTime;
				// particlePositionOld = tempPos;
			}
		}
	}

	
	
	// Return the results
	return vec4(particlePositionNew, particleMassInverse);
}




/**************************************************
 *
 * Main function
 *
 */
void main() {

	vec2 uv = gl_FragCoord.xy / uTextureSize;

	// Vector initialization
	vec3 particleVelocityNew = vec3(0);
	vec4 particlePositionNew = vec4(0);
	vec3 particlePositionOld = vec3(0);

	// Compute the particle physics
	particlePositionNew = semiImplicitEuler(uv, particleVelocityNew, particlePositionOld);
	

	//////////////////////////////////
	// Output

	// Return new calculated particle position values
	output0 = particlePositionNew; 

	// Velocity in pass 1
	output1 = vec4(particleVelocityNew, 1.0);

	// Previous positions
	output2 = vec4(particlePositionOld, particlePositionNew.a);
}