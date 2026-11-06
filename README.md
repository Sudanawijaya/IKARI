# IKARI

**Intelligent Knowledge Assistant for Real-time Interaction**

Alamat produksi: https://hikari.my.id/ikari/

Aplikasi web location-based AR memakai LocAR.js dan Three.js. Model `src/models/karakter_anim_fix.mobile.glb` ditempatkan pada 15 titik: empat titik konten Penglipuran berikut, empat titik Kampus INSTIKI, dan tujuh titik Bajra Sandhi Renon:

- Bamboo Forest
- Pura Penataran
- Pura Puseh
- Bale Banjar Adat

Koordinat berada di `src/locations.ts`. Ganti nilai `longitude`, `latitude`, `altitude`, atau `scale` di file itu untuk memakai titik hasil survei lapangan.

Model GLB hanya dibuat dan dirender saat posisi pengguna berada dalam radius 50 meter dari sebuah lokasi. Saat pengguna keluar dari radius, marker lokasi dilepas dari scene untuk mengurangi kerja GPU.

## Menjalankan

Siapkan konfigurasi backend:

```bash
cp .env.example .env
```

Isi `OPENAI_API_KEY` di `.env`. `OPENAI_MODEL` dan
`OPENAI_TRANSCRIBE_MODEL` mengikuti default backend dan dapat disesuaikan dengan
akses model akun. File `.env` hanya untuk server PHP dan diabaikan oleh Git.
Untuk lokasi konfigurasi khusus, atur `OPENAI_ENV_FILE` pada environment
server/PHP, bukan di dalam `.env`. Endpoint AI membutuhkan PHP dengan cURL;
server pengembangan Vite sendiri tidak menjalankan endpoint PHP.

```bash
npm install
npm run dev
```

Buka URL HTTPS dari Vite di browser. Tekan `Mulai AR` dan izinkan kamera serta lokasi. Model muncul dalam radius 50 meter dari lokasi yang tersedia.

## Build

```bash
npm run build
```

LocAR.js membutuhkan kamera, GPS, dan sensor orientasi perangkat. Browser mobile yang paling aman untuk dicoba adalah Chrome Android atau Safari iOS terbaru, melalui HTTPS.

## Perbaikan izin browser (27 Oktober 2026)

Entry HTML saat ini memakai aplikasi produksi `assets/index-instiki-20261027-v011.js`.
Aplikasi produksi memiliki fitur bahasa/audio/AI yang belum tersinkron ke `src/main.ts`;
jangan mengganti entry HTML dengan sumber TypeScript lama sebelum rekonsiliasi fitur.
Patch yang dapat diulang tersimpan di `scripts/patch-permissions.mjs`, dengan baseline
`assets/index-BQsOLZTj.js` dan helper `src/permission-support.js`.
Jalankan `node scripts/patch-permissions.mjs` setelah mengubah helper/patch, kemudian
`node --test tests/permissions.test.mjs`, `npm run typecheck`, dan `npm run build`.
Build mengikuti entry produksi dan menghasilkan artefak di `dist`.

Kamera menunggu event webcam dengan batas 30 detik. GPS dimulai setelah kamera siap;
izin mikrofon hanya diperlukan ketika pengguna memakai fitur rekam suara. Sensor dan
audio tidak menahan startup. Tombol `Coba GPS lagi` mengulang lokasi setelah izin
situs/perangkat diperbaiki. Galat GPS asli dicatat di console; tampilan membedakan
penolakan izin, kebijakan halaman, dan lokasi yang belum ditemukan.

Verifikasi manual pada Chrome Android dan Safari iOS: izinkan kamera/lokasi;
tolak mikrofon; abaikan prompt sensor; tolak lokasi kemudian izinkan dan tekan
`Coba GPS lagi`; pastikan kamera tetap terlihat dan posisi diperbarui setelah izin
lokasi tersedia. Izin layanan lokasi perangkat tidak dapat diubah oleh situs.

## Versi 0.1.1 — 27 Oktober 2026

Menambahkan lokasi kelima, Kampus INSTIKI, pada latitude -8.690967406553824
 dan longitude 115.22675901260102. Deskripsi Indonesia dan Inggris tersedia
