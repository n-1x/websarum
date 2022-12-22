//Author: Nicholas Dean

/*
There are four draw calls per frame, outlined here:
UPDATE
    Inputs: MAIN_TEXTURE, STATE_TEXTURE (a texture where each pixel represents the position and angle of each particle)
    Output: An updated STATE_TEXTURE
    Explanation: In this step, the shader calculates the new positions and angles of all the particles, and stores the data
        on the STATE_TEXTURE. The MAIN_TEXTURE is sampled to influence the steering of each particle based on the trails around it.

DRAW
    Inputs: STATE_TEXTURE
    Outputs: PARTICLES_TEXTURE
    Explanation: The draw step transforms the STATE_TEXTURE, which is just data,
        into the PARTICLES_TEXTURE, which is a fresh texture with all of the particles 
        drawn on in their current location.

TRAIL
    Inputs: PARTICLES_TEXTURE, MAIN_TEXTURE
    Outputs: MAIN_TEXTURE
    Explanation: The trail step takes the PARTICLES_TEXTURE, and draws the particles onto the MAIN_TEXTURE, which is not cleared.
        It then applies blur to the pixels to simulate diffusion, and subtracts from each to simulate evapouration.

RENDER
    Inputs: MAIN_TEXTURE
    Outputs: none
    Explanation: This step just draws the MAIN_TEXTURE to the canvas.
*/

"use strict"

const queryParams = new URLSearchParams(window.location.search);
const PARTICLE_TEXTURE_WIDTH = queryGet("wi", 1000);
const PARTICLE_TEXTURE_HEIGHT = queryGet("he", PARTICLE_TEXTURE_WIDTH);

function queryGet(name, defaultValue) {
    return queryParams.has(name) ? queryParams.get(name) : defaultValue;
}

function randRange(min, max) {
    return min + (max - min) * Math.random();
}

function logSettings() {
    console.log(JSON.stringify(settings, null, 4));
}

function getQueryStringForCurrentSettings() {
    return Object.entries(settings).map(([name, value]) => {
        return `${name}=${parseFloat(value).toFixed(4)}`
    }).join("&");
}

function updateQueryParameters() {
    try {
        window.history.replaceState(null, null, `?${getQueryStringForCurrentSettings()}`);
    }
    catch { }
}

