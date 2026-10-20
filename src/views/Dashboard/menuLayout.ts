import type { ComponentType } from "react";

/**
 * Item do menu lateral. `path` é o identificador único e, nos itens normais, também a rota.
 * Itens de ação usam "action:<nome>" e atalhos do usuário usam "custom:<id>" (destino em `href`).
 */
export type MenuItemDef = {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  path: string;
  key: string;
  /** Ação em vez de navegação (ex.: abrir o tour guiado). */
  action?: "tour";
  /** Destino de um atalho criado pelo usuário (rota /admin/... ou link externo). */
  href?: string;
};

export type MenuGroupDef = { id: string; label: string; items: MenuItemDef[] };

export type CustomMenuItem = { id: string; label: string; url: string };

/** Layout salvo por usuário (preferência `menu_layout`). Só organiza o que o usuário já pode ver. */
export type MenuLayout = {
  version: 1;
  groups: { id: string; label: string; items: string[] }[];
  hidden: string[];
  customItems: CustomMenuItem[];
};

export const MENU_LAYOUT_PREF_KEY = "menu_layout";
export const HIDDEN_GROUP_ID = "__hidden";

/** Itens que nunca podem ser ocultados (evita o usuário ficar sem acesso às configurações). */
export const PROTECTED_PATHS = ["/admin/settings"];

export const isInternalUrl = (url: string) => url.startsWith("/");
export const customPath = (id: string) => `custom:${id}`;
export const newId = () => Math.random().toString(36).slice(2, 9);

export function isValidLayout(value: unknown): value is MenuLayout {
  const v = value as MenuLayout | null;
  return !!v && v.version === 1 && Array.isArray(v.groups) && Array.isArray(v.hidden) && Array.isArray(v.customItems);
}

export type ResolvedMenu = { groups: MenuGroupDef[]; hidden: MenuItemDef[] };

/**
 * Aplica o layout do usuário sobre os grupos já filtrados por permissão.
 * - Só itens permitidos aparecem: o layout nunca concede acesso.
 * - Itens novos do sistema que o layout desconhece voltam ao grupo de origem.
 * - `keepEmpty` mantém grupos vazios (usado no editor).
 */
export function resolveMenu(
  baseGroups: MenuGroupDef[],
  layout: MenuLayout | null,
  linkIcon: MenuItemDef["icon"],
  keepEmpty = false,
): ResolvedMenu {
  if (!layout) return { groups: baseGroups.filter((g) => keepEmpty || g.items.length > 0), hidden: [] };

  const available = new Map<string, MenuItemDef>();
  const origin = new Map<string, MenuGroupDef>();
  baseGroups.forEach((group) =>
    group.items.forEach((item) => {
      available.set(item.path, item);
      origin.set(item.path, group);
    }),
  );
  layout.customItems.forEach((custom) =>
    available.set(customPath(custom.id), { icon: linkIcon, label: custom.label, path: customPath(custom.id), key: "custom", href: custom.url }),
  );

  const hiddenIds = new Set(layout.hidden.filter((id) => !PROTECTED_PATHS.includes(id) && available.has(id)));
  const placed = new Set<string>();
  const groups: MenuGroupDef[] = layout.groups.map((group) => {
    const items: MenuItemDef[] = [];
    group.items.forEach((id) => {
      const item = available.get(id);
      if (!item || placed.has(id) || hiddenIds.has(id)) return;
      placed.add(id);
      items.push(item);
    });
    return { id: group.id, label: group.label, items };
  });

  available.forEach((item, id) => {
    if (placed.has(id) || hiddenIds.has(id)) return;
    const from = origin.get(id);
    let target = groups.find((g) => g.id === from?.id);
    if (!target) {
      target = { id: from?.id || "outros", label: from?.label || "Outros", items: [] };
      groups.push(target);
    }
    target.items.push(item);
    placed.add(id);
  });

  const hidden = [...hiddenIds].map((id) => available.get(id)!);
  return { groups: groups.filter((g) => keepEmpty || g.items.length > 0), hidden };
}

/** Converte o estado do editor para o formato salvo. */
export function toLayout(resolved: ResolvedMenu, customItems: CustomMenuItem[]): MenuLayout {
  return {
    version: 1,
    groups: resolved.groups.map((g) => ({ id: g.id, label: g.label, items: g.items.map((i) => i.path) })),
    hidden: resolved.hidden.map((i) => i.path),
    customItems: customItems.filter((c) => resolved.groups.some((g) => g.items.some((i) => i.path === customPath(c.id))) || resolved.hidden.some((i) => i.path === customPath(c.id))),
  };
}

// ── Perfis de menu ──────────────────────────────────────────────────────────
// O perfil "Padrão" é do sistema: nunca é salvo, editado nem removido. O usuário cria quantos
// perfis quiser (cada um com seu layout) e escolhe qual usar.

export const DEFAULT_PROFILE_ID = "default";
export const MENU_PROFILES_PREF_KEY = "menu_profiles";

export type MenuProfile = { id: string; name: string; layout: MenuLayout };
export type MenuProfiles = { version: 2; activeId: string; profiles: MenuProfile[] };

export const emptyProfiles = (): MenuProfiles => ({ version: 2, activeId: DEFAULT_PROFILE_ID, profiles: [] });

export function isValidProfiles(value: unknown): value is MenuProfiles {
  const v = value as MenuProfiles | null;
  return !!v && v.version === 2 && typeof v.activeId === "string" && Array.isArray(v.profiles) && v.profiles.every((p) => p && typeof p.id === "string" && isValidLayout(p.layout));
}

/** Aproveita o layout único salvo antes dos perfis existirem (preferência `menu_layout`). */
export function profilesFromLegacy(layout: MenuLayout): MenuProfiles {
  return { version: 2, activeId: "legacy", profiles: [{ id: "legacy", name: "Meu menu", layout }] };
}

/** Layout em uso (null = padrão do sistema). */
export function activeLayout(store: MenuProfiles): MenuLayout | null {
  return store.profiles.find((p) => p.id === store.activeId)?.layout ?? null;
}
