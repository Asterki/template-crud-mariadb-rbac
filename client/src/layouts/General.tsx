import { Layout, Space } from "antd";
import { useTranslation } from "react-i18next";
import { APP_LOGO, APP_NAME } from "@template/shared";

import { LanguageSwitcher } from "../components/LanguageSwitcher";

interface LayoutProps {
  children: React.ReactNode;
}

export default function GeneralLayout({ children }: LayoutProps) {
  const { t } = useTranslation("common");
  const { Header, Content, Footer } = Layout;

  return (
    <Layout className="min-h-screen">
      {/* Top Navbar */}
      <Header className="px-4 flex items-center justify-between bg-white">
        <Space align="center" className="" size={14}>
          <img
            src={APP_LOGO}
            alt=""
            style={{ width: 42, height: 42, objectFit: "contain" }}
          />
          <div className="text-white">
            <h1 style={{ margin: 0 }} className="text-white font-bold text-lg">
              {APP_NAME}
            </h1>
          </div>
        </Space>
        <LanguageSwitcher />
      </Header>

      <Content className="p-5 flex justify-center items-center">
        {children}
      </Content>

      <Footer className="text-center border-t border-[#262a33] bg-transparent">
        {t("footer.madeBy")}{" "}
        <a href="https://asterki.xyz" target="_blank" className="underline">
          {t("footer.author")}
        </a>{" "}
        | {new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}
