import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, CheckCircle2, AlertCircle, Shield, ExternalLink, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import logger from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";

const FaceEnrollment = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [faceIO, setFaceIO] = useState<any>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [hasConsented, setHasConsented] = useState(false);

  useEffect(() => {
    // Initialize FaceIO
    const faceioAppId = import.meta.env.VITE_FACEIO_APP_ID;
    
    if (!faceioAppId) {
      logger.warn('VITE_FACEIO_APP_ID tidak ditemukan');
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
        logger.debug('FaceIO initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize FaceIO:', error);
        toast({
          title: "Error",
          description: "Gagal menginisialisasi FaceIO",
          variant: "destructive",
        });
      }
    };
    script.onerror = () => {
      logger.error('Failed to load FaceIO script');
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

    if (!hasConsented) {
      toast({
        title: "Persetujuan Diperlukan",
        description: "Anda harus menyetujui pemrosesan data biometrik sebelum melanjutkan.",
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
          consentTimestamp: new Date().toISOString(),
        }
      });

      logger.debug('Face enrollment completed successfully', { 
        userId: profile?.id,
        consentTimestamp: new Date().toISOString() 
      });
      
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
      logger.error('Face enrollment failed:', error);
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

  const handleDeleteBiometricData = async () => {
    setIsDeleting(true);
    try {
      if (!profile?.id) {
        throw new Error("User profile not found");
      }

      // Record the deletion request in the database for audit trail
      const { error: insertError } = await supabase
        .from('biometric_consent_records')
        .insert({
          user_id: profile.id,
          consent_given: false,
          action_type: 'deletion_requested',
          notes: 'User requested biometric data deletion via self-service portal',
          ip_address: null, // Could be captured via edge function if needed
          user_agent: navigator.userAgent,
        });

      if (insertError) {
        logger.error('Failed to record deletion request:', insertError);
        throw new Error("Gagal mencatat permintaan penghapusan");
      }

      logger.debug('Biometric data deletion request recorded', { userId: profile.id });
      
      toast({
        title: "Permintaan Penghapusan Diterima",
        description: "Permintaan penghapusan data biometrik Anda telah dicatat dalam sistem. Administrator akan memproses melalui dashboard FaceIO dalam 24-48 jam kerja.",
      });
    } catch (error: any) {
      logger.error('Failed to request biometric data deletion:', error);
      toast({
        title: "Gagal Mengirim Permintaan",
        description: error.message || "Terjadi kesalahan. Silakan hubungi administrator langsung.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
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

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        {/* Privacy Disclosure Alert */}
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Pemberitahuan Privasi Data Biometrik</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm space-y-2">
            <p>
              Sistem ini menggunakan layanan pihak ketiga <strong>FaceIO</strong> untuk pengenalan wajah. 
              Data biometrik (template wajah) Anda akan diproses dan disimpan di server FaceIO di luar infrastruktur perusahaan.
            </p>
            <p className="font-medium">
              Data yang dikumpulkan: Template wajah digital, ID karyawan, email, dan nama lengkap.
            </p>
            <a 
              href="https://faceio.net/privacy-policy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-200 underline hover:no-underline"
            >
              Baca Kebijakan Privasi FaceIO <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>

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

            {/* Consent Checkbox */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="consent" 
                  checked={hasConsented}
                  onCheckedChange={(checked) => setHasConsented(checked === true)}
                  className="mt-1"
                />
                <label 
                  htmlFor="consent" 
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  <span className="font-medium">Saya menyetujui pengumpulan dan pemrosesan data biometrik:</span>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>• Data wajah saya akan dikirim dan disimpan di server FaceIO (pihak ketiga)</li>
                    <li>• Data digunakan untuk keperluan absensi PT. Kemika Karya Pratama</li>
                    <li>• Saya dapat meminta penghapusan data biometrik kapan saja</li>
                    <li>• Saya telah membaca dan memahami pemberitahuan privasi di atas</li>
                  </ul>
                </label>
              </div>
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
              disabled={isEnrolling || !faceIO || enrollmentStatus === 'success' || !hasConsented}
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

            {!hasConsented && (
              <p className="text-xs text-center text-muted-foreground">
                Centang persetujuan di atas untuk melanjutkan pendaftaran
              </p>
            )}

            {/* Data Deletion Request */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Hak Penghapusan Data</p>
                  <p className="text-xs text-muted-foreground">
                    Anda berhak meminta penghapusan data biometrik Anda
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Hapus Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Permintaan Penghapusan Data Biometrik</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          Anda akan meminta penghapusan data biometrik (template wajah) yang tersimpan di server FaceIO.
                        </p>
                        <p>
                          Setelah data dihapus, Anda tidak akan dapat menggunakan fitur absensi dengan pengenalan wajah 
                          hingga mendaftar ulang.
                        </p>
                        <p className="font-medium">
                          Apakah Anda yakin ingin melanjutkan?
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteBiometricData}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Memproses..." : "Ya, Hapus Data Saya"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Info Card */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Catatan:</strong> Dengan memberikan persetujuan, Anda mengonfirmasi bahwa Anda telah 
                memahami bahwa data biometrik Anda akan diproses oleh layanan pihak ketiga (FaceIO) sesuai 
                dengan kebijakan privasi mereka. Data digunakan hanya untuk sistem absensi PT. Kemika Karya Pratama.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FaceEnrollment;