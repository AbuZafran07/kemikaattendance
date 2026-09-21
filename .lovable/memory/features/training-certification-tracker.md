---
name: Training & Certification Tracker
description: Master program training, riwayat training karyawan, sertifikat, dan monitor sertifikasi kadaluarsa.
type: feature
---
Tabel `training_programs` (master: nama, kategori, penyelenggara, biaya, durasi_jam, deskripsi, is_active) dan `employee_trainings` (employee_id, training_id opsional, training_name, start/end date, status planned/ongoing/completed/cancelled, score, expiry_date, certificate_url, notes). Bucket private `training-certificates` — path `{user_id}/...`; RLS owner-only + admin/HR bypass.

Halaman `/dashboard/training` (sidebar MANAJEMEN) 3 tab: **Program** (CRUD admin/HR), **Riwayat Karyawan** (all history + download sertifikat), **Kedaluwarsa** (≤60 hari, sorted). Tab "🎓 Training" tersedia di `EmployeeDetailDialog`. Karyawan akses via `/employee/training` (self service) — bisa tambah/edit/upload sertifikat trainingnya sendiri.
