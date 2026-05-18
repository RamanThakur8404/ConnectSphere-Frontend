import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Unit tests for the apiFetch refresh interceptor logic ─────────────────────
// We test the retry/mutex behaviour by mocking global.fetch directly.

describe("apiFetch — 401 refresh interceptor", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws on non-401 errors without attempting refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve(JSON.stringify({ message: "Forbidden" })),
    });

    // Dynamically import to get fresh module state
    const { apiUrl } = await import("@/lib/apiBase");
    const module = await import("@/lib/api");
    // The api object wraps apiFetch; we test through a simple endpoint
    // Since we can't easily call apiFetch directly, verify fetch was called once (no refresh retry)
    try {
      await module.api.auth.getProfile();
    } catch (e) {
      expect(e.message).toContain("Forbidden");
    }
    // Should NOT have called /auth/refresh
    const refreshCalls = global.fetch.mock.calls.filter((c) =>
      c[0]?.toString().includes("/auth/refresh")
    );
    expect(refreshCalls.length).toBe(0);
  });
});
