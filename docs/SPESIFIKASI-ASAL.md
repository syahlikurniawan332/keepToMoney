# Draft Spesifikasi Aplikasi Keuangan Pribadi

Versi: 0.1 — bahan diskusi sebelum implementasi  
Tanggal: 14 September 2026  
Nama produk: belum ditentukan; “Arus” hanya nama pada contoh tampilan.

## 1. Ringkasan produk

Aplikasi web keuangan pribadi dengan pencatatan manual, kategori yang dapat disesuaikan, laporan mudah dibaca, pemeriksaan harian melalui email, serta bantuan AI untuk merencanakan anggaran dan penghematan.

Siklus utama: rencanakan → catat → periksa kelengkapan → evaluasi → sesuaikan.

Aplikasi tidak memegang atau memindahkan uang sungguhan. Saldo merupakan hasil pencatatan pengguna, bukan saldo resmi bank yang tersinkron. Target awal adalah penggunaan pribadi dan pilot kecil, terutama mahasiswa dewasa, pekerja muda, dan freelancer. Target komersial lebih luas belum ditetapkan.

### Prinsip

- Pengguna tetap memegang keputusan; AI menghasilkan saran atau draft.
- Angka dihitung dan divalidasi oleh kode/database, bukan dipercayakan kepada LLM.
- Kategori fleksibel; template awal tidak menjadi aturan permanen.
- Hari belum dicatat tidak otomatis berarti tidak ada transaksi.
- Antarmuka ringkas, grafik secukupnya, filter konsisten.
- Privasi dan kemampuan mengekspor data diutamakan.
- Target biaya Rp0; akses gratis berkuota tidak dianggap gratis tanpa batas.
- Pencatatan dan perhitungan tetap berjalan ketika AI gagal atau kuotanya habis.

## 2. Status keputusan

| Area | Status | Keputusan atau arah |
|---|---|---|
| Sumber transaksi | Disepakati | Manual; tidak menghubungkan rekening asli |
| Kategori | Disepakati | Template bawaan, bebas ditambah, diubah, dan dihapus/diarsipkan |
| Label | Disepakati | Opsional, lintas pendapatan/pengeluaran, dapat lebih dari satu |
| Output | Disepakati | Kalimat ringkasan, angka pendukung, sedikit diagram, filter berfungsi |
| Pengingat | Disepakati | Email; pemeriksaan harian, termasuk hari tanpa transaksi |
| WhatsApp | Ditunda | Pengembangan masa depan jika aplikasi sudah layak |
| Login | Arah rancangan | Email/password, verifikasi, email pengingat mengikuti email akun |
| AI utama | Arah rancangan | Anggaran, penghematan, evaluasi mingguan |
| Stack | Rekomendasi teknis | Vue, TypeScript, Hono, Supabase, Cloudflare |
| Pengiriman email publik Rp0 | Belum selesai | Domain/pengirim terverifikasi dan penyedia perlu dipastikan |
| AI data asli Rp0 | Belum selesai | Privasi provider dan kemampuan perangkat perlu diuji |
| Nama, logo, desain final | Belum diputuskan | Contoh dashboard bukan desain final |

Dokumen ini merangkum percakapan, bukan bukti implementasi. Rincian teknis tambahan di bawah merupakan usulan untuk menghindari ambiguitas sebelum coding.

## 3. Cakupan versi pertama

### Fondasi

1. Pendaftaran, verifikasi email, login, logout, dan lupa password.
2. Akun sumber uang: tunai, bank, e-wallet.
3. Saldo awal, pendapatan, pengeluaran, transfer antar-akun.
4. Kategori pengguna dan label opsional.
5. Riwayat transaksi dengan edit, hapus terkontrol, pencarian, dan filter.
6. Dashboard naratif dan laporan kategori/periode.
7. Anggaran buatan pengguna.
8. Status pemeriksaan harian dan email pengingat.
9. Ekspor data dan mekanisme backup/restore yang diuji.

### Lapisan AI

1. Draft rencana anggaran dari dana, kewajiban, dan preferensi.
2. Draft penghematan berdasarkan riwayat yang cukup.
3. Evaluasi mingguan terhadap rencana dan realisasi.

AI data asli baru diaktifkan setelah keputusan privasi dan kelayakan teknis selesai. Pengembangan AI dapat dimulai memakai data fiktif.

### Di luar versi pertama

- Integrasi bank/e-wallet, SNAP, aggregator rekening, dan pembacaan notifikasi Android.
- WhatsApp, Telegram, SMS, serta web push sebagai kanal pengingat.
- Aplikasi Android/iOS native.
- OCR struk, input suara, input bahasa alami massal.
- Chatbot bebas, investasi/trading, perpajakan, rekomendasi kredit.
- Akuntansi UMKM lengkap, organisasi dengan approval, shared wallet keluarga.
- Pelatihan model sendiri, vector database, dan sistem multi-agent.

