-- Add unique constraint to api_settings.company_id to support UPSERT operations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'api_settings_company_id_key'
    ) THEN
        ALTER TABLE public.api_settings
        ADD CONSTRAINT api_settings_company_id_key UNIQUE (company_id);
    END IF;
END $$;
