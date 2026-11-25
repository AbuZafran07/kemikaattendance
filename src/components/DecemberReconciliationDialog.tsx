import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { formatRupiah, getPphLabel } from '@/lib/payrollCalculation';
import { loadDecemberSimulation } from '@/lib/payrollTaxData';

export default function DecemberReconciliationDialog({ open, onOpenChange, year }: { open: boolean; onOpenChange: (open: boolean) => void; year: number }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadDecemberSimulation>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError('');
    loadDecemberSimulation(year).then(data => { if (active) setRows(data); }).catch(() => { if (active) setError('Simulasi tidak dapat dimuat.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, year]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[95vw] max-w-6xl max-h-[85dvh] overflow-y-auto">
    <DialogHeader className="text-left"><DialogTitle className="pr-8">Simulasi Rekonsiliasi Desember {year}</DialogTitle><DialogDescription>Estimasi memakai bruto dan iuran karyawan November bila payroll Desember belum dibuat. Tidak mengubah payroll atau potongan yang sudah dibayar.</DialogDescription></DialogHeader>
    {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : <div className="overflow-x-auto"><Table>
      <TableHeader><TableRow>{['Karyawan','Bulan','Bruto pajak setahun','Biaya jabatan','JHT + JP karyawan','PTKP','PKP','Pajak setahun','PPh Jan–Nov','PPh Desember'].map(label => <TableHead key={label} className="whitespace-nowrap">{label}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={row.id}><TableCell className="min-w-48">{row.name}<span className="block text-xs text-muted-foreground">{row.estimated ? 'Estimasi November' : 'Payroll Desember tersimpan'}</span></TableCell><TableCell>{row.months}</TableCell>{[row.bruto,row.biayaJabatan,row.bpjs,row.ptkp,row.pkp,row.yearlyTax,row.withheld].map((n,i) => <TableCell key={i} className="text-right whitespace-nowrap">{formatRupiah(n)}</TableCell>)}<TableCell className="text-right min-w-48"><span className={row.tax < 0 ? 'text-primary font-semibold' : 'font-semibold'}>{formatRupiah(row.tax)}</span>{row.tax < 0 && <span className="block text-xs text-primary">{getPphLabel(row.tax)}</span>}</TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={10}>Belum ada payroll November/Desember untuk disimulasikan.</TableCell></TableRow>}</TableBody>
    </Table></div>}
  </DialogContent></Dialog>;
}