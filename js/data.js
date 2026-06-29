'use strict';

const LASWELL_DB_KEY   = 'laswell_products';
const LASWELL_AUTH_KEY = 'laswell_admin_auth';
const LASWELL_LOCK_KEY = 'laswell_admin_lock';

/* Şifre kaynak kodda açık görünmesin diye Base64 ile gizlendi.
   Şifreyi değiştirmek için yeni şifrenin Base64 karşılığını buraya yaz.
   (Gerçek güvenlik için ayrıca Vercel env variable + middleware önerilir.) */
const ADMIN_PASSWORD_ENC = 'bGFzd2VsbDIwMjQ='; // base64("laswell2024")

const LASWELL_SESSION_TTL = 30 * 60 * 1000; // 30 dk oturum süresi
const LASWELL_MAX_ATTEMPTS = 5;             // izin verilen yanlış deneme
const LASWELL_LOCK_MS = 5 * 60 * 1000;      // kilit süresi (5 dk)

const LaswellDB = {

  /* ── Auth ─────────────────────────────────────── */
  isAuthenticated() {
    const raw = sessionStorage.getItem(LASWELL_AUTH_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data.ok) return false;
      if (Date.now() > data.exp) {
        sessionStorage.removeItem(LASWELL_AUTH_KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  _getLock() {
    try { return JSON.parse(localStorage.getItem(LASWELL_LOCK_KEY)) || {}; }
    catch { return {}; }
  },
  isLocked() {
    const l = this._getLock();
    return !!(l.until && Date.now() < l.until);
  },
  lockRemainingMin() {
    const l = this._getLock();
    return Math.max(1, Math.ceil(((l.until || 0) - Date.now()) / 60000));
  },
  _recordFail() {
    const l = this._getLock();
    l.fails = (l.fails || 0) + 1;
    if (l.fails >= LASWELL_MAX_ATTEMPTS) {
      l.until = Date.now() + LASWELL_LOCK_MS;
      l.fails = 0;
    }
    localStorage.setItem(LASWELL_LOCK_KEY, JSON.stringify(l));
    return l;
  },
  _clearLock() {
    localStorage.removeItem(LASWELL_LOCK_KEY);
  },

  login(password) {
    if (this.isLocked()) {
      return { ok: false, locked: true, remainingMin: this.lockRemainingMin() };
    }

    let expected = '';
    try { expected = atob(ADMIN_PASSWORD_ENC); } catch { expected = ''; }

    if (expected && password === expected) {
      this._clearLock();
      sessionStorage.setItem(LASWELL_AUTH_KEY, JSON.stringify({
        ok:  true,
        exp: Date.now() + LASWELL_SESSION_TTL,
      }));
      return { ok: true };
    }

    const l = this._recordFail();
    if (l.until && Date.now() < l.until) {
      return { ok: false, locked: true, remainingMin: this.lockRemainingMin() };
    }
    return { ok: false, attemptsLeft: Math.max(0, LASWELL_MAX_ATTEMPTS - (l.fails || 0)) };
  },

  refreshSession() {
    const raw = sessionStorage.getItem(LASWELL_AUTH_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.ok) {
        data.exp = Date.now() + LASWELL_SESSION_TTL;
        sessionStorage.setItem(LASWELL_AUTH_KEY, JSON.stringify(data));
      }
    } catch { /* yoksay */ }
  },

  logout: () => sessionStorage.removeItem(LASWELL_AUTH_KEY),

  /* ── Helpers ───────────────────────────────────── */
  _save(products) {
    localStorage.setItem(LASWELL_DB_KEY, JSON.stringify(products));
  },

  /* ── Read ──────────────────────────────────────── */
  getAll() {
    try {
      const raw = localStorage.getItem(LASWELL_DB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  getById: (id) => LaswellDB.getAll().find(p => p.id === id) || null,

  /* ── Create ────────────────────────────────────── */
  add(product) {
    const products   = this.getAll();
    const now        = new Date().toISOString();
    const newProduct = { ...product, id: `lsw_${Date.now()}`, createdAt: now, updatedAt: now };
    products.unshift(newProduct);
    this._save(products);
    return newProduct;
  },

  /* ── Update ────────────────────────────────────── */
  update(id, updates) {
    const products = this.getAll();
    const idx      = products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    products[idx]  = { ...products[idx], ...updates, updatedAt: new Date().toISOString() };
    this._save(products);
    return products[idx];
  },

  /* ── Delete ────────────────────────────────────── */
  delete(id) {
    this._save(this.getAll().filter(p => p.id !== id));
  },

  /* ── Import / Export ───────────────────────────── */
  exportJSON: () => JSON.stringify(LaswellDB.getAll(), null, 2),

  importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) return false;
      this._save(data);
      return true;
    } catch { return false; }
  },

  /* ── Seed demo data ────────────────────────────── */
  seed() {
    if (this.getAll().length > 0) return;
    const now = new Date().toISOString();
    const mk  = (id, name, desc, price, disc, cat, sizes, colors, img, featured) =>
      ({ id, name, description: desc, price, discountPrice: disc, category: cat,
         sizes, colors, image: img, featured, createdAt: now, updatedAt: now });

    this._save([
      mk('lsw_d1','Shadow Oversize Hoodie',
        'Ultra-premium ağır pamuklu oversize hoodie. Gizli yan cepler ve reflektif Laswell logolu detay. Kasıtlı olarak büyük kalıplandı.',
        1299,999,'Üst Giyim',['S','M','L','XL','XXL'],['Siyah','Antrasit'],
        'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80',true),

      mk('lsw_d2','Techwear Kargo Pantolon',
        'Çok cepli techwear kargo pantolon. Fermuarlı detaylar ve ayarlanabilir paça bağları.',
        1599,null,'Alt Giyim',['S','M','L','XL'],['Siyah','Haki'],
        'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&q=80',true),

      mk('lsw_d3','Void Coach Ceket',
        'Hafif ve dayanıklı coach ceket. İç cep, özel baskı Laswell branding ve premium fermuar detayları.',
        2199,1799,'Dış Giyim',['M','L','XL'],['Siyah'],
        'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80',true),

      mk('lsw_d4','Core Logo Tişört',
        'Minimal Laswell core logo baskılı premium pamuklu tişört. Oversize fit, ağır kumaş.',
        599,null,'Üst Giyim',['XS','S','M','L','XL','XXL'],['Siyah','Beyaz','Gri'],
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',false),

      mk('lsw_d5','Anti-Grav Bomber',
        'Saten yüzeyli premium bomber ceket. Kontrast dikişler ve özel Laswell patch detayı.',
        2799,2499,'Dış Giyim',['S','M','L','XL'],['Siyah','Koyu Yeşil'],
        'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80',true),

      mk('lsw_d6','Utility Kemer Çantası',
        'Premium techwear aksesuar. Ayarlanabilir kemer, su geçirmez materyal ve çoklu bölme.',
        699,null,'Aksesuar',['Tek Ebat'],['Siyah'],
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',false),

      mk('lsw_d7','Drift Sweatshirt',
        'Ağır French terry kumaştan yapılmış oversize sweatshirt. Ribana kol ve etek uçları.',
        849,699,'Üst Giyim',['S','M','L','XL'],['Gri','Siyah'],
        'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=600&q=80',false),

      mk('lsw_d8','Phase Şapka',
        'Yapılandırılmış 6 panel şapka. İşleme Laswell logo detayı, ayarlanabilir klips.',
        399,null,'Aksesuar',['Tek Ebat'],['Siyah','Beyaz'],
        'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&q=80',false),
    ]);
  }
};
