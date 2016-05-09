#version 300 es

///////////////////////////////////////////
// Vertex Shader for particle calculations

precision highp float;

in vec2 aVertexPosition;

uniform mat4 uPerspectiveMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uCameraMatrix;

out mat4 vTMatrix;


/**************************************************
 *
 * Main function
 *
 */
void main() {
	vTMatrix = uPerspectiveMatrix * uCameraMatrix * uModelMatrix;

    gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}