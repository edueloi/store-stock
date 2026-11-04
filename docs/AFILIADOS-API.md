# Programa de afiliados — contrato da API

Base: `https://store.boxsys.com.br/api` (no código: rotas montadas em `/api/affiliates`, `/api/super-admin` e `/api/external`).
Erros: `{ "error": "mensagem em português" }` com o status HTTP certo. JSON em camelCase nas respostas.

## Quem faz o quê
- **store-stock**: dono dos dados (afiliados, planos, leads, indicações, comissões, metas) e do painel do afiliado.
- **Develoi**: cobra o cliente final no Asaas. Aplica o **split** na assinatura/cobrança e repassa os eventos de pagamento ao store-stock. Tem a aba "Afiliados" (gestão) e recebe o webhook de saída.
- **site (boxsys.com.br)**: página de vendas para afiliados, cadastro, painel e rastreio do link `?ref=CODIGO`.

## Link do afiliado
`https://boxsys.com.br/store-boxsys/?ref=CODIGO` (qualquer página do site aceita `?ref=`). O site guarda o código por 60 dias (localStorage) e registra o clique.
NÃO usar caminhos novos dinâmicos (o nginx do domínio manda o que não for arquivo para o app do Menu BoxSys).

## Comissão por faixa de mês
`rules`: `[{ "from": 1, "to": 1, "type": "percent", "value": 40 }, { "from": 2, "to": 6, "type": "percent", "value": 20 }, { "from": 7, "to": null, "type": "fixed", "value": 10 }]`
- `type`: `percent` (sobre o valor líquido da cobrança, aplicado pelo Asaas) ou `fixed` (reais).
- `to: null` só na última faixa = enquanto o cliente pagar.
- A indicação guarda uma **foto das regras** no dia da venda. O afiliado só vê o cliente enquanto a janela de comissão estiver aberta (`countedMonths < totalMonths`, ou `totalMonths = null`).
- Efetivas por afiliado: `rulesOverride` > plano do afiliado > plano padrão ativo.

## Público (sem login, CORS aberto)
| Método e rota | Corpo | Resposta |
|---|---|---|
| `GET /affiliates/program` | | `{ plan: { name, rules } \| null, windowMonths: number\|null }` (plano padrão ativo, para a página de vendas mostrar os números reais) |
| `GET /affiliates/validate/:code` | | `{ valid: boolean, firstName?: string }` |
| `POST /affiliates/apply` | `{ name, email, whatsapp, password (8 a 72 caracteres), document?, asaasWalletId?, pitch? }` | `201 { ok: true, code, token, affiliate }`: **cadastro aberto, sem aprovação**: o afiliado já nasce `active`, com sessão aberta (`token`). `409` e-mail já cadastrado · `400` dados inválidos |
| `POST /affiliates/auth/login` | `{ email, password }` | `{ token: "<jwt 30d>", affiliate }` · `401` "E-mail ou senha incorretos" (igual para e-mail inexistente) · `403` conta suspensa · limite de 8 tentativas por conta e IP a cada 15 min |
| `POST /affiliates/auth/request` | `{ email }` | `{ ok: true }` (sempre; manda o link mágico por e-mail: é o "esqueci minha senha") |
| `POST /affiliates/auth/verify` | `{ token }` | `{ token: "<jwt 30d>", affiliate }` · `401` inválido/expirado/usado |
| `POST /affiliates/click` | `{ code, landing? }` | `{ ok: true }` |
| `POST /affiliates/lead` | `{ code, name, whatsapp, email?, business?, system?: "store"\|"menu"\|"ambos", message? }` | `201 { ok: true }` |

O link mágico do e-mail aponta para `https://boxsys.com.br/afiliados/entrar/?token=...`. A sessão aberta por ele vale como "recente" por 30 min: nesse período `PATCH /affiliates/me/password` aceita senha nova sem a atual.
No cadastro, o store-stock envia e-mail de boas-vindas; a Develoi, ao receber `affiliate.applied`, envia a boas-vindas por WhatsApp (`AFFILIATE_WELCOME_WHATSAPP=off` desliga).

