/**********************

	Scene Class
	
************************/


/**
 * Scene Class Constructor
 * 
 */
function Scene() {
    /**     
     * If you need to use WebGL extensions, assign them here
     */
	// Enable color buffer float extension for WebGL 2.0 
	// This enables color attachments with float values for framebuffers 
	// this.colorBufferFloatExt = gl.getExtension("WEBGL_color_buffer_float");
	// if(!this.colorBufferFloatExt) {
	// 	console.log("WEBGL_color_buffer_float not available!");
	// 	return;
	// }
	
    // enable float extension
    this.floatTextureExt = gl.getExtension("OES_texture_float"); 
    if(!this.floatTextureExt) { 
      console.log("OES_texture_float Extension not available!");
      return;
    }
    
    this.m_cubeMapTexture = this.loadCubeMap("standard"); // Load cubemap from image source
    this.m_sceneCamera; // Camera object
    this.m_particleVelocityArray = new Array(); // Array for velocity storage
    this.m_particleSystem;  // Particle system
    this.m_particlePosData = new Float32Array();    // Particle position data
    this.m_particleColorData = new Float32Array();  // Color data
    this.m_textureSize; // Maximum texture size for particle storage
    this.m_pointSize;   // Particle point size
    this.m_gravity; // Gravity in y direction
    this.m_kernelRadius;    // Smoothing kernel radius for SPH
    this.m_colorMixRadius;  // Kernel radius for color mixing
    this.m_restDensity; // Rest density of the fluid
    this.m_tensileInstability;  // Tensile instability (SPH)
    this.m_lambdaCorrection;    // Constraint relaxation (SPH surface tension)
    this.m_viscosity;   // SPH Viscosity
    this.m_vorticity;   // SPH Vorticity (not enabled)
    this.m_nvidia;  // Boolean for AMD/NVIDIA compatibility
    this.m_collResponse;    // For wall collision response activation
    this.m_timeStep = 0.0;  // Time step
    this.m_sceneID = 0; // ID for scene loading

    // For readPixels() evaluation
    this.m_readPositionsTime;
    this.m_readColorsTime;

    // SSFR passes (self explanatory)
    this.m_showParticles = false;
    this.m_ssfrDepth = false;
    this.m_ssfrNormals = false;
    this.m_ssfrBlur = false;
    this.m_ssfrDiffuse = false;
    this.m_ssfrSpecular = false;
    this.m_ssfrFresnel = false;
    this.m_ssfrCubemap = false;
    this.m_ssfrThickness = false;
    this.m_ssfrAbsorption = false;
    this.m_ssfrRefraction = false;
    this.m_ssfrReflection;
    this.m_ssfrGamma;
    this.m_ssfrTransparency;
    this.m_ssfrShininess;
    this.m_ssfrFresnelExponent;
    this.m_ssfrColorLayer;
    this.m_ssfrThicknessValue;
    this.m_disableColorMixing = false;

    this.m_blurSigma = 1; // For bilateral blur

    this.m_binningOutput = new Array(2); // For binning computation output

    // Scene colors
    this.m_fluidColor;
    this.m_specularColor;
    this.m_ambientColor;
    this.m_particleColor;

    var start, end;

    // Get all uniform locations in advance
    if(this.m_shader) {
        this.getUniformLocations();
    }

    console.log("WebGL 3D Scene initialized.");
}



/**
 * Method to set one particle system for the current scene
 * @param {ParticleSystem} particleSystem
 */
Scene.prototype.setParticleSystem = function(particleSystem) {
    this.m_particleSystem = particleSystem;
    this.m_textureSize = particleSystem.getTextureSize();
    
    // Initialize the particle textures for GPU storage
    this.initParticleTextures();
    
    // Initialize framebuffer
    this.initFramebuffer();
};


/**
 * Method to set a shader for rendering
 * @param {WebGLShader} Shader 
 */
Scene.prototype.setShader = function(Shader) {
    this.m_shader = Shader;
    this.getUniformLocations();
};

/**
 * Method to set a camera to view the scene
 * @param {Camera} Camera The camera object, created with 'camera.js'
 */
Scene.prototype.setCamera = function(Camera) {
    this.m_sceneCamera = Camera;
};


/**
 * Method to get all needed locations of uniform variables in the shader
 * This is done once with the scene creation and everytime a shader is loaded
 */
