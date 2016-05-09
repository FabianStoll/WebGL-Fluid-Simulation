precision highp float;

uniform float uTexWidth;   
uniform float uTexWidth2; 
uniform sampler2D uSampler;
uniform sampler2D uVertexTexture0;
uniform sampler2D uVertexTexture1;
uniform sampler2D uVertexTexture2;
uniform sampler2D uVertexTexture3;
uniform sampler2D uTextureCoords;
uniform sampler2D uRTT;	// render target texture
uniform int uRenderStatus;
uniform float uSphereRadius;
uniform vec3 uMaxVertex;
uniform vec3 uMinVertex;
uniform vec3 uLightPos;
uniform mat4 uTMatrix;
uniform sampler2D uNormalTexture;
uniform sampler2D uNormalTexture2;
uniform vec3 uEye;
uniform vec3 uViewDirection;
uniform vec2 uResolution;
uniform float uRand;			// random number between 0 and 1, provided by javascript
uniform float uParameters[16];	// Array of 16 Float Parameters
uniform float uTime;

varying vec2 vTextureCoord;
varying mat4 vTMatrix;
varying mat3 vNormalMatrix;

const int MAX_TEXTURE_WIDTH = 50;
const int MAX_IMAGE_WIDTH = 1920;
const int MAX_IMAGE_HEIGHT = 1080;

const int SAMPLES = 3;

const float INFINITY = 1e10;
const float ZMAX = 99999.0;
const float EPSILON = 0.001;
const float R_LIMIT = 0.1;
const float PI = 3.1415926535897932384626433832795;

const vec3 BACKGROUND = vec3(0.78431, 0.78431, 0.78431);
float SHININESS = uParameters[0];
float K_A = uParameters[1];
float K_D = uParameters[2];
float K_S = uParameters[3];
float K_C = uParameters[4];
float K_L = uParameters[5];
float K_Q = uParameters[6];
vec3 LIGHT_COLOR = vec3(uParameters[7], uParameters[8], uParameters[9])/255.0;
vec3 AMBIENT_COLOR = vec3(uParameters[10], uParameters[11], uParameters[12])/255.0;
float BRDF = uParameters[13];
float SAMPLING = uParameters[14];
float BOUNCES = uParameters[15];


struct Ray {
	vec3 o;
	vec3 dir;
};


struct Intersection {
	vec3 p;
	float dist;
	
	vec3 n;
	vec3 ambient;
	vec3 diffuse;
	float specular;
};


struct Light {
	vec3 p;
	vec3 dir;
	vec3 color;
	float radius;
};


// from Evan Wallace Pathtracer
// use the fragment position for randomness
float random(vec3 scale, float seed) { 
   return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed); 
}




float rand(vec2 n) {
  return 0.5 + 0.5 * fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
}
 

// create a (pseudo-) random direction on the normal's hemisphere
vec3 randomSampledDirection(in vec3 Normal, in vec2 r, in float sampling) {

	vec3 direction = vec3(0);

    float Xi1 = rand(r);
    float Xi2 = (1.0 - rand(r))*rand(uRand*r);

	if(sampling == 0.0) {		// Hemisphere Sampling
	
	}
	
	if(sampling == 1.0) {
	// random cosine-weighted distributed vector
	// from http://www.rorydriscoll.com/2009/01/07/better-sampling/
	   float u = random(vec3(12.9898, 78.233, 151.7182), uTime * gl_FragCoord.x); 
	   float v = random(vec3(63.7264, 10.873, 623.6736), uTime * gl_FragCoord.y); 
	   float r = sqrt(u); 
	   float angle = 6.283185307179586 * v; 
	    // compute basis from normal
	   vec3 sdir, tdir; 
	   if (abs(Normal.x)<.5) { 
	     sdir = cross(Normal, vec3(1,0,0)); 
	   } else { 
	     sdir = cross(Normal, vec3(0,1,0)); 
	   } 
	   tdir = cross(Normal, sdir); 
	   return r*cos(angle)*sdir + r*sin(angle)*tdir + sqrt(1.-u)*Normal; 
	
	}	
	
	if(sampling == 2.0) {		// Phong BRDF Importance Sampling
		float theta = acos(pow(Xi1, (1.0/(SHININESS+1.0))));
	    float phi = 2.0 * PI * Xi2;
	
	    float xs = sin(phi) * cos(theta);
	    float ys = 1.0;
	    float zs = sin(phi) * sin(theta);
	
	    vec3 y = Normal;
	    vec3 h = y;
	    if (abs(h.x)<=abs(h.y) && abs(h.x)<=abs(h.z)) {
	        h.x= 1.0;
	    }
	    else if (abs(h.y)<=abs(h.x) && abs(h.y)<=abs(h.z)) {
	        h.y= 1.0;
	    }
	    else {
	        h.z= 1.0;
	    }
	
	    vec3 x = normalize(pow(h, y));
	    vec3 z = normalize(pow(x, y));
	
	    direction = xs*x + ys*y + zs*z;
	}

    return normalize(direction);
}


