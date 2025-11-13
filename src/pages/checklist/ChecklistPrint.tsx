import dayjs from "dayjs";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
} from "flowbite-react";

interface ChecklistItem {
  nome: string;
  registros: any[];
  status: { [dia: string]: boolean };
}

interface ChecklistPrintProps {
  checklist: ChecklistItem[];
  diasSemana: string[];
}

export default function ChecklistPrint({
  checklist,
  diasSemana,
}: ChecklistPrintProps) {
  return (
    <div className="p-8 text-black">
      <h1 className="mb-6 text-center text-3xl font-bold">Checklist Semanal</h1>

      <Table striped={false} hoverable={false}>
        <TableHead className="bg-gray-200">
          <TableHeadCell className="w-48 text-center font-semibold">
            Tarefa
          </TableHeadCell>
          {diasSemana.map((dia) => (
            <TableHeadCell key={dia} className="text-center font-semibold">
              {dayjs(dia).format("ddd DD/MM")}
            </TableHeadCell>
          ))}
        </TableHead>
        <TableBody>
          {checklist.map((tarefa, i) => (
            <TableRow key={i} className="text-center">
              <TableCell className="font-semibold">{tarefa.nome}</TableCell>
              {diasSemana.map((dia) => {
                const status = tarefa.status[dia];
                return (
                  <TableCell key={dia} className="text-center">
                    {status ? "✅" : "❌"}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="mt-6 text-center text-sm text-gray-500">
        Gerado em {dayjs().format("DD/MM/YYYY HH:mm")}
      </p>
    </div>
  );
}
