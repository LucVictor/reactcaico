import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import {
  Alert,
  Badge,
  Button,
  Card,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Pagination,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
} from "flowbite-react";
import { saveAs } from "file-saver";
import { HiDownload, HiPrinter, HiRefresh } from "react-icons/hi";
import api from "../../../api";
import { useAuthStore } from "../../authStore";
import {
  ApprovalBadge,
  RejectionNote,
  type ApprovalInfo,
  type ApprovalStatus,
} from "../../../components/Approval";
import { getApiError, photoUrl } from "../../recebimento/types";

dayjs.locale("pt-br");

/* ============================================================
   Tipos
============================================================ */
interface Local {
  id: number;
  name: string;
}

interface CatalogItem {
  id: number;
  name: string;
}

interface Avaria extends ApprovalInfo {
  id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  cost: number;
  cost_total: number;
  damaged_date: string;
  created_date: string;
  shelflife_date: string;
  created_by: string;
  user_id?: number | null;
  type: number;
  origin: number;
  local: number;
}

interface DamagedPhoto {
  id: number;
  filename: string;
  url: string;
  created_at?: string;
}

interface Filtros {
  dataInicial: string;
  dataFinal: string;
  local: string;
  tipo: string;
  origem: string;
  status: ApprovalStatus | "";
  codigo: string;
}

/* ============================================================
   Constantes e helpers
============================================================ */
const ITENS_POR_PAGINA = 10;

const criarFiltrosPadrao = (): Filtros => ({
  dataInicial: dayjs().startOf("month").format("YYYY-MM-DD"),
  dataFinal: dayjs().format("YYYY-MM-DD"),
  local: "",
  tipo: "",
  origem: "",
  status: "",
  codigo: "",
});

const PERIODOS = [
  { label: "Hoje", dias: 0 },
  { label: "7 dias", dias: 6 },
  { label: "30 dias", dias: 29 },
  { label: "Mês atual", dias: -1 },
];

const formatarData = (valor?: string | null) =>
  valor ? dayjs(valor).format("DD/MM/YYYY") : "—";

