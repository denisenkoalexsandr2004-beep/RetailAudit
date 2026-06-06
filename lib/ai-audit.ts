import type { ApplicationRecord } from './storage';
import { auditMethodology, type AuditDraft } from './audit-methodology';

const DEFAULT_MODEL_OPENAI = 'gpt-4o-mini';
const DEFAULT_MODEL_CLAUDE = 'claude-haiku-4-5-20251001';

// ─── normalizers ──────────────────────────────────────────────────────────────

function clamp(score: unknown) {
  const value = Number(score || 0);
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function readinessLevel(score: number) {
  if (score >= 91) return 'Сильная готовность к переговорам';
  if (score >= 76) return 'Высокая готовность к переговорам';
  if (score >= 61) return 'Можно готовиться к переговорам';
  if (score >= 41) return 'Есть потенциал, нужна подготовка';
  return 'К сетям идти рано';
}

function normalizeText(value: unknown, fallback = '') {
  return String(value || fallback).trim();
}

function normalizeList(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => normalizeText(item)).filter(Boolean).slice(0, 8);
}

function normalizeAuditDraft(value: unknown): AuditDraft {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<AuditDraft>;
  const blocks = auditMethodology.map((methodBlock) => {
    const rawBlock = Array.isArray(raw.blocks)
      ? raw.blocks.find((b) => b && typeof b === 'object' && (b as { id?: string }).id === methodBlock.id)
      : null;
    const sourceBlock = (rawBlock || {}) as Partial<AuditDraft['blocks'][number]>;
    const kpis = methodBlock.kpis.map((methodKpi) => {
      const rawKpi = Array.isArray(sourceBlock.kpis)
        ? sourceBlock.kpis.find((k) => k && typeof k === 'object' && (k as { id?: string }).id === methodKpi.id)
        : null;
      const sourceKpi = (rawKpi || {}) as Partial<AuditDraft['blocks'][number]['kpis'][number]>;
      return {
        id: methodKpi.id,
        title: methodKpi.title,
        score: clamp(sourceKpi.score),
        comment: normalizeText(sourceKpi.comment, 'Показатель требует экспертной проверки.'),
        evidence: normalizeList(sourceKpi.evidence)
      };
    });
    const score = clamp(kpis.reduce((sum, kpi) => sum + kpi.score, 0) / Math.max(kpis.length, 1));
    return {
      id: methodBlock.id,
      title: methodBlock.title,
      weight: methodBlock.weight,
      goal: methodBlock.goal,
      score,
      conclusion: normalizeText(sourceBlock.conclusion, `${methodBlock.title}: требуется экспертная валидация.`),
      kpis
    };
  });
  const overallScore = clamp(blocks.reduce((sum, block) => sum + block.score * (block.weight / 100), 0));
  return {
    overallScore,
    readinessLevel: normalizeText(raw.readinessLevel, readinessLevel(overallScore)),
    verdict: normalizeText(raw.verdict, 'AI-аудит сформирован по методологии Retail Ready™ и требует экспертной проверки.'),
    summary: normalizeText(raw.summary, 'Черновой AI-анализ сформирован на основании анкеты поставщика и методологии Retail Ready™.'),
    blocks,
    recommendations: normalizeList(raw.recommendations, ['Проверить выводы AI-аудита экспертом перед отправкой поставщику.']),
    roadmap: normalizeList(raw.roadmap, ['Проверить недостающие данные и подтвердить баллы по каждому блоку.'])
  };
}

// ─── prompt builders ──────────────────────────────────────────────────────────

function methodologyPrompt() {
  return auditMethodology.map((block, index) => [
    `${index + 1}. ${block.title} (вес ${block.weight}%)`,
    `Цель: ${block.goal}`,
    `KPI: ${block.kpis.map((kpi) => `${kpi.id} (макс. ${kpi.maxScore} пт): ${kpi.title}`).join('; ')}`
  ].join('\n')).join('\n\n');
}

