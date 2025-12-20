import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email harus diisi')
    .email('Format email tidak valid')
    .max(255, 'Email maksimal 255 karakter'),
  password: z
    .string()
    .min(1, 'Password harus diisi')
    .min(6, 'Password minimal 6 karakter')
    .max(128, 'Password maksimal 128 karakter'),
});

export const employeeSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email harus diisi')
    .email('Format email tidak valid')
    .max(255, 'Email maksimal 255 karakter'),
  password: z
    .string()
    .min(1, 'Password harus diisi')
    .min(8, 'Password minimal 8 karakter')
    .max(128, 'Password maksimal 128 karakter')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/,
      'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol'
    ),
  nik: z
    .string()
    .trim()
    .min(1, 'NIK harus diisi')
    .max(50, 'NIK maksimal 50 karakter'),
  full_name: z
    .string()
    .trim()
    .min(1, 'Nama lengkap harus diisi')
    .max(100, 'Nama maksimal 100 karakter'),
  jabatan: z
    .string()
    .min(1, 'Jabatan harus dipilih'),
  departemen: z
    .string()
    .min(1, 'Departemen harus dipilih'),
  phone: z
    .string()
    .trim()
    .max(20, 'Nomor telepon maksimal 20 karakter')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .max(500, 'Alamat maksimal 500 karakter')
    .optional()
    .or(z.literal('')),
});

export const employeeEditSchema = z.object({
  nik: z
    .string()
    .trim()
    .min(1, 'NIK harus diisi')
    .max(50, 'NIK maksimal 50 karakter'),
  full_name: z
    .string()
    .trim()
    .min(1, 'Nama lengkap harus diisi')
    .max(100, 'Nama maksimal 100 karakter'),
  jabatan: z
    .string()
    .min(1, 'Jabatan harus dipilih'),
  departemen: z
    .string()
    .min(1, 'Departemen harus dipilih'),
  phone: z
    .string()
    .trim()
    .max(20, 'Nomor telepon maksimal 20 karakter')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .max(500, 'Alamat maksimal 500 karakter')
    .optional()
    .or(z.literal('')),
  status: z
    .string()
    .optional(),
});

export const leaveRequestSchema = z.object({
  leaveType: z.enum(['cuti_tahunan', 'izin', 'sakit', 'lupa_absen'], {
    required_error: 'Jenis cuti harus dipilih',
  }),
  startDate: z.string().min(1, 'Tanggal mulai harus diisi'),
  endDate: z.string().min(1, 'Tanggal selesai harus diisi'),
  reason: z.string().trim().max(1000, 'Alasan maksimal 1000 karakter').optional().or(z.literal('')),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'Tanggal selesai harus setelah tanggal mulai',
  path: ['endDate'],
});

export const overtimeRequestSchema = z.object({
  overtimeDate: z.string().min(1, 'Tanggal lembur harus diisi'),
  startTime: z.string().min(1, 'Jam mulai harus diisi'),
  endTime: z.string().min(1, 'Jam selesai harus diisi'),
  reason: z.string().trim().min(1, 'Alasan harus diisi').max(1000, 'Alasan maksimal 1000 karakter'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type EmployeeFormData = z.infer<typeof employeeSchema>;
export type EmployeeEditFormData = z.infer<typeof employeeEditSchema>;
export type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;
export type OvertimeRequestFormData = z.infer<typeof overtimeRequestSchema>;
