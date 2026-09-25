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
import dayjs from "dayjs";
import "dayjs/locale/pt-br";

dayjs.locale("pt-br");

interface ProdutoVencimento {
  id: number;
  product_code: string;
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

  const calcularDiasRestantes = useCallback((validade: string): number => {
    const hoje = dayjs().startOf("day");
    const validadeNormalizada = dayjs(validade).startOf("day");
    const diffFloat = validadeNormalizada.diff(hoje, "day", true);
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

  const handlePrint = () => {
    if (tabelaRef.current) {
      const printContents = tabelaRef.current.innerHTML;
      const janela = window.open("", "_blank");
      if (janela) {
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
                }
                th, td {
                  border: 1px solid #ccc;
                  padding: 4px;
                  text-align: center;
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

    const tabela = tabelaRef.current;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const isDark =
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const nomeLocal = {
      1: "Matriz",
      2: "Parnamirim",
      3: "Zona Norte",
      4: "Lagoa Nova",
    }[idLocal];

    // Clone da tabela
    const clone = tabela.cloneNode(true) as HTMLElement;

    // Ajustes visuais no clone (bordas, largura da coluna, padding)
    clone.style.width = "100%";
    clone.style.maxWidth = "1000px";
    clone.style.borderCollapse = "collapse";
    clone.style.tableLayout = "auto";

    clone.querySelectorAll("td, th").forEach((cell) => {
      const el = cell as HTMLElement;
      el.style.border = isDark ? "1px solid #374151" : "1px solid #d1d5db";
      el.style.padding = "8px";
      el.style.boxSizing = "border-box";
    });

    clone.querySelectorAll(".nome-produto").forEach((cell) => {
      const el = cell as HTMLElement;
      el.style.minWidth = "400px";
      el.style.wordBreak = "break-word";
    });

    // Wrapper que conterá título + clone
    const wrapper = document.createElement("div");
    wrapper.style.padding = "100px 30px 80px 30px";
    wrapper.style.backgroundColor = isDark ? "#1f2937" : "#ffffff";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.justifyContent = "center";
    wrapper.style.alignItems = "center";
    wrapper.style.borderRadius = "12px";
    wrapper.style.boxSizing = "border-box";
    wrapper.style.width = "fit-content";
    wrapper.style.height = "fit-content";

    // Título
    const titulo = document.createElement("h1");
    titulo.textContent = `Vencimentos da ${nomeLocal}`;
    titulo.style.textAlign = "center";
    titulo.style.marginBottom = "30px";
    titulo.style.fontSize = "22px";
    titulo.style.fontWeight = "600";
    titulo.style.color = isDark ? "#ffffff" : "#000000";
    titulo.style.fontFamily = "Arial, sans-serif";

    wrapper.appendChild(titulo);
    wrapper.appendChild(clone);

    // --- POSICIONA O WRAPPER FORA DA VIEWPORT sem torná-lo invisível ao paint ---
    // Não usar display:none ou visibility:hidden (html2canvas não renderiza).
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px"; // fora da tela
    wrapper.style.top = "-10000px"; // fora da tela
    wrapper.style.pointerEvents = "none"; // evita qualquer interação
    wrapper.setAttribute("aria-hidden", "true"); // acessibilidade: ignorar

    document.body.appendChild(wrapper);

    // Aguarda renderização completa do DOM do wrapper antes de capturar
    await new Promise((r) => setTimeout(r, 200));

    // Força tamanho total do wrapper ao html2canvas
    const totalWidth = wrapper.scrollWidth;
    const totalHeight = wrapper.scrollHeight;

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: isDark ? "#1f2937" : "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: totalWidth,
      windowHeight: totalHeight,
      x: 0,
      y: 0,
      logging: false,
    });

    // Remove wrapper e restaura scroll
    document.body.removeChild(wrapper);
    window.scrollTo(scrollX, scrollY);

    // Download do arquivo
    const link = document.createElement("a");
    link.download = `relatorio_vencimentos_${nomeLocal}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <main className="min-w-full p-3">
      <div className="mb-4 min-w-full flex-row gap-3">
        <div>
          <h1 className="text-center font-semibold text-white md:text-2xl">
            Relatório de Vencimentos
          </h1>
          <div className="mt-2">
            <Label htmlFor="localSelect">Selecionar Local:</Label>
            <Select
              id="localSelect"
              className="mt-1 w-full"
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
          <Table striped className="w-full text-center text-xs md:text-base">
            <TableHead className="text-white">
              <TableRow>
                <TableHeadCell className="p-2">Código</TableHeadCell>
                <TableHeadCell className="p-2">Produto</TableHeadCell>
                <TableHeadCell className="p-2">Qtd.</TableHeadCell>
                <TableHeadCell className="p-2">Dias</TableHeadCell>
                <TableHeadCell className="p-2">Validade</TableHeadCell>
                <TableHeadCell className="p-2">Atualização</TableHeadCell>
              </TableRow>
            </TableHead>

            <TableBody className="divide-y">
              {produtos.map((produto) => {
                const dias = produto.diasRestantes ?? 0;
                let bgClass = "";

                if (dias < 15)
                  bgClass =
                    "bg-red-500  dark:border-gray-500 text-white font-semibold";
                else if (dias >= 15 && dias < 30)
                  bgClass =
                    "bg-yellow-400 text-black  dark:border-gray-500 font-semibold";
                else
                  bgClass =
                    "bg-green-500 text-white  dark:border-gray-500 font-semibold";

                return (
                  <TableRow
                    key={produto.id}
                    className="bg-white text-gray-200 dark:border-gray-500 dark:bg-gray-800"
                  >
                    <TableCell className="p-2 md:p-4">
                      {produto.product_code}
                    </TableCell>
                    <TableCell className="nome-produto p-2 md:p-4">
                      {produto.product_name}
                    </TableCell>
                    <TableCell className="p-2 md:p-4">
                      {produto.quantity}
                    </TableCell>

                    {/* Célula colorida conforme dias restantes */}
                    <TableCell
                      className={`border border-gray-300 p-2 md:p-4 dark:border-gray-600 ${bgClass}`}
                      style={{
                        border: "1px solid",
                        borderColor:
                          document.documentElement.classList.contains("dark")
                            ? "#4b5563" // dark:border-gray-600
                            : "#d1d5db", // border-gray-300
                      }}
                    >
                      {produto.diasRestantes}
                    </TableCell>

                    <TableCell className="p-2">
                      {dayjs(produto.shelflife_date).format("DD/MM/YYYY")}
                    </TableCell>
                    <TableCell className="p-2">
                      {dayjs(produto.last_mod).format("DD/MM/YYYY")}
                    </TableCell>
                  </TableRow>
                );
              })}

              {produtos.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-4 text-center text-gray-500"
                  >
                    Nenhum produto encontrado neste local.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
};

export default PaginaImpressaoVencimentos;
