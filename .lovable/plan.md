
# Roadmap Implementasi (4 Batch)

Scope besar, saya pecah jadi 4 batch supaya bisa diuji per modul. Setiap batch = 1 sesi eksekusi. Setelah Anda approve plan ini, saya mulai **Batch A** dulu.

---

## Batch A — Kontrak & Notifikasi Kontrak

**Database**
- Tabel `contract_history`: `id`, `employee_id`, `contract_number`, `contract_type`, `start_date`, `end_date`, `changes` (jsonb: before/after), `notes`, `created_by`, `created_at`.
- Tabel `contract_reminders_log`: `id`, `employee_id`, `contract_end_date`, `reminder_type` (H30/H7/EXPIRED), `sent_at`, `channels` (jsonb: fcm/email status), `recipients` (jsonb).
- RLS: admin/HR full; karyawan lihat miliknya sendiri (contract_history only).
- Trigger: saat `profiles.contract_end_date` / `contract_number` / `contract_type` diubah → auto-insert row `contract_history` dengan diff.

**UI**
- `src/components/EmployeeDetailDialog.tsx`: tab baru **Riwayat Kontrak** — timeline perpanjangan (nomor, periode, tipe, perubahan, dibuat oleh).
- Halaman baru `/dashboard/contract-notifications` (sidebar MANAJEMEN):
  - Tab **Kontrak Aktif**: daftar karyawan kontrak + sisa hari + status reminder terakhir.
  - Tab **Riwayat Reminder**: log H-30/H-7/EXPIRED per karyawan, kanal & status pengiriman.

**Edge function**
- `contract-reminder-scheduler` (cron harian 08:00 WIB via pg_cron):
  - Scan `profiles` dengan `contract_end_date` = today+30 atau today+7 atau today.
  - Kirim FCM ke admin/HR + email via Resend (RESEND_API_KEY sudah ada).
  - Karyawan bersangkutan juga dapat FCM/email.
  - Insert log ke `contract_reminders_log`.
- Badge notifikasi in-app di bell admin.

---

## Batch B — Struktur Organisasi Visual (Org Chart)

- Tambah kolom `profiles.reports_to` (uuid FK ke profiles).
- Halaman `/dashboard/org-chart`:
  - Rendering pohon hierarki (react-flow / custom tree) dari CEO/pimpinan ke bawah berdasarkan `reports_to`.
  - Node: foto, nama, jabatan, departemen. Zoom/pan.
  - Filter per departemen.
  - Export PNG.
- Dialog edit atasan di `Employees.tsx`.

---

## Batch C — Training & Sertifikasi Tracker

**Database**
- `training_programs`: master training (nama, kategori, penyelenggara, biaya).
- `employee_trainings`: employee_id, training_id, tgl mulai/selesai, status, sertifikat_url, skor, expiry_date, notes.
- Bucket storage `training-certificates` (private).

**UI**
- Halaman `/dashboard/training`:
  - Tab **Program**: master training (admin CRUD).
  - Tab **Riwayat Karyawan**: siapa ikut training apa, status, sertifikat.
  - Tab **Sertifikasi Kadaluarsa**: sertifikat expiring dalam 60 hari.
- Tab **Training** di `EmployeeDetailDialog`.
- Karyawan bisa lihat & upload sertifikat sendiri di Employee Self Service.

---

## Batch D — Exit Interview, Handover & Asset Management

**Database**
- `assets`: id, asset_code, name, category (Laptop/HP/dll), brand, serial_number, purchase_date, purchase_price, condition, status (available/assigned/maintenance/lost).
- `asset_assignments`: asset_id, employee_id, assigned_at, returned_at, condition_out, condition_in, notes.
- `exit_interviews`: employee_id, interview_date, reason, satisfaction (jsonb rating), suggestions, would_recommend, interviewer.
- `handover_checklists`: employee_id, item (jsonb list: asset, akun, dokumen, tugas), status, verified_by.

**UI**
- Halaman `/dashboard/assets` (sidebar MANAJEMEN):
  - Master asset (CRUD, kategori, kondisi).
  - Assign/return asset ke karyawan (dengan foto kondisi opsional).
  - Riwayat pemegang per asset.
- Tab **Aset Dipegang** di `EmployeeDetailDialog`.
- Halaman `/dashboard/exit-management`:
  - Tab **Exit Interview**: form terstruktur (alasan, rating budaya kerja, saran).
  - Tab **Handover Checklist**: template item (asset return, akun email, dokumen serah terima, transfer knowledge) + verifikasi HR.
- Integrasi ke `FinalSettlementDialog`: block finalisasi jika handover belum 100% & aset belum return.

---

## Catatan Teknis

- Semua tabel di schema `public`, wajib GRANT + RLS + policy per role.
- Trigger `update_updated_at_column` untuk audit timestamp.
- FCM pakai `send-notification` edge function existing. Email pakai Resend (secret sudah ada).
- Cron pakai `pg_cron` + `pg_net` yang sudah aktif (mengikuti pola `scheduled-backup`).
- Semua halaman baru daftarkan di `DashboardLayout` sidebar (kategori MANAJEMEN) dan `App.tsx` routing.
- i18n keys ditambahkan di `id.json` & `en.json`.

## Kanal Notifikasi Default (Batch A)

- **Penerima**: admin + HR + karyawan bersangkutan.
- **Kanal**: FCM push (in-app) + Email Resend.
- Kalau mau berbeda, beri tahu sebelum saya mulai Batch A.

## Urutan Eksekusi

1. Approve plan → saya kerjakan **Batch A** penuh (DB + UI + edge function + cron).
2. Setelah Anda test & OK → Batch B.
3. Lanjut C, lalu D.

Kalau setuju, balas **"lanjut Batch A"**. Kalau mau ubah urutan/scope batch, beri tahu.