## 4. Model akun dan sumber uang

Pengguna membuat akun seperti “Uang Tunai”, “BRI”, “DANA”. Data dasar: nama, tipe, mata uang, saldo awal, tanggal saldo awal, status aktif/arsip.

Tahap pertama menggunakan rupiah. Penyimpanan mata uang tetap disiapkan, tetapi konversi kurs bukan fitur MVP.

Saldo awal adalah titik awal pencatatan, bukan pendapatan pada laporan. Saldo terhitung = saldo awal + pendapatan − pengeluaran + transfer masuk − transfer keluar + penyesuaian eksplisit.

Usulan penting: tabungan tujuan tidak otomatis menjadi akun baru jika uangnya masih berada di rekening yang sama. Tujuan tabungan adalah alokasi dana; membuat akun bayangan dengan saldo yang sama akan menggandakan total uang.

Penyesuaian saldo digunakan bila catatan berbeda dari hitungan pengguna. Simpan tanggal dan alasan; jangan menyamarkannya sebagai gaji atau belanja. Perlakuan detail penyesuaian pada laporan perlu ditetapkan sebelum implementasi.

## 5. Transaksi

| Jenis | Dampak | Contoh |
|---|---|---|
| Pendapatan | Saldo akun bertambah | Gaji masuk ke BRI |
| Pengeluaran | Saldo akun berkurang | Makan dibayar tunai |
| Transfer | Sumber berkurang, tujuan bertambah | BRI ke DANA atau tarik tunai |

Pendapatan/pengeluaran mempunyai nominal positif, satu akun, satu kategori sesuai jenis, tanggal transaksi, deskripsi opsional, dan beberapa label opsional. Simpan waktu pembuatan terpisah dari tanggal transaksi agar pencatatan terlambat masuk ke periode yang benar.

Transfer mempunyai akun asal dan tujuan berbeda. Transfer tidak dihitung sebagai pendapatan/pengeluaran. Biaya transfer adalah pengeluaran terpisah yang dapat ditautkan ke transfer tersebut. Kedua sisi transfer harus disimpan secara atomik dalam satu transaksi database.

### Alur input

1. Pilih pendapatan, pengeluaran, atau transfer.
2. Masukkan nominal.
3. Pilih akun dan kategori, atau asal/tujuan untuk transfer.
4. Tentukan tanggal; default hari ini sesuai zona waktu pengguna.
5. Tambahkan deskripsi dan label bila diperlukan.
6. Simpan; tampilkan konfirmasi dan akses untuk memperbaiki input.

Kategori terakhir/sering digunakan dapat diprioritaskan. Jangan menebak akun tunai jika pengguna belum menetapkan default.

### Kasus yang perlu dijaga

- Klik simpan dua kali tidak menghasilkan transaksi ganda.
- Edit/hapus menghitung ulang saldo dan laporan terkait.
- Riwayat kategori yang diarsipkan tetap dapat dibaca.
- Penambahan transaksi pada hari yang sudah diperiksa meminta pemeriksaan ulang, bukan menolak transaksi.
- Refund pembelian sebaiknya ditautkan ke pengeluaran asal atau dicatat sebagai pembalik pengeluaran, bukan otomatis pendapatan baru. Usulan ini mengoreksi template awal “Pengembalian dana” sebagai pendapatan agar laporan tidak membesar secara semu; keputusan detail masih perlu dikunci.

## 6. Kategori dan label

### Kategori

Kategori template disalin menjadi milik pengguna saat onboarding. Perubahan pengguna A tidak memengaruhi pengguna B.

Data kategori: pemilik, nama, jenis pendapatan/pengeluaran, ikon, warna, urutan, status aktif/arsip. Satu kategori wajib untuk pendapatan/pengeluaran; transfer tidak memerlukan kategori pendapatan/pengeluaran.

Template pendapatan: Gaji, Freelance, Bonus, Penjualan, Hadiah, Pendapatan lainnya.

Template pengeluaran: Makanan dan minuman, Transportasi, Tempat tinggal, Tagihan, Belanja, Kesehatan, Pendidikan, Hiburan, Langganan, Keluarga, Sedekah dan donasi, Biaya administrasi, Pengeluaran lainnya.

Template dapat diedit; tidak ada kategori khusus AI yang wajib dipertahankan. Subkategori pernah dibahas, tetapi disarankan ditunda agar MVP sederhana.

