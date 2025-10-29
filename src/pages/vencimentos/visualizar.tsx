import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Select,
  Label,
} from "flowbite-react";
import html2canvas from "html2canvas";
import api from "../../api";
import "./visualizar.css";
// 1. Importa Day.js e o locale pt-br
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

// 2. Configura o Day.js para usar o locale pt-br
dayjs.locale('pt-br');

interface ProdutoVencimento {
  id: number;
  product_code: number;
  product_name: string;
  quantity: number;
  shelflife_date: string;
  last_mod: string;
  local: number;
  diasRestantes?: number;
}

const PaginaImpressaoVencimentos: React.FC = () => {
  const [produtos, setProdutos] = useState<ProdutoVencimento[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [idLocal, setIdLocal] = useState<number>(1);
  const tabelaRef = useRef<HTMLDivElement>(null);

  // 3. Função calcularDiasRestantes adaptada para Day.js
  const calcularDiasRestantes = useCallback((validade: string): number => {
    // dayjs().startOf('day') obtém a data de hoje à 00:00:00 no fuso horário local.
    const hoje = dayjs().startOf('day');
    // Cria o objeto dayjs para a data de validade e normaliza
    const validadeNormalizada = dayjs(validade).startOf('day'); 

    // Calcula a diferença em dias (float)
    const diffFloat = validadeNormalizada.diff(hoje, 'day', true); 

    // Mantém Math.ceil() para replicar o comportamento original (arredondar para cima)
    return Math.ceil(diffFloat);
  }, []);

  const buscarVencimentos = useCallback(async () => {
    setIsLoading(true);
    try {
      const getFetch = await api.get("/external/shelflife/visualization");
      const dadosVencimentos: ProdutoVencimento[] = getFetch.data;

      const dadosProcessados = dadosVencimentos
        .filter((e) => e.local === idLocal)
        .sort(
          (a, b) =>
            // 4. Ordenação: usa .valueOf() do Day.js para comparar timestamps (milissegundos)
            dayjs(a.shelflife_date).valueOf() -
            dayjs(b.shelflife_date).valueOf(),
        )
        .map((item) => ({
          ...item,
          // 5. Chamada da função de cálculo
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

  const handlePrint = () => {
    if (tabelaRef.current) {
      const printContents = tabelaRef.current.innerHTML;
      const janela = window.open("", "_blank");
      if (janela) {
        // Mapeamento dos locais para o título do relatório
        const nomeLocal = {
          1: "Matriz",
          2: "Parnamirim",
          3: "Zona Norte",
          4: "Lagoa Nova",
        }[idLocal];

        janela.document.write(`
          <html>
            <head>
              <title>Relatório de Vencimentos</title>
              <style>
                @page { margin: 10mm; }
                body {
                  font-family: Arial, sans-serif;
                  margin: 20px;
                  background: white;
                  color: black;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 10px;
                  table-layout: auto;
                }
                th, td {
                  border: 1px solid #ccc;
                  padding: 4px;
                  text-align: center;
                  word-wrap: break-word;
                }
                th {
                  background: #f0f0f0;
                }
                .nome-produto {
                  min-width: 300px;
                  white-space: nowrap;
                  overflow: visible;
                }
                .print-hide {
                  display: none;
                }
                h2 {
                  text-align: center;
                  margin-bottom: 20px;
                }
              </style>
            </head>
            <body>
              <h2>Relatório de Vencimentos - ${nomeLocal}</h2>
              ${printContents}
            </body>
          </html>
        `);
        janela.document.close();
        janela.focus();

        // Oculta a última coluna na impressão
        const lastTh = janela.document.querySelector("th:last-child");
        if (lastTh) lastTh.classList.add("print-hide");
        const lastTds = janela.document.querySelectorAll("td:last-child");
        lastTds.forEach((td) => td.classList.add("print-hide"));

        janela.print();
        janela.close();
      }
    }
  };

  const handleSaveImage = async () => {
    if (!tabelaRef.current) return;

    // Garante que a tabela seja capturada inteira
    const tabela = tabelaRef.current;

    // Salva scroll atual
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Move a tabela para visível total temporariamente
    tabela.style.position = "absolute";
    tabela.style.left = "0";
    tabela.style.top = "0";

    // Captura a tabela inteira
    const canvas = await html2canvas(tabela, {
      scale: 2,
      useCORS: true, // caso tenha imagens externas
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      windowWidth: tabela.scrollWidth,
      windowHeight: tabela.scrollHeight,
    });

    // Restaura posição original
    tabela.style.position = "";
    tabela.style.left = "";
    tabela.style.top = "";

    // Restaura scroll
    window.scrollTo(scrollX, scrollY);

    // Salva imagem
    const link = document.createElement("a");
    link.download = "relatorio.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <main className="p-3 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-center font-semibold text-white md:text-2xl">
            Relatório de Vencimentos
          </h1>
          <div className="mt-2">
            <Label htmlFor="localSelect">Selecionar Local:</Label>
            <Select
              id="localSelect"
              className="mt-1 w-full md:w-56"
              value={idLocal}
              onChange={(e) => setIdLocal(Number(e.target.value))}
            >
              <option value={1}>1 - Matriz</option>
              <option value={2}>2 - Parnamirim</option>
              <option value={3}>3 - Zona Norte</option>
              <option value={4}>4 - Lagoa Nova</option>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button color="blue" onClick={handleSaveImage}>
            💾 Salvar como Imagem
          </Button>
          <Button color="gray" onClick={handlePrint}>
            🖨️ Imprimir
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="xl" aria-label="Carregando..." />
        </div>
      ) : (
        <div ref={tabelaRef}>
          <Table className="w-full text-center text-xs md:text-base">
            <TableHead>
              <TableRow>
                <TableHeadCell className="w-[15%] p-2 md:w-[15%] md:p-4">
                  Código
                </TableHeadCell>
                <TableHeadCell className="nome-produto w-[50%] p-2 md:w-[35%] md:p-4">
                  Produto
                </TableHeadCell>
                <TableHeadCell className="w-[10%] p-2 md:w-[10%] md:p-4">
                  Qtd.
                </TableHeadCell>
                <TableHeadCell className="w-[10%] p-2 md:w-[10%] md:p-4">
                  Dias
                </TableHeadCell>
                <TableHeadCell className="w-[15%] p-2 md:w-[15%] md:p-4">
                  Validade
                </TableHeadCell>
                <TableHeadCell className="hidden w-[15%] p-2 md:table-cell md:p-4">
                  Atualização
                </TableHeadCell>
              </TableRow>
            </TableHead>

            <TableBody className="divide-y">
              {produtos.map((produto) => (
                <TableRow
                  key={produto.id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="p-2 md:p-4">
                    {produto.product_code}
                  </TableCell>
                  <TableCell className="p-2 text-left md:p-4">
                    {produto.product_name}
                  </TableCell>
                  <TableCell className="p-2 md:p-4">
                    {produto.quantity}
                  </TableCell>
                  <TableCell className="p-2 md:p-4">
                    {produto.diasRestantes}
                  </TableCell>
                  <TableCell className="p-2 md:p-4">
                    {/* 6. Formatação de data Day.js: 'DD/MM/YYYY' */}
                    {dayjs(produto.shelflife_date).format('DD/MM/YYYY')}
                  </TableCell>
                  <TableCell className="hidden p-2 md:table-cell md:p-4">
                    {/* 7. Formatação de data Day.js: 'DD/MM/YYYY' */}
                    {dayjs(produto.last_mod).format('DD/MM/YYYY')}
                  </TableCell>
                </TableRow>
              ))}
              {produtos.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-4 text-gray-500 md:col-span-6"
                  >
                    Nenhum produto encontrado neste local.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Botões de compartilhamento / salvar imagem */}
        </div>
      )}
    </main>
  );
};

export default PaginaImpressaoVencimentos;