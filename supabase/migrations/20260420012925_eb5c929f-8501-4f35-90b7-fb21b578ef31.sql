ALTER TABLE public.leave_requests
ADD COLUMN delegated_to uuid,
ADD COLUMN delegation_notes text;

COMMENT ON COLUMN public.leave_requests.delegated_to IS 'User ID karyawan yang menerima pendelegasian tugas selama cuti';
COMMENT ON COLUMN public.leave_requests.delegation_notes IS 'Detail tugas yang didelegasikan selama cuti';