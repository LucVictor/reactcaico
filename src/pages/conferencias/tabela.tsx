import { useState, useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Modal,
  Button,
  ModalBody,
  ModalHeader,
  ModalFooter,
  TextInput,
  Label,
  Select,
} from "flowbite-react";
import api from "../../api"; // ✅ Importando o modelo de API
import {
  ApprovalStatusCell,
  type ApprovalInfo,
} from "../../components/Approval";

dayjs.locale("pt-br");

export interface ProdutoConferidoProps extends ApprovalInfo {
  id: number;
  product_name: string;
  product_code: string;
  quantity_real?: number | null;
  quantity_system?: number | null;
  diference?: number | null;
  cost_total?: number | null;
  date_?: string;
  created_by?: string;
  user_id?: number | null;
  work_conference_id?: number;
  active?: boolean;
}

export default function TabelaDinamica({
  produtos,
}: {
  produtos: ProdutoConferidoProps[];
}) {
  const [pagina, setPagina] = useState(1);
  const [filtroCodigo, setFiltroCodigo] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroDiferencaOperador, setFiltroDiferencaOperador] =
    useState<string>("");
  const [filtroDiferencaValor, setFiltroDiferencaValor] = useState<string>("");

  const itensPorPagina = 10;

  // Ordenar do mais recente para o mais antigo
  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort((a, b) => {
      if (!a.date_) return 1;
      if (!b.date_) return -1;
      return dayjs(b.date_).valueOf() - dayjs(a.date_).valueOf();
    });
  }, [produtos]);

  // Aplicar filtros
  const produtosFiltrados = useMemo(() => {
    return produtosOrdenados.filter((p) => {
      const codigoMatch = filtroCodigo
        ? p.product_code?.toString().includes(filtroCodigo)
        : true;
      const nomeMatch = filtroNome
        ? p.product_name?.toLowerCase().includes(filtroNome.toLowerCase())
        : true;

      // Filtro de diferença
      let diferencaMatch = true;
      if (filtroDiferencaOperador && filtroDiferencaValor) {
        const valor = parseFloat(filtroDiferencaValor);
        const diferenca = p.diference ?? 0;

        if (filtroDiferencaOperador === "maior" && !(diferenca > valor))
          diferencaMatch = false;
        if (filtroDiferencaOperador === "menor" && !(diferenca < valor))
          diferencaMatch = false;
        if (filtroDiferencaOperador === "igual" && diferenca !== valor)
          diferencaMatch = false;
      }

      return codigoMatch && nomeMatch && diferencaMatch;
    });
  }, [
    produtosOrdenados,
    filtroCodigo,
    filtroNome,
    filtroDiferencaOperador,
    filtroDiferencaValor,
  ]);

  // Paginação
  const indiceInicial = (pagina - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;
  const produtosPagina = produtosFiltrados.slice(indiceInicial, indiceFinal);
  const totalPaginas = Math.max(
    1,
    Math.ceil(produtosFiltrados.length / itensPorPagina),
  );

  // Resetar filtros
  const limparFiltros = () => {
    setFiltroCodigo("");
    setFiltroNome("");
    setFiltroDiferencaOperador("");
    setFiltroDiferencaValor("");
    setPagina(1);
  };

  return (
    <div className="w-full">
      {/* Filtros */}
      <div className="mb-4 rounded-xl bg-gray-50 p-4 shadow-sm dark:bg-gray-800">
        <h2 className="mb-3 text-lg font-semibold text-gray-700 dark:text-gray-200">
          Filtros
        </h2>
        <div className="flex flex-wrap gap-4">
          {/* Filtro por código */}
          <div className="flex min-w-[160px] flex-col">
            <Label htmlFor="codigo">Código</Label>
            <TextInput
              id="codigo"
              type="text"
              value={filtroCodigo}
              onChange={(e) => {
                setFiltroCodigo(e.target.value);
                setPagina(1);
              }}
              placeholder="Código do produto"
              className="mt-1"
            />
          </div>

          {/* Filtro por nome */}
          <div className="flex min-w-[220px] flex-1 flex-col">
            <Label htmlFor="nome">Produto</Label>
            <TextInput
              id="nome"
              type="text"
              value={filtroNome}
              onChange={(e) => {
                setFiltroNome(e.target.value);
                setPagina(1);
              }}
              placeholder="Nome do produto"
              className="mt-1"
            />
          </div>

          {/* Filtro por diferença */}
          <div className="flex min-w-[150px] flex-col">
            <Label htmlFor="operador">Diferença</Label>
            <Select
              id="operador"
              value={filtroDiferencaOperador}
              onChange={(e) => {
                setFiltroDiferencaOperador(e.target.value);
                setPagina(1);
              }}
              className="mt-1"
            >
              <option value="">Selecione</option>
              <option value="maior">Maior que</option>
              <option value="menor">Menor que</option>
              <option value="igual">Igual a</option>
            </Select>
          </div>

          <div className="flex w-[110px] flex-col">
            <Label htmlFor="valor">Valor</Label>
            <TextInput
              id="valor"
              type="number"
              value={filtroDiferencaValor}
              onChange={(e) => {
                setFiltroDiferencaValor(e.target.value);
                setPagina(1);
              }}
              placeholder="Ex: 5"
              className="mt-1"
            />
          </div>

          {/* Botão limpar */}
          <div className="flex items-end">
            <Button
              color="light"
              className="btn-outline-contrast"
              onClick={limparFiltros}
            >
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <Table hoverable className="min-w-[720px] text-center text-sm sm:min-w-full">
          <TableHead>
            <TableRow>
              <TableHeadCell className="whitespace-nowrap">Data</TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                Código
              </TableHeadCell>
              <TableHeadCell>Produto</TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                Qtd. Físico
              </TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                Qtd. Sistema
              </TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                Diferença
              </TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                Aprovação
              </TableHeadCell>
              <TableHeadCell>
                <span className="sr-only">Ações</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {produtosPagina.length > 0 ? (
              produtosPagina.map((p) => (
                <TableRow
                  key={p.id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="whitespace-nowrap">
                    {p.date_ ? dayjs(p.date_).format("DD/MM/YYYY") : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.product_code}
                  </TableCell>
                  <TableCell>
                    <div
                      className="mx-auto max-w-[240px] truncate text-left"
                      title={p.product_name}
                    >
                      {p.product_name}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.quantity_real ?? "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.quantity_system ?? "-"}
                  </TableCell>
                  <TableCell
                    className={`whitespace-nowrap font-semibold ${
                      (p.diference ?? 0) < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-700 dark:text-green-400"
                    }`}
                  >
                    {p.diference ?? "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <ApprovalStatusCell item={p} />
                  </TableCell>
                  <TableCell>
                    <BotaoExcluir produto={p} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-4 text-center">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="mt-4 flex justify-center">
        <Pagination
          currentPage={pagina}
          totalPages={totalPaginas}
          onPageChange={setPagina}
          showIcons
        />
      </div>
    </div>
  );
}

interface BotaoExcluirProps {
  produto: ProdutoConferidoProps;
}

function BotaoExcluir({ produto }: BotaoExcluirProps) {
  const [openModal, setOpenModal] = useState(false);

  const handleClose = () => setOpenModal(false);

  const excluirConferencia = async () => {
    try {
      const endpoint = produto.work_conference_id
        ? `/work_conference/items/${produto.id}`
        : `/conference/${produto.id}`;

      const res = await api.delete(endpoint); // ✅ usando api

      if (res.status !== 200 && res.status !== 204)
        throw new Error("Erro ao deletar");

      alert("Produto deletado!");
      setOpenModal(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao deletar o produto!");
    }
  };

  return (
    <div className="m-1 flex justify-end">
      <Button color="red" size="xs" outline onClick={() => setOpenModal(true)}>
        Excluir
      </Button>
      <Modal show={openModal} onClose={handleClose}>
        <ModalHeader>Excluir</ModalHeader>
        <ModalBody>
          <p className="text-center">
            Deseja excluir o produto "{produto.product_name}"?
          </p>
        </ModalBody>
        <ModalFooter className="flex justify-around">
          <Button size="sm" color="green" onClick={excluirConferencia}>
            Sim
          </Button>
          <Button color="red" size="sm" onClick={handleClose}>
            Não
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
