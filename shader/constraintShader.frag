#version 300 es

/************************************************************
 *
 * Fragmentshader for the computation of particle constraints
 *
 ************************************************************/

 /*
 * Copyright (c) 2013-2014 Daniel Kirchner
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE ANDNONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

 /*
  * Code examples obtained and altered from https://github.com/ekpyron/pbf
  */

precision highp float;
precision highp sampler3D;

// Uniforms:
uniform sampler2D uParticlePosTex;		// Holds particle positions and the inverse mass
uniform sampler2D uParticleVelTex;		// Holds particle velocities and the phase
uniform sampler2D uParticlePosOldTex;	// Holds the previous particle positions
uniform sampler2D uLambdaTex;
uniform sampler2D uParticleColorTex;

uniform sampler2D uBinIDTex; // One-value per pixel texture that holds bin indices
uniform sampler3D uBin3DTex; // The 3D bin data (particle storage)

uniform vec2 uResolution;

uniform vec3 uBinCountVec;

uniform float uTextureSize;
uniform float uTime;
uniform float uBoundingBox[9];
uniform float uPointSize;
uniform float uKernelRadius;
uniform float uColorMixRadius;
uniform float uRestDensity;
uniform float uTensileInstability;

uniform bool uDisableColorMixing;

uniform int uSceneID;

// Outputs:
layout(location=0) out vec4 output0;
layout(location=1) out vec4 output1;
layout(location=2) out vec4 output2;
layout(location=3) out vec4 output3;

// Constants:
const float PI = 3.14159265359;
const float EPSILON = 0.000001;

// Gravitational force constant
const vec3 G_FORCE = vec3(0.0, -1.0, 0.0);



//////////////////////////////////////////////////////////////////
// More iterations converge for a better PBF simulation, 
// but cost more resources
//
const int ITERATIONS = 8;
//
//////////////////////////////////////////////////////////////////



// Offset array for neighbor search
vec3 OFFSET[27] = vec3[](
	vec3(0, 0, 0), vec3(1., 0, 0), vec3(-1., 0, 0),
	vec3(1., 1., 0), vec3(-1., 1., 0), vec3(1., -1, 0),
	vec3(-1., -1., 0), vec3(0, 1., 0), vec3(0, -1., 0),
	vec3(0, 0, -1.), vec3(1., 0, -1.), vec3(-1., 0, -1.),
	vec3(1., 1., -1.), vec3(-1., 1., -1.), vec3(1., -1, -1.),
	vec3(-1., -1., -1.), vec3(0, 1., -1.), vec3(0, -1., -1.),
	vec3(0, 0, 1.), vec3(1., 0, 1.), vec3(-1., 0, 1.),
	vec3(1., 1., 1.), vec3(-1., 1., 1.), vec3(1., -1, 1.),
	vec3(-1., -1., 1.), vec3(0, 1., 1.), vec3(0, -1., 1.)
); 



/****************************************************************
 * Function to get the bin texture coordinates based on the binID
 */
vec3 getBinCoordinates(in float binID) {
	if(binID < 0.0)
		discard;

	float xBinCount = uBinCountVec.x;
	float yBinCount = uBinCountVec.y;
	float zBinCount = uBinCountVec.z;

	float zID = floor(binID/(xBinCount*yBinCount));
	float yID = floor((binID - (zID*xBinCount*yBinCount))/xBinCount);
	float xID = binID - yID*xBinCount - zID*xBinCount*yBinCount;

	float xCoord = xID/(xBinCount-1.0);
	float yCoord = yID/(yBinCount-1.0);
	float zCoord = zID/(zBinCount-1.0);

	vec3 binCoord = vec3(xCoord, yCoord, zCoord);

	return binCoord;
}


// Saturate a color
vec3 saturate(in vec3 v) {
	return vec3(max(0.0, min(v.x, 1.0)), max(0.0, min(v.y, 1.0)), max(0.0, min(v.z, 1.0)));
}


/*****************************************************************
 * Function to solve a distance constraint for 4 particles at max
 * A distance constraint enables granular particle behaviour
 */
