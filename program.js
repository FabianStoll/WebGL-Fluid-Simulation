/***********************

	Program Class
	
************************/


/**
 * PROGRAM
 */
function Program(vsPath, fsPath) {
	// CONSTRUCTOR
	
	// PROPERTIES
	this.VertexShader = this.createVertexShader(vsPath);
	this.FragmentShader = this.createFragmentShader(fsPath);
	
	this.ShaderProgram = this.createProgram(this.VertexShader, this.FragmentShader);
	
	this.loadProgram(this.ShaderProgram, true, true);
}


/**
 * Method to create a vertexshader
 * @param {string} path Path to the shader file
 * @returns shader
 */
Program.prototype.createVertexShader = function(path) {
    var shaderString = this.getShaderString(path);
    this.shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(this.shader, shaderString);
    gl.compileShader(this.shader);
    if(!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
        console.log("Error in" + path);
        throw gl.getShaderInfoLog(this.shader);
    }
    return this.shader;
};


/**
 * Method to create a fragmentshader
 * @param {string} path Path to the shader file
 * @returns shader
 */
Program.prototype.createFragmentShader = function(path) {
    var shaderString = this.getShaderString(path);
    this.shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(this.shader, shaderString);
    gl.compileShader(this.shader);
    if(!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
        console.log("Error in" + path);
        throw gl.getShaderInfoLog(this.shader);
    }
    return this.shader;
};


/**
 * Method to get the string of a shader file
 * @param path
 * @returns {string} shader string
 */
Program.prototype.getShaderString = function(path) {
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
 * Method to create a shader program
 * @param vs Vertexshader
 * @param fs Fragmentshader
 * @returns program
 */
Program.prototype.createProgram = function(vs, fs) {
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        throw gl.getProgramInfoLog(this.program);
    }
    return this.program;
};


/**
 * Method to load a program
 * @param program
 * @param {bool} vertexPos, textureCoord
 */  
Program.prototype.loadProgram = function(program, vertexPos, textureCoord){
    gl.useProgram(program);
    // link the vertex position attribute from the shader  
    if (vertexPos){
        this.VertexPosition = gl.getAttribLocation(program, "aVertexPosition");  
        gl.enableVertexAttribArray(this.VertexPosition);  
    }
    // link the texture coordinate attribute from the shader  
    if(textureCoord) {
        this.VertexTexture = gl.getAttribLocation(program, "aTextureCoord");  
        gl.enableVertexAttribArray(this.VertexTexture);  
    }   
};








