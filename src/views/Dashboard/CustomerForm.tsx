import React, { useState, useRef } from "react";
import {
  Users, MapPin, Search, AlertTriangle, WalletCards, FileText, StickyNote, ArrowLeft, Save,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button, IconButton, Input, Textarea, Select, Alert, ContentCard, PanelCard, DetailField, SectionTitle, Tabs, useToast } from "../../components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerFormData {
  id?: number;
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
  risk_flag?: boolean;
  risk_reason?: string;
  legal_name?: string;
  trade_name?: string;
  cnae_code?: string;
  cnae_description?: string;
  legal_nature?: string;
  registration_status?: string;
  registration_status_date?: string;
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
  contact_type?: string;
  nfe_email?: string;
  customer_since?: string;
  next_visit_at?: string;
  tax_regime?: string;
}

export interface CustomerSeller {
  id: number;
  name: string;
  is_active: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

export function maskDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "").replace(/\.{1,}$/, "");
  }
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "").replace(/\/$/, "");
}

type CustomerFormTab = "geral" | "endereco" | "comercial" | "fiscal" | "pessoal";

const CUSTOMER_FORM_TABS = [
  { id: "geral", label: "Geral", icon: Users },
  { id: "endereco", label: "Endereço", icon: MapPin },
  { id: "comercial", label: "Comercial", icon: WalletCards },
  { id: "fiscal", label: "Fiscal", icon: FileText },
  { id: "pessoal", label: "Dados pessoais", icon: StickyNote },
] as const satisfies readonly { id: CustomerFormTab; label: string; icon: React.ElementType }[];

