# Perbaikan Laporan Absensi (PDF & Excel)

## Masalah yang ditemukan
Baris laporan dibentuk dengan cara menggabungkan tiga sumber (absensi, cuti/izin, dinas) lalu digabung apa adanya, tanpa dikunci per tanggal:

- **Tanggal double** (contoh Iqbal 2026-08-10): pengajuan "Lupa Absen" yang disetujui otomatis membuat baris absensi, tetapi pengajuan cutinya juga tetap dicetak sebagai baris terpisah pada tanggal yang sama.
- **Tanggal hari kerja hilang** (contoh Arief): hari kerja tanpa absensi dan tanpa pengajuan apa pun tidak menghasilkan baris sama sekali, sehingga tidak terlihat bahwa karyawan tidak masuk.
- Bila ada lebih dari satu record absensi di satu tanggal, semuanya tercetak sebagai baris terpisah.

## Yang akan diperbaiki

1. **Satu tanggal = satu baris.** Laporan dibangun dari kalender hari kerja pada rentang tanggal (Sabtu, Minggu, dan hari libur nasional dikecualikan seperti sekarang), lalu setiap tanggal diisi dengan prioritas:
   1. Record absensi (jika ada) — jam masuk paling awal & jam keluar paling akhir bila ada beberapa record
   2. Dinas
   3. Cuti / Izin / Sakit
   4. Bila tidak ada apa pun → **Tidak Hadir** dengan jam "-"

2. **Lupa Absen hanya pada tanggal yang sudah terisi.** Pengajuan lupa absen tidak lagi membuat baris sendiri; keterangannya digabung ke baris absensi tanggal tersebut. Jika tanggalnya belum punya record absensi, baru ditampilkan satu baris Lupa Absen.

3. **Batas masa kerja dihormati.** Baris "Tidak Hadir" hanya dibuat untuk tanggal setelah tanggal masuk dan sebelum tanggal resign karyawan, agar tidak muncul tanggal di luar masa aktif.

4. Perbaikan berlaku otomatis untuk **Excel dan PDF** (per karyawan maupun "Semua Karyawan"), karena keduanya memakai sumber baris yang sama. Ringkasan/summary dan insight AI tetap seperti sekarang.

5. Laporan absensi pada halaman **Laporan** (export Excel & PDF tipe "Absensi") juga disesuaikan dengan aturan yang sama: dedup per karyawan+tanggal, lupa absen tidak dobel, dan hari kerja tanpa kehadiran muncul sebagai "Tidak Hadir".

## Detail teknis
- `src/pages/EmployeeReports.tsx`: `formatRecords()` diubah menjadi berbasis `Map<tanggal, row>`; tambahan input `join_date`/`resign_date` dari profil karyawan; urutan tetap terbaru→terlama.
- `src/pages/Reports.tsx`: blok `reportType === "attendance"` pada `exportToExcel()` dan `exportToPDF()` memakai helper baru yang sama (kunci `user_id|tanggal`), termasuk pembuatan baris "Tidak Hadir" per hari kerja untuk karyawan yang tercakup filter.
- Tidak ada perubahan skema database dan tidak ada perubahan layout halaman.
