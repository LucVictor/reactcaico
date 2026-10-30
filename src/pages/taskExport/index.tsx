import { AxiosError } from "axios";
import { saveAs } from "file-saver";
import {
  Alert,
  Button,
  Card,
  Label,
  Select,
  Spinner,
  TextInput,
} from "flowbite-react";
import { useEffect, useState } from "react";
import api from "../../api";
import { useAuthStore } from "../authStore";

interface UserOption {
  id: number;
  name: string;
  username?: string;
}

type Feedback = { type: "success" | "error"; text: string } | null;

function getDefaultDateRange() {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 29);

  return {
    dateFrom: formatDateInput(start),
    dateTo: formatDateInput(end),
  };
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractFilenameFromDisposition(disposition?: string) {
  if (!disposition) return null;

  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  const legacyMatch = disposition.match(/filename="?([^";]+)"?/i);
  return legacyMatch?.[1] ?? null;
}

async function readErrorMessage(error: unknown): Promise<string> {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data;

    if (responseData instanceof Blob) {
      try {
        const text = await responseData.text();
        const parsed = JSON.parse(text);
        if (typeof parsed?.detail === "string") return parsed.detail;
        if (typeof parsed?.message === "string") return parsed.message;
      } catch {
        return "Não foi possível exportar o relatório solicitado.";
      }
    }

    if (typeof responseData === "object" && responseData !== null) {
      const detail = (responseData as { detail?: string; message?: string })
        .detail;
      const message = (responseData as { detail?: string; message?: string })
        .message;
      if (detail) return detail;
      if (message) return message;
    }

    if (error.response?.status === 400) {
      return "O período informado está inválido. Verifique a data inicial e final.";
    }

    if (error.response?.status === 403) {
      return "Acesso negado para esta exportação.";
    }

    return "Erro ao exportar o relatório. Tente novamente.";
  }

  return "Erro ao exportar o relatório. Tente novamente.";
}

function TaskExportReportPage({ adminMode }: { adminMode?: boolean }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(adminMode || user?.admin === 1);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(getDefaultDateRange().dateFrom);
  const [dateTo, setDateTo] = useState(getDefaultDateRange().dateTo);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!isAdmin) {
      if (user?.id) setSelectedUserId(String(user.id));
      return;
    }

    api
      .get("/admin/users")
      .then((response) => setUsers(Array.isArray(response.data) ? response.data : []))
      .catch((err) => {
        console.error("Erro ao carregar usuários para exportação:", err);
      });
  }, [isAdmin, user?.id]);

  const handleExport = async () => {
    setFeedback(null);

    if (!dateFrom || !dateTo) {
      setFeedback({
        type: "error",
        text: "Selecione as datas inicial e final para exportar.",
      });
      return;
    }

    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFeedback({
        type: "error",
        text: "As datas informadas são inválidas.",
      });
      return;
    }

    if (start > end) {
      setFeedback({
        type: "error",
        text: "A data inicial não pode ser maior que a data final.",
      });
      return;
    }

    const params = {
      date_from: dateFrom,
      date_to: dateTo,
      ...(isAdmin && selectedUserId ? { user_id: Number(selectedUserId) } : {}),
    };

    try {
      setLoading(true);
      const response = await api.get(isAdmin ? "/task/admin/export" : "/task/export", {
        params,
        responseType: "blob",
      });

      const contentType =
        String(response.headers["content-type"] || "application/octet-stream");
      const filename =
        extractFilenameFromDisposition(response.headers["content-disposition"]) ||
        (isAdmin ? "relatorio_admin.xlsx" : "relatorio_usuario.xlsx");

      const blob = new Blob([response.data], { type: contentType });
      saveAs(blob, filename);

      setFeedback({
        type: "success",
        text: isAdmin
          ? "Exportação administrativa concluída com sucesso."
          : "Seu relatório foi exportado com sucesso.",
      });
    } catch (error) {
      const message = await readErrorMessage(error);
      setFeedback({
        type: "error",
        text: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Card className="shadow-md">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {isAdmin ? "Exportação Administrativa" : "Exportação de Relatório"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isAdmin
              ? "Selecione o período e, opcionalmente, um usuário para exportar os dados completos."
              : "Selecione o período para exportar os registros vinculados ao seu usuário."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="date-from">Data inicial</Label>
            <TextInput
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="date-to">Data final</Label>
            <TextInput
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>

        {isAdmin && (
          <div className="mt-4">
            <Label htmlFor="user-filter">Usuário</Label>
            <Select
              id="user-filter"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              <option value="">Todos os usuários</option>
              {users.map((userOption) => (
                <option key={userOption.id} value={userOption.id}>
                  {userOption.name}
                  {userOption.username ? ` (${userOption.username})` : ""}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end">
          <Button onClick={handleExport} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Exportar Excel"}
          </Button>
        </div>

        {feedback && (
          <Alert
            color={feedback.type === "success" ? "success" : "failure"}
            className="mt-4"
          >
            {feedback.text}
          </Alert>
        )}
      </Card>
    </div>
  );
}

export function TaskExportPage() {
  return <TaskExportReportPage />;
}

export function AdminTaskExportPage() {
  return <TaskExportReportPage adminMode />;
}
