"use client";

import { useRouter } from "next/navigation";
import { getCurrentUser, logoutUser } from "../lib/userManagement";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showLogout?: boolean;
}

export default function PageHeader({
  title,
  subtitle,
  showBack = true,
  showLogout = true
}: PageHeaderProps) {
  const router = useRouter();
  const currentUser = getCurrentUser();

  const handleBack = () => {
    router.back();
  };

  const handleLogout = () => {
    logoutUser();
    router.push("/");
  };

  return (
    <div className="page-header">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "#2563eb",
                padding: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              aria-label="Go back"
              title="Go back to previous page"
            >
              ←
            </button>
          )}
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
            {currentUser && (
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Session: <strong>{currentUser.username}</strong> ({currentUser.role})
              </p>
            )}
          </div>
        </div>
      </div>
      {showLogout && (
        <button className="second-button" onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          Logout
        </button>
      )}
    </div>
  );
}
