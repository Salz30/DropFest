// ============================================================
// DropFest — Database Type Definitions
// Matches PRD v2.0 schema (7 tables + RPC return types)
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      brands: {
        Row: Brand
        Insert: BrandInsert
        Update: BrandUpdate
        Relationships: []
      }
      brand_owners: {
        Row: BrandOwner
        Insert: BrandOwnerInsert
        Update: Partial<BrandOwnerInsert>
        Relationships: []
      }
      products: {
        Row: Product
        Insert: ProductInsert
        Update: Partial<ProductInsert>
        Relationships: []
      }
      drops: {
        Row: Drop
        Insert: DropInsert
        Update: Partial<DropInsert>
        Relationships: []
      }
      orders: {
        Row: Order
        Insert: any
        Update: any
        Relationships: []
      }
      payment_proofs: {
        Row: PaymentProof
        Insert: any
        Update: any
        Relationships: []
      }
      waitlist: {
        Row: WaitlistEntry
        Insert: any
        Update: any
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_order: {
        Args: {
          p_drop_id: string
          p_buyer_name: string
          p_buyer_email: string
          p_buyer_phone: string
          p_shipping_address: string
          p_quantity: number
        }
        Returns: Json
      }
      submit_payment_proof: {
        Args: {
          p_order_id: string
          p_slot_token: string
          p_file_url: string
          p_sender_name: string
          p_bank_name: string
          p_amount: number
        }
        Returns: Json
      }
      get_order_by_id_and_email: {
        Args: {
          p_order_id: string
          p_email: string
        }
        Returns: Json
      }
      verify_payment: {
        Args: {
          p_order_id: string
          p_action: string
          p_rejection_reason?: string
        }
        Returns: Json
      }
      join_waitlist: {
        Args: {
          p_drop_id: string
          p_email: string
          p_name: string
        }
        Returns: Json
      }
      release_expired_slots: {
        Args: Record<string, never>
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================
// Table Row Types
// ============================================================

export interface Brand {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  instagram: string | null
  category?: string | null
  created_at: string
}

export interface BrandInsert {
  id?: string
  name: string
  slug: string
  description?: string | null
  logo_url?: string | null
  banner_url?: string | null
  instagram?: string | null
  category?: string | null
  created_at?: string
}

export type BrandUpdate = Partial<BrandInsert>

export interface BrandOwner {
  id: string
  user_id: string
  brand_id: string
  role: 'owner' | 'staff'
  created_at: string
}

export interface BrandOwnerInsert {
  id?: string
  user_id: string
  brand_id: string
  role?: 'owner' | 'staff'
  created_at?: string
}

export interface Product {
  id: string
  brand_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string | null
  created_at: string
}

export interface ProductInsert {
  id?: string
  brand_id: string
  name: string
  description?: string | null
  price: number
  image_url?: string | null
  category?: string | null
  created_at?: string
}

export type DropStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'

export interface Drop {
  id: string
  brand_id: string
  product_id: string
  title: string
  description: string | null
  banner_url: string | null
  total_slots: number
  reserved_count: number
  price: number
  starts_at: string
  ends_at: string | null
  status: DropStatus
  payment_info: string | null
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  created_at: string
}

export interface DropInsert {
  id?: string
  brand_id: string
  product_id: string
  title: string
  description?: string | null
  banner_url?: string | null
  total_slots: number
  reserved_count?: number
  price: number
  starts_at: string
  ends_at?: string | null
  status?: DropStatus
  payment_info?: string | null
  bank_name?: string | null
  account_number?: string | null
  account_holder?: string | null
  created_at?: string
}

export type OrderStatus =
  | 'pending_payment'
  | 'awaiting_verification'
  | 'paid'
  | 'rejected'
  | 'cancelled'

export interface Order {
  id: string
  drop_id: string
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  shipping_address: string
  quantity: number
  total_amount: number
  status: OrderStatus
  slot_token: string
  slot_expires_at: string | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
}

export type PaymentProofStatus = 'pending' | 'verified' | 'rejected'

export interface PaymentProof {
  id: string
  order_id: string
  file_url: string
  sender_name: string
  bank_name: string
  amount: number
  status: PaymentProofStatus
  rejection_reason: string | null
  uploaded_at: string
}

export interface WaitlistEntry {
  id: string
  drop_id: string
  email: string
  name: string
  joined_at: string
}

// ============================================================
// RPC Argument & Return Types
// ============================================================

export interface CreateOrderArgs {
  p_drop_id: string
  p_buyer_name: string
  p_buyer_email: string
  p_buyer_phone: string
  p_shipping_address: string
  p_quantity: number
}

export interface CreateOrderResult {
  success: boolean
  order_id?: string
  slot_token?: string
  message: string
}

export interface SubmitPaymentProofArgs {
  p_order_id: string
  p_slot_token: string
  p_file_url: string
  p_sender_name: string
  p_bank_name: string
  p_amount: number
}

export interface SubmitPaymentProofResult {
  success: boolean
  message: string
}

export interface OrderDetailResult {
  order_id: string
  drop_id: string
  drop_title: string
  brand_name: string
  buyer_name: string
  quantity: number
  total_amount: number
  status: OrderStatus
  slot_expires_at: string | null
  created_at: string
  payment_proof?: {
    file_url: string
    sender_name: string
    bank_name: string
    amount: number
    status: PaymentProofStatus
    rejection_reason: string | null
  } | null
}

// ============================================================
// UI / Computed Types
// ============================================================

export interface DropWithComputedStatus extends Drop {
  computed_status: DropStatus
  available_slots: number
  is_sold_out: boolean
}

export interface BrandWithStats extends Brand {
  drops_count: number
  active_drops: number
}
