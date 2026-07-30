import { callNfseRest, type NfseEnvironment } from "./restClient";

export interface ParametrosServicoResult {
  aliquota: number | null;
  encontrado: boolean;
}

// Consulta a alíquota do ISS parametrizada pelo município para um código de serviço —
// dispensa o usuário de digitar a alíquota manualmente quando o município já aderiu
// ao Sistema Nacional NFS-e (caso do Tatuí/SP e da maioria dos municípios em 2026).
export async function consultarAliquotaServico(
  environment: NfseEnvironment,
  codigoMunicipio: string,
  codigoServico: string,
  pfxPath: string,
  pfxPassword: string,
  timeoutMs: number,
): Promise<ParametrosServicoResult> {
  const result = await callNfseRest({
    environment,
    method: "GET",
    path: `/parametros_municipais/${codigoMunicipio}/${codigoServico}`,
    pfxPath,
    pfxPassword,
    timeoutMs,
  });

  if (!result.ok || !result.data) {
    return { aliquota: null, encontrado: false };
  }

  const aliquota = (result.data as Record<string, unknown>).aliquota;
  return {
    aliquota: typeof aliquota === "number" ? aliquota : null,
    encontrado: true,
  };
}
