-- Add approval_notes column to leave_requests for storing approval reason
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS approval_notes text;

-- Add approval_notes column to overtime_requests for storing approval reason  
ALTER TABLE public.overtime_requests ADD COLUMN IF NOT EXISTS approval_notes text;

-- Add rejection_reason column to overtime_requests if not exists
ALTER TABLE public.overtime_requests ADD COLUMN IF NOT EXISTS rejection_reason text;