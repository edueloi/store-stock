export interface RemotePrintTerminal {
  id: number;
  name: string;
  printers: Array<{ id: number; label: string; role: string; is_default: boolean }>;
}

export async function fetchRemotePrintTerminals(token: string): Promise<RemotePrintTerminal[]> {
  const res = await fetch("/api/desktop-terminals", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Falha ao listar terminais");
  return res.json();
}

export async function requestRemotePrint(
  token: string,
  terminalId: number,
  role: "receipt" | "service_order",
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/print/remote", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ terminal_id: terminalId, role, text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "Falha ao pedir impressão remota" };
  return { ok: true };
}
