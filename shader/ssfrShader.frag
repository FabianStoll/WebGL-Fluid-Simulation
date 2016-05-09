#version 300 es

// Fragment Shader for SSFR calculation

precision highp float;

////////////////////////////
// uniforms:
uniform sampler2D uSSFRDepthTexture;
uniform sampler2D uSSFRDepthTextureBlurX;
uniform sampler2D uSSFRDepthTextureBlurY;
uniform sampler2D uSSFRRefractionTextureBlurY;
uniform sampler2D uParticleColorTex;
uniform sampler2D uRefractionColorTex;
uniform sampler2D uRefractionDepthTex;
uniform sampler2D uSSFRThicknessTexture;
uniform sampler2D uBackgroundTexture;

uniform samplerCube uCubeMapTexture;

uniform mat4 uCameraMatrix;

uniform vec2 uResolution;

uniform vec3 uLightDir;
uniform vec3 uViewDir;
uniform vec3 uSpecularColor;

uniform float uSSFRTransparency;
uniform float uSSFRShininess;
uniform float uSSFRFresnelExponent;
uniform float uSSFRReflection;
uniform float uSSFRGamma;

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

// constants:
const float MAXDEPTH = 0.97;

// Saturate a single value
float saturate(in float x) {
	return max(0.0, min(x, 1.0));
}

// Saturate a vec3
vec3 saturate3(in vec3 v) {
	return vec3(max(0.0, min(v.x, 1.0)), max(0.0, min(v.y, 1.0)), max(0.0, min(v.z, 1.0)));
}