Scene.prototype.getUniformLocations = function() {
    // TODO: remove unused locations
    this.m_uLocationPERSPECTIVEMAT = gl.getUniformLocation(this.m_shader.m_program, "uPerspectiveMatrix");
    this.m_uLocationMODELMAT = gl.getUniformLocation(this.m_shader.m_program, "uModelMatrix");
    this.m_uLocationCAMERAMAT = gl.getUniformLocation(this.m_shader.m_program, "uCameraMatrix");
    this.m_uLocationCAMERAPOS = gl.getUniformLocation(this.m_shader.m_program, "uCameraPos");
    this.m_uLocationVIEWDIR = gl.getUniformLocation(this.m_shader.m_program, "uViewDir");
    this.m_uLocationRESOLUTION = gl.getUniformLocation(this.m_shader.m_program, "uResolution");
    this.m_uLocationEMITTING = gl.getUniformLocation(this.m_shader.m_program, "uEmitting");
    this.m_uLocationBACKGROUNDTEX = gl.getUniformLocation(this.m_shader.m_program, "uBackgroundTexture");
    this.m_uLocationPARTICLEPOSTEX = gl.getUniformLocation(this.m_shader.m_program, "uParticlePosTex");
    this.m_uLocationPARTICLEVELTEX = gl.getUniformLocation(this.m_shader.m_program, "uParticleVelTex");
    this.m_uLocationPARTICLEPOSOLDTEX = gl.getUniformLocation(this.m_shader.m_program, "uParticlePosOldTex");
    // this.m_uLocationVORTICITYTEX = gl.getUniformLocation(this.m_shader.m_program, "uVorticityTex");
    this.m_uLocationLAMBDATEX = gl.getUniformLocation(this.m_shader.m_program, "uLambdaTex");
    this.m_uLocationPARTICLEPOSTEXNEW = gl.getUniformLocation(this.m_shader.m_program, "uParticlePosTexNew");
    this.m_uLocationPARTICLEVELTEXNEW = gl.getUniformLocation(this.m_shader.m_program, "uParticleVelTexNew");
    this.m_uLocationBINIDTEX = gl.getUniformLocation(this.m_shader.m_program, "uBinIDTex");
    this.m_uLocationBIN3DTEX = gl.getUniformLocation(this.m_shader.m_program, "uBin3DTex");
    this.m_uLocationTEXTURESIZE = gl.getUniformLocation(this.m_shader.m_program, "uTextureSize");
    this.m_uLocationGRAVITY = gl.getUniformLocation(this.m_shader.m_program, "uGravity");
    this.m_uLocationEXITVELOCITY = gl.getUniformLocation(this.m_shader.m_program, "uExitVelocity");
    this.m_uLocationTIME = gl.getUniformLocation(this.m_shader.m_program, "uTime");
    this.m_uLocationPOINTSIZE = gl.getUniformLocation(this.m_shader.m_program, "uPointSize");
    this.m_uLocationKERNELRADIUS = gl.getUniformLocation(this.m_shader.m_program, "uKernelRadius");
    this.m_uLocationCOLORMIXRADIUS = gl.getUniformLocation(this.m_shader.m_program, "uColorMixRadius");
    this.m_uLocationSCENEID = gl.getUniformLocation(this.m_shader.m_program, "uSceneID");
    this.m_uLocationRESTDENSITY = gl.getUniformLocation(this.m_shader.m_program, "uRestDensity");
    this.m_uLocationTENSILEINSTABILITY = gl.getUniformLocation(this.m_shader.m_program, "uTensileInstability");
    this.m_uLocationLAMBDACORRECTION = gl.getUniformLocation(this.m_shader.m_program, "uLambdaCorrection");
    this.m_uLocationVISCOSITY = gl.getUniformLocation(this.m_shader.m_program, "uViscosity");
    // this.m_uLocationVORTICITY = gl.getUniformLocation(this.m_shader.m_program, "uVorticity");
    this.m_uLocationNVIDIA = gl.getUniformLocation(this.m_shader.m_program, "uNvidia");
    this.m_uLocationCOLLRESPONSE = gl.getUniformLocation(this.m_shader.m_program, "uCollisionResponse");
    this.m_uLocationLIGHTDIR = gl.getUniformLocation(this.m_shader.m_program, "uLightDir");
    this.m_uLocationBOUNDINGBOX = gl.getUniformLocation(this.m_shader.m_program, "uBoundingBox");
    this.m_uLocationBINCOUNTVEC = gl.getUniformLocation(this.m_shader.m_program, "uBinCountVec");
    this.m_uLocationSSFRDEPTH = gl.getUniformLocation(this.m_shader.m_program, "uSSFRDepth");
    this.m_uLocationSSFRDEPTHTEXTURE = gl.getUniformLocation(this.m_shader.m_program, "uSSFRDepthTexture");
    this.m_uLocationSSFRDEPTHTEXTUREBLURX = gl.getUniformLocation(this.m_shader.m_program, "uSSFRDepthTextureBlurX");
    this.m_uLocationSSFRDEPTHTEXTUREBLURY = gl.getUniformLocation(this.m_shader.m_program, "uSSFRDepthTextureBlurY");
    this.m_uLocationSSFRREFRACTIONTEXTUREBLURX = gl.getUniformLocation(this.m_shader.m_program, "uSSFRRefractionTextureBlurX");
    this.m_uLocationSSFRREFRACTIONTEXTUREBLURY = gl.getUniformLocation(this.m_shader.m_program, "uSSFRRefractionTextureBlurY");
    this.m_uLocationSSFRTHICKNESSTEXTURE = gl.getUniformLocation(this.m_shader.m_program, "uSSFRThicknessTexture");
    this.m_uLocationCUBEMAPTEXTURE = gl.getUniformLocation(this.m_shader.m_program, "uCubeMapTexture");

    this.m_uLocationDISABLEMIXING = gl.getUniformLocation(this.m_shader.m_program, "uDisableColorMixing");
    this.m_uLocationSHOWPARTICLES = gl.getUniformLocation(this.m_shader.m_program, "uShowParticles");
    this.m_uLocationSSFRNORMALS = gl.getUniformLocation(this.m_shader.m_program, "uSSFRNormals");
    this.m_uLocationSSFRBLUR = gl.getUniformLocation(this.m_shader.m_program, "uSSFRBlur");
    this.m_uLocationSSFRDIFFUSE = gl.getUniformLocation(this.m_shader.m_program, "uSSFRDiffuse");
    this.m_uLocationSSFRSPECULAR = gl.getUniformLocation(this.m_shader.m_program, "uSSFRSpecular");
    this.m_uLocationSSFRFRESNEL = gl.getUniformLocation(this.m_shader.m_program, "uSSFRFresnel");
    this.m_uLocationSSFRCUBEMAP = gl.getUniformLocation(this.m_shader.m_program, "uSSFRCubemap");
    this.m_uLocationSSFRTHICKNESS = gl.getUniformLocation(this.m_shader.m_program, "uSSFRThickness");
    this.m_uLocationSSFRABSORPTION = gl.getUniformLocation(this.m_shader.m_program, "uSSFRAbsorption");
    this.m_uLocationSSFRREFRACTION = gl.getUniformLocation(this.m_shader.m_program, "uSSFRRefraction");
    this.m_uLocationSSFRTRANSPARENCY = gl.getUniformLocation(this.m_shader.m_program, "uSSFRTransparency");
    this.m_uLocationSSFRSHININESS = gl.getUniformLocation(this.m_shader.m_program, "uSSFRShininess");
    this.m_uLocationSSFRFRESNELEXPONENT = gl.getUniformLocation(this.m_shader.m_program, "uSSFRFresnelExponent");
    this.m_uLocationSSFRREFLECTION = gl.getUniformLocation(this.m_shader.m_program, "uSSFRReflection");
    this.m_uLocationSSFRGAMMA = gl.getUniformLocation(this.m_shader.m_program, "uSSFRGamma");
    this.m_uLocationSSFRCOLORLAYER = gl.getUniformLocation(this.m_shader.m_program, "uSSFRColorLayer");
    this.m_uLocationBLURSIGMA = gl.getUniformLocation(this.m_shader.m_program, "uBlurSigma");
    this.m_uLocationSSFRTHICKNESSVALUE = gl.getUniformLocation(this.m_shader.m_program, "uThicknessValue");
    // this.m_uLocationFLUIDCOLOR = gl.getUniformLocation(this.m_shader.m_program, "uFluidColor");
    // this.m_uLocationAMBIENTCOLOR = gl.getUniformLocation(this.m_shader.m_program, "uAmbientColor");
    this.m_uLocationSPECULARCOLOR = gl.getUniformLocation(this.m_shader.m_program, "uSpecularColor");
    this.m_uLocationPARTICLECOLOR = gl.getUniformLocation(this.m_shader.m_program, "uParticleColor");

    this.m_uLocationPARTICLECOLORTEX = gl.getUniformLocation(this.m_shader.m_program, "uParticleColorTex");
    this.m_uLocationPARTICLEDEPTHTEX = gl.getUniformLocation(this.m_shader.m_program, "uParticleDepthTex");
    this.m_uLocationREFRACTIONCOLORTEX = gl.getUniformLocation(this.m_shader.m_program, "uRefractionColorTex");
    this.m_uLocationREFRACTIONDEPTHTEX = gl.getUniformLocation(this.m_shader.m_program, "uRefractionDepthTex");
};


/**
 * This method passes all relevant uniforms to the current shader
 */
