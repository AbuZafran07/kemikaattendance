import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function OfficeSettings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lokasi Kantor</h1>
          <p className="text-muted-foreground mt-1">Kelola lokasi dan koordinat GPS kantor</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Pengaturan Lokasi Kantor
            </CardTitle>
            <CardDescription>
              Halaman ini sedang dalam pengembangan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Fitur pengaturan lokasi kantor akan segera tersedia.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
