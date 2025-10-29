import React, { ReactNode, useEffect, useCallback, useState } from "react";
import { CadastrarVencimento } from "./cadastrar";
import { EditarVencimento } from "./editar";
import api from "../../api";
import dayjs from 'dayjs'
// Importa o plugin 'localeData' e 'pt-br' para formatação em português
import 'dayjs/locale/pt-br'; 
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

// Configura o Day.js para usar o locale pt-br
dayjs.locale('pt-br');

export interface ProdutoVencimento {
  product_code: number;
  product_name: string;
  quantity: number;
  shelflife_date: string;
  created_by: string;
  created_date: string;
  id: number;
  last_mod: string;
  local: number;
  diasRestantes?: number; // campo adicionado
}

function TableComponent() {
  const [produtos, setProdutos] = useState<ProdutoVencimento[]>([]);
  const { idLocal } = useLocalDeEstoque();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 1. Função calcularDiasRestantes adaptada para Day.js
  const calcularDiasRestantes = useCallback((validade: string): number => {
    // dayjs().startOf('day') obtém a data de hoje à 00:00:00 no fuso horário local.
    const hoje = dayjs().startOf('day');
    const validadeNormalizada = dayjs(validade).startOf('day');

    // .diff(outraData, 'day', true) calcula a diferença em dias com casas decimais (float).
    const diffFloat = validadeNormalizada.diff(hoje, 'day', true);

    // Math.ceil() é mantido para replicar o comportamento original (dar 1 dia a mais se a validade não for no passado)
    return Math.ceil(diffFloat);
  }, []);

  const buscarVencimentos = useCallback(async () => {
    setIsLoading(true);
    try {
      const getFetch = await api.get("/shelflife/");
      const dadosVencimentos: ProdutoVencimento[] = getFetch.data;

      // 🔹 Filtra, ordena e adiciona dias restantes
      const dadosProcessados = dadosVencimentos
        .filter((e) => e.local === idLocal)
        .sort(
          (a, b) =>
            // 2. Ordenação: usa .valueOf() do Day.js para comparar timestamps (milissegundos)
            dayjs(a.shelflife_date).valueOf() -
            dayjs(b.shelflife_date).valueOf(),
        )
        .map((item) => ({
          ...item,
          // 3. Chamada da função de cálculo
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
        <div className="m-auto flex h-fit w-1/5 items-center justify-center py-16">
          <Spinner size="xl" aria-label="Loading..." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="m-auto w-fit rounded-2xl p-2 text-center font-extrabold text-white dark:bg-gray-700">
            <h1>Vencimentos</h1>
          </div>
          <div className="flex flex-row-reverse">
            <div className="m-1 w-fit rounded-2xl p-1 text-center text-white dark:bg-gray-700">
              <h3>Opções:</h3>
              <div className="flex items-baseline justify-end align-middle">
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
          <Table className="m-2 text-center opacity-95">
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
                    {/* 4. Formatação de data Day.js: 'DD/MM/YYYY' */}
                    { dayjs(produto.shelflife_date).format('DD/MM/YYYY')}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                    {/* 5. Formatação de data Day.js: 'DD/MM/YYYY' */}
                    { dayjs(produto.last_mod).format('DD/MM/YYYY')}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap text-gray-900 dark:text-white">
                    <div className="flex justify-center gap-1">
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
      )}
    </>
  );
}

/* --- Botões e Modal --- */

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
    <div className="m-1 flex justify-end">
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
    } catch (err: any) {
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
            {/* 6. Formatação de data Day.js: 'DD/MM/YYYY' */}
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
    <main className="flex justify-between">
      <div>
        <TableComponent />
        {children && <div>{children}</div>}
      </div>
    </main>
  );
};

export default IndexVencimentos;