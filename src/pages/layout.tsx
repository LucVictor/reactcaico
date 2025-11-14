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
} from "flowbite-react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./styles.css";
import avatar from "../static/user.png";
interface paginaProps {
  pagina: ReactNode;
}

interface Local {
  id: number;
  name: string;
}

export default function Layout({ pagina }: paginaProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const { localName, setLocal } = useLocalDeEstoque();
  const [locais, setLocais] = useState<Local[]>([]);

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
  }, [user, locais, setLocal]);

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

  return (
    <div className="dark relative min-h-screen flex-col">
      {/* Fundo e neve */}
      <div className="background-animado"></div>
      {snowEnabled && <div className="snow"></div>}

      {/* Navbar */}
      <div className="top-bar relative z-20 flex h-16 items-center justify-between p-2">
        {/* Logo */}
        <div
          className={`christmas-logo relative z-10 ${logoGlowEnabled ? "" : "no-glow"}`}
        >
          <img src={caicoLogo} width={60} alt="Logo" />
        </div>

        {/* Navegação */}
        <div className="flex gap-2">
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

            {/* Botão para ligar/desligar neve e brilho do logo */}
            <DropdownItem
              onClick={() => {
                setSnowEnabled((prev) => !prev);
                setLogoGlowEnabled((prev) => !prev);
              }}
            >
              <span className="block text-sm">
                {snowEnabled && logoGlowEnabled
                  ? "Desligar efeitos natalinos ✨"
                  : "Ligar efeitos natalinos 🎄"}
              </span>
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
