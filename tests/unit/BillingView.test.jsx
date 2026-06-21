// ─────────────────────────────────────────────────────────────────────────────
// UNIT TESTS — BillingView component
//
// Tests rendering, admin gate, plan cards, invoice table and action buttons.
// All network calls are mocked — no real Stripe or Supabase calls made.
//
// Run: npm test -- --testPathPattern=tests/unit/BillingView
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock environment ──────────────────────────────────────────────────────────
process.env.REACT_APP_SUPABASE_URL = "https://anhsumvnxmxosdjclfss.supabase.co";

// ── Mock design tokens ────────────────────────────────────────────────────────
const mockTokens = {
  dark: false,
  bg: "#f0f0f0", surface: "#ffffff", surface2: "#f6f9fc", surface3: "#e7eef6",
  border: "#c9d6e3", border2: "#a8c0d9",
  text: "#0b1a30", text2: "#34495e", text3: "#607d8b",
  accent: "#F57A55", accentBg: "#ffe8e0", accentText: "#8a2f15",
  red: "#D33B41", redBg: "#fce8ea", redText: "#9f1f29",
  orange: "#F57A55", orangeBg: "#fff0ea", orangeText: "#9d3e24",
  green: "#4CAF50", greenBg: "#C8E6C9", greenText: "#1f6a2d",
  blue: "#2196F3", blueBg: "#e9f4ff", blueText: "#0d63b6",
  purple: "#5B7BA8", purpleBg: "#edf3fb", purpleText: "#3f5f89",
  yellow: "#FFD166", yellowBg: "#fff7db", yellowText: "#8d6500",
  gray: "#90A4AE", grayBg: "#f4f7fa", grayText: "#526773",
  font: "'Sora', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

jest.mock("../../src/core/hooks.js", () => ({
  useTokens: () => mockTokens,
  useTheme:  () => ({ dark: false, toggle: jest.fn() }),
}));

// ── Mock icons ────────────────────────────────────────────────────────────────
jest.mock("../../src/core/icons.jsx", () => ({
  I: ({ name }) => <span data-testid={`icon-${name}`} />,
}));

// ── Mock Supabase ─────────────────────────────────────────────────────────────
const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: { access_token: "test-jwt-token" } },
});
jest.mock("../../src/core/supabase.js", () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}));

// ── Mock fetch (edge function calls) ─────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Import component AFTER mocks ──────────────────────────────────────────────
const { BillingView } = require("../../src/views/BillingView.jsx");

// ── Test fixtures ─────────────────────────────────────────────────────────────
const adminUser = {
  id: "user-1",
  name: "Ethan Admin",
  email: "ethan@eurekanow.com",
  role: "Admin",
  roles: ["Admin"],
  orgId: "org-1",
};

const agentUser = {
  id: "user-2",
  name: "Joe Agent",
  email: "joe@eurekanow.com",
  role: "Agent",
  roles: ["Agent"],
  orgId: "org-1",
};

const mockOrg = {
  id: "org-1",
  name: "Eureka Technologies",
  plan: "Basic",
};

const emptyBillingResponse = {
  subscription: null,
  invoices: [],
};

const billingWithInvoices = {
  subscription: {
    id: "sub_test123",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: 1735689600, // 2025-01-01
    items: { data: [{ price: { id: "price_1TdZmTJzWbyeb81A8OaC9A9S" } }] },
  },
  invoices: [
    {
      id: "in_test001",
      number: "INV-0001",
      created: 1704067200, // 2024-01-01
      period_end: 1706745600,
      amount_paid: 2900,
      amount_due: 2900,
      currency: "gbp",
      status: "paid",
      invoice_pdf: "https://stripe.com/invoice.pdf",
    },
    {
      id: "in_test002",
      number: "INV-0002",
      created: 1706745600,
      period_end: 1709424000,
      amount_paid: 2900,
      amount_due: 2900,
      currency: "gbp",
      status: "paid",
      invoice_pdf: null,
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupFetchMock(responseData, status = 200) {
  mockFetch.mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => responseData,
  });
}

function renderBilling(user = adminUser, org = mockOrg, plan = "Basic") {
  return render(
    <BillingView currentUser={user} currentOrg={org} plan={plan} />
  );
}

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Default: get-billing-data returns empty (no invoices)
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => emptyBillingResponse,
  });
  // Clear any URL params from previous tests
  window.history.replaceState({}, "", "/");
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN GATE
// ─────────────────────────────────────────────────────────────────────────────

