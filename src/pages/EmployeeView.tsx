import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, MapPin, LogOut, Calendar, Clock, User } from "lucide-react";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const EmployeeView = () => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCheckIn = () => {
    setIsCheckedIn(true);
    toast({
      title: "Check-In Berhasil",
      description: "Terima kasih, kehadiran Anda telah tercatat",
    });
  };

  const handleCheckOut = () => {
    setIsCheckedIn(false);
    toast({
      title: "Check-Out Berhasil",
      description: "Sampai jumpa besok!",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logo} alt="Kemika" className="h-10 object-contain" />
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        {/* Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-xl">Budi Santoso</h2>
                <p className="text-muted-foreground">Quality Control</p>
                <p className="text-sm text-muted-foreground">NIK: NIK003</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Check-In/Out Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Absensi Hari Ini</CardTitle>
            <CardDescription className="text-center">
              Kamis, 26 November 2025
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {new Date().toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">Lokasi Terdeteksi</span>
                </div>
              </div>
            </div>

            {!isCheckedIn ? (
              <Button 
                className="w-full h-32 text-lg font-semibold gap-3" 
                onClick={handleCheckIn}
              >
                <Camera className="h-6 w-6" />
                Check-In Sekarang
              </Button>
            ) : (
              <>
                <div className="bg-primary/10 p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Check-In</p>
                  <p className="text-2xl font-bold text-primary">08:00</p>
                </div>
                <Button 
                  className="w-full h-32 text-lg font-semibold gap-3" 
                  variant="secondary"
                  onClick={handleCheckOut}
                >
                  <Camera className="h-6 w-6" />
                  Check-Out Sekarang
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-3 text-primary" />
              <p className="font-medium">Ajukan Cuti</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 text-center">
              <Clock className="h-8 w-8 mx-auto mb-3 text-primary" />
              <p className="font-medium">Lembur</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Absensi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { date: "25 Nov", checkIn: "08:00", checkOut: "17:00", status: "Hadir" },
                { date: "24 Nov", checkIn: "08:15", checkOut: "17:05", status: "Terlambat" },
                { date: "23 Nov", checkIn: "07:55", checkOut: "17:00", status: "Hadir" },
              ].map((record, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">{record.date}</p>
                    <p className="text-sm text-muted-foreground">
                      {record.checkIn} - {record.checkOut}
                    </p>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    record.status === "Hadir" 
                      ? "bg-primary/10 text-primary" 
                      : "bg-secondary/10 text-secondary"
                  }`}>
                    {record.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeView;