Scene.prototype.passUniforms = function() {

	this.m_sceneCamera.update();
	
	// Pass the perspective matrix (or projection matrix)
    gl.uniformMatrix4fv(this.m_uLocationPERSPECTIVEMAT, false, new Float32Array(this.m_sceneCamera.m_perspectiveMatrix));

    // Pass the model matrix
    gl.uniformMatrix4fv(this.m_uLocationMODELMAT, false, new Float32Array(mat4.create()));

    // Pass the camera matrix
    gl.uniformMatrix4fv(this.m_uLocationCAMERAMAT, false, new Float32Array(this.m_sceneCamera.m_viewMatrix));
    
    // Pass the camera position
    var _camPos = this.m_sceneCamera.m_position;
    gl.uniform3f(this.m_uLocationCAMERAPOS, parseFloat(_camPos[0]), parseFloat(_camPos[1]), parseFloat(_camPos[2]));
    
    // Pass the view direction
    var _view = this.m_sceneCamera.m_viewDirection;
    gl.uniform3f(this.m_uLocationVIEWDIR, parseFloat(_view[0]), parseFloat(_view[1]), parseFloat(_view[2]));
    
    // Pass the canvas resolution
    var _resolution = [canvas.width, canvas.height];
    gl.uniform2fv(this.m_uLocationRESOLUTION, new Float32Array(_resolution));
    
    // Pass the texture size (defines maximum particle number)
    gl.uniform1f(this.m_uLocationTEXTURESIZE, this.m_textureSize);
    
    // Pass the emitting boolean
    var _emitting = this.m_particleSystem.getEmitter().m_emitting;
    gl.uniform1i(this.m_uLocationEMITTING, _emitting);
    
    // Pass the exit velocity of the emitter
    var _exitVel = this.m_particleSystem.getEmitter().m_exitVelocity;
    gl.uniform3f(this.m_uLocationEXITVELOCITY, _exitVel[0], _exitVel[1], _exitVel[2]);
    
    // Pass the time in milliseconds
    gl.uniform1f(this.m_uLocationTIME, this.m_timeStep);
    
    // Pass the point size from the GUI
    gl.uniform1f(this.m_uLocationPOINTSIZE, this.m_pointSize);

    // Pass the gravity value (y-axis)
    gl.uniform1f(this.m_uLocationGRAVITY, this.m_gravity);
    
    // Pass the smoothing and color kernel radius
    gl.uniform1f(this.m_uLocationKERNELRADIUS, this.m_kernelRadius);
    gl.uniform1f(this.m_uLocationCOLORMIXRADIUS, this.m_colorMixRadius);
    
    // Pass the rest density of the fluid and other PBF parameters
    gl.uniform1f(this.m_uLocationRESTDENSITY, this.m_restDensity);
    gl.uniform1f(this.m_uLocationTENSILEINSTABILITY, this.m_tensileInstability);
    gl.uniform1f(this.m_uLocationLAMBDACORRECTION, this.m_lambdaCorrection);
    gl.uniform1f(this.m_uLocationVISCOSITY, this.m_viscosity);
    // gl.uniform1f(this.m_uLocationVORTICITY, this.m_vorticity);

    gl.uniform1i(this.m_uLocationNVIDIA, this.m_nvidia);
    gl.uniform1i(this.m_uLocationCOLLRESPONSE, this.m_collResponse);
    gl.uniform1i(this.m_uLocationSCENEID, this.m_sceneID);
    
    // Pass the light direction from the GUI
    gl.uniform3f(this.m_uLocationLIGHTDIR, this.m_lightPos[0], this.m_lightPos[1], this.m_lightPos[2]);
    
    // Pass the bounding box information
    var _bBox = new Array(this.m_particleSystem.m_boundingBox.m_position[0],
    		this.m_particleSystem.m_boundingBox.m_position[1],
    		this.m_particleSystem.m_boundingBox.m_position[2],
    		this.m_particleSystem.m_boundingBox.m_xMin,
    		this.m_particleSystem.m_boundingBox.m_xMax,
    		this.m_particleSystem.m_boundingBox.m_yMin,
    		this.m_particleSystem.m_boundingBox.m_yMax,
    		this.m_particleSystem.m_boundingBox.m_zMin,
    		this.m_particleSystem.m_boundingBox.m_zMax);
    gl.uniform1fv(this.m_uLocationBOUNDINGBOX, _bBox);
    
    // Pass the bin count information
    gl.uniform3f(this.m_uLocationBINCOUNTVEC, 
    		this.m_particleSystem.m_xBinCount,
    		this.m_particleSystem.m_yBinCount,
    		this.m_particleSystem.m_zBinCount);
    
    // SSFR render pass information
    gl.uniform1i(this.m_uLocationDISABLEMIXING, this.m_disableColorMixing);
    gl.uniform1i(this.m_uLocationSHOWPARTICLES, this.m_showParticles);
    gl.uniform1i(this.m_uLocationSSFRDEPTH, this.m_ssfrDepth);
    gl.uniform1i(this.m_uLocationSSFRNORMALS, this.m_ssfrNormals);
    gl.uniform1i(this.m_uLocationSSFRBLUR, this.m_ssfrBlur);
    gl.uniform1i(this.m_uLocationSSFRDIFFUSE, this.m_ssfrDiffuse);
    gl.uniform1i(this.m_uLocationSSFRSPECULAR, this.m_ssfrSpecular);
    gl.uniform1i(this.m_uLocationSSFRCUBEMAP, this.m_ssfrCubemap);
    gl.uniform1i(this.m_uLocationSSFRFRESNEL, this.m_ssfrFresnel);
    gl.uniform1i(this.m_uLocationSSFRTHICKNESS, this.m_ssfrThickness);
    gl.uniform1i(this.m_uLocationSSFRABSORPTION, this.m_ssfrAbsorption);
    gl.uniform1i(this.m_uLocationSSFRREFRACTION, this.m_ssfrRefraction);
    gl.uniform1f(this.m_uLocationSSFRTRANSPARENCY, this.m_ssfrTransparency);
    gl.uniform1f(this.m_uLocationSSFRSHININESS, this.m_ssfrShininess);
    gl.uniform1f(this.m_uLocationSSFRFRESNELEXPONENT, this.m_ssfrFresnelExponent);
    gl.uniform1f(this.m_uLocationSSFRREFLECTION, this.m_ssfrReflection);
    gl.uniform1f(this.m_uLocationSSFRGAMMA, this.m_ssfrGamma);
    gl.uniform1i(this.m_uLocationSSFRCOLORLAYER, this.m_ssfrColorLayer);
    gl.uniform1f(this.m_uLocationBLURSIGMA, this.m_blurSigma);
    gl.uniform1f(this.m_uLocationSSFRTHICKNESSVALUE, this.m_ssfrThicknessValue);
    
    // Pass the fluid color properties
    gl.uniform3f(this.m_uLocationSPECULARCOLOR, this.m_specularColor[0], this.m_specularColor[1], this.m_specularColor[2]);
    gl.uniform3f(this.m_uLocationPARTICLECOLOR, this.m_particleColor[0], this.m_particleColor[1], this.m_particleColor[2]);

};



/**
 * This method creates a texture that can be used
 * as a color attachment for a framebuffer
 * @param {Float} width The width of the texture
 * @param {Float} height The height of the texture
 * @param {GL_Color_Format} format The color format of the texture
 * @param {GL_Data_Type] type The type of the pixel data
 * @param {Float32Array} pixels The pixel data
 * @returns {WebGLTexture} WebGL Texture
 */
Scene.prototype.createTexture = function(width, height, format, type, pixels, filtering) {
    var _texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, _texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, pixels);
    return _texture;
};


/**
 * Initialize the textures for particle storage
 */
Scene.prototype.initParticleTextures = function() {
	_blankArray = new Float32Array(this.m_textureSize * this.m_textureSize * 4);
	_blankArraySmall = new Float32Array(this.m_textureSize * this.m_textureSize);
	_blank3DArray = new Float32Array(this.m_particleSystem.m_xBinCount*this.m_particleSystem.m_yBinCount*this.m_particleSystem.m_zBinCount*4);

    // Background texture
    this.m_backgroundTexture = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
	
	// Create the particle-position and -velocity textures
    // For particle positions
	this.m_particlePosTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
    // For positions after linear physics calculation
    this.m_particlePosLinearTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
    // For positions after constraint calculation
    this.m_particlePosConstraintTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
    // For particle velocity
	this.m_particleVelTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
    // For particle velocity after linear calculation
    this.m_particleVelLinearTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
    // For velocity after constraint calculation
    this.m_particleVelConstraintTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
    // For vorticity (disabled)
    this.m_particleVelVorticityTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
    // For positions of previous frame
	this.m_particlePosOldTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
    // Vorticity (disabled)
    // this.m_vorticityTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
    // Particle colors
    this.m_particleColorTex = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);
	// PBF lambda texture
	this.m_lambdaTexture = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, _blankArray, gl.NEAREST);	
	// SSFR depth texture
	this.m_ssfrDepthTexture = this.createTexture(canvas.width, canvas.height, gl.DEPTH_COMPONENT, gl.FLOAT, null, gl.LINEAR);
    // Output textures from particle render
    this.m_ssfrParticleColor = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
    this.m_ssfrParticleDepth = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
    // Output textures from refraction render
    this.m_ssfrRefractionColor = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
    this.m_ssfrRefractionDepth = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
    // Blurred depth textures
    this.m_ssfrDepthTextureBlurX = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
    this.m_ssfrDepthTextureBlurY = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
    this.m_ssfrRefractionTextureBlurX = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
    this.m_ssfrRefractionTextureBlurY = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
	// SSFR thickness textures
    this.m_ssfrThicknessTexture = this.createTexture(canvas.width, canvas.height, gl.RGBA, gl.FLOAT, null, gl.LINEAR);
	
	// Bin textures
	this.m_binIDTexture = this.createTexture(this.m_textureSize, this.m_textureSize, gl.RED, gl.FLOAT, _blankArraySmall, gl.NEAREST);
	
	// 3D texture to store bins
	this.m_bin3DTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_3D, this.m_bin3DTexture);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, this.m_particleSystem.m_xBinCount, this.m_particleSystem.m_yBinCount, this.m_particleSystem.m_zBinCount, 0, gl.RGBA, gl.FLOAT, _blank3DArray);

};



/**
 * Initialize all framebuffers
 */
