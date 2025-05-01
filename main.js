import * as THREE from 'https://esm.sh/three@0.154.0';
import { RGBELoader } from 'https://esm.sh/three@0.154.0/examples/jsm/loaders/RGBELoader.js';
import { ImprovedNoise } from 'https://esm.sh/three@0.154.0/examples/jsm/math/ImprovedNoise.js';
import { PointerLockControls } from 'https://esm.sh/three@0.154.0/examples/jsm/controls/PointerLockControls.js';
import { GPUComputationRenderer } from 'https://esm.sh/three@0.154.0/examples/jsm/misc/GPUComputationRenderer.js';
import { GLTFLoader } from 'https://esm.sh/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';
// import {
//   MeshStandardNodeMaterial
// } from 'https://esm.sh/three@0.156.0/examples/jsm/nodes/Nodes.js'; 


// preliminary

//wang tiles
function wang(f, i, o = 0) {
  const n = [2,9,11,8,11,8,9,9,1,6,7,2,10,8,10,9];
  const r = [-1,0,0,0,0,0,0,0,13,15,12,15,-1,-1,-1,-1];
  const t = [-1,3,3,1,3,7,3,5,-1,-1,-1,-1,4,1,2,5];
  const a = [-1,12,14,13,12,12,14,13,-1,-1,-1,-1,-1,-1,-1,-1];

  let b = new Uint8Array(f * i);
  let h = new Uint8Array(f * i);
  h[0] = Math.abs(Math.floor(o)) % 16;

  let A = 1, c = 1;
  while (A < f || c < i) {
    [h, b] = [b, h];
    let u2 = 0, v = 0;

    for (let M = 0; M < c; M++) {
      let w = v === i - 1;
      for (let U = 0; U < A;) {
        let e = u2 + f * v;
        let s = u2 === f - 1;
        let l = b[U + f * M];

        h[e] = n[l];

        if (t[l] !== -1 && !s) {
          h[e + 1] = t[l];
        }

        if (r[l] !== -1 && !w) {
          h[e + f] = r[l];
        }

        if (a[l] !== -1 && !w && !s) {
          h[e + f + 1] = a[l];
        }

        U++;
        u2 += (t[l] !== -1 && !s) ? 2 : 1;
      }

      v += (w || r[b[(A - 1) + f * M]] === -1) ? 1 : 2;
    }

    A = u2;
    c = v;
  }

  return h;
}



// boid

const fragmentShaderPosition = `
uniform float time;
uniform float delta;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 tmpPos = texture2D( texturePosition, uv );
  vec3 position = tmpPos.xyz;
  vec3 velocity = texture2D( textureVelocity, uv ).xyz;

  float phase = tmpPos.w;

  phase = mod( 
    phase + delta +
    length( velocity.xz ) * delta * 3. +
    max( velocity.y, 0.0 ) * delta * 6. , 
    62.83 
  );

  position += velocity * delta * 4.0;

  const float BOUNDS = 500.0;
  const float SPAWN_Z_MIN = -400.0; 
  const float SPAWN_Z_MAX =  0.0; 

  if (position.x < -BOUNDS || position.x > BOUNDS) {

      position.x = BOUNDS;   

      float randomZ = mix(SPAWN_Z_MIN, SPAWN_Z_MAX, rand(uv));
      position.z = randomZ;
  }

  gl_FragColor = vec4( position + velocity * delta * 5. , phase );
}
`;



const fragmentShaderVelocity = `
uniform float time;
uniform float testing;
uniform float delta;
uniform float separationDistance;
uniform float alignmentDistance;
uniform float cohesionDistance;
uniform float freedomFactor;
uniform vec3 predator;

const float width = resolution.x;
const float height = resolution.y;

const float PI = 3.141592653589793;
const float PI_2 = PI * 2.0;

float zoneRadius = 40.0;
float zoneRadiusSquared = 1600.0;

float separationThresh = 0.45;
float alignmentThresh = 0.65;

const float UPPER_BOUNDS = BOUNDS;
const float LOWER_BOUNDS = -UPPER_BOUNDS;

const float SPEED_LIMIT = 2.5; 

float rand( vec2 co ) {
  return fract( sin( dot( co.xy, vec2(12.9898,78.233) ) ) * 43758.5453 );
}

void main() {
  zoneRadius = separationDistance + alignmentDistance + cohesionDistance;
  separationThresh = separationDistance / zoneRadius;
  alignmentThresh = ( separationDistance + alignmentDistance ) / zoneRadius;
  zoneRadiusSquared = zoneRadius * zoneRadius;

  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 birdPosition, birdVelocity;

  vec3 selfPosition = texture2D( texturePosition, uv ).xyz;
  vec3 selfVelocity = texture2D( textureVelocity, uv ).xyz;

  float dist;
  vec3 dir;
  float distSquared;

  float f;
  float percent;

  vec3 velocity = selfVelocity;
  float limit = SPEED_LIMIT;

  dir = predator * UPPER_BOUNDS - selfPosition;
  dir.z = 0.0;
  dist = length( dir );
  distSquared = dist * dist;

  float preyRadius = 150.0;
  float preyRadiusSq = preyRadius * preyRadius;

  if ( dist < preyRadius ) {
    f = ( distSquared / preyRadiusSq - 1.0 ) * delta * 100.0;
    velocity += normalize( dir ) * f;
    limit += 5.0;
  }

  vec3 central = vec3( 0.0, 0.0, 0.0 );
  dir = selfPosition - central;
  dist = length( dir );
  dir.y *= 2.5;
  velocity -= normalize( dir ) * delta * 5.0;

  for ( float y = 0.0; y < height; y++ ) {
    for ( float x = 0.0; x < width; x++ ) {
      vec2 ref = vec2( x + 0.5, y + 0.5 ) / resolution.xy;
      birdPosition = texture2D( texturePosition, ref ).xyz;

      dir = birdPosition - selfPosition;
      dist = length( dir );
      if ( dist < 0.0001 ) continue;

      distSquared = dist * dist;
      if ( distSquared > zoneRadiusSquared ) continue;

      percent = distSquared / zoneRadiusSquared;

      if ( percent < separationThresh ) {
        f = ( separationThresh / percent - 1.0 ) * delta;
        velocity -= normalize( dir ) * f;
      } else if ( percent < alignmentThresh ) {
        float threshDelta = alignmentThresh - separationThresh;
        float adjustedPercent = ( percent - separationThresh ) / threshDelta;
        birdVelocity = texture2D( textureVelocity, ref ).xyz;
        f = ( 0.5 - cos( adjustedPercent * PI_2 ) * 0.5 + 0.5 ) * delta;
        velocity += normalize( birdVelocity ) * f;
      } else {
        float threshDelta = 1.0 - alignmentThresh;
        float adjustedPercent = threshDelta == 0.0 ? 1.0 : ( percent - alignmentThresh ) / threshDelta;
        f = ( 0.5 - ( cos( adjustedPercent * PI_2 ) * -0.5 + 0.5 ) ) * delta;
        velocity += normalize( dir ) * f;
      }
    }
  }



  float targetZ = -450.0;

  vec3 gatheringForce = vec3(0.0, 0.0, (targetZ - selfPosition.z) * 0.015); // thrust to the right
  velocity += gatheringForce * delta;

  velocity.x -= delta * 4.0;

  if ( length( velocity ) > limit ) {
    velocity = normalize( velocity ) * limit;
  }
  

  gl_FragColor = vec4( velocity, 1.0 );
}
`;