// Function to check the intersection of a ray with a triangle
// Möller-Trumbore-Algorithm
Intersection IntersectRayTriangle(in vec3 Triangle[3], in vec3 RayDirection, in vec3 RayOrigin, in vec3 Normal) {
	Intersection i;
	vec3 u, v; 			// triangle vectors
	vec3 w0, w, dir;	// ray vectors
	float r, a, b, c;	// variables for ray-plane intersection
	
	i.n = Normal;
	
	// get the triangle edge vectors and the plane normal
	u = Triangle[1] - Triangle[0];
	v = Triangle[2] - Triangle[0];
	
	w0 = RayOrigin - Triangle[0];
	a = -dot(i.n, w0);
	b = dot(i.n, RayDirection);
	
	if(abs(b) < 1e-5)
	{
		// ray is parallel to triangle plane and they can never intersect
		i.dist = INFINITY;
		return i;
	}
	
	// get intersection point of the ray with the triangle plane
	r = a/b;
	i.dist = r;
	if(r < 0.0)	// ray goes away from triangle
	{
		i.dist = INFINITY;	// no intersection 
		return i;
	}
	
	i.p = RayOrigin + r * RayDirection;	// intersection point of ray and plane
	
	// is i.p inside the Triangle?
	float uu, uv, vv, wu, wv, D;
	uu = dot(u, u);
	uv = dot(u, v);
	vv = dot(v, v);
	w = i.p - Triangle[0];
	wu = dot(w, u);
	wv = dot(w, v);
	D = uv * uv - uu * vv;
	
	// get and test the parametric coordinates
	float s, t;
	s = (uv * wv - vv * wu) / D;
	if(s < 0.0 || s > 1.0)			// i.p is outside the Triangle
	{
		i.dist = INFINITY;
		return i;
	}
	t = (uv * wu - uu * wv) / D;	
	if(t < 0.0 || (s + t) > 1.0)	// i.p is outside the Triangle
	{
		i.dist = INFINITY;	
		return i;
	}
	
	// else: i.p is inside the Triangle
	if(r <= R_LIMIT){
		i.dist = INFINITY;	
		return i;
	}

	return i;
	
}



// rounds a float number to 3 decimals
float RoundNumber(in float num) {
	num = num * 1000.0;
	float result = (num - floor(num) > 0.5) ? ceil(num) : floor(num);
	result = result / 1000.0;
	return result;
}


