import { Select } from "antd";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LOCALES, type SupportedLocale } from "../config/brand";

/** Language switch that keeps i18next, AntD and <html lang> in sync. */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation("common");
  const current = (i18n.resolvedLanguage ?? i18n.language)
    .split("-")[0] as SupportedLocale;

  return (
    <Select<SupportedLocale>
      size="small"
      className="w-28"
      aria-label={t("language.label")}
      value={SUPPORTED_LOCALES.includes(current) ? current : "en"}
      onChange={(language) => {
        void i18n.changeLanguage(language);
      }}
      options={SUPPORTED_LOCALES.map((language) => ({
        value: language,
        label: t(`language.${language}`),
      }))}
    />
  );
}
