"use client";

import { type ReactNode } from "react";

export type NotificationType = "warning" | "success" | "info";

interface NotificationModalProps {
  open: boolean;
  title: string;
  message: string;
  type?: NotificationType;
  onClose: () => void;
}

const ICON_MAP: Record<NotificationType, string> = {
  warning: "⚠️",
  success: "✅",
  info: "ℹ️",
};

export default function NotificationModal({
  open,
  title,
  message,
  type = "warning",
  onClose,
}: NotificationModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className={`modal-tag modal-tag-${type}`}>{ICON_MAP[type]} {type.toUpperCase()}</div>
            <h3 className="modal-title">{title}</h3>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose} aria-label="Close notification">
            ×
          </button>
        </div>
        <div className="modal-body">
          {message.split("\n").map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="second-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
