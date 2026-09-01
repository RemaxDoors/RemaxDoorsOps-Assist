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
    description: "Operations overview",
  },
  {
    label: "NCR",
    href: "/ncr",
    icon: "M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
    description: "Non-conformance reports",
  },
];
