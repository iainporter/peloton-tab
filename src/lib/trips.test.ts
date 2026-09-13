import { describe, expect, it } from "vitest";
import {
  computeTripBalances,
  splitEvenly,
  suggestSettlements,
} from "./trips";

const sum = (values: Iterable<number>) =>
  [...values].reduce((total, v) => total + v, 0);

describe("splitEvenly", () => {
  it("splits evenly divisible amounts", () => {
    const shares = splitEvenly(900, ["a", "b", "c"]);
    expect(Object.fromEntries(shares)).toEqual({ a: 300, b: 300, c: 300 });
  });

  it("hands out leftover units so shares sum to the amount", () => {
    const shares = splitEvenly(1000, ["a", "b", "c"]);
    expect(sum(shares.values())).toBe(1000);
    expect([...shares.values()].sort()).toEqual([333, 333, 334]);
  });

  it("is deterministic regardless of participant order", () => {
    const one = splitEvenly(1001, ["c", "a", "b"], "expense-1");
    const two = splitEvenly(1001, ["b", "c", "a"], "expense-1");
    expect(Object.fromEntries(one)).toEqual(Object.fromEntries(two));
  });

  it("varies who receives the leftover unit by seed", () => {
    const recipients = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const shares = splitEvenly(1000, ["a", "b", "c"], `expense-${i}`);
      for (const [id, share] of shares) if (share === 334) recipients.add(id);
    }
    expect(recipients.size).toBeGreaterThan(1);
  });

  it("ignores duplicate participants", () => {
    const shares = splitEvenly(1000, ["a", "a", "b"]);
    expect(Object.fromEntries(shares)).toEqual({ a: 500, b: 500 });
  });

  it("handles a single participant and no participants", () => {
    expect(Object.fromEntries(splitEvenly(1234, ["a"]))).toEqual({ a: 1234 });
    expect(splitEvenly(1234, []).size).toBe(0);
  });
});

describe("computeTripBalances", () => {
  it("returns zero balances for members with no expenses", () => {
    expect(computeTripBalances(["a", "b"], [])).toEqual([
      { userId: "a", paid: 0, share: 0, sent: 0, received: 0, balance: 0 },
      { userId: "b", paid: 0, share: 0, sent: 0, received: 0, balance: 0 },
    ]);
  });

  it("credits the payer and debits participants", () => {
    const balances = computeTripBalances(
      ["alice", "bob", "carol"],
      [
        {
          id: "taxi",
          paidBy: "alice",
          baseAmount: 6000,
          participantIds: ["alice", "bob", "carol"],
        },
      ],
    );
    expect(balances).toEqual([
      { userId: "alice", paid: 6000, share: 2000, sent: 0, received: 0, balance: 4000 },
      { userId: "bob", paid: 0, share: 2000, sent: 0, received: 0, balance: -2000 },
      { userId: "carol", paid: 0, share: 2000, sent: 0, received: 0, balance: -2000 },
    ]);
  });

  it("handles a payer who isn't a participant", () => {
    const balances = computeTripBalances(
      ["alice", "bob"],
      [{ id: "gift", paidBy: "alice", baseAmount: 1000, participantIds: ["bob"] }],
    );
    const byUser = Object.fromEntries(balances.map((b) => [b.userId, b.balance]));
    expect(byUser).toEqual({ alice: 1000, bob: -1000 });
  });

  it("always nets to exactly zero with uneven splits", () => {
    const members = ["a", "b", "c", "d", "e", "f", "g"];
    const expenses = Array.from({ length: 50 }, (_, i) => ({
      id: `expense-${i}`,
      paidBy: members[i % members.length],
      baseAmount: 1001 + i * 37,
      participantIds: members.slice(0, 2 + (i % 6)),
    }));

    const balances = computeTripBalances(members, expenses);
    expect(sum(balances.map((b) => b.balance))).toBe(0);
    expect(sum(balances.map((b) => b.paid))).toBe(
      sum(expenses.map((e) => e.baseAmount)),
    );
  });

  it("sorts by balance descending", () => {
    const balances = computeTripBalances(
      ["a", "b", "c"],
      [
        { id: "1", paidBy: "c", baseAmount: 3000, participantIds: ["a", "b", "c"] },
        { id: "2", paidBy: "b", baseAmount: 600, participantIds: ["a", "b", "c"] },
      ],
    );
    expect(balances.map((b) => b.userId)).toEqual(["c", "b", "a"]);
  });

  it("applies paid settlements", () => {
    const expenses = [
      { id: "taxi", paidBy: "alice", baseAmount: 6000, participantIds: ["alice", "bob", "carol"] },
    ];
    const balances = computeTripBalances(["alice", "bob", "carol"], expenses, [
      { fromUserId: "bob", toUserId: "alice", amount: 2000 },
    ]);
    const byUser = Object.fromEntries(balances.map((b) => [b.userId, b]));

    expect(byUser.alice).toMatchObject({ received: 2000, balance: 2000 });
    expect(byUser.bob).toMatchObject({ sent: 2000, balance: 0 });
    expect(byUser.carol).toMatchObject({ balance: -2000 });
  });
});

