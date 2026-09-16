import { describe, it, expect } from "vitest";
import { summary, filtered, State, Transaction } from "./model";
const rows: Transaction[] = [
  {
    id: "e",
    kind: "expense",
    amount: 100,
    date: "2026-09-14",
    account: "a",
    category: "food",
    tags: ["one", "two"],
    note: "",
  },
  {
    id: "r",
    kind: "refund",
    amount: 20,
    date: "2026-09-14",
    account: "a",
    category: "food",
    tags: [],
    note: "",
  },
  {
    id: "t",
    kind: "transfer",
    amount: 400,
    date: "2026-09-14",
    account: "a",
    target: "b",
    category: "",
    tags: [],
    note: "",
  },
].map((t) => ({
  target: "",
  original: "",
  created_at: "2026-09-14T12:00:00Z",
  ...t,
}));
describe("reports", () => {
  it("subtracts refund and excludes transfer", () => {
    expect(summary(rows).expense).toBe(80);
    expect(summary(rows).income).toBe(0);
  });
  it("counts multi-tag matching transaction only once", () => {
    const s = { transactions: rows } as State;
    expect(
      summary(
        filtered(s, {
          start: "2026-09-01",
          end: "2026-09-30",
          tags: ["one", "two"],
        }),
      ).expense,
    ).toBe(100);
  });
  it("uses category AND tag and transfer target account", () => {
    const s = { transactions: rows } as State;
    expect(
      filtered(s, { start: "", end: "", categories: ["other"], tags: ["one"] }),
    ).toHaveLength(0);
    expect(filtered(s, { start: "", end: "", account: "b" })).toHaveLength(1);
  });
});
