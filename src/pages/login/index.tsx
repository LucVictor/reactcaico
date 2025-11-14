import { Button, TextInput, Label } from "flowbite-react";
import caicoLogo from "../../static/logo.png";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../authStore"; // 🔹 importar a store
import { API_URL } from "../../api";
import "./styles.css";

interface UserProps {
  username: string;
  password: string;
}

export default function Login() {
  const [user, setUser] = useState<UserProps>({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();
  const setUserFromToken = useAuthStore((state) => state.setUserFromToken);

  const handleAction = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const loginAPI = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });

      if (!loginAPI.ok) {
        setErrorMsg("Usuário ou senha inválidos!");
        setLoading(false);
        return;
      }

      const res = await loginAPI.json();
      const token = res.access_token;

      // 🔹 Atualiza o Zustand com os dados do usuário
      setUserFromToken(token);

      // Redireciona
      navigate("/pontos");
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen flex-col">
      <div className="snow z-0"></div>
      <div className="background-animado"></div>
      <div className="dark flex h-100 min-h-screen items-center justify-center align-middle">
        <div className="flex flex-col gap-1 rounded-2xl border border-solid border-gray-700 bg-gray-700 p-5 text-center align-middle text-white opacity-90">
          <div className="christmas-logo">
            <img src={caicoLogo} className="mx-auto" />
          </div>

          <div>
            <h3>Digite suas credenciais</h3>
          </div>

          <div className="flex flex-col gap-1 text-left">
            <Label>Usuário</Label>
            <TextInput
              placeholder="Digite o usuário"
              value={user.username}
              onChange={(e) =>
                setUser({ ...user, username: String(e.target.value) })
              }
              type="text"
            />

            <Label>Senha:</Label>
            <TextInput
              placeholder="Digite a senha"
              value={user.password}
              onChange={(e) =>
                setUser({ ...user, password: String(e.target.value) })
              }
              type="password"
            />

            {errorMsg && <p className="text-red-400">{errorMsg}</p>}

            <Button onClick={handleAction} disabled={loading}>
              {loading ? "Entrando..." : "Logar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
