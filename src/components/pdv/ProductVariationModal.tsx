import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Modal, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import VariationPicker from "./VariationPicker";
import { cn } from "../../lib/utils";

// Escolha de variação (tamanho, cor etc.) de um produto fora do PDV — orçamento, ordem de serviço,
// consignação. Mesmo visual e regras de estoque do seletor do PDV.

export type VariationOptions = Record<string, string>;

/** Forma mínima de produto que o seletor precisa — cada tela tem seu próprio tipo Product. */
export interface VariationProduct {
  name: string;
  price: number | string;
  discount_price?: number | string | null;
  attributes?: { name: string; values: string[] }[];
  variations?: { name: string; options: { value: string; stock: number }[] }[];
  skus?: { combo: Record<string, string>; stock: number }[];
}

export function productHasVariations(product: Pick<VariationProduct, "attributes" | "variations">): boolean {
  return (Array.isArray(product.attributes) && product.attributes.length > 0)
    || (Array.isArray(product.variations) && product.variations.length > 0);
}

/** Seleção inicial: a primeira combinação COM estoque (senão a primeira opção de cada atributo).
 *  Começar numa combinação esgotada deixava todas as outras opções desabilitadas. */
export function initialVariationOptions(product: Pick<VariationProduct, "attributes" | "variations"> & { skus?: VariationProduct["skus"] }): VariationOptions {
  const init: VariationOptions = {};
  if (Array.isArray(product.attributes) && product.attributes.length > 0) {
    product.attributes.forEach((a) => { init[a.name] = a.values[0] ?? ""; });
    const available = product.skus?.find((s) => s.stock > 0);
    if (available) Object.assign(init, available.combo);
  } else {
    product.variations?.forEach((v) => { init[v.name] = (v.options.find((o) => o.stock > 0) ?? v.options[0])?.value ?? ""; });
  }
  return init;
}

export function variationLabel(options: VariationOptions | null | undefined): string {
  return options ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
}

interface Props {
  product: VariationProduct | null;
  onClose: () => void;
  onConfirm: (options: VariationOptions, label: string) => void;
  confirmLabel?: string;
}

export default function ProductVariationModal({ product, onClose, onConfirm, confirmLabel = "Adicionar" }: Props) {
  const [selected, setSelected] = useState<VariationOptions>({});

  useEffect(() => {
    setSelected(product ? initialVariationOptions(product) : {});
  }, [product]);

  const price = product ? Number(product.discount_price || product.price) : 0;

  // estoque da combinação escolhida: impede confirmar uma variação esgotada
  const selectedStock = (() => {
    if (!product) return null;
    if (Array.isArray(product.attributes) && product.attributes.length > 0) {
      const sku = product.skus?.find((s) => Object.entries(s.combo).every(([k, v]) => selected[k] === v));
      return sku ? sku.stock : null;
    }
    const opts = (product.variations ?? []).map((v) => v.options.find((o) => o.value === selected[v.name]));
    return opts.length && opts.every(Boolean) ? Math.min(...opts.map((o) => o!.stock)) : null;
  })();
  const soldOut = selectedStock !== null && selectedStock <= 0;

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={product?.name}
      subtitle={product ? `Selecionar variação · R$ ${price.toFixed(2)}` : undefined}
      size="sm"
      zIndex={600}
      footer={product ? (
        <ModalFooter>
          <Button variant="outline" size="lg" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="lg" iconLeft={<Plus size={16} />} disabled={soldOut} onClick={() => onConfirm(selected, variationLabel(selected))}>
            {soldOut ? "Esgotado" : confirmLabel}
          </Button>
        </ModalFooter>
      ) : undefined}
    >
      {product && (
        <VariationPicker product={product} selected={selected}
          onSelect={(name, value) => setSelected({ ...selected, [name]: value })} />
      )}
    </Modal>
  );
}
