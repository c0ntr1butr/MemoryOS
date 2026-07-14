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
} from "lucide-react";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true, testid: "nav-overview" },
  { to: "/runtime", label: "Runtime", icon: Activity, testid: "nav-runtime" },
  { to: "/agents", label: "Agents", icon: Bot, testid: "nav-agents" },
  { to: "/policies", label: "Policies", icon: ScrollText, testid: "nav-policies" },
  { to: "/escalations", label: "Escalations", icon: AlertTriangle, testid: "nav-escalations" },
  { to: "/audit", label: "Audit logs", icon: Search, testid: "nav-audit" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, testid: "nav-analytics" },
  { to: "/settings", label: "Settings", icon: Cog, testid: "nav-settings" },
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
      <aside className="w-[240px] shrink-0 border-r hairline flex flex-col p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 pb-6">
          <div className="w-8 h-8 rounded-lg surface flex items-center justify-center">
            <Shield size={16} className="text-cyan-300" />
          </div>
          <div>
            <div className="font-display text-[15px] leading-none">Sentinel</div>
            <div className="text-[10px] text-neutral-500 font-mono-plex mt-1">
              runtime.governance
            </div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <n.icon size={15} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t hairline pt-3">
          <div className="px-2 pb-3">
            <div className="text-[13px] truncate">{user?.name || user?.email}</div>
            <div className="text-[11px] text-neutral-500 font-mono-plex truncate">
              {user?.email}
            </div>
          </div>
          <button
            onClick={onLogout}
            data-testid="logout-button"
            className="sidebar-link w-full"
          >
            <LogOut size={15} />
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
