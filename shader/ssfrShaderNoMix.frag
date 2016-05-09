#version 300 es

// Fragment Shader for SSFR calculation

precision highp float;

////////////////////////////
// uniforms:
uniform sampler2D uSSFRDepthTexture;
uniform sampler2D uSSFRDepthTextureBlurX;
uniform sampler2D uSSFRDepthTextureBlurY;
uniform sampler2D uParticleColorTex;
uniform sampler2D uParticleDepthTex;
uniform sampler2D uSSFRThicknessTexture;
uniform sampler2D uBackgroundTexture;
uniform sampler2D uEnvironmentTex;
uniform sampler2D uColorBlurTex;

uniform samplerCube uCubeMapTexture;

uniform mat4 uCameraMatrix;

uniform vec2 uResolution;

uniform vec3 uLightDir;
uniform vec3 uViewDir;
uniform vec3 uFluidColor;
uniform vec3 uAmbientColor;
uniform vec3 uSpecularColor;

uniform vec3 uColorPaletteArray[8];

uniform float uSSFRTransparency;
uniform float uSSFRShininess;
uniform float uSSFRFresnelExponent;
uniform float uSSFRReflection;
uniform float uSSFRGamma;

uniform int uSSFRColorLayer;
uniform int uSceneID;

uniform bool uShowParticles;
uniform bool uSSFRDepth;
uniform bool uSSFRNormals;
uniform bool uSSFRDiffuse;
uniform bool uSSFRSpecular;
uniform bool uSSFRFresnel;
uniform bool uSSFRThickness;
uniform bool uSSFRAbsorption;
uniform bool uSSFRRefraction;
uniform bool uSSFRBlur;
uniform bool uSSFRCubemap;
uniform bool uDisableColorMixing;

// varyings:
in vec2 vTextureCoord;
in mat4 vPerspectiveMatrix;
in mat4 vTMatrix;

// output:
layout(location=0) out vec4 output0;
layout(location=1) out vec4 output1;
layout(location=2) out vec4 output2;
layout(location=3) out vec4 output3;
layout(location=4) out vec4 output4;
layout(location=5) out vec4 output5;
layout(location=6) out vec4 output6;
layout(location=7) out vec4 output7;

// constants:
const float MAXDEPTH = 0.97;
const float SHININESS = 8.0;
const float GAMMA = 2.2;
const vec3 AMBIENT = vec3(0.0, 0.0, 0.0);
const vec3 DIFFUSE = vec3(0.1, 0.2, 1.0);
const vec3 SPECULAR = vec3(1.0);


float saturate(in float x) {
	return max(0.0, min(x, 1.0));
}


vec3 saturate3(in vec3 v) {
	return vec3(max(0.0, min(v.x, 1.0)), max(0.0, min(v.y, 1.0)), max(0.0, min(v.z, 1.0)));
}


// obtain position from texcoord and depth
vec3 getpos(in vec3 p) {
	vec4 pos = inverse(vPerspectiveMatrix) * vec4(p * 2.0 - 1.0, 1.0);
	pos /= pos.w;
	pos = inverse(uCameraMatrix) * pos;
	return pos.xyz / pos.w;
}


/**************************************************
 *
 * Main function
 *
 */
