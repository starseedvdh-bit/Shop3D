import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// 1 đơn vị = 1 mét. Sàn 40 × 25 m = 1.000 m². Trần 4,5 m.
const FLOOR_W = 40;
const FLOOR_D = 25;
const CEILING = 4.5;
const EYE = 1.6;

const ZONES = [
  {
    id: 'apparel',
    vi: 'Khu Quần áo',
    en: 'Apparel',
    x0: -18.7, x1: -7.7, z0: -11.5, z1: -2.3,
    rug: '#c9b79e',
    light: '#fff1dc',
  },
  {
    id: 'jewelry',
    vi: 'Khu Trang sức',
    en: 'Jewelry',
    x0: -4.7, x1: 4.7, z0: -11.5, z1: -2.3,
    rug: '#1d1a17',
    light: '#fff6e4',
  },
  {
    id: 'watches',
    vi: 'Khu Đồng hồ',
    en: 'Watches',
    x0: 7.7, x1: 18.7, z0: -11.5, z1: -2.3,
    rug: '#1e2a36',
    light: '#e7eef8',
  },
  {
    id: 'footwear',
    vi: 'Khu Giày dép',
    en: 'Footwear',
    x0: -18.7, x1: -7.7, z0: 1.1, z1: 10,
    rug: '#c2b6a2',
    light: '#fff3e6',
  },
  {
    id: 'handbags',
    vi: 'Khu Túi xách',
    en: 'Handbags',
    x0: -4.7, x1: 4.7, z0: 1.1, z1: 10,
    rug: '#5a2a2e',
    light: '#fff0ea',
  },
  {
    id: 'accessories',
    vi: 'Khu Phụ kiện',
    en: 'Accessories',
    note: 'Mũ · Kính mát · Thắt lưng · Khăn',
    x0: 7.7, x1: 18.7, z0: 1.1, z1: 10,
    rug: '#2b4038',
    light: '#f4f7f2',
  },
];

const obstacles = [];
const keys = new Set();
const matteCache = new Map();

const player = new THREE.Vector3(0, EYE, 10.75);

let renderer;
let scene;
let camera;
let controls;
let clock;
let maxAnisotropy = 8;
let zoneViEl;
let zoneEnEl;
let locationKey = '';

const materials = {};

let raycaster;
let mouse = new THREE.Vector2();
let hoverProduct = null;
let productCardVisible = false;
let focusGroup = null;
let restoringGroup = null;
let nameSprite = null;
const ZOOM_FACTOR = 1.28;
const products = [];
const staff = [];
const STOCK = 4; // 4x product density per display area
let fpsTime = 0; // FPS counter variable
let fps = 0;

init();

async function init() {
  zoneViEl = document.getElementById('zone-vi');
  zoneEnEl = document.getElementById('zone-en');

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.prepend(renderer.domElement);
  maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#c9cdd2');
  scene.environmentIntensity = 0.45;

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.08, 160);
  camera.position.set(0, 3.0, 17);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new RoomEnvironment();
  scene.environment = pmrem.fromScene(env, 0.04).texture;
  env.dispose();
  pmrem.dispose();

  createMaterials();
  buildLights();
  buildShell();
  buildExterior();
  buildGrid();

  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 64px "Be Vietnam Pro"'),
        document.fonts.load('600 48px "Cormorant Garamond"'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2800)),
    ]);
  } catch (error) {
    console.warn('Font fallback', error);
  }

  buildZones();
  buildWordmarks();
  addHostDesk();
  addLounge();
  addStaffTeam();
  addPlant(-3.4, 11.15);
  addPlant(3.4, 11.15);
  addDecor();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.5, -10.5);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.35;
  controls.maxDistance = 22;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.zoomSpeed = 0.85;
  controls.rotateSpeed = 0.72;
  controls.update();

  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());

  raycaster = new THREE.Raycaster();
  const card = document.getElementById('product-card');
  renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(products, true);
    if (hits.length > 0) {
      let node = hits[0].object;
      while (node && !node.userData.product) node = node.parent;
      if (node && node.userData.product) {
        const p = node.userData.product;
        card.innerHTML =
          '<p class="eyebrow">' + p.category + '</p>' +
          '<p class="product-name">' + p.name + '</p>' +
          '<p class="product-color"><span class="chip" style="background:' + p.color + '"></span>' + p.color + '</p>' +
          '<p class="product-price">' + p.price + '</p>';
        card.classList.add('visible');
        productCardVisible = true;
        focusProduct(node);
        return;
      }
    }
    card.classList.remove('visible');
    productCardVisible = false;
    clearFocus();
  });

  clock = new THREE.Clock();
  renderer.setAnimationLoop(animate);
}

function createMaterials() {
  materials.wall = new THREE.MeshStandardMaterial({
    color: '#efe8dd',
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.2,
  });
  materials.ceiling = new THREE.MeshStandardMaterial({
    color: '#f4efe7',
    roughness: 0.9,
    metalness: 0,
  });
  materials.stone = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: makeStoneTexture(),
    roughness: 0.48,
    metalness: 0.04,
    envMapIntensity: 0.35,
  });
  materials.partition = new THREE.MeshStandardMaterial({
    color: '#f2ece2',
    roughness: 0.88,
    metalness: 0.02,
  });
  materials.brass = new THREE.MeshStandardMaterial({
    color: '#c9a45c',
    roughness: 0.26,
    metalness: 1,
    envMapIntensity: 1.1,
  });
  materials.chrome = new THREE.MeshStandardMaterial({
    color: '#d7dade',
    roughness: 0.16,
    metalness: 1,
    envMapIntensity: 1,
  });
  materials.plaster = new THREE.MeshStandardMaterial({
    color: '#efe9df',
    roughness: 0.72,
    metalness: 0.02,
  });
  materials.dark = new THREE.MeshStandardMaterial({
    color: '#211c19',
    roughness: 0.55,
    metalness: 0.08,
  });
  materials.wood = new THREE.MeshStandardMaterial({
    color: '#3a2a20',
    roughness: 0.62,
    metalness: 0.06,
  });
  materials.velvet = new THREE.MeshStandardMaterial({
    color: '#14110f',
    roughness: 0.95,
    metalness: 0,
  });
  materials.glass = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.04,
    metalness: 0,
    transmission: 0.92,
    thickness: 0.12,
    ior: 1.5,
    transparent: true,
    envMapIntensity: 1,
  });
  materials.caseGlass = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.05,
    metalness: 0,
    transmission: 0.86,
    thickness: 0.05,
    ior: 1.45,
    transparent: true,
  });
  materials.can = new THREE.MeshStandardMaterial({
    color: '#2a2927',
    roughness: 0.4,
    metalness: 0.8,
  });
  materials.leaf = matte('#3e5a48');
  materials.leafFlat = new THREE.MeshStandardMaterial({
    color: '#3e5a48', roughness: 0.82, metalness: 0, flatShading: true,
  });
  materials.leafFlatLight = new THREE.MeshStandardMaterial({
    color: '#4f7a5c', roughness: 0.82, metalness: 0, flatShading: true,
  });
  materials.marble = new THREE.MeshStandardMaterial({
    color: '#f0ede6', roughness: 0.42, metalness: 0.05, envMapIntensity: 0.5,
  });
  materials.pot = new THREE.MeshStandardMaterial({
    color: '#d7d1c8',
    roughness: 0.85,
  });
  materials.sole = matte('#2b2724');
}

function matte(color) {
  const key = String(color);
  if (!matteCache.has(key)) {
    matteCache.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: 0.78,
      metalness: 0.02,
    }));
  }
  return matteCache.get(key);
}

function fabricMat(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.84,
    metalness: 0,
    sheen: 0.65,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color('#ffffff'),
    clearcoat: 0.05,
    clearcoatRoughness: 0.92,
    envMapIntensity: 0.28,
  });
}

function leatherMat(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.46,
    metalness: 0,
    clearcoat: 0.42,
    clearcoatRoughness: 0.5,
    sheen: 0.28,
    sheenRoughness: 0.6,
    envMapIntensity: 0.6,
  });
}

function polishedMetal(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.15,
    metalness: 0.9,
    envMapIntensity: 1.3,
  });
}

function gemstoneMat(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.06,
    metalness: 0.1,
    transmission: 0.7,
    thickness: 0.4,
    ior: 2.1,
    transparent: true,
    opacity: 0.92,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.6,
  });
}

function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(16, maxAnisotropy);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  return texture;
}

function makeStoneTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e5dfd4';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 90; i += 1) {
    ctx.fillStyle = `rgba(110, 102, 92, ${0.015 + Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 70 + Math.random() * 180, 50 + Math.random() * 140);
  }

  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 16) {
    const jitter = (Math.random() - 0.5) * 10;
    data[i] = clampByte(data[i] + jitter);
    data[i + 1] = clampByte(data[i + 1] + jitter);
    data[i + 2] = clampByte(data[i + 2] + jitter);
  }
  ctx.putImageData(image, 0, 0);

  ctx.strokeStyle = 'rgba(92, 84, 74, 0.22)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i += 1) {
    const p = (i / 4) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  return canvasTexture(canvas, 10, 6.25);
}

function makeRugTexture(hex) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const color = new THREE.Color(hex);
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 0.9 + Math.random() * 0.12;
    image.data[i] = Math.floor(color.r * n * 255);
    image.data[i + 1] = Math.floor(color.g * n * 255);
    image.data[i + 2] = Math.floor(color.b * n * 255);
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvasTexture(canvas, 3, 3);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, value));
}

function buildLights() {
  // Warm, soft base with controlled contrast for a high-end mood
  scene.add(new THREE.HemisphereLight('#fff4e2', '#3a342c', 0.58));
  scene.add(new THREE.AmbientLight('#fff1dc', 0.16));

  // Key light (softened to avoid blowout)
  const sun = new THREE.DirectionalLight('#fff2df', 1.75);
  sun.position.set(-8, 16, 14);
  sun.target.position.set(0, 0, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 48;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // Cool fill from the front glass for dimension
  const fill = new THREE.DirectionalLight('#dfe9f2', 0.34);
  fill.position.set(8, 8, -14);
  scene.add(fill);

  const canGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.07, 20);
  const glowGeo = new THREE.CircleGeometry(0.11, 20);

  function addDownlight(x, z, color, intensity) {
    const can = new THREE.Mesh(canGeo, materials.can);
    can.position.set(x, CEILING - 0.03, z);
    scene.add(can);

    const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color }));
    glow.rotation.x = Math.PI / 2;
    glow.position.set(x, CEILING - 0.07, z);
    scene.add(glow);

    const spot = new THREE.SpotLight(color, intensity, 18, Math.PI / 4.4, 0.5, 1.15);
    spot.position.set(x, CEILING - 0.12, z);
    const target = new THREE.Object3D();
    target.position.set(x, 0, z);
    spot.target = target;
    scene.add(spot, target);
  }

  for (const zone of ZONES) {
    const box = zoneBox(zone);
    addDownlight(box.cx - box.w * 0.22, box.cz - box.d * 0.18, zone.light, 55);
    addDownlight(box.cx + box.w * 0.22, box.cz + box.d * 0.18, zone.light, 55);
  }

  // Decorative hanging pendants (đèn thả) along the main aisle + entrance
  for (const px of [-14, -7, 0, 7, 14]) addPendant(px, -0.6, '#ffdca8', 44);
  addPendant(-3.6, 9.2, '#ffdca8', 40);
  addPendant(3.6, 9.2, '#ffdca8', 40);

  // Warm emissive ceiling slots
  const slotMat = new THREE.MeshStandardMaterial({
    color: '#fff4e4',
    emissive: '#ffdca0',
    emissiveIntensity: 0.68,
    roughness: 0.45,
  });
  for (const z of [-8.2, -0.6, 6.4]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(34, 0.025, 0.12), slotMat);
    slot.position.set(0, CEILING - 0.02, z);
    scene.add(slot);
  }
}

function addPendant(x, z, color, intensity) {
  const shadeTop = 3.46;
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, CEILING - shadeTop, 6),
    materials.dark,
  );
  cord.position.set(x, (CEILING + shadeTop) / 2, z);

  const shadeMat = materials.brass.clone();
  shadeMat.side = THREE.DoubleSide;
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.28, 0.22, 24, 1, true),
    shadeMat,
  );
  shade.position.set(x, 3.35, z);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#fff3da', toneMapped: false }),
  );
  bulb.position.set(x, 3.28, z);

  const spot = new THREE.SpotLight(color, intensity, 13, Math.PI / 5, 0.55, 1.15);
  spot.position.set(x, 3.24, z);
  const target = new THREE.Object3D();
  target.position.set(x, 0, z);
  spot.target = target;

  scene.add(cord, shade, bulb, spot, target);
}

function buildShell() {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 0.2, FLOOR_D), materials.stone);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallT = 0.28;
  const back = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W + wallT * 2, CEILING, wallT), materials.wall);
  back.position.set(0, CEILING / 2, -FLOOR_D / 2 - wallT / 2);
  back.receiveShadow = true;
  back.castShadow = true;
  scene.add(back);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wallT, CEILING, FLOOR_D), materials.wall);
    wall.position.set(side * (FLOOR_W / 2 + wallT / 2), CEILING / 2, 0);
    wall.receiveShadow = true;
    wall.castShadow = true;
    scene.add(wall);
  }

  const sill = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 0.14, 0.16), materials.pot);
  sill.position.set(0, 0.07, FLOOR_D / 2);
  sill.receiveShadow = true;
  scene.add(sill);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 3.72, 0.04), materials.glass);
  glass.position.set(0, 2.0, FLOOR_D / 2 + 0.02);
  scene.add(glass);

  const mullionX = [-18, -15, -12, -9, -6, -3, 3, 6, 9, 12, 15, 18, -1.4, 1.4];
  const mullionGeo = new THREE.BoxGeometry(0.06, 3.72, 0.1);
  for (const x of mullionX) {
    const mullion = new THREE.Mesh(mullionGeo, materials.chrome);
    mullion.position.set(x, 2.0, FLOOR_D / 2 + 0.06);
    mullion.castShadow = true;
    scene.add(mullion);
  }

  const doorHead = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.1), materials.chrome);
  doorHead.position.set(0, 3.84, FLOOR_D / 2 + 0.06);
  scene.add(doorHead);

  for (const x of [-0.28, 0.28]) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 8), materials.brass);
    handle.position.set(x, 1.7, FLOOR_D / 2 + 0.1);
    scene.add(handle);
  }

  const guide = new THREE.Mesh(new THREE.BoxGeometry(36, 0.008, 0.045), materials.brass);
  guide.position.set(0, 0.02, -0.6);
  guide.receiveShadow = true;
  scene.add(guide);
}

function buildExterior() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 36),
    new THREE.MeshStandardMaterial({ color: '#c9c2b7', roughness: 0.96 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.03, FLOOR_D / 2 + 16);
  ground.receiveShadow = true;
  scene.add(ground);
}

function buildGrid() {
  const fine = [];
  const bold = [];
  const y = 0.012;
  for (let x = -20; x <= 20; x += 1) {
    const bucket = x % 5 === 0 ? bold : fine;
    bucket.push(x, y, -12.5, x, y, 12.5);
  }
  for (let z = -12; z <= 12; z += 1) {
    const bucket = z % 5 === 0 ? bold : fine;
    bucket.push(-20, y, z, 20, y, z);
  }
  scene.add(lineSegments(fine, '#b1a89c', 0.28));
  scene.add(lineSegments(bold, '#8f867a', 0.42));
}

function lineSegments(positions, color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.LineSegments(geometry, material);
}

function buildZones() {
  for (const zone of ZONES) {
    addRug(zone);
    addZoneWalls(zone);
    addZoneSign(zone);
    addZoneDisplays(zone);
  }
}

function addRug(zone) {
  const inset = 0.5;
  const w = zone.x1 - zone.x0 - inset * 2;
  const d = zone.z1 - zone.z0 - inset * 2;
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.025, d),
    new THREE.MeshStandardMaterial({
      map: makeRugTexture(zone.rug),
      roughness: 0.96,
      metalness: 0,
    }),
  );
  rug.position.set((zone.x0 + zone.x1) / 2, 0.02, (zone.z0 + zone.z1) / 2);
  rug.receiveShadow = true;
  scene.add(rug);

  const border = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.12, 0.008, d + 0.12),
    materials.brass,
  );
  border.position.set(rug.position.x, 0.012, rug.position.z);
  scene.add(border);
}

function addZoneWalls(zone) {
  const aisleZ = zone.z1 < 0 ? zone.z1 : zone.z0;
  addWallWithGap('x', aisleZ, zone.x0 + 0.2, zone.x1 - 0.2);
  if (zone.x1 < 7) addWallWithGap('z', zone.x1, zone.z0 + 0.2, zone.z1 - 0.2);
  if (zone.x0 > -7) addWallWithGap('z', zone.x0, zone.z0 + 0.2, zone.z1 - 0.2);
}

function addWallWithGap(axis, fixed, a0, a1, gap = 2.7) {
  const start = Math.min(a0, a1);
  const end = Math.max(a0, a1);
  if (end - start < gap + 0.5) return;
  const mid = (start + end) / 2;
  const g0 = mid - gap / 2;
  const g1 = mid + gap / 2;
  if (axis === 'x') {
    addLowWall(start, fixed, g0, fixed);
    addLowWall(g1, fixed, end, fixed);
  } else {
    addLowWall(fixed, start, fixed, g0);
    addLowWall(fixed, g1, fixed, end);
  }
}

function addLowWall(x0, z0, x1, z1) {
  const lenX = Math.abs(x1 - x0);
  const lenZ = Math.abs(z1 - z0);
  const alongX = lenX >= lenZ;
  const length = Math.max(lenX, lenZ);
  if (length < 0.3) return;

  const thick = 0.1;
  const height = 1.02;
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(alongX ? length : thick, height, alongX ? thick : length),
    materials.partition,
  );
  wall.position.set((x0 + x1) / 2, height / 2, (z0 + z1) / 2);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(
      alongX ? length : thick + 0.025,
      0.03,
      alongX ? thick + 0.025 : length,
    ),
    materials.brass,
  );
  cap.position.set(wall.position.x, height + 0.012, wall.position.z);
  scene.add(cap);

  obstacles.push({
    minX: wall.position.x - (alongX ? length : thick) / 2,
    maxX: wall.position.x + (alongX ? length : thick) / 2,
    minZ: wall.position.z - (alongX ? thick : length) / 2,
    maxZ: wall.position.z + (alongX ? thick : length) / 2,
  });
}

function addZoneSign(zone) {
  const box = zoneBox(zone);
  const texture = makeSignTexture(zone.vi, zone.en, zone.note);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.35,
    depthWrite: true,
    toneMapped: false,
  }));
  sprite.position.set(box.cx, 3.15, box.cz);
  sprite.scale.set(zone.note ? 5.1 : 4.6, zone.note ? 2.35 : 2.05, 1);
  sprite.center.set(0.5, 0.5);
  scene.add(sprite);

  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15, 8), materials.chrome);
  wire.position.set(box.cx, 3.95, box.cz);
  scene.add(wire);
}

function makeSignTexture(title, subtitle, note) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = note ? 980 : 860;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  roundRect(ctx, 24, 24, w - 48, h - 48, 36);
  ctx.fillStyle = 'rgba(22, 19, 16, 0.9)';
  ctx.fill();
  ctx.strokeStyle = '#c6a15b';
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f7f3ec';
  fitText(ctx, title.toUpperCase(), `700 ${note ? 150 : 168}px "Be Vietnam Pro", sans-serif`, w - 180);
  ctx.fillText(title.toUpperCase(), w / 2, note ? h * 0.36 : h * 0.4);

  ctx.strokeStyle = 'rgba(198, 161, 91, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.32, note ? h * 0.52 : h * 0.56);
  ctx.lineTo(w * 0.68, note ? h * 0.52 : h * 0.56);
  ctx.stroke();

  ctx.fillStyle = '#e4c98a';
  ctx.font = '600 92px "Cormorant Garamond", serif';
  drawTracked(ctx, subtitle.toUpperCase(), w / 2, note ? h * 0.66 : h * 0.7, 18);

  if (note) {
    ctx.fillStyle = '#f7f3ec';
    fitText(ctx, note, '500 64px "Be Vietnam Pro", sans-serif', w - 220);
    ctx.fillText(note, w / 2, h * 0.82);
  }

  return canvasTexture(canvas);
}

function buildWordmarks() {
  const facade = makeWordmarkTexture('SAITEX', 'SHOWROOM');
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 0.7),
    new THREE.MeshBasicMaterial({ map: facade, transparent: true, toneMapped: false }),
  );
  outside.position.set(0, 4.18, FLOOR_D / 2 + 0.14);
  scene.add(outside);

  const insideMap = makeWordmarkTexture('SAITEX', 'SHOWROOM');
  const inside = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 0.62),
    new THREE.MeshBasicMaterial({ map: insideMap, transparent: true, toneMapped: false }),
  );
  inside.position.set(0, 4.18, FLOOR_D / 2 - 0.12);
  inside.rotation.y = Math.PI;
  scene.add(inside);

  const muralMap = makeMuralTexture();
  const mural = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 3.1),
    new THREE.MeshBasicMaterial({ map: muralMap, toneMapped: false }),
  );
  mural.position.set(0, 2.35, -FLOOR_D / 2 + 0.03);
  scene.add(mural);
}

function makeWordmarkTexture(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 280;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a241e';
  ctx.font = '600 150px "Cormorant Garamond", serif';
  drawTracked(ctx, title, canvas.width / 2, 120, 28);
  ctx.fillStyle = '#8a7358';
  ctx.font = '500 42px "Be Vietnam Pro", sans-serif';
  drawTracked(ctx, subtitle, canvas.width / 2, 210, 10);
  return canvasTexture(canvas);
}

function makeMuralTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#efe8de';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#c6a15b';
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a7358';
  ctx.font = '500 42px "Be Vietnam Pro", sans-serif';
  drawTracked(ctx, 'BỘ SƯU TẬP', canvas.width / 2, 180, 14);
  ctx.fillStyle = '#231f1b';
  ctx.font = '600 168px "Cormorant Garamond", serif';
  drawTracked(ctx, 'SAITEX', canvas.width / 2, 360, 26);
  ctx.fillStyle = '#5c564f';
  ctx.font = '500 48px "Be Vietnam Pro", sans-serif';
  ctx.fillText('Thời trang · 1.000 m²', canvas.width / 2, 520);
  return canvasTexture(canvas);
}

function addZoneDisplays(zone) {
  if (zone.id === 'apparel') addApparel(zone);
  if (zone.id === 'jewelry') addJewelry(zone);
  if (zone.id === 'watches') addWatches(zone);
  if (zone.id === 'footwear') addFootwear(zone);
  if (zone.id === 'handbags') addHandbags(zone);
  if (zone.id === 'accessories') addAccessories(zone);
}

function addApparel(zone) {
  const outfits = ['#1e1c1a', '#f4f1ea', '#7a2430', '#24324a'];
  addRack(at(zone, 0.22, 0.5), Math.PI / 2, 3.4, outfits);
  addRack(at(zone, 0.78, 0.5), Math.PI / 2, 3.4, outfits);
  addMannequin(at(zone, 0.38, 0.24), 0.6, '#f7f4ee');
  addMannequin(at(zone, 0.66, 0.78), -0.8, '#6d2430');
}

function addJewelry(zone) {
  const fxs = [0.15, 0.38, 0.62, 0.85];
  const fzs = [0.15, 0.38, 0.62, 0.85];
  for (const fx of fxs) {
    for (const fz of fzs) addVitrine(at(zone, fx, fz));
  }
}

function addWatches(zone) {
  const face = makeWatchFaceTexture();
  const fxs = [0.12, 0.37, 0.63, 0.88];
  const fzs = [0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.92];
  for (const fx of fxs) {
    for (const fz of fzs) addWatchPedestal(at(zone, fx, fz), face);
  }
}

function addFootwear(zone) {
  addShoeShelf(at(zone, 0.24, 0.36), Math.PI / 2);
  addShoeShelf(at(zone, 0.24, 0.7), Math.PI / 2);
  addBench(at(zone, 0.7, 0.5), 0);
}

function addHandbags(zone) {
  const colors = ['#f3efe8', '#1d1b19', '#8d3a34', '#c6a15b', '#243048', '#efe6da'];
  const names = ['Túi xách da bê', 'Clutch dạ tiệc', 'Tote da sáp', 'Túi đeo chéo', 'Túi xách cấu trúc', 'Túi mini'];
  const fxs = [0.15, 0.38, 0.62, 0.85];
  const fzs = [0.12, 0.27, 0.42, 0.57, 0.72, 0.87];
  let index = 0;
  for (const fx of fxs) {
    for (const fz of fzs) {
      const price = (2400000 + index * 180000).toLocaleString('vi-VN') + '₫';
      addBag(at(zone, fx, fz), colors[index % colors.length], names[index % names.length], price);
      index += 1;
    }
  }
}

function addAccessories(zone) {
  addClusterLabel(at(zone, 0.28, 0.9), 'Mũ');
  addClusterLabel(at(zone, 0.74, 0.9), 'Kính mát');
  addClusterLabel(at(zone, 0.28, 0.14), 'Thắt lưng');
  addClusterLabel(at(zone, 0.74, 0.14), 'Khăn');

  // Hats: 12 stands (4 x 3) back-left
  const hatFxs = [0.12, 0.2, 0.28, 0.36];
  const hatFzs = [0.62, 0.7, 0.78];
  const hatColors = ['#1f1d1b', '#f4f1ea', '#8d6a3f'];
  const hatNames = ['Mũ fedora đen', 'Mũ vành trắng', 'Mũ nâu dập'];
  let hi = 0;
  for (const fx of hatFxs) {
    for (const fz of hatFzs) {
      const p = at(zone, fx, fz);
      const price = (1100000 + hi * 40000).toLocaleString('vi-VN') + '₫';
      addHat(p.x, p.z, hatColors[hi % 3], hatNames[hi % 3], price);
      hi += 1;
    }
  }

  // Glasses: two tables with 6 each (12 total) back-right
  addGlassesTable(at(zone, 0.7, 0.64), 6);
  addGlassesTable(at(zone, 0.7, 0.8), 6);

  // Belts: two rails with 8 each (16 total) front-left
  addBeltRail(at(zone, 0.26, 0.2), 8);
  addBeltRail(at(zone, 0.26, 0.36), 8);

  // Scarves: two rails with 10 each (20 total) front-right
  addScarves(at(zone, 0.74, 0.2), 10);
  addScarves(at(zone, 0.74, 0.36), 10);
}

function makeGarment(color, name, price) {
  const group = new THREE.Group();
  const mat = fabricMat(color);
  const darkMat = fabricMat(new THREE.Color(color).multiplyScalar(0.82).getStyle());

  // Torso silhouette with shoulders and sleeve stubs (extruded, beveled soft edges)
  const s = new THREE.Shape();
  const pts = [
    [-0.2, 0.0], [0.2, 0.0], [0.2, 0.33],
    [0.32, 0.3], [0.35, 0.45], [0.16, 0.51],
    [0.07, 0.53], [-0.07, 0.53], [-0.16, 0.51],
    [-0.35, 0.45], [-0.32, 0.3], [-0.2, 0.33],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: 0.075,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 2,
    steps: 1,
  });
  bodyGeo.translate(0, -0.53, -0.0375);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.castShadow = true;
  group.add(body);

  // Collar ring at the neckline
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 8, 18, Math.PI * 1.35), darkMat);
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = Math.PI * 0.32;
  collar.position.y = 0.0;
  group.add(collar);

  // Sleeve cuffs
  const cuffGeo = new THREE.BoxGeometry(0.085, 0.09, 0.085);
  const cuffL = new THREE.Mesh(cuffGeo, darkMat);
  cuffL.position.set(-0.315, -0.05, 0);
  cuffL.rotation.z = 0.16;
  const cuffR = cuffL.clone();
  cuffR.position.x = 0.315;
  cuffR.rotation.z = -0.16;
  group.add(cuffL, cuffR);

  // Hanger bar + hook (chrome)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.018), materials.chrome);
  bar.position.y = 0.0;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 8), materials.chrome);
  stem.position.y = 0.05;
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 16, Math.PI * 1.4), materials.chrome);
  hook.rotation.z = -Math.PI * 0.2;
  hook.position.set(0.0, 0.1, 0);
  group.add(bar, stem, hook);

  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  group.userData.product = { name, category: 'Quần áo', color, price };
  return group;
}

function addRack(pos, rotY, length, colors) {
  const group = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.45, 10);
  const left = new THREE.Mesh(poleGeo, materials.chrome);
  left.position.set(-length / 2, 0.78, 0);
  const right = left.clone();
  right.position.x = length / 2;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, length, 8), materials.chrome);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.48;
  group.add(left, right, bar);

  const names = ['Áo sơ mi lụa', 'Áo thun cotton', 'Áo khoác dạ', 'Áo len tăm'];
  const perRow = 6;
  const rows = STOCK; // 4 packed depth rows => 24 garments per rack (4x)
  let n = 0;
  for (let r = 0; r < rows; r += 1) {
    const z = (r - (rows - 1) / 2) * 0.07;
    for (let i = 0; i < perRow; i += 1) {
      const color = colors[n % colors.length];
      const garment = makeGarment(color, names[n % names.length], (320000 + n * 22000).toLocaleString('vi-VN') + '₫');
      const x = -length / 2 + 0.32 + i * ((length - 0.64) / (perRow - 1));
      garment.position.set(x, 1.46, z);
      group.add(garment);
      n += 1;
    }
  }

  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = rotY;
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(group);
  products.push(group);

  const alongZ = Math.abs(Math.sin(rotY)) > 0.5;
  addObstacle(pos.x, pos.z, alongZ ? 0.4 : length / 2, alongZ ? length / 2 : 0.4);
}

function addMannequin(pos, rotY, outfit) {
  const group = new THREE.Group();
  const cloth = fabricMat(outfit);
  const skin = materials.plaster;

  // Dress-form torso via LatheGeometry (revolved profile)
  const profile = [
    [0.0, 0.0], [0.13, 0.02], [0.17, 0.18], [0.15, 0.4],
    [0.12, 0.56], [0.16, 0.7], [0.14, 0.82], [0.07, 0.9], [0.0, 0.92],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), cloth);
  torso.position.y = 0.62;
  torso.castShadow = true;

  // Skirt / lower dress via LatheGeometry
  const skirtProfile = [
    [0.0, 0.0], [0.2, 0.02], [0.24, 0.3], [0.2, 0.62], [0.14, 0.86], [0.0, 0.9],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtProfile, 24), cloth);
  skirt.position.y = 0.0;
  skirt.castShadow = true;

  // Neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), skin);
  neck.position.y = 1.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), skin);
  head.position.y = 1.74;
  head.castShadow = true;

  // Shoulders/arms as tapered sleeves
  const armGeo = new THREE.CylinderGeometry(0.05, 0.038, 0.55, 10);
  const armL = new THREE.Mesh(armGeo, cloth);
  armL.position.set(-0.24, 1.22, 0);
  armL.rotation.z = 0.3;
  const armR = armL.clone();
  armR.position.x = 0.24;
  armR.rotation.z = -0.3;

  // Collar detail
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 18), cloth);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.5;

  group.add(skirt, torso, neck, head, armL, armR, collar);
  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = rotY;
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(group);
  group.userData.product = {
    name: 'Mẫu thời trang dạ hội',
    category: 'Quần áo',
    color: outfit,
    price: '1.850.000₫',
  };
  products.push(group);
  addObstacle(pos.x, pos.z, 0.32, 0.32);
}

function makeRing(metalColor, gemColor, name, price) {
  const group = new THREE.Group();
  const metal = polishedMetal(metalColor);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 10, 24), metal);
  band.rotation.x = Math.PI / 2;
  // Setting prongs
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), metal);
    prong.position.set(Math.cos(a) * 0.028, 0.015, Math.sin(a) * 0.028);
    group.add(prong);
  }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), gemstoneMat(gemColor));
  gem.position.y = 0.03;
  group.add(band, gem);
  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  group.userData.product = { name, category: 'Trang sức', color: gemColor, price };
  return group;
}

function makeEarring(metalColor, gemColor, name, price) {
  const group = new THREE.Group();
  const metal = polishedMetal(metalColor);
  const stud = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), metal);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 0), gemstoneMat(gemColor));
  gem.position.y = 0.035;
  group.add(stud, gem);
  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  group.userData.product = { name, category: 'Trang sức', color: gemColor, price };
  return group;
}

function makeNecklace(metalColor, gemColor, name, price) {
  const group = new THREE.Group();
  const metal = polishedMetal(metalColor);
  // Chain curve (U shape draped)
  const chainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.16, 0.12, 0),
    new THREE.Vector3(-0.1, 0.02, 0),
    new THREE.Vector3(0, -0.04, 0),
    new THREE.Vector3(0.1, 0.02, 0),
    new THREE.Vector3(0.16, 0.12, 0),
  ]);
  const chain = new THREE.Mesh(new THREE.TubeGeometry(chainCurve, 32, 0.004, 6, false), metal);
  const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), gemstoneMat(gemColor));
  pendant.position.set(0, -0.05, 0);
  group.add(chain, pendant);
  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  group.userData.product = { name, category: 'Trang sức', color: gemColor, price };
  return group;
}

function addVitrine(pos) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.92, 0.7), materials.dark);
  base.position.y = 0.46;
  base.castShadow = true;
  base.receiveShadow = true;
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.5), materials.velvet);
  cushion.position.y = 0.94;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.28, 0.56), materials.caseGlass);
  glass.position.y = 1.1;
  group.add(base, cushion, glass);

  const gold = '#d4af37';
  const ring1 = makeRing(gold, '#b3122e', 'Nhẫn ruby', '5.200.000₫');
  ring1.position.set(-0.3, 1.0, 0.02);
  const ring2 = makeRing('#e6e6e6', '#2e8b57', 'Nhẫn ngọc lục bảo', '4.650.000₫');
  ring2.position.set(0.0, 1.0, 0.02);
  const necklace = makeNecklace(gold, '#1e3a8a', 'Dây chuyền sapphire', '8.900.000₫');
  necklace.position.set(0.32, 1.0, 0);
  const earringL = makeEarring('#e6e6e6', '#7f1d2d', 'Bông tai kim cương', '3.400.000₫');
  earringL.position.set(-0.3, 1.0, -0.14);
  const earringR = makeEarring('#e6e6e6', '#7f1d2d', 'Bông tai kim cương', '3.400.000₫');
  earringR.position.set(-0.22, 1.0, -0.14);

  group.add(ring1, ring2, necklace, earringL, earringR);
  group.position.set(pos.x, 0, pos.z);
  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  scene.add(group);
  products.push(group);
  addObstacle(pos.x, pos.z, 0.72, 0.4);
}

function makeWatch(faceTexture, strapColor, name, price) {
  const group = new THREE.Group();
  const metal = polishedMetal('#d8dade');

  // Case body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 32), metal);
  body.position.y = 0;
  // Bezel ring
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 10, 32), metal);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.y = 0.016;
  // Dial (face texture) facing up
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.066, 32),
    new THREE.MeshBasicMaterial({ map: faceTexture, toneMapped: false }),
  );
  dial.rotation.x = -Math.PI / 2;
  dial.position.y = 0.017;
  // Crystal glass over dial
  const crystal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.006, 32),
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff', roughness: 0.02, metalness: 0,
      transmission: 0.96, thickness: 0.01, ior: 1.5, transparent: true,
      clearcoat: 1, clearcoatRoughness: 0.02,
    }),
  );
  crystal.position.y = 0.022;
  // Crown (side button)
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), metal);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(0.083, 0, 0);
  // Lugs + bracelet strap
  const strapMat = strapColor === 'metal'
    ? polishedMetal('#c8cace')
    : leatherMat(strapColor);
  const lugGeo = new THREE.BoxGeometry(0.03, 0.02, 0.02);
  const lugA = new THREE.Mesh(lugGeo, metal);
  lugA.position.set(0, 0, 0.082);
  const lugB = lugA.clone();
  lugB.position.z = -0.082;
  // Strap segments (bracelet links / leather band)
  const segGeo = new THREE.BoxGeometry(0.06, 0.012, 0.05);
  const segments = [];
  for (let i = 0; i < 3; i += 1) {
    for (const dir of [-1, 1]) {
      const seg = new THREE.Mesh(segGeo, strapMat);
      seg.position.set(0, -0.004 * i, dir * (0.12 + i * 0.055));
      seg.rotation.x = dir * 0.12;
      segments.push(seg);
    }
  }

  group.add(body, bezel, dial, crystal, crown, lugA, lugB, ...segments);
  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  group.userData.product = { name, category: 'Đồng hồ', color: strapColor, price };
  return group;
}

function addWatchPedestal(pos, faceTexture) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.92, 20), materials.plaster);
  base.position.y = 0.46;
  base.castShadow = true;
  base.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 20), materials.brass);
  cap.position.y = 0.94;
  const pillow = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16), materials.velvet);
  pillow.position.y = 0.98;
  group.add(base, cap, pillow);

  const strapColors = ['metal', '#1d1b19', '#5a3a22', '#7a2430'];
  const names = ['Đồng hồ thép không gỉ', 'Đồng hồ dây da đen', 'Đồng hồ dây da nâu', 'Đồng hồ dây da đỏ'];
  const prices = ['12.500.000₫', '8.900.000₫', '9.200.000₫', '10.100.000₫'];
  for (let i = 0; i < 4; i += 1) {
    const watch = makeWatch(faceTexture, strapColors[i], names[i], prices[i]);
    const angle = (i / 4) * Math.PI * 2;
    watch.position.set(Math.cos(angle) * 0.16, 1.0, Math.sin(angle) * 0.16);
    watch.rotation.y = -angle;
    group.add(watch);
  }
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  group.userData.product = null;
  products.push(group);
  addObstacle(pos.x, pos.z, 0.34, 0.34);
}

function makeWatchFaceTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6f2ea';
  ctx.beginPath();
  ctx.arc(128, 128, 122, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1c1916';
  ctx.lineWidth = 5;
  ctx.stroke();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(angle) * 92, 128 + Math.sin(angle) * 92);
    ctx.lineTo(128 + Math.cos(angle) * 110, 128 + Math.sin(angle) * 110);
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(-Math.PI / 2) * 62, 128 + Math.sin(-Math.PI / 2) * 62);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(0.2) * 48, 128 + Math.sin(0.2) * 48);
  ctx.stroke();
  return canvasTexture(canvas);
}

function makeShoe(color, name, price) {
  const group = new THREE.Group();
  const upper = leatherMat(color);
  const dark = leatherMat(new THREE.Color(color).multiplyScalar(0.72).getStyle());

  // Sole: footprint extruded, laid flat
  const fs = new THREE.Shape();
  fs.moveTo(-0.16, -0.05);
  fs.quadraticCurveTo(-0.17, -0.065, -0.13, -0.065);
  fs.lineTo(0.11, -0.06);
  fs.quadraticCurveTo(0.17, -0.055, 0.17, 0);
  fs.quadraticCurveTo(0.17, 0.055, 0.11, 0.06);
  fs.lineTo(-0.13, 0.065);
  fs.quadraticCurveTo(-0.17, 0.065, -0.16, 0.05);
  fs.closePath();
  const soleGeo = new THREE.ExtrudeGeometry(fs, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.007,
    bevelSegments: 2,
    curveSegments: 10,
  });
  soleGeo.rotateX(-Math.PI / 2);
  const sole = new THREE.Mesh(soleGeo, materials.sole);
  group.add(sole);

  // Toe cap
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), upper);
  toe.scale.set(1.4, 0.7, 1.0);
  toe.position.set(0.1, 0.075, 0);
  // Vamp (mid body)
  const vamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.1), upper);
  vamp.position.set(-0.02, 0.08, 0);
  // Heel counter
  const heel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.11), dark);
  heel.position.set(-0.13, 0.095, 0);
  // Ankle collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 16), dark);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(-0.13, 0.16, 0);

  group.add(toe, vamp, heel, collar);

  // Laces across the vamp
  for (let i = 0; i < 3; i += 1) {
    const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.09, 6), materials.chrome);
    lace.rotation.x = Math.PI / 2;
    lace.position.set(-0.02 + i * 0.04, 0.135 - i * 0.006, 0);
    group.add(lace);
  }

  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  group.userData.product = { name, category: 'Giày dép', color, price };
  return group;
}

function addShoeShelf(pos, rotY) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.45, 0.38), materials.plaster);
  frame.position.y = 0.78;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);
  const colors = ['#f4f1ea', '#1f1d1b', '#8a3b32', '#c2a37a', '#243048', '#d8d2c8'];
  const names = ['Giày da Oxford', 'Giày sneaker', 'Giày cao gót', 'Giày lười', 'Giày bốt', 'Giày sandal'];
  const rows = 6;
  const cols = 8;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const idx = (row + col) % colors.length;
      const price = (1500000 + (row * cols + col) * 90000).toLocaleString('vi-VN') + '₫';
      const shoe = makeShoe(colors[idx], names[idx], price);
      shoe.position.set(-1.35 + col * 0.386, 0.22 + row * 0.225, 0.16);
      group.add(shoe);
    }
  }
  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = rotY;
  scene.add(group);
  products.push(group);
  const alongZ = Math.abs(Math.sin(rotY)) > 0.5;
  addObstacle(pos.x, pos.z, alongZ ? 0.28 : 1.55, alongZ ? 1.55 : 0.28);
}

function addBench(pos, rotY) {
  const group = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.46), materials.wood);
  seat.position.y = 0.46;
  seat.castShadow = true;
  const legGeo = new THREE.BoxGeometry(0.08, 0.46, 0.08);
  for (const x of [-0.64, 0.64]) {
    for (const z of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(legGeo, materials.dark);
      leg.position.set(x, 0.23, z);
      group.add(leg);
    }
  }
  group.add(seat);
  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = rotY;
  scene.add(group);
  addObstacle(pos.x, pos.z, 0.78, 0.3);
}

function makeBag(color, name, price) {
  const group = new THREE.Group();
  const leather = leatherMat(color);

  // Rounded-rectangle body via ExtrudeGeometry
  const w = 0.5;
  const h = 0.36;
  const r = 0.06;
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-w / 2 + r, -h / 2);
  bodyShape.lineTo(w / 2 - r, -h / 2);
  bodyShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  bodyShape.lineTo(w / 2, h / 2 - r);
  bodyShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  bodyShape.lineTo(-w / 2 + r, h / 2);
  bodyShape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  bodyShape.lineTo(-w / 2, -h / 2 + r);
  bodyShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 12,
  });
  bodyGeo.translate(0, 0.86, -0.07);
  const body = new THREE.Mesh(bodyGeo, leather);
  body.castShadow = true;

  // Front flap (slightly darker leather)
  const flapShape = new THREE.Shape();
  const fw = 0.4;
  const fh = 0.16;
  const fr = 0.03;
  flapShape.moveTo(-fw / 2 + fr, -fh / 2);
  flapShape.lineTo(fw / 2 - fr, -fh / 2);
  flapShape.quadraticCurveTo(fw / 2, -fh / 2, fw / 2, -fh / 2 + fr);
  flapShape.lineTo(fw / 2, fh / 2 - fr);
  flapShape.quadraticCurveTo(fw / 2, fh / 2, fw / 2 - fr, fh / 2);
  flapShape.lineTo(-fw / 2 + fr, fh / 2);
  flapShape.quadraticCurveTo(-fw / 2, fh / 2, -fw / 2, fh / 2 - fr);
  flapShape.lineTo(-fw / 2, -fh / 2 + fr);
  flapShape.quadraticCurveTo(-fw / 2, -fh / 2, -fw / 2 + fr, -fh / 2);

  const flapGeo = new THREE.ExtrudeGeometry(flapShape, {
    depth: 0.015,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 8,
  });
  flapGeo.translate(0, 0.93, 0.075);
  const flapMat = leatherMat(new THREE.Color(color).multiplyScalar(0.8).getStyle());
  const flap = new THREE.Mesh(flapGeo, flapMat);
  flap.castShadow = true;

  // Strap via TubeGeometry along an arch curve
  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 0.98, 0),
    new THREE.Vector3(-0.12, 1.28, 0),
    new THREE.Vector3(0, 1.36, 0),
    new THREE.Vector3(0.12, 1.28, 0),
    new THREE.Vector3(0.18, 0.98, 0),
  ]);
  const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 24, 0.014, 8, false), leather);
  strap.castShadow = true;

  // Metal buckle + clasp (brass)
  const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 16), materials.brass);
  buckle.position.set(0, 0.93, 0.1);
  const clasp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), materials.brass);
  clasp.rotation.x = Math.PI / 2;
  clasp.position.set(0, 0.86, 0.1);
  // Metal feet
  const footGeo = new THREE.CylinderGeometry(0.016, 0.02, 0.02, 10);
  const footL = new THREE.Mesh(footGeo, materials.brass);
  footL.position.set(-0.16, 0.7, 0.0);
  const footR = footL.clone();
  footR.position.x = 0.16;

  group.add(body, flap, strap, buckle, clasp, footL, footR);
  group.position.set(0, 0, 0);
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  group.userData.product = { name, category: 'Túi xách', color, price };
  return group;
}

function addBag(pos, color, name, price) {
  const group = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.68, 16), materials.plaster);
  pedestal.position.y = 0.34;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16), materials.brass);
  cap.position.y = 0.7;

  const bag = makeBag(color, name, price);
  bag.position.y = 0.0;
  group.add(pedestal, cap, bag);
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  group.userData.product = { name, category: 'Túi xách', color, price };
  products.push(group);
  addObstacle(pos.x, pos.z, 0.3, 0.3);
}

function makeHat(color, name, price) {
  const group = new THREE.Group();
  const felt = fabricMat(color);
  const bandMat = leatherMat(new THREE.Color(color).multiplyScalar(0.5).getStyle());

  // Wide brim
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.018, 28), felt);
  // Crown via LatheGeometry (slight center dent)
  const prof = [
    [0.0, 0.0], [0.15, 0.0], [0.155, 0.05], [0.15, 0.15],
    [0.13, 0.19], [0.05, 0.195], [0.0, 0.18],
  ].map(([px, py]) => new THREE.Vector2(px, py));
  const crown = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), felt);
  // Hat band around base of crown
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.158, 0.045, 24), bandMat);
  band.position.y = 0.03;

  group.add(brim, crown, band);
  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  group.userData.product = { name, category: 'Phụ kiện', color, price };
  return group;
}

function addHat(x, z, color, name, price) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 16), materials.chrome);
  base.position.y = 0.015;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 8), materials.chrome);
  pole.position.y = 0.62;
  const hat = makeHat(color, name, price);
  hat.position.y = 1.25;
  group.add(base, pole, hat);
  group.position.set(x, 0, z);
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(group);
  group.userData.product = hat.userData.product;
  products.push(group);
  addObstacle(x, z, 0.3, 0.3);
}

function makeGlasses(name, price) {
  const group = new THREE.Group();
  const frame = materials.chrome;
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: '#20242a',
    roughness: 0.05,
    metalness: 0,
    transmission: 0.6,
    thickness: 0.02,
    transparent: true,
    opacity: 0.85,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.2,
  });

  // Lenses
  const lensGeo = new THREE.CircleGeometry(0.06, 24);
  const lensL = new THREE.Mesh(lensGeo, lensMat);
  lensL.position.x = -0.085;
  const lensR = lensL.clone();
  lensR.position.x = 0.085;

  // Rims
  const rimGeo = new THREE.TorusGeometry(0.062, 0.008, 8, 20);
  const rimL = new THREE.Mesh(rimGeo, frame);
  rimL.position.x = -0.085;
  const rimR = rimL.clone();
  rimR.position.x = 0.085;

  // Bridge (half torus arch between lenses)
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 12, Math.PI), frame);
  bridge.position.y = 0.0;

  // Temples (arms) along Z
  const templeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.13, 6);
  const templeL = new THREE.Mesh(templeGeo, frame);
  templeL.rotation.x = Math.PI / 2;
  templeL.position.set(-0.085, 0.0, -0.06);
  const templeR = templeL.clone();
  templeR.position.x = 0.085;

  group.add(lensL, lensR, rimL, rimR, bridge, templeL, templeR);
  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  group.userData.product = { name, category: 'Phụ kiện', color: '#20242a', price };
  return group;
}

function addGlassesTable(pos, count) {
  count = count || 3;
  const cols = Math.ceil(count / 2);
  const width = Math.max(1.7, cols * 0.5 + 0.3);
  const table = new THREE.Mesh(new THREE.BoxGeometry(width, 0.86, 0.62), materials.plaster);
  table.position.set(pos.x, 0.43, pos.z);
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);
  const names = ['Kính mát phi công', 'Kính mắt mèo', 'Kính tròn', 'Kính vuông', 'Kính bướm'];
  for (let i = 0; i < count; i += 1) {
    const price = (900000 + i * 150000).toLocaleString('vi-VN') + '₫';
    const glasses = makeGlasses(names[i % names.length], price);
    const col = i % cols;
    const row = Math.floor(i / cols);
    glasses.position.set(pos.x - ((cols - 1) * 0.5) / 2 + col * 0.5, 0.95, pos.z - 0.12 + row * 0.24);
    scene.add(glasses);
    products.push(glasses);
  }
  addObstacle(pos.x, pos.z, width / 2 + 0.05, 0.36);
}

function makeBelt(color, name, price) {
  const group = new THREE.Group();
  const strapMat = leatherMat(color);
  const buckleMat = materials.brass;

  const sw = 0.5;
  const sh = 0.05;
  const r = 0.02;
  const strapShape = new THREE.Shape();
  strapShape.moveTo(-sw / 2 + r, -sh / 2);
  strapShape.lineTo(sw / 2 - r, -sh / 2);
  strapShape.quadraticCurveTo(sw / 2, -sh / 2, sw / 2, -sh / 2 + r);
  strapShape.lineTo(sw / 2, sh / 2 - r);
  strapShape.quadraticCurveTo(sw / 2, sh / 2, sw / 2 - r, sh / 2);
  strapShape.lineTo(-sw / 2 + r, sh / 2);
  strapShape.quadraticCurveTo(-sw / 2, sh / 2, -sw / 2, sh / 2 - r);
  strapShape.lineTo(-sw / 2, -sh / 2 + r);
  strapShape.quadraticCurveTo(-sw / 2, -sh / 2, -sw / 2 + r, -sh / 2);

  const strapGeo = new THREE.ExtrudeGeometry(strapShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
    curveSegments: 6,
  });
  const strap = new THREE.Mesh(strapGeo, strapMat);
  strap.rotation.z = -0.12;

  // Buckle frame (rectangular ring) + prong
  const buckle = new THREE.Group();
  const bw = 0.08;
  const bh = 0.07;
  const t = 0.012;
  const top = new THREE.Mesh(new THREE.BoxGeometry(bw, t, 0.012), buckleMat);
  top.position.y = bh / 2;
  const bot = top.clone();
  bot.position.y = -bh / 2;
  const lft = new THREE.Mesh(new THREE.BoxGeometry(t, bh, 0.012), buckleMat);
  lft.position.x = -bw / 2;
  const rgt = lft.clone();
  rgt.position.x = bw / 2;
  const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, bh, 6), buckleMat);
  prong.position.x = -bw / 2 + 0.006;
  buckle.add(top, bot, lft, rgt, prong);
  buckle.position.set(sw / 2 - 0.01, 0, 0.0);

  group.add(strap, buckle);
  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  group.userData.product = { name, category: 'Phụ kiện', color, price };
  return group;
}

function addBeltRail(pos, count) {
  count = count || 4;
  const group = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8);
  const left = new THREE.Mesh(poleGeo, materials.chrome);
  left.position.set(-0.8, 0.58, 0);
  const right = left.clone();
  right.position.x = 0.8;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.6, 8), materials.chrome);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.12;
  group.add(left, right, bar);

  const colors = ['#1f1d1b', '#6d2430', '#c6a15b', '#f4f1ea'];
  const names = ['Thắt lưng da', 'Thắt lưng trơn', 'Thắt lưng bản to', 'Thắt lưng lụa'];
  for (let i = 0; i < count; i += 1) {
    const price = (650000 + i * 90000).toLocaleString('vi-VN') + '₫';
    const belt = makeBelt(colors[i % colors.length], names[i % names.length], price);
    belt.rotation.z = Math.PI / 2;
    const span = 1.3;
    belt.position.set(-span / 2 + (count === 1 ? span / 2 : i * (span / (count - 1))), 0.82, 0);
    group.add(belt);
  }
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  products.push(group);
  addObstacle(pos.x, pos.z, 0.9, 0.25);
}

function addScarves(pos, count) {
  count = count || 5;
  const group = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.5, 8);
  const left = new THREE.Mesh(poleGeo, materials.chrome);
  left.position.set(-0.85, 0.75, 0);
  const right = left.clone();
  right.position.x = 0.85;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.7, 8), materials.chrome);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.48;
  group.add(left, right, bar);
  const colors = ['#8d1d2c', '#1f3d73', '#efe8de', '#b08d57', '#2f4f46', '#7a2430', '#243048'];
  const scarfW = Math.min(0.28, (1.5 / count) * 0.85);
  for (let i = 0; i < count; i += 1) {
    const scarf = new THREE.Mesh(new THREE.PlaneGeometry(scarfW, 0.95), matte(colors[i % colors.length]));
    scarf.position.set(-0.75 + (count === 1 ? 0.75 : i * (1.5 / (count - 1))), 0.95, 0);
    scarf.castShadow = true;
    group.add(scarf);
  }
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  addObstacle(pos.x, pos.z, 0.95, 0.2);
}

function addClusterLabel(pos, text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  roundRect(ctx, 16, 40, canvas.width - 32, canvas.height - 80, 28);
  ctx.fillStyle = 'rgba(22, 19, 16, 0.88)';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f7f3ec';
  ctx.font = '700 120px "Be Vietnam Pro", sans-serif';
  ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTexture(canvas),
    transparent: true,
    alphaTest: 0.35,
    depthWrite: true,
    toneMapped: false,
  }));
  sprite.position.set(pos.x, 2.2, pos.z);
  sprite.scale.set(1.7, 0.53, 1);
  scene.add(sprite);
}

function makeReceptionDesk() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.7), materials.wood);
  body.position.y = 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.06, 0.82), materials.marble);
  top.position.y = 1.03;
  top.castShadow = true;
  const kick = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.08, 0.74), materials.brass);
  kick.position.y = 0.04;
  // Slim brass inlay strip on the front
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.04, 0.02), materials.brass);
  inlay.position.set(0, 0.78, 0.36);
  // Small brass table lamp glow on the counter
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.03, 12), materials.brass);
  lampBase.position.set(0.8, 1.08, 0);
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8), materials.brass);
  lampStem.position.set(0.8, 1.2, 0);
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.1, 16, 1, true), new THREE.MeshStandardMaterial({
    color: '#f4e6c8', emissive: '#ffdca0', emissiveIntensity: 0.6, roughness: 0.6, side: THREE.DoubleSide,
  }));
  lampShade.position.set(0.8, 1.34, 0);
  g.add(body, top, kick, inlay, lampBase, lampStem, lampShade);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function makeReceptionist() {
  const g = new THREE.Group();
  const suit = fabricMat('#23262d');
  const shirt = fabricMat('#f2efe9');
  const skin = new THREE.MeshStandardMaterial({ color: '#e8c4a0', roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: '#2a211c', roughness: 0.82 });

  // Legs + shoes
  const legGeo = new THREE.CylinderGeometry(0.07, 0.058, 0.85, 10);
  const legL = new THREE.Mesh(legGeo, suit);
  legL.position.set(-0.09, 0.425, 0);
  const legR = legL.clone();
  legR.position.x = 0.09;
  const shoeGeo = new THREE.BoxGeometry(0.12, 0.06, 0.22);
  const shoeL = new THREE.Mesh(shoeGeo, materials.dark);
  shoeL.position.set(-0.09, 0.03, 0.05);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.09;

  // Torso (suit jacket, tapered)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.6, 14), suit);
  torso.position.y = 1.14;
  // White shirt front panel between the suit lapels
  const shirtV = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.3, 0.02), shirt);
  shirtV.position.set(0, 1.2, 0.13);
  // Tie
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.02), materials.dark);
  tie.position.set(0, 1.16, 0.15);
  // Head + hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), skin);
  head.position.y = 1.58;
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
  hairMesh.position.y = 1.6;

  // Arms (slightly bent, hands clasped in front)
  const armGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.5, 8);
  const armL = new THREE.Mesh(armGeo, suit);
  armL.position.set(-0.22, 1.1, 0.06);
  armL.rotation.z = 0.28;
  armL.rotation.x = -0.5;
  const armR = armL.clone();
  armR.position.x = 0.22;
  armR.rotation.z = -0.28;
  const handGeo = new THREE.SphereGeometry(0.045, 12, 10);
  const handL = new THREE.Mesh(handGeo, skin);
  handL.position.set(-0.05, 0.98, 0.24);
  const handR = handL.clone();
  handR.position.x = 0.05;

  g.add(legL, legR, shoeL, shoeR, torso, shirtV, tie, head, hairMesh, armL, armR, handL, handR);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function addHostDesk() {
  const desk = makeReceptionDesk();
  desk.position.set(-15.6, 0, 11.15);
  scene.add(desk);
  addObstacle(-15.6, 11.15, 1.28, 0.41);

  // Receptionist standing behind the counter, facing the entrance
  const receptionist = makeReceptionist();
  receptionist.position.set(-15.6, 0, 10.42);
  receptionist.rotation.y = 0; // built facing +Z (toward the glass entrance)
  scene.add(receptionist);
  addObstacle(-15.6, 10.42, 0.26, 0.26);
}

function makeSofa(width, color) {
  const g = new THREE.Group();
  const mat = leatherMat(color);
  const dark = leatherMat(new THREE.Color(color).multiplyScalar(0.7).getStyle());
  const depth = 0.85;
  // Base seat block
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.32, depth), mat);
  base.position.y = 0.26;
  // Backrest (at +Z side, sofa faces -Z)
  const back = new THREE.Mesh(new THREE.BoxGeometry(width, 0.55, 0.22), mat);
  back.position.set(0, 0.62, depth / 2 - 0.11);
  // Armrests
  const armGeo = new THREE.BoxGeometry(0.2, 0.42, depth);
  const armL = new THREE.Mesh(armGeo, dark);
  armL.position.set(-width / 2 + 0.1, 0.5, 0);
  const armR = armL.clone();
  armR.position.x = width / 2 - 0.1;
  // Seat cushions
  const cushionGeo = new THREE.BoxGeometry((width - 0.5) / 3, 0.14, depth - 0.3);
  for (let i = 0; i < 3; i += 1) {
    const cushion = new THREE.Mesh(cushionGeo, mat);
    cushion.position.set(-((width - 0.5) / 3) + i * ((width - 0.5) / 3), 0.47, -0.02);
    g.add(cushion);
  }
  // Brass legs
  const legGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8);
  for (const lx of [-width / 2 + 0.15, width / 2 - 0.15]) {
    for (const lz of [-depth / 2 + 0.12, depth / 2 - 0.12]) {
      const leg = new THREE.Mesh(legGeo, materials.brass);
      leg.position.set(lx, 0.06, lz);
      g.add(leg);
    }
  }
  g.add(base, back, armL, armR);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function makeArmchair(color) {
  const g = new THREE.Group();
  const mat = leatherMat(color);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), mat);
  seat.position.y = 0.25;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.2), mat);
  back.position.set(0, 0.58, 0.3);
  const armGeo = new THREE.BoxGeometry(0.16, 0.36, 0.8);
  const armL = new THREE.Mesh(armGeo, mat);
  armL.position.set(-0.32, 0.44, 0);
  const armR = armL.clone();
  armR.position.x = 0.32;
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.55), mat);
  cushion.position.set(0, 0.44, -0.02);
  const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8);
  for (const lx of [-0.32, 0.32]) {
    for (const lz of [-0.32, 0.32]) {
      const leg = new THREE.Mesh(legGeo, materials.brass);
      leg.position.set(lx, 0.06, lz);
      g.add(leg);
    }
  }
  g.add(seat, back, armL, armR, cushion);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function makeCoffeeTable() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.5), materials.marble);
  top.position.y = 0.42;
  top.castShadow = true;
  top.receiveShadow = true;
  const legGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.4, 8);
  for (const lx of [-0.38, 0.38]) {
    for (const lz of [-0.18, 0.18]) {
      const leg = new THREE.Mesh(legGeo, materials.brass);
      leg.position.set(lx, 0.2, lz);
      g.add(leg);
    }
  }
  g.add(top);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function addLounge() {
  const cream = '#efe6da';
  const sofa = makeSofa(2.2, cream);
  sofa.position.set(13, 0, 11.75);
  scene.add(sofa);
  addObstacle(13, 11.75, 1.15, 0.5);

  const table = makeCoffeeTable();
  table.position.set(13, 0, 10.85);
  scene.add(table);
  addObstacle(13, 10.85, 0.5, 0.3);

  const chairL = makeArmchair(cream);
  chairL.position.set(11.4, 0, 10.4);
  chairL.rotation.y = Math.PI + 0.35;
  scene.add(chairL);
  addObstacle(11.4, 10.4, 0.45, 0.45);

  const chairR = makeArmchair('#22242a');
  chairR.position.set(14.6, 0, 10.4);
  chairR.rotation.y = Math.PI - 0.35;
  scene.add(chairR);
  addObstacle(14.6, 10.4, 0.45, 0.45);
}

function makeStaff(uniformColor, accessory) {
  const g = new THREE.Group();
  const uniform = fabricMat(uniformColor);
  const shirt = fabricMat('#f2efe9');
  const skin = new THREE.MeshStandardMaterial({ color: '#e8c4a0', roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: '#2a211c', roughness: 0.82 });

  // Legs + shoes
  const legGeo = new THREE.CylinderGeometry(0.07, 0.058, 0.85, 10);
  const legL = new THREE.Mesh(legGeo, uniform);
  legL.position.set(-0.09, 0.425, 0);
  const legR = legL.clone();
  legR.position.x = 0.09;
  const shoeGeo = new THREE.BoxGeometry(0.12, 0.06, 0.22);
  const shoeL = new THREE.Mesh(shoeGeo, materials.dark);
  shoeL.position.set(-0.09, 0.03, 0.05);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.09;

  // Torso (uniform)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.6, 14), uniform);
  torso.position.y = 1.14;
  // Shirt + tie
  const shirtV = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.3, 0.02), shirt);
  shirtV.position.set(0, 1.2, 0.13);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.02), materials.brass);
  tie.position.set(0, 1.16, 0.15);
  // Head + hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), skin);
  head.position.y = 1.58;
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
  hairMesh.position.y = 1.6;

  // Arms bent forward holding the accessory
  const armGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.5, 8);
  const armL = new THREE.Mesh(armGeo, uniform);
  armL.position.set(-0.2, 1.08, 0.1);
  armL.rotation.z = 0.35;
  armL.rotation.x = -0.7;
  const armR = armL.clone();
  armR.position.x = 0.2;
  armR.rotation.z = -0.35;
  const handGeo = new THREE.SphereGeometry(0.045, 12, 10);
  const handL = new THREE.Mesh(handGeo, skin);
  handL.position.set(-0.04, 0.98, 0.3);
  const handR = handL.clone();
  handR.position.x = 0.04;

  g.add(legL, legR, shoeL, shoeR, torso, shirtV, tie, head, hairMesh, armL, armR, handL, handR);

  // Accessory
  if (accessory === 'tray') {
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20), materials.brass);
    tray.position.set(0, 1.0, 0.3);
    const cupGeo = new THREE.CylinderGeometry(0.03, 0.025, 0.06, 12);
    for (const cx of [-0.06, 0.06]) {
      const cup = new THREE.Mesh(cupGeo, materials.plaster);
      cup.position.set(cx, 1.04, 0.3);
      g.add(cup);
    }
    g.add(tray);
  } else if (accessory === 'bag') {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), fabricMat('#c6a15b'));
    bag.position.set(0.3, 0.72, 0.05);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 16, Math.PI), materials.brass);
    handle.position.set(0.3, 0.84, 0.05);
    g.add(bag, handle);
  } else if (accessory === 'board') {
    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.02), materials.dark);
    boardFrame.position.set(0, 1.08, 0.32);
    boardFrame.rotation.x = -0.25;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.25),
      new THREE.MeshBasicMaterial({ color: '#cfe0ea' }),
    );
    screen.position.set(0, 1.08, 0.333);
    screen.rotation.x = -0.25;
    g.add(boardFrame, screen);
  }

  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function addStaff(x, z, opts) {
  const o = opts || {};
  const group = makeStaff(o.uniform || '#23262d', o.accessory || 'board');
  group.position.set(x, 0, z);
  group.rotation.y = o.baseRot || 0;
  scene.add(group);
  staff.push({
    group,
    home: { x, z },
    baseRot: o.baseRot || 0,
    behavior: o.behavior || 'sway',
    radius: o.radius || 1.0,
    speed: o.speed || 0.5,
    angle: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
  });
}

function addStaffTeam() {
  // Entrance greeter (sway, facing the glass door / incoming guests)
  addStaff(-2.6, 11.5, { uniform: '#23262d', accessory: 'board', behavior: 'sway', baseRot: 0 });
  // One consultant per display zone (gentle patrol, avoid fixtures)
  addStaff(-13.2, -3.6, { uniform: '#5a1f26', accessory: 'board', behavior: 'patrol', radius: 1.0 });
  addStaff(0, -3.0, { uniform: '#1f2a44', accessory: 'tray', behavior: 'patrol', radius: 0.9 });
  addStaff(13.2, -3.2, { uniform: '#233b34', accessory: 'board', behavior: 'patrol', radius: 0.9 });
  addStaff(-13.0, 8.6, { uniform: '#3a2f4d', accessory: 'bag', behavior: 'patrol', radius: 1.0 });
  addStaff(0, 9.0, { uniform: '#5a1f26', accessory: 'bag', behavior: 'patrol', radius: 0.9 });
  addStaff(13.3, 8.6, { uniform: '#23262d', accessory: 'tray', behavior: 'patrol', radius: 0.9 });
}

function updateStaff(dt, t) {
  for (const s of staff) {
    if (s.behavior === 'patrol') {
      // Wander heading slowly
      s.angle += Math.sin(t * 0.4 + s.phase) * 0.02;
      const step = s.speed * dt;
      let nx = s.group.position.x + Math.cos(s.angle) * step;
      let nz = s.group.position.z + Math.sin(s.angle) * step;
      // Steer back home if wandering too far
      const dxh = s.home.x - nx;
      const dzh = s.home.z - nz;
      if (dxh * dxh + dzh * dzh > s.radius * s.radius) {
        s.angle = Math.atan2(dzh, dxh);
        nx = s.group.position.x + Math.cos(s.angle) * step;
        nz = s.group.position.z + Math.sin(s.angle) * step;
      }
      // Collision-aware move (never pass through fixtures / walls)
      if (!blocked(nx, s.group.position.z)) s.group.position.x = nx; else s.angle += 1.4;
      if (!blocked(s.group.position.x, nz)) s.group.position.z = nz; else s.angle += 1.4;
      // Face movement direction (model built facing +Z)
      s.group.rotation.y = Math.atan2(Math.cos(s.angle), Math.sin(s.angle));
    } else {
      // Greeting sway
      s.group.rotation.y = s.baseRot + Math.sin(t * 0.9 + s.phase) * 0.28;
    }
  }
}

function makeFoliage(leafMat, height) {
  const group = new THREE.Group();
  // Trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, height * 0.5, 8), matte('#4a3b32'));
  trunk.position.y = height * 0.25;
  trunk.castShadow = true;
  group.add(trunk);

  // Layered topiary blobs (low-poly, flatShading)
  const layers = 4;
  for (let i = 0; i < layers; i += 1) {
    const t = i / (layers - 1);
    const radius = 0.26 * (1 - t * 0.55) + 0.1;
    const geo = new THREE.IcosahedronGeometry(radius, 0);
    const blob = new THREE.Mesh(geo, i % 2 === 0 ? leafMat : materials.leafFlatLight);
    blob.position.y = height * 0.32 + t * height * 0.5;
    blob.scale.y = 0.82;
    blob.rotation.y = i * 0.7;
    blob.castShadow = true;
    group.add(blob);
  }
  return group;
}

function makePlanter(style) {
  const group = new THREE.Group();
  let body;
  if (style === 'brass') {
    body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.5, 20), materials.brass);
  } else if (style === 'black') {
    body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.5, 20), materials.dark);
  } else {
    // Marble urn via LatheGeometry
    const prof = [
      [0.0, 0.0], [0.16, 0.0], [0.2, 0.06], [0.24, 0.2],
      [0.22, 0.34], [0.16, 0.44], [0.18, 0.5], [0.0, 0.5],
    ].map(([px, py]) => new THREE.Vector2(px, py));
    body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), materials.marble);
  }
  // Ensure the base touches the floor exactly (min y == 0)
  const bbox = new THREE.Box3().setFromObject(body);
  body.position.y -= bbox.min.y;
  body.castShadow = true;
  body.receiveShadow = true;

  // Soil
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16), matte('#2b241d'));
  soil.position.y = 0.48;
  group.add(body, soil);
  return group;
}

function addPlant(x, z, opts) {
  const o = opts || {};
  const style = o.style || 'marble';
  const scale = o.scale || 1;
  const group = new THREE.Group();
  const planter = makePlanter(style);
  group.add(planter);
  const foliage = makeFoliage(materials.leafFlat, 0.9);
  foliage.position.y = 0.5;
  group.add(foliage);
  group.scale.setScalar(scale);
  group.position.set(x, 0, z);
  group.traverse((child) => { if (child.isMesh) child.castShadow = true; });
  scene.add(group);
  addObstacle(x, z, 0.3 * scale, 0.3 * scale);
}

function addDecor() {
  // Room corners
  addPlant(-18.6, -11.3, { style: 'marble', scale: 1.25 });
  addPlant(18.6, -11.3, { style: 'marble', scale: 1.25 });
  addPlant(-18.6, 11.2, { style: 'brass', scale: 1.1 });
  addPlant(18.6, 11.2, { style: 'brass', scale: 1.1 });

  // Aisle ends (central cross aisle near z = -0.6)
  addPlant(-6.2, -0.6, { style: 'black', scale: 0.95 });
  addPlant(6.2, -0.6, { style: 'black', scale: 0.95 });

  // Near display zones (between top-row zones)
  addPlant(-6.2, -6.9, { style: 'marble', scale: 1.0 });
  addPlant(6.2, -6.9, { style: 'marble', scale: 1.0 });
  // Near display zones (between bottom-row zones)
  addPlant(-6.2, 5.5, { style: 'black', scale: 0.95 });
  addPlant(6.2, 5.5, { style: 'black', scale: 0.95 });

  // Aisle corners by the entrance (flanking the central door)
  addPlant(-9.5, 11.0, { style: 'brass', scale: 0.9 });
  addPlant(9.5, 11.0, { style: 'brass', scale: 0.9 });
}

function zoneBox(zone) {
  return {
    cx: (zone.x0 + zone.x1) / 2,
    cz: (zone.z0 + zone.z1) / 2,
    w: zone.x1 - zone.x0,
    d: zone.z1 - zone.z0,
  };
}

function at(zone, fx, fz) {
  return {
    x: zone.x0 + (zone.x1 - zone.x0) * fx,
    z: zone.z0 + (zone.z1 - zone.z0) * fz,
  };
}

function addObstacle(x, z, hx, hz) {
  obstacles.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function fitText(ctx, text, font, maxWidth) {
  const size = Number(font.match(/(\d+)px/)[1]);
  const family = font.replace(/^\d+px\s+/, '').replace(/^\d+\s+/, '');
  const weight = font.match(/^\d+/) ? font.split(' ')[0] : '600';
  let next = size;
  ctx.font = `${weight} ${next}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && next > 48) {
    next -= 4;
    ctx.font = `${weight} ${next}px ${family}`;
  }
}