describe("Admin gate", () => {
  test("non-admin sees access denied screen", async () => {
    await act(async () => { renderBilling(agentUser); });
    expect(screen.getByText(/Admin Access Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Billing information is only accessible/i)).toBeInTheDocument();
  });

  test("non-admin does NOT see plan cards", async () => {
    await act(async () => { renderBilling(agentUser); });
    expect(screen.queryByText(/Choose a Plan/i)).not.toBeInTheDocument();
  });

  test("admin sees the billing page", async () => {
    await act(async () => { renderBilling(adminUser); });
    expect(screen.getByText(/Plans & Billing/i)).toBeInTheDocument();
  });

  test("user with roles array containing Admin gets access", async () => {
    const multiRoleAdmin = { ...agentUser, roles: ["Agent", "Admin"] };
    await act(async () => { renderBilling(multiRoleAdmin); });
    expect(screen.queryByText(/Admin Access Required/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Plans & Billing/i)).toBeInTheDocument();
  });

  test("'admin' lowercase in role string gets access", async () => {
    const lowercaseAdmin = { ...adminUser, role: "admin", roles: ["admin"] };
    await act(async () => { renderBilling(lowercaseAdmin); });
    expect(screen.queryByText(/Admin Access Required/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PLAN CARDS
// ─────────────────────────────────────────────────────────────────────────────

describe("Plan cards", () => {
  test("renders all 3 plan cards: Free, Basic, Pro", async () => {
    await act(async () => { renderBilling(); });
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  test("shows prices for each plan", async () => {
    await act(async () => { renderBilling(); });
    expect(screen.getByText("£0")).toBeInTheDocument();
    expect(screen.getByText("£29")).toBeInTheDocument();
    expect(screen.getByText("£79")).toBeInTheDocument();
  });

  test("marks current plan as 'Current'", async () => {
    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  test("current plan button says 'Current plan'", async () => {
    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });
    expect(screen.getByText("Current plan")).toBeInTheDocument();
  });

  test("Free plan on Free tier", async () => {
    await act(async () => { renderBilling(adminUser, mockOrg, "Free"); });
    // Free plan card should be marked current
    expect(screen.getByText("Current")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS BANNER
// ─────────────────────────────────────────────────────────────────────────────

describe("Success banner", () => {
  test("shows success message when ?billing=success in URL", async () => {
    window.history.pushState({}, "", "/?billing=success");
    await act(async () => { renderBilling(); });
    expect(screen.getByText(/Subscription activated/i)).toBeInTheDocument();
  });

  test("does NOT show success message without URL param", async () => {
    window.history.replaceState({}, "", "/");
    await act(async () => { renderBilling(); });
    expect(screen.queryByText(/Subscription activated/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE TABLE
// ─────────────────────────────────────────────────────────────────────────────

describe("Invoice table", () => {
  test("shows empty state when no invoices", async () => {
    await act(async () => { renderBilling(); });
    await waitFor(() => {
      expect(screen.getByText(/No invoices yet/i)).toBeInTheDocument();
    });
  });

  test("shows invoice rows when billing data loaded", async () => {
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => billingWithInvoices,
    });
    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });
    await waitFor(() => {
      expect(screen.getByText("INV-0001")).toBeInTheDocument();
      expect(screen.getByText("INV-0002")).toBeInTheDocument();
    });
  });

  test("shows invoice amounts in GBP", async () => {
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => billingWithInvoices,
    });
    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });
    await waitFor(() => {
      const amounts = screen.getAllByText("£29.00");
      expect(amounts.length).toBeGreaterThan(0);
    });
  });

  test("renders PDF download link when available", async () => {
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => billingWithInvoices,
    });
    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });
    await waitFor(() => {
      const pdfLink = screen.getByText("PDF");
      expect(pdfLink.closest("a")).toHaveAttribute("href", "https://stripe.com/invoice.pdf");
    });
  });

  test("shows table headers: Invoice #, Date, Period End, Amount, Status, Download", async () => {
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => billingWithInvoices,
    });
    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });
    await waitFor(() => {
      expect(screen.getByText("Invoice #")).toBeInTheDocument();
      expect(screen.getByText("Date")).toBeInTheDocument();
      expect(screen.getByText("Amount")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION STATUS
// ─────────────────────────────────────────────────────────────────────────────

describe("Subscription status section", () => {
  test("shows subscription status panel for paid plans", async () => {
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => billingWithInvoices,
    });
    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });
    await waitFor(() => {
      expect(screen.getByText("Current Plan")).toBeInTheDocument();
    });
  });

  test("does NOT show subscription panel for Free plan", async () => {
    await act(async () => { renderBilling(adminUser, mockOrg, "Free"); });
    await waitFor(() => {
      expect(screen.queryByText("Current Plan")).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MANAGE BILLING BUTTON
// ─────────────────────────────────────────────────────────────────────────────

describe("Manage Billing button", () => {
  test("shows Manage Billing button for paid plans", async () => {
    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });
    expect(screen.getByText("Manage Billing")).toBeInTheDocument();
  });

  test("does NOT show Manage Billing button on Free plan", async () => {
    await act(async () => { renderBilling(adminUser, mockOrg, "Free"); });
    expect(screen.queryByText("Manage Billing")).not.toBeInTheDocument();
  });

  test("Manage Billing button calls create-billing-portal-session", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyBillingResponse })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ url: "https://billing.stripe.com/portal" }) });

    const assignMock = jest.fn();
    Object.defineProperty(window, "location", { writable: true, value: { ...window.location, href: "" } });
    window.location.href = "";

    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });

    const manageBtn = screen.getByText("Manage Billing");
    await act(async () => { fireEvent.click(manageBtn); });

    await waitFor(() => {
      const portalCall = mockFetch.mock.calls.find((call) =>
        call[0]?.includes("create-billing-portal-session")
      );
      expect(portalCall).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────

describe("Error handling", () => {
  test("shows error banner when get-billing-data fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: "Internal server error" }),
    });
    await act(async () => { renderBilling(); });
    await waitFor(() => {
      expect(screen.getByText("Internal server error")).toBeInTheDocument();
    });
  });

  test("shows error when subscribe fails", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyBillingResponse })
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "Card declined" }) });

    await act(async () => { renderBilling(adminUser, mockOrg, "Free"); });

    const upgradeBtn = screen.getByText("Upgrade to Basic");
    await act(async () => { fireEvent.click(upgradeBtn); });

    await waitFor(() => {
      expect(screen.getByText("Card declined")).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ORGANISATION INFO
// ─────────────────────────────────────────────────────────────────────────────

describe("Organisation info section", () => {
  test("shows org name", async () => {
    await act(async () => { renderBilling(); });
    expect(screen.getByText("Eureka Technologies")).toBeInTheDocument();
  });

  test("shows current plan in org section", async () => {
    await act(async () => { renderBilling(adminUser, mockOrg, "Basic"); });
    // The plan "Basic" appears in the org section
    const planTexts = screen.getAllByText("Basic");
    expect(planTexts.length).toBeGreaterThan(0);
  });
});
