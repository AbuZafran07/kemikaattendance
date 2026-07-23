---
name: Organization Structure (Org Chart)
description: Struktur organisasi visual berbasis kolom reports_to di profiles.
type: feature
---
Kolom `reports_to UUID` di `profiles` (self-reference, ON DELETE SET NULL) menyimpan atasan langsung. Diedit di dialog Edit Karyawan (Employees.tsx) via dropdown karyawan aktif.

Halaman `/dashboard/org-chart` (sidebar MANAJEMEN, ikon Network) menampilkan pohon hierarki collapsible dengan Avatar/nama/jabatan/departemen, dukungan pencarian (auto-include ancestor untuk jaga hierarki) dan filter departemen. Karyawan `reports_to` menunjuk ke user tidak aktif ditampilkan di bagian "orphans".
