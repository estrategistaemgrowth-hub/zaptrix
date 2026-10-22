-- Planos por quantidade de produtos (até 50): R$ 29,90 por até 20 produtos
-- e + R$ 7,00 a cada 10 produtos. 1 usuário cada. A tela /assinar agrupa todo
-- plano com product_limit <= 50 numa barra deslizante; os limites continuam
-- reforçados pelos triggers enforce_product_limit/enforce_member_limit (0024).
INSERT INTO plans (name, price_cents, product_limit, member_limit)
SELECT v.name, v.price_cents, v.product_limit, 1
FROM (VALUES
  ('Essencial 20', 2990, 20),
  ('Essencial 30', 3690, 30),
  ('Essencial 40', 4390, 40),
  ('Essencial 50', 5090, 50)
) AS v(name, price_cents, product_limit)
WHERE NOT EXISTS (SELECT 1 FROM plans p WHERE p.name = v.name);
