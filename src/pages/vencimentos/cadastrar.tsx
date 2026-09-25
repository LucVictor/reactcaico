import { Button, Label, Spinner, TextInput } from "flowbite-react";
import { useState, useEffect } from "react";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";

interface ProdutoVencimento {
  product_code: string;
  quantity: number;
  shelflife_date: string; // envia como string no formato yyyy-mm-dd
  local: number;
}

export function CadastrarVencimento({ onSucesso }: { onSucesso: () => void }) {
  const [codigo, setCodigo] = useState<string>("");
  const [nome, setNome] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>();
  const [validade, setValidade] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const { idLocal } = useLocalDeEstoque(); // ✅ pegar local atual

  useEffect(() => {
    const buscarProduto = async () => {
      try {
        const res = await api.get(`/v2/products/${codigo}`);
        const data = await res.data;
        setNome(data.product.name);
      } catch (error) {
        console.error(error);
        setNome(""); // limpa se não encontrar
      }
    };
    if (codigo) {
      buscarProduto();
    }
  }, [codigo]);

  const enviarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome) {
      alert("Digite um código válido!!");
      return;
    }
    if (quantidade < 0) {
      alert("Quantidade menor do que 1!!");
      return;
    }
    try {
      const novoProduto: ProdutoVencimento = {
        product_code: codigo,
        quantity: quantidade,
        shelflife_date: validade,
        local: idLocal,
      };
      setIsLoading(true);

      const res = await api.post("/shelflife/", novoProduto);
      const data = await res.data;
      console.log("Produto cadastrado:", data);
      setIsLoading(false);
      alert("Cadastro realizado com sucesso!");
      onSucesso();
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar produto");
    }
  };

  return (
    <>
      {" "}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner aria-label="Loading..." size="xl" />
        </div>
      ) : (
        <form className="m-auto flex flex-col gap-4" onSubmit={enviarCadastro}>
          <div>
            <Label htmlFor="cproduto">Código</Label>
            <TextInput
              id="cproduto"
              type="text"
              inputMode="numeric"
              placeholder="Digite o código do produto"
              onChange={(e) => setCodigo(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="nproduto">Nome</Label>
            <TextInput
              id="nproduto"
              type="text"
              value={nome}
              readOnly
              required
            />
          </div>
          <div>
            <Label htmlFor="qproduto">Quantidade</Label>
            <TextInput
              id="qproduto"
              type="number"
              step={0.001}
              placeholder="Digite a quantidade"
              onChange={(e) => setQuantidade(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <Label htmlFor="vproduto">Validade</Label>
            <TextInput
              id="vproduto"
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              required
            />
          </div>

          <Button type="submit">Cadastrar</Button>
        </form>
      )}
    </>
  );
}
