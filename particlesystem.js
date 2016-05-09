/* global vec3 */

/*********************
 * 
 * Particle System Class
 * 
 *********************/


function ParticleSystem() {
    // Emitter Array
    this.m_emitterArray = new Array();
    
    // Texture size, defines the maximum amount of particles, which is (textureSize * textureSize)
    this.m_textureSize = 64;

    // Bin size, important for PBF performance, do not change
    this.BINSIZE = 0.4;

    this.m_binSize = this.BINSIZE;
    this.m_binSizeInv = 1 / this.m_binSize;
    
    this.m_filled = false;
    
    // Bounding Box that limits particle movement
    this.m_boundingBox = new BoundingBox();
    this.m_boundingBox.set(vec3.fromValues(0, 0, -1), 
    		-effectController.xBound/2, effectController.xBound/2, 
    		-0.5, effectController.yBound, 
    		-effectController.zBound/2, effectController.zBound/2);
    
    // Initialize the spatial binning structure based ob the bounding volume
    this.initializeBins();
    
    console.log("Particlesystem initialized.");
}

ParticleSystem.prototype.getParticleArray = function() {
	return this.m_emitterArray[0].m_particleArray;
};

ParticleSystem.prototype.setParticleArray = function(array) {
	this.m_emitterArray[0].m_particleArray = array;
};

ParticleSystem.prototype.getParticleColorArray = function() {
	return this.m_emitterArray[0].m_particleColorArray;
};

ParticleSystem.prototype.setParticleColorArray = function(array) {
	this.m_emitterArray[0].m_particleColorArray = array;
};

ParticleSystem.prototype.getEmitter = function() {
	return this.m_emitterArray[0];
};

ParticleSystem.prototype.getTextureSize = function() {
	return this.m_textureSize;
};

ParticleSystem.prototype.setBoundingBox = function(position, xMin, xMax, yMin, yMax, zMin, zMax) {
	this.m_boundingBox.set(position, xMin, xMax, yMin, yMax, zMin, zMax);
	this.initializeBins();
};

ParticleSystem.prototype.getBoundingBox = function() {
	return this.m_boundingBox;
};

/**
 * Create an emitter for the particle system
 * @param {vec3} emitterPosition The position of the emitter
 * @param {vec3} emitterRotation The rotation of the emitter
 * @param {float} emitterWidth The width of the emitter
 * @param {float} emitterHeight The height of the emitter
 * @param {float} emitterRate The emission rate in particles per second
 * @param {float} emitterVelocity The exit velocity of the particles
 * @returns {Emitter}
 */ 
ParticleSystem.prototype.createEmitter = function(  emitterPosition, 
                                                    emitterRotation, 
                                                    emitterWidth,
                                                    emitterHeight,
                                                    emitterRate, 
                                                    emitterVelocity) {
    var emitter = new Emitter();
    emitter.m_position = emitterPosition;
    emitter.m_rotation = emitterRotation;
    emitter.m_width = emitterWidth;
    emitter.m_height = emitterHeight;
    emitter.m_emissionRate = emitterRate;
    emitter.m_exitVelocity = emitterVelocity;
    
    this.m_emitterArray.push(emitter);
    
    return emitter;
};

/**
 * Function to update the particle system
 */
ParticleSystem.prototype.update = function() {
    var emitter;
    // Loop over all emitters 
    for(var i=0; i<this.m_emitterArray.length; i++) {
        emitter = this.m_emitterArray[i];
        emitter.update();
    }
};


ParticleSystem.prototype.initializeBins = function() {
	// Separate the volume containing particles into same-sized bins
	// Here we use the bounding volume for simplicity
	
	// Min and max vertices that span the particle domain
	if(this.m_sortingInitialized == null) {

		this.m_volMin = vec3.fromValues(this.m_boundingBox.m_xMin,
				this.m_boundingBox.m_yMin,
				this.m_boundingBox.m_zMin);
		vec3.subtract(this.m_volMin, this.m_volMin, vec3.fromValues(this.m_binSize, this.m_binSize, this.m_binSize));

		this.m_volMax = vec3.fromValues(this.m_boundingBox.m_xMax,
				this.m_boundingBox.m_yMax,
				this.m_boundingBox.m_zMax);
		vec3.add(this.m_volMax, this.m_volMax, vec3.fromValues(this.m_binSize, this.m_binSize, this.m_binSize));

		this.m_xBinCount = Math.ceil((this.m_volMax[0] - this.m_volMin[0]) * this.m_binSizeInv);
		this.m_yBinCount = Math.ceil((this.m_volMax[1] - this.m_volMin[1]) * this.m_binSizeInv);
		this.m_zBinCount = Math.ceil((this.m_volMax[2] - this.m_volMin[2]) * this.m_binSizeInv);
		
		this.m_xMin = (Math.round(this.m_volMin[0]*10) * 0.1);
		this.m_yMin = (Math.round(this.m_volMin[1]*10) * 0.1);
		this.m_zMin = (Math.round(this.m_volMin[2]*10) * 0.1);

		this.m_binArraySize = this.m_xBinCount * this.m_yBinCount * this.m_zBinCount;
		
		this.m_sortingInitialized = true;
	}
};


