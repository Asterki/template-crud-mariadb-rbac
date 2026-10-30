import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

import AdminPageLayout from "../../layouts/Admin";
import { RouteFallback } from "../../components/RouteFallback";
import { RequirePermission } from "../../rbac";

const ItemsPage = lazy(() => import("../../features/items/components/ItemsPage"));

export const Route = createFileRoute("/admin/items")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AdminPageLayout selectedPage="items">
      <RequirePermission permission="items:read">
        <Suspense fallback={<RouteFallback />}>
          <ItemsPage />
        </Suspense>
      </RequirePermission>
    </AdminPageLayout>
  );
}
