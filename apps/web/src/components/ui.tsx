import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
} from "react";

export const href = (path: string) => `#${path}`;
export function go(path: string) {
  location.hash = path;
}
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const aliases: Record<string, string> = { back: "arrow", down: "chevron", close: "plus", list: "menu" };
  const file = aliases[name] || name;
  return (
    <span
      className={`icon icon-${name}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        "--icon": `url("/icons/${file}.png")`,
      } as CSSProperties}
    />
  );
}
export function Button({
  children,
  variant = "primary",
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: string;
}) {
  return (
    <button {...props} className={`button ${variant} ${className}`}>
      {icon && <Icon name={icon} size={18} />} {children}
    </button>
  );
}
export function LinkButton({
  to,
  children,
  icon,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  icon?: string;
  secondary?: boolean;
}) {
  return (
    <a
      className={`button ${secondary ? "secondary" : "primary"}`}
      href={href(to)}
    >
      {icon && <Icon name={icon} size={18} />} {children}
    </a>
  );
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {props.required && <span className="required"> *</span>}
      </span>
      <input id={id} {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select({
  label,
  children,
  value,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {required && <span className="required"> *</span>}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}
export function TextArea({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {required && <span className="required"> *</span>}
      </span>
      <textarea
        id={id}
        value={value}
        maxLength={2000}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={3}
      />
    </label>
  );
}
export function Page({
  title,
  subtitle,
  action,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} | Garasi Hobby`;
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <>
      <header className="page-heading" style={{ viewTransitionName: "page-heading" }}>
        <div className="heading-main">
          {back && (
            <a className="icon-button" href={href(back)} aria-label="Kembali">
              <Icon name="back" />
            </a>
          )}
          <div>
            <h1 tabIndex={-1} ref={ref}>
              {title}
            </h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        <div className="page-actions">{action}</div>
      </header>
      <div className="page-body">{children}</div>
    </>
  );
}
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({ children }: { children: string }) {
  const progress = children === "Dikerjakan";
  const green = [
    "Paid",
    "Final",
    "Lunas",
    "Disetujui",
    "Selesai",
    "Tersedia",
    "Normal",
    "Aktif",
    "Refunded",
    "Siap Diambil",
  ].includes(children);
  const red = [
    "Batal",
    "Dibatalkan",
    "Ditolak",
    "Habis",
    "Failed",
    "Nonaktif",
  ].includes(children);
  const amber = [
    "Menipis",
    "Pending",
    "Reserved",
    "Menunggu Persetujuan",
    "Menunggu Barang",
    "Menunggu Pembayaran",
    "Refund Pending",
    "Expired",
    "Direvisi",
  ].includes(children);
  return (
    <span
      className={`badge ${progress ? "copper" : green ? "green" : red ? "red" : amber ? "amber" : "neutral"}`}
    >
      {children === "Paid"
        ? "Lunas"
        : children === "Failed"
          ? "Gagal"
          : children === "Expired"
            ? "Kedaluwarsa"
            : children}
    </span>
  );
}
export function Tabs({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = ref.current;
    const update = () => {
      const active = container?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active || !indicator.current) return;
      indicator.current.style.width = `${active.offsetWidth}px`;
      indicator.current.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    update();
    const observer = new ResizeObserver(update);
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [value, options]);
  return (
    <div ref={ref} className="tabs" role="tablist" aria-label="Bagian halaman">
      {options.map((o, index) => (
        <button
          key={o.id}
          role="tab"
          tabIndex={value === o.id ? 0 : -1}
          aria-selected={value === o.id}
          className={value === o.id ? "active" : ""}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => {
            const next =
              e.key === "ArrowRight"
                ? (index + 1) % options.length
                : e.key === "ArrowLeft"
                  ? (index + options.length - 1) % options.length
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? options.length - 1
                      : -1;
            if (next >= 0) {
              e.preventDefault();
              onChange(options[next].id);
              (
                e.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }
          }}
        >
          {o.label}
          {o.count !== undefined && <span>{o.count}</span>}
        </button>
      ))}
      <span ref={indicator} className="tab-indicator" aria-hidden="true" />
    </div>
  );
}
export function Search({
  value,
  onChange,
  placeholder = "Cari…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search">
      <span className="search-label">Cari</span>
      <Icon name="search" size={19} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="icon-button"
          aria-label="Hapus pencarian"
          onClick={() => onChange("")}
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </label>
  );
}
export function Empty({
  title = "Belum ada data",
  description = "Data yang sesuai belum ditemukan.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="notice error" role="alert">
      <Icon name="alert" size={18} />
      {error}
    </p>
  ) : null;
}
export function DemoNote({
  children = "Data contoh. Perubahan hanya tersimpan di browser ini.",
}: {
  children?: ReactNode;
}) {
  return (
    <footer className="demo-note">
      {children}
    </footer>
  );
}
export function Photo({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <img
      className={className}
      src={!src || failed ? "/images/motor-placeholder.webp" : src}
      alt={!src || failed ? "Foto belum tersedia. Gambar ilustrasi placeholder." : alt}
      width="640"
      height="420"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      data-placeholder={!src || failed}
      onError={() => { if (!failed) setFailed(true); }}
    />
  );
}
export function useAction() {
  const [error, setError] = useState("");
  const action = (fn: () => void) => {
    try {
      setError("");
      fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Tidak dapat menyimpan. Coba lagi.",
      );
    }
  };
  return { error, setError, action };
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  beforeClose,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode | ((close: (force?: boolean) => void) => ReactNode);
  wide?: boolean;
  beforeClose?: () => boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const id = useId();
  useEffect(() => {
    closing.current = false;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    document.body.classList.add("modal-open");
    return () => {
      ref.current?.close();
      document.body.classList.remove("modal-open");
      previous?.focus();
    };
  }, []);
  function close(force = false) {
    if (closing.current || (!force && beforeClose && !beforeClose())) return;
    closing.current = true;
    const dialog = ref.current;
    dialog?.close();
    const animations = dialog?.getAnimations({ subtree: true }) || [];
    if (!animations.length) onClose();
    else void Promise.allSettled(animations.map((a) => a.finished)).then(onClose);
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-header">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Tutup dialog"
          onClick={() => close()}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">{typeof children === "function" ? children(close) : children}</div>
    </dialog>
  );
}
export function FormModal({
  title,
  onClose,
  children,
  onSubmit,
  submit = "Simpan",
  danger = false,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  onSubmit: (data: FormData) => void | Promise<void>;
  submit?: string;
  danger?: boolean;
  wide?: boolean;
}) {
  const { error, setError } = useAction();
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  async function handle(e: FormEvent<HTMLFormElement>, close: (force?: boolean) => void) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await onSubmit(data);
      close(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={title}
      onClose={onClose}
      wide={wide}
      beforeClose={() => !busy && (!dirty || window.confirm("Perubahan belum disimpan. Tutup tanpa menyimpan?"))}
    >
      {(close) => <form onSubmit={(e) => void handle(e, close)} onChange={() => setDirty(true)}>
        <div className="form-stack">
          {children}
          <ErrorMessage error={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={() => close()} disabled={busy}>
            Batal
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            type="submit"
            disabled={busy}
          >
            {busy ? "Menyimpan…" : submit}
          </Button>
        </div>
      </form>}
    </Modal>
  );
}
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (
        a?.getAttribute("href")?.startsWith("#/") &&
        !window.confirm(
          "Perubahan belum disimpan. Tetap keluar tanpa menyimpan?",
        )
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click);
    };
  }, [dirty]);
}
