// Traduz as rejeições do Sistema Nacional NFS-e para algo que o lojista entenda, mantendo o
// texto original do governo no final (útil para o suporte).

const CAMPOS: Record<string, string> = {
  finNFSe: "finalidade da NFS-e",
  cLocEmi: "código do município emissor",
  cMotivoEmisTI: "motivo de emissão por tomador/intermediário",
  chNFSeRej: "chave da NFS-e rejeitada",
  regApIBSCBSSN: "regime de apuração de IBS/CBS no Simples Nacional",
  cAtvSN: "atividade do Simples Nacional",
  indDest: "indicador de destinatário",
  indFinal: "indicador de consumidor final",
  prest: "dados do prestador",
  toma: "dados do tomador",
  serv: "dados do serviço",
  valores: "valores da nota",
  IBSCBS: "grupo de IBS/CBS (reforma tributária)",
};

const nome = (tag: string) => (CAMPOS[tag] ? `${CAMPOS[tag]} (${tag})` : tag);

export function explicarErroNfse(descricao: unknown, complemento: unknown): string {
  const d = String(descricao ?? "").trim();
  const c = String(complemento ?? "").trim();
  const original = [d, c].filter(Boolean).join(" — ");
  const texto = `${d} ${c}`;

  // Campo enviado fora de lugar / faltando (validação do XSD do governo)
  const invalido = /has invalid child element '([\w]+)'.*?expected: (.*)/i.exec(texto);
  if (invalido) {
    const esperados = invalido[2].replace(/ in namespace.*$/i, "").split(",").map((t) => t.replace(/'/g, "").trim()).filter(Boolean).map(nome).join(" ou ");
    return (
      `O governo atualizou o formato da nota (NT 009 da NFS-e Nacional) e o sistema enviou ${nome(invalido[1])} ` +
      `num ponto em que ele agora espera ${esperados}. Não é erro de preenchimento seu — é um ajuste do sistema. ` +
      `Avise o suporte com esta mensagem.\n\nDetalhe técnico: ${original}`
    );
  }
  const incompleto = /has incomplete content.*?expected: (.*)/i.exec(texto);
  if (incompleto) {
    const faltando = incompleto[1].replace(/ in namespace.*$/i, "").split(",").map((t) => t.replace(/'/g, "").trim()).filter(Boolean).map(nome).join(" ou ");
    return (
      `Faltou enviar um campo obrigatório do novo formato da nota: ${faltando}. ` +
      `É um ajuste do sistema, não do seu cadastro — avise o suporte.\n\nDetalhe técnico: ${original}`
    );
  }
  if (/esquema XML/i.test(texto)) {
    return `A nota foi enviada num formato que o governo não aceitou. É um ajuste do sistema — avise o suporte.\n\nDetalhe técnico: ${original}`;
  }
  return original;
}
