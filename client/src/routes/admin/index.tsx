import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, Col, Typography } from "antd";
import { FaUserShield, FaUsers } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { RootState } from "../../store";
import AdminLayout from "../../layouts/Admin";
import { Can } from "../../rbac";

const { Title, Paragraph } = Typography;

export const Route = createFileRoute("/admin/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { t } = useTranslation(["pages"], { keyPrefix: "admin.index" });
  const { account } = useSelector((state: RootState) => state.auth);

  const greeting =
    new Date().getHours() < 12
      ? t("greetings.morning")
      : new Date().getHours() < 18
        ? t("greetings.afternoon")
        : t("greetings.evening");

  return (
    <AdminLayout>
      <Title level={2} style={{ marginBottom: 24 }}>
        {greeting}, {account?.name}
      </Title>
      <Paragraph>{t("description")}</Paragraph>

      <div className="flex gap-2 flex-wrap mt-8 items-stretch justify-center">
        <Can permission="accounts:read">
          <Card
            hoverable
            className="w-1/4"
            onClick={() => navigate({ to: "/admin/accounts" })}
          >
            <div className="flex items-center flex-1 justify-center gap-4 h-full">
              <Col className="text-primary">
                <FaUsers className="text-6xl" />
              </Col>
              <Col>
                <p className="text-2xl font-bold text-primary">
                  {t("items.accounts.title")}
                </p>
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  {t("items.accounts.description")}
                </Paragraph>
              </Col>
            </div>
          </Card>
        </Can>

        <Can permission="roles:read">
          <Card
            hoverable
            className="w-1/4"
            onClick={() => navigate({ to: "/admin/roles" })}
          >
            <div className="flex items-center flex-1 justify-center gap-4 h-full">
              <Col className="text-primary">
                <FaUserShield className="text-6xl" />
              </Col>
              <Col>
                <p className="text-2xl font-bold text-primary">
                  {t("items.roles.title")}
                </p>
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  {t("items.roles.description")}
                </Paragraph>
              </Col>
            </div>
          </Card>
        </Can>
      </div>
    </AdminLayout>
  );
}
