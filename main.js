//Author: Nicholas Dean
//Update step takes an where one pixel contains
//the position and angle of each particle. Updates the position
//and angle and draws this to a texture.
//draw step is needed to take the particle state texture
//and draw the individual particles on a bufffer.
//then, the trail step sopies that buffer, applies blur
//and isn't cleared each frame. This simulates diffusion trails. 
//This image is fed back to the update step to influence
//the steering and complete the effect.

//Render step takes the output of the trail step and draws it to the canvas.

"use strict"

const queryParams = new URLSearchParams(window.location.search);
const PARTICLE_TEXTURE_WIDTH = queryParams.has("wi") ? queryParams.get("wi") : 1000;
const PARTICLE_TEXTURE_HEIGHT = queryParams.has("he") ? queryParams.get("he") : PARTICLE_TEXTURE_WIDTH;
const PI = 3.141592;
const TAU = PI * 2;


let SA =                 queryParams.has("sa") ? rad(queryParams.get("sa")) : rad(35.5);
let RA =                 queryParams.has("ra") ? rad(queryParams.get("ra")) : rad(22.5);
let SO =                 queryParams.has("so") ? queryParams.get("so") : 3;
let evapourationAmount = queryParams.has("ea") ? queryParams.get("ea") : 0.90;
let diffusionAmount    = queryParams.has("da") ? queryParams.get("da") : 0.98;
let speed =              queryParams.has("sp") ? queryParams.get("sp") : 1;
let RED =                queryParams.has("re") ? queryParams.get("re") : 50;
let GREEN =              queryParams.has("gr") ? queryParams.get("gr") : 128;
let BLUE =               queryParams.has("bl") ? queryParams.get("bl") : 255;

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    const typeString = {};
    typeString[gl.VERTEX_SHADER] = "vertex";
    typeString[gl.FRAGMENT_SHADER] = "fragment";

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(`Unable to compile ${typeString[type]} shader: ` + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Unable to init shader program: " + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function getIndicesData(width, height) {
    const data = new Float32Array(width * height * 2);

    for (let h = 0; h < height; ++h) {
        for (let w = 0; w < width; ++w) {
            const i = h * 2 * width + w * 2;
            
            data[i] = w;
            data[i+1] = h;
        }
    }

    return data;
}

function getStartingStateImage() {
    const imageData = new Float32Array(
        PARTICLE_TEXTURE_HEIGHT * PARTICLE_TEXTURE_WIDTH * 4);
    const size = 400;

    for (let i = 0; i < imageData.length; i += 4) {
        const angle = Math.random() * TAU;
        imageData[i] =   canvas.width / 2 +  Math.random() * size * Math.cos(angle);    //x pos
        imageData[i+1] = canvas.height / 2 + Math.random() * size * Math.sin(angle); // y pos
        imageData[i+2] = angle + PI;
        // imageData[i+3] = 0; //free space for now
    }

    return imageData;
}

function getUniforms(gl, program, names) {
    const uniforms = {};

    for (const name of names) {
        uniforms[name] = gl.getUniformLocation(program, name);
    }

    return uniforms;
}

function initialiseRenderTexture(gl, texture, width, height, data) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D, // target
        0,             // level
        gl.RGBA32F,    // internalformat
        width,         // width
        height,        // height
        0,             // border
        gl.RGBA,       // format
        gl.FLOAT,      // type
        data,          // srcData
        0              // srcOffset
    );

    //egba32f is not texture_filterable, so disable filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
}

function rad(deg) {
    return deg * (PI / 180);
}

const updateVS = `#version 300 es
    precision highp float;

    in vec2 position;

    void main() {
        gl_Position = vec4(position, 0., 1.);
    }
`;

