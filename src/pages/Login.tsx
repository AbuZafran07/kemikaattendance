import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nik, setNik] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [departemen, setDepartemen] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Navigation is handled by AuthContext based on user role

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Login Gagal",
        description: error.message || "Email atau password salah",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Login Berhasil",
        description: "Selamat datang di Kemika HR System",
      });
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signUp(email, password, {
      full_name: fullName,
      nik,
      jabatan,
      departemen
    });
    
    if (error) {
      toast({
        title: "Pendaftaran Gagal",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pendaftaran Berhasil",
        description: "Akun telah dibuat, silakan login",
      });
    }
    
    setIsLoading(false);
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
              Sistem Absensi Digital PT. Kemika Karya Pratama
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="login">Login</TabsTrigger>
        </TabsList>
            
            <TabsContent value="login">
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
            </TabsContent>
            
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
