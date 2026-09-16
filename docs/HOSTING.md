# Hosting dengan prioritas Rp0

Paket sudah bisa dijalankan lokal. Panduan ini untuk tahap ketika Anda ingin membukanya melalui internet. Belum ada akun provider, database cloud, pengirim Gmail atau deployment yang dibuat otomatis.

## Pilihan paket ini

| Komponen | Pilihan | Batas yang perlu dipahami |
|---|---|---|
| Aplikasi React + FastAPI | Render Web Service Free (Docker) | Bisa tidur setelah idle; startup kembali tidak seketika; kuota penggunaan berlaku |
| Database | Supabase PostgreSQL Free | 500 MB database; dapat pause setelah satu minggu tidak aktif; kuota dapat berubah |
| Email pengingat | Google Apps Script / MailApp | Kuota akun consumer, izin akun dan deployment perlu disiapkan |
| Domain aplikasi | Subdomain bawaan hosting | Tidak perlu membeli domain sendiri |

Cloudflare Pages saja tidak dapat menjalankan backend Python ini. Jangan mengunggah hanya `frontend/dist` lalu menganggap login/database ikut bekerja. Paket ini sengaja memakai satu origin frontend/API untuk mempertahankan cookie sesi dan mengurangi konfigurasi.

## 1. Siapkan akun dan data lokal

- Jalankan paket dan pastikan login demo serta data sesuai.
- Ganti password awal melalui Pengaturan → Data & keamanan → Ganti password.
- Unduh backup JSON pengguna dan jalankan backup_database.py.
- Tutup aplikasi selama migrasi awal agar titik snapshot jelas.

## 2. Buat PostgreSQL gratis

1. Buat proyek Supabase pada Free plan. Pilih wilayah yang dekat dengan pengguna.
2. Buka Connect, salin URI **Session pooler (port 5432)**. Session pooler mendukung IPv4; tidak perlu membeli IPv4 add-on.
3. Isi password database pada URI, dengan URL-encoding jika mengandung karakter khusus. Tambahkan `sslmode=require`.
4. Simpan `DATABASE_URL` dalam `.env` lokal (jangan commit):

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT:PASSWORD@HOST_POOLER:5432/postgres?sslmode=require
```

Gunakan URI asli dari dashboard; contoh di atas bukan koneksi yang bisa langsung digunakan.

5. Dari folder proyek jalankan:

```powershell
.\.venv\Scripts\python.exe migrate_postgres.py
```

Skrip membuat schema privat `arus_app`, memasukkan users dan states, serta mempertahankan ID pengguna, hash password, revisi dan JSON keuangan. Sesi login dan token lama tidak dipindahkan. Skrip **menolak menimpa database yang sudah mempunyai pengguna**. Tidak ada import data asli otomatis saat deployment.

Supabase Auth tidak dipakai. Browser tidak memegang kunci admin atau URI PostgreSQL. Tabel schema khusus mengaktifkan RLS tanpa policy untuk pengguna browser. Backend pemilik schema menjalankan akses data, dengan validasi sesi dan kepemilikan pada layanan aplikasi. Jangan menambahkan schema ini ke daftar exposed schemas pada Supabase API.

Catatan kapasitas: model state per pengguna dan global serialization mempertahankan konsistensi pada pilot kecil; bukan desain untuk banyak replica/request paralel besar. Jalankan satu worker Uvicorn seperti konfigurasi bawaan.

## 3. Upload kode, bukan database

Push source ke repository GitHub pribadi dari komputer Anda. Periksa `git status` sebelum commit. Jangan memasukkan:

- `.env` atau `config.json`;
- folder `data/` dan `original-backups/`;
- file SQLite/backup, sesi, token, password aplikasi Gmail.

`.gitignore` telah disertakan. Jangan upload ZIP pribadi secara manual ke repository publik karena aturan ignore tidak berlaku untuk unggahan manual.

## 4. Buat Render Web Service

1. Hubungkan repository, pilih runtime **Docker**, plan **Free**. Gunakan Dockerfile yang disertakan.
2. Isi environment:

| Variabel | Nilai |
|---|---|
| `DATABASE_URL` | URI Supabase yang sama, dengan TLS |
| `ARUS_HOST` | `0.0.0.0` |
| `ARUS_APP_URL` | URL HTTPS layanan Anda, tanpa slash terakhir |
| `ARUS_ALLOW_REGISTER` | `false` untuk pilot pribadi |
| `ARUS_SCHEDULER` | `false` jika menggunakan trigger Apps Script |
| `GMAIL_GATEWAY_URL` | URL `/exec` script yang sudah di-deploy |
| `GMAIL_GATEWAY_SECRET` | Secret gateway minimal 32 karakter |
| `ARUS_CRON_SECRET` | Secret scheduler berbeda, minimal 32 karakter |

Render menentukan PORT; run.py membacanya. Untuk konfigurasi Blueprint, tersedia render.yaml; tinjau plan dan variabel sebelum menyetujui deployment. Tidak ada resource berbayar yang dideklarasikan.

3. Deploy. Buka URL, login dengan akun yang dimigrasikan.
4. Konfigurasi Apps Script sesuai GMAIL.md. Jangan pakai SMTP Gmail pada Render Free karena port SMTP diblokir.

**Wajib DATABASE_URL untuk cloud.** Disk lokal Render Free bersifat sementara. Data SQLite yang disimpan di dalam container dapat hilang ketika restart/redeploy; data yang harus bertahan disimpan di PostgreSQL. Dockerfile tidak membawa data pribadi dan aplikasi menolak mode cloud tanpa DATABASE_URL, kecuali Anda secara eksplisit memilih disk lokal persisten pada lingkungan yang Anda kelola.

## 5. Uji setelah deploy

- Login, periksa jumlah transaksi/anggaran/sumber uang dan saldo.
- Catat satu transaksi percobaan, edit, lalu hapus; pastikan laporan dan saldo kembali sesuai.
- Buat backup JSON dan uji restore pada akun/data percobaan, bukan langsung mengganti data penting.
- Tes email dan satu jadwal pengingat. Pastikan konfirmasi lengkap menghentikan pengingat hari itu.
- Restart/redeploy dan periksa bahwa catatan tidak hilang.
- Pastikan file .env/database tidak dapat diunduh melalui URL web.

## Maintenance

Backup teratur dari komputer Anda dengan `backup_database.py` saat DATABASE_URL menunjuk PostgreSQL; salinan backend di disk Render bukan cadangan tahan lama. Uji pemulihan pada database/proyek kosong. Periksa kuota, error dan riwayat email mingguan. Pendaftaran hanya dibuka bila Anda siap mengelola pengguna baru dan verifikasi penerima email ditingkatkan.

Paket tidak menjanjikan uptime atau pengingat tepat menit pada layanan gratis. Jangan mengaktifkan upgrade berbayar otomatis. Jika provider meminta pembayaran/verifikasi yang tidak bisa dipenuhi, lanjutkan mode lokal sambil memilih provider yang sesuai.

Referensi resmi (diperiksa saat penyusunan):
- https://render.com/docs/free
- https://render.com/docs/docker
- https://supabase.com/pricing
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://developers.google.com/apps-script/guides/services/quotas