function drawTracked(ctx, text, x, y, tracking) {
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * (chars.length - 1);
  let cursor = x - total / 2;
  const previous = ctx.textAlign;
  ctx.textAlign = 'center';
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor + widths[index] / 2, y);
    cursor += widths[index] + tracking;
  });
  ctx.textAlign = previous;
}

function blocked(x, z) {
  const radius = 0.36;
  if (x < -20 + radius || x > 20 - radius || z < -12.5 + radius || z > 12.5 - radius) return true;
  for (const obstacle of obstacles) {
    const closestX = Math.min(Math.max(x, obstacle.minX), obstacle.maxX);
    const closestZ = Math.min(Math.max(z, obstacle.minZ), obstacle.maxZ);
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

function updateWalk(dt) {
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  else forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

  let inputX = 0;
  let inputZ = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) inputZ += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) inputZ -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;

  if (inputX !== 0 || inputZ !== 0) {
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 9 : 4.2;
    const move = new THREE.Vector3();
    move.addScaledVector(forward, inputZ);
    move.addScaledVector(right, inputX);
    move.normalize().multiplyScalar(speed * dt);
    if (!blocked(player.x + move.x, player.z)) player.x += move.x;
    if (!blocked(player.x, player.z + move.z)) player.z += move.z;
  }

  player.y = EYE;
  controls.target.copy(player);
  camera.position.copy(player).add(offset);
}