vec4[4] solveDistanceConstraint(in vec4 particles[4], in vec3 particlePosition, in float dist, out vec3 positionCorrected) {
	vec3 n;
	vec3 corr = vec3(0);
	float d;
	vec4 particlesNew[4];
	positionCorrected = particlePosition;

	// Loop over 4 particles
	for(int j=0; j<4; j++) {
		if(particles[j].a != -1.0) {	// Is particle valid?
			n = particles[j].xyz - particlePosition;	// Get normal
			d = length(n);	// Get distance
			particlesNew[j] = particles[j];
			// Distance constraint
			if(d < dist && n != vec3(0)) {	
				n = normalize(n);
				corr = (n * (d - dist)) * 0.5;	// Compute correction vector
				positionCorrected = particlePosition + corr;	// Shift particle position
				particlesNew[j].xyz -= corr;
			}
		}
	}

	return particlesNew;
}



/**********************
 *	Kernels
 */

float Wpoly6(float r) {
	float h = uKernelRadius;
	if(r > h)
		return 0.0;
	float tmp = h * h - r * r;
	return 1.56668147106 * tmp * tmp * tmp / (h*h*h*h*h*h*h*h*h);
}

float Wspiky(float r) {
	float h = uKernelRadius;
	if(r > h)
		return 0.0;
	float tmp = h - r;
	return 4.774648292756860 * tmp * tmp * tmp / (h*h*h*h*h*h);
}

vec3 gradWspiky(vec3 r) {
	float h = uKernelRadius;
	float l = length (r);
	if(l > h || l == 0.0)
		return vec3 (0);
	float tmp = h - l;
	return (-3.0 * 4.774648292756860 * tmp * tmp) * r / (l * h*h*h*h*h*h);
}

float Wpoly6Color(float r) {
	float h = uColorMixRadius;
	if (r > h)
		return 0.0;
	float tmp = h * h - r * r;
	return 1.56668147106 * tmp * tmp * tmp / (h*h*h*h*h*h*h*h*h);
}


/***************************************************************
 * Function to compute the new particle positions and velocities
 * Each fragment represents a particle
 */
