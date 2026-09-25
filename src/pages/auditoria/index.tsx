import { useState } from "react";
import api from "../../api";
import dayjs from "dayjs";

export interface ProdutoConferidoProps {
  id: number;
  product_name: string;
  product_code: string;
  quantity_real: number;
  quantity_system: number;
  diference: number;
  cost_total: number;
  created_date: string;
  created_by: string;
  date_: string;
}

export default function Auditoria() {
  const [codigo, setCodigo] = useState("");
  const [produto, setProduto] = useState<ProdutoConferidoProps[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function buscarProduto() {
    if (!codigo) return;

    setLoading(true);
    try {
      const response = await api.get(`/audit/?code_product=${codigo}`);
      setProduto(response.data ?? null);
    } catch (err) {
      console.error(err);
      setProduto(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="m-auto flex w-3/4 flex-col items-center gap-6 rounded-2xl bg-gray-700 p-8 text-white shadow-xl dark:bg-gray-700">
      <h1 className="text-2xl font-bold tracking-wide">Auditoria de Produto</h1>

      {/* área de busca */}
      <div className="flex w-full max-w-lg gap-3">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Código do produto"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="w-full rounded-lg border border-gray-500 bg-gray-800 p-3 transition focus:border-blue-400 focus:ring focus:ring-blue-500/40"
        />
        <button
          disabled={loading}
          onClick={buscarProduto}
          className="rounded-lg bg-blue-600 px-5 py-2 font-bold transition hover:bg-blue-500 active:scale-95 disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {/* listagem */}
      {produto && produto.length > 0 && (
        <div className="mt-3 grid max-h-[70vh] w-full grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2 lg:grid-cols-3">
          {produto.map((p) => (
            <div
              key={p.id}
              className="hover:bg-gray-750 flex h-52 flex-col justify-between rounded-xl border border-gray-600 bg-gray-800 p-4 shadow transition"
            >
              <div>
                <h2 className="mb-1 truncate text-sm font-semibold">
                  {p.product_name}
                </h2>
                <p className="mb-2 text-xs text-gray-300">
                  Código: {p.product_code}
                </p>

                {/* grid de infos */}
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <p>
                    <strong>Data:</strong> <br />
                    {dayjs(p.created_date).format("DD/MM/YYYY")}
                  </p>
                  <p>
                    <strong>Por:</strong> <br /> {p.created_by}
                  </p>

                  <p>
                    <strong>Sistema:</strong> <br /> {p.quantity_system}
                  </p>
                  <p>
                    <strong>Real:</strong> <br /> {p.quantity_real}
                  </p>
                </div>
              </div>

              {/* diferença destacada */}
              <div>
                <span
                  className={`inline-block rounded-lg px-3 py-1 text-center text-sm font-bold ${
                    p.diference > 0
                      ? "bg-green-600"
                      : p.diference < 0
                        ? "bg-red-600"
                        : "bg-gray-600"
                  }`}
                >
                  Diferença: {p.diference}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* caso não ache nada */}
      {produto?.length === 0 && codigo && !loading && (
        <p className="mt-3 text-red-400">Nenhuma conferência encontrada 🙁</p>
      )}
    </div>
  );
}