const updateFS = `#version 300 es
    precision highp float;

    out vec4 outColour;
    uniform sampler2D prevState;
    uniform sampler2D world;
    uniform ivec2 canvasSize;

    float h21(vec2 p) {
        float f = dot(p,sin(p + 4.112355738918707) * 9.32761923879);
        return fract(f + cos(fract(f * p[0]) * 2.92736158));
    }

    bool inBounds(ivec2 p) {
        return p.x >= 0 && p.x < canvasSize.x && p.y >= 0 && p.y < canvasSize.y;
    }

    bool inBounds(vec2 p) {
        return inBounds(ivec2(p));
    }

    float getStrength(vec2 pos) {
        float strength = 0.;
        int sensorSize = 1;

        for (int i = -sensorSize; i <= sensorSize; ++i) {
            for (int j = -sensorSize; j <= sensorSize; ++j) {
                ivec2 pos = ivec2(pos.x + float(i), pos.y + float(j));

                if (inBounds(pos)) {
                    vec4 colour = texelFetch(world, pos, 0);
    
                    strength += dot(colour, colour); 
                }
            }
        }

        return strength / 9.;
    }

    float getNextAngle(vec2 pos, float angle) {
        float SO = float(${SO});
        float SA = float(${SA});
        float RA = float(${RA});
        float leftAngle = angle + SA;
        float rightAngle = angle - SA;

        vec2 centrePos = pos + SO * vec2(cos(angle), sin(angle));
        vec2 leftPos = pos + SO * vec2(cos(leftAngle), sin(leftAngle));
        vec2 rightPos = pos + SO * vec2(cos(rightAngle), sin(rightAngle));

        float F = 0., FL = 0., FR = 0.;
        
        if (inBounds(centrePos)) {
            F = getStrength(centrePos);
        }
        
        if (inBounds(leftPos)) {
            FL = getStrength(leftPos);
        }
        
        if (inBounds(rightPos)) {
            FR += getStrength(rightPos);
        }
        
        if (FR == 0. || FL == 0. || F == 0.) {
            return angle + ${PI - PI/4} + ${PI/2} * h21(pos);
        }

        float nextAngle = angle;

        if (F > FL && F > FR) {
            return nextAngle;
        }
        else if (F < FL && F < FR) {
            float random = h21(pos);
            nextAngle += (random >= 0.5 ? 1. : -1.) * RA; //TODO * DT
        }
        else if (FL > FR) {
            nextAngle += RA;
        }
        else {
            nextAngle -= RA;
        }

        return nextAngle;
    }

    void main() {
        vec4 data = texelFetch(prevState, ivec2(gl_FragCoord.xy), 0);
        vec2 pos = data.xy;
        float angle = data.z;

        float speed = float(${speed});
        vec2 velocity = vec2(speed * cos(angle), speed * sin(angle));

        pos += velocity; //TODO MULTIPLY BY DT

        if (inBounds(ivec2(pos))) {
            angle = getNextAngle(pos, angle);
        }
        else {
            float width = float(canvasSize.x);
            float height = float(canvasSize.y);

            angle = h21(pos) * ${TAU};
        }

        outColour = vec4(pos, angle, 1.);
    }
`;

const drawVS = `#version 300 es
    precision highp float;

    uniform ivec2 canvasSize;
    uniform sampler2D state;
    in vec2 index;

    void main() {
        vec2 particlePos = texelFetch(state, ivec2(index), 0).xy;
        vec2 halfCanvas = vec2(canvasSize)/2.;
        vec2 pos = (particlePos - halfCanvas) / halfCanvas;
        gl_Position = vec4(pos, 0.0, 1.0);
        gl_PointSize = 1.0;
    }
`;

const drawFS = `#version 300 es
    precision highp float; // TODO: play around removing these
    
    out vec4 outColor;

    void main() {
        outColor = vec4(${RED/255}, ${GREEN/255}, ${BLUE/255}, 1.0);
    }
`;

