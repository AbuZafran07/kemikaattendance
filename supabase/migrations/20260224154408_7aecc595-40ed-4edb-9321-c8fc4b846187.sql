
ALTER TABLE public.profiles
ADD COLUMN contract_type text NOT NULL DEFAULT 'permanent',
ADD COLUMN npwp text NULL,
ADD COLUMN bank_name text NULL,
ADD COLUMN bank_account_number text NULL;