| Kondisi | Aturan |
|---|---|
| Belum digunakan | Boleh dihapus |
| Sudah digunakan | Arsipkan, atau pindahkan transaksi ke kategori sejenis lalu hapus |
| Dipakai anggaran | Periksa dan ubah cakupan anggaran terlebih dahulu |
| Mengganti nama | Riwayat tetap terhubung dengan ID kategori yang sama |
| Mengganti jenis setelah digunakan | Ditolak; buat kategori baru sesuai jenis |

### Label/tag

Label bebas, misalnya Magang, Keluarga, Project Website, Liburan. Label dapat dipakai di pendapatan dan pengeluaran; satu transaksi dapat memiliki beberapa label.

Contoh: pendapatan Rp2.500.000 kategori Gaji berlabel Magang, serta pengeluaran Rp450.000 kategori Makanan/Transportasi berlabel Magang. Laporan label menampilkan pendapatan, pengeluaran, dan selisih Rp2.050.000. Selisih ini bukan saldo akun.

Laporan beberapa label harus menghitung setiap transaksi sekali. Menjumlahkan total per label dapat menggandakan transaksi yang memiliki lebih dari satu label.

## 7. Anggaran dan dana tersedia

Pengguna menetapkan nama anggaran, periode awal/akhir, batas nominal, kategori dan/atau label cakupan. Contoh: “Kebutuhan magang”, Rp1.000.000 per bulan, kategori Makanan atau Transportasi, dengan label Magang.

Usulan aturan filter anggaran: beberapa kategori memakai OR; beberapa label memakai OR untuk MVP; kelompok kategori dan kelompok label memakai AND. Label kosong berarti tidak membatasi label. Antarmuka harus menjelaskan aturan tersebut.

Tampilkan batas, realisasi, sisa, dan persentase terpakai. Jika melewati batas, tampilkan selisih; jangan hanya berhenti di 100% tanpa penjelasan.

Anggaran adalah batas penggunaan, bukan pemindahan uang. Beberapa anggaran bisa tumpang tindih; jangan menjumlahkan seluruh realisasinya sebagai total pengeluaran.

Dana aman digunakan = dana yang dipilih untuk periode − kewajiban belum dibayar − alokasi tabungan yang belum dipisahkan − cadangan yang belum dipisahkan. Setiap alokasi dikurangi sekali, bukan ganda.

Jika kebutuhan wajib belum diisi, jangan memberi label “aman” pada sisa saldo. Tampilkan “Belum cukup informasi” atau “Sisa arus kas tercatat” sesuai konteks.

## 8. Dashboard, laporan, dan filter

Prinsip tampilan: kesimpulan lebih dahulu, angka sebagai bukti. Tampilkan satu grafik utama; maksimal dua bila benar-benar diperlukan. Hindari pie chart banyak potongan dan kartu metrik berlebihan.

### Struktur halaman

| Halaman | Isi |
|---|---|
| Beranda | Ringkasan kondisi, angka utama, grafik kategori, langkah berikutnya |
| Transaksi | Daftar, pencarian, filter, tambah/edit/hapus |
| Anggaran | Batas dibanding realisasi dan cakupan |
| Analisis | Tren, perbandingan periode, rincian kategori/label |
| Rencana | Draft anggaran/penghematan AI dan persetujuan |
| Pengaturan | Akun uang, kategori/label, profil, email, privasi, ekspor |

### Angka dan narasi

- Pendapatan dan pengeluaran periode terpilih.
- Selisih arus kas, atau dana aman jika prasyarat perhitungan tersedia.
- Kalimat faktual: kategori terbesar, perubahan terhadap periode pembanding, dan kelengkapan data.
- Saran AI dipisahkan dari fakta hasil perhitungan dan diberi penanda asalnya.
- Nilai dapat dibuka untuk melihat transaksi pembentuknya.

### Filter konsisten

Filter: rentang tanggal, akun, jenis transaksi, kategori, label. Tampilkan pilihan aktif dan tombol reset. Satu kumpulan filter dipakai oleh angka, grafik, tabel, narasi faktual, serta ekspor laporan.

Ketika filter berubah, jangan mempertahankan saran AI lama seolah masih relevan. Tandai belum diperbarui dan sediakan tombol analisis ulang; ini juga menghemat pemanggilan API.

Saldo akun dan “sisa aman seluruh keuangan” tidak boleh dihitung dari subset kategori sebagai saldo sungguhan. Jika laporan sedang difilter sebagian, tampilkan metrik subset yang tepat atau pisahkan metrik saldo global dengan label jelas.

Filter tanpa hasil menampilkan keadaan kosong, bukan saran buatan. Transfer tetap terpisah. Perbandingan periode harus setara, misalnya tanggal 1–14 bulan ini dengan tanggal 1–14 bulan sebelumnya, bukan bulan parsial versus bulan penuh tanpa penjelasan.

