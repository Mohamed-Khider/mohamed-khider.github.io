"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, setCurrentUser } from "../lib/userManagement";
import AppShell from "./AppShell";

interface ProtectedPageProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedPage({ children, requireAdmin = false }: ProtectedPageProps) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentUser = getCurrentUser();

    if (!currentUser) {
      router.replace("/");
      return;
    }

    if (currentUser.mustChangePassword) {
      router.replace("/");
      return;
    }

    if (requireAdmin && currentUser.role !== 'admin') {
      router.replace("/main");
      return;
    }

    // Update current user in localStorage to keep session active
    setCurrentUser(currentUser);
  }, [router, requireAdmin]);

  return <AppShell>{children}</AppShell>;
}
