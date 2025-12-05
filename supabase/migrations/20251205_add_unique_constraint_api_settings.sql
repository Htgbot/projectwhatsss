-- Add unique constraint to api_settings.company_id to support UPSERT operations
ALTER TABLE public.api_settings
ADD CONSTRAINT api_settings_company_id_key UNIQUE (company_id);