function applicationPrompt(application: ApplicationRecord) {
  return JSON.stringify({
    id: application.id,
    company: application.company,
    contact: application.name,
    productName: application.productName,
    category: application.category,
    description: application.description,
    tariff: application.tariff,
    productionCost: application.productionCost,
    retailPrice: application.retailPrice,
    monthlyVolume: application.monthlyVolume,
    targetNetworks: application.targetNetworks,
    networkNames: application.networkNames,
    federalNetworks: application.federalNetworks,
    regionalNetworks: application.regionalNetworks,
    localNetworks: application.localNetworks,
    unknownNetworks: application.unknownNetworks,
    presentationName: application.presentationName,
    presentationUrl: application.presentationUrl,
    notes: application.notes
  }, null, 2);
}

// ─── PDF helper ───────────────────────────────────────────────────────────────

function hasPdfPresentation(application: ApplicationRecord): boolean {
  const url = application.presentationUrl || '';
  const name = application.presentationName || '';
  const type = application.presentationType || '';
  return url.length > 0 && (
    type.toLowerCase().includes('pdf') ||
    name.toLowerCase().endsWith('.pdf') ||
    url.toLowerCase().includes('.pdf')
  );
}

async function fetchPdfBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    // Skip files over 15 MB to stay within API limits
    if (buffer.byteLength > 15 * 1024 * 1024) return null;
    return Buffer.from(buffer).toString('base64');
  } catch {
    return null;
  }
}

// ─── Claude (primary) ─────────────────────────────────────────────────────────

const CLAUDE_SYSTEM = `Ты старший эксперт Центра Закупок Сетей™ по переговорам с розничными сетями.
Твоя задача — провести Retail Ready Аудит поставщика строго по методологии ЦЗС™.

ПРАВИЛА:
- Не выдумывай факты. Если данных нет — снижай балл и пиши, что нужно подтвердить.
- Если приложена презентация или КП — внимательно читай её содержимое и используй при оценке блоков.
- Пиши по-русски, деловым языком, коротко и конкретно.
- Оценка KPI: от 0 до 100 (целое число). Итоговый балл = продукт×0.35 + компания×0.25 + кампания×0.25 + сети×0.15.
- Возвращай ТОЛЬКО валидный JSON без markdown-блоков и без дополнительного текста.`;

async function callClaudeApi(messages: unknown[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.AI_AUDIT_MODEL_CLAUDE || DEFAULT_MODEL_CLAUDE,
      max_tokens: 6000,
      system: CLAUDE_SYSTEM,
      messages
    })
  });

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const msg = (data.error as { message?: string } | null)?.message || 'Anthropic request failed';
    throw new Error(msg);
  }

  const content = Array.isArray(data.content) ? data.content : [];
  for (const block of content) {
    if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
      return (block as { text: string }).text;
    }
  }
  throw new Error('Claude returned empty response');
}

