import { useState } from "react";
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
} from "flowbite-react";

export interface ProdutoConferidoProps {
  id: number;
  product_name: string;
  product_code: number;
  quantity_real?: number | null;
  quantity_system?: number | null;
  diference?: number | null;
  cost_total?: number | null;
  created_date?: string;
  created_by?: string;
  // campos do work item
  work_conference_id?: number;
  active?: boolean;
}

export default function TabelaDinamica({
  produtos,
}: {
  produtos: ProdutoConferidoProps[];
}) {
  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 5;

  const indiceInicial = (pagina - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;

  const produtosPagina = produtos.slice(indiceInicial, indiceFinal);
  const totalPaginas = Math.max(1, Math.ceil(produtos.length / itensPorPagina));

  return (
    <div className="overflow-x-auto">
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
          {produtosPagina.map((p) => (
            <TableRow
              key={p.id}
              className="bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              <TableCell>
                {p.created_date
                  ? new Date(p.created_date).toLocaleDateString("pt-BR")
                  : "-"}
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
          ))}
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

      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Erro ao deletar");

      alert("Produto deletado!");
      setOpenModal(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao deletar o produto!");
    }
  };

  return (
    <div className="m-1 flex justify-end">
      <Button
        disabled
        color="red"
        size="xs"
        outline
        onClick={() => setOpenModal(true)}
      >
        Excluir
      </Button>
      <Modal show={openModal} onClose={handleClose}>
        <ModalHeader>Excluir</ModalHeader>
        <ModalBody>
          <p className="text-center text-white">
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
