-- Add status column to business_numbers for approval workflow
-- Add user_id if it doesn't exist (idempotent)

DO $$
BEGIN
    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_numbers' AND column_name = 'status') THEN
        ALTER TABLE public.business_numbers ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
        ALTER TABLE public.business_numbers ADD CONSTRAINT business_numbers_status_check CHECK (status IN ('pending', 'active', 'rejected'));
    END IF;

    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_numbers' AND column_name = 'user_id') THEN
        ALTER TABLE public.business_numbers ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.business_numbers TO postgres;
GRANT ALL ON public.business_numbers TO service_role;
GRANT ALL ON public.business_numbers TO authenticated;
GRANT ALL ON public.business_numbers TO anon;
