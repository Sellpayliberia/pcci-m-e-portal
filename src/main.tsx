import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  ClipboardList,
  MapPinned,
  MapPin,
  BarChart3,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Download,
  Search,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Leaf,
  Trash2,
  Droplets,
  UsersRound,
  ShieldCheck,
  Menu,
  X,
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  Filter,
  CalendarDays,
  MoreHorizontal,
  LogOut,
  Globe,
  Wifi,
  WifiOff,
  Building2,
  Target,
  Activity,
  BookOpen,
  MessageSquare,
  Navigation,
  Upload,
  Save,
  Eye,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Send,
  Flag,
  Layers,
  LocateFixed,
  Lightbulb,
  SlidersHorizontal,
  LockKeyhole,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  LayerGroup,
  LayersControl,
  GeoJSON,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";
import { QRCodeSVG } from "qrcode.react";
import Papa from "papaparse";
import { Button } from "./components/ui/button";
import {
  targets,
  roles,
  aggregate,
  fmt,
  emptyReport,
} from "./data";
import {
  api,
  queueDraft,
  discardDraft,
  syncDrafts,
  localDrafts,
  exportTable,
  reportPDF,
} from "./lib";
import "./styles.css";
import { siteName, siteDescription } from "./site";
document.title = siteName + " · Presidential Clean Cities Initiative";
document
  .querySelector('meta[name="description"]')
  ?.setAttribute("content", siteDescription);
