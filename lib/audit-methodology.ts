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
    maxScore: number;
  }>;
};

export const auditMethodology: MethodologyBlock[] = [
  {
    id: 'product',
    title: 'Готовность продукта',
    weight: 35,
    goal: 'Оценка рынка, аналогов, цен, характеристик и упаковки продукта',
    kpis: [
      { id: 'market_analogs', title: 'Рынок и аналоги', maxScore: 8 },
      { id: 'price', title: 'Цена и конкурентоспособность', maxScore: 8 },
      { id: 'product_characteristics', title: 'Характеристики продукта', maxScore: 7 },
      { id: 'packaging', title: 'Упаковка и визуальная подача', maxScore: 7 },
      { id: 'segment_audience', title: 'Соответствие сегменту и категории', maxScore: 5 }
    ]
  },
  {
    id: 'company',
    title: 'Готовность компании',
    weight: 25,
    goal: 'Оценка масштаба, производства, логистики, надежности и репутации компании',
    kpis: [
      { id: 'business_scale', title: 'Оборот и масштаб бизнеса', maxScore: 6 },
      { id: 'production_readiness', title: 'Производственная готовность', maxScore: 5 },
      { id: 'supply_chain', title: 'Логистика и цепочка поставок', maxScore: 5 },
      { id: 'reliability', title: 'Надёжность и финансовая стабильность', maxScore: 5 },
      { id: 'reputation_experience', title: 'Репутация и публичность', maxScore: 4 }
    ]
  },
  {
    id: 'negotiation',
    title: 'Готовность переговорной кампании',
    weight: 25,
    goal: 'Аудит КП, презентации, сайта, публичности и опыта переговоров',
    kpis: [
      { id: 'presentation', title: 'Наличие КП и презентации', maxScore: 5 },
      { id: 'presentation_quality', title: 'Качество и содержание презентации', maxScore: 6 },
      { id: 'price_argumentation', title: 'Аргументация цены', maxScore: 6 },
      { id: 'site', title: 'Сайт и цифровое присутствие', maxScore: 4 },
      { id: 'negotiation_experience', title: 'Опыт переговоров и выставок', maxScore: 4 }
    ]
  },
  {
    id: 'network_relevance',
    title: 'Релевантность к актуальным запросам сетей',
    weight: 15,
    goal: 'Соответствие продукта запросам ближайшего ЦЗС и потенциальных сетей-партнёров',
    kpis: [
      { id: 'czs_category_match', title: 'Соответствие категориям ближайшего ЦЗС', maxScore: 5 },
      { id: 'format_match', title: 'Соответствие форматам сетей', maxScore: 4 },
      { id: 'geography_logistics', title: 'Географический охват и логистика', maxScore: 3 },
      { id: 'primary_negotiation_potential', title: 'Потенциал первичных переговоров', maxScore: 3 }
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
      packaging: [hasPresentation ? 70 : 46, evidence('КП/презентация', application.presentationName || application.presentationUrl), hasPresentation ? 'Есть материал для оценки упаковки и подачи.' : 'Упаковку нужно проверить по фото или презентации.'],
      segment_audience: [hasText(application.category) ? 68 : 35, evidence('Категория', application.category), 'Сегмент определён, целевую аудиторию нужно связать с форматом сетей.']
    };
    return map[kpiId] || [40, [], 'Показатель требует экспертной проверки.'];
  }

  if (blockId === 'company') {
    const map: Record<string, [number, string[], string]> = {
      business_scale: [volume > 0 ? 58 + Math.min(volume / 9000, 22) : 38, evidence('Объём', application.monthlyVolume), 'Масштаб бизнеса нужно подтвердить производственными ресурсами и стабильностью поставок.'],
      production_readiness: [hasEconomics ? 60 : 40, evidence('Производство', notes), 'Производственную готовность нужно подтвердить: объём, стандарты качества, возможность масштабирования.'],
      supply_chain: [/(логист|склад|достав|температур|регион)/i.test(`${description} ${notes}`) ? 68 : 42, evidence('Описание', description), 'Логистика и цепочка поставок требуют отдельного подтверждения.'],
      reliability: [hasEconomics ? 60 : 42, evidence('Экономика', application.retailPrice), 'Надёжность нужно подтвердить финансовыми и юридическими данными.'],
      reputation_experience: [hasText(networks) ? 62 : 40, evidence('Сети', networks), 'Репутацию и опыт нужно подтвердить кейсами или публичными данными.']
    };
    return map[kpiId] || [40, [], 'Показатель требует экспертной проверки.'];
  }

  if (blockId === 'negotiation') {
    const map: Record<string, [number, string[], string]> = {
      presentation: [hasPresentation ? 72 : 34, evidence('Материал', application.presentationName), hasPresentation ? 'КП или презентация приложена — структуру нужно проверить на закупочную логику.' : 'КП или презентация не приложена, готовность к переговорам снижена.'],
      presentation_quality: [hasPresentation ? 65 : 30, evidence('КП/презентация', application.presentationName || application.presentationUrl), hasPresentation ? 'Структуру и содержание презентации нужно проверить: аргументы, УТП, условия.' : 'Качество презентации невозможно оценить без материала.'],
      price_argumentation: [hasEconomics ? 60 + Math.min(Math.max(margin, 0), 15) : 36, evidence('Цена', application.retailPrice), 'Аргументация цены должна показывать ценность для сети и маржинальность.'],
      site: [/(сайт|каталог|маркетплейс|ozon|wildberries|вкусвилл|яндекс)/i.test(`${description} ${notes}`) ? 65 : 40, evidence('Публичные материалы', `${description} ${notes}`), 'Сайт должен подтверждать зрелость компании и продукта.'],
      negotiation_experience: [/(выстав|переговор|закупщик|сеть|ритейл|дистрибьют)/i.test(`${description} ${notes}`) ? 68 : 44, evidence('Опыт', notes), 'Опыт переговоров с сетями и участие в выставках повышают шанс успешного входа.']
    };
    return map[kpiId] || [40, [], 'Показатель требует экспертной проверки.'];
  }

  // network_relevance
  const map: Record<string, [number, string[], string]> = {
    czs_category_match: [hasText(application.category) ? 65 : 40, evidence('Категория', application.category), 'Соответствие категориям ближайшего ЦЗС нужно подтвердить актуальным запросом закупщиков.'],
    format_match: [hasText(application.targetNetworks) || hasText(networks) ? 62 : 44, evidence('Целевые форматы', application.targetNetworks || networks), 'Форматы нужно выбрать исходя из конкурентного анализа и запросов сетей.'],
    geography_logistics: [volume > 0 ? 58 + Math.min(volume / 12000, 18) : 40, evidence('Объём и логистика', application.monthlyVolume), 'Географический охват и логистические возможности нужно подтвердить отдельно.'],
    primary_negotiation_potential: [hasPresentation && hasEconomics ? 64 : 42, evidence('Пакет для переговоров', application.presentationName || ''), 'Потенциал первичных переговоров зависит от полноты пакета: КП, цена, условия, объём.']
  };
  return map[kpiId] || [40, [], 'Показатель требует экспертной проверки.'];
}

