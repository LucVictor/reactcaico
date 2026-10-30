import { API_URL } from "../../api";

/* ============================================================
   Tipos compartilhados — Recebimento (V2)
   Usados pela página operacional (/recebimento) e pela
   página administrativa (/admin/receipt).
============================================================ */

export type PhotoType = "dock" | "shelf";

export interface ReceiptPhoto {
  id: number;
  photo_type: PhotoType | string;
  filename: string;
  url: string;
  created_at?: string;
}

export interface ReceiptItem {
  id: number;
  receipt_id: number;
  product_code: string | null;
  is_new_product: boolean;
  product_name: string;
  quantity_system: number;
  quantity_physical: number;
  difference: number;
  received_quantity: number;
  invoice_photo: string | null;
  user_id: number;
  user_name: string;
  received_at: string;
  observations: string | null;
  dock_photos: ReceiptPhoto[];
  shelf_photos: ReceiptPhoto[];
}

export interface Receipt {
  id: number;
  user_id: number;
  user_name: string;
  quantity?: number;
  local: number;
  created_date: string;
  time_stamp?: string;
  completed: boolean;
  completed_at?: string | null;
  approved: boolean;
  photo?: string | null;
  observations?: string | null;
  items_count?: number;
  total_physical_quantity?: number;
  new_products_count?: number;
  items?: ReceiptItem[];
}

export interface ProductInfo {
  found: boolean;
  code: string;
  external_id: number | null;
  name: string;
  price: number | null;
  quantity_system: number;
  is_new_product: boolean;
  barcodes: string[];
}

export interface AdminReceiptSummary {
  total_receipts: number;
  completed_receipts: number;
  pending_receipts: number;
  approved_receipts: number;
  total_items_received: number;
  total_units_received: number;
  total_new_products: number;
  receipts_by_local: Record<string, number>;
}

export interface AdminNewProductItem {
  id: number;
  receipt_id: number;
  local: number;
  product_code: string | null;
  product_name: string;
  quantity_physical: number;
  received_quantity: number;
  invoice_photo: string | null;
  user_id: number;
  user_name: string;
  received_at: string;
  observations: string | null;
  dock_photos: ReceiptPhoto[];
  shelf_photos: ReceiptPhoto[];
}

export interface LocalOption {
  id: number;
  name: string;
}

export interface UserOption {
  id: number;
  name: string;
  username?: string;
}

/** Monta a URL absoluta de uma foto/arquivo servido pelo backend. */
export function photoUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (API_URL || "").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Formata quantidades sem casas decimais desnecessárias. */
export function formatQuantity(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

/** Extrai uma mensagem legível de erros do Axios/fetch. */
export function getApiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown; message?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