const presets = {
    "Roots": {
        "sa": 0.7272388796709374,
        "ra": 0.45623959819739646,
        "so": 5.208635091449514,
        "er": 0.01332048284950104,
        "dr": 0.30593743234632764,
        "ds": 0.07263061471097229,
        "s": 1.345430128476753,
        "r": 131.97661095637793,
        "g": 178.58837511685653,
        "b": 54.275563444613056
    },
    "Sparkler": {
        "sa": 0.6276633577000122,
        "ra": 0.4770540755207435,
        "so": 3.0552513505748156,
        "er": 0.09124361600785168,
        "dr": 0.173742195917986,
        "ds": 0.06671315822692318,
        "s": 1.1332474460691877,
        "r": 59.100403196639405,
        "g": 24.144773716014345,
        "b": 90.86011760619417
    },
    "Fireball": {
        "sa": 0.26024361570502,
        "ra": 0.7591674383997613,
        "so": 2.788681454531885,
        "er": 0.09265237764768487,
        "dr": 0.313245429509618,
        "ds": 0.049803181549129376,
        "s": 1.1317696668780441,
        "r": 235.59117142610606,
        "g": 142.9355650445792,
        "b": 19.26220731473137
    },
    "Alien": {
        "sa": 0.7302706841151516,
        "ra": 0.40834815531032354,
        "so": 6.836371979106925,
        "er": 0.07665430709950119,
        "dr": 0.284695495518407,
        "ds": 0.029248702870850546,
        "s": 1.4811268680587457,
        "r": 132.24931810537421,
        "g": 244.07791933657685,
        "b": 101.23515778679135
    },
    "Nova": {
        "sa": 0.6857024720776844,
        "ra": 0.18271661490918428,
        "so": 3.489764781939051,
        "er": 0.0307725715723038,
        "dr": 0.15906093206727567,
        "ds": 0.09267362322560109,
        "s": 1.4691590009048343,
        "r": 245.50781582020457,
        "g": 40.41057446158983,
        "b": 139.43774913406622
    },
    "Energy": {
        "sa": 0.2172069170954646,
        "ra": 0.24686645320061174,
        "so": 4.7708204305785875,
        "er": 0.07821360586696352,
        "dr": 0.6324835441176011,
        "ds": 0.07914353570477804,
        "s": 1.321075048845392,
        "r": 126.20794601249571,
        "g": 106.17011970230016,
        "b": 215.8979104797793
    },
    "Mycelium": {
        "sa": 0.35950298128423797,
        "ra": 0.6125719378381128,
        "so": 3.407364712537294,
        "er": 0.047558536332927864,
        "dr": 0.2120679558116123,
        "ds": 0.04254278859268712,
        "s": 1.0487097459011205,
        "r": 253.2030708655348,
        "g": 249.0895000709562,
        "b": 170.51777903070285
    },
    "Gold Dust": {
        "sa": 0.5099381191157555,
        "ra": 0.10260424538945051,
        "so": 11.015375727893089,
        "er": 0.04505093643124657,
        "dr": 0.9526744269888571,
        "ds": 0.021202752156016476,
        "s": 1.3046814098923678,
        "r": 199.45578281614002,
        "g": 201.4868621391769,
        "b": 144.3360202997715
    },
    "Life": {
        "sa": 0.59,
        "ra": 0.09,
        "so": 2.7887,
        "er": 0.0927,
        "dr": 0.3132,
        "ds": 0.0498,
        "s": 1.1318,
        "r": 57.6500,
        "g": 142.9356,
        "b": 19.2622
    },
    "Water": {
        "sa": 0.31,
        "ra": 0.37,
        "so": 6.1500,
        "er": 0.1000,
        "dr": 0.1737,
        "ds": 0.0667,
        "s": 1.1332,
        "r": 0.0000,
        "g": 24.1448,
        "b": 255.0000
    },
    "Growth": {
        "sa": 0.5861,
        "ra": 0.7287,
        "so": 1.9768,
        "er": 0.0108,
        "dr": 0.2189,
        "ds": 0.0393,
        "s": 1.2529,
        "r": 65.8377,
        "g": 92.7125,
        "b": 34.9513
    },
    "Wisps": {
        "sa": 0.4998,
        "ra": 0.3449,
        "so": 4.5187,
        "er": 0.0391,
        "dr": 0.0835,
        "ds": 0.0856,
        "s": 1.0254,
        "r": 11.4972,
        "g": 68.0937,
        "b": 151.2045
    }
};

const settingsConfig = {
    "Search Angle": {
        min: 0,
        max: Math.PI / 4,
        convert: degToRad
    },
    "Rotate Angle": {
        min: 0,
        max: Math.PI / 4,
        convert: degToRad
    },
    "Search Offset": {
        min: 1,
        max: 15
    },
    "Evapouration Rate": {
        min: 0.01,
        max: 0.1
    },
    "Diffusion Rate": {
        min: 0,
        max: 1.0
    },
    "Deposit Strength": {
        min: 0.01,
        max: 0.1
    },
    "Speed": {
        min: 1,
        max: 1.5
    },
    "Red": {
        min: 0,
        max: 255
    },
    "Green": {
        min: 0,
        max: 255
    },
    "Blue": {
        min: 0,
        max: 255
    }
}

// Randomised settings
// const settings = {
//     sa: degToRad(queryGet("sa", randRange(2, 46))),
//     ra: degToRad(queryGet("ra", randRange(2, 45))),
//     so: queryGet("so", randRange(1,15)),
//     ev: queryGet("ev", randRange(0.01, 0.1)),
//     di: queryGet("di", randRange(0, 1.0)),
//     de: queryGet("de", randRange(0.01, 0.1)),
//     sp: queryGet("sp", randRange(1, 1.5)),
//     r: queryGet("r", randRange(0, 255)),
//     g: queryGet("g", randRange(0, 255)),
//     b: queryGet("b", randRange(0, 255))
// }

// {
//     "sa": 20.59800783525131,
//     "ra": 35.097793988162785,
//     "so": 3.407364712537294,
//     "ev": 0.047558536332927864,
//     "di": 0.2120679558116123,
//     "de": 0.04254278859268712,
//     "sp": 1.0487097459011205,
//     "r": 253.2030708655348,
//     "g": 249.0895000709562,
//     "b": 170.51777903070285
//   }

const settings = { ...presets["Mycelium"] };
Object.assign(settings, Object.fromEntries(queryParams.entries()));

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
            data[i + 1] = h;
        }
    }

    return data;
}

