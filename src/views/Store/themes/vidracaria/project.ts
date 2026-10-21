import { useEffect, useState } from "react";
import type { PieceSpec } from "../../../../lib/glassPieces";
export type ProjectPiece = { id: string; key: string; spec: PieceSpec | null; quantity: number; selected_options: Record<string, string> };
type Project = { request_id: string; pieces: ProjectPiece[] };
const memory = new Map<string, Project>();
const empty = (): Project => ({ request_id: crypto.randomUUID(), pieces: [] });
const read = (slug: string): Project => {
  try { const value = JSON.parse(sessionStorage.getItem(`vitra-project:${slug}`) || "null"); if (value && typeof value.request_id === "string" && Array.isArray(value.pieces)) return { ...value, pieces: value.pieces.slice(0, 30) }; } catch { /* Navegação privada: mantém em memória. */ }
  return memory.get(slug) || empty();
};
export function useGlassProject(slug: string) {
  const [project, setProject] = useState(() => read(slug));
  useEffect(() => { setProject(read(slug)); const update = () => setProject(read(slug)); window.addEventListener(`vitra-project:${slug}`, update); return () => window.removeEventListener(`vitra-project:${slug}`, update); }, [slug]);
  const save = (pieces: ProjectPiece[]) => {
    const next = { request_id: crypto.randomUUID(), pieces };
    memory.set(slug, next);
    setProject(next);
    try { sessionStorage.setItem(`vitra-project:${slug}`, JSON.stringify(next)); } catch { /* Sem persistência, mantém o projeto em memória nesta visita. */ }
    window.dispatchEvent(new Event(`vitra-project:${slug}`));
  };
  return { ...project, save, clear: () => save([]) };
}
