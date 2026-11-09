import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { applyCommand, maySeeTransaction, permitted } from "../lib/domain.ts";
import type { Command, State, User } from "../lib/domain.ts";
import { seedState } from "../lib/seed.ts";

const KEY = "garasi-hobby-demo-v1";
function readData(): { state: State; error: string } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { state: seedState(), error: "" };
    const state = JSON.parse(raw);
    if (
      state.version !== 1 ||
      ![
        "users",
        "customers",
        "vehicles",
        "items",
        "workOrders",
        "transactions",
        "movements",
        "audit",
        "suppliers",
        "receipts",
        "refunds",
        "services",
        "mechanics",
        "categories",
        "units",
      ].every((k) => Array.isArray(state[k])) ||
      !state.settings ||
      !Number.isInteger(state.revision)
    )
      throw new Error("Format data tidak dikenali.");
    return { state, error: "" };
  } catch {
    return {
      state: seedState(),
      error:
        "Data demo tersimpan tidak dapat dibaca. Salinan lama tidak ditimpa. Unduh cadangan atau reset demo melalui Pengaturan.",
    };
  }
}
type Store = {
  state: State;
  user: User | null;
  run: (c: Command) => State;
  login: (name: string) => void;
  logout: () => void;
  reset: () => void;
  message: string;
  notify: (s: string) => void;
  storageError: string;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(readData);
  const [state, setState] = useState(initial.state);
  const current = useRef(state);
  current.current = state;
  const [userId, setUserId] = useState(
    () => sessionStorage.getItem("gh-demo-user") || "",
  );
  const [message, notify] = useState("");
  const [storageError, setStorageError] = useState(initial.error);
  const user = state.users.find((u) => u.id === userId && u.active) || null;
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => notify(""), 6000);
    return () => clearTimeout(timeout);
  }, [message]);
  const logout = () => {
    sessionStorage.removeItem("gh-demo-user");
    setUserId("");
    location.hash = "/masuk";
  };
  useEffect(() => {
    const change = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        const data = readData();
        if (!data.error) {
          current.current = data.state;
          setState(data.state);
          notify("Data demo diperbarui dari tab lain.");
        } else setStorageError(data.error);
      }
    };
    window.addEventListener("storage", change);
    return () => window.removeEventListener("storage", change);
  }, []);
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
        notify("Sesi demo berakhir. Masuk kembali.");
      }, state.settings.sessionMinutes * 60000);
    };
    arm();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [userId, state.settings.sessionMinutes]);
  function run(c: Command) {
    if (!user) throw new Error("Masuk ke akun demo terlebih dahulu.");
    if (storageError) throw new Error(storageError);
    if (!navigator.onLine)
      throw new Error(
        "Koneksi terputus. Perubahan belum disimpan; formulir tetap tersedia.",
      );
    const stored = readData();
    if (stored.error) throw new Error(stored.error);
    if (stored.state.revision > current.current.revision)
      throw new Error(
        "Data berubah di tab lain. Muat ulang sebelum menyimpan.",
      );
    const next = applyCommand(current.current, c, user.id);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        "Penyimpanan browser penuh atau diblokir. Data belum disimpan. Unduh cadangan, lalu coba lagi.",
      );
    }
    current.current = next;
    setState(next);
    return next;
  }
  function login(name: string) {
    const u = current.current.users.find(
      (x) => x.username.toLowerCase() === name.toLowerCase().trim() && x.active,
    );
    if (!u) throw new Error("Akun demo tidak ditemukan atau tidak aktif.");
    sessionStorage.setItem("gh-demo-user", u.id);
    setUserId(u.id);
    location.hash =
      u.role === "Owner"
        ? "/ringkasan"
        : u.role === "Staf Showroom"
          ? "/motor"
          : u.role === "Staf Gudang"
            ? "/stok"
            : "/bengkel";
  }
  function reset() {
    const fresh = seedState();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    current.current = fresh;
    setState(fresh);
    setStorageError("");
    logout();
  }
  return (
    <Context.Provider
      value={{
        state,
        user,
        run,
        login,
        logout,
        reset,
        message,
        notify,
        storageError,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const c = useContext(Context);
  if (!c) throw new Error("Provider tidak tersedia.");
  return c;
}
export function useVisibleTransactions() {
  const { state, user } = useStore();
  return user
    ? state.transactions.filter((t) => maySeeTransaction(user, t))
    : [];
}
export function useCan(permission: string) {
  const { user } = useStore();
  return !!user && permitted(user, permission);
}
