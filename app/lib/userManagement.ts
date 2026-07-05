import { readJson, removeStorageItem, writeJson } from "./storage";

export type UserRole = "admin" | "supervisor" | "operator" | "user";

export interface User {
  id: string;
  username: string;
  password?: string; // Legacy only. Migrated to passwordHash after successful login.
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

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const USERS_STORAGE_KEY = "warehouse_users";
const CURRENT_USER_KEY = "warehouse_current_user";
const PASSWORD_HASH_ITERATIONS = 210000;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
// const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const LOCKOUT_DURATION_MS = 0
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

type StoredSession = User & {
  sessionExpiresAt?: string;
};

function getCrypto(): Crypto {
  const cryptoObj =
    typeof window !== "undefined"
      ? window.crypto
      : globalThis.crypto;

  if (!cryptoObj?.subtle) {
    throw new Error(
      "Web Crypto API is not available in this environment."
    );
  }

  return cryptoObj;
}



// function bytesToBase64(bytes: Uint8Array): string {
//   let binary = "";
//   bytes.forEach((byte) => {
//     binary += String.fromCharCode(byte);
//   });
//   return btoa(binary);
// }

// function base64ToBytes(value: string): Uint8Array {
//   const binary = atob(value);
//   const bytes = new Uint8Array(binary.length);
//   for (let index = 0; index < binary.length; index++) {
//     bytes[index] = binary.charCodeAt(index);
//   }
//   return bytes;
// }

// function createSalt(): string {
// const secureCrypto = getCrypto();
//   if (!secureCrypto) {
//     throw new Error("Secure password hashing requires Web Crypto support.");
//   }

//   const salt = new Uint8Array(16);
//   secureCrypto.getRandomValues(salt);
//   return bytesToBase64(salt);
// }

// async function hashPassword(password: string, salt: string): Promise<string> {
// const secureCrypto = getCrypto();
//   if (!secureCrypto) {
//     throw new Error("Secure password hashing requires Web Crypto support.");
//   }

//   const encoder = new TextEncoder();
//   const saltBytes = base64ToBytes(salt);
//   const saltBuffer = saltBytes.buffer.slice(
//     saltBytes.byteOffset,
//     saltBytes.byteOffset + saltBytes.byteLength
//   ) as ArrayBuffer;
//   const keyMaterial = await secureCrypto.subtle.importKey(
//     "raw",
//     encoder.encode(password),
//     "PBKDF2",
//     false,
//     ["deriveBits"]
//   );

//   const derivedBits = await secureCrypto.subtle.deriveBits(
//     {
//       name: "PBKDF2",
//       salt: saltBuffer,
//       iterations: PASSWORD_HASH_ITERATIONS,
//       hash: "SHA-256",
//     },
//     keyMaterial,
//     256
//   );

//   return bytesToBase64(new Uint8Array(derivedBits));
// }

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

// async function createPasswordFields(password: string): Promise<Pick<User, "passwordHash" | "passwordSalt" | "passwordChangedAt">> {
//   const passwordSalt = createSalt();
//   const passwordHash = await hashPassword(password, passwordSalt);

//   return {
//     passwordHash,
//     passwordSalt,
//     passwordChangedAt: new Date().toISOString(),
//   };
// }

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
    mustChangePassword: true,
    ...(await createPasswordFields(DEFAULT_ADMIN_PASSWORD)),
  };
}

export async function initializeUsers(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  console.log("Initializing users...");
      console.log("window:", typeof window);
console.log("crypto:", globalThis.crypto);
console.log("subtle:"+ globalThis.crypto?.subtle);

  try {
    const users = getAllUsers();

    if (users.length > 0) {
      return;
    }


    const defaultAdmin =
      await createDefaultAdmin();

    saveUsers([defaultAdmin]);

    console.log(
      "Default admin created:",
      defaultAdmin.username
    );
  } catch (error) {
    console.error(
      "Failed to initialize users:",
      error
    );
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
    // mustChangePassword: options.mustChangePassword ?? false,
    mustChangePassword: false,
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

// async function verifyPassword(user: User, password: string): Promise<boolean> {
//   if (user.passwordHash && user.passwordSalt) {
//     const candidateHash = await hashPassword(password, user.passwordSalt);
//     return candidateHash === user.passwordHash;
//   }

//   return !!user.password && user.password === password;
// }

async function verifyPassword(
  user: User,
  password: string
): Promise<boolean> {
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
  setCurrentUser({ ...refreshedUser, lastLogin: now });
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
  if (typeof window === "undefined") return null;

  const currentUser = readJson<StoredSession | null>(CURRENT_USER_KEY, null);
  if (!currentUser) return null;

  if (currentUser.sessionExpiresAt && new Date(currentUser.sessionExpiresAt).getTime() <= Date.now()) {
    removeStorageItem(CURRENT_USER_KEY);
    return null;
  }

  return sanitizeUser(currentUser);
}

export function setCurrentUser(user: User | null): void {
  if (typeof window === "undefined") return;

  if (user) {
    writeJson(CURRENT_USER_KEY, {
      ...sanitizeUser(user),
      sessionExpiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    });
  } else {
    removeStorageItem(CURRENT_USER_KEY);
  }
}

export function logoutUser(): void {
  removeStorageItem(CURRENT_USER_KEY);
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