const WIDTH = 6; // Antelope population
const BOUNDS = 500; 
const BOUNDS_HALF = BOUNDS / 2;

//initial position
function fillPositionTexture(texture) {
  const data = texture.image.data;
  for (let i = 0; i < data.length; i += 4) {
   
    const x = BOUNDS - Math.random() * (BOUNDS * 0.8); 
    
    const y = Math.random() * 20; 
    
    const z = ((Math.random() - 0.5)* 2 * 0.8-(1-0.8)) * BOUNDS; 

    data[i + 0] = x;
    data[i + 1] = y;
    data[i + 2] = z;
    data[i + 3] = 1; // phase
  }
}



function fillVelocityTexture(texture) {
  const data = texture.image.data;
  for (let i = 0; i < data.length; i += 4) {
    
    const vx = 2.0 + Math.random() * 1.0; 
    const vy = (Math.random() - 0.5) * 0.5; 
    const vz = (Math.random() - 0.5) * 1.0; 
    data[i + 0] = vx;
    data[i + 1] = vy;
    data[i + 2] = vz;
    data[i + 3] = 1;
  }
}









// Create the scene
const scene = new THREE.Scene();


// boid
let gpuCompute;
let velocityVariable, positionVariable;
let positionUniforms, velocityUniforms;

function initComputeRenderer(renderer) {
  gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

  const dtPosition = gpuCompute.createTexture();
  const dtVelocity = gpuCompute.createTexture();

  fillPositionTexture(dtPosition);
  fillVelocityTexture(dtVelocity);

  positionVariable = gpuCompute.addVariable("texturePosition", fragmentShaderPosition, dtPosition);
  velocityVariable = gpuCompute.addVariable("textureVelocity", fragmentShaderVelocity, dtVelocity);

  gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
  gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);

  positionUniforms = positionVariable.material.uniforms;
  velocityUniforms = velocityVariable.material.uniforms;

  positionUniforms.time = { value: 0.0 };
  positionUniforms.delta = { value: 0.0 };

  velocityUniforms.time = { value: 0.0 };
  velocityUniforms.delta = { value: 0.0 };
  velocityUniforms.separationDistance = { value: 20.0 };
  velocityUniforms.alignmentDistance = { value: 40.0 };
  velocityUniforms.cohesionDistance = { value: 40.0 };
  velocityUniforms.freedomFactor = { value: 1.00 };
  velocityUniforms.predator = { value: new THREE.Vector3() };

  velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed(2);

  const error = gpuCompute.init();

  const gui = new dat.GUI();
  const birdFolder = gui.addFolder('Flocking Settings');

  birdFolder.add(velocityUniforms.separationDistance, 'value', 0.0, 100.0).name('Separation');
  birdFolder.add(velocityUniforms.alignmentDistance, 'value', 0.0, 100.0).name('Alignment');
  birdFolder.add(velocityUniforms.cohesionDistance, 'value', 0.0, 100.0).name('Cohesion');

  birdFolder.open();



  if (error) console.error(error);
}



// Loading Antelope
const antelopeCount = 36;
const antelopeModels = [];
const antelopeMixers = [];
const loader = new GLTFLoader();
const dummy = new THREE.Object3D();
const antelopeActions = [];

for (let i = 0; i < antelopeCount; i++) {
  loader.load('assets/models/sable_antelope_low_poly_light.glb', (gltf) => {
    const model = gltf.scene;
    model.scale.set(10, 10, 10);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true; 
      }
    });

    scene.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const runClip = gltf.animations.find(c => c.name.toLowerCase().includes('run'));
    if (runClip) {
      const action = mixer.clipAction(runClip);
      action.play();
      action.startAt(Math.random() * runClip.duration);
      antelopeActions.push(action);
    }

    antelopeModels.push(model);
    antelopeMixers.push(mixer);
  });
}








// Create the camera
const camera = new THREE.PerspectiveCamera(
  75, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  10000
);
camera.position.set(0, 0, 0);

// Create the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Changing the Renderer Output Resolution

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soften the shadows

renderer.toneMapping = THREE.ACESFilmicToneMapping; // Soft cinematic tones
renderer.toneMappingExposure = 0.8; // Exposure is turned down and dimmed.


initComputeRenderer(renderer);


document.body.appendChild(renderer.domElement);

//Create top-down camera
let isTopDownView = false;
const topDownCamera = new THREE.PerspectiveCamera(
    75, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    10000
);
topDownCamera.position.set(0, 700, 0);
topDownCamera.lookAt(new THREE.Vector3(0, 0, 0));


// hdr sky


let sky;
let sunDirection, light, sunHelper;
let u, v;
let params = {
  skyRotationY: 0.5
};

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const rgbeLoader = new RGBELoader();
rgbeLoader.load('assets/hdr/industrial_sunset_02_puresky_4k.hdr', (hdrEquirect) => {
  const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture;
  scene.environment = envMap;

  // Creating Sky Balls
  const skyGeo = new THREE.SphereGeometry(5000, 60, 40);
  const skyMat = new THREE.MeshBasicMaterial({
    map: hdrEquirect,
    side: THREE.BackSide,
    color: new THREE.Color(0xd8c58a)
  });
  sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);


  const gui = new dat.GUI();
  gui.add(params, 'skyRotationY', -Math.PI, Math.PI, 0.01).name('Sky Rotation').onChange(updateSun);

 

  // Automatic extraction of the sun's direction
  const data = hdrEquirect.image.data;
  const width = hdrEquirect.image.width;
  const height = hdrEquirect.image.height;

  let maxLuminance = 0;
  let maxIndex = 0;

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luminance > maxLuminance) {
      maxLuminance = luminance;
      maxIndex = i;
    }
  }

  const x = maxIndex % width;
  const y = Math.floor(maxIndex / width);
  const u = x / width;
  const v = y / height;

  const phi = u * 2 * Math.PI;
  const theta = v * Math.PI;

  const sunDirection = new THREE.Vector3(
    Math.sin(theta) * Math.sin(phi),
    Math.cos(theta),
    Math.sin(theta) * Math.cos(phi)
  ).normalize();

 

  // Create and add direct light (to simulate sunlight)
  const light = new THREE.DirectionalLight(0xffbb66, 0.8);
  light.position.copy(sunDirection.clone().multiplyScalar(100));
  light.castShadow = true;
  
  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;

  light.shadow.camera.left = -500;
  light.shadow.camera.right = 500;
  light.shadow.camera.top = 500;
  light.shadow.camera.bottom = -500;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 1000;

  scene.add(light);

  
  // add helper to debug

  // // Debugging light source shadow area
  // const helper = new THREE.CameraHelper(light.shadow.camera);
  // scene.add(helper);

  
  const sunHelper = new THREE.Mesh(
    new THREE.SphereGeometry(5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  sunHelper.position.copy(sunDirection.clone().multiplyScalar(5000));
  scene.add(sunHelper);

  hdrEquirect.dispose();
  updateSun();

  function updateSun() {
    sky.rotation.y = params.skyRotationY;
  
    const phi = u * 2 * Math.PI + params.skyRotationY;
    const theta = v * Math.PI;
  
    sunDirection.set(
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.cos(phi)
    ).normalize();
  
    light.position.copy(sunDirection.clone().multiplyScalar(100));
    sunHelper.position.copy(sunDirection.clone().multiplyScalar(5000));
  }
  

  
});




