import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function LeaveSettings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kebijakan Cuti</h1>
          <p className="text-muted-foreground mt-1">Kelola kuota dan aturan cuti</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Pengaturan Kebijakan Cuti
            </CardTitle>
            <CardDescription>Halaman ini sedang dalam pengembangan</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Fitur pengaturan kebijakan cuti akan segera tersedia.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
