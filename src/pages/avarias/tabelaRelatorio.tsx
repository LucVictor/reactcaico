import { useEffect } from "react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Card,
} from "flowbite-react";

export interface ProdutoAvariasProps {
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

function TabelaRelatorio({
  dadosRelatorio,
}: {
  dadosRelatorio: ProdutoAvariasProps[];
}) {
  const [somaCustoTotal, setSomaCustoTotal] = useState(0);

  useEffect(() => {
    function somatorio(dados: ProdutoAvariasProps[]): number {
      return dados.reduce((acc, e) => acc + e.cost_total, 0);
    }
    setSomaCustoTotal(somatorio(dadosRelatorio));
  }, [dadosRelatorio]);
  const formatarData = (data: string) => {
    // Pega só a parte YYYY-MM-DD
    const [ano, mes, dia] = data.split("T")[0].split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);

  return (
    <div className="overflow-x-auto">
      <div className="container text-center text-white">
        <Card>
          <p>Somatório do custo total de avarias é R${somaCustoTotal}</p>
        </Card>
      </div>
      <Table className="border border-gray-700 text-center">
        <TableHead>
          <TableRow>
            <TableHeadCell>Data</TableHeadCell>
            <TableHeadCell>Código</TableHeadCell>
            <TableHeadCell>Produto</TableHeadCell>
            <TableHeadCell>Quantidade</TableHeadCell>
            <TableHeadCell>Custo</TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody className="divide-y">
          {dadosRelatorio.map((produto, index) => (
            <TableRow
              key={index}
              className="bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              <TableCell>{formatarData(produto.damaged_date)}</TableCell>
              <TableCell className="font-medium whitespace-nowrap">
                {produto.product_code}
              </TableCell>
              <TableCell>{produto.product_name}</TableCell>
              <TableCell>{produto.quantity}</TableCell>
              <TableCell>{formatarMoeda(produto.cost_total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default TabelaRelatorio;