melalui pilihan bahasa dan suara yang sudah ada. Data kampus disimpan di
`src/instiki-location.json` dan dipakai oleh sumber TypeScript serta patch produksi.
Ringkasan profil mengacu pada situs resmi https://instiki.ac.id/; koordinat berasal
 dari pengguna. Build aplikasi: `0.1.1 (20261027-instiki-1)`.

## Identitas dan homepage IKARI

Homepage responsif di `index.html`, `src/home.css`, dan `src/home.js` menyediakan
panduan penggunaan, informasi izin, dan terjemahan ID/EN. Identitas runtime
produksi diperbarui melalui `scripts/patch-permissions.mjs`; nama Penglipuran
pada konten lokasi tetap dipertahankan karena merupakan nama tempat.

Domain memakai DocumentRoot `/opt/lampp/htdocs/landingpage/dist`. Symlink
`/opt/lampp/htdocs/landingpage/dist/ikari -> ../ikari` memetakan aplikasi beserta
`api/ask.php` ke `/ikari/` tanpa perubahan konfigurasi global Apache.
`.htaccess` aplikasi mengalihkan HTTP ke HTTPS dan mendukung terminasi TLS
melalui proxy. Aturan canonical dan `RewriteOptions AllowNoSlash` di `.htaccess` aplikasi memastikan
URL tanpa slash langsung menuju `https://hikari.my.id/ikari/`.
Pertahankan symlink tersebut ketika membangun ulang situs induk.

`npm run build` menghasilkan frontend statis di `ikari/dist`; produksi saat ini
melayani entry root agar endpoint PHP dan data tetap tersedia. Untuk deployment
terpisah, sertakan backend PHP serta konfigurasi lingkungannya di server.

## Ukuran karakter dan box lokasi

Buka “Ukuran karakter & box lokasi” di panel AR. Slider dan tombol −/+
mengatur karakter 25–300% serta label AR dan teks informasi lokasi 50–200%
secara terpisah. “Reset ukuran” mengembalikan keduanya ke 100%. Preferensi
disimpan lokal pada browser dan diterapkan juga pada marker yang baru muncul.
Implementasi di `src/scale-controls.js`, disertakan oleh patch produksi.

## Bajra Sandhi Renon — 5 November 2026

Tujuh titik berikut memakai knowledge khusus Bajra Sandhi dalam bahasa Indonesia
serta Inggris. Tema adalah konten pemandu AR, bukan klaim posisi fasilitas fisik.

| Titik | Latitude | Longitude | Tema |
| --- | --- | --- | --- |
| 1 | -8.672868351696374 | 115.23384711212623 | Mengenal Bajra Sandhi |
| 2 | -8.672445937077676 | 115.23388304399937 | Arsitektur monumen |
| 3 | -8.671835218930186 | 115.23488367414298 | Diorama sejarah Bali |
| 4 | -8.67134548900151 | 115.23394317723586 | Semangat perjuangan |
| 5 | -8.67174214721078 | 115.2334948461674 | Olahraga dan rekreasi Renon |
| 6 | -8.671692468334053 | 115.23243875265804 | Bajra Sandhi dan sejarah Denpasar |
| 7 | -8.6710411144807 | 115.23395601447717 | Kegiatan dan kunjungan |

Area aktif mengikuti radius **50 meter dari masing-masing titik**, bukan seluruh
batas administratif lapangan. Marker mengikuti aturan radius yang sudah ada.
Saat mengirim pertanyaan suara, browser mengambil posisi GPS baru dan mengirim
`latitude`, `longitude`, `locationId`, serta `language` bersama audio.
Endpoint `api/ask.php` juga menerima pertanyaan teks melalui JSON dengan field
`question` dan field lokasi yang sama.

`api/location-knowledge.php` memeriksa koordinat terhadap titik Bajra Sandhi yang
dipilih sebelum transkripsi atau permintaan AI. Koordinat kosong/tidak valid atau
di luar radius menghasilkan HTTP 403; ID Bajra Sandhi yang tidak dikenal
menghasilkan HTTP 400. Validasi ini bergantung pada koordinat yang dilaporkan
browser, bukan bukti keberadaan fisik yang tahan pemalsuan GPS.

