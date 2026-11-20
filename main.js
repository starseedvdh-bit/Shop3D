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
    rug: '#d9c7b0',
    light: '#fff1dc',
  },
  {
    id: 'jewelry',
    vi: 'Khu Trang sức',
    en: 'Jewelry',
    x0: -4.7, x1: 4.7, z0: -11.5, z1: -2.3,
    rug: '#2a2724',
    light: '#fff6e4',
  },
  {
    id: 'watches',
    vi: 'Khu Đồng hồ',
    en: 'Watches',
    x0: 7.7, x1: 18.7, z0: -11.5, z1: -2.3,
    rug: '#243038',
    light: '#e7eef8',
  },
  {
    id: 'footwear',
    vi: 'Khu Giày dép',
    en: 'Footwear',
    x0: -18.7, x1: -7.7, z0: 1.1, z1: 10,
    rug: '#cbbba8',
    light: '#fff3e6',
  },
  {
    id: 'handbags',
    vi: 'Khu Túi xách',
    en: 'Handbags',
    x0: -4.7, x1: 4.7, z0: 1.1, z1: 10,
    rug: '#6d3438',
    light: '#fff0ea',
  },
  {
    id: 'accessories',
    vi: 'Khu Phụ kiện',
    en: 'Accessories',
    note: 'Mũ · Kính mát · Thắt lưng · Khăn',
    x0: 7.7, x1: 18.7, z0: 1.1, z1: 10,
    rug: '#3f4d45',
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
const products = [];
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.prepend(renderer.domElement);
  maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#c9d6df');
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
  addPlant(-3.4, 11.15);
  addPlant(3.4, 11.15);

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

  clock = new THREE.Clock();
  renderer.setAnimationLoop(animate);
}

function createMaterials() {
  materials.wall = new THREE.MeshStandardMaterial({
    color: '#f4f0e8',
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.2,
  });
  materials.ceiling = new THREE.MeshStandardMaterial({
    color: '#f7f5f1',
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
    color: '#f7f4ef',
    roughness: 0.88,
    metalness: 0.02,
  });
  materials.brass = new THREE.MeshStandardMaterial({
    color: '#c6a15b',
    roughness: 0.28,
    metalness: 1,
    envMapIntensity: 1,
  });
  materials.chrome = new THREE.MeshStandardMaterial({
    color: '#d5d8dc',
    roughness: 0.16,
    metalness: 1,
    envMapIntensity: 1,
  });
  materials.plaster = new THREE.MeshStandardMaterial({
    color: '#f3efe8',
    roughness: 0.72,
    metalness: 0.02,
  });
  materials.dark = new THREE.MeshStandardMaterial({
    color: '#2c2825',
    roughness: 0.55,
    metalness: 0.08,
  });
  materials.wood = new THREE.MeshStandardMaterial({
    color: '#4a3b32',
    roughness: 0.62,
    metalness: 0.06,
  });
  materials.velvet = new THREE.MeshStandardMaterial({
    color: '#161616',
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
  ctx.fillStyle = '#e4dfd8';
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
  scene.add(new THREE.HemisphereLight('#fff6ec', '#c9c1b4', 0.72));
  scene.add(new THREE.AmbientLight('#ffffff', 0.22));

  const sun = new THREE.DirectionalLight('#fff3e4', 2.15);
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

  const fill = new THREE.DirectionalLight('#e4ecf5', 0.45);
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
    addDownlight(box.cx - box.w * 0.22, box.cz - box.d * 0.18, zone.light, 70);
    addDownlight(box.cx + box.w * 0.22, box.cz + box.d * 0.18, zone.light, 70);
  }

  for (let x = -16; x <= 16; x += 8) {
    addDownlight(x, -0.6, '#fff8ef', 46);
  }

  const slotMat = new THREE.MeshStandardMaterial({
    color: '#fff8ef',
    emissive: '#fff1dd',
    emissiveIntensity: 0.55,
    roughness: 0.45,
  });
  for (const z of [-8.2, -0.6, 6.4]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(34, 0.025, 0.12), slotMat);
    slot.position.set(0, CEILING - 0.02, z);
    scene.add(slot);
  }
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
    new THREE.MeshStandardMaterial({ color: '#d5d0c8', roughness: 0.96 }),
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
  for (const fx of [0.28, 0.72]) {
    for (const fz of [0.28, 0.74]) addVitrine(at(zone, fx, fz));
  }
}