function updateHud() {
  let next = { key: 'entrance', vi: 'Sảnh vào', en: 'Entrance' };
  for (const zone of ZONES) {
    if (player.x >= zone.x0 && player.x <= zone.x1 && player.z >= zone.z0 && player.z <= zone.z1) {
      next = { key: zone.id, vi: zone.vi, en: zone.en };
      break;
    }
  }
  if (next.key === 'entrance' && player.z <= 10) {
    next = { key: 'aisle', vi: 'Lỗi đi', en: 'Aisle' };
  }
  if (next.key === locationKey) return;
  locationKey = next.key;
  zoneViEl.textContent = next.vi;
  zoneEnEl.textContent = next.en;
}

function onKeyDown(event) {
  keys.add(event.code);
  if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
}

function onKeyUp(event) {
  keys.delete(event.code);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function makeLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 26);
  ctx.fillStyle = 'rgba(24, 20, 16, 0.92)';
  ctx.fill();
  ctx.strokeStyle = '#c9a45c';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#f5efe4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, text, '600 54px "Be Vietnam Pro", sans-serif', canvas.width - 70);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.7, 0.42, 1);
  sprite.renderOrder = 999;
  return sprite;
}

function removeNameSprite() {
  if (!nameSprite) return;
  scene.remove(nameSprite);
  if (nameSprite.material.map) nameSprite.material.map.dispose();
  nameSprite.material.dispose();
  nameSprite = null;
}

