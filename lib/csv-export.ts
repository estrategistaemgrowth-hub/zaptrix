import Papa from 'papaparse';

/**
 * Gera e baixa um CSV no navegador (client-side puro, sem round-trip ao
 * servidor). BOM UTF-8 no início pra Excel abrir acentuação corretamente —
 * sem ele, "ç"/"ã" viram lixo quando o arquivo é aberto direto no Excel.
 */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