function addWatches(zone) {
  const face = makeWatchFaceTexture();
  for (const fx of [0.28, 0.72]) {
    for (const fz of [0.22, 0.4, 0.62, 0.8]) addWatchPedestal(at(zone, fx, fz), face);
  }
}

function addFootwear(zone) {
  addShoeShelf(at(zone, 0.24, 0.36), Math.PI / 2);
  addShoeShelf(at(zone, 0.24, 0.7), Math.PI / 2);
  addBench(at(zone, 0.7, 0.5), 0);
}

function addHandbags(zone) {
  const colors = ['#f3efe8', '#1d1b19', '#8d3a34', '#c6a15b', '#243048', '#efe6da'];
  const spots = [
    [0.28, 0.28], [0.72, 0.28],
    [0.28, 0.55], [0.72, 0.55],
    [0.28, 0.8], [0.72, 0.8],
  ];
  spots.forEach(([fx, fz], index) => addBag(at(zone, fx, fz), colors[index]));
}

function addAccessories(zone) {
  addClusterLabel(at(zone, 0.28, 0.78), 'Mũ');
  addClusterLabel(at(zone, 0.74, 0.78), 'Kính mát');
  addClusterLabel(at(zone, 0.28, 0.26), 'Thắt lưng');
  addClusterLabel(at(zone, 0.74, 0.26), 'Khăn');

  const hats = at(zone, 0.28, 0.72);
  addHat(hats.x - 0.7, hats.z, '#1f1d1b');
  addHat(hats.x, hats.z, '#f4f1ea');
  addHat(hats.x + 0.7, hats.z, '#8d6a3f');

  addGlassesTable(at(zone, 0.74, 0.72));
  addBeltRail(at(zone, 0.28, 0.32));
  addScarves(at(zone, 0.74, 0.32));
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

  for (let i = 0; i < 7; i += 1) {
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.9, 0.07),
      matte(colors[i % colors.length]),
    );
    cloth.position.set(-length / 2 + 0.35 + i * ((length - 0.6) / 6), 0.98, 0);
    cloth.castShadow = true;
    group.add(cloth);
  }

  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = rotY;
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(group);

  const alongZ = Math.abs(Math.sin(rotY)) > 0.5;
  addObstacle(pos.x, pos.z, alongZ ? 0.4 : length / 2, alongZ ? length / 2 : 0.4);
}

function addMannequin(pos, rotY, outfit) {
  const group = new THREE.Group();
  const cloth = matte(outfit);
  const legGeo = new THREE.CylinderGeometry(0.075, 0.06, 0.92, 10);
  const left = new THREE.Mesh(legGeo, cloth);
  left.position.set(-0.1, 0.46, 0);
  const right = left.clone();
  right.position.x = 0.1;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.58, 14), cloth);
  torso.position.y = 1.16;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), materials.plaster);
  head.position.y = 1.58;
  const armGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.55, 8);
  const armL = new THREE.Mesh(armGeo, cloth);
  armL.position.set(-0.26, 1.18, 0);
  armL.rotation.z = 0.35;
  const armR = armL.clone();
  armR.position.x = 0.26;
  armR.rotation.z = -0.35;
  group.add(left, right, torso, head, armL, armR);
  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = rotY;
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(group);
  addObstacle(pos.x, pos.z, 0.32, 0.32);
}

function addVitrine(pos) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.92, 0.7), materials.dark);
  base.position.set(pos.x, 0.46, pos.z);
  base.castShadow = true;
  base.receiveShadow = true;
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.5), materials.velvet);
  cushion.position.set(pos.x, 0.94, pos.z);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.28, 0.56), materials.caseGlass);
  glass.position.set(pos.x, 1.1, pos.z);
  scene.add(base, cushion, glass);

  for (const dx of [-0.28, 0, 0.28]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 10, 22), materials.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pos.x + dx, 1.0, pos.z);
    scene.add(ring);
  }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({
    color: '#7f1d2d',
    roughness: 0.15,
    metalness: 0.2,
  }));
  gem.position.set(pos.x, 1.05, pos.z + 0.12);
  scene.add(gem);
  addObstacle(pos.x, pos.z, 0.72, 0.4);
}

