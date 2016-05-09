#version 300 es

/////////////////////////////////////////////////////
//
// Fragment shader to draw the background scene
//

precision highp float;

// uniforms:
uniform vec2 uResolution;

uniform vec3 uCameraPos;
uniform vec3 uViewDir;
uniform vec3 uLightDir;


layout(location=0) out vec4 output0;


// other variables:
//Sets background colour(red, green, blue)
vec3 bgCol = vec3(0.7, 0.7, 0.7);


/////////////////////////////
// Structs

struct Sphere {
	vec3 center;
	vec3 color;
	float radius;
	float scale;
};

struct Light {
	vec3 position;
	vec3 direction;
	vec3 color;
	float radius;
};



//////////////////////////////
// Additional functions

//-----------------------------------------------------------------
// Digit drawing function by P_Malin (https://www.shadertoy.com/view/4sf3RN)

float SampleDigit(const in float n, const in vec2 vUV)
{		
	if(vUV.x  < 0.0) return 0.0;
	if(vUV.y  < 0.0) return 0.0;
	if(vUV.x >= 1.0) return 0.0;
	if(vUV.y >= 1.0) return 0.0;
	
	float data = 0.0;
	
	     if(n < 0.5) data = 7.0 + 5.0*16.0 + 5.0*256.0 + 5.0*4096.0 + 7.0*65536.0;
	else if(n < 1.5) data = 2.0 + 2.0*16.0 + 2.0*256.0 + 2.0*4096.0 + 2.0*65536.0;
	else if(n < 2.5) data = 7.0 + 1.0*16.0 + 7.0*256.0 + 4.0*4096.0 + 7.0*65536.0;
	else if(n < 3.5) data = 7.0 + 4.0*16.0 + 7.0*256.0 + 4.0*4096.0 + 7.0*65536.0;
	else if(n < 4.5) data = 4.0 + 7.0*16.0 + 5.0*256.0 + 1.0*4096.0 + 1.0*65536.0;
	else if(n < 5.5) data = 7.0 + 4.0*16.0 + 7.0*256.0 + 1.0*4096.0 + 7.0*65536.0;
	else if(n < 6.5) data = 7.0 + 5.0*16.0 + 7.0*256.0 + 1.0*4096.0 + 7.0*65536.0;
	else if(n < 7.5) data = 4.0 + 4.0*16.0 + 4.0*256.0 + 4.0*4096.0 + 7.0*65536.0;
	else if(n < 8.5) data = 7.0 + 5.0*16.0 + 7.0*256.0 + 5.0*4096.0 + 7.0*65536.0;
	else if(n < 9.5) data = 7.0 + 4.0*16.0 + 7.0*256.0 + 5.0*4096.0 + 7.0*65536.0;
	
	vec2 vPixel = floor(vUV * vec2(4.0, 5.0));
	float fIndex = vPixel.x + (vPixel.y * 4.0);
	
	return mod(floor(data / pow(2.0, fIndex)), 2.0);
}

float PrintInt(const in vec2 uv, const in float value )
{
	float res = 0.0;
	float maxDigits = 1.0+ceil(log2(value)/log2(10.0));
	float digitID = floor(uv.x);
	if( digitID>0.0 && digitID<maxDigits )
	{
        float digitVa = mod( floor( value/pow(10.0,maxDigits-1.0-digitID) ), 10.0 );
        res = SampleDigit( digitVa, vec2(fract(uv.x), uv.y) );
	}

	return res;	
}

// ray-sphere intersection
float iSphere(in vec3 ro, in vec3 rd, in Sphere sph)
{
	vec3 oc = ro - sph.center;
	float b = dot( oc, rd );
	float c = dot( oc, oc ) - sph.scale*sph.scale;
	float h = b*b - c;
	if( h<0.0 ) return -1.0;
	return -b - sqrt( h );
}



/**************************************************
 *
 * Main function
 *
 */
void main() {

	// create pixel coordinates [0, 1]
	vec2 uv = gl_FragCoord.xy / uResolution.xy;
	
	// normalize to screen coordinates [-1, 1] and get the current pixel
	vec3 p = vec3(uv * 2.0 - 1.0, 0.0);
	
	// scale if canvas has an aspect ratio
	p.x *= uResolution.x / uResolution.y;
	
	// set camera position (= ray origin)
	vec3 ro = uCameraPos;
	
	// view vector
	vec3 view = uViewDir;
	
	// right vector
	vec3 right = normalize(cross(view, vec3(0.0, 1.0, 0.0)));
	
	// up vector
	vec3 up = normalize(cross(right, view));
	
	// ray direction
	vec3 rd = normalize(p.x * right + p.y * up + view);
	
	float tmin = 10000.0;
	vec3 pos = vec3(0.0);
	vec3 diff = vec3(1.0);
	vec3 nor = vec3(0.0);
	
	
	float h = 0.0;
	
	// ground plane
	h = (-0.5 - ro.y) / rd.y;	// shift it down by 0.5 units to fit the bounding box
	if( h > 0.0 && h < tmin ) 
	{ 
		tmin = h; 
		pos = ro + h * rd;
		
        // plane normal
		nor = vec3(0.0, 1.0, 0.0); 
		
		//occ = oSphere( pos, nor, sph1 ) * oSphere( pos, nor, sph2 ) * oSphere( pos, nor, sph3 );
        
        // plane color and pattern
		diff = vec3(0.9) * smoothstep(-1.0, -0.95, sin(4.0 * pos.x)) * smoothstep(-1.0, -0.95, sin(4.0 * pos.z));
	}
	

	vec3 col = vec3(0);

	// far plane distance
	if(tmin < 1000.0)
	{
	    pos = ro + tmin * rd;
        col = vec3(1.0);
		
		// light position
		vec3 lig = normalize(uLightDir);

		float ndl = max(0.0, dot(nor, lig));

        // add colors
        col *= diff * ndl;
		
		// light radius
        col *= exp(-0.4*(max(0.0, tmin - 10.0)));

	}

	col = pow(col, vec3(0.45));
	
	///////////////////////////////
	// draw numbers or vectors
	// float number = PrintInt((p.xy + vec2(1.0, -0.5))*4.0, uTime*10000.0);
	// col = mix(col, vec3(1.0), number);
	
	
	
	///////////////////////////////
	// Final Output
    output0 = vec4(col, 1.0);

}