/**
 * This function cuts the bounding volume into equally sized bins
 * and assigns each particle a bin ID for further sorting 
 * @returns {Array}
 */
ParticleSystem.prototype.binParticles = function() {	
	
	this.m_pArray = this.getParticleArray();
	this.m_binArray = new Array();
	
	// 3D bin array can store up to 4 particles per bin
	var _bin3DArray = new Array(this.m_binArraySize);
	
	// Get the bin ID for each particle
	for(var i=0; i<this.m_pArray.length/4; i++) {
		// Particle coordinates
		var _pX = this.m_pArray[i*4];
		var _pY = this.m_pArray[i*4 + 1];
		var _pZ = this.m_pArray[i*4 + 2];
		
		// Compute local bin IDs
		var _xID = Math.floor((_pX - this.m_xMin) * this.m_binSizeInv);
		var _yID = Math.floor((_pY - this.m_yMin) * this.m_binSizeInv);
		var _zID = Math.floor((_pZ - this.m_zMin) * this.m_binSizeInv);
		
		// Shift border bins one bin into the domain
		if(_xID == this.m_xBinCount) _xID = this.m_xBinCount-1;
		if(_yID == this.m_yBinCount) _yID = this.m_yBinCount-1;
		if(_zID == this.m_zBinCount) _zID = this.m_zBinCount-1;
		
		// Clamp these values
		_xID = clamp(0, this.m_xBinCount, _xID);
		_yID = clamp(0, this.m_yBinCount, _yID);
		_zID = clamp(0, this.m_zBinCount, _zID);
		
		// Compute global bin IDs
		this.m_binID = _xID + _yID * this.m_xBinCount;
		this.m_binID += _zID * this.m_xBinCount * this.m_yBinCount;
		this.m_binArray.push(this.m_binID);


		// Put the particle indices in the corresponding bins (max 4 particles per bin)
		// If the bin is empty, create an array for it
		if(!_bin3DArray[this.m_binID])
			_bin3DArray[this.m_binID] = [];

		// If there are less than 4 particles in the bin, push the current index to the array
		if(_bin3DArray[this.m_binID].length < 4) {
			_bin3DArray[this.m_binID].push(i);
		}
	}


	/***********************************************
	 * TODO: Possible bottleneck on CPU side!!!
	 */
	// Fill up the 3D array with -1s
	for(var i=0; i<_bin3DArray.length; i++) {
		if(!_bin3DArray[i]) {
			_bin3DArray[i] = [-1, -1, -1, -1];
		}
		else {
			for(var j=0; j<4; j++) {
				if(!_bin3DArray[i][j] && _bin3DArray[i][j] != 0) {
					_bin3DArray[i][j] = -1;
				}
			}
		}
	}
	
	// Flatten the array so it fits into a 3D texture
	_bin3DArray = [].concat.apply([], _bin3DArray);
	
	function clamp(a, b, x) {
		return Math.max(a, Math.min(x, b));
	}

	return [this.m_binArray, _bin3DArray];
};

/***********************
 * 
 * Emitter Class
 * 
 ***********************/

function Emitter() {
    // Identifier
    this.m_emitterID;
    
    // Position
    this.m_emitterPosition = vec3.create();
    
    // Rotation
    this.m_emitterRotation = vec3.create();
    
    // Size
    this.m_emitterWidth;
    this.m_emitterHeight;
    
    // Emission Rate
    this.m_emissionRate;
    
    // Exit Velocity of Particles
    this.m_exitVelocity = vec3.create();
    
    // Is Emitter emitting?
    this.m_emitting = false;
    
    // Array of particles
    this.m_particleArray = new Array();

    // Particle Color
    this.m_particleColor = vec4.create();
    this.m_particleColorArray = new Array();
}

