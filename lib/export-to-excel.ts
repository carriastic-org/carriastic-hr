"use client";

import type { CellObject, CellStyle, WorkSheet } from "xlsx-js-style";
import * as XLSX from "xlsx-js-style";

type RowValue = string | number | boolean | Date | null | undefined;

export type ExcelRow = Record<string, RowValue>;

export type ExportColumn = {
  key: string;
  label: string;
  width?: number;
};

export type ExportOptions = {
  fileName: string;
  sheetName?: string;
  title?: string;
  columns?: ExportColumn[];
  autoFilter?: boolean;
};

const buildBorder = (): NonNullable<CellStyle["border"]> => ({
  top: { style: "thin", color: { rgb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { rgb: "FFE2E8F0" } },
  left: { style: "thin", color: { rgb: "FFE2E8F0" } },
  right: { style: "thin", color: { rgb: "FFE2E8F0" } },
});

const createHeaderStyle = (): CellStyle => ({
  font: { bold: true, color: { rgb: "FFFFFFFF" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill: { patternType: "solid", fgColor: { rgb: "FF312E81" } },
  border: buildBorder(),
});

const createTitleStyle = (): CellStyle => ({
  font: { bold: true, sz: 14, color: { rgb: "FF0F172A" } },
  alignment: { horizontal: "center", vertical: "center" },
});

const createRowStyle = (fillColor: string): CellStyle => ({
  font: { color: { rgb: "FF0F172A" } },
  alignment: { vertical: "center" },
  fill: { patternType: "solid", fgColor: { rgb: fillColor } },
  border: buildBorder(),
});

const sanitizeFileName = (value: string) => value.replace(/\.xlsx$/i, "");

const startCase = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\w/, (char) => char.toUpperCase());

const resolveColumns = (rows: ExcelRow[], columns?: ExportColumn[]): ExportColumn[] => {
  if (columns && columns.length) {
    return columns;
  }
  const firstRow = rows[0] ?? {};
  return Object.keys(firstRow).map<ExportColumn>((key) => ({
    key,
    label: startCase(key),
  }));
};

const formatCellValue = (value: RowValue) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const ensureCell = (worksheet: WorkSheet, cellRef: string) => {
  if (!worksheet[cellRef]) {
    worksheet[cellRef] = { t: "s", v: "" } as CellObject;
  }
  return worksheet[cellRef] as CellObject;
};

const applyStyle = (worksheet: WorkSheet, cellRef: string, style: CellStyle) => {
  const cell = ensureCell(worksheet, cellRef);
  cell.s = style;
};

export const exportToExcel = (rows: ExcelRow[], options: ExportOptions) => {
  if (rows.length === 0) {
    throw new Error("No data available to export.");
  }

  const columnConfig = resolveColumns(rows, options.columns);
  const headerRow = columnConfig.map((column) => column.label);
  const sheetData: RowValue[][] = [];
  if (options.title) {
    sheetData.push([options.title]);
  }
  sheetData.push(headerRow);
  const dataRows = rows.map((row) =>
    columnConfig.map((column) => formatCellValue(row[column.key])),
  );
  sheetData.push(...dataRows);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const headerRowIndex = options.title ? 1 : 0;
  const dataRowStartIndex = headerRowIndex + 1;

  if (options.title && columnConfig.length > 1) {
    const merges = worksheet["!merges"] ?? [];
    merges.push({
      s: { r: 0, c: 0 },
      e: { r: 0, c: columnConfig.length - 1 },
    });
    worksheet["!merges"] = merges;
    applyStyle(worksheet, "A1", createTitleStyle());
  } else if (options.title) {
    applyStyle(worksheet, "A1", createTitleStyle());
  }

  columnConfig.forEach((_, columnIndex) => {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex });
    applyStyle(worksheet, cellRef, createHeaderStyle());
  });

  dataRows.forEach((_, rowIndex) => {
    const style = createRowStyle(rowIndex % 2 === 0 ? "FFFFFFFF" : "FFF1F5F9");
    columnConfig.forEach((_, columnIndex) => {
      const cellRef = XLSX.utils.encode_cell({
        r: dataRowStartIndex + rowIndex,
        c: columnIndex,
      });
      applyStyle(worksheet, cellRef, style);
    });
  });

  worksheet["!cols"] = columnConfig.map((column) => ({
    wch: column.width ?? 20,
  }));

  if (options.autoFilter && columnConfig.length) {
    const startRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: 0 });
    const endRef = XLSX.utils.encode_cell({
      r: dataRowStartIndex + Math.max(dataRows.length - 1, 0),
      c: columnConfig.length - 1,
    });
    worksheet["!autofilter"] = {
      ref: `${startRef}:${endRef}`,
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName ?? "Report");
  XLSX.writeFile(workbook, `${sanitizeFileName(options.fileName)}.xlsx`);
};
