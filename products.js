import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ============================================================
   Module sản phẩm: danh mục, kiểu dáng 3D và bộ tạo mô hình.
   - CATEGORIES: 6 nhóm của showroom + các kiểu dáng có sẵn.
   - BUILDERS:   hàm dựng hình 3D theo từng kiểu dáng (màu chủ đạo).
   - createProductModel(): tạo Group 3D (kiểu có sẵn hoặc từ .glb).
   ============================================================ */

export const CATEGORIES = [
  {
    id: 'apparel', vi: 'Quần áo', en: 'Apparel',
    styles: [
      { key: 'tshirt', vi: 'Áo thun' },
      { key: 'shirt', vi: 'Áo sơ mi' },
      { key: 'jacket', vi: 'Áo khoác' },
      { key: 'dress', vi: 'Váy' },
    ],
  },
  {
    id: 'jewelry', vi: 'Trang sức', en: 'Jewelry',
    styles: [
      { key: 'ring', vi: 'Nhẫn' },
      { key: 'necklace', vi: 'Dây chuyền' },
      { key: 'earring', vi: 'Bông tai' },
      { key: 'bracelet', vi: 'Vòng tay' },
    ],
  },
  {
    id: 'watches', vi: 'Đồng hồ', en: 'Watches',
    styles: [
      { key: 'watch', vi: 'Đồng hồ đeo tay' },
    ],
  },
  {
    id: 'footwear', vi: 'Giày dép', en: 'Footwear',
    styles: [
      { key: 'shoe', vi: 'Giày tây' },
      { key: 'sneaker', vi: 'Giày sneaker' },
      { key: 'boot', vi: 'Giày bốt' },
      { key: 'heel', vi: 'Giày cao gót' },
    ],
  },
  {
    id: 'handbags', vi: 'Túi xách', en: 'Handbags',
    styles: [
      { key: 'tote', vi: 'Túi tote' },
      { key: 'clutch', vi: 'Túi clutch' },
      { key: 'satchel', vi: 'Túi đeo chéo' },
    ],
  },
  {
    id: 'accessories', vi: 'Phụ kiện', en: 'Accessories',
    styles: [
      { key: 'hat', vi: 'Mũ' },
      { key: 'glasses', vi: 'Kính mát' },
      { key: 'belt', vi: 'Thắt lưng' },
      { key: 'scarf', vi: 'Khăn' },
    ],
  },
];

const DEFAULT_STYLE = {
  apparel: 'tshirt',
  jewelry: 'ring',
  watches: 'watch',
  footwear: 'shoe',
  handbags: 'tote',
  accessories: 'hat',
};

/* ---------- helpers ---------- */

function std(color, opts) {
  const o = opts || {};
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.roughness != null ? o.roughness : 0.6,
    metalness: o.metalness != null ? o.metalness : 0.05,
    flatShading: !!o.flat,
  });
}

function tintable(color, opts) {
  const m = std(color, opts);
  m.userData.tintable = true;
  return m;
}

const GOLD = '#d4af37';
const CHROME = '#d8dade';
const DARK = '#211c19';

function shadowify(group) {
  group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return group;
}

/* Đưa mô hình về gốc: đáy chạm y=0, tâm x/z tại 0 */
function finalize(group) {
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const group2 = new THREE.Group();
  group2.add(group);
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;
  shadowify(group2);
  return group2;
}

/* ---------- builders theo kiểu dáng ---------- */

