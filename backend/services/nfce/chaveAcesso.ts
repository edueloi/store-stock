// Chave de acesso da NFC-e: 44 dígitos.
// cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)

const UF_CODES: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53",
  ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
  PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43",
  RO: "11", RR: "14", SC: "42", SE: "28", SP: "35", TO: "17",
};

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function digitoVerificador(chave43: string): number {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  let weightIndex = 0;
  for (let i = chave43.length - 1; i >= 0; i--) {
    sum += Number(chave43[i]) * weights[weightIndex % weights.length];
    weightIndex++;
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export interface ChaveAcessoInput {
  uf: string; // sigla, ex: "SP"
  emissaoAno: number; // ex: 2026
  emissaoMes: number; // 1-12
  cnpj: string;
  serie: number;
  numero: number;
  tpEmis?: number; // 1 = normal, 9 = contingência offline
  cNF?: number; // código numérico aleatório 0-99999999 (usado se não informado)
}

export function gerarChaveAcesso(input: ChaveAcessoInput): string {
  const cUF = UF_CODES[input.uf.toUpperCase()];
  if (!cUF) throw new Error(`UF desconhecida: ${input.uf}`);

  const aamm = `${String(input.emissaoAno).slice(-2)}${String(input.emissaoMes).padStart(2, "0")}`;
  const cnpj = onlyDigits(input.cnpj).padStart(14, "0");
  const mod = "65"; // modelo NFC-e
  const serie = String(input.serie).padStart(3, "0");
  const nNF = String(input.numero).padStart(9, "0");
  const tpEmis = String(input.tpEmis ?? 1);
  const cNF = String(input.cNF ?? Math.floor(Math.random() * 99999999)).padStart(8, "0");

  const chave43 = `${cUF}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  const cDV = digitoVerificador(chave43);

  return `${chave43}${cDV}`;
}
