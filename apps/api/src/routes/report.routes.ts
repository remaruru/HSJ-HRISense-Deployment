import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { ReportService, REPORT_CATALOG, ReportKey, ReportFilters } from '../services/report.service';

const router = Router();

// Reports aggregate organisation-wide data, so they are HR-only.
router.use(authenticate);
router.use(authorize(['FULL']));

const VALID_KEYS = new Set(REPORT_CATALOG.map((r) => r.key));

function readKey(value: unknown): ReportKey {
  const key = String(value ?? '');
  if (!VALID_KEYS.has(key as ReportKey)) {
    throw new AppError('Unknown report.', 400);
  }
  return key as ReportKey;
}

function readFilters(source: Record<string, any>): ReportFilters {
  return {
    dateFrom: source.dateFrom || undefined,
    dateTo: source.dateTo || undefined,
    unitId: source.unitId || undefined,
    departmentId: source.departmentId || undefined,
    jobRoleId: source.jobRoleId || undefined,
  };
}

/** GET /reports/catalog — the reports this build can actually produce. */
router.get(
  '/catalog',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: REPORT_CATALOG });
  })
);

/** GET /reports/:key — generate one report as JSON. */
router.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const key = readKey(req.params.key);
    const report = await ReportService.generate(key, readFilters(req.query));
    res.json({ success: true, data: report });
  })
);

/** POST /reports/:key/export — the same report as xlsx | pdf | csv. */
router.post(
  '/:key/export',
  asyncHandler(async (req, res) => {
    const key = readKey(req.params.key);
    const format = String(req.body?.format ?? 'excel').toLowerCase();
    const report = await ReportService.generate(key, readFilters(req.body ?? {}));

    const stamp = new Date().toISOString().split('T')[0];
    const base = `HRISense_${report.title.replace(/[^A-Za-z0-9]+/g, '_')}_${stamp}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
      res.send(ReportService.toCsv(report));
      return;
    }

    if (format === 'pdf') {
      const buffer = await ReportService.toPdf(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
      res.send(buffer);
      return;
    }

    if (format === 'excel' || format === 'xlsx') {
      const buffer = await ReportService.toExcel(report);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
      res.send(buffer);
      return;
    }

    throw new AppError('Unsupported export format. Use excel, pdf or csv.', 400);
  })
);

export default router;
