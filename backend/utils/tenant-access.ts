type TenantAccessInput = {
  status?: string | null;
  trial_ends_at?: Date | string | null;
  platform_subscription?: {
    status: string;
    next_due_date: Date | string | null;
    grace_period_days: number;
  } | null;
};

export function getTenantAccessState(tenant: TenantAccessInput) {
  const status = tenant.status ?? "active";

  if (status === "pending_setup") {
    return { allowed: false, reason: "Convite ainda não foi ativado." };
  }

  if (status === "suspended") {
    const sub = tenant.platform_subscription;
    if (sub && (sub.status === "overdue" || sub.status === "suspended")) {
      return { allowed: false, reason: "Assinatura em atraso. Regularize o pagamento para continuar." };
    }
    return { allowed: false, reason: "Conta suspensa pelo super admin." };
  }

  if (status === "trial" && tenant.trial_ends_at) {
    const trialEndsAt = new Date(tenant.trial_ends_at);

    if (!Number.isNaN(trialEndsAt.getTime()) && trialEndsAt.getTime() < Date.now()) {
      return { allowed: false, reason: "Período de teste expirado." };
    }
  }

  return { allowed: true, reason: "" };
}
