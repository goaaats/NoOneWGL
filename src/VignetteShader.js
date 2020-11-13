/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Vignette shader
 * based on PaintEffect postprocess from ro.me
 * http://code.google.com/p/3-dreams-of-black/source/browse/deploy/js/effects/PaintEffect.js
 */

export const VignetteShader = {
    uniforms: {
        tDiffuse: { type: 't', value: null },
        amount: { type: 'f', value: 0 }
    }
    , vertexShader: "varying vec2 vUv;\n\nvoid main() {\n    vUv = uv;\n    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n", fragmentShader: "uniform sampler2D tDiffuse;\nuniform float amount;\nvarying vec2 vUv;\n\nvoid main() {\n    vec4 original = texture2D(tDiffuse, vUv);\n    float dist = length(vUv - vec2(0.5, 0.5));\n    dist = dist / 0.707;\n    if(dist < 0.) dist = 0.;\n    if(dist > 1.) dist = 1.;\n    dist = dist * dist * dist;\n    gl_FragColor = vec4(original.xyz * (1. - dist * amount), 1.);\n}\n"
};
