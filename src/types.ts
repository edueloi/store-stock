export interface BusinessHours {
  [day: string]: { open: string; close: string; closed: boolean };
}

export interface PaymentMethods {
  pix: boolean;
  credit_card: boolean;
  debit_card: boolean;
  cash: boolean;
  boleto: boolean;
}

// card_fees[brand][installmentIndex] = rate%
// ex: { visa: [2.5, 3.0, 3.5, ...12 slots] }
export type CardFees = Record<string, number[]>;

export interface StorePolicies {
  returns: string;
  shipping: string;
  exchange: string;
  warranty_days?: number;
  warranty_resolution_days?: number;
  warranty_title?: string;
  warranty_clauses?: string[];
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  whatsapp: string;
  document?: string;
  logo_url?: string;
  banner_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  address?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  show_address: boolean;
  template_id: string;
  about_text?: string;
  footer_text?: string;
  primary_color: string;
  featured_limit?: number;
  bestseller_limit?: number;
  business_hours?: BusinessHours;
  payment_methods?: PaymentMethods;
  policies?: StorePolicies;
  card_fees?: Record<string, number[]>;
  pass_fee_to_customer?: boolean;
  max_installments?: number;
  enabled_brands?: Record<string, boolean>;
  pass_fee_by_method?: Record<string, boolean>;
  status?: 'pending_setup' | 'trial' | 'active' | 'suspended';
  trial_days?: number;
  trial_starts_at?: string;
  trial_ends_at?: string;
  subscription_amount?: number;
  setup_completed_at?: string;
  public_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: number;
  tenant_id: number;
  name: string;
  email: string;
  role: 'admin' | 'seller' | 'staff' | 'super_admin';
  superAdmin?: boolean;
}

export interface Category {
  id: number;
  tenant_id: number;
  name: string;
}

export interface Product {
  id: number;
  tenant_id: number;
  category_id?: number;
  category_name?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  price: number;
  cost_price?: number;
  discount_price?: number;
  stock_quantity: number;
  image_url?: string;
  images?: string[];
  expiry_date?: string;
  type: 'sale' | 'internal';
  is_active: boolean;
  is_featured: boolean;
  // attribute groups (ex: [{name:"Tamanho", values:["P","M","G"]}, {name:"Cor", values:["Preto","Branco"]}])
  attributes?: { name: string; values: string[] }[];
  // SKU combinations (ex: [{combo:{"Tamanho":"G","Cor":"Preto"}, stock:3}])
  skus?: { combo: Record<string, string>; stock: number }[];
  /** @deprecated use attributes+skus */
  variations?: { name: string; options: { value: string; stock: number }[] }[];
}

export interface Supplier {
  id: number;
  tenant_id: number;
  name: string;
  category: string;
  contact_person?: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export interface Order {
  id: number;
  tenant_id: number;
  seller_id?: number | null;
  seller_name?: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  total_amount: number;
  gross_amount?: number | null;
  discount_amount?: number | null;
  fee_amount?: number | null;
  status: 'pending' | 'completed' | 'cancelled';
  payment_method?: string;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  created_at: string;
}

export interface FinanceEntry {
  id: number;
  tenant_id: number;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  gross_amount?: number | null;
  fee_amount?: number | null;
  discount_amount?: number | null;
  date: string;
  category?: string;
}

export type AccountStatus = 'pending' | 'received' | 'paid' | 'overdue' | 'cancelled';

export interface AccountReceivable {
  id: number;
  tenant_id: number;
  description: string;
  amount: number;
  due_date: string;
  received_date?: string | null;
  status: AccountStatus;
  category?: string;
  customer_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountPayable {
  id: number;
  tenant_id: number;
  description: string;
  amount: number;
  due_date: string;
  paid_date?: string | null;
  status: AccountStatus;
  category?: string;
  supplier_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SetupInvite {
  id: number;
  token: string;
  store_name: string;
  subdomain: string;
  whatsapp: string;
  owner_name?: string | null;
  owner_email?: string | null;
  trial_days: number;
  subscription_amount: number;
  invite_expires_at: string;
  used_at?: string | null;
  created_at: string;
  updated_at: string;
  invite_url: string;
  access_url: string;
  is_expired: boolean;
}

export interface ManagedTenant extends Tenant {
  users?: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
  }>;
}
