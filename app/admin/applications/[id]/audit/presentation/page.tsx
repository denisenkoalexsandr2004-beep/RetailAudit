'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

type Application = {
  id: string;
  company: string;
  productName: string;
  category: string;
  description: string;
  targetNetworks?: string;
  networkNames?: string;
  monthlyVolume?: string;
  productionCost?: string;
  retailPrice?: string;
};

type AuditKpi = {
  id: string;
  title: string;
  score: number;
  comment: string;
  evidence: string[];
};

type AuditBlock = {
  id: string;
  title: string;
  weight: number;
  goal: string;
  score: number;
  conclusion: string;
  kpis: AuditKpi[];
};

type Audit = {
  id: string;
  status: 'draft' | 'expert_review' | 'approved';
  overallScore: number;
  readinessLevel: string;
  verdict: string;
  summary: string;
  blocks: AuditBlock[];
  recommendations: string[];
  roadmap: string[];
};

const footerText = 'Данные и оценки носят экспертный характер и являются условными.';

function scoreClass(score: number) {
  if (score >= 76) return 'good';
  if (score >= 61) return 'mid';
  return 'bad';
}

function today() {
  return new Date().toLocaleDateString('ru-RU');
}

function networksFor(application: Application) {
  return application.networkNames || application.targetNetworks || 'целевые розничные сети';
}

function splitNetworks(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 7);
}

function blockIcon(blockId: string) {
  if (blockId === 'product') return 'product';
  if (blockId === 'company') return 'company';
  if (blockId === 'negotiation') return 'negotiation';
  return 'network';
}

function kpiIcon(title: string) {
  if (/рынок|аналог|масштаб|объем|объём|оборот/i.test(title)) return 'market';
  if (/цена|марж/i.test(title)) return 'price';
  if (/упаков|визуал/i.test(title)) return 'pack';
  if (/логист|постав|географ/i.test(title)) return 'truck';
  if (/сайт|цифров|публич/i.test(title)) return 'globe';
  if (/команд|переговор|опыт|выставк/i.test(title)) return 'people';
  if (/надеж|стабил|финанс/i.test(title)) return 'shield';
  if (/презентац|материал|кп|качество/i.test(title)) return 'screen';
  if (/категор|соответств|формат/i.test(title)) return 'target';
  if (/производств/i.test(title)) return 'database';
  if (/потенциал|первичн/i.test(title)) return 'star';
  if (/репутац/i.test(title)) return 'star';
  return 'list';
}

function PresentationIcon({ kind }: { kind: string }) {
  const paths: Record<string, ReactNode> = {
    product: <><path d="M4 7l8-4 8 4-8 4-8-4z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></>,
    company: <><path d="M4 21h16" /><path d="M6 21V8l6-4 6 4v13" /><path d="M9 10h2M13 10h2M9 14h2M13 14h2" /></>,
    negotiation: <><path d="M7 11a4 4 0 1 1 8 0" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M17 13a3 3 0 0 1 3 3v4" /></>,
    network: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 5V2M19 12h3M12 19v3M5 12H2" /></>,
    market: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16l3-4 3 2 5-7" /></>,
    price: <><path d="M20 12l-8 8-8-8V4h8l8 8z" /><circle cx="9" cy="9" r="1.5" /></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    pack: <><path d="M5 7l7-4 7 4v10l-7 4-7-4V7z" /><path d="M5 7l7 4 7-4" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M14 20a5 5 0 0 1 7 0" /></>,
    truck: <><path d="M3 7h11v10H3z" /><path d="M14 11h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M8 12l3 3 5-6" /></>,
    star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.1-5.6-3-5.6 3 1.1-6.1L3 9.6l6.2-.9L12 3z" />,
    screen: <><path d="M4 5h16v11H4z" /><path d="M9 20h6M12 16v4" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    bulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4z" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
    calendar: <><path d="M4 5h16v15H4z" /><path d="M8 3v4M16 3v4M4 9h16" /></>,
    database: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[kind] || paths.list}</svg>;
}