## Painel do afiliado (`Authorization: Bearer <jwt>`)
`affiliate`: `{ id, code, name, email, whatsapp, document, asaasWalletId, walletStatus, status, planId, planName, pitch, hasPassword, approvedAt, createdAt, lastLoginAt }` — `status`: `pending | active | suspended | rejected`; `walletStatus`: `pending | verified`.

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /affiliates/me` | | `{ affiliate, link, rules, windowMonths }` |
| `PATCH /affiliates/me` | `{ name?, whatsapp?, asaasWalletId?, pitch? }` | `{ affiliate }` |
| `PATCH /affiliates/me/password` | `{ currentPassword?, newPassword }` | `{ ok: true }` · `403` senha atual errada ou ausente (dispensada logo após entrar por link mágico ou se a conta ainda não tem senha) |
| `GET /affiliates/me/dashboard` | | `{ clicks:{total,last30}, leads:{total,byStatus}, sales:{total,activeClients,cancelled}, commissions:{pending,available,paid,total}, conversion, series:[{month:"2026-11",sales,commission}] }` |
| `GET /affiliates/me/leads` | | `{ leads:[{ id, name, whatsapp, email, business, system, message, status, createdAt }] }` (`status`: `new\|contacted\|negotiating\|won\|lost`) |
| `POST /affiliates/me/leads` | `{ name, whatsapp, email?, business?, system?, message? }` | `{ lead }` |
| `PATCH /affiliates/me/leads/:id` | `{ status }` (`new\|contacted\|negotiating\|lost`) | `{ lead }` |
| `GET /affiliates/me/referrals?all=1` | | `{ referrals:[{ id, customerName, status, startedAt, planValue, totalMonths, countedMonths, open, currentRule, nextRule }] }` — sem `all`, só as de janela aberta. `status`: `trial\|active\|overdue\|cancelled` |
| `GET /affiliates/me/commissions?status=` | | `{ commissions:[{ id, referralId, customerName, sequence, status, grossValue, netValue, commissionValue, ruleType, ruleValue, dueDate, paidAt }], totals }` — `status`: `pending\|confirmed\|received\|paid\|refunded\|cancelled\|blocked` |
| `GET /affiliates/me/goals` | | `{ goals:[{ id, title, metric, target, reward, periodStart, periodEnd, createdBy, current, percent }] }` (`metric`: `leads\|sales\|commission`; inclui metas globais criadas pelo admin) |
| `POST /affiliates/me/goals` | `{ title, metric, target, periodStart, periodEnd }` | `{ goal }` |
| `DELETE /affiliates/me/goals/:id` | | `{ ok: true }` (só as dele) |

## Gestão (super admin do store-stock; `Authorization: Bearer <jwt super admin>`; prefixo `/super-admin/affiliates-admin`)
| Rota | Corpo | Resposta |
|---|---|---|
| `GET /overview` | | `{ affiliates:{total,pending,active,suspended}, leads:{total,new}, sales:{total,activeClients}, commissions:{pending,available,paid}, clicks30, webhook:{pending,failed} }` |
| `GET /affiliates?status=&q=` | | `{ affiliates:[{ ...affiliate, stats }] }` (`stats` = o mesmo objeto do dashboard) |
| `POST /affiliates` | `{ name, email, whatsapp, document?, asaasWalletId?, planId? }` | `{ affiliate }` (já ativo) |
| `GET /affiliates/:id` | | `{ affiliate, rules, stats, leads, referrals, commissions }` |
| `PATCH /affiliates/:id` | `{ status?, planId?, rulesOverride?: rules[]\|null, asaasWalletId?, walletStatus?, name?, whatsapp?, adminNotes? }` | `{ affiliate }` — ao virar `active` pela 1ª vez envia e-mail de boas-vindas com link de acesso |
| `GET /plans` · `POST /plans` · `PATCH /plans/:id` · `DELETE /plans/:id` | `{ name, description?, rules, isDefault?, isActive? }` | `{ plans }` / `{ plan }` |
| `GET /leads?status=` · `PATCH /leads/:id` | `{ status?, adminNotes? }` | `{ leads }` / `{ lead }` |
| `GET /referrals` · `POST /referrals` · `PATCH /referrals/:id` | `{ code, customerName, planValue, develoiClientId?, tenantId? }` / `{ status }` | `{ referrals }` / `{ referral }` |
| `GET /commissions?status=&affiliateId=` · `PATCH /commissions/:id` | `{ status }` | `{ commissions, totals }` / `{ commission }` |
| `GET /goals` · `POST /goals` · `DELETE /goals/:id` | `{ affiliateId?: number\|null, title, metric, target, reward?, periodStart, periodEnd }` | `{ goals }` / `{ goal }` |
| `GET /events?pending=1` · `POST /events/:id/retry` | | `{ events }` / `{ ok: true }` (fila do webhook para a Develoi) |

## API externa (Develoi → store-stock; header `x-api-key: <EXTERNAL_API_KEY>`; prefixo `/external/affiliates`)
| Rota | Corpo | Resposta |
|---|---|---|
| `GET /` | | `{ affiliates:[{ ...affiliate, stats }] }` (aba da Develoi) |
| `GET /:id` | | igual ao detalhe da gestão |
| `GET /commissions?status=&affiliateId=` | | `{ commissions, totals }` |
| `GET /resolve/:code` | | `{ valid, affiliateId?, hasWallet?, windowMonths? }` |
| `POST /referrals` | `{ code, develoiClientId, customerName, planValue, asaasSubscriptionId?, tenantId?, leadId? }` | `201 { referralId, split: SplitEntry[]\|null, rules }` — `split` já é o da 1ª mensalidade |
| `GET /referrals/:develoiClientId/split?sequence=n` | | `{ split: SplitEntry[]\|null, rule }` — `null` = fora da janela/sem carteira |
| `POST /events` | `{ event, develoiClientId?, asaasSubscriptionId?, sequence?, payment:{ id, value, netValue?, dueDate?, paymentDate?, split? } }` | `{ ok: true, result }` — `event` = nome do evento do Asaas (`PAYMENT_CREATED`, `PAYMENT_RECEIVED`, `PAYMENT_SPLIT_DONE`, `PAYMENT_REFUNDED`...). Idempotente por `payment.id` |
| `PATCH /referrals/:develoiClientId` | `{ status }` (`active\|overdue\|cancelled`) | `{ ok: true }` |

`SplitEntry` = `{ walletId, percentualValue? , fixedValue? }` — exatamente o formato do array `split` do Asaas.

### Como a Develoi aplica o split (regras do Asaas)
- O split precisa estar habilitado na conta (Integrações > Segurança > Habilitar Split).
- Percentual é sobre o `netValue`; fixo em reais; a soma não pode passar do líquido. Nunca enviar o walletId da própria conta.
- Cobranças já geradas **não** herdam mudança de split. Por isso: (1) `POST /subscriptions` já leva o split da 1ª mensalidade; (2) a cada `PAYMENT_CREATED` de uma assinatura com indicação, a Develoi chama `GET .../split?sequence=n` e faz `PUT /v3/payments/{id}` com o `split` da faixa daquele mês (enquanto pendente); (3) também atualiza o `split` do template da assinatura (`PUT /v3/subscriptions/{id}`) para a próxima faixa.
- Em estorno, o Asaas estorna o split sozinho (evento `PAYMENT_REFUNDED`; status do split `REFUNDED`).

## Webhook de saída (store-stock → Develoi)
`POST $DEVELOI_AFFILIATE_WEBHOOK_URL`, cabeçalhos `X-Boxsys-Event`, `X-Boxsys-Delivery` (id), `X-Boxsys-Signature: sha256=<HMAC-SHA256(AFFILIATE_WEBHOOK_SECRET, corpo bruto)>`. Corpo: `{ "type": "...", "occurredAt": "ISO", "data": { ... } }`. Fila com novas tentativas (1 min, 5 min, 15 min, 1 h, 6 h, 12 h, 24 h).

Eventos: `affiliate.applied`, `affiliate.updated`, `lead.created`, `lead.updated`, `referral.created`, `referral.updated`, `commission.updated`.
- `affiliate.*` → `{ affiliateId, code, name, email, whatsapp, status, walletStatus, planName }`
- `lead.*` → `{ leadId, affiliateId, affiliateCode, name, whatsapp, business, system, status }`
- `referral.*` → `{ referralId, affiliateId, affiliateCode, affiliateName, customerName, develoiClientId, planValue, status? }`
- `commission.updated` → `{ commissionId, referralId, affiliateId, affiliateCode, customerName, sequence, status, grossValue, netValue, commissionValue, asaasPaymentId }`

A Develoi responde `2xx` para confirmar; qualquer outro status gera nova tentativa. A entrega é at-least-once: o receptor deve ser idempotente (`X-Boxsys-Delivery`).
