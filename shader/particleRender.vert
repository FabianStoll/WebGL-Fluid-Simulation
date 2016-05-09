#version 300 es

// Vertex Shader for the particle and depth render

precision highp float;

in vec3 aVertexPosition;	// Point Sprite Data, resembles a square in the xy-plane (from -1 to 1)
in vec4 aParticleOffset; 	// Particle Positions
in vec4 aParticleColor;
in vec4 aParticleVelocity;

uniform mat4 uPerspectiveMatrix;
uniform mat4 uCameraMatrix;

uniform float uPointSize;

uniform bool uNvidia;

out vec2 vTextureCoord;
out vec3 vEyeSpacePos;
out vec4 vParticleColor;
out vec4 vParticleVelocity;
out float vParticleMassInv;


/**************************************************
 *
 * Main function
 *
 */
void main() {

	vec4 pos = vec4(0);

	// Switch code depending on your graphics card!

	////////////////////////////////////
	// NVIDIA:
	if(uNvidia) {

		vec4 particlePos = vec4(vec3(aVertexPosition), 1.0);

		// Transform the sprite coordinates so they always face the camera and add them to the particle offset
		particlePos.xyz += vec4(uCameraMatrix * aParticleOffset).xyz;	

		vEyeSpacePos = particlePos.xyz;

		// MULTIPLY BY INVERSE OF SPRITESIZE!
		vTextureCoord = aVertexPosition.xy * (1.0/uPointSize);

		vParticleColor = aParticleColor;

		vParticleMassInv = aParticleOffset.a;

		vParticleVelocity = aParticleVelocity;

		pos = uPerspectiveMatrix * particlePos;

	} else {
		/////////////////////////////////
		// INTEL:
		vec4 particlePos = aParticleOffset;

		// Transform the sprite coordinates so they always face the camera and add them to the particle offset
		particlePos.xyz += vec4(uCameraMatrix * vec4(aVertexPosition, 1.0)).xyz;	

		vEyeSpacePos = particlePos.xyz;

		// MULTIPLY BY INVERSE OF SPRITESIZE!
		vTextureCoord = aParticleOffset.xy * (1.0/uPointSize);

		vParticleColor = aParticleColor;

		vParticleVelocity = aParticleVelocity;

		pos = uPerspectiveMatrix * particlePos;
	}



	////////////////////////////
	// OUTPUT
	gl_Position = pos;

}

