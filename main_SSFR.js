/*
 * Global variables
 */
/* global vec3 */

var gl, canvas, WebGLUtils, img;
var colorCount = 1;
var PROFILING_TIME = 300;

/**
 * Function to initialize WebGL and run the main function
 */
function initWebGL() {
	console.clear();
    canvas = document.getElementById("canvas");
    
    // This will hold our WebGL variable  
    gl = WebGLUtils.setupWebGL(canvas);  
    
    gl.lineWidth(2);
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    console.log("WebGL successfully set up.");
    
    main();
}


/**
 * Main function to run the WebGL Program
 */
function main() {
	// Variables for performance evaluation
    var constraintTime, ssfrTime, linearTime, lambdaTime, constraintShaderTime, viscosityTime, 
    particleDrawTime, colorMixTime, thicknessRenderTime, thicknessBlurTime, depthBlurTime, ssfrCompositeTime;
    var profiling = false;
    var frameStart, frameEnd, frameTime;

    // Profiling arrays
    var profilingArray = new Array();
    for(var i=0; i<14; i++) {
        profilingArray.push(new Array());
    }

    ////////////////////////////////
    // Camera
    var camera = new Camera();
    camera.setPosition(0, 3.8, 9.5);
        
    ////////////////////////////////
    // Shaders
    // Basic shader to draw on a fullscreen quad
    var shader = new Shader("shader/shader.vert", "shader/shader.frag", "Standard Shader");
    // This shader calculates the linear physical particle behaviour
    var particleShader = new Shader("shader/particleCalculations.vert", "shader/particleCalculations.frag", "Particle Shader");
    // This shader renders the particle vertices as point sprites
    var renderShader = new Shader("shader/particleRender.vert", "shader/particleRender.frag", "Render Shader");
    // This shader extracts the refraction layer for MCSSFR
    var refractionLayerShader = new Shader("shader/particleRender.vert", "shader/refractionLayerShader.frag", "Refraction Layer Shader");
    // This shader renders the lines of the bounding volume
    var lineShader = new Shader("shader/lineShader.vert", "shader/lineShader.frag", "Line Shader");
    // Light source shader, draws the light source as a unscaled point
    var lightSourceShader = new Shader("shader/lightSourceShader.vert", "shader/lightSourceShader.frag", "Light Source Shader");
    // This shader gets the particle neighbors and solves the density constraint for PBF
    var constraintShader = new Shader("shader/constraintShader.vert", "shader/constraintShader.frag", "Constraint Shader");
    // This shader computes the individual lambda values for PBF for each particle
    var lambdaShader = new Shader("shader/constraintShader.vert", "shader/lambdaShader.frag", "Lambda Shader");
    // This shader computes the viscosity and applies it to the velocities
    var viscosityShader = new Shader("shader/constraintShader.vert", "shader/viscosityShader.frag", "Viscosity Shader");
    // This shader computes the vorticity and updates the velocities
    // var vorticityShader = new Shader("shader/constraintShader.vert", "shader/vorticityShader.frag", "Vorticity Shader");
    // Blur shaders (Bilateral for Depth/Normals, Gaussian for thickness)
    var blurBiXShader = new Shader("shader/shader300.vert", "shader/blurBiXShader.frag", "Blur Shader (Bilateral Horizontal)");
    var blurBiYShader = new Shader("shader/shader300.vert", "shader/blurBiYShader.frag", "Blur Shader (Bilateral Vertical)");
    var blurGaussXShader = new Shader("shader/shader300.vert", "shader/blurGaussXShader.frag", "Blur Shader (Gauss Horizontal)");
    var blurGaussYShader = new Shader("shader/shader300.vert", "shader/blurGaussYShader.frag", "Blur Shader (Gauss Vertical)");
    // The main SSFR shader
    var ssfrShader = new Shader("shader/shader300.vert", "shader/ssfrShader.frag", "SSFR Shader");
    // No color mix, for comparison SSFR/MCSSFR
    var ssfrShaderNoMixing = new Shader("shader/shader300.vert", "shader/ssfrShaderNoMix.frag", "SSFR Shader No Mixing");
    // Render the fluid thickness
    var thicknessShader = new Shader("shader/particleRender.vert", "shader/thicknessShader.frag", "Thickness Shader");
    // Cubemap shader
    var cubeMapShader = new Shader("shader/cubeMap.vert", "shader/cubeMap.frag", "Cubemap Shader")
    
	////////////////////////////////
    // Scene
    var scene = new Scene();
    scene.setCamera(camera);
    
    // Function to set up the GUI
	setupGui();
    
    ////////////////////////////////
    // Particle system
    particleSystem = new ParticleSystem();
    scene.setParticleSystem(particleSystem);
    
    // Define an emitter
    var pos = vec3.fromValues(0, 0, 0);
    var rot = vec3.fromValues(0, 0, 0);
    var size = 10;
    var rate = 1;
    var vel = vec3.fromValues(0.1, 0.1, 0);
    var emitter = particleSystem.createEmitter(pos, rot, size, size, rate, vel);
    emitter.setPosition(0, 0, 0);
        
    ////////////////////////////////
    // GUI
    /**
	 * Initialize a GUI element
	 * This requires 'dat.gui.min.js'
	 */
	container = document.createElement('div');
	document.body.appendChild(container);
	
    /**
	 * Initialize an overlay for statistics (framerate)
	 * This requires 'stats.min.js'
	 */
	stats = new Stats();
	// for milliseconds: stats.setMode( 1 );
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.zIndex = 100;
	container.appendChild( stats.domElement );
	stats.domElement.children[ 0 ].children[ 0 ].style.color = "#aaa";
    

	////////////////////////////////
    // Update and render
    function render() {
    	stats.begin();
        frameStart = new Date().getTime();
    	
    	// Make sure the GUI values are passed to see the change immediately
    	updateInputValues();

    	// Render loop
        requestAnimFrame(render, canvas);

        // Add particles with keypress "p"
        if(camera.m_keys[80] == true) {
            emitter.emitParticle(hexToR(effectController.particleColor)/255, 
                hexToG(effectController.particleColor)/255, 
                hexToB(effectController.particleColor)/255, 
                effectController.alpha);
            emitter.m_emitting = true;
        }
        else {
        	emitter.m_emitting = false;
        }
        

        ///////////////////////////////////////////////
        // Render 
        start = new Date().getTime();
        // First run the program to calculate the predicted particle positions
        executeRenderCall(scene, particleShader, 1);
        end = new Date().getTime();
        linearTime = end - start;

        // Get the particle neighbors and solve the constraints
        if(effectController.enableConstraints) {
            start = new Date().getTime();

            start2 = new Date().getTime();
            // Compute the lagrange multipliers
    		executeRenderCall(scene, lambdaShader, 2);
            end2 = new Date().getTime();
            lambdaTime = end2 - start2;

            start3 = new Date().getTime();
            // Solve the density constraint for PBF
    		executeRenderCall(scene, constraintShader, 3);
            end3 = new Date().getTime();
            constraintShaderTime = end3 - start3;

            start4 = new Date().getTime();
            // Apply viscosity
            executeRenderCall(scene, viscosityShader, 4);
            end4 = new Date().getTime();
            viscosityTime = end4 - start4;
            // executeRenderCall(scene, vorticityShader, 13);

            end = new Date().getTime();
            constraintTime = end - start;
        }

        // Draw the scene background to framebuffer and texture
        // executeRenderCall(scene, shader, 2);
        // executeRenderCall(scene, shader, 17);

        // Render the Cubemap as background and to a texture
        executeRenderCall(scene, cubeMapShader, 11);
        executeRenderCall(scene, cubeMapShader, 12);

        // Draw the bounding volume
        if(effectController.showBounds)
            executeRenderCall(scene, lineShader, 16);
        
        start = new Date().getTime();
        
        start2 = new Date().getTime();
        // Draw the particles and compute the depth
        executeRenderCall(scene, renderShader, 5);
        end2 = new Date().getTime();
        particleDrawTime = end2 - start2;

        // Extract the refraction layer for MCSSFR
        start2 = new Date().getTime();
        if(!effectController.disableColorMixing)
            executeRenderCall(scene, refractionLayerShader, 10);
        end2 = new Date().getTime();
        colorMixTime = end2 - start2;
        
        start2 = new Date().getTime();
        // Compute the thickness
        executeRenderCall(scene, thicknessShader, 8);
        end2 = new Date().getTime();
        thicknessRenderTime = end2 - start2;

        // Blur the thickness
        start2 = new Date().getTime();
        if(effectController.ssfrThickness) {
        	executeRenderCall(scene, blurGaussXShader, 9);
        	executeRenderCall(scene, blurGaussYShader, 9);
        }
        end2 = new Date().getTime();
        thicknessBlurTime = end2 - start2;
        
        // Blur the depth
        start2 = new Date().getTime();
        if(effectController.ssfrBlur) {
        	executeRenderCall(scene, blurBiXShader, 6);
        	executeRenderCall(scene, blurBiYShader, 7);
        }
        end2 = new Date().getTime();
        depthBlurTime = end2 - start2;
        
        // Compute SSFR with or without color mixing
        start2 = new Date().getTime();
        if(effectController.disableColorMixing)
            executeRenderCall(scene, ssfrShaderNoMixing, 14);
        else
            executeRenderCall(scene, ssfrShader, 14);
        end2 = new Date().getTime();
        ssfrCompositeTime = end2 - start2;

        end = new Date().getTime();
        ssfrTime = end - start;

        // Draw the light source
        if(effectController.showLight)
        	executeRenderCall(scene, lightSourceShader, 15);
       
        frameEnd = new Date().getTime();
        frameTime = frameEnd - frameStart;
        stats.end();
    }


    render();
    
    
    
    // Additional functions
    /**
     * Function to render a scene with its assigned shader in the specified mode
     * @param {Scene} scene The WebGL scene to render
     * @param {Shader} shader The shader for the scene
     * @param {int} mode The render mode
     */
    function executeRenderCall(scene, shader, mode) {
    	shader.load();
    	scene.setShader(shader);
        ///////////////////////////////////////
        if(mode == 1)
            scene.solveLinearCalculations();
        else if(mode == 2)
            scene.solveLagrangeMultiplierPBF();
        else if(mode == 3)
            scene.solveConstraints();
        else if(mode == 4)
            scene.solveViscosity();
        else if(mode == 5)
            scene.renderParticles();
        else if(mode == 6)
            scene.blurDepthX();
        else if(mode == 7)
            scene.blurDepthY();
        else if(mode == 8)
            scene.renderThickness();
        else if(mode == 9)
            scene.blurThickness();
        else if(mode == 10)
            scene.renderRefraction();
        else if(mode == 11)
            scene.renderCubeMap();
        else if(mode == 12) 
            scene.cubeMapToTexture();
        else if(mode == 13) 
            scene.backgroundToTexture();
        else if(mode == 14)    
            scene.renderSSFR();
        else if(mode == 15) 
            scene.renderLightSource();
        else if(mode == 16) 
            scene.renderLines();
    }
    
    
    /**
     * Function to update all GUI values in the program
     */
    function updateInputValues() {

        // Pass the values from the GUI to the program

    	// Update exit velocity
    	emitter.m_exitVelocity = vec3.fromValues(effectController.exitVelocityX,
									    			effectController.exitVelocityY,
									    			effectController.exitVelocityZ);
    	// Update particle size
    	scene.m_pointSize = effectController.pointSize;

    	// Update gravity
        scene.m_gravity = effectController.gravity;
    	
    	// Smoothing kernel radius
    	scene.m_kernelRadius = effectController.kernelRadius;

    	// Color smoothing kernel radius
        scene.m_colorMixRadius = effectController.colorMixRadius;
    	
    	// Fluid rest density
    	scene.m_restDensity = effectController.restDensity;

    	// Fluid tensile instability
        scene.m_tensileInstability = effectController.tensileInstability;

        // Lambda correction / constraint relaxation
        scene.m_lambdaCorrection = effectController.lambdaCorrection;

        // Viscosity
        scene.m_viscosity = effectController.viscosity;
        // scene.m_vorticity = effectController.vorticity;

        // AMD/NVIDIA Bug
        scene.m_nvidia = effectController.nvidia;

        // Collision response
        scene.m_collResponse = effectController.collResponse;

        // Disable color mixing with MCSSFR
        scene.m_disableColorMixing = effectController.disableColorMixing;
    	
    	// Update emitter position
    	scene.m_particleSystem.getEmitter().setPosition(effectController.emitterPositionX,
    													effectController.emitterPositionY,
    													effectController.emitterPositionZ);
    	
    	// Change of bounding volume
    	particleSystem.setBoundingBox(vec3.fromValues(0, 0, 0), 
    		-effectController.xBound/2, effectController.xBound/2, 
    		-0.5, effectController.yBound, 
    		-effectController.zBound/2, effectController.zBound/2);
    	
    	// Circle light
    	// scene.m_lightPos = vec3.fromValues(effectController.lightPosX + Math.cos(Date.now()/1000),
    	// 									effectController.lightPosY, 
    	// 									effectController.lightPosZ + Math.sin(Date.now()/1000));

        // Static light
        scene.m_lightPos = vec3.fromValues(effectController.lightPosX,
                                            effectController.lightPosY, 
                                            effectController.lightPosZ);
    	
    	// SSFR passes
        scene.m_showParticles = effectController.showParticles;
        if(effectController.showParticles) {
            scene.m_pointSize = 0.15;
        }
    	scene.m_ssfrDepth = effectController.ssfrDepth;
    	scene.m_ssfrNormals = effectController.ssfrNormals;
    	scene.m_ssfrBlur = effectController.ssfrBlur;
    	scene.m_ssfrDiffuse = effectController.ssfrDiffuse;
    	scene.m_ssfrSpecular = effectController.ssfrSpecular;
    	scene.m_ssfrFresnel = effectController.ssfrFresnel;
    	scene.m_ssfrCubemap = effectController.ssfrCubemap;
        scene.m_ssfrReflection = effectController.ssfrReflection;
    	scene.m_ssfrThickness = effectController.ssfrThickness;
    	scene.m_ssfrAbsorption = effectController.ssfrAbsorption;
    	scene.m_ssfrRefraction = effectController.ssfrRefraction;
    	scene.m_ssfrTransparency = effectController.ssfrTransparency;
    	scene.m_ssfrShininess = effectController.ssfrShininess;
        scene.m_ssfrGamma = effectController.ssfrGamma;
    	scene.m_ssfrFresnelExponent = effectController.ssfrFresnelExponent;
        // scene.m_ssfrColorLayer = effectController.ssfrColorLayer;
    	// scene.m_blurSigma = effectController.blurSigma;
        scene.m_ssfrThicknessValue = effectController.ssfrThicknessValue;

        // Specular color
    	scene.m_specularColor = vec3.fromValues(hexToR(effectController.specularColor)/255, 
    			hexToG(effectController.specularColor)/255, 
    			hexToB(effectController.specularColor)/255);

    	// Particle color
        scene.m_particleColor = vec3.fromValues(hexToR(effectController.particleColor)/255, 
                hexToG(effectController.particleColor)/255, 
                hexToB(effectController.particleColor)/255);

        /////////////////////////////
        // HTML Display
        var particleCount = scene.m_particleSystem.getParticleArray().length / 4
        if(particleCount % 200 == 0 && particleCount > 0) {
            console.log("Particles: " + particleCount);
            console.log("Frame Time: " + frameTime + " ms");
        }
    	
    	document.getElementById("ParticleCountText").innerHTML = particleCount;
    	document.getElementById("MaxParticlesText").innerHTML = 
    		scene.m_particleSystem.m_textureSize * scene.m_particleSystem.m_textureSize;
        document.getElementById("SSFRPerformance").innerHTML = ssfrTime + "ms";
        document.getElementById("linearCalculations").innerHTML = linearTime + "ms";
        document.getElementById("lambdaShader").innerHTML = lambdaTime + "ms";
        document.getElementById("constraintShader").innerHTML = constraintShaderTime + "ms";
        document.getElementById("viscosityShader").innerHTML = viscosityTime + "ms";
        document.getElementById("particleDraw").innerHTML = particleDrawTime + "ms";
        document.getElementById("colorMixing").innerHTML = colorMixTime + "ms";
        document.getElementById("thicknessDraw").innerHTML = thicknessRenderTime + "ms";
        document.getElementById("thicknessBlur").innerHTML = thicknessBlurTime + "ms";
        document.getElementById("depthBlur").innerHTML = depthBlurTime + "ms";
        document.getElementById("ssfrComposite").innerHTML = ssfrCompositeTime + "ms";
        document.getElementById("readPositions").innerHTML = scene.m_readPositionsTime + "ms";        
        document.getElementById("readColors").innerHTML = scene.m_readColorsTime + "ms";

        // Log frame times
        if(profiling) {
            profilingArray[0].push(ssfrTime);
            profilingArray[1].push(linearTime);
            profilingArray[2].push(lambdaTime);
            profilingArray[3].push(constraintShaderTime);
            profilingArray[4].push(viscosityTime);
            profilingArray[5].push(particleDrawTime);
            profilingArray[6].push(colorMixTime);
            profilingArray[7].push(thicknessRenderTime);
            profilingArray[8].push(thicknessBlurTime);
            profilingArray[9].push(depthBlurTime);
            profilingArray[10].push(ssfrCompositeTime);
            profilingArray[11].push(scene.m_readPositionsTime);
            profilingArray[12].push(scene.m_readColorsTime);
            profilingArray[13].push(frameTime);

            if(profilingArray[0].length >= PROFILING_TIME)
                logProfileToConsole();
        }
    }
    
    // Console logging for performance evaluation
    function logProfileToConsole() {
        console.log("------------------------------------");
        console.log("-------------PROFILING--------------");
        console.log("------------------------------------");
        console.log("");
        console.log("Scene: " + effectController.selectScene)
        var sum = profilingArray[0].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("SSFR Time: " + sum);
        sum = profilingArray[1].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Linear Time: " + sum);
        sum = profilingArray[2].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Lambda Time: " + sum);
        sum = profilingArray[3].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Constraint Time: " + sum);
        sum = profilingArray[4].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Viscosity Time: " + sum);
        sum = profilingArray[5].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Particle Draw Time: " + sum);
        sum = profilingArray[6].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Color Mix Time: " + sum);
        sum = profilingArray[7].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Thickness Render Time: " + sum);
        sum = profilingArray[8].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Thickness Blur Time: " + sum);
        sum = profilingArray[9].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Depth Blur Time: " + sum);
        sum = profilingArray[10].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("SSFR Compositing Time: " + sum);
        sum = profilingArray[11].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Read Positions Time: " + sum);
        sum = profilingArray[12].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Read Colors Time: " + sum);
        sum = profilingArray[13].reduce(function(pv, cv) { return pv + cv; }, 0);
        sum /= PROFILING_TIME;
        console.log("Average Frame Time: " + sum);

        profiling = false;
        resetArray();

    }


    // GUI-activated functions:
    // Clear particles
    function resetScene() {
        scene.m_particleSystem.setParticleArray(new Array());
        scene.m_particleSystem.setParticleColorArray(new Array());
    }
    // Load a different cubemap
    function loadCubeMap(map) {
        scene.m_cubeMapTexture = scene.loadCubeMap(map);
    }
    // Reset performance times
    function resetArray() {
        profilingArray = new Array();
        for(var i=0; i<14; i++) {
            profilingArray.push(new Array());
        }
    }

    // Load a test scene
    function loadScene(sceneString) {
        if(sceneString == "Standard") {
            scene.m_sceneID = 0;
            resetScene();
            emitter.m_filled = false;
            effectController.xBound = 8;
            effectController.yBound = 8;
            effectController.zBound = 8;
            effectController.exitVelocityX = 4;
            effectController.exitVelocityY = 0;
            effectController.exitVelocityZ = 0;
            effectController.lambdaCorrection = 289;
            effectController.viscosity = 0.0038;
        }
        // Water shader for whole fluid
        if(sceneString == "Water") {
            scene.m_sceneID = 1;
        }
        // Classic dam break
        if(sceneString == "Dam Break") {
            scene.m_sceneID = 2;
            resetScene();
            emitter.m_filled = false;
            effectController.xBound = 8;
            effectController.yBound = 8;
            effectController.zBound = 4;
            particleSystem.setBoundingBox(vec3.fromValues(0, 0, 0), 
                                            -effectController.xBound/2, effectController.xBound/2, 
                                            -0.5, effectController.yBound, 
                                            -effectController.zBound/2, effectController.zBound/2);
            emitter.damBreak();
            effectController.enableConstraints = false;
            effectController.exitVelocityX = 0;
            effectController.exitVelocityY = 0;
            effectController.exitVelocityZ = 0;
            emitter.m_exitVelocity = vec3.fromValues(effectController.exitVelocityX,
                                                    effectController.exitVelocityY,
                                                    effectController.exitVelocityZ);
            scene.m_sceneID = 1;
            effectController.lambdaCorrection = 289;
            effectController.viscosity = 0.0038;
            effectController.tensileInstability = 0.02;
        }
        // Double dam break with different colors
        if(sceneString == "Dam Break Color") {
            scene.m_sceneID = 3;
            resetScene();
            emitter.m_filled = false;
            emitter.doubleDamBreak();
            effectController.xBound = 8;
            effectController.yBound = 8;
            effectController.zBound = 4;
            particleSystem.setBoundingBox(vec3.fromValues(0, 0, 0), 
                                            -effectController.xBound/2, effectController.xBound/2, 
                                            -0.5, effectController.yBound, 
                                            -effectController.zBound/2, effectController.zBound/2);
            effectController.enableConstraints = false;
            effectController.exitVelocityX = 0;
            effectController.exitVelocityY = 0;
            effectController.exitVelocityZ = 0;
            emitter.m_exitVelocity = vec3.fromValues(effectController.exitVelocityX,
                                                    effectController.exitVelocityY,
                                                    effectController.exitVelocityZ);
            effectController.lambdaCorrection = 332;
            effectController.viscosity = 0.0029;
            effectController.tensileInstability = 0.02;
        }
        // Opaque into transparent fluid
        if(sceneString == "Dam Break Refraction") {
            scene.m_sceneID = 4;
            resetScene();
            emitter.m_filled = false;
            emitter.damBreakRefraction();
            effectController.xBound = 8;
            effectController.yBound = 8;
            effectController.zBound = 4;
            particleSystem.setBoundingBox(vec3.fromValues(0, 0, 0), 
                                            -effectController.xBound/2, effectController.xBound/2, 
                                            -0.5, effectController.yBound, 
                                            -effectController.zBound/2, effectController.zBound/2);
            effectController.enableConstraints = false;
            effectController.exitVelocityX = 0;
            effectController.exitVelocityY = 0;
            effectController.exitVelocityZ = 0;
            emitter.m_exitVelocity = vec3.fromValues(effectController.exitVelocityX,
                                                    effectController.exitVelocityY,
                                                    effectController.exitVelocityZ);
            effectController.lambdaCorrection = 91;
            effectController.viscosity = 0.008;
        }
        // Drop a viscous blob into the scene
        if(sceneString == "Viscous Drops") {
            scene.m_sceneID = 5;
            // emitter.m_filled = false;
            emitter.colorDrop(Math.random());
            effectController.xBound = 4;
            effectController.yBound = 8;
            effectController.zBound = 4;
            particleSystem.setBoundingBox(vec3.fromValues(0, 0, 0), 
                                            -effectController.xBound/2, effectController.xBound/2, 
                                            -0.5, effectController.yBound, 
                                            -effectController.zBound/2, effectController.zBound/2);
            effectController.enableConstraints = true;
            effectController.exitVelocityX = 0;
            effectController.exitVelocityY = 0;
            effectController.exitVelocityZ = 0;
            emitter.m_exitVelocity = vec3.fromValues(effectController.exitVelocityX,
                                                    effectController.exitVelocityY,
                                                    effectController.exitVelocityZ);
            effectController.lambdaCorrection = 200;
            effectController.viscosity = 0.008;
        }
        // Four colors mixing
        if(sceneString == "4 Color Mix") {
            scene.m_sceneID = 6;
            resetScene();
            emitter.m_filled = false;
            emitter.fourColorMix();
            effectController.xBound = 8;
            effectController.yBound = 8;
            effectController.zBound = 4;
            particleSystem.setBoundingBox(vec3.fromValues(0, 0, 0), 
                                            -effectController.xBound/2, effectController.xBound/2, 
                                            -0.5, effectController.yBound, 
                                            -effectController.zBound/2, effectController.zBound/2);
            effectController.enableConstraints = false;
            effectController.exitVelocityX = 0;
            effectController.exitVelocityY = 0;
            effectController.exitVelocityZ = 0;
            emitter.m_exitVelocity = vec3.fromValues(effectController.exitVelocityX,
                                                    effectController.exitVelocityY,
                                                    effectController.exitVelocityZ);
            effectController.lambdaCorrection = 361;
            effectController.viscosity = 0.005;
            effectController.tensileInstability = 0.02;
        }
    }

    /**
     * Function to set up the GUI
     * Requires 'dat.gui.min.js'
     */
    function setupGui() {

    	effectController = {

			exitVelocityX: 4.0,
    		exitVelocityY: -0.2,
    		exitVelocityZ: 0.1,

    		pointSize: 0.28,

            gravity: -1,

    		emitterPositionX: -1.8,
    		emitterPositionY: 2.8,
    		emitterPositionZ: -0.5,

            reset: function() {resetScene();},

            selectScene: "Standard",
            loadScene: function() {loadScene(this.selectScene);},
            selectCubeMap: "standard",
            loadCubeMap: function() {loadCubeMap(this.selectCubeMap);},
            startSimulation: function(){this.enableConstraints = true; profiling = true; resetArray();},

            nvidia: true,
            collResponse: false,

    		lightPosX: -2.0,
    		lightPosY: 10.0,
    		lightPosZ: 10.0,
    		showLight: false,

    		blurSigma: 0.2,

            showParticles: false,

            disableColorMixing: false,

    		ssfrDepth: true,
    		ssfrNormals: true,
    		ssfrBlur: true,
    		ssfrDiffuse: true,
    		ssfrSpecular: true,
    		ssfrShininess: 20,
    		ssfrFresnel: true,
    		ssfrFresnelExponent: 50,
    		ssfrCubemap: false,
            ssfrReflection: 1.0,
    		ssfrThickness: true,
            ssfrThicknessValue: 0.4,
    		ssfrAbsorption: true,
    		ssfrRefraction: true,
            ssfrGamma: 1.1,
    		ssfrTransparency: 0.2,
            ssfrColorLayer: 0,
    		SSFR: true,

    		enableConstraints: true,
    		kernelRadius: 0.86,
            colorMixRadius: 0.86,
    		restDensity: 40,
            tensileInstability: 0.03,
            lambdaCorrection: 262,
            viscosity: 0.0063,
            vorticity: 0,

            concentration: 0.5,

    		xBound: 8,
    		yBound: 8,
    		zBound: 8,

    		// fluidColor: "#0025ff",
            particleColor: "#1D89F5",
            alpha: 0.7,
    		// ambientColor: "#000000",
    		specularColor: "#ffffff",

            showBounds: true
    	};
    	
    	// Create a new GUI
    	gui = new dat.GUI({width: 500});
    	
    	// Emitter properties
    	h = gui.addFolder("Emitter Properties");
   	    h.open();
        h.add(effectController, "reset").name("Clear Particles");
        h.add(effectController, "selectScene", ["Standard", "Dam Break", "Dam Break Color", "Dam Break Refraction", 
            "Viscous Drops", "4 Color Mix", "Water"]).name("Select Scene");
        h.add(effectController, "loadScene").name("Load Scene");
        h.add(effectController, "selectCubeMap", ["standard", "white", "ocean", "space", "sunset"]).name("Select Cubemap");
        h.add(effectController, "loadCubeMap").name("Load Cubemap");
        h.add(effectController, "startSimulation").name("Start Simulation");
        h.add(effectController, "showBounds").name("Show Bounding Volume");
        h.addColor(effectController, "particleColor").name("Particle Color");
        h.add(effectController, "alpha", 0, 1, 0.1).name("Alpha");
    	// Emitter exit velocity
    	h.add(effectController, "exitVelocityX", -10.0, 10.0, 0.1).name("Exit Velocity X");
    	h.add(effectController, "exitVelocityY", -10.0, 10.0, 0.1).name("Exit Velocity Y");
    	h.add(effectController, "exitVelocityZ", -10.0, 10.0, 0.1).name("Exit Velocity Z");
    	// Emitter position
    	h.add(effectController, "emitterPositionX", -8.0, 8.0, 0.1).name("Emitter Position X");
    	h.add(effectController, "emitterPositionY", -0.5, 6.0, 0.1).name("Emitter Position Y");
    	h.add(effectController, "emitterPositionZ", -8.0, 8.0, 0.1).name("Emitter Position Z");
    	
    	// Point properties
    	i = gui.addFolder("Simulation Properties");
    	i.open();
    	// Particle size
    	i.add(effectController, "xBound", 1.0, 8.0, 0.2).name("X Boundary");
    	i.add(effectController, "yBound", 1.0, 8.0, 0.2).name("Y Boundary");
    	i.add(effectController, "zBound", 1.0, 8.0, 0.2).name("Z Boundary");
    	i.add(effectController, "pointSize", 0.01, 1.0, 0.01).name("Point Size");
        i.add(effectController, "gravity", -3.0, 1.0, 0.01).name("Gravity");
    	i.add(effectController, "enableConstraints").name("Enable PBF");
        i.add(effectController, "nvidia").name("NVIDIA GPU");
        // i.add(effectController, "collResponse").name("Collision Response");
    	// i.add(effectController, "kernelRadius", 0.2, 2.0, 0.1).name("Kernel Radius");
        i.add(effectController, "colorMixRadius", 0.2, 1.0, 0.1).name("Color Mix Radius");
    	// i.add(effectController, "restDensity", 1, 250, 1).name("Rest Density");
        i.add(effectController, "tensileInstability", 0.00, 0.1, 0.01).name("Tensile Instability");
        i.add(effectController, "lambdaCorrection", 5, 500, 1).name("Constraint Relaxation");
        i.add(effectController, "viscosity", 0, 0.01, 0.001).name("Viscosity");
        // i.add(effectController, "vorticity", 0, 500, 1).name("Vorticity Epsilon");
    	
    	// SSFR passes
    	k = gui.addFolder("SSFR Passes");
    	k.open();
        k.add(effectController, "disableColorMixing").name("Disable Color Mixing");
        k.add(effectController, "showParticles").name("Show Particles");
    	k.add(effectController, "ssfrDepth").name("Depth");
    	k.add(effectController, "ssfrBlur").name("Blur");
    	k.add(effectController, "ssfrNormals").name("Normals");
    	k.add(effectController, "ssfrThickness").name("Thickness");
        i.add(effectController, "ssfrThicknessValue", 0.001, 1.0, 0.001).name("Thickness");
    	k.add(effectController, "ssfrDiffuse").name("Diffuse");
    	k.add(effectController, "ssfrSpecular").name("Specular");
    	k.add(effectController, "ssfrShininess", 1, 20, 1).name("Shininess");
        k.addColor(effectController, "specularColor").name("Specular Color");
    	k.add(effectController, "ssfrFresnel").name("Fresnel");
    	k.add(effectController, "ssfrFresnelExponent", 1, 50, 1).name("Fresnel Exponent");
    	k.add(effectController, "ssfrCubemap").name("Cubemap");
        k.add(effectController, "ssfrReflection", 0, 1, 0.1).name("Reflection");
        k.add(effectController, "ssfrGamma", 0, 3, 0.1).name("Gamma");
    	k.add(effectController, "ssfrAbsorption").name("Absorption");
    	k.add(effectController, "ssfrRefraction").name("Refraction");
    	// k.add(effectController, "ssfrTransparency", 0, 500, 1).name("Transparency");
        // k.add(effectController, "ssfrColorLayer", [0, 1, 2, 3, 4, 5, 6, 7]).name("Layer");
    	
    	// Blur properties
    	// l = gui.addFolder("Blur Properties");
    	// l.open();
    	// l.add(effectController, "blurSigma", 0.0, 0.5, 0.01).name("Blur Sigma");
    	
    	// Shading parameters
    	j = gui.addFolder("Shading Parameters");
    	// j.open();
    	j.add(effectController, "showLight").name("Show Light Source");
    	// Light direction
    	j.add(effectController, "lightPosX", -10.0, 10.0, 0.1).name("Light Position X");
    	j.add(effectController, "lightPosY", -10.0, 10.0, 0.1).name("Light Position Y");
    	j.add(effectController, "lightPosZ", -10.0, 10.0, 0.1).name("Light Position Z");
    }
}






// Additional functions:

// Convert hex to rgb
function hexToR(h) {return parseInt((cutHex(h)).substring(0,2),16);}
function hexToG(h) {return parseInt((cutHex(h)).substring(2,4),16);}
function hexToB(h) {return parseInt((cutHex(h)).substring(4,6),16);}
function cutHex(h) {return (h.charAt(0)=="#") ? h.substring(1,7):h;}

// Convert rgb to hex
function rgbToHex(R,G,B) {return toHex(R)+toHex(G)+toHex(B);}
function toHex(n) {
 n = parseInt(n,10);
 if (isNaN(n)) return "00";
 n = Math.max(0,Math.min(n,255));
 return "0123456789ABCDEF".charAt((n-n%16)/16)
      + "0123456789ABCDEF".charAt(n%16);
}