// Get the pixel position from the texture coordinates and the depth
// Input vec3 p = (texCoord.x, texCoord.y, depth)
vec3 getPos(in vec3 p) {
	// Transform the values back from screen space to world space
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

	// Define the horizontal and vertical texel sizes
	float texelSizeX = 1.0 / uResolution.x;
	float texelSizeY = 1.0 / uResolution.y;

	float diffuse = 0.0;
	float diffuse2 = 0.0;

	// Get the thickness from the thickness texture
	float thickness = texture(uSSFRThicknessTexture, vTextureCoord).x;
	thickness = max(thickness, 1.0);

	// Get the depth from the depth texture
	float depth = texture(uSSFRDepthTexture, vTextureCoord).x;

	// Don't compute anything if the pixel does not contain a fluid
	if(depth >= MAXDEPTH) {
		discard;
		return;
	}

	// Get the bilateral blurred depth value
	depth = texture(uSSFRDepthTextureBlurY, vTextureCoord).x;

	// Get the position of the fluid surface pixel
	vec3 pos = getPos(vec3(vTextureCoord, depth));
	vec3 eye = pos;

	// Compute the normal by getting the neighbouring pixel positions (in x- and y-direction)
	vec2 tmp;
	tmp = vTextureCoord + vec2 (texelSizeX, 0);
	vec3 ddx = getPos(vec3(tmp, texture (uSSFRDepthTextureBlurY, tmp).x)) - pos;
	tmp = vTextureCoord - vec2(texelSizeX, 0);
	vec3 ddx2 = pos - getPos(vec3 (tmp, texture(uSSFRDepthTextureBlurY, tmp).x));
	if(abs(ddx.z) > abs(ddx2.z)) 
		ddx = ddx2;

	tmp = vTextureCoord + vec2(0, texelSizeY);
	vec3 ddy = getPos(vec3(tmp, texture (uSSFRDepthTextureBlurY, tmp).x)) - pos;
	tmp = vTextureCoord - vec2(0, texelSizeY);
	vec3 ddy2 = pos - getPos(vec3 (tmp, texture(uSSFRDepthTextureBlurY, tmp).x));
	if(abs(ddy.z) < abs(ddy2.z)) 
		ddy = ddy2;
	
	vec3 n = normalize(cross(ddx, ddy));

	vec3 dir = normalize(reflect(-uViewDir, n));

	// Do the same for the refraction layer
	float depthRefraction = texture(uSSFRRefractionTextureBlurY, vTextureCoord).x;
	vec3 pos2 = getPos(vec3(vTextureCoord, depthRefraction));

	tmp = vTextureCoord + vec2(texelSizeX, 0);
	ddx = getPos(vec3(tmp, texture(uSSFRRefractionTextureBlurY, tmp).x)) - pos2;
	tmp = vTextureCoord - vec2(texelSizeX, 0);
	ddx2 = pos2 - getPos(vec3(tmp, texture(uSSFRRefractionTextureBlurY, tmp).x));
	if (abs(ddx.z) > abs(ddx2.z)) 
		ddx = ddx2;

	tmp = vTextureCoord + vec2(0, texelSizeY);
	ddy = getPos(vec3(tmp, texture(uSSFRRefractionTextureBlurY, tmp).x)) - pos2;
	tmp = vTextureCoord - vec2(0, texelSizeY);
	ddy2 = pos2 - getPos(vec3(tmp, texture(uSSFRRefractionTextureBlurY, tmp).x));
	if(abs(ddy.z) < abs(ddy2.z))
		ddy = ddy2;
	
	vec3 n2 = normalize(cross(ddx, ddy));

	vec3 dir2 = normalize(reflect(-uViewDir, n2));


	vec4 color = vec4(0);
	vec4 colorRefraction = vec4(0);

	// Get the fluid color at the pixel and the refracted fluid color
	color = texture(uParticleColorTex, vTextureCoord);
	colorRefraction = texture(uRefractionColorTex, dir2.xy*thickness*0.001 + vTextureCoord);

	// Render particles as spheres
	if(uShowParticles) {
		output0 = vec4(color.xyz, 1.0);
		return;
	}

	output0 = vec4(color.xyz, 1.0);

	// Draw the depth
	if(uSSFRDepth)
		output0 = texture(uSSFRDepthTexture, vTextureCoord);
		
	// Draw the blurred depth
	if(uSSFRBlur)
		output0 = texture(uSSFRDepthTextureBlurY, vTextureCoord);

	// Draw the computed normales
	if(uSSFRNormals)
		output0 = vec4(n, 1.0);

	// Draw the thickness
	if(uSSFRThickness) 
		output0 = texture(uSSFRThicknessTexture, vTextureCoord);


	vec3 lightDir = normalize(uLightDir-eye);
	float fresnel = 0.0;
	float normalReflectance = 0.0;
	vec3 reflection = vec3(0);
	vec3 colorLinear = vec3(0);


	// Compute the local illumination:

	// Diffuse shading
	if(uSSFRDiffuse) {
		// Fluid surface
		diffuse = max(0.0, dot(n, lightDir) * 0.5 + 0.5);
		color.xyz *= diffuse;
		output0 = vec4(color.xyz, 1.0);
		// Refraction layer
		diffuse2 = max(0.0, dot(n2, lightDir) * 0.5 + 0.5);
		colorRefraction.xyz *= diffuse;
	}

	// Specular shading
	if(uSSFRSpecular) {
		float spec = 0.0;
		float spec2 = 0.0;
		if(diffuse > 0.0) {
			vec3 viewDir = uViewDir;
			float specAngle = max(dot(viewDir, reflect(lightDir, n)), 0.0);
			spec = pow(specAngle, uSSFRShininess);

			// Fresnel reflectance
			if(uSSFRFresnel) {
				normalReflectance = pow(saturate(dot(n, lightDir)), uSSFRShininess);
				normalReflectance = spec;
				// Schlick's approximation
				fresnel = saturate(normalReflectance + (1.0 - normalReflectance) * pow(1.0 - abs(dot(n, uViewDir)), uSSFRFresnelExponent));
				spec = fresnel;
			}
		} 

		// Apply diffuse shading to the refraction layer and scale it to consider absorption
		colorRefraction.xyz = diffuse2*colorRefraction.xyz*2.0;

		// Refraction of the background image
		vec3 refraction = texture(uBackgroundTexture, dir.xy*thickness*0.005 + vTextureCoord).xyz;
		// Mix background refraction with refraction layer
		refraction = mix(refraction, colorRefraction.xyz, colorRefraction.a);

		// Blend edge transparency
		float transparency = thickness - 0.95;

		// Cubemap reflection
		if(uSSFRCubemap) {
			vec3 refN = normalize(reflect(uViewDir, n));
	        reflection = texture(uCubeMapTexture, refN).xyz;
	        color.xyz += reflection*uSSFRReflection;
	        colorLinear = diffuse*color.xyz + spec*uSpecularColor;

	        if(uSSFRAbsorption) {
	        	if(uSSFRRefraction) {
	        		// Mix refraction depending on the fluid's alpha value
	        		color.xyz = mix(color.xyz, refraction, (1.0 - color.a));
	        	}

	        	// Beer's law for volumetric absorption
	        	vec3 c_beer = vec3(exp(log(color.r)-0.05 * thickness),
								   exp(log(color.g)-0.05 * thickness),
								   exp(log(color.b)-0.05 * thickness));

				color.xyz = vec3(c_beer + spec * min(c_beer + 0.5, 1.0));

				colorLinear = color.xyz + spec*uSpecularColor;
	        }
	    }
	    else { // No cubemap reflection
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
		
		// Gamma correction
		vec3 colorGammaCorrected = pow(colorLinear, vec3(1.0/uSSFRGamma));
		color.xyz = colorGammaCorrected;
		output0 = vec4(color.xyz, transparency);

		// Water shader
		if(uSceneID == 1) {
			// 	/*************************
			// 	 *
			// 	 * 		WATER EFFECT
			// 	 *
			// 	 *************************/

			// Special values for water appearance
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