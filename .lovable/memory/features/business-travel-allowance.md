---
name: business-travel-allowance
description: Tunjangan Perjalanan Dinas: flat per-hari × hari dinas efektif, otomatis masuk payroll_overrides saat approval.
type: feature
---
- Setting: `system_settings.business_travel_allowance_config` `{ per_day_amount, enabled }`. RPC `get_business_travel_allowance_config`.
- Kolom: `payroll.tunjangan_perjalanan_dinas`, `payroll_overrides.tunjangan_perjalanan_dinas`.
- **Formula (disederhanakan)**: `per_day_amount × hari_dinas_efektif`. Hari dinas exclude weekend & libur nasional/cuti bersama. Tidak dobel dengan tunj. kehadiran karena hari "Dinas" sudah tidak dihitung sebagai hari hadir di Laporan Tunj. Kehadiran.
- Periode payroll ditentukan per hari via cut-off (default 21): tanggal ≥ 21 → bulan berikutnya. Trip lintas cut-off otomatis dipecah 2 periode.
- Helper: `src/lib/businessTravelAllowance.ts` → `applyBusinessTravelAllowance({userId,startDate,endDate,dryRun?})`. Upsert akumulatif ke `payroll_overrides`, mirror ke `payroll` bila row sudah ada. Skip period `finalized` (perlu unlock + generate ulang).
- Dipanggil dari: `src/pages/BusinessTravel.tsx` (approve) & `src/components/AdminCreateBusinessTravelDialog.tsx` (auto-approve).
- UI: setting `/dashboard/settings/business-travel-allowance`. Baris terpisah di slip PDF, detail dialog, dan kolom sendiri di export Excel/PDF laporan payroll.
- Tidak masuk THP bank export (dibayar dimuka via Voucher Perjadin di Payroll → Export → Voucher Perjadin).
- Tidak ada reversal otomatis: jika dinas dibatalkan/diedit setelah approve, admin sesuaikan manual.
