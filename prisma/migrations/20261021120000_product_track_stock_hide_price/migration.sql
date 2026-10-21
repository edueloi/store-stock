-- Controle de estoque e exibição do preço no site, por produto.
ALTER TABLE `products`
  ADD COLUMN `track_stock` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `hide_price_on_site` BOOLEAN NOT NULL DEFAULT false;
