"use client";

import { createContext, useContext, useState } from "react";

type ToastType = "success" | "warning" | "info";

export interface Toast {
  id: number;
title: string;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<any>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
};

export default function ToastProvider({ children }: any) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (title: string, message: string, type: ToastType = "success") => {
    const id = Date.now();

    setToasts((prev) => [...prev, { id, title, message, type }]);

    // 🔥 auto remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* 🔥 Toast UI */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: toast.type === "success" ? "#16a34a" : toast.type === "warning" ? "#f59e0b" : "#3b82f6",
              color: "#fff",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "10px",
              minWidth: "220px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              fontSize: "13px",
              fontWeight: "500",
              animation: "fadeIn 0.2s ease",
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}