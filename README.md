# Arus Modern 2.0

Aplikasi keuangan pribadi dengan React + TypeScript, FastAPI, SQLite lokal, dan adapter PostgreSQL untuk hosting. Dibangun dari Arus Lokal v1.3 dan draft spesifikasi yang disertakan, dengan login username yang dipertahankan sesuai permintaan.

## Mulai di Windows

1. Ekstrak seluruh ZIP, misalnya ke `D:\Belajar\Arus-Modern`. Jangan menjalankan dari dalam ZIP.
2. Pasang Python 3.10 atau lebih baru dari https://www.python.org/downloads/windows/ (disarankan 3.12). Aktifkan Python Launcher saat instalasi.
3. Klik dua kali `MULAI-WINDOWS.bat`. Pertama kali perlu internet untuk mengunduh dependency. Environment dibuat di folder proyek, sehingga bisa ditempatkan di D:.
4. Saat terminal menampilkan `Uvicorn running`, buka **http://127.0.0.1:8765**.
5. Masuk dengan **username `demo`**, **password `demo123456`**.
6. Biarkan terminal terbuka. Tutup dengan Ctrl+C setelah selesai.

Frontend hasil build sudah disertakan. **Node.js tidak diperlukan untuk pemakaian lokal biasa.** Jangan membuka `frontend/dist/index.html` dengan klik dua kali; aplikasi membutuhkan server.

Jika memilih terminal PowerShell:

