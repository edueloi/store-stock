import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "../../components/ui";
import CustomerForm, { CustomerFormData, CustomerSeller } from "./CustomerForm";

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

/**
 * Página de cadastro/edição de cliente: /admin/customers/novo e
 * /admin/customers/:id/editar. Carrega o registro (edição) e os vendedores,
 * chama a API e navega; os campos vivem em CustomerForm.
 */
export default function CustomerFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [customer, setCustomer] = useState<CustomerFormData | null>(null);
  const [sellers, setSellers] = useState<CustomerSeller[]>([]);

  const backPath = isEditing ? `/admin/customers/${id}` : "/admin/customers";

  useEffect(() => {
    fetch("/api/sellers", { headers: authH() })
      .then((r) => r.json())
      .then((data) => setSellers(Array.isArray(data) ? data.filter((s: CustomerSeller) => s.is_active) : []))
      .catch(() => setSellers([]));
  }, []);

  useEffect(() => {
    if (!isEditing) { setCustomer(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    fetch(`/api/customers/${id}`, { headers: authH() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { if (active) { setCustomer(data); setLoading(false); } })
      .catch(() => {
        if (!active) return;
        toast.error("Cliente não encontrado.");
        navigate("/admin/customers", { replace: true });
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async (body: Record<string, unknown>) => {
    const res = await fetch(isEditing ? `/api/customers/${id}` : "/api/customers", {
      method: isEditing ? "PUT" : "POST",
      headers: authH(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Não foi possível salvar o cliente.");
    }
    toast.success(isEditing ? "Cliente atualizado." : "Cliente cadastrado.");
    navigate(backPath);
  };

  if (loading) {
    return <div role="status" className="flex justify-center py-12 text-sm text-slate-500">Carregando…</div>;
  }

  return (
    <CustomerForm
      key={id ?? "novo"}
      initialData={customer}
      sellers={sellers}
      onSave={handleSave}
      onCancel={() => navigate(backPath)}
    />
  );
}
