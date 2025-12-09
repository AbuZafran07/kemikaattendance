import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeavePolicyConfig {
  annual_leave_quota: number;
  sick_leave_quota: number;
  permission_quota: number;
  carry_over_enabled: boolean;
  max_carry_over_days: number;
  min_days_advance_request: number;
  max_consecutive_days: number;
  require_approval: boolean;
  auto_reset_on_anniversary: boolean;
  reset_month: number;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
}

export interface OvertimePolicyConfig {
  min_hours: number;
  max_hours_per_day: number;
  max_hours_per_week: number;
  max_hours_per_month: number;
  require_approval: boolean;
  min_days_advance_request: number;
  weekday_rate_multiplier: number;
  weekend_rate_multiplier: number;
  holiday_rate_multiplier: number;
  allow_weekend_overtime: boolean;
  allow_holiday_overtime: boolean;
  meal_allowance_threshold_hours: number;
  meal_allowance_amount: number;
  transport_allowance_enabled: boolean;
  transport_allowance_amount: number;
  holidays: Holiday[];
}

const DEFAULT_LEAVE_POLICY: LeavePolicyConfig = {
  annual_leave_quota: 12,
  sick_leave_quota: 12,
  permission_quota: 6,
  carry_over_enabled: false,
  max_carry_over_days: 5,
  min_days_advance_request: 3,
  max_consecutive_days: 14,
  require_approval: true,
  auto_reset_on_anniversary: true,
  reset_month: 1,
};

const DEFAULT_OVERTIME_POLICY: OvertimePolicyConfig = {
  min_hours: 1,
  max_hours_per_day: 4,
  max_hours_per_week: 14,
  max_hours_per_month: 40,
  require_approval: true,
  min_days_advance_request: 1,
  weekday_rate_multiplier: 1.5,
  weekend_rate_multiplier: 2.0,
  holiday_rate_multiplier: 3.0,
  allow_weekend_overtime: true,
  allow_holiday_overtime: true,
  meal_allowance_threshold_hours: 3,
  meal_allowance_amount: 50000,
  transport_allowance_enabled: true,
  transport_allowance_amount: 30000,
  holidays: [],
};

export function useLeavePolicy() {
  const [policy, setPolicy] = useState<LeavePolicyConfig>(DEFAULT_LEAVE_POLICY);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "leave_policy")
          .maybeSingle();

        if (error && error.code !== "PGRST116") throw error;

        if (data?.value) {
          setPolicy({ ...DEFAULT_LEAVE_POLICY, ...(data.value as unknown as LeavePolicyConfig) });
        }
      } catch (error) {
        console.error("Error fetching leave policy:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicy();
  }, []);

  return { policy, isLoading };
}

export function useOvertimePolicy() {
  const [policy, setPolicy] = useState<OvertimePolicyConfig>(DEFAULT_OVERTIME_POLICY);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "overtime_policy")
          .maybeSingle();

        if (error && error.code !== "PGRST116") throw error;

        if (data?.value) {
          setPolicy({ ...DEFAULT_OVERTIME_POLICY, ...(data.value as unknown as OvertimePolicyConfig) });
        }
      } catch (error) {
        console.error("Error fetching overtime policy:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicy();
  }, []);

  return { policy, isLoading };
}

export function isHoliday(date: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => h.date === date);
}

export function isWeekend(date: string): boolean {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
}