function level(score: number) {
  if (score >= 91) return 'Сильная готовность к переговорам';
  if (score >= 76) return 'Высокая готовность к переговорам';
  if (score >= 61) return 'Можно готовиться к переговорам';
  if (score >= 41) return 'Есть потенциал, нужна подготовка';
  return 'К сетям идти рано';
}

function verdict(score: number, company: string, product: string) {
  if (score >= 91) return `${company} с продуктом «${product}» демонстрирует сильную готовность — фокус на выборе конкретных сетей и условиях входа.`;
  if (score >= 76) return `${company} с продуктом «${product}» имеет высокую готовность к переговорам после финальной экспертной проверки и подготовки КП.`;
  if (score >= 61) return `${company} с продуктом «${product}» может готовиться к переговорам: есть рабочая основа, но до выхода в сеть нужно усилить доказательную базу.`;
  if (score >= 41) return `${company} с продуктом «${product}» имеет потенциал, но требует существенной подготовки перед выходом в сети.`;
  return `${company} с продуктом «${product}» пока не готов к переговорам — необходимо серьёзно доработать продукт, компанию и переговорную кампанию.`;
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
      conclusion: `${block.title}: ${level(score).toLowerCase()}. ${score >= 61 ? 'Блок можно брать в работу и уточнять доказательства.' : 'Блок требует доработки перед финальным отчётом.'}`,
      kpis
    };
  });

  const overallScore = clamp(blocks.reduce((sum, block) => sum + block.score * (block.weight / 100), 0));
  const readinessLevel = level(overallScore);
  const weakBlocks = blocks.filter((block) => block.score < 61).map((block) => block.title.toLowerCase());
  const recommendations = [
    'Собрать и приложить подтверждающие документы: сертификаты, декларации, маркировку, производственные и логистические данные.',
    'Доработать коммерческое предложение под закупщика сети: цена, условия, маржинальность, промо, пилотная поставка.',
    'Сравнить продукт с 3–5 аналогами в целевой категории по цене, упаковке, УТП и полочному сценарию.',
    weakBlocks.length ? `В первую очередь усилить блоки: ${weakBlocks.join(', ')}.` : 'Зафиксировать доказательства по каждому блоку и подготовить финальную презентацию для сети.'
  ];

  return {
    overallScore,
    readinessLevel,
    verdict: verdict(overallScore, application.company, application.productName),
    summary: `Черновой аудит сформирован по методологии Retail Ready™: продукт (35%), компания (25%), переговорная кампания (25%), релевантность сетям (15%). Оценка основана на данных заявки и требует экспертной валидации перед передачей клиенту.`,
    blocks,
    recommendations,
    roadmap: [
      'Шаг 1: Собрать полный пакет документов — сертификаты, декларации, маркировка, производственные и логистические данные.',
      'Шаг 2: Провести конкурентное сравнение по цене, упаковке и УТП в 3–5 аналогах целевой категории.',
      'Шаг 3: Доработать КП, презентацию и аргументацию цены под конкретные форматы сетей.',
      'Шаг 4: Уточнить релевантные форматы и сети, подготовить список первичных контактов.',
      'Шаг 5: Экспертная проверка всего пакета и подготовка к первому контакту с закупщиком.'
    ]
  };
}
