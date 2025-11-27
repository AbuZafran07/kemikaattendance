import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CameraCaptureProps {
  onCapture: (photoUrl: string) => void;
  onClose: () => void;
  isOpen: boolean;
  title?: string;
}

export const CameraCapture = ({ onCapture, onClose, isOpen, title = "Ambil Foto" }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCapturing, setIsCapturing] = useState(false);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw the video frame
    ctx.drawImage(video, 0, 0);

    // Add timestamp overlay
    const timestamp = currentTime.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    // Background for timestamp
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(10, canvas.height - 60, 320, 50);
    
    // Timestamp text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px Arial";
    ctx.fillText(timestamp, 20, canvas.height - 25);

    // Convert to blob and create URL
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        onCapture(url);
        stopCamera();
        onClose();
      }
      setIsCapturing(false);
    }, "image/jpeg", 0.9);
  };

  const formatTime = () => {
    return currentTime.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-full md:max-w-3xl p-0 gap-0">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-auto max-h-[60vh] object-contain"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Live timestamp overlay on video */}
          <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded font-bold text-sm">
            {formatTime()}
          </div>

          {/* Camera controls */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={switchCamera}
              className="rounded-full"
            >
              <RotateCw className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Batal
          </Button>
          <Button
            type="button"
            onClick={capturePhoto}
            disabled={isCapturing || !stream}
          >
            <Camera className="h-4 w-4 mr-2" />
            Ambil Foto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
