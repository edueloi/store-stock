// Baixa um arquivo protegido por login (DANFE, cupom, XML...). Um <a href="/api/..."> aberto direto não envia o token e o servidor
// responde "Unauthorized"; aqui o arquivo é buscado com o header Authorization e salvo/aberto a partir do blob.
// No app desktop o download é salvo direto em Downloads e o PDF abre no leitor padrão (ver main.cjs); no navegador, baixa normalmente.
export async function downloadAuthenticatedFile(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let message = "Não foi possível baixar o arquivo.";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* resposta sem corpo JSON */ }
    throw new Error(message);
  }
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