function focusProduct(node) {
  if (focusGroup === node) return;
  if (restoringGroup && restoringGroup.userData._rest) restoringGroup.scale.copy(restoringGroup.userData._rest);
  if (focusGroup) restoringGroup = focusGroup;
  if (!node.userData._rest) node.userData._rest = node.scale.clone();
  node.userData._zoom = node.userData._rest.clone().multiplyScalar(ZOOM_FACTOR);
  focusGroup = node;
  removeNameSprite();
  if (node.userData.product) {
    nameSprite = makeLabelSprite(node.userData.product.name);
    scene.add(nameSprite);
  }
}

function clearFocus() {
  if (restoringGroup && restoringGroup.userData._rest) restoringGroup.scale.copy(restoringGroup.userData._rest);
  if (focusGroup) restoringGroup = focusGroup;
  focusGroup = null;
  removeNameSprite();
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateWalk(dt);
  updateStaff(dt, clock.elapsedTime);

  // Smooth zoom / restore of the focused product
  if (focusGroup && focusGroup.userData._zoom) {
    focusGroup.scale.lerp(focusGroup.userData._zoom, 0.16);
    if (nameSprite) {
      const box = new THREE.Box3().setFromObject(focusGroup);
      const center = box.getCenter(new THREE.Vector3());
      nameSprite.position.set(center.x, box.max.y + 0.2, center.z);
    }
  }
  if (restoringGroup && restoringGroup.userData._rest) {
    restoringGroup.scale.lerp(restoringGroup.userData._rest, 0.16);
    if (restoringGroup.scale.distanceTo(restoringGroup.userData._rest) < 0.006) {
      restoringGroup.scale.copy(restoringGroup.userData._rest);
      restoringGroup = null;
    }
  }

  controls.update();
  if (camera.position.y < 0.4) camera.position.y = 0.4;
  updateHud();
  // FPS counter
  fpsTime++;
  if (fpsTime > 30) {
    fps = 30 / (fpsTime / 30);
    fpsTime = 0;
  }
  // Display FPS in top-left corner
  const fpsText = document.createElement('div');
  fpsText.style.cssText = 'position: fixed; top: 10px; left: 10px; width: 50px; height: 20px; background: rgba(0, 0, 0, 0.5); color: #fff; font-family: "Be Vietnam Pro", sans-serif; font-size: 14px; text-align: center;';
  fpsText.innerHTML = 'FPS: ' + Math.floor(fps);
  // Remove previous FPS text if exists
  const existing = document.querySelector('.fps-counter');
  if (existing) existing.remove();
  document.body.appendChild(fpsText);
  // Enable shadow fade effect
  renderer.setClearColor(0x000000);
  renderer.fog = new THREE.FogExp2(0x000000, 0.015);
  renderer.render(scene, camera);
}
