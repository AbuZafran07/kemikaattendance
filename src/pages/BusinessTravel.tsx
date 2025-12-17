import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle2, XCircle, Clock, Upload, Download, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BusinessTravelRequest {
  id: string;
  user_id: string;
  destination: string;
  purpose: string;
  start_date: string;
  end_date: string;
  total_days: number;
  notes: string | null;
  status: string;
  document_url: string | null;
  rejection_reason: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    nik: string;
    departemen: string;
  } | null;
}

const BusinessTravel = () => {
  const [requests, setRequests] = useState<BusinessTravelRequest[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { userRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === "admin";
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BusinessTravelRequest | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const totalPages = Math.ceil(requests.length / itemsPerPage);
  const paginatedRequests = requests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    fetchRequests();

    // Real-time listener
    const channel = supabase
      .channel("realtime:business_travel_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_travel_requests" },
        (payload) => {
          console.log("Business travel request change:", payload);
          fetchRequests();

          if (payload.eventType === "INSERT") {
            toast({
              title: "Pengajuan Perjalanan Dinas Baru",
              description: "Ada permintaan perjalanan dinas baru masuk",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    console.log("Fetching business travel requests...");

    const { data: requestsData, error: requestsError } = await supabase
      .from("business_travel_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestsError) {
      console.error("Error fetching requests:", requestsError);
      toast({
        title: "Gagal Memuat Data",
        description: requestsError.message,
        variant: "destructive",
      });
      return;
    }

    if (!requestsData || requestsData.length === 0) {
      setRequests([]);
      return;
    }

    // Get unique user IDs
    const userIds = [...new Set(requestsData.map((r) => r.user_id))];

    // Fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, nik, departemen")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    // Create profiles map
    const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));

    // Combine data
    const combinedData = requestsData.map((request) => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null,
    }));

    console.log("Business travel requests fetched:", combinedData);
    setRequests(combinedData);
  };

  const handleApproveClick = (request: BusinessTravelRequest) => {
    setSelectedRequest(request);
    setUploadingFile(null);
    setUploadDialogOpen(true);
  };

  const handleRejectClick = (request: BusinessTravelRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Format File Tidak Didukung",
          description: "Gunakan format PDF, DOC, DOCX, JPG, atau PNG",
          variant: "destructive",
        });
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Terlalu Besar",
          description: "Maksimal ukuran file adalah 10MB",
          variant: "destructive",
        });
        return;
      }
      setUploadingFile(file);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);

    try {
      let documentUrl = null;

      // Upload document if provided
      if (uploadingFile) {
        const fileExt = uploadingFile.name.split('.').pop();
        const fileName = `${selectedRequest.id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("business-travel-docs")
          .upload(fileName, uploadingFile);

        if (uploadError) throw uploadError;

        documentUrl = fileName;
      }

      // Update request status
      const updateData: any = {
        status: "approved",
        approved_at: new Date().toISOString(),
      };

      if (documentUrl) {
        updateData.document_url = documentUrl;
      }

      const { error } = await supabase
        .from("business_travel_requests")
        .update(updateData)
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: documentUrl 
          ? "Perjalanan dinas disetujui dan dokumen berhasil diunggah" 
          : "Perjalanan dinas disetujui",
      });

      setUploadDialogOpen(false);
      setSelectedRequest(null);
      setUploadingFile(null);
      fetchRequests();
    } catch (error: any) {
      console.error("Error approving request:", error);
      toast({
        title: "Gagal Menyetujui",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from("business_travel_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason || "Ditolak oleh admin",
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Perjalanan dinas ditolak",
      });

      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      fetchRequests();
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Gagal Menolak",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadDocument = async (request: BusinessTravelRequest) => {
    setSelectedRequest(request);
    setUploadingFile(null);
    setUploadDialogOpen(true);
  };

  const handleUploadOnly = async () => {
    if (!selectedRequest || !uploadingFile) return;

    setIsProcessing(true);

    try {
      const fileExt = uploadingFile.name.split('.').pop();
      const fileName = `${selectedRequest.id}_${Date.now()}.${fileExt}`;

      // Delete old file if exists
      if (selectedRequest.document_url) {
        await supabase.storage
          .from("business-travel-docs")
          .remove([selectedRequest.document_url]);
      }

      const { error: uploadError } = await supabase.storage
        .from("business-travel-docs")
        .upload(fileName, uploadingFile);

      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from("business_travel_requests")
        .update({ document_url: fileName })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Dokumen berhasil diunggah",
      });

      setUploadDialogOpen(false);
      setSelectedRequest(null);
      setUploadingFile(null);
      fetchRequests();
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast({
        title: "Gagal Mengunggah",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-primary">Disetujui</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Perjalanan Dinas</h1>
          <p className="text-muted-foreground mt-1">Kelola permintaan perjalanan dinas karyawan</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Permintaan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{requests.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                <span className="text-3xl font-bold">{requests.filter((r) => r.status === "pending").length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disetujui</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{requests.filter((r) => r.status === "approved").length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Permintaan Perjalanan Dinas</CardTitle>
            <CardDescription>Semua permintaan perjalanan dinas karyawan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[calc(100vh-400px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIK</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>Tujuan</TableHead>
                    <TableHead>Keperluan</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dokumen</TableHead>
                    {isAdmin && <TableHead>Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.length > 0 ? (
                    paginatedRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.profiles?.full_name}</TableCell>
                        <TableCell>{request.profiles?.nik}</TableCell>
                        <TableCell>{request.profiles?.departemen}</TableCell>
                        <TableCell>{request.destination}</TableCell>
                        <TableCell className="max-w-xs truncate">{request.purpose}</TableCell>
                        <TableCell>
                          {format(new Date(request.start_date), "d MMM yyyy", { locale: id })} -
                          {format(new Date(request.end_date), "d MMM yyyy", { locale: id })}
                        </TableCell>
                        <TableCell>{request.total_days} hari</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          {request.document_url ? (
                            <Badge variant="outline" className="gap-1">
                              <FileText className="h-3 w-3" />
                              Ada
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Belum Ada</Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-2">
                              {request.status === "pending" && (
                                <>
                                  <Button size="sm" onClick={() => handleApproveClick(request)}>
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleRejectClick(request)}>
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {request.status === "approved" && (
                                <Button size="sm" variant="outline" onClick={() => handleUploadDocument(request)}>
                                  <Upload className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-muted-foreground">
                        Belum ada permintaan perjalanan dinas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, requests.length)} dari {requests.length} data
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approve & Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedRequest?.status === "approved" ? "Upload Surat Dinas" : "Setujui Perjalanan Dinas"}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.status === "approved"
                ? "Upload dokumen surat dinas untuk karyawan"
                : "Anda dapat mengupload surat dinas sekarang atau nanti setelah disetujui"}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><strong>Nama:</strong> {selectedRequest.profiles?.full_name}</p>
                <p><strong>Tujuan:</strong> {selectedRequest.destination}</p>
                <p><strong>Tanggal:</strong> {format(new Date(selectedRequest.start_date), "d MMM yyyy", { locale: id })} - {format(new Date(selectedRequest.end_date), "d MMM yyyy", { locale: id })}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document">Upload Surat Dinas (Opsional)</Label>
                <Input
                  id="document"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
                {uploadingFile && (
                  <p className="text-xs text-muted-foreground">
                    File dipilih: {uploadingFile.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Format: PDF, DOC, DOCX, JPG, PNG (Maks. 10MB)
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Batal
            </Button>
            {selectedRequest?.status === "approved" ? (
              <Button onClick={handleUploadOnly} disabled={!uploadingFile || isProcessing}>
                {isProcessing ? "Mengupload..." : "Upload Dokumen"}
              </Button>
            ) : (
              <Button onClick={handleApprove} disabled={isProcessing}>
                {isProcessing ? "Memproses..." : uploadingFile ? "Setujui & Upload" : "Setujui Tanpa Dokumen"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Perjalanan Dinas</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan untuk perjalanan dinas ini
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><strong>Nama:</strong> {selectedRequest.profiles?.full_name}</p>
                <p><strong>Tujuan:</strong> {selectedRequest.destination}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Alasan Penolakan</Label>
                <Textarea
                  id="reason"
                  placeholder="Tuliskan alasan penolakan..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing}>
              {isProcessing ? "Memproses..." : "Tolak Perjalanan Dinas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default BusinessTravel;