Contoh dashboard pada percakapan hanya eksplorasi visual dengan data contoh. Rumus, saran, dan perilaku filter di contoh itu bukan acuan final; aturan dokumen ini yang menjadi dasar implementasi.

## 9. Pemeriksaan harian dan pengingat email

Tujuan: membantu memastikan pencatatan lengkap, bukan memaksa pengguna bertransaksi setiap hari.

| Status tampilan | Makna |
|---|---|
| Belum diperiksa | Belum dikonfirmasi; kosong bukan berarti nol transaksi |
| Ada catatan | Ada transaksi, belum dikonfirmasi lengkap |
| Sudah lengkap | Pengguna menyatakan semua transaksi telah dicatat |
| Tidak ada transaksi | Pengguna mengonfirmasi hari tanpa aktivitas transaksi |
| Perlu diperiksa ulang | Catatan berubah setelah konfirmasi atau terdapat ketidaksesuaian |

Status “tidak ada transaksi” tidak membuat transaksi Rp0. Jika hari tersebut memiliki pendapatan atau transfer, pengguna dapat menandainya “sudah lengkap”, bukan “tidak ada transaksi”. Tidak ada pengeluaran tidak sama dengan tidak ada transaksi.

### Interaksi email

Untuk hari kosong, tawarkan Catat transaksi, Tidak ada transaksi, dan Ingatkan nanti. Untuk hari yang sudah memiliki catatan, tawarkan Periksa catatan, Sudah lengkap, dan Ingatkan nanti.

Email mengandung pesan singkat dan tautan ke tanggal terkait. Saldo, merchant, dan nominal disembunyikan secara default. Jangan menilai kebiasaan pengguna dari jumlah transaksi.

### Aturan pengiriman

- Opt-in, mengikuti jam, hari, dan zona waktu pengguna.
- Usulan default pukul 20.30 waktu setempat; dapat diubah.
- Satu pengingat utama/hari; ulang hanya jika pengguna memilih snooze, dengan batas yang jelas.
- Periksa ulang status sebelum benar-benar mengirim agar tidak mengganggu pengguna yang baru menyelesaikan pemeriksaan.
- Tidak mengirim bila sudah lengkap/tanpa transaksi, pengingat mati, atau sedang dijeda.
- Sediakan unsubscribe dan pengaturan frekuensi; mematikan pengingat tidak mematikan email keamanan.
- Tidak otomatis mengubah frekuensi menjadi mingguan tanpa pengaturan/persetujuan pengguna. Setelah beberapa hari diabaikan, boleh menawarkan perubahan.
- Email gagal diterima tidak dianggap pengguna mengabaikannya.
- Pengiriman diupayakan mendekati jadwal, bukan dijamin tiba tepat menit tertentu.

### Tautan aman

Tautan email membuka halaman konfirmasi bertanda tanggal dan aksi. Jangan melakukan perubahan data hanya dengan GET/membuka URL; pemindai keamanan email bisa membuka tautan otomatis. Gunakan token acak/bertanda tangan, kedaluwarsa, cakupan satu aksi/tanggal, dan konfirmasi POST. Akses detail keuangan tetap memerlukan sesi yang sah.

### Penjadwal

Cloudflare Cron memeriksa pengguna yang jatuh tempo, misalnya setiap 15 menit. Jadwal lokal dikonversi ke UTC. Catat idempotency key per pengguna, tanggal, jenis pengingat, dan nomor percobaan logis; retry pengiriman harus terbatas dan tidak menyebabkan duplikasi. Periksa bounce/complaint dan hentikan pengiriman ke alamat bermasalah.

## 10. Login, email, dan onboarding

Rancangan awal: email + password, verifikasi email, lupa password, logout, pengelolaan sesi. Login Google ditunda; magic link bukan metode utama agar setiap login tidak menghabiskan kuota email.

Email pengingat secara default mengikuti email akun yang terverifikasi. Tidak perlu input email kedua. Opsi email pengingat berbeda disiapkan dalam desain, tetapi ditunda dari MVP; kelak wajib diverifikasi dan bukan jalur reset password/login.

Alur: daftar → verifikasi email → login → pilih zona waktu → buat sumber uang/saldo awal → gunakan atau sesuaikan kategori → pilih apakah mengaktifkan pengingat → mulai mencatat. Jangan meminta semua detail rencana finansial pada pendaftaran.

Perubahan email utama mengikuti mekanisme aman provider: verifikasi alamat baru, persyaratan konfirmasi alamat lama bila berlaku, pemberitahuan keamanan, lalu pindahkan tujuan pengingat yang mengikuti email akun. Sebelum verifikasi berhasil, jangan mengalihkan pengiriman ke alamat baru.

