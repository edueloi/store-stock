// Identificador da DPS (Declaração de Prestação de Serviço), 45 dígitos após o literal "DPS":
// cLocEmi(7) + tpInsc(1) + inscricaoFederal(14) + serie(5) + nDPS(15)
// Usado como valor do atributo Id em <infDPS Id="DPS...">.

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

export interface DpsIdInput {
  codigoMunicipio: string; // código IBGE (7 dígitos) do município emissor
  cnpj?: string; // titular pessoa jurídica
  cpf?: string; // titular pessoa física
  serie: number;
  numero: number;
}

// tpInsc: 1 = CPF, 2 = CNPJ (confirmado contra o servidor real — nome do campo é
// contraintuitivo, mas o Sistema Nacional NFS-e rejeita com erro E0004 "identificador
// difere da concatenação" quando invertido)
export function gerarIdDPS(input: DpsIdInput): { id: string; tipoInscricao: 1 | 2; inscricaoFederal: string } {
  const cLocEmi = onlyDigits(input.codigoMunicipio).padStart(7, "0");

  const tipoInscricao: 1 | 2 = input.cnpj ? 2 : 1;
  const inscricaoFederal = tipoInscricao === 2
    ? onlyDigits(input.cnpj ?? "").padStart(14, "0")
    : onlyDigits(input.cpf ?? "").padStart(14, "0"); // CPF completa com 000 à esquerda até 14 posições

  const serie = String(input.serie).padStart(5, "0");
  const nDPS = String(input.numero).padStart(15, "0");

  return {
    id: `DPS${cLocEmi}${tipoInscricao}${inscricaoFederal}${serie}${nDPS}`,
    tipoInscricao,
    inscricaoFederal,
  };
}
