'use strict';

/* ============================================================
   LASWELL — Storefront App Logic
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
const state = {
  products:       [],
  filtered:       [],
  activeCategory: 'Tümü',
  activeSize:     null,
  sortBy:         'newest',
  searchQuery:    '',
  currentProduct: null,
  selectedSize:   null,
  selectedColor:  null,
};

// ── DOM Refs ──────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const loader         = $('#page-loader');
const navbar         = $('#navbar');
const searchInput    = $('#search-input');
const searchClear    = $('#search-clear');
const sortSelect     = $('#sort-select');
const productsGrid   = $('#products-grid');
const resultsCount   = $('#results-count');
const featuredTrack  = $('#featured-track');
const featuredScroll = $('#featured-scroll');
const heroTitle      = $('#hero-title');
const productModal   = $('#product-modal');
const modalScrollBox = $('#modal-scroll-box');
const toastContainer = $('#toast-container');

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  LaswellDB.seed();
  state.products = LaswellDB.getAll();

  animateHeroLetters();
  applyFilters();
  renderFeatured();
  bindFeaturedCarousel();
  bindEvents();
  initScrollObserver();
  initNavbarScroll();

  // Hide loader
  setTimeout(() => loader.classList.add('hidden'), 900);
});

// ── Hero Letter Float ─────────────────────────────────────────
function animateHeroLetters() {
  if (!heroTitle) return;
  const text = heroTitle.textContent;
  heroTitle.innerHTML = [...text].map((ch, i) => {
    if (ch === ' ') return '<span>&nbsp;</span>';
    const dur   = (2.8 + i * 0.2).toFixed(1) + 's';
    const delay = (i * 0.15).toFixed(2) + 's';
    return `<span class="floating-letter" style="--float-dur:${dur};--float-delay:${delay}">${ch}</span>`;
  }).join('');
}

// ── Navbar Scroll ─────────────────────────────────────────────
function initNavbarScroll() {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// ── Scroll Observer ───────────────────────────────────────────
function initScrollObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  $$('.reveal').forEach(el => observer.observe(el));
  // Cards observed after render in renderProducts()
}

// ── Filter Logic ──────────────────────────────────────────────
function applyFilters() {
  let result = [...state.products];

  // Search — kelime/harf bazlı, Türkçe karakter duyarsız
  if (state.searchQuery) {
    result = result.filter(p => productMatchesQuery(p, state.searchQuery));
  }

  // Category
  if (state.activeCategory && state.activeCategory !== 'Tümü') {
    result = result.filter(p => p.category === state.activeCategory);
  }

  // Size
  if (state.activeSize) {
    result = result.filter(p => p.sizes?.includes(state.activeSize));
  }

  // Sort
  switch (state.sortBy) {
    case 'price-asc':
      result.sort((a, b) => effectivePrice(a) - effectivePrice(b)); break;
    case 'price-desc':
      result.sort((a, b) => effectivePrice(b) - effectivePrice(a)); break;
    case 'featured':
      result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); break;
    case 'discount':
      result = result.filter(p => p.discountPrice).concat(result.filter(p => !p.discountPrice));
      break;
    default: // newest
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  state.filtered = result;
  renderProducts();
}

function effectivePrice(p) {
  return p.discountPrice ?? p.price;
}

// ── Arama Yardımcıları ────────────────────────────────────────
// Türkçe karakterleri ve aksanları sadeleştirir (tişört → tisort)
function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}

// Yazılan her kelime/harf grubunun ürünle eşleşmesini arar (AND mantığı)
function productMatchesQuery(p, query) {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeText(`${p.name} ${p.category || ''} ${p.description || ''}`);
  return tokens.every(t => haystack.includes(t));
}

// ── Render Products ───────────────────────────────────────────
function renderProducts() {
  productsGrid.innerHTML = '';
  resultsCount.textContent = state.filtered.length;

  if (state.filtered.length === 0) {
    productsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>Ürün bulunamadı</h3>
        <p>Farklı bir arama terimi veya filtre deneyin.</p>
      </div>`;
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in-view'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });

  state.filtered.forEach((product, idx) => {
    const card = createProductCard(product, idx);
    productsGrid.appendChild(card);
    observer.observe(card);
  });
}

function createProductCard(product, idx) {
  const discount   = product.discountPrice && product.price > product.discountPrice;
  const pct        = discount ? Math.round((1 - product.discountPrice / product.price) * 100) : 0;
  const price      = effectivePrice(product);
  const delay      = Math.min(idx * 60, 400);

  const card       = document.createElement('div');
  card.className   = 'product-card';
  card.style.transitionDelay = delay + 'ms';
  card.dataset.id  = product.id;

  card.innerHTML = `
    <div class="card-img">
      <img src="${product.image || 'https://via.placeholder.com/400x533/111/333?text=LASWELL'}"
           alt="${product.name}" loading="lazy" />
    </div>
    <div class="card-overlay"></div>
    <div class="card-overlay-hover"></div>
    <div class="card-badges">
      ${product.featured ? '<span class="card-badge badge-featured">Öne Çıkan</span>' : ''}
      ${discount ? `<span class="card-badge badge-discount">-%${pct}</span>` : ''}
    </div>
    <div class="card-info">
      <p class="card-category">${product.category || ''}</p>
      <h3 class="card-name">${product.name}</h3>
      <div class="card-price">
        <span class="card-price-current">₺${price.toLocaleString('tr-TR')}</span>
        ${discount ? `<span class="card-price-original">₺${product.price.toLocaleString('tr-TR')}</span>` : ''}
      </div>
    </div>
    <div class="card-hover-actions">
      <button class="btn-primary card-detail-btn" style="flex: 1; justify-content: center;">
        İncele
      </button>
      <a href="https://www.shopier.com/s/notfound/1041" target="_blank" rel="noopener noreferrer" class="btn-icon card-quick-buy" aria-label="Satın al" style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>
        </svg>
      </a>
    </div>`;

  card.querySelector('.card-detail-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(product.id);
  });
  card.addEventListener('click', () => openModal(product.id));

  return card;
}

// ── Featured Strip ────────────────────────────────────────────
const featuredAuto = { rafId: null, pauseUntil: 0, autoScrolling: false, speed: 0.55 };

function renderFeatured() {
  const featured = state.products.filter(p => p.featured);
  if (featured.length === 0) {
    $('#featured-section').style.display = 'none';
    stopFeaturedAuto();
    return;
  }
  $('#featured-section').style.display = '';

  const items = featured.length > 1 ? [...featured, ...featured] : featured;

  featuredTrack.innerHTML = items.map(p => {
    const price = effectivePrice(p);
    return `
      <div class="featured-card" data-id="${p.id}">
        <div class="card-img">
          <img src="${p.image || ''}" alt="${p.name}" loading="lazy" draggable="false" />
        </div>
        <div class="featured-card-overlay"></div>
        <div class="featured-card-info">
          <div class="featured-card-name">${p.name}</div>
          <div class="featured-card-price">₺${price.toLocaleString('tr-TR')}</div>
        </div>
      </div>`;
  }).join('');

  featuredTrack.querySelectorAll('.featured-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });

  if (featuredScroll) featuredScroll.scrollLeft = 0;
  startFeaturedAuto();
}

function featuredAutoTick() {
  featuredAuto.rafId = requestAnimationFrame(featuredAutoTick);
  if (!featuredScroll || Date.now() < featuredAuto.pauseUntil) return;

  const half = featuredScroll.scrollWidth / 2;
  if (half <= featuredScroll.clientWidth + 4) return;

  featuredAuto.autoScrolling = true;
  let next = featuredScroll.scrollLeft + featuredAuto.speed;
  if (next >= half) next -= half;
  featuredScroll.scrollLeft = next;
  featuredAuto.autoScrolling = false;
}

function pauseFeaturedAuto(ms = 5000) {
  featuredAuto.pauseUntil = Date.now() + ms;
}

function startFeaturedAuto() {
  stopFeaturedAuto();
  featuredAuto.rafId = requestAnimationFrame(featuredAutoTick);
}

function stopFeaturedAuto() {
  if (featuredAuto.rafId) cancelAnimationFrame(featuredAuto.rafId);
  featuredAuto.rafId = null;
}

function bindFeaturedCarousel() {
  const prev = $('#featured-prev');
  const next = $('#featured-next');
  if (!featuredScroll || !prev || !next) return;

  const scrollByCard = (dir) => {
    const card = featuredTrack.querySelector('.featured-card');
    if (!card) return;
    const gap  = parseFloat(getComputedStyle(featuredTrack).gap) || 12;
    featuredScroll.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: 'smooth' });
  };

  prev.addEventListener('click', () => { pauseFeaturedAuto(); scrollByCard(-1); });
  next.addEventListener('click', () => { pauseFeaturedAuto(); scrollByCard(1); });

  featuredScroll.addEventListener('touchstart', () => pauseFeaturedAuto(6000), { passive: true });
  featuredScroll.addEventListener('pointerdown', () => pauseFeaturedAuto(6000), { passive: true });
  featuredScroll.addEventListener('scroll', () => {
    if (!featuredAuto.autoScrolling) pauseFeaturedAuto(5000);
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderFeatured, 200);
  });

  startFeaturedAuto();
}

function resetModalScroll() {
  if (modalScrollBox) modalScrollBox.scrollTop = 0;
}

// ── Product Modal ─────────────────────────────────────────────
function openModal(productId) {
  const product = LaswellDB.getById(productId) || state.products.find(p => p.id === productId);
  if (!product) return;

  state.currentProduct = product;
  state.selectedSize   = product.sizes?.[0] || null;
  state.selectedColor  = product.colors?.[0] || null;

  const discount = product.discountPrice && product.price > product.discountPrice;
  const price    = effectivePrice(product);
  const save     = discount ? product.price - product.discountPrice : 0;

  $('#modal-img').src              = product.image || '';
  $('#modal-img').alt              = product.name;
  $('#modal-category').textContent = product.category || '';
  $('#modal-product-name').textContent = product.name;
  $('#modal-price').textContent    = `₺${price.toLocaleString('tr-TR')}`;
  $('#modal-original-price').textContent = discount ? `₺${product.price.toLocaleString('tr-TR')}` : '';
  $('#modal-save').textContent     = discount ? `₺${save.toLocaleString('tr-TR')} tasarruf` : '';
  $('#modal-desc').textContent     = product.description || '';

  // Sizes
  const sizesEl = $('#modal-sizes');
  sizesEl.innerHTML = (product.sizes || []).map(s =>
    `<button class="size-btn${s === state.selectedSize ? ' selected' : ''}" data-size="${s}">${s}</button>`
  ).join('');
  $('#selected-size-label').textContent = state.selectedSize || '—';
  sizesEl.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedSize = btn.dataset.size;
      sizesEl.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      $('#selected-size-label').textContent = state.selectedSize;
    });
  });

  // Colors
  const colorsEl = $('#modal-colors');
  colorsEl.innerHTML = (product.colors || []).map(c =>
    `<button class="color-btn${c === state.selectedColor ? ' selected' : ''}" data-color="${c}">${c}</button>`
  ).join('');
  $('#selected-color-label').textContent = state.selectedColor || '—';
  colorsEl.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedColor = btn.dataset.color;
      colorsEl.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      $('#selected-color-label').textContent = state.selectedColor;
    });
  });

  resetModalScroll();
  productModal.classList.add('open');
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  productModal.classList.remove('open');
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  resetModalScroll();
  state.currentProduct = null;
}



// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
    <span class="toast-message">${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

// ── Search Suggestions ────────────────────────────────────────
const suggestionsEl = $('#search-suggestions');

function updateSuggestions(query) {
  if (!suggestionsEl) return;
  const trimmed = query.trim();
  if (!trimmed) {
    suggestionsEl.innerHTML = '';
    suggestionsEl.classList.remove('active');
    return;
  }

  const matches = state.products
    .filter(p => productMatchesQuery(p, trimmed))
    .slice(0, 5);

  if (matches.length === 0) {
    suggestionsEl.innerHTML = '<div class="suggestion-empty">Eşleşen ürün bulunamadı.</div>';
  } else {
    suggestionsEl.innerHTML = matches.map(p => {
      const price = p.discountPrice ?? p.price;
      return `
        <div class="suggestion-item" data-id="${p.id}">
          <img class="suggestion-img" src="${p.image || ''}" alt="${p.name}" />
          <div class="suggestion-info">
            <div class="suggestion-name">${p.name}</div>
            <div class="suggestion-cat">${p.category || ''}</div>
          </div>
          <div class="suggestion-price">₺${price.toLocaleString('tr-TR')}</div>
        </div>
      `;
    }).join('');

    suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const matchedProduct = state.products.find(p => p.id === id);
        if (matchedProduct) {
          searchInput.value = matchedProduct.name;
          state.searchQuery = matchedProduct.name;
          applyFilters();
          openModal(id);
        }
        suggestionsEl.classList.remove('active');
      });
    });
  }

  suggestionsEl.classList.add('active');
}

// ── Event Bindings ────────────────────────────────────────────
function bindEvents() {
  // Search
  let searchTimeout;

  const triggerSearchSubmit = () => {
    clearTimeout(searchTimeout);
    state.searchQuery = searchInput.value.trim();
    searchClear.classList.toggle('visible', state.searchQuery.length > 0);
    applyFilters();
    if (suggestionsEl) suggestionsEl.classList.remove('active');
    
    // Scroll to products
    const target = $('#products');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  const searchBtn = $('#search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      triggerSearchSubmit();
      searchInput.focus();
    });
  }

  searchInput.addEventListener('input', () => {
    const val = searchInput.value;
    state.searchQuery = val.trim();
    searchClear.classList.toggle('visible', state.searchQuery.length > 0);
    updateSuggestions(val);
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 150); // faster live filtering
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      triggerSearchSubmit();
    }
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length > 0) {
      updateSuggestions(searchInput.value);
    }
  });

  document.addEventListener('click', (e) => {
    if (suggestionsEl && !e.target.closest('.nav-search')) {
      suggestionsEl.classList.remove('active');
    }
  });

  searchClear.addEventListener('click', () => {
    searchInput.value  = '';
    state.searchQuery  = '';
    searchClear.classList.remove('visible');
    if (suggestionsEl) {
      suggestionsEl.innerHTML = '';
      suggestionsEl.classList.remove('active');
    }
    applyFilters();
    searchInput.focus();
  });

  // Filters
  $$('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      const value  = btn.dataset.value;

      if (filter === 'category') {
        $$('[data-filter="category"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeCategory = value;
      } else if (filter === 'size') {
        if (state.activeSize === value) {
          btn.classList.remove('active');
          state.activeSize = null;
        } else {
          $$('[data-filter="size"]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.activeSize = value;
        }
      }
      applyFilters();
    });
  });

  // Footer koleksiyon linkleri — kategoriye göre filtrele
  $$('.footer-cat-link').forEach(link => {
    link.addEventListener('click', () => {
      const value = link.dataset.category;
      const pill  = document.querySelector(`[data-filter="category"][data-value="${value}"]`);
      if (pill) {
        pill.click();
      } else {
        state.activeCategory = value;
        applyFilters();
      }
    });
  });

  // Sort
  sortSelect.addEventListener('change', () => {
    state.sortBy = sortSelect.value;
    applyFilters();
  });

  // Modal close
  $('#modal-close-btn').addEventListener('click', closeModal);
  $('#modal-backdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}
