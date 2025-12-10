import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, X, Pencil, Download, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
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
import { EditBusinessTravelDialog } from "@/components/EditBusinessTravelDialog";

interface BusinessTravelRequest {
  id: string;
  destination: string;
  purpose: string;
  start_date: string;
  end_date: string;
  total_days: number;
  notes: string | null;
  status: string;
  document_url: string | null;
  created_at: string;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const BusinessTravelHistory = () => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [requests, setRequests] = useState<BusinessTravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [editRequest, setEditRequest] = useState<BusinessTravelRequest | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchRequests();
    }
  }, [profile?.id]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_travel_requests")
        .select("*")
        .eq("user_id", profile?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const { error } = await supabase
        .from("business_travel_requests")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Pengajuan perjalanan dinas berhasil dibatalkan");
    } catch (error) {
      console.error("Error cancelling request:", error);
      toast.error("Gagal membatalkan pengajuan");
    } finally {
      setCancellingId(null);
    }
  };

  const handleDownloadDocument = async (request: BusinessTravelRequest) => {
    if (!request.document_url) {
      toast.error("Dokumen belum tersedia");
      return;
    }

    setDownloadingId(request.id);
    try {
      // Extract the path from the URL
      const path = request.document_url.includes('business-travel-docs/') 
        ? request.document_url.split('business-travel-docs/')[1]
        : request.document_url;

      const { data, error } = await supabase.storage
        .from("business-travel-docs")
        .download(path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Surat_Dinas_${request.destination.replace(/\s+/g, '_')}_${format(new Date(request.start_date), 'dd-MM-yyyy')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Dokumen berhasil diunduh");
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Gagal mengunduh dokumen");
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Disetujui</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="secondary">Menunggu</Badge>;
    }
  };

  const filterByStatus = (items: BusinessTravelRequest[]): BusinessTravelRequest[] => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  };

  const filteredRequests = filterByStatus(requests);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/employee")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Kemika" className="h-8 object-contain" />
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Riwayat Perjalanan Dinas</h1>
            <p className="text-muted-foreground">Riwayat pengajuan perjalanan dinas luar</p>
          </div>
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat...</div>
          ) : filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {statusFilter === "all" ? "Belum ada pengajuan perjalanan dinas" : "Tidak ada pengajuan dengan status ini"}
              </CardContent>
            </Card>
          ) : (
            filteredRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">{request.destination}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(request.start_date), "d MMM yyyy", { locale: id })}
                        {request.start_date !== request.end_date &&
                          ` - ${format(new Date(request.end_date), "d MMM yyyy", { locale: id })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(request.status)}
                      {request.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditRequest(request)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={cancellingId === request.id}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Batalkan Pengajuan?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin membatalkan pengajuan perjalanan dinas ini? Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Tidak</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleCancel(request.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Ya, Batalkan
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm mb-2">{request.purpose}</p>
                  {request.notes && (
                    <p className="text-sm text-muted-foreground mb-2">Catatan: {request.notes}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{request.total_days} hari</span>
                    <span>Diajukan: {format(new Date(request.created_at), "d MMM yyyy", { locale: id })}</span>
                  </div>

                  {/* Download Document Button */}
                  {request.status === "approved" && request.document_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => handleDownloadDocument(request)}
                      disabled={downloadingId === request.id}
                    >
                      {downloadingId === request.id ? (
                        "Mengunduh..."
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Unduh Surat Dinas
                        </>
                      )}
                    </Button>
                  )}

                  {request.status === "approved" && !request.document_url && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground bg-muted p-2 rounded">
                      <FileText className="h-4 w-4" />
                      <span>Surat dinas sedang diproses oleh admin</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      {editRequest && (
        <EditBusinessTravelDialog
          open={!!editRequest}
          onOpenChange={(open) => !open && setEditRequest(null)}
          request={editRequest}
          onUpdated={fetchRequests}
        />
      )}

      <EmployeeBottomNav />
    </div>
  );
};

export default BusinessTravelHistory;
