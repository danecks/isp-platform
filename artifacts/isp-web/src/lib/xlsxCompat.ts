/**
 * xlsxCompat.ts
 *
 * Secure, dependency-free XLSX reader built on JSZip + browser DOMParser.
 * Replaces the xlsx (SheetJS CE) package which has critical CVEs.
 *
 * Supported API surface (matches the subset used by this project):
 *   await XLSX.read(data, { type: "array", cellDates?: boolean })
 *   XLSX.utils.sheet_to_json(sheet, { defval?, header?: 1 })
 *
 * Supports: .xlsx (OOXML). Does NOT support legacy .xls binary format.
 */

import JSZip from "jszip";

interface XlsxSheet {
  rows: any[][];
  cellDates: boolean;
}

export interface WorkbookProxy {
  SheetNames: string[];
  Sheets: Record<string, XlsxSheet>;
}

function getXmlText(zip: JSZip, path: string): Promise<string> | null {
  const f = zip.file(path);
  return f ? f.async("text") : null;
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function tags(node: Document | Element, local: string): Element[] {
  return Array.from(node.getElementsByTagName("*")).filter(
    (el) => el.localName === local
  );
}

function parseSharedStrings(xml: string): string[] {
  const doc = parseXml(xml);
  return tags(doc, "si").map((si) => {
    const ts = tags(si, "t");
    return ts.map((t) => t.textContent ?? "").join("");
  });
}

function parseStyles(xml: string): { numFmtIds: number[]; customFmts: Record<number, string> } {
  const doc = parseXml(xml);
  const customFmts: Record<number, string> = {};
  tags(doc, "numFmt").forEach((el) => {
    const id = parseInt(el.getAttribute("numFmtId") ?? "0", 10);
    const code = el.getAttribute("formatCode") ?? "";
    customFmts[id] = code;
  });
  const numFmtIds: number[] = [];
  tags(doc, "cellXfs").forEach((xfs) => {
    tags(xfs, "xf").forEach((xf) => {
      numFmtIds.push(parseInt(xf.getAttribute("numFmtId") ?? "0", 10));
    });
  });
  return { numFmtIds, customFmts };
}

function isDateFmt(fmtId: number, customFmts: Record<number, string>): boolean {
  if ((fmtId >= 14 && fmtId <= 22) || (fmtId >= 45 && fmtId <= 47)) return true;
  const code = customFmts[fmtId] ?? "";
  const stripped = code.replace(/"[^"]*"/g, "").replace(/\[.*?\]/g, "");
  return /[yYmMdDhH]/.test(stripped);
}

function colIndex(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

function serialToDate(n: number): Date {
  const adj = n > 59 ? n - 1 : n;
  return new Date(Math.round((adj - 25569) * 86400000));
}

function parseSheet(
  xml: string,
  sharedStrings: string[],
  styles: { numFmtIds: number[]; customFmts: Record<number, string> },
  cellDates: boolean
): any[][] {
  const doc = parseXml(xml);
  const rowEls = tags(doc, "row");
  const result: any[][] = [];

  rowEls.forEach((rowEl) => {
    const rIdx = parseInt(rowEl.getAttribute("r") ?? "1", 10) - 1;
    while (result.length <= rIdx) result.push([]);
    const rowData = result[rIdx];

    tags(rowEl, "c").forEach((cellEl) => {
      const ref = cellEl.getAttribute("r") ?? "";
      const m = ref.match(/^([A-Z]+)/);
      if (!m) return;
      const cIdx = colIndex(m[1]);
      const type = cellEl.getAttribute("t") ?? "";
      const sIdx = parseInt(cellEl.getAttribute("s") ?? "-1", 10);
      const vEl = tags(cellEl, "v")[0];
      const v = vEl?.textContent ?? null;

      let value: any;

      if (type === "s") {
        value = sharedStrings[parseInt(v ?? "0", 10)] ?? "";
      } else if (type === "inlineStr") {
        const tEls = tags(cellEl, "t");
        value = tEls.map((t) => t.textContent ?? "").join("");
      } else if (type === "b") {
        value = v === "1";
      } else if (type === "e") {
        value = undefined;
      } else if (v !== null) {
        const num = parseFloat(v);
        if (!isNaN(num)) {
          if (sIdx >= 0 && sIdx < styles.numFmtIds.length) {
            const fmtId = styles.numFmtIds[sIdx];
            if (isDateFmt(fmtId, styles.customFmts)) {
              value = cellDates ? serialToDate(num) : num;
            } else {
              value = num;
            }
          } else {
            value = num;
          }
        } else {
          value = v;
        }
      }

      while (rowData.length <= cIdx) rowData.push(undefined);
      rowData[cIdx] = value;
    });
  });

  return result;
}

function parseWorkbookSheets(xml: string): { name: string; rId: string }[] {
  const doc = parseXml(xml);
  return tags(doc, "sheet").map((s) => ({
    name: s.getAttribute("name") ?? "",
    rId:
      s.getAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "id"
      ) ??
      s.getAttribute("r:id") ??
      "",
  }));
}

function parseRels(xml: string): Record<string, string> {
  const doc = parseXml(xml);
  const map: Record<string, string> = {};
  tags(doc, "Relationship").forEach((rel) => {
    const id = rel.getAttribute("Id") ?? "";
    const target = rel.getAttribute("Target") ?? "";
    map[id] = target;
  });
  return map;
}

export async function read(
  data: Uint8Array | ArrayBuffer,
  opts: { type?: string; cellDates?: boolean } = {}
): Promise<WorkbookProxy> {
  const cellDates = opts.cellDates !== false;
  const buffer: ArrayBuffer =
    data instanceof Uint8Array
      ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
      : data;

  const zip = await JSZip.loadAsync(buffer);

  const sharedStrings: string[] = [];
  const ssTxt = await getXmlText(zip, "xl/sharedStrings.xml");
  if (ssTxt) parseSharedStrings(ssTxt).forEach((s) => sharedStrings.push(s));

  let styles = {
    numFmtIds: [] as number[],
    customFmts: {} as Record<number, string>,
  };
  const stylesTxt = await getXmlText(zip, "xl/styles.xml");
  if (stylesTxt) styles = parseStyles(stylesTxt);

  const wbTxt = await getXmlText(zip, "xl/workbook.xml");
  if (!wbTxt) throw new Error("Invalid .xlsx file: missing xl/workbook.xml");
  const sheetInfos = parseWorkbookSheets(wbTxt);

  let rIdMap: Record<string, string> = {};
  const relsTxt = await getXmlText(zip, "xl/_rels/workbook.xml.rels");
  if (relsTxt) rIdMap = parseRels(relsTxt);

  const SheetNames: string[] = [];
  const Sheets: Record<string, XlsxSheet> = {};

  for (let i = 0; i < sheetInfos.length; i++) {
    const info = sheetInfos[i];
    SheetNames.push(info.name);
    let target = rIdMap[info.rId] ?? `worksheets/sheet${i + 1}.xml`;
    if (target.startsWith("/xl/")) target = target.slice(1);
    else if (!target.startsWith("xl/")) {
      target = `xl/${target.replace(/^\.\.\//, "")}`;
    }
    const wsTxt = await getXmlText(zip, target);
    if (!wsTxt) {
      Sheets[info.name] = { rows: [], cellDates };
      continue;
    }
    const rows = parseSheet(wsTxt, sharedStrings, styles, cellDates);
    Sheets[info.name] = { rows, cellDates };
  }

  return { SheetNames, Sheets };
}

export function sheet_to_json<T>(
  sheet: XlsxSheet,
  opts: { defval?: any; header?: 1 } = {}
): T[] {
  const { defval, header } = opts;
  const { rows } = sheet;

  if (header === 1) {
    return rows.map((row) =>
      (row ?? []).map((cell) =>
        cell === undefined || cell === null ? defval : cell
      )
    ) as any;
  }

  if (rows.length === 0) return [];
  const headers = (rows[0] ?? []).map((h: any) => String(h ?? ""));
  return rows.slice(1).map((row) => {
    const obj: Record<string, any> = {};
    headers.forEach((h: string, i: number) => {
      const val = (row ?? [])[i];
      obj[h] = val === undefined || val === null ? defval : val;
    });
    return obj;
  }) as T[];
}

export const xlsxCompat = {
  read,
  utils: { sheet_to_json },
};
