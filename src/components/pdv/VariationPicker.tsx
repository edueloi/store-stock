import React from "react";
import { cn } from "../../lib/utils";
import { colorHex, isColorAttribute } from "../../lib/colorNames";

// Seletor de variações (cor, tamanho, modelo...) compacto e limpo, usado no PDV e nas telas de
// orçamento / ordem de serviço / consignação. Mostra bolinha de cor quando o atributo é cor,
// destaca só o estoque baixo e resume a combinação escolhida; a lista completa de estoque por
// combinação fica recolhida para não ocupar a tela.

export interface PickerProduct {
  attributes?: { name: string; values: string[]; colors?: Record<string, string> }[];
  variations?: { name: string; options: { value: string; stock: number }[] }[];
  skus?: { combo: Record<string, string>; stock: number }[];
}

function swatchFor(attrName: string, value: string, colors?: Record<string, string>): string | null {
  if (colors?.[value]) return colors[value];
  return isColorAttribute(attrName) ? colorHex(value) : null;
}

function StockPill({ stock }: { stock: number }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold",
      stock <= 0 ? "bg-red-50 text-red-600" : stock <= 3 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
      {stock <= 0 ? "Esgotado" : `${stock} un`}
    </span>
  );
}

interface Props {
  product: PickerProduct;
  selected: Record<string, string>;
  onSelect: (name: string, value: string) => void;
}

export default function VariationPicker({ product, selected, onSelect }: Props) {
  const hasAttrs = Array.isArray(product.attributes) && product.attributes.length > 0;

  const groups: { name: string; colors?: Record<string, string>; options: { value: string; stock: number | null }[] }[] = hasAttrs
    ? product.attributes!.map((attr) => ({
        name: attr.name,
        colors: attr.colors,
        options: attr.values.map((value) => {
          const current = { ...selected, [attr.name]: value };
          const sku = product.skus?.find((s) => Object.entries(s.combo).every(([k, v]) => current[k] === v));
          return { value, stock: sku ? sku.stock : null };
        }),
      }))
    : (product.variations ?? []).map((v) => ({ name: v.name, options: v.options.map((o) => ({ value: o.value, stock: o.stock })) }));

  // Estoque da combinação escolhida (resumo)
  const selectedStock = (() => {
    if (hasAttrs) {
      const sku = product.skus?.find((s) => Object.entries(s.combo).every(([k, v]) => selected[k] === v));
      return sku ? sku.stock : null;
    }
    const opts = (product.variations ?? []).map((v) => v.options.find((o) => o.value === selected[v.name]));
    return opts.length && opts.every(Boolean) ? Math.min(...opts.map((o) => o!.stock)) : null;
  })();
  const summary = Object.values(selected).filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.name}>
          <div className="mb-1.5 flex items-baseline gap-2">
            <p className="text-[13px] font-semibold text-slate-700">{group.name}</p>
            {selected[group.name] && <span className="text-[12px] text-slate-400">{selected[group.name]}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((opt) => {
              const available = opt.stock === null || opt.stock > 0;
              const isSelected = selected[group.name] === opt.value;
              const swatch = swatchFor(group.name, opt.value, group.colors);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!available}
                  onClick={() => onSelect(group.name, opt.value)}
                  title={opt.stock === null ? opt.value : opt.stock <= 0 ? `${opt.value} — esgotado` : `${opt.value} — ${opt.stock} un`}
                  className={cn(
                    "inline-flex h-9 min-w-[44px] items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
                    !available ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 line-through opacity-60"
                      : isSelected ? "border-blue-600 bg-blue-50 font-semibold text-blue-700 ring-1 ring-blue-600"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50",
                  )}
                >
                  {swatch && <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/15" style={{ background: swatch }} />}
                  {opt.value}
                  {available && opt.stock !== null && opt.stock <= 3 && (
                    <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">{opt.stock}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Resumo da combinação escolhida */}
      {summary && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">Selecionado</p>
            <p className="truncate text-[14px] font-semibold text-slate-800">{summary}</p>
          </div>
          {selectedStock !== null && <StockPill stock={selectedStock} />}
        </div>
      )}

      {/* Estoque por combinação — recolhido */}
      {product.skus && product.skus.length > 1 && (
        <details className="group rounded-xl border border-slate-200">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[12px] font-medium text-slate-500 hover:text-slate-700">
            Estoque por combinação ({product.skus.length})
            <span className="text-[10px] transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="grid max-h-44 grid-cols-1 gap-x-4 overflow-y-auto border-t border-slate-100 px-3 py-1.5 sm:grid-cols-2">
            {product.skus.map((sku, i) => {
              const current = Object.entries(sku.combo).every(([k, v]) => selected[k] === v);
              return (
                <div key={i} className={cn("flex items-center justify-between rounded-md px-1.5 py-1", current && "bg-blue-50")}>
                  <span className="text-[12px] text-slate-600">{Object.values(sku.combo).join(" · ")}</span>
                  <StockPill stock={sku.stock} />
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