const BUILDERS = {
  /* ----- Quần áo ----- */
  tshirt(color) {
    const g = new THREE.Group();
    const mat = tintable(color);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.16), mat);
    body.position.y = 0.36;
    const slGeo = new THREE.BoxGeometry(0.16, 0.2, 0.16);
    const slL = new THREE.Mesh(slGeo, mat);
    slL.position.set(-0.33, 0.55, 0);
    slL.rotation.z = 0.5;
    const slR = slL.clone();
    slR.position.x = 0.33;
    slR.rotation.z = -0.5;
    const neck = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 16), std(new THREE.Color(color).multiplyScalar(0.8).getStyle()));
    neck.rotation.x = Math.PI / 2;
    neck.position.y = 0.66;
    g.add(body, slL, slR, neck);
    return finalize(g);
  },
  shirt(color) {
    const g = new THREE.Group();
    const mat = tintable(color);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.16), mat);
    body.position.y = 0.4;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16), std(new THREE.Color(color).multiplyScalar(0.85).getStyle()));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.75;
    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.66, 0.02), std(new THREE.Color(color).multiplyScalar(0.9).getStyle()));
    placket.position.set(0, 0.4, 0.09);
    g.add(body, collar, placket);
    return finalize(g);
  },
  jacket(color) {
    const g = new THREE.Group();
    const mat = tintable(color);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.2), mat);
    body.position.y = 0.42;
    const lapGeo = new THREE.BoxGeometry(0.12, 0.28, 0.03);
    const lapL = new THREE.Mesh(lapGeo, std(new THREE.Color(color).multiplyScalar(0.8).getStyle()));
    lapL.position.set(-0.1, 0.66, 0.11);
    lapL.rotation.z = 0.3;
    const lapR = lapL.clone();
    lapR.position.x = 0.1;
    lapR.rotation.z = -0.3;
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.7, 0.02), std(CHROME, { metalness: 0.9, roughness: 0.2 }));
    zip.position.set(0, 0.42, 0.11);
    g.add(body, lapL, lapR, zip);
    return finalize(g);
  },
  dress(color) {
    const g = new THREE.Group();
    const mat = tintable(color);
    const prof = [
      [0.0, 0.0], [0.24, 0.02], [0.22, 0.3], [0.14, 0.72], [0.1, 0.9], [0.0, 0.95],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), mat);
    body.position.y = 0.2;
    g.add(body);
    return finalize(g);
  },

  /* ----- Trang sức ----- */
  ring(color) {
    const g = new THREE.Group();
    const metal = std(GOLD, { metalness: 0.85, roughness: 0.2 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 12, 28), metal);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.1;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), tintable(color, { metalness: 0.1, roughness: 0.08 }));
    gem.position.y = 0.14;
    g.add(band, gem);
    return finalize(g);
  },
  necklace(color) {
    const g = new THREE.Group();
    const metal = std(GOLD, { metalness: 0.9, roughness: 0.18 });
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.16, 0.5, 0), new THREE.Vector3(-0.1, 0.3, 0),
      new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(0.1, 0.3, 0),
      new THREE.Vector3(0.16, 0.5, 0),
    ]);
    const chain = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.005, 6, false), metal);
    const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), tintable(color, { metalness: 0.1, roughness: 0.08 }));
    pendant.position.set(0, 0.18, 0);
    g.add(chain, pendant);
    return finalize(g);
  },
  earring(color) {
    const g = new THREE.Group();
    const metal = std(CHROME, { metalness: 0.9, roughness: 0.2 });
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.025, 14, 10), metal);
    stud.position.y = 0.16;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), tintable(color, { metalness: 0.1, roughness: 0.08 }));
    gem.position.y = 0.1;
    g.add(stud, gem);
    return finalize(g);
  },
  bracelet(color) {
    const g = new THREE.Group();
    const mat = tintable(color, { metalness: 0.3, roughness: 0.35 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 12, 28), mat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.1;
    g.add(band);
    return finalize(g);
  },

  /* ----- Đồng hồ ----- */
  watch(color) {
    const g = new THREE.Group();
    const metal = std(CHROME, { metalness: 0.9, roughness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 28), metal);
    body.position.y = 0.14;
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.07, 28), std('#f6f2ea', { roughness: 0.5, metalness: 0 }));
    dial.rotation.x = -Math.PI / 2;
    dial.position.y = 0.157;
    const strapMat = tintable(color, { roughness: 0.5 });
    const segGeo = new THREE.BoxGeometry(0.07, 0.012, 0.05);
    for (let i = 0; i < 3; i += 1) {
      for (const dir of [-1, 1]) {
        const seg = new THREE.Mesh(segGeo, strapMat);
        seg.position.set(0, 0.14 - i * 0.004, dir * (0.11 + i * 0.05));
        g.add(seg);
      }
    }
    g.add(body, dial);
    return finalize(g);
  },

  /* ----- Giày dép ----- */
  shoe(color) {
    const g = new THREE.Group();
    const upper = tintable(color, { roughness: 0.45 });
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.13), std(DARK));
    sole.position.y = 0.02;
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), upper);
    toe.scale.set(1.4, 0.7, 1.0);
    toe.position.set(0.1, 0.08, 0);
    const vamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.11), upper);
    vamp.position.set(-0.02, 0.08, 0);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.12), upper);
    heel.position.set(-0.13, 0.1, 0);
    g.add(sole, toe, vamp, heel);
    return finalize(g);
  },
  sneaker(color) {
    const g = new THREE.Group();
    const upper = tintable(color, { roughness: 0.6 });
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.14), std('#f0ede6'));
    sole.position.y = 0.025;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.13), upper);
    body.position.y = 0.1;
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), upper);
    toe.scale.set(1.3, 0.6, 1.0);
    toe.position.set(0.12, 0.09, 0);
    g.add(sole, body, toe);
    return finalize(g);
  },
  boot(color) {
    const g = new THREE.Group();
    const upper = tintable(color, { roughness: 0.5 });
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.13), std(DARK));
    sole.position.y = 0.02;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.3, 14), upper);
    shaft.position.set(-0.08, 0.2, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.12), upper);
    foot.position.set(0.0, 0.08, 0);
    g.add(sole, shaft, foot);
    return finalize(g);
  },
  heel(color) {
    const g = new THREE.Group();
    const upper = tintable(color, { roughness: 0.4 });
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.1), std(DARK));
    sole.position.set(0.02, 0.1, 0);
    sole.rotation.z = 0.18;
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), upper);
    toe.scale.set(1.3, 0.6, 1.0);
    toe.position.set(0.14, 0.08, 0);
    const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), std(DARK));
    heel.position.set(-0.12, 0.06, 0);
    g.add(sole, toe, heel);
    return finalize(g);
  },

  /* ----- Túi xách ----- */
  tote(color) {
    const g = new THREE.Group();
    const mat = tintable(color, { roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.18), mat);
    body.position.y = 0.2;
    const hGeo = new THREE.TorusGeometry(0.09, 0.012, 8, 16, Math.PI);
    const hL = new THREE.Mesh(hGeo, mat);
    hL.position.set(-0.1, 0.4, 0);
    hL.rotation.z = Math.PI;
    const hR = hL.clone();
    hR.position.x = 0.1;
    g.add(body, hL, hR);
    return finalize(g);
  },
  clutch(color) {
    const g = new THREE.Group();
    const mat = tintable(color, { roughness: 0.45 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.08), mat);
    body.position.y = 0.12;
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), std(GOLD, { metalness: 0.9, roughness: 0.2 }));
    clasp.position.set(0, 0.2, 0.05);
    g.add(body, clasp);
    return finalize(g);
  },
  satchel(color) {
    const g = new THREE.Group();
    const mat = tintable(color, { roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.14), mat);
    body.position.y = 0.2;
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.02), std(new THREE.Color(color).multiplyScalar(0.85).getStyle(), { roughness: 0.5 }));
    flap.position.set(0, 0.3, 0.08);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 16, Math.PI), mat);
    strap.position.y = 0.4;
    g.add(body, flap, strap);
    return finalize(g);
  },

  /* ----- Phụ kiện ----- */
  hat(color) {
    const g = new THREE.Group();
    const felt = tintable(color, { roughness: 0.7 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.02, 28), felt);
    brim.position.y = 0.02;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 24), felt);
    crown.position.y = 0.12;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.04, 24), std(new THREE.Color(color).multiplyScalar(0.6).getStyle(), { roughness: 0.5 }));
    band.position.y = 0.05;
    g.add(brim, crown, band);
    return finalize(g);
  },
  glasses(color) {
    const g = new THREE.Group();
    const frame = tintable(color, { metalness: 0.6, roughness: 0.3 });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: '#20242a', roughness: 0.05, metalness: 0, transmission: 0.6,
      thickness: 0.02, transparent: true, opacity: 0.85,
    });
    const lensGeo = new THREE.CircleGeometry(0.06, 24);
    const rimGeo = new THREE.TorusGeometry(0.062, 0.008, 8, 20);
    for (const sx of [-0.085, 0.085]) {
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.x = sx;
      const rim = new THREE.Mesh(rimGeo, frame);
      rim.position.x = sx;
      g.add(lens, rim);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 12, Math.PI), frame);
    g.add(bridge);
    return finalize(g);
  },
  belt(color) {
    const g = new THREE.Group();
    const mat = tintable(color, { roughness: 0.45 });
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.012), mat);
    strap.position.y = 0.03;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.015), std(GOLD, { metalness: 0.9, roughness: 0.2 }));
    buckle.position.set(0.3, 0.03, 0);
    g.add(strap, buckle);
    return finalize(g);
  },
  scarf(color) {
    const g = new THREE.Group();
    const mat = tintable(color, { roughness: 0.9 });
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.03), mat);
    cloth.position.y = 0.35;
    cloth.rotation.z = 0.06;
    g.add(cloth);
    return finalize(g);
  },
};

