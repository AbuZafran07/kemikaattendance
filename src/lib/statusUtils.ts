// Status formatting utilities for reports

export const formatAttendanceStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    hadir: "Hadir",
    terlambat: "Terlambat",
    pulang_cepat: "Pulang Cepat",
    tidak_hadir: "Tidak Hadir",
    // Leave types
    cuti_tahunan: "Cuti",
    cuti: "Cuti",
    izin: "Izin",
    sakit: "Sakit",
    lupa_absen: "Lupa Absen",
    // Business travel
    dinas: "Dinas",
    // Request status
    pending: "Menunggu",
    approved: "Disetujui",
    rejected: "Ditolak",
  };

  return statusMap[status] || status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

export const formatLeaveType = (leaveType: string): string => {
  const typeMap: Record<string, string> = {
    cuti_tahunan: "Cuti Tahunan",
    izin: "Izin",
    sakit: "Sakit",
    lupa_absen: "Lupa Absen",
  };

  return typeMap[leaveType] || leaveType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};
