import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";

export interface TaskExportMeta {
  id: number | string;
  userName?: string;
  branchCode?: number | string;
  createdDate?: string;
  completed?: boolean;
}

export interface TaskExportItem {
  code?: string | null;
  product_name?: string;
  name?: string;
  stock_quantity?: number | string | null;
  quantity_system?: number | string | null;
  quantity_real?: number | string | null;
  difference?: number | string | null;
}

interface NormalizedItem {
  code: string;
  productName: string;
  stockQuantity: string;
  quantitySystem: string;
  quantityReal: string;
  difference: string;
}

function toDisplay(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("pt-BR");
}

function toCsvCell(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  const text =
    Number.isNaN(n) || typeof value === "string"
      ? String(value)
      : String(value);
  void n;
  return text;
}

function normalizeItems(items: TaskExportItem[]): NormalizedItem[] {
  return items.map((item) => ({
    code: item.code ?? "—",
    productName: item.product_name ?? item.name ?? "—",
    stockQuantity: toDisplay(item.stock_quantity),
    quantitySystem: toDisplay(item.quantity_system),
    quantityReal: toDisplay(item.quantity_real),
    difference: toDisplay(item.difference),
  }));
}

function formatDate(date?: string): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("pt-BR");
}

function formatDateTimeNow(): string {
  return new Date().toLocaleString("pt-BR");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Exporta para CSV compatível com Excel PT-BR (delimitador `;` + BOM). */
export function exportTaskToExcel(
  items: TaskExportItem[],
  meta: TaskExportMeta,
): void {
  const rows = normalizeItems(items);
  const header = [
    "Código",
    "Produto",
    "Qtd Estoque",
    "Qtd Sistema",
    "Qtd Real",
    "Diferença",
  ];

  const escapeCsv = (value: string): string => {
    const needsQuotes = /[";\n\r]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const lines: string[] = [];
  lines.push(
    `Task #${meta.id}${meta.userName ? ` - ${toCsvCell(meta.userName)}` : ""}`,
  );
  lines.push(
    `Filial: ${meta.branchCode ?? "—"};Data: ${formatDate(meta.createdDate)};Gerado em: ${formatDateTimeNow()}`,
  );
  lines.push("");
  lines.push(header.map(escapeCsv).join(";"));
  for (const r of rows) {
    lines.push(
      [
        r.code,
        r.productName,
        r.stockQuantity,
        r.quantitySystem,
        r.quantityReal,
        r.difference,
      ]
        .map(escapeCsv)
        .join(";"),
    );
  }

  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `task_${meta.id}_produtos.csv`);
}

/** Exporta para PDF A4 usando jsPDF (sem dependências extras). */
export function exportTaskToPdf(
  items: TaskExportItem[],
  meta: TaskExportMeta,
): void {
  const rows = normalizeItems(items);
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const usableWidth = pageWidth - margin * 2;

  // Colunas: Código | Produto | Est. | Sist. | Real | Dif.
  const colWidths = [22, usableWidth - 22 - 18 * 4, 18, 18, 18, 18];
  const colX: number[] = [];
  let acc = margin;
  for (const w of colWidths) {
    colX.push(acc);
    acc += w;
  }

  const title = `Listagem de Produtos - Task #${meta.id}`;
  let cursorY = 16;

  const drawHeader = (page: number, totalPagesPlaceholder = "") => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, margin, cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const subtitle =
      `Filial: ${meta.branchCode ?? "—"}   ` +
      `Data: ${formatDate(meta.createdDate)}   ` +
      (meta.userName ? `Responsável: ${meta.userName}   ` : "") +
      (meta.completed !== undefined
        ? `Status: ${meta.completed ? "Concluída" : "Pendente"}`
        : "");
    const subLines = doc.splitTextToSize(subtitle, usableWidth);
    doc.text(subLines, margin, cursorY + 6);
    doc.setFontSize(8);
    doc.text(
      `Gerado em ${formatDateTimeNow()}${totalPagesPlaceholder || page > 1 ? `  •  Pág. ${page}` : ""}`,
      margin,
      cursorY + 6 + subLines.length * 4 + 2,
    );
    return cursorY + 6 + subLines.length * 4 + 7;
  };

  const drawTableHeader = (y: number) => {
    doc.setFillColor(31, 41, 55);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const headers = ["Código", "Produto", "Estoque", "Sistema", "Real", "Dif."];
    const h = 7;
    doc.rect(margin, y, usableWidth, h, "F");
    headers.forEach((head, i) => {
      doc.text(head, colX[i] + 1.5, y + 4.8);
    });
    doc.setTextColor(0, 0, 0);
    return y + h;
  };

  let page = 1;
  let y = drawHeader(page);
  y = drawTableHeader(y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const lineHeight = 4;
  const cellPadding = 1.5;
  const rowMinHeight = 6.5;

  rows.forEach((row, index) => {
    const productLines = doc.splitTextToSize(
      row.productName,
      colWidths[1] - cellPadding * 2,
    ) as string[];
    const rowHeight = Math.max(
      rowMinHeight,
      productLines.length * lineHeight + cellPadding * 2,
    );

    if (y + rowHeight > pageHeight - 15) {
      doc.setFontSize(8);
      doc.text(
        `Pág. ${page} — Task #${meta.id}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: "right" },
      );
      doc.addPage();
      page += 1;
      cursorY = 16;
      y = drawHeader(page);
      y = drawTableHeader(y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    if (index % 2 === 0) {
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, y, usableWidth, rowHeight, "F");
    }
    doc.setDrawColor(209, 213, 219);
    doc.rect(margin, y, usableWidth, rowHeight, "S");
    for (let i = 1; i < colX.length; i++) {
      doc.line(colX[i], y, colX[i], y + rowHeight);
    }

    const cells = [
      row.code,
      "",
      row.stockQuantity,
      row.quantitySystem,
      row.quantityReal,
      row.difference,
    ];
    cells.forEach((cell, i) => {
      if (i === 1) return; // produto usa múltiplas linhas
      const alignRight = i >= 2;
      const textX = alignRight ? colX[i] + colWidths[i] - 1.5 : colX[i] + 1.5;
      doc.text(cell, textX, y + 4.5, {
        align: alignRight ? "right" : "left",
      });
    });
    productLines.forEach((line, li) => {
      doc.text(line, colX[1] + 1.5, y + 4.5 + li * lineHeight);
    });

    y += rowHeight;
  });

  if (rows.length === 0) {
    doc.text("Nenhum produto nesta task.", margin, y + 8);
  }

  doc.setFontSize(8);
  doc.text(
    `Total de itens: ${rows.length}  •  Pág. ${page} — Task #${meta.id}`,
    margin,
    pageHeight - 8,
  );

  doc.save(`task_${meta.id}_produtos.pdf`);
}

/** Abre janela de impressão A4 com a listagem da task. */
export function printTask(items: TaskExportItem[], meta: TaskExportMeta): void {
  const rows = normalizeItems(items);
  const janela = window.open("", "_blank");
  if (!janela) return;

  const rowsHtml =
    rows.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:16px;">Nenhum produto nesta task.</td></tr>`
      : rows
          .map(
            (r, i) => `<tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(r.code)}</td>
              <td class="prod">${escapeHtml(r.productName)}</td>
              <td>${escapeHtml(r.stockQuantity)}</td>
              <td>${escapeHtml(r.quantitySystem)}</td>
              <td>${escapeHtml(r.quantityReal)}</td>
              <td>${escapeHtml(r.difference)}</td>
            </tr>`,
          )
          .join("");

  janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Task #${escapeHtml(String(meta.id))} - Listagem de Produtos</title>
<style>
  @page { size: A4; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 0; }
  .sheet { max-width: 190mm; margin: 0 auto; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #333; margin-bottom: 12px; }
  .meta strong { color: #000; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #999; padding: 5px 4px; text-align: center; }
  th { background: #eee; font-weight: bold; }
  td.prod { text-align: left; }
  tr:nth-child(even) td { background: #f7f7f7; }
  .footer { margin-top: 14px; font-size: 10px; color: #333; display: flex; justify-content: space-between; }
  .sign { margin-top: 28px; display: flex; gap: 24px; }
  .sign div { flex: 1; border-top: 1px solid #000; padding-top: 4px; font-size: 10px; text-align: center; }
  @media print {
    .no-print { display: none; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <h1>Listagem de Produtos — Task #${escapeHtml(String(meta.id))}</h1>
    <div class="meta">
      <strong>Filial:</strong> ${escapeHtml(String(meta.branchCode ?? "—"))} &nbsp;•&nbsp;
      <strong>Data:</strong> ${escapeHtml(formatDate(meta.createdDate))} &nbsp;•&nbsp;
      ${meta.userName ? `<strong>Responsável:</strong> ${escapeHtml(meta.userName)} &nbsp;•&nbsp;` : ""}
      ${meta.completed !== undefined ? `<strong>Status:</strong> ${meta.completed ? "Concluída" : "Pendente"} &nbsp;•&nbsp;` : ""}
      <strong>Total:</strong> ${rows.length} item(ns) &nbsp;•&nbsp;
      <strong>Gerado em:</strong> ${escapeHtml(formatDateTimeNow())}
    </div>
    <table>
      <thead><tr>
        <th style="width:28px">#</th>
        <th style="width:70px">Código</th>
        <th>Produto</th>
        <th style="width:60px">Qtd Est.</th>
        <th style="width:60px">Qtd Sist.</th>
        <th style="width:60px">Qtd Real</th>
        <th style="width:55px">Dif.</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="footer">
      <span>Documento gerado pelo sistema de conferência.</span>
      <span>Página A4 • retrato</span>
    </div>
    <div class="sign">
      <div>Conferente (nome e assinatura)</div>
      <div>Responsável (nome e assinatura)</div>
      <div>Data: ____ / ____ / ________</div>
    </div>
  </div>
  <script>window.onload = function(){ window.focus(); window.print(); }<\/script>
</body>
</html>`);
  janela.document.close();
  janela.focus();
}
