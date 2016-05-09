#version 300 es


/////////////////////////////////////////////////////
//
// Basic vertex shader for fullscreen quad rendering
//

precision highp float;

in vec3 aCubeVertex;

uniform mat4 uPerspectiveMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uCameraMatrix;

out vec3 vTextureCoord;
// out vec2 vTextureCoord;
// out mat4 vTMatrix;
// out mat4 vPerspectiveMatrix;

// const vec2 scale = vec2(0.5, 0.5);


/**************************************************
 *
 * Main function
 *
 */
void main() {

    vTextureCoord  = aCubeVertex;



    gl_Position = uPerspectiveMatrix * uCameraMatrix * vec4(aCubeVertex, 1.0);
} 