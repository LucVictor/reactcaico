import { ReactNode, useEffect, useState } from "react";
import caicoLogo from "../static/logo.png";
import { useAuthStore } from "./authStore";
import { useLocalDeEstoque } from "./localEstoque";
import Mailbox from "./Mailbox";

import { API_URL } from "../api";
import {
  Button,
  ButtonGroup,
  Dropdown,
  DropdownHeader,
  Avatar,
  DropdownItem,
  DropdownDivider,
} from "flowbite-react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./styles.css";
import avatar from "../static/user.png";
import WarningBar from "./warning";
import { ThemeLogo } from "../theme/ThemeLogo";
import { ThemeMenuItems } from "../theme/ThemeMenuItems";
import { HolidayBadge } from "../theme/HolidayBadge";

interface paginaProps {
  pagina: ReactNode;
}

interface Local {
  id: number;
  name: string;
}

interface Message {
  id: number;
  read: boolean;
}

export default function Layout({ pagina }: paginaProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const { localName, setLocal } = useLocalDeEstoque();

  const [locais, setLocais] = useState<Local[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messagesOpen, setMessagesOpen] = useState(false);

  const logout = () => {
    clearUser();
    navigate("/login");
  };

  // Carrega locais
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

  // Sincroniza local do usuário
  useEffect(() => {
    if (user && locais.length > 0) {
      const localDoUsuario = locais.find((l) => l.id === user.local);
      if (localDoUsuario) {
        setLocal(localDoUsuario.id, localDoUsuario.name);
      }
    }
  }, [user, locais]);

  // Carrega contador de mensagens não lidas
  useEffect(() => {
    async function fetchMensagens() {
      try {
        const res = await api.get("/message/mailbox");

        const msgs: Message[] = Array.isArray(res.data)
          ? res.data
          : (res.data?.messages ?? []);

        const unread = msgs.filter((m) => !m.read).length;
        setUnreadCount(unread);
      } catch (e) {
        console.error("Erro ao buscar mensagens:", e);
      }
    }

    fetchMensagens();
  }, []);

  const navItems = [
    { label: "Vencimentos", path: "/vencimentos" },
    { label: "Avarias", path: "/avarias" },
    { label: "Conferências", path: "/conferencias" },
    { label: "Recebimentos", path: "/recebimento" },
    { label: "Metas", path: "/metas" },
    { label: "Pontos", path: "/pontos" },
    { label: "Checklist", path: "/checklist" },
    { label: "Tarefas", path: "/tasks" },
    { label: "Auditoria", path: "/auditoria" },
  ];

  return (
    <div className="dark relative min-h-screen flex-col">
      <WarningBar />
      <div className="background-animado"></div>
      <div className="top-bar relative z-20 flex h-16 items-center justify-between gap-2 p-2">
        {/* LOGO */}
        <div className="flex shrink-0 items-center gap-3">
          <ThemeLogo src={caicoLogo} width={52} />
          <HolidayBadge className="theme-holiday-badge--header" />
        </div>

        {/* NAV */}
        <div className="flex min-w-0 items-center gap-2">
          {/* Navegação completa (tablet/desktop) */}
          <div className="hidden xl:block">
            <ButtonGroup>
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  color="alternative"
                >
                  {item.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>

          {/* Menu compacto para celular */}
          <div className="xl:hidden">
            <Dropdown
              inline
              label="Menu"
              className="max-h-[70vh] overflow-y-auto"
            >
              {navItems.map((item) => (
                <DropdownItem
                  key={item.path}
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </DropdownItem>
              ))}
            </Dropdown>
          </div>

          {/* DROPDOWN DO AVATAR */}
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
              </div>
            }
          >
            <DropdownHeader>
              <span className="block text-sm">
                {user ? user.name : "Carregando..."}
              </span>
            </DropdownHeader>

            <DropdownItem disabled>Local de estoque: {localName}</DropdownItem>

            {/* BOTÃO MENSAGENS */}
            <DropdownItem onClick={() => setMessagesOpen(true)}>
              <div className="relative">
                <span>Mensagens</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-6 rounded-full bg-red-500 px-2 text-xs text-white">
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
                <DropdownItem onClick={() => navigate("/admin/receipt")}>
                  Adm: Recebimentos
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
                <DropdownItem onClick={() => navigate("/admin/tasks")}>
                  Adm: Tarefas
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/admin/avarias")}>
                  Adm: Aprovar Avarias
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/admin/conferencias")}>
                  Adm: Aprovar Conferências
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/task/admin/export")}>
                  Adm: Exportação
                </DropdownItem>
              </>
            )}

            <ThemeMenuItems />

            <DropdownDivider />

            <DropdownItem onClick={logout}>Sair 🔴</DropdownItem>
          </Dropdown>
        </div>
      </div>

      {/* CAIXA DE MENSAGENS */}
      <Mailbox open={messagesOpen} onClose={() => setMessagesOpen(false)} />

      {/* CONTEÚDO DA PÁGINA */}
      <div className="relative z-10 p-2 sm:p-4">{pagina}</div>
    </div>
  );
}
