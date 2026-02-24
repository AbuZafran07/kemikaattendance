import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Download, MoreVertical, Upload, User, Pencil, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Building2, KeyRound, Shield, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { EmployeeDetailDialog } from "@/components/EmployeeDetailDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { JABATAN_OPTIONS, DEPARTMENT_OPTIONS } from "@/lib/employeeOptions";
import { employeeSchema, employeeEditSchema } from "@/lib/validationSchemas";
import { compressEmployeePhoto, blobToFile } from "@/lib/imageCompression";
import logger from "@/lib/logger";

const Employees = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSetAdminDialogOpen, setIsSetAdminDialogOpen] = useState(false);
  const [setAdminEmployee, setSetAdminEmployee] = useState<any>(null);
  const [isSettingAdmin, setIsSettingAdmin] = useState(false);
  const [employeeRoles, setEmployeeRoles] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nik: "",
    full_name: "",
    jabatan: "",
    departemen: "",
    phone: "",
    address: "",
    join_date: new Date().toISOString().split('T')[0],
    work_type: "wfo",
  });

  const [editFormData, setEditFormData] = useState({
    nik: "",
    full_name: "",
    jabatan: "",
    departemen: "",
    phone: "",
    address: "",
    status: "",
    work_type: "wfo",
    basic_salary: "",
    ptkp_status: "TK/0",
    tunjangan_komunikasi: "",
    tunjangan_jabatan: "",
    tunjangan_operasional: "",
    bpjs_kesehatan_enabled: true,
  });

  useEffect(() => {
    fetchEmployees();
    fetchEmployeeRoles();
  }, []);

  const fetchEmployeeRoles = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id, role');
    
    if (data) {
      const rolesMap: Record<string, string> = {};
      data.forEach((item) => {
        rolesMap[item.user_id] = item.role;
      });
      setEmployeeRoles(rolesMap);
    }
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      // Generate signed URLs for all employee photos
      const employeesWithSignedUrls = await Promise.all(
        data.map(async (emp) => {
          if (emp.photo_url) {
            const signedUrl = await getSignedPhotoUrl(emp.photo_url);
            return { ...emp, photo_url: signedUrl };
          }
          return emp;
        })
      );
      setEmployees(employeesWithSignedUrls);
    }
  };

  // Helper to get signed URL for employee photos
  const getSignedPhotoUrl = async (filePath: string): Promise<string | null> => {
    if (!filePath) return null;
    
    // If it's already a full URL (legacy data), try to extract the path
    if (filePath.startsWith('http')) {
      const match = filePath.match(/employee-photos\/(.+)$/);
      if (match) {
        filePath = match[1];
      } else {
        return filePath; // Return as-is if we can't parse it
      }
    }
    
    const { data, error } = await supabase.storage
      .from('employee-photos')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      logger.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File terlalu besar",
          description: "Maksimal ukuran foto 5MB",
          variant: "destructive",
        });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (userId: string): Promise<string | null> => {
    if (!photoFile) return null;

    try {
      // Compress the photo before uploading
      const compressedBlob = await compressEmployeePhoto(photoFile);
      const compressedFile = blobToFile(compressedBlob, `${userId}.jpg`);
      
      const filePath = `photos/${userId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Return the file path - we'll generate signed URLs when displaying
      return filePath;
    } catch (error) {
      logger.error('Error uploading photo:', error);
      throw error;
    }
  };
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    // Validate input
    const result = employeeSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        errors[field] = err.message;
      });
      setFormErrors(errors);
      toast({
        title: "Validasi Gagal",
        description: "Periksa kembali data yang dimasukkan",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Use admin edge function to create user without auto-login
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: result.data.email,
          password: result.data.password,
          userData: {
            nik: result.data.nik,
            full_name: result.data.full_name,
            jabatan: result.data.jabatan,
            departemen: result.data.departemen,
            phone: formData.phone,
            address: formData.address,
            join_date: formData.join_date,
            work_type: formData.work_type,
          }
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const userId = data?.userId;

      // Upload photo if exists
      if (userId && photoFile) {
        const photoUrl = await uploadPhoto(userId);
        if (photoUrl) {
          await supabase
            .from('profiles')
            .update({ photo_url: photoUrl })
            .eq('id', userId);
        }
      }

      toast({
        title: "Berhasil",
        description: "Karyawan berhasil ditambahkan",
      });

      setIsDialogOpen(false);
      resetForm();
      fetchEmployees();
      fetchEmployeeRoles();
    } catch (error: any) {
      toast({
        title: "Gagal Menambahkan Karyawan",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setEditFormErrors({});

    // Validate input
    const result = employeeEditSchema.safeParse(editFormData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        errors[field] = err.message;
      });
      setEditFormErrors(errors);
      toast({
        title: "Validasi Gagal",
        description: "Periksa kembali data yang dimasukkan",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      let photoUrl = editingEmployee.photo_url;
      
      if (photoFile) {
        photoUrl = await uploadPhoto(editingEmployee.id);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          nik: result.data.nik,
          full_name: result.data.full_name,
          jabatan: result.data.jabatan,
          departemen: result.data.departemen,
          phone: result.data.phone || null,
          address: result.data.address || null,
          status: result.data.status,
          photo_url: photoUrl,
          work_type: editFormData.work_type,
          basic_salary: Number(editFormData.basic_salary) || 0,
          ptkp_status: editFormData.ptkp_status || "TK/0",
          tunjangan_komunikasi: Number(editFormData.tunjangan_komunikasi) || 0,
          tunjangan_jabatan: Number(editFormData.tunjangan_jabatan) || 0,
          tunjangan_operasional: Number(editFormData.tunjangan_operasional) || 0,
          bpjs_kesehatan_enabled: editFormData.bpjs_kesehatan_enabled,
        })
        .eq('id', editingEmployee.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Data karyawan berhasil diperbarui",
      });

      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      toast({
        title: "Gagal Memperbarui",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const openEditDialog = (employee: any) => {
    setEditingEmployee(employee);
    setEditFormData({
      nik: employee.nik,
      full_name: employee.full_name,
      jabatan: employee.jabatan,
      departemen: employee.departemen,
      phone: employee.phone || "",
      address: employee.address || "",
      status: employee.status || "Active",
      work_type: employee.work_type || "wfo",
      basic_salary: String(employee.basic_salary || ""),
      ptkp_status: employee.ptkp_status || "TK/0",
      tunjangan_komunikasi: String(employee.tunjangan_komunikasi || ""),
      tunjangan_jabatan: String(employee.tunjangan_jabatan || ""),
      tunjangan_operasional: String(employee.tunjangan_operasional || ""),
      bpjs_kesehatan_enabled: employee.bpjs_kesehatan_enabled !== false,
    });
    setPhotoPreview(employee.photo_url);
    setPhotoFile(null);
    setEditFormErrors({});
    setIsEditDialogOpen(true);
  };

  const openDetailDialog = (employee: any) => {
    setViewingEmployee(employee);
    setIsDetailDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      nik: "",
      full_name: "",
      jabatan: "",
      departemen: "",
      phone: "",
      address: "",
      join_date: new Date().toISOString().split('T')[0],
      work_type: "wfo",
    });
    setEditFormData({
      nik: "",
      full_name: "",
      jabatan: "",
      departemen: "",
      phone: "",
      address: "",
      status: "",
      work_type: "wfo",
      basic_salary: "",
      ptkp_status: "TK/0",
      tunjangan_komunikasi: "",
      tunjangan_jabatan: "",
      tunjangan_operasional: "",
      bpjs_kesehatan_enabled: true,
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormErrors({});
    setEditFormErrors({});
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus karyawan ini?")) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Gagal Menghapus",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Berhasil",
        description: "Karyawan berhasil dihapus",
      });
      fetchEmployees();
    }
  };

  const openResetPasswordDialog = (employee: any) => {
    setResetPasswordEmployee(employee);
    setNewPassword("");
    setIsResetPasswordDialogOpen(true);
  };

  const handleAdminResetPassword = async () => {
    if (!resetPasswordEmployee || !newPassword) {
      toast({
        title: "Password Diperlukan",
        description: "Masukkan password baru",
        variant: "destructive",
      });
      return;
    }

    // Validate password with same requirements as backend (admin-reset-password edge function)
    // Minimum 8 characters, at least one uppercase, one lowercase, one number, one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      toast({
        title: "Password Lemah",
        description: "Password minimal 8 karakter dengan huruf besar, huruf kecil, angka, dan simbol (!@#$%^&*)",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          userId: resetPasswordEmployee.id,
          newPassword: newPassword,
        },
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: `Password untuk ${resetPasswordEmployee.full_name} berhasil direset`,
      });

      setIsResetPasswordDialogOpen(false);
      setResetPasswordEmployee(null);
      setNewPassword("");
    } catch (error: any) {
      toast({
        title: "Gagal Reset Password",
        description: error.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const openSetAdminDialog = (employee: any) => {
    setSetAdminEmployee(employee);
    setIsSetAdminDialogOpen(true);
  };

  const handleSetAdminRole = async () => {
    if (!setAdminEmployee) return;

    setIsSettingAdmin(true);

    try {
      const currentRole = employeeRoles[setAdminEmployee.id] || 'employee';
      const newRole = currentRole === 'admin' ? 'employee' : 'admin';

      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', setAdminEmployee.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: `${setAdminEmployee.full_name} sekarang menjadi ${newRole === 'admin' ? 'Admin' : 'Karyawan'}`,
      });

      setIsSetAdminDialogOpen(false);
      setSetAdminEmployee(null);
      fetchEmployeeRoles();
    } catch (error: any) {
      toast({
        title: "Gagal Mengubah Role",
        description: error.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsSettingAdmin(false);
    }
  };

  const searchFilteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset to page 1 when search changes
  const totalPages = Math.ceil(searchFilteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const filteredEmployees = searchFilteredEmployees.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when search query changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Data Karyawan</h1>
            <p className="text-muted-foreground mt-1">
              Kelola informasi karyawan PT. Kemika Karya Pratama
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Karyawan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Tambah Karyawan Baru</DialogTitle>
                  <DialogDescription>
                    Masukkan data karyawan baru
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddEmployee} className="space-y-4">
                  {/* Photo Upload */}
                  <div className="flex flex-col items-center gap-4">
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Avatar className="h-24 w-24">
                        {photoPreview ? (
                          <AvatarImage src={photoPreview} alt="Preview" />
                        ) : (
                          <AvatarFallback className="bg-muted">
                            <User className="h-10 w-10 text-muted-foreground" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(e, false)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Klik untuk upload foto (maks 5MB)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nik">NIK *</Label>
                      <Input
                        id="nik"
                        value={formData.nik}
                        onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nama Lengkap *</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jabatan">Jabatan *</Label>
                      <Select
                        value={formData.jabatan}
                        onValueChange={(value) => setFormData({ ...formData, jabatan: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Jabatan" />
                        </SelectTrigger>
                        <SelectContent>
                          {JABATAN_OPTIONS.map((jabatan) => (
                            <SelectItem key={jabatan} value={jabatan}>
                              {jabatan}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="departemen">Departemen *</Label>
                      <Select
                        value={formData.departemen}
                        onValueChange={(value) => setFormData({ ...formData, departemen: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Departemen" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENT_OPTIONS.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telepon</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="join_date">Tanggal Bergabung *</Label>
                      <Input
                        id="join_date"
                        type="date"
                        value={formData.join_date}
                        onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="work_type">Tipe Kerja *</Label>
                      <Select
                        value={formData.work_type}
                        onValueChange={(value) => setFormData({ ...formData, work_type: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Tipe Kerja" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wfo">WFO (Work From Office)</SelectItem>
                          <SelectItem value="wfa">Hybrid (Work From Anywhere)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Hybrid: Bisa absen dari mana saja
                      </p>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="address">Alamat</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={isUploading}>
                      {isUploading ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Edit Employee Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingEmployee(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Data Karyawan</DialogTitle>
              <DialogDescription>
                Perbarui data karyawan
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditEmployee} className="space-y-4">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-4">
                <div 
                  className="relative cursor-pointer group"
                  onClick={() => editFileInputRef.current?.click()}
                >
                  <Avatar className="h-24 w-24">
                    {photoPreview ? (
                      <AvatarImage src={photoPreview} alt="Preview" />
                    ) : (
                      <AvatarFallback className="bg-muted">
                        <User className="h-10 w-10 text-muted-foreground" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="h-6 w-6 text-white" />
                  </div>
                </div>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhotoSelect(e, true)}
                />
                <p className="text-sm text-muted-foreground">
                  Klik untuk ubah foto (maks 5MB)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_nik">NIK *</Label>
                  <Input
                    id="edit_nik"
                    value={editFormData.nik}
                    onChange={(e) => setEditFormData({ ...editFormData, nik: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_full_name">Nama Lengkap *</Label>
                  <Input
                    id="edit_full_name"
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_jabatan">Jabatan *</Label>
                  <Select
                    value={editFormData.jabatan}
                    onValueChange={(value) => setEditFormData({ ...editFormData, jabatan: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Jabatan" />
                    </SelectTrigger>
                    <SelectContent>
                      {JABATAN_OPTIONS.map((jabatan) => (
                        <SelectItem key={jabatan} value={jabatan}>
                          {jabatan}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_departemen">Departemen *</Label>
                  <Select
                    value={editFormData.departemen}
                    onValueChange={(value) => setEditFormData({ ...editFormData, departemen: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_OPTIONS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_phone">Telepon</Label>
                  <Input
                    id="edit_phone"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_status">Status</Label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_work_type">Tipe Kerja *</Label>
                  <Select
                    value={editFormData.work_type}
                    onValueChange={(value) => setEditFormData({ ...editFormData, work_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe Kerja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wfo">WFO (Work From Office)</SelectItem>
                      <SelectItem value="wfa">Hybrid (Work From Anywhere)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Hybrid: Bisa absen dari mana saja
                  </p>
                </div>

                {/* Payroll Info Section */}
                <div className="col-span-2 border-t border-border pt-3 mt-2">
                  <p className="text-sm font-semibold text-muted-foreground mb-3">💰 Informasi Payroll</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_basic_salary">Gaji Pokok (Rp)</Label>
                  <Input
                    id="edit_basic_salary"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editFormData.basic_salary}
                    onChange={(e) => setEditFormData({ ...editFormData, basic_salary: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_ptkp_status">Status PTKP</Label>
                  <Select
                    value={editFormData.ptkp_status}
                    onValueChange={(value) => setEditFormData({ ...editFormData, ptkp_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih PTKP" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TK/0">TK/0 - Tidak Kawin</SelectItem>
                      <SelectItem value="TK/1">TK/1 - Tidak Kawin, 1 Tanggungan</SelectItem>
                      <SelectItem value="TK/2">TK/2 - Tidak Kawin, 2 Tanggungan</SelectItem>
                      <SelectItem value="TK/3">TK/3 - Tidak Kawin, 3 Tanggungan</SelectItem>
                      <SelectItem value="K/0">K/0 - Kawin, 0 Tanggungan</SelectItem>
                      <SelectItem value="K/1">K/1 - Kawin, 1 Tanggungan</SelectItem>
                      <SelectItem value="K/2">K/2 - Kawin, 2 Tanggungan</SelectItem>
                      <SelectItem value="K/3">K/3 - Kawin, 3 Tanggungan</SelectItem>
                      <SelectItem value="K/I/0">K/I/0 - Kawin, Istri Digabung, 0 Tanggungan</SelectItem>
                      <SelectItem value="K/I/1">K/I/1 - Kawin, Istri Digabung, 1 Tanggungan</SelectItem>
                      <SelectItem value="K/I/2">K/I/2 - Kawin, Istri Digabung, 2 Tanggungan</SelectItem>
                      <SelectItem value="K/I/3">K/I/3 - Kawin, Istri Digabung, 3 Tanggungan</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Penghasilan Tidak Kena Pajak
                  </p>
                </div>

                {/* BPJS & Tunjangan Tetap Section */}
                <div className="col-span-2 border-t border-border pt-3 mt-2">
                  <p className="text-sm font-semibold text-muted-foreground mb-3">🏥 BPJS & Tunjangan Tetap</p>
                </div>
                <div className="col-span-2 flex items-center space-x-2 mb-2">
                  <Checkbox
                    id="edit_bpjs_kes"
                    checked={editFormData.bpjs_kesehatan_enabled}
                    onCheckedChange={(checked) => setEditFormData({ ...editFormData, bpjs_kesehatan_enabled: !!checked })}
                  />
                  <Label htmlFor="edit_bpjs_kes" className="text-sm font-normal cursor-pointer">
                    Ikut BPJS Kesehatan
                  </Label>
                  {!editFormData.bpjs_kesehatan_enabled && (
                    <Badge variant="destructive" className="text-xs">Tidak Ikut</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_tunjangan_komunikasi">Tunjangan Komunikasi (Rp)</Label>
                  <Input
                    id="edit_tunjangan_komunikasi"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editFormData.tunjangan_komunikasi}
                    onChange={(e) => setEditFormData({ ...editFormData, tunjangan_komunikasi: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_tunjangan_jabatan">Tunjangan Jabatan (Rp)</Label>
                  <Input
                    id="edit_tunjangan_jabatan"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editFormData.tunjangan_jabatan}
                    onChange={(e) => setEditFormData({ ...editFormData, tunjangan_jabatan: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_tunjangan_operasional">Tunjangan Operasional (Rp)</Label>
                  <Input
                    id="edit_tunjangan_operasional"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editFormData.tunjangan_operasional}
                    onChange={(e) => setEditFormData({ ...editFormData, tunjangan_operasional: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit_address">Alamat</Label>
                  <Input
                    id="edit_address"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <EmployeeDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={(open) => {
            setIsDetailDialogOpen(open);
            if (!open) setViewingEmployee(null);
          }}
          employee={viewingEmployee}
          employeeRoles={employeeRoles}
          onEdit={(emp) => openEditDialog(emp)}
        />

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Daftar Karyawan</CardTitle>
                <CardDescription>Total {employees.length} karyawan aktif</CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari karyawan..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[calc(100vh-320px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foto</TableHead>
                    <TableHead>NIK</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>Bergabung</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={employee.photo_url} alt={employee.full_name} />
                            <AvatarFallback>{getInitials(employee.full_name)}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{employee.nik}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            {employee.full_name}
                            {employeeRoles[employee.id] === 'admin' && (
                              <Badge variant="outline" className="text-xs">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                            {employee.work_type === 'wfa' && (
                              <Badge variant="secondary" className="text-xs">
                                <MapPin className="h-3 w-3 mr-1" />
                                Hybrid
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                        <TableCell>{employee.jabatan}</TableCell>
                        <TableCell>{employee.departemen}</TableCell>
                        <TableCell>{new Date(employee.join_date).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>
                          <Badge variant="default">{employee.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetailDialog(employee)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Lihat Detail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(employee)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openResetPasswordDialog(employee)}>
                                <KeyRound className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openSetAdminDialog(employee)}>
                                {employeeRoles[employee.id] === 'admin' ? (
                                  <>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Hapus Admin
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    Jadikan Admin
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleDelete(employee.id)}
                              >
                                Hapus
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? 'Tidak ada karyawan yang sesuai dengan pencarian' : 'Belum ada karyawan'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Menampilkan {startIndex + 1}-{Math.min(startIndex + itemsPerPage, searchFilteredEmployees.length)} dari {searchFilteredEmployees.length} karyawan
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Sebelumnya
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        if (totalPages <= 5) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((page, index, arr) => (
                        <div key={page} className="flex items-center">
                          {index > 0 && arr[index - 1] !== page - 1 && (
                            <span className="px-2 text-muted-foreground">...</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            className="min-w-[36px]"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        </div>
                      ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Selanjutnya
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reset Password Dialog */}
        <Dialog open={isResetPasswordDialogOpen} onOpenChange={(open) => {
          setIsResetPasswordDialogOpen(open);
          if (!open) {
            setResetPasswordEmployee(null);
            setNewPassword("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Reset Password Karyawan
              </DialogTitle>
              <DialogDescription>
                Reset password untuk {resetPasswordEmployee?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Password Baru</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
                  Batal
                </Button>
                <Button onClick={handleAdminResetPassword} disabled={isResettingPassword}>
                  {isResettingPassword ? "Menyimpan..." : "Reset Password"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Set Admin Dialog */}
        <Dialog open={isSetAdminDialogOpen} onOpenChange={(open) => {
          setIsSetAdminDialogOpen(open);
          if (!open) {
            setSetAdminEmployee(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {setAdminEmployee && employeeRoles[setAdminEmployee.id] === 'admin' 
                  ? 'Hapus Role Admin' 
                  : 'Jadikan Admin'}
              </DialogTitle>
              <DialogDescription>
                {setAdminEmployee && employeeRoles[setAdminEmployee.id] === 'admin'
                  ? `Apakah Anda yakin ingin menghapus role admin dari ${setAdminEmployee?.full_name}?`
                  : `Apakah Anda yakin ingin menjadikan ${setAdminEmployee?.full_name} sebagai Admin?`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  {setAdminEmployee && employeeRoles[setAdminEmployee.id] === 'admin'
                    ? 'Karyawan ini akan kehilangan akses ke dashboard admin dan hanya bisa mengakses tampilan karyawan.'
                    : 'Karyawan ini akan mendapatkan akses penuh ke dashboard admin termasuk mengelola karyawan, pengaturan, dan laporan.'}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSetAdminDialogOpen(false)}>
                  Batal
                </Button>
                <Button onClick={handleSetAdminRole} disabled={isSettingAdmin}>
                  {isSettingAdmin ? "Menyimpan..." : (
                    setAdminEmployee && employeeRoles[setAdminEmployee.id] === 'admin' 
                      ? "Hapus Admin" 
                      : "Jadikan Admin"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Employees;
