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

function scoreClass(score: number) {
  if (score > 70) return 'good';
  if (score > 60) return 'mid';
  return 'bad';
}

function today() {
  return new Date().toLocaleDateString('ru-RU');
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
    megaphone: <><path d="M4 14h4l10 4V6L8 10H4v4z" /><path d="M8 14l2 6" /></>
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[kind] || paths.list}</svg>;
}

function blockIcon(blockId: string) {
  if (blockId === 'product') return 'product';
  if (blockId === 'company') return 'company';
  if (blockId === 'negotiation') return 'negotiation';
  return 'network';
}

function kpiIcon(title: string) {
  if (/рынок|аналог/i.test(title)) return 'market';
  if (/цена/i.test(title)) return 'price';
  if (/характер/i.test(title)) return 'list';
  if (/упаков/i.test(title)) return 'pack';
  if (/аудитор|команд|переговорщик|сегмент/i.test(title)) return 'people';
  if (/логист|цепочка/i.test(title)) return 'truck';
  if (/надеж|стабил/i.test(title)) return 'shield';
  if (/репутац|уник/i.test(title)) return 'star';
  if (/презентац/i.test(title)) return 'screen';
  if (/сайт/i.test(title)) return 'globe';
  if (/публич/i.test(title)) return 'megaphone';
  return 'network';
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
      <span>Данные и оценки носят экспертный характер и являются условными.</span>
    </footer>
  );
}

export default function AuditPresentationPage() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const [token, setToken] = useState('');
  const [application, setApplication] = useState<Application | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const blocks = audit?.blocks || [];
  const productBlock = blocks.find((block) => block.id === 'product') || blocks[0];
  const companyBlock = blocks.find((block) => block.id === 'company') || blocks[1];
  const negotiationBlock = blocks.find((block) => block.id === 'negotiation') || blocks[2];
  const networkBlock = blocks.find((block) => block.id === 'network_relevance' || block.id === 'network') || blocks[3];
  const networks = application?.networkNames || application?.targetNetworks || 'целевые сети требуют уточнения';

  const strongest = useMemo(() => {
    return [...blocks].sort((a, b) => b.score - a.score)[0];
  }, [blocks]);

  const weakest = useMemo(() => {
    return [...blocks].sort((a, b) => a.score - b.score)[0];
  }, [blocks]);

  useEffect(() => {
    const saved = window.localStorage.getItem('rra_admin_token') || '';
    setToken(saved);
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

  return (
    <main className="auditPresentation">
      <div className="auditPresentationControls">
        <Link href={`/admin/applications/${applicationId}/audit`}>Назад в Audit Studio</Link>
        <button type="button" onClick={() => window.print()}>Сохранить PDF</button>
      </div>

      <section className="clientSlide dashboardSlide">
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
            {blocks.map((block) => (
              <article className={scoreClass(block.score)} key={block.id}>
                <div className="slideIcon"><PresentationIcon kind={blockIcon(block.id)} /></div>
                <div>
                  <h3>{block.title}</h3>
                  <p>{block.goal}</p>
                  <i><span style={{ width: `${block.score}%` }} /></i>
                </div>
                <b>{block.score}%</b>
              </article>
            ))}
          </aside>
        </div>
        <SlideFooter />
      </section>

      {[productBlock, companyBlock, negotiationBlock, networkBlock].filter(Boolean).map((block, index) => (
        <section className="clientSlide blockSlide" key={block.id}>
          <SlideHeader page={index + 2} />
          <div className="blockSlideGrid">
            <div>
              <span className="slideEyebrow">Блок {index + 1}</span>
              <h1>{block.title}</h1>
              <p>{block.goal}</p>
              <div className={`blockScore ${scoreClass(block.score)}`}>
                <b>{block.score}%</b>
                <span>{block.score > 70 ? 'Сильный блок' : block.score > 60 ? 'Рабочая основа' : 'Требует доработки'}</span>
              </div>
              <div className="keyConclusion compact">
                <strong>Ключевой вывод</strong>
                <p>{block.conclusion}</p>
              </div>
            </div>
            <div>
              <h2 className="kpiTableTitle">Из чего складывается оценка</h2>
              <div className="kpiTable">
                {block.kpis.map((kpi) => (
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

      <section className="clientSlide insightSlide">
        <SlideHeader page={6} />
        <h1 className="recommendationsTitle">Что необходимо улучшить до переговоров</h1>
        <p>Пункты, которые сильнее всего влияют на решение закупщика. Сфокусируйтесь на них в первую очередь.</p>
        <div className="keyConclusion compact">
          <strong>Ключевой вывод</strong>
          <p>{audit.verdict}</p>
        </div>
        <div className="insightGrid">
          <article>
            <span>Сильная сторона</span>
            <h2>{strongest?.title || 'Не определено'}</h2>
            <p>{strongest?.conclusion || audit.summary}</p>
          </article>
          <article>
            <span>Зона риска</span>
            <h2>{weakest?.title || 'Не определено'}</h2>
            <p>{weakest?.conclusion || 'Требуется экспертная проверка.'}</p>
          </article>
          <article>
            <span>Релевантные сети</span>
            <h2>{networks}</h2>
            <p>Перед переговорами нужно подтвердить формат входа, объём пилота, условия поставки и категорийную релевантность.</p>
          </article>
        </div>
        <SlideFooter />
      </section>

      <section className="clientSlide recommendationsSlide">
        <SlideHeader page={7} />
        <h1>Дорожная карта по входу в сети</h1>
        <p>Пошаговый план действий на основе проведенного аудита</p>
        <div className="keyConclusion compact">
          <strong>Ключевой вывод</strong>
          <p>Ваша готовность к переговорам может быть повышена при последовательной реализации шагов из этой дорожной карты.</p>
        </div>
        <div className="recommendationList">
          {audit.roadmap.map((item, index) => (
            <article key={`${item}-${index}`}>
              <b>{index + 1}</b>
              <p>{item}</p>
            </article>
          ))}
        </div>
        <SlideFooter />
      </section>

      <section className="clientSlide roadmapSlide">
        <SlideHeader page={8} />
        <h1>Источники, инструменты и экспертная проверка</h1>
        <p>Прозрачность данных и экспертиза, на которых основаны выводы аудита</p>
        <div className="insightGrid">
          <article>
            <span>Используемые данные</span>
            <p>Материалы поставщика и анкета<br />Сайт, КП, презентация, прайс<br />Открытые данные о рынке и аналогах<br />Список сетей ближайшего ЦЗС</p>
          </article>
          <article>
            <span>Инструменты</span>
            <p>AI-assisted research<br />Экспертная проверка команды ЦЗС™<br />DaData / Контур.Фокус / ЕГРЮЛ<br />Каталоги сетей и маркетплейсы</p>
          </article>
          <article>
            <span>Проверка охватывает</span>
            <p>Продукт и рынок<br />Компания и надежность<br />Переговорная кампания<br />Релевантность сетям<br />Цифровые следы и репутация</p>
          </article>
        </div>
        <div className="nextStep">
          <strong>Ключевой вывод</strong>
          <p>Аудит проведён при участии специалиста ЦЗС™ по переговорам с розничными сетями и отраслевого эксперта по FMCG-категории.</p>
        </div>
        <SlideFooter />
      </section>
    </main>
  );
}
