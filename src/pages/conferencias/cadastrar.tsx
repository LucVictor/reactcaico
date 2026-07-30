import { useRef, useState, ChangeEvent, FocusEvent } from "react";
import {
  Button,
  Label,
  Spinner,
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TextInput,
} from "flowbite-react";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";

interface LinhaConferencia {
  id: number;
  product_code: number;
  name: string;
  quantity_real: number;
  quantity_system: number;
}

export function CadastrarConferencia({ onSucesso }: { onSucesso: () => void }) {
  const { idLocal } = useLocalDeEstoque();
  const [dataConferencia, setDataConferencia] = useState<string>(() => {
    const hoje = new Date();
    return hoje.toISOString().split("T")[0];
  });
  const endRef = useRef<HTMLDivElement | null>(null);
  const [linhas, setLinhas] = useState<LinhaConferencia[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const adicionarLinha = () => {
    setLinhas((prev) => [
      ...prev,
      {
        id: Date.now(),
        product_code: 0,
        name: "",
        quantity_real: 0,
        quantity_system: 0,
      },
    ]);

    scrollToBottom();
  };

  const removerLinha = (id: number) => {
    setLinhas((prev) => prev.filter((linha) => linha.id !== id));
  };

  const atualizarLinha = (
    id: number,
    campo: keyof LinhaConferencia,
    valor: any,
  ) => {
    setLinhas((prev) =>
      prev.map((linha) =>
        linha.id === id ? { ...linha, [campo]: valor } : linha,
      ),
    );
  };

  // Buscar nome do produto automaticamente
  const buscarProduto = async (id: number, codigo: number) => {
    if (!codigo) return;
    try {
      const res = await api.get(`/product/${codigo}`);
      const data = res.data;
      atualizarLinha(id, "name", data.name);
    } catch {
      atualizarLinha(id, "name", "");
    }
  };

  const enviarTudo = async () => {
    if (linhas.length === 0) {
      alert("Adicione pelo menos um produto!");
      return;
    }

    setIsLoading(true);
    try {
      for (const linha of linhas) {
        if (!linha.name) continue;
        const novaConferencia = {
          product_code: linha.product_code,
          quantity_real: linha.quantity_real,
          quantity_system: linha.quantity_system,
          date_: dataConferencia,
          local: idLocal,
        };
        await api.post("/conference/", novaConferencia);
      }

      alert("Todos os cadastros foram enviados com sucesso!");
      setLinhas([]);
      onSucesso();
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar os cadastros!");
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "auto" });
    }, 50);
  };

  // Lida com a digitação das quantidades
  const handleQuantityChange = (
    e: ChangeEvent<HTMLInputElement>,
    id: number,
    campo: "quantity_real" | "quantity_system",
  ) => {
    let valor = e.target.value;

    // Remove qualquer ponto digitado ou colado automaticamente
    valor = valor.replace(/\./g, "");

    // Permite números e vírgula, com até 3 casas decimais (ex: 1000,500)
    const valido = /^[0-9]*,?[0-9]{0,3}$/.test(valor);
    if (!valido) {
      // Se a regex falhar (ex: digitou letra ou mais de 3 casas), limpa a última entrada
      e.target.value = valor.slice(0, -1);
      return;
    }

    // Força o input a exibir a string formatada sem pontos
    e.target.value = valor;

    // Salva o valor numérico no estado
    const numero = valor ? Number(valor.replace(",", ".")) : 0;
    atualizarLinha(id, campo, numero);
  };

  // Formata a quantidade ao sair do campo (onBlur)
  const handleQuantityBlur = (e: FocusEvent<HTMLInputElement>) => {
    let valor = e.target.value;
    if (!valor) return;

    if (!valor.includes(",")) {
      valor += ",000";
    } else {
      const [int, dec = ""] = valor.split(",");
      // Preenche com zeros até atingir 3 casas decimais
      valor = `${int},${dec.padEnd(3, "0")}`;
    }

    e.target.value = valor;
  };

  // Somatórios para feedback
  const totalReal = linhas.reduce(
    (acc, linha) => acc + (linha.quantity_real || 0),
    0,
  );
  const totalSistema = linhas.reduce(
    (acc, linha) => acc + (linha.quantity_system || 0),
    0,
  );

  return (
    <div className="w-full p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Label htmlFor="dataConferencia">Data da Conferência</Label>
          <TextInput
            id="dataConferencia"
            type="date"
            value={dataConferencia}
            onChange={(e) => setDataConferencia(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table className="min-w-full table-auto">
          <TableHead>
            <TableHeadCell className="w-[15%] text-center">
              Código
            </TableHeadCell>
            <TableHeadCell className="w-[35%] text-center">Nome</TableHeadCell>
            <TableHeadCell className="w-[15%] text-center">
              Qtd. Físico
            </TableHeadCell>
            <TableHeadCell className="w-[15%] text-center">
              Qtd. Sistema
            </TableHeadCell>
            <TableHeadCell className="w-[20%] text-center">Ações</TableHeadCell>
          </TableHead>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={linha.id}>
                <TableCell className="w-36">
                  <TextInput
                    type="number"
                    value={linha.product_code || ""}
                    onChange={(e) => {
                      const codigo = Number(e.target.value);
                      atualizarLinha(linha.id, "product_code", codigo);
                      buscarProduto(linha.id, codigo);
                    }}
                  />
                </TableCell>
                <TableCell className="w-9x1 text-center">
                  {linha.name || "—"}
                </TableCell>
                <TableCell className="w-32">
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 1000,500"
                    onChange={(e) =>
                      handleQuantityChange(e, linha.id, "quantity_real")
                    }
                    onBlur={handleQuantityBlur}
                  />
                </TableCell>
                <TableCell className="w-32">
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 1000,500"
                    onChange={(e) =>
                      handleQuantityChange(e, linha.id, "quantity_system")
                    }
                    onBlur={handleQuantityBlur}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    color="red"
                    size="xs"
                    className="mx-auto"
                    onClick={() => removerLinha(linha.id)}
                  >
                    Remover
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {/* Linha de Somatório (só aparece se houver produtos) */}
            {linhas.length > 0 && (
              <TableRow className="bg-gray-50 font-semibold dark:bg-gray-800">
                <TableCell
                  colSpan={2}
                  className="text-right text-sm text-gray-900 uppercase dark:text-white"
                >
                  Totais da Conferência:
                </TableCell>
                <TableCell className="text-center text-blue-600 dark:text-blue-400">
                  {totalReal.toFixed(3).replace(".", ",")}
                </TableCell>
                <TableCell className="text-center text-blue-600 dark:text-blue-400">
                  {totalSistema.toFixed(3).replace(".", ",")}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}

            <div ref={endRef}></div>
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button color="blue" onClick={adicionarLinha}>
          + Adicionar Produto
        </Button>
        <Button color="green" disabled={isLoading} onClick={enviarTudo}>
          {isLoading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Enviando...
            </>
          ) : (
            "Enviar Todos"
          )}
        </Button>
      </div>
    </div>
  );
}