Email autentikasi dan pengingat berbeda jenis, prioritas, template, dan preferensi. Jika memakai satu kuota provider, sisakan kapasitas untuk verifikasi/reset; pengingat tidak boleh menghabiskan seluruhnya.

## 11. Tiga fitur AI prioritas

### 11.1 Susun anggaran

Input: dana tersedia untuk periode, tanggal awal/akhir, kewajiban belum dibayar, target tabungan, cadangan, kategori terkunci, preferensi penghematan, dan riwayat yang relevan.

Contoh fiktif: dana Rp1.500.000 untuk 20 hari, transportasi Rp200.000, tabungan Rp300.000, cadangan Rp100.000. Sisa Rp900.000, rata-rata Rp45.000/hari. Angka dihitung kode; AI mengusulkan pembagian sisa ke kategori pengguna dan menjelaskan asumsi.

Output: ringkasan, tabel alokasi, asumsi, batasan, dan pilihan edit/simpan draft/terapkan. Jika target tidak layak, jelaskan kekurangan dan alternatif, bukan memaksa alokasi negatif.

### 11.2 Rencana penghematan

Input: target penghematan, periode, realisasi sebelumnya, kategori yang boleh dikurangi, dan kebutuhan yang tidak boleh disentuh.

Output: nominal lama, usulan batas, potensi hemat per kategori, konsekuensi dan alternatif. Tidak boleh menganggap seluruh pengeluaran kategori tertentu tidak penting. Nama kategori ambigu harus diklarifikasi.

Contoh fiktif: kurangi Ngopi Rp150.000, Hiburan Rp100.000, Belanja pribadi Rp150.000 untuk target Rp400.000. Ini ilustrasi fungsi aplikasi, bukan nasihat personal.

### 11.3 Evaluasi mingguan

Bandingkan rencana dengan realisasi, jelaskan perubahan signifikan, dan tawarkan penyesuaian. Jangan mengarang penyebab seperti “impulsif” jika catatan tidak membuktikannya.

Jika beberapa hari belum diperiksa, hasil diberi keterangan “data belum lengkap”. Jika riwayat sedikit, minta estimasi pengguna; jangan berpura-pura telah mengenali kebiasaan.

### Kendali dan validasi

1. Backend menghitung ringkasan dari data milik pengguna dan filter yang diminta.
2. Jalur AI hanya menerima data yang diizinkan untuk lingkungan/provider tersebut.
3. Model menghasilkan output terstruktur sesuai skema.
4. Sistem memeriksa kepemilikan kategori, nominal, batas dana, kategori terkunci, dan konsistensi total.
5. Hasil tidak valid ditolak atau diperbaiki melalui proses terbatas; jangan langsung ditampilkan sebagai benar.
6. Hasil disimpan sebagai draft beserta periode, asumsi, versi data, model/prompt yang digunakan.
7. Pengguna menyetujui penerapan. Periksa ulang apakah data berubah sebelum menerapkan.

Sediakan tombol Susun anggaran saya, Bantu saya berhemat, Evaluasi minggu ini. Pertanyaan lanjutan hanya dalam konteks hasil tersebut. AI tidak mempunyai akses menjalankan SQL arbitrer atau menghapus transaksi.

### Biaya dan privasi AI

- Panggil AI saat diminta, bukan setiap transaksi.
- Cache hasil per pengguna, filter, preferensi, versi data, dan versi prompt; invalidasi jika berubah.
- Tetapkan batas pemakaian dan timeout; pencatatan tetap berfungsi saat batas habis.
- Ringkasan template tanpa model harus diberi nama ringkasan otomatis, bukan AI.
- Gemini free tier kandidat pengujian data fiktif. Ketentuan layanan gratis melarang pengiriman informasi sensitif/pribadi; penghapusan nama bukan jaminan anonimitas.
- Ollama lokal kandidat pengembangan pribadi. WebLLM kandidat eksperimen di browser, perlu uji memori, GPU, ukuran unduhan, kualitas bahasa Indonesia, dan perangkat pengguna.
- Model lokal tidak berarti server AI publik gratis: komputasi, listrik, kapasitas, dan operasional tetap ada.
- Provider/model data asli belum diputuskan. Jangan menurunkan privasi hanya demi klaim Rp0.

## 12. Teknologi dan arsitektur rekomendasi

