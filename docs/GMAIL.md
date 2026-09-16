# Pengingat Gmail

Login tetap username/password. Email pengingat terpisah dan mengikuti preferensi data lama. Tidak perlu menjadikan Gmail sebagai metode login.

## A. Lokal: Gmail SMTP

1. Salin `.env.example` menjadi `.env` di folder yang berisi `run.py`. Pastikan bukan `.env.txt`.
2. Pada akun Google pengirim, aktifkan 2-Step Verification dan buat App Password. Opsi ini bisa tidak tersedia pada akun yang dibatasi administrator atau pengaturan keamanan tertentu. Jangan memakai password Gmail utama.
3. Isi:

```dotenv
ARUS_APP_URL=http://127.0.0.1:8765
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_USERNAME=alamat-pengirim@gmail.com
SMTP_PASSWORD=APP_PASSWORD_ANDA
SMTP_FROM=alamat-pengirim@gmail.com
```

4. Restart Arus. Pengaturan → Profil & Gmail → isi email tujuan, aktifkan pengingat, pilih jam/hari, simpan.
5. Klik **Kirim email percobaan**. Periksa Inbox dan Spam. Tombol ini benar-benar mengirim email saat pengirim dikonfigurasi.

Pengingat lokal hanya berjalan selama server dan komputer aktif. Tautan localhost hanya dapat digunakan di komputer yang menjalankan aplikasi; setelah hosting gunakan URL HTTPS publik.

Panduan resmi Google: https://support.google.com/accounts/answer/185833

## B. Hosting gratis: gateway HTTPS Google Apps Script

Render Free memblokir port SMTP keluar. Gateway ini memakai HTTPS sehingga tidak bergantung pada koneksi SMTP dari Render. Ia mengirim melalui akun Google yang memberikan izin pada script. Tidak membutuhkan pembelian domain pengirim.

### Buat script pengirim

1. Buka https://script.google.com/ dengan akun Google pengirim. Buat proyek baru, misalnya `Arus Gmail`.
2. Salin seluruh isi `email/GmailGateway.gs` ke editor `Code.gs`.
3. Buat dua secret berbeda menggunakan perintah berikut, jalankan dua kali pada komputer sendiri:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(40))"
```

4. Project Settings → Script Properties, tambahkan:

| Nama | Nilai |
|---|---|
| `GATEWAY_SECRET` | Secret pertama, minimal 32 karakter |
| `CRON_SECRET` | Secret kedua, minimal 32 karakter |
| `ARUS_URL` | URL HTTPS hosting Arus, tanpa slash terakhir |

5. Pilih fungsi `otorisasiPengirim`, Run, dan selesaikan pemberian izin pada akun Anda. Fungsi ini memeriksa kuota; tidak mengirim email.
6. Deploy → New deployment → Web app. Execute as: akun Anda. Who has access: Anyone, bila pilihan ini tersedia untuk akun Anda. Endpoint tetap memeriksa tanda tangan HMAC; URL saja tidak cukup untuk mengirim email. Jika kebijakan akun melarang deployment ini, gunakan akun/penyedia yang mendukung atau jalur SMTP di hosting yang mengizinkannya.
7. Salin URL deployment yang berakhir `/exec`, bukan `/dev`. Jangan membagikan secret.

### Hubungkan ke backend

Pada environment hosting, isi:

```dotenv
GMAIL_GATEWAY_URL=https://script.google.com/macros/s/ID_DEPLOYMENT/exec
GMAIL_GATEWAY_SECRET=SECRET_PERTAMA
ARUS_CRON_SECRET=SECRET_KEDUA
ARUS_APP_URL=https://URL_ARUS_ANDA
ARUS_SCHEDULER=false
```

Simpan dan redeploy/restart. Masuk ke Arus, atur preferensi, lalu kirim email percobaan. Nilai gateway harus ada pada server, tidak di bundle React. Untuk mode ini, SMTP boleh dibiarkan kosong.

### Jadwalkan pengingat

1. Di Apps Script, jalankan `periksaPengingat` sekali untuk meminta izin fetch jika diperlukan.
2. Triggers → Add trigger → `periksaPengingat` → Time-driven → Minutes timer → Every 15 minutes.
3. Script meminta backend memeriksa hari/jam/zona/status pengguna. Backend hanya menyiapkan email bila jatuh tempo dan belum lengkap, kemudian mengirim lewat gateway yang sudah ditandatangani.

Ini tugas pengingat nyata, bukan jaminan server terus aktif. Jangan menambahkan ping terpisah untuk menghindari aturan idle hosting. Saat server bangun dari tidur, panggilan bisa lambat/gagal. Jadwal berikutnya akan mencoba pemeriksaan lagi, sedangkan email berstatus tidak pasti tidak diulang otomatis agar tidak menduplikasi pesan.

Pemindai tautan email tidak dapat mengubah status: aksi memerlukan halaman konfirmasi dan POST. Nominal serta saldo tidak dimasukkan dalam pesan. Snooze maksimal sekali pada hari yang sama, setelah pengingat utama berhasil diserahkan ke pengirim.

## Kuota dan diagnosis

Dokumentasi Google mencantumkan kuota akun consumer 100 penerima email/hari; kuota mengikuti akun dan bisa berubah. Gateway menyisakan 5 penerima untuk kebutuhan lain; backend membatasi pengingat 50/hari secara default. Akun pengirim yang juga dipakai script lain berbagi kuota.

- Pengirim dikonfigurasi tidak sama dengan keterkiriman terbukti. Gunakan email percobaan.
- Periksa Apps Script → Executions untuk kegagalan izin/kuota/deployment.
- URL harus deployment `/exec`, secret harus sama persis, jam perangkat/server harus benar.
- HMAC memakai timestamp dan nonce. Jangan mencetak payload/secret di log.
- Setelah mengubah kode Apps Script, perbarui deployment ke versi baru.
- `sent` berarti layanan pengirim menerima pesan, bukan bukti masuk Inbox.
- Bounce yang datang belakangan tidak diproses otomatis pada adapter Gmail ini. Pemilik perlu meninjau akun pengirim dan mematikan pengingat alamat bermasalah.

Referensi resmi:
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/triggers/installable
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/reference/mail/mail-app
- https://render.com/docs/free
