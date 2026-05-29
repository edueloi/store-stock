import { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Package,
  ShoppingCart,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Box,
  Tags,
  Users,
  Receipt,
  Wallet,
  UserCheck,
  Truck,
  FolderOpen,
  Settings as SettingsIcon,
  LineChart,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Star,
  Target,
  Barcode,
  Calculator,
  Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { ToastProvider } from "../../components/ui/Toast";

// Sub-views
import Home from "./Home";
import Inventory from "./Inventory"; // This will be "Catálogo"
import Stock from "./Stock"; // This will be "Estoque"
import PDV from "./PDV";
import Orders from "./Orders";
import Finance from "./Finance";
import ContasReceber from "./ContasReceber";
import ContasPagar from "./ContasPagar";
import Settings from "./Settings";
import Customers from "./Customers";
import Suppliers from "./Suppliers";
import Categories from "./Categories";
import Analytics from "./Analytics";
import Loyalty from "./Loyalty";
import Quotes from "./Quotes";
import Sellers from "./Sellers";
import Goals from "./Goals";
import Barcodes from "./Barcodes";
import Markup from "./Markup";
import Services from "./Services";

export default function AdminDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [tenantPublicUrl, setTenantPublicUrl] = useState<string>("");
  const [tenantName, setTenantName] = useState<string>("Nexus ERP");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      // Auto close/open sidebar on large screen transitions
      if (window.innerWidth <= 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const menuGroups = [
    {
      label: "Operação",
      items: [
        { icon: LayoutDashboard, label: "Visão Geral",   path: "/admin" },
        { icon: ShoppingCart,    label: "PDV — Caixa",   path: "/admin/pdv" },
        { icon: Receipt,         label: "Pedidos",        path: "/admin/orders" },
        { icon: FileText,        label: "Orçamentos",     path: "/admin/orcamentos" },
      ],
    },
    {
      label: "Catálogo & Estoque",
      items: [
        { icon: Tags,        label: "Catálogo",      path: "/admin/catalog" },
        { icon: Box,         label: "Estoque",        path: "/admin/stock" },
        { icon: Calculator,  label: "Markup",         path: "/admin/markup" },
        { icon: Barcode,     label: "Etiquetas",      path: "/admin/etiquetas" },
        { icon: FolderOpen,  label: "Categorias",     path: "/admin/categories" },
        { icon: Truck,       label: "Fornecedores",   path: "/admin/suppliers" },
      ],
    },
    {
      label: "Financeiro",
      items: [
        { icon: Wallet,           label: "Fluxo de Caixa",    path: "/admin/finance" },
        { icon: ArrowDownCircle,  label: "Contas a Receber",  path: "/admin/contas-receber" },
        { icon: ArrowUpCircle,    label: "Contas a Pagar",    path: "/admin/contas-pagar" },
        { icon: Target,           label: "Metas",             path: "/admin/metas" },
        { icon: LineChart,        label: "Relatórios",        path: "/admin/analytics" },
      ],
    },
    {
      label: "Clientes & Marketing",
      items: [
        { icon: Users,       label: "Clientes — CRM", path: "/admin/customers" },
        { icon: Star,        label: "Vendedores",      path: "/admin/vendedores" },
        { icon: Wrench,      label: "Serviços",        path: "/admin/servicos" },
        { icon: UserCheck,   label: "Fidelidade",      path: "/admin/loyalty" },
      ],
    },
    {
      label: "Sistema",
      items: [
        { icon: SettingsIcon, label: "Configurações", path: "/admin/settings" },
      ],
    },
  ];

  // flat list for header label lookup and mobile nav
  const menuItems = menuGroups.flatMap((g) => g.items);

  const viewPublicStore = () => {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    window.open(isLocal ? `/s/${tenantSlug}` : (tenantPublicUrl || `/s/${tenantSlug}`), "_blank");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    // PDV-only users must not access the admin panel
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.role === "pdv") { navigate("/pdv", { replace: true }); return; }
      }
    } catch { /* ignore */ }

    // Fetch tenant info to get the real slug
    fetch("/api/tenant", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.slug) setTenantSlug(data.slug);
        if (data?.name) setTenantName(data.name);
        if (data?.public_url) setTenantPublicUrl(data.public_url);
      })
      .catch(() => {});
  }, [navigate]);

  const isPDV = location.pathname === "/admin/pdv";

  return (
    <ToastProvider>
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans text-slate-800 relative">

      {/* ── SIDEBAR DESKTOP ─────────────────────────────────────────────── */}
      <aside className={cn(
        "bg-[#0f172a] text-slate-300 hidden lg:flex flex-col border-r border-white/5 transition-all duration-300 shrink-0",
        isSidebarOpen ? "w-60" : "w-[60px]"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 border-b border-white/5 h-16 shrink-0",
          isSidebarOpen ? "px-4" : "px-0 justify-center"
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-md">
            <img src="/system/logo.png" alt="BoxSys" className="h-5 w-5 object-contain" />
          </div>
          {isSidebarOpen && (
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Box Sys</p>
              <p className="text-[13px] font-bold text-white leading-tight truncate mt-0.5">{tenantName}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto admin-scroll py-2 px-2 space-y-3">
          {menuGroups.map((group) => (
            <div key={group.label}>
              {isSidebarOpen && (
                <p className="mb-1 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
                  {group.label}
                </p>
              )}
              {!isSidebarOpen && <div className="my-1 mx-2 border-t border-white/5" />}
              <div className="space-y-px">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path || (item.path === "/admin" && location.pathname === "/admin/");
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-all relative",
                        isActive
                          ? "bg-[#C9A227] text-white shadow-[0_2px_12px_rgba(201,162,39,0.35)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <item.icon size={16} className="shrink-0" />
                      {isSidebarOpen && <span className="truncate">{item.label}</span>}
                      {!isSidebarOpen && (
                        <div className="absolute left-[56px] z-50 whitespace-nowrap rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 pointer-events-none">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 p-2 space-y-px">
          <button onClick={viewPublicStore}
            className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-slate-400 transition-all hover:bg-white/5 hover:text-white relative">
            <Package size={16} className="shrink-0" />
            {isSidebarOpen && <span>Ver Loja</span>}
            {!isSidebarOpen && (
              <div className="absolute left-[56px] z-50 whitespace-nowrap rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 pointer-events-none">
                Ver Loja
              </div>
            )}
          </button>
          <button onClick={handleLogout}
            className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400 relative">
            <LogOut size={16} className="shrink-0" />
            {isSidebarOpen && <span>Sair</span>}
            {!isSidebarOpen && (
              <div className="absolute left-[56px] z-50 whitespace-nowrap rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 pointer-events-none">
                Sair
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ── MOBILE OVERLAY ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── MOBILE SIDEBAR DRAWER ───────────────────────────────────────── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed inset-y-0 left-0 w-[260px] bg-[#0f172a] text-slate-300 flex flex-col z-[101] lg:hidden border-r border-white/5 shadow-2xl"
          >
            {/* Logo mobile */}
            <div className="flex items-center justify-between border-b border-white/5 px-4 h-16 shrink-0">
              <div className="flex items-center gap-3">
                <img src="/system/logo.png" alt="BoxSys" className="h-7 w-7 object-contain rounded-lg" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Box Sys</p>
                  <p className="text-[13px] font-bold text-white leading-tight truncate mt-0.5">{tenantName}</p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto admin-scroll py-2 px-2 space-y-3">
              {menuGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
                    {group.label}
                  </p>
                  <div className="space-y-px">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.path || (item.path === "/admin" && location.pathname === "/admin/");
                      return (
                        <Link key={item.path} to={item.path} onClick={() => setIsSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-all",
                            isActive
                              ? "bg-[#C9A227] text-white shadow-[0_2px_12px_rgba(201,162,39,0.35)]"
                              : "text-slate-400 hover:bg-white/5 hover:text-white"
                          )}>
                          <item.icon size={16} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-white/5 p-2 space-y-px">
              <button onClick={() => { setIsSidebarOpen(false); viewPublicStore(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-slate-400 transition-all hover:bg-white/5 hover:text-white">
                <Package size={16} /><span>Ver Loja</span>
              </button>
              <button onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400">
                <LogOut size={16} /><span>Sair</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden w-full min-w-0">

        {/* Header */}
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3">
            {/* Toggle sidebar desktop */}
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200 transition-all">
              <Menu size={17} />
            </button>
            {/* Open drawer mobile */}
            <button onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
              <Menu size={17} />
            </button>
            <h1 className="text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none">
              {menuItems.find(m => m.path === location.pathname)?.label || "Dashboard"}
            </h1>
            <span className="hidden sm:flex text-[9px] text-blue-600 font-black uppercase tracking-widest items-center gap-1.5 leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Produção Ativa
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={viewPublicStore}
              className="h-8 px-3 bg-white border border-slate-200 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 text-slate-600 transition-all text-[10px] font-bold uppercase tracking-tight">
              <BarChart3 size={13} />
              <span className="hidden sm:inline">Loja</span>
            </button>
            <Link to="/admin/pdv"
              className="h-8 px-3 bg-blue-600 text-white rounded-lg flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-95 text-[10px] font-black uppercase tracking-widest">
              <ShoppingCart size={13} />
              <span className="hidden sm:inline">Nova Venda</span>
            </Link>
          </div>
        </header>

        {/* Viewport */}
        <div className={cn(
          "flex-1 min-h-0",
          isPDV
            ? "overflow-hidden flex flex-col"
            : "overflow-y-auto admin-scroll p-4 lg:p-6 bg-[#f8fafc]"
        )}>
          <div className={isPDV ? "flex-1 min-h-0 flex flex-col" : ""}>
            <Routes>
              <Route index element={<Home />} />
              <Route path="catalog" element={<Inventory />} />
              <Route path="categories" element={<Categories />} />
              <Route path="stock" element={<Stock />} />
              <Route path="pdv" element={<PDV />} />
              <Route path="customers" element={<Customers />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="orders" element={<Orders />} />
              <Route path="finance" element={<Finance />} />
              <Route path="contas-receber" element={<ContasReceber />} />
              <Route path="contas-pagar" element={<ContasPagar />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="orcamentos" element={<Quotes />} />
              <Route path="vendedores" element={<Sellers />} />
              <Route path="servicos"   element={<Services />} />
              <Route path="metas"      element={<Goals />} />
              <Route path="markup"     element={<Markup />} />
              <Route path="etiquetas"  element={<Barcodes />} />
              <Route path="settings" element={<Settings />} />
              <Route path="loyalty" element={<Loyalty />} />
              <Route path="inventory" element={<Stock />} />
            </Routes>
          </div>
        </div>

        {/* Status bar desktop */}
        <footer className="hidden lg:flex h-7 bg-slate-900 border-t border-slate-800 px-5 items-center justify-between shrink-0">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">
            BoxSys Store · Sistema de Gestão para Lojas
          </span>
          <div className="flex gap-4 shrink-0">
            <span className="text-[9px] text-emerald-400 font-bold uppercase">Online</span>
            <span className="text-[9px] text-slate-600 font-bold uppercase">v.BoxSys-1.0</span>
          </div>
        </footer>

        {/* Bottom nav mobile */}
        <nav className="lg:hidden shrink-0 bg-white border-t border-slate-200 flex items-stretch"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {[
            { icon: LayoutDashboard, label: "Home",     path: "/admin" },
            { icon: Tags,            label: "Catálogo", path: "/admin/catalog" },
            { icon: ShoppingCart,    label: "PDV",      path: "/admin/pdv" },
            { icon: Receipt,         label: "Pedidos",  path: "/admin/orders" },
            { icon: LineChart,       label: "Métricas", path: "/admin/analytics" },
          ].map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/admin" && location.pathname === "/admin/");
            return (
              <Link key={item.path} to={item.path}
                className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                  isActive ? "text-blue-600" : "text-slate-400")}>
                <item.icon size={19} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[8px] font-bold uppercase tracking-wide leading-none">{item.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setIsSidebarOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-400">
            <Menu size={19} strokeWidth={1.5} />
            <span className="text-[8px] font-bold uppercase tracking-wide leading-none">Mais</span>
          </button>
        </nav>
      </main>
    </div>
    </ToastProvider>
  );
}
