import { Spin } from "antd";
import { useTranslation } from "react-i18next";

/** Loading placeholder for lazily loaded route chunks. */
export function RouteFallback() {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spin size="large" tip={t("loading")}>
        <div className="h-16 w-16" />
      </Spin>
    </div>
  );
}
