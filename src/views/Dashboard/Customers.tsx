import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, Phone, Search,
  AlertTriangle, X, ChevronRight, ChevronLeft, ChevronDown,
  DollarSign, CheckCircle2,
  TrendingDown, AlertCircle,
  Loader2, LayoutGrid, List, MapPin, Mail, StickyNote, WalletCards,
  HelpCircle, Download, Upload, FileSpreadsheet, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Button, IconButton, Input, Textarea, Select, Modal, ModalFooter, Badge, Alert, EmptyState, ContentCard, PanelCard, DetailField, SectionTitle, StatGrid, StatCard, Tabs, GridTable, Pagination, FilterLine, FilterLineSection, FilterLineSearch, FilterLineViewToggle } from "../../components/ui";
import type { Column } from "../../components/ui";
import { DropdownMenu } from "../../components/ui/Dropdown";
import CustomersPageTour, { CUSTOMERS_PAGE_TOUR_EVENTS, type CustomersPageTourHandle } from "../../components/onboarding/CustomersPageTour";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address_country?: string;
  notes?: string;
  credit_limit?: number;
  consignment_limit?: number;
  birth_date?: string;
  risk_flag: boolean;
  risk_reason?: string;
  created_at: string;
  total_debt?: number;
  open_debts?: number;
  legal_name?: string;
  trade_name?: string;
  cnae_code?: string;
  cnae_description?: string;
  legal_nature?: string;
  registration_status?: string;
  registration_status_date?: string;
  // ── Campos expandidos (import/export planilha) ──
  external_code?: string;
  contact_name?: string;
  fax?: string;
  website?: string;
  person_type?: "physical" | "legal";
  state_registration?: string;
  state_registration_exempt?: boolean;
  status?: "active" | "inactive";
  marital_status?: string;
  profession?: string;
  gender?: string;
  birthplace?: string;
  father_name?: string;
  father_document?: string;
  mother_name?: string;
  mother_document?: string;
  segment?: string;
  seller_id?: number | null;
  seller?: { id: number; name: string } | null;
  contact_type?: string;
  nfe_email?: string;
  customer_since?: string;
  next_visit_at?: string;
  tax_regime?: string;
}

interface Seller {
  id: number;
  name: string;
  is_active: boolean;
}

interface ImportSummary {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

interface Debtor {
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  risk_flag: boolean;
  total_debt: number;
  open_debts: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR");

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function maskDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "").replace(/\.{1,}$/, "");
  }
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "").replace(/\/$/, "");
}

// ─── Main Component ───────────────────────────────────────────────────────────

type MainTab = "customers" | "debtors";
type CustomerViewMode = "grid" | "table";

const CUSTOMER_VIEW_MODE_PREF = "customers_view_mode";

function getCachedViewMode(): CustomerViewMode {
  try {
    return localStorage.getItem(CUSTOMER_VIEW_MODE_PREF) === "table" ? "table" : "grid";
  } catch {
    return "grid";
  }
}

const MAIN_TABS = [
  { id: "customers", label: "Todos os Clientes", icon: Users },
  { id: "debtors", label: "Com pendências", icon: TrendingDown },
] as const satisfies readonly { id: MainTab; label: string; icon: React.ElementType; badge?: number }[];

type CustomerFormTab = "geral" | "endereco" | "comercial" | "fiscal" | "pessoal";

const CUSTOMER_FORM_TABS = [
  { id: "geral", label: "Geral", icon: Users },
  { id: "endereco", label: "Endereço", icon: MapPin },
  { id: "comercial", label: "Comercial", icon: WalletCards },
  { id: "fiscal", label: "Fiscal", icon: FileText },
  { id: "pessoal", label: "Dados pessoais", icon: StickyNote },
] as const satisfies readonly { id: CustomerFormTab; label: string; icon: React.ElementType }[];

