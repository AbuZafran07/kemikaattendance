import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface DepartmentBreakdownProps {
  data: {
    name: string;
    value: number;
    present: number;
  }[];
}

const COLORS = ['hsl(var(--primary))', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

const DepartmentBreakdown = ({ data }: DepartmentBreakdownProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kehadiran per Departemen</CardTitle>
        <CardDescription>
          Distribusi karyawan hari ini
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="present"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => [`${value} hadir`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {data.map((dept, index) => (
            <div key={dept.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-muted-foreground">{dept.name}</span>
              </div>
              <span className="font-medium">{dept.present}/{dept.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DepartmentBreakdown;
