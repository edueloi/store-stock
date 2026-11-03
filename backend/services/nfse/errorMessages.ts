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

const TENTE_DEPOIS = "Aguarde alguns minutos e clique em Reemitir — o sistema confere antes se a nota já foi autorizada.";

// Falhas de rede/infra (sem resposta de negócio do governo) → mensagem para o lojista.
// Devolve null quando não reconhece, para o chamador manter o texto original.
export function explicarFalhaComunicacao(error: unknown, statusCode?: number): string | null {
  const t = String(error ?? "");
  const detalhe = t ? `

Detalhe técnico: ${t}` : "";
  if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(t)) {
    return `O Sistema Nacional NFS-e (governo) demorou demais para responder e a nota não foi confirmada. ${TENTE_DEPOIS}${detalhe}`;
  }
  if (/ECONNRESET|ECONNREFUSED|EPIPE|socket hang up|EAI_AGAIN|ENOTFOUND|ECONNABORTED/i.test(t)) {
    return `Não foi possível conectar ao Sistema Nacional NFS-e (governo) — o serviço deles está fora do ar ou instável no momento. Não é problema no seu cadastro nem no certificado. ${TENTE_DEPOIS}${detalhe}`;
  }
  if (statusCode && statusCode >= 500) {
    return `O Sistema Nacional NFS-e (governo) está com instabilidade (erro ${statusCode} do lado deles). ${TENTE_DEPOIS}`;
  }
  if (/Certificado inválido|Unsupported PKCS12|mac verify failure|Invalid password/i.test(t)) {
    return `Não foi possível abrir o certificado digital. Confira se a senha do certificado está correta em Configurações > Dados Fiscais, ou envie o certificado novamente.${detalhe}`;
  }
  if (/certificate has expired|CERT_HAS_EXPIRED|expirad/i.test(t)) {
    return `O certificado digital da empresa está vencido. Renove o certificado A1 e envie o novo em Configurações > Dados Fiscais.${detalhe}`;
  }
  return null;
}

export function explicarErroNfse(descricao: unknown, complemento: unknown): string {
  const d = String(descricao ?? "").trim();
  const c = String(complemento ?? "").trim();
  const original = [d, c].filter(Boolean).join(" — ");
  const texto = `${d} ${c}`;

  if (/sem identificação do tomador.*cancelad/i.test(texto)) {
    return (
      "Esta nota foi emitida sem identificar o cliente (CPF/CNPJ do tomador) e a prefeitura deste município não permite cancelar nota assim. " +
      "Se for nota de teste, use o botão Excluir. Em notas reais, informe sempre o CPF/CNPJ do cliente ao emitir.\n\nDetalhe técnico: " + original
    );
  }

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
  if (/E0718|assinatura.*(inv[aá]lida|n[aã]o confere)|certificado.*n[aã]o corresponde/i.test(texto)) {
    return `A assinatura da nota não bateu com o certificado da empresa. Confira se o certificado enviado é o e-CNPJ do mesmo CNPJ cadastrado em Configurações > Dados Fiscais.

Detalhe técnico: ${original}`;
  }
  if (/E0008|posterior/i.test(texto)) {
    return `O governo recusou a data/hora de emissão da nota (relógio fora de sincronia). Clique em Reemitir; se repetir, avise o suporte.

Detalhe técnico: ${original}`;
  }
  if (/duplicidade|j[aá] existe|E0014/i.test(texto)) {
    return `O governo informa que esta nota já foi enviada. Ela pode já estar autorizada — atualize a tela; se não aparecer, avise o suporte com a mensagem abaixo.

Detalhe técnico: ${original}`;
  }
  if (/esquema XML/i.test(texto)) {
    return `A nota foi enviada num formato que o governo não aceitou. É um ajuste do sistema — avise o suporte.\n\nDetalhe técnico: ${original}`;
  }
  return original;
}
