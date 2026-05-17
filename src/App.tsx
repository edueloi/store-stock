import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Plus,
  Search,
  ShoppingCart as CartIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";

// Views (Implementing inline for speed and coherence in this turn)
import AdminDashboard from "./views/Dashboard/AdminDashboard";
import StoreLayout from "./views/Store/StoreLayout";
import Login from "./views/Auth/Login";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/s/:slug/*" element={<StoreLayout />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
