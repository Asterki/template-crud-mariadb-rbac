import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { App, Button, Result } from "antd";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import AuthFeature from "../../features/auth";
import type { AppDispatch } from "../../store";

export const Route = createFileRoute("/errors/offline")({
  component: OfflinePage,
});

function OfflinePage() {
  const { t } = useTranslation(["errors"]);
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const navigate = useNavigate();

  const handleRetry = async () => {
    try {
      await dispatch(AuthFeature.actions.fetchMe()).unwrap();
      navigate({ to: "/admin" });
    } catch {
      message.error(t("offline.subtitle"));
    }
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      void handleRetry();
    }, 5000);
    return () => clearTimeout(handle);
    // Retry once after the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <Result
        status="500"
        title={t("offline.title")}
        subTitle={t("offline.subtitle")}
        extra={
          <Button type="primary" onClick={handleRetry}>
            {t("offline.retry")}
          </Button>
        }
      />
    </div>
  );
}