describe("suggestSettlements", () => {
  it("suggests nothing when everyone is even", () => {
    expect(suggestSettlements([])).toEqual([]);
    expect(
      suggestSettlements([
        { userId: "a", balance: 0 },
        { userId: "b", balance: 0 },
      ]),
    ).toEqual([]);
  });

  it("pays a single creditor from each debtor", () => {
    expect(
      suggestSettlements([
        { userId: "alice", balance: 4000 },
        { userId: "carol", balance: -2000 },
        { userId: "bob", balance: -2000 },
      ]),
    ).toEqual([
      { fromUserId: "bob", toUserId: "alice", amount: 2000 },
      { fromUserId: "carol", toUserId: "alice", amount: 2000 },
    ]);
  });

  it("matches the largest debtor with the largest creditor", () => {
    expect(
      suggestSettlements([
        { userId: "a", balance: 5000 },
        { userId: "b", balance: 1000 },
        { userId: "c", balance: -3000 },
        { userId: "d", balance: -3000 },
      ]),
    ).toEqual([
      { fromUserId: "c", toUserId: "a", amount: 3000 },
      { fromUserId: "d", toUserId: "a", amount: 2000 },
      { fromUserId: "d", toUserId: "b", amount: 1000 },
    ]);
  });

  it("settles a busy trip in at most n−1 positive payments", () => {
    const members = ["a", "b", "c", "d", "e", "f", "g"];
    const expenses = Array.from({ length: 50 }, (_, i) => ({
      id: `expense-${i}`,
      paidBy: members[(i * 3) % members.length],
      baseAmount: 1001 + i * 37,
      participantIds: members.slice(i % 3, 3 + (i % 5)),
    }));

    const balances = computeTripBalances(members, expenses);
    const transfers = suggestSettlements(balances);

    expect(transfers.length).toBeLessThanOrEqual(members.length - 1);
    expect(transfers.every((t) => t.amount > 0)).toBe(true);

    // Once every payment is made, everyone is even
    const settled = computeTripBalances(members, expenses, transfers);
    expect(settled.every((b) => b.balance === 0)).toBe(true);
  });

  it("settles only what's left after earlier payments", () => {
    const expenses = [
      { id: "taxi", paidBy: "alice", baseAmount: 6000, participantIds: ["alice", "bob", "carol"] },
    ];
    const balances = computeTripBalances(["alice", "bob", "carol"], expenses, [
      { fromUserId: "bob", toUserId: "alice", amount: 2000 },
    ]);

    expect(suggestSettlements(balances)).toEqual([
      { fromUserId: "carol", toUserId: "alice", amount: 2000 },
    ]);
  });

  it("rejects balances that don't net to zero", () => {
    expect(() =>
      suggestSettlements([
        { userId: "a", balance: 100 },
        { userId: "b", balance: -99 },
      ]),
    ).toThrow();
  });
});
