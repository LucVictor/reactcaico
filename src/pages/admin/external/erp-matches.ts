import api from "../../../api";

export type ErpRecordType = "conference" | "damaged" | "task_item";

/**
 * Linha retornada por `GET /external/erp/json/matches`.
 *
 * `quantity` e `cost_unit` chegam como string para preservar a precisão
 * decimal; converta com `Number(...)` antes de formatar.
 */
export interface ErpMatchRow {
  match_id: number;
  record_id: number;
  record_type: ErpRecordType;
  match_type: "ajuste" | "avaria";
  product_code: string;
  product_name: string;
  num_mov: string;
  dt_mov: string | null;
  quantity: string | null;
  cost_unit: string | null;
  cod_filial: string | null;
  erp_local: string | null;
  match_date: string | null;
}

/** Busca os cruzamentos ERP já calculados para um registro. */
export async function fetchErpMatches(
  recordType: ErpRecordType,
  recordId: number,
): Promise<ErpMatchRow[]> {
  const res = await api.get("/external/erp/json/matches", {
    params: { record_type: recordType, record_id: recordId },
  });
  return Array.isArray(res.data) ? (res.data as ErpMatchRow[]) : [];
}
