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
  expiry_date?: string;
  type: 'sale' | 'internal';
  is_active: boolean;
  is_featured: boolean;
  variations?: { name: string; options: string[] }[];
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