//Controls
let previousPosition = new THREE.Vector3();
let previousRotation = new THREE.Euler();


const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());
controls.getObject().position.set(0, 32, -350); //Initial camera position
camera.lookAt(new THREE.Vector3(0, 0, 0));
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let destination = null;


document.addEventListener('click', (event) => {
  if (isTopDownView) {
    // Handle clicks in top-down view
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(terrain);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        destination = new THREE.Vector3(point.x, point.y, point.z);
        console.log('Destination set:', destination);

        visualizeDestination(destination);
        updatePath();
    }
  }
else {
  controls.lock(); //Go to first person mode
  }
});

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const move = {
  forward: false,
  backward: false,
  turnLeft: false,
  turnRight: false,
  strafeLeft: false,
  strafeRight: false,
  up: false, 
  down: false 
};

// Listen for key presses
document.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'KeyW': move.forward = true; break;
    case 'KeyS': move.backward = true; break;
    case 'KeyA': move.turnLeft = true; break;
    case 'KeyD': move.turnRight = true; break;
    case 'KeyQ': move.strafeLeft = true; break;
    case 'KeyE': move.strafeRight = true; break;
    case 'KeyR': move.up = true; break; 
    case 'KeyF': move.down = true; break;   
    case 'KeyT': {
      isTopDownView = !isTopDownView;

      if (isTopDownView) {
        previousPosition.copy(controls.getObject().position);
        previousRotation.copy(controls.getObject().rotation);
        controls.unlock();
        camera.position.copy(topDownCamera.position);
        camera.lookAt(topDownCamera.getWorldDirection(new THREE.Vector3()).add(camera.position));
        document.body.style.cursor = 'default';
        topDownTextbox.style.display = 'block';
      } else {
        controls.getObject().position.copy(previousPosition);
        controls.getObject().rotation.copy(previousRotation);
        controls.lock();
        camera.position.set(controls.getObject().position.x, controls.getObject().position.y, controls.getObject().position.z);
        document.body.style.cursor = 'none';
        topDownTextbox.style.display = 'none';
      }
      break;
    }
  }
});

// Listen for release keys
document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW': move.forward = false; break;
    case 'KeyS': move.backward = false; break;
    case 'KeyA': move.turnLeft = false; break;
    case 'KeyD': move.turnRight = false; break;
    case 'KeyQ': move.strafeLeft = false; break;
    case 'KeyE': move.strafeRight = false; break;
    case 'KeyR': move.up = false; break; 
    case 'KeyF': move.down = false; break;  
  }
});







// terrain


// Change terrain resolution
const worldWidth = 800; 
const worldDepth = 800;





function generateHeight(width, height) {

  const size = width * height;
  const data = new Float32Array(size); 
  const perlin = new ImprovedNoise();
  const seed = 57;
  const z = seed * 0.12345;

  // Define independent point peaks
  const mountainCenters = [
    { x: 0.3, z: 0.4, radius: 0.12, strength: 2 },
    // { x: 0.8, z: 0.6, radius: 0.12, strength: 0.8 },
  ];

  // Define rolling ridgelines
  const mountainLines = [
    { start: {x: 0.1, z: 0.8}, end: {x: 0.9, z: 0.8}, radius: 0.4, strength: 0.6 },
    { start: {x: 0.6, z: 0.6}, end: {x: 0.9, z: 0.6}, radius: 0.08, strength: 0.9 },
    { start: {x: 0.1, z: 0.5}, end: {x: 0.4, z: 0.5}, radius: 0.08, strength: 0.9 },
    { start: {x: 0.2, z: 0.2}, end: {x: 0.9, z: 0.2}, radius: 0.1, strength: 0.3 },
  ];

  // 计算(u,v)位置的总权重（点 + 线）
  function getMountainWeight(u, v) {
    let weight = 0.0;

    // 点式山峰权重
    for (const center of mountainCenters) {
      const dx = u - center.x;
      const dz = v - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz) / center.radius;
      if (dist < 1.0) {
        const localWeight = Math.pow(1.0 - dist, 2.0); // 平滑衰减
        weight += localWeight * center.strength;
      }
    }

    // 线式山脊权重
    for (const line of mountainLines) {
      const dist = distancePointToSegment(u, v, line.start.x, line.start.z, line.end.x, line.end.z) / line.radius;
      if (dist < 1.0) {
        const localWeight = Math.pow(1.0 - dist, 2.0); // 平滑衰减
        weight += localWeight * line.strength;
      }
    }

    return Math.min(weight, 1.0); // 最多是1
  }

  // Auxiliary function: nearest distance from a point to a line segment
  function distancePointToSegment(px, pz, ax, az, bx, bz) {
    const abx = bx - ax;
    const abz = bz - az;
    const apx = px - ax;
    const apz = pz - az;
    const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / (abx * abx + abz * abz)));
    const closestX = ax + abx * t;
    const closestZ = az + abz * t;
    const dx = px - closestX;
    const dz = pz - closestZ;
    return Math.sqrt(dx * dx + dz * dz);
  }

  let quality = 1;
  for (let j = 0; j < 4; j++) {

    for (let i = 0; i < size; i++) {

      const x = i % width;
      const y = ~~(i / width);

      const u = x / (width - 1);
      const v = y / (height - 1);

      

      const baseNoiseScale = 40; // Noise frequency of small undulations on a flat surface (larger and denser)
      const baseNoiseStrength = 0.8; // Intensity of undulation on a flat surface

      const noiseScale = 0.5
      const mainNoise = Math.abs(perlin.noise(x * noiseScale / quality, y * noiseScale / quality, z) * quality * 1.75);
      const baseNoise = Math.abs(perlin.noise(x * baseNoiseScale / width, y * baseNoiseScale / height, z + 100));

      const mountainWeight = getMountainWeight(u, v);

      
      data[i] += mainNoise * mountainWeight + baseNoise * baseNoiseStrength;
    }

    quality *= 5;
  }

  return data;
}


// texture



