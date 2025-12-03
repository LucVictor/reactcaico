import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  Badge,
} from "flowbite-react";
import api from "../api";

interface Message {
  id: number;
  message: string;
  title: string;
  timestamp?: string;
  create_date?: string;
  read: boolean;
  ok_: boolean;
}

interface MailboxProps {
  open: boolean;
  onClose: () => void;
}

export default function Mailbox({ open, onClose }: MailboxProps) {
  const [mensagens, setMensagens] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Message | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [filter, setFilter] = useState<"todas" | "lidas" | "nao-lidas">(
    "todas",
  );
  const [page, setPage] = useState(1);
  const pageSize = 7;

  const fetchMensagens = async () => {
    try {
      setLoading(true);

      const response = await api.get("/message/mailbox");
      const msgs = Array.isArray(response.data)
        ? response.data
        : (response.data?.messages ?? []);

      // Ordenar por mais recentes primeiro
      msgs.sort((a: Message, b: Message) => {
        const da = new Date(a.timestamp || a.create_date || "0").getTime();
        const db = new Date(b.timestamp || b.create_date || "0").getTime();
        return db - da;
      });

      setMensagens(msgs);
    } catch (e) {
      console.error("Erro ao buscar mensagens:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchMensagens();
  }, [open]);

  const marcarComoLida = async (id: number) => {
    try {
      await api.put(`/message/${id}`, { read: true });
      setMensagens((prev) =>
        prev.map((m) => (m.id === id ? { ...m, read: true } : m)),
      );
    } catch (e) {
      console.error("Erro ao marcar leitura:", e);
    }
  };

  const confirmarOk = async () => {
    if (!selected) return;

    try {
      await api.put(`/message/${selected.id}`, { ok_: true });
      setMensagens((prev) =>
        prev.map((m) => (m.id === selected.id ? { ...m, ok_: true } : m)),
      );
      setViewOpen(false); // Fecha modal
    } catch (e) {
      console.error("Erro no OK:", e);
    }
  };

  const abrirMensagem = (msg: Message) => {
    setSelected(msg);
    setViewOpen(true);

    if (!msg.read) marcarComoLida(msg.id);
  };

  const filtrar = () => {
    if (filter === "lidas") return mensagens.filter((m) => m.read);
    if (filter === "nao-lidas") return mensagens.filter((m) => !m.read);
    return mensagens;
  };

  const msgsFiltradas = filtrar();
  const totalPages = Math.ceil(msgsFiltradas.length / pageSize);
  const paginated = msgsFiltradas.slice((page - 1) * pageSize, page * pageSize);

  const formatDate = (m: Message) => {
    const dt = m.timestamp || m.create_date;
    if (!dt) return "";
    return new Date(dt).toLocaleString();
  };

  return (
    <>
      {/* LISTAGEM */}
      <Modal show={open} onClose={onClose} size="lg">
        <ModalHeader>📨 Mensagens</ModalHeader>
        <ModalBody>
          <div className="mb-2 flex justify-between">
            <Button
              color={filter === "todas" ? "blue" : "gray"}
              onClick={() => setFilter("todas")}
            >
              Todas
            </Button>
            <Button
              color={filter === "nao-lidas" ? "blue" : "gray"}
              onClick={() => setFilter("nao-lidas")}
            >
              Não lidas
            </Button>
            <Button
              color={filter === "lidas" ? "blue" : "gray"}
              onClick={() => setFilter("lidas")}
            >
              Lidas
            </Button>
          </div>

          {loading ? (
            <p>Carregando...</p>
          ) : paginated.length === 0 ? (
            <p className="text-gray-500">Nenhuma mensagem.</p>
          ) : (
            <div className="max-h-96 space-y-2">
              {paginated.map((m) => (
                <div
                  key={m.id}
                  className="cursor-pointer rounded-lg bg-gray-100 p-3 dark:bg-gray-700"
                  onClick={() => abrirMensagem(m)}
                >
                  <p
                    className={`font-semibold ${
                      m.read ? "text-gray-400" : "text-blue-600"
                    }`}
                  >
                    {m.title}
                  </p>

                  <p className="text-xs text-gray-500">{formatDate(m)}</p>

                  {!m.ok_ && (
                    <Badge color="warning" className="mt-1">
                      Pendente de ciência
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </ModalBody>

        <ModalFooter className="flex justify-between">
          {/* PAGINAÇÃO */}
          <div className="flex gap-2">
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
              ◀
            </Button>
            <Button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              ▶
            </Button>
          </div>

          <Button color="red" onClick={onClose}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      {/* VISUALIZAR MENSAGEM */}
      <Modal show={viewOpen} onClose={() => setViewOpen(false)} size="lg">
        <ModalHeader>{selected?.title}</ModalHeader>
        <ModalBody>
          <p className="whitespace-pre-line text-gray-800 dark:text-gray-200">
            {selected?.message}
          </p>

          <p className="mt-3 text-xs text-gray-400">
            {selected && formatDate(selected)}
          </p>

          {selected?.ok_ && (
            <p className="mt-3 font-semibold text-green-600">
              ✔ Você já confirmou ciência.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          {!selected?.ok_ && (
            <Button color="green" onClick={confirmarOk}>
              OK — estou ciente
            </Button>
          )}
          <Button color="red" onClick={() => setViewOpen(false)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
