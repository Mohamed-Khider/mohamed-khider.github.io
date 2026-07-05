import { readJson, removeStorageItem, writeJson } from "./storage";

export type UserRole = "admin" | "supervisor" | "operator" | "user";

export interface User {
  id: string;
  username: string;
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  passwordChangedAt?: string;
  mustChangePassword?: boolean;
  failedLoginCount?: number;
  lockedUntil?: string;
  role: UserRole;
  permissions?: string[];
  email?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  createdAt: string;
  lastActivityAt: string;
  userAgent: string;
  deviceLabel: string;
  revokedAt?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  session: AuthSession | null;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const USERS_STORAGE_KEY = "warehouse_users";
const AUTH_STATE_KEY = "warehouse_auth_state";
const CURRENT_USER_KEY = "warehouse_current_user";
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const DEFAULT_ADMIN_PASSWORD = "$123234345Moha";

const ADMIN_PERMISSIONS = [
  "receive_goods",
  "move_stock",
  "print_labels",
  "manage_locations",
  "manage_inventory",
  "view_reports",
  "create_shipments",
  "adjust_inventory",
];

interface AuthStorageState {
  activeSessionId: string | null;
  sessions: AuthSession[];
}

function sanitizeUser(user: User): User {
  const { password, passwordHash, passwordSalt, ...safeUser } = user;
  return safeUser;
}

function saveUsers(users: User[]): void {
  writeJson(USERS_STORAGE_KEY, users);
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

function getBrowserContext() {
  if (typeof window === "undefined") {
    return { deviceLabel: "server", userAgent: "server" };
  }

  const userAgent = window.navigator?.userAgent ?? "unknown";
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(userAgent);

  return {
    deviceLabel: isMobile ? "Mobile Browser" : "Desktop Browser",
    userAgent,
  };
}

function createSecureToken(prefix: string): string {
  const cryptoInstance = typeof window !== "undefined" ? window.crypto : globalThis.crypto;

  if (!cryptoInstance?.getRandomValues) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  const bytes = new Uint8Array(16);
  cryptoInstance.getRandomValues(bytes);
  const binary = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${binary}`;
}

function readAuthStorage(): AuthStorageState {
  if (typeof window === "undefined") {
    return { activeSessionId: null, sessions: [] };
  }

  return readJson<AuthStorageState>(AUTH_STATE_KEY, { activeSessionId: null, sessions: [] });
}

function writeAuthStorage(state: AuthStorageState): void {
  if (typeof window === "undefined") return;
  writeJson(AUTH_STATE_KEY, state);
}

function clearAuthStorage(): void {
  removeStorageItem(AUTH_STATE_KEY);
  removeStorageItem(CURRENT_USER_KEY);
}

function syncAuthCookie(sessionId: string | null): void {
  if (typeof window === "undefined") return;

  if (!sessionId) {
    document.cookie = "warehouse_auth_session=; Max-Age=0; Path=/; SameSite=Lax";
    return;
  }

  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `warehouse_auth_session=${encodeURIComponent(sessionId)}; Max-Age=${7 * 24 * 60 * 60}; Path=/; SameSite=Lax${secureFlag}`;
}

function saveCurrentUser(user: User | null): void {
  if (typeof window === "undefined") return;

  if (!user) {
    removeStorageItem(CURRENT_USER_KEY);
    return;
  }

  writeJson(CURRENT_USER_KEY, {
    ...sanitizeUser(user),
    updatedAt: nowIso(),
  });
}

function getUserByIdFromStore(userId: string): User | null {
  const user = getAllUsers().find((item) => item.id === userId);
  return user ? sanitizeUser(user) : null;
}

function getCurrentSession(state: AuthStorageState): AuthSession | null {
  if (!state.activeSessionId) return null;
  return state.sessions.find((session) => session.id === state.activeSessionId && !session.revokedAt) ?? null;
}

function touchSession(state: AuthStorageState, sessionId: string): AuthStorageState {
  const activeSession = state.sessions.find((session) => session.id === sessionId);
  if (!activeSession) return state;

  activeSession.lastActivityAt = nowIso();
  return state;
}

function revokeSession(state: AuthStorageState, sessionId: string | null): AuthStorageState {
  if (!sessionId) return state;

  const session = state.sessions.find((item) => item.id === sessionId);
  if (session) {
    session.revokedAt = nowIso();
  }

  if (state.activeSessionId === sessionId) {
    state.activeSessionId = null;
  }

  return state;
}

function createSessionRecord(user: User): AuthSession {
  const now = Date.now();
  const { deviceLabel, userAgent } = getBrowserContext();

  return {
    id: createSecureToken("session"),
    userId: user.id,
    accessToken: createSecureToken("access"),
    refreshToken: createSecureToken("refresh"),
    accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS).toISOString(),
    refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
    createdAt: nowIso(),
    lastActivityAt: nowIso(),
    userAgent,
    deviceLabel,
  };
}

function pruneExpiredSessions(state: AuthStorageState): AuthStorageState {
  const now = Date.now();

  const activeSessions = state.sessions.filter((session) => {
    const refreshExpired = new Date(session.refreshExpiresAt).getTime() <= now;
    return !refreshExpired;
  });

  return {
    ...state,
    sessions: activeSessions,
    activeSessionId:
      activeSessions.some((session) => session.id === state.activeSessionId)
        ? state.activeSessionId
        : null,
  };
}

export function validatePassword(password: string, username = ""): PasswordValidationResult {
  const errors: string[] = [];
  const normalizedUsername = normalizeUsername(username);

  if (password.length < 10) {
    errors.push("Password must be at least 10 characters long.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include an uppercase letter.");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must include a lowercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must include a number.");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include a symbol.");
  }
  if (normalizedUsername && password.toLowerCase().includes(normalizedUsername)) {
    errors.push("Password cannot contain the username.");
  }
  if (/(.)\1{2,}/.test(password)) {
    errors.push("Password cannot repeat the same character 3 times in a row.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function createPasswordFields(password: string) {
  return {
    passwordHash: btoa(password),
    passwordSalt: "",
    passwordChangedAt: new Date().toISOString(),
  };
}

async function createDefaultAdmin(): Promise<User> {
  return {
    id: "admin-1",
    username: "admin",
    role: "admin",
    permissions: ADMIN_PERMISSIONS,
    email: "admin@warehouse.com",
    createdAt: new Date().toISOString(),
    mustChangePassword: false,
    ...(await createPasswordFields(DEFAULT_ADMIN_PASSWORD)),
  };
}

export async function initializeUsers(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const users = getAllUsers();

    if (users.length > 0) {
      return;
    }

    const defaultAdmin = await createDefaultAdmin();
    saveUsers([defaultAdmin]);
  } catch (error) {
    console.error("Failed to initialize users:", error);
    throw error;
  }
}

export function getAllUsers(): User[] {
  if (typeof window === "undefined") return [];
  return readJson<User[]>(USERS_STORAGE_KEY, []);
}

export async function createUser(
  username: string,
  password: string,
  role: UserRole = "user",
  permissions: string[] = []
): Promise<User> {
  const cleanUsername = username.trim();
  const users = getAllUsers();

  if (users.some((user) => normalizeUsername(user.username) === normalizeUsername(cleanUsername))) {
    throw new Error("Username already exists.");
  }

  const passwordValidation = validatePassword(password, cleanUsername);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join(" "));
  }

  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    username: cleanUsername,
    role,
    permissions,
    createdAt: new Date().toISOString(),
    ...(await createPasswordFields(password)),
  };

  users.push(newUser);
  saveUsers(users);
  return sanitizeUser(newUser);
}

export function updateUser(userId: string, updates: Partial<User>): boolean {
  const users = getAllUsers();
  const userIndex = users.findIndex((user) => user.id === userId);

  if (userIndex === -1) return false;

  const { password, passwordHash, passwordSalt, ...safeUpdates } = updates;
  users[userIndex] = { ...users[userIndex], ...safeUpdates };
  saveUsers(users);
  return true;
}

export async function setUserPassword(
  userId: string,
  newPassword: string,
  options: { mustChangePassword?: boolean } = {}
): Promise<boolean> {
  const users = getAllUsers();
  const userIndex = users.findIndex((user) => user.id === userId);
  if (userIndex === -1) return false;

  const passwordValidation = validatePassword(newPassword, users[userIndex].username);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join(" "));
  }

  users[userIndex] = {
    ...users[userIndex],
    password: undefined,
    failedLoginCount: 0,
    lockedUntil: undefined,
    mustChangePassword: options.mustChangePassword ?? false,
    ...(await createPasswordFields(newPassword)),
  };

  saveUsers(users);
  return true;
}

export function deleteUser(userId: string): boolean {
  const users = getAllUsers();
  const filteredUsers = users.filter((user) => user.id !== userId);

  if (filteredUsers.length === users.length) return false;

  saveUsers(filteredUsers);
  return true;
}

function isLocked(user: User): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now();
}

function registerFailedLogin(userId: string): void {
  const users = getAllUsers();
  const userIndex = users.findIndex((user) => user.id === userId);
  if (userIndex === -1) return;

  const failedLoginCount = (users[userIndex].failedLoginCount ?? 0) + 1;
  users[userIndex] = {
    ...users[userIndex],
    failedLoginCount,
    lockedUntil:
      failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
        : users[userIndex].lockedUntil,
  };
  saveUsers(users);
}

async function verifyPassword(user: User, password: string): Promise<boolean> {
  return user.passwordHash === btoa(password);
}

async function migrateLegacyPassword(user: User, password: string): Promise<User> {
  if (!user.password || user.passwordHash) return user;

  const users = getAllUsers();
  const userIndex = users.findIndex((storedUser) => storedUser.id === user.id);
  if (userIndex === -1) return user;

  users[userIndex] = {
    ...users[userIndex],
    password: undefined,
    mustChangePassword: !validatePassword(password, users[userIndex].username).valid,
    ...(await createPasswordFields(password)),
  };
  saveUsers(users);
  return users[userIndex];
}

export function initializeAuth(): AuthState {
  if (typeof window === "undefined") {
    return { isAuthenticated: false, user: null, session: null };
  }

  const state = pruneExpiredSessions(readAuthStorage());
  writeAuthStorage(state);

  const session = getCurrentSession(state);
  if (!session) {
    clearAuthStorage();
    syncAuthCookie(null);
    return { isAuthenticated: false, user: null, session: null };
  }

  const now = Date.now();
  const accessExpired = new Date(session.accessExpiresAt).getTime() <= now;
  const refreshExpired = new Date(session.refreshExpiresAt).getTime() <= now;

  if (refreshExpired) {
    const revokedState = revokeSession(state, session.id);
    writeAuthStorage(revokedState);
    saveCurrentUser(null);
    syncAuthCookie(null);
    return { isAuthenticated: false, user: null, session: null };
  }

  if (accessExpired) {
    const refreshedSession: AuthSession = {
      ...session,
      accessToken: createSecureToken("access"),
      accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS).toISOString(),
      lastActivityAt: nowIso(),
    };

    const refreshedState = {
      ...state,
      sessions: state.sessions.map((item) => (item.id === session.id ? refreshedSession : item)),
    };

    writeAuthStorage(refreshedState);
    saveCurrentUser(getUserByIdFromStore(session.userId));
    syncAuthCookie(refreshedSession.id);
    return {
      isAuthenticated: true,
      user: getUserByIdFromStore(session.userId),
      session: refreshedSession,
    };
  }

  const touchState = touchSession(state, session.id);
  writeAuthStorage(touchState);
  const user = getUserByIdFromStore(session.userId);
  saveCurrentUser(user);
  syncAuthCookie(session.id);

  return {
    isAuthenticated: true,
    user,
    session,
  };
}

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  const cleanUsername = username.trim();
  const users = getAllUsers();
  const user = users.find((item) => normalizeUsername(item.username) === normalizeUsername(cleanUsername));

  if (!user) return null;
  if (isLocked(user)) {
    throw new Error("Account is temporarily locked after too many failed attempts. Try again later.");
  }

  const passwordMatches = await verifyPassword(user, password);
  if (!passwordMatches) {
    registerFailedLogin(user.id);
    return null;
  }

  const migratedUser = await migrateLegacyPassword(user, password);
  const now = new Date().toISOString();
  updateUser(migratedUser.id, {
    lastLogin: now,
    failedLoginCount: 0,
    lockedUntil: undefined,
  });

  const refreshedUser = getAllUsers().find((item) => item.id === migratedUser.id) ?? migratedUser;
  const state = pruneExpiredSessions(readAuthStorage());
  const session = createSessionRecord(refreshedUser);
  const nextState: AuthStorageState = {
    ...state,
    activeSessionId: session.id,
    sessions: [...state.sessions, session],
  };

  writeAuthStorage(nextState);
  saveCurrentUser({ ...refreshedUser, lastLogin: now });
  syncAuthCookie(session.id);
  return sanitizeUser({ ...refreshedUser, lastLogin: now });
}

export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const users = getAllUsers();
  const user = users.find((item) => normalizeUsername(item.username) === normalizeUsername(username));

  if (!user || !(await verifyPassword(user, currentPassword))) {
    return false;
  }

  const changed = await setUserPassword(user.id, newPassword);
  if (changed && getCurrentUser()?.id === user.id) {
    const refreshedUser = getAllUsers().find((item) => item.id === user.id);
    setCurrentUser(refreshedUser ?? null);
  }

  return changed;
}

export function getCurrentUser(): User | null {
  return initializeAuth().user;
}

export function setCurrentUser(user: User | null): void {
  if (typeof window === "undefined") return;

  if (!user) {
    clearAuthStorage();
    syncAuthCookie(null);
    return;
  }

  const state = pruneExpiredSessions(readAuthStorage());
  const activeSession = getCurrentSession(state);
  if (activeSession) {
    touchSession(state, activeSession.id);
    writeAuthStorage(state);
  }

  saveCurrentUser(user);
}

export function logoutUser(options: { allDevices?: boolean } = {}): void {
  if (typeof window === "undefined") return;

  const state = pruneExpiredSessions(readAuthStorage());
  const activeSession = getCurrentSession(state);

  if (options.allDevices) {
    const userId = activeSession?.userId;
    state.sessions = state.sessions.map((session) => {
      if (userId && session.userId === userId) {
        return { ...session, revokedAt: nowIso() };
      }
      return session;
    });
  } else if (activeSession) {
    revokeSession(state, activeSession.id);
  }

  writeAuthStorage(state);
  clearAuthStorage();
  syncAuthCookie(null);
}

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.permissions?.includes(permission) || false;
}

export async function resetPassword(userId: string, newPassword: string): Promise<boolean> {
  return setUserPassword(userId, newPassword, { mustChangePassword: true });
}

export function getUserById(userId: string): User | null {
  const user = getAllUsers().find((item) => item.id === userId);
  return user ? sanitizeUser(user) : null;
}

export function getDefaultAdminPasswordNotice(): string {
  return `New installs use admin / ${DEFAULT_ADMIN_PASSWORD}. Change it immediately after first login.`;
}
