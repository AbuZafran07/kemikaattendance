import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function OvertimeSettings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kebijakan Lembur</h1>
          <p className="text-muted-foreground mt-1">Atur aturan dan kompensasi lembur</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Pengaturan Kebijakan Lembur
            </CardTitle>
            <CardDescription>
              Halaman ini sedang dalam pengembangan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Fitur pengaturan kebijakan lembur akan segera tersedia.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