const nav = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Field reports", icon: ClipboardList },
  { label: "Map & coverage", icon: MapPinned },
  { label: "Analytics", icon: BarChart3 },
  { label: "MEAL tools", icon: BookOpen },
];
function isOverdue(r: any) {
  return (
    r.status !== "Admin Approved" &&
    r.data.periodEnd &&
    Date.now() - new Date(r.data.periodEnd).getTime() > 7 * 86400000
  );
}
function Badge({ children }: any) {
  return (
    <span
      className={"badge " + String(children).toLowerCase().replaceAll(" ", "-")}
    >
      {children}
    </span>
  );
}
function Field({ label, children }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Select({
  value,
  onChange,
  options,
  placeholder = "All",
  ...props
}: any) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    >
      <option value="">{placeholder}</option>
      {options.map((o: any) => (
        <option
          key={typeof o === "string" ? o : o.id}
          value={typeof o === "string" ? o : o.name}
        >
          {typeof o === "string" ? o : o.name}
        </option>
      ))}
    </select>
  );
}
function App() {
  const [page, setPage] = useState("Dashboard"),
    [user, setUser] = useState<any>(null),
    [reports, setReports] = useState<any[]>([]),
    [locations, setLocations] = useState<any[]>([]),
    [ready, setReady] = useState(false),
    [login, setLogin] = useState(false),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<any>(null),
    [online, setOnline] = useState(navigator.onLine),
    [filters, setFilters] = useState<any>({}),
    [search, setSearch] = useState(""),
    [notifications, setNotifications] = useState(false);
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 5500);
  };
  async function load() {
    const [r, l] = await Promise.all([api("/reports"), api("/locations")]);
    const drafts = await localDrafts(user?.id || "");
    setReports([
      ...drafts,
      ...r.filter((x: any) => !drafts.some((d) => d.id === x.id)),
    ]);
    setLocations(l);
  }
  useEffect(() => {
    api("/me")
      .then(async (u) => {
        const [r, l] = await Promise.all([api("/reports"), api("/locations")]);
        setUser(u);
        setReports(r);
        setLocations(l);
      })
      .catch(() => {})
      .finally(() => setReady(true));
    const on = () => setOnline(true),
      off = () => setOnline(false);
    const expired = () => {
      setUser(null);
      setModal(null);
      setReports([]);
      setLocations([]);
      setLogin(true);
    };
    window.addEventListener("pcci-session-expired", expired);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js");
    return () => {
      window.removeEventListener("pcci-session-expired", expired);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (online && user && !modal)
      syncDrafts(user.id)
        .then((n) => {
          if (n) {
            notify(`${n} offline draft(s) synced`);
            load();
          }
        })
        .catch((e) => notify(`Draft sync paused: ${e.message}`));
  }, [online, user, modal]);
  useEffect(() => {
    if (!user) return;
    let timer: any;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        api("/logout", "POST").catch(() => {});
        setUser(null);
        setReports([]);
        setLocations([]);
        setModal(null);
        notify("Your session timed out. Please sign in again.");
      }, 29 * 60000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [user]);
  useEffect(() => {
    if (!modal && !login) return;
    const prior = document.activeElement as HTMLElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]",
        ) || [],
      );
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const items = focusables();
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [!!modal, login]);
  const filtered = reports.filter(
    (r) =>
      Object.entries(filters).every(
        ([k, v]) =>
          !v ||
          (k === "from"
            ? r.data.periodEnd >= v
            : k === "to"
              ? r.data.periodStart <= v
              : String(k === "team" ? r.team : r[k]) === v),
      ) &&
      (!search ||
        `${r.number} ${r.team} ${r.city}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const newReport = () => {
    if (!user) {
      setLogin(true);
      return;
    }
    if (
      !["Super Admin", "Admin/M&E Officer", "Team Supervisor"].includes(
        user.role,
      )
    ) {
      notify("Your role can view and review reports.");
      return;
    }
    setModal({
      ...emptyReport(),
      county: user.county || "",
      city: user.city || "",
    });
  };
  const changePage = (p: string) => {
    setPage(p);
    setMobile(false);
    setSearch("");
  };
  if (!ready)
    return (
      <div className="loading-shell" aria-label="Loading workspace">
        <div className="loading-side" />
        <div className="loading-main">
          <div className="loading-line" />
          <div className="loading-title" />
          <div className="loading-cards">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} />
            ))}
          </div>
          <div className="loading-chart" />
        </div>
      </div>
    );
  if (!user)
    return (
      <Login
        required
        onLogin={async (u: any) => {
          setUser(u);
          setPage("Dashboard");
          setFilters({});
          setSearch("");
          setLogin(false);
          try {
            const [r, l] = await Promise.all([api("/reports"), api("/locations")]);
            setReports(r);
            setLocations(l);
          } catch (e: any) {
            notify(e.message);
          }
        }}
      />
    );
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a href="/" className="brand">
          <span className="brand-mark">
            <Flag size={23} fill="currentColor" />
          </span>
          <span>
            PCCI <small>M&E PORTAL</small>
          </span>
        </a>
        <div className="initiative">PRESIDENTIAL CLEAN CITIES INITIATIVE</div>
        <div className="workspace">
          <span className="workspace-icon">
            <Building2 size={18} />
          </span>
          <span>
            National workspace<small>Republic of Liberia</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-heading">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.label}
              className={page === n.label ? "nav-item active" : "nav-item"}
              onClick={() => changePage(n.label)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.label === "Field reports" && (
                <span className="nav-count">{reports.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-heading administration">ADMINISTRATION</div>
        {[
          { label: "Users & roles", icon: Users },
          { label: "Locations", icon: MapPin },
          { label: "Audit log", icon: ShieldCheck },
          { label: "Settings", icon: Settings },
        ]
          .filter(
            (n) =>
              !user ||
              n.label === "Settings" ||
              (n.label === "Users & roles"
                ? user.role === "Super Admin"
                : ["Super Admin", "Admin/M&E Officer"].includes(user.role)),
          )
          .map((n) => (
            <button
              key={n.label}
              className={page === n.label ? "nav-item active" : "nav-item"}
              onClick={() => changePage(n.label)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
            </button>
          ))}
        <div className="sidebar-bottom">
          <div className="mission">
            <span className="mission-icon">
              <Leaf size={21} />
            </span>
            <strong>
              Cleaner cities.
              <br />
              Stronger communities.
            </strong>
            <p>Measuring progress, together.</p>
            <div className="flag-stripes">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="help-link">
            <span>
              <span className={"dot " + (!online ? "offline" : "")} />
              {online ? "Connected to portal" : "Working offline"}
            </span>
            <span>v1.0</span>
          </div>
          <button
            className="profile"
            onClick={() => (user ? changePage("Settings") : setLogin(true))}
          >
            <span className="avatar">
              {user
                ? user.name
                    .split(" ")
                    .map((s: string) => s[0])
                    .slice(0, 2)
                    .join("")
                : "PC"}
            </span>
            <span>
              <strong>{user?.name || "PCCI Workspace"}</strong>
              <small>{user?.role || "Explore the portal"}</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="top-right">
            <span className="ministry">
              Ministry of State for Presidential Affairs
            </span>
            <span className="liberia-flag">
              <i>★</i>
            </span>
            <div className="top-divider" />
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={19} />
              {filtered.some((r) => r.status === "Submitted") && <i />}
            </button>
            <button
              className="top-avatar"
              aria-label="Sign in or account"
              onClick={() => (user ? changePage("Settings") : setLogin(true))}
            >
              {user ? user.name[0] : "PC"}
            </button>
          </div>
          {notifications && (
            <div className="notification-panel">
              <h3>Workspace notifications</h3>
              <p>
                {reports.filter((r) => r.status === "Submitted").length} reports
                are awaiting city verification.
              </p>
              <p>
                {reports.filter((r) => r.status === "Returned").length} reports
                have been returned for correction.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  changePage("Field reports");
                  setNotifications(false);
                }}
              >
                View reports <ArrowRight size={14} />
              </Button>
            </div>
          )}
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="dot" /> NATIONAL MONITORING & EVALUATION
              </div>
              <h1>
                {page === "Dashboard"
                  ? "A cleaner Liberia, in focus."
                  : page === "Field reports"
                    ? "Field reports"
                    : page === "Map & coverage"
                      ? "Progress on the ground."
                      : page === "Analytics"
                        ? "From activity to impact."
                        : page === "MEAL tools"
                          ? "Listen. Learn. Improve."
                          : page}
              </h1>
              <p>
                {page === "Dashboard"
                  ? "Track sanitation progress, strengthen accountability, and turn field data into action."
                  : page === "Field reports"
                    ? "One workspace for every team, field activity, and verified result."
                    : page === "Map & coverage"
                      ? "Explore field activities, community coverage, and areas that need attention."
                      : page === "Analytics"
                        ? "Understand performance and find opportunities for greater impact."
                        : page === "MEAL tools"
                          ? "Connect evidence and community voices to better decisions."
                          : "Manage your Presidential Clean Cities Initiative workspace."}
              </p>
            </div>
            <div className="heading-actions">
              {page === "Dashboard" && (
                <Button variant="outline" onClick={() => exportTable(filtered)}>
                  <Download size={16} /> Export overview
                </Button>
              )}
              {["Dashboard", "Field reports"].includes(page) && (
                <Button onClick={newReport}>
                  <Plus size={17} /> New report
                </Button>
              )}
            </div>
          </div>
          {!user && (
            <div className="demo-banner">
              <span>
                <Eye size={15} />
                <strong>Preview workspace</strong>
                <span>
                  Explore illustrative data. Sign in to manage your initiative.
                </span>
              </span>
              <button onClick={() => setLogin(true)}>
                Sign in <ArrowRight size={14} />
              </button>
            </div>
          )}
          {[
            "Dashboard",
            "Field reports",
            "Analytics",
            "Map & coverage",
          ].includes(page) && (
            <div className="filters">
              <div className="filter-label">
                <SlidersHorizontal size={17} />
                <span>Filters</span>
              </div>
              {["county", "city", "district", "community", "team"].map(
                (k, i) => (
                  <Select
                    key={k}
                    value={filters[k]}
                    placeholder={
                      "All " +
                      [
                        "counties",
                        "cities",
                        "districts",
                        "communities",
                        "teams",
                      ][i]
                    }
                    options={Array.from(
                      new Set(
                        (k === "team"
                          ? reports
                          : locations.filter(
                              (l) =>
                                l.type ===
                                ["County", "City", "District", "Community"][i],
                            )
                        )
                          .filter(
                            (l) =>
                              (!filters.county ||
                                l.county === filters.county) &&
                              (!filters.city ||
                                k === "county" ||
                                l.city === filters.city),
                          )
                          .map((l) => (k === "team" ? l.team : l.name)),
                      ),
                    ).sort()}
                    onChange={(v: string) =>
                      setFilters({
                        ...filters,
                        [k]: v,
                        ...(k === "county"
                          ? { city: "", district: "", community: "" }
                          : k === "city"
                            ? { district: "", community: "" }
                            : {}),
                      })
                    }
                  />
                ),
              )}
              <div className="date-filter">
                <CalendarDays size={15} />
                <input
                  type="date"
                  aria-label="From date"
                  value={filters.from || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, from: e.target.value })
                  }
                />
                <span>–</span>
                <input
                  type="date"
                  aria-label="To date"
                  value={filters.to || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, to: e.target.value })
                  }
                />
              </div>
              {Object.values(filters).some(Boolean) && (
                <button className="text-button" onClick={() => setFilters({})}>
                  Reset
                </button>
              )}
            </div>
          )}
          {page === "Dashboard" && (
            <Dashboard
              reports={filtered}
              demo={!user}
              onNew={newReport}
              onPage={changePage}
              onReport={setModal}
            />
          )}
          {page === "Field reports" && (
            <Reportal
              reports={filtered}
              search={search}
              setSearch={setSearch}
              onReport={setModal}
            />
          )}
          {page === "Map & coverage" && (
            <MapView reports={filtered} locations={locations} />
          )}
          {page === "Analytics" && (
            <Analytics reports={filtered} locations={locations} />
          )}
          {page === "MEAL tools" && (
            <Meal user={user} notify={notify} onLogin={() => setLogin(true)} />
          )}
          {page === "Locations" && (
            <Locations
              locations={locations}
              user={user}
              notify={notify}
              refresh={load}
            />
          )}
          {page === "Users & roles" && (
            <UsersPanel user={user} notify={notify} />
          )}
          {page === "Audit log" && <Audit user={user} />}
          {page === "Settings" && (
            <SettingsPanel
              user={user}
              onLogin={() => setLogin(true)}
              notify={notify}
              onLogout={async () => {
                try {
                  await api("/logout", "POST");
                } catch {}
                setUser(null);
                setReports([]);
                setLocations([]);
                changePage("Dashboard");
              }}
            />
          )}
          <footer>
            <span>
              © {new Date().getFullYear()} Presidential Clean Cities Initiative
            </span>
            <span>
              <ShieldCheck size={13} /> Ministry of State for Presidential
              Affairs <span className="footer-dot">·</span> Republic of Liberia
            </span>
          </footer>
        </main>
      </div>
      {login && (
        <Login
          onClose={() => setLogin(false)}
          onLogin={async (u: any) => {
            setUser(u);
            setReports([]);
            setLocations([]);
            setLogin(false);
            try {
              const [r, l] = await Promise.all([
                api("/reports"),
                api("/locations"),
              ]);
              setReports(r);
              setLocations(l);
              notify(`Welcome, ${u.name}`);
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      )}
      {modal && (
        <ReportEditor
          report={modal}
          reports={reports}
          user={user}
          locations={locations}
          onClose={() => setModal(null)}
          notify={notify}
          onSave={async (r: any) => {
            setModal(r);
            if (navigator.onLine) await load();
            else
              setReports((previous) => [
                r,
                ...previous.filter((v) => v.id !== r.id),
              ]);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button aria-label="Dismiss" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function Dashboard({ reports, demo, onNew, onPage, onReport }: any) {
  const totals = aggregate(reports),
    pending = reports.filter((r) =>
      ["Submitted", "City Verified"].includes(r.status),
    ).length;
  const [chart, setChart] = useState("Waste removed");
  const approved = reports.filter((r) => r.status === "Admin Approved");
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = demo
      ? new Date(2026, 9, 5 + i * 7)
      : new Date(Date.now() - (5 - i) * 7 * 86400000);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      week: `${start.toLocaleDateString("en", { month: "short" })} ${start.getDate()}`,
      actual: approved
        .filter(
          (r) =>
            new Date(r.data.periodEnd) >= start &&
            new Date(r.data.periodEnd) <= end,
        )
        .reduce(
          (s, r) =>
            s +
            Number(
              r.data.metrics?.[
                chart === "Waste removed" ? "waste" : "spaces"
              ] || 0,
            ),
          0,
        ),
      target: chart === "Waste removed" ? 420 : 20,
    };
  });
  if (demo) {
    const a =
      chart === "Waste removed"
        ? [138, 186, 164, 279, 312, 386]
        : [8, 12, 11, 16, 19, 23];
    weeks.forEach((w, i) => {
      w.actual = a[i];
    });
  }
  return (
    <>
      <div className="section-label">
        <h2>
          National overview{" "}
          <span className="subtle-badge">
            {demo ? "Sample programme data" : "Approved reports only"}
          </span>
        </h2>
        <span className="updated">
          <RefreshCw size={12} />{" "}
          {demo
            ? "Illustrative reporting period"
            : "Updated from field reports"}
        </span>
      </div>
      <div className="kpi-grid">
        {targets.slice(0, 4).map((t, i) => {
          const value = demo ? [86, 1842, 72, 94.2][i] : totals[t.key];
          const percent = (value / t.target) * 100;
          const Icon = [Building2, Trash2, Droplets, UsersRound][i];
          return (
            <article className="kpi-card" key={t.key}>
              <div className="kpi-top">
                <span>{t.label}</span>
                <span className={"kpi-icon icon-" + i}>
                  <Icon size={19} />
                </span>
              </div>
              <div className="kpi-value">
                {fmt(value)}
                {t.unit === "%" ? (
                  <small>%</small>
                ) : i === 1 ? (
                  <small>mt</small>
                ) : null}
              </div>
              <div className="kpi-target">
                of {fmt(t.target)}
                {t.unit === "%" ? "%" : ""}{" "}
                {i === 3 ? "participation target" : "programme target"}
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${Math.min(percent, 100)}%`,
                    background: i === 3 ? "#d6a347" : "#388d70",
                  }}
                />
              </div>
              <div className="kpi-bottom">
                <span className={percent >= 75 ? "green" : "amber"}>
                  <span className="dot" />
                  {percent >= 75 ? "On track" : "In progress"}
                </span>
                <strong>{fmt(percent)}% achieved</strong>
              </div>
            </article>
          );
        })}
      </div>
      <div className="dashboard-middle">
        <section className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <h2>Progress over time</h2>
              <p>Turning weekly action into lasting impact</p>
            </div>
            <Select
              value={chart}
              options={["Waste removed", "Public spaces"]}
              placeholder="Indicator"
              onChange={setChart}
            />
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot green-bg" />
              Actual progress
            </span>
            <span>
              <i className="legend-line" />
              Weekly target
            </span>
            <small>
              {chart === "Waste removed" ? "METRIC TONS" : "PUBLIC SPACES"}
            </small>
          </div>
          <div className="main-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={weeks}
                margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64a991" stopOpacity={0.25} />
                    <stop
                      offset="100%"
                      stopColor="#64a991"
                      stopOpacity={0.015}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 4"
                  vertical={false}
                  stroke="#e9edf1"
                />
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#8a94a2" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#8a94a2" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 9,
                    border: "1px solid #e6ebef",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#adb8c7"
                  strokeDasharray="5 5"
                  fill="transparent"
                  strokeWidth={1.5}
                  name="Weekly target"
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#388d70"
                  fill="url(#areaGreen)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                  name="Actual progress"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">
            <span>
              <span className="dot" />{" "}
              {demo ? "Illustrative trend" : "Approved field data"}
            </span>
            <button onClick={() => onPage("Analytics")}>
              Explore analytics <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
        <section className="panel status-panel">
          <div className="panel-heading">
            <div>
              <h2>Reporting pipeline</h2>
              <p>From field activity to verified results</p>
            </div>
            <ClipboardList size={18} color="#8794a4" />
          </div>
          <div className="pipeline-total">
            <strong>{reports.length}</strong>
            <span>
              total reports<small>Across all reporting teams</small>
            </span>
            <div className="pipeline-ring">
              <FileCheck2 size={24} />
            </div>
          </div>
          <div className="stacked-bar">
            {[
              "Admin Approved",
              "City Verified",
              "Submitted",
              "Draft",
              "Returned",
            ].map((s, i) => (
              <i
                key={s}
                style={{
                  width: `${(reports.filter((r) => r.status === s).length / (reports.length || 1)) * 100}%`,
                  background: [
                    "#3c8e71",
                    "#7ba895",
                    "#d5ab58",
                    "#d6dce4",
                    "#cb6c70",
                  ][i],
                }}
              />
            ))}
          </div>
          <div className="pipeline-list">
            {[
              "Admin Approved",
              "City Verified",
              "Submitted",
              "Draft",
              "Returned",
            ].map((s, i) => (
              <div key={s}>
                <span>
                  <i
                    style={{
                      background: [
                        "#3c8e71",
                        "#7ba895",
                        "#d5ab58",
                        "#d6dce4",
                        "#cb6c70",
                      ][i],
                    }}
                  />
                  {s === "Admin Approved"
                    ? "Approved"
                    : s === "City Verified"
                      ? "City verified"
                      : s === "Submitted"
                        ? "Awaiting verification"
                        : s === "Returned"
                          ? "Returned for correction"
                          : "Drafts"}
                </span>
                <strong>{reports.filter((r) => r.status === s).length}</strong>
              </div>
            ))}
          </div>
          <button
            className="pipeline-alert"
            onClick={() => onPage("Field reports")}
          >
            <Clock size={16} />
            <span>
              <strong>
                {reports.filter(isOverdue).length > 0
                  ? `${reports.filter(isOverdue).length} overdue reports`
                  : `${pending} reports need attention`}
              </strong>
              <small>Keep your reporting cycle moving</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </section>
      </div>
      <div className="dashboard-lower">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent field reports</h2>
              <p>The latest updates from our sanitation teams</p>
            </div>
            <button
              className="text-button"
              onClick={() => onPage("Field reports")}
            >
              View all reports <ArrowRight size={14} />
            </button>
          </div>
          <ReportTable
            reports={reports.slice(0, 4)}
            onReport={onReport}
            compact
          />
        </section>
        <section className="panel insight-panel">
          <div className="insight-title">
            <span>
              <Lightbulb size={18} />
            </span>
            <h2>On the radar</h2>
            <span className="subtle-badge">Insights</span>
          </div>
          <div className="insight-item">
            <span className="insight-symbol green-light">
              <TrendingUp size={18} />
            </span>
            <div>
              <h3>Every action adds up</h3>
              <p>
                {demo
                  ? "1,842 metric tons of waste removed. That’s 73.7% of the programme target."
                  : `${fmt(totals.waste)} metric tons of waste removed in approved reports.`}
              </p>
              <button onClick={() => onPage("Analytics")}>
                View performance <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
          <div className="insight-item">
            <span className="insight-symbol amber-light">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h3>Safety stays a priority</h3>
              <p>
                {demo
                  ? "PPE compliance is close to target. Follow up with teams below the 95% threshold."
                  : `${reports.filter((r) => Number(r.data.metrics?.ppe) < 95).length} reports record PPE compliance below 95%.`}
              </p>
              <button onClick={() => onPage("Analytics")}>
                Review compliance <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
          <div className="insight-note">
            <Leaf size={15} />
            <span>Better data. Better decisions. Cleaner cities.</span>
          </div>
        </section>
      </div>
      <div className="bottom-banner">
        <span className="bottom-icon">
          <Globe size={27} />
        </span>
        <div>
          <strong>Local action. National impact.</strong>
          <p>
            Connected teams, accountable progress, and cleaner communities
            across Liberia.
          </p>
        </div>
        <button onClick={() => onPage("Map & coverage")}>
          Explore the coverage map <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
