---
name: Batch D — Exit Interview, Handover & Asset Management
description: 4 tabel (assets, asset_assignments, exit_interviews, handover_checklists), halaman `/dashboard/assets` & `/dashboard/exit-management`, tab Aset di EmployeeDetailDialog.
type: feature
---
- `assets` + `asset_assignments`: master aset + assignment. Trigger `sync_asset_status_on_assignment` auto set status assets ke `assigned`/`available` sesuai assignment.
- `exit_interviews`: unique per employee, satisfaction JSON per kategori (management, culture, compensation, career_growth, work_life) skala 1-5.
- `handover_checklists`: unique per employee, items JSONB array `{label, done}`, status `in_progress`/`completed`; diverifikasi hanya jika semua item done.
- RLS: Admin/HR full akses; karyawan hanya lihat aset aktif miliknya + exit/handover-nya sendiri.
- Halaman `/dashboard/assets`: tab Master Aset (CRUD), Sedang Dipegang (assign/return), Riwayat.
- Halaman `/dashboard/exit-management`: karyawan Resigned/Inactive → Exit Interview & Handover Checklist.
- Tab **💻 Aset** di EmployeeDetailDialog memakai komponen `EmployeeAssets`.
