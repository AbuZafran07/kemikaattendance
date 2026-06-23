---
name: Final Settlement Policy
description: Leftover annual leave is consumed as paid working days up to resign_date, never cashed out
type: feature
---
Kebijakan final settlement Kemika:
- Sisa cuti tahunan **tidak diuangkan**. Karyawan "memakai" sisa cutinya sebagai hari kerja sehingga `resign_date` di-set ke tanggal terakhir setelah sisa cuti habis.
- Contoh: karyawan resign efektif 22 Jun namun sisa cuti 12 hari → `resign_date` di-set 7 Jul. Gaji prorata 21 Jun – 7 Jul otomatis dihitung oleh payroll engine berdasarkan `resign_date`.
- FinalSettlementDialog HANYA menangani: pesangon/uang pisah dan pelunasan pinjaman. Tidak ada komponen "sisa cuti" atau "sisa periode" yang ditambahkan ke override (akan double-pay).