function generateWangTextures(callback, mapWidth = 6, mapHeight = 6, tileSize = 128) { // Canvas size change
  const canvasList = {
    map: document.createElement('canvas'),
    aoMap: document.createElement('canvas'),
    roughnessMap: document.createElement('canvas'),
    displacementMap: document.createElement('canvas'),
    normalMap: document.createElement('canvas')
  };

  const ctxList = {};
  for (const key in canvasList) {
    canvasList[key].width = mapWidth * tileSize;
    canvasList[key].height = mapHeight * tileSize;
    ctxList[key] = canvasList[key].getContext('2d');
  }

  const tileMap = wang(mapWidth, mapHeight);
  const textureTypes = ['diff', 'ao', 'rough', 'disp', 'normal'];
  const textureKeys = ['map', 'aoMap', 'roughnessMap', 'displacementMap', 'normalMap'];

  const tiles = {};
  const totalToLoad = 16 * textureTypes.length;
  let loaded = 0;

  for (let i = 0; i < 16; i++) {
    for (let t = 0; t < textureTypes.length; t++) {
      const texType = textureTypes[t];
      const key = textureKeys[t];

      const img = new Image();
      img.src = `assets/wang_tiles/wang_${i}_${texType}.png`;
      if (!tiles[key]) tiles[key] = [];
      tiles[key][i] = img;

      img.onload = () => {
        loaded++;
        if (loaded === totalToLoad) drawAll();
      };
    }
  }

  function drawAll() {
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const index = tileMap[y * mapWidth + x];
        textureKeys.forEach((key) => {
          ctxList[key].drawImage(tiles[key][index], x * tileSize, y * tileSize, tileSize, tileSize);
        });
      }
    }

    const textures = {};
    for (const key in canvasList) {
      const tex = new THREE.CanvasTexture(canvasList[key]);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      textures[key] = tex;
    }

    callback(textures);
  }
}



// World-wide dimensions of terrain
const terrainSize = 1000;


// Height scaling of terrain; Overall adjustment of the height of the mountain
const terrainHeightScale = 1; 


const data = generateHeight(worldWidth, worldDepth);



// Coordinate mapping and sampling
const terrainHeightCache = new Map();
function getTerrainHeightAt(x, z) {
  const key = `${Math.round(x)},${Math.round(z)}`;
  if (terrainHeightCache.has(key)) {
    return terrainHeightCache.get(key);
  }
  
  const gridX = ((x + terrainSize / 2) / terrainSize) * (worldWidth - 1);
  const gridZ = ((z + terrainSize / 2) / terrainSize) * (worldDepth - 1);

  const i = Math.floor(gridZ) * worldWidth + Math.floor(gridX);

  // Boundary detection
  if (i < 0 || i >= data.length) return 0;

  const height = data[i] * terrainHeightScale;
  terrainHeightCache.set(key, height);

  return height;
}








const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, worldWidth - 1, worldDepth - 1);
geometry.rotateX(-Math.PI / 2);


const vertices = geometry.attributes.position.array;
for (let i = 0, j = 0; i < data.length; i++, j += 3) {
  vertices[j + 1] = data[i] * terrainHeightScale; 
}
geometry.computeVertexNormals();
geometry.setAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));


let terrain;
generateWangTextures((textures) => {
  const material = new THREE.MeshStandardMaterial({
    map: textures.map,
    aoMap: textures.aoMap,
    roughnessMap: textures.roughnessMap,
    displacementMap: textures.displacementMap,
    normalMap: textures.normalMap, 
  
    roughness: 2,
    metalness: 0,
    displacementScale: 3,
    envMapIntensity: 0.4
  });

  geometry.computeVertexNormals();
  

  geometry.attributes.uv.array.forEach((v, i, arr) => {
    arr[i] *= 50; // Change in laying density
  });
  geometry.attributes.uv.needsUpdate = true;

  terrain = new THREE.Mesh(geometry, material);
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  scene.add(terrain);
});

// generateWangTextures((textures) => {

//   // textures.map 是生成好的 Wang Tile Texture

//   const textureLoader = new THREE.TextureLoader();

//   const sandTexture = textureLoader.load('assets/textures/coast_sand_01_4k/coast_sand_01_diff_4k.jpg');
//   const splatMap = textureLoader.load('assets/textures/splatmap.png');

//   sandTexture.wrapS = sandTexture.wrapT = THREE.RepeatWrapping;
//   textures.map.wrapS = textures.map.wrapT = THREE.RepeatWrapping;
//   splatMap.wrapS = splatMap.wrapT = THREE.RepeatWrapping;

//   const material = new THREE.ShaderMaterial({
//     uniforms: {
//       wangTexture: { value: textures.map },
//       sandTexture: { value: sandTexture },
//       splatMap: { value: splatMap },
//       wangScale: { value: 20.0 },
//       sandScale: { value: 20.0 }
//     },
//     vertexShader: `
//       varying vec2 vUv;
//       void main() {
//         vUv = uv;
//         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//       }
//     `,
//     fragmentShader: `
//       uniform sampler2D wangTexture;
//       uniform sampler2D sandTexture;
//       uniform sampler2D splatMap;
//       uniform float wangScale;
//       uniform float sandScale;

//       varying vec2 vUv;

//       void main() {
//         vec4 splat = texture2D(splatMap, vUv);

//         vec4 wangColor = texture2D(wangTexture, vUv * wangScale);
//         vec4 sandColor = texture2D(sandTexture, vUv * sandScale);

//         vec4 color = splat.r * wangColor + splat.g * sandColor;

//         // vec4 color = 0.0 * wangColor + 1.0 * sandColor;
//         gl_FragColor = color;
//       }
//     `
//   });

//   geometry.computeVertexNormals();
  
//   geometry.attributes.uv.array.forEach((v, i, arr) => {
//     arr[i] *= 1.0; // Splat map 用正常 UV，不需要放大
//   });
//   geometry.attributes.uv.needsUpdate = true;

//   const terrain = new THREE.Mesh(geometry, material);
//   terrain.castShadow = true;
//   terrain.receiveShadow = true;
//   scene.add(terrain);
// });

// generateWangTextures((wangTextures) => {
//   const loader = new THREE.TextureLoader();

//   const uniforms = {
//     wangMap: { value: wangTextures.map },
//     wangAOMap: { value: wangTextures.aoMap },
//     wangRoughnessMap: { value: wangTextures.roughnessMap },
//     wangDisplacementMap: { value: wangTextures.displacementMap },
//     wangNormalMap: { value: wangTextures.normalMap },

//     sandMap: { value: loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_diff_4k.jpg') },
//     sandAOMap: { value: loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_ao_4k.jpg') },
//     sandRoughnessMap: { value: loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_rough_4k.jpg') },
//     sandDisplacementMap: { value: loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_disp_4k.jpg') },
//     sandNormalMap: { value: loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_nor_dx_4k.jpg') },

//     splatMap: { value: loader.load('assets/textures/splatmap.png') },

//     wangScale: { value: 50.0 },
//     sandScale: { value: 50.0 }
//   };

//   // 贴图 wrap 设置
//   for (let key in uniforms) {
//     const tex = uniforms[key].value;
//     if (tex instanceof THREE.Texture) {
//       tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
//     }
//   }

