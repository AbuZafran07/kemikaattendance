import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function WorkHoursSettings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jam Kerja</h1>
          <p className="text-muted-foreground mt-1">Atur jam kerja dan toleransi keterlambatan</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pengaturan Jam Kerja
            </CardTitle>
            <CardDescription>
              Halaman ini sedang dalam pengembangan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Fitur pengaturan jam kerja akan segera tersedia.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
