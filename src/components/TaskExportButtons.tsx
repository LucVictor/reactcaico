import { Button } from "flowbite-react";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import {
  exportTaskToExcel,
  exportTaskToPdf,
  printTask,
  type TaskExportItem,
  type TaskExportMeta,
} from "../utils/taskExport";

interface TaskExportButtonsProps {
  items: TaskExportItem[];
  meta: TaskExportMeta;
  disabled?: boolean;
  size?: "xs" | "sm";
}

export default function TaskExportButtons({
  items,
  meta,
  disabled = false,
  size = "xs",
}: TaskExportButtonsProps) {
  const isDisabled = disabled || items.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size={size}
        color="success"
        disabled={isDisabled}
        onClick={() => exportTaskToExcel(items, meta)}
        title="Exportar listagem para Excel (CSV)"
      >
        <FileSpreadsheet className="mr-1 h-4 w-4" />
        Excel
      </Button>
      <Button
        size={size}
        color="failure"
        disabled={isDisabled}
        onClick={() => exportTaskToPdf(items, meta)}
        title="Exportar listagem para PDF (folha A4)"
      >
        <FileText className="mr-1 h-4 w-4" />
        PDF
      </Button>
      <Button
        size={size}
        color="gray"
        disabled={isDisabled}
        onClick={() => printTask(items, meta)}
        title="Imprimir listagem (folha A4)"
      >
        <Printer className="mr-1 h-4 w-4" />
        Imprimir
      </Button>
    </div>
  );
}
