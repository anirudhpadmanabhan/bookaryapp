ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS favorite_quote TEXT;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS tracking_status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;