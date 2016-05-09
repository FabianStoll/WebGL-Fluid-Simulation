/***********************

	Shader Class
	
************************/

/**
 * Shader Class Constructor
 * Used to initialize a new shader variable
 * @param {String} vs_path	Path to the vertex shader source
 * @param {String} fs_path  Path to the fragment shader source
 * @param {String} id		Shader name for identification
 */
function Shader(vs_path, 
				fs_path, 
				id) {
	// PROPERTIES
	this.m_vsPath = vs_path;
	this.m_fsPath = fs_path;
	this.m_id = id;   
	this.m_attributes = new Array();
	
	// use the input to create a shader program
	this.m_program = this.createProgram(this.m_vsPath, this.m_fsPath);
	
	console.log("Shader '" + id + "' initialized.");
}

Shader.prototype.getProgram = function() {
	return this.m_program;
};

/**
 * Function to create a WebGLProgram
 * @param {String} vs_path	Path to the vertex shader source
 * @param {String} fs_path	Path to the fragment shader source
 * @returns {WebGLProgram} WebGL program
 */
Shader.prototype.createProgram = function(vs_path, 
										  fs_path) {
	// create the vertex and fragment shader and a program
    this.m_vs = this.createShader(vs_path, "vertex");
    this.m_fs = this.createShader(fs_path, "fragment");
    var _program = gl.createProgram();
    // attach the shaders to the program
    gl.attachShader(_program, this.m_vs);
    gl.attachShader(_program, this.m_fs);
    // link the program
    gl.linkProgram(_program);
    
    // ATTRIBUTE LOCATIONS
    gl.bindAttribLocation(_program, 0, "aVertexPosition");
    gl.bindAttribLocation(_program, 1, "aParticleOffset");
    gl.bindAttribLocation(_program, 2, "aParticleColor");
    gl.bindAttribLocation(_program, 3, "aParticleVelocity");
    gl.bindAttribLocation(_program, 4, "aCubeVertex");
    
    // output possible program errors
    if(!gl.getProgramParameter(_program, gl.LINK_STATUS)) {
        console.log("Error in " + this.m_id);
        throw gl.getProgramInfoLog(_program);
    }
    
    return _program;
};


/**
 * Function to create a WebGLShader
 * @param {String} path Path to the shader source
 * @param {String} type Shader type ('vertex' or 'fragment')
 * @returns {WebGLShader} WebGL Shader
 */
Shader.prototype.createShader = function(path, 
										 type) {
    var _shaderString = this.getShaderString(path);
    var _shader;
    if (type == "vertex") {
        _shader = gl.createShader(gl.VERTEX_SHADER);	// WebGL-internal function
    }
    else {
        _shader = gl.createShader(gl.FRAGMENT_SHADER);	// WebGL-internal function
    }
    gl.shaderSource(_shader, _shaderString);
    gl.compileShader(_shader);
    if(!gl.getShaderParameter(_shader, gl.COMPILE_STATUS)) {
        console.log("Error in " + path + " " + type);
        throw gl.getShaderInfoLog(_shader);
        
    }
    return _shader;
};


/**
 * Function to get the shader string from a file source
 * @param {String} path Path to the shader source
 * @returns {String} Shader string
 */
Shader.prototype.getShaderString = function(path) {
    var XHR = new XMLHttpRequest();
    XHR.open("GET", path, false);
    if(XHR.overrideMimeType){
        XHR.overrideMimeType("text/plain");
    }
    try{
        XHR.send(null);
    }catch(e){
        this.println('Error reading file "' + path + '"');
    }
    return XHR.responseText;
};


/**
 * Function to load a WebGLProgram
 * Please note that the attributes need 
 * to be set up in the vertex shader
 */  
Shader.prototype.load = function() {    
	// Abort load program when already loaded
	if(this.m_program == gl.getParameter(gl.CURRENT_PROGRAM)) {
	    return;
	}

	gl.useProgram(this.m_program);	// WebGL-internal function

	if(this.m_attributes == ""){
	    for (var i = 0; i < gl.getProgramParameter(this.m_program, gl.ACTIVE_ATTRIBUTES); i++){
	    	this.m_attributes[i] = gl.getActiveAttrib(this.m_program, i).name;
	    }
//	    console.log(gl.getProgramParameter(this.m_program, gl.ACTIVE_ATTRIBUTES));
	    // console.log(this.m_attributes);
	}   
	
	for(var i = 0; i < this.m_attributes.length; i++){
	    var _attribute_loc = gl.getAttribLocation(this.m_program, this.m_attributes[i]);
	    gl.enableVertexAttribArray(_attribute_loc); 
	}
	
//	gl.bindAttribLocation(this.m_program, 0, "aVertexPosition");

	/**
	 * Add your vertex attributes here
	 */
	
//	this.m_aLocationVERTEXPOSITION = gl.getAttribLocation(this.m_program, "aVertexPosition");
//	gl.enableVertexAttribArray(this.m_aLocationVERTEXPOSITION);
//	
//	this.m_aLocationPARTICLEOFFSET = gl.getAttribLocation(this.m_program, "aParticleOffset");
//	gl.enableVertexAttribArray(this.m_aLocationPARTICLEOFFSET);
	

	// link the texture coordinate attribute from the shader  
//    this.m_vertexTexture = gl.getAttribLocation(_program, "aTextureCoord");  
//    gl.enableVertexAttribArray(this.m_vertexTexture);  

	// link the normals array attribute from the shader
    //var m_vertexNormal = gl.getAttribLocation(program, "aVertexNormal");
    //gl.enableVertexAttribArray(m_vertexNormal);

	// link the vertex position attribute from the shader  
//    this.m_vertexPosition = gl.getAttribLocation(this.m_program, "aVertexPosition");  
//    gl.enableVertexAttribArray(this.m_vertexPosition);  
//    
//    this.m_particleCoords = gl.getAttribLocation(this.m_program, "aParticleCoords");  
//    gl.enableVertexAttribArray(this.m_particleCoords);  
};


/**
 * Function to disable a WebGLProgram
 * Please note that the attributes need 
 * to be set up in the vertex shader
 */  
Shader.prototype.disable = function() {  

	var _attributes = this.m_attributes;
	var _program = this.m_program;

	gl.useProgram(_program);	// WebGL-internal function

	if (_attributes == ""){
	    for (var i = 0; i < gl.getProgramParameter(_program, gl.ACTIVE_ATTRIBUTES); i++){
	        _attributes [i]= gl.getActiveAttrib(_program, i).name;
	    }
	}   
	
	for (var i = 0; i < _attributes.length; i++){
	    var _attribute_loc = gl.getAttribLocation(_program, _attributes[i]);
	    gl.disableVertexAttribArray(_attribute_loc);  
	}
	
//    this.m_vertexTexture = gl.getAttribLocation(_program, "aTextureCoord");  
//    gl.disableVertexAttribArray(this.m_vertexTexture);  

	// link the normals array attribute from the shader
    //var m_vertexNormal = gl.getAttribLocation(program, "aVertexNormal");
    //gl.enableVertexAttribArray(m_vertexNormal);

	// link the vertex position attribute from the shader  
//    this.m_vertexPosition = gl.getAttribLocation(_program, "aVertexPosition");  
//    gl.disableVertexAttribArray(this.m_vertexPosition);  

};