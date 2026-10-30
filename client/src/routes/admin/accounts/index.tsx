import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { RouteFallback } from "../../../components/RouteFallback";

const AccountsPage = lazy(
  () => import("../../../features/accounts/components/AccountsPage"),
);

export const Route = createFileRoute("/admin/accounts/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <AccountsPage />
    </Suspense>
  );
}
