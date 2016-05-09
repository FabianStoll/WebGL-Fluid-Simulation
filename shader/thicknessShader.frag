#version 300 es

// Fragment Shader for particle calculations
// #version 300
//#extension GL_EXT_draw_buffers : require
precision highp float;

uniform float uThicknessValue;

in vec2 vTextureCoord;
in float vParticleMassInv;


// Output:
layout(location=0) out vec4 output0;


const float THICKNESS = 0.008;


/***********************************
 * Main function
 *
 */
void main() {

    if(vParticleMassInv == 0.0)
        discard;

    /***********************
    * Method from:
    * Screen Space Fluid Rendering for Games
    ************/
    // calculate eye-space sphere normal from texture coordinates
    vec3 N;
    // from range [0,1] to [-1, 1]
    N.xy = vTextureCoord;// * 2.0 - vec2(1.0);
    float r2 = dot(N.xy, N.xy);
    if (r2 > 1.0) 
    	discard;

    vec3 thickness = vec3(uThicknessValue);

	//////////////////////////////////
	// Output

	output0 = vec4(thickness, 1.0);

}
