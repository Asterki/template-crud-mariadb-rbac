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
  const { t } = useTranslation("common");
  const { t: tAccounts } = useTranslation("accounts");
  const { t: tRoles } = useTranslation("roles");
  const { account } = useSelector((state: RootState) => state.auth);

  const greeting =
    new Date().getHours() < 12
      ? t("dashboard.greetings.morning")
      : new Date().getHours() < 18
        ? t("dashboard.greetings.afternoon")
        : t("dashboard.greetings.evening");

  return (
    <AdminLayout>
      <Title level={2} className="!mb-6">
        {greeting}, {account?.name}
      </Title>
      <Paragraph>{t("dashboard.description")}</Paragraph>

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
                  {tAccounts("title")}
                </p>
                <Paragraph type="secondary" className="!m-0">
                  {tAccounts("description")}
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
                  {tRoles("title")}
                </p>
                <Paragraph type="secondary" className="!m-0">
                  {tRoles("description")}
                </Paragraph>
              </Col>
            </div>
          </Card>
        </Can>
      </div>
    </AdminLayout>
  );
}
