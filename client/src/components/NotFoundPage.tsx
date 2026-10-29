import { Button, Result } from "antd";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/** Shared 404 UI used by the router's not-found handler and the 404 route. */
export function NotFoundPage() {
  const { t } = useTranslation("errors");
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Result
        status="404"
        title={t("404.title")}
        subTitle={t("404.description")}
        extra={
          <Button type="primary" onClick={() => navigate({ to: "/" })}>
            {t("404.back")}
          </Button>
        }
      />
    </div>
  );
}