// returns the intersection with the 3D OBJ Model
Intersection IntersectScene(in Ray ray, in sampler2D VertexTexture) {

	Intersection I;
	int index = 0;
	
	vec3 Triangle[3];
	vec3 s, t, n;	// 2 Triangle Vectors and Triangle Normal for Backface Culling
	float d;		// Dot Product for Backface Culling
	vec3 dir;
	float TexelU, nTexelU;
	float TexelSize = 1.0 / uTexWidth;
	// Round the TexelSize to 3 decimals. Otherwise the texture coordinate access would fail!
	TexelSize = RoundNumber(TexelSize);
	bool result;
	vec3 p0, p1, p2;
	vec2 c0;
	vec3 n0, Normal;
	Intersection hit;
	hit.dist = INFINITY;
	// default background color is the color of the canvas background
	hit.diffuse = BACKGROUND;
	float j, a, b, c;
		
		// LINKS NACH RECHTS VON (0,1) BIS (1,1)
		for(int i=0; i<MAX_TEXTURE_WIDTH; i++) {
			j = float(i);
			if(i >= int(uTexWidth/3.0)) {
			//if(i >= int(3)) {
				break;
			} 
			else {

				// formula to iterate through the texture coordinates to get the vertices
				//TexelU = TexelSize * (3.0 * float(i) - 2.0); 
					
					
				TexelU = j * 3.0;
				a = TexelU * TexelSize;
				b = a + TexelSize;
				c = b + TexelSize;	
							
				p0 = texture2D(VertexTexture, vec2(a, 0.0)).rgb;
				p1 = texture2D(VertexTexture, vec2(b, 0.0)).rgb;
				p2 = texture2D(VertexTexture, vec2(c, 0.0)).rgb;
				
				
				/*
				p0 = texture2D(VertexTexture, vec2(TexelSize*52.0, 0.0)).rgb;
				p1 = texture2D(VertexTexture, vec2(TexelSize*53.0, 0.0)).rgb;
				p2 = texture2D(VertexTexture, vec2(TexelSize*54.0, 0.0)).rgb;
				*/
				
				// transform the vertices with the current Transformation Matrix
				Triangle[0] = (vTMatrix * vec4(p0, 1.0)).xyz;
				Triangle[1] = (vTMatrix * vec4(p1, 1.0)).xyz;
				Triangle[2] = (vTMatrix * vec4(p2, 1.0)).xyz;
				
				n0 = texture2D(uNormalTexture, vec2(a, 1.0)).rgb;
				Normal = vNormalMatrix * n0;
				Normal = normalize(Normal);
				
				
				vec3 a = Triangle[1] - Triangle[0];
				vec3 b = Triangle[2] - Triangle[0];
				Normal = cross(a, b);
				Normal = -normalize(Normal);
				

				I = IntersectRayTriangle(Triangle, ray.dir, ray.o, Normal);
				vec3 point = I.p;
			
				// only save the nearest Intersection and assign its color
				if(I.dist < hit.dist) {
					c0 = texture2D(uTextureCoords, vec2(TexelU * TexelSize, 0.0)).rg;
					I.diffuse = texture2D(uSampler, c0).rgb;
					hit = I;
				}
				
			} 
		} // end of for loop
		
    return hit;
}



// Blinn-Phong-Lighting
vec3 BlinnPhong(in Intersection I, in Light L, in vec3 ViewDir) {
	
	vec3 Color = vec3(0);
	
	// Ambient
	vec3 ambientColor = AMBIENT_COLOR;
	Color += ambientColor * I.diffuse * K_A;
	
	// Diffuse
	float lam = max(dot(-I.n, L.dir), 0.0);
	Color += K_D * I.diffuse * L.color * lam;
	
	// Specular
	vec3 H = normalize(L.dir + ViewDir);
	float NdotH = max(dot(-I.n, H), 0.0);
	float spec = K_S * pow(NdotH, SHININESS);
	if(lam <= 0.0) {
		spec = 0.0;
	}
	
	// Light Attenuation
	float d = length(L.dir);
	float att = 1.0 / (K_C + K_L * d + K_Q * d*d);
	
	// add up the specular and attenuation terms
	Color += spec * L.color * I.diffuse * att;
	
	return Color;
}


// Specular Lighting
vec3 Specular(in Intersection I, in Light L, in Ray R) {
	
	Ray ray;
	Intersection i;
	vec3 Color;
	
	// ray origin
	ray.o = I.p;
	
	// reflection direction
	ray.dir = reflect(R.dir, I.n);
	
	// trace the reflective ray
	i = IntersectScene(ray, uVertexTexture0);
	Color = I.diffuse + i.diffuse;
	
	return Color/2.0;
}


// Phong-Lighting
vec3 Phong(in Intersection I, in Light L, in vec3 ViewDir) {
	
	vec3 Color = vec3(0);
	
	// Ambient
	vec3 ambientColor = AMBIENT_COLOR;
	Color += ambientColor * I.diffuse * K_A;
	
	// Diffuse
	float lam = max(dot(-I.n, L.dir), 0.0);
	Color += K_D * I.diffuse * L.color * lam;
	
	// Specular
	vec3 reflDir = reflect(-L.dir, -I.n);
	float specAngle = max(dot(reflDir, ViewDir), 0.0);
	float spec = K_S * pow(specAngle, SHININESS);
	if(lam <= 0.0) {
		spec = 0.0;
	}
	
	// Light Attenuation
	float d = length(L.dir);
	float att = 1.0 / (K_C + K_L * d + K_Q * d*d);
	
	// add up the specular and attenuation terms
	Color += spec * L.color * I.diffuse * att;
	
	return Color;
}



