const PRODUCTS = [
  // Apparel Builders
  {
    name: 't-shirt',
    builder: (color) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.5, 0.2),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.6, 
          metalness: 0, 
          flatShading: true 
        })
      );
      body.position.set(0, 0.75, 0);
      group.add(body);
      return group;
    }
  },
  {
    name: 'hat',
    builder: (color) => {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1.25, 12),
        new THREE.MeshStandardMaterial({ 
          color: '#1a1a1a', 
          roughness: 0.8, 
          metalness: 0, 
          flatShading: true 
        })
      );
      pole.position.y = 0.62;
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.26, 0.025, 24),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.6, 
          metalness: 0, 
          flatShading: true 
        })
      );
      brim.position.y = 1.26;
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 0.16, 16),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.6, 
          metalness: 0, 
          flatShading: true 
        })
      );
      crown.position.y = 1.35;
      group.add(pole, brim, crown);
      group.position.set(0, 0, 0);
      return group;
    }
  },
  {
    name: 'sweater',
    builder: (color) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.14, 0.58, 14),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.6, 
          metalness: 0, 
          flatShading: true 
        })
      );
      body.position.y = 1.16;
      group.add(body);
      group.position.set(0, 0, 0);
      return group;
    }
  },
  {
    name: 'jeans',
    builder: (color) => {
      const group = new THREE.Group();
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.06, 0.92, 10),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.6, 
          metalness: 0, 
          flatShading: true 
        })
      );
      leg.position.set(-0.1, 0.46, 0);
      const right = leg.clone();
      right.position.x = 0.1;
      group.add(leg, right);
      group.position.set(0, 0, 0);
      return group;
    }
  },

  // Jewelry Builders
  {
    name: 'ring',
    builder: (color) => {
      const group = new THREE.Group();
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.05, 0.025, 10, 16),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.2, 
          metalness: 0.8, 
          flatShading: true 
        })
      );
      band.position.y = 0.94;
      group.add(band);
      group.position.set(0, 0, 0);
      return group;
    }
  },
  {
    name: 'necklace',
    builder: (color) => {
      const group = new THREE.Group();
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.45, 12),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.2, 
          metalness: 0.9, 
          flatShading: true 
        })
      );
      chain.position.y = 1.05;
      group.add(chain);
      group.position.set(0, 0, 0);
      return group;
    }
  },
  {
    name: 'bracelet',
    builder: (color) => {
      const group = new THREE.Group();
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.025, 10, 16),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.2, 
          metalness: 0.8, 
          flatShading: true 
        })
      );
      band.position.y = 0.94;
      group.add(band);
      group.position.set(0, 0, 0);
      return group;
    }
  },
  {
    name: 'earring',
    builder: (color) => {
      const group = new THREE.Group();
      const stud = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 12),
        new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.2, 
          metalness: 0.9, 
          flatShading: true 
        })
      );
      stud.position.y = 0.95;
      group.add(stud);
      group.position.set(0, 0, 0);
      return group;
    }
  }
];