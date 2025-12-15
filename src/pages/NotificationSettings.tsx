import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Bell, Clock, AlertTriangle, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NotificationSettingsConfig {
  notifyCheckIn: boolean;
  notifyCheckOut: boolean;
  notifyLeaveRequest: boolean;
  notifyOvertimeRequest: boolean;
  notifyMissedCheckIn: boolean;
  missedCheckInTime: string;
  notifyLowLeaveQuota: boolean;
  lowLeaveQuotaThreshold: number;
}

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettingsConfig>({
    notifyCheckIn: true,
    notifyCheckOut: true,
    notifyLeaveRequest: true,
    notifyOvertimeRequest: true,
    notifyMissedCheckIn: true,
    missedCheckInTime: "09:00",
    notifyLowLeaveQuota: true,
    lowLeaveQuotaThreshold: 3,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

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
      // Check if setting exists
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'notification_settings')
        .maybeSingle();

      let error;
      if (existing) {
        const result = await supabase
          .from('system_settings')
          .update({ value: settings as any, description: 'Pengaturan notifikasi untuk admin' })
          .eq('key', 'notification_settings');
        error = result.error;
      } else {
        const result = await supabase
          .from('system_settings')
          .insert({ key: 'notification_settings', value: settings as any, description: 'Pengaturan notifikasi untuk admin' });
        error = result.error;
      }

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

  const handleSendLeaveQuotaReminder = async () => {
    setIsSendingReminder(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-leave-quota', {
        body: { threshold: settings.lowLeaveQuotaThreshold }
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: data.message || "Reminder kuota cuti berhasil dikirim",
      });
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal mengirim reminder",
        variant: "destructive",
      });
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleToggle = (key: keyof NotificationSettingsConfig) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleTimeChange = (value: string) => {
    setSettings({ ...settings, missedCheckInTime: value });
  };

  const handleThresholdChange = (value: number) => {
    setSettings({ ...settings, lowLeaveQuotaThreshold: Math.max(1, Math.min(value, 30)) });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Pengaturan Notifikasi</h1>
            <p className="text-muted-foreground">
              Kelola pengaturan notifikasi push untuk admin dan karyawan
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Reminder Kuota Cuti
            </CardTitle>
            <CardDescription>
              Pengaturan reminder otomatis untuk karyawan dengan kuota cuti hampir habis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notifyLowLeaveQuota" className="cursor-pointer">
                <div>
                  <p className="font-medium">Aktifkan Reminder Kuota Cuti</p>
                  <p className="text-sm text-muted-foreground">
                    Kirim notifikasi ke karyawan yang kuota cutinya hampir habis
                  </p>
                </div>
              </Label>
              <Switch
                id="notifyLowLeaveQuota"
                checked={settings.notifyLowLeaveQuota}
                onCheckedChange={() => handleToggle('notifyLowLeaveQuota')}
              />
            </div>

            {settings.notifyLowLeaveQuota && (
              <div className="ml-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="lowLeaveQuotaThreshold" className="text-sm whitespace-nowrap">
                    Threshold kuota cuti:
                  </Label>
                  <Input
                    id="lowLeaveQuotaThreshold"
                    type="number"
                    min={1}
                    max={30}
                    value={settings.lowLeaveQuotaThreshold}
                    onChange={(e) => handleThresholdChange(parseInt(e.target.value) || 3)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">hari atau kurang</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Karyawan dengan sisa cuti tahunan ≤ {settings.lowLeaveQuotaThreshold} hari akan menerima reminder.
                </p>
                
                <Button 
                  variant="outline" 
                  onClick={handleSendLeaveQuotaReminder}
                  disabled={isSendingReminder}
                  className="mt-2"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSendingReminder ? "Mengirim..." : "Kirim Reminder Sekarang"}
                </Button>
              </div>
            )}
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