void main() {
	vec4 colorMix = vec4(0);

	float texelSizeX = 1.0 / uResolution.x;
	float texelSizeY = 1.0 / uResolution.y;

	float diffuse = 0.0;
	float diffuse2 = 0.0;

	float thickness = texture(uSSFRThicknessTexture, vTextureCoord).x;

	thickness = max(thickness, 1.0);

	float depth = texture(uSSFRDepthTexture, vTextureCoord).x;

	if(depth >= MAXDEPTH) {
		discard;
		return;
	}

	depth = texture(uSSFRDepthTextureBlurY, vTextureCoord).x;

	vec3 pos = getpos (vec3 (vTextureCoord, depth));
	vec3 eye = pos;

	vec2 tmp;
	tmp = vTextureCoord + vec2 (texelSizeX, 0);
	vec3 ddx = getpos (vec3 (tmp, texture (uSSFRDepthTextureBlurY, tmp).x)) - pos;
	tmp = vTextureCoord - vec2 (texelSizeX, 0);
	vec3 ddx2 = pos - getpos (vec3 (tmp, texture (uSSFRDepthTextureBlurY, tmp).x));
	if (abs (ddx.z) > abs (ddx2.z)) ddx = ddx2;

	tmp = vTextureCoord + vec2 (0, texelSizeY);
	vec3 ddy = getpos (vec3 (tmp, texture (uSSFRDepthTextureBlurY, tmp).x)) - pos;
	tmp = vTextureCoord - vec2 (0, texelSizeY);
	vec3 ddy2 = pos - getpos (vec3 (tmp, texture (uSSFRDepthTextureBlurY, tmp).x));
	if (abs (ddy.z) < abs (ddy2.z)) ddy = ddy2;
	
	vec3 n = normalize (cross (ddx, ddy));

	vec3 dir = normalize (reflect (-uViewDir, n));


	vec4 color = vec4(0);

	color = texture(uParticleColorTex, vTextureCoord);

	if(uShowParticles) {
		output0 = vec4(color.xyz, 1.0);
		return;
	}

	output0 = vec4(color.xyz, 1.0);

	if(uSSFRDepth)
		output0 = texture(uSSFRDepthTexture, vTextureCoord);
		
	if(uSSFRBlur)
		output0 = texture(uSSFRDepthTextureBlurY, vTextureCoord);

	if(uSSFRNormals)
		output0 = vec4(n, 1.0);

	if(uSSFRThickness) {
		// scale thickness by radius so the thickness looks the same for any number of particles present in the 
		// same z-range.
		// less particles => larger radius => more thickness contribution per particle
		// color.xyz = texture2D(uSSFRThicknessTexture, vTextureCoord).xyz*0.1;

		output0 = texture(uSSFRThicknessTexture, vTextureCoord);
	}

	vec3 lightDir = normalize(uLightDir-eye);
	float fresnel = 0.0;
	float normalReflectance = 0.0;
	vec3 reflection = vec3(0);
	vec3 colorLinear = vec3(0);

	// diffuse shading
	if(uSSFRDiffuse) {
		// diffuse = abs(dot(n, lightDir)) * 0.5 + 0.5;
		// diffuse = abs(dot(n, lightDir));
		diffuse = max(0.0, dot(n, lightDir) * 0.5 + 0.5);

		color.xyz *= diffuse;
		output0 = vec4(color.xyz, 1.0);
	}

	// specular shading
	if(uSSFRSpecular) {
		float spec = 0.0;
		if(diffuse > 0.0) {
			vec3 viewDir = uViewDir;
			// vec3 halfDir = normalize(lightDir + viewDir);
			float specAngle = max(dot(viewDir, reflect(lightDir, n)), 0.0);
			spec = pow(specAngle, uSSFRShininess);

			if(uSSFRFresnel) {
				// Fresnel
				normalReflectance = pow(saturate(dot(n, lightDir)), uSSFRShininess);
				normalReflectance = spec;
				// Schlick's approximation
				fresnel = saturate(normalReflectance + (1.0 - normalReflectance) * pow(1.0 - abs(dot(n, uViewDir)), uSSFRFresnelExponent));
				spec = fresnel;
			}
		} 

		// Refraction
		vec3 refraction = texture(uBackgroundTexture, dir.xy*thickness*0.005 + vTextureCoord).xyz;

		// Blend edge transparency
		float transparency = thickness - 0.95;

		if(uSSFRCubemap) {
			vec3 refN = normalize(reflect(uViewDir, n));
	        reflection = texture(uCubeMapTexture, refN).xyz;
	        color.xyz += reflection*uSSFRReflection;
	        colorLinear = diffuse*color.xyz + spec*uSpecularColor;

	        if(uSSFRAbsorption) {

	        	if(uSSFRRefraction) {

	        		color.xyz = mix(color.xyz, refraction, (1.0 - color.a));

	        	}

	        	vec3 c_beer = vec3(exp(log(color.r)-0.05 * thickness),
								   exp(log(color.g)-0.05 * thickness),
								   exp(log(color.b)-0.05 * thickness));

				color.xyz = vec3(c_beer + spec * min(c_beer + 0.5, 1.0));

				colorLinear = color.xyz + spec*uSpecularColor;
	        }
	    }
	    else {
	    	vec3 refN = normalize(reflect(uViewDir, n));
	        reflection = texture(uCubeMapTexture, refN).xyz;
	    	colorLinear = diffuse*(color.xyz+reflection*fresnel) + spec*uSpecularColor;

	    	if(uSSFRAbsorption) {

	    		if(uSSFRRefraction) {

	        		color.xyz = mix(color.xyz, refraction, (1.0 - color.a));

	        	}

	        	vec3 c_beer = vec3(exp(log(color.r)-0.05 * thickness),
								   exp(log(color.g)-0.05 * thickness),
								   exp(log(color.b)-0.05 * thickness));

				color.xyz = vec3(c_beer + spec * min(c_beer + 0.5, 1.0));

				colorLinear = (color.xyz+reflection*fresnel) + spec*uSpecularColor;

	        }
	    }

		colorLinear = vec3(saturate(colorLinear.x), saturate(colorLinear.y), saturate(colorLinear.z));
		
		// gamma correction
		vec3 colorGammaCorrected = pow(colorLinear, vec3(1.0/uSSFRGamma));
		color.xyz = colorGammaCorrected;
		output0 = vec4(color.xyz, transparency);




		if(uSceneID == 1) {
			// 	/*************************
			// 	 *
			// 	 * 		WATER EFFECT
			// 	 *
			// 	 *************************/

			// thickness *= 10.0;

			vec3 c = vec3 (exp (-0.6 * thickness),
						   exp (-0.2 * thickness),
						   exp (-0.01 * thickness));

			float alpha = min (dot (c, c), 0.8);

			refraction = texture(uBackgroundTexture, dir.xy*thickness*0.005 + vTextureCoord).xyz;

			c = mix(c, refraction, 0.2);

			vec3 specular = spec * min(c + 0.5, 1.0);

			output0 = vec4(c + specular, transparency);
		}
	}

	

}



		


			
		
	//////////////////////////////////////////////////////////////////////
	//
	// From ekpyron Github:

	// vec4 color = texture(uSSFRDepthTextureArray[0], vTextureCoord);
	// output0 = color;
	// // color.xyz = vec3(vTextureCoord, 0.0); 
	
	// float thickness = texture(uSSFRThicknessTextureArray[0], vTextureCoord).x * 10.0;

	// float depth = texture(uSSFRDepthTextureArray[1], vTextureCoord).x;

	// // depthArray[i] = texture(uSSFRDepthTextureArray[i], vTextureCoord).x;
	

	// if(depth > MAXDEPTH) {
	// 	discard;
	// 	return;
	// }


	// vec3 pos = getpos (vec3 (vTextureCoord, depth));
	// vec3 eye = pos;

	// vec2 tmp;
	// tmp = vTextureCoord + vec2 (texelSizeX, 0);
	// vec3 ddx = getpos (vec3 (tmp, texture (uSSFRDepthTextureArray[1], tmp).x)) - pos;
	// tmp = vTextureCoord - vec2 (texelSizeX, 0);
	// vec3 ddx2 = pos - getpos (vec3 (tmp, texture (uSSFRDepthTextureArray[1], tmp).x));
	// if (abs (ddx.z) > abs (ddx2.z)) ddx = ddx2;

	// tmp = vTextureCoord + vec2 (0, texelSizeY);
	// vec3 ddy = getpos (vec3 (tmp, texture (uSSFRDepthTextureArray[1], tmp).x)) - pos;
	// tmp = vTextureCoord - vec2 (0, texelSizeY);
	// vec3 ddy2 = pos - getpos (vec3 (tmp, texture (uSSFRDepthTextureArray[1], tmp).x));
	// if (abs (ddy.z) < abs (ddy2.z)) ddy = ddy2;
	
	// vec3 normal = normalize (cross (ddx, ddy));

	// vec3 n = normal;



	// if(uSSFRDepth)
	// 	output0 = texture(uSSFRDepthTextureArray[1], vTextureCoord);

	// if(uSSFRNormals)
	// 	output0 = vec4(n, color.a);

	// if(uSSFRThickness) {
	// 	// scale thickness by radius so the thickness looks the same for any number of particles present in the 
	// 	// same z-range.
	// 	// less particles => larger radius => more thickness contribution per particle
	// 	// color.xyz = texture2D(uSSFRThicknessTexture, vTextureCoord).xyz*0.1;

	// 	output0 = vec4(texture(uSSFRThicknessTextureArray[0], vTextureCoord).xyz * 10.0, color.a);
	// }


	// vec3 lightDir = uLightDir-eye;
	// float lightdist = length (lightDir);
	// lightDir /= lightdist;

	// // view direction
	// vec3 viewdir = uViewDir;
	// vec3 halfvec = normalize (viewdir + lightDir);
	// float intensity;

	// // diffuse shading
	// if(uSSFRDiffuse) {
	// 	// color.xyz = colorArray[i]; 
	// 	// diffuse = abs(dot(n, lightDir)) * 0.5 + 0.5;
	// 	// diffuse = abs(dot(n, lightDir));
	// 	// float diffuse = max(0.0, dot(n, lightDir));
	// 	// color.xyz *= diffuse;

	// 	// compute light intensity as the cosine of the angle
	// 	// between light direction and normal direction
	// 	float NdotL = dot (lightDir, normal);
	// 	intensity = max (NdotL * 0.5 + 0.5, 0.0);

	// 	// apply distance attenuation and light intensity
	// 	// intensity /= lightdist * lightdist;
	// 	// intensity *= 4.0;

	// 	color.xyz *= intensity;

	// 	output0 = color;
	// }

	// // specular shading
	// if(uSSFRSpecular) {
	// 	// specular light
	// 	float k = max (dot (viewdir, reflect (-lightDir, normal)), 0.0);
	// 	k = pow (k, 8.0);

	// 	// Schlick's approximation for the fresnel term
	// 	float cos_theta = dot (viewdir, normal);
	// 	float fresnel = 0.75 + (1.0 - 0.75) * pow (1.0 - cos_theta, 5.0); 
	// 	k *= fresnel;	

	// 	// Beer-Lambert law for coloring
	// 	vec3 c = vec3 (exp (-0.5 * thickness),
	// 				   exp (-0.02 * thickness),
	// 				   exp (-0.005 * thickness));

	// 	// calculate specular color
	// 	vec3 specular = k * min (c + 0.5, 1.0);

	// 	// calculate alpha
	// 	float alpha = min (dot (c, c), 0.8);

	// 	vec3 diffuse = color.xyz;

	// 	// Environment map reflection
	// 	// vec3 dir = normalize (reflect (-viewdir, normal.xyz));
 //  //       vec3 reflection = texture (envmap, dir).xyz;
 //  //       diffuse += reflection * fresnel;


	// 	diffuse *= clamp (intensity, 0.0, 1.0);

	// 	output0 = vec4 (diffuse + specular, alpha*color.a);



		// OLD CODE
		// float lambertian = abs(dot(n, lightDir)) * 0.5 + 0.5;
		// // float lambertian = abs(dot(n, lightDir));
		// // float lambertian = max(0.0, dot(n, lightDir));
		// float spec = 0.0;
		// if(lambertian > 0.0) {
		// 	// vec3 viewDir = uViewDir;
		// 	// vec3 halfDir = normalize(lightDir + viewDir);
		// 	float specAngle = max(0.0, dot(halfvec, n));
		// 	spec = pow(specAngle, uSSFRShininess);

		// 	if(uSSFRFresnel) {
		// 		// fresnel
		// 		float normalReflectance = pow(saturate(dot(n, lightDir)), uSSFRShininess);
		// 		// Schlick's approximation
		// 		spec = saturate(normalReflectance + (1.0 - normalReflectance) * pow(1.0 - abs(dot(n, uViewDir)), uSSFRFresnelExponent));
		// 		// spec = saturate(spec);
		// 	}
		// } 

		// vec3 colorLinear = uAmbientColor + lambertian*color.xyz + spec*uSpecularColor;
		// colorLinear = vec3(saturate(colorLinear.x), saturate(colorLinear.y), saturate(colorLinear.z));
		
		// // gamma correction
		// vec3 colorGammaCorrected = pow(colorLinear, vec3(1.0/GAMMA));
		// color.xyz = colorGammaCorrected;
		// output0 = color;

		// if(uSSFRAbsorption) {
		// 	// Beer's law
		// 	vec4 c_beer = vec4(exp(-0.6*thickness), // almost no red
		// 		exp(-0.2*thickness), // leave a bit of green
		// 		exp(-0.01*thickness), // leave most of blue
		// 		// saturate(1.0-exp(-3.0*thickness) * uSSFRTransparency)
		// 		saturate(1.0-exp(-3.0*thickness) + uSSFRTransparency)
		// 		// thickness
		// 	);


		// 	color = vec4(lambertian*color.xyz, color.a) * c_beer;

		// 	color.xyz = uAmbientColor + lambertian*color.xyz + spec*uSpecularColor*saturate(thickness);
		// 	color.xyz = vec3(saturate(color.x), saturate(color.y), saturate(color.z));

		// 	// Gamma correction
		// 	color.xyz = pow(color.xyz, vec3(1.0/GAMMA));

		// 	output0 = color;

		// }
				
	// }
