// Generates a multi-page PDF from a predictions array (single-dept from Map sidebar
// or multi-dept from Predictions view). The `any` casts are intentional: pdfmake
// ships no TypeScript types, and modelling its recursive docDefinition structure
// provides no runtime benefit.

import type { PredictionResponse, RiskLevel } from '@/lib/types';
import { getDepartmentByCode } from '@/lib/data/departments';

const RISK_COLORS: Record<RiskLevel, string> = {
    low: '#16a34a',
    medium: '#ca8a04',
    high: '#ea580c',
    'very-high': '#dc2626',
};

const RISK_LABELS: Record<RiskLevel, string> = {
    low: 'Low', medium: 'Medium', high: 'High', 'very-high': 'Very High',
};

const RISK_RANK: Record<RiskLevel, number> = {
    low: 0, medium: 1, high: 2, 'very-high': 3,
};

const CLIMATE_LABELS: Record<string, string> = {
    temperature: 'Temperature',
    precipitation: 'Precipitation',
    humidity: 'Humidity',
    oni: 'ONI (current)',
    oni_lag4: 'ONI (lag 4 mo)',
};

export interface ReportOptions {
    source: 'map' | 'predictions';
    originalFilename?: string;
}

export async function generateReport(
    predictions: PredictionResponse[],
    options: ReportOptions,
): Promise<void> {
    if (predictions.length === 0) {
        throw new Error('Cannot generate report from an empty prediction list.');
    }

    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfMake: any = (pdfMakeModule as unknown as { default?: unknown }).default ?? pdfMakeModule;

    pdfMake.fonts = {
        Roboto: {
            normal: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf',
            bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf',
            italics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Italic.ttf',
            bolditalics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-MediumItalic.ttf',
        },
    };
    pdfMake.vfs = pdfMake.vfs ?? {};

    const docDef = buildDocDefinition(predictions, options);
    const filename = buildFilename(options);
    pdfMake.createPdf(docDef).download(filename);
}

function buildDocDefinition(
    predictions: PredictionResponse[],
    options: ReportOptions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const generatedAt = new Date();
    const dateStr = generatedAt.toISOString().split('T')[0];
    const timeStr = generatedAt.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });

    const peakRisk = predictions.reduce<RiskLevel>((peak, p) => (
        RISK_RANK[p.risk_level] > RISK_RANK[peak] ? p.risk_level : peak
    ), 'low');
    const week1Avg = predictions.reduce(
        (sum, p) => sum + (p.weekly_forecasts[0]?.cases ?? 0), 0,
    ) / predictions.length;
    const totalForecasts = predictions.length * 4;
    const riskCounts: Record<RiskLevel, number> = {
        low: 0, medium: 0, high: 0, 'very-high': 0,
    };
    predictions.forEach((p) => { riskCounts[p.risk_level]++; });

    return {
        info: {
            title: 'EpiGuard — Dengue Forecast Report',
            author: 'EpiGuard',
            subject: 'Per-department dengue case forecast (4-week horizon)',
            creator: 'EpiGuard frontend',
            producer: 'pdfmake',
        },
        pageSize: 'LETTER',
        pageMargins: [50, 60, 50, 60],

        header: (currentPage: number) => {
            if (currentPage === 1) return null;
            return {
                text: 'EpiGuard — Dengue Forecast Report',
                alignment: 'right',
                margin: [0, 25, 50, 0],
                fontSize: 9,
                color: '#64748b',
            };
        },

        footer: (currentPage: number, pageCount: number) => ({
            columns: [
                { text: `Generated ${dateStr} ${timeStr}`, fontSize: 8, color: '#94a3b8', margin: [50, 0, 0, 0] },
                { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 8, color: '#94a3b8', margin: [0, 0, 50, 0] },
            ],
        }),

        content: [
            ...buildCoverPage({
                predictions,
                options,
                dateStr,
                peakRisk,
                week1Avg,
                totalForecasts,
                riskCounts,
            }),
            ...predictions.flatMap((pred) =>
                buildDepartmentSection(pred),
            ),
            ...buildMethodologyPage(),
        ],

        styles: {
            h1: { fontSize: 24, bold: true, color: '#0f172a', margin: [0, 0, 0, 6] },
            h2: { fontSize: 16, bold: true, color: '#0f172a', margin: [0, 12, 0, 6] },
            h3: { fontSize: 12, bold: true, color: '#334155', margin: [0, 8, 0, 4] },
            muted: { fontSize: 9, color: '#64748b' },
            small: { fontSize: 8, color: '#94a3b8' },
            body: { fontSize: 10, color: '#1e293b' },
            tableH: { fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9' },
        },
        defaultStyle: { fontSize: 10, color: '#1e293b' },
    };
}

