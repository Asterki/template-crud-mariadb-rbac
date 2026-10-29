import { useEffect, useState } from "react";
import { Alert, Button, Empty, Menu, Spin, Typography } from "antd";
import { FaDatabase } from "react-icons/fa";
import { useTranslation } from "react-i18next";

import { RequirePermission } from "../../../rbac";
import { useDoc } from "../hooks/useDoc";
import { useDocsManifest } from "../hooks/useDocsManifest";
import { DocsViewer } from "./DocsViewer";

const { Title, Text } = Typography;

function DocsContent() {
  const { t } = useTranslation("docs");
  const manifest = useDocsManifest();
  const [slug, setSlug] = useState("index");
  const doc = useDoc(slug);

  useEffect(() => {
    if (manifest.data.length === 0) return;
    if (!manifest.data.some((entry) => entry.slug === slug)) {
      setSlug(manifest.data[0]!.slug);
    }
  }, [manifest.data, slug]);

  if (manifest.loading) {
    return (
      <div className="text-center py-10">
        <Spin size="large" />
        <p>{t("loading")}</p>
      </div>
    );
  }

  if (manifest.error) {
    return (
      <Alert
        type="error"
        showIcon
        message={t("loadError")}
        description={manifest.error.code}
        action={
          <Button size="small" onClick={manifest.reload}>
            {t("retry")}
          </Button>
        }
      />
    );
  }

  if (manifest.data.length === 0) {
    return <Empty description={t("empty")} />;
  }

  const hasDatabase = manifest.data.some((entry) => entry.slug === "database");

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside>
        <Title level={3} className="!mb-2">
          {t("title")}
        </Title>
        <Text type="secondary">{t("description")}</Text>

        {hasDatabase ? (
          <Button
            type="primary"
            block
            icon={<FaDatabase />}
            className="mt-4"
            onClick={() => setSlug("database")}
          >
            {t("switchDatabase")}
          </Button>
        ) : null}

        <Menu
          mode="inline"
          className="mt-4"
          selectedKeys={[slug]}
          items={manifest.data.map((entry) => ({
            key: entry.slug,
            label: entry.title,
          }))}
          onClick={({ key }) => setSlug(key)}
        />
        <Text type="secondary" className="mt-4 block text-xs">
          {t("contentLanguage")}
        </Text>
      </aside>

      <section className="min-w-0">
        {doc.loading ? (
          <div className="text-center py-10">
            <Spin />
            <p>{t("loading")}</p>
          </div>
        ) : doc.error ? (
          <Alert
            type="error"
            showIcon
            message={t("pageError")}
            description={doc.error.code}
            action={
              <Button size="small" onClick={doc.reload}>
                {t("retry")}
              </Button>
            }
          />
        ) : doc.data ? (
          <DocsViewer markdown={doc.data.markdown} tocLabel={t("toc")} />
        ) : (
          <Empty description={t("empty")} />
        )}
      </section>
    </div>
  );
}

/** Docs page. The guard runs before any data is fetched. */
export function DocsPage() {
  return (
    <RequirePermission permission="docs:read">
      <DocsContent />
    </RequirePermission>
  );
}
