import { useEffect, useState, useMemo } from "react";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Select,
  Checkbox,
  Spinner,
} from "flowbite-react";
import api from "../../api";

export default function ChecklistSemana() {
  const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const [conferencias, setConferencias] = useState([]);
  const [semanaSelecionada, setSemanaSelecionada] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [checks, setChecks] = useState({});

  // 📦 Busca conferências da API
  const fetchConferencias = async () => {
    try {
      const res = await api.get("/conference/");
      setConferencias(res.data);
    } catch (err) {
      console.error("Erro ao buscar conferências:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    fetchConferencias();
  }, []);

  // 🗓️ Agrupa conferências por semana (ano + número da semana)
  const conferenciasPorSemana = useMemo(() => {
    const agrupado = {};
    for (const conf of conferencias) {
      const data = new Date(conf.date_);
      const ano = data.getFullYear();
      const numeroSemana = getNumeroSemana(data);
      const chave = `${ano}-S${numeroSemana}`;
      agrupado[chave] = agrupado[chave] || [];
      agrupado[chave].push(conf);
    }
    return agrupado;
  }, [conferencias]);

  // 📅 Calcula o intervalo de datas da semana selecionada
  const diasDaSemanaSelecionada = useMemo(() => {
    if (!semanaSelecionada) return [];
    const [ano, semanaStr] = semanaSelecionada.split("-S");
    const numeroSemana = parseInt(semanaStr);
    const primeiraData = getPrimeiroDiaDaSemana(ano, numeroSemana);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(primeiraData);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [semanaSelecionada]);

  // 🧮 Funções auxiliares
  function getNumeroSemana(data) {
    const d = new Date(
      Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()),
    );
    const diaSemana = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
    const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const numeroSemana = Math.ceil(((d - inicioAno) / 86400000 + 1) / 7);
    return numeroSemana;
  }

  function getPrimeiroDiaDaSemana(ano, numeroSemana) {
    const simples = new Date(ano, 0, 1 + (numeroSemana - 1) * 7);
    const diaSemana = simples.getDay();
    const inicio = simples;
    if (diaSemana <= 4)
      inicio.setDate(simples.getDate() - simples.getDay() + 1);
    else inicio.setDate(simples.getDate() + 8 - simples.getDay());
    return inicio;
  }

  const toggleCheck = (confId, diaIndex) => {
    setChecks((prev) => {
      const novos = { ...prev };
      novos[confId] = novos[confId] || Array(7).fill(false);
      novos[confId][diaIndex] = !novos[confId][diaIndex];
      return novos;
    });
  };

  if (carregando)
    return (
      <div className="mt-20 flex justify-center">
        <Spinner size="xl" />
      </div>
    );

  return (
    <div className="mx-auto mt-10 max-w-6xl rounded-2xl p-6 shadow-lg dark:bg-gray-800">
      <h1 className="mb-6 text-center text-2xl font-bold">Checklist Semanal</h1>

      {/* Seletor de semana */}
      <div className="mb-6 flex items-center gap-4">
        <Select
          value={semanaSelecionada}
          onChange={(e) => setSemanaSelecionada(e.target.value)}
        >
          <option value="">Selecione a semana</option>
          {Object.keys(conferenciasPorSemana).map((sem) => (
            <option key={sem} value={sem}>
              {sem}
            </option>
          ))}
        </Select>
      </div>

      {semanaSelecionada && (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHead>
              <TableHeadCell>Conferência</TableHeadCell>
              {diasDaSemanaSelecionada.map((data, idx) => (
                <TableHeadCell key={idx}>
                  <div className="text-center">
                    {diasSemana[idx]}
                    <div className="text-xs text-gray-400">
                      {data.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </div>
                  </div>
                </TableHeadCell>
              ))}
            </TableHead>

            <TableBody>
              {conferenciasPorSemana[semanaSelecionada]?.map((conf) => (
                <TableRow key={conf.id} className="hover:bg-gray-700">
                  <TableCell className="font-medium">
                    {conf.product_name}
                  </TableCell>
                  {diasDaSemanaSelecionada.map((_, iDia) => (
                    <TableCell key={iDia} className="text-center">
                      <Checkbox
                        checked={checks[conf.id]?.[iDia] || false}
                        onChange={() => toggleCheck(conf.id, iDia)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
