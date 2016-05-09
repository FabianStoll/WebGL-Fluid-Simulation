#version 300 es

/************************************************************
 *
 * Fragmentshader for the computation of the lagrange multiplier lambda
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
  * Code examlples obtained and altered from https://github.com/ekpyron/pbf
  */

precision highp float;
precision highp sampler3D;

// Uniforms:
uniform sampler2D uParticlePosTex;	// Holds particle positions and the inverse mass

uniform sampler2D uBinIDTex; // One-value per pixel texture that holds bin indices
uniform sampler3D uBin3DTex; // The 3D bin data (particle storage)

uniform vec2 uResolution;

uniform vec3 uBinCountVec;

uniform float uTextureSize;
uniform float uKernelRadius;
uniform float uRestDensity;
uniform float uLambdaCorrection;

// Outputs:
layout(location=0) out vec4 output0;

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




/***************************************************************
 * Function to compute the lambda
 * Each fragment represents a particle
 */
float computeLambda(in vec2 uv) {

	// Get the pixel values
	vec3 particlePosition = texture(uParticlePosTex, uv).rgb;	
	float particleMassInverse = texture(uParticlePosTex, uv).a;	

	// Don't compute anything if there is no particle in the current pixel
	if(particleMassInverse <= 0.0) {
		discard;
	}

	// Get the bin which holds the current particle
	float binID = texture(uBinIDTex, uv).r;

	// Convert the binID to the corresponding texture coordinate for the 3D texture
	vec3 binCoord = getBinCoordinates(binID);

	// These values can be precomputed!
	float xStep = 1.0/(uBinCountVec.x-1.0);
	float yStep = 1.0/(uBinCountVec.y-1.0);
	float zStep = 1.0/(uBinCountVec.z-1.0);
	vec3 steps = vec3(xStep, yStep, zStep);

	// There is a maximum of 107 particle neighbors (27 bins * 4 particles) - current particle
	// Each bin has 4 particle IDs of the particles they inhabit
	vec4 neighborBins[27];
	vec4 particles[4];
	vec3 shift;
	vec2 texel;
	float lambda = 0.0;
	float sum_grad_C2 = 0.0;
	vec3 gradC_i = vec3(0);	
	vec3 gradC_j = vec3(0);
	float sum_k_grad_Ci = 0.0;
	float rho = 0.0;
	vec3 grad_pi_Ci = vec3 (0);

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
			else {
				texel.y = floor(neighborBins[i][j]/uTextureSize);
				texel.x = neighborBins[i][j] - (texel.y*uTextureSize);
				texel = texel / uTextureSize;
				particles[j] = texture(uParticlePosTex, texel);
			}
		}

		vec3 position = particlePosition;

		// Iterate over all particles in the current bin
		for(int j=0; j<4; j++) {
			vec3 position_j = particles[j].xyz;
		
			// Compute rho_i - density of the current particle
			float len = distance(position, position_j);
			float tmp = Wpoly6(len);
			rho += tmp;

			// Sum gradients of Ci - constraint function of current particle
			// Use j as k so that we can stay in the same loop
			vec3 grad_pk_Ci = vec3 (0);
			grad_pk_Ci = gradWspiky(position - position_j);
			grad_pk_Ci *= 1.0 / uRestDensity;
			sum_k_grad_Ci += dot(grad_pk_Ci, grad_pk_Ci);
			
			// Now use j as j again and accumulate grad_pi_Ci for the case k=i
			grad_pi_Ci += grad_pk_Ci;
		}
	}

	// Add grad_pi_Ci to the sum
	sum_k_grad_Ci += dot(grad_pi_Ci, grad_pi_Ci);
	
	// Compute lambda_i 
	float C_i = rho * (1.0 / uRestDensity) - 1.0;
	lambda = -C_i / (sum_k_grad_Ci + uLambdaCorrection);

	// Return lambda
	return lambda;
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

	float lambda = computeLambda(uv);

	//////////////////////////////////
	// Output

	// Return lambda to framebuffer target
	output0 = vec4(vec3(lambda), 1.0); 
}