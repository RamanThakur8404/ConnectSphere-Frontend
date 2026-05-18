import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Unit tests for auth-utils.js ──────────────────────────────────────────────
import { isAdminRole, resolvePostLoginPath } from "@/lib/auth-utils";

describe("isAdminRole", () => {
  it('returns true for "ADMIN"', () => {
    expect(isAdminRole("ADMIN")).toBe(true);
  });

  it('returns true for "ROLE_ADMIN"', () => {
    expect(isAdminRole("ROLE_ADMIN")).toBe(true);
  });

  it("returns false for regular user role", () => {
    expect(isAdminRole("USER")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe("resolvePostLoginPath", () => {
  it("routes admin user to /admin by default", () => {
    const user = { role: "ADMIN" };
    expect(resolvePostLoginPath(user, null)).toBe("/admin");
  });

  it("routes regular user to /feed by default", () => {
    const user = { role: "USER" };
    expect(resolvePostLoginPath(user, null)).toBe("/feed");
  });

  it("respects a requested non-auth path", () => {
    const user = { role: "USER" };
    expect(resolvePostLoginPath(user, "/bookmarks")).toBe("/bookmarks");
  });

  it("prevents non-admin from accessing /admin", () => {
    const user = { role: "USER" };
    expect(resolvePostLoginPath(user, "/admin")).toBe("/feed");
  });

  it("ignores /auth/* requested paths", () => {
    const user = { role: "USER" };
    expect(resolvePostLoginPath(user, "/auth/login")).toBe("/feed");
  });
});
