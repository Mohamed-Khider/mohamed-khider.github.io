"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getCurrentUser,
  setCurrentUser,
  User,
  UserRole
} from "../lib/userManagement";

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "user" as UserRole,
    permissions: [] as string[]
  });
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      router.replace("/main");
      return;
    }

    loadUsers();
  }, [router]);

  const loadUsers = () => {
    const allUsers = getAllUsers();
    setUsers(allUsers);
  };

  const handleCreateUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const username = formData.username.trim();
    if (username.length < 3) {
      setError("Username must be at least 3 characters long");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    try {
      createUser(username, formData.password, formData.role, formData.permissions);
      loadUsers();
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const handleUpdateUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!editingUser) return;

    const username = formData.username.trim();
    if (username.length < 3) {
      setError("Username must be at least 3 characters long");
      return;
    }

    if (formData.password && formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    const users = getAllUsers();
    const conflictingUser = users.find((user) => user.username === username && user.id !== editingUser.id);
    if (conflictingUser) {
      setError("A user with that username already exists.");
      return;
    }

    try {
      const changed = updateUser(editingUser.id, {
        username,
        role: formData.role,
        permissions: formData.permissions,
        ...(formData.password && { password: formData.password })
      });

      if (!changed) {
        throw new Error("User update failed");
      }

      if (getCurrentUser()?.id === editingUser.id) {
        setCurrentUser({
          ...editingUser,
          username,
          role: formData.role,
          permissions: formData.permissions,
          ...(formData.password ? { password: formData.password } : {})
        });
      }

      loadUsers();
      setEditingUser(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        deleteUser(userId);
        loadUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete user");
      }
    }
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "",
      role: user.role,
      permissions: user.permissions || []
    });
  };

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      role: "user",
      permissions: []
    });
    setError("");
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setShowCreateForm(false);
    resetForm();
  };

  return (
    <ProtectedPage requireAdmin={true}>
      <div className="container">
        <PageHeader
          title="Admin Dashboard"
          subtitle="Manage users and permissions"
          showBack={true}
          showLogout={true}
        />

        <div style={{ marginTop: "20px", marginBottom: "20px" }}>
          <button
            className="primary-button"
            onClick={() => setShowCreateForm(true)}
          >
            Create User
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: "#fef2f2",
            color: "#dc2626",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #fecaca"
          }}>
            {error}
          </div>
        )}

        {(showCreateForm || editingUser) && (
          <div className="card" style={{ marginBottom: "20px" }}>
            <h3>{editingUser ? "Edit User" : "Create New User"}</h3>
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
              <div className="form-field">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="password">
                  {editingUser ? "New Password (leave empty to keep current)" : "Password"}
                </label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                />
              </div>

              <div className="form-field">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                >
                  <option value="user">User</option>
                  <option value="operator">Operator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="form-field">
                <label>Permissions</label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {['receive_goods', 'move_stock', 'print_labels', 'manage_locations', 'view_reports', 'manage_inventory', 'create_shipments', 'adjust_inventory'].map((permission) => (
                    <label key={permission} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(permission)}
                        onChange={(e) => {
                          const newPermissions = e.target.checked
                            ? [...formData.permissions, permission]
                            : formData.permissions.filter(p => p !== permission);
                          setFormData({ ...formData, permissions: newPermissions });
                        }}
                      />
                      {permission.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button type="submit" className="primary-button">
                  {editingUser ? "Update User" : "Create User"}
                </button>
                <button type="button" onClick={cancelEdit} style={{
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <h3>Users</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "12px" }}>Username</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Role</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Permissions</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Created</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px" }}>{user.username}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        backgroundColor: user.role === 'admin' ? '#fef3c7' : '#f3f4f6',
                        color: user.role === 'admin' ? '#92400e' : '#374151',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      {user.permissions?.length ? user.permissions.join(", ") : "None"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => startEditUser(user)}
                          style={{
                            background: "#3b82f6",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1}
                          style={{
                            background: "#dc2626",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            cursor: user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1 ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            opacity: user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1 ? 0.5 : 1
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}