export default function Customers() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<MainTab>("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debtors, setDebtors]     = useState<Debtor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [viewMode, setViewMode]   = useState<CustomerViewMode>(getCachedViewMode);
  const [pageSize, setPageSize]   = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Customer form (create/edit)
  const [showForm, setShowForm]   = useState(false);
  const [formTab, setFormTab]     = useState<CustomerFormTab>("geral");
  const [editCust, setEditCust]   = useState<Customer | null>(null);
  const [fName, setFName]         = useState("");
  const [fEmail, setFEmail]       = useState("");
  const [fPhone, setFPhone]       = useState("");
  const [fDoc, setFDoc]           = useState("");
  const [fAddr, setFAddr]         = useState("");
  const [fStreet, setFStreet]     = useState("");
  const [fNumber, setFNumber]     = useState("");
  const [fComplement, setFComplement] = useState("");
  const [fDistrict, setFDistrict] = useState("");
  const [fCity, setFCity]         = useState("");
  const [fState, setFState]       = useState("");
  const [fZip, setFZip]           = useState("");
  const [fCountry, setFCountry]   = useState("Brasil");
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [fLegalName, setFLegalName] = useState("");
  const [fTradeName, setFTradeName] = useState("");
  const [fCnaeCode, setFCnaeCode] = useState("");
  const [fCnaeDescription, setFCnaeDescription] = useState("");
  const [fLegalNature, setFLegalNature] = useState("");
  const [fRegistrationStatus, setFRegistrationStatus] = useState("");
  const [fRegistrationStatusDate, setFRegistrationStatusDate] = useState("");
  const [fNotes, setFNotes]       = useState("");
  const [fCredit, setFCredit]     = useState("");
  const [fConsignmentLimit, setFConsignmentLimit] = useState("");
  const [fBirth, setFBirth]       = useState("");
  const [fRisk, setFRisk]         = useState(false);
  const [fRiskReason, setFRiskReason] = useState("");
  const [saving, setSaving]       = useState(false);

  // ── Campos expandidos (planilha) ──
  const [fExternalCode, setFExternalCode] = useState("");
  const [fContactName, setFContactName]   = useState("");
  const [fFax, setFFax]                   = useState("");
  const [fWebsite, setFWebsite]           = useState("");
  const [fPersonType, setFPersonType]     = useState<"physical" | "legal">("physical");
  const [fStateRegistration, setFStateRegistration] = useState("");
  const [fStateRegistrationExempt, setFStateRegistrationExempt] = useState(false);
  const [fStatus, setFStatus]             = useState<"active" | "inactive">("active");
  const [fMaritalStatus, setFMaritalStatus] = useState("");
  const [fProfession, setFProfession]     = useState("");
  const [fGender, setFGender]             = useState("");
  const [fBirthplace, setFBirthplace]     = useState("");
  const [fFatherName, setFFatherName]     = useState("");
  const [fFatherDocument, setFFatherDocument] = useState("");
  const [fMotherName, setFMotherName]     = useState("");
  const [fMotherDocument, setFMotherDocument] = useState("");
  const [fSegment, setFSegment]           = useState("");
  const [fSellerId, setFSellerId]         = useState("");
  const [fContactType, setFContactType]   = useState("");
  const [fNfeEmail, setFNfeEmail]         = useState("");
  const [fCustomerSince, setFCustomerSince] = useState("");
  const [fNextVisitAt, setFNextVisitAt]   = useState("");
  const [fTaxRegime, setFTaxRegime]       = useState("");

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Generic confirmation dialog (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const customersPageTourRef = useRef<CustomersPageTourHandle>(null);

  useEffect(() => { if (showForm) setFormTab("geral"); }, [showForm]);

  // ── fetch

  const fetchAll = useCallback(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const [cRes, dRes] = await Promise.all([
        fetch("/api/customers", { headers: h }),
        fetch("/api/customers/debtors", { headers: h }),
      ]);
      const cData = await cRes.json();
      const dData = await dRes.json();
      setCustomers(Array.isArray(cData) ? cData : []);
      setDebtors(Array.isArray(dData) ? dData : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Vendedores ativos para o select "Vendedor" do formulário — carregado uma vez,
  // igual ao padrão de outras telas que consomem /api/sellers.
  useEffect(() => {
    fetch("/api/sellers", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => r.json())
      .then((data) => setSellers(Array.isArray(data) ? data.filter((s: Seller) => s.is_active) : []))
      .catch(() => setSellers([]));
  }, []);

  // Mantém a escolha Grade/Tabela por usuário, inclusive ao abrir o sistema em outro dispositivo.
  useEffect(() => {
    let active = true;
    const loadViewPreference = async () => {
      try {
        const res = await fetch(`/api/preferences/${CUSTOMER_VIEW_MODE_PREF}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const value = await res.json();
        if (active && (value === "grid" || value === "table")) {
          setViewMode(value);
          localStorage.setItem(CUSTOMER_VIEW_MODE_PREF, value);
        }
      } catch {
        // A preferência local mantém a tela utilizável mesmo sem conexão.
      }
    };
    loadViewPreference();
    return () => { active = false; };
  }, []);

  const changeViewMode = (mode: CustomerViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem(CUSTOMER_VIEW_MODE_PREF, mode); } catch { /* sem armazenamento local */ }
    fetch(`/api/preferences/${CUSTOMER_VIEW_MODE_PREF}`, {
      method: "PUT",
      headers: authH(),
      body: JSON.stringify({ value: mode }),
    }).catch(() => { /* cache local já foi atualizado */ });
  };

  // ── form helpers

  function openCreate() {
    setEditCust(null);
    setFName(""); setFEmail(""); setFPhone(""); setFDoc("");
    setFAddr(""); setFStreet(""); setFNumber(""); setFComplement(""); setFDistrict(""); setFCity(""); setFState(""); setFZip(""); setFCountry("Brasil");
    setFNotes(""); setFCredit(""); setFConsignmentLimit(""); setFBirth(""); setFRisk(false); setFRiskReason("");
    setFLegalName(""); setFTradeName(""); setFCnaeCode(""); setFCnaeDescription(""); setFLegalNature(""); setFRegistrationStatus(""); setFRegistrationStatusDate("");
    setFExternalCode(""); setFContactName(""); setFFax(""); setFWebsite(""); setFPersonType("physical");
    setFStateRegistration(""); setFStateRegistrationExempt(false); setFStatus("active");
    setFMaritalStatus(""); setFProfession(""); setFGender(""); setFBirthplace("");
    setFFatherName(""); setFFatherDocument(""); setFMotherName(""); setFMotherDocument("");
    setFSegment(""); setFSellerId(""); setFContactType(""); setFNfeEmail("");
    setFCustomerSince(""); setFNextVisitAt(""); setFTaxRegime("");
    setCnpjError(null);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setEditCust(c);
    setFName(c.name); setFEmail(c.email ?? ""); setFPhone(maskPhone(c.phone ?? ""));
    setFDoc(maskDoc(c.document ?? "")); setFAddr(c.address ?? ""); setFNotes(c.notes ?? "");
    setFStreet(c.address_street ?? ""); setFNumber(c.address_number ?? ""); setFComplement(c.address_complement ?? "");
    setFDistrict(c.address_district ?? ""); setFCity(c.address_city ?? ""); setFState(c.address_state ?? ""); setFZip(c.address_zip ?? "");
    setFCountry(c.address_country ?? "Brasil");
    setFCredit(c.credit_limit ? String(c.credit_limit) : "");
    setFConsignmentLimit(c.consignment_limit ? String(c.consignment_limit) : "");
    setFBirth(c.birth_date ? c.birth_date.slice(0, 10) : "");
    setFRisk(c.risk_flag); setFRiskReason(c.risk_reason ?? "");
    setFLegalName(c.legal_name ?? ""); setFTradeName(c.trade_name ?? "");
    setFCnaeCode(c.cnae_code ?? ""); setFCnaeDescription(c.cnae_description ?? "");
    setFLegalNature(c.legal_nature ?? ""); setFRegistrationStatus(c.registration_status ?? "");
    setFRegistrationStatusDate(c.registration_status_date ? c.registration_status_date.slice(0, 10) : "");
    setFExternalCode(c.external_code ?? ""); setFContactName(c.contact_name ?? "");
    setFFax(c.fax ? maskPhone(c.fax) : ""); setFWebsite(c.website ?? "");
    setFPersonType(c.person_type === "legal" ? "legal" : "physical");
    setFStateRegistration(c.state_registration ?? ""); setFStateRegistrationExempt(c.state_registration_exempt ?? false);
    setFStatus(c.status === "inactive" ? "inactive" : "active");
    setFMaritalStatus(c.marital_status ?? ""); setFProfession(c.profession ?? ""); setFGender(c.gender ?? "");
    setFBirthplace(c.birthplace ?? "");
    setFFatherName(c.father_name ?? ""); setFFatherDocument(c.father_document ?? "");
    setFMotherName(c.mother_name ?? ""); setFMotherDocument(c.mother_document ?? "");
    setFSegment(c.segment ?? ""); setFSellerId(c.seller_id ? String(c.seller_id) : "");
    setFContactType(c.contact_type ?? ""); setFNfeEmail(c.nfe_email ?? "");
    setFCustomerSince(c.customer_since ? c.customer_since.slice(0, 10) : "");
    setFNextVisitAt(c.next_visit_at ? c.next_visit_at.slice(0, 10) : "");
    setFTaxRegime(c.tax_regime ?? "");
    setCnpjError(null);
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditCust(null); }

  // ── Canal de comunicação do TOUR DE PÁGINA (CustomersPageTour) ────────────
  // Abre o drawer "Novo Cliente" de verdade via openCreate e preenche nome/
  // telefone de exemplo chamando os setters individuais (não há um objeto
  // form único nesta tela) — nunca chama handleSave (POST/PUT real) nem
  // handleDelete (abre confirmDialog → DELETE real). Fechar sempre via
  // closeForm (equivalente a clicar fora ou no X, que já fazem isso na tela
  // real).
  useEffect(() => {
    const onOpenNewCustomer = () => openCreate();
    const onFillCustomer = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; phone?: string; email?: string }>).detail;
      if (!detail) return;
      if (detail.name !== undefined) setFName(detail.name);
      if (detail.phone !== undefined) setFPhone(detail.phone);
      if (detail.email !== undefined) setFEmail(detail.email);
    };
    const onCloseForm = () => closeForm();

    window.addEventListener(CUSTOMERS_PAGE_TOUR_EVENTS.openNewCustomer, onOpenNewCustomer);
    window.addEventListener(CUSTOMERS_PAGE_TOUR_EVENTS.fillCustomer, onFillCustomer);
    window.addEventListener(CUSTOMERS_PAGE_TOUR_EVENTS.closeForm, onCloseForm);
    return () => {
      window.removeEventListener(CUSTOMERS_PAGE_TOUR_EVENTS.openNewCustomer, onOpenNewCustomer);
      window.removeEventListener(CUSTOMERS_PAGE_TOUR_EVENTS.fillCustomer, onFillCustomer);
      window.removeEventListener(CUSTOMERS_PAGE_TOUR_EVENTS.closeForm, onCloseForm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLookupCEP() {
    const raw = fZip.replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setFStreet(d.logradouro ?? "");
        setFDistrict(d.bairro ?? "");
        setFCity(d.localidade ?? "");
        setFState(d.uf ?? "");
        setFZip(raw);
      }
    } catch {
      // silencioso — mesmo comportamento do lookup de CEP do Tenant
    } finally {
      setCepLoading(false);
    }
  }

  async function handleLookupCNPJ() {
    const raw = fDoc.replace(/\D/g, "");
    if (raw.length !== 14) return;
    setCnpjLoading(true);
    setCnpjError(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (!res.ok) { setCnpjError("CNPJ não encontrado."); return; }
      const d = await res.json();
      // Nunca sobrescreve o campo "Nome" — ele é o apelido/nome usado no dia a
      // dia (cupom, listagens) e o usuário pode já tê-lo definido diferente da
      // razão social/fantasia oficial. A busca só completa os demais dados.
      if (d.email) setFEmail(d.email);
      if (d.ddd_telefone_1) setFPhone(maskPhone(d.ddd_telefone_1));
      if (d.cep) setFZip(String(d.cep).replace(/\D/g, ""));
      if (d.logradouro) setFStreet(d.logradouro);
      if (d.numero) setFNumber(d.numero);
      if (d.complemento) setFComplement(d.complemento);
      if (d.bairro) setFDistrict(d.bairro);
      if (d.municipio) setFCity(d.municipio);
      if (d.uf) setFState(d.uf);
      setFLegalName(d.razao_social?.trim() ?? "");
      setFTradeName(d.nome_fantasia?.trim() ?? "");
      setFCnaeCode(d.cnae_fiscal ? String(d.cnae_fiscal) : "");
      setFCnaeDescription(d.cnae_fiscal_descricao ?? "");
      setFLegalNature(d.natureza_juridica ?? "");
      setFRegistrationStatus(d.descricao_situacao_cadastral ?? "");
      setFRegistrationStatusDate(d.data_situacao_cadastral ?? "");
    } catch {
      setCnpjError("Falha ao consultar CNPJ. Tente novamente.");
    } finally {
      setCnpjLoading(false);
    }
  }

  async function handleSave() {
    if (!fName.trim()) return;
    setSaving(true);
    try {
      const computedAddress = [
        fStreet && fNumber ? `${fStreet}, ${fNumber}` : fStreet,
        fDistrict,
        fCity && fState ? `${fCity} - ${fState}` : fCity || fState,
      ].filter(Boolean).join(", ");
      const body = {
        name: fName, email: fEmail,
        phone: fPhone.replace(/\D/g, "") || null,
        document: fDoc.replace(/\D/g, "") || null,
        address: computedAddress || fAddr || null, notes: fNotes,
        address_street: fStreet || null,
        address_number: fNumber || null,
        address_complement: fComplement || null,
        address_district: fDistrict || null,
        address_city: fCity || null,
        address_state: fState || null,
        address_zip: fZip.replace(/\D/g, "") || null,
        address_country: fCountry || null,
        credit_limit: fCredit ? Number(fCredit) : null,
        consignment_limit: fConsignmentLimit ? Number(fConsignmentLimit) : null,
        birth_date: fBirth || null,
        risk_flag: fRisk,
        risk_reason: fRiskReason || null,
        legal_name: fLegalName || null,
        trade_name: fTradeName || null,
        cnae_code: fCnaeCode || null,
        cnae_description: fCnaeDescription || null,
        legal_nature: fLegalNature || null,
        registration_status: fRegistrationStatus || null,
        registration_status_date: fRegistrationStatusDate || null,
        external_code: fExternalCode || null,
        contact_name: fContactName || null,
        fax: fFax.replace(/\D/g, "") || null,
        website: fWebsite || null,
        person_type: fPersonType,
        state_registration: fStateRegistration || null,
        state_registration_exempt: fStateRegistrationExempt,
        status: fStatus,
        marital_status: fMaritalStatus || null,
        profession: fProfession || null,
        gender: fGender || null,
        birthplace: fBirthplace || null,
        father_name: fFatherName || null,
        father_document: fFatherDocument.replace(/\D/g, "") || null,
        mother_name: fMotherName || null,
        mother_document: fMotherDocument.replace(/\D/g, "") || null,
        segment: fSegment || null,
        seller_id: fSellerId ? Number(fSellerId) : null,
        contact_type: fContactType || null,
        nfe_email: fNfeEmail || null,
        customer_since: fCustomerSince || null,
        next_visit_at: fNextVisitAt || null,
        tax_regime: fTaxRegime || null,
      };
      if (editCust) {
        await fetch(`/api/customers/${editCust.id}`, {
          method: "PUT", headers: authH(), body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/customers", {
          method: "POST", headers: authH(), body: JSON.stringify(body),
        });
      }
      await fetchAll();
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: number) {
    setConfirmDialog({
      title: "Excluir cliente",
      message: "Excluir este cliente? Todas as dívidas e notas serão removidas.",
      onConfirm: async () => {
        await fetch(`/api/customers/${id}`, { method: "DELETE", headers: authH() });
        fetchAll();
      },
    });
  }

  // ── Export / Import planilha ──

  async function handleExport(format: "xlsx" | "csv") {
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const res = await fetch(`/api/customers/export?format=${format}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clientes_${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleImportClick() {
    importFileInputRef.current?.click();
  }

  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reimportar o mesmo arquivo depois
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImportSummary(data);
        await fetchAll();
      } else {
        setImportSummary({ created: 0, updated: 0, errors: [{ row: 0, message: data?.error ?? "Falha ao importar planilha" }] });
      }
    } catch {
      setImportSummary({ created: 0, updated: 0, errors: [{ row: 0, message: "Falha de conexão ao importar planilha" }] });
    } finally {
      setImporting(false);
    }
  }

  // ── filters

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDebtors = debtors.filter((d) =>
    d.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.customer_phone && d.customer_phone.includes(search))
  );

  const totalDebt = debtors.reduce((s, d) => s + d.total_debt, 0);

  useEffect(() => { setCurrentPage(1); }, [search, mainTab, viewMode, pageSize]);

  const pagedItems = mainTab === "customers" ? filteredCustomers : filteredDebtors;
  const totalPages = Math.max(1, Math.ceil(pagedItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedCustomers = filteredCustomers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedDebtors = filteredDebtors.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ─────────────────────────────────────────────────────────────────────────────

  const customerColumns: Column<Customer>[] = [
    { header: "Cliente", render: (c) => <span className="break-words text-xs font-medium text-slate-800">{c.name}</span> },
    { header: "Telefone", render: (c) => <span className="text-xs text-slate-500">{(c.phone && maskPhone(c.phone)) || "–"}</span> },
    { header: "Cidade", render: (c) => <span className="text-xs text-slate-500">{[c.address_city, c.address_state].filter(Boolean).join(" - ") || "–"}</span> },
    {
      header: "Saldo em aberto",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-red-600">{(c.total_debt ?? 0) > 0 ? fmt(c.total_debt!) : "–"}</span>,
    },
    {
      header: "Risco",
      className: "text-center",
      headerClassName: "text-center",
      render: (c) => c.risk_flag ? <AlertTriangle size={14} className="mx-auto text-rose-500" /> : <span className="text-xs text-slate-300">—</span>,
    },
    { header: "Cliente desde", render: (c) => <span className="text-xs text-slate-500">{fmtDate(c.customer_since ?? c.created_at)}</span> },
    {
      header: "Ação",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => <span className="text-[11px] font-medium text-blue-600">Ver ficha</span>,
    },
  ];

  const debtorColumns: Column<Debtor>[] = [
    { header: "Cliente", render: (d) => <span className="break-words text-xs font-medium text-slate-800">{d.customer_name}</span> },
    { header: "Telefone", render: (d) => <span className="text-xs text-slate-500">{(d.customer_phone && maskPhone(d.customer_phone)) || "–"}</span> },
    {
      header: "Parcelas",
      className: "text-center",
      headerClassName: "text-center",
      render: (d) => <Badge pill>{d.open_debts}</Badge>,
    },
    {
      header: "Saldo em aberto",
      className: "text-right",
      headerClassName: "text-right",
      render: (d) => <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-red-600">{fmt(d.total_debt)}</span>,
    },
    {
      header: "Risco",
      className: "text-center",
      headerClassName: "text-center",
      render: (d) => d.risk_flag ? <AlertTriangle size={14} className="mx-auto text-rose-500" /> : <span className="text-xs text-slate-300">—</span>,
    },
    {
      header: "Ação",
      className: "text-right",
      headerClassName: "text-right",
      render: () => <span className="text-[11px] font-medium text-blue-600">Ver ficha</span>,
    },
  ];

  const formTabItems = CUSTOMER_FORM_TABS.filter((t) => t.id !== "pessoal" || fPersonType === "physical");

  return (
    <div data-tour="customers-page" className="min-w-0 space-y-4">
      <SectionTitle
        title="Clientes"
        icon={Users}
        description="Clientes, crédito, histórico de compras e notas internas"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button data-tour="customers-new-btn" size="sm" iconLeft={<UserPlus size={14} />} onClick={openCreate}>
              Novo Cliente
            </Button>
            <DropdownMenu
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Download size={14} />}
                  iconRight={<ChevronDown size={12} />}
                  loading={exporting}
                  title="Exportar clientes para planilha"
                >
                  <span className="sr-only sm:not-sr-only">Exportar planilha</span>
                </Button>
              }
              items={[
                { label: "Excel (.xlsx)", icon: <FileSpreadsheet size={14} className="text-emerald-600" />, onClick: () => handleExport("xlsx") },
                { label: "CSV (.csv)", icon: <FileText size={14} className="text-blue-600" />, onClick: () => handleExport("csv") },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Upload size={14} />}
              loading={importing}
              onClick={handleImportClick}
              title="Importar clientes de planilha Excel ou CSV"
            >
              <span className="sr-only sm:not-sr-only">Importar planilha</span>
            </Button>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              aria-label="Importar planilha de clientes"
              onChange={handleImportFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              iconLeft={<HelpCircle size={14} />}
              onClick={() => customersPageTourRef.current?.start()}
              title="Tour guiado desta página"
            >
              <span className="sr-only sm:not-sr-only">Ajuda</span>
            </Button>
          </div>
        }
      />

      <CustomersPageTour ref={customersPageTourRef} />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard title="Total Clientes" value={customers.length} icon={Users} color="default" />
        <StatCard title="Com Pendências" value={debtors.length} icon={AlertCircle} color="warning" />
        <StatCard title="Saldo em Aberto" value={fmt(totalDebt)} icon={DollarSign} color="danger" />
        <StatCard title="Clientes em Risco" value={customers.filter(c => c.risk_flag).length} icon={AlertTriangle} color="purple" />
      </StatGrid>

      {/* Busca + modo de exibição */}
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineSearch
            aria-label={mainTab === "customers" ? "Buscar cliente" : "Buscar cliente com pendência"}
            value={search}
            onChange={setSearch}
            placeholder={mainTab === "customers" ? "Buscar cliente…" : "Buscar cliente com pendência…"}
          />
        </FilterLineSection>
        {mainTab === "customers" && (
          <FilterLineSection align="right">
            <FilterLineViewToggle<CustomerViewMode>
              value={viewMode}
              onChange={changeViewMode}
              gridValue="grid"
              listValue="table"
            />
          </FilterLineSection>
        )}
      </FilterLine>

      {/* Main tabs */}
      <Tabs<MainTab>
        items={MAIN_TABS.map((t) => (t.id === "debtors" ? { ...t, badge: debtors.length } : t))}
        value={mainTab}
        onChange={setMainTab}
        label="Listas de clientes"
      >
      {/* ── CUSTOMERS LIST ─────────────────────────────────────────────────── */}
      {mainTab === "customers" && (
        <div className="space-y-3">
          {!loading && filteredCustomers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum cliente encontrado"
              description={search ? "Ajuste a busca para ver outros clientes." : undefined}
              action={<Button size="sm" onClick={openCreate}>Cadastrar cliente</Button>}
            />
          ) : loading ? (
            <div role="status" className="flex justify-center py-12 text-sm text-slate-500">Carregando…</div>
          ) : viewMode === "grid" ? (
            <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              <AnimatePresence>
                {pagedCustomers.map((c) => {
                  const hasDebt = Number(c.total_debt ?? 0) > 0;
                  const hasCreditLimit = Number(c.credit_limit ?? 0) > 0;
                  const location = [c.address_city, c.address_state].filter(Boolean).join(" · ") || c.address;
                  const preference = c.notes?.trim();

                  return (
                  <motion.article
                    key={c.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    onClick={() => navigate(`/admin/customers/${c.id}`)}
                    className={cn(
                      "group flex min-w-0 cursor-pointer flex-col gap-3 rounded-lg border bg-white p-3 transition-all hover:border-blue-200",
                      c.risk_flag ? "border-rose-200" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-base font-semibold",
                          c.risk_flag ? "border-rose-200 bg-rose-50 text-rose-500" : "border-blue-100 bg-blue-50 text-blue-600"
                        )}>
                          {c.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 break-words text-[13px] font-semibold leading-tight text-slate-900">{c.name}</p>
                          <p className="mt-1 text-[11px] text-slate-500">Cliente desde {fmtDate(c.customer_since ?? c.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {c.risk_flag && (
                          <span title="Cliente em risco">
                            <Badge color="danger" icon={<AlertTriangle size={11} />}>Risco</Badge>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 border-y border-slate-100 py-3 min-[430px]:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-2 text-slate-500">
                        {c.phone ? <Phone size={13} className="shrink-0 text-blue-500" /> : <Mail size={13} className="shrink-0 text-blue-500" />}
                        <span className="truncate text-[11px] font-medium">{(c.phone && maskPhone(c.phone)) || c.email || "Contato não informado"}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-slate-500">
                        <MapPin size={13} className="shrink-0 text-blue-500" />
                        <span className="truncate text-[11px] font-medium">{location || "Endereço não informado"}</span>
                      </div>
                    </div>

                    {preference && (
                      <div className="flex min-w-0 items-start gap-2 rounded-lg bg-blue-50/70 px-3 py-2 text-blue-800">
                        <StickyNote size={13} className="mt-0.5 shrink-0 text-blue-500" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-blue-500">Preferências</p>
                          <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-relaxed">{preference}</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        {hasDebt ? (
                          <p className="text-[11px] font-semibold text-rose-600">Em aberto: {fmt(Number(c.total_debt))}</p>
                        ) : hasCreditLimit ? (
                          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><WalletCards size={12} /> Limite: {fmt(Number(c.credit_limit))}</p>
                        ) : (
                          <p className="text-[11px] font-medium text-emerald-600">Sem pendências</p>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-blue-600 transition-transform group-hover:translate-x-0.5">
                        Ver ficha <ChevronRight size={11} />
                      </span>
                    </div>
                  </motion.article>
                )})}
              </AnimatePresence>
            </div>
            <Pagination
              total={filteredCustomers.length}
              page={safePage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
            </>
          ) : (
            <ContentCard padding="none" className="overflow-hidden">
              <GridTable<Customer>
                noDesktopCard
                data={pagedCustomers}
                columns={customerColumns}
                keyExtractor={(c) => c.id}
                onRowClick={(c) => navigate(`/admin/customers/${c.id}`)}
                pagination={{
                  total: filteredCustomers.length,
                  page: safePage,
                  pageSize,
                  onPageChange: setCurrentPage,
                  onPageSizeChange: setPageSize,
                }}
              />
            </ContentCard>
          )}
        </div>
      )}

      {/* ── DEBTORS LIST ───────────────────────────────────────────────────── */}
      {mainTab === "debtors" && (
        <div className="space-y-3">
          {filteredDebtors.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhum cliente com pendência em aberto"
              description={search ? "Ajuste a busca para ver outros clientes." : undefined}
            />
          ) : (
            <ContentCard padding="none" className="overflow-hidden">
              <GridTable<Debtor>
                noDesktopCard
                data={pagedDebtors}
                columns={debtorColumns}
                keyExtractor={(d) => d.customer_id}
                onRowClick={(d) => navigate(`/admin/customers/${d.customer_id}`)}
                pagination={{
                  total: filteredDebtors.length,
                  page: safePage,
                  pageSize,
                  onPageChange: setCurrentPage,
                  onPageSizeChange: setPageSize,
                }}
              />
              <div className="flex items-center justify-between border-t border-red-100 bg-red-50 px-3 py-2">
                <span className="text-[11px] font-medium text-red-500">Total em aberto</span>
                <span className="text-xs font-semibold tabular-nums text-red-600">{fmt(totalDebt)}</span>
              </div>
            </ContentCard>
          )}
        </div>
      )}
      </Tabs>

      {/* ── CREATE / EDIT FORM ────────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={closeForm}
        size="lg"
        title={editCust ? "Editar Cliente" : "Novo Cliente"}
        subtitle="Cadastro de Cliente"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving} disabled={saving || !fName.trim()}>
              {editCust ? "Salvar" : "Criar Cliente"}
            </Button>
          </ModalFooter>
        }
      >
        <Tabs<CustomerFormTab> items={formTabItems} value={formTab} onChange={setFormTab} label="Dados do cliente">
          {formTab === "geral" && (
            <div className="space-y-3">
              <div data-tour="customer-form-name">
                <Input label="Nome *" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Telefone"
                  value={fPhone}
                  onChange={(e) => setFPhone(maskPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  inputMode="numeric"
                />
                <div className="flex items-end gap-1.5">
                  <Input
                    wrapperClassName="flex-1"
                    label="CPF/CNPJ"
                    value={fDoc}
                    onChange={(e) => { setFDoc(maskDoc(e.target.value)); setCnpjError(null); }}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                  {fDoc.replace(/\D/g, "").length === 14 && (
                    <IconButton
                      variant="outline"
                      onClick={handleLookupCNPJ}
                      disabled={cnpjLoading}
                      loading={cnpjLoading}
                      title="Buscar dados do CNPJ na Receita Federal"
                      aria-label="Buscar dados do CNPJ"
                    >
                      <Search size={14} />
                    </IconButton>
                  )}
                </div>
              </div>
              {cnpjError && <Alert variant="error">{cnpjError}</Alert>}
              {fDoc.replace(/\D/g, "").length === 14 && (fLegalName || fCnaeDescription || fRegistrationStatus) && (
                <PanelCard title="Dados Fiscais (Receita Federal)">
                  <div className="space-y-3">
                    {fLegalName && (
                      <Input label="Razão Social" value={fLegalName} onChange={(e) => setFLegalName(e.target.value)} />
                    )}
                    <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                      {fLegalNature && <DetailField label="Natureza Jurídica" value={fLegalNature} />}
                      {fRegistrationStatus && <DetailField label="Situação Cadastral" value={fRegistrationStatus} />}
                      {fCnaeDescription && (
                        <DetailField
                          className="sm:col-span-2"
                          label="CNAE Principal"
                          value={`${fCnaeCode ? `${fCnaeCode} — ` : ""}${fCnaeDescription}`}
                        />
                      )}
                    </dl>
                  </div>
                </PanelCard>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Data de Aniversário" type="date" value={fBirth} onChange={(e) => setFBirth(e.target.value)} />
                <Input label="E-mail" type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div data-tour="customer-form-credit">
                  <Input label="Limite de Crédito (R$)" type="number" min={0} value={fCredit} onChange={(e) => setFCredit(e.target.value)} placeholder="0,00" />
                </div>
                <Input label="Limite de Consignação (R$)" type="number" min={0} value={fConsignmentLimit} onChange={(e) => setFConsignmentLimit(e.target.value)} placeholder="0,00" />
              </div>
              <Textarea label="Observações" value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} placeholder="Preferências, anotações gerais…" />

              {/* Risk flag */}
              <div className={cn("space-y-2 rounded-lg border p-3 transition-colors", fRisk ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50")}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fRisk}
                    onChange={(e) => setFRisk(e.target.checked)}
                    className="h-4 w-4 accent-rose-500"
                  />
                  <span className={cn("text-xs font-medium", fRisk ? "text-rose-600" : "text-slate-600")}>
                    <AlertTriangle size={12} className="mr-1 inline" />
                    Marcar como Cliente de Risco
                  </span>
                </label>
                {fRisk && (
                  <Textarea
                    aria-label="Motivo do risco"
                    value={fRiskReason}
                    onChange={(e) => setFRiskReason(e.target.value)}
                    rows={2}
                    placeholder="Motivo do risco (ex: atrasou 3x, cheque sem fundo…)"
                  />
                )}
              </div>
            </div>
          )}

          {formTab === "endereco" && (
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <Input
                  wrapperClassName="w-36"
                  label="CEP"
                  value={fZip}
                  onChange={(e) => setFZip(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="CEP"
                  inputMode="numeric"
                />
                <Button
                  variant="outline"
                  iconLeft={<Search size={13} />}
                  onClick={handleLookupCEP}
                  loading={cepLoading}
                  disabled={cepLoading || fZip.replace(/\D/g, "").length !== 8}
                >
                  Buscar CEP
                </Button>
              </div>
              <Input label="Rua / Logradouro" value={fStreet} onChange={(e) => setFStreet(e.target.value)} placeholder="Rua / Logradouro" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Número" value={fNumber} onChange={(e) => setFNumber(e.target.value)} placeholder="Número" />
                <Input label="Complemento" value={fComplement} onChange={(e) => setFComplement(e.target.value)} placeholder="Complemento" />
              </div>
              <Input label="Bairro" value={fDistrict} onChange={(e) => setFDistrict(e.target.value)} placeholder="Bairro" />
              <div className="grid grid-cols-3 gap-3">
                <Input wrapperClassName="col-span-2" label="Cidade" value={fCity} onChange={(e) => setFCity(e.target.value)} placeholder="Cidade" />
                <Select label="UF" value={fState} onChange={(e) => setFState(e.target.value)}>
                  <option value="">UF</option>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </Select>
              </div>
              <Input label="País" value={fCountry} onChange={(e) => setFCountry(e.target.value)} placeholder="País" />
            </div>
          )}

          {formTab === "comercial" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Código (planilha)" value={fExternalCode} onChange={(e) => setFExternalCode(e.target.value)} placeholder="Código legado" />
                <Select label="Situação" value={fStatus} onChange={(e) => setFStatus(e.target.value as "active" | "inactive")}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </Select>
              </div>
              <Input label="Nome do Contato" value={fContactName} onChange={(e) => setFContactName(e.target.value)} placeholder="Pessoa de contato" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Fax" value={fFax} onChange={(e) => setFFax(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="numeric" />
                <Input label="Tipo de Contato" value={fContactType} onChange={(e) => setFContactType(e.target.value)} placeholder="Ex: Comprador" />
              </div>
              <Input label="Web Site" value={fWebsite} onChange={(e) => setFWebsite(e.target.value)} placeholder="https://…" />
              <Input label="Segmento" value={fSegment} onChange={(e) => setFSegment(e.target.value)} placeholder="Segmento de mercado" />
              <Select label="Vendedor Responsável" value={fSellerId} onChange={(e) => setFSellerId(e.target.value)}>
                <option value="">Nenhum</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Cliente desde" type="date" value={fCustomerSince} onChange={(e) => setFCustomerSince(e.target.value)} />
                <Input label="Próxima visita" type="date" value={fNextVisitAt} onChange={(e) => setFNextVisitAt(e.target.value)} />
              </div>
            </div>
          )}

          {formTab === "fiscal" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Tipo de Pessoa" value={fPersonType} onChange={(e) => setFPersonType(e.target.value as "physical" | "legal")}>
                  <option value="physical">Pessoa Física</option>
                  <option value="legal">Pessoa Jurídica</option>
                </Select>
                <Input
                  label={fPersonType === "legal" ? "IE" : "RG"}
                  value={fStateRegistration}
                  onChange={(e) => setFStateRegistration(e.target.value)}
                  disabled={fStateRegistrationExempt}
                  placeholder={fPersonType === "legal" ? "Inscrição Estadual" : "RG"}
                />
              </div>
              {fPersonType === "legal" && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={fStateRegistrationExempt} onChange={(e) => setFStateRegistrationExempt(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                  <span className="text-xs font-medium text-slate-600">IE isento</span>
                </label>
              )}
              <Input label="E-mail para envio de NFe" type="email" value={fNfeEmail} onChange={(e) => setFNfeEmail(e.target.value)} placeholder="nfe@exemplo.com" />
              <Input label="Regime Tributário" value={fTaxRegime} onChange={(e) => setFTaxRegime(e.target.value)} placeholder="Ex: Simples Nacional" />
            </div>
          )}

          {formTab === "pessoal" && fPersonType === "physical" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Estado Civil" value={fMaritalStatus} onChange={(e) => setFMaritalStatus(e.target.value)} placeholder="Ex: Casado(a)" />
                <Input label="Profissão" value={fProfession} onChange={(e) => setFProfession(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Sexo" value={fGender} onChange={(e) => setFGender(e.target.value)}>
                  <option value="">–</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="other">Outro</option>
                </Select>
                <Input label="Naturalidade" value={fBirthplace} onChange={(e) => setFBirthplace(e.target.value)} placeholder="Cidade - UF" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Nome do pai" value={fFatherName} onChange={(e) => setFFatherName(e.target.value)} placeholder="Nome do pai" />
                <Input label="CPF do pai" value={fFatherDocument} onChange={(e) => setFFatherDocument(maskDoc(e.target.value))} placeholder="CPF do pai" inputMode="numeric" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Nome da mãe" value={fMotherName} onChange={(e) => setFMotherName(e.target.value)} placeholder="Nome da mãe" />
                <Input label="CPF da mãe" value={fMotherDocument} onChange={(e) => setFMotherDocument(maskDoc(e.target.value))} placeholder="CPF da mãe" inputMode="numeric" />
              </div>
            </div>
          )}
        </Tabs>
      </Modal>

      <Modal
        open={!!confirmDialog}
        onClose={() => { if (!confirming) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ""}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={confirming}>Cancelar</Button>
            <Button
              variant="danger"
              loading={confirming}
              onClick={async () => {
                if (!confirmDialog) return;
                setConfirming(true);
                try {
                  await confirmDialog.onConfirm();
                  setConfirmDialog(null);
                } finally {
                  setConfirming(false);
                }
              }}
            >
              Confirmar
            </Button>
          </ModalFooter>
        }
      >
        <p className="text-[13px] text-slate-600">{confirmDialog?.message}</p>
      </Modal>

      {/* Resumo da importação de planilha */}
      <Modal
        open={!!importSummary}
        onClose={() => setImportSummary(null)}
        title="Resultado da Importação"
        size="md"
        footer={<ModalFooter><Button onClick={() => setImportSummary(null)}>Fechar</Button></ModalFooter>}
      >
        {importSummary && (
          <div className="space-y-3">
            <StatGrid cols={3}>
              <StatCard title="Criados" value={importSummary.created} icon={CheckCircle2} color="success" />
              <StatCard title="Atualizados" value={importSummary.updated} icon={Users} color="info" />
              <StatCard title="Erros" value={importSummary.errors.length} icon={AlertTriangle} color="danger" />
            </StatGrid>
            {importSummary.errors.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 text-[11px] font-medium text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Linha</th>
                      <th className="px-3 py-2 text-left font-medium">Erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importSummary.errors.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-600">{e.row || "–"}</td>
                        <td className="px-3 py-2 text-slate-600">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
