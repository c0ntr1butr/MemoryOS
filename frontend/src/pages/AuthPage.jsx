import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Shield, Lock, ArrowRight } from "lucide-react";

export default function AuthPage() {
  const { login, register, user, formatErr } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "admin@sentinel.ai",
    password: "Admin@2026",
    name: "",
    org_name: "",
  });

  useEffect(() => {
    if (user && user.email) navigate("/", { replace: true });
  }, [user, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        toast.success("Welcome back");
      } else {
        await register(form);
        toast.success("Organization created");
      }
      navigate("/");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex" data-testid="auth-page">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden border-r hairline">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-br from-black via-transparent to-black" />
        <div className="relative z-10 p-14 flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg surface flex items-center justify-center">
              <Shield size={18} className="text-cyan-300" />
            </div>
            <div>
              <div className="font-display text-lg">Sentinel</div>
              <div className="text-xs text-neutral-500 font-mono-plex -mt-0.5">
                runtime.governance
              </div>
            </div>
          </div>
          <div className="max-w-lg">
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight">
              The control plane for every autonomous&nbsp;
              <span className="text-cyan-300">AI action</span>.
            </h1>
            <p className="text-neutral-400 mt-6 text-[15px] leading-relaxed">
              Evaluate every agent request against identity, purpose, policy,
              and risk. Allow, block, modify, or escalate — in milliseconds.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-4 text-sm">
              {[
                ["<8ms", "median decision"],
                ["12+", "policy primitives"],
                ["SOC 2", "audit ready"],
              ].map(([k, v]) => (
                <div key={k} className="surface rounded-lg p-4">
                  <div className="font-display text-2xl">{k}</div>
                  <div className="text-neutral-500 text-xs uppercase tracking-wider mt-1">
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-neutral-600 text-xs font-mono-plex">
            © 2026 Sentinel Labs — governance @ runtime
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Shield size={18} className="text-cyan-300" />
            <div className="font-display text-xl">Sentinel</div>
          </div>
          <div className="mb-8">
            <div className="text-xs font-mono-plex text-neutral-500 uppercase tracking-wider">
              {mode === "login" ? "sign in" : "get started"}
            </div>
            <h2 className="font-display text-3xl tracking-tight mt-1">
              {mode === "login"
                ? "Enter the console"
                : "Create your organization"}
            </h2>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="auth-form">
            {mode === "register" && (
              <>
                <div>
                  <label className="text-xs text-neutral-400 uppercase tracking-wider">
                    Your name
                  </label>
                  <input
                    data-testid="auth-name-input"
                    className="input mt-2"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 uppercase tracking-wider">
                    Organization
                  </label>
                  <input
                    data-testid="auth-org-input"
                    className="input mt-2"
                    value={form.org_name}
                    onChange={(e) =>
                      setForm({ ...form, org_name: e.target.value })
                    }
                    required
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider">
                Email
              </label>
              <input
                data-testid="auth-email-input"
                type="email"
                className="input mt-2"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Lock size={11} /> Password
              </label>
              <input
                data-testid="auth-password-input"
                type="password"
                className="input mt-2"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                required
                minLength={6}
              />
            </div>
            <button
              data-testid="auth-submit-button"
              disabled={loading}
              className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 text-sm text-neutral-500">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  data-testid="auth-toggle-register"
                  className="text-cyan-300 hover:underline"
                  onClick={() => setMode("register")}
                >
                  Create an organization
                </button>
              </>
            ) : (
              <>
                Have an account?{" "}
                <button
                  data-testid="auth-toggle-login"
                  className="text-cyan-300 hover:underline"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
          <div className="mt-6 surface rounded-lg p-3 text-xs text-neutral-400 font-mono-plex">
            demo: admin@sentinel.ai / Admin@2026
          </div>
        </div>
      </div>
    </div>
  );
}