| Komponen | Pilihan | Fungsi |
|---|---|---|
| Frontend | Vue 3 + TypeScript + Vite | Aplikasi web responsif |
| Routing | Vue Router | Navigasi halaman |
| Styling | Tailwind CSS | Tampilan konsisten |
| Grafik | Chart.js | Diagram sederhana |
| Backend | Hono + TypeScript | API bisnis dan validasi |
| Database | Supabase PostgreSQL | Data relasional dan perhitungan |
| Auth | Supabase Auth | Identitas, sesi, verifikasi |
| Frontend hosting | Cloudflare Pages | Aset statis dan subdomain bawaan |
| Backend hosting | Cloudflare Workers | API tanpa server yang dikelola sendiri |
| Scheduler | Cloudflare Cron Triggers | Pengingat terjadwal |
| Email | Resend, bersyarat | SMTP autentikasi dan API pengingat |
| AI | Adapter provider | Gemini dummy/local; produksi belum final |
| Validasi skema | Usulan Zod atau ekuivalen | Request dan output model |
| Testing | Vitest + Playwright | Unit dan end-to-end |
| Kode dan deployment | Git/GitHub | Riwayat dan pipeline deployment |

Vue berkomunikasi dengan Supabase Auth untuk login. API bisnis melalui Worker yang memverifikasi token dan menggunakan akses database terikat pengguna/RLS. Backend terjadwal memakai hak terbatas sesuai kebutuhan. Tidak semua endpoint menggunakan kunci administratif.

Fungsi PostgreSQL dipakai untuk operasi atomik seperti transfer dan query agregasi. Backend tidak menjalankan model besar di Worker gratis; Worker hanya menjadi penghubung ke provider bila diizinkan.

Laravel adalah alternatif jika prioritas berubah ke pendalaman PHP, bukan stack tambahan yang harus berjalan bersamaan. Python, Redis, LangChain, serta vector database tidak diperlukan untuk MVP.

PWA dapat ditambahkan untuk pemasangan ke layar utama. Dukungan offline penuh, penyimpanan lokal data sensitif, dan konflik sinkronisasi belum termasuk MVP.

## 13. Rancangan API internal

| Endpoint ilustratif | Fungsi |
|---|---|
| GET/POST /accounts | Daftar dan buat sumber uang |
| GET/POST /categories | Kelola kategori pengguna |
| GET/POST /tags | Kelola label |
| GET/POST /transactions | Cari atau tambah transaksi |
| PATCH/DELETE /transactions/:id | Ubah/hapus transaksi dengan validasi |
| POST /transfers | Transfer atomik antar-akun |
| GET /reports/summary | Ringkasan sesuai filter |
| GET/POST /budgets | Daftar dan buat anggaran |
| POST /daily-checkins | Konfirmasi status hari tertentu |
| PATCH /reminder-preferences | Atur pengingat |
| POST /plans/budget | Draft rencana anggaran |
| POST /plans/savings | Draft penghematan |
| POST /reviews/weekly | Evaluasi mingguan |
| POST /plans/:id/apply | Terapkan setelah persetujuan |
| GET /exports | Ekspor sesuai hak akses |

Ini rancangan awal, bukan kontrak API final. Seluruh endpoint privat wajib autentikasi, otorisasi, validasi, rate limit yang sesuai, dan format kesalahan konsisten.

## 14. Rancangan data awal

| Entitas | Isi utama |
|---|---|
| auth.users | Identitas dan email utama, dikelola provider |
| profiles | Nama tampilan, zona waktu, preferensi dasar |
| accounts | Nama akun, tipe, mata uang, saldo awal dan tanggal |
| categories | Kategori milik pengguna, jenis dan status arsip |
| tags | Label milik pengguna |
| transactions | Jenis, akun, nominal, kategori, tanggal, deskripsi |
| transaction_tags | Relasi banyak label pada transaksi |
| transfers | Penghubung asal/tujuan dan biaya jika ada |
| budgets | Periode, batas, nama |
| budget_categories / budget_tags | Cakupan anggaran |
| daily_checkins | Tanggal lokal, konfirmasi, waktu pemeriksaan |
| reminder_preferences | Opt-in, kanal, jadwal, zona waktu, snooze |
| reminder_deliveries | Kunci deduplikasi, status, percobaan, ID provider |
| plans / plan_allocations | Draft, alokasi, persetujuan, versi sumber |
| ai_reviews | Evaluasi dan metadata data/model, tanpa log prompt sensitif secara default |
| audit_logs | Perubahan penting dengan retensi terbatas |

Struktur ledger transfer final perlu dipilih saat desain skema agar transaksi dan transfers tidak menghitung uang yang sama dua kali. Entitas merupakan model konseptual, bukan migrasi siap dijalankan.

Gunakan nilai rupiah integer; jangan floating point untuk uang. Atur batas angka aman ketika berpindah antara PostgreSQL BIGINT dan JavaScript. Foreign key harus mencegah transaksi pengguna A memakai akun/kategori pengguna B. Simpan tanggal transaksi lokal dan timestamp sistem secara konsisten.

## 15. Keamanan dan privasi

