import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Password lama harus diisi"),
  newPassword: z
    .string()
    .min(8, "Password baru minimal 8 karakter")
    .regex(/[A-Z]/, "Harus mengandung minimal 1 huruf besar")
    .regex(/[0-9]/, "Harus mengandung minimal 1 angka")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Harus mengandung minimal 1 simbol"),
  confirmPassword: z.string().min(1, "Konfirmasi password harus diisi"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Password baru tidak cocok",
  path: ["confirmPassword"],
});

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export const ChangePasswordDialog = ({
  open,
  onOpenChange,
  userEmail,
}: ChangePasswordDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async () => {
    // Validate inputs
    const validation = passwordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        setErrors({ currentPassword: "Password lama salah" });
        setLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      toast.success("Password berhasil diubah");
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Gagal mengubah password");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ganti Password</DialogTitle>
          <DialogDescription>
            Masukkan password lama dan password baru Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password">Password Lama</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Masukkan password lama"
                className={errors.currentPassword ? "border-destructive" : ""}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">Password Baru</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 karakter"
                className={errors.newPassword ? "border-destructive" : ""}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword}</p>
            )}
            <ul className="text-xs text-muted-foreground space-y-1 mt-2">
              <li className={newPassword.length >= 8 ? "text-green-600" : ""}>
                • Minimal 8 karakter
              </li>
              <li className={/[A-Z]/.test(newPassword) ? "text-green-600" : ""}>
                • Minimal 1 huruf besar (A-Z)
              </li>
              <li className={/[0-9]/.test(newPassword) ? "text-green-600" : ""}>
                • Minimal 1 angka (0-9)
              </li>
              <li className={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? "text-green-600" : ""}>
                • Minimal 1 simbol (!@#$%^&*)
              </li>
            </ul>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className={errors.confirmPassword ? "border-destructive" : ""}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
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