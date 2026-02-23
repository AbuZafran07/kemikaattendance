import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, ChevronLeft, ChevronRight, Star, Palmtree, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isToday, isSameDay } from "date-fns";
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

const CompanyCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [specialPeriods, setSpecialPeriods] = useState<SpecialPeriod[]>([]);

  useEffect(() => {
    fetchCalendarData();
  }, []);

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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month with empty cells
  const startDayOfWeek = getDay(monthStart); // 0=Sun
  const paddingDays = startDayOfWeek;

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach(h => {
      map.set(h.date, h.name);
    });
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
          {/* Empty padding cells */}
          {Array.from({ length: paddingDays }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}

          {daysInMonth.map(date => {
            const dateStr = format(date, "yyyy-MM-dd");
            const holidayName = holidayMap.get(dateStr);
            const specialPeriod = getSpecialPeriodForDate(date);
            const weekend = isWeekend(date);
            const today = isToday(date);

            const hasEvent = !!holidayName || !!specialPeriod;

            let bgClass = "bg-background hover:bg-accent/50";
            if (today) bgClass = "bg-primary/10 ring-1 ring-primary";
            else if (holidayName) bgClass = "bg-destructive/10";
            else if (specialPeriod) bgClass = "bg-chart-4/20";
            else if (weekend) bgClass = "bg-muted/50";

            const content = (
              <div
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs relative cursor-default transition-colors ${bgClass}`}
              >
                <span className={`font-medium ${weekend ? "text-destructive/70" : ""} ${holidayName ? "text-destructive" : ""} ${today ? "text-primary font-bold" : ""}`}>
                  {format(date, "d")}
                </span>
                {/* Indicator dots */}
                {hasEvent && (
                  <div className="flex gap-0.5 mt-0.5">
                    {holidayName && <div className="h-1 w-1 rounded-full bg-destructive" />}
                    {specialPeriod && <div className="h-1 w-1 rounded-full bg-chart-4" />}
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
            <div className="h-2 w-2 rounded-full bg-primary" />
            Hari Ini
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyCalendar;