Scene.prototype.initFramebuffer = function() {
	
	// Create a framebuffer
    this.m_framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebuffer);
    this.m_framebuffer.width = canvas.width;
    this.m_framebuffer.height = canvas.height;
    
    // FOLLOWING CODE ONLY FOR WEBGL 2.0 WITH FLOAT_BUFFERS EXTENSION
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_particlePosTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_particleVelTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.m_particlePosOldTex, 0);
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // PBOs (NOT WORKING IN CURRENT NIGHTLY BUILDS)
    // this.m_pboPositions = gl.createBuffer();
    // gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.m_pboPositions);
    // var _pboSize = this.m_textureSize * this.m_textureSize * 4;
    // gl.bufferData(gl.PIXEL_PACK_BUFFER, _pboSize, gl.STREAM_READ);
    // gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    
    // Initialize SSFR depth buffer
    this.m_framebufferParticlesSSFR = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferParticlesSSFR);
    this.m_framebufferParticlesSSFR.width = canvas.width;
    this.m_framebufferParticlesSSFR.height = canvas.height;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_ssfrParticleColor, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_ssfrParticleDepth, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.m_ssfrDepthTexture, 0);
    // Render buffer
    this.m_renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.m_renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.m_framebufferParticlesSSFR.width, this.m_framebufferParticlesSSFR.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.m_renderbuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // MCSSFR Refraction Layer
    this.m_framebufferRefractionSSFR = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferRefractionSSFR);
    this.m_framebufferRefractionSSFR.width = canvas.width;
    this.m_framebufferRefractionSSFR.height = canvas.height;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_ssfrRefractionColor, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_ssfrRefractionDepth, 0);

    this.m_renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.m_renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.m_framebufferRefractionSSFR.width, this.m_framebufferRefractionSSFR.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.m_renderbuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    // Thickness
    this.m_framebufferThicknessSSFR = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferThicknessSSFR);
    this.m_framebufferThicknessSSFR.width = canvas.width;
    this.m_framebufferThicknessSSFR.height = canvas.height;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_ssfrThicknessTexture, 0);

    this.m_renderbufferThickness = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.m_renderbufferThickness);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.m_framebufferThicknessSSFR.width, this.m_framebufferThicknessSSFR.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.m_renderbufferThickness);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Background render
    this.m_framebufferBackground = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferBackground);
    this.m_framebufferBackground.width = canvas.width;
    this.m_framebufferBackground.height = canvas.height;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_backgroundTexture, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};



/*****************************************************************************************
 *
 * Functions for physical fluid simulation
 * The methods are based on "Position Based Fluids" by Miles Macklin and Matthias Müller
 *
 *****************************************************************************************
 */


/**
 * Method to compute the particle simulation
 * It packs the JavaScript particle array in a texture and passes that texture to the shader
 * for further parallel computations
 *
 * Shader: particleCalculations.frag
 */
Scene.prototype.solveLinearCalculations = function() {
    this.m_timeStep = getTimestep();

    // If there is a particle system AND the emitter is emitting new particles, send the particles to the shader
    if(this.m_particleSystem.getParticleArray().length > 0) { // && this.m_particleSystem.getEmitter().m_emitting) {
        this.particlesToShader(false);
    }
    
    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebuffer);
    
    // OLD CODE FOR WEBGL 1.0
//    gl.framebufferTexture2D(gl.FRAMEBUFFER, this.drawBufferExt.COLOR_ATTACHMENT0_WEBGL, gl.TEXTURE_2D, this.m_particlePosTex, 0);
//  gl.framebufferTexture2D(gl.FRAMEBUFFER, this.drawBufferExt.COLOR_ATTACHMENT1_WEBGL, gl.TEXTURE_2D, this.m_particleVelTex, 0);
//  gl.framebufferTexture2D(gl.FRAMEBUFFER, this.drawBufferExt.COLOR_ATTACHMENT2_WEBGL, gl.TEXTURE_2D, this.m_particleVisTex, 0);
//  
//  // draw the buffers
//  this.drawBufferExt.drawBuffersWEBGL([
//      this.drawBufferExt.COLOR_ATTACHMENT0_WEBGL, // gl_FragData[0]
//      this.drawBufferExt.COLOR_ATTACHMENT1_WEBGL, // gl_FragData[1]
//      this.drawBufferExt.COLOR_ATTACHMENT2_WEBGL  // gl_FragData[2]
//  ]);

    // PBO Test - for future replacement of readPixels()
    // gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.m_pbo);
    // gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

    // Define the outputs of the shader
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_particlePosLinearTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_particleVelLinearTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.m_particlePosOldTex, 0);
    
    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0, 
        gl.COLOR_ATTACHMENT1, 
        gl.COLOR_ATTACHMENT2  
    ]);
    
    // Are there particles in the scene?
    if(this.m_particleSystem.getParticleArray().length > 0) {

        if(this.m_screenQuadBuffer == null) {
            // Vertex definition of the screen quad
            var screenQuad = [
              1,  1,
             -1,  1,
             -1, -1,
              1,  1,
             -1, -1,
              1, -1
            ];

            // Create the buffer for the vertex data and bind it
            this.m_screenQuadBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
        }
        
        // Bind the screen quad buffer data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        
        // Pass relevant textures
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particlePosTex);
        gl.uniform1i(this.m_uLocationPARTICLEPOSTEXNEW, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particleVelVorticityTex);
        gl.uniform1i(this.m_uLocationPARTICLEVELTEX, 1);
        
        // Pass relevant uniform variables to the shader
        this.passUniforms();
        
        // Render the fullscreen quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindTexture(gl.TEXTURE_2D, null);
    }
        
    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
 
};



/**
 * Function to compute the Lagrange multiplier lambda for the
 * calculation of the PBF density constraint
 *
 * Shader: lambdaShader.frag
 */
Scene.prototype.solveLagrangeMultiplierPBF = function() {
    
    // Bin the predicted particle positions
    if(this.m_particleSystem.getParticleArray().length > 0){
        
        // VERY important step for fluid simulation, computationally expensive! (see particlesystem.js)
        this.m_binningOutput = this.m_particleSystem.binParticles();
        this.m_binArray = this.m_binningOutput[0];
        
        this.binsToShader();
    }
    
    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebuffer);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_lambdaTexture, 0);
    
    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0 // gl_FragData[0]
    ]);
    
    if(this.m_particleSystem.getParticleArray().length > 0) {
        if(this.m_screenQuadBuffer == null) {
            // Vertex definition of the screen quad
            var screenQuad = [
              1,  1,
             -1,  1,
             -1, -1,
              1,  1,
             -1, -1,
              1, -1
            ];

            // Create the buffer for the vertex data and bind it
            this.m_screenQuadBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
        }
        
        // Bind the screen quad buffer data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particlePosLinearTex);
        gl.uniform1i(this.m_uLocationPARTICLEPOSTEXNEW, 0);
        
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.m_binIDTexture);
        gl.uniform1i(this.m_uLocationBINIDTEX, 3);

        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_3D, this.m_bin3DTexture);
        gl.uniform1i(this.m_uLocationBIN3DTEX, 4);
        
        // Pass relevant uniform variables to the shader
        this.passUniforms();
        
        // Render the fullscreen quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};




/**
 * Function to find particle neighbors and solve constraints
 * This computes the density constraint for PBF
 *
 * Shader: constraintShader.frag
 */
