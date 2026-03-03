/**
 * Generate bank e-Payroll CSV file for bulk salary transfers.
 * Format: semicolon-separated values matching Indonesian bank bulk payment format.
 */

// Bank code mapping for common Indonesian banks
const BANK_CODES: Record<string, { code: string; fullName: string }> = {
  'bca': { code: '0141820', fullName: 'BCA (Bank Central Asia)' },
  'bri': { code: 'BRINIDJA', fullName: 'BRI (Bank Rakyat Indonesia)' },
  'mandiri': { code: '008', fullName: 'PT. Bank Mandiri Tbk.' },
  'bsi': { code: '4510539', fullName: 'Bank Syariah Indonesia' },
  'bank syariah indonesia': { code: '4510539', fullName: 'Bank Syariah Indonesia' },
  'bank syariah mandiri': { code: '4510539', fullName: 'Bank Syariah Mandiri' },
  'bni': { code: '0091310', fullName: 'BNI (Bank Negara Indonesia)' },
  'cimb': { code: '0221520', fullName: 'CIMB Niaga' },
  'danamon': { code: '0111320', fullName: 'Bank Danamon' },
  'permata': { code: '0131320', fullName: 'Bank Permata' },
  'btpn': { code: '2131320', fullName: 'Bank BTPN' },
  'mega': { code: '4260426', fullName: 'Bank Mega' },
  'ocbc': { code: '0281520', fullName: 'OCBC NISP' },
};

export interface BankPayrollConfig {
  companyAccountNumber: string;
  companyBankName: string;
}

export interface BankPayrollEmployee {
  bankAccountNumber: string;
  fullName: string;
  amount: number; // take_home_pay (rounded to integer)
  nik: string;
  email: string;
  bankName: string;
  seqNumber: number;
}

function getBankInfo(bankName: string): { code: string; fullName: string; isOBU: boolean } {
  const key = bankName.toLowerCase().trim();

  // Direct match
  if (BANK_CODES[key]) {
    return { ...BANK_CODES[key], isOBU: true };
  }

  // Partial match
  for (const [k, v] of Object.entries(BANK_CODES)) {
    if (key.includes(k) || k.includes(key)) {
      return { ...v, isOBU: true };
    }
  }

  // Unknown bank - treat as IBU (inter-bank)
  return { code: '000', fullName: bankName, isOBU: false };
}

function determineTransferType(
  employeeBankName: string,
  companyBankName: string
): 'OBU' | 'IBU' {
  const empKey = employeeBankName.toLowerCase().trim();
  const compKey = companyBankName.toLowerCase().trim();

  // Check if same bank family
  const normalize = (name: string) => {
    if (name.includes('mandiri') && !name.includes('syariah')) return 'mandiri';
    if (name.includes('bca')) return 'bca';
    if (name.includes('bri') && !name.includes('syariah')) return 'bri';
    if (name.includes('bsi') || name.includes('syariah')) return 'bsi';
    if (name.includes('bni')) return 'bni';
    return name;
  };

  return normalize(empKey) === normalize(compKey) ? 'OBU' : 'IBU';
}

export function generateBankPayrollCSV(
  config: BankPayrollConfig,
  employees: BankPayrollEmployee[],
  month: number,
  year: number
): string {
  const today = new Date();
  const dateStr = `${year}${String(month).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const totalAmount = employees.reduce((sum, e) => sum + Math.round(e.amount), 0);
  const paddingFields = ';;;;;;;;;;;;;;;;;;;OUR;;;;;;;;;;;;;;;;';

  // Header line
  const header = `P;${dateStr};${config.companyAccountNumber};${employees.length};${totalAmount}`;

  // Detail lines
  const details = employees.map((emp, idx) => {
    const bankInfo = getBankInfo(emp.bankName);
    const transferType = determineTransferType(emp.bankName, config.companyBankName);
    const amount = Math.round(emp.amount);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const description = `Gaji ${monthNames[month - 1]}`;
    const seqStr = String(emp.seqNumber).padStart(2, '0');
    const reference = `${seqStr}-${emp.nik}`;

    return `${emp.bankAccountNumber};${emp.fullName};;;;IDR;${amount};${description};${reference};${transferType};${bankInfo.code};${bankInfo.fullName};;;;;Y;${emp.email}${paddingFields}`;
  });

  return [header, ...details].join('\n');
}

export function downloadBankPayrollFile(
  csvContent: string,
  month: number,
  year: number
) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const fileName = `e-payroll_${monthNames[month - 1]}_${year}.txt`;

  const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
