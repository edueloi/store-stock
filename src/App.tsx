import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import PwaUpdateBanner from "./components/PwaUpdateBanner";
import AdminDashboard from "./views/Dashboard/AdminDashboard";
import StoreLayout from "./views/Store/StoreLayout";
import Login from "./views/Auth/Login";
import ForgotPassword from "./views/Auth/ForgotPassword";
import ResetPassword from "./views/Auth/ResetPassword";
import PDVStandalone from "./views/PDVStandalone";
import PDVClassico from "./views/PDVClassico";
import SuperAdminDashboard from "./views/SuperAdmin/SuperAdminDashboard";
import SetupInvite from "./views/Auth/SetupInvite";
import QuoteApproval from "./views/Public/QuoteApproval";
import { getStoredUser } from "./lib/session";
import { isTenantSubdomainHost } from "./views/Store/store-routing";
import { useRemotePrintBridge } from "./hooks/useRemotePrintBridge";
import DigitalMenu from "./views/Menu/DigitalMenu";

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
      <PwaUpdateBanner />
    </BrowserRouter>
  );
}
