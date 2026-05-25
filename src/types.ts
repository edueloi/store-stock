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

export interface StorePolicies {
  returns: string;
  shipping: string;
  exchange: string;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  whatsapp: string;
  logo_url?: string;
  banner_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  address?: string;
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
}

export interface User {
  id: number;
  tenant_id: number;
  name: string;
  email: string;
  role: 'admin' | 'seller' | 'staff';
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
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  total_amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  payment_method?: string;
  created_at: string;
}

export interface FinanceEntry {
  id: number;
  tenant_id: number;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
  category?: string;
}
