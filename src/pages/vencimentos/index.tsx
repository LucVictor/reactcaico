import React, { ReactNode, useEffect, useCallback, useState } from "react";
import { CadastrarVencimento } from "./cadastrar";
import { EditarVencimento } from "./editar";
import api from "../../api";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { useLocalDeEstoque } from "../localEstoque";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "flowbite-react";
import { useNavigate } from "react-router-dom";

// Configura Day.js para pt-br
dayjs.locale("pt-br");

export interface ProdutoVencimento {
  product_code: string;
  product_name: string;
  quantity: number;
  shelflife_date: string;
  created_by: string;
  created_date: string;
  id: number;
  last_mod: string;
  local: number;
  diasRestantes?: number;
}

function TableComponent() {
  const [produtos, setProdutos] = useState<ProdutoVencimento[]>([]);
  const { idLocal } = useLocalDeEstoque();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const calcularDiasRestantes = useCallback((validade: string): number => {
    const hoje = dayjs().startOf("day");
    const validadeNormalizada = dayjs(validade).startOf("day");
    return Math.ceil(validadeNormalizada.diff(hoje, "day", true));
  }, []);

  const buscarVencimentos = useCallback(async () => {
    setIsLoading(true);
    try {
      const getFetch = await api.get("/shelflife/");
      const dadosVencimentos: ProdutoVencimento[] = getFetch.data;

      const dadosProcessados = dadosVencimentos
        .filter((e) => e.local === idLocal)
        .sort(
          (a, b) =>
            dayjs(a.shelflife_date).valueOf() -
            dayjs(b.shelflife_date).valueOf(),
        )
        .map((item) => ({
          ...item,
          diasRestantes: calcularDiasRestantes(item.shelflife_date),
        }));

      setProdutos(dadosProcessados);
    } catch (err) {
      console.error("Erro ao buscar vencimentos:", err);
      setProdutos([]);
    } finally {
      setIsLoading(false);
    }
  }, [idLocal, calcularDiasRestantes]);

  useEffect(() => {
    buscarVencimentos();
  }, [buscarVencimentos]);

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="xl" aria-label="Loading..." />
        </div>
      ) : (
        <div className="flex w-full flex-col items-center justify-start gap-4 p-4">
          {/* Título */}
          <div className="w-fit rounded-2xl p-2 text-center font-extrabold text-white dark:bg-gray-700">
            <h1>Vencimentos</h1>
          </div>

          {/* Opções */}
          <div className="flex w-full justify-end">
            <div className="mb-4 w-fit flex-col rounded-2xl bg-gray-700 p-2 text-center text-white">
              <h4>Opções:</h4>
              <div className="flex flex-wrap items-center gap-4 p-1 text-white dark:bg-gray-700">
                <Button
                  onClick={() => navigate("/vencimentos/visualizar")}
                  size="sm"
                >
                  Impressão/Compartilhar
                </Button>
                <BotaoCadastrar onAtualizar={buscarVencimentos} />
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="w-full max-w-6xl rounded-lg border border-gray-600 shadow-sm">
            <Table className="min-w-full text-center opacity-95">
              <TableHead>
                <TableRow>
                  <TableHeadCell>Código</TableHeadCell>
                  <TableHeadCell>Produto</TableHeadCell>
                  <TableHeadCell>Quantidade</TableHeadCell>
                  <TableHeadCell>Dias</TableHeadCell>
                  <TableHeadCell>Validade</TableHeadCell>
                  <TableHeadCell>Atualização</TableHeadCell>
                  <TableHeadCell>
                    <span className="sr-only">Edit</span>
                  </TableHeadCell>
                </TableRow>
              </TableHead>

              <TableBody className="divide-y">
                {produtos.map((produto) => (
                  <TableRow
                    key={produto.id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                      {produto.product_code}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                      {produto.product_name}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                      {produto.quantity}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                      {produto.diasRestantes}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                      {dayjs(produto.shelflife_date).format("DD/MM/YYYY")}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                      {dayjs(produto.last_mod).format("DD/MM/YYYY")}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                      <div className="flex flex-col justify-center gap-1 sm:flex-row">
                        <BotaoEditar
                          produto={produto}
                          onAtualizar={buscarVencimentos}
                        />
                        <BotaoExcluir
                          produto={produto}
                          onAtualizar={buscarVencimentos}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}

/* --- Botões e Modais --- */

interface BotaoCadastrarProps {
  onAtualizar: () => void;
}

function BotaoCadastrar({ onAtualizar }: BotaoCadastrarProps) {
  const [openModal, setOpenModal] = useState(false);

  const handleClose = () => {
    setOpenModal(false);
    onAtualizar();
  };

  return (
    <div className="flex justify-center">
      <Button color="green" size="sm" onClick={() => setOpenModal(true)}>
        Cadastrar
      </Button>
      <Modal show={openModal} onClose={handleClose}>
        <ModalHeader>Cadastrar Vencimento</ModalHeader>
        <ModalBody>
          <CadastrarVencimento onSucesso={handleClose} />
        </ModalBody>
      </Modal>
    </div>
  );
}

interface BotaoEditarProps {
  produto: ProdutoVencimento;
  onAtualizar: () => void;
}

function BotaoEditar({ produto, onAtualizar }: BotaoEditarProps) {
  const [openModal, setOpenModal] = useState(false);

  const handleClose = () => {
    setOpenModal(false);
    onAtualizar();
  };

  return (
    <div>
      <Button outline size="xs" onClick={() => setOpenModal(true)}>
        Editar
      </Button>
      <Modal show={openModal} onClose={handleClose}>
        <ModalHeader>Editar Vencimento</ModalHeader>
        <ModalBody>
          <EditarVencimento
            produtoSelecionado={produto}
            onSucesso={handleClose}
          />
        </ModalBody>
      </Modal>
    </div>
  );
}

interface BotaoExcluirProps {
  produto: ProdutoVencimento;
  onAtualizar: () => void;
}

function BotaoExcluir({ produto, onAtualizar }: BotaoExcluirProps) {
  const [openModal, setOpenModal] = useState(false);

  const handleClose = () => {
    setOpenModal(false);
    onAtualizar();
  };

  const excluirVencimento = async () => {
    try {
      await api.delete(`/shelflife/${produto.id}`);
      alert("Produto deletado!");
      handleClose();
    } catch (err) {
      console.error("Erro ao excluir:", err);
    }
  };

  return (
    <div>
      <Button color="red" size="xs" outline onClick={() => setOpenModal(true)}>
        Excluir
      </Button>
      <Modal show={openModal} onClose={handleClose}>
        <ModalHeader>Excluir Produto</ModalHeader>
        <ModalBody>
          <p className="text-center text-gray-800 dark:text-gray-100">
            Deseja realmente excluir o produto{" "}
            <strong>{produto.product_name}</strong> com validade em{" "}
            {dayjs(produto.shelflife_date).format("DD/MM/YYYY")}?
          </p>
        </ModalBody>
        <ModalFooter className="flex justify-around">
          <Button size="sm" color="green" onClick={excluirVencimento}>
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

/* --- Componente principal --- */

interface IndexVencimentosProps {
  children?: ReactNode;
}

const IndexVencimentos: React.FC<IndexVencimentosProps> = ({ children }) => {
  return (
    <main className="flex w-full flex-col items-center justify-start p-4">
      <TableComponent />
      {children && <div className="mt-4">{children}</div>}
    </main>
  );
};

export default IndexVencimentos;
