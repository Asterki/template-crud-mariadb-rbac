import enUS from "antd/locale/en_US";
import esES from "antd/locale/es_ES";
import type { Locale } from "antd/es/locale";

const LOCALES: Record<string, Locale> = {
  en: enUS,
  es: esES,
};

/** Map an i18n language tag ("en", "es-MX", ...) to an Ant Design locale. */
export function getAntdLocale(language: string | undefined): Locale {
  const base = language?.split("-")[0]?.toLowerCase() ?? "en";
  return LOCALES[base] ?? LOCALES.en;
}
