/***********************

	Camera Class
	
************************/


/**
 * Camera Class Constructor
 */
function Camera() {
	// PROPERTIES
	this.m_cameraMatrix = mat4.create();
	this.m_viewMatrix = mat4.create();  // inverse of CameraMatrix
	mat4.invert(this.m_viewMatrix, this.m_cameraMatrix);
	this.m_perspectiveMatrix = mat4.create();
	this.m_quaternion = quat.create();
	this.m_sensitivity = 0.01;
	
	// base vector values
	this.m_up = vec3.fromValues(0, 1, 0);
	this.m_viewDirection = vec3.fromValues(0, 0, -1);
//	this.m_viewDirection = vec3.fromValues(0.61795490, -0.38618686, -0.6484155);
	this.m_right = vec3.fromValues(-1, 0, 0);
	
	this.m_position = vec3.create();
	this.m_pitch = 0;
	this.m_yaw = 0;
	
	this.m_translationVector = vec3.create();
	
	this.m_stepSize = 0.5;
	this.m_maxSpeed = 3;
	this.m_minSpeed = 0.5;
	this.m_speed = 100;
	
	this.m_keys = new Array();
	
	// variables for mouse controls
	this.m_mouseDown = false;
	this.m_lastMouseX = null;
	this.m_lastMouseY = null;
	
	// call methods on initialization
	this.setPerspective(45.4, 1, 100);
	this.updateRotation();
	
	console.log("Camera initialized.");
}


/**
 * Function to define the Perspective Matrix
 * @param {Number} FOV  Field of View
 * @param {Number} near Near plane distance
 * @param {Number} far  Far plane distance
 */
Camera.prototype.setPerspective = function(FOV, 
										   near, 
										   far) {
	// write the perspective matrix to m_perspectiveMatrix
	mat4.perspective(this.m_perspectiveMatrix, FOV, canvas.width/canvas.height, near, far);
};


/**
 * Set the position of the camera
 * @param {Number} xPos Camera position on the x axis
 * @param {Number} yPos Camera position on the y axis
 * @param {Number} zPos Camera position on the z axis
 */
Camera.prototype.setPosition = function(xPos, 
										yPos, 
										zPos) {
	this.m_position = vec3.fromValues(xPos, yPos, zPos);
	this.m_cameraMatrix[12] = xPos;
	this.m_cameraMatrix[13] = yPos;
	this.m_cameraMatrix[14] = zPos;
	mat4.invert(this.m_viewMatrix, this.m_cameraMatrix);
};


/**
 * Base functions for camera movement
 * 
 */
Camera.prototype.moveRight = function() {
	this.m_translationVector = this.m_right;
};

Camera.prototype.moveLeft = function() {
	vec3.scale(this.m_translationVector, this.m_right, -1);
};

Camera.prototype.moveUp = function() {
	this.m_translationVector = this.m_up;
};

Camera.prototype.moveDown = function() {
	vec3.scale(this.m_translationVector, this.m_up, -1);
};

Camera.prototype.moveForward = function() {
	this.m_translationVector = this.m_viewDirection;
};

Camera.prototype.moveBackward = function() {
	vec3.scale(this.m_translationVector, this.m_viewDirection, -1);
};

Camera.prototype.moveLeftBackward = function() {
	vec3.add(this.m_translationVector, this.m_viewDirection, this.m_right);
	vec3.scale(this.m_translationVector, this.m_translationVector, -1);
};

Camera.prototype.moveRightForward = function() {
	vec3.add(this.m_translationVector, this.m_viewDirection, this.m_right);
};

Camera.prototype.moveLeftForward = function() {
	vec3.scaleAndAdd(this.m_translationVector, this.m_viewDirection, this.m_right, -1);
};

Camera.prototype.moveRightBackward = function() {
	vec3.scaleAndAdd(this.m_translationVector, this.m_right, this.m_viewDirection, -1);
};

/**
 * Function to update the camera
 * Checks for mouse and keyboard input
 */
