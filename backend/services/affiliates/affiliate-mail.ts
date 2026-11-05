import { env } from "../../config/env";
import { escapeHtml } from "../../utils/html-escape";
import { baseTemplate, sendPlatformEmail } from "../mailer.service";
import { describeRule, type CommissionRule } from "./rules";

const button = (url: string, label: string) => `
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 28px;">
    <a href="${url}" style="display:inline-block;background:#2a7fd6;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">${label}</a>
  </td></tr></table>`;

const loginUrl = (token: string) => `${env.affiliateAppUrl}/entrar?token=${encodeURIComponent(token)}`;

export async function sendAffiliateLoginEmail(to: string, name: string, token: string) {
  const url = loginUrl(token);
  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#0f172a;">Seu acesso ao painel de afiliados</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">Olá, ${escapeHtml(name)}! Clique no botão para entrar. O link vale por 20 minutos e só funciona uma vez.</p>
    ${button(url, "Entrar no painel")}
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">Se não foi você quem pediu, ignore este e-mail.</p>`;
  await sendPlatformEmail({ to, subject: "Seu link de acesso ao painel de afiliados BoxSys", html: baseTemplate(content) });
}

export async function sendAffiliateApprovedEmail(to: string, name: string, code: string, rules: CommissionRule[], token: string) {
  const link = `${env.affiliateSiteUrl}/store/?ref=${code}`;
  const rulesHtml = rules.length
    ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#475569;line-height:1.7;">${rules.map((r) => `<li>${escapeHtml(describeRule(r))}</li>`).join("")}</ul>`
    : "";
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#10b981;">Cadastro aprovado</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#0f172a;">Bem-vindo ao programa de afiliados, ${escapeHtml(name)}!</h1>
    <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6;">Seu código é <strong>${escapeHtml(code)}</strong> e este é o seu link de indicação:</p>
    <p style="margin:0 0 16px;font-size:14px;word-break:break-all;"><a href="${link}" style="color:#2a7fd6;">${link}</a></p>
    ${rulesHtml ? `<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a;">Sua comissão</p>${rulesHtml}` : ""}
    ${button(loginUrl(token), "Abrir meu painel")}
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">O link do botão vale por 20 minutos. Depois, é só pedir um novo em ${env.affiliateAppUrl}/entrar.</p>`;
  await sendPlatformEmail({ to, subject: "Seu cadastro de afiliado BoxSys foi aprovado", html: baseTemplate(content) });
}

/** Boas-vindas logo depois do cadastro aberto (sem aprovação): agradece, entrega código e link e explica o começo. */
export async function sendAffiliateWelcomeEmail(to: string, name: string, code: string, rules: CommissionRule[]) {
  const first = escapeHtml(name.split(/\s+/)[0]);
  const link = `${env.affiliateSiteUrl}/store/?ref=${code}`;
  const panel = `${env.affiliateAppUrl}/`;
  const rulesHtml = rules.length
    ? `<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a;">Como você é remunerado</p>
       <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#475569;line-height:1.7;">${rules.map((r) => `<li>${escapeHtml(describeRule(r))}</li>`).join("")}</ul>`
    : "";
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#10b981;">Cadastro concluído</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#0f172a;line-height:1.2;">Bem-vindo(a) ao time de afiliados BoxSys, ${first}!</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">Obrigado por fazer parte dessa história! A cada empresa que você ajuda a organizar com o Store BoxSys, a gente cresce junto, e você ganha por isso. Seu acesso já está liberado.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;background:#f8fafc;border-radius:12px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;">Seu código</p>
        <p style="margin:0 0 14px;font-size:22px;font-weight:900;letter-spacing:2px;color:#0f172a;">${escapeHtml(code)}</p>
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;">Seu link de indicação</p>
        <p style="margin:0;font-size:14px;word-break:break-all;"><a href="${link}" style="color:#2a7fd6;">${link}</a></p>
      </td></tr>
    </table>
    ${rulesHtml}
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a;">Para começar</p>
    <ol style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#475569;line-height:1.7;">
      <li>Compartilhe o seu link com quem tem loja, oficina ou presta serviço.</li>
      <li>Acompanhe cliques, contatos e clientes no seu painel.</li>
      <li>Ative a sua <strong>conta de recebimento</strong>, para a comissão cair direto na sua conta: responda este e-mail ou chame a equipe no WhatsApp, que a gente te ajuda (é rápido e sem custo).</li>
      <li>Quer o <strong>material de divulgação</strong> e o <strong>treinamento</strong>? É só responder este e-mail que a gente envia.</li>
    </ol>
    ${button(panel, "Abrir meu painel")}
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Qualquer dúvida é só responder este e-mail ou chamar a gente no WhatsApp. Estamos juntos!</p>`;
  await sendPlatformEmail({ to, subject: "Bem-vindo(a) ao programa de afiliados BoxSys! 🎉", html: baseTemplate(content) });
}
