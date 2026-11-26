import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Badge,
  Button,
  Card,
  Label,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";
import api from "../../../api";

export interface ErpJsonFileInfo {
  file_id: number;
  filename: string;
  erp_type: "ajuste" | "avaria";
  content_hash: string;
  imported_at: string;
}

type ErpType = "ajuste" | "avaria";
type Feedback = { type: "success" | "error"; text: string } | null;

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const data = (
      err as { response?: { data?: { detail?: unknown; message?: unknown } } }
    ).response?.data;
    const detail = data?.detail ?? data?.message;
    if (detail !== undefined && detail !== null) {
      return typeof detail === "string" ? detail : JSON.stringify(detail);
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default function AdminErpJsonUploadPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [erpType, setErpType] = useState<"" | ErpType>("");
  const [carregandoUpload, setCarregandoUpload] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<Feedback>(null);

  const [files, setFiles] = useState<ErpJsonFileInfo[]>([]);
  const [carregandoFiles, setCarregandoFiles] = useState(true);
  const [filesFeedback, setFilesFeedback] = useState<Feedback>(null);

  const [aplicarLoading, setAplicarLoading] = useState(false);
  const [aplicarFeedback, setAplicarFeedback] = useState<Feedback>(null);

  const [removendoId, setRemovendoId] = useState<number | null>(null);

  const recarregarArquivos = useCallback(async () => {
    setCarregandoFiles(true);
    setFilesFeedback(null);
    try {
      const res = await api.get("/external/erp/json/files");
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setFiles([]);
      setFilesFeedback({
        type: "error",
        text: getErrorMessage(err, "Não foi possível listar os arquivos ERP."),
      });
    } finally {
      setCarregandoFiles(false);
    }
  }, []);

  useEffect(() => {
    recarregarArquivos();
  }, [recarregarArquivos]);

  const handleUpload = async () => {
    if (!arquivo) return;

    const nomeArquivo = arquivo.name;
    setCarregandoUpload(true);
    setUploadFeedback(null);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      if (erpType) form.append("erp_type", erpType);

      const res = await api.post("/external/erp/json/upload", form);
      const duplicate = Boolean(res.data?.duplicate);

      setUploadFeedback({
        type: "success",
        text: duplicate
          ? `Arquivo "${nomeArquivo}" já foi ingerido (id=${res.data?.file_id}).`
          : `Arquivo "${nomeArquivo}" ingerido com sucesso (id=${res.data?.file_id}).`,
      });
      setArquivo(null);
      setErpType("");
      setInputKey((key) => key + 1);
      await recarregarArquivos();
    } catch (err) {
      setUploadFeedback({
        type: "error",
        text: getErrorMessage(
          err,
          "Não foi possível fazer o upload do arquivo.",
        ),
      });
    } finally {
      setCarregandoUpload(false);
    }
  };

  const handleAplicar = async () => {
    setAplicarLoading(true);
    setAplicarFeedback(null);
    try {
      await api.post("/external/erp/json/apply");
      setAplicarFeedback({
        type: "success",
        text: "Cruzamento ERP reaplicado em todos os registros pendentes.",
      });
    } catch (err) {
      setAplicarFeedback({
        type: "error",
        text: getErrorMessage(
          err,
          "Não foi possível reaplicar o cruzamento ERP.",
        ),
      });
    } finally {
      setAplicarLoading(false);
    }
  };

  const handleDelete = async (file: ErpJsonFileInfo) => {
    if (
      !window.confirm(
        `Remover o arquivo "${file.filename}"? Os cruzamentos pendentes serão recalculados.`,
      )
    ) {
      return;
    }

    setRemovendoId(file.file_id);
    setFilesFeedback(null);
    try {
      await api.delete(`/external/erp/json/files/${file.file_id}`);
      setFilesFeedback({
        type: "success",
        text: `Arquivo "${file.filename}" removido. Cruzamento recalculado.`,
      });
      await recarregarArquivos();
    } catch (err) {
      setFilesFeedback({
        type: "error",
        text: getErrorMessage(err, "Não foi possível remover o arquivo ERP."),
      });
    } finally {
      setRemovendoId(null);
    }
  };

  const feedbackClass = (feedback: Feedback) =>
    feedback?.type === "success"
      ? "border-green-500 bg-green-50 text-green-800 dark:bg-green-900/30 dark:border-green-500 dark:text-green-200"
      : "border-red-500 bg-red-50 text-red-800 dark:bg-red-900/30 dark:border-red-500 dark:text-red-200";

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="rounded-2xl border border-gray-600 bg-gray-800 p-4 shadow-lg sm:p-6">
        <h1 className="text-2xl font-bold text-white">Upload ERP</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-300">
          Ingere arquivos JSON exportados do ERP e reaplica o cruzamento nas
          solicitações pendentes de aprovação.
        </p>
      </div>

      <Card className="shadow-md">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                Ingerir JSON
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                O tipo é detectado pelo nome do arquivo quando não informado.
              </p>
            </div>
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
              className={`rounded-lg border px-3 py-2 text-sm ${feedbackClass(aplicarFeedback)}`}
            >
              {aplicarFeedback.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="erp-arquivo">Arquivo JSON exportado do ERP</Label>
              <input
                key={inputKey}
                id="erp-arquivo"
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] ?? null);
                  setUploadFeedback(null);
                }}
                className="block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:focus:ring-blue-600"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="erp-tipo">Tipo do arquivo</Label>
              <Select
                id="erp-tipo"
                value={erpType}
                onChange={(e) => setErpType(e.target.value as "" | ErpType)}
              >
                <option value="">Detectar pelo nome</option>
                <option value="ajuste">Ajuste de estoque</option>
                <option value="avaria">Avaria / transferência</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              color="blue"
              disabled={!arquivo || carregandoUpload}
              onClick={handleUpload}
            >
              {carregandoUpload ? <Spinner size="sm" /> : "Ingerir JSON"}
            </Button>
            {uploadFeedback && (
              <span
                className={`text-sm ${
                  uploadFeedback.type === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-700 dark:text-green-400"
                }`}
              >
                {uploadFeedback.text}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card className="shadow-md">
        <h2 className="mb-3 text-lg font-bold text-gray-800 dark:text-white">
          Arquivos JSON ingeridos
        </h2>

        {filesFeedback && (
          <div
            className={`mb-3 rounded-lg border px-3 py-2 text-sm ${feedbackClass(filesFeedback)}`}
          >
            {filesFeedback.text}
          </div>
        )}

        {carregandoFiles ? (
          <div className="flex justify-center py-6">
            <Spinner size="xl" />
          </div>
        ) : files.length === 0 ? (
          <p className="py-6 text-center text-gray-600 dark:text-gray-300">
            Nenhum arquivo JSON ingerido ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table
              hoverable
              className="min-w-[640px] text-center sm:min-w-full"
            >
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
                    <TableCell className="text-left">{f.filename}</TableCell>
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
                        disabled={removendoId === f.file_id}
                        onClick={() => handleDelete(f)}
                      >
                        {removendoId === f.file_id ? (
                          <Spinner size="sm" />
                        ) : (
                          "Remover"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