Scene.prototype.solveConstraints = function() {
    
    if(this.m_particleSystem.getParticleArray().length > 0){
        this.particlesToShader(true);
    }
    
    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebuffer);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_particlePosConstraintTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_particleVelConstraintTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.m_particleColorTex, 0);
    
    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0, 
        gl.COLOR_ATTACHMENT1, 
        gl.COLOR_ATTACHMENT2
    ]);
    
    if(this.m_particleSystem.getParticleArray().length > 0) {
    
        // Render the fullscreen quad to get the pixels
        if(this.m_screenQuadBuffer == null) {
            // Vertex definition of the screen quad
            var screenQuad = [
              1,  1,
             -1,  1,
             -1, -1,
              1,  1,
             -1, -1,
              1, -1
            ];

            // Create the buffer for the vertex data and bind it
            this.m_screenQuadBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
        }
        
        // Bind the screen quad buffer data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particlePosLinearTex);
        gl.uniform1i(this.m_uLocationPARTICLEPOSTEXNEW, 0);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particlePosOldTex);
        gl.uniform1i(this.m_uLocationPARTICLEPOSOLDTEX, 2);

        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.m_binIDTexture);
        gl.uniform1i(this.m_uLocationBINIDTEX, 3);

        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_3D, this.m_bin3DTexture);
        gl.uniform1i(this.m_uLocationBIN3DTEX, 4);
        
        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_2D, this.m_lambdaTexture);
        gl.uniform1i(this.m_uLocationLAMBDATEX, 5);

        gl.activeTexture(gl.TEXTURE6);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particleColorTex);
        gl.uniform1i(this.m_uLocationPARTICLECOLORTEX, 6);
        
        // Pass relevant uniform variables to the shader
        this.passUniforms();
        
        // Render the fullscreen quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindTexture(gl.TEXTURE_2D, null);

        gl.readBuffer(gl.COLOR_ATTACHMENT0);
        
        // Read the pixels of the texture, which represent the particle properties
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
            
            start = new Date().getTime();
            // Initialize the array for particle position data
            this.m_particlePosData = new Float32Array(this.m_textureSize * this.m_textureSize * 4);
            
            // Read the pixels from the framebuffer to the predefined array (VERY EXPENSIVE!)
            gl.readPixels(0, 0, this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, this.m_particlePosData);

            // Read pixels to PBO (WAITING FOR MOZILLA TO MAKE THIS HAPPEN)
      //       gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.m_pboPositions);
      //       gl.readPixels(0, 0, this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, 0);
            // gl.bindBuffer(gl.PIXEL_PACK_BUFFER, 0);

            // Convert Float32Array to Array
            var _dataArray = Array.prototype.slice.call(this.m_particlePosData);
            
            // Reduce the array so it only contains particle data
            var _length = this.m_particleSystem.getParticleArray().length;  // Get length of original particle array
            var _newArray = _dataArray.slice(0, _length);                   // Cut off any undefined particles

            this.m_particleSystem.setParticleArray(_newArray);  // Set array as new particle array for the next frame
            end = new Date().getTime();
            this.m_readPositionsTime = end - start;

            // Read back the color
            start = new Date().getTime();
            gl.readBuffer(gl.COLOR_ATTACHMENT2);
            this.m_particleColorData = new Float32Array(this.m_textureSize * this.m_textureSize * 4);
            
            // Read the pixels from the framebuffer to the predefined array
            gl.readPixels(0, 0, this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, this.m_particleColorData);
            
            // Convert Float32Array to Array
            _dataArray = Array.prototype.slice.call(this.m_particleColorData);
            
            // Reduce the array so it only contains particle data
             _length = this.m_particleSystem.getParticleArray().length;  // Get length of original particle array
             _newArray = _dataArray.slice(0, _length);                   // Cut off any undefined particles
             
            this.m_particleSystem.setParticleColorArray(_newArray);  // Set array as new particle array for the next frame
            end = new Date().getTime();
            this.m_readColorsTime = end - start;

            /*
            // Read back the velocity
            gl.readBuffer(gl.COLOR_ATTACHMENT1);
            this.m_particleVelocityData = new Float32Array(this.m_textureSize * this.m_textureSize * 4);
            
            // Read the pixels from the framebuffer to the predefined array
            gl.readPixels(0, 0, this.m_textureSize, this.m_textureSize, gl.RGBA, gl.FLOAT, this.m_particleVelocityData);
            
            // Convert Float32Array to Array
            _dataArray = Array.prototype.slice.call(this.m_particleVelocityData);
            
            // Reduce the array so it only contains particle data
             _length = this.m_particleSystem.getParticleArray().length;  // Get length of original particle array
             this.m_particleVelocityArray = _dataArray.slice(0, _length); // Cut off any undefined particles
             */

        }
    }
        
    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};




/** 
 * Function to compute the viscosity in the SPH simulation
 * This only affects the particle velocity
 *
 * Shader: viscosityShader.frag
 */
Scene.prototype.solveViscosity = function() {
    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebuffer);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_particleVelVorticityTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_vorticityTex, 0);
    
    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1
    ]);
    
    if(this.m_particleSystem.getParticleArray().length > 0) {
        if(this.m_screenQuadBuffer == null) {
            // Vertex definition of the screen quad
            var screenQuad = [
              1,  1,
             -1,  1,
             -1, -1,
              1,  1,
             -1, -1,
              1, -1
            ];

            // Create the buffer for the vertex data and bind it
            this.m_screenQuadBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
        }
        
        // Bind the screen quad buffer data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particlePosTex);
        gl.uniform1i(this.m_uLocationPARTICLEPOSTEXNEW, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particleVelConstraintTex);
        gl.uniform1i(this.m_uLocationPARTICLEVELTEX, 1);

        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.m_binIDTexture);
        gl.uniform1i(this.m_uLocationBINIDTEX, 3);

        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_3D, this.m_bin3DTexture);
        gl.uniform1i(this.m_uLocationBIN3DTEX, 4);
        
        // Pass relevant uniform variables to the shader
        this.passUniforms();
        
        // Render the fullscreen quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

};


// Scene.prototype.solveVorticity = function() {
//     // Bind the framebuffer
//     gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebuffer);
    
//     gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_particleVelTex, 0);
    
//     // draw the buffers
//     gl.drawBuffers([
//         gl.COLOR_ATTACHMENT0
//     ]);

//     if(this.m_particleSystem.getParticleArray().length > 0) {
//         if(this.m_screenQuadBuffer == null) {
//             // Vertex definition of the screen quad
//             var screenQuad = [
//               1,  1,
//              -1,  1,
//              -1, -1,
//               1,  1,
//              -1, -1,
//               1, -1
//             ];

//             // Create the buffer for the vertex data and bind it
//             this.m_screenQuadBuffer = gl.createBuffer();
//             gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
//             gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
//         }
        
//         // Bind the screen quad buffer data
//         gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
//         gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        
//         gl.activeTexture(gl.TEXTURE0);
//         gl.bindTexture(gl.TEXTURE_2D, this.m_particlePosConstraintTex);
//         gl.uniform1i(this.m_uLocationPARTICLEPOSTEXNEW, 0);
        
//         gl.activeTexture(gl.TEXTURE1);
//         gl.bindTexture(gl.TEXTURE_2D, this.m_particleVelVorticityTex);
//         gl.uniform1i(this.m_uLocationPARTICLEVELTEX, 1);

//         gl.activeTexture(gl.TEXTURE3);
//         gl.bindTexture(gl.TEXTURE_2D, this.m_binIDTexture);
//         gl.uniform1i(this.m_uLocationBINIDTEX, 3);

//         gl.activeTexture(gl.TEXTURE4);
//         gl.bindTexture(gl.TEXTURE_3D, this.m_bin3DTexture);
//         gl.uniform1i(this.m_uLocationBIN3DTEX, 4);

//         gl.activeTexture(gl.TEXTURE20);
//         gl.bindTexture(gl.TEXTURE_2D, this.m_vorticityTex);
//         gl.uniform1i(this.m_uLocationVORTICITYTEX, 20);
        
//         // Pass relevant uniform variables to the shader
//         this.passUniforms();
        
//         // Render the fullscreen quad
//         gl.drawArrays(gl.TRIANGLES, 0, 6);

//         gl.bindTexture(gl.TEXTURE_2D, null);
//     }
    
    
//     // Unbind the framebuffer
//     gl.bindFramebuffer(gl.FRAMEBUFFER, null);

// };




/*****************************************************************************************
 *
 * Functions for fluid visualization
 * The methods are based on Screen Space Fluid Rendering (SSFR) by van der Laan et al.
 * SSFR is extended by a new implementation for color mixing and inter-fluid refractions
 * Multi-Color SSFR (MCSSFR) by Fabian Stoll
 *
 *****************************************************************************************
 */


/**
 * Method to render the particles 
 * This sets up the SSFR pipeline for surface reconstruction
 *
 * Shader: particleRender.vert / particleRender.frag
 */
