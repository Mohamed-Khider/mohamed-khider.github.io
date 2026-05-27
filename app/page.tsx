"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticateUser, changePassword, getCurrentUser, initializeUsers } from "./lib/userManagement";
import NotificationModal from "./components/NotificationModal";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadAuth = async () => {
      await initializeUsers();

      const currentUser = getCurrentUser();
      if (currentUser && !currentUser.mustChangePassword) {
        router.replace("/main");
      }
    };

    loadAuth();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
      const user = await authenticateUser(username, password);
      if (user?.mustChangePassword) {
        setResetUsername(user.username);
        setCurrentPassword(password);
        setShowResetPassword(true);
        setError("You must change the default or temporary password before continuing.");
        return;
      }

      if (user) {
        router.push("/main");
      } else {
        setError("Invalid username or password");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    }
  };

  const handlePasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!resetUsername.trim() || !currentPassword.trim()) {
      setError("Enter username and current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const success = await changePassword(resetUsername.trim(), currentPassword, newPassword);
      if (!success) {
        setError("Current password is incorrect or user does not exist.");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
      return;
    }

    setNotification({
      title: "Password Updated",
      message: "Your password was updated successfully. Please log in with your new password.",
      type: "success",
    });
    setShowResetPassword(false);
    setResetUsername("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: "32px auto" }}>
        <div className="page-header">
          <div>
            <h1>Warehouse Login</h1>
            <p>Secure access for warehouse label generation.</p>
          </div>
        </div>

        {!showResetPassword ? (
          <>
            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label htmlFor="user">Username</label>
                <input
                  id="user"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="pass">Password</label>
                <input
                  id="pass"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              {error && (
                <div style={{ color: "#dc2626", fontSize: "14px", marginBottom: "16px" }}>
                  {error}
                </div>
              )}

              <button className="primary-button full-width" type="submit">
                Login
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => setShowResetPassword(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: "14px"
                }}
              >
                Forgot Password?
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handlePasswordReset}>
              <div className="form-field">
                <label htmlFor="resetUsername">Username</label>
                <input
                  id="resetUsername"
                  type="text"
                  value={resetUsername}
                  onChange={(event) => setResetUsername(event.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                  required
                />
                <p style={{ color: "#6b7280", fontSize: "12px", marginTop: "6px" }}>
                  Use at least 10 characters with uppercase, lowercase, number, and symbol.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              {error && (
                <div style={{ color: "#dc2626", fontSize: "14px", marginBottom: "16px" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowResetPassword(false)}
                  style={{
                    flex: 1,
                    background: "#6b7280",
                    color: "white",
                    border: "none",
                    padding: "14px",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit" style={{ flex: 1 }}>
                  Reset Password
                </button>
              </div>
            </form>
          </>
        )}
        <NotificationModal
          open={!!notification}
          title={notification?.title ?? "Notification"}
          message={notification?.message ?? ""}
          type={notification?.type ?? "info"}
          onClose={() => setNotification(null)}
        />
      </div>
    </div>
  );
}
