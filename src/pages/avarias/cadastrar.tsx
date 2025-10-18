import { Button, Label, TextInput, Select, Spinner } from "flowbite-react";
import { useState, useEffect } from "react";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";

interface CadastrarProdutoAvariaProps {
  product_code: number;
  quantity: number;
  shelflife_date: string;
  damaged_date: string;
  type: number;
  origin: number;
  local: number;
}

interface TipoDeAvariaProps {
  id: number;
  name: string;
}

interface OrigemDeAvaria {
  id: number;
  name: string;
}

export function CadastrarAvaria() {
  const [codigo, setCodigo] = useState<number>(0);
  const [nome, setNome] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(0);
  const [dataAvaria, setdataAvaria] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [dataValidade, setDataValidade] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [tipo, setTipo] = useState<number>(0);
  const [origem, setOrigem] = useState<number>(0);
  const [origens, setOrigens] = useState<OrigemDeAvaria[]>([]);
  const [tipos, setTipos] = useState<TipoDeAvariaProps[]>([]);
  const { idLocal } = useLocalDeEstoque();
  const [isLoading, setIsLoading] = useState<boolean>();

  useEffect(() => {
    const buscarOrigensEtipo = async () => {
      const respOrigens = await api.get("/damaged/origin/");
      const dataOrigens = await respOrigens.data;
      setOrigens(dataOrigens);
      const respTipo = await api.get("/damaged/type/");
      const dataTipos = await respTipo.data;
      console.log(dataTipos);
      setTipos(dataTipos);
    };
    buscarOrigensEtipo();
  }, []);

  useEffect(() => {
    const buscarProduto = async () => {
      try {
        const res = await api.get(`/product/${codigo}`);
        const data = await res.data;
        setNome(data.name);
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
      const novaAvaria: CadastrarProdutoAvariaProps = {
        product_code: codigo,
        quantity: quantidade,
        shelflife_date: dataValidade,
        type: tipo,
        origin: origem,
        local: idLocal,
        damaged_date: dataAvaria,
      };
      setIsLoading(true);
      const res = await api.post("/damaged/", novaAvaria);
      const data = await res.data;
      console.log("Produto cadastrado:", data);
      setIsLoading(false);
      alert("Cadastro realizado com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar produto");
    }
  };

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner aria-label="Loading..." size="xl" />
        </div>
      ) : (
        <form
          className="m-auto flex w-3/4 flex-col gap-4"
          onSubmit={enviarCadastro}
        >
          <div>
            <Label htmlFor="cproduto">Código</Label>
            <TextInput
              id="cproduto"
              type="number"
              placeholder="Digite o código do produto"
              min="1"
              onChange={(e) => setCodigo(Number(e.target.value))}
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
            <Label htmlFor="vproduto">Data da Avaria</Label>
            <TextInput
              id="vproduto"
              type="date"
              value={dataAvaria}
              onChange={(e) => setdataAvaria(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="qproduto">Quantidade</Label>
            <TextInput
              id="qproduto"
              type="number"
              step={0.01}
              placeholder="Digite a quantidade"
              onChange={(e) => setQuantidade(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <Label htmlFor="vproduto">Vencimento do Produto</Label>
            <TextInput
              id="vproduto"
              type="date"
              value={dataValidade}
              onChange={(e) => setDataValidade(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="vproduto">Tipo de avaria</Label>
            <Select
              onChange={(e) => setTipo(Number(e.target.value))}
              id="type"
              required
            >
              <option value="">Selecione o tipo</option>
              {tipos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="vproduto">Origem de avaria</Label>
            <Select
              id="origin"
              onChange={(e) => setOrigem(Number(e.target.value))}
              required
            >
              <option value="">Selecione a origem</option>
              {origens.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit">Cadastrar</Button>
        </form>
      )}
    </>
  );
}
