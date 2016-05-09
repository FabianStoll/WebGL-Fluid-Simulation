#version 300 es

// Fragment Shader

precision highp float;

////////////////////////////
// Global variables
//

// uniforms:
uniform sampler2D uParticleDepthTex;
uniform sampler2D uRefractionDepthTex;

uniform vec2 uResolution;
uniform float uBlurSigma;
uniform bool uSSFRDepth;
uniform bool uSSFRNormals;
uniform bool uSSFRBlur;
uniform bool uDisableColorMixing;

// varyings:
in vec2 vTextureCoord;
in mat4 vPerspectiveMatrix;

// constants:
const int radius = 8;

// Kernel definition
float kernel15[15] = float[](0.057099, 0.060931, 0.064373, 0.067333, 0.06973, 0.071493, 0.072573,
	0.072936, 0.072573, 0.071493, 0.06973, 0.067333, 0.064373, 0.060931, 0.057099);

// Output:
layout(location=0) out vec4 output0;
layout(location=1) out vec4 output1;


float normpdf(in float x, in float sigma)
{
	return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
}


/*************************
 *
 * Bilateral filter function for blurring
 * Adapted from: https://github.com/benma/pysph/blob/master/src/fluid_rendering/blur.cg
 */
float blurFragmentBilateral(in vec2 uv, in vec2 shift, in sampler2D depthTex) {

	float sum = 0.0;
	float wsum = 0.0;

	float depth = texture(depthTex, uv).x;

	float bZ = 1.0/normpdf(0.0, uBlurSigma);

	float factor;


	for(int x = -radius; x <= radius; x++) {

		float sampleX = texture(depthTex, uv + float(x)*shift).x;

		float dist = sampleX - depth;

		factor = normpdf(dist, uBlurSigma)*bZ*kernel15[radius + x];
		wsum += factor;
		sum += factor*sampleX;
	}

	if(wsum > 0.0) {
		sum /= wsum;
	}

	return sum;
}



void main() {	


	float dx = 1.0/uResolution.x;
	vec2 shift = vec2(dx, 0.0);

	float blurredDepth = blurFragmentBilateral(vTextureCoord, shift, uParticleDepthTex);

	float blurredRefraction = 0.0;

	if(!uDisableColorMixing)
		blurredRefraction = blurFragmentBilateral(vTextureCoord, shift, uRefractionDepthTex);
	

	///////////////////////////////
	// Final Output

    output0 = vec4(vec3(blurredDepth), 1.0);

    if(!uDisableColorMixing)
    	output1 = vec4(vec3(blurredRefraction), 1.0);

     
}