# Project Memory

## Core
- (kept minimal; add universal rules here when needed)

## Memories
- [Employee Resign Notes](mem://features/employee-resign-notes) — Optional `resign_notes` & `notes` on `profiles`; editable in employee edit dialog and shown in detail dialog.
- [Final Settlement Policy](mem://features/final-settlement-policy) — Sisa cuti dipakai sbg hari kerja s/d resign_date (tidak diuangkan). Dialog hanya isi pesangon & pelunasan pinjaman.
- [Contract Lifecycle](mem://features/contract-lifecycle-management) — Riwayat kontrak (trigger `log_contract_change`), reminder H-30/H-7/EXPIRED harian via pg_cron, halaman `/dashboard/contract-notifications`.
- [Org Chart](mem://features/org-chart) — Kolom `reports_to` di profiles + halaman `/dashboard/org-chart` (tree collapsible, search + filter departemen).
- [Training Tracker](mem://features/training-certification-tracker) — `training_programs` + `employee_trainings` + bucket `training-certificates`; halaman `/dashboard/training` (Program/Riwayat/Kedaluwarsa) & `/employee/training`; tab Training di EmployeeDetailDialog.
