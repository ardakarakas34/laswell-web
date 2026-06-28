'use strict';

/* ============================================================
   LASWELL — Admin Panel Logic
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── State ─────────────────────────────────────────────────────
const adminState = {
  editingId:    null,
  selectedSizes:  [],
  selectedColors: [],
  adminProducts:  [],
  adminSearch:    '',
  adminCatFilter: '',
  adminTypeFilter: 'all',
  confirmCallback: null,
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (LaswellDB.isAuthenticated()) {
    showPanel();
  } else {
    $('#login-screen').style.display = 'flex';
    $('#admin-panel').style.display  = 'none';
  }

  bindLoginEvents();
  bindAdminEvents();
  bindChips();
  bindImageUpload();
  bindConfirmModal();
});

// ── Auth ──────────────────────────────────────────────────────
function bindLoginEvents() {
  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = $('#admin-password').value;
    if (LaswellDB.login(pw)) {
      showPanel();
    } else {
      const err = $('#login-error');
      err.classList.add('show');
      setTimeout(() => err.classList.remove('show'), 3000);
      $('#admin-password').value = '';
    }
  });

  $('#logout-btn').addEventListener('click', () => {
    LaswellDB.logout();
    location.reload();
  });
}

function showPanel() {
  $('#login-screen').style.display  = 'none';
  $('#admin-panel').classList.add('visible');
  LaswellDB.seed();
  loadDashboard();
  loadProductList();
  updateSidebarCount();
}

// ── Navigation ────────────────────────────────────────────────
function switchPanel(panelName) {
  $$('.admin-panel').forEach(p => p.classList.remove('active'));
  $$('.sidebar-link').forEach(l => l.classList.remove('active'));

  const panel = $(`#panel-${panelName}`);
  const link  = $(`[data-panel="${panelName}"]`);
  if (panel) panel.classList.add('active');
  if (link)  link.classList.add('active');

  const titles = {
    dashboard:    'Dashboard',
    products:     'Ürünler',
    'add-product': 'Ürün Ekle / Düzenle',
    data:         'Veri Yönetimi',
  };
  $('#topbar-title').textContent = titles[panelName] || '';

  if (panelName === 'products')  loadProductList();
  if (panelName === 'dashboard') loadDashboard();
  if (panelName === 'add-product' && !adminState.editingId) resetForm();
}

function bindAdminEvents() {
  // Sidebar nav
  $$('.sidebar-link[data-panel]').forEach(link => {
    link.addEventListener('click', () => switchPanel(link.dataset.panel));
  });

  // Dashboard "Tümünü Gör" button
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-panel]');
    if (btn && !btn.classList.contains('sidebar-link')) {
      switchPanel(btn.dataset.panel);
    }
  });

  // Topbar add btn
  $('#topbar-add-btn').addEventListener('click', () => {
    adminState.editingId = null;
    resetForm();
    switchPanel('add-product');
  });

  // Product panel add btn
  $('#admin-add-product-btn').addEventListener('click', () => {
    adminState.editingId = null;
    resetForm();
    switchPanel('add-product');
  });

  // Form cancel
  $('#form-cancel-btn').addEventListener('click', () => switchPanel('products'));

  // Form reset
  $('#form-reset-btn').addEventListener('click', () => {
    adminState.editingId = null;
    resetForm();
  });

  // Product form submit
  $('#product-form').addEventListener('submit', handleProductSubmit);

  // Admin search + filter
  $('#admin-search-input').addEventListener('input', (e) => {
    adminState.adminSearch = e.target.value.toLowerCase();
    loadProductList();
  });
  $('#admin-cat-filter').addEventListener('change', (e) => {
    adminState.adminCatFilter = e.target.value;
    loadProductList();
  });
  $('#admin-type-filter').addEventListener('change', (e) => {
    adminState.adminTypeFilter = e.target.value;
    loadProductList();
  });

  // Connect stats cards in dashboard
  $('#stat-card-total').addEventListener('click', () => {
    adminState.adminTypeFilter = 'all';
    $('#admin-type-filter').value = 'all';
    switchPanel('products');
  });
  $('#stat-card-featured').addEventListener('click', () => {
    adminState.adminTypeFilter = 'featured';
    $('#admin-type-filter').value = 'featured';
    switchPanel('products');
  });
  $('#stat-card-discount').addEventListener('click', () => {
    adminState.adminTypeFilter = 'discount';
    $('#admin-type-filter').value = 'discount';
    switchPanel('products');
  });
  $('#stat-card-total-val').addEventListener('click', () => {
    adminState.adminTypeFilter = 'all';
    $('#admin-type-filter').value = 'all';
    switchPanel('products');
  });
  $('#stat-card-expensive').addEventListener('click', () => {
    adminState.adminTypeFilter = 'expensive';
    $('#admin-type-filter').value = 'expensive';
    switchPanel('products');
  });
  $('#stat-card-cats').addEventListener('click', () => {
    adminState.adminTypeFilter = 'all';
    $('#admin-type-filter').value = 'all';
    switchPanel('products');
  });

  // Image URL preview
  $('#f-image-url').addEventListener('input', () => updateImagePreview($('#f-image-url').value.trim()));

  // Export
  $('#export-btn').addEventListener('click', () => {
    const json = LaswellDB.exportJSON();
    $('#export-textarea').value = json;
    const blob = new Blob([json], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `laswell_products_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showAdminToast('Veriler dışa aktarıldı!', 'success');
  });

  // Import
  $('#import-btn').addEventListener('click', () => {
    const json = $('#import-textarea').value.trim();
    if (!json) { showAdminToast('Lütfen JSON verisi girin.', 'error'); return; }
    openConfirm(
      '⚠️', 'İçe Aktar',
      'Mevcut tüm ürünler silinip yeni veriler yüklenecek. Emin misiniz?',
      'İçe Aktar', () => {
        if (LaswellDB.importJSON(json)) {
          showAdminToast('Veriler başarıyla içe aktarıldı!', 'success');
          loadProductList(); loadDashboard(); updateSidebarCount();
        } else {
          showAdminToast('Geçersiz JSON formatı!', 'error');
        }
      }
    );
  });

  // Clear all
  $('#clear-all-btn').addEventListener('click', () => {
    openConfirm(
      '🗑️', 'Tüm Verileri Sil',
      'Tüm ürünler kalıcı olarak silinecek. Bu işlem geri alınamaz!',
      'Evet, Hepsini Sil', () => {
        localStorage.removeItem('laswell_products');
        loadProductList(); loadDashboard(); updateSidebarCount();
        showAdminToast('Tüm ürünler silindi.', 'success');
      }
    );
  });

  // Sidebar toggle (mobile)
  const toggleBtn = $('#sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.style.display = 'flex';
    toggleBtn.addEventListener('click', () => {
      $('#admin-sidebar').classList.toggle('mobile-open');
    });
  }

  // Custom color
  $('#add-custom-color-btn').addEventListener('click', () => {
    const val = $('#f-custom-color').value.trim();
    if (!val) return;
    addCustomChip('colors-chips', val, 'color', val);
    if (!adminState.selectedColors.includes(val)) adminState.selectedColors.push(val);
    $('#f-custom-color').value = '';
  });
}

// ── Chips ─────────────────────────────────────────────────────
function bindChips() {
  $('#sizes-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const val  = chip.dataset.size;
    chip.classList.toggle('selected');
    if (chip.classList.contains('selected')) {
      if (!adminState.selectedSizes.includes(val)) adminState.selectedSizes.push(val);
    } else {
      adminState.selectedSizes = adminState.selectedSizes.filter(s => s !== val);
    }
  });

  $('#colors-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const val  = chip.dataset.color;
    chip.classList.toggle('selected');
    if (chip.classList.contains('selected')) {
      if (!adminState.selectedColors.includes(val)) adminState.selectedColors.push(val);
    } else {
      adminState.selectedColors = adminState.selectedColors.filter(c => c !== val);
    }
  });
}

function addCustomChip(containerId, label, attr, value) {
  const container = $(`#${containerId}`);
  if (container.querySelector(`[data-${attr}="${value}"]`)) return;
  const chip = document.createElement('span');
  chip.className = 'chip selected';
  chip.dataset[attr] = value;
  chip.textContent   = label;
  container.appendChild(chip);
}

function resetChips() {
  $$('#sizes-chips .chip, #colors-chips .chip').forEach(c => c.classList.remove('selected'));
  adminState.selectedSizes  = [];
  adminState.selectedColors = [];
}

// ── Image Upload ──────────────────────────────────────────────
function bindImageUpload() {
  const area     = $('#img-upload-area');
  const fileInput = $('#f-image-file');

  area.addEventListener('click', () => fileInput.click());
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.style.borderColor = 'var(--accent)'; });
  area.addEventListener('dragleave', () => { area.style.borderColor = ''; });
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) readImageFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) readImageFile(fileInput.files[0]);
  });
}

function readImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    updateImagePreview(e.target.result);
    $('#f-image-url').value = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateImagePreview(src) {
  const preview     = $('#img-preview');
  const placeholder = $('#img-preview-placeholder');
  if (src) {
    preview.src = src;
    preview.classList.add('visible');
    if (placeholder) placeholder.style.display = 'none';
  } else {
    preview.classList.remove('visible');
    if (placeholder) placeholder.style.display = 'flex';
  }
}

// ── Product Form ──────────────────────────────────────────────
function resetForm(product = null) {
  $('#form-panel-title').textContent   = product ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle';
  $('#form-submit-btn').innerHTML      = product
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg> Değişiklikleri Kaydet`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ürünü Kaydet`;

  $('#edit-product-id').value = product?.id || '';
  $('#f-name').value          = product?.name || '';
  $('#f-desc').value          = product?.description || '';
  $('#f-cat').value           = product?.category || '';
  $('#f-price').value         = product?.price || '';
  $('#f-disc').value          = product?.discountPrice || '';
  $('#f-featured').checked    = product?.featured || false;
  $('#f-image-url').value     = product?.image || '';
  $('#f-custom-color').value  = '';

  resetChips();
  if (product?.sizes)  { product.sizes.forEach(s => { adminState.selectedSizes.push(s); const c = $(`#sizes-chips [data-size="${s}"]`); if (c) c.classList.add('selected'); }); }
  if (product?.colors) { product.colors.forEach(c => { adminState.selectedColors.push(c); const el = $(`#colors-chips [data-color="${c}"]`); if (el) el.classList.add('selected'); }); }

  updateImagePreview(product?.image || '');
}

function handleProductSubmit(e) {
  e.preventDefault();

  const name  = $('#f-name').value.trim();
  const price = parseFloat($('#f-price').value);
  const disc  = parseFloat($('#f-disc').value) || null;
  const cat   = $('#f-cat').value;

  if (!name || isNaN(price) || !cat) {
    showAdminToast('Lütfen zorunlu alanları doldurun.', 'error'); return;
  }
  if (adminState.selectedSizes.length === 0) {
    showAdminToast('En az bir beden seçin.', 'error'); return;
  }
  if (disc && disc >= price) {
    showAdminToast('İndirimli fiyat normal fiyattan düşük olmalı.', 'error'); return;
  }

  const productData = {
    name,
    description:   $('#f-desc').value.trim(),
    category:      cat,
    price,
    discountPrice: disc,
    sizes:         [...adminState.selectedSizes],
    colors:        [...adminState.selectedColors],
    image:         $('#f-image-url').value.trim() || '',
    featured:      $('#f-featured').checked,
  };

  const editId = $('#edit-product-id').value;
  if (editId) {
    LaswellDB.update(editId, productData);
    showAdminToast('Ürün güncellendi!', 'success');
    adminState.editingId = null;
  } else {
    LaswellDB.add(productData);
    showAdminToast('Ürün eklendi!', 'success');
  }

  updateSidebarCount();
  switchPanel('products');
}

function editProduct(id) {
  const product = LaswellDB.getById(id);
  if (!product) return;
  adminState.editingId = id;
  resetForm(product);
  switchPanel('add-product');
}

function deleteProduct(id) {
  const p = LaswellDB.getById(id);
  openConfirm(
    '🗑️', `Ürünü Sil`,
    `"${p?.name || 'Bu ürün'}" kalıcı olarak silinecek. Emin misiniz?`,
    'Evet, Sil', () => {
      LaswellDB.delete(id);
      updateSidebarCount();
      loadProductList();
      loadDashboard();
      showAdminToast('Ürün silindi.', 'success');
    }
  );
}

// ── Product List ──────────────────────────────────────────────
function loadProductList() {
  let products = LaswellDB.getAll();

  if (adminState.adminSearch) {
    products = products.filter(p =>
      p.name.toLowerCase().includes(adminState.adminSearch) ||
      p.category?.toLowerCase().includes(adminState.adminSearch)
    );
  }
  if (adminState.adminCatFilter) {
    products = products.filter(p => p.category === adminState.adminCatFilter);
  }

  // Type Filter
  if (adminState.adminTypeFilter === 'featured') {
    products = products.filter(p => p.featured);
  } else if (adminState.adminTypeFilter === 'discount') {
    products = products.filter(p => p.discountPrice);
  } else if (adminState.adminTypeFilter === 'expensive') {
    if (products.length > 0) {
      const maxPrice = products.reduce((max, p) => (p.price > max ? p.price : max), 0);
      products = products.filter(p => p.price === maxPrice);
    }
  }

  adminState.adminProducts = products;
  const tbody = $('#products-tbody');
  $('#product-list-count').textContent = `${products.length} ürün`;

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="table-empty">
          <div class="table-empty-icon">📦</div>
          <p>Henüz ürün yok. İlk ürünü ekleyin!</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const price    = p.discountPrice ?? p.price;
    const dateStr  = p.createdAt ? new Date(p.createdAt).toLocaleDateString('tr-TR') : '—';
    return `
      <tr>
        <td>
          <img class="table-product-img"
               src="${p.image || 'https://via.placeholder.com/48x60/111/333?text=IMG'}"
               alt="${p.name}" />
        </td>
        <td>
          <div class="table-product-name">${p.name}</div>
          <div class="table-product-id">${p.id}</div>
        </td>
        <td><span class="table-badge badge-cat">${p.category || '—'}</span></td>
        <td>
          <div class="price-current">₺${price.toLocaleString('tr-TR')}</div>
          ${p.discountPrice ? `<div class="price-original">₺${p.price.toLocaleString('tr-TR')}</div>` : ''}
        </td>
        <td style="font-size:0.82rem;color:var(--text-2);">${(p.sizes || []).join(', ') || '—'}</td>
        <td>
          <span class="table-badge ${p.featured ? 'badge-feat' : 'badge-no'}">
            ${p.featured ? 'Öne Çıkan' : 'Normal'}
          </span>
        </td>
        <td style="font-size:0.8rem;color:var(--text-3);">${dateStr}</td>
        <td>
          <div class="table-actions">
            <button class="tbl-btn tbl-btn-edit" onclick="editProduct('${p.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Düzenle
            </button>
            <button class="tbl-btn tbl-btn-delete" onclick="deleteProduct('${p.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Sil
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Dashboard ─────────────────────────────────────────────────
function loadDashboard() {
  const all      = LaswellDB.getAll();
  const featured = all.filter(p => p.featured).length;
  const discount = all.filter(p => p.discountPrice).length;
  const cats     = new Set(all.map(p => p.category).filter(Boolean)).size;

  // Advanced Stats Calculations
  const totalValue = all.reduce((sum, p) => sum + (p.discountPrice ?? p.price), 0);
  let mostExpensive = null;
  if (all.length > 0) {
    mostExpensive = all.reduce((max, p) => (p.price > (max?.price ?? 0) ? p : max), null);
  }

  $('#stat-total').textContent    = all.length;
  $('#stat-featured').innerHTML   = `<span>${featured}</span>`;
  $('#stat-discount').innerHTML   = `<span>${discount}</span>`;
  $('#stat-cats').textContent     = cats;

  $('#stat-total-val').textContent = `₺${totalValue.toLocaleString('tr-TR')}`;
  if (mostExpensive) {
    $('#stat-expensive-val').textContent = mostExpensive.name;
    $('#stat-expensive-sub').textContent = `₺${mostExpensive.price.toLocaleString('tr-TR')} (En Pahalı)`;
  } else {
    $('#stat-expensive-val').textContent = '—';
    $('#stat-expensive-sub').textContent = 'En yüksek fiyatlı';
  }

  const recent = all.slice(0, 5);
  const tbody  = $('#dashboard-recent-tbody');
  tbody.innerHTML = recent.length === 0
    ? `<tr><td colspan="5"><div class="table-empty"><div class="table-empty-icon">📦</div><p>Henüz ürün yok.</p></div></td></tr>`
    : recent.map(p => {
        const price = p.discountPrice ?? p.price;
        return `
          <tr>
            <td>
              <img class="table-product-img" src="${p.image || ''}" alt="${p.name}" />
            </td>
            <td>
              <div class="table-product-name">${p.name}</div>
              <div class="table-product-id">${p.id}</div>
            </td>
            <td><span class="table-badge badge-cat">${p.category || '—'}</span></td>
            <td><div class="price-current">₺${price.toLocaleString('tr-TR')}</div></td>
            <td><span class="table-badge ${p.featured ? 'badge-feat' : 'badge-no'}">${p.featured ? 'Öne Çıkan' : 'Normal'}</span></td>
            <td>
              <div class="table-actions">
                <button class="tbl-btn tbl-btn-edit" onclick="editProduct('${p.id}')">Düzenle</button>
              </div>
            </td>
          </tr>`;
      }).join('');
}

function updateSidebarCount() {
  const count = LaswellDB.getAll().length;
  $('#sidebar-product-count').textContent = count;
}

// ── Confirm Modal ─────────────────────────────────────────────
function bindConfirmModal() {
  $('#confirm-cancel').addEventListener('click', closeConfirm);
  $('#confirm-modal .confirm-backdrop').addEventListener('click', closeConfirm);
  $('#confirm-ok').addEventListener('click', () => {
    if (adminState.confirmCallback) adminState.confirmCallback();
    closeConfirm();
  });
}
function openConfirm(icon, title, msg, okLabel, callback) {
  $('#confirm-icon').textContent  = icon;
  $('#confirm-title').textContent = title;
  $('#confirm-msg').textContent   = msg;
  $('#confirm-ok').textContent    = okLabel;
  adminState.confirmCallback      = callback;
  $('#confirm-modal').classList.add('open');
}
function closeConfirm() {
  $('#confirm-modal').classList.remove('open');
  adminState.confirmCallback = null;
}

// ── Toast ─────────────────────────────────────────────────────
function showAdminToast(message, type = 'success') {
  const container = $('#admin-toast-container');
  const toast     = document.createElement('div');
  toast.className = `admin-toast admin-toast-${type}`;
  toast.innerHTML = `
    <span style="font-size:1rem">${type === 'success' ? '✓' : '✕'}</span>
    <span class="admin-toast-msg">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}
