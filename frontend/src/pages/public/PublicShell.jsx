import { Link, NavLink } from "react-router-dom";
import { Shield, Github, ArrowRight, Twitter, Linkedin } from "lucide-react";

const NAV = [
  { to: "/product",    label: "Product" },
  { to: "/pricing",    label: "Pricing" },
  { to: "/docs",       label: "Docs" },
  { to: "/security",   label: "Security" },
  { to: "/customers",  label: "Customers" },
  { to: "/playground", label: "Playground" },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-black/60 border-b hairline">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0" data-testid="public-logo">
          <div className="w-8 h-8 rounded-lg surface flex items-center justify-center">
            <Shield size={16} className="text-cyan-300" />
          </div>
          <div>
            <div className="font-display text-[15px] leading-none">MemoryGate</div>
            <div className="text-[10px] text-neutral-500 font-mono-plex mt-1">
              runtime.governance
            </div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`public-nav-${n.label.toLowerCase()}`}
              className={({ isActive }) =>
                `px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive ? "text-white bg-white/[0.05]" : "text-neutral-400 hover:text-white"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 ml-auto">
          <a
            href="https://github.com/memorygate"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary text-sm hidden sm:flex items-center gap-2"
          >
            <Github size={13} /> GitHub
          </a>
          <Link
            to="/auth"
            className="btn-secondary text-sm hidden sm:inline-flex"
            data-testid="public-signin"
          >
            Sign in
          </Link>
          <Link
            to="/pilot"
            className="btn-primary text-sm flex items-center gap-2"
            data-testid="public-cta-pilot"
          >
            Book a pilot <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </header>
  );
}

const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      ["Overview", "/product"],
      ["Pricing", "/pricing"],
      ["Playground", "/playground"],
      ["Benchmarks", "/benchmarks"],
    ],
  },
  {
    title: "Developers",
    links: [
      ["Documentation", "/docs"],
      ["API reference", "/api/docs"],
      ["Python SDK", "/docs#python"],
      ["TypeScript SDK", "/docs#typescript"],
    ],
  },
  {
    title: "Enterprise",
    links: [
      ["Customers", "/customers"],
      ["Security", "/security"],
      ["Compliance", "/security#compliance"],
      ["Book a pilot", "/pilot"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About",         "/product"],
      ["Contact",       "mailto:hello@memorygate.dev"],
      ["Terms",         "#"],
      ["Privacy",       "#"],
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t hairline mt-16">
      <div className="max-w-[1400px] mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-6 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg surface flex items-center justify-center">
              <Shield size={16} className="text-cyan-300" />
            </div>
            <div className="font-display text-[15px]">MemoryGate</div>
          </div>
          <p className="text-neutral-500 text-sm max-w-xs leading-relaxed">
            The zero-trust runtime infrastructure layer for autonomous AI systems.
          </p>
          <div className="flex items-center gap-2 mt-6">
            {[
              [Github, "https://github.com/memorygate"],
              [Twitter, "https://twitter.com/memorygate"],
              [Linkedin, "https://linkedin.com/company/memorygate"],
            ].map(([Icon, href], i) => (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-md border hairline flex items-center justify-center text-neutral-400 hover:text-white hover:border-white/20 transition-colors"
              >
                <Icon size={13} />
              </a>
            ))}
          </div>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title}>
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono-plex mb-4">
              {col.title}
            </div>
            <div className="space-y-2.5">
              {col.links.map(([label, href]) => (
                <div key={label}>
                  {href.startsWith("http") || href.startsWith("mailto") || href === "#" ? (
                    <a href={href} className="text-sm text-neutral-400 hover:text-white transition-colors">
                      {label}
                    </a>
                  ) : (
                    <Link to={href} className="text-sm text-neutral-400 hover:text-white transition-colors">
                      {label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t hairline">
        <div className="max-w-[1400px] mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-neutral-600 text-xs font-mono-plex">
            © 2026 MemoryGate Labs, Inc. — zero-trust runtime for autonomous AI
          </div>
          <div className="text-neutral-600 text-xs font-mono-plex flex items-center gap-4">
            <span>SOC 2 Type II · ISO 27001 · GDPR · HIPAA</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
