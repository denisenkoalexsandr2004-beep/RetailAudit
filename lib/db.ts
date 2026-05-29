import fs from 'node:fs';
import path from 'node:path';
import type { ApplicationInput } from './validation';
import type { AuditBlockResult, AuditDraft } from './audit-methodology';
import { normalizeTariff } from './tariffs';

export type ApplicationStatus = 'new' | 'invoice_sent' | 'paid_in_work' | 'completed' | 'rejected';
export type LegacyApplicationStatus = 'contacted' | 'in_review';

export type ApplicationRecord = ApplicationInput & {
  id: string;
  status: ApplicationStatus;
  telegramStatus: 'sent' | 'failed' | 'not_configured';
  createdAt: string;
  updatedAt: string;
};

export type AuditRecord = AuditDraft & {
  id: string;
  applicationId: string;
  status: 'draft' | 'expert_review' | 'approved';
  createdAt: string;
  updatedAt: string;
};

type SqliteDatabase = {
  pragma?: (statement: string) => unknown;
  exec: (statement: string) => unknown;
  prepare: (statement: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

let db: SqliteDatabase | null = null;
let sqliteAvailable: boolean | null = null;

type JsonStore = {
  applications: ApplicationRecord[];
  audits: AuditRecord[];
};

function dbPath() {
  const configured = process.env.DATABASE_PATH || './data/retail_ready_audit.db';
  if (path.isAbsolute(configured)) return configured;
  const defaultRelativePaths = new Set([
    './data/retail_ready_audit.db',
    'data/retail_ready_audit.db',
    '.\\data\\retail_ready_audit.db',
    'data\\retail_ready_audit.db'
  ]);
  if (process.env.NODE_ENV !== 'production' && !defaultRelativePaths.has(configured)) {
    return path.resolve(process.cwd(), configured);
  }
  const baseDir = process.env.RETAIL_AUDIT_DATA_DIR
    || process.env.DATA_DIR
    || (process.env.NODE_ENV === 'production' ? path.join('/tmp', 'retail_ready_audit') : path.join(process.cwd(), 'data'));
  return path.join(baseDir, 'retail_ready_audit.db');
}

function jsonPath() {
  return dbPath().replace(/\.[^.]+$/, '') + '.json';
}

function canUseSqlite() {
  if (sqliteAvailable !== null) return sqliteAvailable;
  try {
    const nativeRequire = eval('require') as NodeRequire;
    nativeRequire('node:sqlite');
    sqliteAvailable = true;
  } catch {
    sqliteAvailable = false;
  }
  return sqliteAvailable;
}

function readStore(): JsonStore {
  const file = jsonPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    return { applications: [], audits: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<JsonStore>;
    return {
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      audits: Array.isArray(parsed.audits) ? parsed.audits : []
    };
  } catch {
    return { applications: [], audits: [] };
  }
}

function writeStore(store: JsonStore) {
  const file = jsonPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

function disableSqlite() {
  sqliteAvailable = false;
  db = null;
}

function normalizeApplicationRecord(record: ApplicationRecord): ApplicationRecord {
  return {
    ...record,
    tariff: normalizeTariff(record.tariff),
    status: ['new', 'invoice_sent', 'paid_in_work', 'completed', 'rejected'].includes(record.status)
      ? record.status
      : 'new',
    telegramStatus: ['sent', 'failed', 'not_configured'].includes(record.telegramStatus)
      ? record.telegramStatus
      : 'not_configured'
  };
}

export function getDb() {
  if (db) return db;
  if (!canUseSqlite()) {
    throw new Error('node:sqlite is unavailable; JSON storage fallback is active');
  }
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const nativeRequire = eval('require') as NodeRequire;
  const { DatabaseSync } = nativeRequire('node:sqlite') as { DatabaseSync: new (file: string) => SqliteDatabase };
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      phone TEXT NOT NULL,
      telegram TEXT,
      email TEXT,
      category TEXT NOT NULL,
      product_name TEXT NOT NULL,
      description TEXT NOT NULL,
      tariff TEXT NOT NULL,
      production_cost TEXT,
      retail_price TEXT,
      monthly_volume TEXT,
      target_networks TEXT,
      network_level TEXT,
      network_names TEXT,
      federal_networks TEXT,
      regional_networks TEXT,
      local_networks TEXT,
      unknown_networks TEXT,
      presentation_url TEXT,
      presentation_name TEXT,
      presentation_type TEXT,
      presentation_size INTEGER,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      telegram_status TEXT NOT NULL DEFAULT 'not_configured',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      overall_score INTEGER NOT NULL DEFAULT 0,
      readiness_level TEXT NOT NULL DEFAULT '',
      verdict TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      blocks_json TEXT,
      recommendations_json TEXT,
      roadmap_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audits_application_id ON audits(application_id);
    CREATE INDEX IF NOT EXISTS idx_audits_updated_at ON audits(updated_at DESC);
  `);
  const columns = getDb().prepare('PRAGMA table_info(applications)').all() as Array<{ name: string }>;
  const names = new Set(columns.map(column => column.name));
  const addColumn = (name: string, definition: string) => {
    if (!names.has(name)) getDb().exec(`ALTER TABLE applications ADD COLUMN ${name} ${definition}`);
  };
  addColumn('network_level', 'TEXT');
  addColumn('network_names', 'TEXT');
  addColumn('federal_networks', 'TEXT');
  addColumn('regional_networks', 'TEXT');
  addColumn('local_networks', 'TEXT');
  addColumn('unknown_networks', 'TEXT');
  addColumn('presentation_url', 'TEXT');
  addColumn('presentation_name', 'TEXT');
  addColumn('presentation_type', 'TEXT');
  addColumn('presentation_size', 'INTEGER');
  addColumn('notes', 'TEXT');
  return db;
}

function map(row: Record<string, unknown>): ApplicationRecord {
  const rawStatus = String(row.status || 'new');
  const status = rawStatus === 'contacted' || rawStatus === 'in_review' || rawStatus === 'in_work' || rawStatus === 'waiting_client'
      ? 'invoice_sent'
      : rawStatus;
  return {
    id: String(row.id),
    name: String(row.name),
    company: String(row.company),
    phone: String(row.phone),
    telegram: String(row.telegram || ''),
    email: String(row.email || ''),
    category: String(row.category),
    productName: String(row.product_name),
    description: String(row.description),
    tariff: normalizeTariff(row.tariff),
    productionCost: String(row.production_cost || ''),
    retailPrice: String(row.retail_price || ''),
    monthlyVolume: String(row.monthly_volume || ''),
    targetNetworks: String(row.target_networks || ''),
    networkLevel: String(row.network_level || ''),
    networkNames: String(row.network_names || ''),
    federalNetworks: String(row.federal_networks || ''),
    regionalNetworks: String(row.regional_networks || ''),
    localNetworks: String(row.local_networks || ''),
    unknownNetworks: String(row.unknown_networks || ''),
    presentationUrl: String(row.presentation_url || ''),
    presentationName: String(row.presentation_name || ''),
    presentationType: String(row.presentation_type || ''),
    presentationSize: Number(row.presentation_size || 0),
    notes: String(row.notes || ''),
    status: status as ApplicationStatus,
    telegramStatus: String(row.telegram_status || 'not_configured') as ApplicationRecord['telegramStatus'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapAudit(row: Record<string, unknown>): AuditRecord {
  const status = String(row.status || 'draft');
  return {
    id: String(row.id),
    applicationId: String(row.application_id),
    status: ['draft', 'expert_review', 'approved'].includes(status) ? status as AuditRecord['status'] : 'draft',
    overallScore: Number(row.overall_score || 0),
    readinessLevel: String(row.readiness_level || ''),
    verdict: String(row.verdict || ''),
    summary: String(row.summary || ''),
    blocks: parseJsonField<AuditBlockResult[]>(row.blocks_json, []),
    recommendations: parseJsonField<string[]>(row.recommendations_json, []),
    roadmap: parseJsonField<string[]>(row.roadmap_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createApplication(data: ApplicationInput) {
  const now = new Date().toISOString();
  const id = `RRA-${Date.now().toString(36).toUpperCase()}`;

  const createInJsonStore = () => {
    const store = readStore();
    const application = normalizeApplicationRecord({
      ...data,
      id,
      status: 'new',
      telegramStatus: 'not_configured',
      createdAt: now,
      updatedAt: now
    });
    store.applications.unshift(application);
    writeStore(store);
    return application;
  };

  if (!canUseSqlite()) {
    return createInJsonStore();
  }

  try {
    getDb()
      .prepare(`
        INSERT INTO applications (
          id, name, company, phone, telegram, email, category, product_name, description,
          tariff, production_cost, retail_price, monthly_volume, target_networks,
          network_level, network_names, federal_networks, regional_networks, local_networks, unknown_networks,
          presentation_url, presentation_name, presentation_type, presentation_size, notes,
          status, telegram_status, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          'new', 'not_configured', ?, ?
        )
      `)
      .run(
        id,
        data.name,
        data.company,
        data.phone,
        data.telegram || '',
        data.email || '',
        data.category,
        data.productName,
        data.description,
        data.tariff,
        data.productionCost || '',
        data.retailPrice || '',
        data.monthlyVolume || '',
        data.targetNetworks || '',
        data.networkLevel || '',
        data.networkNames || '',
        data.federalNetworks || '',
        data.regionalNetworks || '',
        data.localNetworks || '',
        data.unknownNetworks || '',
        data.presentationUrl || '',
        data.presentationName || '',
        data.presentationType || '',
        data.presentationSize || 0,
        data.notes || '',
        now,
        now
      );
    return getApplication(id)!;
  } catch {
    disableSqlite();
    return createInJsonStore();
  }
}

export function updateTelegramStatus(id: string, status: ApplicationRecord['telegramStatus']) {
  if (!canUseSqlite()) {
    const store = readStore();
    store.applications = store.applications.map((application) => application.id === id
      ? normalizeApplicationRecord({ ...application, telegramStatus: status, updatedAt: new Date().toISOString() })
      : application);
    writeStore(store);
    return;
  }

  getDb()
    .prepare('UPDATE applications SET telegram_status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
}

export function updateApplicationStatus(id: string, status: ApplicationStatus) {
  if (!canUseSqlite()) {
    const store = readStore();
    store.applications = store.applications.map((application) => application.id === id
      ? normalizeApplicationRecord({ ...application, status, updatedAt: new Date().toISOString() })
      : application);
    writeStore(store);
    return getApplication(id);
  }

  getDb()
    .prepare('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
  return getApplication(id);
}

export function getApplication(id: string) {
  if (!canUseSqlite()) {
    const application = readStore().applications.find((item) => item.id === id);
    return application ? normalizeApplicationRecord(application) : null;
  }

  try {
    const row = getDb().prepare('SELECT * FROM applications WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? map(row) : null;
  } catch {
    disableSqlite();
    const application = readStore().applications.find((item) => item.id === id);
    return application ? normalizeApplicationRecord(application) : null;
  }
}

export function listApplications() {
  if (!canUseSqlite()) {
    return readStore().applications
      .map(normalizeApplicationRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 300);
  }

  try {
    const rows = getDb().prepare('SELECT * FROM applications ORDER BY created_at DESC LIMIT 300').all() as Record<string, unknown>[];
    return rows.map(map);
  } catch {
    disableSqlite();
    return readStore().applications
      .map(normalizeApplicationRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 300);
  }
}

export function getAuditByApplicationId(applicationId: string) {
  if (!canUseSqlite()) {
    return readStore().audits
      .filter((audit) => audit.applicationId === applicationId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
  }

  const row = getDb()
    .prepare('SELECT * FROM audits WHERE application_id = ? ORDER BY updated_at DESC LIMIT 1')
    .get(applicationId) as Record<string, unknown> | undefined;
  return row ? mapAudit(row) : null;
}

export function upsertAudit(applicationId: string, draft: AuditDraft, status: AuditRecord['status'] = 'draft') {
  if (!canUseSqlite()) {
    const store = readStore();
    const now = new Date().toISOString();
    const existing = store.audits
      .filter((audit) => audit.applicationId === applicationId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (existing) {
      const updated = {
        ...existing,
        ...draft,
        status,
        updatedAt: now
      };
      store.audits = store.audits.map((audit) => audit.id === existing.id ? updated : audit);
      writeStore(store);
      return updated;
    }

    const audit: AuditRecord = {
      ...draft,
      id: `AUD-${Date.now().toString(36).toUpperCase()}`,
      applicationId,
      status,
      createdAt: now,
      updatedAt: now
    };
    store.audits.unshift(audit);
    writeStore(store);
    return audit;
  }

  const existing = getAuditByApplicationId(applicationId);
  const now = new Date().toISOString();
  const args = [
    status,
    draft.overallScore,
    draft.readinessLevel,
    draft.verdict,
    draft.summary,
    JSON.stringify(draft.blocks),
    JSON.stringify(draft.recommendations),
    JSON.stringify(draft.roadmap),
    now
  ];

  if (existing) {
    getDb()
      .prepare(`
        UPDATE audits
        SET status = ?, overall_score = ?, readiness_level = ?, verdict = ?, summary = ?,
            blocks_json = ?, recommendations_json = ?, roadmap_json = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(...args, existing.id);
    return getAuditByApplicationId(applicationId);
  }

  const id = `AUD-${Date.now().toString(36).toUpperCase()}`;
  getDb()
    .prepare(`
      INSERT INTO audits (
        id, application_id, status, overall_score, readiness_level, verdict, summary,
        blocks_json, recommendations_json, roadmap_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(id, applicationId, ...args, now);
  return getAuditByApplicationId(applicationId);
}

export function updateAudit(audit: Pick<AuditRecord, 'id' | 'status' | 'overallScore' | 'readinessLevel' | 'verdict' | 'summary' | 'blocks' | 'recommendations' | 'roadmap'>) {
  if (!canUseSqlite()) {
    const store = readStore();
    let updatedAudit: AuditRecord | null = null;
    store.audits = store.audits.map((existing) => {
      if (existing.id !== audit.id) return existing;
      updatedAudit = {
        ...existing,
        ...audit,
        updatedAt: new Date().toISOString()
      };
      return updatedAudit;
    });
    writeStore(store);
    return updatedAudit;
  }

  getDb()
    .prepare(`
      UPDATE audits
      SET status = ?, overall_score = ?, readiness_level = ?, verdict = ?, summary = ?,
          blocks_json = ?, recommendations_json = ?, roadmap_json = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      audit.status,
      audit.overallScore,
      audit.readinessLevel,
      audit.verdict,
      audit.summary,
      JSON.stringify(audit.blocks),
      JSON.stringify(audit.recommendations),
      JSON.stringify(audit.roadmap),
      new Date().toISOString(),
      audit.id
    );

  const row = getDb().prepare('SELECT * FROM audits WHERE id = ?').get(audit.id) as Record<string, unknown> | undefined;
  return row ? mapAudit(row) : null;
}
