import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure,
  auth: {
    user: env.smtpUser,
    pass: env.smtpPass,
  },
});

function baseTemplate(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>BoxSys Store</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
                Box<span style="color:#f59e0b;">Sys</span>
              </p>
              <p style="margin:6px 0 0;font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#64748b;">
                Store · Sistema de Gestão para Lojas
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px;">
              ${content}
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 24px;"/>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                Este e-mail foi enviado automaticamente pela BoxSys.<br/>
                Dúvidas? Fale conosco: <a href="mailto:contato@boxsys.com.br" style="color:#3b82f6;text-decoration:none;">contato@boxsys.com.br</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#f59e0b;">
      Redefinição de Senha
    </p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#0f172a;line-height:1.2;">
      Oi, ${name}! Recebemos seu pedido.
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong>1 hora</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 28px;">
          <a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.5px;">
            Redefinir Senha →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
      Se não foi você, ignore este e-mail. Sua senha permanece a mesma.
    </p>`;

  await transporter.sendMail({
    from: `"BoxSys Store" <${env.smtpUser}>`,
    to,
    subject: "Redefinição de senha · BoxSys Store",
    html: baseTemplate(content),
  });
}

export async function sendWelcomeEmail(to: string, name: string, storeName: string, accessUrl: string) {
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#10b981;">
      Conta Ativada
    </p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#0f172a;line-height:1.2;">
      Bem-vindo à BoxSys, ${name}! 🎉
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      Sua loja <strong>${storeName}</strong> está pronta. Agora você tem acesso completo ao painel de gestão para gerenciar produtos, estoque, vendas e muito mais.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;background:#f8fafc;border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;">Sua loja</p>
          <p style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">${storeName}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#3b82f6;">${accessUrl}</p>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 28px;">
          <a href="${accessUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.5px;">
            Acessar Minha Loja →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
      Ficou com dúvida? Nossa equipe está disponível para te ajudar.
    </p>`;

  await transporter.sendMail({
    from: `"BoxSys Store" <${env.smtpUser}>`,
    to,
    subject: `Bem-vindo à BoxSys, ${name}! Sua loja está pronta 🎉`,
    html: baseTemplate(content),
  });
}
