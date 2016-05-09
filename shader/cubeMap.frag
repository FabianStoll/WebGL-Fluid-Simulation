#version 300 es

/////////////////////////////////////////////////////
//
// Fragment shader to draw the background scene
//

precision highp float;


uniform samplerCube uCubeMapTexture;

in vec3 vTextureCoord;


layout(location=0) out vec4 output0;



//////////////////////////////
// Additional functions

/**************************************************
 *
 * Main function
 *
 */
void main() {

	///////////////////////////////
	// Final Output

    output0 = texture(uCubeMapTexture, vTextureCoord);
}