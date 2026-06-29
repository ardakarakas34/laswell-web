'use strict';

const LASWELL_DB_KEY    = 'laswell_products';
const LASWELL_AUTH_KEY  = 'laswell_admin_auth';
const LASWELL_OTP_KEY   = 'laswell_admin_otp';
const ADMIN_PASSWORD    = 'laswell2024';

const LaswellDB = {

  /* ── Auth ─────────────────────────────────────── */
  isAuthenticated: () => sessionStorage.getItem(LASWELL_AUTH_KEY) === 'true',

  checkPassword(password) {
    return password === ADMIN_PASSWORD;
  },

  _hashOtp(code) {
    let h = 0;
    for (let i = 0; i < code.length; i++) {
      h = ((h << 5) - h) + code.charCodeAt(i) | 0;
    }
    return String(h);
  },

  generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
  },

  storeOTP(code) {
    const minutes = (typeof LASWELL_CONFIG !== 'undefined' && LASWELL_CONFIG.otpExpiryMinutes) || 10;
    sessionStorage.setItem(LASWELL_OTP_KEY, JSON.stringify({
      hash:    this._hashOtp(code),
      expiry:  Date.now() + minutes * 60 * 1000,
      attempts: 0,
    }));
  },

  verifyOTP(input) {
    const raw = sessionStorage.getItem(LASWELL_OTP_KEY);
    if (!raw) return { ok: false, reason: 'expired' };

    const data = JSON.parse(raw);
    if (Date.now() > data.expiry) {
      sessionStorage.removeItem(LASWELL_OTP_KEY);
      return { ok: false, reason: 'expired' };
    }

    const maxAttempts = (typeof LASWELL_CONFIG !== 'undefined' && LASWELL_CONFIG.maxOtpAttempts) || 5;
    if (data.attempts >= maxAttempts) {
      sessionStorage.removeItem(LASWELL_OTP_KEY);
      return { ok: false, reason: 'locked' };
    }

    if (this._hashOtp(input.trim()) !== data.hash) {
      data.attempts += 1;
      sessionStorage.setItem(LASWELL_OTP_KEY, JSON.stringify(data));
      return { ok: false, reason: 'invalid', remaining: maxAttempts - data.attempts };
    }

    sessionStorage.removeItem(LASWELL_OTP_KEY);
    sessionStorage.setItem(LASWELL_AUTH_KEY, 'true');
    return { ok: true };
  },

  clearOTP() {
    sessionStorage.removeItem(LASWELL_OTP_KEY);
  },

  completeLogin() {
    sessionStorage.setItem(LASWELL_AUTH_KEY, 'true');
  },

  logout() {
    sessionStorage.removeItem(LASWELL_AUTH_KEY);
    sessionStorage.removeItem(LASWELL_OTP_KEY);
  },

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
