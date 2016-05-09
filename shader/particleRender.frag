#version 300 es


//////////////////////////////////////////////
//
// Fragment Shader for particle sphere rendering
precision highp float;

uniform sampler2D uParticlePosTex;	// Holds particle positions and the inverse mass
uniform sampler2D uParticleVelTex;	// Holds particle velocities and the phase

uniform vec3 uLightDir;

uniform mat4 uPerspectiveMatrix;

uniform float uPointSize;

uniform bool uSSFRDepth;
uniform bool uShowParticles;

in vec2 vTextureCoord;
in vec3 vEyeSpacePos;
in vec4 vParticleColor;
in vec4 vParticleVelocity;
in float vParticleMassInv;

// Outputs:
layout(location=0) out vec4 output0;
layout(location=1) out vec4 output1;

// Color saturation
vec3 saturate(in vec3 v) {
	return vec3(max(0.0, min(v.x, 1.0)), max(0.0, min(v.y, 1.0)), max(0.0, min(v.z, 1.0)));
}



/**************************************************
 *
 * Main function
 *
 */
void main() {

    /***********************
    * Method from:
    * Screen Space Fluid Rendering for Games by Simon Green
    ************/

    if(vParticleMassInv == 0.0)
    	discard;

    // calculate eye-space sphere normal from texture coordinates
    vec3 N;
    // from range [0,1] to [-1, 1]
    N.xy = vTextureCoord;
    float r2 = dot(N.xy, N.xy);

    if (r2 > 1.0) {
    	discard;
    }

    N.z = sqrt(1.0 - r2);

    float a = vParticleColor.a;

	// calculate depth
	vec4 pixelPos = vec4(vEyeSpacePos + N*uPointSize, 1.0);
	vec4 clipSpacePos = uPerspectiveMatrix * pixelPos;
	float fragDepth = clipSpacePos.z / clipSpacePos.w;
	// Assign depth value to gl_FragDepth and overwrite the WebGL depth estimation
	gl_FragDepth = fragDepth;

	vec3 lightDir = normalize(uLightDir - vEyeSpacePos);

	vec3 color = vParticleColor.rgb;

	// Sphere shading
	if(uShowParticles) {
		float diffuse = max(0.0, dot(N, lightDir));
		color *= diffuse;
	}

	//////////////////////////////////
	// Output

	output0 = vec4(color, a);
	
	output1 = vec4(vec3(fragDepth), 1.0);

}
