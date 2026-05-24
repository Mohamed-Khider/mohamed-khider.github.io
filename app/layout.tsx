import type { Metadata } from "next";
import "./globals.css";
import ToastProvider from "./components/ToastProvider";

export const metadata: Metadata = {
  title: "Warehouse Label System",
  description: "Next.js warehouse label and barcode management app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
          </ToastProvider>
          </body>
    </html>
  );
}
