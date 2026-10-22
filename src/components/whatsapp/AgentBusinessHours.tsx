import { BUSINESS_DAYS, BUSINESS_DAY_LABELS, type BusinessHours } from "../../../shared/businessHours";
import { Switch } from "../ui";

export default function AgentBusinessHours({ value, onChange }: { value: BusinessHours | null; onChange: (value: BusinessHours | null) => void }) {
  return <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
    <legend className="px-1 text-sm font-semibold text-slate-900">Expediente do atendente</legend>
    <Switch label="Usar o horário da loja" checked={value === null} onChange={inherit => onChange(inherit ? null : Object.fromEntries(BUSINESS_DAYS.map(day => [day, { closed: true }])))} />
    <p className="text-xs leading-5 text-slate-500">Horário de Brasília. Fora do expediente, o bot informa os horários e continua ajudando sem transferir. Se o horário da loja não estiver cadastrado, a disponibilidade será controlada pelo status online.</p>
    {value !== null && <div className="space-y-3">{BUSINESS_DAYS.map(day => {
      const entry = value[day] ?? { closed: true };
      return <div key={day} className="space-y-2 border-t border-slate-100 pt-3">
        <Switch label={BUSINESS_DAY_LABELS[day]} checked={!entry.closed} onChange={open => onChange({ ...value, [day]: open ? { open: "", close: "", closed: false } : { closed: true } })} />
        {!entry.closed ? <div className="grid grid-cols-2 gap-3">
          {(["open", "close"] as const).map(key => <label key={key} className="space-y-1 text-xs text-slate-500">
            <span>{key === "open" ? "Entrada" : "Saída"}</span>
            <input type="time" required aria-label={`${key === "open" ? "Entrada" : "Saída"} de ${BUSINESS_DAY_LABELS[day]}`} value={entry[key] ?? ""} onChange={e => onChange({ ...value, [day]: { ...entry, [key]: e.target.value } })} className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>)}
        </div> : <p className="text-xs text-slate-400">Sem expediente</p>}
      </div>;
    })}</div>}
  </fieldset>;
}