Di titik Bajra Sandhi, AI diarahkan hanya menjawab tentang Bajra Sandhi Renon dan
Kota Denpasar: sejarah, budaya, wisata, kegiatan, serta informasi lokal terkait.
Pertanyaan di luar topik, termasuk permintaan campuran dengan tugas yang tidak
terkait, diarahkan mendapat penolakan. Pembatasan topik menggunakan instruksi
model. Fakta yang belum ada, jadwal acara terkini, harga tiket, dan jam buka tidak
dikarang. Titik Penglipuran tetap menggunakan knowledge Penglipuran; titik INSTIKI menggunakan knowledge resmi INSTIKI.

Data koordinat, deskripsi, radius, dan sumber rujukan berada di
`data/bajra-sandhi-knowledge.json`, dipakai bersama oleh sumber TypeScript,
patch bundle produksi, dan backend. Sumber materi meliputi
[Dinas Pariwisata Denpasar](https://pariwisata.denpasarkota.go.id/artikel/munumen-bajrasandi),
[DJKN tentang Bajra Sandhi](https://www.djkn.kemenkeu.go.id/kpknl-denpasar/baca-artikel/13015/Mengenang-Perjuangan-Masyarakat-Bali-di-Monumen-Bajra-Sandhi.html),
[sejarah Kota Denpasar](https://denpasarkota.go.id/page/sejarah), dan sumber
kegiatan yang dicatat dalam array `sources` pada file knowledge.

Setelah mengubah data, jalankan `node scripts/patch-permissions.mjs` lalu
`npm run build` untuk memperbarui aplikasi produksi dan artefak `dist`.
Validasi perubahan ini cukup dengan typecheck, build, lint PHP, dan pemeriksaan
kasus geofence terarah. Pengujian suara/AI langsung serta GPS perangkat belum
dilakukan.

## Titik dan knowledge INSTIKI — 6 November 2026

Tiga titik tambahan memiliki deskripsi Indonesia/Inggris dari situs resmi INSTIKI:

| ID | Latitude | Longitude | Tema | Sumber |
| --- | --- | --- | --- | --- |
| instiki-1 | -8.690849490930324 | 115.22623692791757 | Sejarah INSTIKI | https://instiki.ac.id/faq/ |
| instiki-2 | -8.690900530606648 | 115.22655074637419 | Pendidikan di INSTIKI | https://instiki.ac.id/jurusan/ |
| instiki-3 | -8.690909147693624 | 115.22712742131374 | Bisnis Digital INSTIKI | https://instiki.ac.id/prodi-bisnis-digital/ |

Tema adalah konten AR, bukan penamaan gedung atau fasilitas pada koordinat tersebut.
Titik `kampus-instiki` sebelumnya tetap tersedia dan kini juga memakai knowledge
INSTIKI. Data tiga titik baru disimpan di `data/instiki-knowledge.json` dan
digunakan bersama oleh sumber TypeScript, patch produksi, serta backend.

Tanya jawab INSTIKI memerlukan GPS dalam radius 50 meter dari titik terpilih.
Setelah validasi lokasi, `api/instiki-source.php` mengambil halaman
`https://instiki.ac.id/` pada setiap permintaan pertanyaan (tanpa cache), dengan
batas waktu 12 detik, batas unduhan 2 MiB, dan maksimal 16.000 karakter konteks.
URL tetap, HTTPS, dan redirect dinonaktifkan agar pengambilan tidak beralih ke
situs lain. Jika sumber tidak dapat dibaca, endpoint mengembalikan HTTP 503,
bukan menggunakan sumber alternatif. PHP membutuhkan ekstensi cURL.

AI diarahkan hanya menjawab tentang INSTIKI menggunakan deskripsi terverifikasi
serta konten halaman resmi yang diambil, dan menyebutkan situs sumbernya.
Artikel umum pada situs kampus tidak memperluas topik yang diizinkan. Informasi
yang tidak tersedia dalam halaman yang diberikan dinyatakan belum tersedia;
halaman utama tidak menjamin cakupan seluruh isi situs atau semua pengumuman.
Deskripsi AR merupakan snapshot sumber resmi, sedangkan konteks halaman utama
diambil saat bertanya. Jadwal lama tidak boleh dianggap masih berlaku.

Pembaruan bundle: `node scripts/patch-permissions.mjs` lalu `npm run build`.
