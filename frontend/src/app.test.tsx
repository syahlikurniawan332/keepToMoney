// @vitest-environment jsdom
import React from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./main";
import type { Snapshot } from "./model";

let signed = false;
let mutations: any[] = [];
const fixture: Snapshot = {
  state: {
    accounts: [
      {
        id: "a",
        name: "Cash",
        kind: "cash",
        opening: 1000000,
        opening_date: "2026-09-01",
      },
    ],
    categories: [
      { id: "food", name: "Makanan", kind: "expense" },
      { id: "pay", name: "Gaji", kind: "income" },
    ],
    tags: [{ id: "work", name: "Magang" }],
    transactions: [
      {
        id: "tx",
        kind: "expense",
        account: "a",
        target: "",
        category: "food",
        original: "",
        tags: ["work"],
        date: "2026-09-14",
        amount: 25000,
        note: "Makan siang",
        created_at: "2026-09-14T01:00:00Z",
      },
    ],
    budgets: [
      {
        id: "b",
        name: "Makan bulanan",
        start: "2026-09-01",
        end: "2026-09-30",
        limit: 500000,
        categories: ["food"],
        tags: [],
      },
    ],
    plans: [],
    checkins: {},
    preferences: {
      name: "Pengguna Tes",
      zone: "Asia/Jakarta",
      reminder: false,
      reminder_email: "",
      time: "20:30",
      days: [0, 1, 2, 3, 4, 5, 6],
      pause_until: "",
      ai_consent: false,
    },
  },
  revision: 1,
  today: "2026-09-15",
  balances: { a: 975000 },
  deliveries: [],
};
beforeEach(() => {
  signed = false;
  mutations = [];
  window.location.hash = "";
  localStorage.clear();
  vi.stubGlobal("scrollTo", vi.fn());
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, opts?: RequestInit) => {
      const path = url.split("/api/")[1];
      const p = opts?.body ? JSON.parse(String(opts.body)) : null;
      if (path === "login") {
        signed = true;
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (path === "logout") {
        signed = false;
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (path === "session")
        return {
          ok: true,
          json: async () => ({
            user: signed
              ? { id: "user", username: "demo", email: "", verified: false }
              : null,
            csrf: "csrf",
            smtp: false,
            ai_model: "",
            registration: true,
          }),
        };
      if (path === "state")
        return { ok: true, json: async () => structuredClone(fixture) };
      if (path === "mutate") {
        mutations.push(p);
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return {
        ok: false,
        json: async () => ({ error: "Unexpected request " + path }),
      };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function login() {
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText("Username"), "demo");
  await user.type(screen.getByLabelText("Password"), "demo123456");
  await user.click(screen.getByRole("button", { name: "Masuk ke Arus" }));
  await screen.findByRole("heading", { name: "Keuangan, lebih tenang." });
  return user;
}
describe("React user flows", () => {
  it("shows and opens account registration", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Buat akun baru" }));
    expect(screen.getByRole("heading", { name: "Mulai perjalanan Anda." })).toBeTruthy();
    expect(screen.getByLabelText("Nama tampilan")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Buat akun$/ })).toBeTruthy();
  });
  it("logs in and opens all seven pages", async () => {
    const user = await login();
    expect(screen.getByText("Makan siang")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Navigasi utama" });
    for (const page of [
      "Transaksi",
      "Anggaran",
      "Analisis",
      "Pemeriksaan",
      "Rencana",
      "Pengaturan",
      "Beranda",
    ]) {
      await user.click(
        within(nav).getByRole("button", { name: page }),
      );
      expect(
        await screen.findByRole("heading", {
          name: page === "Beranda" ? "Keuangan, lebih tenang." : page,
          level: 1,
        }),
      ).toBeTruthy();
    }
  });
  it("submits integer transaction and preserves selected tags", async () => {
    const user = await login();
    await user.click(screen.getByRole("button", { name: "Catat transaksi" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nominal (Rp)"), "12500");
    await user.selectOptions(within(dialog).getByLabelText("Sumber uang"), "a");
    await user.selectOptions(within(dialog).getByLabelText("Kategori"), "food");
    await user.click(within(dialog).getByText("Magang"));
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan" }),
    );
    await waitFor(() => expect(mutations).toHaveLength(1));
    expect(mutations[0].data.amount).toBe(12500);
    expect(mutations[0].data.tags).toEqual(["work"]);
    expect(mutations[0].action).toBe("transaction");
  });
  it("filters categories and resets fields consistently", async () => {
    const user = await login();
    await user.click(
      screen.getByRole("button", { name: "Filter" }),
    );
    await user.click(screen.getByText("Gaji", { exact: true }));
    await user.click(
      screen.getByRole("button", { name: "Terapkan" }),
    );
    expect(screen.queryByText("Makan siang")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reset filter" }));
    expect(await screen.findByText("Makan siang")).toBeTruthy();
    expect(
      (screen.getByRole("checkbox", { name: "Gaji" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });
  it("saves reminder preferences without falsely enabling test email", async () => {
    const user = await login();
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Pengaturan",
      }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Kirim email percobaan",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await user.type(
      screen.getByLabelText("Email tujuan pengingat"),
      "test@example.test",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Aktifkan pengingat email/ }),
    );
    await user.click(screen.getByRole("button", { name: "Simpan preferensi" }));
    await waitFor(() => expect(mutations).toHaveLength(1));
    expect(mutations[0].data.reminder_email).toBe("test@example.test");
    expect(mutations[0].data.days).toHaveLength(7);
  });
  it("switches theme and opens budget editor", async () => {
    const user = await login();
    await user.click(screen.getByRole("button", { name: "Mode gelap" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Anggaran",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Edit Makan bulanan" }),
    );
    expect(
      (screen.getByLabelText("Batas anggaran (Rp)") as HTMLInputElement).value,
    ).toBe("500000");
  });
});
