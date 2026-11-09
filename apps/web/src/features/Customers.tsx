import { useState } from "react";
import { useCan, useStore } from "../app/store.tsx";
import {
  Badge,
  Button,
  Empty,
  Field,
  FormModal,
  Icon,
  LinkButton,
  Page,
  Panel,
  Search,
  href,
} from "../components/ui.tsx";
import { uid } from "../lib/domain.ts";
import type { Customer, Vehicle } from "../lib/domain.ts";

export function Customers({ path }: { path: string }) {
  const { state, run, notify } = useStore();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [contact, setContact] = useState("");
  const canWorkshop = useCan("workshop");
  const id = path.split("/")[2];
  const selected = state.customers.find((c) => c.id === id);
  const rows = state.customers.filter((c) =>
    `${c.name} ${c.contact} ${state.vehicles
      .filter((v) => v.customerId === c.id)
      .map((v) => `${v.plate} ${v.brand} ${v.model}`)
      .join(" ")}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const duplicate =
    contact &&
    state.customers.find(
      (c) =>
        c.id !== editing?.id &&
        c.contact.replace(/\D/g, "") === contact.replace(/\D/g, ""),
    );
  function openCustomer(c: Customer | null) {
    setEditing(c);
    setContact(c?.contact || "");
    setModal("customer");
  }
  return (
    <Page
      title={selected ? selected.name : "Pelanggan & motor"}
      subtitle={
        selected
          ? selected.contact || "Kontak belum dicatat"
          : "Kenali pemiliknya. Jaga perjalanan motornya."
      }
      back={selected ? "/pelanggan" : undefined}
      action={
        <Button
          icon={selected ? "edit" : "plus"}
          onClick={() => openCustomer(selected || null)}
        >
          {selected ? "Ubah pelanggan" : "Tambah pelanggan"}
        </Button>
      }
    >
      {selected ? (
        <div className="detail-columns">
          <Panel
            title="Motor pelanggan"
            action={
              <Button
                variant="secondary"
                icon="plus"
                onClick={() => setModal("vehicle")}
              >
                Tambah motor
              </Button>
            }
          >
            {state.vehicles
              .filter((v) => v.customerId === selected.id)
              .map((v) => (
                <div className="list-row customer-motor" key={v.id}>
                  <span className="part-icon">
                    <Icon name="motor" size={26} />
                  </span>
                  <span>
                    <strong>
                      {v.brand} {v.model}
                    </strong>
                    <small>
                      {v.plate || "Tanpa pelat"} ·{" "}
                      {v.year || "Tahun belum dicatat"}
                    </small>
                    <small>{v.id}</small>
                  </span>
                  {canWorkshop && (
                    <LinkButton secondary to="/bengkel/baru">
                      Buat WO
                    </LinkButton>
                  )}
                </div>
              ))}
            {!state.vehicles.some((v) => v.customerId === selected.id) && (
              <Empty
                title="Belum ada motor"
                description="Tambahkan motor pertama pelanggan ini."
              />
            )}
          </Panel>
          <Panel title="Data pelanggan">
            <dl>
              <dt>Kontak</dt>
              <dd>{selected.contact || "Belum dicatat"}</dd>
              <dt>Alamat</dt>
              <dd>{selected.address || "Belum dicatat"}</dd>
            </dl>
            <p className="field-hint">
              Pelanggan tidak memiliki akun aplikasi. Identitas motor tetap sama
              setelah penjualan dan servis.
            </p>
          </Panel>
        </div>
      ) : (
        <Panel>
          <div className="toolbar">
            <Search
              value={q}
              onChange={setQ}
              placeholder="Cari nama, kontak, pelat, atau motor"
            />
            <span className="muted">{rows.length} pelanggan</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th>Kontak</th>
                  <th>Motor</th>
                  <th scope="col">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a
                        href={href(`/pelanggan/${c.id}`)}
                        className="stack-link"
                      >
                        <strong>{c.name}</strong>
                        <small>{c.address}</small>
                      </a>
                    </td>
                    <td>{c.contact || "Belum dicatat"}</td>
                    <td>
                      {
                        state.vehicles.filter((v) => v.customerId === c.id)
                          .length
                      }{" "}
                      motor
                    </td>
                    <td>
                      <a
                        className="icon-button"
                        href={href(`/pelanggan/${c.id}`)}
                        aria-label={`Buka ${c.name}`}
                      >
                        <Icon name="chevron" size={17} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <Empty />}
        </Panel>
      )}
      {modal === "customer" && (
        <FormModal
          title={editing ? "Ubah pelanggan" : "Tambah pelanggan"}
          onClose={() => setModal("")}
          onSubmit={(data) => {
            run({
              type: "customer",
              value: {
                id: editing?.id || uid(),
                name: String(data.get("name")).trim(),
                contact,
                address: String(data.get("address")),
              },
            });
            notify("Pelanggan tersimpan.");
          }}
        >
          <Field
            label="Nama pelanggan"
            name="name"
            defaultValue={editing?.name}
            required
            maxLength={120}
          />
          <Field
            label="Kontak (jika tersedia)"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={80}
          />
          {duplicate && (
            <div className="notice">
              Kontak sama dengan {duplicate.name}.
              <a
                className="text-link"
                href={href(`/pelanggan/${duplicate.id}`)}
                onClick={() => setModal("")}
              >
                Gunakan pelanggan ini
              </a>
            </div>
          )}
          <Field
            label="Alamat (opsional)"
            name="address"
            defaultValue={editing?.address}
            maxLength={1000}
          />
        </FormModal>
      )}
      {modal === "vehicle" && selected && (
        <FormModal
          title="Tambah motor pelanggan"
          onClose={() => setModal("")}
          onSubmit={(data) => {
            const v: Vehicle = {
              id: `VEH-${uid().slice(0, 8)}`,
              brand: String(data.get("brand")),
              model: String(data.get("model")),
              plate: String(data.get("plate")).toUpperCase(),
              year: String(data.get("year")),
              color: String(data.get("color")),
              chassis: String(data.get("chassis")).toUpperCase(),
              engine: String(data.get("engine")).toUpperCase(),
              customerId: selected.id,
              showroom: false,
              status: "Terjual",
              price: 0,
              cost: 0,
              notes: "",
              photos: [],
              reservedFor: "",
              reservedAt: "",
            };
            run({ type: "vehicle", value: v });
            notify("Motor pelanggan tersimpan.");
          }}
        >
          <div className="form-grid">
            <Field label="Merek" name="brand" required maxLength={80} />
            <Field label="Model / tipe" name="model" required maxLength={100} />
            <Field label="Pelat (opsional)" name="plate" maxLength={20} />
            <Field
              label="Tahun (opsional)"
              name="year"
              type="number"
              min={1900}
              max={new Date().getFullYear() + 1}
            />
            <Field label="Warna" name="color" />
            <Field label="Nomor rangka" name="chassis" maxLength={60} />
            <Field label="Nomor mesin" name="engine" maxLength={60} />
          </div>
          <p className="field-hint">
            Cari motor yang sudah ada sebelum membuat identitas baru. Nomor
            rangka dan mesin yang terisi harus unik.
          </p>
        </FormModal>
      )}
    </Page>
  );
}
