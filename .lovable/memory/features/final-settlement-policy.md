---
name: final-settlement-policy
description: Final Settlement disimpan terpisah dari payroll bulanan; slip & e-Payroll bulanan tetap berisi prorata saja. Settlement diekspor via "e-Payroll Final Settlement".
type: feature
---

## Final Settlement Policy

Karyawan resign:
- Slip Juni & Juli = gaji prorata normal (s/d resign_date). Tidak ada baris pesangon/pelunasan pinjaman di slip.
- e-Payroll bulanan = nominal prorata bulan tersebut.
- Sisa cuti **tidak diuangkan** — dipakai sebagai hari kerja s/d resign_date.

Pesangon/uang pisah & pelunasan pinjaman disimpan di tabel `final_settlements`:
- Kolom: `pesangon_amount`, `loan_payoff`, `net_amount`, `status` (pending/paid).
- Diisi via tombol "Final Settlement" di profil karyawan.
- Diekspor lewat menu Payroll → Export → **e-Payroll Final Settlement** (CSV bank).
- Setelah export, status berubah jadi `paid`.

Tidak menulis ke `payroll_overrides` (agar slip & monthly bank export bersih).