Emitter.prototype.setPosition = function(xPos, yPos, zPos) {
    this.m_emitterPosition = vec3.fromValues(xPos, yPos, zPos);
};

Emitter.prototype.setRotation = function(xRot, yRot, zRot) {
    this.m_emitterRotation = vec3.fromValues(xRot, yRot, zRot);
};

Emitter.prototype.setColor = function(R, G, B, A) {
	this.m_particleColor = vec4.fromValues(R, G, B, A);
}



/**
 * Function to emit a particle with a given color and alpha value
 */
Emitter.prototype.emitParticle = function(r, g, b, a) {
	
	var lambda = 0.2;
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1]);
	this.m_particleArray.push(this.m_emitterPosition[2]);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1]);
	this.m_particleArray.push(this.m_emitterPosition[2] + lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1]);
	this.m_particleArray.push(this.m_emitterPosition[2] - lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] - lambda);
	this.m_particleArray.push(this.m_emitterPosition[2]);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] + lambda);
	this.m_particleArray.push(this.m_emitterPosition[2]);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] + lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] + lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] + lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] - lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] - lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] + lambda);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] - lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] - lambda);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1]);
	this.m_particleArray.push(this.m_emitterPosition[2] + 2*lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1]);
	this.m_particleArray.push(this.m_emitterPosition[2] - 2*lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] - 2*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2]);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] + 2*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2]);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] + 2*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] + 2*lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] + 2*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] - 2*lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] - 2*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] + 2*lambda);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] - 2*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] - 2*lambda);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1]);
	this.m_particleArray.push(this.m_emitterPosition[2] + 3*lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1]);
	this.m_particleArray.push(this.m_emitterPosition[2] - 3*lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] - 3*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2]);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] + 3*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2]);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] + 3*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] + 3*lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] + 3*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] - 3*lambda);
	this.m_particleArray.push(1.0);
	
	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] - 3*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] + 3*lambda);
	this.m_particleArray.push(1.0);

	this.m_particleArray.push(this.m_emitterPosition[0]);
	this.m_particleArray.push(this.m_emitterPosition[1] - 3*lambda);
	this.m_particleArray.push(this.m_emitterPosition[2] - 3*lambda);
	this.m_particleArray.push(1.0);

	for(var i=0; i<25; i++) {
		this.m_particleColorArray.push(r);
		this.m_particleColorArray.push(g);
		this.m_particleColorArray.push(b);
		this.m_particleColorArray.push(a);
	}
	
	
};


// For Debugging
// Emitter.prototype.setTestCase = function() {
// 	// Create a front layer with transparent particles
// 	// and a opaque layer behind it
// 	if(!this.m_filled) {
// 		// Front:
// 		for(var x=-1; x<=1; x+=0.175) {
// 			for(var y=0; y<=2; y+=0.175) {
// 				for(var z=2; z>1; z-= 0.175) {
// 					this.m_particleArray.push(x);
// 					this.m_particleArray.push(y);
// 					this.m_particleArray.push(z);
// 					this.m_particleArray.push(1.0);

// 					this.m_particleColorArray.push(0);
// 					this.m_particleColorArray.push(0);
// 					this.m_particleColorArray.push(0);
// 					this.m_particleColorArray.push(0);
// 				}
// 			}
// 		}

// 		// Back:
// 		for(var x=0; x<=2; x+=0.175) {
// 			for(var y=0; y<=2; y+=0.175) {
// 				for(var z=-1; z>-2; z-= 0.175) {
// 					this.m_particleArray.push(x);
// 					this.m_particleArray.push(y);
// 					this.m_particleArray.push(z);
// 					this.m_particleArray.push(1.0);

// 					this.m_particleColorArray.push(1);
// 					this.m_particleColorArray.push(0);
// 					this.m_particleColorArray.push(0);
// 					this.m_particleColorArray.push(1);
// 				}
// 			}
// 		}

// 		this.m_filled = true;
// 	}

// };



