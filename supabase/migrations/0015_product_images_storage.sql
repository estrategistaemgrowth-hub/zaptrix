-- Zaptrix — bucket de storage para fotos de produto enviadas manualmente
-- (a IA usa image_url para mandar foto do produto ao cliente no WhatsApp)
-- 2026-09-09

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Qualquer pessoa pode VER as imagens (bucket público — necessário para a Evolution
-- API/WhatsApp buscar a URL da imagem e enviar ao cliente)
CREATE POLICY "Product images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Só membro do workspace (autenticado) pode enviar/remover, e só dentro da
-- pasta do próprio workspace (primeira parte do path = workspace_id)
CREATE POLICY "Workspace members can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Workspace members can delete their product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
