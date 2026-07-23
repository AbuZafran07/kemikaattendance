import { useAuth } from "@/contexts/AuthContext";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";
import { EmployeeTrainings } from "@/components/EmployeeTrainings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EmployeeTrainingPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 pb-24">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/employee/self-service")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Training & Sertifikasi</h1>
              <p className="text-xs text-muted-foreground">Riwayat training dan sertifikat Anda.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Riwayat Training Saya</CardTitle></CardHeader>
          <CardContent>
            {profile?.id ? (
              <EmployeeTrainings employeeId={profile.id} canEdit />
            ) : (
              <p className="text-center text-muted-foreground py-8">Memuat...</p>
            )}
          </CardContent>
        </Card>
      </div>

      <EmployeeBottomNav />
    </div>
  );
};

export default EmployeeTrainingPage;
