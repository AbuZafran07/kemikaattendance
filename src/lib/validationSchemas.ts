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
    .min(6, 'Password minimal 6 karakter')
    .max(128, 'Password maksimal 128 karakter'),
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

export type LoginFormData = z.infer<typeof loginSchema>;
export type EmployeeFormData = z.infer<typeof employeeSchema>;
export type EmployeeEditFormData = z.infer<typeof employeeEditSchema>;