- HTTPS; rahasia hanya di backend, tidak di bundle frontend/repository.
- Password ditangani layanan auth, tidak disimpan plaintext oleh aplikasi.
- RLS dan pemeriksaan kepemilikan pada seluruh relasi.
- CAPTCHA/rate limit untuk pendaftaran, reset, pengiriman ulang, dan AI.
- Reautentikasi untuk perubahan sensitif; sesi dikelola dengan mekanisme provider yang aman.
- Pisahkan informasi publik dan data keuangan; jangan cache respons privat sebagai aset publik.
- Tidak meminta PIN, OTP bank, atau password internet banking.
- Tidak mencatat isi lengkap transaksi, email, atau prompt sensitif di log.
- Persetujuan pengingat dan AI terpisah; unsubscribe tidak menghapus akun.
- Ekspor dan penghapusan data disediakan; tetapkan retensi backup/log sebelum peluncuran.
- Tautan email hanya mengonfirmasi aksi terbatas, bukan memberikan akses penuh ke akun.
- Lindungi ekspor CSV dari formula injection dan seluruh tampilan dari konten berbahaya.
- Persyaratan usia/wilayah serta penggunaan data provider AI perlu diperiksa sebelum peluncuran publik.

## 16. Target biaya dan batas layanan

Angka berikut merangkum dokumentasi yang diperiksa pada diskusi 14 September 2026; perlu diperiksa kembali ketika implementasi/deploy karena paket dapat berubah.

| Komponen | Kondisi gratis yang dibahas | Batas/risiko |
|---|---|---|
| Cloudflare Pages | Hosting frontend pada free plan | Kuota build/file; domain sendiri tidak termasuk |
| Cloudflare Workers | 100.000 request/hari pada free plan | Batas CPU, request, dan layanan terkait; bukan untuk inferensi model besar |
| Supabase | 500 MB database, 5 GB egress, 50.000 MAU | Maks. 2 proyek aktif; potensi pause setelah 1 minggu tidak aktif |
| Resend | 3.000 email/bulan, 100/hari | Domain pengirim terverifikasi; termasuk email autentikasi bila memakai kuota sama |
| Gemini gratis | Model tertentu dengan kuota | Tidak untuk informasi sensitif; model/kuota berubah |
| AI lokal | Tanpa biaya per token API saat lokal | Biaya perangkat, daya, waktu, dan kemampuan perangkat |

Contoh kapasitas email: 50 pengguna × 1 pengingat × 30 hari = 1.500 email/bulan sebelum verifikasi, reset, snooze, dan rangkuman mingguan. Contoh ini estimasi, bukan jaminan kapasitas atau keterkiriman.

Jangan mengaktifkan upgrade berbayar otomatis. Tetapkan limit aplikasi, pesan saat kuota habis, dan kapasitas pengguna pilot. Jika anggaran tetap Rp0, tidak boleh diam-diam menganggap biaya domain telah disetujui.

### Dua kendala terbuka

1. Email publik dengan pengirim layak tanpa domain baru berbayar. Resend cocok bila domain yang sah sudah tersedia; jika tidak, provider lain perlu diuji dan persyaratannya dikonfirmasi.
2. LLM pribadi dengan data asli pada perangkat sasaran tanpa biaya layanan. Uji lokal diperlukan; Gemini gratis hanya untuk dummy dalam rancangan saat ini.

Jika keduanya belum selesai, labeli sistem sebagai prototipe/pilot terbatas, bukan aplikasi publik lengkap Rp0.

## 17. Pengujian dan kriteria penerimaan

### Perhitungan

- Saldo awal tidak masuk pendapatan periode.
- Transfer Rp200.000 tidak mengubah total dana; biaya Rp2.500 menurunkannya Rp2.500.
- Edit, hapus, transaksi bertanggal mundur, dan transfer gagal menghasilkan saldo konsisten.
- Transaksi banyak label dihitung sekali dalam laporan gabungan.
- Dana tabungan/cadangan tidak dihitung atau dikurangi ganda.

### Pengguna dan laporan

- Kategori pengguna tidak memengaruhi pengguna lain.
- Akses silang akun/kategori/transaksi ditolak, termasuk lewat API langsung.
- Filter memperbarui seluruh hasil yang relevan; ekspor laporan cocok dengan filter.
- Data kosong, kategori arsip, dan periode parsial ditangani jelas.
- Form dan dashboard terbaca di HP dan bisa dioperasikan dengan keyboard.

### Pengingat

- Email hanya ke alamat terverifikasi yang opt-in.
- Hari lengkap/tanpa transaksi tidak dikirimi pengingat utama lagi.
- Snooze mengikuti tanggal dan zona waktu; retry tidak menggandakan pesan.
- Tautan yang dibuka bot pemindai tidak mengubah status.
- Unsubscribe dan bounce menghentikan pengingat tanpa memutus pemulihan akun.

