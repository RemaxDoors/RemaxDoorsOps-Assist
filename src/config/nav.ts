export type NavItem = {
  label: string;
  href: string;
  /** Inline SVG path data — keeps the app dependency-free for icons. */
  icon: string;
  description?: string;
};

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "M3 10.5 12 3l9 7.5M5.25 9.75V20a1 1 0 0 0 1 1h3.5v-5.5h4.5V21h3.5a1 1 0 0 0 1-1V9.75",
    description: "NCR trend and totals",
  },
  {
    label: "System",
    href: "/system",
    icon: "M12 3a9 9 0 1 0 9 9m-9-5v5l3.5 2M20 4v5h-5",
    description: "Environment checks and logs",
  },
  {
    label: "NCR",
    href: "/ncr",
    icon: "M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
    description: "Non-conformance reports",
  },
  {
    label: "Support",
    href: "/support",
    icon: "M12 17h.01M12 14c0-1.5 1.5-2 2.3-2.8a3 3 0 1 0-5-2.7M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z",
    description: "Report a problem",
  },
];