Scene.prototype.renderParticles = function() {

    /***********************************************************
     * Draw particles as instanced rectangles
     * Requires WebGL 2.0
     */    
    // Create the buffer with the position offsets (the particle positions)
    if(this.m_offsetBuffer == null) {
        this.m_offsetBuffer = gl.createBuffer();
    }
    this.m_offsetData = new Float32Array(this.m_particleSystem.getParticleArray());
    var _instanceCount = this.m_offsetData.length/4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_offsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.m_offsetData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    // Pass color data as attribute
    if(this.m_colorBuffer == null) {
        this.m_colorBuffer = gl.createBuffer();
    }
    this.m_colorData = new Float32Array(this.m_particleSystem.getParticleColorArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.m_colorData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);

    // Pass velocity data as attribute
    if(this.m_velocityBuffer == null) {
        this.m_velocityBuffer = gl.createBuffer();
    }
    this.m_velocityData = new Float32Array(this.m_particleVelocityArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_velocityBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.m_velocityData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(3, 1);

    // Vertex definition of the point sprite
    var pointSprite = [
      this.m_pointSize,  this.m_pointSize, 0,
     -this.m_pointSize,  this.m_pointSize, 0,
     -this.m_pointSize, -this.m_pointSize, 0,
     this.m_pointSize,  this.m_pointSize, 0,
     -this.m_pointSize, -this.m_pointSize, 0,
     this.m_pointSize, -this.m_pointSize, 0
    ];
    // Create the buffer for the vertex data and bind it
    this.m_pointSpriteBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_pointSpriteBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointSprite), gl.STATIC_DRAW);

    // Bind the point sprite buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_pointSpriteBuffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    // Pass relevant uniforms
    this.passUniforms();
    
    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferParticlesSSFR);

    // Define the outputs of the shader
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_ssfrParticleColor, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_ssfrParticleDepth, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.m_ssfrDepthTexture, 0);
    
    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1
    ]);
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.disable(gl.BLEND);
    
    // Use instanced rendering
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, _instanceCount);
    
    gl.disable(gl.DEPTH_TEST);

    gl.enable(gl.BLEND);
    
    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
};




/**
 * Method to render the thickness of the fluid 
 *
 * Shader: thicknessShader.frag
 */
Scene.prototype.renderThickness = function() {
    
    /***********************************************************
     * Draw particles as instanced rectangles
     * Requires WebGL 2.0
     */    
    // Create the buffer with the position offsets (the particle positions)
    if(this.m_offsetBuffer == null) {
        this.m_offsetBuffer = gl.createBuffer();
    }
    // var _offsetData = new Float32Array(this.m_particleSystem.getParticleArray());
    var _instanceCount = this.m_offsetData.length/4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_offsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.m_offsetData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    // Pass color data as attribute
    if(this.m_colorBuffer == null) {
        this.m_colorBuffer = gl.createBuffer();
    }
    // var _colorData = new Float32Array(this.m_particleSystem.getParticleColorArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.m_colorData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);
    
    // Vertex definition of the point sprite
    var pointSprite = [
      this.m_pointSize,  this.m_pointSize, 0,
     -this.m_pointSize,  this.m_pointSize, 0,
     -this.m_pointSize, -this.m_pointSize, 0,
     this.m_pointSize,  this.m_pointSize, 0,
     -this.m_pointSize, -this.m_pointSize, 0,
     this.m_pointSize, -this.m_pointSize, 0
    ];
    // Create the buffer for the vertex data and bind it
    this.m_pointSpriteBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_pointSpriteBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointSprite), gl.STATIC_DRAW);

    // Bind the point sprite buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_pointSpriteBuffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    // Pass relevant uniforms
    this.passUniforms();
    
    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferThicknessSSFR);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_ssfrThicknessTexture, 0);
    
    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0
    ]);
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Use additive blending!
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, _instanceCount);
    
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);      
};





/**
 * Render particles a second time for MCSSFR
 * Now the alpha values are written to the depth buffer
 * This corresponds to a fluid refraction layer and is important for color mixing
 *
 * Shader: refractionLayerShader.frag
 */
Scene.prototype.renderRefraction = function() {

    // Render particles with depth test
    // Create the buffer with the position offsets (the particle positions)
    if(this.m_offsetBuffer == null) {
        this.m_offsetBuffer = gl.createBuffer();
    }

    var _instanceCount = this.m_offsetData.length/4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_offsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.m_offsetData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    // Pass color data as attribute
    if(this.m_colorBuffer == null) {
        this.m_colorBuffer = gl.createBuffer();
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.m_colorData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);
    
    // Vertex definition of the point sprite
    var pointSprite = [
      this.m_pointSize,  this.m_pointSize, 0,
     -this.m_pointSize,  this.m_pointSize, 0,
     -this.m_pointSize, -this.m_pointSize, 0,
     this.m_pointSize,  this.m_pointSize, 0,
     -this.m_pointSize, -this.m_pointSize, 0,
     this.m_pointSize, -this.m_pointSize, 0
    ];
    // Create the buffer for the vertex data and bind it
    this.m_pointSpriteBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_pointSpriteBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointSprite), gl.STATIC_DRAW);

    // Bind the point sprite buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_pointSpriteBuffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    // Pass relevant uniforms
    this.passUniforms();

    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferRefractionSSFR);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_ssfrRefractionColor, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_ssfrRefractionDepth, 0);
    
    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1
    ]);
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, _instanceCount);
    
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    
    // Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

};




/*
 * Renderpass to blur the depth texture in horizontal direction
 * using a bilateral filter
 *
 * Shader: blurBiXShader.frag
 */
Scene.prototype.blurDepthX = function() {
    if(this.m_screenQuadBuffer == null) {
        // Vertex definition of the screen quad
        var screenQuad = [
          1,  1,
         -1,  1,
         -1, -1,
          1,  1,
         -1, -1,
          1, -1
        ];

        // Create the buffer for the vertex data and bind it
        this.m_screenQuadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
    }
    
    // Bind the screen quad buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrParticleDepth);
    gl.uniform1i(this.m_uLocationPARTICLEDEPTHTEX, 10);

    gl.activeTexture(gl.TEXTURE11);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrRefractionDepth);
    gl.uniform1i(this.m_uLocationREFRACTIONDEPTHTEX, 11);
    
    // Pass relevant uniform variables to the shader
    this.passUniforms();
    
    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferParticlesSSFR);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.m_renderbuffer);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_ssfrDepthTextureBlurX, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_ssfrRefractionTextureBlurX, 0);

    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1
    ]);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
};


/*
 * Renderpass to blur the depth texture in vertical direction
 * using a bilateral filter
 *
 * Shader: blurBiYShader.frag
 */
Scene.prototype.blurDepthY = function() {
    if(this.m_screenQuadBuffer == null) {
        // Vertex definition of the screen quad
        var screenQuad = [
          1,  1,
         -1,  1,
         -1, -1,
          1,  1,
         -1, -1,
          1, -1
        ];

        // Create the buffer for the vertex data and bind it
        this.m_screenQuadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
    }
    
    // Bind the screen quad buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE30);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrDepthTextureBlurX);
    gl.uniform1i(this.m_uLocationSSFRDEPTHTEXTUREBLURX, 30);

    gl.activeTexture(gl.TEXTURE31);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrRefractionTextureBlurX);
    gl.uniform1i(this.m_uLocationSSFRREFRACTIONTEXTUREBLURX, 31);
    
    // Pass relevant uniform variables to the shader
    this.passUniforms();
    
    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferParticlesSSFR);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.m_renderbuffer);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_ssfrDepthTextureBlurY, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.m_ssfrRefractionTextureBlurY, 0);

    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1
    ]);

    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
};



/**
 *  Blur the thickness using a gauss filter
 *  Shader files: blurGaussXShader.frag and blurGaussYShader.frag
 */
Scene.prototype.blurThickness = function() {
    if(this.m_screenQuadBuffer == null) {
        // Vertex definition of the screen quad
        var screenQuad = [
          1,  1,
         -1,  1,
         -1, -1,
          1,  1,
         -1, -1,
          1, -1
        ];

        // Create the buffer for the vertex data and bind it
        this.m_screenQuadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
    }
    
    // Bind the screen quad buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Pass thickness texture
    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrThicknessTexture);
    gl.uniform1i(this.m_uLocationSSFRTHICKNESSTEXTURE, 9);
    
    // Pass relevant uniform variables to the shader
    this.passUniforms();
    
    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferThicknessSSFR);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_ssfrThicknessTexture, 0);
   
    // draw the buffers
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0
    ]);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};



