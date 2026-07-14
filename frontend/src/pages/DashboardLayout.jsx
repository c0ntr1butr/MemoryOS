import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  Shield,
  LayoutDashboard,
  Bot,
  ScrollText,
  Activity,
  Search,
  BarChart3,
  AlertTriangle,
  Settings as Cog,
  LogOut,
  KeyRound,
  Plug,
  Webhook,
  ShieldCheck,
  Users,
  Code2,
  Network,
} from "lucide-react";

const sections = [
  {
    label: "Security",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard, end: true, tid: "nav-overview" },
      { to: "/runtime", label: "Runtime", icon: Activity, tid: "nav-runtime" },
      { to: "/escalations", label: "Escalations", icon: AlertTriangle, tid: "nav-escalations" },
    ],
  },
  {
    label: "Policy",
    items: [
      { to: "/policies", label: "Policies", icon: ScrollText, tid: "nav-policies" },
      { to: "/compliance", label: "Compliance", icon: ShieldCheck, tid: "nav-compliance" },
    ],
  },
  {
    label: "Agents & Access",
    items: [
      { to: "/agents", label: "Agents", icon: Bot, tid: "nav-agents" },
      { to: "/keys", label: "API keys", icon: KeyRound, tid: "nav-keys" },
      { to: "/members", label: "Members", icon: Users, tid: "nav-members" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { to: "/connectors", label: "Connectors", icon: Plug, tid: "nav-connectors" },
      { to: "/webhooks", label: "Webhooks", icon: Webhook, tid: "nav-webhooks" },
      { to: "/sdks", label: "SDKs & Docs", icon: Code2, tid: "nav-sdks" },
    ],
  },
  {
    label: "Observability",
    items: [
      { to: "/audit", label: "Audit logs", icon: Search, tid: "nav-audit" },
      { to: "/analytics", label: "Analytics", icon: BarChart3, tid: "nav-analytics" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/architecture", label: "Architecture", icon: Network, tid: "nav-architecture" },
      { to: "/settings", label: "Settings", icon: Cog, tid: "nav-settings" },
    ],
  },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex" data-testid="dashboard-layout">
      <aside className="w-[240px] shrink-0 border-r hairline flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-2 p-4 pb-5 border-b hairline">
          <div className="w-8 h-8 rounded-lg surface flex items-center justify-center">
            <Shield size={16} className="text-cyan-300" />
          </div>
          <div>
            <div className="font-display text-[15px] leading-none">MemoryGate</div>
            <div className="text-[10px] text-neutral-500 font-mono-plex mt-1">
              runtime.governance
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
          {sections.map((s) => (
            <div key={s.label}>
              <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-600 font-mono-plex px-2 mb-1.5">
                {s.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {s.items.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    data-testid={n.tid}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? "active" : ""}`
                    }
                  >
                    <n.icon size={14} />
                    {n.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t hairline p-3">
          <div className="px-2 pb-2">
            <div className="text-[13px] truncate">{user?.name || user?.email}</div>
            <div className="text-[11px] text-neutral-500 font-mono-plex truncate flex items-center gap-2">
              <span className="capitalize">{user?.role || "member"}</span>
              <span className="text-neutral-700">·</span>
              <span className="truncate">{user?.email}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            data-testid="logout-button"
            className="sidebar-link w-full"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
