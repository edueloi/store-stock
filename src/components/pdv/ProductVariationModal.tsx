import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Modal, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
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

/** Primeira opção de cada atributo como seleção inicial. */
export function initialVariationOptions(product: Pick<VariationProduct, "attributes" | "variations">): VariationOptions {
  const init: VariationOptions = {};
  if (Array.isArray(product.attributes) && product.attributes.length > 0) {
    product.attributes.forEach((a) => { init[a.name] = a.values[0] ?? ""; });
  } else {
    product.variations?.forEach((v) => { init[v.name] = v.options[0]?.value ?? ""; });
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

  const optionButton = (key: string, label: string, stock: number | null, isSelected: boolean, onPick: () => void) => {
    const hasStock = stock === null || stock > 0;
    return (
      <button
        key={key}
        type="button"
        disabled={!hasStock}
        onClick={onPick}
        className={cn(
          "flex min-h-[44px] min-w-[64px] flex-col items-center justify-center rounded-lg border px-3 py-1.5 transition-colors",
          !hasStock ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-50"
            : isSelected ? "border-blue-600 bg-blue-50"
              : "border-slate-200 bg-white hover:border-blue-300",
        )}
      >
        <span className={cn("text-xs font-medium", !hasStock && "line-through", isSelected ? "text-blue-700" : "text-slate-700")}>{label}</span>
        {stock !== null && (
          <span className={cn("mt-0.5 text-[10px] font-medium", stock === 0 ? "text-red-500" : stock <= 3 ? "text-amber-600" : "text-slate-400")}>
            {stock === 0 ? "esgotado" : `${stock} un`}
          </span>
        )}
      </button>
    );
  };

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={product?.name}
      subtitle={product ? `Selecionar variação · R$ ${price.toFixed(2)}` : undefined}
      size="md"
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
        <div className="space-y-4">
          {Array.isArray(product.attributes) && product.attributes.length > 0
            ? product.attributes.map((attr, aIdx) => (
              <div key={aIdx}>
                <p className="mb-2 text-xs font-medium text-slate-600">{attr.name}</p>
                <div className="flex flex-wrap gap-2">
                  {attr.values.map((val, vIdx) => {
                    const current = { ...selected, [attr.name]: val };
                    const sku = product.skus?.find((s) => Object.entries(s.combo).every(([k, v]) => current[k] === v));
                    return optionButton(`${aIdx}-${vIdx}`, val, sku ? sku.stock : null, selected[attr.name] === val, () => setSelected({ ...selected, [attr.name]: val }));
                  })}
                </div>
              </div>
            ))
            : product.variations?.map((variation, vIdx) => (
              <div key={vIdx}>
                <p className="mb-2 text-xs font-medium text-slate-600">{variation.name}</p>
                <div className="flex flex-wrap gap-2">
                  {variation.options.map((opt, oIdx) =>
                    optionButton(`${vIdx}-${oIdx}`, opt.value, opt.stock, selected[variation.name] === opt.value, () => setSelected({ ...selected, [variation.name]: opt.value })))}
                </div>
              </div>
            ))}

          {product.skus && product.skus.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">Estoque disponível</p>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                {product.skus.map((sku, sIdx) => {
                  const isCurrent = Object.entries(sku.combo).every(([k, v]) => selected[k] === v);
                  return (
                    <div key={sIdx} className={cn("flex items-center justify-between px-3 py-2", sIdx > 0 && "border-t border-slate-100", isCurrent ? "bg-blue-50" : "bg-white")}>
                      <span className="text-[11px] font-medium text-slate-600">{Object.values(sku.combo).join(" · ")}</span>
                      <Badge size="sm" color={sku.stock === 0 ? "danger" : sku.stock <= 3 ? "warning" : "success"}>
                        {sku.stock === 0 ? "Esgotado" : `${sku.stock} un`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
