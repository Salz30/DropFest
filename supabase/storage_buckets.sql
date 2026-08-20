-- Brand Assets bucket (logos, banners)
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Drop Banners bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('drop-banners', 'drop-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Product Images bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies: anyone can read public buckets
CREATE POLICY "Public read brand-assets" ON storage.objects FOR SELECT USING (bucket_id = 'brand-assets');
CREATE POLICY "Public read drop-banners" ON storage.objects FOR SELECT USING (bucket_id = 'drop-banners');
CREATE POLICY "Public read product-images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

-- Policies: authenticated users can upload
CREATE POLICY "Auth upload brand-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'brand-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Auth upload drop-banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'drop-banners' AND auth.role() = 'authenticated');
CREATE POLICY "Auth upload product-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Policies: authenticated users can update their uploads
CREATE POLICY "Auth update brand-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'brand-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update drop-banners" ON storage.objects FOR UPDATE USING (bucket_id = 'drop-banners' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update product-images" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');