function addWatchPedestal(pos, faceTexture) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.92, 20), materials.plaster);
  base.position.set(pos.x, 0.46, pos.z);
  base.castShadow = true;
  base.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 20), materials.brass);
  cap.position.set(pos.x, 0.94, pos.z);
  const pillow = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16), materials.velvet);
  pillow.position.set(pos.x, 0.98, pos.z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 20), materials.chrome);
  body.position.set(pos.x, 1.02, pos.z);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.062, 24),
    new THREE.MeshBasicMaterial({ map: faceTexture, toneMapped: false }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.set(pos.x, 1.038, pos.z);
  scene.add(base, cap, pillow, body, face);
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

function addShoeShelf(pos, rotY) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.45, 0.38), materials.plaster);
  frame.position.y = 0.78;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);
  const colors = ['#f4f1ea', '#1f1d1b', '#8a3b32', '#c2a37a', '#243048', '#d8d2c8'];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      addShoe(group, -1.15 + col * 0.76, 0.32 + row * 0.42, 0.16, colors[(row + col) % colors.length]);
    }
  }
  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = rotY;
  scene.add(group);
  const alongZ = Math.abs(Math.sin(rotY)) > 0.5;
  addObstacle(pos.x, pos.z, alongZ ? 0.28 : 1.55, alongZ ? 1.55 : 0.28);
}

function addShoe(parent, x, y, z, color) {
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.13), materials.sole);
  sole.position.set(x, y, z);
  sole.castShadow = true;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.11), matte(color));
  upper.position.set(x - 0.01, y + 0.06, z);
  upper.castShadow = true;
  parent.add(sole, upper);
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

function addBag(pos, color) {
  const group = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.68, 16), materials.plaster);
  pedestal.position.y = 0.34;
  pedestal.castShadow = true;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.16), matte(color));
  body.position.y = 0.86;
  body.castShadow = true;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 8, 18, Math.PI), materials.brass);
  handle.position.y = 1.1;
  handle.rotation.z = Math.PI;
  group.add(pedestal, body, handle);
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  addObstacle(pos.x, pos.z, 0.3, 0.3);
}

function addHat(x, z, color) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 8), materials.chrome);
  pole.position.y = 0.62;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.025, 20), matte(color));
  brim.position.y = 1.26;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.16, 16), matte(color));
  crown.position.y = 1.35;
  group.add(pole, brim, crown);
  group.position.set(x, 0, z);
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(group);
  addObstacle(x, z, 0.28, 0.28);
}

function addGlassesTable(pos) {
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.86, 0.62), materials.plaster);
  table.position.set(pos.x, 0.43, pos.z);
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);
  const lensMat = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.08, metalness: 0.65 });
  for (let i = 0; i < 3; i += 1) {
    const group = new THREE.Group();
    const lensGeo = new THREE.SphereGeometry(0.065, 14, 10);
    const left = new THREE.Mesh(lensGeo, lensMat);
    left.scale.z = 0.32;
    left.position.x = -0.09;
    const right = left.clone();
    right.position.x = 0.09;
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), materials.chrome);
    bridge.rotation.z = Math.PI / 2;
    group.add(left, right, bridge);
    group.position.set(pos.x - 0.48 + i * 0.48, 0.95, pos.z);
    scene.add(group);
  }
  addObstacle(pos.x, pos.z, 0.9, 0.36);
}

function addBeltRail(pos) {
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
  for (let i = 0; i < 4; i += 1) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.03), matte(colors[i]));
    belt.position.set(-0.55 + i * 0.36, 0.82, 0);
    belt.castShadow = true;
    group.add(belt);
  }
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  addObstacle(pos.x, pos.z, 0.9, 0.25);
}

function addScarves(pos) {
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
  const colors = ['#8d1d2c', '#1f3d73', '#efe8de', '#b08d57', '#2f4f46'];
  for (let i = 0; i < colors.length; i += 1) {
    const scarf = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.95), matte(colors[i]));
    scarf.position.set(-0.64 + i * 0.32, 0.95, 0);
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

function addHostDesk() {
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.02, 0.7), materials.wood);
  desk.position.set(-15.6, 0.51, 11.15);
  desk.castShadow = true;
  desk.receiveShadow = true;
  scene.add(desk);
  addObstacle(-15.6, 11.15, 1.1, 0.42);
}

function addPlant(x, z) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.36, 16), materials.pot);
  pot.position.set(x, 0.18, z);
  pot.castShadow = true;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), materials.leaf);
  leaf.position.set(x, 0.82, z);
  leaf.scale.y = 1.3;
  leaf.castShadow = true;
  scene.add(pot, leaf);
  addObstacle(x, z, 0.4, 0.4);
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

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateWalk(dt);
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
