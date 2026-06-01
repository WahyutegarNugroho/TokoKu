import { type LocalProduct } from '@/lib/dexie';

export interface SelectedVariantOption {
  variant_name: string;
  option_name: string;
  price_modifier: number;
}

export interface CartItem {
  cartItemId: string;
  product: LocalProduct;
  quantity: number;
  discount?: number;
  selectedVariants?: SelectedVariantOption[];
}

export interface PaymentSplit {
  method: 'CASH' | 'DEBIT' | 'QRIS' | 'EWALLET' | 'TRANSFER' | 'CREDIT' | 'DEBT';
  amount: number;
}

export interface Category {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  sku: string;
  price: number;
  category_id: string | null;
  stock: number;
  image_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StoreMember {
  id: string;
  user_id: string;
  role: string;
  user_email: string;
  user_name: string;
  created_at?: string;
}

export interface MembershipRow {
  store_id: string;
  store_name: string;
  store_address: string | null;
  store_phone: string | null;
  store_logo_url?: string | null;
  store_tax_enabled?: boolean;
  store_tax_rate?: number;
  role: string;
}

export interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  created_at?: string;
  users: Record<string, string> | Record<string, string>[];
}

export interface Invite {
  id: string;
  code: string;
  role: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
  is_expired: boolean;
  is_full: boolean;
}