Camera.prototype.update = function() {
    // keyboard control
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
    // mouse control
    canvas.onmousedown = handleMouseDown;
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;

    var _that = this;

    //reset cameracontrols after lost focus
	window.onblur = function() {
		_that.m_keys = [];
	};
    
    function handleKeyDown(event) {
    	// key is pressed, camera is moving
    	_that.Moving = true; 	
    	_that.m_keys[event.keyCode] = true;
    }
    
    function handleKeyUp(event) {
    	// slow down    	
    	_that.Moving = false;
    	_that.m_keys[event.keyCode] = false;
    }

    /**
     * Keyboard controls
     */
    if (this.m_keys[65]) {
        // A key
        if (this.m_keys[83] && !this.m_keys[87] && !this.m_keys[68]) {
            // + S key
        	this.moveLeftBackward();
        } 
        if (this.m_keys[87] && !this.m_keys[68] && !this.m_keys[63]) {
            // + W key
        	this.moveLeftForward();
        } 
		if (!this.m_keys[68] && !this.m_keys[83] && !this.m_keys[87]) {
        	this.moveLeft();
    	}
    }

    if (this.m_keys[68]) {
        // D key
        if (this.m_keys[83] && !this.m_keys[63] && !this.m_keys[87]) {
            // + S key
        	this.moveRightBackward();
        } 
        if (this.m_keys[87] && !this.m_keys[63] && !this.m_keys[83]) {
            // + W key
        	this.moveRightForward();
        } 
		if (!this.m_keys[65] && !this.m_keys[83] && !this.m_keys[87]) {
        	this.moveRight();
    	}
    }

    if (this.m_keys[87] && !this.m_keys[65] && !this.m_keys[68] && !this.m_keys[83]) {
    	//W
        this.moveForward();
    }  

    if (this.m_keys[83] && !this.m_keys[65] && !this.m_keys[68] && !this.m_keys[87]) {
    	//S
        this.moveBackward();
    }  

    if (this.m_keys[32] && !this.m_keys[17]) {
        //Space key
    	this.moveUp();
    } 
    if (this.m_keys[17] && !this.m_keys[32]) {
        //Control key
    	this.moveDown();
    }   

    //update only if one of WASD is pressed
    if (this.m_keys[17] || this.m_keys[32] || this.m_keys[65] || this.m_keys[68] || this.m_keys[83] || this.m_keys[87]){
    	    this.updateTranslation();
    }
    
    /**
     * Mouse event and controls
     */
    function handleMouseDown(event) {
    	_that.m_mouseDown = true;
    	_that.m_lastMouseX = event.clientX;
    	_that.m_lastMouseY = event.clientY;
    }
    
    function handleMouseUp(event) {
    	_that.m_mouseDown = false;
    }
    
    function handleMouseMove(event) {
    	if(_that.m_mouseDown == false) {
    		_that.m_yaw = 0;
    		_that.m_pitch = 0;
    		return;
    	}
    	var newX = event.clientX;
    	var newY = event.clientY;
    	
    	var deltaX = newX - _that.m_lastMouseX;
    	_that.m_yaw = -(deltaX *0.25) * (Math.PI/180);
    	
    	var deltaY = newY - _that.m_lastMouseY;
    	_that.m_pitch = (deltaY *0.25) * (Math.PI/180);
    	
    	_that.m_lastMouseX = newX;
    	_that.m_lastMouseY = newY;
    	
    	// apply the rotation
    	_that.updateRotation();
    }    
};


/**
 * Function to update the camera rotation
 */
Camera.prototype.updateRotation = function() {
	// get the right-vector
	vec3.cross(this.m_right, this.m_viewDirection, this.m_up);
	
	// rotate around the right-vector
	quat.setAxisAngle(this.m_quaternion, this.m_right, -this.m_pitch);
	
	// rotate the quaternion around y axis
	quat.rotateY(this.m_quaternion, this.m_quaternion, this.m_yaw);
	
	// transform the view direction with the rotation quaternion
	vec3.transformQuat(this.m_viewDirection, this.m_viewDirection, this.m_quaternion);

	// calculate the position the camera is looking at
	var _cameraLookAt = vec3.create();
	vec3.add(_cameraLookAt, this.m_viewDirection, this.m_position);
	
	// set up the view matrix
	mat4.lookAt(this.m_viewMatrix, this.m_position, _cameraLookAt, this.m_up);
	
	this.m_yaw = 0;
	this.m_pitch = 0;
};


/**
 * Function to update the camera translation
 */
Camera.prototype.updateTranslation = function() {
	vec3.scaleAndAdd(this.m_position, this.m_position, this.m_translationVector, this.m_sensitivity);
	// calculate the position the camera is looking at
	var _cameraLookAt = vec3.create();
	vec3.add(_cameraLookAt, this.m_viewDirection, this.m_position);
	// set up the view matrix
	mat4.lookAt(this.m_viewMatrix, this.m_position, _cameraLookAt, this.m_up);
	//reset translation vector
	this.m_translationVector = vec3.create();
};


