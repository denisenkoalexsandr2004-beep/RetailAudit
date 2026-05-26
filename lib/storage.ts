import type { ApplicationInput } from './validation';

export type ApplicationStatus = 'new' | 'invoice_sent' | 'paid_in_work' | 'completed' | 'rejected';

export type ApplicationRecord = ApplicationInput & {
  id: string;
  status: ApplicationStatus;
  telegramStatus: 'sent' | 'failed' | 'not_configured';
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
    tariff: row.tariff === 'audit_plus' ? 'audit_plus' : 'audit',
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

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase storage is not configured');
  }

  return { url, key };
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
  const application = await uploadSupabasePresentation(createRecord(data));
  const rows = await supabaseRequest<SupabaseApplicationRow[]>('applications?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(toRow(application))
  });

  return fromRow(rows[0]);
}

export async function listApplications() {
  const rows = await supabaseRequest<SupabaseApplicationRow[]>('applications?select=*&order=created_at.desc&limit=300');
  return rows.map(fromRow);
}

export async function updateTelegramStatus(id: string, status: ApplicationRecord['telegramStatus']) {
  await supabaseRequest<null>(`applications?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ telegram_status: status, updated_at: new Date().toISOString() })
  });
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus) {
  const rows = await supabaseRequest<SupabaseApplicationRow[]>(`applications?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() })
  });

  return rows[0] ? fromRow(rows[0]) : null;
}
