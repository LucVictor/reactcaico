import {
  Button,
  Label,
  TextInput,
  Select,
  Spinner,
  Modal,
  FileInput,
  ModalFooter,
  ModalBody,
  ModalHeader,
} from "flowbite-react";
import { useState, useEffect } from "react";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";

interface CadastrarProdutoAvariaProps {
  product_code: string;
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
  const [codigo, setCodigo] = useState<string>("");
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
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fotos / Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const buscarOrigensEtipo = async () => {
      try {
        const respOrigens = await api.get("/damaged/origin/");
        setOrigens(respOrigens.data || []);
        const respTipo = await api.get("/damaged/type/");
        setTipos(respTipo.data || []);
      } catch (err) {
        console.error("Erro ao buscar tipos/origens:", err);
      }
    };
    buscarOrigensEtipo();
  }, []);

  useEffect(() => {
    const buscarProduto = async () => {
      try {
        const res = await api.get(`/v2/products/${codigo}`);
        const data = await res.data;
        setNome(data.product.name);
      } catch (error) {
        console.error(error);
        setNome("");
      }
    };
    if (codigo) {
      buscarProduto();
    }
  }, [codigo]);

  useEffect(() => {
    // revoke antigos
    previews.forEach((url) => URL.revokeObjectURL(url));
    const urls = selectedFiles.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles]);

  const handleFileChange = (files?: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    // opcional: filtrar por tipo/size aqui
    setSelectedFiles((prev) => [...prev, ...arr]);
  };

  const removeFileAt = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setPreviews([]);
  };

  const enviarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome) {
      alert("Digite um código válido!!");
      return;
    }
    if (quantidade <= 0) {
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

      // 1) cria a avaria
      const createRes = await api.post("/damaged/", novaAvaria);
      const created = createRes.data;
      console.log("Produto cadastrado: ", created);

      // 2) se tiver fotos, envia para /damaged/{id}/photos
      if (selectedFiles && selectedFiles.length > 0) {
        // extrai id de forma robusta
        const damagedId =
          created?.id ?? created?.ID ?? created?.pk ?? created?.PK ?? null;

        if (!damagedId) {
          setIsLoading(false);
          alert(
            "Resposta do servidor não contém 'id'. Atualize o backend para retornar o id.",
          );
          return;
        }

        const form = new FormData();
        // ajuste o nome 'files' para 'photos' se seu backend espera 'photos'
        selectedFiles.forEach((file) => form.append("files", file));

        try {
          await api.post(`/damaged/${damagedId}/photos`, form, {
            // axios define Content-Type com boundary automaticamente
          });
        } catch (uploadErr) {
          console.error("Erro no upload das fotos:", uploadErr);

          // opcional: tentar rollback apagando o damaged criado (só se existir rota DELETE)
          try {
            await api.delete(`/damaged/${damagedId}`);
            console.info("Rollback: avaria apagada:", damagedId);
          } catch (delErr) {
            console.warn(
              "Rollback falhou (DELETE não disponível ou erro):",
              delErr,
            );
          }

          setIsLoading(false);
          alert(
            "Erro ao enviar fotos. A avaria foi removida (rollback). Tente novamente.",
          );
          return;
        }
      }

      // sucesso
      setIsLoading(false);
      alert("Cadastro realizado com sucesso!");
      // limpa formulário
      setCodigo("");
      setNome("");
      setQuantidade(0);
      setTipo(0);
      setOrigem(0);
      clearFiles();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Erro ao criar avaria:", err);
      setIsLoading(false);
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
        <>
          <form
            className="m-auto flex w-3/4 flex-col gap-4"
            onSubmit={enviarCadastro}
          >
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
                step={0.001}
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

            <div className="flex gap-2">
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                Adicionar Fotos
              </Button>

              <Button type="submit">Cadastrar</Button>
            </div>
          </form>

          {/* Modal de upload de fotos */}
          <Modal
            show={isModalOpen}
            size="3xl"
            onClose={() => setIsModalOpen(false)}
          >
            <ModalHeader>Adicionar Fotos da Avaria</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <div>
                  <Label>Selecione imagens (jpg, png, webp)</Label>
                  <FileInput
                    onChange={(e) => handleFileChange(e.target.files)}
                    id="photos"
                    multiple
                    accept="image/*"
                  />
                </div>

                {/* Previews */}
                {previews.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {previews.map((src, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={src}
                          alt={`preview-${idx}`}
                          className="h-32 w-full rounded object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFileAt(idx)}
                          className="absolute top-1 right-1 rounded-full bg-red-600 p-1 text-xs text-white"
                          title="Remover"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    Nenhuma foto selecionada.
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <div className="flex w-full items-center justify-between gap-2">
                <div>
                  <Button
                    color="gray"
                    onClick={() => {
                      clearFiles();
                      setIsModalOpen(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button color="failure" onClick={() => clearFiles()}>
                    Limpar fotos
                  </Button>
                  <Button onClick={() => setIsModalOpen(false)}>
                    Concluído
                  </Button>
                </div>
              </div>
            </ModalFooter>
          </Modal>
        </>
      )}
    </>
  );
}
