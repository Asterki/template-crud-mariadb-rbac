import { createFileRoute } from "@tanstack/react-router";

import AdminPageLayout from "../../layouts/Admin";
import { DocsPage } from "../../features/docs";

export const Route = createFileRoute("/admin/docs")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AdminPageLayout selectedPage="docs">
      <DocsPage />
    </AdminPageLayout>
  );
}