/**
 * Render the SSFR pass
 * 
 * Shader: ssfrShader.frag
 */
Scene.prototype.renderSSFR = function() {
    if(this.m_screenQuadBuffer == null) {
        // Vertex definition of the screen quad
        var screenQuad = [
          1,  1,
         -1,  1,
         -1, -1,
          1,  1,
         -1, -1,
          1, -1
        ];

        // Create the buffer for the vertex data and bind it
        this.m_screenQuadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
    }
    
    // Bind the screen quad buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrThicknessTexture);
    gl.uniform1i(this.m_uLocationSSFRTHICKNESSTEXTURE, 9);

    gl.activeTexture(gl.TEXTURE28);
    gl.bindTexture(gl.TEXTURE_2D, this.m_backgroundTexture);
    gl.uniform1i(this.m_uLocationBACKGROUNDTEX, 28);

    gl.activeTexture(gl.TEXTURE29);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrDepthTexture);
    gl.uniform1i(this.m_uLocationSSFRDEPTHTEXTURE, 29);

    gl.activeTexture(gl.TEXTURE30);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrDepthTextureBlurX);
    gl.uniform1i(this.m_uLocationSSFRDEPTHTEXTUREBLURX, 30);

    gl.activeTexture(gl.TEXTURE31);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrDepthTextureBlurY);
    gl.uniform1i(this.m_uLocationSSFRDEPTHTEXTUREBLURY, 31);

    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrRefractionTextureBlurY);
    gl.uniform1i(this.m_uLocationSSFRREFRACTIONTEXTUREBLURY, 10);

    gl.activeTexture(gl.TEXTURE11);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrParticleColor);
    gl.uniform1i(this.m_uLocationPARTICLECOLORTEX, 11);

    gl.activeTexture(gl.TEXTURE12);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrRefractionColor);
    gl.uniform1i(this.m_uLocationREFRACTIONCOLORTEX, 12);

    gl.activeTexture(gl.TEXTURE13);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrRefractionDepth);
    gl.uniform1i(this.m_uLocationREFRACTIONDEPTHTEX, 13);

    gl.activeTexture(gl.TEXTURE14);
    gl.bindTexture(gl.TEXTURE_2D, this.m_ssfrParticleDepth);
    gl.uniform1i(this.m_uLocationPARTICLEDEPTHTEX, 14);

    gl.activeTexture(gl.TEXTURE27);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.m_cubeMapTexture);
    gl.uniform1i(this.m_uLocationCUBEMAPTEXTURE, 27);

    // Pass relevant uniform variables to the shader
    this.passUniforms();

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindTexture(gl.TEXTURE_2D, null);
};





/* *****************************************************
 * 
 * Additional functions to render the scene with WebGL
 *
 * *****************************************************
 */


/**
 *  Method to draw the background image to a texture
 */
Scene.prototype.backgroundToTexture = function() {
    
    if(this.m_screenQuadBuffer == null) {
        // Vertex definition of the screen quad
        var screenQuad = [
          1,  1,
         -1,  1,
         -1, -1,
          1,  1,
         -1, -1,
          1, -1
        ];

        // Create the buffer for the vertex data and bind it
        this.m_screenQuadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(screenQuad), gl.STATIC_DRAW);
    }
    
    // Bind the screen quad buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_screenQuadBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferBackground);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_backgroundTexture, 0);
    
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0
    ]);
    
    // Pass relevant uniform variables to the shader
    this.passUniforms();
    
    // Render the fullscreen quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

};



/**
 * Function to pack all particles into a texture and pass it to the shader
 */
Scene.prototype.particlesToShader = function(constraintShader) {

    if(!constraintShader) {
    	// Get array, compute texture size, fill texture and pass it
    	var _particles = this.m_particleSystem.getParticleArray();
    	var _arraySize = this.m_textureSize * this.m_textureSize * 4;
    	var _textureDataPos = new Float32Array(_arraySize);
    	var _particlePosArray = Float32Array.from(_particles);
    	
    	// Fill up the array wit 0's to its maximum length depending on the maximum texture size
    	_textureDataPos.set(_particlePosArray);
    	
    	// Particle position data goes into texture 0
    	// gl.activeTexture(gl.TEXTURE0);
    	gl.bindTexture(gl.TEXTURE_2D, this.m_particlePosTex);
    	// gl.uniform1i(this.m_uLocationPARTICLEPOSTEX, 0);
    	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.m_textureSize, this.m_textureSize, 0, gl.RGBA, gl.FLOAT, _textureDataPos);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // Color texture
        _arraySize = this.m_textureSize * this.m_textureSize * 4;
        _textureDataPos = new Float32Array(_arraySize);
        var _colors = this.m_particleSystem.getParticleColorArray();
        var _particleColorArray = Float32Array.from(_colors);
        _textureDataPos.set(_particleColorArray);

        // gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particleColorTex);
        // gl.uniform1i(this.m_uLocationPARTICLECOLORTEX, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.m_textureSize, this.m_textureSize, 0, gl.RGBA, gl.FLOAT, _textureDataPos);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }


	if(constraintShader) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particlePosTex);
        gl.uniform1i(this.m_uLocationPARTICLEPOSTEX, 0);

        // Color texture
        gl.activeTexture(gl.TEXTURE6);
        gl.bindTexture(gl.TEXTURE_2D, this.m_particleColorTex);
        gl.uniform1i(this.m_uLocationPARTICLECOLORTEX, 6);

		// Also pass the bin information in a 1-channel texture
		gl.activeTexture(gl.TEXTURE3);
		gl.bindTexture(gl.TEXTURE_2D, this.m_binIDTexture);
		gl.uniform1i(this.m_uLocationBINIDTEX, 3);
	
		// Fill the 3D texture with information (which bin contains which particles)
		gl.activeTexture(gl.TEXTURE4);
		gl.bindTexture(gl.TEXTURE_3D, this.m_bin3DTexture);
		gl.uniform1i(this.m_uLocationBIN3DTEX, 4);		
	}
};


/**
 *  Pass the binning data to the shader
 */ 
Scene.prototype.binsToShader = function() {

    // Also pass the bin information in a 1-channel texture
    var _size = this.m_textureSize * this.m_textureSize;
    var _textureDataBinIDs = new Float32Array(_size);
    var _binIDArray = Float32Array.from(this.m_binArray);
    _textureDataBinIDs.set(_binIDArray);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.m_binIDTexture);
    gl.uniform1i(this.m_uLocationBINIDTEX, 3);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RED, this.m_textureSize, this.m_textureSize, 0, gl.RED, gl.FLOAT, _textureDataBinIDs);

    // Fill the 3D texture with information (which bin contains which particles)
    var _textureData3DArray = Float32Array.from(this.m_binningOutput[1]);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_3D, this.m_bin3DTexture);
    gl.uniform1i(this.m_uLocationBIN3DTEX, 4);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, this.m_particleSystem.m_xBinCount, this.m_particleSystem.m_yBinCount, this.m_particleSystem.m_zBinCount, 0, gl.RGBA, gl.FLOAT, _textureData3DArray);
};



/**
 * Function to render the lines of the bounding volume for better visualization
 */
Scene.prototype.renderLines = function() {
//	if(this.m_boundingVolumeBuffer == null) {
		var b = this.m_particleSystem.m_boundingBox;
		// Vertex definition of the bounding volume
	    var _boundingVolume = [
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMin,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMin, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMin, b.m_position[2] + b.m_zMax,
	      b.m_position[0] + b.m_xMax, b.m_position[1] + b.m_yMax, b.m_position[2] + b.m_zMax,
	    ];
	
	    // Create the buffer for the vertex data and bind it
	    this.m_boundingVolumeBuffer = gl.createBuffer();
	    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_boundingVolumeBuffer);
	    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_boundingVolume), gl.STATIC_DRAW);
