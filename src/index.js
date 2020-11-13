import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HemisphereLight, RepeatWrapping, Vector2 } from 'three';
import { GUI } from 'dat.gui';
import { FilmShader } from './FilmShader';
import { VignetteShader } from './VignetteShader';
import { HorizontalBlurShader } from './HorizontalBlurShader';
import { VerticalBlurShader } from './VerticalBlurShader';
import { RGBShiftShader } from './RGBShiftShader';
import { BadTVShader } from './BadTVShader';
import { StaticShader } from './StaticShader';

const generalParams = {
  exposure: 1.3
}

const bloomParams = {
  bloomStrength: 0.3,
  bloomThreshold: 0,
  bloomRadius: 0,
};

const filmParams = {
  show: true,
  count: 800,
  sIntensity: 0.2,
  nIntensity: 0.3
};

const badTVParams = {
  mute: true,
  show: true,
  distortion: 1.0,
  distortion2: 1.0,
  speed: 0.2,
  rollSpeed: 0
};

const staticParams = {
  show: true,
  amount: 0.03,
  size: 4
};

const rgbParams = {
  show: true,
  amount: 0.0015,
  angle: 0.0,
};

const vignetteParams = {
  amount: 0.95
}

const blurParams = {
  h: 0.3,
  v: 0.3
}

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;

document.body.appendChild(renderer.domElement);

// Generate rainbow color array for BG
// Thank you Nikolay: http://www.nikolay.rocks/2015-10-29-rainbows-generator-in-javascript
var size = 2500;
var rainbow = new Array(size);
for (var i = 0; i < size; i++) {
  var red = sin_to_hex(i, 0 * Math.PI * 2 / 3); // 0   deg
  var blue = sin_to_hex(i, 1 * Math.PI * 2 / 3); // 120 deg
  var green = sin_to_hex(i, 2 * Math.PI * 2 / 3); // 240 deg

  rainbow[i] = "#" + red + green + blue;
}

function sin_to_hex(i, phase) {
  var sin = Math.sin(Math.PI / size * 2 * i + phase);
  var int = Math.floor(sin * 127) + 128;
  var hex = int.toString(16);

  return hex.length === 1 ? "0" + hex : hex;
}

// Allow for window resize
function onWindowResize() {

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);

}
window.addEventListener('resize', onWindowResize);

// Setup scene
let scene, camera, lineScrollTex, mixer, bob;
function setupScene() {
  scene = new THREE.Scene();

  const texLoader = new THREE.TextureLoader();
  const noOneMat = new THREE.MeshBasicMaterial({
    map: texLoader.load("asset/nobody.png"),
    alphaMap: texLoader.load("asset/nobody.png"),
    alphaTest: 0.5
  })

  const noOnePlaneGeo = new THREE.PlaneGeometry(22, 5, 1, 1);
  const noOnePlane = new THREE.Mesh(noOnePlaneGeo, noOneMat);
  noOnePlane.position.set(0, -7, -20);

  lineScrollTex = texLoader.load("asset/linescroll-mask.png");
  lineScrollTex.wrapS = RepeatWrapping;
  lineScrollTex.wrapT = RepeatWrapping;
  lineScrollTex.repeat.set(1, 2);

  const lineScrollMat = new THREE.MeshBasicMaterial({
    alphaMap: lineScrollTex,
    transparent: true,
    color: 0x0000000,
    opacity: 0.7
  })

  const lineScrollPlaneGeo = new THREE.PlaneGeometry(200, 100, 1, 1);
  const lineScrollPlane = new THREE.Mesh(lineScrollPlaneGeo, lineScrollMat);
  lineScrollPlane.position.set(0, 0, -29);

  const gltfload = new GLTFLoader();
  gltfload.load('asset/bob/catdance.gltf', function (gltf) {
    bob = gltf.scene;
    bob.name = "bobModel";

    mixer = new THREE.AnimationMixer(bob);
    const animationClip = gltf.animations[0];
    mixer.clipAction(animationClip.optimize()).play();

    scene.add(bob);
    bob.position.set(0, -0.3, 2.5);
  });

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  scene.add(noOnePlane);
  scene.add(lineScrollPlane);

  const hemLight = new HemisphereLight(0x404040, 0xffffff, 3);
  hemLight.position.set(-2, 1.8, 5);
  scene.add(hemLight);
}

