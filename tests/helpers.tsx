import { vi } from "vitest";
import type { Category, RecurringRule, SavingsGoal, Transaction } from "@/lib/supabase/types";

/**
 * Server actions can't be imported into jsdom — they pull in the Supabase
 * server client, which needs request cookies. Components under test only need
 * them to exist as form targets, so each suite mocks the action module.
 */
export const noopAction = vi.fn(async () => undefined);

export function makeCategory(over: Partial<Category> = {}): Category {
  return {
    id: "cat-food",
    user_id: "u1",
    name: "Food & Drink",
    kind: "expense",
    color: "#a1584a",
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

export function makeTransaction(over: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    user_id: "u1",
    amount: 100_000,
    kind: "expense",
    category_id: "cat-food",
    note: "Lunch",
    occurred_on: "2026-09-05",
    created_at: "2026-09-05T00:00:00Z",
    ...over,
  };
}

export function makeGoal(over: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "goal-1",
    user_id: "u1",
    name: "New phone",
    target_amount: 20_000_000,
    saved_amount: 5_000_000,
    target_date: null,
    color: "#b68235",
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

export function makeRule(over: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: "rule-1",
    user_id: "u1",
    kind: "expense",
    amount: 2_500_000,
    category_id: "cat-food",
    note: "Rent",
    frequency: "monthly",
    next_run_on: "2026-10-01",
    active: true,
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}