async function generateClaudeAuditDraft(application: ApplicationRecord): Promise<AuditDraft> {
  const pdfBase64 = hasPdfPresentation(application)
    ? await fetchPdfBase64(application.presentationUrl!)
    : null;

  const textPart = [
    'МЕТОДОЛОГИЯ ОЦЕНКИ:\n' + methodologyPrompt(),
    '',
    'ДАННЫЕ ЗАЯВКИ ПОСТАВЩИКА:\n' + applicationPrompt(application),
    '',
    pdfBase64
      ? 'МАТЕРИАЛЫ ПОСТАВЩИКА: документ прикреплён выше — используй его содержимое при оценке блоков «Продукт» и «Переговорная кампания».'
      : 'Презентация/КП поставщика не загружена — оценивай только по данным анкеты.',
    '',
    'ЗАДАЧА: Проведи Retail Ready Аудит. Верни ТОЛЬКО JSON такой структуры:',
    '{',
    '  "overallScore": 0-100,',
    '  "readinessLevel": "строка из методологии",',
    '  "verdict": "1 абзац итогового вывода",',
    '  "summary": "1 абзац описания аудита",',
    '  "blocks": [',
    '    {',
    '      "id": "product|company|negotiation|network_relevance",',
    '      "score": 0-100,',
    '      "conclusion": "1-2 предложения по блоку",',
    '      "kpis": [{ "id": "kpi_id", "score": 0-100, "comment": "1 предложение", "evidence": ["факт из анкеты"] }]',
    '    }',
    '  ],',
    '  "recommendations": ["рекомендация 1", "рекомендация 2", "рекомендация 3", "рекомендация 4"],',
    '  "roadmap": ["Шаг 1: ...", "Шаг 2: ...", "Шаг 3: ...", "Шаг 4: ...", "Шаг 5: ..."]',
    '}'
  ].join('\n');

  const userContent: unknown[] = [];

  if (pdfBase64) {
    userContent.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
    });
  }

  userContent.push({ type: 'text', text: textPart });

  const raw = await callClaudeApi([{ role: 'user', content: userContent }]);
  // Strip markdown code fences Claude may add despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return normalizeAuditDraft(JSON.parse(cleaned));
}

// ─── OpenAI (fallback) ────────────────────────────────────────────────────────

function extractOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === 'string') return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
    }
  }
  return '';
}

const auditSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['overallScore', 'readinessLevel', 'verdict', 'summary', 'blocks', 'recommendations', 'roadmap'],
  properties: {
    overallScore: { type: 'number' },
    readinessLevel: { type: 'string' },
    verdict: { type: 'string' },
    summary: { type: 'string' },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'weight', 'goal', 'score', 'conclusion', 'kpis'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          weight: { type: 'number' },
          goal: { type: 'string' },
          score: { type: 'number' },
          conclusion: { type: 'string' },
          kpis: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'title', 'score', 'comment', 'evidence'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                score: { type: 'number' },
                comment: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    },
    recommendations: { type: 'array', items: { type: 'string' } },
    roadmap: { type: 'array', items: { type: 'string' } }
  }
};

async function generateOpenAIAuditDraft(application: ApplicationRecord): Promise<AuditDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.AI_AUDIT_MODEL || DEFAULT_MODEL_OPENAI,
      input: [
        {
          role: 'system',
          content: [
            'Ты эксперт Центра Закупок Сетей по переговорам с розничными сетями.',
            'Сформируй черновой Retail Ready Аудит для поставщика строго по методологии.',
            'Не выдумывай факты. Если данных нет, снижай оценку и указывай, что нужно подтвердить.',
            'Пиши по-русски, деловым языком, коротко и конкретно.',
            'Веса блоков: продукт 35%, компания 25%, переговорная кампания 25%, релевантность сетям 15%.'
          ].join('\n')
        },
        {
          role: 'user',
          content: [
            'Методология оценки:',
            methodologyPrompt(),
            '',
            'Данные заявки поставщика:',
            applicationPrompt(application),
            '',
            'Сформируй JSON для Audit Studio. Для каждого KPI дай score 0-100, comment и evidence из данных заявки.'
          ].join('\n')
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'retail_ready_audit',
          strict: true,
          schema: auditSchema
        }
      },
      max_output_tokens: 5000
    })
  });

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof data.error === 'object' && data.error && 'message' in data.error
      ? String((data.error as { message?: unknown }).message)
      : 'OpenAI request failed';
    throw new Error(message);
  }

  const text = extractOutputText(data);
  if (!text) throw new Error('OpenAI returned empty audit result');

  return normalizeAuditDraft(JSON.parse(text));
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function generateAIAuditDraft(application: ApplicationRecord): Promise<AuditDraft> {
  if (process.env.ANTHROPIC_API_KEY) {
    return generateClaudeAuditDraft(application);
  }
  return generateOpenAIAuditDraft(application);
}
