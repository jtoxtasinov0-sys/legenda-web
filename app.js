/* Legenda sayti: 3 ta filial kartasi → skroll bilan do'konga kirish (kino) → kiyimlar → katalog.
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
  // tik ekranli telefon: 16:9 videoning faqat o'rtasi ko'rinadi — o'sha qismi kesilgan, ~3 barobar yengil nusxa (_m)
  const PHONE = matchMedia('(max-aspect-ratio: 4 / 5)').matches, M = PHONE ? '_m' : '';
  document.documentElement.classList.toggle('phone', PHONE);

  // thumb — aloqa bo'limidagi kichik rasm; door — eshik (rasmlar shu nuqtaga yaqinlashadi).
  const STORES = {
    shahrixon: {
      city: 'Shahrixon', title: 'Legenda Premium',
      street: "Hamza ko'chasi", address: "Shahrixon sh., Hamza ko'chasi", landmark: "2-maktab oldida",
      phones: ['+998 93 372 88 55'], hours: null,
      insta: 'legenda_shahrixon', tg: 'https://t.me/Legenda_Premium1',
      day: 'assets/filial/shahrixon_kun.jpg', night: null, inside: 'assets/filial/shahrixon_ichkari.jpg',
      thumb: 'assets/filial/shahrixon_kun_kichik.jpg', door: [50, 58],
    },
    asaka: {
      city: 'Asaka', title: 'Legenda Premium',
      street: "Sharq to'yxonasi, 1-qavat", address: "Asaka sh., Imom Buxoriy ko'chasi", landmark: "Sharq to'yxonasi, 1-qavat",
      phones: ['+998 50 117 11 55'], hours: null,
      insta: 'legenda_premium_asaka', tg: null,
      // Asakadan faqat kechki vitrina rasmi bor — kunduzgi ko'rinish shu rasmdan filtr bilan olinadi
      day: 'assets/filial/asaka_tun.jpg', dayify: true, night: null, inside: 'assets/filial/asaka_ichkari.jpg',
      thumb: 'assets/filial/asaka_resepshn_kichik.jpg', door: [48, 52],
    },
    andijon: {
      city: 'Andijon', title: 'Legenda Andijon',
      street: "Furqat ko'chasi, 136-uy", address: "Andijon sh., Furqat ko'chasi 136-uy", landmark: "Oq laylak to'yxonasi oldida",
      phones: ['+998 88 480 71 71', '+998 93 100 78 13'], hours: 'har kuni 08:00 – 02:00',
      insta: 'legenda_andijon', tg: 'https://t.me/LEGENDA_AND1',
      day: 'assets/filial/andijon_kun.jpg', night: 'assets/filial/andijon_tun.jpg', inside: 'assets/filial/andijon_ichkari.jpg',
      thumb: 'assets/filial/andijon_tun_kichik.jpg', door: [50, 60],
    },
  };
  const ORDER = ['shahrixon', 'asaka', 'andijon']; // chapdan o'ngga (g'arbdan sharqqa)
  const CAT = { "Ko'ylak": "Ko'ylak", 'Oyoq kiyim': 'Oyoq kiyim', Komplekt: 'Tayyor look', Kurtka: 'Kurtka', Kostyum: 'Kostyum', Kardigan: 'Kardigan', Jilet: 'Jilet' };
  const PRODUCTS = window.LEGENDA_PRODUCTS || [];

  /* ---------- FILIAL ALMASHTIRGICH (kino ustida, chap tepada) ---------- */
  // Sayt darhol Andijon kinosi bilan ochiladi; boshqa filialga shu yerdan (yoki "Aloqa" dagi kartalardan) o'tiladi.
  const switchEl = $('#switch');
  switchEl.innerHTML = ORDER.map(key => `<button type="button" data-key="${key}">${esc(STORES[key].city)}</button>`).join('');
  switchEl.addEventListener('click', e => { const b = e.target.closest('[data-key]'); if (b && !(J && J.key === b.dataset.key)) enter(b.dataset.key); });

  // Video skrolldan biroz orqada "suzib" boradi — g'ildirak qadamlari sakramasin.
  // Keyingi seek oldingisi tugagach ('seeked') beriladi: dekoder qancha tez bo'lsa, shuncha tez,
  // navbat ham tiqilmaydi. busy() — video hali surilyaptimi; seek(t) — t (0–1) holatga suradi,
  // seek berilgan bo'lsa true qaytaradi. Kutish ekran kadri bilan (requestAnimationFrame) — oraliq chizishlar yo'q.
  function scrubber(busy, seek) {
    const s = { t: 0, target: 0, last: 0, wait: 0 };
    s.run = () => {
      cancelAnimationFrame(s.wait);
      if (busy()) return;
      const now = performance.now(), dt = Math.min(0.1, (now - s.last) / 1000);
      s.last = now;
      s.t += (s.target - s.t) * (1 - Math.exp(-dt / 0.12));
      if (Math.abs(s.target - s.t) < 0.0004) s.t = s.target;
      if (!seek(s.t) && s.t !== s.target) s.wait = requestAnimationFrame(s.run);
    };
    // ochilganda boshidan "suzib" kelmasin — darhol skroll turgan kadr
    s.jump = () => { s.t = s.target; s.last = performance.now(); };
    return s;
  }
  const seekTo = (v, want) => Math.abs(v.currentTime - want) > 0.004 && ((v.currentTime = want), true);

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
    layersEl.innerHTML = ''; capEl.innerHTML = ''; stage.classList.remove('film');
    // kino (FILMS) bo'lsa — video kelguncha uning birinchi kadri (rasm) ko'rinadi, filial rasmlari yuklanmaydi;
    // kinosiz filial safari to'g'ri filial rasmidan boshlanadi
    const L = { map: FILMS[key] ? layer(`<img src="assets/video/${key}_boshi${M}.jpg" alt="">`) : null, day: null, night: null, inside: null };
    if (L.map) L.map.style.opacity = 1;
    const photos = () => {
      L.day = layer(`<img src="${st.day}" alt="">`);
      L.night = st.night ? layer(`<img src="${st.night}" alt="">`) : null;
      L.inside = layer(`<img src="${st.inside}" alt="">`);
      const origin = `${st.door[0]}% ${st.door[1]}%`;
      [L.day, L.night, L.inside].forEach(el => el && (el.style.transformOrigin = origin));
    };
    if (!FILMS[key]) photos();
    stage.style.setProperty('--gx', st.door[0] + '%');
    stage.style.setProperty('--gy', st.door[1] + '%');
    const n = PRODUCTS.filter(p => p.store === key).length;
    const caps = [
      { k: st.title, h: st.city, s: 'xush kelibsiz' },
      { k: 'Manzil', h: st.street, p: st.landmark === st.street ? st.address : `${st.address} · ${st.landmark}` },
      st.hours ? { k: 'Har kuni ochiq', h: st.hours.replace('har kuni ', ''), s: 'kechqurun ham kutamiz' } : { k: 'Kechki Legenda', h: 'Chiroqlar yondi', s: 'ichkariga marhamat' },
      // kiyimlar bo'lsa eshikdan to'g'ri ularga o'tamiz — "Ichkarida N ta model" yozuvi yo'q
      !hasTry(key) && { k: 'Ichkarida', h: `${n} ta model`, p: 'Pastga suring — narxlari bilan katalog' },
    ].filter(Boolean).map(c => {
      const el = document.createElement('div');
      el.className = 'c' + (c.h.length > 14 ? ' long' : '');
      el.innerHTML = `<span class="kicker k">${esc(c.k)}</span><h2>${esc(c.h)}</h2>${c.s ? `<span class="s">${esc(c.s)}</span>` : ''}${c.p ? `<p>${esc(c.p)}</p>` : ''}`;
      capEl.appendChild(el);
      return el;
    });
    (J && J.blobs || []).forEach(u => URL.revokeObjectURL(u));
    (J && J.film || []).forEach(it => it.q && it.q.bm.forEach(drop));
    J = { key, st, L, caps, film: null, cur: -1, look: -1, blobs: [], phases: [0, .24, .45, .72, 1] };
    journey.style.height = '';
    stepsLi[4].hidden = true; // "Kiyimlar" — faqat kinoda kiyimlar bo'lsa
    lookCard.classList.remove('show'); // oldingi filialning kiyim kartochkasi

    // Higgsfield kliplari bo'lsa — kadrlar o'rniga kino. Tahrir (FILMS) bo'lmasa yoki uning fayllaridan biri
    // yetishmasa — A dan boshlab ketma-ket bor kliplar (kamida A–D). Avval faqat videolarning boshi (metadata,
    // bir necha KB) olinadi — kino darhol tayyor; to'liq fayllar keyin navbat bilan yuklanadi (preloadFilm).
    // Telefonda klipning kadrlari (WebP) bo'lsa — video o'rniga ular (frameSeq), bo'lmasa video.
    const url = x => x.c ? `assets/video/${key}_${x.c}${M}.mp4` : x.vid ? `assets/${x.vid}${M}.mp4` : `assets/${x.img}.jpg`;
    const kadr = await KADR, clipName = x => x.c ? `${key}_${x.c}` : x.vid.split('/').pop();
    const load = x => x.c || x.vid
      ? (kadr[clipName(x)] ? frameSeq(clipName(x), kadr[clipName(x)]) : Promise.resolve(null)).then(q => q || videoMeta(url(x)))
      : loadImg(url(x));
    let plan = FILMS[key], media = plan && await Promise.all(plan.map(load));
    if (!media || media.includes(null)) {
      plan = [...'ABCDEFG'].map(c => ({ c }));
      media = await Promise.all(plan.map(load));
      const m = media.includes(null) ? media.indexOf(null) : media.length;
      plan = plan.slice(0, m); media = media.slice(0, m);
    }
    if (!(J && J.key === key)) return;
    if (plan.length < 4) { if (!L.day) { photos(); render(); } return; }
    // birinchi kadr rasmi (L.map) kino birinchi marta chizilguncha turadi — oraliqda qora ekran chiqmaydi (paintFilm)
    [L.day, L.night, L.inside].forEach(el => el && el.remove());
    J.poster = L.map;
    stage.classList.add('film');
    let at = 0;
    J.film = plan.map((x, k) => {
      // v — video, q — telefon kadrlari (canvas); ikkalasi ham "klip": uzunligi bor, skroll bilan suriladi
      const m = media[k], q = m && m.canvas ? m : null, v = m instanceof HTMLVideoElement ? m : null;
      // .layer (tashqi) — parda o'tishida siljiydi va chetini kesadi; .in — rasm/video/kadrlar (yaqinlashish);
      // .shade — ustiga yangi kadr chiqayotganda biroz qorayadi
      const el = layer('<div class="in"></div><div class="shade"></div>'), inner = el.firstChild, shade = el.lastChild;
      inner.appendChild(q ? q.canvas : m);
      if (x.look != null) el.classList.add('try');
      // aylanish videosi ustida uning Start = End kadri (2K rasm): model yuzi bilan turganda tiniq rasm ko'rinadi
      const still = x.still ? inner.appendChild(Object.assign(new Image(), { className: 'still', alt: '', src: `assets/${x.still}${M}.jpg` })) : null;
      const to = v || q ? (v || q).duration - 0.05 : 0, keys = x.keys && x.keys.map(([f, s]) => [f, Math.min(s, to)]);
      const it = { c: x.c, look: x.look, el, inner, shade, v, q, still, from: 0, to, keys, w: x.w || to, fade: x.fade || 0,
        wipe: !!x.wipe, dip: !!x.dip, push: x.push ?? 0.08, at };
      if (v) v.addEventListener('seeked', journeyScrub.run);
      at += it.w;
      return it;
    });
    J.film.forEach((it, k) => { const n = J.film[k + 1]; if (n && n.dip) it.shade.classList.add('light'); });
    J.total = at;
    // yozuvlar: A–B shahar, C fasad, D kechqurun, E — kirish; keyin kiyimlar (kartochka)
    const atOf = c => { const it = J.film.find(x => x.c === c); return it && it.at / at; };
    const tryIt = J.film.find(x => x.look != null);
    J.tryAt = tryIt ? tryIt.at / at : null;
    J.phases = atOf('E') ? [0, atOf('C'), atOf('D'), atOf('E'), J.tryAt ?? 1, 1] : [0, .25, .5, .75, 1];
    stepsLi[4].hidden = J.tryAt == null;
    sizeJourney();
    journeyScrub.target = journeyProgress(); journeyScrub.jump();
    render();
    preloadFilm(J);
  }

  // Kino tahriri: Higgsfield kliplarining xira yoki sifatsiz joylari fayldan kesilgan (skript: TRIM, SKIP).
  // c — do'kon klipi harfi; vid/img — assets/ ichidagi video yoki rasm; w — necha "soniya" turadi (video uchun
  // berilmasa — uzunligi); fade — oldingi kadrdan shuncha soniyada erib o'tish; push — rasm sekin yaqinlashishi;
  // look — kiyim (LOOKS dagi tartib raqami), shu bo'laklarda o'ngda kartochka chiqadi;
  // keys — [skroll ulushi, video soniyasi] nuqtalari: xira joy skrollda tez o'tib ketadi, tiniq joy uzoqroq turadi.
  // wipe — o'tish "parda" bilan (paintFilm): yangi kadr pastdan chiqib eskisini yopadi, eskisi sekinroq yuqoriga
  // siljib qorayadi (ustma-ust erish — "arvoh" — yo'q). Kiyimlar orasida shu.
  // dip — eshikdan kirish: kamera eshikka yaqinlashib iliq yorug'likka "sho'ng'iydi", xona yorug'likdan ochiladi.
  // model videosi: parda chiqayotganda (fade 1.5 / w 8.5) yuzi bilan turadi, keyin skroll bilan bir aylanadi
  // va oxirida yana biroz yuzi bilan turadi. Turgan paytda video ustida tiniq rasm (still) — Higgsfield videosi
  // aylanish paytida xiraroq, rasm esa 2K.
  const TURN = [[0, 0], [0.18, 0], [0.94, 5], [1, 5]];
  const FILMS = {
    // do'kon tepasidagi dron kadridan (B, 1 s — sekinroq suriladi) boshlanadi; eshikdan kirgach — kiyimlar:
    // har biri avval ilgichda, keyin model shu kiyimda skroll bilan aylanadi
    // C da 2.2–3.5 s — kamera tomlar ustidan o'tadi, chetlarda xira narsalar: skrollning 8% ida o'tadi
    andijon: [{ c: 'B', w: 2.5 }, { c: 'C', keys: [[0, 0], [0.42, 2.2], [0.5, 3.5], [1, 5]] }, { c: 'D' }, { c: 'E' },
      { img: 'kiyim/ilgich_LG-014', w: 2.2, fade: 1.6, dip: true, push: 0.03, look: 0 },
      { vid: 'video/orta_LG-014', still: 'kiyim/orta_LG-014', w: 8.5, fade: 1.5, wipe: true, keys: TURN, look: 0 },
      { img: 'kiyim/ilgich_LG-018', w: 2.3, fade: 1.5, wipe: true, push: 0.03, look: 1 },
      { vid: 'video/orta_LG-018', still: 'kiyim/orta_LG-018', w: 8.5, fade: 1.5, wipe: true, keys: TURN, look: 1 },
      { img: 'kiyim/ilgich_LG-013', w: 2.3, fade: 1.5, wipe: true, push: 0.03, look: 2 },
      { img: 'kiyim/orta_LG-013', w: 3.5, fade: 1.5, wipe: true, push: 0.03, look: 2 }],
  };
  const LOOKS = ['LG-014', 'LG-018', 'LG-013'];
  // keys bo'yicha: skroll ulushi t → video soniyasi
  const warp = (keys, t) => {
    let k = 1;
    while (k < keys.length - 1 && t > keys[k][0]) k++;
    const [a, sa] = keys[k - 1], [b, sb] = keys[k];
    return sa + (sb - sa) * clamp((t - a) / (b - a));
  };
  // bo'lak ichidagi o'rin (0–1) → video soniyasi
  const clipTime = (it, local) => it.keys ? warp(it.keys, local) : it.from + local * (it.to - it.from);
  const hasTry = key => !!(FILMS[key] && FILMS[key].some(x => x.look != null));
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  // video elementi faqat metadata bilan (uzunligi ma'lum bo'ladi), 10 s ichida kelmasa — null
  const videoMeta = src => new Promise(res => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'metadata';
    const tm = setTimeout(() => res(null), 10000);
    v.onloadedmetadata = () => { clearTimeout(tm); res(v); };
    v.onerror = () => { clearTimeout(tm); res(null); };
    v.src = src;
  });

  // Telefonda kino videosi o'rniga kadrlar: har klipning har kadri alohida WebP (assets/kadr/{klip}/001.webp ...),
  // canvas'ga chiziladi. iPhone (Safari, Telegram ichidagi brauzer) va quvvat tejash rejimida video skroll bilan
  // surilmaydi yoki umuman yuklanmaydi — rasm esa hamma joyda bir xil ishlaydi. Ro'yxat: kadrlar.json (skript).
  //
  // Tezlik: kadrni ochish (WebP dekodlash) qimmat — asosiy oqimda telefonda 30–80 ms, skroll qotadi. Shuning uchun
  // fayllar avval xotiraga (blob) olinadi, keyin joriy joy atrofidagi kadrlar FONDA ochiladi (createImageBitmap,
  // bir vaqtda 2 ta), skroll paytida esa faqat tayyor kadr chiziladi (~0.5 ms). Ochilgan kadr ~3 MB — xotirada
  // ko'pi bilan FRAME_CACHE tasi turadi: joriy joydan oldinda ~18, orqada ~6 va qo'shni bo'laklar chegarasi.
  const KADR = PHONE ? fetch('assets/kadr/kadrlar.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})) : Promise.resolve({});
  const frameUrl = (name, k) => `assets/kadr/${name}/${String(k + 1).padStart(3, '0')}.webp`;
  const FRAME_CACHE = 32, AHEAD = 18, BEHIND = 6;
  const getBlob = u => fetch(u).then(r => (r.ok ? r.blob() : null)).catch(() => null);
  // fonda ochish; createImageBitmap yo'q eski brauzerda — Image + decode()
  const decodeBlob = b => window.createImageBitmap ? createImageBitmap(b) : new Promise((res, rej) => {
    const im = new Image(), u = URL.createObjectURL(b);
    im.onload = () => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { URL.revokeObjectURL(u); res(im); });
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('kadr')); };
    im.src = u;
  });
  const drop = bm => bm && bm.close && bm.close();
  // birinchi va oxirgi kadr darhol (bo'laklar chegarasi shular), qolganlari keyin navbat bilan (loadFrames)
  async function frameSeq(name, m) {
    const ends = await Promise.all([0, m.n - 1].map(k => getBlob(frameUrl(name, k))));
    if (ends.includes(null)) return null;
    const bms = await Promise.all(ends.map(b => decodeBlob(b).catch(() => null)));
    if (bms.includes(null)) { bms.forEach(drop); return null; }
    const canvas = Object.assign(document.createElement('canvas'), { width: m.w, height: m.h });
    const q = { name, canvas, ctx: canvas.getContext('2d', { alpha: false }), n: m.n, fps: m.fps, duration: m.n / m.fps,
      blob: [], bm: [], busy: new Set(), shown: -1, want: 0, dir: 1 };
    q.blob[0] = ends[0]; q.blob[m.n - 1] = ends[1];
    q.bm[0] = bms[0]; q.bm[m.n - 1] = bms[1];
    drawFrame(q, 0);
    return q;
  }
  // t (soniya) dagi kadr (t berilmasa — oxirgi so'ralgani); u hali ochilmagan bo'lsa — eng yaqin ochilgani
  // (avval orqadagi, ya'ni o'tib kelingan tomondagi), kerakli kadr esa navbatga qo'yiladi
  function drawFrame(q, t) {
    const want = t == null ? q.want : clamp(Math.round(t * q.fps), 0, q.n - 1);
    if (want !== q.want) q.dir = want > q.want ? 1 : -1;
    q.want = want;
    let k = -1;
    for (let d = 0; k < 0 && d < q.n; d++) {
      const a = want - d * q.dir, b = want + d * q.dir;
      k = q.bm[a] ? a : q.bm[b] ? b : -1;
    }
    if (k >= 0 && k !== q.shown) { q.ctx.drawImage(q.bm[k], 0, 0, q.canvas.width, q.canvas.height); q.shown = k; }
    if (k !== want) pumpDecode();
  }
  // Keyingi ochiladigan kadr: joriy bo'lakda kerakli kadrdan harakat tomoniga (bo'lak tugasa — keyingisiga
  // o'tib), biroz orqaga, qo'shni bo'laklarning chegara kadrlari.
  function nextDecode(j) {
    const F = j.film, cur = F[Math.max(0, j.cur)], list = [];
    const add = (it, k) => { if (it && it.q && k >= 0 && k < it.q.n) list.push([it.q, k]); };
    if (cur && cur.q) {
      const q = cur.q, i = F.indexOf(cur), step = (from, d, n) => {
        for (let s = from; s <= n; s++) {
          const k = q.want + s * d;
          if (k >= 0 && k < q.n) add(cur, k);
          else { const nb = F[i + d]; add(nb, d > 0 ? k - q.n : nb && nb.q ? nb.q.n + k : -1); }
        }
      };
      step(0, q.dir, 5); step(1, -q.dir, 2);
      add(F[i - 1], F[i - 1] && F[i - 1].q ? F[i - 1].q.n - 1 : -1); add(F[i + 1], 0);
      step(6, q.dir, AHEAD); step(3, -q.dir, BEHIND);
    } else if (cur) {
      const i = F.indexOf(cur);
      add(F[i - 1], F[i - 1] && F[i - 1].q ? F[i - 1].q.n - 1 : -1); add(F[i + 1], 0);
      for (let k = 1; k < AHEAD; k++) add(F[i + 1], k);
    }
    return list.find(([q, k]) => q.blob[k] && !q.bm[k] && !q.busy.has(k));
  }
  // Xotira chegarasi: kerakli joydan eng uzoq (orqadagilar ikki barobar "uzoqroq") va qo'shni bo'lmagan
  // bo'laklarning kadrlari yopiladi. Ko'rinib turgan kadr yopilmaydi.
  function evict(j) {
    const all = [], c = Math.max(0, j.cur);
    j.film.forEach((it, f) => it.q && it.q.bm.forEach((bm, k) => bm && all.push([it.q, k, f])));
    if (all.length <= FRAME_CACHE) return;
    const cost = ([q, k, f]) => {
      if (k === q.shown) return -1;
      const d = (k - q.want) * q.dir, far = d < 0 ? -2 * d : d;
      return f === c ? far : Math.abs(f - c) === 1 ? (k === q.want ? 0 : 40 + far) : 1000 + far;
    };
    all.sort((a, b) => cost(b) - cost(a));
    all.slice(0, all.length - FRAME_CACHE).forEach(([q, k]) => { if (k !== q.shown) { drop(q.bm[k]); delete q.bm[k]; } });
  }
  let decoding = 0;
  function pumpDecode() {
    const j = J;
    while (j && j.film && decoding < 2) {
      const job = nextDecode(j);
      if (!job) return;
      const [q, k] = job;
      q.busy.add(k); decoding++;
      decodeBlob(q.blob[k]).then(bm => {
        q.busy.delete(k); decoding--;
        if (J !== j) { drop(bm); return; }
        q.bm[k] = bm;
        evict(j);
        // kerakli kadrga ko'rinib turganidan yaqinroq kadr ochildi — qayta chizilsin
        if (Math.abs(k - q.want) < Math.abs(q.shown - q.want)) drawFrame(q);
        pumpDecode();
      }, () => { q.busy.delete(k); decoding--; delete q.blob[k]; pumpDecode(); });
    }
  }
  // Kadr fayllari yuklanishi: avval butun kino bo'ylab har 8-kadr (kino darhol oxirigacha suriladi), keyin joriy
  // bo'lakdan oldinga qarab qolganlari (har 4-, har 2-, hammasi) — skroll qilinayotgan joy birinchi silliqlashadi.
  function loadFrames(j) {
    const seqs = j.film.filter(it => it.q), lvl = k => (k % 8 ? k % 4 ? k % 2 ? 3 : 2 : 1 : 0);
    seqs.forEach(it => { it.todo = [...Array(it.q.n).keys()].filter(k => !it.q.blob[k]).sort((a, b) => lvl(a) - lvl(b) || a - b); });
    const rank = it => { const f = j.film.indexOf(it), c = Math.max(0, j.cur); return f >= c ? f - c : 100 + c - f; };
    const pick = () => {
      const order = seqs.filter(it => it.todo.length).sort((a, b) => rank(a) - rank(b));
      const it = order.find(x => lvl(x.todo[0]) === 0) || order[0];
      return it && [it, it.todo.shift()];
    };
    const worker = async () => {
      for (let p; J === j && (p = pick());) {
        const [it, k] = p, b = await getBlob(frameUrl(it.q.name, k));
        if (J !== j) return;
        if (b) { it.q.blob[k] = b; pumpDecode(); }
      }
    };
    for (let w = 0; w < 6; w++) worker();
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const once = (el, ev) => new Promise(r => el.addEventListener(ev, r, { once: true }));
  // Kino videolari tartib bilan to'liq yuklanib, xotiraga olinadi (blob) — keyin skroll bilan surish tarmoqni
  // kutmaydi va qotmaydi. Yangi video eskisi turgan kadrga surilib, uning ostiga qo'yiladi; kadr chizilgach eskisi
  // olib tashlanadi — ko'rinib turgan video ham sezilmay almashadi.
  async function preloadFilm(j) {
    if (j.film.some(it => it.q)) loadFrames(j);
    for (const it of j.film) {
      if (!it.v) continue;
      let blob = null;
      try { const r = await fetch(it.v.src); if (r.ok) blob = await r.blob(); } catch { /* file:// — tarmoqdan qoladi */ }
      if (J !== j) return;
      if (!blob) continue;
      const u = URL.createObjectURL(blob), v = await videoMeta(u), old = it.v;
      j.blobs.push(u);
      if (J !== j) return;
      if (!v) continue;
      old.parentNode.insertBefore(v, old);
      v.currentTime = old.currentTime;
      await once(v, 'seeked');
      // kadr ekranga chiqquncha (yashirin varaqda requestVideoFrameCallback kelmasligi mumkin — 300 ms dan keyin baribir)
      await Promise.race([new Promise(r => v.requestVideoFrameCallback ? v.requestVideoFrameCallback(r) : requestAnimationFrame(r)), sleep(300)]);
      await Promise.race([new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))), sleep(100)]); // ekranga chiqsin
      if (J !== j) return;
      v.addEventListener('seeked', journeyScrub.run);
      it.v = v;
      if (j.film[j.cur] === it) j.ready = true; // eskisining 'seeked' i endi kelmaydi
      old.remove(); old.removeAttribute('src'); old.load();
      journeyScrub.run();
    }
  }

  // Kino intro kabi suriladi: t (0–1) — hamma bo'laklar bo'ylab bitta uzluksiz vaqt.
  // Bo'lak almashganda yangisi kerakli kadrga surilib bo'lgach ko'rsatiladi, qo'shnilari esa oldindan
  // chegara kadrga qo'yiladi (A oxiri = B boshi) — chok ko'rinmaydi.
  const journeyScrub = scrubber(
    () => { const it = J && J.film && J.film[Math.max(0, J.cur)]; return !it || (it.v && (!it.v.duration || it.v.seeking)); },
    t => {
      const F = J.film, pos = t * J.total;
      let i = 0;
      while (i < F.length - 1 && pos >= F[i + 1].at) i++;
      const it = F[i];
      J.local = clamp((pos - it.at) / it.w);
      // kadrlar (telefon) darhol chiziladi — "seeked" kutilmaydi
      if (it.q) drawFrame(it.q, clipTime(it, J.local));
      const moved = !!it.v && seekTo(it.v, clipTime(it, J.local));
      if (i !== J.cur) {
        J.cur = i; J.ready = !moved;
        if (moved) it.v.addEventListener('seeked', () => { if (J.cur === i) { J.ready = true; paintFilm(); } }, { once: true });
        [i - 1, i + 1].forEach(k => {
          const n = F[k], t = n && (k < i ? n.to : n.from);
          if (n && n.q) drawFrame(n.q, t);
          else if (n && n.v && n.v.duration) seekTo(n.v, t);
        });
      }
      if (J.ready) paintFilm();
      return moved;
    });

  // "fade" bo'lsa, bo'lak boshida oldingi kadr (oxirida to'xtagan) ostida biroz kattalashib eriydi.
  // Rasmlar o'z vaqti davomida sekin yaqinlashadi. Oldingi bo'lak har doim joriysining ostida ko'rinib turadi —
  // yangi video kadri hali chizilmagan bo'lsa ham ekran qoraymaydi va pirpiramaydi. Keyingisi shaffof, lekin
  // chiziladi (kadri tayyor turadi); qolganlari umuman chizilmaydi (visibility) — tezroq.
  //
  // "dip": eski kadr (eshik) kattalashib iliq-oq rangga botadi (.shade.light), yangisi shu rangdan ochilib
  // 1.07 dan 1 ga o'tiradi — ikki kadr hech qachon ustma-ust ko'rinmaydi.
  // "wipe" (parda) o'tishi — faqat transform va shaffoflik (kompozitor, telefonda ham silliq):
  // yangi qatlam (tashqi) pastdan yuqoriga siljiydi, ichi esa teskari siljib joyida turadi — chegara chizig'i
  // ekran bo'ylab pastdan yuqoriga yuradi; yangi kadr 1.08 dan 1 ga "o'tiradi". Eski kadr sekinroq (18%) yuqoriga
  // ketadi va qorayadi — chuqurlik. Chegarada yumshoq soya va yupqa oltin chiziq (CSS .layer.wipe).
  function paintFilm() {
    const F = J.film, i = J.cur, f = F[i].fade ? clamp(J.local * F[i].w / F[i].fade) : 1;
    const wipe = F[i].wipe && f < 1, dip = F[i].dip && f < 1, e = ease(f);
    F.forEach((x, k) => {
      const out = k === i - 1 && f < 1;
      const o = k === i ? (wipe ? 1 : dip ? ramp(f, 0.42, 0.95) : f) : k === i - 1 ? 1 : 0;
      x.el.style.opacity = o.toFixed(3);
      x.el.style.visibility = k >= i - 1 && k <= i + 1 ? 'visible' : 'hidden';
      const push = x.v || x.q ? 1 : 1 + x.push * (k === i ? J.local : k < i ? 1 : 0);
      let y = 0, iy = 0, sc = push, dark = 0;
      if (k === i && wipe) { y = (1 - e) * 100; iy = -y; sc *= lerp(1.08, 1, e); }
      else if (out && wipe) { iy = -18 * e; dark = 0.42 * e; }
      else if (k === i && dip) sc *= lerp(1.07, 1, ease(ramp(f, 0.42, 1)));
      else if (out && dip) { sc *= lerp(1, 1.16, ease(ramp(f, 0, 0.6))); dark = ease(ramp(f, 0.12, 0.55)); }
      else if (out) sc *= lerp(1, 1.06, f); // erib o'tish: eski kadr biroz kattalashib so'nadi
      x.el.style.transform = y ? `translate3d(0, ${y.toFixed(3)}%, 0)` : 'none';
      x.inner.style.transform = `translate3d(0, ${iy.toFixed(3)}%, 0) scale(${sc.toFixed(4)})`;
      x.shade.style.opacity = dark.toFixed(3);
      if (x.el.classList.contains('wipe') !== (k === i && wipe)) x.el.classList.toggle('wipe');
      // tiniq rasm faqat model deyarli qimirlamaganda (birinchi ~0.2 s va oxirgi ~0.25 s) — keyin video
      if (x.still) {
        const t = k === i ? clipTime(x, J.local) : k < i ? x.to : x.from;
        const s = x.still.naturalWidth ? Math.max(1 - ramp(t, 0.03, 0.2), ramp(t, x.to - 0.25, x.to - 0.04)) : 0;
        x.still.style.opacity = s.toFixed(3);
      }
    });
    if (J.poster) { const p = J.poster; J.poster = null; requestAnimationFrame(() => requestAnimationFrame(() => p.remove())); }
    if (J.waitFor && J.waitFor.k === i) { J.waitFor.done(); J.waitFor = null; }
    showLook(F[i].look);
  }

  // ~21vh skroll = kinoning 1 soniyasi
  function sizeJourney() {
    if (J && J.film) journey.style.height = `${100 + 21 * J.total}vh`;
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
    if (J.film) {
      journeyScrub.target = p; journeyScrub.run();
      [ovDay, ovNight, ovGlow, ovWarm].forEach(o => (o.style.opacity = 0));
    } else {
      const hasNight = !!L.night;
      // kunduzgi fasad (boshidanoq ko'rinadi, sekin yaqinlashadi), keyin qorong'ilashadi.
      // Kino rasmi (L.map) — kino yuklanguncha o'zgarmay turadi.
      const dusk = ramp(p, P[2], P[3] - 0.02);
      const dayIn = 1;
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
    // yozuvlar: har biri o'z bo'lagida; oxirgisi kiyimlar boshlanganda (yoki hech qachon) so'nadi
    caps.forEach((el, i) => {
      const a = P[i], b = P[i + 1];
      const o = ramp(p, a + 0.015, a + 0.06) * (b >= 1 ? 1 : 1 - ramp(p, b - 0.06, b - 0.015));
      el.style.opacity = (i === 0 ? Math.max(o, 1 - ramp(p, b - 0.06, b - 0.015)) : o).toFixed(3);
      el.style.transform = `translateY(${((1 - o) * 18).toFixed(1)}px)`;
    });
    let seg = 0;
    while (seg < stepsLi.length - 1 && P[seg + 1] < 1 && p >= P[seg + 1]) seg++;
    stepsLi.forEach((li, i) => li.classList.toggle('on', i === seg));
    trackFill.style.transform = `scaleX(${p.toFixed(4)})`; // width emas — har kadrda sahifa qayta o'lchanmasin
    hint.style.opacity = 1 - ramp(p, 0.01, 0.05);
    // kiyim xonasi yorug' — pastki yozuvlar qora, chetdagi qoraytirish yo'q
    stage.classList.toggle('light', J.tryAt != null && p >= J.tryAt);
  }

  /* ---------- KATALOG ---------- */

  const catalog = $('#katalog'), grid = $('#grid'), chips = $('#chips');
  function orderLink(st) { return st.phones.length ? tel(st.phones[0]) : `https://instagram.com/${st.insta}`; }
  const partsHtml = p => p.tarkibi ? `<ul class="parts">${p.tarkibi.map(t => `<li><span>${esc(t.nomi)}</span><b>${som(t.narx)}</b></li>`).join('')}</ul>` : '';
  const sizesHtml = p => p.razmerlar ? `<div class="sizes">${p.razmerlar.split(/,\s*/).map(s => `<span>${esc(s)}</span>`).join('')}</div>` : '';

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
            ${partsHtml(p)}
            ${sizesHtml(p)}
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

  /* ---------- KIYIMLAR (kino ichida) ---------- */
  // Eshikdan kirgach kino kiyim xonasiga o'tadi: har kiyim ilgichda, keyin model shu kiyimda skroll bilan aylanadi
  // (FILMS dagi look). O'ngda — shu kiyimning kartochkasi: narx, tarkibi, razmerlar, buyurtma.
  const lookCard = $('#lookCard'), lookInfo = $('#lookInfo'), lookId = $('#lookId'), lookCount = $('#lookCount'), lookThumbs = $('#lookThumbs');
  lookThumbs.innerHTML = LOOKS.map((id, i) =>
    `<button type="button" data-i="${i}" aria-label="${id}"><img src="assets/kiyim/ilgich_${id}.jpg" alt="" loading="lazy"></button>`).join('');

  function showLook(i) {
    if (!J || i === J.look) return;
    J.look = i ?? -1;
    lookCard.classList.toggle('show', J.look >= 0);
    if (J.look < 0) return;
    const p = PRODUCTS.find(x => x.id === LOOKS[J.look]);
    lookCount.textContent = `0${J.look + 1} / 0${LOOKS.length}`;
    lookId.textContent = p ? ap(`${p.id} · ${CAT[p.kategoriya] || p.kategoriya}`) : '';
    lookInfo.innerHTML = p ? `<h3>${esc(p.nomi)}</h3>
      <div class="price">${som(p.narx)}<small>so’m${p.tarkibi ? ' · jami' : ''}</small></div>${partsHtml(p)}${sizesHtml(p)}
      <a class="btn" href="${orderLink(J.st)}">Buyurtma berish</a>` : '';
    lookThumbs.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === J.look));
  }
  // Kiyimga o'tish: video oraliq kadrlardan "aylanib" o'tmaydi — qisqa parda ostida darhol o'sha kiyimga.
  // Model ko'rinib turgan bo'lsa — keyingi kiyimdagi modelga (yuzi bilan), ilgichda bo'lsa — keyingi ilgichga.
  const veil = $('#veil');
  let going = false;
  async function goLook(i) {
    if (!J || !J.film || going) return;
    const look = (i + LOOKS.length) % LOOKS.length, cur = J.film[J.cur];
    const onModel = !!cur && cur.look != null && J.film.find(x => x.look === cur.look) !== cur;
    const items = J.film.filter(x => x.look === look), it = items[onModel ? items.length - 1 : 0];
    if (!it) return;
    going = true;
    veil.classList.add('on');
    await sleep(reduced ? 0 : 200);
    const shown = new Promise(done => { J.waitFor = { k: J.film.indexOf(it), done }; });
    const t = (it.at + it.fade) / J.total + 0.0005;
    window.scrollTo({ top: journey.offsetTop + t * (journey.offsetHeight - innerHeight), behavior: 'auto' });
    journeyScrub.target = journeyProgress(); journeyScrub.jump();
    render();
    await Promise.race([shown, sleep(1200)]); // yangi kadr chizilguncha parda turadi
    await sleep(60);
    veil.classList.remove('on');
    going = false;
  }
  lookThumbs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) goLook(+b.dataset.i); });
  $('#lookPrev').addEventListener('click', () => goLook(J.look - 1));
  $('#lookNext').addEventListener('click', () => goLook(J.look + 1));
  // menyudagi "Kiyib ko'rish" — kiyimlar boshiga
  const navTry = $('#navTry');
  navTry.addEventListener('click', e => { e.preventDefault(); goLook(0); });

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
    navTry.hidden = !hasTry(key);
    switchEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.key === key));
    history.replaceState(null, '', '#' + key);
    // kino boshiga darhol (silliq skroll butun kinoni orqaga aylantirib o'tardi)
    window.scrollTo({ top: journey.offsetTop, behavior: 'auto' });
    render();
  }

  let ticking = false;
  function render() {
    ticking = false;
    // avval hamma o'lchamlar o'qiladi, keyin uslublar yoziladi — brauzer har kadrda sahifani qayta hisoblamaydi
    const y = scrollY, live = J && !journey.hidden, top = journey.offsetTop, h = journey.offsetHeight;
    const jp = live ? journeyProgress() : 0;
    if (live && y >= top - innerHeight && y <= top + h) renderJourney(jp);
    // kino ustida menyu qora, yorug' kiyim xonasi ustida — oddiy
    const inTry = live && J.film && J.tryAt != null && jp >= J.tryAt;
    const overJourney = live && !inTry && y >= top - 60 && y < top + h - 60;
    nav.classList.toggle('dark', !!overJourney);
    nav.classList.toggle('solid', !overJourney && y > innerHeight * 0.6);
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } }, { passive: true });
  addEventListener('resize', () => { sizeJourney(); render(); });

  // Ishga tushirish: havolada filial bo'lsa (#shahrixon) — o'sha, bo'lmasa Andijon kinosi
  const hash = location.hash.slice(1);
  enter(STORES[hash] ? hash : 'andijon');
})();
