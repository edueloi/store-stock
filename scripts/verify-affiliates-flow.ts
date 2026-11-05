// Fluxo completo do programa de afiliados contra as rotas HTTP reais, num banco DE TESTE.
// Uso (o DATABASE_URL precisa apontar para um banco descartável, ex.: boxsys_affiliates_test):
//   DATABASE_URL=... npx tsx scripts/verify-affiliates-flow.ts
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";

import jwt from "jsonwebtoken";

import { createApp } from "../backend/app";
import { env } from "../backend/config/env";
import { prisma } from "../backend/config/prisma";
import { createLoginToken } from "../backend/services/affiliates/auth";

if (!/test/i.test(process.env.DATABASE_URL ?? "")) throw new Error("Recuso rodar: o DATABASE_URL não parece ser de um banco de teste.");
if (!env.externalApiKey) throw new Error("EXTERNAL_API_KEY ausente no ambiente.");

const server = createApp().listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
const adminToken = jwt.sign({ userId: 1, role: "super_admin", superAdmin: true }, env.jwtSecret, { expiresIn: "1h" });

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const admin = (m: string, p: string, b?: unknown) => call(m, `/super-admin/affiliates-admin${p}`, b, { Authorization: `Bearer ${adminToken}` });
const ext = (m: string, p: string, b?: unknown) => call(m, `/external/affiliates${p}`, b, { "x-api-key": env.externalApiKey });
const step = (name: string) => console.log("ok  ", name);

