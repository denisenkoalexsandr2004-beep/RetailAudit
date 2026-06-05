import type { ApplicationInput } from './validation';
import type { AuditBlockResult, AuditDraft } from './audit-methodology';
import { normalizeTariff } from './tariffs';
import {
  createApplication as createSqliteApplication,
  getApplication as getSqliteApplication,
  getAuditByApplicationId as getSqliteAuditByApplicationId,
  listApplications as listSqliteApplications,
  updateAudit as updateSqliteAudit,
  updateApplicationStatus as updateSqliteApplicationStatus,
  updateTelegramStatus as updateSqliteTelegramStatus,
  upsertAudit as upsertSqliteAudit
} from './db';

export type ApplicationStatus = 'new' | 'invoice_sent' | 'paid_in_work' | 'completed' | 'rejected';

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

type SupabaseApplicationRow = {
  id: string;
  name: string;
  company: string;
  phone: string;
  telegram: string | null;
  email: string | null;
  category: string;
  product_name: string;
  description: string;
  tariff: string;
  production_cost: string | null;
  retail_price: string | null;
  monthly_volume: string | null;
  target_networks: string | null;
  network_level: string | null;
  network_names: string | null;
  federal_networks: string | null;
  regional_networks: string | null;
  local_networks: string | null;
  unknown_networks: string | null;
  presentation_url: string | null;
  presentation_name: string | null;
  presentation_type: string | null;
  presentation_size: number | null;
  notes: string | null;
  status: string;
  telegram_status: string;
  created_at: string;
  updated_at: string;
};

type SupabaseAuditRow = {
  id: string;
  application_id: string;
  status: string;
  overall_score: number;
  readiness_level: string;
  verdict: string;
  summary: string;
  blocks_json: AuditBlockResult[] | string | null;
  recommendations_json: string[] | string | null;
  roadmap_json: string[] | string | null;
  created_at: string;
  updated_at: string;
};

function createRecord(data: ApplicationInput): ApplicationRecord {
  const now = new Date().toISOString();
  return {
    ...data,
    id: `RRA-${Date.now().toString(36).toUpperCase()}`,
    status: 'new',
    telegramStatus: 'not_configured',
    createdAt: now,
    updatedAt: now
  };
}

function toRow(application: ApplicationRecord): SupabaseApplicationRow {
  return {
    id: application.id,
    name: application.name,
    company: application.company,
    phone: application.phone,
    telegram: application.telegram || null,
    email: application.email || null,
    category: application.category,
    product_name: application.productName,
    description: application.description,
    tariff: application.tariff,
    production_cost: application.productionCost || null,
    retail_price: application.retailPrice || null,
    monthly_volume: application.monthlyVolume || null,
    target_networks: application.targetNetworks || null,
    network_level: application.networkLevel || null,
    network_names: application.networkNames || null,
    federal_networks: application.federalNetworks || null,
    regional_networks: application.regionalNetworks || null,
    local_networks: application.localNetworks || null,
    unknown_networks: application.unknownNetworks || null,
    presentation_url: application.presentationUrl || null,
    presentation_name: application.presentationName || null,
    presentation_type: application.presentationType || null,
    presentation_size: application.presentationSize || null,
    notes: application.notes || null,
    status: application.status,
    telegram_status: application.telegramStatus,
    created_at: application.createdAt,
    updated_at: application.updatedAt
  };
}

function normalizeStatus(status: unknown): ApplicationStatus {
  const value = String(status || 'new');
  if (value === 'contacted' || value === 'in_review' || value === 'in_work' || value === 'waiting_client') return 'invoice_sent';
  if (['new', 'invoice_sent', 'paid_in_work', 'completed', 'rejected'].includes(value)) return value as ApplicationStatus;
  return 'new';
}

function fromRow(row: SupabaseApplicationRow): ApplicationRecord {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    phone: row.phone,
    telegram: row.telegram || '',
    email: row.email || '',
    category: row.category,
    productName: row.product_name,
    description: row.description,
    tariff: normalizeTariff(row.tariff),
    productionCost: row.production_cost || '',
    retailPrice: row.retail_price || '',
    monthlyVolume: row.monthly_volume || '',
    targetNetworks: row.target_networks || '',
    networkLevel: row.network_level || '',
    networkNames: row.network_names || '',
    federalNetworks: row.federal_networks || '',
    regionalNetworks: row.regional_networks || '',
    localNetworks: row.local_networks || '',
    unknownNetworks: row.unknown_networks || '',
    presentationUrl: row.presentation_url || '',
    presentationName: row.presentation_name || '',
    presentationType: row.presentation_type || '',
    presentationSize: row.presentation_size || 0,
    notes: row.notes || '',
    status: normalizeStatus(row.status),
    telegramStatus: (row.telegram_status || 'not_configured') as ApplicationRecord['telegramStatus'],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseJsonField<T>(value: T | string | null, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function fromAuditRow(row: SupabaseAuditRow): AuditRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    status: ['draft', 'expert_review', 'approved'].includes(row.status) ? row.status as AuditRecord['status'] : 'draft',
    overallScore: Number(row.overall_score || 0),
    readinessLevel: row.readiness_level || '',
    verdict: row.verdict || '',
    summary: row.summary || '',
    blocks: parseJsonField<AuditBlockResult[]>(row.blocks_json, []),
    recommendations: parseJsonField<string[]>(row.recommendations_json, []),
    roadmap: parseJsonField<string[]>(row.roadmap_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function auditToRow(applicationId: string, draft: AuditDraft, status: AuditRecord['status'] = 'draft') {
  return {
    application_id: applicationId,
    status,
    overall_score: draft.overallScore,
    readiness_level: draft.readinessLevel,
    verdict: draft.verdict,
    summary: draft.summary,
    blocks_json: draft.blocks,
    recommendations_json: draft.recommendations,
    roadmap_json: draft.roadmap,
    updated_at: new Date().toISOString()
  };
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase storage is not configured');
  }

  return { url, key };
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    console.error('Supabase request failed', response.status, message.slice(0, 300));
    throw new Error('Supabase request failed');
  }

  if (response.status === 204) return null as T;
  return await response.json() as T;
}

function safeFileName(name: string) {
  const fallback = 'presentation.pdf';
  const parts = name.split('.');
  const extension = parts.length > 1 ? parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'pdf';
  const base = parts.join('.').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 70) || 'presentation';
  return `${base}.${extension || fallback.split('.').pop()}`;
}

