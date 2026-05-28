import type { ApplicationRecord } from './storage';

export type AuditKpiResult = {
  id: string;
  title: string;
  score: number;
  comment: string;
  evidence: string[];
};

export type AuditBlockResult = {
  id: string;
  title: string;
  weight: number;
  goal: string;
  score: number;
  conclusion: string;
  kpis: AuditKpiResult[];
};

export type AuditDraft = {
  overallScore: number;
  readinessLevel: string;
  verdict: string;
  summary: string;
  blocks: AuditBlockResult[];
  recommendations: string[];
  roadmap: string[];
};

type MethodologyBlock = {
  id: string;
  title: string;
  weight: number;
  goal: string;
  kpis: Array<{
    id: string;
    title: string;
  }>;
};

export const auditMethodology: MethodologyBlock[] = [
  {
    id: 'product',
    title: 'Готовность продукта',
    weight: 25,
    goal: 'Оценка рынка, аналогов, цен, характеристик и упаковки продукта',
    kpis: [
      { id: 'market_analogs', title: 'Рынок и аналоги' },
      { id: 'price', title: 'Цена' },
      { id: 'product_characteristics', title: 'Характеристики продукта' },
      { id: 'packaging', title: 'Упаковка' },
      { id: 'segment_audience', title: 'Сегмент и целевая аудитория' }
    ]
  },
  {
    id: 'company',
    title: 'Готовность компании',
    weight: 25,
    goal: 'Оценка масштаба, логистики, надежности и репутации компании',
    kpis: [
      { id: 'business_scale', title: 'Масштаб бизнеса' },
      { id: 'supply_chain', title: 'Логистика и цепочка поставок' },
      { id: 'reliability', title: 'Надежность и стабильность' },
      { id: 'reputation_experience', title: 'Репутация и опыт работы' },
      { id: 'team_expertise', title: 'Команда и экспертиза' }
    ]
  },
  {
    id: 'negotiation',
    title: 'Готовность переговорной кампании',
    weight: 25,
    goal: 'Аудит КП, презентации, сайта, публичности и готовности к первому контакту',
    kpis: [
      { id: 'presentation', title: 'Презентация и продающие материалы' },
      { id: 'price_argumentation', title: 'Аргументация цены' },
      { id: 'site', title: 'Сайт' },
      { id: 'public_activity', title: 'Публичная активность' },
      { id: 'negotiator_readiness', title: 'Готовность переговорщика' },
      { id: 'offer_uniqueness', title: 'Уникальность предложения' }
    ]
  },
  {
    id: 'network_relevance',
    title: 'Релевантность к актуальным запросам сетей',
    weight: 25,
    goal: 'Потенциально релевантные сети и форматы входа',
    kpis: [
      { id: 'convenience_channel', title: 'Канал удобства (АЗС / food-to-go)' },
      { id: 'healthy_specialized', title: 'Специализированный / ЗОЖ' },
      { id: 'hyper_super', title: 'Гипер / супер' },
      { id: 'supermarket', title: 'Супермаркет' },
      { id: 'near_home', title: 'Магазины у дома' }
    ]
  }
];

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function hasText(value?: string, minLength = 3) {
  return Boolean(value && value.trim().length >= minLength);
}

