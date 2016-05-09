#version 300 es

///////////////////////////////////////////
// Vertex Shader for particle calculations

precision highp float;

in vec2 aVertexPosition;

uniform mat4 uPerspectiveMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uCameraMatrix;



/**************************************************
 *
 * Main function
 *
 */
void main() {

    gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}