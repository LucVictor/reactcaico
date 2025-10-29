import React, { ReactNode, useCallback, useEffect, useState } from "react";
import { RelatorioAvarias } from "./relatorio";
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
  Label,
  TextInput,
  Spinner,
} from "flowbite-react";
import GraficoAvariasDia from "./grafico";
import { CadastrarAvaria } from "./cadastrar";
import api from "../../api";
// 1. Importa Day.js e o locale pt-br
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

// 2. Configura o Day.js para usar o locale pt-br
dayjs.locale('pt-br');

export interface ProdutoAvariaProps {
  id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  cost: number;
  damaged_date: string;
  cost_total: number;
  created_date: string;
  shelflife_date: string;
  last_mod: string;
  created_by: string;
  type: number;
  origin: number;
  local: number;
}

export interface OriginProps {
  id: number;
  name: string;
}

export interface TypesProps {
  id: number;
  name: string;
}

export interface DatesProps {
  date1: string;
  date2: string;
}

function TableComponent() {
  const [produtos, setProdutos] = useState<ProdutoAvariaProps[]>([]);
  const [tipo, setTipos] = useState<TypesProps[]>([]);
  const [origem, setOrigem] = useState<OriginProps[]>([]);
  const { idLocal } = useLocalDeEstoque();
  const [isLoading, setIsLoading] = useState<boolean>();
  const [currentPage, setCurrentPage] = useState(1); // ✅ página atual
  const itemsPerPage = 10; // ✅ número de itens por página

  async function buscarTiposEOrigem() {
    try {
      const getFetchTipos = await api.get("/damaged/type/");
      const dadosTipos: TypesProps[] = getFetchTipos.data;
      if (dadosTipos?.length > 0) setTipos(dadosTipos);

      const getFetchOrigem = await api.get("/damaged/origin/");
      const dadosOrigem: OriginProps[] = getFetchOrigem.data;
      if (dadosOrigem?.length > 0) setOrigem(dadosOrigem);
    } catch (err) {
      console.error("Erro ao buscar tipos e origem:", err);
    }
  }

  const buscarAvarias = useCallback(async () => {
    try {
      const getFetch = await api.get(`/damaged/`);
      const dadosAvarias: ProdutoAvariaProps[] = getFetch.data;
      setProdutos(
        dadosAvarias
          .filter((e) => e.local == idLocal)
          .sort(
            (a, b) =>
              // 3. Ordenação: usa dayjs().valueOf() para comparar timestamps (data mais recente primeiro)
              dayjs(b.damaged_date).valueOf() -
              dayjs(a.damaged_date).valueOf(),
          ) || [],
      );
      setCurrentPage(1); // 🔁 reinicia para a primeira página ao buscar
    } catch (err) {
      console.error("Erro ao buscar avarias:", err);
    }
  }, [idLocal]);

  async function filtrarAvarias(date1: string, date2: string) {
    try {
      const getFetch = await api.get(
        `/damaged/between?date1=${date1}&date2=${date2}`,
      );
      const dadosAvarias: ProdutoAvariaProps[] = getFetch.data;
      setProdutos(
        dadosAvarias
          .filter((e) => e.local == idLocal)
          .sort(
            (a, b) =>
              // 4. Ordenação: usa dayjs().valueOf() para comparar timestamps (data mais recente primeiro)
              dayjs(b.damaged_date).valueOf() -
              dayjs(a.damaged_date).valueOf(),
          ) || [],
      );
      setCurrentPage(1); // 🔁 reinicia para a primeira página ao filtrar
    } catch (err) {
      console.error("Erro ao filtrar avarias:", err);
    }
  }

  useEffect(() => {
    async function carregarDadosIniciais() {
      setIsLoading(true);
      try {
        await Promise.all([buscarAvarias(), buscarTiposEOrigem()]);
      } catch (err) {
        console.error("Erro ao carregar dados iniciais:", err);
      } finally {
        setIsLoading(false);
      }
    }

    carregarDadosIniciais();
  }, [buscarAvarias]);

  // 5. Função de formatação de data adaptada para Day.js
  const formatarData = (data: string) => {
    // dayjs(data) parseia a string da data
    // .format('DD/MM/YYYY') formata para o padrão PT-BR
    return dayjs(data).format('DD/MM/YYYY');
  };

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);

  // ✅ lógica de paginação
  const totalPages = Math.ceil(produtos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const produtosPaginados = produtos.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner aria-label="Loading..." size="xl" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="h-full w-full rounded-2xl border-solid dark:bg-gray-700">
            {produtos.length > 0 && (
              <GraficoAvariasDia
                produtosAvarias={produtos}
                tipos={tipo}
                origens={origem}
              />
            )}
          </div>

          <div className="flex flex-row-reverse">
            <div className="m-1 w-1/3 rounded-2xl text-white dark:bg-gray-700">
              <div className="text-center">
                <h3>Opções:</h3>
              </div>
              <div className="flex justify-center">
                <BotaoRelatorio />
                <BotaoAvariaFiltro onFiltrar={filtrarAvarias} />
                <BotaoCadastrar onAtualizar={buscarAvarias} />
              </div>
            </div>
          </div>

          {/* ✅ tabela paginada */}
          <Table className="text-center">
            <TableHead>
              <TableRow>
                <TableHeadCell>Data</TableHeadCell>
                <TableHeadCell>Código</TableHeadCell>
                <TableHeadCell>Produto</TableHeadCell>
                <TableHeadCell>Quantidade</TableHeadCell>
                <TableHeadCell>Custo</TableHeadCell>
                <TableHeadCell>Tipo</TableHeadCell>
                <TableHeadCell>Origem</TableHeadCell>
                <TableHeadCell>
                  <span className="sr-only">Ações</span>
                </TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {produtosPaginados.map((produto) => (
                <TableRow
                  key={produto.id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  {/* 6. Uso da função formatarData (agora com Day.js) */}
                  <TableCell>{formatarData(produto.damaged_date)}</TableCell>
                  <TableCell>{produto.product_code}</TableCell>
                  <TableCell>{produto.product_name}</TableCell>
                  <TableCell>{produto.quantity}</TableCell>
                  <TableCell>{formatarMoeda(produto.cost_total)}</TableCell>
                  <TableCell>
                    {tipo.find((e) => e.id === produto.type)?.name || "-"}
                  </TableCell>
                  <TableCell>
                    {origem.find((e) => e.id === produto.origin)?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <BotaoExcluir
                      produto={produto}
                      onAtualizar={buscarAvarias}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* ✅ Paginação */}
          <div className="mt-4 mb-8 flex items-center justify-center gap-3">
            <Button
              size="xs"
              color="gray"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              size="xs"
              color="gray"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function BotaoCadastrar({ onAtualizar }: { onAtualizar: () => void }) {
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
        <ModalHeader>Cadastrar Avaria</ModalHeader>
        <ModalBody>
          <CadastrarAvaria />
        </ModalBody>
      </Modal>
    </div>
  );
}

function BotaoExcluir({
  produto,
  onAtualizar,
}: {
  produto: ProdutoAvariaProps;
  onAtualizar: () => void;
}) {
  const [openModal, setOpenModal] = useState(false);

  const excluirVencimento = async () => {
    try {
      await api.delete(`/damaged/${produto.id}`);
      alert("Produto deletado!");
      setOpenModal(false);
      onAtualizar();
    } catch {
      alert("Erro ao excluir produto!");
    }
  };

  return (
    <div className="m-1 flex justify-end">
      <Button color="red" size="xs" outline onClick={() => setOpenModal(true)}>
        Excluir
      </Button>
      <Modal show={openModal} onClose={() => setOpenModal(false)}>
        <ModalHeader>Excluir</ModalHeader>
        <ModalBody>
          <p className="text-center text-white">
            Deseja excluir o produto <strong>{produto.product_name}</strong> (
            {/* 7. Formatação de data Day.js no Modal de Exclusão */}
            {dayjs(produto.created_date).format("DD/MM/YYYY")})?
          </p>
        </ModalBody>
        <ModalFooter className="flex justify-around">
          <Button size="sm" color="green" onClick={excluirVencimento}>
            Sim
          </Button>
          <Button color="red" size="sm" onClick={() => setOpenModal(false)}>
            Não
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function BotaoRelatorio() {
  const [openModal, setOpenModal] = useState(false);

  return (
    <div className="m-1 flex justify-end">
      <Button color="blue" size="sm" onClick={() => setOpenModal(true)}>
        Relatório
      </Button>
      <Modal show={openModal} onClose={() => setOpenModal(false)}>
        <ModalHeader>Relatório de Avarias</ModalHeader>
        <ModalBody>
          <RelatorioAvarias />
        </ModalBody>
        <ModalFooter>
          <Button>Gerar impressão</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function BotaoAvariaFiltro({
  onFiltrar,
}: {
  onFiltrar: (date1: string, date2: string) => void;
}) {
  const [openModal, setOpenModal] = useState(false);
  const [datas, setDatas] = useState({ dataInicial: "", dataFinal: "" });

  const handleFiltrar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!datas.dataInicial || !datas.dataFinal) {
      alert("Selecione as duas datas!");
      return;
    }
    onFiltrar(datas.dataInicial, datas.dataFinal);
    setOpenModal(false);
  };

  return (
    <div className="m-1 flex justify-end">
      <Button size="sm" onClick={() => setOpenModal(true)}>
        Filtro
      </Button>
      <Modal show={openModal} onClose={() => setOpenModal(false)}>
        <ModalHeader>Filtro de Avarias</ModalHeader>
        <ModalBody>
          <form className="m-auto flex flex-col gap-4" onSubmit={handleFiltrar}>
            <div>
              <Label htmlFor="data_inicial">Data inicial</Label>
              <TextInput
                id="data_inicial"
                type="date"
                onChange={(e) =>
                  setDatas({ ...datas, dataInicial: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="data_final">Data Final</Label>
              <TextInput
                id="data_final"
                type="date"
                onChange={(e) =>
                  setDatas({ ...datas, dataFinal: e.target.value })
                }
                required
              />
            </div>
            <Button type="submit" color="green">
              Filtrar
            </Button>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={() => setOpenModal(false)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
const IndexAvarias: React.FC<{ children?: ReactNode }> = ({ children }) => (
  <main className="m-1 flex justify-between opacity-95">
    <div>
      <TableComponent />
      {children}
    </div>
  </main>
);

export default IndexAvarias;