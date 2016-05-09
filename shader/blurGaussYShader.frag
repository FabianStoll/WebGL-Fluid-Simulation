#version 300 es

// Fragment Shader

precision highp float;

////////////////////////////
// Global variables
//

// uniforms:
uniform sampler2D uSSFRThicknessTexture;
uniform vec2 uResolution;

// varyings:
in vec2 vTextureCoord;

// constants:
const int gaussRadius = 11;

// Output:
layout(location=0) out vec4 output0;


/*************************
 *
 * Gaussian Filter
 * Adapted from: https://wiki.delphigl.com/index.php/shader_blur2
 */
float blurThicknessGauss(in vec2 uv, in vec2 shift) {

	float sum = 0.0;
	float gaussFilter[] = float[](0.0402,0.0623,0.0877,0.1120,0.1297,0.1362,0.1297,0.1120,0.0877,0.0623,0.0402);

	for(int i = 0; i < gaussRadius; i++) {
		sum += gaussFilter[i] * texture(uSSFRThicknessTexture, uv + float(i-5)*shift).x;
	}

	return sum;
}


void main() {

	float blurredThickness;	

	float dy = 1.0/uResolution.y;

	vec2 shift = vec2(0.0, dy);
	blurredThickness = blurThicknessGauss(vTextureCoord, shift);

	output0 = vec4(vec3(blurredThickness), 1.0);
}