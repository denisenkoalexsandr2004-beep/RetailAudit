import type { ApplicationRecord } from './storage';
import { auditMethodology, type AuditDraft } from './audit-methodology';

const DEFAULT_MODEL = 'gpt-5-nano';

function clamp(score: unknown) {
  const value = Number(score || 0);
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function readinessLevel(score: number) {
  if (score >= 80) return 'Высокая готовность';
  if (score >= 60) return 'Средняя готовность';
  if (score >= 40) return 'Низкая готовность';
  return 'Не готов к переговорам';
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
      ? raw.blocks.find((block) => block && typeof block === 'object' && (block as { id?: string }).id === methodBlock.id)
      : null;
    const sourceBlock = (rawBlock || {}) as Partial<AuditDraft['blocks'][number]>;
    const kpis = methodBlock.kpis.map((methodKpi) => {
      const rawKpi = Array.isArray(sourceBlock.kpis)
        ? sourceBlock.kpis.find((kpi) => kpi && typeof kpi === 'object' && (kpi as { id?: string }).id === methodKpi.id)
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
    verdict: normalizeText(raw.verdict, 'AI-аудит сформирован по методологии Retail Ready и требует экспертной проверки.'),
    summary: normalizeText(raw.summary, 'Черновой AI-анализ сформирован на основании анкеты поставщика и методологии Retail Ready.'),
    blocks,
    recommendations: normalizeList(raw.recommendations, [
      'Проверить выводы AI-аудита экспертом перед отправкой поставщику.'
    ]),
    roadmap: normalizeList(raw.roadmap, [
      'Проверить недостающие данные и подтвердить баллы по каждому блоку.'
    ])
  };
}

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

function methodologyPrompt() {
  return auditMethodology.map((block, index) => [
    `${index + 1}. ${block.title} (${block.weight}%)`,
    `Цель: ${block.goal}`,
    `KPI: ${block.kpis.map((kpi) => `${kpi.id}: ${kpi.title}`).join('; ')}`
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
                evidence: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' }
    },
    roadmap: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

export async function generateAIAuditDraft(application: ApplicationRecord): Promise<AuditDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.AI_AUDIT_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: 'system',
          content: [
            'Ты эксперт Центра Закупок Сетей по переговорам с розничными сетями.',
            'Сформируй черновой Retail Ready Аудит для поставщика строго по методологии.',
            'Не выдумывай факты. Если данных нет, снижай оценку и указывай, что нужно подтвердить.',
            'Пиши по-русски, деловым языком, коротко и конкретно.',
            'Каждый блок весит 25%, итоговый балл равен средневзвешенной оценке 4 блоков.'
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
