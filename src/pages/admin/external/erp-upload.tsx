import { useCallback, useState } from "react";
import dayjs from "dayjs";
import {
  Badge,
  Button,
  Card,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
} from "flowbite-react";
import api from "../../../api";
import type { ErpMatch } from "../aprovacoes";

export interface ErpJsonFileInfo {
  file_id: number;
  filename: string;
  erp_type: "ajuste" | "avaria";
  content_hash: string;
  imported_at: string;
}

export interface ErpMatchRow extends ErpMatch {
  record_name?: string;
}

export default function AdminErpJsonUploadPage() {
  const hoje = dayjs().format("YYYY-MM-DD");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregandoUpload, setCarregandoUpload] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [files, setFiles] = useState<ErpJsonFileInfo[]>([]);
  const [carregandoFiles, setCarregandoFiles] = useState(false);
  const [aplicarLoading, setAplicarLoading] = useState(false);
  const [aplicarFeedback, setAplicarFeedback] = useState<string | null>(null);
  const [matchModal, setMatchModal] = useState<{
    open: boolean;
    recordType: "conference" | "damaged" | "task_item";
    recordId: number;
    matches: ErpMatchRow[];
  }>({ open: false, recordType: "conference", recordId: 0, matches: [] });
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchFile, setMatchFile] = useState<ErpJsonFileInfo | null>(null);
  const [matchFeedback, setMatchFeedback] = useState<string | null>(null);


  const recarregarArquivos = useCallback(async () => {
    setCarregandoFiles(true);
    try {
      const res = await api.get("/external/erp/json/files");
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch {
      setFiles([]);
    } finally {
      setCarregandoFiles(false);
    }
  }, []);

  const handleUpload = async () => {
    if (!arquivo) return;
    setCarregandoUpload(true);
    setUploadFeedback(null);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      const res = await api.post("/external/erp/json/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadFeedback(
        res.data?.duplicate
          ? `Arquivo "${res.data?.filename}" já foi ingerido (id=${res.data?.file_id}).`
          : `Arquivo "${res.data?.filename}" ingerido com sucesso (id=${res.data?.file_id}).`
      );
      setArquivo(null);
      await recarregarArquivos();
    } catch (err) {
      setUploadFeedback("Não foi possível fazer o upload do arquivo.");
    } finally {
      setCarregandoUpload(false);
    }
  };

  const handleAplicar = async () => {
    setAplicarLoading(true);
    setAplicarFeedback(null);
    try {
      await api.post("/external/erp/json/apply");
      setAplicarFeedback(
        "Cruzamento ERP reaplicado em todos os registros pendentes."
      );
      await recarregarArquivos();
    } catch {
      setAplicarFeedback("Não foi possível reaplicar o cruzamento ERP.");
    } finally {
      setAplicarLoading(false);
    }
  };

  const handleDelete = async (file_id: number) => {
    try {
      await api.delete(`/external/erp/json/files/${file_id}`);
      await recarregarArquivos();
    } catch {
      /* ignora */
    }
  };

  const handleVerMatches = async (
    recordType: "conference" | "damaged" | "task_item",
    recordId: number
  ) => {
    setMatchModal({ open: true, recordType, recordId, matches: [] });
    try {
      const res = await api.get("/external/erp/json/matches", {
        params: { record_id: recordId, record_type: recordType },
      });
      setMatchModal((m) => ({
        ...m,
        matches: Array.isArray(res.data) ? res.data : [],
      }));
    } catch {
      setMatchModal((m) => ({ ...m, matches: [] }));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">
              Upload de JSON do ERP
            </h2>
            <Button
              color="green"
              size="sm"
              onClick={handleAplicar}
              disabled={aplicarLoading}
            >
              {aplicarLoading ? (
                <Spinner size="sm" />
              ) : (
                <>Aplicar cruzamento ERP</>
              )}
            </Button>
          </div>

          {aplicarFeedback && (
            <div
              className={`rounded-lg border ${
                aplicarFeedback.startsWith("Cruzamento")
                  ? "border-green-500 bg-green-50 text-green-800 dark:bg-green-900/30 dark:border-green-500 dark:text-green-200"
                  : "border-red-500 bg-red-50 text-red-800 dark:bg-red-900/30 dark:border-red-500 dark:text-red-200"
              } px-3 py-2 text-sm`}
            >
              {aplicarFeedback}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Label>Arquivo JSON exportado do ERP</Label>
            <div className="flex flex-wrap items-center gap-3">
              <FileInput
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setArquivo(file);
                  setUploadFeedback(null);
                }
              />
              <Button
                color="blue"
                disabled={!arquivo || carregandoUpload}
                onClick={handleUpload}
              >
                {carregandoUpload ? (
                  <Spinner size="sm" />
                ) : (
                  "Ingerir JSON"
                )}
              </Button>
              {uploadFeedback && (
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {uploadFeedback}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="shadow-md">
        <h2 className="mb-3 text-lg font-bold text-gray-800 dark:text-white">
          Arquivos JSON ingeridos
        </h2>
        {carregandoFiles ? (
          <div className="flex justify-center py-6">
            <Spinner size="xl" />
          </div>
        ) : files.length === 0 ? (
          <p className="py-6 text-center text-gray-600 dark:text-gray-300">
            Nenhum arquivo JSON ingerido ainda.
          </p>
        ) : (
          <Table hoverable className="min-w-[640px] text-center sm:min-w-full">
            <TableHead>
              <TableRow>
                <TableHeadCell>Arquivo</TableHeadCell>
                <TableHeadCell>Tipo</TableHeadCell>
                <TableHeadCell>Ingerido em</TableHeadCell>
                <TableHeadCell>Ações</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((f) => (
                <TableRow key={f.file_id}>

                  <TableCell>
                    <Badge
                      color={f.erp_type === "ajuste" ? "success" : "warning"}
                    >
                      {f.erp_type === "ajuste" ? "Ajuste" : "Avaria"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {dayjs(f.imported_at).format("DD/MM/YYYY HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="xs"
                      color="red"
                      outline
                      onClick={() => handleDelete(f.file_id)}
                    >
                      Remover
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        show={matchModal.open}
        onClose={() => setMatchModal((m) => ({ ...m, open: false }))}
        size="lg"
      >
        <ModalHeader>
          Checks ERP — {matchModal.recordType ==="conference" ? "Conferência" : matchModal.recordType === "damaged" ? "Avaria" : "Item de Tarefa"} #{matchModal.recordId}
        </ModalHeader>
        <ModalBody>
          {matchModal.matches.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-300">
              Nenhum check ERP encontrado para este registro.
            </p>
          ) : (
            <Table hoverable className="min-w-[640px] text-center sm:min-w-full">
              <TableHead>
                <TableRow>
                  <TableHeadCell>#</TableHeadCell>
                  <TableHeadCell>Produto</TableHeadCell>
                  <TableHeadCell>Nº Mov.</TableHeadCell>
                  <TableHeadCell>Data Mov.</TableHeadCell>
                  <TableHeadCell>Qtd.</TableHeadCell>
                  <TableHeadCell>Custo Unit.</TableHeadCell>
                  <TableHeadCell>Filial</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {matchModal.matches.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.id}</TableCell>
                    <TableCell className="text-left">
                      <div className="break-words">
                        <span className="font-medium">{m.product_code}</span>
                        <span className="hidden xs:inline mx-1 text-gray-500">—</span>
                        {m.product_name}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{m.num_mov}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {dayjs(m.dt_mov).format("DD/MM/YYYY")}
                    </TableCell>
                    <TableCell>
                      {m.quantity != null
                        ? m.quantity.toLocaleString("pt-BR", {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {m.cost_unit != null
                        ? Number(m.cost_unit).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>{m.cod_filial ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            onClick={() =>
              setMatchModal((m) => ({ ...m, open: false }))
            }
          >
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

