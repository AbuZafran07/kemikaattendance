---
name: business-travel-allowance
description: Tunjangan Perjalanan Dinas: per-hari flat, dikurangi tunj. kehadiran/hari, otomatis masuk payroll_overrides saat approval.
type: feature
---
- Setting: `system_settings.business_travel_allowance_config` `{ per_day_amount, enabled }` (default 100.000). RPC `get_business_travel_allowance_config`.
- Kolom baru: `payroll.tunjangan_perjalanan_dinas`, `payroll_overrides.tunjangan_perjalanan_dinas`.
- Formula: `max(0, per_day_amount − (attendance_max ÷ working_days_periode)) × hari_dinas_efektif`. Hari dinas exclude weekend & holiday. Periode = bulan dari `start_date`.
- Helper: `src/lib/businessTravelAllowance.ts` → `applyBusinessTravelAllowance({userId,startDate,endDate})`. Akumulasi ke override + mirror ke `payroll`. Tolak jika payroll period `finalized`.
- Dipanggil dari: `src/pages/BusinessTravel.tsx` (approve) dan `src/components/AdminCreateBusinessTravelDialog.tsx` (auto-approve admin).
- UI: pengaturan baru `/dashboard/settings/business-travel-allowance`. Field manual di dialog Tambahan Penghasilan Payroll. Tampil sebagai baris terpisah di slip PDF & detail dialog.
- Tidak ada reversal otomatis: jika dinas dibatalkan/diedit setelah approve, admin harus sesuaikan manual.
