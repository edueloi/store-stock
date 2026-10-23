// Mantém o banco local (SQLite) do terminal sempre abastecido para vender 100% offline:
// em segundo plano, com a credencial do terminal (sem usuário logado), baixa do servidor o
// pacote leve de produtos (sem fotos), vendedores, clientes e configurações da loja, e
// repete a cada poucos minutos. O PDV lê tudo isso do banco local; a internet só é
// necessária para atualizar o pacote e para sincronizar as vendas feitas offline.

const INTERVAL_MS = 5 * 60 * 1000;

function start({ fetchSnapshot, saveCache, log }) {
  let running = false;

  async function run() {
    if (running) return { ok: false, error: "Sincronização já em andamento." };
    running = true;
    try {
      const snap = await fetchSnapshot();
      saveCache("products", snap.products || []);
      saveCache("tenant", snap.tenant || null);
      saveCache("sellers", snap.sellers || []);
      saveCache("customers", snap.customers || []);
      const meta = {
        at: new Date().toISOString(),
        serverAt: snap.generated_at,
        products: (snap.products || []).length,
        customers: (snap.customers || []).length,
      };
      saveCache("snapshot_meta", meta);
      log?.info?.(`[offline-sync] pacote atualizado: ${meta.products} produtos, ${meta.customers} clientes`);
      return { ok: true, ...meta };
    } catch (err) {
      log?.warn?.(`[offline-sync] falha ao baixar o pacote: ${err?.message || err}`);
      return { ok: false, error: err?.message || String(err) };
    } finally {
      running = false;
    }
  }

  // um pouco depois da abertura (não disputa banda com o carregamento da tela) e depois periodicamente
  setTimeout(run, 8000);
  setInterval(run, INTERVAL_MS);
  return { syncNow: run };
}

module.exports = { start };
