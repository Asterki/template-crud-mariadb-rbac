import { createFileRoute } from "@tanstack/react-router";

import AdminPageLayout from "../../layouts/Admin";
import { RequirePermission } from "../../rbac";
import { ItemsPage } from "../../features/items";

export const Route = createFileRoute("/admin/items")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AdminPageLayout selectedPage="items">
      <RequirePermission permission="items:read">
        <ItemsPage />
      </RequirePermission>
    </AdminPageLayout>
  );
}