//   const material = new THREE.ShaderMaterial({
//     uniforms,
//     vertexShader: `
//       varying vec2 vUv;
//       void main() {
//         vUv = uv;
//         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//       }
//     `,
//     fragmentShader: `
//       uniform sampler2D wangMap, sandMap;
//       uniform sampler2D wangAOMap, sandAOMap;
//       uniform sampler2D wangRoughnessMap, sandRoughnessMap;
//       uniform sampler2D wangDisplacementMap, sandDisplacementMap;
//       uniform sampler2D wangNormalMap, sandNormalMap;
//       uniform sampler2D splatMap;

//       uniform float wangScale;
//       uniform float sandScale;

//       varying vec2 vUv;

//       void main() {
//         vec2 wangUV = vUv * wangScale;
//         vec2 sandUV = vUv * sandScale;

//         vec4 splat = texture2D(splatMap, vUv);
//         float w = splat.r;
//         float s = splat.g;
//         float total = w + s;
//         w = w / total;
//         s = s / total;

//         // 主颜色混合
//         vec4 colorWang = texture2D(wangMap, wangUV);
//         vec4 colorSand = texture2D(sandMap, sandUV);
//         vec4 finalColor = w * colorWang + s * colorSand;

//         // AO 混合（可以乘 finalColor）
//         float aoW = texture2D(wangAOMap, wangUV).r;
//         float aoS = texture2D(sandAOMap, sandUV).r;
//         float ao = w * aoW + s * aoS;

//         // Roughness 混合
//         float roughW = texture2D(wangRoughnessMap, wangUV).r;
//         float roughS = texture2D(sandRoughnessMap, sandUV).r;
//         float roughness = w * roughW + s * roughS;

//         // Normal 混合（这里只做简单混合，后面可用更复杂方法）
//         vec3 normalW = texture2D(wangNormalMap, wangUV).xyz * 2.0 - 1.0;
//         vec3 normalS = texture2D(sandNormalMap, sandUV).xyz * 2.0 - 1.0;
//         vec3 blendedNormal = normalize(w * normalW + s * normalS);

//         // 输出
//         gl_FragColor = vec4(finalColor.rgb * ao, 1.0);
//       }
//     `
//   });

//   const terrain = new THREE.Mesh(geometry, material);
//   terrain.castShadow = true;
//   terrain.receiveShadow = true;
//   scene.add(terrain);
// });




// generateWangTextures((wangTextures) => {

//   const loader = new THREE.TextureLoader();


//   const sandMap = loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_diff_4k.jpg');
//   const sandAOMap = loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_ao_4k.jpg');
//   const sandRoughMap = loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_rough_4k.jpg');
//   const sandDispMap = loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_disp_4k.jpg');
//   const sandNormalMap = loader.load('assets/textures/coast_sand_01_4k/coast_sand_01_nor_dx_4k.jpg');


//   const splatMap = loader.load('assets/textures/splatmap.png');

//   const scaleWang = 50;
//   const scaleSand = 50;

//   // === 2. 设置重复模式 ===
//   const allTextures = [
//     ...Object.values(wangTextures),
//     sandMap, sandAOMap, sandRoughMap, sandDispMap, sandNormalMap,
//     splatMap
//   ];

//   allTextures.forEach(tex => {
//     tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
//     tex.colorSpace = THREE.SRGBColorSpace;
//   });

//   // === 3. 创建 UV ===
//   const uv = varying(vec2()); // vUv 自动传入
//   const uvWang = mul(uv, float(scaleWang));
//   const uvSand = mul(uv, float(scaleSand));

//   // === 4. 采样贴图 ===
//   const wangColor = texture(wangTextures.map, uvWang);
//   const sandColor = texture(sandMap, uvSand);

//   const splat = texture(splatMap, uv); // 控制混合
//   const blendWang = splat.r;
//   const blendSand = splat.g;
//   const blendTotal = add(blendWang, blendSand);

//   // === 5. Diffuse 混合 ===
//   const finalColor = mix(wangColor, sandColor, blendSand);

//   // === 6. Normal 混合 ===
//   const wangNormal = normalMapNode(texture(wangTextures.normalMap, uvWang));
//   const sandNormal = normalMapNode(texture(sandNormalMap, uvSand));
//   const finalNormal = mix(wangNormal, sandNormal, blendSand);

//   // === 7. Roughness 混合 ===
//   const wangRough = texture(wangTextures.roughnessMap, uvWang).g;
//   const sandRough = texture(sandRoughMap, uvSand).g;
//   const finalRough = mix(wangRough, sandRough, blendSand);

//   // === 8. AO 混合 ===
//   const wangAO = texture(wangTextures.aoMap, uvWang).r;
//   const sandAO = texture(sandAOMap, uvSand).r;
//   const finalAO = mix(wangAO, sandAO, blendSand);

//   // === 9. 位移贴图（暂不混合，取 Wang 或 Sand 其中之一）===
//   const displacementMap = texture(sandDispMap, uvSand); // 可换成 wangTextures.displacementMap

//   // === 10. 构建 Node 材质 ===
//   const material = new MeshStandardNodeMaterial();

//   material.colorNode = finalColor;
//   material.normalNode = finalNormal;
//   material.roughnessNode = finalRough;
//   material.aoNode = finalAO;
//   material.displacementMap = sandDispMap;
//   material.displacementScale = 2;
//   material.envMapIntensity = 1;
//   material.metalness = 0;

//   // === 11. 地形 Mesh ===
//   const terrain = new THREE.Mesh(geometry, material);
//   terrain.castShadow = true;
//   terrain.receiveShadow = true;
//   scene.add(terrain);

// });



// grass and bush




// create seed
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// grass

const grassCount = 500; // Total number of grasses
const grassFiles = ['grass0.glb', 'grass1.glb']; 
const allGrassClumps = []; // Store all grass clusters
let grassLoaded = 0;

const grassLoader = new GLTFLoader();

grassFiles.forEach((filename) => {
  grassLoader.load(`assets/models/${filename}`, (gltf) => {
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.alphaTest = 0.5;
          child.material.transparent = true;
        }
        allGrassClumps.push(child); // Collect tufted grasses from different models
      }
    });

    grassLoaded++;
    if (grassLoaded === grassFiles.length) {
      scatterAllGrass(); 
    }
  });
});





function scatterAllGrass() {
  const grassRand = mulberry32(2025);// Random seeds
  for (let i = 0; i < grassCount; i++) {
    const base = allGrassClumps[Math.floor(grassRand() * allGrassClumps.length)];
    const clone = base.clone();

    

    const x = grassRand() * 300 - 150; // Width range
    const z = grassRand() * 100 - 400; // Depth range
    const y = getTerrainHeightAt(x, z);

    clone.position.set(x, y, z);
    clone.rotation.y = grassRand() * Math.PI * 2;
    const scale = 4 + grassRand() * 2;
    clone.scale.set(scale, scale, scale);

    scene.add(clone);
  }
}






// flower
const flowerCount = 10;
const flowerFiles = ['flower0.glb'];
const allFlowers = [];
let flowerLoaded = 0;

const flowerLoader = new GLTFLoader();

