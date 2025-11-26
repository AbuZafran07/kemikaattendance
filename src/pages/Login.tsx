import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate login - will be replaced with actual authentication
    setTimeout(() => {
      if (email && password) {
        toast({
          title: "Login Berhasil",
          description: "Selamat datang di Kemika HR System",
        });
        // For demo, admin email goes to dashboard, others to employee view
        if (email.includes("admin")) {
          navigate("/dashboard");
        } else {
          navigate("/employee");
        }
      } else {
        toast({
          title: "Login Gagal",
          description: "Email atau password salah",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <img src={logo} alt="Kemika Logo" className="h-16 object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Kemika HR Attendance</CardTitle>
            <CardDescription className="mt-2">
              Silakan masuk untuk melanjutkan
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@kemika.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Demo: gunakan email dengan "admin" untuk dashboard admin</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