function numberValue(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function evidence(label: string, value?: string) {
  return hasText(value) ? [`${label}: ${value}`] : [];
}

function scoreKpi(application: ApplicationRecord, blockId: string, kpiId: string): [number, string[], string] {
  const description = application.description || '';
  const notes = application.notes || '';
  const networks = [
    application.networkNames,
    application.targetNetworks,
    application.federalNetworks,
    application.regionalNetworks,
    application.localNetworks,
    application.unknownNetworks
  ].filter(Boolean).join(', ');
  const hasPresentation = hasText(application.presentationUrl) || hasText(application.presentationName);
  const hasEconomics = numberValue(application.productionCost) > 0 && numberValue(application.retailPrice) > 0;
  const margin = hasEconomics
    ? ((numberValue(application.retailPrice) - numberValue(application.productionCost)) / numberValue(application.retailPrice)) * 100
    : 0;
  const volume = numberValue(application.monthlyVolume);

  if (blockId === 'product') {
    const base = 45 + Math.min(description.length / 20, 25);
    const map: Record<string, [number, string[], string]> = {
      market_analogs: [hasText(notes, 20) ? 70 : 52, evidence('Комментарий', notes), 'Продукт актуален для рынка, но аналоги и конкурентное окружение нужно подтвердить отдельным сравнением.'],
      price: [hasEconomics ? 58 + Math.min(Math.max(margin, 0), 30) : 42, [`Маржинальность по введённым данным: ${Math.max(0, Math.round(margin))}%`], 'Цена требует проверки на конкурентоспособность и восприятие в сегменте.'],
      product_characteristics: [base + (hasText(notes) ? 6 : 0), evidence('Описание', description), 'Состав и функциональность раскрыты частично, УТП нужно усилить.'],
      packaging: [hasPresentation ? 70 : 46, evidence('КП/презентация', application.presentationName || application.presentationUrl), hasPresentation ? 'Есть материал для оценки упаковки и подачи.' : 'Упаковку нужно проверить по фото/презентации.'],
      segment_audience: [hasText(application.category) ? 68 : 35, evidence('Категория', application.category), 'Сегмент определён, целевую аудиторию нужно связать с форматом сетей.']
    };
    return map[kpiId] || [40, [], 'Показатель требует экспертной проверки.'];
  }

  if (blockId === 'company') {
    const map: Record<string, [number, string[], string]> = {
      business_scale: [volume > 0 ? 58 + Math.min(volume / 9000, 22) : 38, evidence('Объём', application.monthlyVolume), 'Масштаб бизнеса нужно подтвердить производственными ресурсами и стабильностью поставок.'],
      supply_chain: [/(логист|склад|достав|температур|регион)/i.test(`${description} ${notes}`) ? 68 : 42, evidence('Описание', description), 'Логистика и цепочка поставок требуют отдельного подтверждения.'],
      reliability: [hasEconomics ? 60 : 42, evidence('Экономика', application.retailPrice), 'Надежность и стабильность нужно подтвердить финансовыми и юридическими данными.'],
      reputation_experience: [hasText(networks) ? 62 : 40, evidence('Сети', networks), 'Репутацию и опыт работы нужно подтвердить кейсами или публичными данными.'],
      team_expertise: [hasText(notes, 30) ? 66 : 48, evidence('Комментарий', notes), 'Компетенции команды для работы с ритейлом нужно раскрыть в материалах.']
    };
    return map[kpiId] || [40, [], 'Показатель требует экспертной проверки.'];
  }

  if (blockId === 'negotiation') {
    const map: Record<string, [number, string[], string]> = {
      presentation: [hasPresentation ? 70 : 34, evidence('Материал', application.presentationName), hasPresentation ? 'Презентация приложена, структуру нужно проверить на закупочную логику.' : 'Презентация не приложена, переговорная готовность снижена.'],
      price_argumentation: [hasEconomics ? 60 + Math.min(Math.max(margin, 0), 15) : 36, evidence('Цена', application.retailPrice), 'Аргументация цены должна показывать ценность для сети.'],
      site: [/(сайт|каталог|маркетплейс|ozon|wildberries|вкусвилл|яндекс)/i.test(`${description} ${notes}`) ? 65 : 40, evidence('Публичные материалы', `${description} ${notes}`), 'Сайт должен подтверждать зрелость компании и продукта.'],
      public_activity: [/(сми|выстав|публикац|соцсет|инстаграм|telegram|vk)/i.test(`${description} ${notes}`) ? 60 : 42, evidence('Публичность', notes), 'Публичная активность и упоминания требуют проверки.'],
      negotiator_readiness: [hasText(notes, 30) ? 65 : 48, evidence('Комментарий', notes), 'Готовность переговорщика нужно подтвердить опытом, компетенциями и подготовленными ответами.'],
      offer_uniqueness: [hasText(application.targetNetworks) ? 60 : 44, evidence('Целевые сети', application.targetNetworks), 'Уникальность предложения нужно сформулировать под конкретную сеть.']
    };
    return map[kpiId] || [40, [], 'Показатель требует экспертной проверки.'];
  }

  const map: Record<string, [number, string[], string]> = {
    convenience_channel: [/(напит|снек|батон|готов|перекус)/i.test(description) ? 76 : 56, evidence('Формат', application.category), 'Канал удобства подходит продуктам быстрого потребления и перекуса.'],
    healthy_specialized: [/(зож|здоров|функцион|без сахар|натурал|эко)/i.test(description) ? 82 : 58, evidence('Описание', description), 'Специализированный ЗОЖ-формат требует чёткого УТП и доказанной пользы.'],
    hyper_super: [volume > 0 ? 58 + Math.min(volume / 12000, 18) : 46, evidence('Объём', application.monthlyVolume), 'Гипер/супер требует объёма, промо и стабильной доступности.'],
    supermarket: [hasText(networks) ? 64 : 52, evidence('Сети', networks), 'Супермаркету важны цена, полочная логика и понятная категория.'],
    near_home: [hasEconomics ? 58 : 44, evidence('Цена', application.retailPrice), 'Магазины у дома требуют конкурентной цены и стабильных поставок.']
  };
  return map[kpiId] || [40, [], 'Показатель требует экспертной проверки.'];
}

function level(score: number) {
  if (score >= 80) return 'Высокая готовность';
  if (score >= 60) return 'Средняя готовность';
  if (score >= 40) return 'Низкая готовность';
  return 'Не готов к переговорам';
}

function verdict(score: number, company: string, product: string) {
  if (score >= 80) return `${company} с продуктом ${product} выглядит готовым к предметным переговорам с сетями после финальной экспертной проверки.`;
  if (score >= 60) return `${company} с продуктом ${product} имеет рабочую основу для переговоров, но до выхода в сети нужно усилить доказательную базу и коммерческое предложение.`;
  if (score >= 40) return `${company} с продуктом ${product} пока имеет существенные пробелы в готовности; сначала стоит доработать материалы, экономику и подтверждения.`;
  return `${company} с продуктом ${product} не готов к переговорам с сетями без серьёзной подготовки продукта, компании и коммерческого пакета.`;
}

export function generateAuditDraft(application: ApplicationRecord): AuditDraft {
  const blocks = auditMethodology.map((block) => {
    const kpis = block.kpis.map((kpi) => {
      const [rawScore, rawEvidence, comment] = scoreKpi(application, block.id, kpi.id);
      return {
        id: kpi.id,
        title: kpi.title,
        score: clamp(rawScore),
        comment,
        evidence: rawEvidence.filter(Boolean)
      };
    });
    const score = clamp(kpis.reduce((sum, kpi) => sum + kpi.score, 0) / kpis.length);
    return {
      id: block.id,
      title: block.title,
      weight: block.weight,
      goal: block.goal,
      score,
      conclusion: `${block.title}: ${level(score).toLowerCase()}. ${score >= 60 ? 'Блок можно брать в работу и уточнять доказательства.' : 'Блок требует доработки перед финальным отчётом.'}`,
      kpis
    };
  });

  const overallScore = clamp(blocks.reduce((sum, block) => sum + block.score * (block.weight / 100), 0));
  const readinessLevel = level(overallScore);
  const weakBlocks = blocks.filter((block) => block.score < 60).map((block) => block.title.toLowerCase());
  const recommendations = [
    'Собрать и приложить подтверждающие документы: сертификаты, декларации, маркировку, производственные и логистические данные.',
    'Доработать коммерческое предложение под закупщика сети: цена, условия, маржинальность, промо, пилотная поставка.',
    'Сравнить продукт с 3-5 аналогами в целевой категории по цене, упаковке, УТП и полочному сценарию.',
    weakBlocks.length ? `В первую очередь усилить блоки: ${weakBlocks.join(', ')}.` : 'Зафиксировать доказательства по каждому блоку и подготовить финальную презентацию для сети.'
  ];

  return {
    overallScore,
    readinessLevel,
    verdict: verdict(overallScore, application.company, application.productName),
    summary: `Черновой аудит сформирован по методологии Retail Ready: 4 блока по 25%. Оценка основана на данных заявки и требует экспертной валидации перед передачей клиенту.`,
    blocks,
    recommendations,
    roadmap: [
      'День 1: закрыть недостающие данные по компании, документам, производству и логистике.',
      'День 2: провести конкурентное сравнение и уточнить релевантные сети/форматы.',
      'День 3: доработать КП, презентацию, аргументацию цены и условия входа.',
      'День 4: экспертно подтвердить баллы и собрать финальный отчёт для поставщика.'
    ]
  };
}
