import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// A component that always throws
function ThrowingComponent({ error }) {
  throw error;
}

// Suppress React error boundary console errors during tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <div data-testid="child">Hello</div>
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders fallback UI when a child throws", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowingComponent error={new Error("Test crash")} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it("shows the generic error description in the fallback UI", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowingComponent error={new Error("Specific failure")} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    // ErrorBoundary shows a generic message rather than the raw error text
    expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
  });
});
