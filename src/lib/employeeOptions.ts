// Employee position and department options for PT. Kemika Karya Pratama

export const JABATAN_OPTIONS = [
  "Komisaris",
  "CEO",
  "Direktur",
  "FAT Manager",
  "HR & GA Manager",
  "Government Sales Executive",
  "Office Boy",
  "Supervisor Sales",
  "Head Warehouse",
  "Accounting",
  "Driver",
  "Quality Control",
  "Technical & Sales Specialist",
  "Admin Marketing",
  "Admin Support",
  "Helper",
  "Purchasing + EXIM",
  "Marketing Support",
] as const;

export const DEPARTMENT_OPTIONS = [
  "Komisaris",
  "BOD",
  "FAT Department",
  "HR & GA Department",
  "Marketing & Sales Department",
  "Teknologi Informasi Department",
] as const;

export type Jabatan = typeof JABATAN_OPTIONS[number];
export type Department = typeof DEPARTMENT_OPTIONS[number];
