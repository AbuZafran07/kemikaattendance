import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface SystemSettings {
  office_location: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  working_hours: {
    check_in: string;
    check_out: string;
    late_threshold: string;
  };
  leave_policy: {
    annual_quota: number;
    max_consecutive_days: number;
    min_notice_days: number;
  };
  overtime_policy: {
    min_hours: number;
    max_hours: number;
    requires_approval: boolean;
  };
}

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({
    office_location: { latitude: -6.2088, longitude: 106.8456, radius: 100 },
    working_hours: { check_in: "08:00", check_out: "17:00", late_threshold: "08:30" },
    leave_policy: { annual_quota: 12, max_consecutive_days: 14, min_notice_days: 3 },
    overtime_policy: { min_hours: 1, max_hours: 4, requires_approval: true },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value");

      if (error) throw error;

      if (data) {
        const settingsMap = data.reduce((acc: any, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {});
        setSettings(settingsMap);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from("system_settings")
          .update({ value })
          .eq("key", key);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Configure office location, working hours, and policies</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Office Location</CardTitle>
          <CardDescription>GPS coordinates for attendance validation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="0.0001"
                value={settings.office_location.latitude}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    office_location: {
                      ...settings.office_location,
                      latitude: parseFloat(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="0.0001"
                value={settings.office_location.longitude}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    office_location: {
                      ...settings.office_location,
                      longitude: parseFloat(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="radius">Radius (meters)</Label>
              <Input
                id="radius"
                type="number"
                value={settings.office_location.radius}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    office_location: {
                      ...settings.office_location,
                      radius: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Working Hours</CardTitle>
          <CardDescription>Standard office hours and late threshold</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="check_in">Check-in Time</Label>
              <Input
                id="check_in"
                type="time"
                value={settings.working_hours.check_in}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    working_hours: {
                      ...settings.working_hours,
                      check_in: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="check_out">Check-out Time</Label>
              <Input
                id="check_out"
                type="time"
                value={settings.working_hours.check_out}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    working_hours: {
                      ...settings.working_hours,
                      check_out: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="late_threshold">Late Threshold</Label>
              <Input
                id="late_threshold"
                type="time"
                value={settings.working_hours.late_threshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    working_hours: {
                      ...settings.working_hours,
                      late_threshold: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave Policy</CardTitle>
          <CardDescription>Annual leave quota and restrictions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="annual_quota">Annual Quota (days)</Label>
              <Input
                id="annual_quota"
                type="number"
                value={settings.leave_policy.annual_quota}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    leave_policy: {
                      ...settings.leave_policy,
                      annual_quota: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="max_consecutive_days">Max Consecutive Days</Label>
              <Input
                id="max_consecutive_days"
                type="number"
                value={settings.leave_policy.max_consecutive_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    leave_policy: {
                      ...settings.leave_policy,
                      max_consecutive_days: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="min_notice_days">Minimum Notice (days)</Label>
              <Input
                id="min_notice_days"
                type="number"
                value={settings.leave_policy.min_notice_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    leave_policy: {
                      ...settings.leave_policy,
                      min_notice_days: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overtime Policy</CardTitle>
          <CardDescription>Overtime request rules and limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min_hours">Minimum Hours</Label>
              <Input
                id="min_hours"
                type="number"
                value={settings.overtime_policy.min_hours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    overtime_policy: {
                      ...settings.overtime_policy,
                      min_hours: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="max_hours">Maximum Hours</Label>
              <Input
                id="max_hours"
                type="number"
                value={settings.overtime_policy.max_hours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    overtime_policy: {
                      ...settings.overtime_policy,
                      max_hours: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