async function main() {
  // limpeza do banco de teste
  for (const t of ["affiliateEvent", "affiliateLoginToken", "affiliateGoal", "affiliateCommission", "affiliateReferral", "affiliateLead", "affiliateClick", "affiliate", "affiliatePlan"] as const) {
    await (prisma[t] as any).deleteMany({});
  }

  // sem plano padrão ainda
  let r = await call("GET", "/affiliates/program");
  assert.equal(r.data.plan, null);
  step("programa sem plano padrão");

  // plano: 1ª mensalidade 40%, meses 2 a 3 20% (janela de 3 meses)
  r = await admin("POST", "/plans", { name: "Padrão", isDefault: true, rules: [{ from: 1, to: 1, type: "percent", value: 40 }, { from: 2, to: 3, type: "percent", value: 20 }] });
  assert.equal(r.status, 201);
  r = await admin("POST", "/plans", { name: "Ruim", rules: [{ from: 2, to: null, type: "percent", value: 20 }] });
  assert.equal(r.status, 400);
  step("planos: cria o válido e recusa o inválido");

  r = await call("GET", "/affiliates/program");
  assert.equal(r.data.windowMonths, 3);
  step("programa mostra o plano padrão");

  // cadastro público e aberto: senha obrigatória, ativo na hora, sessão aberta
  const PASS = "SenhaForte123";
  r = await call("POST", "/affiliates/apply", { name: "Ana Souza", email: "Ana@Exemplo.com", whatsapp: "(15) 99999-1111", password: PASS, asaasWalletId: "48548710-9baa-4ec1-a11f-9010193527c6", pitch: "Instagram" });
  assert.equal(r.status, 201);
  const code: string = r.data.code;
  assert.match(code, /^[A-Z2-9]{6,7}$/);
  assert.equal(r.data.affiliate.status, "active");
  assert.equal(r.data.affiliate.hasPassword, true);
  assert.ok(r.data.token);
  r = await call("GET", "/affiliates/me", undefined, { Authorization: `Bearer ${r.data.token}` });
  assert.equal(r.status, 200); // o token devolvido no cadastro já abre o painel
  r = await call("POST", "/affiliates/apply", { name: "Ana Souza", email: "ana@exemplo.com", whatsapp: "15999991111", password: PASS });
  assert.equal(r.status, 409);
  r = await call("POST", "/affiliates/apply", { name: "Curta Senha", email: "curta@exemplo.com", whatsapp: "15999991111", password: "123" });
  assert.equal(r.status, 400);
  r = await call("POST", "/affiliates/apply", { name: "Sem Senha", email: "sem@exemplo.com", whatsapp: "15999991111" });
  assert.equal(r.status, 400);
  r = await call("POST", "/affiliates/apply", { name: "X", email: "x", whatsapp: "1", password: PASS });
  assert.equal(r.status, 400);
  step("cadastro aberto com senha, e-mail duplicado e validações");

  const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { code } });
  assert.notEqual(affiliate.password_hash, PASS); // nunca guarda a senha pura
  r = await call("GET", `/affiliates/validate/${code.toLowerCase()}`);
  assert.deepEqual(r.data, { valid: true, firstName: "Ana" });
  step("o código vale na hora, sem aprovação");

  // login por e-mail e senha
  r = await call("POST", "/affiliates/auth/login", { email: "ANA@exemplo.com", password: PASS });
  assert.equal(r.status, 200);
  const passwordSession: string = r.data.token;
  r = await call("POST", "/affiliates/auth/login", { email: "ana@exemplo.com", password: "errada-errada" });
  assert.equal(r.status, 401);
  const wrongMsg = r.data.error;
  r = await call("POST", "/affiliates/auth/login", { email: "ninguem@exemplo.com", password: PASS });
  assert.equal(r.status, 401);
  assert.equal(r.data.error, wrongMsg); // mesma resposta: não revela quem é afiliado
  step("login com senha: certo, errado e e-mail inexistente respondem igual");

  // troca de senha: sessão por senha exige a atual
  const withPw = (m: string, p: string, b?: unknown) => call(m, `/affiliates/me${p}`, b, { Authorization: `Bearer ${passwordSession}` });
  r = await withPw("PATCH", "/password", { newPassword: "OutraSenha456" });
  assert.equal(r.status, 403);
  r = await withPw("PATCH", "/password", { currentPassword: "errada", newPassword: "OutraSenha456" });
  assert.equal(r.status, 403);
  r = await withPw("PATCH", "/password", { currentPassword: PASS, newPassword: "curta" });
  assert.equal(r.status, 400);
  r = await withPw("PATCH", "/password", { currentPassword: PASS, newPassword: "OutraSenha456" });
  assert.equal(r.status, 200);
  r = await call("POST", "/affiliates/auth/login", { email: "ana@exemplo.com", password: PASS });
  assert.equal(r.status, 401); // a antiga deixou de valer
  r = await call("POST", "/affiliates/auth/login", { email: "ana@exemplo.com", password: "OutraSenha456" });
  assert.equal(r.status, 200);
  step("troca de senha exige a atual e invalida a antiga");

  // recuperação: o link mágico abre a sessão e deixa definir senha nova sem a atual
  const resetToken = await createLoginToken(affiliate.id);
  r = await call("POST", "/affiliates/auth/verify", { token: resetToken });
  assert.equal(r.status, 200);
  r = await call("PATCH", "/affiliates/me/password", { newPassword: "SenhaRecuperada789" }, { Authorization: `Bearer ${r.data.token}` });
  assert.equal(r.status, 200);
  r = await call("POST", "/affiliates/auth/login", { email: "ana@exemplo.com", password: "SenhaRecuperada789" });
  assert.equal(r.status, 200);
  step("recuperação por link define nova senha sem a atual");

  // rastreio de clique (um por dia por visitante) e lead público
  await call("POST", "/affiliates/click", { code, landing: "/store-boxsys/" });
  await call("POST", "/affiliates/click", { code, landing: "/store-boxsys/" });
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(await prisma.affiliateClick.count({ where: { affiliate_id: affiliate.id } }), 1);
  r = await call("POST", "/affiliates/lead", { code, name: "João da Serralheria", whatsapp: "15988887777", business: "Serralheria do João", system: "store" });
  assert.equal(r.status, 201);
  r = await call("POST", "/affiliates/lead", { code: "ZZZZZZ", name: "Maria", whatsapp: "15988887777" });
  assert.equal(r.status, 201); // código inválido não bloqueia o visitante
  assert.equal(await prisma.affiliateLead.count(), 1);
  step("clique deduplicado, lead criado, código inválido não quebra");

  // login por link mágico
  const token = await createLoginToken(affiliate.id);
  r = await call("POST", "/affiliates/auth/verify", { token });
  assert.equal(r.status, 200);
  const session: string = r.data.token;
  r = await call("POST", "/affiliates/auth/verify", { token });
  assert.equal(r.status, 401);
  r = await call("POST", "/affiliates/auth/verify", { token: "inventado" });
  assert.equal(r.status, 401);
  step("link mágico funciona uma única vez");

  // o token de afiliado NÃO abre rotas de lojista nem de super admin, e vice-versa
  const mine = (m: string, p: string, b?: unknown) => call(m, `/affiliates/me${p}`, b, { Authorization: `Bearer ${session}` });
  r = await call("GET", "/super-admin/overview", undefined, { Authorization: `Bearer ${session}` });
  assert.ok([401, 403].includes(r.status));
  r = await call("GET", "/stats/summary", undefined, { Authorization: `Bearer ${session}` });
  assert.ok([401, 403, 404].includes(r.status));
  r = await call("GET", "/affiliates/me", undefined, { Authorization: `Bearer ${adminToken}` });
  assert.equal(r.status, 401);
  r = await call("GET", "/affiliates/me");
  assert.equal(r.status, 401);
  step("tokens de afiliado e de sistema não se misturam");

  r = await mine("GET", "");
  assert.equal(r.data.link, `${env.affiliateSiteUrl}/store/?ref=${code}`);
  assert.equal(r.data.windowMonths, 3);
  r = await mine("PATCH", "", { asaasWalletId: "invalido" });
  assert.equal(r.status, 400);
  step("painel: perfil e link");

  // API externa exige chave
  r = await call("GET", "/external/affiliates");
  assert.equal(r.status, 401);
  r = await ext("GET", `/resolve/${code}`);
  assert.equal(r.data.valid, true);
  assert.equal(r.data.hasWallet, true);
  step("API externa: chave obrigatória e resolve");

  // Develoi registra a venda (idempotente) e recebe o split da 1ª mensalidade
  r = await ext("POST", "/referrals", { code, develoiClientId: "cli-1", customerName: "Serralheria do João", planValue: 150, asaasSubscriptionId: "sub_1" });
  assert.equal(r.status, 201);
  assert.deepEqual(r.data.split, [{ walletId: "48548710-9baa-4ec1-a11f-9010193527c6", percentualValue: 40 }]);
  const again = await ext("POST", "/referrals", { code, develoiClientId: "cli-1", customerName: "Serralheria do João", planValue: 150 });
  assert.equal(again.data.referralId, r.data.referralId);
  assert.equal(await prisma.affiliateReferral.count(), 1);
  step("indicação idempotente com split da 1ª mensalidade");

  r = await ext("GET", "/referrals/cli-1/split?sequence=2");
  assert.deepEqual(r.data.split, [{ walletId: "48548710-9baa-4ec1-a11f-9010193527c6", percentualValue: 20 }]);
  r = await ext("GET", "/referrals/cli-1/split?sequence=4");
  assert.equal(r.data.split, null);
  step("split muda por faixa e some depois da janela");

  // mudar o plano depois NÃO altera a indicação já feita (foto das regras)
  await admin("PATCH", `/plans/${(await prisma.affiliatePlan.findFirstOrThrow({ where: { name: "Padrão" } })).id}`, { rules: [{ from: 1, to: null, type: "percent", value: 90 }] });
  r = await ext("GET", "/referrals/cli-1/split?sequence=1");
  assert.equal(r.data.split[0].percentualValue, 40);
  step("regras da venda ficam congeladas");

  // eventos do Asaas, três mensalidades, com reenvio e fora de ordem
  const pay = (n: number, extra: Record<string, unknown> = {}) => ({
    id: `pay_${n}`,
    value: 150,
    netValue: 148.01,
    dueDate: `2026-0${n}-10`,
    split: [{ walletId: "48548710-9baa-4ec1-a11f-9010193527c6", percentualValue: n === 1 ? 40 : 20, status: "PENDING" }],
    ...extra,
  });
  const event = (name: string, n: number, extra?: Record<string, unknown>) => ext("POST", "/events", { event: name, develoiClientId: "cli-1", payment: pay(n, extra) });

  r = await event("PAYMENT_CREATED", 1);
  assert.equal(r.data.result.sequence, 1);
  r = await event("PAYMENT_RECEIVED", 1);
  assert.equal(r.data.result.status, "received");
  r = await event("PAYMENT_CONFIRMED", 1); // atrasado: não rebaixa
  assert.equal(r.data.result.status, "received");
  r = await event("PAYMENT_RECEIVED", 1); // reenvio
  assert.equal(await prisma.affiliateCommission.count(), 1);
  let c1 = await prisma.affiliateCommission.findFirstOrThrow({ where: { asaas_payment_id: "pay_1" } });
  assert.equal(Number(c1.commission_value), 59.2); // 40% de 148,01
  step("1ª mensalidade: 40% do líquido, sem duplicar nem rebaixar");

  r = await event("PAYMENT_SPLIT_DONE", 1);
  assert.equal(r.data.result.status, "paid");
  r = await event("PAYMENT_CREATED", 2);
  assert.equal(r.data.result.sequence, 2);
  r = await event("PAYMENT_RECEIVED", 2);
  r = await event("PAYMENT_RECEIVED", 3);
  r = await event("PAYMENT_CREATED", 4); // fora da janela de 3 meses
  assert.equal(r.data.result.ignored, "out_of_window");
  assert.equal(await prisma.affiliateCommission.count(), 3);
  const c2 = await prisma.affiliateCommission.findFirstOrThrow({ where: { asaas_payment_id: "pay_2" } });
  assert.equal(Number(c2.commission_value), 29.6); // 20% de 148,01
  step("meses 2 e 3 a 20%; mês 4 fica fora da janela");

  // painel do afiliado
  r = await mine("GET", "/dashboard");
  assert.equal(r.data.clicks.total, 1);
  assert.equal(r.data.leads.total, 1);
  assert.equal(r.data.sales.total, 1);
  assert.equal(r.data.commissions.paid, 59.2);
  assert.equal(r.data.commissions.available, 59.2); // mês 2 + 3 recebidos (29,6 + 29,6)
  assert.equal(r.data.sales.activeClients, 0); // janela de 3 meses já completa
  step("painel: números batem");

  r = await mine("GET", "/referrals");
  assert.equal(r.data.referrals.length, 0); // janela fechada: o cliente sai da lista
  r = await mine("GET", "/referrals?all=1");
  assert.equal(r.data.referrals.length, 1);
  assert.equal(r.data.referrals[0].countedMonths, 3);
  step("cliente some do painel quando a janela de comissão fecha (e volta com 'ver todos')");

  r = await mine("GET", "/commissions");
  assert.equal(r.data.commissions.length, 3);
  assert.equal(r.data.totals.paid, 59.2);
  step("extrato de comissões");

  // estorno
  r = await event("PAYMENT_REFUNDED", 3);
  assert.equal(r.data.result.status, "refunded");
  r = await event("PAYMENT_RECEIVED", 3); // atrasado não reabre
  assert.equal(r.data.result.status, "refunded");
  step("estorno reverte a comissão e não reabre");

  // metas: do afiliado e global
  r = await mine("POST", "/goals", { title: "5 contatos", metric: "leads", target: 5, periodStart: "2026-01-01", periodEnd: "2026-12-31" });
  assert.equal(r.status, 201);
  const mineGoal = r.data.goal.id;
  r = await admin("POST", "/goals", { affiliateId: null, title: "Meta da equipe: 3 vendas", metric: "sales", target: 3, reward: "Bônus", periodStart: "2026-01-01", periodEnd: "2026-12-31" });
  assert.equal(r.status, 201);
  r = await mine("GET", "/goals");
  assert.equal(r.data.goals.length, 2);
  assert.equal(r.data.goals.find((g: any) => g.metric === "sales").current, 1);
  assert.equal(r.data.goals.find((g: any) => g.metric === "leads").percent, 20);
  r = await mine("DELETE", `/goals/${r.data.goals.find((g: any) => g.createdBy === "admin").id}`);
  assert.equal(r.status, 404); // meta da equipe não se apaga
  r = await mine("DELETE", `/goals/${mineGoal}`);
  assert.equal(r.status, 200);
  step("metas: progresso, global da equipe protegida");

  // um afiliado não enxerga o lead de outro
  r = await call("POST", "/affiliates/apply", { name: "Bruno Lima", email: "bruno@exemplo.com", whatsapp: "15977776666", password: "SenhaDoBruno1" });
  const other = await prisma.affiliate.findUniqueOrThrow({ where: { code: r.data.code } });
  const otherToken = signAs(other.id);
  r = await call("GET", "/affiliates/me/leads", undefined, { Authorization: `Bearer ${otherToken}` });
  assert.equal(r.data.leads.length, 0);
  const leadId = (await prisma.affiliateLead.findFirstOrThrow()).id;
  r = await call("PATCH", `/affiliates/me/leads/${leadId}`, { status: "contacted" }, { Authorization: `Bearer ${otherToken}` });
  assert.equal(r.status, 404);
  step("isolamento entre afiliados");

  // gestão
  r = await admin("GET", "/overview");
  assert.equal(r.data.affiliates.total, 2);
  assert.equal(r.data.affiliates.active, 2);
  assert.equal(r.data.affiliates.pending, 0);
  r = await admin("GET", `/affiliates/${affiliate.id}`);
  assert.equal(r.data.referrals.length, 1);
  assert.equal(r.data.commissions.length, 3);
  r = await ext("GET", "/");
  assert.equal(r.data.affiliates.length, 2);
  step("gestão e API externa listam os mesmos números");

  // a equipe só entra para suspender abuso
  r = await admin("PATCH", `/affiliates/${other.id}`, { status: "suspended" });
  assert.equal(r.status, 200);
  r = await call("POST", "/affiliates/auth/login", { email: "bruno@exemplo.com", password: "SenhaDoBruno1" });
  assert.equal(r.status, 403);
  r = await call("GET", `/affiliates/validate/${other.code}`);
  assert.equal(r.data.valid, false);
  r = await call("GET", "/affiliates/me", undefined, { Authorization: `Bearer ${otherToken}` });
  assert.equal(r.status, 403);
  step("suspender bloqueia login, sessão aberta e o código");

  // fila de webhook: eventos gravados na ordem certa
  const types = (await prisma.affiliateEvent.findMany({ orderBy: { id: "asc" } })).map((e) => e.type);
  for (const t of ["affiliate.applied", "affiliate.updated", "lead.created", "referral.created", "commission.updated"]) assert.ok(types.includes(t), `faltou o evento ${t}`);
  r = await admin("GET", "/events?pending=1");
  assert.ok(r.data.events.length > 0);
  step("fila de eventos para a Develoi registrada");

  // ── links nomeados, campanhas e conta criada pela página do Store ──
  await prisma.affiliate.updateMany({ where: { code }, data: { status: "active" } }); // o passo anterior suspendeu este afiliado
  r = await mine("GET", "/links");
  assert.equal(r.data.links.length, 1);
  assert.equal(r.data.links[0].publicId, code);
  assert.equal(r.data.links[0].url, `${env.affiliateSiteUrl}/store/?ref=${code}`);
  r = await mine("POST", "/links", { name: "Instagram Bio" });
  assert.equal(r.status, 201);
  assert.equal(r.data.link.campaign, "instagram-bio");
  assert.equal(r.data.link.publicId, `${code}-01`);
  const linkId = r.data.link.id;
  r = await mine("POST", "/links", { name: "Instagram Bio" });
  assert.equal(r.data.link.campaign, "instagram-bio-2");
  await call("POST", "/affiliates/click", { code, campaign: "Instagram Bio!" });
  r = await mine("GET", "/links");
  assert.equal(r.data.links.find((l: any) => l.campaign === "instagram-bio").clicks, 1);
  step("links nomeados: ID legível, campanha única e cliques por link");

  const signup = (b: Record<string, unknown>) => call("POST", "/store-signup", b);
  const form = { storeName: "Serralheria Teste Link", ownerName: "João da Silva", email: "joao.link@example.com", whatsapp: "15999990000", document: "12345678901", password: "SenhaForte123", ref: code, campaign: "instagram-bio" };
  r = await signup({ ...form, password: "123" });
  assert.equal(r.status, 400);
  r = await signup({ ...form, document: "123" });
  assert.equal(r.status, 400);
  r = await signup(form);
  assert.equal(r.status, 201);
  assert.equal(r.data.trialDays, 14);
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { name: "Serralheria Teste Link" } });
  assert.equal(tenant.status, "active");
  assert.equal(Number(tenant.subscription_amount), 150);
  assert.equal(await prisma.user.count({ where: { tenant_id: tenant.id, email: "joao.link@example.com" } }), 1);
  r = await signup(form);
  assert.equal(r.status, 409);
  const lead = await prisma.affiliateLead.findFirstOrThrow({ where: { tenant_id: tenant.id } });
  assert.equal(lead.status, "trial");
  assert.equal(lead.origin, "store-signup");
  assert.equal(lead.campaign, "instagram-bio");
  assert.ok(await prisma.affiliateEvent.findFirst({ where: { type: "store.signup.created" } }), "evento store.signup.created na fila");
  r = await mine("GET", "/links");
  assert.equal(r.data.links.find((l: any) => l.campaign === "instagram-bio").trials, 1);
  r = await mine("GET", "/dashboard");
  assert.equal(r.data.sales.trials, 1);
  // código inválido: a conta nasce igual, só que sem contato de afiliado
  r = await signup({ ...form, storeName: "Loja Sem Afiliado", email: "sem.ref@example.com", ref: "NAOEXISTE" });
  assert.equal(r.status, 201);
  assert.equal(await prisma.affiliateLead.count({ where: { tenant_id: { not: null } } }), 1);
  r = await mine("DELETE", `/links/${linkId}`);
  assert.equal(r.data.ok, true);
  step("criação de conta pela página: loja em teste, contato 'trial', evento e métricas");

  console.log("\nFluxo completo de afiliados OK.");
}

function signAs(id: number) {
  // mesmo segredo derivado que o painel usa (apenas para o teste)
  const secret = crypto.createHmac("sha256", env.jwtSecret).update("affiliate-portal").digest("hex");
  return jwt.sign({ affiliateId: id, kind: "affiliate" }, secret, { expiresIn: "1h" });
}

main()
  .catch((error) => {
    console.error("\nFALHOU:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    server.close();
    await prisma.$disconnect();
  });