### AI

- Tidak ada kategori fiktif, nominal negatif, alokasi berlebih, atau perubahan kategori terkunci.
- Catatan belum lengkap menghasilkan peringatan, bukan klaim berhasil hemat.
- Draft tidak mengubah anggaran sebelum disetujui.
- Data berubah → hasil lama ditandai usang.
- Timeout, kuota habis, dan output salah memiliki fallback yang jelas.
- Uji kualitas bahasa Indonesia dan rencana pada data fiktif sebelum memakai data asli.

## 18. Deployment dan maintenance

### Sebelum rilis

Pisahkan konfigurasi lokal, pengujian, dan produksi; gunakan data fiktif pada preview. Kelola migrasi database melalui Git. Jalankan test sebelum deployment. Simpan rahasia melalui konfigurasi hosting, bukan file yang di-commit. Siapkan backup dan uji restore sebelum pengguna memasukkan data penting.

### Rutin

| Frekuensi usulan | Pekerjaan |
|---|---|
| Mingguan | Cek error, pengiriman email gagal, duplikasi, penggunaan kuota, dan backup |
| Bulanan | Update dependency terkontrol, tes regresi, uji restore, cek kebijakan provider |
| Berkala/setelah perubahan penting | Audit RLS, hak akses, alur email, prompt/model, dan keamanan |
| Saat ada insiden | Batasi dampak, perbaiki, rotasi rahasia jika perlu, pulihkan dan beri pemberitahuan sesuai dampak |

Backup tidak boleh diasumsikan tersedia penuh pada free plan. Tentukan frekuensi dan lokasi backup terenkripsi, aksesnya, serta prosedur pemulihan. Riwayat Git menyimpan kode, bukan menggantikan backup database.

## 19. Tahapan pembangunan

1. Kunci keputusan terbuka: target perangkat, email publik, privasi/provider AI, nama produk, perlakuan refund dan penyesuaian saldo.
2. Fondasi: skema database, Auth, RLS, sumber uang, kategori/label, transaksi dan transfer.
3. Output: dashboard, filter bersama, laporan, ekspor, dan pengujian angka.
4. Kebiasaan: daily check-in, preferensi, scheduler, email, unsubscribe dan deduplikasi.
5. Perencanaan: anggaran manual dan mesin perhitungan dana tersedia.
6. AI: adapter, dummy data, validasi, draft/persetujuan, pengujian privasi/perangkat.
7. Pilot: pengguna terbatas, data dan backup terkendali, pengukuran manfaat, perbaikan alur.

Tidak ada estimasi tanggal rilis final; lama pengerjaan bergantung kapasitas pengembang, kesiapan email, dan hasil uji AI.

## 20. Pengembangan masa depan

Prioritas potensial setelah fondasi stabil: WhatsApp resmi, login Google, email pengingat alternatif terverifikasi, target tabungan lebih lengkap, simulasi pembelian, prediksi saldo dengan rentang/asumsi, input bahasa alami, impor CSV, scan struk, dan input suara.

Utang/piutang, transaksi berulang, shared wallet, dan mode freelancer lebih lengkap perlu desain tersendiri. Integrasi rekening asli tidak termasuk rencana aktif karena pengguna telah memilih kembali pencatatan manual.

## 21. Referensi resmi

Referensi ini berasal dari pemeriksaan pada diskusi sebelumnya; merupakan dasar teknis, bukan janji kuota tetap.

- Vue: https://vuejs.org/guide/introduction.html
- Hono: https://hono.dev/docs
- Supabase pricing: https://supabase.com/pricing
- Supabase Auth dan SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Resend pricing: https://resend.com/pricing
- Resend verified domains: https://resend.com/docs/dashboard/domains/introduction
- Gemini terms: https://ai.google.dev/gemini-api/terms
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Ollama FAQ: https://docs.ollama.com/faq
- WebLLM: https://webllm.mlc.ai/

## 22. Kesimpulan

Produk yang dirancang adalah pencatat keuangan pribadi yang membantu pengguna memahami kondisi uang, membangun kebiasaan pencatatan, dan mengubah data menjadi rencana yang dapat dilakukan. Pencatatan manual, kategori fleksibel, laporan ringan, dan pengingat email menjadi fondasi. AI mendampingi melalui anggaran, penghematan, dan evaluasi, bukan menggantikan validasi angka atau keputusan pengguna.

Fondasi teknis direkomendasikan memakai Vue + TypeScript + Hono + Supabase + Cloudflare. Pengiriman email publik dan AI untuk data pribadi tetap keputusan bersyarat. Keduanya harus diselesaikan dengan tetap menghormati batas biaya Rp0 dan privasi sebelum aplikasi dinyatakan siap digunakan secara publik.