flowerFiles.forEach((filename) => {
  flowerLoader.load(`assets/models/${filename}`, (gltf) => {
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.alphaTest = 0.5;
          child.material.transparent = true;
        }
        allFlowers.push(child);
      }
    });

    flowerLoaded++;
    if (flowerLoaded === flowerFiles.length) {
      scatterFlowers(); // 
    }
  });
});

function scatterFlowers() {
  const flowerRand = mulberry32(300); // 
  for (let i = 0; i < flowerCount; i++) {
    const base = allFlowers[Math.floor(flowerRand() * allFlowers.length)];
    const clone = base.clone();

    const x = flowerRand() * 300 - 150; // 
    const z = flowerRand() * 100 - 400;
    const y = getTerrainHeightAt(x, z);

    clone.position.set(x, y, z);
    clone.rotation.y = flowerRand() * Math.PI * 2;
    const scale = 4 + flowerRand() * 2;
    clone.scale.set(scale, scale, scale);

    scene.add(clone);
  }
}



// rock
const rockCount = 30;
const rockFiles = ['rock0.glb', 'rock1.glb']; 
const allRocks = [];
let rockLoaded = 0;

const rockLoader = new GLTFLoader();

rockFiles.forEach(filename => {
  rockLoader.load(`assets/models/${filename}`, (gltf) => {
    gltf.scene.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        allRocks.push(child);
      }
    });

    rockLoaded++;
    if (rockLoaded === rockFiles.length) {
      scatterRocks();
    }
  });
});

function scatterRocks() {
  const rand = mulberry32(303); 
  for (let i = 0; i < rockCount; i++) {
    const base = allRocks[Math.floor(rand() * allRocks.length)];
    const clone = base.clone();

    const x = rand() * 800 - 400;
    const z = rand() * 200 - 50;
    const y = getTerrainHeightAt(x, z);

    clone.position.set(x, y, z);
    clone.rotation.y = rand() * Math.PI * 2;
    const scale = 2 + rand() * 2;
    clone.scale.set(scale, scale, scale);

    scene.add(clone);
  }
}



// small stones


const stoneCount = 200;
const stoneFiles = ['stone0.glb']; 
const allStones = [];
let stoneLoaded = 0;

const stoneLoader = new GLTFLoader();

stoneFiles.forEach((filename) => {
  stoneLoader.load(`assets/models/${filename}`, (gltf) => {
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          child.material.alphaTest = 0.5;
          child.material.transparent = true;
          child.material.depthWrite = true;
          child.material.side = THREE.DoubleSide;
        }

        allStones.push(child);
      }
    });

    stoneLoaded++;
    if (stoneLoaded === stoneFiles.length) {
      scatterStones(); 
    }
  });
});


function scatterStones() {
  const stoneRand = mulberry32(5555); 
  for (let i = 0; i < stoneCount; i++) {
    const base = allStones[Math.floor(stoneRand() * allStones.length)];
    const clone = base.clone();

   
    const x = stoneRand() * 400 - 200;
    const z = stoneRand() * 100 - 400;
    const y = getTerrainHeightAt(x, z);

    clone.position.set(x, y, z);
    clone.rotation.y = stoneRand() * Math.PI * 2;
    const scale = 2 + stoneRand() * 2; 
    clone.scale.set(scale, scale, scale);

    scene.add(clone);
  }
}






//boids animation

function animateAntelopes(readPixels) {
  for (let i = 0; i < antelopeModels.length; i++) {
    const model = antelopeModels[i];

    const x = readPixels[i * 4 + 0];
    const y = readPixels[i * 4 + 1];
    const z = readPixels[i * 4 + 2];

    const terrainY = getTerrainHeightAt(x, z);
    model.position.set(x, terrainY + 0, z);

    const vx = x - previousPositions[i * 3 + 0];
    const vy = y - previousPositions[i * 3 + 1];
    const vz = z - previousPositions[i * 3 + 2];
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz); 

    // Calculate steering
    const angle = Math.atan2(vx, vz);
    model.rotation.set(0, angle, 0);

    // Update the animated Mixer
    if (i < antelopeMixers.length) {
      antelopeMixers[i].update(0.016); // Advancing animation every frame
    }

    // Dynamically adjusts the animation speed according to the speed
    if (i < antelopeActions.length) {
      const mappedSpeed = THREE.MathUtils.clamp(speed , 0.9, 1.1); 
      antelopeActions[i].timeScale = mappedSpeed;
    }



    previousPositions[i * 3 + 0] = x;
    previousPositions[i * 3 + 1] = y;
    previousPositions[i * 3 + 2] = z;
  }
}



const previousPositions = new Float32Array(antelopeCount * 3);



// Sand tornado particles
const particleCount = 4000;
const particlesGeometry = new THREE.BufferGeometry();
const particlesMaterial = new THREE.PointsMaterial({
    color: new THREE.Color(0x5c3a04),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: new THREE.TextureLoader().load('assets/textures/sand_texture.jpg'),
});

const particlesSizes = [];
for (let i = 0; i < particleCount; i++) {
    particlesSizes.push(Math.random() * 2 + 1);
}

const particlesVertices = [];
const particlesVelocities = [];
const particlesLifetimes = [];
const particlesMaxLifetimes = [];
const tornadoCenter = new THREE.Vector3(0, 0, 0);
let tornadoRadius = 50;
const tornadoHeight = 90;
const tornadoUpwardSpeed = 0.2;
const rotationSpeed = 0.02;

let tornadoMoveDirection = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
let tornadoMoveSpeed = 0.3;

for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const height = Math.random() * tornadoHeight;

    const radiusFactor = Math.sqrt(Math.random());
    const radius = tornadoRadius * radiusFactor * (1 - height / tornadoHeight); 

    particlesVertices.push(
        tornadoCenter.x + Math.cos(angle) * radius,
        height,
        tornadoCenter.z + Math.sin(angle) * radius
    );

    particlesVelocities.push(
        -Math.sin(angle) * rotationSpeed,  
        tornadoUpwardSpeed,  
        Math.cos(angle) * rotationSpeed
    );

    particlesLifetimes.push(Math.random() * 5);
    particlesMaxLifetimes.push(Math.random() * 8 + 3);
}

particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlesVertices, 3));
particlesGeometry.setAttribute('velocity', new THREE.Float32BufferAttribute(particlesVelocities, 3));
particlesGeometry.setAttribute('lifetime', new THREE.Float32BufferAttribute(particlesLifetimes, 1));
particlesGeometry.setAttribute('maxLifetime', new THREE.Float32BufferAttribute(particlesMaxLifetimes, 1));

const sandTornadoParticles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(sandTornadoParticles);


