// Cells that start with these characters can run as formulas in spreadsheet programs.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  let text = "";
  if (Array.isArray(value)) text = value.join("; ");
  else if (value !== null && value !== undefined) text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

// columns: [{ header, value(row) }]. Every cell is quoted, so commas and line breaks stay inside the cell.
export function toCsv(columns, rows) {
  const header = columns.map((column) => csvCell(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(","));
  return `${[header, ...lines].join("\r\n")}\r\n`;
}