async function uploadSupabasePresentation(application: ApplicationRecord) {
  if (!application.presentationFile) return application;

  const { url, key } = supabaseConfig();
  const bucket = process.env.SUPABASE_PRESENTATIONS_BUCKET || 'rra-presentations';
  const file = application.presentationFile;
  const filePath = `${application.id}/${Date.now()}-${safeFileName(file.name)}`;
  const bytes = Buffer.from(file.data, 'base64');

  const response = await fetch(`${url}/storage/v1/object/${bucket}/${filePath}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: bytes
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    console.error('Supabase file upload failed', response.status, message.slice(0, 300));
    throw new Error('Supabase file upload failed');
  }

  return {
    ...application,
    presentationFile: undefined,
    presentationUrl: `${url}/storage/v1/object/public/${bucket}/${filePath}`,
    presentationName: file.name,
    presentationType: file.type,
    presentationSize: file.size
  };
}

export async function createApplication(data: ApplicationInput) {
  if (!hasSupabaseConfig()) return createSqliteApplication(data);

  const application = await uploadSupabasePresentation(createRecord(data));
  const rows = await supabaseRequest<SupabaseApplicationRow[]>('applications?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(toRow(application))
  });

  return fromRow(rows[0]);
}

export async function listApplications() {
  if (!hasSupabaseConfig()) return listSqliteApplications();

  const rows = await supabaseRequest<SupabaseApplicationRow[]>('applications?select=*&order=created_at.desc&limit=300');
  return rows.map(fromRow);
}

export async function updateTelegramStatus(id: string, status: ApplicationRecord['telegramStatus']) {
  if (!hasSupabaseConfig()) {
    updateSqliteTelegramStatus(id, status);
    return;
  }

  await supabaseRequest<null>(`applications?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ telegram_status: status, updated_at: new Date().toISOString() })
  });
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus) {
  if (!hasSupabaseConfig()) return updateSqliteApplicationStatus(id, status);

  const rows = await supabaseRequest<SupabaseApplicationRow[]>(`applications?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() })
  });

  return rows[0] ? fromRow(rows[0]) : null;
}

export async function getApplication(id: string) {
  if (!hasSupabaseConfig()) return getSqliteApplication(id);

  const rows = await supabaseRequest<SupabaseApplicationRow[]>(`applications?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function getAuditByApplicationId(applicationId: string) {
  if (!hasSupabaseConfig()) return getSqliteAuditByApplicationId(applicationId);

  try {
    const rows = await supabaseRequest<SupabaseAuditRow[]>(
      `audits?application_id=eq.${encodeURIComponent(applicationId)}&select=*&order=updated_at.desc&limit=1`
    );
    return rows[0] ? fromAuditRow(rows[0]) : null;
  } catch (err) {
    console.error('[storage] getAuditByApplicationId Supabase failed, falling back to SQLite:', err);
    return getSqliteAuditByApplicationId(applicationId);
  }
}

export async function upsertAudit(applicationId: string, draft: AuditDraft, status: AuditRecord['status'] = 'draft') {
  if (!hasSupabaseConfig()) return upsertSqliteAudit(applicationId, draft, status);

  try {
    const existing = await getAuditByApplicationId(applicationId);
    if (existing) {
      const rows = await supabaseRequest<SupabaseAuditRow[]>(`audits?id=eq.${encodeURIComponent(existing.id)}&select=*`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(auditToRow(applicationId, draft, status))
      });
      return rows[0] ? fromAuditRow(rows[0]) : null;
    }
    const rows = await supabaseRequest<SupabaseAuditRow[]>('audits?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: `AUD-${Date.now().toString(36).toUpperCase()}`,
        ...auditToRow(applicationId, draft, status),
        created_at: new Date().toISOString()
      })
    });
    return rows[0] ? fromAuditRow(rows[0]) : null;
  } catch (err) {
    console.error('[storage] upsertAudit Supabase failed, falling back to SQLite:', err);
    return upsertSqliteAudit(applicationId, draft, status);
  }
}

export async function updateAudit(audit: Pick<AuditRecord, 'id' | 'status' | 'overallScore' | 'readinessLevel' | 'verdict' | 'summary' | 'blocks' | 'recommendations' | 'roadmap'>) {
  if (!hasSupabaseConfig()) return updateSqliteAudit(audit);

  try {
    const rows = await supabaseRequest<SupabaseAuditRow[]>(`audits?id=eq.${encodeURIComponent(audit.id)}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: audit.status,
        overall_score: audit.overallScore,
        readiness_level: audit.readinessLevel,
        verdict: audit.verdict,
        summary: audit.summary,
        blocks_json: audit.blocks,
        recommendations_json: audit.recommendations,
        roadmap_json: audit.roadmap,
        updated_at: new Date().toISOString()
      })
    });
    return rows[0] ? fromAuditRow(rows[0]) : null;
  } catch (err) {
    console.error('[storage] updateAudit Supabase failed, falling back to SQLite:', err);
    return updateSqliteAudit(audit);
  }
}