// Sand tornado animation
function updateSandTornado() {
    const positions = sandTornadoParticles.geometry.attributes.position.array;
    const velocities = sandTornadoParticles.geometry.attributes.velocity.array;
    const lifetimes = sandTornadoParticles.geometry.attributes.lifetime.array;
    const maxLifetimes = sandTornadoParticles.geometry.attributes.maxLifetime.array;

    const boundary = 350;
    if (tornadoCenter.x > boundary || tornadoCenter.x < -boundary) {
        tornadoMoveDirection.x *= -1;
    }
    if (tornadoCenter.z > boundary || tornadoCenter.z < -boundary) {
        tornadoMoveDirection.z *= -1;
    }

    tornadoCenter.add(tornadoMoveDirection.clone().multiplyScalar(tornadoMoveSpeed));

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];

        const relativeX = x - tornadoCenter.x;
        const relativeZ = z - tornadoCenter.z;
        let angle = Math.atan2(relativeZ, relativeX);
        let radius = Math.sqrt(relativeX * relativeX + relativeZ * relativeZ);
        radius += 0.1; 

        angle += rotationSpeed;

        positions[i] = tornadoCenter.x + Math.cos(angle) * radius;
        positions[i + 2] = tornadoCenter.z + Math.sin(angle) * radius;
        positions[i + 1] += velocities[i + 1];

        lifetimes[i / 3] += 0.01;

        if (lifetimes[i / 3] > maxLifetimes[i / 3]) {
            const newAngle = Math.random() * Math.PI * 2;
            const newRadiusFactor = Math.sqrt(Math.random());
            const newRadius = tornadoRadius * newRadiusFactor;
            positions[i] = tornadoCenter.x + Math.cos(newAngle) * newRadius;
            positions[i + 1] = 0;
            positions[i + 2] = tornadoCenter.z + Math.sin(newAngle) * newRadius;
            lifetimes[i / 3] = 0;
        }

        velocities[i] = -Math.sin(angle) * rotationSpeed;
        velocities[i + 2] = Math.cos(angle) * rotationSpeed;
    }

    sandTornadoParticles.geometry.attributes.position.needsUpdate = true;
    sandTornadoParticles.geometry.attributes.lifetime.needsUpdate = true;
}


//Fractal tree
const barkTexture = new THREE.TextureLoader().load('assets/textures/bark_texture.jpg');
barkTexture.wrapS = THREE.RepeatWrapping;
barkTexture.wrapT = THREE.RepeatWrapping;
barkTexture.encoding = THREE.sRGBEncoding;

//Branch creation
function createBranch(length, thickness) {
  const geometry = new THREE.CylinderGeometry(
    thickness * 0.65,
    thickness,
    length,
    8
  );

  geometry.translate(0, length / 2, 0);

  const material = new THREE.MeshStandardMaterial({
    map: barkTexture,
    roughness: 1,
    metalness: 0,
    color: new THREE.Color(0x888888),
  });

  const branch = new THREE.Mesh(geometry, material);
  branch.castShadow = true;
  branch.receiveShadow = true;

  return branch;
}

//Fractal tree creation
function createFractalTree(parent, length, thickness, depth, isRoot = false) {
  if (depth === 0) return;

  const branch = createBranch(length, thickness);
  parent.add(branch);
  branch.position.y = 0;

  let angleX, angleZ;
  if (isRoot) {
    angleX = (Math.random() - 0.5) * Math.PI / 15;
    angleZ = (Math.random() - 0.5) * Math.PI / 15;
  } else {
    angleX = (Math.random() - 0.5) * Math.PI / 3;
    angleZ = (Math.random() - 0.5) * Math.PI / 3;
  }
  branch.rotation.x = angleX;
  branch.rotation.z = angleZ;


  const newLength = length * (0.8 + Math.random() * 0.2);
  const newThickness = thickness * (0.6 + Math.random() * 0.2);


  const child1 = new THREE.Object3D();
  child1.position.y = length;
  branch.add(child1);
  child1.rotation.y = Math.random() * Math.PI * 2;
  createFractalTree(child1, newLength, newThickness, depth - 1);

  const child2 = new THREE.Object3D();
  child2.position.y = length;
  branch.add(child2);
  child2.rotation.y = Math.random() * Math.PI * 2;
  createFractalTree(child2, newLength, newThickness, depth - 1);
}

// Create 20 trees
const trees = [];
for (let i = 0; i < 20; i++) {
  const tree = new THREE.Object3D();
  createFractalTree(tree, 10, 2, 8, true);
  tree.position.x = (Math.random() - 0.5) * worldWidth;
  tree.position.z = (Math.random() - 0.5) * worldDepth;
  tree.position.y = getTerrainHeightAt(tree.position.x, tree.position.z);
  tree.rotation.y = Math.random() * Math.PI * 2;

  scene.add(tree);
  trees.push(tree);
}



//Shortest path algorithm
const stepSize = 10;

//Make user follow terrain
function updateUserPosition() {
  const userPosition = controls.getObject().position;
  const terrainHeight = getTerrainHeightAt(userPosition.x, userPosition.z);
  if(!isTopDownView) {
    userPosition.y = terrainHeight + 15;
  }
}

function getNeighbors(node) {
  const neighbors = [];

  const directions = [
      { dx: -stepSize, dz: 0 }, // Left
      { dx: stepSize, dz: 0 },  // Right
      { dx: 0, dz: -stepSize }, // Down
      { dx: 0, dz: stepSize },  // Up
      { dx: -stepSize, dz: -stepSize }, // Top-left
      { dx: stepSize, dz: -stepSize },  // Top-right
      { dx: -stepSize, dz: stepSize },  // Bottom-left
      { dx: stepSize, dz: stepSize },   // Bottom-right
  ];

  for (const { dx, dz } of directions) {
      const neighborX = node.x + dx;
      const neighborZ = node.z + dz;

      if (
        neighborX < -terrainSize / 2 || neighborX > terrainSize / 2 ||
        neighborZ < -terrainSize / 2 || neighborZ > terrainSize / 2
    ) {
        continue;
    }

      const neighborHeight = getTerrainHeightAt(neighborX, neighborZ);

      const heightDifference = Math.abs(neighborHeight - node.height);
      const heightPenalty = neighborHeight * 3;

      const cost = 1 + heightDifference * 3 + heightPenalty; 

      neighbors.push({
          x: neighborX,
          z: neighborZ,
          height: neighborHeight,
          cost: cost,
      });
  }

  return neighbors;
}


//Finding the shortest path using A* algorithm
function findShortestPath(start, goal) {
  const openSet = [start];
  const cameFrom = new Map();
  cameFrom.set(`${start.x},${start.z}`, null);

  const gScore = new Map();
  gScore.set(`${start.x},${start.z}`, 0);

  const fScore = new Map();
  fScore.set(`${start.x},${start.z}`, heuristic(start, goal));

  while (openSet.length > 0) {
      openSet.sort((a, b) => fScore.get(`${a.x},${a.z}`) - fScore.get(`${b.x},${b.z}`));
      const current = openSet.shift();

      console.log('Processing node:', current);

      // Check if we've reached the goal
      if (Math.sqrt((current.x - goal.x) ** 2 + (current.z - goal.z) ** 2) < stepSize) {
          console.log('Goal reached:', current);
          return reconstructPath(cameFrom, current);
      }

      for (const neighbor of getNeighbors(current)) {
          const tentativeGScore = gScore.get(`${current.x},${current.z}`) + neighbor.cost;

          if (tentativeGScore < (gScore.get(`${neighbor.x},${neighbor.z}`) || Infinity)) {
              cameFrom.set(`${neighbor.x},${neighbor.z}`, current);
              gScore.set(`${neighbor.x},${neighbor.z}`, tentativeGScore);
              fScore.set(`${neighbor.x},${neighbor.z}`, tentativeGScore + heuristic(neighbor, goal));

              if (!openSet.some(n => n.x === neighbor.x && n.z === neighbor.z)) {
                  openSet.push(neighbor);
              }
          }
      }
  }

  console.log('No path found!');
  return null;
}

