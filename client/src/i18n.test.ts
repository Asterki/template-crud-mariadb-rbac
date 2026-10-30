import { describe, expect, it } from "vitest";

import i18n, { LANGUAGE_STORAGE_KEY, NAMESPACES, resources } from "./i18n";
import { apiErrorKey, translateApiError } from "./i18n/errors";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result.set(path, value);
    } else {
      for (const [childKey, childValue] of flatten(value, path)) {
        result.set(childKey, childValue);
      }
    }
  }

  return result;
}

function localeKeys(locale: "en" | "es"): Map<string, string> {
  const result = new Map<string, string>();

  for (const namespace of NAMESPACES) {
    const tree = resources[locale][namespace] as Tree;
    for (const [key, value] of flatten(tree)) {
      result.set(`${namespace}:${key}`, value);
    }
  }

  return result;
}

describe("locale packs", () => {
  const en = localeKeys("en");
  const es = localeKeys("es");

  it("has every English key in Spanish and vice versa", () => {
    expect([...es.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it("contains no empty translations", () => {
    for (const [key, value] of [...en, ...es]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("registers every namespace", () => {
    for (const namespace of NAMESPACES) {
      expect(i18n.hasResourceBundle("en", namespace)).toBe(true);
      expect(i18n.hasResourceBundle("es", namespace)).toBe(true);
    }
  });
});

describe("API error lookup", () => {
  it("maps every known server code to an errors key", () => {
    expect(apiErrorKey({ code: "last-admin" })).toBe("codes.lastAdmin");
    expect(apiErrorKey({ code: "not_found" })).toBe("codes.notFound");
    expect(apiErrorKey({ code: "service-unavailable" })).toBe(
      "codes.serviceUnavailable",
    );
    expect(apiErrorKey({ code: "something-new" })).toBe("codes.unknown");
  });

  it("translates a code in the active language", async () => {
    const t = i18n.getFixedT("es", "errors");
    expect(translateApiError(t, { code: "last-admin" })).toContain(
      "último administrador",
    );
  });
});

describe("language persistence", () => {
  it("updates <html lang> and localStorage when the language changes", async () => {
    await i18n.changeLanguage("es");

    expect(document.documentElement.lang).toBe("es");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("es");

    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
