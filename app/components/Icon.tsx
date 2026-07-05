"use client";

import { memo } from "react";

interface IconProps {
  name: string;
  className?: string;
  size?: number;
  title?: string;
}

const ICON_PATHS: Record<string, string> = {
  dashboard: "M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-4H4v4Zm10-10h6V4h-6v6Z",
  inventory_2: "M5 4h14a1 1 0 0 1 1 1v4H4V5a1 1 0 0 1 1-1Zm-1 7h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8Zm4 2h8v2H8v-2Z",
  location_on: "M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z",
  swap_horiz: "M7 7h10l-2-2m2 2L15 9M17 17H7l2 2m-2-2 2-2",
  local_shipping: "M4 7h10v6H4V7Zm10 2h3l3 3v3h-6v-6Zm-8 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  fact_check: "M7 4h10a1 1 0 0 1 1 1v14H6V5a1 1 0 0 1 1-1Zm2 4h6M9 12h6m-6 4h4",
  inventory: "M4 7h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Zm3 0V5h10v2",
  label: "M5 5h8l6 6v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm8 0v5h5",
  qr_code: "M7 4H4v3h3V4Zm0 13H4v3h3v-3Zm13-13h-3v3h3V4ZM7 11h3v3H7v-3Zm7 0h3v3h-3v-3Zm-7 7h3v3H7v-3Zm10-3h-3v3h3v-3Zm-3-7h-3v3h3V7Zm-7 0H4v3h3V7Zm10 10v-3h-3v3h3Z",
  grid_view: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  view_in_ar: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm9 2.3 6 3-6 3-6-3 6-3Z",
  pin_drop: "M12 21s5-4.4 5-9a5 5 0 1 0-10 0c0 4.6 5 9 5 9Zm0-7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z",
  print: "M8 5h8v3H8V5Zm-3 5h14v6a1 1 0 0 1-1 1h-2v-3H8v3H6a1 1 0 0 1-1-1v-6Zm2 1v2h10v-2H7Z",
  monitoring: "M5 19V9m7 10V5m7 14v-7",
  admin_panel_settings: "M12 3l7 4v5c0 4.2-2.8 7.5-7 9-4.2-1.5-7-4.8-7-9V7l7-4Zm0 3.2L8 7.8v3.2c0 2.4 1.5 4.7 4 5.8 2.5-1.1 4-3.4 4-5.8V7.8l-4-1.6Z",
  warehouse: "M4 10 12 4l8 6v10a1 1 0 0 1-1 1h-3v-7H8v7H5a1 1 0 0 1-1-1v-10Z",
  logout: "M10 17l-1.4-1.4 2.6-2.6H3v-2h8.2l-2.6-2.6L10 7l5 5-5 5Zm8 2V5h-2v12h2Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm8 12 3 3",
  verified: "M12 3l7 4v5c0 4.2-2.8 7.5-7 9-4.2-1.5-7-4.8-7-9V7l7-4Zm-1 5 3 3 4-4",
  call_received: "M5 7l4-4 2 2-2 2 4 4 2-2 2 2-4 4h-4l-4-4Z",
  tag: "M4 12l8-8h8v8l-8 8-8-8Zm8-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  priority_high: "M12 3v10m0 8v-2",
  warning: "M12 3 2 19h20L12 3Zm0 5v5m0 3h.01",
  package_2: "M4 7h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Zm3 0V5h10v2M8 10h8",
  close: "M6 6l12 12M18 6 6 18",
  refresh: "M21 12a9 9 0 1 1-2.6-6.3L21 3v6h-6",
  usb: "M8 8h8v5l-2 2v3h-4v-3l-2-2V8Zm2 0V5h4v3h-4Zm2 8v2",
  check_circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-1.2 12 5.3-5.3-1.4-1.4-3.9 3.9-2.1-2.1-1.4 1.4 3.5 3.5Z",
  chevron_left: "M15 18l-6-6 6-6",
  chevron_right: "M9 6l6 6-6 6",
  square: "M5 5h14v14H5z",
};

function Icon({ name, className = "", size = 20, title }: IconProps) {
  const pathData = ICON_PATHS[name] || ICON_PATHS.square;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={pathData} />
    </svg>
  );
}

export default memo(Icon);