// Emitter.prototype.randomizeParticles = function(particleCount, boundingBox) {
// 	for(var i=0; i<particleCount; i++) {
// 		this.m_particleArray.push(getRandomArbitrary(boundingBox.m_position[0] + boundingBox.m_xMin, boundingBox.m_position[0] + boundingBox.m_xMax));
// 		this.m_particleArray.push(getRandomArbitrary(boundingBox.m_position[1] + boundingBox.m_yMin, boundingBox.m_position[1] + boundingBox.m_yMax));
// 		this.m_particleArray.push(getRandomArbitrary(boundingBox.m_position[2] + boundingBox.m_zMin, boundingBox.m_position[2] + boundingBox.m_zMax));
// 		this.m_particleArray.push(1.0);
// 	}
	
// 	function getRandomArbitrary(min, max) {
// 		return Math.random() * (max - min) + min;
// 	}
// };




/*
 * Set up a dam break simulation scenario
 */
Emitter.prototype.damBreak = function() {
	var delta = 0.3;
	if(!this.m_filled) {
		for(var x = -3.6; x <= -1.0; x += delta) {
			for (var y = 0.4; y <= 7.6; y += delta) {
				for(var z = -1.6; z <= 1.6; z += delta) {
					this.m_particleArray.push(x);
					this.m_particleArray.push(y);
					this.m_particleArray.push(z);
					this.m_particleArray.push(1.0);

					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0.1);
					this.m_particleColorArray.push(1.0);
					this.m_particleColorArray.push(0.5);
				}
			}
		}
	}

	this.m_filled = true;
}



/*
 * Set up a double dam break for a color mixing simulation
 */
Emitter.prototype.doubleDamBreak = function() {
	var delta = 0.3;
	if(!this.m_filled) {
		// Left blue pillar
		for(var x = -3.6; x <= -2.0; x += delta) {
			for (var y = 0.4; y <= 7.6; y += delta) {
				for(var z = -1.6; z <= 1.6; z += delta) {
					this.m_particleArray.push(x);
					this.m_particleArray.push(y);
					this.m_particleArray.push(z);
					this.m_particleArray.push(1.0);

					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(1);
					this.m_particleColorArray.push(0.5);
				}
			}
		}

		// Right red pillar
		for(var x = 2.0; x <= 3.6; x += delta) {
			for (var y = 0.4; y <= 7.6; y += delta) {
				for(var z = -1.6; z <= 1.6; z += delta) {
					this.m_particleArray.push(x);
					this.m_particleArray.push(y);
					this.m_particleArray.push(z);
					this.m_particleArray.push(1.0);

					this.m_particleColorArray.push(1);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(1.0);
				}
			}
		}

		// Middle green pillar
		// for(var x = -0.8; x <= 0.8; x += delta) {
		// 	for (var y = 0.4; y <= 7.6; y += delta) {
		// 		for(var z = -1.6; z <= 1.6; z += delta) {
		// 			this.m_particleArray.push(x);
		// 			this.m_particleArray.push(y);
		// 			this.m_particleArray.push(z);
		// 			this.m_particleArray.push(1.0);

		// 			this.m_particleColorArray.push(0);
		// 			this.m_particleColorArray.push(1);
		// 			this.m_particleColorArray.push(0);
		// 			this.m_particleColorArray.push(0.6);
		// 		}
		// 	}
		// }
	}

	this.m_filled = true;
}


/*
 * Set up a simulation to showcase fluid refraction
 */
Emitter.prototype.damBreakRefraction = function() {
	var delta = 0.3;
	if(!this.m_filled) {
		// Transparent base
		for(var x = -3.6; x <= 3.6; x += delta) {
			for (var y = -0.2; y <= 3.0; y += delta) {
				for(var z = -1.6; z <= 1.6; z += delta) {
					this.m_particleArray.push(x);
					this.m_particleArray.push(y);
					this.m_particleArray.push(z);
					this.m_particleArray.push(1.0);

					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0);
				}
			}
		}

		// Middle opaque pillar
		for(var x = -1.8; x <= 1.8; x += delta) {
			for (var y = 5.5; y <= 7.6; y += delta) {
				for(var z = -1.6; z <= 1.6; z += delta) {
					this.m_particleArray.push(x);
					this.m_particleArray.push(y);
					this.m_particleArray.push(z);
					this.m_particleArray.push(1.0);

					this.m_particleColorArray.push(1);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(1);
				}
			}
		}
	}

	this.m_filled = true;
}


/*
 * Drop a random color blob
 */
