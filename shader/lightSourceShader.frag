/////////////////////////////////////////////////
//
// Fragment Shader to render the light source

precision highp float;

/**************************************************
 *
 * Main function
 *
 */
void main() {
	
	vec3 N;
    N.xy = gl_PointCoord * 2.0 - vec2(1.0);
    float r2 = dot(N.xy, N.xy);
    if (r2 > 1.0) discard;	// kill pixels outside circle
	
	///////////////////////////////
	// Final Output

	// Yellow
    gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
}