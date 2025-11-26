import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, CheckCircle2, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const FaceEnrollment = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [faceIO, setFaceIO] = useState<any>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    // Initialize FaceIO
    const faceioAppId = import.meta.env.VITE_FACEIO_APP_ID;
    
    if (!faceioAppId) {
      console.warn('VITE_FACEIO_APP_ID tidak ditemukan');
      toast({
        title: "Konfigurasi Error",
        description: "FaceIO belum dikonfigurasi. Hubungi administrator.",
        variant: "destructive",
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.faceio.net/fio.js';
    script.async = true;
    script.onload = () => {
      try {
        const fioInstance = new (window as any).faceIO(faceioAppId);
        setFaceIO(fioInstance);
        console.log('FaceIO initialized successfully');
      } catch (error) {
        console.error('Failed to initialize FaceIO:', error);
        toast({
          title: "Error",
          description: "Gagal menginisialisasi FaceIO",
          variant: "destructive",
        });
      }
    };
    script.onerror = () => {
      console.error('Failed to load FaceIO script');
      toast({
        title: "Error",
        description: "Gagal memuat FaceIO script",
        variant: "destructive",
      });
    };
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleEnroll = async () => {
    if (!faceIO) {
      toast({
        title: "FaceIO Belum Siap",
        description: "Sistem pengenalan wajah sedang dimuat. Silakan tunggu beberapa detik.",
        variant: "destructive",
      });
      return;
    }

    setIsEnrolling(true);
    setEnrollmentStatus('pending');

    try {
      // Enroll new user face
      const userInfo = await faceIO.enroll({
        locale: 'auto',
        payload: {
          userId: profile?.id,
          email: profile?.email,
          fullName: profile?.full_name,
        }
      });

      console.log('Face enrollment successful:', userInfo);
      
      setEnrollmentStatus('success');
      toast({
        title: "Pendaftaran Berhasil!",
        description: "Wajah Anda telah berhasil didaftarkan. Anda sekarang dapat melakukan check-in.",
      });

      // Navigate back to employee view after 2 seconds
      setTimeout(() => {
        navigate('/employee');
      }, 2000);

    } catch (error: any) {
      console.error('Face enrollment failed:', error);
      setEnrollmentStatus('error');
      
      let errorMessage = 'Gagal mendaftarkan wajah. Silakan coba lagi.';
      
      if (error.code === 1) {
        errorMessage = 'Wajah tidak terdeteksi. Pastikan wajah Anda terlihat jelas di kamera.';
      } else if (error.code === 2) {
        errorMessage = 'Kamera tidak dapat diakses. Berikan izin kamera dan coba lagi.';
      } else if (error.code === 3) {
        errorMessage = 'Wajah Anda sudah terdaftar sebelumnya.';
      }

      toast({
        title: "Pendaftaran Gagal",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/employee')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Kemika" className="h-10 object-contain" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Daftarkan Wajah Anda</CardTitle>
            <CardDescription>
              Daftarkan wajah Anda untuk sistem absensi dengan pengenalan wajah
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Instructions */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Panduan Pendaftaran:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Pastikan pencahayaan cukup terang</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Posisikan wajah Anda di tengah kamera</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Lepas kacamata, masker, atau aksesori yang menutupi wajah</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Ikuti instruksi yang muncul di layar</span>
                </li>
              </ul>
            </div>

            {/* Status Display */}
            {enrollmentStatus === 'success' && (
              <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Pendaftaran Berhasil!</p>
                  <p className="text-xs text-muted-foreground">Mengarahkan kembali...</p>
                </div>
              </div>
            )}

            {enrollmentStatus === 'error' && (
              <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Pendaftaran Gagal</p>
                  <p className="text-xs text-muted-foreground">Silakan coba lagi</p>
                </div>
              </div>
            )}

            {/* Enroll Button */}
            <Button 
              onClick={handleEnroll}
              disabled={isEnrolling || !faceIO || enrollmentStatus === 'success'}
              className="w-full"
              size="lg"
            >
              {isEnrolling ? (
                <>Memproses...</>
              ) : (
                <>
                  <Camera className="h-5 w-5 mr-2" />
                  {enrollmentStatus === 'success' ? 'Berhasil Didaftarkan' : 'Mulai Pendaftaran Wajah'}
                </>
              )}
            </Button>

            {/* Info Card */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Catatan:</strong> Data wajah Anda akan tersimpan dengan aman dan hanya digunakan 
                untuk sistem absensi PT. Kemika Karya Pratama. Anda hanya perlu mendaftar sekali.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FaceEnrollment;
