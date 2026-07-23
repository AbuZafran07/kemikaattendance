---
name: Contract Lifecycle Management
description: Riwayat kontrak, notifikasi H-30/H-7/EXPIRED, log reminder, dan halaman Notifikasi Kontrak.
type: feature
---
Perubahan `contract_number/type/start/end` di `profiles` otomatis mencatat ke `contract_history` via trigger `log_contract_change`. Tab "📜 Kontrak" di EmployeeDetailDialog menampilkan timeline.

Edge function `contract-reminder-scheduler` dijadwalkan pg_cron harian 01:00 UTC (08:00 WIB) untuk H-30, H-7, dan EXPIRED. Mengirim FCM + email (Resend) ke seluruh Admin & HR, log ke `contract_reminders_log` (unique per employee+end_date+type untuk cegah duplikat).

Halaman `/dashboard/contract-notifications` (di sidebar LAPORAN) menampilkan daftar kontrak akan berakhir ≤60 hari dan riwayat reminder, dengan tombol "Jalankan Sekarang" untuk trigger manual.
