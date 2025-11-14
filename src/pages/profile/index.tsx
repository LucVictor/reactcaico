import React, { useState } from "react";
import { useAuthStore } from "../authStore";
import { useNavigate } from "react-router-dom";
import avatar from "../../static/user.png";

import {
  Button,
  Modal,
  ModalBody,
  ModalHeader,
  Avatar,
  Label,
  TextInput,
} from "flowbite-react";
import api, { API_URL } from "../../api";

export interface ProfileProps {
  id: number;
  name: string;
  email: string;
  local: number;
  admin: number;
  profile_photo: string;
}

function ProfileComponente() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [openModalSenha, setOpenModalSenha] = useState(false);
  const [openModalFoto, setOpenModalFoto] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const clearUser = useAuthStore((s) => s.clearUser);
  const navigate = useNavigate();

  // --- Upload da foto ---
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoArquivo(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const enviarFoto = async () => {
    const formData = new FormData();
    if (fotoArquivo) {
      formData.append("file", fotoArquivo); // ✅ tipo File
    } else {
      console.warn("Nenhum arquivo selecionado");
    }

    const response = await api.post("/profile/upload-photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const novaFoto = `${response.data.profile_photo}`;
    updateUser({ profile_photo: novaFoto });
  };

  // --- Trocar senha ---
  const alterarSenha = async () => {
    try {
      await api.put("/profile/change-password", {
        password: senhaAtual,
        new_password: novaSenha,
      });
      alert("Senha alterada com sucesso!");
      clearUser();
      navigate("/login");
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      alert("Falha ao alterar senha.");
    }
  };

  return (
    <div className="margin-5 m-auto flex w-fit max-w-full flex-col gap-4 overflow-x-auto rounded-2xl p-5 opacity-95 dark:bg-gray-800">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar
          img={
            user?.profile_photo
              ? `${API_URL}/${user.profile_photo}`
              : "https://flowbite.com/docs/images/people/profile-picture-1.jpg"
          }
          size="xl"
          rounded
        />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {user?.name}
        </h2>
        <p className="text-gray-500">{user?.email}</p>

        <div className="mt-2 flex gap-2">
          <Button color="dark" onClick={() => setOpenModalFoto(true)}>
            Trocar foto
          </Button>
          <Button color="dark" onClick={() => setOpenModalSenha(true)}>
            Alterar senha
          </Button>
        </div>
      </div>

      {/* Modal Trocar Senha */}
      <Modal show={openModalSenha} onClose={() => setOpenModalSenha(false)}>
        <ModalHeader>Alterar Senha</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Digite a senha atual:</Label>
              <Label htmlFor="senhaAtual" />
              <TextInput
                id="senhaAtual"
                type="password"
                value={senhaAtual}
                placeholder="Senha atual"
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Digite a nova senha:</Label>
              <Label htmlFor="novaSenha" />
              <TextInput
                id="novaSenha"
                type="password"
                placeholder="Nova senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
              />
            </div>
            <Button color="dark" onClick={alterarSenha}>
              Salvar
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Modal Trocar Foto */}
      <Modal show={openModalFoto} onClose={() => setOpenModalFoto(false)}>
        <ModalHeader>Trocar Foto de Perfil</ModalHeader>
        <ModalBody>
          <div className="flex flex-col items-center gap-4">
            {fotoPreview ? (
              <img
                src={fotoPreview}
                alt="Pré-visualização"
                className="h-32 w-32 rounded-full object-cover"
              />
            ) : (
              <Avatar
                img={
                  user?.profile_photo
                    ? `${API_URL}/${user.profile_photo}`
                    : avatar
                }
                size="xl"
                rounded
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-900"
            />
            <Button color="green" onClick={enviarFoto}>
              Enviar Foto
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
}

export default function IndexProfile() {
  return (
    <div className="m-5 w-full max-w-full">
      <ProfileComponente />
    </div>
  );
}