// Setup shader pipeline
const composer = new EffectComposer(renderer);
let bloomPass, hBlurPass, vBlurPass, filmPass, badTVPass, rgbPass, staticPass, vignettePass;
function setupShaderPipeline() {
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight),
    bloomParams.bloomStrength, // strength
    bloomParams.bloomRadius, // radius
    bloomParams.bloomThreshold // treshold
  );
  composer.addPass(bloomPass);

  hBlurPass = new ShaderPass(HorizontalBlurShader);
  composer.addPass(hBlurPass);
  vBlurPass = new ShaderPass(VerticalBlurShader);
  composer.addPass(vBlurPass);

  filmPass = new ShaderPass(FilmShader);
  composer.addPass(filmPass);

  badTVPass = new ShaderPass(BadTVShader);
  composer.addPass(badTVPass);

  rgbPass = new ShaderPass(RGBShiftShader);
  composer.addPass(rgbPass);

  staticPass = new ShaderPass(StaticShader);
  composer.addPass(staticPass);

  vignettePass = new ShaderPass(VignetteShader);
  vignettePass.renderToScreen = true;
  composer.addPass(vignettePass);
}

// Process changed GUI params, initial setup
function onParamsChange() {

  //copy gui params into shader uniforms
  badTVPass.uniforms['distortion'].value = badTVParams.distortion;
  badTVPass.uniforms['distortion2'].value = badTVParams.distortion2;
  badTVPass.uniforms['speed'].value = badTVParams.speed;
  badTVPass.uniforms['rollSpeed'].value = badTVParams.rollSpeed;

  staticPass.uniforms['amount'].value = staticParams.amount;
  staticPass.uniforms['size'].value = staticParams.size;

  rgbPass.uniforms['angle'].value = rgbParams.angle * Math.PI;
  rgbPass.uniforms['amount'].value = rgbParams.amount;

  filmPass.uniforms['sCount'].value = filmParams.count;
  filmPass.uniforms['sIntensity'].value = filmParams.sIntensity;
  filmPass.uniforms['nIntensity'].value = filmParams.nIntensity;
  filmPass.uniforms['grayscale'].value = 0;

  vignettePass.uniforms.amount.value = vignetteParams.amount;

  hBlurPass.uniforms["h"].value = blurParams.h / window.innerWidth;
  vBlurPass.uniforms["v"].value = blurParams.v / window.innerHeight;

  renderer.toneMappingExposure = generalParams.exposure;

  bloomPass.threshold = Number(bloomParams.bloomThreshold);
  bloomPass.strength = Number(bloomParams.bloomStrength);
  bloomPass.radius = Number(bloomParams.bloomRadius);
}

