/* Legenda sayti: intro (bulutlar → vodiy) → filial tanlash → skroll bilan do'konga kirish → katalog.
 *
 * Higgsfield kliplari tayyor bo'lsa (assets/video/...), sayt o'zi ularni ishlatadi;
 * bo'lmasa — haqiqiy filial rasmlaridan yasalgan vaqtinchalik animatsiya ko'rsatiladi.
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const som = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const ap = s => String(s).replace(/'/g, '’');
  const esc = s => ap(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tel = s => 'tel:' + s.replace(/[^\d+]/g, '');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Vodiy kadri 1600x900. pin — chizilgan xaritadagi joy; vpin — Higgsfield intro videosining oxirgi kadridagi shahar;
  // side — o'sha kadrda qaysi tomonga sho'ng'ish (% eni).
  const STORES = {
    shahrixon: {
      city: 'Shahrixon', title: 'Legenda Premium', pin: [330, 600], vpin: [200, 545], side: 12,
      street: "Hamza ko'chasi", address: "Shahrixon sh., Hamza ko'chasi", landmark: "2-maktab oldida",
      phones: ['+998 93 372 88 55'], hours: null,
      insta: 'legenda_shahrixon', tg: 'https://t.me/Legenda_Premium1',
      day: 'assets/filial/shahrixon_kun.jpg', night: null, inside: 'assets/filial/shahrixon_ichkari.jpg',
      thumb: 'assets/filial/shahrixon_kun.jpg', door: [50, 58],
    },
    asaka: {
      city: 'Asaka', title: 'Legenda Premium', pin: [800, 680], vpin: [800, 600], side: 50,
      street: "Sharq to'yxonasi, 1-qavat", address: "Asaka sh., Imom Buxoriy ko'chasi", landmark: "Sharq to'yxonasi, 1-qavat",
      phones: ['+998 50 117 11 55'], hours: null,
      insta: 'legenda_premium_asaka', tg: null,
      // Asakadan faqat kechki vitrina rasmi bor — kunduzgi ko'rinish shu rasmdan filtr bilan olinadi
      day: 'assets/filial/asaka_tun.jpg', dayify: true, night: null, inside: 'assets/filial/asaka_ichkari.jpg',
      thumb: 'assets/filial/asaka_resepshn.jpg', door: [48, 52],
    },
    andijon: {
      city: 'Andijon', title: 'Legenda Andijon', pin: [1270, 560], vpin: [1430, 505], side: 89,
      street: "Furqat ko'chasi, 136-uy", address: "Andijon sh., Furqat ko'chasi 136-uy", landmark: "Oq laylak to'yxonasi oldida",
      phones: ['+998 88 480 71 71', '+998 93 100 78 13'], hours: 'har kuni 08:00 – 02:00',
      insta: 'legenda_andijon', tg: 'https://t.me/LEGENDA_AND1',
      day: 'assets/filial/andijon_kun.jpg', night: 'assets/filial/andijon_tun.jpg', inside: 'assets/filial/andijon_ichkari.jpg',
      thumb: 'assets/filial/andijon_tun.jpg', door: [50, 60],
    },
  };
  const ORDER = ['shahrixon', 'asaka', 'andijon']; // xaritada chapdan o'ngga (g'arbdan sharqqa)
  const CAT = { "Ko'ylak": "Ko'ylak", 'Oyoq kiyim': 'Oyoq kiyim', Komplekt: 'Tayyor look', Kurtka: 'Kurtka', Kostyum: 'Kostyum', Kardigan: 'Kardigan', Jilet: 'Jilet' };
  const PRODUCTS = window.LEGENDA_PRODUCTS || [];

  /* ---------- Vodiy xaritasi (intro.mp4 bo'lmaguncha) ---------- */

  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MAP_SVG = (() => {
    const r = rng(20261031), H0 = 250, f = n => n.toFixed(1);
    const pick = a => a[Math.floor(r() * a.length)];
    const depth = y => clamp((y - H0) / (900 - H0)); // ufqda 0, pastda 1
    let s = '';

    // tog'lar (ufqda)
    const ridge = (base, amp, seed, fill) => {
      const q = rng(seed); let d = `M0 ${H0 + 40} `;
      const ph = [q() * 6, q() * 6, q() * 6];
      for (let x = 0; x <= 1600; x += 16) {
        const y = base - amp * (0.55 + 0.25 * Math.sin(x / 140 + ph[0]) + 0.15 * Math.sin(x / 47 + ph[1]) + 0.08 * Math.sin(x / 19 + ph[2]));
        d += `L${x} ${f(y)} `;
      }
      return `<path d="${d}L1600 ${H0 + 40} Z" fill="${fill}"/>`;
    };
    s += ridge(232, 150, 3, 'url(#gSnow)') + ridge(246, 80, 9, '#97a8b0') + ridge(258, 34, 13, '#8c9f88');

    // dalalar — yer tekisligi perspektivasi: chetlari ufqdagi bitta nuqtaga yig'iladi
    const FIELD = ['#86a96a', '#9bb878', '#7a9d5e', '#a9c287', '#b8c48f', '#cbc89c', '#8fae6f', '#6f9356', '#b3b98a', '#9fb27a', '#c4b98c', '#7e9f63'];
    for (let y = 900; y > H0 + 34;) {
      const k = depth(y), h = Math.min(y - H0 - 26, lerp(7, 66, k) * (0.7 + r() * 0.6)), yt = y - h;
      const ratio = (yt - H0) / (y - H0), proj = x => 800 + (x - 800) * ratio;
      const reach = 900 / ratio;
      for (let x = 800 - reach - 40; x < 800 + reach + 40;) {
        const w = lerp(26, 170, k) * (0.5 + r() * 1.0), x2 = x + w, gap = lerp(0.6, 3.2, k);
        if (x2 > -60 && x < 1660 || proj(x2) > -60 && proj(x) < 1660) {
          s += `<polygon points="${f(x)},${f(y)} ${f(x2)},${f(y)} ${f(proj(x2))},${f(yt)} ${f(proj(x))},${f(yt)}" fill="${pick(FIELD)}" opacity="${(0.6 + r() * 0.4).toFixed(2)}"/>`;
          // yaqindagi katta dalalarda ekin qatorlari
          if (k > 0.55 && r() < 0.3) for (let q = 1; q < 6; q++) {
            const xa = x + (w * q) / 6;
            s += `<line x1="${f(xa)}" y1="${f(y)}" x2="${f(proj(xa))}" y2="${f(yt)}" stroke="#f3f0d8" stroke-width=".8" opacity=".25"/>`;
          }
        }
        x = x2 + gap;
      }
      // daraxt qatorlari (terak)
      if (r() < 0.45) {
        const xa = r() * 1600, xb = xa + (r() < .5 ? -1 : 1) * lerp(200, 700, r());
        s += `<line x1="${f(xa)}" y1="${f(y)}" x2="${f(xb)}" y2="${f(y)}" stroke="#3f5f33" stroke-width="${f(lerp(1, 5, k))}" stroke-linecap="round" opacity=".7"/>`;
      }
      y = yt - lerp(0.6, 3.2, k);
    }

    // bulut soyalari
    for (let i = 0; i < 7; i++) s += `<ellipse cx="${f(r() * 1600)}" cy="${f(380 + r() * 520)}" rx="${f(140 + r() * 220)}" ry="${f(50 + r() * 80)}" fill="url(#gShade)"/>`;

    // daryo
    let rv = '';
    for (let x = -30; x <= 1640; x += 20) rv += `${x === -30 ? 'M' : 'L'}${x} ${f(800 + 36 * Math.sin(x / 190) + 15 * Math.sin(x / 57 + 1.3) - (x / 1600) * 120)} `;
    s += `<path d="${rv}" fill="none" stroke="#6f97a6" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`;
    s += `<path d="${rv}" fill="none" stroke="#b7d4dd" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;

    // yo'llar
    const P = Object.fromEntries(ORDER.map(k => [k, STORES[k].pin]));
    const road = d => `<path d="${d}" fill="none" stroke="#7a6a52" stroke-width="5" opacity=".35"/><path d="${d}" fill="none" stroke="#f1e7d2" stroke-width="2.6" opacity=".95"/>`;
    s += road(`M-20 640 Q 160 610 ${P.shahrixon[0]} ${P.shahrixon[1]}`);
    s += road(`M${P.shahrixon[0]} ${P.shahrixon[1]} Q 560 700 ${P.asaka[0]} ${P.asaka[1]}`);
    s += road(`M${P.asaka[0]} ${P.asaka[1]} Q 1040 650 ${P.andijon[0]} ${P.andijon[1]}`);
    s += road(`M${P.andijon[0]} ${P.andijon[1]} Q 1440 520 1620 470`);
    s += road(`M${P.asaka[0]} ${P.asaka[1]} Q 760 800 700 920`);
    s += road(`M${P.andijon[0]} ${P.andijon[1]} Q 1330 420 1390 290`);

    // shaharchalar: tomlar va daraxtlar
    const ROOF = ['#dcd5c8', '#c7bba9', '#b8a48d', '#ebe5da', '#a8785c', '#cfc7ba', '#9a8a78', '#e3d9c6'];
    ORDER.forEach((key, i) => {
      const [cx, cy] = STORES[key].pin, q = rng(100 + i);
      s += `<ellipse cx="${cx}" cy="${cy}" rx="150" ry="70" fill="url(#gTown)"/>`;
      for (let n = 0; n < 190; n++) {
        const a = q() * Math.PI * 2, d = Math.sqrt(q());
        const x = cx + Math.cos(a) * d * 125, y = cy + Math.sin(a) * d * 52, k = depth(y);
        const w = lerp(4, 13, k) * (0.6 + q()), h = w * (0.55 + q() * 0.5);
        s += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${ROOF[Math.floor(q() * ROOF.length)]}" transform="rotate(${f(-8 + q() * 16)} ${f(x)} ${f(y)})"/>`;
      }
      for (let n = 0; n < 70; n++) {
        const a = q() * Math.PI * 2, d = 0.3 + q() * 0.9;
        const x = cx + Math.cos(a) * d * 150, y = cy + Math.sin(a) * d * 64;
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(lerp(1.8, 5.5, depth(y)) * (0.7 + q() * 0.6))}" fill="#46633a" opacity=".85"/>`;
      }
      s += `<circle cx="${cx}" cy="${cy}" r="90" fill="url(#gPin)"/>`;
    });

    // osmon va ufqdagi tuman
    const defs = `<defs>
      <linearGradient id="gGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb497"/><stop offset=".45" stop-color="#6f8f58"/><stop offset="1" stop-color="#4b6a3b"/></linearGradient>
      <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb9df"/><stop offset="1" stop-color="#e3ecef"/></linearGradient>
      <linearGradient id="gSnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d9e2ea"/><stop offset="1" stop-color="#a9b8c2"/></linearGradient>
      <linearGradient id="gHaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f1ea" stop-opacity="0"/><stop offset=".42" stop-color="#eef0ea" stop-opacity=".75"/><stop offset="1" stop-color="#eef0ea" stop-opacity="0"/></linearGradient>
      <radialGradient id="gShade"><stop offset="0" stop-color="#1b2a14" stop-opacity=".16"/><stop offset="1" stop-color="#1b2a14" stop-opacity="0"/></radialGradient>
      <radialGradient id="gTown"><stop offset="0" stop-color="#cbbfa8" stop-opacity=".75"/><stop offset="1" stop-color="#cbbfa8" stop-opacity="0"/></radialGradient>
      <radialGradient id="gPin"><stop offset="0" stop-color="#ffd59a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd59a" stop-opacity="0"/></radialGradient>
    </defs>`;
    return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}
      <rect width="1600" height="900" fill="url(#gGround)"/><rect width="1600" height="${H0 + 20}" fill="url(#gSky)"/>
      ${s}<rect y="150" width="1600" height="300" fill="url(#gHaze)"/></svg>`;
  })();

  // 1600x900 kadrdagi nuqtani "cover" qilingan ekran nuqtasiga aylantiradi
  function coverPoint([x, y], w, h) {
    const s = Math.max(w / 1600, h / 900);
    return [(w - 1600 * s) / 2 + x * s, (h - 900 * s) / 2 + y * s];
  }

  /* ---------- INTRO ---------- */

  const intro = $('#top'), sky = $('#sky'), valley = $('#valley'), cloudsEl = $('#clouds');
  const introTitle = $('#introTitle'), choose = $('#choose'), pinsEl = $('#pins'), pickEl = $('#pick'), skip = $('#skip');
  const introHint = $('#introHint');
  $('#introMap').innerHTML = MAP_SVG;

  const clouds = [];
  (() => {
    const r = rng(7);
    for (let i = 0; i < 40; i++) {
      const d = r(), w = lerp(38, 105, d), el = document.createElement('div');
      const x = -12 + r() * 124, y = 38 + r() * 80; // boshida bulut dengizi pastda, tepada osmon
      el.className = 'cloud';
      el.style.width = w + 'vmax'; el.style.height = w * 0.56 + 'vmax';
      el.style.left = x + '%'; el.style.top = y + '%';
      const a = 0.82 + d * 0.18;
      el.style.background = [
        `radial-gradient(circle at ${28 + r() * 10}% ${40 + r() * 10}%, rgba(255,255,255,${a}) 0 20%, rgba(255,255,255,0) 44%)`,
        `radial-gradient(circle at ${60 + r() * 12}% ${36 + r() * 10}%, rgba(255,255,255,${a}) 0 18%, rgba(255,255,255,0) 42%)`,
        `radial-gradient(ellipse at 50% 56%, rgba(255,255,255,${a}) 0 32%, rgba(250,252,255,.7) 48%, rgba(255,255,255,0) 68%)`,
        `radial-gradient(ellipse at 50% 82%, rgba(158,182,210,.5) 0 26%, rgba(158,182,210,0) 58%)`,
      ].join(',');
      el.style.zIndex = Math.round(d * 10);
      cloudsEl.appendChild(el);
      clouds.push({ el, d, x, y });
    }
  })();

  function applyIntro(t) {
    // 1) kamera pastga tushadi — bulutlar yuqoriga ko'tarilib ekranni qoplaydi
    // 2) bulut ichidan o'tamiz — ular chetlarga tarqaladi va ostidan vodiy ochiladi
    const rise = ease(clamp(t / 0.48)), part = ease(ramp(t, 0.42, 1));
    for (const c of clouds) {
      const cy = c.y - rise * (42 + 30 * c.d);
      const dx = (c.x - 50) * part * (1.3 + 3.2 * c.d), dy = (cy - 50) * part * (1.3 + 3.2 * c.d);
      const sc = 1 + rise * 0.5 * c.d + part * (1.2 + 3 * c.d);
      c.el.style.transform = `translate(-50%,-50%) translate(${dx.toFixed(2)}vw,${(cy - c.y + dy).toFixed(2)}vh) scale(${sc.toFixed(3)})`;
      c.el.style.opacity = (1 - ramp(t, 0.5 + 0.22 * (1 - c.d), 0.82 + 0.16 * (1 - c.d))).toFixed(3);
    }
    sky.style.opacity = 1 - ramp(t, 0.45, 0.78);
    valley.style.transform = `scale(${lerp(1.55, 1, ease(ramp(t, 0.25, 1)))})`;
    introTitle.style.opacity = 1 - ramp(t, 0.1, 0.3);
    introTitle.style.transform = `translateY(${-ramp(t, 0.1, 0.3) * 40}px)`;
  }

  let VMODE = false;      // Higgsfield intro.mp4 bor — chizilgan xarita o'rniga video
  let INTRO_VIDEO = null; // o'sha <video>, yuklanib bo'lgach
  let introShown = false; // tanlov (sarlavha + kartalar) ko'rinib turibdimi
  function placePins() {
    const b = valley.getBoundingClientRect();
    pinsEl.querySelectorAll('.pin').forEach(p => {
      const st = STORES[p.dataset.key], [x, y] = coverPoint(VMODE ? st.vpin : st.pin, b.width, b.height);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      // karta ekrandan chiqib ketmasin: nuqta joyida qoladi, karta ichkariga suriladi
      const btn = p.querySelector('button'), w = btn.offsetWidth, pad = 16;
      const shift = clamp(x - w / 2, pad, Math.max(pad, b.width - pad - w)) - (x - w / 2);
      btn.style.translate = `${shift}px 0`;
    });
  }
  // Skroll intro bo'limining qayerida: 0 — tepasi (osmon), 1 — oxiri (vodiy, tanlov)
  function introProgress() {
    if (reduced) return 1;
    const len = intro.offsetHeight - innerHeight;
    return len > 0 ? clamp((scrollY - intro.offsetTop) / len) : 1;
  }
  const introEndY = () => intro.offsetTop + Math.max(0, intro.offsetHeight - innerHeight);

  function showChoice(on) {
    if (on === introShown) return;
    introShown = on;
    if (on) placePins();
    choose.classList.toggle('show', on);
    pickEl.classList.toggle('show', on);
    pinsEl.querySelectorAll('.pin').forEach((p, i) => {
      clearTimeout(p.showTimer);
      if (on) p.showTimer = setTimeout(() => p.classList.add('show'), reduced ? 0 : 250 + i * 180);
      else p.classList.remove('show');
    });
  }

  // Video skrolldan biroz orqada "suzib" boradi — g'ildirak qadamlari sakramasin.
  // Keyingi seek oldingisi tugagach ('seeked') beriladi: dekoder qancha tez bo'lsa, shuncha tez,
  // navbat ham tiqilmaydi.
  let introT = 0, introTarget = 0, introLast = 0, introWait = 0;
  function scrubIntro() {
    clearTimeout(introWait);
    const v = INTRO_VIDEO;
    if (!v || !v.duration || v.seeking) return;
    const now = performance.now(), dt = Math.min(0.1, (now - introLast) / 1000);
    introLast = now;
    introT += (introTarget - introT) * (1 - Math.exp(-dt / 0.12));
    if (Math.abs(introTarget - introT) < 0.0004) introT = introTarget;
    const want = introT * (v.duration - 0.05);
    if (Math.abs(v.currentTime - want) > 0.004) v.currentTime = want;
    else if (introT !== introTarget) introWait = setTimeout(scrubIntro, 16);
  }

  function renderIntro() {
    const p = introProgress();
    if (VMODE) {
      introTarget = p; scrubIntro();
      introTitle.style.opacity = 1 - ramp(p, 0.03, 0.16);
      introTitle.style.transform = `translateY(${-ramp(p, 0.03, 0.16) * 40}px)`;
    } else {
      applyIntro(p);
    }
    introHint.style.opacity = p < 0.02 ? 1 : 0;
    skip.hidden = p > 0.9;
    showChoice(p > 0.96);
  }
  skip.addEventListener('click', () => window.scrollTo({ top: introEndY(), behavior: 'smooth' }));

  // Tanlov tugmalari: kompyuterda xaritadagi pinlar, telefonda pastdagi kartalar
  ORDER.forEach(key => {
    const st = STORES[key];
    const pin = document.createElement('div');
    pin.className = 'pin'; pin.dataset.key = key;
    pin.innerHTML = `<button type="button" aria-label="${esc(st.city)} filialiga kirish"><img src="${st.thumb}" alt=""><span class="t">
      <span class="sub">${esc(st.title.toUpperCase())}</span><span class="city">${esc(st.city)}</span><span class="go">Kirish →</span></span></button>
      <span class="stem"></span><span class="dot"></span>`;
    pin.querySelector('button').addEventListener('click', () => enter(key));
    pinsEl.appendChild(pin);

    const card = document.createElement('button');
    card.type = 'button';
    card.innerHTML = `<img src="${st.thumb}" alt=""><span><span class="sub">${esc(st.title.toUpperCase())}</span><br><span class="city">${esc(st.city)}</span><span class="go">Do’konga kirish →</span></span>`;
    card.addEventListener('click', () => enter(key));
    pickEl.appendChild(card);
  });

  // Higgsfield intro.mp4 tayyor bo'lsa — bulut animatsiyasi o'rniga o'sha o'ynaydi
  function tryVideo(src, timeout = 2500) {
    return new Promise(resolve => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      const done = ok => { clearTimeout(tm); v.onloadeddata = v.onerror = null; resolve(ok ? v : null); };
      const tm = setTimeout(() => done(false), timeout);
      v.onloadeddata = () => done(true);
      v.onerror = () => done(false);
      v.src = src;
    });
  }

  /* ---------- DO'KONGA KIRISH ---------- */

  const journey = $('#journey'), stage = $('#stage'), layersEl = $('#layers'), capEl = $('#cap'), hint = $('#hint');
  const ovDay = $('#ovDay'), ovNight = $('#ovNight'), ovGlow = $('#ovGlow'), ovWarm = $('#ovWarm');
  const stepsLi = [...document.querySelectorAll('#steps li')], trackFill = $('#trackFill');
  let J = null; // joriy safar: { key, st, L: {map, day, night, inside}, videos, phases, caps }

  function layer(html) {
    const el = document.createElement('div');
    el.className = 'layer'; el.innerHTML = html;
    layersEl.appendChild(el);
    return el;
  }

  async function buildJourney(key) {
    const st = STORES[key];
    layersEl.innerHTML = ''; capEl.innerHTML = '';
    const L = {
      // haqiqiy intro bo'lsa — uning oxirgi kadridan sho'ng'iymiz, bo'lmasa chizilgan xaritadan
      map: layer(VMODE ? '<img src="assets/video/intro_end.jpg" alt="">' : MAP_SVG),
      day: layer(`<img src="${st.day}" alt="">`),
      night: st.night ? layer(`<img src="${st.night}" alt="">`) : null,
      inside: layer(`<img src="${st.inside}" alt="">`),
    };
    const origin = `${st.door[0]}% ${st.door[1]}%`;
    [L.day, L.night, L.inside].forEach(el => el && (el.style.transformOrigin = origin));
    stage.style.setProperty('--gx', st.door[0] + '%');
    stage.style.setProperty('--gy', st.door[1] + '%');
    const n = PRODUCTS.filter(p => p.store === key).length;
    const caps = [
      { k: st.title, h: st.city, s: 'xush kelibsiz' },
      { k: 'Manzil', h: st.street, p: st.landmark === st.street ? st.address : `${st.address} · ${st.landmark}` },
      st.hours ? { k: 'Har kuni ochiq', h: st.hours.replace('har kuni ', ''), s: 'kechqurun ham kutamiz' } : { k: 'Kechki Legenda', h: 'Chiroqlar yondi', s: 'ichkariga marhamat' },
      { k: 'Ichkarida', h: `${n} ta model`, p: 'Pastga suring — narxlari bilan katalog' },
    ].map(c => {
      const el = document.createElement('div');
      el.className = 'c' + (c.h.length > 14 ? ' long' : '');
      el.innerHTML = `<span class="kicker k">${esc(c.k)}</span><h2>${esc(c.h)}</h2>${c.s ? `<span class="s">${esc(c.s)}</span>` : ''}${c.p ? `<p>${esc(c.p)}</p>` : ''}`;
      capEl.appendChild(el);
      return el;
    });
    J = { key, st, L, caps, videos: null, phases: [0, .24, .45, .72, 1] };
    sizeJourneyMap();

    // Higgsfield kliplari (A–D) bo'lsa — kadrlar o'rniga videolar
    const vids = await Promise.all(['A', 'B', 'C', 'D'].map(x => tryVideo(`assets/video/${key}_${x}.mp4`)));
    if (J && J.key === key && vids.every(Boolean)) {
      Object.values(L).forEach(el => el && el.remove());
      J.videos = vids.map(v => { const el = layer(''); el.appendChild(v); return el; });
      J.phases = [0, .25, .5, .75, 1];
      render();
    }
  }

  function sizeJourneyMap() {
    if (!J || !J.L.map) return;
    if (VMODE) { J.L.map.style.transformOrigin = `${J.st.side}% 62%`; return; }
    const [x, y] = coverPoint(J.st.pin, stage.clientWidth, stage.clientHeight);
    J.L.map.style.transformOrigin = `${x}px ${y}px`;
  }

  function journeyProgress() {
    const top = journey.offsetTop, len = journey.offsetHeight - innerHeight;
    return clamp((scrollY - top) / len);
  }

  function setLayer(el, opacity, scale, filter = '') {
    if (!el) return;
    el.style.opacity = opacity.toFixed(3);
    el.style.transform = `scale(${scale.toFixed(4)})`;
    el.style.filter = filter;
  }

  function renderJourney(p) {
    const { L, st, phases: P, caps } = J;
    if (J.videos) {
      const seg = Math.min(3, Math.floor(p * 4)), local = p * 4 - seg;
      J.videos.forEach((el, i) => {
        el.style.opacity = i === seg ? 1 : 0;
        const v = el.firstChild;
        if (i === seg && v.duration) {
          const want = local * (v.duration - 0.05);
          if (Math.abs(v.currentTime - want) > 0.02) v.currentTime = want;
        }
      });
      [ovDay, ovNight, ovGlow, ovWarm].forEach(o => (o.style.opacity = 0));
    } else {
      const hasNight = !!L.night;
      // A: vodiydan shaharcha ustiga sho'ng'ish
      const a = ease(ramp(p, 0, P[1]));
      setLayer(L.map, 1 - ramp(p, P[1] - 0.07, P[1] + 0.02), lerp(1, 7.5, a), `blur(${(ramp(p, P[1] - 0.08, P[1]) * 8).toFixed(1)}px)`);
      // B → C: kunduzgi fasad, keyin qorong'ilashadi
      const dusk = ramp(p, P[2], P[3] - 0.02);
      const dayIn = ramp(p, P[1] - 0.08, P[1] + 0.02);
      const dayOut = hasNight ? 1 - ramp(p, P[3] - 0.1, P[3]) : 1 - ramp(p, 0.86, 0.93);
      const dayScale = p < P[2] ? lerp(1.35, 1.04, ease(ramp(p, P[1] - 0.08, P[2])))
        : lerp(1.04, hasNight ? 1.14 : 1.8, ease(ramp(p, P[2], hasNight ? P[3] : 0.92)));
      const blurDoor = hasNight ? 0 : ramp(p, 0.84, 0.92) * 7;
      const dayFilter = st.dayify
        ? `brightness(${lerp(1.18, 0.95, dusk).toFixed(3)}) saturate(${lerp(0.7, 1.08, dusk).toFixed(3)}) contrast(${lerp(0.9, 1.05, dusk).toFixed(3)}) blur(${blurDoor.toFixed(1)}px)`
        : `brightness(${lerp(1, 0.5, dusk).toFixed(3)}) saturate(${lerp(1.05, 0.85, dusk).toFixed(3)}) blur(${blurDoor.toFixed(1)}px)`;
      setLayer(L.day, dayIn * dayOut, dayScale, dayFilter);
      // haqiqiy kechki rasm (Andijon)
      if (hasNight) {
        const nIn = ramp(p, P[3] - 0.1, P[3]);
        setLayer(L.night, nIn * (1 - ramp(p, 0.86, 0.93)), lerp(1.02, 1.75, ease(ramp(p, P[3] - 0.1, 0.92))), `blur(${(ramp(p, 0.84, 0.92) * 7).toFixed(1)}px)`);
      }
      // D: ichkari
      const inside = ramp(p, 0.85, 0.94);
      setLayer(L.inside, inside, lerp(1.25, 1, ease(ramp(p, 0.85, 1))), `brightness(${lerp(0.8, 1.02, inside).toFixed(3)})`);
      // kechki effektlar
      const fadeForReal = hasNight ? 1 - ramp(p, P[3] - 0.1, P[3]) : 1 - inside;
      ovDay.style.opacity = st.dayify ? (0.5 * (1 - dusk) * dayIn * (1 - inside)).toFixed(3) : 0;
      ovNight.style.opacity = ((st.dayify ? 0.35 : 0.78) * dusk * fadeForReal).toFixed(3);
      ovGlow.style.opacity = (ramp(p, P[2] + 0.1, P[3]) * (st.dayify ? 0.5 : 1) * fadeForReal).toFixed(3);
      ovWarm.style.opacity = (inside * 0.9).toFixed(3);
    }
    // yozuvlar
    caps.forEach((el, i) => {
      const a = P[i], b = P[i + 1];
      const o = ramp(p, a + 0.015, a + 0.06) * (i === 3 ? 1 : 1 - ramp(p, b - 0.06, b - 0.015));
      el.style.opacity = (i === 0 ? Math.max(o, 1 - ramp(p, b - 0.06, b - 0.015)) : o).toFixed(3);
      el.style.transform = `translateY(${((1 - o) * 18).toFixed(1)}px)`;
    });
    const seg = p < P[1] ? 0 : p < P[2] ? 1 : p < P[3] ? 2 : 3;
    stepsLi.forEach((li, i) => li.classList.toggle('on', i === seg));
    trackFill.style.width = (p * 100).toFixed(2) + '%';
    hint.style.opacity = 1 - ramp(p, 0.01, 0.05);
  }

  /* ---------- KATALOG ---------- */

  const catalog = $('#katalog'), grid = $('#grid'), chips = $('#chips');
  function orderLink(st) { return st.phones.length ? tel(st.phones[0]) : `https://instagram.com/${st.insta}`; }

  function renderCatalog(key) {
    const st = STORES[key], items = PRODUCTS.filter(p => p.store === key);
    $('#catKicker').textContent = ap(`${st.title} · ${st.city}`);
    $('#catTitle').innerHTML = `Katalog <em>${esc(st.city.toLowerCase())}</em>`;
    $('#catMeta').innerHTML = `<span>${items.length} ta model · narxlar so’mda</span><span class="links">
      <a class="btn" href="${tel(st.phones[0])}">${esc(st.phones[0])}</a>
      ${st.tg ? `<a class="btn ghost" href="${st.tg}" target="_blank" rel="noopener">Telegram</a>` : ''}
      <a class="btn ghost" href="https://instagram.com/${st.insta}" target="_blank" rel="noopener">Instagram</a></span>`;
    const cats = [...new Set(items.map(p => p.kategoriya))];
    chips.innerHTML = [['', 'Barchasi', items.length], ...cats.map(c => [c, CAT[c] || c, items.filter(p => p.kategoriya === c).length])]
      .map(([v, l, n], i) => `<button class="chip${i ? '' : ' on'}" type="button" data-v="${esc(v)}">${esc(l)}<small>${n}</small></button>`).join('');
    const draw = cat => {
      grid.innerHTML = items.filter(p => !cat || p.kategoriya === cat).map(p => `
        <article class="card">
          <div class="ph"><img src="${p.img}" alt="${esc(p.nomi)}" loading="lazy"><span class="tag">${esc(CAT[p.kategoriya] || p.kategoriya)}</span></div>
          <div class="bd">
            <span class="id">${p.id}</span>
            <h3>${esc(p.nomi)}</h3>
            <div class="price">${som(p.narx)}<small>so’m${p.tarkibi ? ' · jami' : ''}</small></div>
            ${p.tarkibi ? `<ul class="parts">${p.tarkibi.map(t => `<li><span>${esc(t.nomi)}</span><b>${som(t.narx)}</b></li>`).join('')}</ul>` : ''}
            ${p.razmerlar ? `<div class="sizes">${p.razmerlar.split(/,\s*/).map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
            <a class="btn" href="${orderLink(st)}">Buyurtma berish</a>
          </div>
        </article>`).join('');
    };
    chips.onclick = e => {
      const b = e.target.closest('.chip'); if (!b) return;
      chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
      draw(b.dataset.v);
    };
    draw('');
  }

  /* ---------- ALOQA ---------- */

  $('#branches').innerHTML = ORDER.map(key => {
    const st = STORES[key];
    return `<article class="branch">
      <img src="${st.thumb}" alt="${esc(st.title + ' ' + st.city)}" loading="lazy">
      <span class="kicker">${esc(st.title)}</span><h3>${esc(st.city)}</h3>
      <dl><div><dt>Manzil</dt><dd>${esc(st.address)}<br>${esc(st.landmark)}</dd></div>
      <div><dt>Telefon</dt><dd>${st.phones.map(ph => `<a href="${tel(ph)}">${esc(ph)}</a>`).join('<br>')}</dd></div>
      ${st.hours ? `<div><dt>Ish vaqti</dt><dd>${esc(st.hours)}</dd></div>` : ''}</dl>
      <div class="row"><button class="btn" type="button" data-enter="${key}">Do’konga kirish</button>
      <a class="btn ghost" href="https://instagram.com/${st.insta}" target="_blank" rel="noopener">Instagram</a></div>
    </article>`;
  }).join('');
  $('#branches').addEventListener('click', e => { const b = e.target.closest('[data-enter]'); if (b) enter(b.dataset.enter); });

  /* ---------- BOSHQARUV ---------- */

  const nav = $('#nav'), navCatalog = $('#navCatalog');
  function enter(key) {
    buildJourney(key);
    renderCatalog(key);
    journey.hidden = false; catalog.hidden = false; navCatalog.hidden = false;
    history.replaceState(null, '', '#' + key);
    requestAnimationFrame(() => {
      sizeJourneyMap(); render();
      window.scrollTo({ top: journey.offsetTop, behavior: reduced ? 'auto' : 'smooth' });
    });
  }
  // "← Filiallar": intro boshiga emas, tanlov turgan oxiriga
  $('#back').addEventListener('click', () => window.scrollTo({ top: introEndY(), behavior: reduced ? 'auto' : 'smooth' }));

  let ticking = false;
  function render() {
    ticking = false;
    const y = scrollY;
    renderIntro();
    const inJourney = J && !journey.hidden && y >= journey.offsetTop - innerHeight && y <= journey.offsetTop + journey.offsetHeight;
    if (inJourney) renderJourney(journeyProgress());
    const overJourney = J && !journey.hidden && y >= journey.offsetTop - 60 && y < journey.offsetTop + journey.offsetHeight - innerHeight;
    nav.classList.toggle('dark', !!overJourney);
    nav.classList.toggle('solid', !overJourney && y > introEndY() + innerHeight * 0.6);
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } }, { passive: true });
  addEventListener('resize', () => { placePins(); sizeJourneyMap(); render(); });

  // Ishga tushirish
  (async () => {
    const hash = location.hash.slice(1), iv = $('#introVideo');
    const useVideo = () => {
      VMODE = true; intro.classList.add('vmode');
      iv.poster = 'assets/video/intro_start.jpg'; iv.hidden = false; $('#introMap').hidden = true;
      sky.hidden = true; cloudsEl.hidden = true; valley.style.transform = 'none';
    };
    let src = null;
    try {
      // butun fayl xotiraga olinadi — skrollda har kadr tarmoqni kutmaydi, surish silliq bo'ladi
      const r = await fetch('assets/video/intro.mp4');
      if (r.ok) { useVideo(); render(); src = URL.createObjectURL(await r.blob()); }
    } catch {
      // file:// da fetch ishlamaydi — videoni to'g'ridan-to'g'ri ulaymiz
      const v = await tryVideo('assets/video/intro.mp4', 2500);
      if (v) { useVideo(); src = v.src; }
    }
    if (STORES[hash]) enter(hash);
    render();
    if (src) {
      iv.src = src;
      await new Promise(res => iv.addEventListener('loadeddata', res, { once: true }));
      INTRO_VIDEO = iv;
      introT = introTarget; // ochilganda boshidan "suzib" kelmasin — darhol skroll turgan kadr
      introLast = performance.now();
      iv.addEventListener('seeked', scrubIntro);
      scrubIntro();
    }
  })();
})();