function heuristic(node, goal) {
  const dx = node.x - goal.x;
  const dz = node.z - goal.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  const visited = new Set();

  while (true) {
      const key = `${current.x},${current.z}`;
      if (visited.has(key)) {
          console.error('Circular reference detected in cameFrom map:', current);
          break;
      }

      visited.add(key);

      if (!cameFrom.has(key)) {
          console.log('Reached the start of the path or missing node in cameFrom:', current);
          break;
      }

      current = cameFrom.get(key);
      path.unshift(current);
  }

  console.log('Reconstructed path:', path);
  return path;
}


//Visualize the path
let previousTube = null;

function visualizePath(path) {
  if (previousTube) {
    scene.remove(previousTube);
    previousTube.geometry.dispose();
    previousTube.material.dispose();
    previousTube = null;
  }

  console.log('Path to visualize:', path);
  const points = path.map(node => {
      if (!node || typeof node.x === 'undefined' || typeof node.z === 'undefined') {
          console.error('Invalid node in path:', node);
      }
      return new THREE.Vector3(node.x, node.height + 7, node.z);
  });

  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeometry = new THREE.TubeGeometry(curve, 32, 1, 6, false);
  const tubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);

  scene.add(tube);
  previousTube = tube;
}


//Visualize the destination
const destinationMarker = new THREE.Mesh(
  new THREE.SphereGeometry(2, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
destinationMarker.visible = false;
scene.add(destinationMarker);

function visualizeDestination(destination) {
  destinationMarker.position.copy(destination);
  destinationMarker.visible = true;
}

// Update the destination marker position
function updatePath() {
  if (!destination) return;

  const userPosition = controls.getObject().position;
  const snappedDestination = {
    x: Math.round(destination.x / stepSize) * stepSize,
    z: Math.round(destination.z / stepSize) * stepSize,
    height: getTerrainHeightAt(
      Math.round(destination.x / stepSize) * stepSize,
      Math.round(destination.z / stepSize) * stepSize
    ),
  };

  const start = {
    x: Math.round(previousPosition.x / stepSize) * stepSize,
    z: Math.round(previousPosition.z / stepSize) * stepSize,
    height: getTerrainHeightAt(
      Math.round(previousPosition.x / stepSize) * stepSize,
      Math.round(previousPosition.z / stepSize) * stepSize
    ),
    cost: 0,
  };

  const goal = {
    x: snappedDestination.x,
    z: snappedDestination.z,
    height: snappedDestination.height,
    cost: 0,
  };

  const path = findShortestPath(start, goal);
  if (path) {
      visualizePath(path);
  } else {
      console.log('No path found!');
  }
}

const minimapTextbox = document.createElement('div');
minimapTextbox.textContent = 'Press T to toggle minimap';
minimapTextbox.style.position = 'absolute';
minimapTextbox.style.top = '10px';
minimapTextbox.style.left = '10px';
minimapTextbox.style.padding = '5px 10px';
minimapTextbox.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
minimapTextbox.style.color = 'white';
minimapTextbox.style.fontFamily = 'Arial, sans-serif';
minimapTextbox.style.fontSize = '14px';
minimapTextbox.style.borderRadius = '5px';
minimapTextbox.style.zIndex = '1000';
document.body.appendChild(minimapTextbox);

const topDownTextbox = document.createElement('div');
topDownTextbox.textContent = 'Click on your destination on the map';
topDownTextbox.style.position = 'absolute';
topDownTextbox.style.top = '40px';
topDownTextbox.style.left = '10px';
topDownTextbox.style.padding = '5px 10px';
topDownTextbox.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
topDownTextbox.style.color = 'white';
topDownTextbox.style.fontFamily = 'Arial, sans-serif';
topDownTextbox.style.fontSize = '14px';
topDownTextbox.style.borderRadius = '5px';
topDownTextbox.style.zIndex = '1000';
topDownTextbox.style.display = 'none';
document.body.appendChild(topDownTextbox);







// Animation

const moveSpeed = 100;  // Unit: units/second
const turnSpeed = 2.0;  // Unit: radians/second
function updateControls(delta) {
  const object = controls.getObject();

  // 转身
  if (move.turnLeft) object.rotation.y -= turnSpeed * delta;
  if (move.turnRight) object.rotation.y += turnSpeed * delta;

  const direction = new THREE.Vector3();

  // Horizontal movement direction
  if (move.strafeLeft) direction.x -= 1;
  if (move.strafeRight) direction.x += 1;
  if (move.forward) direction.z -= 1;
  if (move.backward) direction.z += 1;
  if (move.up) object.position.y += moveSpeed * delta;
  if (move.down) object.position.y -= moveSpeed * delta;


  direction.normalize();

  if (direction.lengthSq() > 0) {
    const moveVector = new THREE.Vector3(direction.x, 0, direction.z);
    moveVector.applyQuaternion(object.quaternion);
    moveVector.y = 0; // Horizontal movement only
    moveVector.normalize(); 

    object.position.addScaledVector(moveVector, moveSpeed * delta);
  }
}



function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    let delta = (now - (animate.lastTime || now)) / 1000;
    animate.lastTime = now;




    positionUniforms.time.value = now;
    positionUniforms.delta.value = delta;
    velocityUniforms.time.value = now;
    velocityUniforms.delta.value = delta;

    
    
    gpuCompute.compute();

    updateControls(delta);




    if (sky) sky.position.copy(camera.position);

    
    const target = gpuCompute.getCurrentRenderTarget(positionVariable);
    const posTexture = target.texture;
    const readPixels = new Float32Array(WIDTH * WIDTH * 4);
    
    renderer.readRenderTargetPixels(
      target,
      0, 0, WIDTH, WIDTH,
      readPixels
    );

    updateUserPosition();

    animateAntelopes(readPixels);

    antelopeMixers.forEach(m => m.update(delta));
    
    updateSandTornado();

    if (destination) {
      const userPosition = controls.getObject().position;
      const distance = Math.sqrt(
          (userPosition.x - destination.x) ** 2 +
          (userPosition.z - destination.z) ** 2
      );

      if (distance < stepSize) {
          if (previousTube) {
              scene.remove(previousTube);
              previousTube.geometry.dispose();
              previousTube.material.dispose();
              previousTube = null;
          }
          destinationMarker.visible = false;
          destination = null;
      }
  }
    

    renderer.render(scene, camera);
  }
  
  animate();
  
