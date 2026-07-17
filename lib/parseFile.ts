// Parses and validates CSV/JSON/XLSX files uploaded in the Predictions view.
// Client-side validation gives immediate row-level feedback before the Edge Function is called.

import Papa from 'papaparse';
import * as XLSX from '@e965/xlsx';
import { DEPARTMENTS } from '@/lib/data/departments';
import type { HistoricalRow } from '@/lib/types';

// Set of valid department codes for fast membership checks
const VALID_DEPT_CODES = new Set(DEPARTMENTS.map((d) => d.code));

// ISO 8601 week format: YYYY-WNN (e.g. 2024-W40, 2024-W01)
const ISO_WEEK_RE = /^\d{4}-W\d{2}$/;

// Required columns. We accept a few synonyms for friendliness — DANE codes
// often appear as `COD_DPTO`, weeks as `SEMANA_ISO`, etc.
const COLUMN_ALIASES: Record<keyof HistoricalRow, string[]> = {
    dept_code: ['dept_code', 'cod_dpto', 'codigo_departamento', 'departamento', 'code'],
    week_iso: ['week_iso', 'semana_iso', 'semana', 'week', 'iso_week'],
    cases: ['cases', 'casos', 'casos_semana', 'count'],
};

// Backend constraints (mirrors limits in on-demand-predict Edge Function)
export const PARSE_LIMITS = {
    MAX_FILE_BYTES: 10 * 1024 * 1024,    // 10 MB
    MAX_ROWS: 1000,                // matches MAX_HISTORICAL_ROWS
    MIN_ROWS_PER_DEPT: 4,                   // matches MIN_HISTORICAL_PER_DEPT
} as const;

// Public API

export interface ParseSuccess {
    ok: true;
    rows: HistoricalRow[];
    rowsByDept: Map<number, HistoricalRow[]>;   // grouped, sorted by week_iso
    warnings: string[];                          // non-fatal issues (rounded values, sparse depts, duplicates)
    fileSummary: {
        totalRows: number;
        deptsFound: number[];
        weekRange: { earliest: string; latest: string };
    };
}

export interface ParseFailure {
    ok: false;
    errors: string[];      // human-readable, max ~10 entries to avoid overwhelming
    warnings: string[];    // non-fatal issues (e.g. row had extra columns)
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Top-level entry point. Reads the file, dispatches to the right parser
 * based on extension, then validates the parsed rows.
 */
export async function parseAndValidateFile(file: File): Promise<ParseResult> {
    // Pre-flight checks before reading
    if (file.size === 0) {
        return { ok: false, errors: ['File is empty.'], warnings: [] };
    }
    if (file.size > PARSE_LIMITS.MAX_FILE_BYTES) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        return {
            ok: false,
            errors: [`File is ${mb} MB; maximum allowed is 10 MB.`],
            warnings: [],
        };
    }

    const ext = file.name.toLowerCase().split('.').pop();
    let rawRows: Record<string, unknown>[];
    try {
        if (ext === 'csv') {
            rawRows = await parseCsv(file);
        } else if (ext === 'json') {
            rawRows = await parseJson(file);
        } else if (ext === 'xlsx' || ext === 'xls') {
            rawRows = await parseXlsx(file);
        } else {
            return {
                ok: false,
                errors: [`Unsupported file extension ".${ext}". Use CSV, JSON, or XLSX.`],
                warnings: [],
            };
        }
    } catch (e) {
        return {
            ok: false,
            errors: [`Could not parse file: ${e instanceof Error ? e.message : String(e)}`],
            warnings: [],
        };
    }

    return validateRows(rawRows);
}

// Per-format parsers

function parseCsv(file: File): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
        Papa.parse<Record<string, unknown>>(file, {
            header: true,
            skipEmptyLines: 'greedy',
            dynamicTyping: false, // keep raw strings; we coerce ourselves with clearer errors
            complete: (result) => {
                if (result.errors.length > 0) {
                    // Take just the first parse error to keep the message readable
                    const e = result.errors[0];
                    reject(new Error(`Row ${e.row ?? '?'}: ${e.message}`));
                    return;
                }
                resolve(result.data);
            },
            error: (err) => reject(err),
        });
    });
}

