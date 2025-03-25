import * as THREE from 'https://esm.sh/three@0.154.0';
import { PointerLockControls } from 'https://esm.sh/three@0.154.0/examples/jsm/controls/PointerLockControls.js';


// Create the scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5d7a3); // warm desert sky

// Create the camera
const camera = new THREE.PerspectiveCamera(
  75, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  1000
);
camera.position.set(0, 5, 10);

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add PointerLockControls to control the camera
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Click anywhere to enable controls
document.addEventListener('click', () => {
    controls.lock();
  });
  

  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const move = { forward: false, backward: false, left: false, right: false };
  
  document.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'KeyW': move.forward = true; break;
      case 'KeyS': move.backward = true; break;
      case 'KeyA': move.left = true; break;
      case 'KeyD': move.right = true; break;
    }
  });
  
  document.addEventListener('keyup', (event) => {
    switch (event.code) {
      case 'KeyW': move.forward = false; break;
      case 'KeyS': move.backward = false; break;
      case 'KeyA': move.left = false; break;
      case 'KeyD': move.right = false; break;
    }
  });
  


// Create a more detailed ground (with many vertices)
const groundGeometry = new THREE.PlaneGeometry(100, 100, 100, 100);

// Modify vertex heights to create hills
const positionAttr = groundGeometry.attributes.position;
for (let i = 0; i < positionAttr.count; i++) {
  const x = positionAttr.getX(i);
  const y = positionAttr.getY(i);
  const z = positionAttr.getZ(i);

  const height = Math.random() * 0.3; // Tune this value for smoother hills
  positionAttr.setZ(i, height);     // Update the Z (height) of each vertex
}
positionAttr.needsUpdate = true;
groundGeometry.computeVertexNormals(); // Important for correct lighting

const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xc2b280 }); // sand yellow
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Rotate to lay flat
scene.add(ground);

// Add a directional light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);



// Animation
function animate() {
    requestAnimationFrame(animate);
  
    const speed = 0.1;
    direction.z = Number(move.forward) - Number(move.backward);
    direction.x = Number(move.right) - Number(move.left);
    direction.normalize();
  
    velocity.x = direction.x * speed;
    velocity.z = direction.z * speed;
  
    controls.moveRight(velocity.x);
    controls.moveForward(velocity.z);
  
    renderer.render(scene, camera);
  }
  
  animate();
  