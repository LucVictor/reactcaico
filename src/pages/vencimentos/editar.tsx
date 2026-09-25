import { Button, Label, TextInput, Select, Spinner } from "flowbite-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ProdutoVencimento } from "./index";
import api from "../../api";

interface EditarVencimentoProps {
  produtoSelecionado: ProdutoVencimento;
}

interface DadosEditarVencimentosProps {
  id: number;
  quantity: number;
}

export function EditarVencimento({
  produtoSelecionado,
  onSucesso,
}: EditarVencimentoProps & { onSucesso: () => void }) {
  const [produto, setProduto] = useState<ProdutoVencimento>(produtoSelecionado);
  const [novaAvariaOpen, setNovaAvariaOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const enviarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();

    const produtoEditado: DadosEditarVencimentosProps = {
      id: produto.id,
      quantity: produto.quantity,
    };

    try {
      setIsLoading(true);
      const res = await api.put(`/shelflife/`, produtoEditado);
      const data = await res.data;
      console.log("Produto cadastrado:", data);
      setIsLoading(false);
      alert("Edição realizada com sucesso!");
      onSucesso();
    } catch (err) {
      console.error(err);
      alert("Erro ao editar produto");
    }
  };

  return (
    <>
      {novaAvariaOpen ? (
        <CadastrarAvaria produtoSelecionado={produtoSelecionado} />
      ) : (
        <>
          {" "}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner aria-label="Loading..." size="xl" />
            </div>
          ) : (
            <form
              className="m-auto flex flex-col gap-4"
              onSubmit={enviarCadastro}
            >
              <div>
                <Label htmlFor="cproduto">Código</Label>
                <TextInput
                  id="cproduto"
                  type="text"
                  value={produto.product_code}
                  readOnly
                  required
                />
              </div>

              <div>
                <Label htmlFor="nproduto">Nome</Label>
                <TextInput
                  id="nproduto"
                  type="text"
                  value={produto.product_name}
                  readOnly
                />
              </div>

              <div>
                <Label htmlFor="qproduto">Quantidade</Label>
                <TextInput
                  id="qproduto"
                  type="number"
                  value={produto.quantity}
                  onChange={(e) =>
                    setProduto({ ...produto, quantity: Number(e.target.value) })
                  }
                  required
                />
              </div>

              <div className="flex gap-1">
                <Button className="w-full" type="submit">
                  Editar
                </Button>
                <Button
                  color="dark"
                  type="button"
                  onClick={() => setNovaAvariaOpen(true)}
                >
                  Avaria
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}

// -------------------------------------------------------------

interface TipoDeAvariaProps {
  id: number;
  name: string;
}

interface OrigemDeAvaria {
  id: number;
  name: string;
}

function CadastrarAvaria({ produtoSelecionado }: EditarVencimentoProps) {
  const [codigo] = useState<string>(produtoSelecionado.product_code);
  const [nome] = useState<string>(produtoSelecionado.product_name);
  const [quantidade] = useState<number>(produtoSelecionado.quantity);
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
  const idLocal = produtoSelecionado.local;
  const [isLoading, setIsLoading] = useState<boolean>();
  const navigate = useNavigate();

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

  const enviarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome) {
      alert("Digite um código válido!!");
      return;
    }

    if (quantidade < 1) {
      alert("Quantidade menor do que 1!!");
      return;
    }

    try {
      const novaAvaria = {
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
      navigate("/avarias");
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
              value={produtoSelecionado.quantity}
              placeholder="Digite a quantidade"
              required
            />
          </div>

          <div>
            <Label htmlFor="vproduto">Vencimento do Produto</Label>
            <TextInput
              id="vproduto"
              type="date"
              readOnly
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
