import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Upload, X } from "lucide-react";
import { EmployeeAvatar } from "@/components/ui/employee-avatar";
import { compressImage } from "@/lib/imageCompression";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  photo_url: string | null;
}

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  onUpdated: () => void;
}

export const EditProfileDialog = ({
  open,
  onOpenChange,
  profile,
  onUpdated,
}: EditProfileDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState(profile.phone || "");
  const [address, setAddress] = useState(profile.address || "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB");
      return;
    }

    try {
      // Compress image
      const compressedBlob = await compressImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
      });

      // Convert Blob to File
      const compressedFile = new File([compressedBlob], file.name, {
        type: compressedBlob.type,
        lastModified: Date.now(),
      });

      setPhotoFile(compressedFile);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("Error compressing image:", error);
      toast.error("Gagal memproses gambar");
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return profile.photo_url;

    const fileExt = photoFile.name.split(".").pop();
    const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

    // Delete old photo if exists
    if (profile.photo_url) {
      try {
        // Extract path from signed URL or regular path
        const urlParts = profile.photo_url.split("/employee-photos/");
        if (urlParts[1]) {
          const oldPath = urlParts[1].split("?")[0]; // Remove query params from signed URL
          await supabase.storage.from("employee-photos").remove([oldPath]);
        }
      } catch (error) {
        console.error("Error deleting old photo:", error);
      }
    }

    const { error: uploadError } = await supabase.storage
      .from("employee-photos")
      .upload(fileName, photoFile, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Use signed URL since bucket is private
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from("employee-photos")
      .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry

    if (signedError || !signedUrlData) {
      throw signedError || new Error("Failed to create signed URL");
    }

    return signedUrlData.signedUrl;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let newPhotoUrl = profile.photo_url;

      if (photoFile) {
        newPhotoUrl = await uploadPhoto();
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          phone: phone.trim() || null,
          address: address.trim() || null,
          photo_url: newPhotoUrl,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Profil berhasil diperbarui");
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Gagal memperbarui profil");
    } finally {
      setLoading(false);
    }
  };

  const clearPhotoPreview = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profil</DialogTitle>
          <DialogDescription>
            Ubah foto, nomor telepon, dan alamat Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Photo Upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-24 w-24 rounded-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={clearPhotoPreview}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <EmployeeAvatar
                  src={profile.photo_url}
                  name={profile.full_name}
                  size="lg"
                  className="h-24 w-24"
                />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              {profile.photo_url || photoPreview ? "Ganti Foto" : "Upload Foto"}
            </Button>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Nomor Telepon</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 08123456789"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Alamat</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Masukkan alamat lengkap..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};