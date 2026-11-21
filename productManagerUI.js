import { CATEGORIES, categoryById, createProductModel } from './products.js';

/* ============================================================
   productManagerUI — UI quản lý sản phẩm (Admin)
   - Nút "+ Thêm sản phẩm" mở form nhập.
   - Nút "Sửa" trên từng sản phẩm (khi được focus).
   - "Chuyển vị trí": đổi khu / slot trưng bày, cập nhật mesh ngay.
   - Nhãn trạng thái: Bình thường / Mới về / Bán chạy / Tạm hết hàng.
     + "Tạm hết hàng" sẽ ẩn mesh 3D nhưng giữ dữ liệu.
   - "Xóa": gỡ cả dữ liệu lẫn vật thể 3D (có xác nhận nhanh).

   ctx = {
     isAdmin(),                 // () => boolean
     findFreeSpot(zoneId),      // (zoneId) => {x,y,z,rotY} | null
     placeProduct(model, meta, spot, zoneId),
     updateProduct(node, meta, opts),
     moveProduct(node, spot, zoneId),   // cập nhật toạ độ mesh ngay
     removeProduct(node),               // gỡ khỏi scene + products
     setProductHidden(node, hidden),    // ẩn/hiện mesh (Tạm hết hàng)
     refreshRegistry(),         // rebuild + render admin list
     refreshNameSprite(),       // cập nhật label nếu đang focus
     refreshProductCard(node),  // cập nhật nội dung product card
     productCardNode(),         // node product đang focus (hoặc null)
     onMessage(msg),            // thông báo (toast)
   }
   ============================================================ */

const STORE_KEY = 'saitex_custom_products';

const STATUS = [
  { key: 'normal', vi: 'Bình thường' },
  { key: 'new', vi: 'Mới về' },
  { key: 'hot', vi: 'Bán chạy' },
  { key: 'out', vi: 'Tạm hết hàng' },
];

function statusVi(key) {
  const s = STATUS.find((x) => x.key === key);
  return s ? s.vi : 'Bình thường';
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      } else if (attrs[k] != null) {
        node.setAttribute(k, attrs[k]);
      }
    }
  }
  if (children) {
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return node;
}

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
}

function writeStore(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}