```powershell
cd D:\Belajar\Arus-Modern\arus-modern
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

Sesuaikan `cd` dengan folder yang benar-benar berisi `run.py`.

macOS/Linux: `sh mulai-macos-linux.sh`. Saat muncul masalah `venv`, pasang dukungan venv melalui pengelola Python/OS Anda.

## Akun dan isi yang dibawa

Pemeriksaan ZIP menemukan dua database, keduanya mempunyai username **magangmedan**, bukan demo. Salinan terbaru memiliki revisi 127, 33 transaksi, 5 anggaran, 2 sumber uang (SEABANK dan Cash), 3 label, dan 1 rencana. Salinan awal hanya 3 transaksi dan 11 anggaran.

Paket baru memakai **isi terbaru**, dengan ID pengguna yang sama, lalu username/password pada salinan kerja disesuaikan menjadi `demo` / `demo123456` sesuai permintaan. Seluruh JSON keuangan, termasuk riwayat dan preferensi, dibandingkan dan dipertahankan persis. Sesi, token, antrean deduplikasi, snooze, dan log pengiriman lama pada salinan kerja dibersihkan supaya tidak membawa sesi login lama.

Cadangan asli keduanya ada di `original-backups/awal.sqlite3` dan `original-backups/terbaru.sqlite3`. Database asli tersebut tidak diubah. Jangan mencampur dua database; anggaran pada versi awal bisa merupakan pengaturan lama yang sudah diganti pengguna.

ZIP ini bersifat pribadi karena berisi data keuangan dan hash password. Jangan upload seluruh ZIP/data/cadangan ke repository publik. `.gitignore` dan `.dockerignore` sudah mengecualikannya, tetapi tidak melindungi jika diunggah manual melalui website.

## Yang tersedia

- React + TypeScript dengan tujuh halaman: Beranda, Transaksi, Anggaran, Analisis, Pemeriksaan, Rencana, Pengaturan.
- Tampilan hijau-krem, sidebar, kartu saldo, grafik kategori, ikon SVG, mode gelap/terang, layout responsif.
- Animasi halaman, dialog, bar grafik, dan panel login; mengikuti preferensi sistem `prefers-reduced-motion`.
- Login username/password, cookie HttpOnly, CSRF, ganti password, logout, pemulihan via email akun bila email tersedia. Pendaftaran ditutup secara default untuk pilot pribadi.
- Pendapatan, pengeluaran, transfer, refund tertaut, penyesuaian saldo beralasan, edit/hapus, kategori/label, sumber uang/arsip.
- Filter periode, akun, jenis, kategori, label dan pencarian; laporan, grafik, ekspor CSV mengikuti filter.
- Anggaran, konfirmasi harian, snooze, pengingat Gmail opt-in, email percobaan, tautan berhenti berlangganan dengan konfirmasi POST.
- Draft anggaran, penghematan, evaluasi periode, edit alokasi dan penerapan setelah persetujuan. Kalkulasi tanpa model diberi label **Perhitungan otomatis**.
- AI Ollama lokal opsional; backend tidak mengirim data ke provider AI cloud.
- Backup/restore JSON, backup database penuh, Docker, migrasi PostgreSQL satu kali, contoh konfigurasi hosting gratis.

## Teknologi dan alasan

| Bagian | Implementasi |
|---|---|
| UI | React, TypeScript, Vite, Lucide, CSS responsif dan animasi |
| HTTP server | FastAPI + Uvicorn |
| Aturan bisnis | Domain Python dari versi lama, dipertahankan dan diuji |
| Data lokal | SQLite, tanpa cloud/database tambahan |
| Data hosting | PostgreSQL; bisa Supabase Free |
| Login | Username/password aplikasi; bukan Supabase Auth |
| Gmail lokal | SMTP STARTTLS + Google App Password |
| Gmail hosting | Gateway HTTPS Google Apps Script + MailApp |

Ini berbeda dari usulan React + Supabase Auth sebelumnya: Supabase Auth tidak digunakan supaya login username dan ID/data lama tidak harus dibangun ulang sebagai identitas email. Pada mode hosting, Supabase hanya dipakai sebagai PostgreSQL. FastAPI menjadi transport baru yang mengadaptasi layanan bisnis lama, bukan menulis ulang semua aturan finansial.

Model data masih berupa state JSON per pengguna yang disimpan di database. Belum merupakan normalisasi penuh tabel accounts/transactions dari draft. Transfer dan seluruh mutasi disimpan atomik; backend memvalidasi referensi milik pengguna, dan pembaruan memakai revision. Cocok untuk pilot kecil, bukan klaim arsitektur skala besar. Batas domain lama (20.000 transaksi per pengguna) tetap berlaku.

## Gmail dan hosting

- Konfigurasi pengirim: **docs/GMAIL.md**.
- Hosting gratis dan migrasi data: **docs/HOSTING.md**.
- Pengujian dan batas yang belum terverifikasi: **docs/VALIDASI.md**.
- Acuan awal: **docs/SPESIFIKASI-ASAL.md**.

Tanpa konfigurasi pengirim, **email tidak dikirim ke Gmail**. Email keamanan lokal dapat masuk `data/outbox/*.eml`; ini bukan Inbox Gmail. Tidak ada App Password, token Gmail, atau config.json dari ZIP lama yang disalin ke paket baru.

## Pengembangan frontend

Untuk mengubah sumber React, gunakan Node.js 22+:

```powershell
cd frontend
npm ci
npm run build
```

Setelah build, jalankan server kembali atau refresh halaman. Untuk dev, server FastAPI tetap berjalan pada port 8765, lalu jalankan `npm run dev` di terminal kedua. Gunakan URL yang ditampilkan Vite; proxy API mengarah ke FastAPI. Mode produksi menjalankan frontend dan API di origin yang sama sehingga cookie tidak membutuhkan CORS lintas domain.

## Backup dan pemulihan

Backup per pengguna: Pengaturan → Data & keamanan → Unduh backup JSON. Pulihkan melalui halaman yang sama dan konfirmasi password. Restore mengganti catatan akun, mempertahankan login, mematikan pengingat serta izin AI, dan membuang draft hasil AI.

Backup penuh SQLite: jalankan `python backup_database.py` menggunakan Python di `.venv`. Simpan hasil dari `data/backups` di perangkat/lokasi pribadi lain. Untuk memulihkan SQLite penuh: hentikan aplikasi, simpan folder data saat ini sebagai cadangan, buat folder data baru, lalu salin snapshot sebagai `data/arus.sqlite3`. Jangan mengganti file ketika aplikasi berjalan; jangan membawa berkas WAL/SHM dari database lain.

Saat `DATABASE_URL` terisi, skrip backup membuat JSON berisi users dan states dari PostgreSQL (termasuk hash password, tanpa sesi/token). Pemulihan akun tunggal paling mudah lewat backup JSON dari UI; pemulihan penuh PostgreSQL tersedia melalui `restore_postgres.py` dan hanya menerima database kosong. Backup penuh tidak terenkripsi otomatis; lindungi dengan penyimpanan terenkripsi yang Anda kelola.

## Masalah umum

- `py` tidak dikenali: pasang Python beserta launcher, kemudian buka terminal baru.
- Port 8765 dipakai: tutup Arus yang lama atau ubah `PORT` dan `ARUS_APP_URL` di `.env`, kemudian buka port tersebut.
- Halaman masih desain lama: pastikan menjalankan `run.py` dari folder paket ini dan refresh browser.
- Nama akun lama tidak bisa login: paket baru memakai `demo`. Cadangan asli tetap memakai username lama.
- Muncul “Data berubah”: muat ulang untuk mengambil revisi terbaru sebelum mengedit lagi.
- Salah konfigurasi `.env`: periksa nama variabel dan restart aplikasi.
- Lupa password pada akun tanpa email pemulihan: tidak ada email yang dapat dikirimi tautan. Jangan menganggap email pengingat otomatis menjadi email pemulihan.
- Email tidak masuk: lihat konfigurasi pengirim, uji email, cek Spam/kuota. Di hosting gratis gunakan HTTPS, bukan SMTP bila port diblokir.

## Batas yang tetap berlaku

Tidak ada integrasi rekening sungguhan, OCR, transaksi otomatis, aplikasi native, sinkronisasi offline, atau AI cloud gratis yang diam-diam memproses data asli. Jadwal email tidak dijamin tepat menit. Server lokal harus aktif; hosting gratis bisa tidur. Penerima pengingat mengikuti perilaku versi lama (email manual opt-in, belum ada verifikasi penerima terpisah). Karena itu pendaftaran publik ditutup secara default dan paket diarahkan untuk pilot pribadi.

Sebelum hosting, ganti password awal lewat Pengaturan. Aktifkan backup, uji restore dan email nyata. Panduan hosting belum berarti akun cloud sudah dibuat atau aplikasi sudah dipublikasikan.
