# Validasi CA (Cash Advance) untuk Tunjangan Perjalanan Dinas

Tunjangan perjalanan dinas hanya keluar nominalnya jika pengajuan dinas dilengkapi **dokumen CA (Cash Advance)** yang diupload karyawan saat mengajukan. Tanpa dokumen CA, pengajuan dinas tetap bisa diajukan & disetujui (untuk keperluan izin/absensi), tapi tidak ada tunjangan yang masuk ke payroll.

## Alur baru

```text
Karyawan ajukan dinas
  ├── upload dokumen CA  ──► Admin approve ──► tunjangan masuk payroll_overrides
  └── tanpa dokumen CA   ──► Admin approve ──► TIDAK ada tunjangan (info jelas di toast)
```

## Yang akan dibuat/diubah

1. **Form pengajuan karyawan** (`BusinessTravelRequest.tsx`)
   - Tambah bagian "Dokumen Cash Advance (CA)" dengan upload file (PDF/JPG/PNG/DOC, maks 10 MB), tersimpan di bucket `business-travel-docs` dengan prefix folder user.
   - Catatan penjelas: "Tunjangan perjalanan dinas hanya dibayarkan bila dokumen CA dilampirkan."
   - Upload opsional secara teknis (pengajuan tanpa CA tetap bisa), tapi ada peringatan sebelum submit.

2. **Halaman admin** (`BusinessTravel.tsx`)
   - Kolom/badge status CA: **"CA ✓"** (hijau) atau **"Tanpa CA"** (abu).
   - Tombol lihat/download dokumen CA (signed URL, seperti dokumen dinas yang sudah ada).
   - Di dialog approve: peringatan bila belum ada CA — "Tunjangan dinas tidak akan diproses".
   - Admin boleh melengkapi/mengganti dokumen CA saat approve bila karyawan lupa upload.

3. **Logika tunjangan** (`businessTravelAllowance.ts`)
   - Tambah gate: kalau request tidak punya dokumen CA → tidak menulis apapun ke `payroll_overrides`, kembalikan alasan "Belum ada dokumen CA".
   - Nominal tetap: `tarif/hari × hari dinas efektif` (weekend & libur nasional dikecualikan), pemecahan cut-off 21 tetap seperti sekarang.

4. **Edit pengajuan** (`EditBusinessTravelDialog.tsx`)
   - Tambah upload/ganti dokumen CA agar bisa dilengkapi sebelum approval.

5. **Dokumen lama**: pengajuan yang sudah approved sebelumnya dibiarkan apa adanya — aturan CA berlaku untuk approval baru.

## Detail teknis

- Migrasi: tambah kolom di `business_travel_requests` → `ca_document_url text`, `ca_uploaded_at timestamptz`, `ca_number text` (opsional, nomor CA).
- RPC `approve_business_travel_request` tidak berubah; gate CA dijalankan di helper `applyBusinessTravelAllowance` (dibaca dari row request) sehingga berlaku untuk approve manual maupun auto-approve admin.
- `applyBusinessTravelAllowance` menerima parameter tambahan `requestId` (atau `hasCA`) untuk verifikasi; pemanggil: `BusinessTravel.tsx` dan `AdminCreateBusinessTravelDialog.tsx`.
- Kebijakan storage `business-travel-docs` yang sudah ada (isolasi per user + admin read) dipakai kembali, tanpa perubahan.
- Voucher Perjadin dan export payroll tidak berubah — otomatis hanya memuat karyawan yang tunjangannya benar-benar terisi.
