import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface AttendanceChartProps {
  data: {
    day: string;
    hadir: number;
    terlambat: number;
    tidak_hadir: number;
  }[];
}

const AttendanceChart = ({ data }: AttendanceChartProps) => {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Tren Kehadiran Mingguan</CardTitle>
        <CardDescription>
          Statistik kehadiran 7 hari terakhir
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="day" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="hadir" name="Hadir" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tidak_hadir" name="Tidak Hadir" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceChart;
