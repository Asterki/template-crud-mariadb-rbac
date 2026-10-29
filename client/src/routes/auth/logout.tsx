import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { App, Button, Card } from "antd";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import AdminLayout from "../../layouts/Admin";
import AuthFeature from "../../features/auth";
import type { AppDispatch } from "../../store";

export const Route = createFileRoute("/auth/logout")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const { t } = useTranslation(["pages"], { keyPrefix: "auth.logout" });

  const logout = async () => {
    try {
      await dispatch(AuthFeature.actions.logout()).unwrap();
      navigate({ to: "/auth/login" });
    } catch {
      message.error(t("messages.error"));
    }
  };

  return (
    <AdminLayout>
      <main className="min-h-screen flex items-center justify-center">
        <Card>
          <div className="text-2xl font-bold text-center">{t("title")}</div>
          <div className="text-center">
            <p>{t("description")}</p>
            <Button className="mt-4" type="primary" danger onClick={logout}>
              {t("button")}
            </Button>
            <br />
            <Button className="mt-4" onClick={() => navigate({ to: "/admin" })}>
              {t("cancel")}
            </Button>
          </div>
        </Card>
      </main>
    </AdminLayout>
  );
}