Emitter.prototype.colorDrop = function(rand) {
	var delta = 0.3;
	var R, G, B = 0;
	if(rand < 0.2) {
			R = 1; G = 0; B = 0;
	}
	else if(rand >= 0.2 && rand < 0.4) {
		R = 0; G = 1; B = 0;
	}
	else if(rand >= 0.4 && rand < 0.6) {
		R = 0; G = 0; B = 1;
	}
	else if(rand >= 0.6 && rand < 0.8) {
		R = 1; G = 1; B = 0;
	}
	else if(rand >= 0.8 && rand < 1.0) {
		R = 0; G = 1; B = 1;
	}


	// Middle opaque pillar
	for(var x = -1.0; x <= 1.0; x += delta) {
		for (var y = 4; y <= 6; y += delta) {
			for(var z = -1.0; z <= 1.0; z += delta) {
				this.m_particleArray.push(x);
				this.m_particleArray.push(y);
				this.m_particleArray.push(z);
				this.m_particleArray.push(1.0);

				this.m_particleColorArray.push(R);
				this.m_particleColorArray.push(G);
				this.m_particleColorArray.push(B);
				this.m_particleColorArray.push(1);
			}
		}
	}

}


/*
 * Simulation setup with four different colors
 */
Emitter.prototype.fourColorMix = function() {
	var delta = 0.3;
	if(!this.m_filled) {
		// Bottom left
		for(var x = -3.6; x <= -0.5; x += delta) {
			for (var y = -0.2; y <= 3.0; y += delta) {
				for(var z = -1.6; z <= 1.6; z += delta) {
					this.m_particleArray.push(x);
					this.m_particleArray.push(y);
					this.m_particleArray.push(z);
					this.m_particleArray.push(1.0);

					this.m_particleColorArray.push(1);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(1);
				}
			}
		}

		// Bottom right
		for(var x = 0.5; x <= 3.6; x += delta) {
			for (var y = -0.2; y <= 3.0; y += delta) {
				for(var z = -1.6; z <= 1.6; z += delta) {
					this.m_particleArray.push(x);
					this.m_particleArray.push(y);
					this.m_particleArray.push(z);
					this.m_particleArray.push(1.0);

					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(1);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0.4);
				}
			}
		}

		// Top left
		for(var x = -3.6; x <= -0.5; x += delta) {
			for (var y = 4.0; y <= 6.8; y += delta) {
				for(var z = -1.6; z <= 1.6; z += delta) {
					this.m_particleArray.push(x);
					this.m_particleArray.push(y);
					this.m_particleArray.push(z);
					this.m_particleArray.push(1.0);

					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(1);
					this.m_particleColorArray.push(0.8);
				}
			}
		}

		// Top right
		for(var x = 0.5; x <= 3.6; x += delta) {
			for (var y = 4.0; y <= 6.8; y += delta) {
				for(var z = -1.6; z <= 1.6; z += delta) {
					this.m_particleArray.push(x);
					this.m_particleArray.push(y);
					this.m_particleArray.push(z);
					this.m_particleArray.push(1.0);

					this.m_particleColorArray.push(1);
					this.m_particleColorArray.push(1);
					this.m_particleColorArray.push(0);
					this.m_particleColorArray.push(1.0);
				}
			}
		}
	}

	this.m_filled = true;
}




/*********************
 * 
 * Particle Class
 * 
 *********************/

function Particle() {
    // Mass (float)
    this.m_invMass = 1.0;
    
    // Position (vec3)
    this.m_particlePosition = vec3.create();
    
    // Velocity (vec3)
    this.m_particleVelocity = vec3.create();
    
    // Phase Identifier (integer)
    this.m_phase = 0;
}



// Test
function Particle2() {
	this.m_posX = 0.0;
	this.m_posY = 0.0;
	this.m_posZ = 0.0;
	
	this.m_invMass = 0.0;
	
}


/***********************
 * Bounding Box Class
 */
function BoundingBox() {
	this.m_position = vec3.create();
	this.m_xMin = 0.0;
	this.m_xMax = 0.0;
	this.m_yMin = 0.0;
	this.m_yMax = 0.0;
	this.m_zMin = 0.0;
	this.m_zMax = 0.0;
	
BoundingBox.prototype.set = function(pos, xMin, xMax, yMin, yMax, zMin, zMax) {
	this.m_position = pos;
	this.m_xMin = xMin;
	this.m_xMax = xMax;
	this.m_yMin = yMin;
	this.m_yMax = yMax;
	this.m_zMin = zMin;
	this.m_zMax = zMax;
};
	
}