function ReportTable({ reports, onReport, compact = false }: any) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>REPORT / TEAM</th>
            <th>LOCATION</th>
            {!compact && <th>PERIOD</th>}
            <th>STATUS</th>
            <th>UPDATED</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {reports.map((r: any) => (
            <tr
              key={r.id}
              onClick={() => onReport(r)}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onReport(r)}
            >
              <td>
                <strong className="table-team">
                  {r.team || "Untitled team"}
                </strong>
                <span className="table-secondary">
                  {r.number || "Offline draft"} <span>·</span> {r.data.type}
                </span>
              </td>
              <td>
                <span>{r.city}</span>
                <span className="table-secondary">{r.county}</span>
              </td>
              {!compact && (
                <td>
                  {r.data.periodStart}
                  <span className="table-secondary">to {r.data.periodEnd}</span>
                </td>
              )}
              <td>
                <Badge>{r.status}</Badge>
                {isOverdue(r) && (
                  <small className="overdue-tag">
                    <Clock size={10} />
                    Overdue
                  </small>
                )}
              </td>
              <td className="date-cell">
                {r.updatedAt
                  ? new Date(r.updatedAt).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                    })
                  : "Local"}
              </td>
              <td>
                <ChevronRight size={15} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!reports.length && (
        <Empty
          icon={ClipboardList}
          title="No reports in this view"
          text="Adjust your filters or create a field report to start tracking progress."
        />
      )}
    </div>
  );
}
function Reportal({ reports, search, setSearch, onReport }: any) {
  const [status, setStatus] = useState(""),
    [format, setFormat] = useState("csv");
  const shown = reports.filter((r: any) => !status || r.status === status);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>
            Reportal{" "}
            <span className="subtle-badge">{shown.length} reports</span>
          </h2>
          <p>Search, review, and export your field reporting records</p>
        </div>
        <div className="row">
          <Select
            value={format}
            options={["csv", "xlsx", "pdf"]}
            onChange={setFormat}
            placeholder="Export format"
          />
          <Button variant="outline" onClick={() => exportTable(shown, format)}>
            <Download size={15} /> Export
          </Button>
        </div>
      </div>
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Search report, team, or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={status}
          options={[
            "Draft",
            "Submitted",
            "City Verified",
            "Admin Approved",
            "Returned",
          ]}
          placeholder="All statuses"
          onChange={setStatus}
        />
      </div>
      <ReportTable reports={shown} onReport={onReport} />
      <div className="table-bottom">
        Showing {shown.length} reports{" "}
        <span>Open a report to review, verify, or export to PDF</span>
      </div>
    </section>
  );
}
function Empty({ icon: Icon = FileText, title, text }: any) {
  return (
    <div className="empty">
      <span>
        <Icon size={29} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function WasteHeat({ reports }: any) {
  const map = useMap();
  useEffect(() => {
    const points = reports
      .filter((r: any) => r.data.latitude && r.data.longitude)
      .map((r: any) => [
        r.data.latitude,
        r.data.longitude,
        Math.min(1, Number(r.data.metrics?.waste || 0) / 100),
      ]);
    const layer = (L as any)
      .heatLayer(points, {
        radius: 35,
        blur: 24,
        maxZoom: 12,
        gradient: { 0.2: "#6eae95", 0.5: "#d3b767", 0.8: "#c35d63" },
      })
      .addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [reports, map]);
  return null;
}
function CountyCoverage({ reports, level = "county" }: any) {
  const [geo, setGeo] = useState<any>(null);
  useEffect(() => {
    fetch(
      level === "county"
        ? "/counties.geojson"
        : level === "district"
          ? "/districts.geojson"
          : "/cities.geojson",
    )
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => {});
  }, [level]);
  if (!geo) return null;
  return (
    <GeoJSON
      key={level + reports.map((r: any) => r.id + r.status).join(",")}
      data={geo}
      style={(f: any) => {
        const name = String(f.properties.shapeName || "").replace(
          " County",
          "",
        );
        const count = reports.filter(
          (r: any) =>
            String(r[level] || "").replace(" District", "") === name &&
            r.status === "Admin Approved",
        ).length;
        return {
          color: "#718a9a",
          weight: 1,
          fillOpacity: 0.24,
          fillColor: count > 5 ? "#28775a" : count > 0 ? "#83ad8b" : "#d8b6a8",
        };
      }}
      onEachFeature={(f: any, layer: any) => {
        const name = String(f.properties.shapeName || "").replace(
          " County",
          "",
        );
        const count = reports.filter(
          (r: any) =>
            String(r[level] || "").replace(" District", "") === name &&
            r.status === "Admin Approved",
        ).length;
        const node = document.createElement("div");
        node.textContent = `${name}: ${count} approved reports`;
        layer.bindPopup(node);
      }}
    />
  );
}
function MapFit({ locations }: any) {
  const map = useMap();
  useEffect(() => {
    const points = locations
      .filter((l: any) => l.type === "City")
      .map((l: any) => [Number(l.latitude), Number(l.longitude)]);
    if (points.length)
      map.fitBounds(points, { padding: [55, 55], maxZoom: 11 });
  }, [locations]);
  return null;
}
function MapView({ reports, locations }: any) {
  const [heat, setHeat] = useState(false);
  const activeCommunities = new Set(
    reports
      .filter((r: any) => r.status === "Admin Approved")
      .map((r: any) => r.community),
  );
  const gaps = locations.filter(
    (l: any) => l.type === "Community" && !activeCommunities.has(l.name),
  );
  return (
    <>
      <div className="map-summary">
        <span>
          <span className="dot" />
          {reports.length} reporting activities
        </span>
        <span>
          <MapPin size={15} />
          {locations.filter((l: any) => l.type === "City").length} cities
        </span>
        <span>
          <Target size={15} />
          {gaps.length} communities without approved activity
        </span>
        <button
          className={heat ? "text-button green" : "text-button"}
          onClick={() => setHeat(!heat)}
        >
          <Layers size={16} />
          {heat ? "Hide waste intensity" : "Show waste intensity"}
        </button>
      </div>
      <section className="panel map-panel">
        <MapContainer
          center={[6.3, -10.5]}
          zoom={8}
          style={{ height: 510, width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFit locations={locations} />
          {heat && <WasteHeat reports={reports} />}
          <LayersControl position="topright">
            <LayersControl.Overlay name="County coverage choropleth">
              <LayerGroup>
                <CountyCoverage reports={reports} />
              </LayerGroup>
            </LayersControl.Overlay>
            <LayersControl.Overlay name="District coverage choropleth">
              <LayerGroup>
                <CountyCoverage reports={reports} level="district" />
              </LayerGroup>
            </LayersControl.Overlay>
            <LayersControl.Overlay name="City coverage (available boundaries)">
              <LayerGroup>
                <CountyCoverage reports={reports} level="city" />
              </LayerGroup>
            </LayersControl.Overlay>
            <LayersControl.Overlay checked name="Team locations">
              <LayerGroup>
                {reports
                  .filter((r: any) => r.data.latitude && r.data.longitude)
                  .map((r: any) => (
                    <CircleMarker
                      key={r.id}
                      center={[r.data.latitude, r.data.longitude]}
                      radius={7}
                      pathOptions={{
                        color: "#234c7c",
                        fillOpacity: 0.7,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <strong>{r.team}</strong>
                        <p>
                          {r.city} · {r.community}
                        </p>
                        <p>{r.data.metrics?.waste || 0} mt waste removed</p>
                        <Badge>{r.status}</Badge>
                      </Popup>
                    </CircleMarker>
                  ))}
              </LayerGroup>
            </LayersControl.Overlay>
            {["Cleaned sites", "Drainages", "Awareness sites"].map(
              (name, i) => (
                <LayersControl.Overlay checked key={name} name={name}>
                  <LayerGroup>
                    {reports.flatMap((r: any) =>
                      (i === 2
                        ? r.data.awareness || []
                        : r.data.sanitation || []
                      )
                        .filter(
                          (a: any) =>
                            i !== 1 || a.activities?.includes("Drain"),
                        )
                        .filter((a: any) => a.latitude || r.data.latitude)
                        .map((a: any, j: number) => (
                          <CircleMarker
                            key={r.id + j}
                            center={[
                              Number(a.latitude || r.data.latitude),
                              Number(a.longitude || r.data.longitude),
                            ]}
                            radius={i === 2 ? 5 : 8}
                            pathOptions={{
                              color:
                                i === 2
                                  ? "#bd974c"
                                  : a.after === "Good"
                                    ? "#37886a"
                                    : a.after === "Fair"
                                      ? "#ce9d3a"
                                      : "#c5535c",
                              fillOpacity: 0.65,
                            }}
                          >
                            <Popup>
                              <strong>{a.site}</strong>
                              <p>
                                {name} · {r.city}
                              </p>
                              <p>
                                {a.before && `${a.before} → ${a.after}`}
                                {i === 2 && `${a.reached} people reached`}
                              </p>
                            </Popup>
                          </CircleMarker>
                        )),
                    )}
                  </LayerGroup>
                </LayersControl.Overlay>
              ),
            )}
            <LayersControl.Overlay checked name="Nearest markets">
              <LayerGroup>
                {locations
                  .filter((l: any) => l.type === "Market")
                  .map((l: any) => (
                    <CircleMarker
                      key={l.id}
                      center={[l.latitude, l.longitude]}
                      radius={5}
                      pathOptions={{ color: "#94679e", fillOpacity: 0.8 }}
                    >
                      <Popup>
                        <strong>{l.name}</strong>
                        <p>
                          {l.city}, {l.county}
                        </p>
                      </Popup>
                    </CircleMarker>
                  ))}
              </LayerGroup>
            </LayersControl.Overlay>
          </LayersControl>
        </MapContainer>
        <div className="map-legend">
          <span>
            <i style={{ background: "#37886a" }} />
            Good condition
          </span>
          <span>
            <i style={{ background: "#ce9d3a" }} />
            Fair condition
          </span>
          <span>
            <i style={{ background: "#c5535c" }} />
            Poor condition
          </span>
          <span>
            <i style={{ background: "#94679e" }} />
            Market
          </span>
        </div>
      </section>
      <section className="panel hotspot-panel">
        <div className="panel-heading">
          <div>
            <h2>Activity hotspots & clusters</h2>
            <p>
              Spatial grouping of reporting sites within 1 km · counts activity
              locations, not unique waste events
            </p>
          </div>
        </div>
        <div className="cluster-grid">
          {clusterSites(reports)
            .slice(0, 6)
            .map((c: any, i: number) => (
              <div key={i}>
                <MapPinned size={18} />
                <strong>{c.city}</strong>
                <span>{c.points.length} nearby activities</span>
                <small>{fmt(c.waste)} mt recorded</small>
              </div>
            ))}
          {!clusterSites(reports).length && (
            <p className="muted">
              Capture report GPS coordinates to identify activity clusters.
            </p>
          )}
        </div>
      </section>
      <div className="two-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Coverage gaps</h2>
            <Badge>{gaps.length + " communities"}</Badge>
          </div>
          {gaps.length ? (
            gaps.map((l: any) => (
              <div className="simple-row" key={l.id}>
                <MapPin size={17} />
                <div>
                  <strong>{l.name}</strong>
                  <small>
                    {l.city} · {l.county}
                  </small>
                </div>
                <Badge>No approved activity</Badge>
              </div>
            ))
          ) : (
            <Empty
              title="Every community has activity"
              text="All communities in this view have at least one approved report."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Site-to-market distance</h2>
          </div>
          {reports
            .filter((r: any) => r.data.latitude && r.data.longitude)
            .slice(0, 5)
            .map((r: any) => {
              const markets = locations
                .filter((l: any) => l.type === "Market")
                .map((l: any) => ({
                  ...l,
                  distance: haversine(
                    r.data.latitude,
                    r.data.longitude,
                    l.latitude,
                    l.longitude,
                  ),
                }))
                .sort((a: any, b: any) => a.distance - b.distance);
              return (
                <div className="simple-row" key={r.id}>
                  <Navigation size={16} />
                  <div>
                    <strong>{r.team}</strong>
                    <small>{markets[0]?.name || "No market coordinates"}</small>
                  </div>
                  <b>
                    {markets.length ? fmt(markets[0].distance) + " km" : "—"}
                  </b>
                </div>
              );
            })}
        </section>
      </div>
    </>
  );
}
function clusterSites(reports: any[]) {
  const clusters: any[] = [];
  for (const r of reports.filter((r) => r.data.latitude && r.data.longitude)) {
    const found = clusters.find(
      (c) =>
        haversine(c.latitude, c.longitude, r.data.latitude, r.data.longitude) <=
        1,
    );
    if (found) {
      found.points.push(r.id);
      found.waste += Number(r.data.metrics?.waste || 0);
    } else
      clusters.push({
        latitude: r.data.latitude,
        longitude: r.data.longitude,
        city: r.city,
        points: [r.id],
        waste: Number(r.data.metrics?.waste || 0),
      });
  }
  return clusters.sort((a, b) => b.points.length - a.points.length);
}
function haversine(a: number, b: number, c: number, d: number) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function Analytics({ reports, locations }: any) {
  const totals = aggregate(reports),
    approved = reports.filter((r: any) => r.status === "Admin Approved");
  const cities = Array.from(new Set(reports.map((r: any) => r.city)))
    .map((city) => {
      const r = approved.filter((r: any) => r.city === city);
      return {
        name: city,
        waste: r.reduce(
          (s: number, r: any) => s + Number(r.data.metrics?.waste || 0),
          0,
        ),
        spaces: r.reduce(
          (s: number, r: any) => s + Number(r.data.metrics?.spaces || 0),
          0,
        ),
      };
    })
    .sort((a, b) => b.waste - a.waste);
  const gender = [
    {
      name: "Male",
      value: approved.reduce(
        (s: number, r: any) => s + Number(r.data.attendance?.presentMale || 0),
        0,
      ),
    },
    {
      name: "Female",
      value: approved.reduce(
        (s: number, r: any) =>
          s + Number(r.data.attendance?.presentFemale || 0),
        0,
      ),
    },
  ];
  const wastes = ["Household", "Municipal"].map((name) => ({
    name,
    value: approved.reduce(
      (s: number, r: any) =>
        s +
        (r.data.sanitation || [])
          .filter((a: any) => a.wasteType === name)
          .reduce((v: number, a: any) => v + Number(a.weight || 0), 0),
      0,
    ),
  }));
  const awareness = cities.map((c) => ({
    name: c.name,
    reach: approved
      .filter((r: any) => r.city === c.name)
      .reduce(
        (s: number, r: any) =>
          s +
          (r.data.awareness || []).reduce(
            (v: number, a: any) => v + Number(a.reached || 0),
            0,
          ),
        0,
      ),
  }));
  const teamRanks = Array.from(new Set(approved.map((r: any) => r.team)))
    .map((team) => {
      const r = approved.filter((r: any) => r.team === team);
      const tons = r.reduce(
          (s: number, r: any) => s + Number(r.data.metrics?.waste || 0),
          0,
        ),
        cost = r.reduce((s: number, r: any) => s + Number(r.data.cost || 0), 0);
      return { team, tons, cost };
    })
    .sort((a, b) => b.tons - a.tons);
  return (
    <>
      <div className="section-label">
        <h2>Programme performance</h2>
        <span className="updated">Calculated from approved reports</span>
      </div>
      <div className="metric-matrix">
        {targets.map((t) => (
          <div className="panel mini-metric" key={t.key}>
            <span>{t.label}</span>
            <strong>
              {fmt(totals[t.key])}
              {t.unit === "%" ? "%" : ""}
            </strong>
            <div className="progress">
              <i
                style={{
                  width: `${Math.min((totals[t.key] / t.target) * 100, 100)}%`,
                  background:
                    totals[t.key] / t.target >= 0.95
                      ? "#388d70"
                      : totals[t.key] / t.target >= 0.7
                        ? "#c69b45"
                        : "#bd5b64",
                }}
              />
            </div>
            <small>
              {fmt((totals[t.key] / t.target) * 100)}% of {fmt(t.target)} target
            </small>
          </div>
        ))}
      </div>
      <div className="two-grid">
        <ChartPanel title="City performance · waste removed (mt)">
          <BarChart data={cities}>
            <CartesianGrid vertical={false} stroke="#eef0f3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar
              dataKey="waste"
              name="Waste (mt)"
              fill="#3c8e71"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="Attendance by gender">
          <PieChart>
            <Pie
              data={gender}
              dataKey="value"
              nameKey="name"
              innerRadius={65}
              outerRadius={94}
              paddingAngle={4}
            >
              {gender.map((g, i) => (
                <Cell key={g.name} fill={["#24486f", "#73ab94"][i]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartPanel>
        <ChartPanel title="Waste composition">
          <BarChart data={wastes}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar
              dataKey="value"
              name="Metric tons"
              fill="#24486f"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="Awareness reach by city">
          <BarChart data={awareness}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar
              dataKey="reach"
              name="People reached"
              fill="#c5a05e"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ChartPanel>
      </div>
      <div className="two-grid">
        <ChartPanel title="Indicators · target vs actual (%)">
          <BarChart
            data={targets.map((t) => ({
              name: t.key,
              actual: Number(((totals[t.key] / t.target) * 100).toFixed(1)),
              target: 100,
            }))}
          >
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="actual" fill="#3c8e71" />
            <Bar dataKey="target" fill="#e2e8ed" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="PPE compliance by city (%)">
          <BarChart
            data={cities.map((c) => {
              const list = approved.filter((r: any) => r.city === c.name);
              return {
                name: c.name,
                ppe:
                  list.reduce(
                    (s: number, r: any) => s + Number(r.data.metrics?.ppe || 0),
                    0,
                  ) / (list.length || 1),
                target: 95,
              };
            })}
          >
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="ppe" name="PPE compliance" fill="#bc9d62" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="Behaviour change ratings (1–5)">
          <BarChart
            data={[1, 2, 3, 4, 5].map((n) => ({
              name: String(n),
              activities: approved.reduce(
                (s: number, r: any) =>
                  s +
                  (r.data.awareness || []).filter(
                    (a: any) => Number(a.rating) === n,
                  ).length,
                0,
              ),
            }))}
          >
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar
              dataKey="activities"
              name="Awareness activities"
              fill="#658aa8"
            />
          </BarChart>
        </ChartPanel>
        <section className="panel">
          <div className="panel-heading">
            <h2>District progress signals</h2>
          </div>
          {Array.from(new Set(reports.map((r: any) => r.district)))
            .filter(Boolean)
            .map((district: any) => {
              const list = reports.filter((r: any) => r.district === district);
              const rate =
                (list.filter((r: any) => r.status === "Admin Approved").length /
                  (list.length || 1)) *
                100;
              return (
                <div className="simple-row" key={district}>
                  <Target size={17} />
                  <div>
                    <strong>{district}</strong>
                    <small>
                      {fmt(rate)}% of reports approved · {list.length} submitted
                      or draft records
                    </small>
                  </div>
                  <Badge>{rate < 70 ? "Needs follow-up" : "On track"}</Badge>
                </div>
              );
            })}
        </section>
      </div>
      <div className="two-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Team rankings & productivity</h2>
          </div>
          {teamRanks.map((t, i) => (
            <div className="simple-row" key={String(t.team)}>
              <span className="rank">{i + 1}</span>
              <div>
                <strong>{String(t.team)}</strong>
                <small>
                  {t.cost
                    ? `USD ${fmt(t.cost / (t.tons || 1))} per metric ton`
                    : "Cost data not entered"}
                </small>
              </div>
              <b>{fmt(t.tons)} mt</b>
            </div>
          ))}
          {!teamRanks.length && (
            <Empty
              title="Rankings appear with approvals"
              text="Approve field reports to compare team performance."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Risk & forecast signals</h2>
          </div>
          <div className="signal">
            <ShieldCheck size={19} />
            <div>
              <h3>
                {
                  reports.filter((r: any) => Number(r.data.metrics?.ppe) < 95)
                    .length
                }{" "}
                PPE risk flags
              </h3>
              <p>Reports below the 95% compliance target require follow-up.</p>
            </div>
          </div>
          <div className="signal">
            <TrendingUp size={19} />
            <div>
              <h3>Waste target projection</h3>
              <p>
                {approved.length
                  ? `${fmt(Math.max(0, 2500 - totals.waste) / (totals.waste / approved.length || 1))} more comparable reports to reach the target at the current average.`
                  : "Approve reports to establish a reporting baseline."}
              </p>
            </div>
          </div>
          <div className="signal">
            <UsersRound size={19} />
            <div>
              <h3>Youth inclusion: {fmt(totals.youth)}%</h3>
              <p>
                {fmt(Math.max(0, 95 - totals.youth))} percentage points
                remaining to the participation target.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
function ChartPanel({ title, children }: any) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
      </div>
      <div className="analytics-chart">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
function Login({ onClose, onLogin, required = false }: any) {
  const [configuration, setConfiguration] = useState<any>(null);
  useEffect(() => {
    api("/config")
      .then(setConfiguration)
      .catch(() => {});
  }, []);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reset, setReset] = useState(false);
  return (
    <div className="modal-backdrop">
      <div
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to PCCI"
      >
        {!required && (
          <button
            className="modal-x icon-button"
            aria-label="Close login"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        )}
        <span className="login-mark">
          <Flag size={26} />
        </span>
        <div className="eyebrow">PRESIDENTIAL CLEAN CITIES INITIATIVE</div>
        <h2>{reset ? "Recover your account" : "Welcome to your workspace."}</h2>
        <p>
          {reset
            ? "Contact your Super Admin for a secure password reset."
            : "Sign in to report, verify, and track progress across Liberia."}
        </p>
        {configuration?.administratorBootstrapConfigured === false &&
          !reset && (
            <div className="notice">
              Initial administrator setup is incomplete. Existing accounts can
              still sign in. Access is restricted to accounts created by a Super Admin.
            </div>
          )}
        {!reset && <p>Authorized users only. Contact your Super Admin to request an account.</p>}
        {reset ? (
          <>
            <div className="notice">
              For account security, a Super Admin resets your password from
              Users & roles after verifying your identity. Passwords must have
              at least 10 characters.
            </div>
            <Button variant="outline" onClick={() => setReset(false)}>
              Back to sign in
            </Button>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                onLogin(await api("/login", "POST", Object.fromEntries(f)));
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Username">
              <input
                autoFocus
                required
                name="username"
                autoComplete="username"
                placeholder="Your assigned username"
              />
            </Field>
            <Field label="Password">
              <input
                required
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </Field>
            {error && <div className="error">{error}</div>}
            <Button disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in to portal"}
              <ArrowRight size={17} />
            </Button>
            <button
              className="forgot text-button"
              type="button"
              onClick={() => setReset(true)}
            >
              Forgot your password?
            </button>
          </form>
        )}
        <div className="login-footer">
          <LockKeyhole size={13} /> Secure access · Sessions expire after 30
          minutes
        </div>
      </div>
    </div>
  );
}
function Cascades({ value, onChange, locations, disabled = false }: any) {
  return (
    <>
      {["County", "City", "District", "Community", "Market"].map((type, i) => {
        const key = ["county", "city", "district", "community", "market"][i];
        const parent = ["", "county", "city", "district", "community"][i];
        const p = locations.find(
          (l: any) =>
            l.type === ["", "County", "City", "District", "Community"][i] &&
            l.name === value[parent],
        );
        const options = locations.filter(
          (l: any) => l.type === type && (!i || l.parentId === p?.id),
        );
        return (
          <Field
            key={type}
            label={
              type === "Market"
                ? "Nearest market"
                : type === "Community"
                  ? "Community name"
                  : type
            }
          >
            <Select
              value={value[key]}
              onChange={(v: string) => {
                const obj = { ...value, [key]: v };
                ["county", "city", "district", "community", "market"]
                  .slice(i + 1)
                  .forEach((k) => (obj[k] = ""));
                onChange(obj);
              }}
              options={options}
              disabled={disabled || (!!i && !value[parent])}
              placeholder={"Select " + type.toLowerCase()}
            />
          </Field>
        );
      })}
    </>
  );
}
function ReportEditor({
  report,
  reports,
  user,
  locations,
  onClose,
  onSave,
  notify,
}: any) {
  const savedSnapshot = useRef(JSON.stringify(report));
  const [r, setR] = useState<any>(() => structuredClone(report)),
    [tab, setTab] = useState("Team & location"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState<any>(null);
  const editable =
    !!user &&
    ["Draft", "Returned"].includes(r.status) &&
    ["Super Admin", "Admin/M&E Officer", "Team Supervisor"].includes(user.role);
  const setD = (key: string, v: any) =>
    setR((r: any) => ({ ...r, data: { ...r.data, [key]: v } }));
  const data = r.data;
  const tabs = [
    "Team & location",
    "Progress & attendance",
    "Sanitation",
    "Awareness",
    "Equipment",
    "Challenges & photos",
    "Review",
  ];
  const total = aggregate(reports.filter((v: any) => v.id !== r.id));
  useEffect(() => {
    if (!editable || !user || JSON.stringify(r) === savedSnapshot.current)
      return;
    const timer = setTimeout(
      () => queueDraft(user.id, r).catch(() => {}),
      1000,
    );
    return () => clearTimeout(timer);
  }, [r]);
  async function save() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await queueDraft(user.id, r);
      if (!navigator.onLine) {
        await onSave({ ...r, updatedAt: new Date().toISOString() });
        notify("Draft saved on this device. It syncs when connected.");
        return r;
      }
      const saved = await api(`/reports/${r.id}`, "PUT", r);
      await discardDraft(user.id, r.id);
      savedSnapshot.current = JSON.stringify(saved);
      setR(saved);
      await onSave(saved);
      notify("Field report saved");
      return saved;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function transition() {
    setBusy(true);
    setError("");
    try {
      const saved = await api(`/reports/${r.id}/transition`, "POST", review);
      savedSnapshot.current = JSON.stringify(saved);
      await discardDraft(user.id, r.id);
      setR(saved);
      setReview(null);
      await onSave(saved);
      notify("Report status updated");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const inpt = (key: string, type = "text", required = false) => (
    <input
      type={type}
      value={data[key] || ""}
      disabled={!editable}
      required={required}
      onChange={(e) =>
        setD(key, type === "number" ? Number(e.target.value) : e.target.value)
      }
    />
  );
  const canSubmit =
    user &&
    ["Super Admin", "Admin/M&E Officer", "Team Supervisor"].includes(
      user.role,
    ) &&
    ["Draft", "Returned"].includes(r.status);
  const canVerify =
    user &&
    ["Super Admin", "Admin/M&E Officer", "City Verifier"].includes(user.role) &&
    r.status === "Submitted";
  const canApprove =
    user &&
    ["Super Admin", "Admin/M&E Officer"].includes(user.role) &&
    r.status === "City Verified";
  return (
    <div className="modal-backdrop report-backdrop">
      <div
        className="report-modal"
        role="dialog"
        aria-modal="true"
        aria-label="PCCI field report"
      >
        <div className="report-modal-heading">
          <div>
            <div className="eyebrow">PCCI FIELD REPORT</div>
            <h2>
              {r.number || "New field report"} <Badge>{r.status}</Badge>
            </h2>
          </div>
          <div className="row">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reportPDF(r, reports)}
            >
              <Download size={14} /> PDF
            </Button>
            <button
              className="icon-button"
              aria-label="Close report"
              onClick={async () => {
                if (editable && JSON.stringify(r) !== savedSnapshot.current)
                  await queueDraft(user.id, r);
                onClose();
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>
        <div className="report-tabs">
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="report-body">
          {!user && (
            <div className="notice">
              This is an illustrative report. Sign in to create and manage
              official records.
            </div>
          )}
          {error && <div className="error">{error}</div>}
          {tab === "Team & location" && (
            <>
              <h3>Section A · Team information</h3>
              <div className="form-grid">
                <Field label="Team name *">
                  <input
                    value={r.team}
                    disabled={!editable}
                    onChange={(e) => setR({ ...r, team: e.target.value })}
                  />
                </Field>
                <Field label="Report type">
                  <Select
                    disabled={!editable}
                    value={data.type}
                    options={["Daily", "Weekly"]}
                    onChange={(v: string) => setD("type", v)}
                  />
                </Field>
                <Field label="Supervisor *">{inpt("supervisor")}</Field>
                <Field label="Phone number">{inpt("phone", "tel")}</Field>
                <Field label="Period start *">
                  {inpt("periodStart", "date")}
                </Field>
                <Field label="Period end *">{inpt("periodEnd", "date")}</Field>
                <Field label="Work zone">{inpt("zone")}</Field>
                <Field label="Activity cost (USD, optional)">
                  {inpt("cost", "number")}
                </Field>
              </div>
              <h3>Assigned location</h3>
              <div className="form-grid">
                <Cascades
                  value={{ ...r, market: data.market }}
                  locations={locations}
                  disabled={!editable}
                  onChange={(v: any) =>
                    setR({
                      ...r,
                      county: v.county,
                      city: v.city,
                      district: v.district,
                      community: v.community,
                      data: { ...data, market: v.market },
                    })
                  }
                />
                <Field label="GPS coordinates">
                  <div className="row">
                    <input
                      readOnly
                      value={
                        data.latitude
                          ? `${Number(data.latitude).toFixed(5)}, ${Number(data.longitude).toFixed(5)}`
                          : "Not captured"
                      }
                    />
                    <Button
                      disabled={!editable}
                      variant="outline"
                      onClick={() =>
                        navigator.geolocation
                          ? navigator.geolocation.getCurrentPosition(
                              (p) =>
                                setR({
                                  ...r,
                                  data: {
                                    ...data,
                                    latitude: p.coords.latitude,
                                    longitude: p.coords.longitude,
                                  },
                                }),
                              () =>
                                setError(
                                  "Location access failed. Enable GPS and location permissions.",
                                ),
                            )
                          : setError("Geolocation is unavailable")
                      }
                    >
                      <LocateFixed size={16} /> Capture GPS
                    </Button>
                  </div>
                </Field>
              </div>
            </>
          )}
          {tab === "Progress & attendance" && (
            <>
              <h3>Section B · Progress against programme targets</h3>
              <p className="muted">
                Enter this period’s result. Cumulative totals include approved
                reports plus this period. Percentage indicators use the average
                of report percentages.
              </p>
              <div className="table-scroll">
                <table className="form-table">
                  <thead>
                    <tr>
                      <th>INDICATOR</th>
                      <th>TARGET</th>
                      <th>THIS PERIOD</th>
                      <th>CUMULATIVE</th>
                      <th>ACHIEVED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((t) => {
                      const old = reports.filter(
                        (v: any) =>
                          v.id !== r.id && v.status === "Admin Approved",
                      );
                      const value = ["youth", "cbo", "ppe"].includes(t.key)
                        ? (Number(total[t.key]) * old.length +
                            Number(data.metrics?.[t.key] || 0)) /
                          (old.length + 1)
                        : Number(total[t.key]) +
                          Number(data.metrics?.[t.key] || 0);
                      return (
                        <tr key={t.key}>
                          <td>{t.label}</td>
                          <td>
                            {fmt(t.target)} {t.unit}
                          </td>
                          <td>
                            <input
                              min="0"
                              max={t.unit === "%" ? 100 : undefined}
                              type="number"
                              step="any"
                              disabled={!editable}
                              value={data.metrics?.[t.key] || 0}
                              onChange={(e) =>
                                setD("metrics", {
                                  ...data.metrics,
                                  [t.key]: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td>{fmt(value)}</td>
                          <td>{fmt((value / t.target) * 100)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <h3>Attendance & PPE</h3>
              <div className="table-scroll">
                <table className="form-table">
                  <thead>
                    <tr>
                      <th>CATEGORY</th>
                      <th>MALE</th>
                      <th>FEMALE</th>
                      <th>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      "assigned",
                      "present",
                      "excused",
                      "absent",
                      "compliant",
                      "nonCompliant",
                    ].map((k) => (
                      <tr key={k}>
                        <td>
                          {(
                            {
                              compliant: "PPE-compliant",
                              nonCompliant: "Non-compliant",
                            } as any
                          )[k] || k[0].toUpperCase() + k.slice(1)}
                        </td>
                        {["Male", "Female"].map((g) => (
                          <td key={g}>
                            <input
                              type="number"
                              min="0"
                              disabled={!editable}
                              value={data.attendance?.[k + g] || 0}
                              onChange={(e) =>
                                setD("attendance", {
                                  ...data.attendance,
                                  [k + g]: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                        ))}
                        <td>
                          {Number(data.attendance?.[k + "Male"] || 0) +
                            Number(data.attendance?.[k + "Female"] || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Field label="Attendance notes">
                <textarea
                  value={data.attendanceNotes || ""}
                  disabled={!editable}
                  onChange={(e) => setD("attendanceNotes", e.target.value)}
                />
              </Field>
            </>
          )}
          {tab === "Sanitation" && (
            <>
              <h3>Sanitation activities</h3>
              <Repeater
                rows={data.sanitation || []}
                editable={editable}
                onChange={(v: any) => setD("sanitation", v)}
                fields={[
                  ["site", "Site name"],
                  [
                    "siteType",
                    "Site type",
                    ["Public space", "Road", "Market", "Drainage", "Community"],
                  ],
                  ["location", "Location / map pin description"],
                  ["latitude", "Latitude", "number"],
                  ["longitude", "Longitude", "number"],
                  [
                    "activities",
                    "Activities",
                    ["Sweeping", "Brushing", "Sand Removal", "Clear Drains"],
                  ],
                  ["date", "Activity date", "date"],
                  ["start", "Start time", "time"],
                  ["end", "End time", "time"],
                  ["wasteType", "Waste type", ["Household", "Municipal"]],
                  ["weight", "Estimated weight (mt)", "number"],
                  ["before", "Condition before", ["Poor", "Fair", "Good"]],
                  ["after", "Condition after", ["Poor", "Fair", "Good"]],
                ]}
              />
            </>
          )}
          {tab === "Awareness" && (
            <>
              <h3>Awareness & community engagement</h3>
              <Repeater
                rows={data.awareness || []}
                editable={editable}
                onChange={(v: any) => setD("awareness", v)}
                fields={[
                  ["site", "Site name"],
                  [
                    "siteType",
                    "Site type",
                    [
                      "Community",
                      "City Centre",
                      "Market",
                      "School",
                      "Religious Centre",
                      "Bus Station",
                    ],
                  ],
                  ["medium", "Medium", ["In-person", "Digital"]],
                  ["conducted", "Conducted?", ["Yes", "No"]],
                  ["reached", "People reached", "number"],
                  [
                    "rating",
                    "Behaviour change rating",
                    ["1", "2", "3", "4", "5"],
                  ],
                ]}
              />
              <div className="notice">
                <UsersRound size={18} /> Total people reached:{" "}
                <strong>
                  {fmt(
                    (data.awareness || []).reduce(
                      (s: number, a: any) => s + Number(a.reached || 0),
                      0,
                    ),
                  )}
                </strong>
              </div>
            </>
          )}
          {tab === "Equipment" && (
            <>
              <h3>Equipment inventory</h3>
              <Repeater
                rows={data.equipment || []}
                editable={editable}
                onChange={(v: any) => setD("equipment", v)}
                fields={[
                  ["name", "Equipment"],
                  ["received", "Quantity received", "number"],
                  ["available", "Quantity available", "number"],
                  [
                    "condition",
                    "Condition",
                    ["Good", "Fair", "Poor", "Requires replacement"],
                  ],
                ]}
              />
            </>
          )}
          {tab === "Challenges & photos" && (
            <>
              <h3>Challenges & escalations</h3>
              <Repeater
                rows={data.challenges || []}
                editable={editable}
                onChange={(v: any) => setD("challenges", v)}
                fields={[
                  ["challenge", "Challenge"],
                  ["escalation", "Escalation / support needed"],
                  ["responsible", "Responsible person"],
                  ["priority", "Priority", ["Low", "Medium", "High"]],
                ]}
              />
              <h3>Documentation checklist</h3>
              {[
                "Before photos captured",
                "After photos captured",
                "Attendance verified",
                "GPS coordinates confirmed",
                "Supervisor review completed",
              ].map((k) => (
                <label className="checkbox-row" key={k}>
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={data.checklist?.[k] || false}
                    onChange={(e) =>
                      setD("checklist", {
                        ...data.checklist,
                        [k]: e.target.checked,
                      })
                    }
                  />
                  {k}
                </label>
              ))}
              <div className="photo-upload">
                <Upload size={24} />
                <h3>Before & after photographs</h3>
                <p>
                  JPG, PNG, or WebP · up to 5 MB each · save the report before
                  uploading
                </p>
                <input
                  type="file"
                  aria-label="Upload documentation photo"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={!editable || !r.number || !navigator.onLine}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setError("Photo must be smaller than 5 MB");
                      return;
                    }
                    try {
                      const base64 = await new Promise<string>(
                        (resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () =>
                            resolve(String(reader.result).split(",")[1]);
                          reader.onerror = reject;
                          reader.readAsDataURL(file);
                        },
                      );
                      const photo = await api(
                        `/reports/${r.id}/photos`,
                        "POST",
                        { base64, type: file.type, name: file.name },
                      );
                      setD("photos", [...(data.photos || []), photo]);
                      notify("Photo uploaded. Save the report to attach it.");
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                />
              </div>
              <div className="photo-grid">
                {(data.photos || []).map((p: any) => (
                  <figure key={p.id}>
                    <img src={p.url} alt={p.name} />
                    <figcaption>{p.name}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
          {tab === "Review" && (
            <>
              <h3>Report workflow</h3>
              <div className="workflow">
                {["Draft", "Submitted", "City Verified", "Admin Approved"].map(
                  (s, i) => (
                    <React.Fragment key={s}>
                      <span className={r.status === s ? "current" : ""}>
                        <span>{i + 1}</span>
                        {s}
                      </span>
                      {i < 3 && <ArrowRight size={14} />}
                    </React.Fragment>
                  ),
                )}
              </div>
              <div className="notice">
                Drafts are editable by the reporting team. Submitted reports
                require city verification, followed by final administrative
                approval. Returned reports include correction comments.
              </div>
              <h3>Review history</h3>
              {(data.history || []).length ? (
                (data.history || []).map((h: any, i: number) => (
                  <div className="history" key={i}>
                    <Badge>{h.status}</Badge>
                    <strong>{h.name}</strong>
                    <span>{h.position}</span>
                    <small>{new Date(h.date).toLocaleString()}</small>
                    {h.signature && <p>Signed: {h.signature}</p>}
                    {h.comment && <p>{h.comment}</p>}
                  </div>
                ))
              ) : (
                <Empty
                  title="No review actions yet"
                  text="Submit a completed report to begin verification."
                />
              )}
            </>
          )}
          {review && (
            <div className="review-box">
              <h3>
                {review.status === "Returned"
                  ? "Return with comments"
                  : review.status}
              </h3>
              {review.status === "City Verified" && (
                <div className="form-grid">
                  <Field label="Verifier position">
                    <input
                      value={review.position || ""}
                      onChange={(e) =>
                        setReview({ ...review, position: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="E-signature (type full name)">
                    <input
                      value={review.signature || ""}
                      onChange={(e) =>
                        setReview({ ...review, signature: e.target.value })
                      }
                    />
                  </Field>
                </div>
              )}
              <Field
                label={
                  review.status === "Returned"
                    ? "Required correction comments"
                    : "Comments (optional)"
                }
              >
                <textarea
                  value={review.comment || ""}
                  onChange={(e) =>
                    setReview({ ...review, comment: e.target.value })
                  }
                />
              </Field>
              <p className="muted">
                Your name and timestamp are recorded with this action.
              </p>
              <div className="row">
                <Button disabled={busy} onClick={transition}>
                  Confirm {review.status.toLowerCase()}
                </Button>
                <Button variant="ghost" onClick={() => setReview(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="report-footer">
          <span>
            <ShieldCheck size={14} />
            {editable
              ? "Drafts save on this device automatically"
              : "Protected reporting record"}
          </span>
          <div className="row">
            {editable && (
              <Button variant="outline" disabled={busy} onClick={save}>
                <Save size={16} />
                {busy ? "Saving…" : "Save draft"}
              </Button>
            )}
            {canSubmit && (
              <Button
                disabled={busy}
                onClick={async () => {
                  const saved = await save();
                  if (saved && navigator.onLine) {
                    setTab("Review");
                    setReview({ status: "Submitted" });
                  }
                }}
              >
                <Send size={15} /> Submit report
              </Button>
            )}
            {canVerify && (
              <Button
                onClick={() => {
                  setTab("Review");
                  setReview({ status: "City Verified" });
                }}
              >
                <FileCheck2 size={15} /> Verify report
              </Button>
            )}
            {canApprove && (
              <Button
                onClick={() => {
                  setTab("Review");
                  setReview({ status: "Admin Approved" });
                }}
              >
                Approve report
              </Button>
            )}
            {(canVerify || canApprove) && (
              <Button
                variant="outline"
                onClick={() => {
                  setTab("Review");
                  setReview({ status: "Returned" });
                }}
              >
                Return
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function Repeater({ rows, fields, editable, onChange }: any) {
  return (
    <>
      <div className="repeaters">
        {rows.map((r: any, i: number) => (
          <div className="repeat-row" key={i}>
            <div className="repeat-header">
              <strong>Entry {String(i + 1).padStart(2, "0")}</strong>
              {editable && fields.some((f: any) => f[0] === "latitude") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigator.geolocation?.getCurrentPosition((p) =>
                      onChange(
                        rows.map((a: any, j: number) =>
                          j === i
                            ? {
                                ...a,
                                latitude: p.coords.latitude,
                                longitude: p.coords.longitude,
                              }
                            : a,
                        ),
                      ),
                    )
                  }
                >
                  <MapPin size={13} /> Capture site pin
                </Button>
              )}
              {editable && (
                <button
                  className="icon-button"
                  aria-label="Remove entry"
                  onClick={() =>
                    onChange(rows.filter((_: any, j: number) => j !== i))
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="form-grid">
              {fields.map(([key, label, type]: any) => (
                <Field label={label} key={key}>
                  {Array.isArray(type) ? (
                    key === "activities" ? (
                      <div className="activity-checks">
                        {type.map((v: string) => (
                          <label className="checkbox-row" key={v}>
                            <input
                              type="checkbox"
                              disabled={!editable}
                              checked={String(r[key] || "")
                                .split(", ")
                                .includes(v)}
                              onChange={(e) => {
                                const values = String(r[key] || "")
                                  .split(", ")
                                  .filter(Boolean);
                                const value = (
                                  e.target.checked
                                    ? [...values, v]
                                    : values.filter((x) => x !== v)
                                ).join(", ");
                                onChange(
                                  rows.map((a: any, j: number) =>
                                    j === i ? { ...a, [key]: value } : a,
                                  ),
                                );
                              }}
                            />
                            {v}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <Select
                        value={r[key]}
                        placeholder="Select"
                        disabled={!editable}
                        options={type}
                        onChange={(v: string) =>
                          onChange(
                            rows.map((a: any, j: number) =>
                              j === i ? { ...a, [key]: v } : a,
                            ),
                          )
                        }
                      />
                    )
                  ) : (
                    <input
                      type={type || "text"}
                      min={
                        type === "number" &&
                        !["latitude", "longitude"].includes(key)
                          ? 0
                          : undefined
                      }
                      step={type === "number" ? "any" : undefined}
                      disabled={!editable}
                      value={r[key] ?? ""}
                      onChange={(e) =>
                        onChange(
                          rows.map((a: any, j: number) =>
                            j === i
                              ? {
                                  ...a,
                                  [key]:
                                    type === "number"
                                      ? Number(e.target.value)
                                      : e.target.value,
                                }
                              : a,
                          ),
                        )
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!rows.length && (
        <Empty
          title="No entries yet"
          text="Add an entry to document this reporting period."
        />
      )}
      {editable && (
        <Button variant="outline" onClick={() => onChange([...rows, {}])}>
          <Plus size={16} /> Add entry
        </Button>
      )}
    </>
  );
}
function UsersPanel({ user, notify }: any) {
  const [rows, setRows] = useState<any[]>([]),
    [edit, setEdit] = useState<any>(null),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState("");
  const refresh = () =>
    api("/users")
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (user?.role === "Super Admin") refresh();
  }, [user]);
  if (user?.role !== "Super Admin")
    return (
      <section className="panel">
        <Empty
          icon={ShieldCheck}
          title="Super Admin access"
          text="Sign in as a Super Admin to create users, assign permissions, and manage access."
        />
      </section>
    );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Users & roles</h2>
          <p>Manage access, responsibilities, and geographic scope</p>
        </div>
        <Button
          onClick={() =>
            setEdit({
              name: "",
              username: "",
              password: "",
              role: "Viewer",
              county: "",
              city: "",
            })
          }
        >
          <Plus size={16} /> Add user
        </Button>
      </div>
      {error && <div className="error">{error}</div>}
      {edit && (
        <form
          className="inset-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await api(
                "/users" + (edit.id ? "/" + edit.id : ""),
                edit.id ? "PATCH" : "POST",
                edit,
              );
              setEdit(null);
              refresh();
              notify("User access updated");
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <h3>{edit.id ? "Edit user / reset password" : "Create user"}</h3>
          <div className="form-grid">
            {[
              ["name", "Full name"],
              ["username", "Username"],
              [
                "password",
                edit.id
                  ? "New password (leave blank to retain)"
                  : "Initial password (12+ characters)",
              ],
              ["county", "County scope (blank = all)"],
              ["city", "City scope (blank = all)"],
            ].map(([k, label]) => (
              <Field key={k} label={label}>
                <input
                  value={edit[k] || ""}
                  type={k === "password" ? "password" : "text"}
                  minLength={k === "password" ? 12 : undefined}
                  required={
                    !edit.id && ["name", "username", "password"].includes(k)
                  }
                  disabled={!!edit.id && k === "username"}
                  onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Role">
              <Select
                value={edit.role}
                options={roles}
                onChange={(v: string) => setEdit({ ...edit, role: v })}
              />
            </Field>
          </div>
          <div className="row">
            <Button type="submit">Save user</Button>
            <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>USER</th>
              <th>ROLE</th>
              <th>SCOPE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <small className="table-secondary">@{u.username}</small>
                </td>
                <td>{u.role}</td>
                <td>
                  {u.county || "All counties"}
                  <small className="table-secondary">
                    {u.city || "All cities"}
                  </small>
                </td>
                <td>
                  <Badge>{u.active ? "Active" : "Inactive"}</Badge>
                </td>
                <td>
                  <div className="row">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEdit({ ...u, password: "" })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={u.id === user.id}
                      onClick={async () => {
                        try {
                          await api("/users/" + u.id, "PATCH", {
                            active: !u.active,
                          });
                          refresh();
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </Button>
                    <button
                      className="icon-button"
                      disabled={u.id === user.id}
                      aria-label="Delete user"
                      onClick={() => setDeleting(u.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deleting && (
        <div className="inset-form">
          <h3>Permanently delete this user?</h3>
          <p>Accounts with reports must be deactivated to preserve records.</p>
          <div className="row">
            <Button
              onClick={async () => {
                try {
                  await api("/users/" + deleting, "DELETE");
                  setDeleting("");
                  refresh();
                  notify("User deleted");
                } catch (e: any) {
                  setError(e.message);
                  setDeleting("");
                }
              }}
            >
              Delete user
            </Button>
            <Button variant="outline" onClick={() => setDeleting("")}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
function Locations({ locations, user, notify, refresh }: any) {
  const [adding, setAdding] = useState(false),
    [error, setError] = useState(""),
    [type, setType] = useState("County"),
    [q, setQ] = useState("");
  const isAdmin =
    user && ["Super Admin", "Admin/M&E Officer"].includes(user.role);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Location directory</h2>
          <p>County → City → District → Community → Nearest market</p>
        </div>
        {isAdmin && (
          <div className="row">
            <label className="btn btn-outline">
              <Upload size={15} /> Import CSV
              <input
                hidden
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    Papa.parse(file, {
                      header: true,
                      skipEmptyLines: true,
                      complete: async (result) => {
                        try {
                          if (result.errors.length)
                            throw Error("Check CSV formatting.");
                          await api("/locations", "POST", result.data);
                          await refresh();
                          notify("Locations imported");
                        } catch (e: any) {
                          setError(e.message);
                        }
                      },
                    });
                }}
              />
            </label>
            <Button onClick={() => setAdding(!adding)}>
              <Plus size={16} /> Add location
            </Button>
          </div>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {adding && (
        <form
          className="inset-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            try {
              await api("/locations", "POST", f);
              await refresh();
              setAdding(false);
              notify("Location added");
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <div className="form-grid">
            <Field label="Location type">
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {["County", "City", "District", "Community", "Market"].map(
                  (t) => (
                    <option key={t}>{t}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Name">
              <input name="name" required />
            </Field>
            <Field label="County">
              <input name="county" required />
            </Field>
            <Field label="City">
              <input name="city" />
            </Field>
            {type !== "County" && (
              <Field label="Parent location">
                <select name="parentId" required>
                  <option value="">Select parent</option>
                  {locations
                    .filter(
                      (l: any) =>
                        l.type ===
                        ["County", "City", "District", "Community"][
                          ["City", "District", "Community", "Market"].indexOf(
                            type,
                          )
                        ],
                    )
                    .map((l: any) => (
                      <option value={l.id} key={l.id}>
                        {l.name} ({l.county})
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Latitude">
              <input
                name="latitude"
                type="number"
                required
                step="any"
                min="-90"
                max="90"
              />
            </Field>
            <Field label="Longitude">
              <input
                name="longitude"
                type="number"
                required
                step="any"
                min="-180"
                max="180"
              />
            </Field>
          </div>
          <Button type="submit">Save location</Button>
        </form>
      )}
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Search locations…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className="muted">{locations.length} locations</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>NAME</th>
              <th>LEVEL</th>
              <th>COUNTY / CITY</th>
              <th>GPS COORDINATES</th>
            </tr>
          </thead>
          <tbody>
            {locations
              .filter((l: any) =>
                `${l.name} ${l.county}`.toLowerCase().includes(q.toLowerCase()),
              )
              .map((l: any) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.name}</strong>
                  </td>
                  <td>
                    <Badge>{l.type}</Badge>
                  </td>
                  <td>
                    {l.county}
                    <small className="table-secondary">{l.city}</small>
                  </td>
                  <td>
                    {Number(l.latitude).toFixed(5)},{" "}
                    {Number(l.longitude).toFixed(5)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="table-bottom">
        CSV columns: id, name, type, parentId, county, city, latitude,
        longitude. <span>Import parents before their children.</span>
      </div>
    </section>
  );
}
function Audit({ user }: any) {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [q, setQ] = useState("");
  useEffect(() => {
    if (user)
      api("/audit")
        .then(setRows)
        .catch((e) => setError(e.message));
  }, [user]);
  if (!user)
    return (
      <section className="panel">
        <Empty
          icon={ShieldCheck}
          title="Accountability at every step"
          text="Sign in as an administrator to review the protected audit log."
        />
      </section>
    );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Audit trail</h2>
          <p>Last 500 recorded actions · server timestamps</p>
        </div>
        <ShieldCheck size={22} />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            placeholder="Search actions or users…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>TIME</th>
              <th>USER</th>
              <th>ACTION</th>
              <th>RECORD</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) =>
                `${r.action} ${r.name}`.toLowerCase().includes(q.toLowerCase()),
              )
              .map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{r.name || "Public / system"}</td>
                  <td>{r.action}</td>
                  <td>{r.entity || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!rows.length && !error && (
        <Empty
          title="No audit events loaded"
          text="Actions appear as users work in the portal."
        />
      )}
    </section>
  );
}
function Meal({ user, notify, onLogin }: any) {
  const [tab, setTab] = useState("Indicators"),
    [rows, setRows] = useState<any[]>([]),
    [adding, setAdding] = useState(false),
    [fields, setFields] = useState<any[]>([
      { label: "", type: "Text", required: false },
    ]),
    [error, setError] = useState("");
  const can = user && ["Super Admin", "Admin/M&E Officer"].includes(user.role);
  const refresh = () =>
    api("/meal")
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (can) refresh();
  }, [user]);
  return (
    <>
      <div className="meal-intro">
        <span>
          <BookOpen size={24} />
        </span>
        <div>
          <strong>Monitoring, Evaluation, Accountability & Learning</strong>
          <p>
            Build indicators, gather community feedback, and turn lessons into
            action.
          </p>
        </div>
        <QRCodeSVG
          value={window.location.origin + "/?feedback=1"}
          size={56}
          title="Public feedback QR code"
        />
        <a
          className="btn btn-outline"
          href="/?feedback=1"
          target="_blank"
          rel="noreferrer"
        >
          <Globe size={15} /> Public feedback link <ArrowUpRight size={14} />
        </a>
      </div>
      <section className="panel">
        <div className="meal-tabs">
          {[
            "Indicators",
            "Surveys",
            "Grievances",
            "Lessons learned",
            "Action tracker",
          ].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setAdding(false);
              }}
              className={tab === t ? "selected" : ""}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="panel-heading">
          <div>
            <h2>{tab}</h2>
            <p>
              {tab === "Surveys"
                ? "Design data collection fields without changing code"
                : tab === "Indicators"
                  ? "Define measures, baselines, and programme targets"
                  : tab === "Grievances"
                    ? "Track public concerns from receipt to resolution"
                    : tab === "Lessons learned"
                      ? "Capture what works and what needs to change"
                      : "Assign actions and track follow-through"}
            </p>
          </div>
          <Button onClick={() => (can ? setAdding(!adding) : onLogin())}>
            <Plus size={16} /> Add{" "}
            {tab === "Surveys"
              ? "survey"
              : tab === "Indicators"
                ? "indicator"
                : "record"}
          </Button>
        </div>
        {error && <div className="error">{error}</div>}
        {adding && (
          <form
            className="inset-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const b = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await api("/meal", "POST", {
                  kind: tab,
                  title: b.title,
                  data: {
                    ...b,
                    fields: tab === "Surveys" ? fields : undefined,
                  },
                });
                setAdding(false);
                refresh();
                notify("MEAL record created");
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Title">
                <input name="title" required />
              </Field>
              {tab === "Indicators" ? (
                <>
                  <Field label="Unit">
                    <input
                      name="unit"
                      required
                      placeholder="e.g. metric tons"
                    />
                  </Field>
                  <Field label="Baseline">
                    <input name="baseline" type="number" step="any" required />
                  </Field>
                  <Field label="Target">
                    <input name="target" type="number" step="any" required />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Responsible person">
                    <input name="owner" />
                  </Field>
                  <Field label="Due date">
                    <input name="due" type="date" />
                  </Field>
                </>
              )}
              <Field label="Description / notes">
                <textarea name="description" />
              </Field>
            </div>
            {tab === "Surveys" && (
              <>
                <h3>Survey questions</h3>
                {fields.map((f, i) => (
                  <div className="builder-row" key={i}>
                    <input
                      required
                      placeholder="Question label"
                      value={f.label}
                      onChange={(e) =>
                        setFields(
                          fields.map((v, j) =>
                            j === i ? { ...v, label: e.target.value } : v,
                          ),
                        )
                      }
                    />
                    <Select
                      value={f.type}
                      options={[
                        "Text",
                        "Number",
                        "Yes / No",
                        "Rating 1–5",
                        "Date",
                      ]}
                      onChange={(v: string) =>
                        setFields(
                          fields.map((f, j) =>
                            j === i ? { ...f, type: v } : f,
                          ),
                        )
                      }
                    />
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) =>
                          setFields(
                            fields.map((f, j) =>
                              j === i
                                ? { ...f, required: e.target.checked }
                                : f,
                            ),
                          )
                        }
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove question"
                      onClick={() =>
                        setFields(fields.filter((_, j) => j !== i))
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFields([
                      ...fields,
                      { label: "", type: "Text", required: false },
                    ])
                  }
                >
                  <Plus size={14} /> Add question
                </Button>
              </>
            )}
            <div className="row form-actions">
              <Button type="submit">
                Save {tab === "Surveys" ? "survey" : "record"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
        {rows
          .filter((r) => r.kind === tab)
          .map((r) => (
            <div className="meal-record" key={r.id}>
              <span className="record-icon">
                <FileText size={20} />
              </span>
              <div>
                <h3>{r.title}</h3>
                <p>{r.data.description}</p>
                {tab === "Indicators" && (
                  <small>
                    Baseline: {r.data.baseline} · Target: {r.data.target}{" "}
                    {r.data.unit}
                  </small>
                )}
                {tab === "Surveys" && (
                  <details>
                    <summary>
                      {r.data.fields?.length || 0} questions · Open survey
                    </summary>
                    <SurveyForm survey={r} notify={notify} onSaved={refresh} />
                    <small>
                      {
                        rows.filter(
                          (v) =>
                            v.kind === "Survey responses" &&
                            v.data.surveyId === r.id,
                        ).length
                      }{" "}
                      recorded responses
                    </small>
                  </details>
                )}
                {r.data.owner && (
                  <small>
                    Owner: {r.data.owner} · Due: {r.data.due || "Not set"}
                  </small>
                )}
              </div>
              <Select
                value={r.status}
                placeholder="Status"
                options={["Open", "In progress", "Resolved", "Closed"]}
                onChange={async (status: string) => {
                  try {
                    await api("/meal/" + r.id, "PATCH", { status });
                    refresh();
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              />
            </div>
          ))}
        {!rows.some((r) => r.kind === tab) && !adding && (
          <Empty
            icon={
              tab === "Grievances"
                ? MessageSquare
                : tab === "Indicators"
                  ? Target
                  : BookOpen
            }
            title={
              can
                ? "No " + tab.toLowerCase() + " yet"
                : "Your learning workspace"
            }
            text={
              can
                ? "Create your first record to start building an evidence-led programme."
                : "Sign in as an administrator to configure MEAL tools and manage community feedback."
            }
          />
        )}
      </section>
    </>
  );
}
function SurveyForm({ survey, notify, onSaved }: any) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = e.currentTarget;
        try {
          await api("/meal/" + survey.id + "/responses", "POST", {
            answers: Object.fromEntries(new FormData(form)),
          });
          form.reset();
          notify("Survey response recorded");
          onSaved();
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {(survey.data.fields || []).map((f: any, i: number) => (
        <Field key={i} label={f.label + (f.required ? " *" : "")}>
          {f.type === "Yes / No" ? (
            <select name={String(i)} required={f.required}>
              <option value="">Select</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          ) : (
            <input
              name={String(i)}
              type={
                f.type === "Number" || f.type === "Rating 1–5"
                  ? "number"
                  : f.type === "Date"
                    ? "date"
                    : "text"
              }
              min={f.type === "Rating 1–5" ? 1 : undefined}
              max={f.type === "Rating 1–5" ? 5 : undefined}
              required={f.required}
            />
          )}
        </Field>
      ))}
      {error && <div className="error">{error}</div>}
      <Button size="sm" disabled={busy}>
        Save response
      </Button>
    </form>
  );
}
function SettingsPanel({ user, onLogin, onLogout, notify }: any) {
  const [error, setError] = useState("");
  const [configuration, setConfiguration] = useState<any>(null);
  useEffect(() => {
    api("/config")
      .then(setConfiguration)
      .catch(() => {});
  }, []);
  return (
    <div className="two-grid">
      <section className="panel">
        <div className="panel-heading">
          <h2>Your account</h2>
        </div>
        {user ? (
          <div className="settings-body">
            <span className="avatar large">{user.name[0]}</span>
            <h3>{user.name}</h3>
            <p>
              @{user.username} · {user.role}
            </p>
            <p>
              {user.county || "National"} / {user.city || "All cities"}
            </p>
            <Button variant="outline" onClick={onLogout}>
              <LogOut size={15} /> Sign out
            </Button>
            <h3>Change password</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api(
                    "/password",
                    "POST",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  notify("Password updated. Sign in with your new password.");
                  onLogout();
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              <Field label="Current password">
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="New password (10+ characters)">
                <input
                  name="password"
                  type="password"
                  minLength={10}
                  required
                  autoComplete="new-password"
                />
              </Field>
              {error && <div className="error">{error}</div>}
              <Button>Update password</Button>
            </form>
          </div>
        ) : (
          <div className="settings-body">
            <Empty
              icon={LockKeyhole}
              title="Sign in to your account"
              text="Use your assigned username and password to access the workspace."
            />
            <Button onClick={onLogin}>
              Sign in <ArrowRight size={15} />
            </Button>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>About this workspace</h2>
        </div>
        <div className="settings-body">
          <h3>PCCI M&E Portal</h3>
          <p>Presidential Clean Cities Initiative</p>
          <p>
            Ministry of State for Presidential Affairs
            <br />
            Republic of Liberia
          </p>
          <hr />
          <h3>Ready for the field</h3>
          <p>
            The portal can be installed from your browser’s app menu. Open it
            once while connected to cache the interface. Drafts save on this
            device and sync after sign-in when connectivity returns.
          </p>
          <h3>Weekly reporting summary</h3>
          <Badge>
            {configuration?.weeklyEmailConfigured
              ? "Delivery configured"
              : "Sample email preview"}
          </Badge>
          <p>
            {configuration?.weeklyEmailConfigured
              ? "National summaries are scheduled for Mondays at 08:00 UTC."
              : "Email delivery is paused until a sender, recipient list, and email service are configured. No sample emails are sent."}
          </p>
          {!configuration?.weeklyEmailConfigured && (
            <div className="notice">
              <div>
                <strong>
                  Illustrative email · PCCI weekly field reporting summary
                </strong>
                <br />
                24 reports in the sample workspace. Review submitted reports,
                verification progress, and approved sanitation results.
              </div>
            </div>
          )}
          <h3>Security & accountability</h3>
          <p>
            Sessions expire after 30 minutes. Geographic scope and workflow
            permissions are checked on the server. Password resets and account
            access are managed by your Super Admin.
          </p>
        </div>
      </section>
    </div>
  );
}
function PublicFeedback() {
  const [success, setSuccess] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="public-feedback">
      <a href="/" className="brand">
        <span className="brand-mark">
          <Flag size={23} />
        </span>
        <span>
          PCCI <small>COMMUNITY VOICES</small>
        </span>
      </a>
      <div className="panel">
        <div className="eyebrow">ACCOUNTABILITY STARTS WITH LISTENING</div>
        <h1>
          Your community.
          <br />
          Your voice.
        </h1>
        <p>
          Share a sanitation concern, suggestion, or feedback with the
          Presidential Clean Cities Initiative.
        </p>
        {success ? (
          <div className="feedback-success">
            <CheckCircle2 size={36} />
            <h2>Thank you for speaking up.</h2>
            <p>Your feedback has been recorded.</p>
            <small>Reference: {success}</small>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await api(
                  "/feedback",
                  "POST",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                setSuccess(r.id);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Subject *">
              <input name="title" required maxLength={160} />
            </Field>
            <Field label="Community">
              <input name="community" />
            </Field>
            <Field label="Your feedback *">
              <textarea name="description" required maxLength={4000} rows={5} />
            </Field>
            <p className="muted">
              You can submit anonymously. Please avoid sharing sensitive
              personal information.
            </p>
            {error && <div className="error">{error}</div>}
            <Button disabled={busy} type="submit">
              {busy ? "Sending…" : "Send feedback"}
              <Send size={16} />
            </Button>
          </form>
        )}
      </div>
      <small>
        Ministry of State for Presidential Affairs · Republic of Liberia
      </small>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  new URLSearchParams(window.location.search).has("feedback") ? (
    <PublicFeedback />
  ) : (
    <App />
  ),
);
