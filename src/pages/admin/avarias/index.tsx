import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Card,
  Label,
  Pagination,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";
import api from "../../../api";
import {
  ApprovalActions,
  ApprovalBadge,
  RejectionNote,
  type ApprovalInfo,
  type ApprovalStatus,
} from "../../../components/Approval";

interface Avaria extends ApprovalInfo {
  id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  cost_total: number;
  damaged_date: string;
  created_by: string;
  local: number;
}

interface Local {
  id: number;
  name: string;
}

const formatarData = (data: string) =>
  data ? dayjs(data).format("DD/MM/YYYY") : "-";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

export default function AdminAvarias() {
  const [avarias, setAvarias] = useState<Avaria[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "">(
    "pending",
  );
  const [localFilter, setLocalFilter] = useState("");
  const [pagina, setPagina] = useState(1);

  const itensPorPagina = 10;

  useEffect(() => {
    api
      .get("/local/")
      .then((res) => setLocais(res.data))
      .catch((err) => console.error("Erro ao buscar filiais:", err));
  }, []);

  const fetchAvarias = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/damaged/admin/", {
        params: {
          ...(statusFilter ? { approval_status: statusFilter } : {}),
          ...(localFilter ? { local: Number(localFilter) } : {}),
        },
      });
      setAvarias(res.data);
    } catch (err) {
      console.error("Erro ao listar avarias (admin):", err);
      setAvarias([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, localFilter]);

  useEffect(() => {
    fetchAvarias();
  }, [fetchAvarias]);

  useEffect(() => {
    setPagina(1);
  }, [statusFilter, localFilter]);

  const decidir = async (
    id: number,
    approved: boolean,
    rejection_reason?: string,
  ) => {
    await api.patch(`/damaged/admin/${id}/approve`, {
      approved,
      rejection_reason: approved ? null : rejection_reason,
    });
    await fetchAvarias();
  };

  const totalPaginas = Math.max(1, Math.ceil(avarias.length / itensPorPagina));
  const indiceInicial = (pagina - 1) * itensPorPagina;
  const avariasPagina = avarias.slice(
    indiceInicial,
    indiceInicial + itensPorPagina,
  );

  const nomeLocal = (id: number) =>
    locais.find((l) => l.id === id)?.name ?? String(id);

  return (
    <div className="mx-auto max-w-7xl rounded-2xl p-2 sm:p-6 dark:bg-gray-800">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">
          Aprovação de Avarias
        </h1>
        <p className="text-sm text-gray-300">
          Aprove ou reprove as avarias cadastradas pelos operadores. Os pontos
          só são creditados após a aprovação.
        </p>
      </div>

      <Card className="shadow-md">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-xl">
          <div>
            <Label htmlFor="filtro-status">Situação</Label>
            <Select
              id="filtro-status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ApprovalStatus | "")
              }
            >
              <option value="">Todas</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovadas</option>
              <option value="rejected">Reprovadas</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-local">Filial</Label>
            <Select
              id="filtro-local"
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id} - {l.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner aria-label="Carregando avarias..." size="xl" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table hoverable className="min-w-[900px] text-center">
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Data</TableHeadCell>
                    <TableHeadCell>Código</TableHeadCell>
                    <TableHeadCell>Produto</TableHeadCell>
                    <TableHeadCell>Qtd.</TableHeadCell>
                    <TableHeadCell>Custo</TableHeadCell>
                    <TableHeadCell>Operador</TableHeadCell>
                    <TableHeadCell>Filial</TableHeadCell>
                    <TableHeadCell>Aprovação</TableHeadCell>
                    <TableHeadCell>Ações</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {avariasPagina.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-6 text-center">
                        Nenhuma avaria encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    avariasPagina.map((avaria) => (
                      <TableRow
                        key={avaria.id}
                        className="bg-white dark:border-gray-700 dark:bg-gray-800"
                      >
                        <TableCell>
                          {formatarData(avaria.damaged_date)}
                        </TableCell>
                        <TableCell>{avaria.product_code}</TableCell>
                        <TableCell className="max-w-[220px] overflow-hidden text-ellipsis">
                          {avaria.product_name}
                        </TableCell>
                        <TableCell>{avaria.quantity}</TableCell>
                        <TableCell>
                          {formatarMoeda(avaria.cost_total)}
                        </TableCell>
                        <TableCell>{avaria.created_by}</TableCell>
                        <TableCell>{nomeLocal(avaria.local)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <ApprovalBadge status={avaria.approval_status} />
                            <RejectionNote
                              item={avaria}
                              className="max-w-[200px]"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <ApprovalActions
                            onApprove={() => decidir(avaria.id, true)}
                            onReject={(reason) =>
                              decidir(avaria.id, false, reason)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPaginas > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination
                  currentPage={pagina}
                  totalPages={totalPaginas}
                  onPageChange={setPagina}
                  showIcons
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
