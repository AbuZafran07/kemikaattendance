import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, MapPin, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface CameraCaptureProps {
  onCapture: (photoUrl: string, isInsideArea: boolean) => void;
  onClose: () => void;
  isOpen: boolean;
  title?: string;
}

export const CameraCapture = ({ onCapture, onClose, isOpen, title = "Ambil Foto Absensi" }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCapturing, setIsCapturing] = useState(false);
  const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [address, setAddress] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<{
    inside: boolean;
    officeName?: string;
  }>({ inside: false });
  const [showInstruction, setShowInstruction] = useState(true);

  // 🏢 Daftar lokasi kantor (bisa diubah sesuai kebutuhan)
  const OFFICE_LOCATIONS = [
    { name: "Head Office", lat: -6.2318, lng: 106.72395, radius: 50 },
    { name: "Warehouse", lat: -6.23133, lng: 106.72716, radius: 100 },
  ];

  // 🕒 Update waktu real-time setiap detik
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 🚀 Saat kamera dibuka
  useEffect(() => {
    if (isOpen) {
      startCamera();
      getCurrentLocation();
      setShowInstruction(true); // tetap tampil sampai ambil foto
    } else {
      stopCamera();
    }
  }, [isOpen]);

  // 📍 Ambil lokasi user
  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });

        let inside = false;
        let officeName = "";
        for (const office of OFFICE_LOCATIONS) {
          const distance = getDistanceInMeters(latitude, longitude, office.lat, office.lng);
          if (distance <= office.radius) {
            inside = true;
            officeName = office.name;
            break;
          }
        }
        setLocationStatus({ inside, officeName });

        await getAddressFromCoords(latitude, longitude);
      },
      (err) => console.error("Gagal ambil lokasi:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // 🌍 Ambil nama alamat dari koordinat (reverse geocoding via backend)
  const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
      setAddress("Memuat alamat...");
      
      // Use server-side geocoding to avoid exposing coordinates to third party
      const { data, error } = await supabase.functions.invoke('reverse-geocode', {
        body: { lat, lng }
      });
      
      if (error) {
        console.error('Geocoding error:', error);
        // Fallback: tampilkan koordinat sebagai alamat
        setAddress(`Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        return;
      }
      
      if (data?.address) {
        setAddress(data.address);
      } else if (data?.error) {
        console.error('Geocoding service error:', data.error);
        // Fallback: tampilkan koordinat sebagai alamat
        setAddress(`Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } else {
        setAddress("Alamat tidak ditemukan");
      }
    } catch (err) {
      console.error('Geocoding fetch error:', err);
      // Fallback: tampilkan koordinat sebagai alamat
      setAddress(`Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  // 📏 Hitung jarak antar dua titik (meter)
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 🎥 Start kamera depan
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch {
      alert("Tidak dapat mengakses kamera depan. Pastikan izin kamera diaktifkan.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  // 🔊 Bunyi kamera (notifikasi)
  const playCameraSound = () => {
    const audio = new Audio("https://actions.google.com/sounds/v1/foley/camera_shutter_click.ogg");
    audio.play();
  };

  // 📸 Ambil foto + overlay lokasi + bunyi
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setShowInstruction(false); // sembunyikan pesan saat ambil foto
    playCameraSound(); // bunyi notifikasi
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const timestamp = currentTime.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Prioritaskan alamat daripada koordinat
    const addrText = address && !address.includes("Koordinat") && !address.includes("Lokasi:") 
      ? address 
      : (location.lat && location.lng 
          ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` 
          : "Lokasi tidak tersedia");

    const areaStatus = locationStatus.inside ? `✅ Dalam area ${locationStatus.officeName}` : "❌ Di luar area kantor";

    // 🧾 Overlay informasi di foto
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(10, canvas.height - 100, 520, 90);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px Arial";
    ctx.fillText(timestamp, 20, canvas.height - 72);
    ctx.font = "14px Arial";
    // Tampilkan alamat dengan max length untuk mencegah overflow
    const displayAddr = addrText.length > 60 ? addrText.substring(0, 57) + "..." : addrText;
    ctx.fillText(displayAddr, 20, canvas.height - 48);
    ctx.fillStyle = locationStatus.inside ? "#00ff7f" : "#ff4d4f";
    ctx.fillText(areaStatus, 20, canvas.height - 24);

    // Simpan hasil foto ke blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          onCapture(url, locationStatus.inside);
          stopCamera();
          onClose();
        }
        setIsCapturing(false);
      },
      "image/jpeg",
      0.9,
    );
  };

  const formatTime = () =>
    currentTime.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-full md:max-w-3xl p-0 gap-0">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full max-h-[60vh] object-contain" />
          <canvas ref={canvasRef} className="hidden" />

          {/* 💬 Pesan instruksi */}
          {showInstruction && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full shadow-md flex items-center gap-2 animate-fadeIn">
              <Info className="h-4 w-4 text-yellow-300" />
              <span>Harap absen dengan wajah terlihat jelas dan pencahayaan cukup</span>
            </div>
          )}

          {/* 📍 Info lokasi di layar */}
          <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded text-xs font-semibold space-y-1">
            <div>{formatTime()}</div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-red-400" />
              {address && !address.includes("Memuat") ? (
                <span className="max-w-[250px] truncate">{address}</span>
              ) : location.lat && location.lng ? (
                <span>{`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</span>
              ) : (
                <span className="text-red-400">GPS belum siap</span>
              )}
            </div>
            {address && address.includes("Koordinat") && location.lat && location.lng && (
              <div className="text-[10px] text-gray-200">{`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</div>
            )}
            {locationStatus.officeName && (
              <div className={`flex items-center gap-1 ${locationStatus.inside ? "text-green-400" : "text-red-400"}`}>
                {locationStatus.inside ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                <span>{locationStatus.inside ? `Dalam area ${locationStatus.officeName}` : "Di luar area kantor"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="p-4 flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            <X className="h-4 w-4 mr-2" /> Batal
          </Button>
          <Button type="button" onClick={capturePhoto} disabled={isCapturing || !stream}>
            <Camera className="h-4 w-4 mr-2" /> Ambil Foto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
