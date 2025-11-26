import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Bell, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    notifyCheckIn: true,
    notifyCheckOut: true,
    notifyLeaveRequest: true,
    notifyOvertimeRequest: true,
    notifyMissedCheckIn: true,
    missedCheckInTime: "09:00",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'notification_settings')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data && data.value) {
        setSettings({ ...settings, ...data.value as any });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'notification_settings',
          value: settings,
          description: 'Pengaturan notifikasi untuk admin'
        });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pengaturan notifikasi berhasil disimpan",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan pengaturan",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof typeof settings) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleTimeChange = (value: string) => {
    setSettings({ ...settings, missedCheckInTime: value });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Pengaturan Notifikasi</h1>
            <p className="text-muted-foreground">
              Kelola pengaturan notifikasi push untuk admin
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifikasi Absensi
            </CardTitle>
            <CardDescription>
              Pengaturan notifikasi untuk aktivitas check-in dan check-out
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notifyCheckIn" className="cursor-pointer">
                <div>
                  <p className="font-medium">Notifikasi Check-In</p>
                  <p className="text-sm text-muted-foreground">
                    Terima notifikasi ketika karyawan melakukan check-in
                  </p>
                </div>
              </Label>
              <Switch
                id="notifyCheckIn"
                checked={settings.notifyCheckIn}
                onCheckedChange={() => handleToggle('notifyCheckIn')}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notifyCheckOut" className="cursor-pointer">
                <div>
                  <p className="font-medium">Notifikasi Check-Out</p>
                  <p className="text-sm text-muted-foreground">
                    Terima notifikasi ketika karyawan melakukan check-out
                  </p>
                </div>
              </Label>
              <Switch
                id="notifyCheckOut"
                checked={settings.notifyCheckOut}
                onCheckedChange={() => handleToggle('notifyCheckOut')}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notifyMissedCheckIn" className="cursor-pointer">
                <div>
                  <p className="font-medium">Peringatan Belum Check-In</p>
                  <p className="text-sm text-muted-foreground">
                    Kirim notifikasi ke karyawan yang belum check-in
                  </p>
                </div>
              </Label>
              <Switch
                id="notifyMissedCheckIn"
                checked={settings.notifyMissedCheckIn}
                onCheckedChange={() => handleToggle('notifyMissedCheckIn')}
              />
            </div>

            {settings.notifyMissedCheckIn && (
              <div className="ml-6 flex items-center gap-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="missedCheckInTime" className="text-sm">
                  Waktu pengiriman peringatan:
                </Label>
                <Input
                  id="missedCheckInTime"
                  type="time"
                  value={settings.missedCheckInTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-32"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifikasi Permintaan
            </CardTitle>
            <CardDescription>
              Pengaturan notifikasi untuk permintaan cuti dan lembur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notifyLeaveRequest" className="cursor-pointer">
                <div>
                  <p className="font-medium">Notifikasi Permintaan Cuti</p>
                  <p className="text-sm text-muted-foreground">
                    Terima notifikasi untuk setiap permintaan cuti baru
                  </p>
                </div>
              </Label>
              <Switch
                id="notifyLeaveRequest"
                checked={settings.notifyLeaveRequest}
                onCheckedChange={() => handleToggle('notifyLeaveRequest')}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notifyOvertimeRequest" className="cursor-pointer">
                <div>
                  <p className="font-medium">Notifikasi Permintaan Lembur</p>
                  <p className="text-sm text-muted-foreground">
                    Terima notifikasi untuk setiap permintaan lembur baru
                  </p>
                </div>
              </Label>
              <Switch
                id="notifyOvertimeRequest"
                checked={settings.notifyOvertimeRequest}
                onCheckedChange={() => handleToggle('notifyOvertimeRequest')}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/settings')}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default NotificationSettings;
