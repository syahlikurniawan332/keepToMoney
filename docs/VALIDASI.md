# Catatan validasi Arus Modern 2.0

## Lulus pada lingkungan pembuatan

- 34 pengujian Python: domain, layanan API lama yang diadaptasi, dan FastAPI.
- 8 pengujian frontend: 3 perhitungan/filter dan 5 alur React melalui jsdom.
- Build produksi TypeScript + Vite.
- Server HTTP nyata: halaman utama 200, login demo 200, dan 33 transaksi dapat dibaca memakai salinan database sementara.
- Login salinan kerja `demo` / `demo123456` cocok dengan hash password.
- JSON state keuangan salinan kerja cocok persis dengan database sumber terbaru.
- 33 transaksi, 5 anggaran, 2 sumber uang, 3 label, dan 1 rencana dipertahankan.
- Akun/session/CSRF, password change, akses silang pengguna, transfer atomik, klik ganda, konflik revisi, refund dan koreksi saldo.
- Restore JSON, cadangan sebelum restore, CSV formula injection dan filter.
- Pengingat ganda, hari lengkap tanpa pengingat, unsubscribe dan fallback AI memakai mock; tidak mengirim email sungguhan.
- Alur React: login, buka tujuh halaman, tambah transaksi dengan nominal integer dan label, filter/reset, preferensi pengingat, mode gelap dan editor anggaran.

## Belum terverifikasi

- **Pemeriksaan visual pada browser desktop/HP nyata.** Upaya koneksi browser pengujian tidak berhasil; jsdom menguji interaksi komponen, bukan layout pixel atau animasi yang benar-benar dirender. CSS responsif dan reduced-motion sudah ditulis, namun screenshot visual final belum diverifikasi.
- PostgreSQL/Supabase langsung: adapter, schema dan skrip migrasi tersedia, tetapi tidak ada database cloud yang dikonfigurasi untuk pengujian. Uji migrasi, backup/restore dan restart setelah deploy sesuai HOSTING.md.
- Pengiriman Gmail nyata, izin Apps Script dan jadwal di cloud: belum ada pengirim pengguna yang dikonfigurasi; SMTP/AI pada tes memakai mock.
- Docker build dan deployment provider nyata belum dijalankan. Dockerfile dan contoh Render disertakan sebagai konfigurasi, bukan bukti deployment berhasil.
- Peluncur .bat belum dijalankan pada Windows; jalur Python/server diuji pada Linux.
- AI Ollama nyata: tidak ada model yang dijalankan dalam verifikasi ini.

Paket adalah hasil implementasi lokal yang telah melalui tes fungsi dan build. Batas di atas harus diperiksa sebelum mempercayakan data penting pada hosting publik. Aplikasi tidak dinyatakan sebagai implementasi lengkap seluruh usulan normalisasi/RLS per entitas dan verifikasi email penerima dalam draft.

## Menjalankan ulang tes

Instal requirements-dev.txt untuk tes Python:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
$env:PYTHONPATH = "backend"
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Tes memakai database sementara. Satu tes preservasi memeriksa bahwa paket awal masih memuat data sumber dan password awal; setelah Anda mengubah data/password secara sah, tes preservasi paket itu tidak lagi diharapkan lulus.

```powershell
cd frontend
npm ci
npm test
npm run build
```

Tes React memakai data fiktif dan API mock; tes FastAPI terpisah memeriksa logika server asli.

## Perbedaan penting dari draft

Login username dipertahankan atas permintaan pengguna, bukan dipindah ke Supabase Auth. PostgreSQL memakai schema privat dan state JSON per pengguna. Pengingat tetap memakai alamat manual opt-in seperti versi lokal; verifikasi penerima terpisah serta webhook bounce belum ditambahkan. Pendaftaran default ditutup, sehingga paket ditujukan untuk pilot pribadi. AI lokal tetap opsional, bukan janji AI cloud gratis.
