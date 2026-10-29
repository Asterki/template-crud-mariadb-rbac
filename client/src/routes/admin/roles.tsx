import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { App, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import type { RolePermissionsEntry } from "@template/shared";

import AdminPageLayout from "../../layouts/Admin";
import { RequirePermission } from "../../rbac";
import rolesApiClient from "../../features/roles/api";
import { normalizeApiError } from "../../utils/api";

const { Title, Text } = Typography;

export const Route = createFileRoute("/admin/roles")({
  component: RouteComponent,
});

const ROLE_COLORS: Record<string, string> = {
  admin: "red",
  manager: "gold",
  staff: "blue",
  viewer: "default",
};

function RouteComponent() {
  const { t } = useTranslation(["pages"], { keyPrefix: "admin.roles" });
  const { t: tPermissions } = useTranslation(["permissions"]);
  const { message } = App.useApp();
  const [rows, setRows] = useState<RolePermissionsEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void rolesApiClient
      .list()
      .then((response) => setRows(response.data))
      .catch((error: unknown) => {
        const normalized = normalizeApiError(error);
        message.error(
          t(`error-messages:${normalized.message}`, {
            defaultValue: normalized.message,
          }),
        );
      })
      .finally(() => setLoading(false));
  }, [message, t]);

  const columns: ColumnsType<RolePermissionsEntry> = [
    {
      title: t("table.role"),
      dataIndex: "role",
      key: "role",
      render: (role: string) => <Tag color={ROLE_COLORS[role]}>{role}</Tag>,
    },
    {
      title: t("table.permissions"),
      dataIndex: "permissions",
      key: "permissions",
      render: (permissions: RolePermissionsEntry["permissions"]) => (
        <Space wrap>
          {permissions.map((permission) => (
            <Tag key={permission}>
              {tPermissions(permission.replace(":", "."), {
                defaultValue: permission,
              })}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <AdminPageLayout selectedPage="roles">
      <RequirePermission permission="roles:read">
        <Title>{t("title")}</Title>
        <Text>{t("description")}</Text>
        <Table<RolePermissionsEntry>
          className="mt-4"
          rowKey="role"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={false}
        />
      </RequirePermission>
    </AdminPageLayout>
  );
}
