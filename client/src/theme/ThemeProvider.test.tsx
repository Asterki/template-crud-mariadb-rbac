import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import "../i18n";
import { ThemeProvider, useThemeMode } from "./ThemeProvider";

function Probe() {
  const { mode, toggleMode } = useThemeMode();

  return (
    <button type="button" onClick={toggleMode}>
      {mode}
    </button>
  );
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("applies the dark class and persists the choice", async () => {
    renderProvider();

    expect(screen.getByRole("button")).toHaveTextContent("light");

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(window.localStorage.getItem("theme-mode")).toBe("dark");
    expect(screen.getByRole("button")).toHaveTextContent("dark");
  });

  it("restores a persisted dark mode", async () => {
    window.localStorage.setItem("theme-mode", "dark");

    renderProvider();

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(screen.getByRole("button")).toHaveTextContent("dark");
  });

  it("exposes the brand colour and surface variables", async () => {
    renderProvider();

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--brand-primary"),
      ).not.toBe("");
    });
    expect(
      document.documentElement.style.getPropertyValue("--color-bg"),
    ).not.toBe("");
    expect(
      document.documentElement.style.getPropertyValue("--color-text"),
    ).not.toBe("");
  });
});
