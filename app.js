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
  // seek berilgan bo'lsa true qaytaradi.
  function scrubber(busy, seek) {
    const s = { t: 0, target: 0, last: 0, wait: 0 };
    s.run = () => {
      clearTimeout(s.wait);
      if (busy()) return;
      const now = performance.now(), dt = Math.min(0.1, (now - s.last) / 1000);
      s.last = now;
      s.t += (s.target - s.t) * (1 - Math.exp(-dt / 0.12));
      if (Math.abs(s.target - s.t) < 0.0004) s.t = s.target;
      if (!seek(s.t) && s.t !== s.target) s.wait = setTimeout(s.run, 16);
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
    J = { key, st, L, caps, film: null, cur: -1, look: -1, blobs: [], phases: [0, .24, .45, .72, 1] };
    journey.style.height = '';
    stepsLi[4].hidden = true; // "Kiyimlar" — faqat kinoda kiyimlar bo'lsa
    lookCard.classList.remove('show'); // oldingi filialning kiyim kartochkasi

    // Higgsfield kliplari bo'lsa — kadrlar o'rniga kino. Tahrir (FILMS) bo'lmasa yoki uning fayllaridan biri
    // yetishmasa — A dan boshlab ketma-ket bor kliplar (kamida A–D). Avval faqat videolarning boshi (metadata,
    // bir necha KB) olinadi — kino darhol tayyor; to'liq fayllar keyin navbat bilan yuklanadi (preloadFilm).
    const url = x => x.c ? `assets/video/${key}_${x.c}${M}.mp4` : x.vid ? `assets/${x.vid}${M}.mp4` : `assets/${x.img}.jpg`;
    const load = x => x.c || x.vid ? videoMeta(url(x)) : loadImg(url(x));
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
      const v = x.c || x.vid ? media[k] : null, el = layer('');
      el.appendChild(media[k]);
      if (x.look != null) el.classList.add('try');
      const to = v ? v.duration - 0.05 : 0, keys = x.keys && x.keys.map(([f, s]) => [f, Math.min(s, to)]);
      const it = { c: x.c, look: x.look, el, v, from: 0, to, keys, w: x.w || to, fade: x.fade || 0, push: x.push ?? 0.08, at };
      if (v) v.addEventListener('seeked', journeyScrub.run);
      at += it.w;
      return it;
    });
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
  // model videosi: ilgichdan erib o'tayotganda (fade 1 / w 8) yuzi bilan turadi, keyin skroll bilan bir aylanadi
  const TURN = [[0, 0], [0.125, 0], [1, 5]];
  const FILMS = {
    // do'kon tepasidagi dron kadridan (B, 1 s — sekinroq suriladi) boshlanadi; eshikdan kirgach — kiyimlar:
    // har biri avval ilgichda, keyin model shu kiyimda skroll bilan aylanadi
    // C da 2.2–3.5 s — kamera tomlar ustidan o'tadi, chetlarda xira narsalar: skrollning 8% ida o'tadi
    andijon: [{ c: 'B', w: 2.5 }, { c: 'C', keys: [[0, 0], [0.42, 2.2], [0.5, 3.5], [1, 5]] }, { c: 'D' }, { c: 'E' },
      { img: 'kiyim/ilgich_LG-014', w: 1.8, fade: 1.2, push: 0.03, look: 0 }, { vid: 'video/orta_LG-014', w: 8, fade: 1, keys: TURN, look: 0 },
      { img: 'kiyim/ilgich_LG-018', w: 1.8, fade: 1, push: 0.03, look: 1 }, { vid: 'video/orta_LG-018', w: 8, fade: 1, keys: TURN, look: 1 },
      { img: 'kiyim/ilgich_LG-013', w: 1.8, fade: 1, push: 0.03, look: 2 }, { img: 'kiyim/orta_LG-013', w: 3, fade: 1, push: 0.03, look: 2 }],
  };
  const LOOKS = ['LG-014', 'LG-018', 'LG-013'];
  // keys bo'yicha: skroll ulushi t → video soniyasi
  const warp = (keys, t) => {
    let k = 1;
    while (k < keys.length - 1 && t > keys[k][0]) k++;
    const [a, sa] = keys[k - 1], [b, sb] = keys[k];
    return sa + (sb - sa) * clamp((t - a) / (b - a));
  };
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
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const once = (el, ev) => new Promise(r => el.addEventListener(ev, r, { once: true }));
  // Kino videolari tartib bilan to'liq yuklanib, xotiraga olinadi (blob) — keyin skroll bilan surish tarmoqni
  // kutmaydi va qotmaydi. Yangi video eskisi turgan kadrga surilib, uning ostiga qo'yiladi; kadr chizilgach eskisi
  // olib tashlanadi — ko'rinib turgan video ham sezilmay almashadi.
  async function preloadFilm(j) {
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
      it.el.insertBefore(v, old);
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
      const moved = !!it.v && seekTo(it.v, it.keys ? warp(it.keys, J.local) : it.from + J.local * (it.to - it.from));
      if (i !== J.cur) {
        J.cur = i; J.ready = !moved;
        if (moved) it.v.addEventListener('seeked', () => { if (J.cur === i) { J.ready = true; paintFilm(); } }, { once: true });
        [i - 1, i + 1].forEach(k => { const n = F[k]; if (n && n.v && n.v.duration) seekTo(n.v, k < i ? n.to : n.from); });
      }
      if (J.ready) paintFilm();
      return moved;
    });

  // "fade" bo'lsa, bo'lak boshida oldingi kadr (oxirida to'xtagan) ostida biroz kattalashib eriydi.
  // Rasmlar o'z vaqti davomida sekin yaqinlashadi. Oldingi bo'lak har doim joriysining ostida ko'rinib turadi —
  // yangi video kadri hali chizilmagan bo'lsa ham ekran qoraymaydi va pirpiramaydi. Keyingisi shaffof, lekin
  // chiziladi (kadri tayyor turadi); qolganlari umuman chizilmaydi (visibility) — tezroq.
  function paintFilm() {
    const F = J.film, i = J.cur, f = F[i].fade ? clamp(J.local * F[i].w / F[i].fade) : 1;
    F.forEach((x, k) => {
      const out = k === i - 1 && f < 1, o = k === i ? f : k === i - 1 ? 1 : 0;
      x.el.style.opacity = o.toFixed(3);
      x.el.style.visibility = k >= i - 1 && k <= i + 1 ? 'visible' : 'hidden';
      const push = x.v ? 1 : 1 + x.push * (k === i ? J.local : k < i ? 1 : 0);
      x.el.style.transform = `scale(${(push * (out ? lerp(1, 1.06, f) : 1)).toFixed(4)})`;
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
    trackFill.style.width = (p * 100).toFixed(2) + '%';
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