function buildCoverPage(args: {
    predictions: PredictionResponse[];
    options: ReportOptions;
    dateStr: string;
    peakRisk: RiskLevel;
    week1Avg: number;
    totalForecasts: number;
    riskCounts: Record<RiskLevel, number>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any[] {
    const { predictions, options, dateStr, peakRisk, week1Avg, totalForecasts, riskCounts } = args;

    const subtitleParts: string[] = [
        `Generated ${dateStr}`,
        `${predictions.length} department${predictions.length !== 1 ? 's' : ''}`,
    ];
    if (options.originalFilename) subtitleParts.push(`Source: ${options.originalFilename}`);

    return [
        { text: 'EpiGuard', style: 'h1', color: '#0891b2' },
        { text: 'Dengue Forecast Report', style: 'h2', margin: [0, 0, 0, 4] },
        { text: subtitleParts.join('  ·  '), style: 'muted', margin: [0, 0, 0, 24] },

        {
            table: {
                widths: ['*', '*'],
                body: [
                    [
                        buildStatCell('Departments analyzed', String(predictions.length)),
                        buildStatCell('4-week forecasts generated', String(totalForecasts)),
                    ],
                    [
                        buildStatCell('Peak risk level', RISK_LABELS[peakRisk], RISK_COLORS[peakRisk]),
                        buildStatCell('Avg week+1 prediction', `${week1Avg.toFixed(1)} cases`),
                    ],
                ],
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 18],
        },

        { text: 'Risk distribution', style: 'h3' },
        {
            table: {
                widths: [80, '*', 30],
                body: (['low', 'medium', 'high', 'very-high'] as RiskLevel[]).map((level) => {
                    const count = riskCounts[level];
                    const widthPct = predictions.length > 0
                        ? Math.round((count / predictions.length) * 100)
                        : 0;
                    return [
                        { text: RISK_LABELS[level], color: RISK_COLORS[level], bold: true, fontSize: 10 },
                        buildBarCell(widthPct, RISK_COLORS[level]),
                        { text: String(count), alignment: 'right', fontSize: 10 },
                    ];
                }),
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 24],
        },

        {
            text: [
                { text: 'About this report. ', bold: true },
                'Forecasts are produced by SARIMAX models trained per Colombian department on weekly dengue case data (2007–2023) with climate exogenous variables (temperature, precipitation, humidity, ONI ENSO index). ',
                'Risk classification uses each department\'s own historical 50th, 80th, and 95th percentiles — not fixed thresholds — so what counts as "high" in one region may be "very-high" in another. ',
                'This is an educational project. Predictions should not be the sole basis for public-health decisions.',
            ],
            style: 'muted',
            lineHeight: 1.4,
        },
    ];
}

function buildDepartmentSection(
    pred: PredictionResponse,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
    const dept = getDepartmentByCode(pred.dept_code);
    const deptName = dept?.name ?? `Department ${pred.dept_code}`;
    const population = dept?.population
        ? dept.population.toLocaleString()
        : 'N/A';
    const riskColor = RISK_COLORS[pred.risk_level];

    const forecastRows = pred.weekly_forecasts.map((f) => [
        { text: `Week +${f.horizon}`, style: 'body', fontSize: 9 },
        { text: f.cases.toLocaleString(), style: 'body', alignment: 'right', bold: true, fontSize: 11 },
        {
            text: f.trend === 'up' ? '↑ rising' : '↓ falling',
            color: f.trend === 'up' ? '#dc2626' : '#16a34a',
            alignment: 'right', fontSize: 9
        },
    ]);

    const climateValues = Object.values(pred.climate_influence);
    const maxAbs = climateValues.length > 0
        ? Math.max(...climateValues.map((v) => Math.abs(v)))
        : 0;
    const climateRows = (Object.entries(pred.climate_influence) as [string, number][]).map(
        ([key, value]) => {
            const widthPct = maxAbs > 0
                ? Math.max(4, Math.round((Math.abs(value) / maxAbs) * 100))
                : 0;
            const positive = value >= 0;
            return [
                { text: CLIMATE_LABELS[key] ?? key, fontSize: 9 },
                buildBarCell(widthPct, positive ? '#0891b2' : '#ea580c'),
                {
                    text: `${positive ? '+' : ''}${value.toFixed(2)}`,
                    alignment: 'right',
                    fontSize: 9,
                    color: positive ? '#0891b2' : '#ea580c',
                },
            ];
        },
    );

    return [
        { text: '', pageBreak: 'before' },

        {
            columns: [
                {
                    width: '*',
                    stack: [
                        { text: deptName, style: 'h2', margin: [0, 0, 0, 0] },
                        {
                            text: `DANE code: ${String(pred.dept_code).padStart(2, '0')}  ·  Population: ${population}`,
                            style: 'muted',
                        },
                    ],
                },
                {
                    width: 'auto',
                    table: {
                        body: [[{
                            text: RISK_LABELS[pred.risk_level].toUpperCase(),
                            color: '#ffffff', fillColor: riskColor,
                            bold: true, fontSize: 10,
                            margin: [10, 6, 10, 6],
                        }]],
                    },
                    layout: 'noBorders',
                },
            ],
            margin: [0, 0, 0, 12],
        },

        { text: 'Predicted weekly cases', style: 'h3' },
        {
            table: {
                widths: ['*', 'auto', 'auto'],
                headerRows: 1,
                body: [
                    [
                        { text: 'Horizon', style: 'tableH' },
                        { text: 'Cases', style: 'tableH', alignment: 'right' },
                        { text: 'Trend', style: 'tableH', alignment: 'right' },
                    ],
                    ...forecastRows,
                ],
            },
            layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0,
                hLineColor: () => '#e2e8f0',
            },
            margin: [0, 0, 0, 14],
        },

        { text: 'Climate variable influence', style: 'h3' },
        {
            text: 'Estimated case-count change when each variable rises by 1 standard deviation.',
            style: 'muted',
            margin: [0, 0, 0, 4],
        },
        {
            table: {
                widths: [120, '*', 60],
                body: climateRows,
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 14],
        },

        {
            columns: [
                pred.model_order
                    ? { text: `Model: SARIMAX ${pred.model_order}`, style: 'small', width: '*' }
                    : { text: '', width: '*' },
                pred.inference_ms != null
                    ? { text: `Inference: ${pred.inference_ms.toFixed(0)} ms`, style: 'small', alignment: 'right' }
                    : { text: '', alignment: 'right' },
            ],
        },
    ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMethodologyPage(): any[] {
    return [
        { text: '', pageBreak: 'before' },
        { text: 'Methodology & data sources', style: 'h2' },

        { text: 'Forecast model', style: 'h3' },
        {
            text: 'Each department has its own SARIMAX model fit on weekly dengue cases from 2007 to 2023. ' +
                'The exogenous variables are: weekly mean temperature (°C), weekly precipitation total (mm), ' +
                'weekly mean relative humidity (%), the current ONI (Oceanic Niño Index) value, and the ONI ' +
                'value lagged 4 months. Forecasts cover four weekly horizons (t+1 through t+4).',
            style: 'body', margin: [0, 0, 0, 10],
        },

        { text: 'Risk classification', style: 'h3' },
        {
            text: 'Risk levels are derived from each department\'s historical case distribution (training + ' +
                'validation splits, 2007–2021). Low: forecast below the 50th percentile. Medium: between ' +
                'the 50th and 80th. High: between the 80th and 95th. Very High: above the 95th. Floors of ' +
                '3 and 8 cases are applied to the medium/high and high/very-high boundaries respectively, ' +
                'so departments with very sparse history don\'t produce noisy classifications.',
            style: 'body', margin: [0, 0, 0, 10],
        },

        { text: 'Data sources', style: 'h3' },
        {
            ul: [
                'Dengue cases: Instituto Nacional de Salud (Colombia), via SIVIGILA',
                'Temperature, precipitation, humidity: NASA POWER',
                'ENSO state: NOAA Climate Prediction Center (ONI series)',
                'Department geometries: DANE MGN_DPTO_POLITICO',
            ],
            style: 'body', margin: [0, 0, 0, 10],
        },

        { text: 'Limitations', style: 'h3' },
        {
            ul: [
                'Future climate is approximated by the most recent observed weeks; we do not use weather forecasts.',
                'Bogotá D.C. (DANE code 11) is excluded from per-department modeling and visually merged with Cundinamarca on the map.',
                'Departments with sparse historical data (Vaupés, Guainía, San Andrés) have wider uncertainty.',
                'This is a prototype. Use alongside, not instead of, official surveillance.',
            ],
            style: 'body',
        },
    ];
}

function buildStatCell(
    label: string,
    value: string,
    valueColor?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    return {
        stack: [
            { text: label, fontSize: 9, color: '#64748b' },
            { text: value, fontSize: 18, bold: true, color: valueColor ?? '#0f172a', margin: [0, 4, 0, 0] },
        ],
        fillColor: '#f8fafc',
        margin: [12, 10, 12, 10],
    };
}

function buildBarCell(
    widthPct: number,
    color: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const filled = Math.max(0, Math.min(100, widthPct));
    return {
        table: {
            widths: [`${filled}%`, `${100 - filled}%`],
            body: [[
                { text: '', fillColor: color, border: [false, false, false, false] },
                { text: '', border: [false, false, false, false] },
            ]],
            heights: [10],
        },
        layout: { defaultBorder: false, paddingTop: () => 1, paddingBottom: () => 1 },
    };
}

function buildFilename(options: ReportOptions): string {
    const date = new Date().toISOString().split('T')[0];
    const suffix = options.source === 'map' ? 'dept' : 'multi';
    return `epiguard-report-${date}-${suffix}.pdf`;
}