async function parseJson(file: File): Promise<Record<string, unknown>[]> {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
        throw new Error('JSON must be an array of row objects.');
    }
    return data;
}

async function parseXlsx(file: File): Promise<Record<string, unknown>[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('Workbook has no sheets.');
    const sheet = workbook.Sheets[firstSheetName];
    // defval ensures missing cells become null instead of being absent
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
}

// Row validation

/** Build a case-insensitive map from header → canonical field name. */
function resolveColumns(headers: string[]): Map<string, keyof HistoricalRow> {
    const lower = headers.map((h) => h.trim().toLowerCase());
    const result = new Map<string, keyof HistoricalRow>();
    for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
            const idx = lower.indexOf(alias.toLowerCase());
            if (idx !== -1) {
                result.set(headers[idx], canonical as keyof HistoricalRow);
                break;
            }
        }
    }
    return result;
}

/**
 * Coerce a raw cell value to a number. Returns null on failure.
 * Handles strings like "245", "245.0", " 245 ", and Excel-style numerics.
 */
function toNumber(v: unknown): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed === '') return null;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function validateRows(rawRows: Record<string, unknown>[]): ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (rawRows.length === 0) {
        return { ok: false, errors: ['File contains no data rows.'], warnings: [] };
    }
    if (rawRows.length > PARSE_LIMITS.MAX_ROWS) {
        return {
            ok: false,
            errors: [
                `File has ${rawRows.length} rows; maximum allowed is ${PARSE_LIMITS.MAX_ROWS}.`,
            ],
            warnings: [],
        };
    }

    // Column resolution from the first row's keys
    const headers = Object.keys(rawRows[0]);
    const columnMap = resolveColumns(headers);
    const required: (keyof HistoricalRow)[] = ['dept_code', 'week_iso', 'cases'];
    const missing = required.filter((c) => !Array.from(columnMap.values()).includes(c));
    if (missing.length > 0) {
        return {
            ok: false,
            errors: [
                `Missing required column(s): ${missing.join(', ')}. ` +
                `Found columns: ${headers.join(', ')}.`,
                `Required schema: dept_code, week_iso (YYYY-WNN), cases.`,
            ],
            warnings: [],
        };
    }
    // Reverse lookup: canonical name → original header
    const headerByCanonical: Record<keyof HistoricalRow, string> = {
        dept_code: '', week_iso: '', cases: '',
    };
    for (const [orig, canonical] of columnMap) {
        headerByCanonical[canonical] = orig;
    }

    // Walk every row, collect issues. We cap reported errors at 10 to keep the
    // UI readable; users fix one batch at a time anyway.
    const MAX_REPORTED = 10;
    const validatedRows: HistoricalRow[] = [];
    let errorCount = 0;
    const reportError = (msg: string) => {
        errorCount++;
        if (errors.length < MAX_REPORTED) errors.push(msg);
    };

    rawRows.forEach((rawRow, idx) => {
        const rowNum = idx + 2; // +1 header, +1 to be human-friendly
        const rawDept = rawRow[headerByCanonical.dept_code];
        const rawWeek = rawRow[headerByCanonical.week_iso];
        const rawCases = rawRow[headerByCanonical.cases];

        // dept_code
        const deptNum = toNumber(rawDept);
        if (deptNum === null || !Number.isInteger(deptNum)) {
            reportError(`Row ${rowNum}: dept_code "${rawDept}" is not a valid integer.`);
            return;
        }
        if (!VALID_DEPT_CODES.has(deptNum)) {
            reportError(
                `Row ${rowNum}: dept_code ${deptNum} is not a known DANE code ` +
                `(must be one of the 32 supported departments; Bogotá / 11 is excluded).`,
            );
            return;
        }

        // week_iso
        if (typeof rawWeek !== 'string' || !ISO_WEEK_RE.test(rawWeek.trim())) {
            reportError(
                `Row ${rowNum}: week_iso "${rawWeek}" must match format YYYY-WNN ` +
                `(e.g. 2024-W40).`,
            );
            return;
        }

        // cases
        const casesNum = toNumber(rawCases);
        if (casesNum === null || casesNum < 0) {
            reportError(`Row ${rowNum}: cases "${rawCases}" must be a non-negative number.`);
            return;
        }
        // Soft warning if non-integer; we'll round
        let casesInt = casesNum;
        if (!Number.isInteger(casesNum)) {
            casesInt = Math.round(casesNum);
            if (warnings.length < MAX_REPORTED) {
                warnings.push(`Row ${rowNum}: cases ${casesNum} rounded to ${casesInt}.`);
            }
        }

        validatedRows.push({
            dept_code: deptNum,
            week_iso: rawWeek.trim(),
            cases: casesInt,
        });
    });

    if (errorCount > MAX_REPORTED) {
        errors.push(`...and ${errorCount - MAX_REPORTED} more error(s) not shown.`);
    }
    if (errors.length > 0) {
        return { ok: false, errors, warnings };
    }
    if (validatedRows.length === 0) {
        return { ok: false, errors: ['No valid rows after validation.'], warnings };
    }

    // Group by department + sort each group chronologically
    const rowsByDept = new Map<number, HistoricalRow[]>();
    for (const row of validatedRows) {
        if (!rowsByDept.has(row.dept_code)) rowsByDept.set(row.dept_code, []);
        rowsByDept.get(row.dept_code)!.push(row);
    }
    for (const arr of rowsByDept.values()) {
        arr.sort((a, b) => a.week_iso.localeCompare(b.week_iso));
    }

    // Departments with too few rows are a warning, not a fatal error — the
    // user might have selected the dept by mistake; the UI shows this so they
    // can deselect it before submitting.
    for (const [deptCode, rows] of rowsByDept) {
        if (rows.length < PARSE_LIMITS.MIN_ROWS_PER_DEPT) {
            warnings.push(
                `Department ${deptCode}: only ${rows.length} row(s); ` +
                `at least ${PARSE_LIMITS.MIN_ROWS_PER_DEPT} are required for prediction.`,
            );
        }
    }

    // Check for duplicates (same dept_code + week_iso)
    const seen = new Set<string>();
    for (const row of validatedRows) {
        const key = `${row.dept_code}|${row.week_iso}`;
        if (seen.has(key)) {
            warnings.push(`Duplicate row: dept_code=${row.dept_code}, week_iso=${row.week_iso}.`);
        }
        seen.add(key);
    }

    // Compute summary
    const allWeeks = validatedRows.map((r) => r.week_iso).sort();
    return {
        ok: true,
        rows: validatedRows,
        rowsByDept,
        warnings,
        fileSummary: {
            totalRows: validatedRows.length,
            deptsFound: Array.from(rowsByDept.keys()).sort((a, b) => a - b),
            weekRange: { earliest: allWeeks[0], latest: allWeeks[allWeeks.length - 1] },
        },
    };
}

/**
 * Filter parsed rows by the user-selected departments. Used right before
 * submission to ignore rows for departments the user didn't pick.
 *
 * Returns the rows AND any selected departments that have insufficient data,
 * so the UI can display "X dept(s) selected don't have enough data".
 */
export function filterRowsForSelection(
    result: ParseSuccess,
    selectedCodes: number[],
): {
    rows: HistoricalRow[];
    insufficient: number[];
} {
    const insufficient: number[] = [];
    const out: HistoricalRow[] = [];
    for (const code of selectedCodes) {
        const rows = result.rowsByDept.get(code);
        if (!rows || rows.length < PARSE_LIMITS.MIN_ROWS_PER_DEPT) {
            insufficient.push(code);
            continue;
        }
        out.push(...rows);
    }
    return { rows: out, insufficient };
}