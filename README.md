# Legenda — erkaklar kiyimi sayti

Andijon, Shahrixon va Asakadagi Legenda do'konlari uchun bir sahifali sayt.

- **Intro:** kamera bulutlar orasidan shaharga tushadi, keyin filialni tanlaysiz.
- **Do'konga kirish:** skroll bilan osmondan fasadga, kun kechga aylanib, do'kon ichiga.
- **Kiyib ko'rish (Andijon):** bo'y va vazn tanlanadi, shunday gavdali odam kiyimlarni kiyib ko'rsatadi.
- **Katalog:** tanlangan do'kon mahsulotlari: narx, o'lcham, kategoriya bo'yicha filtr.
- **Aloqa:** uchala filial manzili va telefoni.

To'g'ridan-to'g'ri havolalar: `#andijon`, `#shahrixon`, `#asaka`.

## Ochish

`index.html` ni brauzerda oching. Build kerak emas. Shriftlar Google Fonts'dan yuklanadi.

## Tuzilishi

```
index.html        sahifa
style.css         dizayn
app.js            intro, skroll animatsiyasi, katalog
assets/data.js    mahsulotlar ro'yxati
assets/filial/    filial rasmlari
assets/mahsulot/  mahsulot rasmlari
assets/video/     Higgsfield videolari (intro, do'kon kliplari, kiyib ko'rish)
assets/kiyim/     kiyib ko'rish rasmlari (har gavda: model + 3 obraz) va fon
assets/kadr/      telefon uchun kino kadrlari (har klip — WebP kadrlar, ro'yxati kadrlar.json)
```

Telefonda (tik ekran) kino video emas, `assets/kadr/` dagi kadrlar bilan suriladi — iPhone (Safari, Telegram
ichidagi brauzer) va quvvat tejash rejimida video skroll bilan surilmaydi. Kadrlarni
`python skriptlar/kliplarni_joylash.py` yasaydi (asosiy loyihada).

Do'kon kliplari (`assets/video/andijon_A.mp4`, `_B`, `_C` … ketma-ket, kamida A–D) qo'shilsa, sayt rasmli animatsiya
o'rniga avtomatik ravishda videolarni o'ynatadi. Kiyib ko'rishda `{gavda}_tanlash.mp4` bo'lsa videolar, bo'lmasa
`assets/kiyim/` dagi rasmlar ko'rsatiladi.
