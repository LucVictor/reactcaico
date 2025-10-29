import { Button, Label, Spinner, TextInput } from "flowbite-react";
import { useState, useEffect } from "react";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";

export interface CadastrarProdutoConferencia {
  product_code: number;
  quantity_real: number;
  quantity_system: number;
  date_: string;
  local: number;
}

export function CadastrarConferencia({ onSucesso }: { onSucesso: () => void }) {
  const [codigo, setCodigo] = useState<number>(0);
  const [nome, setNome] = useState<string>("");
  const [quantidade_fisico, setQuantidade_fisico] = useState<number>(0);
  const [quantidade_sistema, setQuantidade_sistema] = useState<number>(0);
  const [dataConferencia, setDataConferencia] = useState<string>("");
  const { idLocal } = useLocalDeEstoque();
  const [modoContinuar, setModoContinuar] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false); // ✅ novo estado de carregamento

  useEffect(() => {
    const buscarProduto = async () => {
      try {
        const res = await api.get(`/product/${codigo}`);
        const data = await res.data;
        setNome(data.name);
      } catch (error) {
        console.error(error);
        setNome("");
      }
    };

    if (codigo) buscarProduto();
  }, [codigo]);

  const limparFormulario = () => {
    setCodigo(0);
    setNome("");
    setQuantidade_fisico(0);
    setQuantidade_sistema(0);
    setDataConferencia("");
  };

  const enviarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome) {
      alert("Digite um código válido!!");
      return;
    }

    setIsLoading(true); // ✅ inicia o loading

    try {
      const novaConferencia: CadastrarProdutoConferencia = {
        product_code: codigo,
        quantity_real: quantidade_fisico,
        quantity_system: quantidade_sistema,
        date_: dataConferencia,
        local: idLocal,
      };

      const res = await api.post("/conference/", novaConferencia);
      const data = await res.data;
      console.log("Produto cadastrado:", data);
      alert("Cadastro realizado com sucesso!");

      const desejaContinuar = confirm("Deseja cadastrar outro produto?");
      if (desejaContinuar) {
        limparFormulario();
        setModoContinuar(true);
      } else {
        setModoContinuar(false);
        onSucesso();
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar produto");
    } finally {
      setIsLoading(false); // ✅ finaliza o loading
    }
  };

  return (
    <form className="m-auto flex flex-col gap-4" onSubmit={enviarCadastro}>
      <div>
        <Label htmlFor="cproduto">Código</Label>
        <TextInput
          id="cproduto"
          type="number"
          placeholder="Digite o código do produto"
          min="1"
          value={codigo || ""}
          onChange={(e) => setCodigo(Number(e.target.value))}
          required
        />
      </div>

      <div>
        <Label htmlFor="nproduto">Nome</Label>
        <TextInput id="nproduto" type="text" value={nome} readOnly required />
      </div>

      <div>
        <Label htmlFor="qproduto_fisico">Quantidade Físico</Label>
        <TextInput
          id="qproduto_fisico"
          type="number"
          step={0.01}
          placeholder="Digite a quantidade física"
          onChange={(e) => setQuantidade_fisico(Number(e.target.value))}
          required
        />
      </div>

      <div>
        <Label htmlFor="qproduto_sistema">Quantidade Sistema</Label>
        <TextInput
          id="qproduto_sistema"
          type="number"
          step={0.01}
          placeholder="Digite a quantidade no sistema"
          onChange={(e) => setQuantidade_sistema(Number(e.target.value))}
          required
        />
      </div>

      <div>
        <Label htmlFor="vproduto">Data</Label>
        <TextInput
          id="vproduto"
          type="date"
          value={dataConferencia ?? ""}
          onChange={(e) => setDataConferencia(e.target.value)}
          required
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Salvando...
          </>
        ) : modoContinuar ? (
          "Cadastrar próximo produto"
        ) : (
          "Cadastrar"
        )}
      </Button>
    </form>
  );
}
