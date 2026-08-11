import { Home, Receipt, AlertCircle, CreditCard } from "lucide-react";

// The main tabs, shared by the phone's bottom bar and the desktop's top bar.
// One list, so a tab added or renamed can't appear in one and not the other.
export const NAV_TABS = [
  { href: "/", label: "My Cash", Icon: Home },
  { href: "/bills", label: "Bills", Icon: Receipt },
  { href: "/debt", label: "My Debt", Icon: CreditCard },
  { href: "/owes", label: "Past Due", Icon: AlertCircle },
] as const;
