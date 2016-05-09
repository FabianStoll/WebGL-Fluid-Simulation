#version 300 es

// Vertex Shader

precision highp float;

in vec2 aVertexPosition;

uniform mat4 uPerspectiveMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uCameraMatrix;

out vec2 vTextureCoord;
out mat4 vTMatrix;
out mat4 vPerspectiveMatrix;

const vec2 scale = vec2(0.5, 0.5);


/**************************************************
 *
 * Main function
 *
 */
void main() {
    // vTextureCoord = aTextureCoord;
    vTextureCoord  = aVertexPosition * scale + scale; // scale vertex attribute to [0,1] range

    vPerspectiveMatrix = uPerspectiveMatrix;
    
    vTMatrix = uPerspectiveMatrix * uCameraMatrix * uModelMatrix;

    gl_Position = vec4(aVertexPosition, 0.0, 1.0);
} 