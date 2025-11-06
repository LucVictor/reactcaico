// index.tsx
import { useEffect, useState } from "react";
import { useAuthStore } from "../authStore";
import { CadastrarConferencia } from "./cadastrar";
import {
  Button,
  Modal,
  ModalBody,
  ModalHeader,
  Card,
  Badge,
  Spinner,
} from "flowbite-react";
import TabelaDinamica from "./tabela";
import api from "../../api";
import GraficoConferenciasDia from "./grafico";
import dayjs from "dayjs";

export interface ProdutoConferidoProps {
  id: number;
  product_name: string;
  product_code: number;
  quantity_real: number;
  quantity_system: number;
  diference: number;
  cost_total: number;
  created_date: string;
  created_by: string;
}

export default function TableComponent() {
  const [produtosConferidos, setProdutosConferidos] = useState<
    ProdutoConferidoProps[]
  >([]);
  const [workItems, setWorkItems] = useState<ProdutoConferidoProps[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const user = useAuthStore((state) => state.user);

  const totalProdutosConferidosDia = () => {
    const hojeFormatado = dayjs().format("YYYY-MM-DD");
    return [...produtosConferidos, ...workItems].filter(
      (d) =>
        d.created_date.split("T")[0] === hojeFormatado &&
        d.created_by == user?.name,
    ).length;
  };

  const produtosConferidosHoje = totalProdutosConferidosDia();

  async function fetchAll() {
    setIsLoading(true);
    try {
      const conferidos = await api.get("/conference/");
      const work = await api.get("/work_conference/items/");

      const workNormalized: ProdutoConferidoProps[] = work.data.map(
        (w: any) => ({
          id: w.id,
          product_name: w.product_name,
          product_code: w.product_code,
          quantity_real: w.quantity_real,
          quantity_system: w.quantity_system,
          diference:
            w.quantity_system && w.quantity_real
              ? w.quantity_system - w.quantity_real
              : 0,
          cost_total: 0,
          created_date: w.created_date,
          created_by: w.created_by,
        }),
      );

      setProdutosConferidos(
        conferidos.data.filter(
          (d: ProdutoConferidoProps) => d.created_by == user?.name,
        ),
      );
      setWorkItems(workNormalized.filter((d) => d.created_by == user?.name));
    } catch (err) {
      console.error(err);
      setProdutosConferidos([]);
      setWorkItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner size="xl" aria-label="Loading..." />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6 p-5 opacity-95">
      {/* Cards de informações */}
      <div className="flex w-full flex-col items-center gap-6 md:flex-row md:justify-center">
        <Card className="w-full max-w-sm text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Informações Gerais
          </h2>
          <p className="mt-2 flex flex-col gap-2 font-normal text-gray-700 dark:text-gray-400">
            <Badge className="m-auto w-fit">
              Total de produtos conferidos hoje: {produtosConferidosHoje}
            </Badge>
            <Badge className="m-auto w-fit">
              Total de produtos conferidos no mês: {produtosConferidos.length}
            </Badge>
          </p>
        </Card>

        <Card className="h-96 w-full max-w-2xl">
          {/* Card maior para o gráfico */}
          <GraficoConferenciasDia
            produtosConferidos={produtosConferidos}
            workItems={workItems}
          />
        </Card>
      </div>

      {/* Botão Cadastrar centralizado */}
      <div className="flex w-full max-w-6xl justify-end">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-700 p-3 text-white dark:bg-gray-700">
          <h3 className="mb-2 w-full text-center">Opções:</h3>
          <div className="m-auto w-fit">
            <BotaoCadastrar onAtualizar={fetchAll} />
          </div>
        </div>
      </div>

      {/* Tabela centralizada e maior */}
      <Card className="w-full max-w-6xl overflow-x-auto">
        <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Listagem:
        </h2>
        <TabelaDinamica produtos={[...produtosConferidos, ...workItems]} />
      </Card>
    </div>
  );
}

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
        <ModalHeader>Cadastrar conferência</ModalHeader>
        <ModalBody>
          <CadastrarConferencia onSucesso={handleClose} />
        </ModalBody>
      </Modal>
    </div>
  );
}