vec4 computeSPH(in vec2 uv, out vec3 particleVelocityNew, out vec4 particleColor) {

	// Get the pixel values
	vec3 particlePosition = texture(uParticlePosTex, uv).rgb;	
	float particleMassInverse = texture(uParticlePosTex, uv).a;	

	vec3 particleVelocity = texture(uParticleVelTex, uv).rgb;

	// vec3 particlePositionNew = vec3(0);
	vec3 particlePositionNew = particlePosition;
	particleVelocityNew = vec3(0);

	// Values from last time step
	vec3 particlePositionOld = texture(uParticlePosOldTex, uv).rgb;	

	// Don't compute anything if there is no particle in the current pixel
	if(particleMassInverse <= 0.0) {
		discard;
	}

	/******************************
	 * Get neighboring particles:
	 */

	// Get the bin which holds the current particle
	float binID = texture(uBinIDTex, uv).r;

	// Convert the binID to the corresponding texture coordinate for the 3D texture
	vec3 binCoord = getBinCoordinates(binID);

	// These values can be precomputed!
	float xStep = 1.0/(uBinCountVec.x-1.0);
	float yStep = 1.0/(uBinCountVec.y-1.0);
	float zStep = 1.0/(uBinCountVec.z-1.0);
	vec3 steps = vec3(xStep, yStep, zStep);

	// There is a maximum of 107 particle neighbors (27 bins * 4 particles minus the current particle)
	// Each bin has 4 particle IDs of the partices they inhabit
	vec4 neighborBins[27];
	vec4 particles[4];
	float lambdaArray[4];
	vec3 shift;
	vec2 texel;
	float lambda = texture(uLambdaTex, uv).r;
	particleColor = vec4(0);
	if(!uDisableColorMixing) {
		particleColor = texture(uParticleColorTex, uv);
	}

	vec4 particleColorArray[4];
	vec4 newColor = particleColor;
	float colorCounter = 0.0;
	vec3 deltap = vec3(0);

	// Look up the values of the neighboring bins to get the neighboring particles
	for(int i=0; i<27; i++) {

		// Get the particle IDs
		shift = vec3(OFFSET[i].x*steps.x, OFFSET[i].y*steps.y, OFFSET[i].z*steps.z);
		neighborBins[i] = texture(uBin3DTex, binCoord + shift).rgba;

		// Fetch the particles
		for(int j=0; j<4; j++) {
			// Convert the particle IDs to the corresponding texture coordinates and get the particle values
			if(neighborBins[i][j] == -1.0) {
				particles[j] = vec4(-1.0);
				lambdaArray[j] = -1.0;
				if(!uDisableColorMixing) {
					particleColorArray[j] = vec4(-1.0);
				}
			}
			else {
				// Calculate the texture coordinate
				texel.y = floor(neighborBins[i][j]/uTextureSize);
				texel.x = neighborBins[i][j] - (texel.y*uTextureSize);
				texel = texel / uTextureSize;
				particles[j] = texture(uParticlePosTex, texel);
				lambdaArray[j] = texture(uLambdaTex, texel).r;
				if(!uDisableColorMixing) {
					particleColorArray[j] = texture(uParticleColorTex, texel);
				}
			}
		}

		//////////////////////////////////////////////////////////////
		//
		// Compute the particle interactions for the current particle
		// --> Solve the constraints
		
		int k = 0;
		vec4 particlesCorrected[4] = particles;
		
		vec3 v = vec3(0);
		vec3 vorticity = vec3(0);
		
		// Converge the positional change
		while(k < ITERATIONS) {

			for(int j=0; j<4; j++) {

				if(particles[j] != vec4(-1.0)) {

					// SPH approach:
					vec3 position_j = particles[j].xyz;
					float len = distance(particlePosition, position_j);
					float tmp = Wpoly6(len);

					// Color diffusion:
					if(!uDisableColorMixing) {
						// Interpolate the colors
						vec4 col_j = particleColorArray[j];
						float tmp2 = Wpoly6Color(len);
						
						float w = clamp(tmp2/107.0, 0.0, 1.0);
						newColor = newColor * (1.0 - w) + col_j * w;
					}


					// PBF position correction calculation:

					// Tensile instability
					float scorr = (1.0 / Wpoly6 (0.1 * uKernelRadius)) *  tmp;
					scorr *= scorr;
					scorr *= scorr;
					scorr = -uTensileInstability * scorr;

					float lambda_j = lambdaArray[j];
					vec3 temp = gradWspiky(particlePosition - position_j);

					deltap += (lambda + lambda_j + scorr) * temp;
				}
			}

			k++;
		} 
		
	}

	if(!uDisableColorMixing) {
		particleColor = newColor;
	}

	// Apply the correction
	particlePosition += (1.0 / uRestDensity) * deltap;
	particlePositionNew = particlePosition;
	
	// Wall collision
	float delta = 0.2;
	particlePositionNew = clamp(particlePositionNew, vec3(uBoundingBox[3]+delta, uBoundingBox[5]+delta, uBoundingBox[7]+delta), 
		vec3(uBoundingBox[4]-delta, uBoundingBox[6]-delta, uBoundingBox[8]-delta));
	
	// Verlet integration
	// vec3 particleAcceleration = G_FORCE * particleMassInverse;
	particleVelocityNew = ((particlePositionNew - particlePositionOld) / uTime);
	// particleVelocityNew += particleAcceleration * uTime;

	// Particle sleeping for low velocities
	if(length(particlePositionNew - particlePositionOld) < 0.005) {
		particlePositionNew = particlePositionOld;
		particleVelocityNew = vec3(0.0001);
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

	// create pixel coordinates [0, 1]
	vec2 uv = gl_FragCoord.xy / uTextureSize;
	
	// normalize to screen coordinates [-1, 1] 
	vec3 p = vec3(uv * 2.0 - 1.0, 0.0);
	
	// scale if canvas has an aspect ratio
	p.x *= uResolution.x / uResolution.y;

	vec3 particleVelocityNew = vec3(0);
	vec4 particlePositionNew = vec4(0);
	vec4 particleColor = vec4(0);
	float colorPhase = 0.0;
	float colorID = 0.0;

	// Compute the particle physics 
	particlePositionNew = computeSPH(uv, particleVelocityNew, particleColor); 


	//////////////////////////////////
	// Output

	// Return new calculated particle position values
	output0 = particlePositionNew; 

	// Velocity in pass 1
	output1 = vec4(particleVelocityNew, 1.0);

	// Color in pass 2
	output2 = particleColor;

}