const formatarMoeda = (valor?: number | string | null) => {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "—";
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const formatarQuantidade = (valor?: number | string | null) => {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "—";
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Reprovada",
};

/** Mantém o número "cru" (vírgula decimal) para o Excel somar as colunas. */
const numeroCsv = (valor?: number | string | null) => {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "";
  return String(numero).replace(".", ",");
};

const escapeHtml = (texto?: string | number | null) =>
  String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ============================================================
   Página
============================================================ */
export default function AdminAvarias() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.admin === 1;

  const [filtros, setFiltros] = useState<Filtros>(criarFiltrosPadrao);
  const [aplicados, setAplicados] = useState<Filtros>(criarFiltrosPadrao);

  const [locais, setLocais] = useState<Local[]>([]);
  const [tipos, setTipos] = useState<CatalogItem[]>([]);
  const [origens, setOrigens] = useState<CatalogItem[]>([]);

  const [avarias, setAvarias] = useState<Avaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const [photosByDamage, setPhotosByDamage] = useState<
    Record<number, DamagedPhoto[]>
  >({});
  const [photosLoading, setPhotosLoading] = useState<Record<number, boolean>>(
    {},
  );
  const loadedPhotosRef = useRef<Set<number>>(new Set());

  const [fotoModal, setFotoModal] = useState<{
    open: boolean;
    avaria: Avaria | null;
  }>({ open: false, avaria: null });

  /* ============================================================
     Cadastros auxiliares
  ============================================================ */
  useEffect(() => {
    if (!isAdmin) return;

    api
      .get<Local[]>("/local/")
      .then((res) => setLocais(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Erro ao carregar filiais:", err));

    api
      .get<CatalogItem[]>("/damaged/type/")
      .then((res) => setTipos(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Erro ao carregar tipos:", err));

    api
      .get<CatalogItem[]>("/damaged/origin/")
      .then((res) => setOrigens(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Erro ao carregar origens:", err));
  }, [isAdmin]);

  /* ============================================================
     Listagem
  ============================================================ */
  const buscar = useCallback(async () => {
    if (!isAdmin) return;
    setCarregando(true);
    setErro(null);
    try {
      const params: Record<string, string | number> = {
        date1: aplicados.dataInicial,
        date2: aplicados.dataFinal,
      };
      if (aplicados.local) params.local = Number(aplicados.local);
      if (aplicados.tipo) params.type = Number(aplicados.tipo);
      if (aplicados.origem) params.origin = Number(aplicados.origem);
      if (aplicados.status) params.approval_status = aplicados.status;
      if (aplicados.codigo.trim())
        params.product_code = aplicados.codigo.trim();

      const res = await api.get<Avaria[]>("/damaged/admin/", { params });
      setAvarias(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setAvarias([]);
      setErro(getApiError(err, "Não foi possível carregar as avarias."));
    } finally {
      setCarregando(false);
    }
  }, [isAdmin, aplicados]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  useEffect(() => {
    setPagina(1);
  }, [aplicados]);

  /* ============================================================
     Fotos
  ============================================================ */
  const carregarFotos = useCallback(async (ids: number[]) => {
    const faltantes = ids.filter((id) => !loadedPhotosRef.current.has(id));
    if (faltantes.length === 0) return;

    faltantes.forEach((id) => loadedPhotosRef.current.add(id));
    setPhotosLoading((prev) => {
      const next = { ...prev };
      faltantes.forEach((id) => {
        next[id] = true;
      });
      return next;
    });

    const resultados = await Promise.all(
      faltantes.map(async (id) => {
        try {
          const res = await api.get<{ photos?: DamagedPhoto[] } | DamagedPhoto[]>(
            `/damaged/photo/${id}`,
          );
          const data = res.data;
          const photos = Array.isArray(data) ? data : (data?.photos ?? []);
          return { id, photos };
        } catch (err) {
          console.error(`Erro ao buscar fotos da avaria #${id}:`, err);
          return { id, photos: [] as DamagedPhoto[] };
        }
      }),
    );

    setPhotosByDamage((prev) => {
      const next = { ...prev };
      resultados.forEach(({ id, photos }) => {
        next[id] = photos;
      });
      return next;
    });

    setPhotosLoading((prev) => {
      const next = { ...prev };
      faltantes.forEach((id) => {
        delete next[id];
      });
      return next;
    });
  }, []);

  const totalPaginas = Math.max(
    1,
    Math.ceil(avarias.length / ITENS_POR_PAGINA),
  );

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const avariasPagina = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;
    return avarias.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [avarias, pagina]);

  useEffect(() => {
    carregarFotos(avariasPagina.map((avaria) => avaria.id));
  }, [avariasPagina, carregarFotos]);

  const abrirFotos = (avaria: Avaria) => {
    setFotoModal({ open: true, avaria });
    carregarFotos([avaria.id]);
  };

  /* ============================================================
     Derivados
  ============================================================ */
  const resumo = useMemo(
    () =>
      avarias.reduce(
        (acc, avaria) => {
          acc.total += 1;
          acc.quantidade += Number(avaria.quantity) || 0;
          acc.custo += Number(avaria.cost_total) || 0;
          if (avaria.approval_status === "pending") acc.pendentes += 1;
          if (avaria.approval_status === "approved") acc.aprovadas += 1;
          return acc;
        },
        { total: 0, quantidade: 0, custo: 0, pendentes: 0, aprovadas: 0 },
      ),
    [avarias],
  );

  const nomeFilial = (id: number) =>
    locais.find((local) => local.id === id)?.name ?? String(id);

  const nomeTipo = (id: number) =>
    tipos.find((tipo) => tipo.id === id)?.name ?? "—";

  const nomeOrigem = (id: number) =>
    origens.find((origem) => origem.id === id)?.name ?? "—";

  const aplicarPeriodo = (dias: number) => {
    const proximos: Filtros =
      dias === -1
        ? {
            ...filtros,
            dataInicial: dayjs().startOf("month").format("YYYY-MM-DD"),
            dataFinal: dayjs().format("YYYY-MM-DD"),
          }
        : {
            ...filtros,
            dataInicial: dayjs().subtract(dias, "day").format("YYYY-MM-DD"),
            dataFinal: dayjs().format("YYYY-MM-DD"),
          };
    setFiltros(proximos);
    setAplicados(proximos);
  };

  const periodoAtivo = (dias: number) => {
    const inicial =
      dias === -1
        ? dayjs().startOf("month").format("YYYY-MM-DD")
        : dayjs().subtract(dias, "day").format("YYYY-MM-DD");
    return (
      aplicados.dataInicial === inicial &&
      aplicados.dataFinal === dayjs().format("YYYY-MM-DD")
    );
  };

  const aplicarFiltros = () => {
    setAplicados({ ...filtros });
  };

  const limparFiltros = () => {
    const padrao = criarFiltrosPadrao();
    setFiltros(padrao);
    setAplicados(padrao);
  };

  const atualizar = () => {
    loadedPhotosRef.current.clear();
    setPhotosByDamage({});
    setPhotosLoading({});
    buscar();
  };

  /* ============================================================
     Exportação (CSV e impressão)
  ============================================================ */
  const descreverFiltros = () => ({
    periodo: `${formatarData(aplicados.dataInicial)} a ${formatarData(
      aplicados.dataFinal,
    )}`,
    filial: aplicados.local
      ? `${aplicados.local} - ${nomeFilial(Number(aplicados.local))}`
      : "Todas",
    tipo: aplicados.tipo ? nomeTipo(Number(aplicados.tipo)) : "Todos",
    origem: aplicados.origem
      ? nomeOrigem(Number(aplicados.origem))
      : "Todas",
    situacao: aplicados.status ? STATUS_LABEL[aplicados.status] : "Todas",
    codigo: aplicados.codigo.trim() || "Todos",
  });

  const situacaoDaAvaria = (avaria: Avaria) =>
    avaria.approval_status ? STATUS_LABEL[avaria.approval_status] : "—";

  const exportarCsv = () => {
    const { periodo, filial, tipo, origem, situacao, codigo } =
      descreverFiltros();

    const escapeCsv = (valor?: string | number | null) => {
      const texto = String(valor ?? "");
      return /[";\n\r]/.test(texto)
        ? `"${texto.replace(/"/g, '""')}"`
        : texto;
    };

    const linhas: string[] = [
      "Relatório de Avarias",
      `Período: ${periodo}`,
      `Filial: ${filial}`,
      `Tipo: ${tipo}`,
      `Origem: ${origem}`,
      `Situação: ${situacao}`,
      `Código do produto: ${codigo}`,
      `Gerado em: ${dayjs().format("DD/MM/YYYY HH:mm")}`,
      "",
      `Total de avarias;${resumo.total}`,
      `Quantidade total;${numeroCsv(resumo.quantidade)}`,
      `Custo total;${numeroCsv(resumo.custo)}`,
      `Pendentes;${resumo.pendentes}`,
      `Aprovadas;${resumo.aprovadas}`,
      "",
      [
        "Data",
        "Código",
        "Produto",
        "Quantidade",
        "Custo total",
        "Tipo",
        "Origem",
        "Filial",
        "Operador",
        "Situação",
      ]
        .map(escapeCsv)
        .join(";"),
    ];

    avarias.forEach((avaria) => {
      linhas.push(
        [
          formatarData(avaria.damaged_date),
          avaria.product_code,
          avaria.product_name,
          numeroCsv(avaria.quantity),
          numeroCsv(avaria.cost_total),
          nomeTipo(avaria.type),
          nomeOrigem(avaria.origin),
          nomeFilial(avaria.local),
          avaria.created_by,
          situacaoDaAvaria(avaria),
        ]
          .map(escapeCsv)
          .join(";"),
      );
    });

    const csv = "\uFEFF" + linhas.join("\r\n");
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `relatorio_avarias_${aplicados.dataInicial}_${aplicados.dataFinal}.csv`,
    );
  };

  const imprimirRelatorio = () => {
    const janela = window.open("", "_blank");
    if (!janela) {
      setErro(
        "Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.",
      );
      return;
    }

    const { periodo, filial, tipo, origem, situacao, codigo } =
      descreverFiltros();

    const linhasHtml = avarias
      .map(
        (avaria, indice) => `<tr>
          <td>${indice + 1}</td>
          <td>${escapeHtml(formatarData(avaria.damaged_date))}</td>
          <td>${escapeHtml(avaria.product_code)}</td>
          <td class="prod">${escapeHtml(avaria.product_name)}</td>
          <td>${escapeHtml(formatarQuantidade(avaria.quantity))}</td>
          <td>${escapeHtml(formatarMoeda(avaria.cost_total))}</td>
          <td>${escapeHtml(nomeTipo(avaria.type))}</td>
          <td>${escapeHtml(nomeOrigem(avaria.origin))}</td>
          <td>${escapeHtml(nomeFilial(avaria.local))}</td>
          <td>${escapeHtml(avaria.created_by)}</td>
          <td>${escapeHtml(situacaoDaAvaria(avaria))}</td>
        </tr>`,
      )
      .join("");

    janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório de Avarias</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 0; }
  .sheet { max-width: 277mm; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #333; margin-bottom: 10px; }
  .meta strong { color: #000; }
  .totais { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
  .totais div { border: 1px solid #999; border-radius: 4px; padding: 6px 10px; font-size: 11px; }
  .totais span { display: block; font-size: 10px; color: #444; text-transform: uppercase; }
  .totais strong { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #999; padding: 4px 3px; text-align: center; }
  th { background: #eee; font-weight: bold; }
  td.prod { text-align: left; }
  tr:nth-child(even) td { background: #f7f7f7; }
  .footer { margin-top: 10px; font-size: 10px; color: #333; display: flex; justify-content: space-between; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <h1>Relatório de Avarias</h1>
    <div class="meta">
      <strong>Período:</strong> ${escapeHtml(periodo)} &nbsp;•&nbsp;
      <strong>Filial:</strong> ${escapeHtml(filial)} &nbsp;•&nbsp;
      <strong>Tipo:</strong> ${escapeHtml(tipo)} &nbsp;•&nbsp;
      <strong>Origem:</strong> ${escapeHtml(origem)} &nbsp;•&nbsp;
      <strong>Situação:</strong> ${escapeHtml(situacao)} &nbsp;•&nbsp;
      <strong>Código do produto:</strong> ${escapeHtml(codigo)}
    </div>
    <div class="totais">
      <div><span>Avarias</span><strong>${resumo.total}</strong></div>
      <div><span>Quantidade</span><strong>${escapeHtml(formatarQuantidade(resumo.quantidade))}</strong></div>
      <div><span>Custo total</span><strong>${escapeHtml(formatarMoeda(resumo.custo))}</strong></div>
      <div><span>Pendentes</span><strong>${resumo.pendentes}</strong></div>
      <div><span>Aprovadas</span><strong>${resumo.aprovadas}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:26px">#</th>
        <th style="width:62px">Data</th>
        <th style="width:60px">Código</th>
        <th>Produto</th>
        <th style="width:62px">Qtd.</th>
        <th style="width:70px">Custo</th>
        <th style="width:80px">Tipo</th>
        <th style="width:80px">Origem</th>
        <th style="width:90px">Filial</th>
        <th style="width:90px">Operador</th>
        <th style="width:65px">Situação</th>
      </tr></thead>
      <tbody>${linhasHtml}</tbody>
    </table>
    <div class="footer">
      <span>Documento gerado pelo sistema de conferência.</span>
      <span>Gerado em ${escapeHtml(dayjs().format("DD/MM/YYYY HH:mm"))} • ${avarias.length} linha(s)</span>
    </div>
  </div>
  <script>window.onload = function(){ window.focus(); window.print(); }<\/script>
</body>
</html>`);
    janela.document.close();
    janela.focus();
  };

  const fotosModal = fotoModal.avaria
    ? (photosByDamage[fotoModal.avaria.id] ?? [])
    : [];
  const carregandoFotosModal = fotoModal.avaria
    ? !!photosLoading[fotoModal.avaria.id]
    : false;

  /* ============================================================
     Guarda de acesso
  ============================================================ */
  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-lg text-white">Acesso restrito a administradores.</p>
      </div>
    );
  }

  /* ============================================================
     Render
  ============================================================ */
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-gray-600 bg-gray-800 p-4 shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Relatório de Avarias
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-300">
              Consulte as avarias de todas as filiais, com filtros, totais e as
              fotos registradas por cada operador.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button color="gray" onClick={atualizar} disabled={carregando}>
              <HiRefresh className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button
              color="green"
              onClick={exportarCsv}
              disabled={carregando || avarias.length === 0}
            >
              <HiDownload className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button
              color="blue"
              onClick={imprimirRelatorio}
              disabled={carregando || avarias.length === 0}
            >
              <HiPrinter className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="shadow-md">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div>
            <Label htmlFor="data-inicial">Data inicial</Label>
            <TextInput
              id="data-inicial"
              type="date"
              value={filtros.dataInicial}
              max={filtros.dataFinal || undefined}
              onChange={(e) =>
                setFiltros((prev) => ({
                  ...prev,
                  dataInicial: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="data-final">Data final</Label>
            <TextInput
              id="data-final"
              type="date"
              value={filtros.dataFinal}
              min={filtros.dataInicial || undefined}
              onChange={(e) =>
                setFiltros((prev) => ({ ...prev, dataFinal: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="filtro-filial">Filial</Label>
            <Select
              id="filtro-filial"
              value={filtros.local}
              onChange={(e) =>
                setFiltros((prev) => ({ ...prev, local: e.target.value }))
              }
            >
              <option value="">Todas</option>
              {locais.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.id} - {local.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-tipo">Tipo</Label>
            <Select
              id="filtro-tipo"
              value={filtros.tipo}
              onChange={(e) =>
                setFiltros((prev) => ({ ...prev, tipo: e.target.value }))
              }
            >
              <option value="">Todos</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-origem">Origem</Label>
            <Select
              id="filtro-origem"
              value={filtros.origem}
              onChange={(e) =>
                setFiltros((prev) => ({ ...prev, origem: e.target.value }))
              }
            >
              <option value="">Todas</option>
              {origens.map((origem) => (
                <option key={origem.id} value={origem.id}>
                  {origem.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-situacao">Situação</Label>
            <Select
              id="filtro-situacao"
              value={filtros.status}
              onChange={(e) =>
                setFiltros((prev) => ({
                  ...prev,
                  status: e.target.value as ApprovalStatus | "",
                }))
              }
            >
              <option value="">Todas</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovadas</option>
              <option value="rejected">Reprovadas</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-codigo">Código do produto</Label>
            <TextInput
              id="filtro-codigo"
              placeholder="Ex.: 12414"
              value={filtros.codigo}
              onChange={(e) =>
                setFiltros((prev) => ({ ...prev, codigo: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300">
              Período:
            </span>
            {PERIODOS.map((periodo) => {
              const ativo = periodoAtivo(periodo.dias);
              return (
                <button
                  key={periodo.label}
                  type="button"
                  onClick={() => aplicarPeriodo(periodo.dias)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    ativo
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-gray-400 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  }`}
                >
                  {periodo.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button color="blue" onClick={aplicarFiltros} disabled={carregando}>
              Aplicar filtros
            </Button>
            <Button color="gray" onClick={limparFiltros} disabled={carregando}>
              Limpar
            </Button>
          </div>
        </div>
      </Card>

      {erro && (
        <Alert color="failure" onDismiss={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="text-center">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
            Avarias
          </p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">
            {resumo.total}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
            Quantidade
          </p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">
            {formatarQuantidade(resumo.quantidade)}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
            Custo total
          </p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">
            {formatarMoeda(resumo.custo)}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
            Pendentes
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {resumo.pendentes}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
            Aprovadas
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {resumo.aprovadas}
          </p>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="shadow-md">
        {carregando ? (
          <div className="flex justify-center py-12">
            <Spinner size="xl" />
          </div>
        ) : avarias.length === 0 ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-300">
            Nenhuma avaria encontrada para os filtros aplicados.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table hoverable className="text-center">
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Foto</TableHeadCell>
                    <TableHeadCell>Data</TableHeadCell>
                    <TableHeadCell>Produto</TableHeadCell>
                    <TableHeadCell>Qtd.</TableHeadCell>
                    <TableHeadCell>Custo</TableHeadCell>
                    <TableHeadCell>Tipo</TableHeadCell>
                    <TableHeadCell>Origem</TableHeadCell>
                    <TableHeadCell>Filial</TableHeadCell>
                    <TableHeadCell>Operador</TableHeadCell>
                    <TableHeadCell>Aprovação</TableHeadCell>
                    <TableHeadCell>Ações</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody className="divide-y">
                  {avariasPagina.map((avaria) => {
                    const fotos = photosByDamage[avaria.id];
                    const carregandoFoto = photosLoading[avaria.id];
                    const primeiraFoto = fotos?.find((foto) =>
                      photoUrl(foto.url),
                    );
                    const primeiraUrl = primeiraFoto
                      ? photoUrl(primeiraFoto.url)
                      : null;

                    return (
                      <TableRow
                        key={avaria.id}
                        className="bg-white dark:border-gray-700 dark:bg-gray-800"
                      >
                        <TableCell className="py-2">
                          {carregandoFoto ? (
                            <div className="flex justify-center">
                              <Spinner size="sm" />
                            </div>
                          ) : primeiraUrl ? (
                            <button
                              type="button"
                              onClick={() => abrirFotos(avaria)}
                              title="Ver fotos da avaria"
                              className="relative mx-auto block h-12 w-12 overflow-hidden rounded-lg ring-1 ring-gray-300 transition hover:ring-blue-500 dark:ring-gray-600"
                            >
                              <img
                                src={primeiraUrl}
                                alt={`Foto da avaria #${avaria.id}`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                              {(fotos?.length ?? 0) > 1 && (
                                <span className="absolute right-0 bottom-0 rounded-tl-md bg-black/70 px-1 text-[10px] font-semibold text-white">
                                  +{(fotos?.length ?? 1) - 1}
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Sem foto
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatarData(avaria.damaged_date)}
                        </TableCell>
                        <TableCell>
                          <div
                            className="w-[170px] truncate text-left sm:w-[210px]"
                            title={`${avaria.product_code} - ${avaria.product_name}`}
                          >
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                              {avaria.product_code}
                            </span>
                            <span className="block truncate">
                              {avaria.product_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatarQuantidade(avaria.quantity)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatarMoeda(avaria.cost_total)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {nomeTipo(avaria.type)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {nomeOrigem(avaria.origin)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {nomeFilial(avaria.local)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {avaria.created_by}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <ApprovalBadge
                              status={avaria.approval_status}
                            />
                            <RejectionNote
                              item={avaria}
                              className="max-w-[180px]"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Button
                              size="xs"
                              color="blue"
                              outline
                              onClick={() => abrirFotos(avaria)}
                            >
                              Fotos
                              {fotos && fotos.length > 0
                                ? ` (${fotos.length})`
                                : ""}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Badge color="blue" className="w-fit">
                {avarias.length} avaria(s)
              </Badge>
              {totalPaginas > 1 && (
                <Pagination
                  currentPage={pagina}
                  totalPages={totalPaginas}
                  onPageChange={setPagina}
                  showIcons
                />
              )}
            </div>
          </>
        )}
      </Card>

      {/* Modal de fotos */}
      <Modal
        show={fotoModal.open}
        onClose={() => setFotoModal({ open: false, avaria: null })}
        size="4xl"
      >
        <ModalHeader>
          Fotos da Avaria
          {fotoModal.avaria && (
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-300">
              #{fotoModal.avaria.id}
            </span>
          )}
        </ModalHeader>
        <ModalBody>
          {fotoModal.avaria && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-left dark:border-gray-700 dark:bg-gray-800/60">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {fotoModal.avaria.product_code} —{" "}
                    {fotoModal.avaria.product_name}
                  </span>
                  <Badge color="blue">
                    {formatarQuantidade(fotoModal.avaria.quantity)} un.
                  </Badge>
                  <Badge color="gray">
                    {nomeFilial(fotoModal.avaria.local)}
                  </Badge>
                  <Badge color="gray">
                    {formatarData(fotoModal.avaria.damaged_date)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  Operador: {fotoModal.avaria.created_by} · Tipo:{" "}
                  {nomeTipo(fotoModal.avaria.type)} · Origem:{" "}
                  {nomeOrigem(fotoModal.avaria.origin)}
                </p>
              </div>

              {carregandoFotosModal ? (
                <div className="flex justify-center py-8">
                  <Spinner size="xl" />
                </div>
              ) : fotosModal.length === 0 ? (
                <p className="py-6 text-center text-gray-600 dark:text-gray-300">
                  Nenhuma foto cadastrada para esta avaria.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {fotosModal.map((foto) => {
                    const url = photoUrl(foto.url);
                    if (!url) return null;
                    return (
                      <a
                        key={foto.id}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group block overflow-hidden rounded-lg ring-1 ring-gray-300 transition hover:ring-blue-500 dark:ring-gray-600"
                      >
                        <img
                          src={url}
                          alt={foto.filename}
                          loading="lazy"
                          className="h-40 w-full object-cover transition group-hover:scale-105 sm:h-48"
                        />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            onClick={() => setFotoModal({ open: false, avaria: null })}
          >
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
