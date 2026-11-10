import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazyRetry } from "./lib/lazyRetry";

import PwaUpdateBanner from "./components/PwaUpdateBanner";
const AdminDashboard = lazyRetry(() => import("./views/Dashboard/AdminDashboard"));
const StoreLayout = lazyRetry(() => import("./views/Store/StoreLayout"));
import Login from "./views/Auth/Login";
const ForgotPassword = lazyRetry(() => import("./views/Auth/ForgotPassword"));
const ResetPassword = lazyRetry(() => import("./views/Auth/ResetPassword"));
const PDVStandalone = lazyRetry(() => import("./views/PDVStandalone"));
const PDVClassico = lazyRetry(() => import("./views/PDVClassico"));
const SuperAdminDashboard = lazyRetry(() => import("./views/SuperAdmin/SuperAdminDashboard"));
const SetupInvite = lazyRetry(() => import("./views/Auth/SetupInvite"));
const QuoteApproval = lazyRetry(() => import("./views/Public/QuoteApproval"));
import { getStoredUser } from "./lib/session";
import { isTenantSubdomainHost } from "./views/Store/store-routing";
import { useRemotePrintBridge } from "./hooks/useRemotePrintBridge";
const DigitalMenu = lazyRetry(() => import("./views/Menu/DigitalMenu"));

function HostAwareEntry() {
  if (isTenantSubdomainHost()) {
    // Cardápio digital: tela própria, separada do site da loja.
    if (window.location.pathname.startsWith("/cardapio")) return <DigitalMenu />;
    return <StoreLayout />;
  }

  const user = getStoredUser();

  if (user?.role === "super_admin") {
    return <Navigate to="/super-admin" replace />;
  }

  if (user?.role === "pdv") {
    return <Navigate to="/pdv" replace />;
  }

  if (user?.role) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  useRemotePrintBridge();

  return (
    <BrowserRouter>
      <Suspense fallback={<div role="status" style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 14 }}>Carregando…</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/setup/:token" element={<SetupInvite />} />
        <Route path="/orcamento/:token" element={<QuoteApproval />} />
        <Route path="/pdv" element={<PDVStandalone />} />
        <Route path="/pdv-classico" element={<PDVClassico />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/super-admin/*" element={<SuperAdminDashboard />} />
        <Route path="/s/:slug/cardapio/*" element={<DigitalMenu />} />
        <Route path="/s/:slug/*" element={<StoreLayout />} />
        <Route path="/*" element={<HostAwareEntry />} />
      </Routes>
      </Suspense>
      <PwaUpdateBanner />
    </BrowserRouter>
  );
}
