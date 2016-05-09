#version 300 es

/************************************************************
 *
 * Fragmentshader for the computation fluid vorticity
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
  * Code obtained and altered from https://github.com/ekpyron/pbf
  */

precision highp float;
precision highp sampler3D;

// Uniforms:
uniform sampler2D uParticlePosTex;	// Holds particle positions and the inverse mass
uniform sampler2D uParticleVelTex;	// Holds particle velocities and the phase
uniform sampler2D uVorticityTex;

uniform sampler2D uBinIDTex; // One-value per pixel texture that holds bin indices
uniform sampler3D uBin3DTex; // The 3D bin data (particle storage)

uniform vec2 uResolution;

uniform vec3 uBinCountVec;

uniform float uTextureSize;
uniform float uTime;
uniform float uKernelRadius;
uniform float uVorticity;

// Outputs:
layout(location=0) out vec4 output0;	// updated velocity

// Constants:
const float PI = 3.14159265359;
const float EPSILON = 0.000001;

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

/**********************
 *	Kernels
 */
float Wpoly6 (float r)
{
	float h = uKernelRadius;
	if (r > h)
		return 0.0;
	float tmp = h * h - r * r;
	return 1.56668147106 * tmp * tmp * tmp / (h*h*h*h*h*h*h*h*h);
}

float Wspiky (float r)
{
	float h = uKernelRadius;
	if (r > h)
		return 0.0;
	float tmp = h - r;
	return 4.774648292756860 * tmp * tmp * tmp / (h*h*h*h*h*h);
}

vec3 gradWspiky (vec3 r)
{
	float h = uKernelRadius;
	float l = length (r);
	if (l > h || l == 0.0)
		return vec3 (0);
	float tmp = h - l;
	return (-3.0 * 4.774648292756860 * tmp * tmp) * r / (l * h*h*h*h*h*h);
}



/***************************************************************
 * Function to compute the new particle positions and velocities
 * Each fragment represents a particle
 */
vec3 computeVorticity(in vec2 uv) {

	// Get the pixel values
	vec3 particlePosition = texture(uParticlePosTex, uv).rgb;	
	float particleMassInverse = texture(uParticlePosTex, uv).a;	

	vec3 particleVelocity = texture(uParticleVelTex, uv).rgb;

	// Don't compute anything if there is no particle in the current pixel
	if(particleMassInverse == 0.0) {
		return vec3(0.0);
	}


	////////////////////////////////////
	// Get neighboring particles:

	// Get the bin which holds the current particle
	float binID = texture(uBinIDTex, uv).r;

	// Convert the binID to the corresponding texture coordinate for the 3D texture
	vec3 binCoord = getBinCoordinates(binID);

	// These values can be precomputed!
	float xStep = 1.0/(uBinCountVec.x-1.0);
	float yStep = 1.0/(uBinCountVec.y-1.0);
	float zStep = 1.0/(uBinCountVec.z-1.0);
	vec3 steps = vec3(xStep, yStep, zStep);

	// There is a maximum of 108 particle neighbors (27 bins * 4 particles)
	// Each bin has 4 particle IDs of the partices they inhabit
	vec4 neighborBins[27];
	vec4 particles[4];
	vec3 shift;
	vec2 texel;
	vec3 v_i = particleVelocity;
	vec3 vorticityArray[4];
	vec3 v = vec3(0);
	vec3 vorticity = texture(uVorticityTex, uv).xyz;
	vec3 gradVorticity = vec3(0);

	// Look up the values of the neighboring bins to get the neighboring particles
	for(int i=0; i<27; i++) {

		// Get the particle IDs
		shift = vec3(OFFSET[i].x*steps.x, OFFSET[i].y*steps.y, OFFSET[i].z*steps.z);
		neighborBins[i] = texture(uBin3DTex, binCoord + shift).rgba;

		for(int j=0; j<4; j++) {
			// Convert the particle IDs to the corresponding texture coordinates and get the particle values
			if(neighborBins[i][j] == -1.0) {
				particles[j] = vec4(-1.0);
			}
			else{
				texel.y = floor(neighborBins[i][j]/uTextureSize);
				texel.x = neighborBins[i][j] - (texel.y*uTextureSize);
				texel = texel / uTextureSize;
				particles[j] = texture(uParticlePosTex, texel);
				vorticityArray[j] = texture(uVorticityTex, texel).xyz;
			}
		}
		
		int k = 0;
		vec4 particlesCorrected[4] = particles;
		float colorCounter = 0.0;
		
		for(int j=0; j<4; j++) {

			if(particles[j] != vec4(-1.0)) {

				// Compute vorticity
				vec3 position_j = particles[j].xyz;

				vec3 p_ij = particlePosition - position_j;

				gradVorticity += length(vorticityArray[j]) * gradWspiky(p_ij);
			}
		}
		
	}

	float l = length(gradVorticity);
	if(l > 0.0)
		gradVorticity /= l;

	vec3 N = gradVorticity;

	// Apply vorticity force
	v = v_i + uTime * uVorticity * cross(N, vorticity);

	return v;

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

	// Compute the particle physics 
	particleVelocityNew = computeVorticity(uv); 


	//////////////////////////////////
	// Output

	// Return new calculated particle position values
	output0 = vec4(particleVelocityNew, 1.0); 
}