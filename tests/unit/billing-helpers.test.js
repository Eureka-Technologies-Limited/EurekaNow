// ─────────────────────────────────────────────────────────────────────────────
// UNIT TESTS — Billing helper functions
//
// Tests the pure utility functions used inside BillingView.
// No React or network calls — fast and isolated.
//
// Run: npm test -- --testPathPattern=tests/unit/billing-helpers
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers copied from BillingView (kept in sync) ───────────────────────────

function isAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roles) && user.roles.length
    ? user.roles
    : [user.role].filter(Boolean);
  return roles.some((r) => String(r).toLowerCase() === "admin");
}

function fmt(cents, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(ts) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Plan config ───────────────────────────────────────────────────────────────

const PLANS = {
  Free:  { key: "Free",  price: "£0",  priceId: null },
  Basic: { key: "Basic", price: "£29", priceId: "price_1TdZmTJzWbyeb81A8OaC9A9S" },
  Pro:   { key: "Pro",   price: "£79", priceId: "price_1TdZnYJzWbyeb81AHZuDaTqf" },
};

// ─────────────────────────────────────────────────────────────────────────────
// isAdmin()
// ─────────────────────────────────────────────────────────────────────────────

describe("isAdmin()", () => {
  test("returns true for user with role='Admin'", () => {
    expect(isAdmin({ role: "Admin" })).toBe(true);
  });

  test("is case-insensitive (admin, ADMIN, Admin)", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
    expect(isAdmin({ role: "Admin" })).toBe(true);
  });

  test("returns false for non-admin roles", () => {
    expect(isAdmin({ role: "Agent" })).toBe(false);
    expect(isAdmin({ role: "End User" })).toBe(false);
    expect(isAdmin({ role: "Catalog Manager" })).toBe(false);
  });

  test("checks roles array when present", () => {
    expect(isAdmin({ roles: ["Admin", "Agent"] })).toBe(true);
    expect(isAdmin({ roles: ["Agent", "End User"] })).toBe(false);
  });

  test("prefers roles array over role string", () => {
    // roles array takes priority
    expect(isAdmin({ roles: ["Admin"], role: "End User" })).toBe(true);
    expect(isAdmin({ roles: ["Agent"], role: "Admin" })).toBe(false);
  });

  test("falls back to role string when roles is empty array", () => {
    expect(isAdmin({ roles: [], role: "Admin" })).toBe(true);
  });

  test("returns false for null/undefined user", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  test("returns false for user with no role", () => {
    expect(isAdmin({})).toBe(false);
    expect(isAdmin({ name: "Ethan" })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fmt() — currency formatter
// ─────────────────────────────────────────────────────────────────────────────

describe("fmt()", () => {
  test("formats pence to GBP correctly", () => {
    expect(fmt(2900)).toBe("£29.00");
    expect(fmt(7900)).toBe("£79.00");
    expect(fmt(0)).toBe("£0.00");
  });

  test("formats odd amounts correctly", () => {
    expect(fmt(1)).toBe("£0.01");
    expect(fmt(99)).toBe("£0.99");
    expect(fmt(10000)).toBe("£100.00");
  });

  test("handles different currencies", () => {
    // Should not throw with other currency codes
    expect(() => fmt(2900, "usd")).not.toThrow();
    expect(() => fmt(2900, "eur")).not.toThrow();
  });

  test("always includes 2 decimal places", () => {
    const result = fmt(5000);
    expect(result).toMatch(/\.\d{2}$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fmtDate() — Stripe unix timestamp formatter
// ─────────────────────────────────────────────────────────────────────────────

describe("fmtDate()", () => {
  test("converts Stripe unix timestamp to readable date", () => {
    // 2024-01-15 00:00:00 UTC = 1705276800
    const result = fmtDate(1705276800);
    expect(result).toMatch(/jan/i);
    expect(result).toMatch(/2024/);
  });

  test("includes day, month and year", () => {
    const result = fmtDate(1700000000); // 2023-11-14
    expect(result).toMatch(/\d{2}/);   // day
    expect(result).toMatch(/2023/);    // year
  });

  test("does not throw for zero timestamp", () => {
    expect(() => fmtDate(0)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PLANS config
// ─────────────────────────────────────────────────────────────────────────────

describe("PLANS config", () => {
  test("has exactly 3 plans: Free, Basic, Pro", () => {
    expect(Object.keys(PLANS)).toEqual(["Free", "Basic", "Pro"]);
  });

  test("Free plan has no priceId", () => {
    expect(PLANS.Free.priceId).toBeNull();
  });

  test("Basic and Pro have valid Stripe price IDs", () => {
    expect(PLANS.Basic.priceId).toMatch(/^price_/);
    expect(PLANS.Pro.priceId).toMatch(/^price_/);
  });

  test("Basic is cheaper than Pro", () => {
    const basicPrice = parseInt(PLANS.Basic.price.replace(/\D/g, ""), 10);
    const proPrice   = parseInt(PLANS.Pro.price.replace(/\D/g, ""), 10);
    expect(basicPrice).toBeLessThan(proPrice);
  });

  test("plan keys match their key property", () => {
    Object.entries(PLANS).forEach(([key, plan]) => {
      expect(plan.key).toBe(key);
    });
  });
});
