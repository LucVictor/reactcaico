import { ReactNode, useEffect, useState } from "react";
import caicoLogo from "../static/logo.png";
import santahat from "../static/santa-hat.png";
import { useAuthStore } from "./authStore";
import { useLocalDeEstoque } from "./localEstoque";

import { API_URL } from "../api";
import {
  Button,
  ButtonGroup,
  Dropdown,
  DropdownHeader,
  Avatar,
  DropdownItem,
  DropdownDivider,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "flowbite-react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./styles.css";
import avatar from "../static/user.png";
import WarningBar from "./warning";

interface paginaProps {
  pagina: ReactNode;
}

interface Local {
  id: number;
  name: string;
}

interface Message {
  id?: number;
  message?: string;
  title?: string;
  timestamp?: string;
  create_date?: string;
  read?: boolean | null;
  ok_?: any;
  [k: string]: any;
}

export default function Layout({ pagina }: paginaProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const { localName, setLocal } = useLocalDeEstoque();

  const [locais, setLocais] = useState<Local[]>([]);
  const [mensagens, setMensagens] = useState<Message[]>([]);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertModal, setAlertModal] = useState(false);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [viewMessageOpen, setViewMessageOpen] = useState(false);

  // Marca como lida ao abrir
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

  // Abrir mensagem (modal)
  const abrirMensagem = (msg: Message) => {
    setSelectedMessage(msg);
    setViewMessageOpen(true);

    if (!msg.read) marcarComoLida(msg.id!);
  };

  // Botão OK — estou ciente
  const confirmarOk = async () => {
    if (!selectedMessage) return;

    try {
      await api.put(`/message/${selectedMessage.id}`, { ok_: true });

      setMensagens((prev) =>
        prev.map((m) =>
          m.id === selectedMessage.id ? { ...m, ok_: true } : m,
        ),
      );

      setViewMessageOpen(false);
    } catch (e) {
      console.error("Erro no OK:", e);
    }
  };

  // Buscar mensagens
  useEffect(() => {
    async function fetchMensagens() {
      try {
        const response = await api.get("/message/mailbox");
        const data = response.data;

        let msgs: Message[] = [];

        if (!data) msgs = [];
        else if (Array.isArray(data)) msgs = data;
        else if (typeof data === "object") {
          msgs = Array.isArray(data.messages)
            ? data.messages
            : [data as Message];
        }

        const unread = msgs.filter((m) => !m.read).length;
        setMensagens(msgs);
        setUnreadCount(unread);

        if (unread > 0) {
          setAlertModal(true);
        }
      } catch (err) {
        console.error("Erro ao buscar mensagens:", err);
      }
    }

    fetchMensagens();
  }, []);

  const logout = () => {
    clearUser();
    navigate("/login");
  };

  const [snowEnabled, setSnowEnabled] = useState(true);
  const [logoGlowEnabled, setLogoGlowEnabled] = useState(true);

  useEffect(() => {
    if (user && locais.length > 0) {
      const localDoUsuario = locais.find((l) => l.id === user.local);
      if (localDoUsuario) setLocal(localDoUsuario.id, localDoUsuario.name);
    }
  }, [user, locais]);

  useEffect(() => {
    async function fetchLocais() {
      try {
        const response = await api.get("/local/");
        setLocais(response.data);
      } catch (err) {
        console.error("Erro ao buscar locais:", err);
      }
    }
    fetchLocais();
  }, []);

  const formatDate = (m: Message) => {
    const dt = m.timestamp || m.create_date || m.created_at;
    if (!dt) return "";
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return String(dt);
    }
  };

  return (
    <div className="dark relative min-h-screen flex-col">
      <WarningBar />
      <div className="background-animado"></div>
      {snowEnabled && <div className="snow"></div>}

      <div className="top-bar relative z-20 flex h-16 items-center justify-between p-2">
        {/* Modal ALERTA */}
        <Modal show={alertModal} onClose={() => setAlertModal(false)} size="md">
          <ModalHeader>📢 Aviso de Mensagens</ModalHeader>
          <ModalBody>
            <p className="text-center text-gray-800 dark:text-gray-200">
              Você possui <strong>{unreadCount}</strong> mensagem(ns) não
              lida(s).
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="blue"
              onClick={() => {
                setAlertModal(false);
                setMessagesOpen(true);
              }}
            >
              Ver Mensagens
            </Button>
            <Button color="red" onClick={() => setAlertModal(false)}>
              Fechar
            </Button>
          </ModalFooter>
        </Modal>

        {/* Modal LISTA */}
        <Modal
          show={messagesOpen}
          onClose={() => setMessagesOpen(false)}
          size="lg"
        >
          <ModalHeader>📨 Mensagens</ModalHeader>
          <ModalBody>
            {mensagens.length === 0 ? (
              <p className="text-gray-500">Nenhuma mensagem disponível.</p>
            ) : (
              <div className="max-h-96 space-y-3">
                {mensagens.map((m, i) => (
                  <div
                    key={m.id ?? i}
                    className="rounded-lg bg-gray-100 p-3 dark:bg-gray-700"
                  >
                    <p
                      className={`cursor-pointer text-sm font-semibold ${
                        m.read ? "text-gray-500" : "text-blue-700"
                      }`}
                      onClick={() => {
                        setMessagesOpen(false);
                        abrirMensagem(m);
                      }}
                    >
                      {m.title || "Mensagem"}
                    </p>

                    {formatDate(m) && (
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(m)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="red" onClick={() => setMessagesOpen(false)}>
              Fechar
            </Button>
          </ModalFooter>
        </Modal>

        {/* Modal VISUALIZAR MENSAGEM */}
        <Modal
          show={viewMessageOpen}
          onClose={() => setViewMessageOpen(false)}
          size="lg"
        >
          <ModalHeader>{selectedMessage?.title || "Mensagem"}</ModalHeader>

          <ModalBody>
            <p className="whitespace-pre-line text-gray-800 dark:text-gray-200">
              {selectedMessage?.message}
            </p>

            {selectedMessage?.timestamp && (
              <p className="mt-3 text-xs text-gray-400">
                {formatDate(selectedMessage)}
              </p>
            )}

            {selectedMessage?.ok_ && (
              <p className="mt-3 font-semibold text-green-600">
                ✔ Você já confirmou ciência desta mensagem.
              </p>
            )}
          </ModalBody>

          <ModalFooter>
            {!selectedMessage?.ok_ && (
              <Button color="green" onClick={confirmarOk}>
                OK — estou ciente
              </Button>
            )}

            <Button color="red" onClick={() => setViewMessageOpen(false)}>
              Fechar
            </Button>
          </ModalFooter>
        </Modal>

        {/* Logo */}
        <div className={`christmas-logo ${logoGlowEnabled ? "logo-glow" : ""}`}>
          <img src={caicoLogo} width={60} />
        </div>

        {/* NAV */}
        <div className="flex items-center gap-2">
          <ButtonGroup>
            <Button
              onClick={() => navigate("/vencimentos")}
              color="alternative"
            >
              🎄 Vencimentos
            </Button>
            <Button onClick={() => navigate("/avarias")} color="alternative">
              ❄️ Avarias
            </Button>
            <Button
              onClick={() => navigate("/conferencias")}
              color="alternative"
            >
              ⛄ Conferências
            </Button>
            <Button
              onClick={() => navigate("/recebimento")}
              color="alternative"
            >
              🎁 Recebimentos
            </Button>
            <Button onClick={() => navigate("/metas")} color="alternative">
              ⭐ Metas
            </Button>
            <Button onClick={() => navigate("/pontos")} color="alternative">
              🔔 Pontos
            </Button>
            <Button onClick={() => navigate("/checklist")} color="alternative">
              🕯️ Checklist
            </Button>
          </ButtonGroup>

          {/* Dropdown com avatar */}
          <Dropdown
            arrowIcon={false}
            inline
            className="dropdown-fix"
            label={
              <div className="relative inline-block">
                <Avatar
                  alt="User profile"
                  img={
                    user?.profile_photo
                      ? `${API_URL}/${user.profile_photo}`
                      : avatar
                  }
                  className="relative z-10 ring-2 ring-red-500"
                  rounded
                />
                <img
                  src={santahat}
                  alt="Chapéu de Natal"
                  className="absolute -top-3 -right-1 z-20 w-6 rotate-12"
                />
              </div>
            }
          >
            <DropdownHeader>
              <span className="block text-sm">
                {user ? user.name : "Carregando..."}
              </span>
            </DropdownHeader>

            <DropdownItem>
              <span className="block text-sm">
                Local de estoque: {localName}
              </span>
            </DropdownItem>

            <DropdownItem onClick={() => setMessagesOpen(true)}>
              <div>
                <span>Mensagens</span>
                {unreadCount > 0 && (
                  <span className="absolute rounded-full bg-red-500 px-2 text-xs text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
            </DropdownItem>

            <DropdownItem onClick={() => navigate("/profile")}>
              Perfil
            </DropdownItem>

            {user?.admin === 1 && (
              <>
                <DropdownItem onClick={() => navigate("/admin/Logs")}>
                  Adm: Logs
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/admin/checklist")}>
                  Adm: Checklist
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/admin/pontos")}>
                  Adm: Pontos
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/admin/rank")}>
                  Adm: Rank
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/admin/rank/analise")}>
                  Adm: Rank Analise
                </DropdownItem>
                <DropdownItem
                  onClick={() => navigate("/admin/conferencia/analise")}
                >
                  Adm: Conferência Analise
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/admin/metas")}>
                  Adm: Conferência Meta
                </DropdownItem>
              </>
            )}

            <DropdownDivider />

            <DropdownItem
              onClick={() => {
                setSnowEnabled((prev) => !prev);
                setLogoGlowEnabled((prev) => !prev);
              }}
            >
              {snowEnabled && logoGlowEnabled
                ? "Desligar efeitos natalinos 🎄"
                : "Ligar efeitos natalinos ✨"}
            </DropdownItem>

            <DropdownDivider />

            <DropdownItem onClick={logout}>Sair 🔴</DropdownItem>
          </Dropdown>
        </div>
      </div>

      {/* Página */}
      <div className="relative z-10 p-4">{pagina}</div>
    </div>
  );
}