function SlideHeader({ page }: { page: number }) {
  return (
    <header>
      <span>Центр Закупок Сетей™</span>
      <b>Retail Ready Аудит</b>
      <em>{page} / 8</em>
    </header>
  );
}

function SlideFooter() {
  return (
    <footer>
      <span>Дата аудита: {today()}</span>
      <span>Срок подготовки отчёта: 48 часов</span>
      <span>{footerText}</span>
    </footer>
  );
}

function readinessText(score: number) {
  if (score >= 91) return 'сильный';
  if (score >= 76) return 'высокий';
  if (score >= 61) return 'средний';
  if (score >= 41) return 'низкий';
  return 'критичный';
}

export default function AuditPresentationPage() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const [application, setApplication] = useState<Application | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem('rra_admin_token') || '';
    if (!saved) {
      setLoading(false);
      setError('Нужен вход в админку.');
      return;
    }

    fetch(`/api/admin/audits?applicationId=${encodeURIComponent(applicationId)}`, {
      headers: { 'x-admin-token': saved }
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Не удалось загрузить аудит.');
        if (!data.audit) throw new Error('Сначала сформируйте и сохраните аудит в Audit Studio.');
        setApplication(data.application);
        setAudit(data.audit);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить презентацию.'))
      .finally(() => setLoading(false));
  }, [applicationId]);

  useEffect(() => {
    if (loading || error) return;
    const target = window.location.hash ? document.querySelector(window.location.hash) : null;
    target?.scrollIntoView({ block: 'start' });
  }, [loading, error]);

  const blocks = audit?.blocks || [];
  const strongest = useMemo(() => [...blocks].sort((a, b) => b.score - a.score)[0], [blocks]);
  const weakest = useMemo(() => [...blocks].sort((a, b) => a.score - b.score)[0], [blocks]);
  const riskKpis = useMemo(() => {
    return blocks
      .flatMap((block) => block.kpis.map((kpi) => ({ ...kpi, blockTitle: block.title })))
      .sort((a, b) => a.score - b.score)
      .slice(0, 4);
  }, [blocks]);

  if (loading) {
    return <main className="auditPresentationState">Готовлю клиентскую презентацию...</main>;
  }

  if (error || !application || !audit) {
    return (
      <main className="auditPresentationState">
        <h1>Презентация не готова</h1>
        <p>{error || 'Нет данных аудита.'}</p>
        <Link href={`/admin/applications/${applicationId}/audit`}>Вернуться в Audit Studio</Link>
      </main>
    );
  }

  const networks = networksFor(application);
  const networkRows = splitNetworks(networks);

  return (
    <main className="auditPresentation reportPresentation">
      <div className="auditPresentationControls">
        <Link href={`/admin/applications/${applicationId}/audit`}>Назад в Audit Studio</Link>
        <button type="button" onClick={() => window.print()}>Сохранить PDF</button>
      </div>

      <section className="clientSlide dashboardSlide" id="slide-1">
        <SlideHeader page={1} />
        <div className="dashboardGrid">
          <div>
            <h1>Дашборд готовности к переговорам с сетями</h1>
            <p>Поставщик: <strong>{application.company}</strong></p>
            <p>Продукт для оценки: {application.productName} | {application.category}</p>
            <div className={`bigGauge ${scoreClass(audit.overallScore)}`}>
              <span>Вы набрали</span>
              <b>{audit.overallScore}</b>
              <em>балла из 100</em>
            </div>
            <div className="keyConclusion">
              <strong>Ключевой вывод</strong>
              <p>{audit.verdict}</p>
            </div>
          </div>
          <aside>
            <h2>Из чего формируется общий балл</h2>
            {blocks.slice(0, 4).map((block, index) => (
              <article className={scoreClass(block.score)} key={block.id}>
                <div className="slideIcon"><PresentationIcon kind={blockIcon(block.id)} /></div>
                <div>
                  <h3>{index + 1}. {block.title}</h3>
                  <p>{block.goal}</p>
                  <i><span style={{ width: `${block.score}%` }} /></i>
                </div>
                <b>{block.score}%</b>
              </article>
            ))}
            <div className="detailHint">Детальный разбор по 4 блокам на следующих слайдах</div>
          </aside>
        </div>
        <SlideFooter />
      </section>

      {blocks.slice(0, 3).map((block, index) => (
        <section className="clientSlide blockSlide" id={`slide-${index + 2}`} key={block.id}>
          <SlideHeader page={index + 2} />
          <div className="blockSlideGrid">
            <div>
              <h1>{index + 1}. {block.title}</h1>
              <p>{block.goal}</p>
              <div className="scorePanel">
                <div className={`blockScore ${scoreClass(block.score)}`}>
                  <b>{block.score}%</b>
                  <span>готовность</span>
                </div>
                <p>Оценка показывает, насколько текущая подготовка закрывает требования сетей по этому блоку.</p>
              </div>
              <div className="keyConclusion compact">
                <strong>Ключевой вывод</strong>
                <p>{block.conclusion}</p>
              </div>
            </div>
            <div>
              <h2 className="kpiTableTitle">Из чего складывается оценка</h2>
              <div className="kpiTable reportKpiTable">
                {block.kpis.slice(0, 6).map((kpi) => (
                  <article className={scoreClass(kpi.score)} key={kpi.id}>
                    <div className="slideIcon"><PresentationIcon kind={kpiIcon(kpi.title)} /></div>
                    <div>
                      <h3>{kpi.title}</h3>
                      <p>{kpi.comment}</p>
                    </div>
                    <b>{kpi.score}%</b>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <SlideFooter />
        </section>
      ))}

      <section className="clientSlide networkReportSlide" id="slide-5">
        <SlideHeader page={5} />
        <h1>5. {blocks[3]?.title || 'Релевантность к актуальным запросам сетей'}</h1>
        <p>Потенциально релевантные сети и форматы входа для продукта {application.productName}</p>
        <div className="networkSlideGrid">
          <div>
            <h2>Оценка релевантности</h2>
            <div className="kpiTable reportKpiTable">
              {(blocks[3]?.kpis || []).slice(0, 4).map((kpi) => (
                <article className={scoreClass(kpi.score)} key={kpi.id}>
                  <div className="slideIcon"><PresentationIcon kind={kpiIcon(kpi.title)} /></div>
                  <div>
                    <h3>{kpi.title}</h3>
                    <p>{kpi.comment}</p>
                  </div>
                  <b>{kpi.score}%</b>
                </article>
              ))}
            </div>
          </div>
          <div>
            <h2>Потенциально релевантные сети</h2>
            <div className="auditTable">
              <div className="auditTableHead"><span>№</span><span>Сеть / формат</span><span>Комментарий</span><span>Порог входа</span></div>
              {(networkRows.length ? networkRows : ['ВкусВилл', 'Пятёрочка', 'Лента', 'Перекрёсток', 'Магнит']).map((network, index) => (
                <div className="auditTableRow" key={`${network}-${index}`}>
                  <b>{index + 1}</b>
                  <span>{network}</span>
                  <p>Нужны подтверждённые УТП, экономика, условия поставки и готовность к первому контакту.</p>
                  <em className={index < 2 ? 'good' : index < 4 ? 'mid' : 'bad'}>{index < 2 ? 'низкий' : index < 4 ? 'средний' : 'высокий'}</em>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="keyConclusion networkConclusion">
          <strong>Ключевой вывод</strong>
          <p>{blocks[3]?.conclusion || `Потенциальные сети для входа: ${networks}. Для успешного входа критичны экономика, объёмы и доказанная релевантность категории.`}</p>
        </div>
        <SlideFooter />
      </section>

      <section className="clientSlide improvementSlide" id="slide-6">
        <SlideHeader page={6} />
        <div className="improvementHead">
          <div>
            <h1>6. Что необходимо улучшить до переговоров</h1>
            <p>Пункты, которые сильнее всего влияют на решение закупщика. Сфокусируйтесь на них в первую очередь.</p>
          </div>
          <div className="keyConclusion compact">
            <strong>Ключевой вывод</strong>
            <p>{audit.verdict}</p>
          </div>
        </div>
        <div className="improvementTable">
          <div className="improvementTableHead"><span>№</span><span>Что улучшить</span><span>Почему это важно</span><span>Приоритет</span></div>
          {(riskKpis.length ? riskKpis : []).map((kpi, index) => (
            <article className={scoreClass(kpi.score)} key={`${kpi.blockTitle}-${kpi.id}`}>
              <b>{index + 1}</b>
              <div className="slideIcon"><PresentationIcon kind={kpiIcon(kpi.title)} /></div>
              <h3>{kpi.title}</h3>
              <p>{kpi.comment}</p>
              <em>{readinessText(kpi.score)}</em>
            </article>
          ))}
        </div>
        <SlideFooter />
      </section>

      <section className="clientSlide roadmapReportSlide" id="slide-7">
        <SlideHeader page={7} />
        <div className="improvementHead">
          <div>
            <h1>7. Дорожная карта по входу в сети</h1>
            <p>Пошаговый план действий на основе проведенного аудита</p>
          </div>
          <div className="keyConclusion compact">
            <strong>Ключевой вывод</strong>
            <p>Готовность к переговорам может быть повышена при последовательной реализации шагов из этой дорожной карты.</p>
          </div>
        </div>
        <div className="timelineRoadmap">
          {(audit.roadmap.length ? audit.roadmap : audit.recommendations).slice(0, 5).map((item, index) => (
            <article key={`${item}-${index}`}>
              <b>{index + 1}</b>
              <div className="slideIcon"><PresentationIcon kind={index === 4 ? 'calendar' : index === 3 ? 'market' : index === 2 ? 'negotiation' : 'target'} /></div>
              <h3>{item}</h3>
              <p>{index === 4 ? 'Получаете готовый пакет для первого контакта с закупщиком и реальные шансы на вход в сеть.' : 'Усиливает аргументацию, закрывает слабые места и повышает шанс успешного контакта.'}</p>
            </article>
          ))}
        </div>
        <div className="importantNote"><b>Важно</b><span>Консультация с экспертом ЦЗС доступна в течение 14 дней со дня отправки отчёта.</span></div>
        <SlideFooter />
      </section>

      <section className="clientSlide sourceReportSlide" id="slide-8">
        <SlideHeader page={8} />
        <h1>8. Источники, инструменты и экспертная проверка</h1>
        <p>Прозрачность данных и экспертиза, на которых основаны выводы аудита</p>
        <div className="sourceReportGrid">
          <article>
            <h2>Используемые данные</h2>
            <p>Материалы поставщика и анкета</p>
            <p>Сайт, КП, презентация, прайс</p>
            <p>Открытые данные о рынке и аналогах</p>
            <p>Список сетей ближайшего ЦЗС</p>
            <p>Обезличенная обратная связь закупщиков</p>
          </article>
          <article>
            <h2>Инструменты</h2>
            <p>AI-assisted research</p>
            <p>Экспертная проверка команды ЦЗС™</p>
            <p>DaData / КонтурФокус / ЕГРЮЛ</p>
            <p>Каталоги сетей и маркетплейсы</p>
            <p>Отраслевые СМИ и аналитика</p>
          </article>
          <article>
            <h2>Проверка охватывает</h2>
            <div className="coverage360">360°<span>проверка поставщика</span></div>
            <p>Продукт и рынок</p>
            <p>Компания и надежность</p>
            <p>Переговорная кампания</p>
            <p>Релевантность сетям</p>
          </article>
        </div>
        <div className="expertSignature">
          <div className="slideIcon"><PresentationIcon kind="people" /></div>
          <div>
            <h2>Экспертная подпись</h2>
            <p>Аудит проведён при участии специалиста ЦЗС™ по переговорам с розничными сетями и отраслевого эксперта по категории {application.category}.</p>
          </div>
          <div><b>500+</b><span>поставщиков прошли аудит</span></div>
          <div><b>35+</b><span>категорий FMCG</span></div>
          <div><b>1000+</b><span>переговоров подготовлено</span></div>
          <div><b>85%</b><span>клиентов рекомендуют аудит</span></div>
        </div>
        <SlideFooter />
      </section>
    </main>
  );
}
