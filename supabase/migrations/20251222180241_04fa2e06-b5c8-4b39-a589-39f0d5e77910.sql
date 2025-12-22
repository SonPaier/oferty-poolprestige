-- Create settings table for app configuration
CREATE TABLE public.settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  company_settings JSONB NOT NULL DEFAULT '{}',
  excavation_settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (single user app)
CREATE POLICY "Settings are readable by everyone"
ON public.settings
FOR SELECT
USING (true);

-- Allow anyone to insert settings
CREATE POLICY "Settings can be inserted by anyone"
ON public.settings
FOR INSERT
WITH CHECK (true);

-- Allow anyone to update settings
CREATE POLICY "Settings can be updated by anyone"
ON public.settings
FOR UPDATE
USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_settings_updated_at();