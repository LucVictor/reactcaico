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

dayjs.locale("pt-br");

export interface ProdutoConferidoProps {
  id: number;
  product_name: string;
  product_code: number;
  quantity_real?: number | null;
  quantity_system?: number | null;
  diference?: number | null;
  cost_total?: number | null;
  date_?: string;
  created_by?: string;
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

  const itensPorPagina = 5;

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
  };

  return (
    <div className="overflow-x-auto">
      {/* Filtros */}
      <div className="mb-6 rounded-xl bg-gray-50 p-4 shadow-sm dark:bg-gray-800">
        <h2 className="mb-3 text-lg font-semibold text-gray-700 dark:text-gray-200">
          Filtros
        </h2>
        <div className="flex flex-wrap gap-4">
          {/* Filtro por código */}
          <div className="flex min-w-[180px] flex-col">
            <Label htmlFor="codigo" />
            <TextInput
              id="codigo"
              type="text"
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
              placeholder="Código do produto"
              className="mt-1"
            />
          </div>

          {/* Filtro por nome */}
          <div className="flex min-w-[250px] flex-1 flex-col">
            <Label htmlFor="nome" />
            <TextInput
              id="nome"
              type="text"
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              placeholder="Nome do produto"
              className="mt-1"
            />
          </div>

          {/* Filtro por diferença */}
          <div className="flex min-w-[150px] flex-col">
            <Label htmlFor="operador" />
            <Select
              id="operador"
              value={filtroDiferencaOperador}
              onChange={(e) => setFiltroDiferencaOperador(e.target.value)}
              className="mt-1"
            >
              <option value="">Selecione</option>
              <option value="maior">Maior que</option>
              <option value="menor">Menor que</option>
              <option value="igual">Igual a</option>
            </Select>
          </div>

          <div className="flex min-w-[120px] flex-col">
            <Label htmlFor="valor" />
            <TextInput
              id="valor"
              type="number"
              value={filtroDiferencaValor}
              onChange={(e) => setFiltroDiferencaValor(e.target.value)}
              placeholder="Ex: 5"
              className="mt-1"
            />
          </div>

          {/* Botão limpar */}
          <div className="flex items-end">
            <Button color="gray" outline onClick={limparFiltros}>
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <Table hoverable={true} className="text-center">
        <TableHead>
          <TableRow>
            <TableHeadCell>Data</TableHeadCell>
            <TableHeadCell>Código</TableHeadCell>
            <TableHeadCell>Produto</TableHeadCell>
            <TableHeadCell>Qtd. Físico</TableHeadCell>
            <TableHeadCell>Qtd. Sistema</TableHeadCell>
            <TableHeadCell>Diferença</TableHeadCell>
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
                <TableCell>
                  {p.date_ ? dayjs(p.date_).format("DD/MM/YYYY") : "-"}
                </TableCell>
                <TableCell>{p.product_code}</TableCell>
                <TableCell>{p.product_name}</TableCell>
                <TableCell>{p.quantity_real ?? "-"}</TableCell>
                <TableCell>{p.quantity_system ?? "-"}</TableCell>
                <TableCell>{p.diference ?? "-"}</TableCell>
                <TableCell>
                  <BotaoExcluir produto={p} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="py-4 text-center">
                Nenhum produto encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

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