const trailVS = `#version 300 es
    in vec2 position;

    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const trailFS = `#version 300 es
    precision highp float;

    out vec4 outColor;
    uniform sampler2D particleTexture;
    uniform sampler2D prevFrame;
    uniform ivec2 canvasSize;

    bool inBounds(ivec2 p) {
        return p.x >= 0 && p.x < canvasSize.x && p.y >= 0 && p.y < canvasSize.y;
    }

    void main() {
        ivec2 uv = ivec2(gl_FragCoord.xy);
        vec3 col = texelFetch(particleTexture, uv, 0).rgb;

        vec4 prevColour = texelFetch(prevFrame, uv, 0);

        //draw particle current locations
        if (col.r + col.g + col.b != 0.) {
            outColor = vec4(col, 1.0) * 0.2;
        }
        
        //diffusion
        vec4 avg = vec4(0.);
        float count = 0.;
        for (int i = -1; i <= 1; ++i) {
            for (int j = -1; j <= 1; ++j) {
                ivec2 location = ivec2(uv.x + i, uv.y + j);

                if (inBounds(location)) {
                    count += 1.;
                    avg += texelFetch(prevFrame, location, 0);
                }
            }
        }
        avg /= count;

        outColor += avg * ${diffusionAmount};

        outColor *= ${evapourationAmount};
    }
`;

const renderVS = `#version 300 es
    in vec2 position;

    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const renderFS = `#version 300 es
    precision highp float;

    out vec4 outColor;
    uniform sampler2D image;

    void main() {
        ivec2 uv = ivec2(gl_FragCoord.xy);
        outColor = texelFetch(image, uv, 0);
    }
`;

const quadData = new Float32Array([
    -1.0, 1.0,
    1.0, 1.0,
    -1.0, -1.0,
    1.0, -1.0,
]);

const indicesData = getIndicesData(PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT);

function updateParticles(gl, state, worldTexture) {
    gl.useProgram(state.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.particleTexture1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, state.particleTexture1, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.particleTexture2);
    gl.uniform1i(state.uniforms.prevState, 1);
    
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, worldTexture);
    gl.uniform1i(state.uniforms.world, 2);

    gl.uniform2i(state.uniforms.canvasSize, gl.canvas.width, gl.canvas.height);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    gl.bindVertexArray(state.vao);
    gl.vertexAttribPointer(state.updatePosAttribLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(state.updatePosAttribLoc);

    gl.viewport(0, 0, PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    [state.particleTexture1, state.particleTexture2] = 
        [state.particleTexture2, state.particleTexture1]; 
}
    
function drawParticles(gl, state) {
    gl.useProgram(state.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, state.texture, 0);
        
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.particleTexture1);
    gl.uniform1i(state.uniforms.state, 1);

    gl.uniform2i(state.uniforms.canvasSize, gl.canvas.width, gl.canvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.indexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, indicesData, gl.STATIC_DRAW);
    gl.bindVertexArray(state.vao);
    gl.vertexAttribPointer(state.drawPosAttribLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(state.drawPosAttribLoc);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.POINTS, 0, indicesData.length / 2);
}

