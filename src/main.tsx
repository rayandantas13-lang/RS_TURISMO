import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

/** Evita tela branca silenciosa se algo quebrar na inicialização. */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { erro: Error | null }
> {
  state: { erro: Error | null } = { erro: null };

  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }

  render() {
    if (this.state.erro) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#f1f5f9",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 8px 30px rgba(15,23,42,.08)",
              border: "1px solid #e2e8f0",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>
              Não foi possível carregar o painel
            </h1>
            <p style={{ margin: "12px 0 0", fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
              {this.state.erro.message || "Erro inesperado."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                width: "100%",
                border: 0,
                borderRadius: 10,
                padding: "10px 14px",
                background: "#0369a1",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML =
    '<p style="font-family:system-ui;padding:2rem">Elemento #root não encontrado.</p>';
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
