import {
  CalendarClock,
  LayoutDashboard,
  Newspaper,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Lean, Nasdaq-100-only navigation in plain language. */
export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Nasdaq-100",
    items: [
      { href: "/", label: "Right Now", icon: LayoutDashboard },
      { href: "/news", label: "Important News", icon: Newspaper },
      { href: "/macro", label: "What to Watch", icon: CalendarClock },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];