function getStartingStateImage() {
    const imageData = new Float32Array(
        PARTICLE_TEXTURE_HEIGHT * PARTICLE_TEXTURE_WIDTH * 4);
    const size = Math.min(window.innerWidth, window.innerHeight) / 3;

    for (let i = 0; i < imageData.length; i += 4) {
        const angle = Math.random() * Math.PI * 2;
        const randomSize = Math.random() * size;
        imageData[i] = canvas.width / 2 + randomSize * Math.cos(angle);    //x pos
        imageData[i + 1] = canvas.height / 2 + randomSize * Math.sin(angle); // y pos
        imageData[i + 2] = angle;
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

    //rgba32f is not texture_filterable, so disable filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
}

function degToRad(deg) {
    return deg * (Math.PI / 180);
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

    #define PI ${Math.PI}

    out vec4 outColour;
    uniform sampler2D prevState;
    uniform sampler2D world;
    uniform ivec2 canvasSize;
    uniform float searchOffset;
    uniform float searchAngle;
    uniform float rotateAngle;
    uniform float speed;

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
        float SO = searchOffset;
        float SA = searchAngle;
        float RA = rotateAngle;
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
            return angle + (PI - PI/4.) + (PI/2.) * h21(pos);
        }

        float nextAngle = angle;

        if (F > FL && F > FR) {
            return nextAngle;
        }
        else if (F < FL && F < FR) {
            float random = h21(pos);
            nextAngle += (random >= 0.5 ? 1. : -1.) * RA;
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

        vec2 velocity = vec2(speed * cos(angle), speed * sin(angle));

        pos += velocity;

        if (inBounds(ivec2(pos))) {
            angle = getNextAngle(pos, angle);
        }
        else {
            float width = float(canvasSize.x);
            float height = float(canvasSize.y);

            angle = h21(pos) * PI * 2.;
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
    
    uniform float de;
    uniform vec3 colour;
    
    out vec4 outColor;

    void main() {
        outColor = vec4(colour, 1.0) * de;
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
    uniform float diffusion;
    uniform float evapouration;

    bool inBounds(ivec2 p) {
        return p.x >= 0 && p.x < canvasSize.x && p.y >= 0 && p.y < canvasSize.y;
    }

    void main() {
        ivec2 uv = ivec2(gl_FragCoord.xy);
        vec3 col = texelFetch(particleTexture, uv, 0).rgb;

        vec4 prevColour = texelFetch(prevFrame, uv, 0);
        float depositAmount = 0.8;

        //draw particle current locations
        if (col.r + col.g + col.b != 0.) {
            float prevBrightness = (prevColour.r + prevColour.g + prevColour.b) / 3.0;
            outColor = prevColour + vec4(col, 1.0) / prevBrightness;
        }
        else {
            //diffusion
            vec4 avg = vec4(0.);
            int count = 0;
            for (int i = -1; i <= 1; ++i) {
                for (int j = -1; j <= 1; ++j) {
                    ivec2 location = ivec2(uv.x + i, uv.y + j);
    
                    if (inBounds(location)) {
                        count += 1;
                        avg += texelFetch(prevFrame, location, 0);
                    }
                }
            }
    
            avg /= float(count);
            outColor = mix(prevColour, avg, diffusion);
            outColor = max(vec4(0), outColor - evapouration);
        }
        
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
    gl.uniform1f(state.uniforms.searchOffset, settings.so);
    gl.uniform1f(state.uniforms.searchAngle, settings.sa);
    gl.uniform1f(state.uniforms.rotateAngle, settings.ra);
    gl.uniform1f(state.uniforms.speed, settings.s);

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
    gl.uniform3f(state.uniforms.colour, settings.r / 255, settings.g / 255, settings.b / 255);
    gl.uniform1f(state.uniforms.de, settings.ds);

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
    gl.uniform1f(state.uniforms.diffusion, settings.dr);
    gl.uniform1f(state.uniforms.evapouration, settings.er);

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

function initCanvas(width, height) {
    const canvas = document.getElementById("canvas");
    canvas.width = width;
    canvas.height = height;
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
            "world",
            "searchOffset",
            "searchAngle",
            "rotateAngle",
            "speed"
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
            "canvasSize",
            "colour",
            "de"
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
            "prevFrame",
            "diffusion",
            "evapouration"
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
    const emptyCanvas = new Uint8Array(width * height * 3);

    initialiseRenderTexture(gl, particleTexture1,
        PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT, startingStateImage);

    initialiseRenderTexture(gl, particleTexture2,
        PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT, startingStateImage);

    gl.bindTexture(gl.TEXTURE_2D, drawnParticlesTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,    // target
        0,                // level
        gl.RGB,           // internalformat
        width,            // width
        height,           // height
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
        width,            // width
        height,           // height
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
        width,            // width
        height,           // height
        0,                // border
        gl.RGB,           // format
        gl.UNSIGNED_BYTE, // type 
        emptyCanvas,      // srcData
        0                 // srcOffset
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const error = gl.getError();

    if (error) {
        document.write(`Unable to initialise, error ${error}`);
    }
    else {
        draw(gl, updateState, drawState, trailState, renderState);
    }
}

function initParameterWindow() {
    const paramDiv = document.getElementById("param-list");
    const inputMap = {};

    const select = document.createElement("select");
    const startingLabel = document.createElement("option");
    startingLabel.innerText = "Select a preset";
    select.appendChild(startingLabel);

    // add presets
    for (const name of Object.keys(presets)) {
        const option = document.createElement("option");
        option.innerText = name;
        select.appendChild(option);
    }

    select.onchange = e => {
        if (e.target.selectedIndex !== 0) {
            const preset = presets[e.target.value];
            for (const [name, value] of Object.entries(preset)) {
                settings[name] = value;

                if (inputMap[name]) {
                    inputMap[name].value = value;
                }
            }
            updateQueryParameters();
        }
    };

    paramDiv.appendChild(select);
    paramDiv.appendChild(document.createElement("br"));
    const getShortName = s => s.split(" ").map(w => w[0].toLowerCase()).join("");

    for (const [longName, config] of Object.entries(settingsConfig)) {
        const shortName = getShortName(longName);
        const label = document.createElement("label");
        label.innerText = longName;

        const input = document.createElement("input");
        input.type = "range";
        input.min = config.min;
        input.max = config.max;
        input.step = 0.01;
        input.value = settings[shortName];
        input.oninput = e => {
            const newValue = parseFloat(e.target.value);
            settings[shortName] = newValue;
            updateQueryParameters();
        };
        inputMap[shortName] = input;

        paramDiv.appendChild(label);
        paramDiv.appendChild(input);
        paramDiv.appendChild(document.createElement("br"))
    }

    const randomButton = document.createElement("button");
    randomButton.innerText = "Randomise parameters";
    randomButton.onclick = () => {
        for (const [longName, config] of Object.entries(settingsConfig)) {
            const shortName = getShortName(longName);
            const newValue = randRange(config.min, config.max);
            settings[shortName] = newValue;
            inputMap[shortName].value = newValue;
        }
        updateQueryParameters();
    };
    paramDiv.appendChild(randomButton);
}

window.onload = () => {
    initParameterWindow();
    // For some reason the gl textures only work if the width
    // is divisible by four, so here we round down to the nearest
    // multiple.
    const canvasWidth = window.innerWidth & ~0b11;
    initCanvas(canvasWidth, window.innerHeight);
};

// Draggable window
let currentWindow = null;
let dragStart = null;
let dragOffset = null;

window.onmousedown = e => {
    if (e.target.classList.contains('drag-header')) {
        currentWindow = e.target.parentNode;
        const { x, y } = currentWindow.getBoundingClientRect();
        dragOffset = [window.mouseX - x, window.mouseY - y];
        dragStart = [window.mouseX - dragOffset[0], window.mouseY - dragOffset[1]];
    }
}

window.onmouseup = e => {
    currentWindow = null;
}

window.onmousemove = e => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;

    if (currentWindow) {
        const dx = window.mouseX - dragStart[0];
        const dy = window.mouseY - dragStart[1];
        const { x, y } = currentWindow.getBoundingClientRect();
        const newX = x + dx - dragOffset[0];
        const newY = y + dy - dragOffset[1];

        currentWindow.style.left = `${newX}px`;
        currentWindow.style.top = `${newY}px`;
        dragStart = [newX, newY];
    }
};

window.onkeydown = e => {
    if (e.key.toLowerCase() === "p") {
        const paramWindow = document.getElementById("param-window");

        if (paramWindow.style.display === "") {
            paramWindow.style.display = "none";
        }
        else {
            paramWindow.style.display = "";
        }
    }
}