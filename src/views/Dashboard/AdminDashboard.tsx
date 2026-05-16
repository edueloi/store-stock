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
  Settings as SettingsIcon
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

export default function AdminDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
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

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    { icon: Box, label: "Estoque", path: "/admin/stock" },
    { icon: Tags, label: "Catálogo", path: "/admin/catalog" },
    { icon: Users, label: "Clientes", path: "/admin/customers" },
    { icon: Truck, label: "Fornecedores", path: "/admin/suppliers" },
    { icon: ShoppingCart, label: "PDV (Vendas)", path: "/admin/pdv" },
    { icon: Receipt, label: "Pedidos", path: "/admin/orders" },
    { icon: Wallet, label: "Financeiro", path: "/admin/finance" },
    { icon: SettingsIcon, label: "Configurações", path: "/admin/settings" },
  ];

  const viewPublicStore = () => {
    // In a real app, this comes from the authenticated user's tenant object
    window.open('/s/loja-nexus', '_blank');
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login");
  }, [navigate]);

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans text-slate-800 relative">
      {/* Sidebar Navigation - Desktop */}
      <aside 
        className={cn(
          "bg-[#1e293b] text-slate-300 hidden lg:flex flex-col border-r border-slate-700 transition-all duration-300",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold shrink-0">N</div>
          {isSidebarOpen && <span className="text-xl font-bold text-white tracking-tight">Nexus ERP</span>}
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {isSidebarOpen && (
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-2 tracking-widest">Management</div>
          )}
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all group relative text-sm font-medium",
                location.pathname === item.path || (item.path === "/admin" && location.pathname === "/admin/")
                  ? "bg-blue-600/10 text-blue-400 border-l-2 border-blue-500"
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon size={16} />
              {isSidebarOpen && <span>{item.label}</span>}
              {!isSidebarOpen && (
                <div className="absolute left-16 bg-slate-900 text-white px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap font-bold uppercase tracking-widest">
                  {item.label}
                </div>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 bg-slate-900/50 mt-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-500 border-2 border-blue-500 shrink-0 overflow-hidden">
               <img src="https://ui-avatars.com/api/?name=Admin&bg=1e293b&color=fff" alt="User" />
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden text-left">
                <div className="text-xs font-bold text-white truncate">Nexus Admin</div>
                <div className="text-[10px] text-slate-400 uppercase">Main Tenant</div>
              </div>
            )}
            {!isSidebarOpen && (
              <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors">
                <LogOut size={16} />
              </button>
            )}
          </div>
          {isSidebarOpen && (
            <button 
              onClick={handleLogout}
              className="mt-4 flex items-center justify-between w-full px-3 py-2 text-[10px] text-slate-400 uppercase font-bold hover:bg-slate-800 rounded transition-colors text-left"
            >
              Encerrar Sessão <span>→</span>
            </button>
          )}
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
            className="fixed inset-y-0 left-0 w-[280px] bg-[#1e293b] text-slate-300 flex flex-col z-[101] lg:hidden border-r border-slate-700 shadow-2xl"
          >
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold shrink-0">N</div>
                <span className="text-xl font-bold text-white tracking-tight">Nexus ERP</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-2 tracking-widest">Management</div>
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm font-medium",
                    location.pathname === item.path || (item.path === "/admin" && location.pathname === "/admin/")
                      ? "bg-blue-600 text-white shadow-xl shadow-blue-500/20"
                      : "hover:bg-slate-800 hover:text-white text-slate-400"
                  )}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="p-6 border-t border-slate-700 bg-slate-900/50 mt-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-500 border-2 border-blue-500 shrink-0 overflow-hidden">
                  <img src="https://ui-avatars.com/api/?name=Admin&bg=1e293b&color=fff" alt="User" />
                </div>
                <div className="overflow-hidden text-left">
                  <div className="text-sm font-bold text-white truncate">Nexus Admin</div>
                  <div className="text-[10px] text-slate-400 uppercase">Main Tenant</div>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center justify-center w-full px-4 py-3 bg-red-500/10 text-red-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-red-500/20 border border-red-500/20"
              >
                Encerrar Acesso
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
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 focus:outline-none bg-slate-50 border border-slate-200"
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
             <Route path="stock" element={<Stock />} />
             <Route path="pdv" element={<PDV />} />
             <Route path="customers" element={<Customers />} />
             <Route path="suppliers" element={<Suppliers />} />
             <Route path="orders" element={<Orders />} />
             <Route path="finance" element={<Finance />} />
             <Route path="settings" element={<Settings />} />
             <Route path="inventory" element={<Stock />} />
           </Routes>
        </div>

        {/* Bottom Bar - Stats Indicator (hidden on small mobile) */}
        <footer className="h-10 lg:h-8 bg-slate-900 border-t border-slate-800 px-4 lg:px-6 flex items-center justify-between shrink-0 overflow-hidden">
          <div className="text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
            Nexus Cloud Sync · Instância: AWS-SA-EAST-1
          </div>
          <div className="hidden sm:flex gap-4">
            <span className="text-[9px] lg:text-[10px] text-emerald-400 font-bold uppercase">DB Healthy</span>
            <span className="text-[9px] lg:text-[10px] text-slate-500 font-bold uppercase">v.Nexus-1.0.9</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
