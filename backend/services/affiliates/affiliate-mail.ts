import { env } from "../../config/env";
import { escapeHtml } from "../../utils/html-escape";
import { baseTemplate, sendPlatformEmail } from "../mailer.service";
import { describeRule, type CommissionRule } from "./rules";

const button = (url: string, label: string) => `
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 28px;">
    <a href="${url}" style="display:inline-block;background:#2a7fd6;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">${label}</a>
  </td></tr></table>`;

const loginUrl = (token: string) => `${env.affiliateSiteUrl}/afiliados/entrar/?token=${encodeURIComponent(token)}`;

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
  const link = `${env.affiliateSiteUrl}/store-boxsys/?ref=${code}`;
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
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">O link do botão vale por 20 minutos. Depois, é só pedir um novo em ${env.affiliateSiteUrl}/afiliados/entrar/.</p>`;
  await sendPlatformEmail({ to, subject: "Seu cadastro de afiliado BoxSys foi aprovado", html: baseTemplate(content) });
}