function updateTrails(gl, state) {
    gl.useProgram(state.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.outTexture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, state.outTexture, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.particleTexture);
    gl.uniform1i(state.uniforms.particleTexture, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.prevFrameTexture);
    gl.uniform1i(state.uniforms.prevFrame, 2);

    gl.uniform2i(state.uniforms.canvasSize, gl.canvas.width, gl.canvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    gl.bindVertexArray(state.vao);
    gl.vertexAttribPointer(state.trailVertexAttribLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(state.trailVertexAttribLoc);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function render(gl, state, texture) {
    gl.useProgram(state.program);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(state.uniforms.image, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    gl.bindVertexArray(state.vao);
    gl.vertexAttribPointer(state.renderVertexAttribLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(state.renderVertexAttribLoc);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function draw(gl, updateState, drawState, trailState, renderState) {
    updateParticles(gl, updateState, trailState.outTexture);
    drawParticles(gl, drawState);
    updateTrails(gl, trailState);
    render(gl, renderState, trailState.outTexture);

    [trailState.outTexture, trailState.prevFrameTexture] = 
        [trailState.prevFrameTexture, trailState.outTexture];

    window.requestAnimationFrame(() => { 
        draw(gl, updateState, drawState, trailState, renderState); 
    });
}

function init() {
    const canvas = document.querySelector("#canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const gl = canvas.getContext("webgl2");

    if (!gl) {
        return alert("Failed to initialise WebGL 2.0. Use a more up-to-date browser.");
    }

    //without this extension RGBA32F is not renderable
    if (!gl.getExtension('EXT_color_buffer_float')) { 
        return alert('Failed to find extension EXT_color_buffer_float. Use a more up-to-date browser.');
    }
    
    console.log("Initialising update shader program");
    const updateProgram = initShaderProgram(gl, updateVS, updateFS);

    console.log("Initialising draw shader program");
    const drawProgram = initShaderProgram(gl, drawVS, drawFS);

    console.log("Initialising trail shader program");
    const trailProgram = initShaderProgram(gl, trailVS, trailFS);

    console.log("Initialising render shader program");
    const renderProgram = initShaderProgram(gl, renderVS, renderFS);

    console.log("Shaders ready");

    const particleTexture1 = gl.createTexture();
    const particleTexture2 = gl.createTexture();
    
    const updatePosAttribLoc = gl.getAttribLocation(updateProgram, "position");
    const drawPosAttribLoc = gl.getAttribLocation(drawProgram, "index");
    const trailVertexAttribLoc = gl.getAttribLocation(trailProgram, "position");
    const renderVertexAttribLoc = gl.getAttribLocation(renderProgram, "position");

    const drawnParticlesTexture = gl.createTexture();
    const canvasTexture = gl.createTexture();

    const updateState = {
        program: updateProgram,
        particleTexture1,
        particleTexture2,
        quadBuffer: gl.createBuffer(),
        frameBuffer: gl.createFramebuffer(),
        vao: gl.createVertexArray(),
        updatePosAttribLoc,
        uniforms: getUniforms(gl, updateProgram, [
            "prevState",
            "canvasSize",
            "world"
        ]),
    };

    const drawState = {
        program: drawProgram,
        indexBuffer: gl.createBuffer(),
        framebuffer: gl.createFramebuffer(),
        vao: gl.createVertexArray(),
        texture: drawnParticlesTexture,
        particleTexture1,
        drawPosAttribLoc,
        uniforms: getUniforms(gl, drawProgram, [
            "state",
            "canvasSize"
        ]),
    };

    const trailState = {
        program: trailProgram,
        framebuffer: gl.createFramebuffer(),
        quadBuffer: gl.createBuffer(),
        vao: gl.createVertexArray(),
        particleTexture: drawnParticlesTexture,
        prevFrameTexture: gl.createTexture(),
        outTexture: canvasTexture,
        trailVertexAttribLoc,
        uniforms: getUniforms(gl, trailProgram, [
            "particleTexture",
            "canvasSize",
            "prevFrame"
        ]),
    };

    const renderState = {
        program: renderProgram,
        quadBuffer: gl.createBuffer(),
        vao: gl.createVertexArray(),
        renderVertexAttribLoc,
        uniforms: getUniforms(gl, renderProgram, [
            "image",
        ]),
    };

    const startingStateImage = getStartingStateImage();
    const emptyCanvas = new Uint8Array(canvas.width * canvas.height * 3);

    initialiseRenderTexture(gl, particleTexture1, 
        PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT, startingStateImage);

    initialiseRenderTexture(gl, particleTexture2, 
        PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT, startingStateImage);

    gl.bindTexture(gl.TEXTURE_2D, drawnParticlesTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,    // target
        0,                // level
        gl.RGB,           // internalformat
        canvas.width,     // width
        canvas.height,    // height
        0,                // border
        gl.RGB,           // format
        gl.UNSIGNED_BYTE, // type 
        emptyCanvas,      // srcData
        0                 // srcOffset
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, canvasTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,    // target
        0,                // level
        gl.RGB,           // internalformat
        canvas.width,     // width
        canvas.height,    // height
        0,                // border
        gl.RGB,           // format
        gl.UNSIGNED_BYTE, // type 
        emptyCanvas,      // srcData
        0                 // srcOffset
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, trailState.prevFrameTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,    // target
        0,                // level
        gl.RGB,           // internalformat
        canvas.width,     // width
        canvas.height,    // height
        0,                // border
        gl.RGB,           // format
        gl.UNSIGNED_BYTE, // type 
        emptyCanvas,      // srcData
        0                 // srcOffset
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    draw(gl, updateState, drawState, trailState, renderState);
}

window.onload = init;