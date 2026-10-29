import { Button, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import { FaMoon, FaSun } from "react-icons/fa";

import { useThemeMode } from "../theme";

/** Light/dark switch for the admin header. */
export function ThemeModeToggle() {
  const { isDark, toggleMode } = useThemeMode();
  const { t } = useTranslation("common");
  const label = isDark ? t("theme.toLight") : t("theme.toDark");

  return (
    <Tooltip title={label}>
      <Button
        type="text"
        aria-label={label}
        icon={isDark ? <FaSun /> : <FaMoon />}
        onClick={toggleMode}
      />
    </Tooltip>
  );
}