//	}
	    
    // Bind the buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_boundingVolumeBuffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    // Pass relevant uniform variables to the shader
    this.passUniforms();
    
    // Render the lines
    gl.drawArrays(gl.LINES, 0, 24);
};


/**
 *  Function to show the light source as a yellow point
 *  Shader file: lightSourceShader.frag
 */ 
Scene.prototype.renderLightSource = function() {
	var _lightPos = [this.m_lightPos[0], this.m_lightPos[1], this.m_lightPos[2]];
    // Create the buffer for the vertex data and bind it
    this.m_lightSourceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_lightSourceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_lightPos), gl.STATIC_DRAW);
    
//    console.log(getTimestep()*10000);
    
    this.passUniforms();
    
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
//    gl.enable(gl.DEPTH_TEST);
    gl.drawArrays(gl.POINTS, 0, 1);
//    gl.disable(gl.DEPTH_TEST);
};



/**
 *  Function to load a cubemap texture
 *  From: http://stackoverflow.com/questions/10079368/how-would-i-do-environment-reflection-in-webgl-without-using-a-library-like-thre
 */
Scene.prototype.loadCubeMap = function(map) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    var path = "";

    if(map == "standard") {
        path = "textures/tiles.png";  
        var faces = [[path, gl.TEXTURE_CUBE_MAP_POSITIVE_X],
                 [path, gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
                 [path, gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
                 [path, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
                 [path, gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
                 [path, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z]]; 
    }
    else if(map == "white") {
        path = "textures/white.png";   
        var faces = [[path, gl.TEXTURE_CUBE_MAP_POSITIVE_X],
                 [path, gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
                 [path, gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
                 [path, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
                 [path, gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
                 [path, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z]];
    }
    else {
        if(map == "ocean")
            path = "textures/ocean";
        else if(map == "space")
            path = "textures/space2";
        else if(map == "sunset")
            path = "textures/sunset";

        var faces = [[path + "/right.png", gl.TEXTURE_CUBE_MAP_POSITIVE_X],
                     [path + "/left.png", gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
                     [path + "/top.png", gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
                     [path + "/bottom.png", gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
                     [path + "/front.png", gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
                     [path + "/back.png", gl.TEXTURE_CUBE_MAP_NEGATIVE_Z]];
    }

    

    for (var i = 0; i < faces.length; i++) {
        var face = faces[i][1];
        var image = new Image();
        image.onload = function(texture, face, image) {
            return function() {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            }
        } (texture, face, image);
        image.src = faces[i][0];
    }
    return texture;
};


/**
 *  Function to render a cubemap/skybox 
 *  From: http://antongerdelan.net/opengl/cubemaps.html
 */
Scene.prototype.renderCubeMap = function() {

    if(this.m_cubeMapBuffer == null) {
        // Vertex definition of the cube
        var points = [
          -10.0,  10.0, -10.0,
          -10.0, -10.0, -10.0,
           10.0, -10.0, -10.0,
           10.0, -10.0, -10.0,
           10.0,  10.0, -10.0,
          -10.0,  10.0, -10.0,
          
          -10.0, -10.0,  10.0,
          -10.0, -10.0, -10.0,
          -10.0,  10.0, -10.0,
          -10.0,  10.0, -10.0,
          -10.0,  10.0,  10.0,
          -10.0, -10.0,  10.0,
          
           10.0, -10.0, -10.0,
           10.0, -10.0,  10.0,
           10.0,  10.0,  10.0,
           10.0,  10.0,  10.0,
           10.0,  10.0, -10.0,
           10.0, -10.0, -10.0,
           
          -10.0, -10.0,  10.0,
          -10.0,  10.0,  10.0,
           10.0,  10.0,  10.0,
           10.0,  10.0,  10.0,
           10.0, -10.0,  10.0,
          -10.0, -10.0,  10.0,
          
          -10.0,  10.0, -10.0,
           10.0,  10.0, -10.0,
           10.0,  10.0,  10.0,
           10.0,  10.0,  10.0,
          -10.0,  10.0,  10.0,
          -10.0,  10.0, -10.0,
          
          -10.0, -10.0, -10.0,
          -10.0, -10.0,  10.0,
           10.0, -10.0, -10.0,
           10.0, -10.0, -10.0,
          -10.0, -10.0,  10.0,
           10.0, -10.0,  10.0
        ].map(function(x) { return x * 2; });

        // Create the buffer for the vertex data and bind it
        this.m_cubeMapBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_cubeMapBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
    }
    
    // Bind the screen quad buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_cubeMapBuffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    this.passUniforms();

    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.m_cubeMapTexture);
    gl.uniform1i(this.m_uLocationCUBEMAPTEXTURE, 10);

    // gl.depthMask(gl.FALSE);

    gl.drawArrays(gl.TRIANGLES, 0, 36);

    // gl.depthMask(gl.TRUE);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
};


/**
 *  Function to render the cubemap background to a texture
 *  Needed for refraction in ssfrShader.frag
 */
Scene.prototype.cubeMapToTexture = function() {

    if(this.m_cubeMapBuffer == null) {
        // Vertex definition of the cube
        var points = [
          -10.0,  10.0, -10.0,
          -10.0, -10.0, -10.0,
           10.0, -10.0, -10.0,
           10.0, -10.0, -10.0,
           10.0,  10.0, -10.0,
          -10.0,  10.0, -10.0,
          
          -10.0, -10.0,  10.0,
          -10.0, -10.0, -10.0,
          -10.0,  10.0, -10.0,
          -10.0,  10.0, -10.0,
          -10.0,  10.0,  10.0,
          -10.0, -10.0,  10.0,
          
           10.0, -10.0, -10.0,
           10.0, -10.0,  10.0,
           10.0,  10.0,  10.0,
           10.0,  10.0,  10.0,
           10.0,  10.0, -10.0,
           10.0, -10.0, -10.0,
           
          -10.0, -10.0,  10.0,
          -10.0,  10.0,  10.0,
           10.0,  10.0,  10.0,
           10.0,  10.0,  10.0,
           10.0, -10.0,  10.0,
          -10.0, -10.0,  10.0,
          
          -10.0,  10.0, -10.0,
           10.0,  10.0, -10.0,
           10.0,  10.0,  10.0,
           10.0,  10.0,  10.0,
          -10.0,  10.0,  10.0,
          -10.0,  10.0, -10.0,
          
          -10.0, -10.0, -10.0,
          -10.0, -10.0,  10.0,
           10.0, -10.0, -10.0,
           10.0, -10.0, -10.0,
          -10.0, -10.0,  10.0,
           10.0, -10.0,  10.0
        ].map(function(x) { return x * 2; });

        // Create the buffer for the vertex data and bind it
        this.m_cubeMapBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.m_cubeMapBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
    }
    
    // Bind the screen quad buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_cubeMapBuffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    this.passUniforms();

    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.m_cubeMapTexture);
    gl.uniform1i(this.m_uLocationCUBEMAPTEXTURE, 10);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.m_framebufferBackground);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.m_backgroundTexture, 0);
    
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0
    ]);

    gl.drawArrays(gl.TRIANGLES, 0, 36);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

};



/**************************
 * 
 * Additional functions
 */

// Get the maximum value out of a Float32Array
Float32Array.prototype.max = function(){
      var max = -100000, i = 0, len = this.length;
      for ( ; i < len; i++ )
        if ( this[i] > max ) max = this[i];
      return max;
};

// Get the timestep between two frames
var then;
function getTimestep() {
	var now = Date.now();
	if(!then){
		then = Date.now();
	}
	var elapsedTime = now - then;
	then = now;
	return elapsedTime/1000;
}

// Reset time when focus is on window again
// Prevents huge animation steps
window.onfocus = function() {
	then = Date.now();
};







/*
// Framebuffer Status Check
var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
switch (status) {
    case gl.FRAMEBUFFER_COMPLETE:
        break;
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        throw("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
        break;
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        throw("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
        break;
    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        throw("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
        break;
    case gl.FRAMEBUFFER_UNSUPPORTED:
        throw("Incomplete framebuffer: FRAMEBUFFER_UNSUPPORTED");
        break;
    default:
        throw("Incomplete framebuffer: " + status);
}

*/