function setupGui() {
  const gui = new GUI();

  var f1 = gui.addFolder('Bad TV');
  f1.add(badTVParams, 'distortion', 0.1, 20).step(0.1).listen().name('Thick Distort').onChange(onParamsChange);
  f1.add(badTVParams, 'distortion2', 0.1, 20).step(0.1).listen().name('Fine Distort').onChange(onParamsChange);
  f1.add(badTVParams, 'speed', 0.0, 1.0).step(0.01).listen().name('Distort Speed').onChange(onParamsChange);
  f1.add(badTVParams, 'rollSpeed', 0.0, 1.0).step(0.01).listen().name('Roll Speed').onChange(onParamsChange);
  f1.open();

  var f4 = gui.addFolder('Static');
  f4.add(staticParams, 'amount', 0.0, 1.0).step(0.01).listen().onChange(onParamsChange);
  f4.add(staticParams, 'size', 1.0, 100.0).step(1.0).onChange(onParamsChange);
  f4.open();

  var f2 = gui.addFolder('RGB Shift');
  f2.add(rgbParams, 'amount', 0.0, 0.1).listen().onChange(onParamsChange);
  f2.add(rgbParams, 'angle', 0.0, 2.0).listen().onChange(onParamsChange);
  f2.open();

  var f3 = gui.addFolder('Scanlines');
  f3.add(filmParams, 'count', 50, 1000).onChange(onParamsChange);
  f3.add(filmParams, 'sIntensity', 0.0, 2.0).step(0.1).onChange(onParamsChange);
  f3.add(filmParams, 'nIntensity', 0.0, 2.0).step(0.1).onChange(onParamsChange);
  f3.open();

  var f3 = gui.addFolder('Blur');
  f3.add(blurParams, 'h', 0.0, 2.0).step(0.1).onChange(onParamsChange);
  f3.add(blurParams, 'v', 0.0, 2.0).step(0.1).onChange(onParamsChange);
  f3.open();

  var f4 = gui.addFolder('Vignette');
  f4.add(vignetteParams, 'amount').min(0).max(3).step(0.01).onChange(onParamsChange);
  f4.open();

  var f5 = gui.addFolder('Bloom');
  f5.add(bloomParams, 'bloomThreshold', 0.0, 1.0).onChange(onParamsChange);
  f5.add(bloomParams, 'bloomStrength', 0.0, 3.0).onChange(onParamsChange);
  f5.add(bloomParams, 'bloomRadius', 0.0, 1.0).step(0.01).onChange(onParamsChange);
  f5.open();

  gui.add(generalParams, 'exposure', 0.1, 2).onChange(onParamsChange);
}

window.addEventListener('resize', onWindowResize);

setupScene();
setupShaderPipeline();
onParamsChange();
//setupGui();

let shaderTime = 0;
let then = 0;
let currcolor = 0;
function render(now) {
  shaderTime += 0.1;

  badTVPass.uniforms['time'].value = shaderTime;
  staticPass.uniforms['time'].value = shaderTime;
  filmPass.uniforms['time'].value = shaderTime;

  now *= 0.001;  // convert to seconds
  const deltaTime = now - then;
  then = now;

  if (lineScrollTex.offset.y >= 1) {
    lineScrollTex.offset.y = 0;
  }
  lineScrollTex.offset.y += 0.003;

  /* bob.rotation.x += 0.01;
  bob.rotation.y += 0.01; */
  if (mixer)
    mixer.update(deltaTime);

  renderer.setClearColor(rainbow[currcolor]);

  if (currcolor + 1 > size)
    currcolor = 0;
  currcolor++;

  if (composer)
    composer.render(deltaTime);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);



//Plays the sound
function play(volume) {
  //Set the current time for the audio file to the beginning
  soundFile.currentTime = 0.01;
  soundFile.volume = volume;

  //Due to a bug in Firefox, the audio needs to be played after a delay
  setTimeout(function () { soundFile.play(); }, 1);
}

let soundFile = undefined;

function loadAudioMuted() {
  if (soundFile == undefined || !soundFile.currentTime) {
    console.log("trying to load audio...");

    //Create the audio tag
    soundFile = document.createElement("audio");
    soundFile.preload = "auto";
    soundFile.muted = true;
    soundFile.loop = true;

    //Load the sound file (using a source element for expandability)
    var src = document.createElement("source");
    src.src = "asset/sound.mp3";
    soundFile.appendChild(src);


    //Load the audio tag
    //It auto plays as a fallback
    soundFile.load();
    soundFile.volume = 0.2;
  }
}

loadAudioMuted();

function hideInfo() {
  document.getElementById('info').style = 'visibility: hidden;';
}

renderer.domElement.addEventListener("click", () => {
  setTimeout(() => {
    if (soundFile.muted || !soundFile.currentTime) {
      soundFile.muted = false;
      soundFile.currentTime = 0;
      soundFile.play();
    }
  }, 500);

  hideInfo();
});

setTimeout(hideInfo, 15000);