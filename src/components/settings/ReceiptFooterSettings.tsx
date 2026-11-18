import { useId } from "react";
import { Switch } from "../ui/Switch";
import { buildReceiptFooterText, readReceiptFooterConfig, RECEIPT_FOOTER_MESSAGE_LIMIT, RECEIPT_FOOTER_TITLE_LIMIT, type ReceiptFooterConfig } from "../../../shared/receiptFooter";

export default function ReceiptFooterSettings({ value, onChange }: { value?: ReceiptFooterConfig; onChange: (value: ReceiptFooterConfig) => void }) {
  const id = useId();
  const config = { ...readReceiptFooterConfig({ receipt_footer: value }), ...value };
  const update = (patch: Partial<ReceiptFooterConfig>) => onChange({ ...config, ...patch });
  const preview = buildReceiptFooterText({ receipt_footer: config });
  const fieldClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5" aria-labelledby={`${id}-heading`}>
    <div>
      <h3 id={`${id}-heading`} className="text-xs font-semibold text-slate-800">Mensagem no rodapé das notinhas</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Configure avisos de troca, atendimento ou agradecimento para os comprovantes de venda, reimpressões e a impressão da NFC-e.</p>
    </div>
    <Switch checked={config.enabled} onCheckedChange={enabled => update({ enabled })} label="Exibir mensagem no rodapé" />
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <div><label htmlFor={`${id}-title`} className="mb-1.5 block text-[11px] font-semibold text-slate-700">Título do aviso (opcional)</label><input id={`${id}-title`} className={fieldClass} maxLength={RECEIPT_FOOTER_TITLE_LIMIT} value={config.title} onChange={e => update({ title: e.target.value })} placeholder="Ex.: Política de troca" /></div>
        <div><label htmlFor={`${id}-message`} className="mb-1.5 block text-[11px] font-semibold text-slate-700">Mensagem para o cliente</label><textarea id={`${id}-message`} className={fieldClass} rows={4} maxLength={RECEIPT_FOOTER_MESSAGE_LIMIT} value={config.message} onChange={e => update({ message: e.target.value })} placeholder="Escreva o aviso que deve aparecer no final da notinha." /><p className="mt-1 text-right text-[10px] text-slate-400">{config.message.length}/{RECEIPT_FOOTER_MESSAGE_LIMIT} caracteres</p></div>
        <button type="button" className="text-[11px] font-semibold text-blue-700 hover:underline" onClick={() => update({ enabled: true, title: "POLÍTICA DE TROCA", message: "Trocas em até 3 dias após a compra, com a embalagem e a apresentação da nota." })}>Usar exemplo de aviso de troca</button>
        <p className="text-[11px] leading-relaxed text-slate-500">A mensagem é exclusiva da sua loja. Ajuste o prazo e as condições conforme a sua política e clique em Salvar alterações.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Prévia do rodapé · térmica 80 mm</p>
        <pre className="overflow-x-auto whitespace-pre text-center font-mono text-[10px] leading-relaxed text-black" aria-live="polite">{preview ? `${"-".repeat(42)}\n${preview}       Obrigado pela preferência!` : "A mensagem não será impressa.\nAtive e preencha o texto para visualizar."}</pre>
      </div>
    </div>
  </section>;
}
