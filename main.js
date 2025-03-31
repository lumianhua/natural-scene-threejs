import * as THREE from 'https://esm.sh/three@0.154.0';
import { OrbitControls } from 'https://esm.sh/three@0.154.0/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'https://esm.sh/three@0.154.0/examples/jsm/loaders/RGBELoader.js';
import { ImprovedNoise } from 'https://esm.sh/three@0.154.0/examples/jsm/math/ImprovedNoise.js';
import { PMREMGenerator } from 'https://esm.sh/three@0.154.0';
import { PointerLockControls } from 'https://esm.sh/three@0.154.0/examples/jsm/controls/PointerLockControls.js';



// Create the scene
const scene = new THREE.Scene();


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
document.body.appendChild(renderer.domElement);



// hdr sky


let sky;


const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const rgbeLoader = new RGBELoader();
rgbeLoader.load('assets/hdr/industrial_sunset_02_puresky_4k.hdr', (hdrEquirect) => {
  const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture;

  scene.environment = envMap;         // Let HDR take care of the real lighting
 
 
  const skyGeo = new THREE.SphereGeometry(5000, 60, 40);
  const skyMat = new THREE.MeshBasicMaterial({
    map: hdrEquirect,
    side: THREE.BackSide
  });
  sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
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
function generateLargeTexture(callback) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;

  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = 'assets/textures/sandy_gravel_02_diff_4k.jpg'; 

  img.onload = () => {
    const tileSize = 512;
    const repeatX = Math.ceil(canvas.width / tileSize);
    const repeatY = Math.ceil(canvas.height / tileSize);

    for (let y = 0; y < repeatY; y++) {
      for (let x = 0; x < repeatX; x++) {
        ctx.drawImage(img, x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    callback(texture);
  };
}









const data = generateHeight(worldWidth, worldDepth);


const geometry = new THREE.PlaneGeometry(1000, 1000, worldWidth - 1, worldDepth - 1);
geometry.rotateX(-Math.PI / 2);


const vertices = geometry.attributes.position.array;
for (let i = 0, j = 0; i < data.length; i++, j += 3) {
  vertices[j + 1] = data[i] * 2.5; 
}
geometry.computeVertexNormals();


generateLargeTexture((texture) => {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 1.2
  });

  // UV coordinate scaling, repeat mapping, avoid blurring
  geometry.attributes.uv.array.forEach((v, i, arr) => {
    arr[i] *= 10; 
  });
  geometry.attributes.uv.needsUpdate = true;

  const terrain = new THREE.Mesh(geometry, material);
  scene.add(terrain);
});







// Add a directional light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);











// Animation
function animate() {
    requestAnimationFrame(animate);
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


  

    renderer.render(scene, camera);
  }
  
  animate();
  