function genId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function createProductManager(ctx) {
  let editingNode = null; // node 3D đang sửa
  let movingNode = null; // node 3D đang chuyển vị trí

  /* ---------- store sync ---------- */

  function storeIndex(node) {
    const id = node && node.userData.product && node.userData.product.customId;
    if (!id) return -1;
    return readStore().findIndex((it) => it.customId === id);
  }

  function updateStore(node, patch) {
    const list = readStore();
    const idx = storeIndex(node);
    if (idx === -1) return;
    list[idx] = Object.assign({}, list[idx], patch, {
      meta: Object.assign({}, list[idx].meta, patch.meta || {}),
    });
    writeStore(list);
  }

  function removeStore(node) {
    const list = readStore();
    const idx = storeIndex(node);
    if (idx === -1) return;
    list.splice(idx, 1);
    writeStore(list);
  }

  /* ---------- form ---------- */

  function buildForm(mode) {
    const isEdit = mode === 'edit';
    const form = el('form', { class: 'pm-form', autocomplete: 'off' });

    const nameRow = el('label', { class: 'pm-field' }, [
      el('span', { class: 'pm-label', text: 'Tên sản phẩm' }),
      el('input', { class: 'pm-input', type: 'text', name: 'name', placeholder: 'VD: Áo sơ mi lụa cao cấp' }),
    ]);

    const catSelect = el('select', { class: 'pm-input', name: 'category' });
    for (const cat of CATEGORIES) {
      catSelect.appendChild(el('option', { value: cat.id, text: cat.vi }));
    }
    const catRow = el('label', { class: 'pm-field' }, [
      el('span', { class: 'pm-label', text: 'Danh mục' }),
      catSelect,
    ]);

    const styleSelect = el('select', { class: 'pm-input', name: 'style' });
    const glbInput = el('input', { class: 'pm-input', type: 'text', name: 'glb', placeholder: 'https://.../model.glb (tuỳ chọn)' });
    const styleRow = el('label', { class: 'pm-field' }, [
      el('span', { class: 'pm-label', text: 'Kiểu dáng 3D' }),
      styleSelect,
      el('span', { class: 'pm-hint', text: 'Hoặc dán đường dẫn file .glb' }),
      glbInput,
    ]);

    function fillStyles(catId, selectedKey) {
      const cat = categoryById(catId);
      styleSelect.innerHTML = '';
      for (const st of cat.styles) {
        styleSelect.appendChild(el('option', { value: st.key, text: st.vi }));
      }
      if (selectedKey) styleSelect.value = selectedKey;
    }
    fillStyles(catSelect.value);
    catSelect.addEventListener('change', () => fillStyles(catSelect.value));

    const priceRow = el('label', { class: 'pm-field' }, [
      el('span', { class: 'pm-label', text: 'Giá' }),
      el('input', { class: 'pm-input', type: 'text', name: 'price', placeholder: 'VD: 1.250.000₫' }),
    ]);

    const materialRow = el('label', { class: 'pm-field' }, [
      el('span', { class: 'pm-label', text: 'Chất liệu' }),
      el('input', { class: 'pm-input', type: 'text', name: 'material', placeholder: 'VD: Lụa, Da bê, Cotton' }),
    ]);

    const descRow = el('label', { class: 'pm-field' }, [
      el('span', { class: 'pm-label', text: 'Mô tả' }),
      el('textarea', { class: 'pm-input', name: 'desc', rows: '2', placeholder: 'Mô tả ngắn về sản phẩm' }),
    ]);

    const colorRow = el('label', { class: 'pm-field' }, [
      el('span', { class: 'pm-label', text: 'Màu sắc chủ đạo' }),
      el('input', { class: 'pm-input pm-color', type: 'color', name: 'color', value: '#1e1c1a' }),
    ]);

    const statusSelect = el('select', { class: 'pm-input', name: 'status' });
    for (const s of STATUS) statusSelect.appendChild(el('option', { value: s.key, text: s.vi }));
    const statusRow = el('label', { class: 'pm-field' }, [
      el('span', { class: 'pm-label', text: 'Nhãn trạng thái' }),
      statusSelect,
      el('span', { class: 'pm-hint', text: 'Chọn "Tạm hết hàng" để ẩn sản phẩm khỏi kệ.' }),
    ]);

    const actions = el('div', { class: 'pm-actions' }, [
      el('button', {
        class: 'pm-btn pm-cancel', type: 'button', text: 'Huỷ',
        onclick: () => closeModal(),
      }),
      el('button', { class: 'pm-btn pm-save', type: 'submit', text: isEdit ? 'Lưu thay đổi' : 'Lưu sản phẩm mới' }),
    ]);

    form.append(nameRow, catRow, styleRow, priceRow, materialRow, colorRow, statusRow, actions);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {
        name: form.name.value.trim(),
        category: form.category.value,
        style: form.style.value,
        glbUrl: form.glb.value.trim(),
        price: form.price.value.trim(),
        material: form.material.value.trim(),
        desc: form.desc.value.trim(),
        color: form.color.value,
        status: form.status.value,
      };
      if (!data.name) { ctx.onMessage && ctx.onMessage('Vui lòng nhập tên sản phẩm.'); return; }
      if (isEdit) submitEdit(data);
      else submitAdd(data);
    });

    return { form, setValues, catSelect, styleSelect, statusSelect };

    function setValues(v) {
      if (!v) return;
      form.name.value = v.name || '';
      if (v.category) { catSelect.value = v.category; fillStyles(v.category, v.style); }
      if (v.style) styleSelect.value = v.style;
      form.glb.value = v.glbUrl || '';
      form.price.value = v.price || '';
      form.material.value = v.material || '';
      form.desc.value = v.desc || '';
      form.color.value = v.color || '#1e1c1a';
      if (v.status) statusSelect.value = v.status;
    }
  }

  /* ---------- modal ---------- */

  let overlay = null;

  function openModal(mode, values) {
    closeModal();
    const isEdit = mode === 'edit';
    const built = buildForm(mode);
    const card = el('div', { class: 'pm-card' }, [
      el('div', { class: 'pm-head' }, [
        el('span', { class: 'pm-title', text: isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới' }),
        el('button', {
          class: 'pm-close', type: 'button', text: '✕',
          onclick: () => closeModal(),
        }),
      ]),
      built.form,
    ]);
    overlay = el('div', { class: 'pm-overlay' }, [card]);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    if (values) built.setValues(values);
    const first = card.querySelector('input[name="name"]');
    if (first) first.focus();
  }

  function closeModal() {
    if (!overlay) return;
    const o = overlay;
    overlay = null;
    o.classList.remove('show');
    setTimeout(() => { if (o.parentNode) o.parentNode.removeChild(o); }, 220);
  }

  /* ---------- move modal ---------- */

  function openMoveModal(node) {
    if (!node || !node.userData.product) return;
    movingNode = node;
    const p = node.userData.product;
    const zoneSelect = el('select', { class: 'pm-input', name: 'zone' });
    for (const cat of CATEGORIES) {
      const opt = el('option', { value: cat.id, text: cat.vi });
      if (cat.id === p.categoryId) opt.selected = true;
      zoneSelect.appendChild(opt);
    }
    const form = el('form', { class: 'pm-form', autocomplete: 'off' }, [
      el('label', { class: 'pm-field' }, [
        el('span', { class: 'pm-label', text: 'Khu vực trưng bày' }),
        zoneSelect,
        el('span', { class: 'pm-hint', text: 'Hệ thống tự tìm một vị trí (slot) còn trống trong khu.' }),
      ]),
      el('div', { class: 'pm-actions' }, [
        el('button', { class: 'pm-btn pm-cancel', type: 'button', text: 'Huỷ', onclick: () => closeModal() }),
        el('button', { class: 'pm-btn pm-save', type: 'submit', text: 'Chuyển đến khu này' }),
      ]),
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const zoneId = zoneSelect.value;
      const spot = ctx.findFreeSpot(zoneId);
      if (!spot) { ctx.onMessage && ctx.onMessage('Khu này đã đầy, không còn slot trống.'); return; }
      const ok = ctx.moveProduct(movingNode, spot, zoneId);
      if (ok) {
        updateStore(movingNode, { zoneId, meta: { categoryId: zoneId } });
        ctx.refreshRegistry();
        ctx.refreshNameSprite();
        if (ctx.refreshProductCard) ctx.refreshProductCard(movingNode);
        const z = categoryById(zoneId);
        ctx.onMessage && ctx.onMessage('Đã chuyển đến ' + z.vi + '.');
        closeModal();
      } else {
        ctx.onMessage && ctx.onMessage('Không chuyển được sản phẩm.');
      }
    });
    openCardModal('Chuyển vị trí trưng bày', form);
  }

  function openCardModal(title, bodyNode) {
    closeModal();
    const card = el('div', { class: 'pm-card pm-card-sm' }, [
      el('div', { class: 'pm-head' }, [
        el('span', { class: 'pm-title', text: title }),
        el('button', { class: 'pm-close', type: 'button', text: '✕', onclick: () => closeModal() }),
      ]),
      bodyNode,
    ]);
    overlay = el('div', { class: 'pm-overlay' }, [card]);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  /* ---------- add / edit handlers ---------- */

  async function submitAdd(data) {
    const cat = categoryById(data.category);
    const customId = genId();
    const meta = {
      customId,
      name: data.name,
      category: cat.vi,
      categoryId: cat.id,
      price: data.price || 'Liên hệ',
      material: data.material || '',
      desc: data.desc || '',
      color: data.color,
      style: data.style,
      glbUrl: data.glbUrl || '',
      status: data.status || 'normal',
    };
    ctx.onMessage && ctx.onMessage('Đang tạo mô hình 3D...');
    let model;
    try {
      model = await createProductModel({ category: cat.id, style: data.style, color: data.color, glbUrl: data.glbUrl });
    } catch (err) {
      ctx.onMessage && ctx.onMessage('Lỗi: ' + (err && err.message ? err.message : 'không tạo được mô hình'));
      return;
    }
    const spot = ctx.findFreeSpot(cat.id);
    if (!spot) { ctx.onMessage && ctx.onMessage('Không còn vị trí trống trong khu này.'); return; }
    ctx.placeProduct(model, meta, spot, cat.id);

    const list = readStore();
    list.push({ customId, zoneId: cat.id, meta });
    writeStore(list);

    ctx.refreshRegistry();
    ctx.refreshNameSprite();
    closeModal();
    ctx.onMessage && ctx.onMessage('Đã thêm sản phẩm vào ' + cat.vi + '.');
  }

  async function submitEdit(data) {
    if (!editingNode) { closeModal(); return; }
    const meta = editingNode.userData.product || {};
    const cat = categoryById(data.category);
    const oldColor = meta.color;
    const oldCategoryId = meta.categoryId;
    const newMeta = Object.assign({}, meta, {
      name: data.name,
      category: cat.vi,
      categoryId: cat.id,
      price: data.price || meta.price,
      material: data.material,
      desc: data.desc,
      color: data.color,
      style: data.style,
      status: data.status || 'normal',
    });

    // đổi màu trên mesh nếu màu thay đổi
    if (data.color && data.color !== oldColor) {
      ctx.updateProduct(editingNode, newMeta, { recolor: true, oldColor });
    } else {
      ctx.updateProduct(editingNode, newMeta, { recolor: false });
    }

    // đổi khu -> chuyển tới slot trống của khu mới
    if (oldCategoryId && data.category && data.category !== oldCategoryId) {
      const spot = ctx.findFreeSpot(data.category);
      if (spot) ctx.moveProduct(editingNode, spot, data.category);
      else ctx.onMessage && ctx.onMessage('Khu mới đã đầy, giữ nguyên vị trí cũ.');
    }

    // áp dụng trạng thái ẩn/hiện
    if (ctx.setProductHidden) ctx.setProductHidden(editingNode, data.status === 'out');

    // đồng bộ store
    updateStore(editingNode, { zoneId: newMeta.categoryId, meta: newMeta });

    ctx.refreshRegistry();
    ctx.refreshNameSprite();
    if (ctx.refreshProductCard) ctx.refreshProductCard(editingNode);
    closeModal();
    ctx.onMessage && ctx.onMessage('Đã cập nhật sản phẩm.');
  }

  /* ---------- quick actions on focused node ---------- */

  function toggleStock() {
    const node = ctx.productCardNode();
    if (!node || !node.userData.product) return;
    const p = node.userData.product;
    const willHide = p.status !== 'out';
    if (ctx.setProductHidden) ctx.setProductHidden(node, willHide);
    const newStatus = willHide ? 'out' : 'normal';
    node.userData.product.status = newStatus;
    updateStore(node, { meta: { status: newStatus } });
    ctx.refreshRegistry();
    if (ctx.refreshProductCard) ctx.refreshProductCard(node);
    ctx.onMessage && ctx.onMessage(willHide ? 'Đã đánh dấu Tạm hết hàng (ẩn khỏi kệ).' : 'Đã mở bán lại.');
  }

  function deleteProduct() {
    const node = ctx.productCardNode();
    if (!node || !node.userData.product) return;
    const name = node.userData.product.name;
    // xác nhận nhanh 2 bước trên chính nút Xóa
    const ok = window.confirm('Xóa sản phẩm "' + name + '" khỏi showroom?');
    if (!ok) return;
    removeStore(node);
    if (ctx.removeProduct) ctx.removeProduct(node);
    ctx.refreshRegistry();
    // ẩn card
    const card = document.getElementById('product-card');
    if (card) card.classList.remove('visible');
    ctx.onMessage && ctx.onMessage('Đã xóa sản phẩm.');
  }

  /* ---------- nút "+ Thêm sản phẩm" ---------- */

  const addBtn = el('button', {
    class: 'pm-fab', type: 'button', text: '+ Thêm sản phẩm',
    onclick: (e) => { e.stopPropagation(); openModal('add', null); },
  });
  document.body.appendChild(addBtn);

  /* ---------- thanh nút thao tác gắn vào product card ---------- */

  let actionsBar = null;

  function ensureCardActions() {
    const card = document.getElementById('product-card');
    if (!card) return;
    if (actionsBar && actionsBar.parentNode !== card) card.appendChild(actionsBar);
    if (actionsBar) return;

    actionsBar = el('div', { class: 'pm-card-actions' });

    const editBtn = el('button', {
      class: 'pm-edit-btn', type: 'button', text: '✎ Sửa',
      onclick: (e) => {
        e.stopPropagation();
        if (!ctx.isAdmin()) { ctx.onMessage && ctx.onMessage('Cần đăng nhập Admin.'); return; }
        const node = ctx.productCardNode();
        if (!node || !node.userData.product) return;
        editingNode = node;
        const p = node.userData.product;
        openModal('edit', {
          name: p.name, category: p.categoryId || '', style: p.style,
          glbUrl: p.glbUrl || '', price: p.price, material: p.material,
          desc: p.desc, color: p.color, status: p.status || 'normal',
        });
      },
    });

    const moveBtn = el('button', {
      class: 'pm-edit-btn', type: 'button', text: '⇄ Chuyển vị trí',
      onclick: (e) => {
        e.stopPropagation();
        if (!ctx.isAdmin()) { ctx.onMessage && ctx.onMessage('Cần đăng nhập Admin.'); return; }
        openMoveModal(ctx.productCardNode());
      },
    });

    const stockBtn = el('button', {
      class: 'pm-edit-btn', type: 'button', text: 'Đánh dấu hết hàng',
      onclick: (e) => { e.stopPropagation(); if (!ctx.isAdmin()) return; toggleStock(); },
    });

    const delBtn = el('button', {
      class: 'pm-edit-btn pm-danger', type: 'button', text: '🗑 Xóa',
      onclick: (e) => { e.stopPropagation(); if (!ctx.isAdmin()) return; deleteProduct(); },
    });

    actionsBar.append(editBtn, moveBtn, stockBtn, delBtn);
    card.appendChild(actionsBar);
  }

  function refreshCardActions() {
    const card = document.getElementById('product-card');
    if (!card) return;
    const show = ctx.isAdmin() && card.classList.contains('visible');
    if (actionsBar) {
      actionsBar.style.display = show ? '' : 'none';
      // cập nhật nhãn nút trạng thái theo node hiện tại
      if (show) {
        const node = ctx.productCardNode();
        const isOut = node && node.userData.product && node.userData.product.status === 'out';
        const btn = actionsBar.querySelector('.pm-edit-btn:nth-child(3)');
        if (btn) btn.textContent = isOut ? 'Mở bán lại' : 'Đánh dấu hết hàng';
      }
    }
  }

  /* cập nhật trạng thái hiển thị (gọi mỗi frame từ animate) */
  function tick() {
    ensureCardActions();
    refreshCardActions();
    const showAdd = ctx.isAdmin();
    addBtn.style.display = showAdd ? '' : 'none';
  }

  /* áp dụng lại các sản phẩm tuỳ chọn đã lưu (sau reload) */
  function restoreCustom() {
    const list = readStore();
    for (const item of list) {
      try {
        const meta = item.meta;
        const spot = ctx.findFreeSpot(item.zoneId);
        if (!spot) continue;
        createProductModel({
          category: meta.categoryId, style: meta.style, color: meta.color, glbUrl: meta.glbUrl,
        }).then((model) => {
          ctx.placeProduct(model, Object.assign({ categoryId: item.zoneId, customId: item.customId, status: meta.status || 'normal' }, meta), spot, item.zoneId);
          ctx.refreshRegistry();
        }).catch(() => { /* bỏ qua item lỗi */ });
      } catch (e) { /* ignore */ }
    }
  }

  return { tick, openAdd: () => openModal('add', null), restoreCustom, closeModal };
}