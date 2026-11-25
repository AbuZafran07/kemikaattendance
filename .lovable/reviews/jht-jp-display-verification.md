# Pemeriksaan rincian JHT dan JP karyawan

Tanggal: 25 November 2026.

## Hasil

Perbaikan hanya pada rincian tampilan di laporan PDF payroll, slip PDF, detail payroll administrator, riwayat payroll karyawan, dan ekspor Excel payroll. Angka gabungan BPJS, BPJS Kesehatan, PPh 21, netto, bruto pajak, total potongan, dan Take Home Pay tidak diubah.

| Karyawan — November 2026 | Dasar BPJS tersimpan | JHT karyawan | JP karyawan | Total tersimpan |
| --- | ---: | ---: | ---: | ---: |
| Haris Pratama Putra | Rp43.928.000 | Rp878.560 | Rp110.863 | Rp989.423 |
| Iin Marlinda | Rp24.911.000 | Rp498.220 | Rp110.863 | Rp609.083 |
| Deni | Rp3.176.500 | Rp63.530 | Rp31.765 | Rp95.295 |

## Daftar penggunaan lama sebelum perubahan

- `src/lib/payslipPdfGenerator.ts`, baris awal 165–166: JHT dibagi 2/3 dari total; JP merupakan sisanya.
- `src/lib/payrollReportPdfGenerator.ts`, baris awal 330–331: pembagian yang sama per karyawan pada halaman potongan.
- `src/lib/payrollReportPdfGenerator.ts`, baris awal 356–357: subtotal kolom JHT dan JP juga memakai pembagian lama.
- `src/pages/Payroll.tsx`: detail layar dan ekspor Excel sebelumnya hanya menampilkan gabungan BPJS TK+JP.
- `src/pages/EmployeePayrollHistory.tsx`: detail layar sebelumnya hanya menampilkan gabungan; slip PDF mengikuti generator lama.
- Tidak ditemukan pembagian 2:1 lain untuk rincian BPJS karyawan dalam kode aplikasi. Pembagian lebar kolom/kartu dan kelas ukuran 2/3 bukan perhitungan BPJS.

## Cara perbaikan

Helper tampilan `splitBpjsKtEmployee` menghitung JP dengan plafon sesuai bulan payroll, lalu menentukan JHT sebagai total tersimpan dikurangi JP. Helper tidak memanggil perhitungan ulang payroll dan tidak menulis ke database.

Dasar BPJS memakai `basic_salary`, `tunjangan_jabatan`, dan `tunjangan_operasional` pada baris payroll asli, sebelum pengayaan tampilan dengan profil. Komponen profil saat ini tidak digunakan untuk membagi JHT/JP. Tampilan komponen penghasilan lain tidak dirombak.

Sebelum Juni 2026, dasar tampilan hanya gaji pokok. Juni 2026 dan sesudahnya memakai kebijakan yang efektif pada 2 Juni 2026 beserta komponen tetap yang diaktifkan. Plafon JP diambil dari riwayat: Februari Rp10.547.400 dan Maret Rp11.086.300. Tarif JP berasal dari konfigurasi BPJS.

Jika dasar/konfigurasi historis tidak tersedia atau JP melebihi gabungan tersimpan, pembagian lama digunakan dengan tanda **perkiraan**. Total JHT+JP tetap berasal dari angka tersimpan. Potongan nol ditampilkan sebagai JHT nol dan JP nol.

## Pengujian

