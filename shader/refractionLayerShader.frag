#version 300 es


//////////////////////////////////////////////
//
// MCSSFR Shader

precision highp float;

uniform mat4 uPerspectiveMatrix;

uniform float uPointSize;

in vec2 vTextureCoord;
in vec3 vEyeSpacePos;
in vec4 vParticleColor;
in vec4 vParticleVelocity;
in float vParticleMassInv;

// Outputs:
layout(location=0) out vec4 output0;
layout(location=1) out vec4 output1;


/**************************************************
 *
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
    N.xy = vTextureCoord;
    float r2 = dot(N.xy, N.xy);
    // r2 = smoothstep(0.9, 1.1, r2);

	vec3 color = vParticleColor.rgb;
	float alpha = vParticleColor.a;

    if (r2 > 1.0) {
    	discard;
    }

    N.z = sqrt(1.0 - r2);

    // calculate depth
	vec4 pixelPos = vec4(vEyeSpacePos + N*uPointSize, 1.0);
	vec4 clipSpacePos = uPerspectiveMatrix * pixelPos;
	float fragDepth = clipSpacePos.z / clipSpacePos.w;

	// Assign inverse alpha value as depth! 
	// This enabled alpha sorting with WebGL!
	gl_FragDepth = (1.0 - alpha);

	//////////////////////////////////
	// Output

	output0 = vec4(color, alpha);
	
	output1 = vec4(vec3(fragDepth), 1.0);

}
