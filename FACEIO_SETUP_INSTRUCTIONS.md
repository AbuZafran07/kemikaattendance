# Panduan Setup FaceIO

## Masalah
FaceIO tidak dapat digunakan karena belum dikonfigurasi. Error yang muncul:
```
VITE_FACEIO_APP_ID tidak ditemukan
```

## Solusi

FaceIO memerlukan **App ID** yang harus ditambahkan sebagai **environment variable frontend** (bukan secret backend).

### Langkah-langkah Setup:

1. **Dapatkan FaceIO App ID**
   - Kunjungi: https://faceio.net
   - Buat akun atau login
   - Buat aplikasi baru (New Application)
   - Salin **App ID** yang diberikan

2. **Tambahkan ke File .env Lokal**
   
   Buka file `.env` di root project Anda dan tambahkan:
   ```env
   VITE_FACEIO_APP_ID=your_actual_faceio_app_id_here
   ```
   
   **Penting:** 
   - Ganti `your_actual_faceio_app_id_here` dengan App ID asli dari FaceIO
   - Variabel harus diawali dengan `VITE_` agar bisa dibaca oleh frontend
   - File `.env` hanya ada di development lokal, tidak di production

3. **Restart Development Server**
   
   Setelah menambahkan environment variable, restart server:
   ```bash
   npm run dev
   ```
   atau
   ```bash
   yarn dev
   ```

4. **Untuk Production/Deployment**
   
   Jika Anda deploy ke hosting:
   - Tambahkan `VITE_FACEIO_APP_ID` ke environment variables di platform hosting Anda
   - Contoh: Vercel, Netlify, atau hosting lainnya biasanya punya panel untuk environment variables

## Verifikasi Setup

Setelah setup selesai:
1. Buka halaman Face Enrollment (`/employee/face-enrollment`)
2. Tidak akan muncul error "Konfigurasi Error"
3. Button "Mulai Pendaftaran Wajah" akan berfungsi
4. Check-in dan check-out akan dapat menggunakan face recognition

## Catatan Penting

- **Secret vs Environment Variable:**
  - Secret (FACEIO_APP_ID tanpa VITE_) = untuk backend/edge functions
  - Environment Variable (VITE_FACEIO_APP_ID) = untuk frontend
  - FaceIO adalah library client-side yang berjalan di browser, jadi memerlukan VITE_ prefix

- **Keamanan:**
  - FaceIO App ID adalah identifier publik, bukan rahasia
  - Data wajah disimpan dengan aman di server FaceIO, bukan di database aplikasi
  - Face recognition berjalan di client-side dengan enkripsi

## Troubleshooting

Jika masih error setelah setup:
1. Periksa console browser untuk error detail
2. Pastikan App ID sudah benar (copy-paste tanpa spasi)
3. Pastikan restart development server sudah dilakukan
4. Periksa apakah `.env` file ada di root project (sejajar dengan package.json)
5. Pastikan tidak ada typo di nama variabel (harus persis: `VITE_FACEIO_APP_ID`)

## Alternatif (Jika Tidak Ingin Menggunakan FaceIO)

Jika Anda tidak ingin menggunakan FaceIO untuk sementara:
1. Sistem check-in/check-out tetap akan berjalan
2. Hanya validasi wajah yang di-skip
3. GPS validation tetap bekerja
4. Foto tetap diambil dari kamera tapi tidak divalidasi dengan face recognition
