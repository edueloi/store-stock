import { useCallback, useRef, useState } from "react";

/** Dados da Receita Federal devolvidos por GET /api/fiscal-codes/cnpj/:cnpj. */
export interface CnpjInfo {
  cnpj: string;
  legal_name: string;
  trade_name: string;
  /** ATIVA | BAIXADA | INAPTA | SUSPENSA | NULA */
  status: string;
  active: boolean;
  status_date: string;
  status_reason: string;
  opening_date: string;
  cnae_code: string;
  cnae_description: string;
  legal_nature: string;
  size: string;
  simples: boolean;
  mei: boolean;
  suggested_tax_regime: "simples_nacional" | null;
  email: string;
  phone: string;
  address: { zip: string; street: string; number: string; complement: string; district: string; city: string; state: string };
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Consulta o CNPJ no servidor. Nunca lança: devolve `error` com texto pronto para mostrar. */
export async function fetchCnpj(cnpj: string): Promise<{ info?: CnpjInfo; error?: string }> {
  try {
    const res = await fetch(`/api/fiscal-codes/cnpj/${onlyDigits(cnpj)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.error || "Não foi possível consultar o CNPJ agora." };
    return { info: data as CnpjInfo };
  } catch {
    return { error: "Sem conexão para consultar o CNPJ. Preencha manualmente." };
  }
}

/**
 * Consulta automática de CNPJ: chame `run(valorDigitado)` a cada mudança do campo. Só consulta quando há 14 dígitos
 * (CPF e valores incompletos limpam o aviso) e ignora respostas atrasadas de um CNPJ que já foi trocado.
 * Empresa inativa não bloqueia: o aviso é só informativo.
 */
export function useCnpjLookup(onFound?: (info: CnpjInfo) => void) {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<CnpjInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef("");
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  const clear = useCallback(() => { lastRef.current = ""; setInfo(null); setError(null); setLoading(false); }, []);

  const run = useCallback(async (value: string, force = false) => {
    const digits = onlyDigits(value);
    if (digits.length !== 14) { clear(); return null; }
    if (!force && digits === lastRef.current) return null;
    lastRef.current = digits;
    setLoading(true); setError(null); setInfo(null);
    const result = await fetchCnpj(digits);
    if (lastRef.current !== digits) return null; // o usuário já trocou o CNPJ
    setLoading(false);
    if (result.error) { setError(result.error); return null; }
    setInfo(result.info!);
    onFoundRef.current?.(result.info!);
    return result.info!;
  }, [clear]);

  return { loading, info, error, run, clear };
}