/* ---------- tạo mô hình ---------- */

export function buildStyleModel(categoryId, styleKey, color) {
  const build = BUILDERS[styleKey] || BUILDERS[DEFAULT_STYLE[categoryId]] || BUILDERS.tshirt;
  return build(color);
}

function applyColorToGLB(root, color) {
  root.traverse((c) => {
    if (!c.isMesh || !c.material) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) {
      if (m && m.color && (m.metalness == null || m.metalness < 0.5)) {
        m.color.set(color);
        m.needsUpdate = true;
      }
    }
  });
}

function loadGLB(url) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 0.5 / maxDim;
        root.scale.setScalar(scale);
        const box2 = new THREE.Box3().setFromObject(root);
        const center = box2.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= box2.min.y;
        shadowify(root);
        resolve(root);
      },
      undefined,
      () => reject(new Error('Không tải được mô hình .glb')),
    );
  });
}

/**
 * Tạo mô hình 3D cho sản phẩm.
 * @param {{category:string, style:string, color:string, glbUrl?:string}} opts
 * @returns {Promise<THREE.Group>}
 */
export async function createProductModel(opts) {
  const o = opts || {};
  if (o.glbUrl) {
    const root = await loadGLB(o.glbUrl);
    if (o.color) applyColorToGLB(root, o.color);
    const wrap = new THREE.Group();
    wrap.add(root);
    return wrap;
  }
  return buildStyleModel(o.category, o.style, o.color || '#1e1c1a');
}

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}

export function categoryByVi(vi) {
  return CATEGORIES.find((c) => c.vi === vi) || CATEGORIES[0];
}