interface CustomerFormProps {
  /** Cliente a editar; ausente/nulo = cadastro novo. */
  initialData?: CustomerFormData | null;
  sellers: CustomerSeller[];
  /** Recebe o corpo pronto para a API (sem máscaras). A Promise libera o botão ao terminar. */
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export default function CustomerForm({ initialData, sellers, onSave, onCancel }: CustomerFormProps) {
  const toast = useToast();
  const c = initialData ?? null;
  const isEditing = !!c?.id;

  const [formTab, setFormTab]     = useState<CustomerFormTab>("geral");
  const [fName, setFName]         = useState(c?.name ?? "");
  const [fEmail, setFEmail]       = useState(c?.email ?? "");
  const [fPhone, setFPhone]       = useState(maskPhone(c?.phone ?? ""));
  const [fDoc, setFDoc]           = useState(maskDoc(c?.document ?? ""));
  const [fAddr]                   = useState(c?.address ?? "");
  const [fStreet, setFStreet]     = useState(c?.address_street ?? "");
  const [fNumber, setFNumber]     = useState(c?.address_number ?? "");
  const [fComplement, setFComplement] = useState(c?.address_complement ?? "");
  const [fDistrict, setFDistrict] = useState(c?.address_district ?? "");
  const [fCity, setFCity]         = useState(c?.address_city ?? "");
  const [fState, setFState]       = useState(c?.address_state ?? "");
  const [fZip, setFZip]           = useState(c?.address_zip ?? "");
  const [fCountry, setFCountry]   = useState(c?.address_country ?? "Brasil");
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [fLegalName, setFLegalName] = useState(c?.legal_name ?? "");
  const [fTradeName, setFTradeName] = useState(c?.trade_name ?? "");
  const [fCnaeCode, setFCnaeCode] = useState(c?.cnae_code ?? "");
  const [fCnaeDescription, setFCnaeDescription] = useState(c?.cnae_description ?? "");
  const [fLegalNature, setFLegalNature] = useState(c?.legal_nature ?? "");
  const [fRegistrationStatus, setFRegistrationStatus] = useState(c?.registration_status ?? "");
  const [fRegistrationStatusDate, setFRegistrationStatusDate] = useState(c?.registration_status_date ? c.registration_status_date.slice(0, 10) : "");
  const [fNotes, setFNotes]       = useState(c?.notes ?? "");
  const [fCredit, setFCredit]     = useState(c?.credit_limit ? String(c.credit_limit) : "");
  const [fConsignmentLimit, setFConsignmentLimit] = useState(c?.consignment_limit ? String(c.consignment_limit) : "");
  const [fBirth, setFBirth]       = useState(c?.birth_date ? c.birth_date.slice(0, 10) : "");
  const [fRisk, setFRisk]         = useState(!!c?.risk_flag);
  const [fRiskReason, setFRiskReason] = useState(c?.risk_reason ?? "");
  const [saving, setSaving]       = useState(false);
  const savingRef = useRef(false);

  const [fExternalCode, setFExternalCode] = useState(c?.external_code ?? "");
  const [fContactName, setFContactName]   = useState(c?.contact_name ?? "");
  const [fFax, setFFax]                   = useState(c?.fax ? maskPhone(c.fax) : "");
  const [fWebsite, setFWebsite]           = useState(c?.website ?? "");
  const [fPersonType, setFPersonType]     = useState<"physical" | "legal">(c?.person_type === "legal" ? "legal" : "physical");
  const [fStateRegistration, setFStateRegistration] = useState(c?.state_registration ?? "");
  const [fStateRegistrationExempt, setFStateRegistrationExempt] = useState(c?.state_registration_exempt ?? false);
  const [fStatus, setFStatus]             = useState<"active" | "inactive">(c?.status === "inactive" ? "inactive" : "active");
  const [fMaritalStatus, setFMaritalStatus] = useState(c?.marital_status ?? "");
  const [fProfession, setFProfession]     = useState(c?.profession ?? "");
  const [fGender, setFGender]             = useState(c?.gender ?? "");
  const [fBirthplace, setFBirthplace]     = useState(c?.birthplace ?? "");
  const [fFatherName, setFFatherName]     = useState(c?.father_name ?? "");
  const [fFatherDocument, setFFatherDocument] = useState(c?.father_document ?? "");
  const [fMotherName, setFMotherName]     = useState(c?.mother_name ?? "");
  const [fMotherDocument, setFMotherDocument] = useState(c?.mother_document ?? "");
  const [fSegment, setFSegment]           = useState(c?.segment ?? "");
  const [fSellerId, setFSellerId]         = useState(c?.seller_id ? String(c.seller_id) : "");
  const [fContactType, setFContactType]   = useState(c?.contact_type ?? "");
  const [fNfeEmail, setFNfeEmail]         = useState(c?.nfe_email ?? "");
  const [fCustomerSince, setFCustomerSince] = useState(c?.customer_since ? c.customer_since.slice(0, 10) : "");
  const [fNextVisitAt, setFNextVisitAt]   = useState(c?.next_visit_at ? c.next_visit_at.slice(0, 10) : "");
  const [fTaxRegime, setFTaxRegime]       = useState(c?.tax_regime ?? "");

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

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (savingRef.current) return;
    if (!fName.trim()) {
      setFormTab("geral");
      toast.error("Preencha o nome do cliente.");
      return;
    }
    savingRef.current = true;
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
      await onSave(body);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const formTabItems = CUSTOMER_FORM_TABS.filter((t) => t.id !== "pessoal" || fPersonType === "physical");

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={onCancel}>Voltar</Button>
      <SectionTitle
        title={isEditing ? "Editar cliente" : "Novo cliente"}
        icon={Users}
        description={isEditing ? "Atualize os dados do cliente" : "Preencha os dados do novo cliente"}
      />
      <ContentCard padding="lg">
        <form id="customer-form" onSubmit={handleSave} className="space-y-4">
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
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" type="button" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button type="submit" iconLeft={<Save size={13} />} loading={saving} disabled={saving}>
            {saving ? "Salvando..." : isEditing ? "Salvar" : "Cadastrar cliente"}
          </Button>
        </div>
        </form>
      </ContentCard>
    </div>
  );
}
