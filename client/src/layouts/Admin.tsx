import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import {
  ConfigProvider,
  Drawer,
  Layout,
  Menu,
  type MenuProps,
  Space,
  Spin,
  Typography,
} from "antd";
const { Title } = Typography;
import esES from "antd/locale/es_ES";

import {
  FaBars,
  FaCompressArrowsAlt,
  FaKey,
  FaRegArrowAltCircleLeft,
  FaUserShield,
  FaUsers,
} from "react-icons/fa";

import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { APP_LOGO, APP_NAME } from "@template/shared";

import AuthFeature from "../features/auth";
import { useCan } from "../rbac";
import { authRedirect } from "../rbac/guards";
import type { RootState } from "../store";

const { Header, Sider } = Layout;

interface LayoutProps {
  children: React.ReactNode;
  selectedPage?: string;
  defaultCollapsed?: boolean;
  removePadding?: boolean;
}

export default function PageLayout({
  children,
  selectedPage,
  removePadding,
  defaultCollapsed,
}: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation(["layouts"], { keyPrefix: "admin" });
  const { can } = useCan();

  const { account } = useSelector((state: RootState) => state.auth);

  const [collapsed, setCollapsed] = useState(defaultCollapsed || false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    if (account) return;
    void dispatch(AuthFeature.actions.fetchMe())
      .unwrap()
      .catch(() => {
        navigate({ to: "/auth/login" });
      });
  }, [account, dispatch, navigate]);

  useEffect(() => {
    if (!account) return;
    const target = authRedirect(account, location.pathname);
    if (target && target !== location.pathname) {
      navigate({ to: target });
    }
  }, [account, location.pathname, navigate]);

  type MenuItem = Required<MenuProps>["items"][number];
  const menuItems = useMemo<MenuItem[]>(() => {
    if (!account) return [];

    const items: MenuItem[] = [
      {
        key: "dashboard",
        label: <Link to="/admin">{t("sidebar.dashboard")}</Link>,
        icon: <FaCompressArrowsAlt />,
      },
    ];

    if (can("accounts:read")) {
      items.push({
        key: "accounts",
        label: <Link to="/admin/accounts">{t("sidebar.accounts")}</Link>,
        icon: <FaUsers />,
      });
    }

    if (can("roles:read")) {
      items.push({
        key: "roles",
        label: <Link to="/admin/roles">{t("sidebar.roles")}</Link>,
        icon: <FaUserShield />,
      });
    }

    items.push(
      {
        key: "change-password",
        label: (
          <Link to="/admin/change-password">{t("sidebar.changePassword")}</Link>
        ),
        icon: <FaKey />,
      },
      {
        key: "logout",
        label: (
          <Link to="/auth/logout" className="text-red-500">
            {t("sidebar.logout")}
          </Link>
        ),
        danger: true,
        icon: <FaRegArrowAltCircleLeft className="text-red-300" />,
      },
    );

    return items;
  }, [account, can, t]);

  return (
    <ConfigProvider locale={esES}>
      <Header
        className="px-4 flex items-center justify-between color-white"
        style={{ paddingInline: 16 }}
      >
        <div className="md:hidden block">
          <button
            type="button"
            onClick={() => setDrawerVisible(true)}
            className="md:hidden text-xl block text-white"
            aria-label="Menu"
          >
            <FaBars />
          </button>
        </div>
        <Space align="center" size={14}>
          <img
            src={APP_LOGO}
            alt=""
            style={{ width: 42, height: 42, objectFit: "contain" }}
          />
          <Title level={1} style={{ margin: 0 }} className="text-white text-lg">
            {APP_NAME}
          </Title>
        </Space>
      </Header>

      <Layout hasSider>
        <Sider
          breakpoint="md"
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          className="hidden md:block"
          theme="light"
          width={220}
        >
          <Menu
            mode="inline"
            defaultOpenKeys={["management"]}
            defaultSelectedKeys={[selectedPage || "dashboard"]}
            items={menuItems}
            className="h-full"
          />
        </Sider>

        <Drawer
          title="Menu"
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
        >
          <Menu
            mode="inline"
            defaultSelectedKeys={[selectedPage || "dashboard"]}
            items={menuItems}
            onClick={() => setDrawerVisible(false)}
          />
        </Drawer>

        <Layout style={{ background: "transparent" }} className="min-h-screen">
          <div
            className={`${removePadding ? "" : "p-4"} dark:text-white min-h-[calc(100vh-64px)] z-10`}
          >
            {account ? (
              children
            ) : (
              <div className="text-center text-lg text-gray-500">
                <Spin size="large" />
              </div>
            )}
          </div>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

type AppDispatch = typeof import("../store").store.dispatch;
