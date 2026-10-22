import { escapeHtml } from "../utils/html-escape";

/** Conteúdo compartilhado entre a versão HTML e a alternativa em texto do e-mail. */
export function passwordResetEmail(name: string, resetUrl: string) {
  const recipient = name.trim() || "tudo bem";
  const subject = "Redefinição de senha - Store BoxSys";
  const safeName = escapeHtml(recipient);
  const safeUrl = escapeHtml(resetUrl);
  const text = [
    `Olá, ${recipient}.`, "",
    "Recebemos uma solicitação para redefinir a senha da sua conta no Store BoxSys.",
    "Para criar uma nova senha, acesse o link abaixo:", "", resetUrl, "",
    "Este link é válido por 1 hora e pode ser usado uma única vez.", "",
    "Se você não solicitou a redefinição, pode ignorar esta mensagem. Sua senha continua a mesma.", "",
    "Atenciosamente,", "Equipe Store BoxSys",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#26384b;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Crie uma nova senha para acessar sua conta no Store BoxSys. O link é válido por 1 hora.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e1e7ef;border-radius:14px;">
      <tr><td style="padding:28px 28px 24px;border-bottom:1px solid #edf0f4;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="54" style="vertical-align:middle;"><img src="cid:store-boxsys-logo" width="40" height="40" alt="Store BoxSys" style="display:block;border:0;"></td><td style="vertical-align:middle;"><p style="margin:0;font-size:21px;font-weight:700;letter-spacing:-.5px;color:#297ed1;"><span style="color:#e97b11;">Store</span> BoxSys</p><p style="margin:5px 0 0;color:#7d8b99;font-size:11px;">Gestão para o seu negócio</p></td></tr></table>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="font-size:23px;line-height:1.35;letter-spacing:-.5px;color:#182b3f;margin:0 0 24px;font-weight:700;">Redefinição de senha</h1>
        <p style="font-size:14px;line-height:1.8;margin:0 0 16px;">Olá, ${safeName}.</p>
        <p style="font-size:14px;line-height:1.8;margin:0 0 16px;">Recebemos uma solicitação para redefinir a senha da sua conta no Store BoxSys.</p>
        <p style="font-size:14px;line-height:1.8;margin:0 0 22px;">Para escolher uma nova senha, clique no botão abaixo.</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#297ed1" style="border-radius:8px;text-align:center;"><a href="${safeUrl}" style="display:inline-block;padding:15px 25px;color:#fff;font-size:14px;font-weight:700;line-height:1.2;text-decoration:none;border:1px solid #297ed1;border-radius:8px;">Redefinir minha senha</a></td></tr></table>
        <p style="font-size:12px;line-height:1.7;margin:15px 0 24px;color:#738398;">Este link é válido por <strong>1 hora</strong> e pode ser usado uma única vez.</p>
        <p style="font-size:13px;line-height:1.8;margin:0 0 24px;color:#64748b;">Se você não solicitou a redefinição, pode ignorar esta mensagem. Sua senha continua a mesma.</p>
        <p style="font-size:14px;line-height:1.8;margin:0 0 26px;">Atenciosamente,<br><strong>Equipe Store BoxSys</strong></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-top:1px solid #edf0f4;"><tr><td style="padding-top:20px;"><p style="font-size:11px;line-height:1.8;margin:0 0 8px;color:#7d8b99;">Se o botão não abrir, copie e cole este endereço no navegador:</p><p style="font-size:11px;line-height:1.8;margin:0;word-break:break-all;overflow-wrap:anywhere;"><a href="${safeUrl}" style="color:#297ed1;text-decoration:underline;word-break:break-all;">${safeUrl}</a></p></td></tr></table>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;color:#8a97a6;font-size:11px;line-height:1.6;">Mensagem automática do Store BoxSys.</p>
  </td></tr></table>
</body></html>`;
  return { subject, text, html };
}
