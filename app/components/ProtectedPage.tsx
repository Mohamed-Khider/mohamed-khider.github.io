"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface ProtectedPageProps {
  children: ReactNode;
}

export default function ProtectedPage({ children }: ProtectedPageProps) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (localStorage.getItem("auth") !== "true") {
      router.replace("/");
    }
  }, [router]);

  return <>{children}</>;
}
