import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../i18n";
import { ErrorBoundary } from "./ErrorBoundary";

let shouldThrow = true;

function UnstableChild() {
  if (shouldThrow) {
    throw new Error("render failure");
  }
  return <p>Recovered content</p>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the localised fallback and retries the render", () => {
    render(
      <ErrorBoundary>
        <UnstableChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });
});