- **14 pengujian baru lulus**: Haris, Iin, Deni, plafon Februari/Maret, dasar sebelum/sesudah Juni, komponen tetap aktif, JP melebihi total, dasar/tunjangan/konfigurasi tidak tersedia, potongan nol, total tetap utuh, serta sumber tidak dimutasi.
- **24 pengujian payroll sebelumnya lulus**; total **38 lulus, 0 gagal**.
- Pemeriksaan read-only terhadap **191 baris Januari–November 2026**: seluruh JHT+JP tepat sama dengan `bpjs_ketenagakerjaan` tersimpan; **0 selisih**.
- Daftar baris yang memakai fallback pada data produksi: **tidak ada**.
- Sidik data masing-masing dari 11 bulan identik sebelum dan sesudah pemeriksaan, termasuk semua 174 baris final dan 17 baris November.
- Dengan akun administrator aktif, unduhan laporan PDF, Excel dan slip Haris untuk Oktober serta November berhasil; rincian Haris dan Iin juga diperiksa pada layar desktop/ponsel. Tidak ada kesalahan halaman.
- Excel Oktober dan November diperiksa masing-masing 17 baris: rincian JHT/JP, gabungan BPJS, BPJS Kesehatan, PPh 21, netto dan THP cocok dengan data tersimpan.
- PDF sebelum/sesudah dibandingkan untuk 17 karyawan per bulan: angka setiap baris tetap sama selain rincian JHT/JP. Angka halaman penghasilan, ringkasan dan kontribusi perusahaan juga identik, terlepas dari waktu cetak dan urutan baris pembanding.
- Slip Haris Oktober/November dibandingkan dengan generator sebelum perubahan: Total Income, Total Deduction, THP dan bruto pajak identik.
- PDF fallback diuji menggunakan salinan sementara, tanpa menyimpan payroll: tetap berhasil diunduh dan memuat tanda perkiraan.
- Riwayat payroll karyawan sudah memakai hasil helper yang sama, tetapi belum diuji menggunakan sesi akun karyawan terpisah; pemeriksaan langsung dilakukan dengan akun administrator pengguna.

## Total laporan Oktober dan November tidak berubah

Berikut angka seperti ditampilkan pada laporan PDF (pembulatan tampilan rupiah tetap seperti sebelumnya):

| Total laporan | Oktober 2026 sebelum = sesudah | November 2026 sebelum = sesudah |
| --- | ---: | ---: |
| Bruto pajak | Rp198.586.220 | Rp209.157.775 |
| BPJS TK+JP karyawan | Rp4.002.963 | Rp4.013.741 |
| BPJS Kesehatan karyawan | Rp1.045.078 | Rp1.045.078 |
| PPh 21 | Rp15.527.952 | Rp17.423.355 |
| Total potongan | Rp20.909.323 | Rp22.482.174 |
| Take Home Pay | Rp172.690.109 | Rp181.688.813 |

Subtotal kolom JHT dan JP masing-masing berubah mengikuti rincian yang benar; jumlah keduanya tidak berubah. Tidak ada pembulatan baru pada total atau PPh.

Khusus Oktober, Haris menjadi JHT Rp873.171 + JP Rp110.863 = total historis Rp984.034; Iin menjadi JHT Rp492.831 + JP Rp110.863 = total historis Rp603.694. JHT tersebut adalah sisa dari total historis, **bukan** perhitungan ulang 2% yang dapat menggeser pembayaran lama.

## File yang diubah

1. `src/lib/payrollCalculation.ts` — helper tampilan dan tipe tanggal efektif konfigurasi; rumus `calculatePayroll` tidak diubah.
2. `src/lib/payrollReportPdfGenerator.ts` — rincian dan subtotal JHT/JP memakai hasil helper.
3. `src/lib/payslipPdfGenerator.ts` — rincian JHT/JP dan penanda perkiraan.
4. `src/pages/Payroll.tsx` — mengambil hasil dari baris historis asli dan memakainya pada detail, PDF serta Excel.
5. `src/pages/EmployeePayrollHistory.tsx` — hasil historis yang sama untuk detail dan slip.
6. `src/lib/payrollBpjsDisplay.test.js` — 14 pengujian baru.
7. `AGENTS.md` — aturan arsitektur untuk pemisahan BPJS tampilan tanpa menggeser total historis.
8. `roadmap.md` — daftar pekerjaan dan hasil verifikasi.
9. `.lovable/reviews/jht-jp-display-verification.md` — laporan pemeriksaan ini.

**Tidak ada migrasi, perubahan tabel, perubahan konfigurasi tersimpan, perubahan data payroll, perubahan rumus payroll, maupun Generate ulang bulan mana pun.**