// Function to compute direct lighting
vec3 DirectLighting(in Intersection I, in Light L, in Ray R, in vec3 ViewDirection, in sampler2D VertexTexture, in float brdf) {
	
	Intersection i;
	vec3 LightDir;
	vec3 Color = vec3(0.0);
	
	// check the illumination of the point
	Ray sray;
	// new origin is old hitpoint
	sray.o = I.p;	
	// new direction is normalized distance to the light source
	LightDir = normalize(L.p - sray.o);
	sray.dir = LightDir;	
	
	// trace the ray from the hitpoint to the light source and check for intersections
	i = IntersectScene(sray, uVertexTexture0);
	
	if(brdf == 0.0) {			// Blinn-Phong
		Color = BlinnPhong(I, L, ViewDirection);
	}
	else if(brdf == 1.0) {	// Specular reflective
		Color = Specular(I, L, R);
	}
	else if(brdf == 2.0) {	// Phong
		Color = Phong(I, L, ViewDirection);
	}
	
	// check if the shadow ray intersects with the scene
	if(i.dist != INFINITY) {
		// hitpoint is in the shadow
		Color = vec3(0.1, 0.1, 0.1) * Color;
		return Color;
	}
	else {
		// point is illuminated by the light source
		// save the color of the first hitpoint
		return Color;
	}
	
}

   
// MAIN FUNCTION 
void main(void) {

	Intersection I0, I1, I2, I3, I4, Isph;
	Ray ray;
	
	// define the light source
	Light L;
	L.p = uLightPos;
	L.p = (vTMatrix * vec4(L.p, 1.0)).xyz;
	L.radius = 10.0;
	L.color = LIGHT_COLOR;
	
	// final Color
	vec3 Color = vec3(0);

	// get the current uv-coordinates
	vec2 uv = vec2((gl_FragCoord.x / uResolution.x), (gl_FragCoord.y / uResolution.y));
	
	
	// normalize to screen coordinates [-1, 1]
	uv = (uv * 2.0 - 1.0);
	
	// set the ray origin
	ray.o = vec3(0.0, 0.0, -2.0);
	
	// set the ray direction
	ray.dir = vec3(uv, 1.0);
	
	ray.dir = normalize(ray.dir);
	
	// Raytrace with Eye Ray and the Model to get the first intersection
	I0 = IntersectScene(ray, uVertexTexture0);
	
	// Light direction is the vector from the first hitpoint to the light's position
	L.dir = I0.p - L.p;
	L.dir = normalize(L.dir);

	// color from indirect lighting
	vec3 Color_ind = vec3(0);
	vec3 Color_ind2 = vec3(0);
	vec3 Color_ind3 = vec3(0);
	vec3 Color_ind4 = vec3(0);
	
	// cast and apply the shadow ray
	Color = DirectLighting(I0, L, ray, uViewDirection, uVertexTexture0, BRDF);
	//Color = I0.diffuse;
	// new rays to continue the path
	Ray iray;
	Ray iray2;
	Ray iray3;
	Ray iray4;
	// new ray origin is old ray hitpoint
	iray.o = I0.p;
	
	// RUSSIAN ROULETTE
	// randomly choose if initial ray is reflected or emitted
	float prob = rand(uv*I0.p.yx);
	float p_emit = 0.01; // 50% probability, that light emits from the hitpoint, 50% that it reflects
	
		// get random ray direction
		iray.dir = randomSampledDirection(I0.n, uRand*uv, SAMPLING);
		//iray.dir = cosineWeightedDirection(I0.n, uTime * uv.x);
		//iray.dir = ray.o;
		// trace the new ray
		I1 = IntersectScene(iray, uVertexTexture0);
		// see if the reflected ray hits a point in the light or in the shadow
		I1.diffuse = DirectLighting(I1, L, iray, uViewDirection, uVertexTexture0, BRDF) * p_emit;
		
		// get random ray direction
		//iray4.dir = randomSampledDirection(I0.n, uTime*uv, SAMPLING);
		// trace the new ray
		//I4 = IntersectScene(iray4, uVertexTexture0);
		// see if the reflected ray hits a point in the light or in the shadow
		//I4.diffuse = DirectLighting(I4, L, iray4, uViewDirection, uVertexTexture0, BRDF) * p_emit;
		
		//I1.diffuse = (I1.diffuse + I4.diffuse) / 2.0;
		
		if(BOUNCES >= 2.0) {
			prob = rand(uv.yx * uRand * I1.n.yz);
			//p_emit = (0.2126 * I1.diffuse.x + 0.7152 * I1.diffuse.y + 0.0722 * I1.diffuse.z);	
			
			
				// get random ray direction
				iray2.dir = randomSampledDirection(I1.n, uRand*uv, SAMPLING);
				//iray2.dir = cosineWeightedDirection(I1.n, uTime * uv.y);
				// trace the new ray
				I2 = IntersectScene(iray2, uVertexTexture0);
				// see if the reflected ray hits a point in the light or in the shadow
				I2.diffuse = DirectLighting(I2, L, iray2, uViewDirection, uVertexTexture0, BRDF) * p_emit;
				
				if(BOUNCES >= 3.0) {
					prob = rand(uv.yx * uRand * I2.n.yz);
					//p_emit = (0.2126 * I1.diffuse.x + 0.7152 * I1.diffuse.y + 0.0722 * I1.diffuse.z);	
					
					
						// get random ray direction
						iray3.dir = randomSampledDirection(I2.n, uRand*uv, SAMPLING);
						// trace the new ray
						I3 = IntersectScene(iray3, uVertexTexture0);
						// see if the reflected ray hits a point in the light or in the shadow
						I3.diffuse = DirectLighting(I3, L, iray3, uViewDirection, uVertexTexture0, BRDF) * p_emit;
						
						Color_ind = Color_ind + (I1.diffuse + I2.diffuse + I3.diffuse) / 3.0;
					
				} else {	// compute 2 bounces
					Color_ind = (I1.diffuse + I2.diffuse) * 0.5; 
				}
			
		} else {
			Color_ind = I1.diffuse;
		}
		
		
		// divide the accumulated color by the number of samples to evaluate the monte carlo integral
		//Color_ind = Color_ind / float(SAMPLES);
		// add the indirect illumination to to illumination of the first hitpoint
		Color += Color_ind;
		// divide it by 2 to correct for the addition of 2 colors
		Color *= 0.5;
		
	
	
	
	
	/*
	// trace random rays 
	for(int i=0; i<SAMPLES; i++) {
		// get random ray direction
		iray.dir = randomSampledDirection(I0.n, uTime * uv.xy * (float(i)+1.0), SAMPLING);
		// trace the new ray
		I1 = IntersectScene(iray, uVertexTexture0);
		// see if the reflected ray hits a point in the light or in the shadow
		I1.diffuse = DirectLighting(I1, L, iray, uViewDirection, uVertexTexture0, BRDF);
		// accumulate the color
		Color_ind += I1.diffuse;
		
		if(prob < p_emit) {		// light reflects again
			iray2.o = I1.p;
			iray2.dir = randomSampledDirection(I0.n, uTime * uv.yx * (float(i)+1.0), SAMPLING);
			I2 = IntersectScene(iray2, uVertexTexture0);
			I2.diffuse = DirectLighting(I2, L, iray2, uViewDirection, uVertexTexture0, BRDF);
			Color_ind2 += I2.diffuse;
			
			Color_ind2 = Color_ind2 / p_emit;
			
			Color_ind *= Color_ind2;
			Color_ind /= 2.0;
			
			
			float prob2 = rand(uv*uRand*uTime*(float(i)+1.0);
			if(prob2 < p_emit) {		// light reflects again
				iray3.o = I2.p;
				iray3.dir = randomSampledDirection(I0.n, (uTime/PI) * uv.yx * (float(i)+1.0), SAMPLING);
				I3 = IntersectScene(iray3, uVertexTexture0);
				I3.diffuse = DirectLighting(I3, L, iray3, uViewDirection, uVertexTexture0, BRDF);
				Color_ind3 += I3.diffuse;
				
				Color_ind3 = Color_ind3 / p_emit;
				
				Color_ind2 *= Color_ind3;
				Color_ind2 /= 2.0;
			}
			
		}
		
	}
	
	// divide the accumulated color by the number of samples to evaluate the monte carlo integral
	Color_ind = Color_ind / float(SAMPLES);
	// add the indirect illumination to to illumination of the first hitpoint
	Color += Color_ind;
	// divide it by 2 to correct for the addition of 2 colors
	Color *= 0.5;
	*/

	
	// assign the calculated color as output color
	gl_FragColor = vec4(Color, 1.0);
	
	
	
	
	/////////////////////////////////////////////////////////////////////////////////////////////
	// for squared textures:
	/*
	for(int j=1; j < 20; j++) { 
	
		if(j >= int(uTexWidth2)) {
			break;
		} 
		else {
			texelV = 1.0 - float(j)*TexelSize;
			I = Raytrace2(texelV, ray);
			if(I.dist != INFINITY) {
				vec4 texelColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
				gl_FragColor = vec4(texelColor.rgb * vLightLevel, texelColor.a);
			}
		}
	}
	*/
	/////////////////////////////////////////////////////////////////////////////////////////////
	
}     





