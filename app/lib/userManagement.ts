// User management types and utilities
export type UserRole = 'admin' | 'supervisor' | 'operator' | 'user';

export interface User {
  id: string;
  username: string;
  password: string; // In production, this should be hashed
  role: UserRole;
  permissions?: string[];
  email?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

// Default admin user
const DEFAULT_ADMIN: User = {
  id: 'admin-1',
  username: 'admin',
  password: '1234', // Default password
  role: 'admin',
  permissions: [
    'receive_goods',
    'move_stock',
    'print_labels',
    'manage_locations',
    'manage_inventory',
    'view_reports',
    'create_shipments',
    'adjust_inventory',
  ],
  email: 'admin@warehouse.com',
  createdAt: new Date().toISOString(),
};

const USERS_STORAGE_KEY = 'warehouse_users';
const CURRENT_USER_KEY = 'warehouse_current_user';

// Initialize default users if none exist
export function initializeUsers(): void {
  if (typeof window === 'undefined') return;

  const existingUsers = localStorage.getItem(USERS_STORAGE_KEY);
  if (!existingUsers) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([DEFAULT_ADMIN]));
  }
}

// Get all users
export function getAllUsers(): User[] {
  if (typeof window === 'undefined') return [DEFAULT_ADMIN];

  const users = localStorage.getItem(USERS_STORAGE_KEY);
  return users ? JSON.parse(users) : [DEFAULT_ADMIN];
}

// Save users
function saveUsers(users: User[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// Create new user
export function createUser(username: string, password: string, role: UserRole = 'user', permissions: string[] = []): User {
  const users = getAllUsers();

  // Check if username already exists
  if (users.some(u => u.username === username)) {
    throw new Error('Username already exists');
  }

  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    username,
    password,
    role,
    permissions,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);
  return newUser;
}

// Update user
export function updateUser(userId: string, updates: Partial<User>): boolean {
  const users = getAllUsers();
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) return false;

  users[userIndex] = { ...users[userIndex], ...updates };
  saveUsers(users);
  return true;
}

// Delete user
export function deleteUser(userId: string): boolean {
  const users = getAllUsers();
  const filteredUsers = users.filter(u => u.id !== userId);

  if (filteredUsers.length === users.length) return false;

  saveUsers(filteredUsers);
  return true;
}

// Authenticate user
export function authenticateUser(username: string, password: string): User | null {
  const users = getAllUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    updateUser(user.id, { lastLogin: new Date().toISOString() });
    setCurrentUser({ ...user, lastLogin: new Date().toISOString() });
    return user;
  }

  return null;
}

export function changePassword(username: string, currentPassword: string, newPassword: string): boolean {
  const users = getAllUsers();
  const user = users.find(u => u.username === username && u.password === currentPassword);

  if (!user) {
    return false;
  }

  updateUser(user.id, { password: newPassword });
  if (getCurrentUser()?.id === user.id) {
    setCurrentUser({ ...user, password: newPassword });
  }
  return true;
}

// Get current user
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;

  const currentUser = localStorage.getItem(CURRENT_USER_KEY);
  return currentUser ? JSON.parse(currentUser) : null;
}

// Set current user
export function setCurrentUser(user: User | null): void {
  if (typeof window === 'undefined') return;

  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

// Logout user
export function logoutUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CURRENT_USER_KEY);
}

// Check if user has permission
export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;

  if (user.role === 'admin') return true;

  return user.permissions?.includes(permission) || false;
}

// Reset password
export function resetPassword(userId: string, newPassword: string): boolean {
  return updateUser(userId, { password: newPassword });
}

// Get user by ID
export function getUserById(userId: string): User | null {
  const users = getAllUsers();
  return users.find(u => u.id === userId) || null;
}