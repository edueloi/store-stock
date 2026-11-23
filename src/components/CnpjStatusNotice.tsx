import { Loader2 } from "lucide-react";

import { Alert } from "./ui/Alert";
import type { CnpjInfo } from "../lib/cnpjLookup";

function formatDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/** Resultado da consulta de CNPJ: situação cadastral na Receita. Inativo só avisa — nunca bloqueia o cadastro. */
export default function CnpjStatusNotice({ loading, info, error }: { loading: boolean; info: CnpjInfo | null; error: string | null }) {
  if (loading) {
    return <p className="flex items-center gap-1.5 text-[11px] text-slate-500" role="status"><Loader2 size={12} className="animate-spin" />Consultando o CNPJ na Receita Federal…</p>;
  }
  if (error) return <Alert variant="warning">{error} Você pode continuar preenchendo à mão.</Alert>;
  if (!info) return null;

  if (!info.active) {
    return (
      <Alert variant="warning" title={`Atenção: CNPJ com situação ${info.status || "não ativa"}`}>
        {info.legal_name ? <>{info.legal_name} — </> : null}
        situação {info.status || "não ativa"}{info.status_date ? ` desde ${formatDate(info.status_date)}` : ""}
        {info.status_reason && info.status_reason.toUpperCase() !== "SEM MOTIVO" ? ` (${info.status_reason.toLowerCase()})` : ""}.
        {" "}Você pode continuar, mas notas fiscais para esse CNPJ podem ser recusadas.
      </Alert>
    );
  }
  const regime = info.mei ? "MEI" : info.simples ? "Simples Nacional" : "";
  return (
    <Alert variant="success" title="CNPJ ativo na Receita Federal">
      {info.legal_name}
      {info.cnae_code ? ` · CNAE ${info.cnae_code}${info.cnae_description ? ` (${info.cnae_description})` : ""}` : ""}
      {regime ? ` · ${regime}` : ""}
    </Alert>
  );
}
