import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, ChevronLeft, ChevronRight, Star, Palmtree, Clock, Briefcase, Plane, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { id } from "date-fns/locale";

interface Holiday {
  id: string;
  name: string;
  date: string;
}

interface SpecialPeriod {
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  check_in_end?: string;
  check_out_start?: string;
}

interface LeaveDay {
  leave_type: string;
  label: string;
}

interface TravelDay {
  destination: string;
  purpose: string;
}

interface CompanyEvent {
  title: string;
  description: string | null;
}

const leaveTypeLabels: Record<string, string> = {
  cuti_tahunan: "Cuti Tahunan",
  izin: "Izin",
  sakit: "Sakit",
  lupa_absen: "Lupa Absen",
};

const CompanyCalendar = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [specialPeriods, setSpecialPeriods] = useState<SpecialPeriod[]>([]);
  const [leaveDaysMap, setLeaveDaysMap] = useState<Map<string, LeaveDay[]>>(new Map());
  const [travelDaysMap, setTravelDaysMap] = useState<Map<string, TravelDay[]>>(new Map());
  const [companyEventsMap, setCompanyEventsMap] = useState<Map<string, CompanyEvent[]>>(new Map());

  useEffect(() => {
    fetchCalendarData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchLeaveData();
      fetchTravelData();
    }
    fetchCompanyEvents();
  }, [user, currentMonth]);

  const fetchCalendarData = async () => {
    const [{ data: overtimeSettings }, { data: specialSettings }] = await Promise.all([
      supabase.from("system_settings").select("value").eq("key", "overtime_policy").single(),
      supabase.from("system_settings").select("value").eq("key", "special_work_hours").single(),
    ]);

    if (overtimeSettings?.value) {
      const val = overtimeSettings.value as any;
      setHolidays(val.holidays || []);
    }

    if (specialSettings?.value) {
      const val = specialSettings.value as any;
      setSpecialPeriods(val.periods || []);
    }
  };

  const fetchLeaveData = async () => {
    if (!user) return;
    const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data } = await supabase
      .from("leave_requests")
      .select("start_date, end_date, leave_type")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .gte("end_date", monthStart)
      .lte("start_date", monthEnd);

    const map = new Map<string, LeaveDay[]>();
    if (data) {
      data.forEach((leave) => {
        const start = parseISO(leave.start_date);
        const end = parseISO(leave.end_date);
        const days = eachDayOfInterval({ start, end });
        days.forEach((d) => {
          const key = format(d, "yyyy-MM-dd");
          const existing = map.get(key) || [];
          existing.push({
            leave_type: leave.leave_type,
            label: leaveTypeLabels[leave.leave_type] || leave.leave_type,
          });
          map.set(key, existing);
        });
      });
    }
    setLeaveDaysMap(map);
  };

  const fetchTravelData = async () => {
    if (!user) return;
    const mStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const mEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data } = await supabase
      .from("business_travel_requests")
      .select("start_date, end_date, destination, purpose")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .gte("end_date", mStart)
      .lte("start_date", mEnd);

    const map = new Map<string, TravelDay[]>();
    if (data) {
      data.forEach((t) => {
        const start = parseISO(t.start_date);
        const end = parseISO(t.end_date);
        eachDayOfInterval({ start, end }).forEach((d) => {
          const key = format(d, "yyyy-MM-dd");
          const existing = map.get(key) || [];
          existing.push({ destination: t.destination, purpose: t.purpose });
          map.set(key, existing);
        });
      });
    }
    setTravelDaysMap(map);
  };
  const fetchCompanyEvents = async () => {
    const mStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const mEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data } = await supabase
      .from("company_events")
      .select("title, description, event_date")
      .gte("event_date", mStart)
      .lte("event_date", mEnd);

    const map = new Map<string, CompanyEvent[]>();
    if (data) {
      data.forEach((e: any) => {
        const key = e.event_date;
        const existing = map.get(key) || [];
        existing.push({ title: e.title, description: e.description });
        map.set(key, existing);
      });
    }
    setCompanyEventsMap(map);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = getDay(monthStart);
  const paddingDays = startDayOfWeek;

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach(h => map.set(h.date, h.name));
    return map;
  }, [holidays]);

  const getSpecialPeriodForDate = (date: Date): SpecialPeriod | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return specialPeriods.find(p =>
      p.is_active && dateStr >= p.start_date && dateStr <= p.end_date
    ) || null;
  };

  const isWeekend = (date: Date) => {
    const day = getDay(date);
    return day === 0 || day === 6;
  };

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Kalender Perusahaan
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: id })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: paddingDays }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}

          {daysInMonth.map(date => {
            const dateStr = format(date, "yyyy-MM-dd");
            const holidayName = holidayMap.get(dateStr);
            const specialPeriod = getSpecialPeriodForDate(date);
            const weekend = isWeekend(date);
            const today = isToday(date);
            const leaveDays = leaveDaysMap.get(dateStr);
            const travelDays = travelDaysMap.get(dateStr);
            const companyEvents = companyEventsMap.get(dateStr);

            const hasEvent = !!holidayName || !!specialPeriod || !!leaveDays || !!travelDays || !!companyEvents;

            let bgClass = "bg-background hover:bg-accent/50";
            if (today) bgClass = "bg-primary/10 ring-1 ring-primary";
            else if (holidayName) bgClass = "bg-destructive/10";
            else if (travelDays) bgClass = "bg-green-500/10";
            else if (leaveDays) bgClass = "bg-blue-500/10";
            else if (specialPeriod) bgClass = "bg-chart-4/20";
            else if (weekend) bgClass = "bg-muted/50";

            const content = (
              <div
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-[10px] relative cursor-default transition-colors p-0.5 ${bgClass}`}
              >
                <span className={`font-medium text-xs ${weekend ? "text-destructive/70" : ""} ${holidayName ? "text-destructive" : ""} ${today ? "text-primary font-bold" : ""}`}>
                  {format(date, "d")}
                </span>
                {holidayName && (
                  <span className="text-[7px] leading-tight text-destructive/80 text-center line-clamp-2 mt-0.5 px-0.5">
                    {holidayName}
                  </span>
                )}
                {!holidayName && hasEvent && (
                  <div className="flex gap-0.5 mt-0.5">
                    {specialPeriod && <div className="h-1 w-1 rounded-full bg-chart-4" />}
                    {leaveDays && <div className="h-1 w-1 rounded-full bg-blue-500" />}
                    {travelDays && <div className="h-1 w-1 rounded-full bg-green-500" />}
                  </div>
                )}
              </div>
            );

            if (hasEvent) {
              return (
                <Tooltip key={dateStr}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <div className="space-y-1">
                      <p className="font-medium text-xs">{format(date, "d MMMM yyyy", { locale: id })}</p>
                      {holidayName && (
                        <div className="flex items-center gap-1 text-xs">
                          <Palmtree className="h-3 w-3 text-destructive" />
                          <span>{holidayName}</span>
                        </div>
                      )}
                      {specialPeriod && (
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3 text-chart-4" />
                          <span>{specialPeriod.name}</span>
                          {specialPeriod.check_out_start && (
                            <span className="text-muted-foreground">
                              (Pulang: {specialPeriod.check_out_start})
                            </span>
                          )}
                        </div>
                      )}
                      {leaveDays && leaveDays.map((l, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs">
                          <Briefcase className="h-3 w-3 text-blue-500" />
                          <span>{l.label}</span>
                        </div>
                      ))}
                      {travelDays && travelDays.map((t, i) => (
                        <div key={`t-${i}`} className="flex items-center gap-1 text-xs">
                          <Plane className="h-3 w-3 text-green-500" />
                          <span>Dinas: {t.destination}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={dateStr}>{content}</div>;
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            Hari Libur
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-chart-4" />
            Jam Kerja Khusus
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            Cuti Saya
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Dinas
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-primary" />
            Hari Ini
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyCalendar;
