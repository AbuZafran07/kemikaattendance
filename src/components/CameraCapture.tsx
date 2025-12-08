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

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

export const CameraCapture = ({ onCapture, onClose, isOpen, title = "Ambil Foto Absensi" }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCapturing, setIsCapturing] = useState(false);
  const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [address, setAddress] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<{ inside: boolean; officeName?: string }>({ inside: false });
  const [showInstruction, setShowInstruction] = useState(true);
  const [offices, setOffices] = useState<OfficeLocation[]>([]);

  // 🕓 Update waktu real-time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 🚀 Fetch data kantor dari Supabase
  useEffect(() => {
    if (isOpen) {
      fetchOfficeLocations();
      startCamera();
      getCurrentLocation();
      setShowInstruction(true);
      const timer = setTimeout(() => setShowInstruction(false), 3000);
      return () => clearTimeout(timer);
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const fetchOfficeLocations = async () => {
    const { data, error } = await supabase.from("office_locations").select("*");
    if (error) {
      console.error("Gagal memuat lokasi kantor:", error);
    } else {
      setOffices(data || []);
    }
  };

  // 📍 Ambil lokasi user dan cek validasi kantor
  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        await getAddressFromCoords(latitude, longitude);

        let inside = false;
        let officeName = "";
        for (const office of offices) {
          const distance = getDistanceInMeters(latitude, longitude, office.latitude, office.longitude);
          if (distance <= office.radius_meters) {
            inside = true;
            officeName = office.name;
            break;
          }
        }
        setLocationStatus({ inside, officeName });
      },
      (err) => console.error("Gagal ambil lokasi:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // 🌍 Reverse geocoding
  const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      setAddress(data.display_name?.split(",").slice(0, 3).join(", ") || "Alamat tidak ditemukan");
    } catch {
      setAddress("Gagal memuat alamat");
    }
  };

  // 📏 Hitung jarak antar koordinat (meter)
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // 🎥 Kamera depan
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

  // 📸 Ambil foto + overlay info
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
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

    const locText =
      location.lat && location.lng
        ? `Lat: ${location.lat.toFixed(5)}, Lng: ${location.lng.toFixed(5)}`
        : "Lokasi tidak tersedia";

    const addrText = address || "Memuat alamat...";
    const areaStatus = locationStatus.inside ? `✅ Dalam area ${locationStatus.officeName}` : "❌ Di luar area kantor";

    // Overlay box
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(10, canvas.height - 120, 520, 110);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px Arial";
    ctx.fillText(timestamp, 20, canvas.height - 90);
    ctx.font = "16px Arial";
    ctx.fillText(locText, 20, canvas.height - 65);
    ctx.font = "14px Arial";
    ctx.fillText(addrText, 20, canvas.height - 40);
    ctx.fillStyle = locationStatus.inside ? "#00ff7f" : "#ff4d4f";
    ctx.fillText(areaStatus, 20, canvas.height - 20);

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

        {/* Preview Kamera */}
        <div className="relative bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full max-h-[60vh] object-contain" />
          <canvas ref={canvasRef} className="hidden" />

          {/* Pesan instruksi */}
          {showInstruction && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full shadow-md flex items-center gap-2">
              <Info className="h-4 w-4 text-yellow-300" />
              <span>Harap absen dengan wajah terlihat jelas dan pencahayaan cukup</span>
            </div>
          )}

          {/* Overlay Lokasi */}
          <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded text-xs font-semibold space-y-1">
            <div>{formatTime()}</div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-red-400" />
              {location.lat && location.lng ? (
                <span>{`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</span>
              ) : (
                <span className="text-red-400">GPS belum siap</span>
              )}
            </div>
            <div className="text-[10px] text-gray-200 max-w-[280px] truncate">{address || "Memuat alamat..."}</div>
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
