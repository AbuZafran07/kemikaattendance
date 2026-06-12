## Ringkasan
Menambahkan logika tunjangan perjalanan dinas ke modul **Perjalanan Dinas yang sudah ada** (tidak dirombak). Saat admin meng-approve pengajuan dinas, sistem otomatis menghitung tunjangan dinas dan menambahkannya ke `payroll_overrides` bulan berjalan. Slip & dialog payroll akan menampilkannya sebagai baris terpisah "Tunjangan Perjalanan Dinas".

## Rumus (sudah dikonfirmasi)
- Per-hari kehadiran = `attendance_allowance.max_amount ÷ jumlah hari kerja bulan ybs` (cut-off 21–20, hari kerja = exclude weekend & libur nasional/cuti bersama — sama persis dengan Laporan Tunj. Kehadiran).
- Tambahan dinas = `max(0, nilai_dinas_per_hari − per_hari_kehadiran) × hari_dinas_efektif` (hari dinas exclude weekend & libur).
- Periode payroll = bulan dari `start_date` pengajuan dinas.

## Perubahan yang akan dibuat

### 1. Database (migrasi)
- Tambah row baru di `system_settings` dengan key `business_travel_allowance_config` = `{ per_day_amount: 100000, enabled: true }`.
- RPC baru `get_business_travel_allowance_config()` (SECURITY DEFINER, `SET search_path = ''`).
- **Tambah kolom baru** `tunjangan_perjalanan_dinas numeric NOT NULL DEFAULT 0` pada:
  - `payroll_overrides`
  - `payroll`
- Tidak mengubah tabel/policy lain, tidak menyentuh `approve_business_travel_request` RPC (logic upsert payroll_overrides dikerjakan di client setelah approve sukses, agar tidak menyentuh RPC yang sudah dipakai luas).

### 2. Halaman Pengaturan baru
- File: `src/pages/BusinessTravelAllowanceSettings.tsx` — input nilai per-hari + toggle aktif.
- Daftarkan di `src/pages/Settings.tsx` (grid menu) + route di `src/App.tsx`.
- i18n key di `id.json` & `en.json`.

### 3. Helper kalkulasi
- File baru: `src/lib/businessTravelAllowanceCalc.ts`
  - Fungsi `calculateBusinessTravelAllowance({ userId, startDate, endDate })` → `{ amount, period_month, period_year, breakdown }`.
  - Re-use logika hari kerja dari `AttendanceAllowanceReport` (akan diekstrak ke util kecil agar tidak duplikasi).

### 4. Integrasi approval (tanpa merusak alur existing)
- `src/pages/BusinessTravel.tsx` — di `handleApprove` (dan path approve massal jika ada): setelah RPC `approve_business_travel_request` sukses, panggil helper di atas → upsert `payroll_overrides` (tambahkan ke kolom baru `tunjangan_perjalanan_dinas`, akumulasi jika sudah ada untuk periode yang sama).
- `src/components/AdminCreateBusinessTravelDialog.tsx` — karena admin-create otomatis approved, jalankan helper yang sama setelah insert sukses.
- Toast info: "Tunjangan dinas Rp X ditambahkan ke payroll bulan MM/YYYY".

### 5. Tampilkan di Payroll
- `src/pages/Payroll.tsx`:
  - Tambah kolom `tunjangan_perjalanan_dinas` saat fetch + simpan/generate payroll.
  - Tambah field di dialog Tambahan Penghasilan (read-only-ish, bisa diedit admin) — di-init dari override.
  - Masukkan ke total penghasilan bruto.
- `src/lib/payrollCalculation.ts` — tambahkan ke akumulator penghasilan kena pajak.
- `src/lib/payslipPdfGenerator.ts` & `src/lib/payrollReportPdfGenerator.ts` — tampilkan baris "Tunjangan Perjalanan Dinas" terpisah (sesuai rule memori payroll-slip-itemization).
- `src/lib/bankPayrollExport.ts` — pastikan masuk THP.

### 6. Memory
- Tambah memory baru: `business-travel-allowance` (rumus & integrasi).

## Catatan keamanan & ketahanan
- Helper akan **idempotent**: kalau request yang sama di-approve ulang (mis. unlock & approve lagi), tidak double — pakai marker di `deduction_notes`/log sederhana. Saya akan tambahkan kolom `payroll_override_id` opsional di `business_travel_requests` agar bisa di-revert saat dibatalkan? **(opsional; bisa di-skip kalau Anda mau lebih sederhana — lihat pertanyaan di bawah)**.
- Tidak ada perubahan ke RPC approval existing → modul lain (notifikasi, audit, kalender) tetap berjalan.

## Pertanyaan terakhir sebelum eksekusi
1. **Reversal**: jika dinas yang sudah approved kemudian dibatalkan/diedit admin → tunjangan otomatis ikut dicabut/diupdate, atau cukup hitung saat approval pertama saja (admin edit manual jika perlu)?
2. **Payroll sudah finalized**: jika payroll bulan tsb sudah `finalized=true`, apakah tambahan tunjangan dinas **ditolak** (toast warning, admin harus unlock dulu), atau **tetap masuk ke override** (admin nanti unlock + re-generate)?
