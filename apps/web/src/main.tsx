import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Component } from "react";
import type { ReactNode } from "react";
import App from "./app/App.tsx";
import "./styles/global.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal-error">
        <h1>Halaman tidak dapat dimuat</h1>
        <p>Data tersimpan tidak dihapus. Muat ulang untuk mencoba kembali.</p>
        <button onClick={() => location.reload()}>Muat ulang</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
