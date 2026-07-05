"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, hasPermission, logoutUser } from "../lib/userManagement";
import PrinterManagerButton from "./PrinterManagerButton";
import Icon from "./Icon";

interface AppShellProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: string;
  adminOnly?: boolean;
  group: "Operations" | "Labels" | "Control";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/main", label: "Dashboard", icon: "dashboard", group: "Operations" },
  { href: "/receive", label: "Receive", icon: "inventory_2", permission: "receive_goods", group: "Operations" },
  { href: "/locations", label: "Locations", icon: "location_on", permission: "manage_locations", group: "Operations" },
  { href: "/stock-movement", label: "Move Stock", icon: "swap_horiz", permission: "move_stock", group: "Operations" },
  { href: "/shipments", label: "Shipments", icon: "local_shipping", permission: "create_shipments", group: "Operations" },
  { href: "/cycle-count", label: "Cycle Count", icon: "fact_check", permission: "adjust_inventory", group: "Operations" },
  { href: "/packing", label: "Packing", icon: "inventory", group: "Operations" },
  { href: "/labels", label: "Label Hub", icon: "label", permission: "print_labels", group: "Labels" },
  { href: "/generate-barcode", label: "Single Barcode", icon: "qr_code", permission: "print_labels", group: "Labels" },
  { href: "/generate-multi-barcode", label: "Bulk Barcodes", icon: "grid_view", permission: "print_labels", group: "Labels" },
  { href: "/pallet", label: "Pallet Labels", icon: "view_in_ar", permission: "print_labels", group: "Labels" },
  { href: "/section", label: "Section Labels", icon: "pin_drop", permission: "print_labels", group: "Labels" },
  { href: "/printer-settings", label: "Printers", icon: "print", permission: "print_labels", group: "Control" },
  { href: "/reports", label: "Reports", icon: "monitoring", permission: "view_reports", group: "Control" },
  { href: "/admin", label: "Admin", icon: "admin_panel_settings", adminOnly: true, group: "Control" },
];

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = getCurrentUser();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.adminOnly) return currentUser?.role === "admin";
      if (!item.permission) return true;
      return hasPermission(currentUser, item.permission);
    });
  }, [currentUser]);

  const groups = useMemo(() => {
    return visibleItems.reduce<Record<NavItem["group"], NavItem[]>>(
      (result, item) => {
        result[item.group].push(item);
        return result;
      },
      { Operations: [], Labels: [], Control: [] }
    );
  }, [visibleItems]);

  useEffect(() => {
    const updateViewport = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(false);
      }
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("warehouse-sidebar-collapsed");
    if (saved) {
      setCollapsed(saved === "true");
    }
  }, []);

  useEffect(() => {
    if (!isMobile) {
      window.localStorage.setItem("warehouse-sidebar-collapsed", String(collapsed));
    }
  }, [collapsed, isMobile]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const navigate = (href: string) => {
    setDrawerOpen(false);
    router.push(href);
  };

  const handleLogout = () => {
    logoutUser();
    router.push("/");
  };

  return (
    <div className="app-shell">
      <aside className={`side-drawer ${collapsed && !isMobile ? "collapsed" : ""} ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-brand">
          <button
            className="brand-toggle"
            type="button"
            onClick={() => {
              if (isMobile) {
                setDrawerOpen(false);
              } else {
                setCollapsed((value) => !value);
              }
            }}
            aria-label={collapsed && !isMobile ? "Expand navigation" : "Collapse navigation"}
            title={collapsed && !isMobile ? "Expand navigation" : "Collapse navigation"}
          >
            <Icon name={collapsed && !isMobile ? "chevron_right" : "chevron_left"} size={18} />
          </button>
          <div className="brand-copy">
            <strong>Warehouse OS</strong>
            <span>WMS Console</span>
          </div>
        </div>

        <nav className="drawer-nav" aria-label="Warehouse navigation">
          {(Object.keys(groups) as Array<NavItem["group"]>).map((group) => (
            groups[group].length > 0 && (
              <div className="drawer-group" key={group}>
                {!collapsed || isMobile ? <div className="drawer-group-title">{group}</div> : null}
                {groups[group].map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <button
                      className={`drawer-link ${active ? "active" : ""}`}
                      key={item.href}
                      onClick={() => navigate(item.href)}
                      type="button"
                      title={collapsed && !isMobile ? item.label : undefined}
                    >
                      <span className="drawer-icon-wrap">
                        <Icon name={item.icon} size={20} />
                      </span>
                      {!collapsed || isMobile ? <span className="drawer-link-label">{item.label}</span> : null}
                    </button>
                  );
                })}
              </div>
            )
          ))}
        </nav>

        <div className="drawer-user">
          <div className="drawer-user-copy">
            <strong>{currentUser?.username ?? "Operator"}</strong>
            <span>{currentUser?.role ?? "user"}</span>
          </div>
          <button type="button" onClick={handleLogout} title="Logout" aria-label="Logout">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      {drawerOpen && <button className="drawer-scrim" onClick={() => setDrawerOpen(false)} aria-label="Close menu" />}

      <div className="app-main">
        <header className="topbar">
          <button className="drawer-toggle" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={20} />
          </button>
          <div className="topbar-search">
            <Icon name="search" size={18} />
            <span>Scan, receive, move, pack, print</span>
          </div>
          <div className="topbar-status">
            <span className="status-dot" />
            <span>Local mode</span>
          </div>
          <PrinterManagerButton />
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
