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
// 1. Importa Day.js
import dayjs from 'dayjs';

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

  // 2. Função adaptada para usar Day.js para comparação de datas
  const totalProdutosConferidosDia = () => {
    // dayjs().format('YYYY-MM-DD') obtém a data atual no formato da API
    const hojeFormatado = dayjs().format("YYYY-MM-DD");
    
    return [...produtosConferidos, ...workItems].filter(
      // Compara a data de criação (created_date) com a data de hoje formatada
      (d) => d.created_date.split("T")[0] === hojeFormatado && d.created_by == user?.name
    ).length; 
  };

  const produtosConferidosHoje = totalProdutosConferidosDia();

  async function fetchAll() {
    setIsLoading(true);
    try {
      const conferidos = await api.get("/conference/");
      const work = await api.get("/work_conference/items/"); // nova rota que retorna todos os work items do usuário

      // Normaliza work items para a mesma interface de ProdutoConferidoProps
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

      setProdutosConferidos(conferidos.data.filter((d:ProdutoConferidoProps) => d.created_by == user?.name));
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
      <div className="m-auto flex h-fit w-1/5 items-center justify-center py-16">
        <Spinner size="xl" aria-label="Loading..." />
      </div>
    );
  }

  return (
    <div className="m-5 flex w-full max-w-full flex-col gap-4 overflow-x-auto opacity-95">
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="w-full text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Informações Gerais
          </h2>
          <p className="font-normal text-gray-700 dark:text-gray-400">
            <Badge className="m-auto w-fit">
              Total de produtos conferidos hoje: {produtosConferidosHoje}
            </Badge>
          </p>
        </Card>

        <Card>
          <GraficoConferenciasDia
            produtosConferidos={produtosConferidos}
            workItems={workItems}
          />
        </Card>
      </div>

      <Card className="w-full">
        <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Listagem:
        </h2>
        <BotaoCadastrar onAtualizar={fetchAll} />
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
    onAtualizar(); // refaz o fetch ao fechar
  };

  return (
    <div className="m-1 flex justify-end">
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