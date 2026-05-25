import { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Package,
  ShoppingCart,
  DollarSign,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Box,
  Tags,
  Users,
  Receipt,
  Wallet,
  Contact2,
  Table2,
  Trash2,
  UserCheck,
  Truck,
  FolderOpen,
  Settings as SettingsIcon,
  LineChart,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

// Sub-views
import Home from "./Home";
import Inventory from "./Inventory"; // This will be "Catálogo"
import Stock from "./Stock"; // This will be "Estoque"
import PDV from "./PDV";
import Orders from "./Orders";
import Finance from "./Finance";
import Settings from "./Settings";
import Customers from "./Customers";
import Suppliers from "./Suppliers";
import Categories from "./Categories";
import Analytics from "./Analytics";
import Loyalty from "./Loyalty";

export default function AdminDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [tenantPublicUrl, setTenantPublicUrl] = useState<string>("");
  const [tenantName, setTenantName] = useState<string>("Nexus ERP");
  const [userName, setUserName] = useState<string>("Admin");
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
      ],
    },
    {
      label: "Catálogo & Estoque",
      items: [
        { icon: Tags,       label: "Catálogo",      path: "/admin/catalog" },
        { icon: Box,        label: "Estoque",        path: "/admin/stock" },
        { icon: FolderOpen, label: "Categorias",     path: "/admin/categories" },
        { icon: Truck,      label: "Fornecedores",   path: "/admin/suppliers" },
      ],
    },
    {
      label: "Financeiro",
      items: [
        { icon: Wallet,    label: "Fluxo de Caixa",  path: "/admin/finance" },
        { icon: LineChart, label: "Relatórios",       path: "/admin/analytics" },
      ],
    },
    {
      label: "Clientes & Marketing",
      items: [
        { icon: Users,       label: "Clientes — CRM", path: "/admin/customers" },
        { icon: UserCheck,   label: "Fidelidade",     path: "/admin/loyalty" },
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

    // Read user name from stored user object
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.name) setUserName(u.name);
      }
    } catch {}
  }, [navigate]);

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans text-slate-800 relative">
      {/* Sidebar Navigation - Desktop */}
      <aside
        className={cn(
          "bg-[#0f172a] text-slate-300 hidden lg:flex flex-col border-r border-white/5 transition-all duration-300 shrink-0",
          isSidebarOpen ? "w-64" : "w-[72px]"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-3 border-b border-white/5", isSidebarOpen ? "px-5 py-5" : "px-4 py-5 justify-center")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-md">
            <img src="/system/logo.png" alt="BoxSys" className="h-6 w-6 object-contain" />
          </div>
          {isSidebarOpen && (
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Box Sys</p>
              <p className="text-sm font-bold text-white leading-tight truncate">{tenantName}</p>
            </div>
          )}
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-5 px-3">
          {menuGroups.map((group) => (
            <div key={group.label}>
              {isSidebarOpen && (
                <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path || (item.path === "/admin" && location.pathname === "/admin/");
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all relative",
                        isActive
                          ? "bg-[#C9A227] text-white shadow-[0_4px_16px_rgba(201,162,39,0.30)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <item.icon size={17} className="shrink-0" />
                      {isSidebarOpen && <span>{item.label}</span>}
                      {!isSidebarOpen && (
                        <div className="absolute left-[68px] z-50 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 pointer-events-none">
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
        <div className="border-t border-white/5 p-3 space-y-1">
          <button
            onClick={viewPublicStore}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition-all hover:bg-white/5 hover:text-white"
          >
            <Package size={17} className="shrink-0" />
            {isSidebarOpen && <span>Ver Loja</span>}
          </button>
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={17} className="shrink-0" />
            {isSidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar - Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 w-[280px] bg-[#0f172a] text-slate-300 flex flex-col z-[101] lg:hidden border-r border-white/5 shadow-2xl"
          >
            {/* Logo mobile */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-5">
              <div className="flex items-center gap-3">
                <img src="/system/logo.png" alt="BoxSys" className="h-8 w-8 object-contain rounded-lg" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Box Sys</p>
                  <p className="text-sm font-bold text-white leading-tight truncate">{tenantName}</p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 space-y-5 px-3">
              {menuGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.path || (item.path === "/admin" && location.pathname === "/admin/");
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all",
                            isActive
                              ? "bg-[#C9A227] text-white shadow-[0_4px_16px_rgba(201,162,39,0.30)]"
                              : "text-slate-400 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <item.icon size={18} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-white/5 p-3 space-y-1">
              <button
                onClick={() => { setIsSidebarOpen(false); viewPublicStore(); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-400 transition-all hover:bg-white/5 hover:text-white"
              >
                <Package size={18} />
                <span>Ver Loja</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={18} />
                <span>Sair</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="h-16 lg:h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0 shadow-sm z-10 transition-all">
          <div className="flex items-center gap-3 lg:gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-2 hover:bg-slate-50 rounded-lg text-slate-500 focus:outline-none bg-slate-50 border border-slate-200"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col lg:flex-row lg:items-center gap-0 lg:gap-4">
              <h1 className="text-xs lg:text-sm font-black text-slate-900 uppercase tracking-tight">
                {menuItems.find(m => m.path === location.pathname)?.label || "Dashboard"}
              </h1>
              <div className="hidden lg:block h-4 w-px bg-slate-300"></div>
              <span className="text-[8px] lg:text-[10px] text-blue-600 font-black uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <div className="w-1 h-1 rounded-full bg-blue-600 animate-pulse"></div>
                Produção Ativa
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-4 text-xs font-bold">
            <button 
              onClick={viewPublicStore}
              className="px-3 h-10 lg:h-9 bg-white border border-slate-200 rounded-xl flex items-center gap-2 hover:bg-slate-50 text-slate-600 transition-all shadow-sm"
            >
              <BarChart3 size={14} className="hidden sm:block" />
              <span className="text-[10px] uppercase tracking-tighter">Loja</span>
            </button>
            
            <Link 
              to="/admin/pdv" 
              className="px-3 md:px-5 h-10 lg:h-9 bg-blue-600 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95"
            >
              <ShoppingCart size={14} />
              <span className="hidden md:inline text-[10px] uppercase tracking-widest">Nova Venda</span>
            </Link>
          </div>
        </header>

        {/* Viewport */}
        <div className={cn(
          "flex-1 overflow-y-auto relative transition-all duration-300",
          "p-4 lg:p-8 bg-[#f8fafc]"
        )}>
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
             <Route path="analytics" element={<Analytics />} />
             <Route path="settings" element={<Settings />} />
             <Route path="loyalty" element={<Loyalty />} />
             <Route path="inventory" element={<Stock />} />
           </Routes>
        </div>

        {/* Bottom Bar - Desktop status bar */}
        <footer className="hidden lg:flex h-8 bg-slate-900 border-t border-slate-800 px-6 items-center justify-between shrink-0 overflow-hidden">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
            BoxSys Store · Sistema de Gestão para Lojas
          </div>
          <div className="flex gap-4">
            <span className="text-[10px] text-emerald-400 font-bold uppercase">Online</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase">v.BoxSys-1.0</span>
          </div>
        </footer>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden shrink-0 bg-white border-t border-slate-200 flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {[
            { icon: LayoutDashboard, label: "Home",     path: "/admin" },
            { icon: Tags,            label: "Catálogo", path: "/admin/catalog" },
            { icon: ShoppingCart,    label: "PDV",      path: "/admin/pdv" },
            { icon: Receipt,         label: "Pedidos",  path: "/admin/orders" },
            { icon: LineChart,       label: "Métricas", path: "/admin/analytics" },
          ].map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/admin" && location.pathname === "/admin/");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors",
                  isActive ? "text-blue-600" : "text-slate-400"
                )}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[9px] font-bold uppercase tracking-wide leading-none">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-slate-400"
          >
            <Menu size={20} strokeWidth={1.5} />
            <span className="text-[9px] font-bold uppercase tracking-wide leading-none">Mais</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
