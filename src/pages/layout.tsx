import { ReactNode, useEffect, useState } from "react";
import caicoLogo from "../static/logo.png";
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

  useEffect(() => {
    if (user && locais.length > 0) {
      // procura o local correspondente ao id do token
      const localDoUsuario = locais.find((l) => l.id === user.local);
      if (localDoUsuario) {
        setLocal(localDoUsuario.id, localDoUsuario.name);
      }
    }
  }, [user, locais, setLocal]);

  // Busca locais da API
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
    <div className="dark flex-col">
      <div className="dark flex h-full items-center justify-between p-2">
        {/* Logo */}
        <div>
          <img src={caicoLogo} width={60} />
        </div>

        {/* Navegação */}
        <div className="m-1 flex justify-center gap-2 self-center align-middle">
          <ButtonGroup>
            <Button
              onClick={() => navigate("/vencimentos")}
              color="alternative"
            >
              Vencimentos
            </Button>
            <Button onClick={() => navigate("/avarias")} color="alternative">
              Avarias
            </Button>
            <Button
              onClick={() => navigate("/conferencias")}
              color="alternative"
            >
              Conferências
            </Button>
            <Button onClick={() => navigate("/metas")} color="alternative">
              Metas
            </Button>

            <Button onClick={() => navigate("/pontos")} color="alternative">
              Pontos
            </Button>

            <Button onClick={() => navigate("/tarefas")} color="alternative">
              Tarefas
            </Button>
          </ButtonGroup>

          <Dropdown
            arrowIcon={false}
            inline
            label={
              <Avatar
                alt="User profile"
                img={
                  user?.profile_photo
                    ? `${API_URL}/${user.profile_photo}`
                    : "https://flowbite.com/docs/images/people/profile-picture-1.jpg"
                }
                rounded
              />
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
              <span className="block text-sm">Perfil</span>
            </DropdownItem>
            {user?.admin == 1 ? (
              <DropdownItem onClick={() => navigate("/admin/Logs")}>
                <span className="block text-sm">Adm: Logs</span>
              </DropdownItem>
            ) : (
              ""
            )}
            {user?.admin == 1 ? (
              <>
                <DropdownItem onClick={() => navigate("/admin/pontos")}>
                  <span className="block text-sm">Adm: Pontos</span>
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/admin/rank")}>
                  <span className="block text-sm">Adm: Rank</span>
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/admin/rank/analise")}>
                  <span className="block text-sm">Adm: Analise</span>
                </DropdownItem>{" "}
              </>
            ) : (
              ""
            )}

            <DropdownDivider />
            <DropdownItem onClick={logout}>Sair</DropdownItem>
          </Dropdown>
        </div>
      </div>

      {/* Background animado */}
      <div className="background-animado"></div>

      {/* Página */}
      <div>{pagina}</div>
    </div>
  );
}
