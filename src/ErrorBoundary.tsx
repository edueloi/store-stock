import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Sem isso, qualquer exceção não tratada durante a renderização (ex.: um throw síncrono
// escondido dentro de um useEffect) derruba a árvore React inteira — o usuário vê uma tela
// branca sem nenhuma pista do que aconteceu, e nada chega ao console se o DevTools não
// estiver aberto. Aqui pelo menos aparece uma mensagem, em vez de nada.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] erro não tratado:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100vh", padding: 24, fontFamily: "system-ui, sans-serif", textAlign: "center", gap: 12,
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Algo deu errado</h1>
          <p style={{ fontSize: 13, color: "#64748b", maxWidth: 480 }}>
            {this.state.error.message || "Erro desconhecido."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, height: 36, padding: "0 20px", borderRadius: 8, border: "none",
              background: "#1e293b", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
