import * as THREE from 'https://esm.sh/three@0.154.0';
import { OrbitControls } from 'https://esm.sh/three@0.154.0/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'https://esm.sh/three@0.154.0/examples/jsm/loaders/RGBELoader.js';
import { ImprovedNoise } from 'https://esm.sh/three@0.154.0/examples/jsm/math/ImprovedNoise.js';
import { PMREMGenerator } from 'https://esm.sh/three@0.154.0';
import { PointerLockControls } from 'https://esm.sh/three@0.154.0/examples/jsm/controls/PointerLockControls.js';
import { GPUComputationRenderer } from 'https://esm.sh/three@0.154.0/examples/jsm/misc/GPUComputationRenderer.js';




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

  gl_FragColor = vec4( position + velocity * delta * 15. , phase );
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

const float SPEED_LIMIT = 9.0;

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

  if ( length( velocity ) > limit ) {
    velocity = normalize( velocity ) * limit;
  }

  gl_FragColor = vec4( velocity, 1.0 );
}
`;






const WIDTH = 8;
const BOUNDS = 800;
const BOUNDS_HALF = BOUNDS / 2;

function fillPositionTexture(texture) {
  const data = texture.image.data;
  for (let i = 0; i < data.length; i += 4) {
    const x = Math.random() * BOUNDS - BOUNDS_HALF;
    const y = Math.random() * BOUNDS - BOUNDS_HALF;
    const z = Math.random() * BOUNDS - BOUNDS_HALF;
    data[i + 0] = x;
    data[i + 1] = y;
    data[i + 2] = z;
    data[i + 3] = 1;
  }
}

function fillVelocityTexture(texture) {
  const data = texture.image.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = (Math.random() - 0.5) * 10;
    data[i + 1] = (Math.random() - 0.5) * 10;
    data[i + 2] = (Math.random() - 0.5) * 10;
    data[i + 3] = 1;
  }
}









// Create the scene
const scene = new THREE.Scene();


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
  velocityUniforms.freedomFactor = { value: 0.75 };
  velocityUniforms.predator = { value: new THREE.Vector3() };

  velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed(2);

  const error = gpuCompute.init();
  if (error) console.error(error);
}

const antelopeGeometry = new THREE.BoxGeometry(2, 1, 5); // 比例像个动物身体


const antelopeMaterial = new THREE.MeshStandardMaterial({ color: 0x886633 });
const antelopeMesh = new THREE.InstancedMesh(antelopeGeometry, antelopeMaterial, WIDTH * WIDTH);
antelopeMesh.castShadow = true;
antelopeMesh.receiveShadow = true;
scene.add(antelopeMesh);

const dummy = new THREE.Object3D();




// Create the camera
const camera = new THREE.PerspectiveCamera(
  75, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  10000
);
camera.position.set(0, 0, 0);

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soften the shadows

initComputeRenderer(renderer);


document.body.appendChild(renderer.domElement);



// hdr sky


let sky;


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
    side: THREE.BackSide
  });
  sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

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
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
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
});




//Controls


const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());
controls.getObject().position.set(0, 25, -350);
camera.lookAt(new THREE.Vector3(0, 0, 0));


document.addEventListener('click', () => {
  controls.lock(); // Go to first person view
});

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const move = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false
};

// Listen for key presses
document.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'KeyW': move.forward = true; break;
    case 'KeyS': move.backward = true; break;
    case 'KeyA': move.left = true; break;
    case 'KeyD': move.right = true; break;
    case 'KeyQ': move.up = true; break;
    case 'KeyE': move.down = true; break;
  }
});

// Listen for release keys
document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW': move.forward = false; break;
    case 'KeyS': move.backward = false; break;
    case 'KeyA': move.left = false; break;
    case 'KeyD': move.right = false; break;
    case 'KeyQ': move.up = false; break;
    case 'KeyE': move.down = false; break;
  }
});








// terrain



const worldWidth = 400;
const worldDepth = 400;




// mountain
function generateHeight(width, height) {
  const size = width * height;
  const data = new Uint8Array(size);
  const perlin = new ImprovedNoise();
  const z = 67; // Refreshing the terrain

  const centers = [
    // Mountains in the distance
    { x: 350, y: 300, radius: 80, strength: 0.5},
    { x: 290, y: 300, radius: 80, strength: 0.5},
    { x: 230, y: 260, radius: 80, strength: 0.4},
    { x: 90, y: 300, radius: 80, strength: 0.3},
    { x: 30, y: 300, radius: 70, strength: 0.4},
    { x: 60, y: 220, radius: 50, strength: 0.3},

    // Nearby mountains
    { x: 350, y: 60, radius: 80, strength: 0.2},
    { x: 290, y: 60, radius: 80, strength: 0.2},
    { x: 230, y: 60, radius: 80, strength: 0.2},
    { x: 150, y: 60, radius: 80, strength: 0.2},
    { x: 50, y: 60, radius: 70, strength: 0.2},
    { x: 100, y: 60, radius: 60, strength: 0.2}
  ];
  



  let quality = 1;
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < size; i++) {
      const x = i % width;
      const y = ~~(i / width);

      let totalFalloff = 0;

      for (const center of centers) {
        const dx = x - center.x;
        const dy = y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);


        let falloff;
        if (center.radius > 70) {
          falloff = Math.pow(Math.max(0, 1 - dist / center.radius), 1.2);
        } else {
          falloff = Math.pow(Math.max(0, 1 - dist / center.radius), 2.5);
        }
        totalFalloff += falloff * center.strength;


      }

      const noise = Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 1.75);
      data[i] += noise * totalFalloff;
    }

    quality *= 5;
  }

  return data;
}



// texture



function generateWangTextures(callback, mapWidth = 8, mapHeight = 8, tileSize = 128) {
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









const data = generateHeight(worldWidth, worldDepth);


const geometry = new THREE.PlaneGeometry(1000, 1000, worldWidth - 1, worldDepth - 1);
geometry.rotateX(-Math.PI / 2);


const vertices = geometry.attributes.position.array;
for (let i = 0, j = 0; i < data.length; i++, j += 3) {
  vertices[j + 1] = data[i] * 2.5; 
}
geometry.computeVertexNormals();
geometry.setAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));



generateWangTextures((textures) => {
  const material = new THREE.MeshStandardMaterial({
    map: textures.map,
    aoMap: textures.aoMap,
    roughnessMap: textures.roughnessMap,
    displacementMap: textures.displacementMap,
    normalMap: textures.normalMap, 
  
    roughness: 1,
    metalness: 0,
    displacementScale: 2.5,
    envMapIntensity: 0.3
  });
  

  geometry.attributes.uv.array.forEach((v, i, arr) => {
    arr[i] *= 10;
  });
  geometry.attributes.uv.needsUpdate = true;

  const terrain = new THREE.Mesh(geometry, material);
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  scene.add(terrain);
});


















// Animation
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



    const speed = 1.5;

    direction.z = Number(move.forward) - Number(move.backward);
    direction.x = Number(move.right) - Number(move.left);
    direction.y = Number(move.up) - Number(move.down);
    direction.normalize();
    
    velocity.x = direction.x * speed;
    velocity.z = direction.z * speed;
    velocity.y = direction.y * speed;
    
    controls.moveRight(velocity.x);
    controls.moveForward(velocity.z);
    controls.getObject().position.y += velocity.y;
    if (sky) sky.position.copy(camera.position);

    
    const target = gpuCompute.getCurrentRenderTarget(positionVariable);
    const posTexture = target.texture;
    const readPixels = new Float32Array(WIDTH * WIDTH * 4);
    
    renderer.readRenderTargetPixels(
      target,
      0, 0, WIDTH, WIDTH,
      readPixels
    );
    

    for (let i = 0; i < WIDTH * WIDTH; i++) {
      const x = readPixels[i * 4];
      const y = readPixels[i * 4 + 1];
      const z = readPixels[i * 4 + 2];

      dummy.position.set(x, 5, z);



      dummy.updateMatrix();
      antelopeMesh.setMatrixAt(i, dummy.matrix);
    }
    antelopeMesh.instanceMatrix.needsUpdate = true;




  

    renderer.render(scene, camera);
  }
  
  animate();
  






