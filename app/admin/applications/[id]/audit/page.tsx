'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getTariffLabel, type TariffCode } from '@/lib/tariffs';

type Application = {
  id: string;
  name?: string;
  company: string;
  phone?: string;
  telegram?: string;
  email?: string;
  productName: string;
  category: string;
  description: string;
  tariff: TariffCode;
  status?: 'new' | 'invoice_sent' | 'paid_in_work' | 'completed' | 'rejected';
  createdAt?: string;
  productionCost?: string;
  retailPrice?: string;
  monthlyVolume?: string;
  networkNames?: string;
  targetNetworks?: string;
  federalNetworks?: string;
  regionalNetworks?: string;
  localNetworks?: string;
  unknownNetworks?: string;
  presentationUrl?: string;
  presentationName?: string;
  notes?: string;
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
  applicationId: string;
  status: 'draft' | 'expert_review' | 'approved';
  overallScore: number;
  readinessLevel: string;
  verdict: string;
  summary: string;
  blocks: AuditBlock[];
  recommendations: string[];
  roadmap: string[];
  updatedAt: string;
};

const statusLabels: Record<Audit['status'], string> = {
  draft: 'Черновик',
  expert_review: 'Экспертная проверка',
  approved: 'Утверждён'
};

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score || 0)));
}

function readinessLevel(score: number) {
  if (score >= 80) return 'Высокая готовность';
  if (score >= 60) return 'Средняя готовность';
  if (score >= 40) return 'Низкая готовность';
  return 'Не готов к переговорам';
}

function recalculate(audit: Audit): Audit {
  const blocks = audit.blocks.map((block) => {
    const score = clamp(block.kpis.reduce((sum, kpi) => sum + clamp(kpi.score), 0) / Math.max(block.kpis.length, 1));
    return { ...block, score };
  });
  const overallScore = clamp(blocks.reduce((sum, block) => sum + block.score * (block.weight / 100), 0));
  return { ...audit, blocks, overallScore, readinessLevel: readinessLevel(overallScore) };
}

function linesToArray(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

export default function AuditStudioPage() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const [token, setToken] = useState('');
  const [application, setApplication] = useState<Application | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeBlockId, setActiveBlockId] = useState('');
  const [funnelApplications, setFunnelApplications] = useState<Application[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState(applicationId);

  const activeBlock = useMemo(
    () => audit?.blocks.find((block) => block.id === activeBlockId) || audit?.blocks[0] || null,
    [activeBlockId, audit]
  );

  const paidInWorkApplications = useMemo(
    () => funnelApplications.filter((item) => item.status === 'paid_in_work'),
    [funnelApplications]
  );

  const selectedFunnelApplication = useMemo(
    () => paidInWorkApplications.find((item) => item.id === selectedFunnelId)
      || paidInWorkApplications.find((item) => item.id === applicationId)
      || application,
    [application, applicationId, paidInWorkApplications, selectedFunnelId]
  );

  async function request(path: string, init: RequestInit = {}, currentToken = token) {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('x-admin-token', currentToken);
    const response = await fetch(path, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Запрос не выполнен. HTTP ${response.status}`);
    return data;
  }

  async function load(currentToken = token) {
    setLoading(true);
    setError('');
    try {
      const [data, listData] = await Promise.all([
        request(`/api/admin/audits?applicationId=${encodeURIComponent(applicationId)}`, {}, currentToken),
        request('/api/admin/applications', {}, currentToken)
      ]);
      setApplication(data.application || null);
      setAudit(data.audit || null);
      setFunnelApplications(listData.applications || []);
      setActiveBlockId(data.audit?.blocks?.[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить аудит.');
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const data = await request('/api/admin/audits', {
        method: 'POST',
        body: JSON.stringify({ applicationId })
      });
      setApplication(data.application || null);
      setAudit(data.audit || null);
      setActiveBlockId(data.audit?.blocks?.[0]?.id || '');
      setMessage('Черновик аудита сформирован.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сформировать аудит.');
    } finally {
      setWorking(false);
    }
  }

  async function generateAi() {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const data = await request('/api/admin/audits/ai', {
        method: 'POST',
        body: JSON.stringify({ applicationId })
      });
      setApplication(data.application || null);
      setAudit(data.audit || null);
      setActiveBlockId(data.audit?.blocks?.[0]?.id || '');
      setMessage('AI-аудит сформирован. Проверьте выводы экспертом перед отправкой поставщику.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сформировать AI-аудит.');
    } finally {
      setWorking(false);
    }
  }

  async function save(nextAudit = audit) {
    if (!nextAudit) return;
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const normalized = recalculate(nextAudit);
      const data = await request('/api/admin/audits', {
        method: 'PATCH',
        body: JSON.stringify(normalized)
      });
      setAudit(data.audit);
      setMessage('Аудит сохранён.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить аудит.');
    } finally {
      setWorking(false);
    }
  }

  async function openPresentation() {
    if (audit) await save(audit);
    window.location.href = `/admin/applications/${applicationId}/audit/presentation`;
  }

  function updateAudit(next: Audit) {
    setAudit(recalculate(next));
  }

  function updateKpi(blockId: string, kpiId: string, patch: Partial<AuditKpi>) {
    if (!audit) return;
    updateAudit({
      ...audit,
      blocks: audit.blocks.map((block) => block.id === blockId
        ? { ...block, kpis: block.kpis.map((kpi) => kpi.id === kpiId ? { ...kpi, ...patch } : kpi) }
        : block)
    });
  }

  useEffect(() => {
    const saved = window.localStorage.getItem('rra_admin_token') || '';
    setToken(saved);
    setSelectedFunnelId(applicationId);
    if (saved) load(saved);
    else setLoading(false);
  }, [applicationId]);

  return (
    <main className="adminExact adminRetail auditStudio">
      <nav className="adminExactNav">
        <Link className="adminExactBrand" href="/admin/applications">
          <span className="adminExactPill">Сейл Трекер</span>
          <span className="adminExactTitle">Ритейл <b>контракт</b></span>
        </Link>
        <div className="adminExactLinks">
          <Link href="/admin/applications">Заявки</Link>
          <Link href="/">Сайт</Link>
        </div>
      </nav>

      <section className="adminExactHero auditStudioHero">
        <div className="adminExactContainer adminExactHeroGrid">
          <div className="adminExactHeroLeft">
            <div className="adminExactTag">
              <span />
              <b>Внутренний аудит</b>
            </div>
            <h1>Audit Studio</h1>
            <p>{application ? `${application.company} · ${application.productName}` : 'Рабочее место эксперта Ритейл контракта'}</p>
          </div>
          {audit && (
            <div className="auditScorePanel">
              <span>{statusLabels[audit.status]}</span>
              <b>{audit.overallScore}</b>
              <em>{audit.readinessLevel}</em>
            </div>
          )}
        </div>
      </section>

      {!token && (
        <section className="auditStudioEmpty adminExactContainer">
          <h2>Нужен вход в админку</h2>
          <p>Откройте админку и войдите под логином менеджера.</p>
          <Link className="auditStudioButton" href="/admin/applications">Войти</Link>
        </section>
      )}

      {token && loading && <div className="adminExactError">Загружаю Audit Studio...</div>}
      {error && <div className="adminExactError">{error}</div>}
      {message && <div className="auditStudioNotice adminExactContainer">{message}</div>}

      {token && !loading && application && (
        <section className="auditStudioWork adminExactContainer">
          <aside className="auditStudioSidebar">
            <section className="auditStudioFunnelList">
              <div className="auditStudioFunnelHead">
                <span>Воронка</span>
                <b>{paidInWorkApplications.length}</b>
              </div>
              <h3>Счёт оплачен, в работе</h3>
              <p>Все анкеты, которые сейчас находятся на этом этапе.</p>
              <div className="auditStudioFunnelItems">
                {paidInWorkApplications.length ? paidInWorkApplications.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={item.id === selectedFunnelId ? 'active' : ''}
                    onClick={() => setSelectedFunnelId(item.id)}
                  >
                    <em>{index + 1}</em>
                    <span>
                      <strong>{item.productName}</strong>
                      <small>{item.company}</small>
                    </span>
                  </button>
                )) : (
                  <div className="auditStudioFunnelEmpty">На этом этапе пока нет заявок.</div>
                )}
              </div>
            </section>

            {selectedFunnelApplication && (
              <section className="auditStudioSupplierCard">
                <div className="auditStudioSupplierTop">
                  <span>Поставщик</span>
                  <b>{selectedFunnelApplication.id}</b>
                </div>
                <h3>{selectedFunnelApplication.company}</h3>
                <p>{selectedFunnelApplication.productName}</p>
                <dl>
                  <div><dt>Контакт</dt><dd>{selectedFunnelApplication.name || '-'}</dd></div>
                  <div><dt>Телефон</dt><dd>{selectedFunnelApplication.phone || '-'}</dd></div>
                  <div><dt>Telegram</dt><dd>{selectedFunnelApplication.telegram || '-'}</dd></div>
                  <div><dt>Email</dt><dd>{selectedFunnelApplication.email || '-'}</dd></div>
                  <div><dt>Категория</dt><dd>{selectedFunnelApplication.category || '-'}</dd></div>
                  <div><dt>Сети</dt><dd>{selectedFunnelApplication.networkNames || selectedFunnelApplication.targetNetworks || '-'}</dd></div>
                </dl>
                <Link className="auditStudioSupplierLink" href={`/admin/applications/${selectedFunnelApplication.id}/audit`}>
                  Открыть аудит заявки
                </Link>
              </section>
            )}

            <section>
              <h2>{application.productName}</h2>
              <p>{application.company}</p>
              <dl>
                <div><dt>Категория</dt><dd>{application.category}</dd></div>
                <div><dt>Тариф</dt><dd>{getTariffLabel(application.tariff, true)}</dd></div>
                <div><dt>Цена / РРЦ</dt><dd>{application.productionCost || '-'} / {application.retailPrice || '-'}</dd></div>
                <div><dt>Объём</dt><dd>{application.monthlyVolume || '-'}</dd></div>
                <div><dt>Сети</dt><dd>{application.networkNames || application.targetNetworks || '-'}</dd></div>
              </dl>
            </section>

            <section>
              <h3>Материалы</h3>
              <p>{application.presentationUrl ? <a href={application.presentationUrl} target="_blank" rel="noreferrer">{application.presentationName || 'Открыть КП'}</a> : 'КП не приложено'}</p>
            </section>

            <section>
              <h3>Описание</h3>
              <p>{application.description}</p>
            </section>
          </aside>

          <article className="auditStudioMain">
            {!audit ? (
              <div className="auditStudioEmpty">
                <h2>Аудит ещё не создан</h2>
                <p>Заявка готова к первичному скорингу по методологии Ритейл контракта.</p>
                <button className="auditStudioButton" type="button" onClick={generate} disabled={working}>
                  {working ? 'Формирую...' : 'Сформировать черновик'}
                </button>
              </div>
            ) : (
              <>
                <header className="auditStudioToolbar">
                  <div>
                    <span>Итоговый вердикт</span>
                    <h2>{audit.readinessLevel}</h2>
                  </div>
                  <div className="auditStudioActions">
                    <Link className="auditStudioBackButton" href="/admin/applications">← К заявкам</Link>
                    <select value={audit.status} onChange={(event) => updateAudit({ ...audit, status: event.target.value as Audit['status'] })}>
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button className="auditStudioAiButton" type="button" onClick={generateAi} disabled={working}>AI-аудит</button>
                    <button type="button" onClick={generate} disabled={working}>Пересобрать</button>
                    <button type="button" onClick={() => save()} disabled={working}>{working ? 'Сохраняю...' : 'Сохранить'}</button>
                    <button className="auditStudioPresentationButton" type="button" onClick={openPresentation} disabled={working}>
                      Сгенерировать презентацию
                    </button>
                  </div>
                </header>

                <div className="auditStudioVerdict">
                  <label>
                    Вердикт
                    <textarea rows={3} value={audit.verdict} onChange={(event) => updateAudit({ ...audit, verdict: event.target.value })} />
                  </label>
                  <label>
                    Резюме
                    <textarea rows={3} value={audit.summary} onChange={(event) => updateAudit({ ...audit, summary: event.target.value })} />
                  </label>
                </div>

                <div className="auditStudioBlocks">
                  {audit.blocks.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      className={activeBlock?.id === block.id ? 'active' : ''}
                      onClick={() => setActiveBlockId(block.id)}
                    >
                      <span>{block.title}</span>
                      <b>{block.score}</b>
                      <em>{block.weight}%</em>
                    </button>
                  ))}
                </div>

                {activeBlock && (
                  <section className="auditStudioBlock">
                    <div className="auditStudioBlockHead">
                      <div>
                        <span>{activeBlock.goal}</span>
                        <h3>{activeBlock.title}</h3>
                      </div>
                      <strong>{activeBlock.score}</strong>
                    </div>

                    <label className="auditStudioConclusion">
                      Ключевой вывод
                      <textarea
                        rows={2}
                        value={activeBlock.conclusion}
                        onChange={(event) => updateAudit({
                          ...audit,
                          blocks: audit.blocks.map((block) => block.id === activeBlock.id ? { ...block, conclusion: event.target.value } : block)
                        })}
                      />
                    </label>

                    <div className="auditStudioKpis">
                      {activeBlock.kpis.map((kpi) => (
                        <section key={kpi.id}>
                          <div>
                            <h4>{kpi.title}</h4>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={kpi.score}
                              onChange={(event) => updateKpi(activeBlock.id, kpi.id, { score: clamp(Number(event.target.value)) })}
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={kpi.comment}
                            onChange={(event) => updateKpi(activeBlock.id, kpi.id, { comment: event.target.value })}
                          />
                          <input
                            value={kpi.evidence.join(' | ')}
                            onChange={(event) => updateKpi(activeBlock.id, kpi.id, { evidence: event.target.value.split('|').map((item) => item.trim()).filter(Boolean) })}
                            placeholder="Доказательства через |"
                          />
                        </section>
                      ))}
                    </div>
                  </section>
                )}

                <section className="auditStudioLists">
                  <label>
                    Рекомендации
                    <textarea rows={6} value={audit.recommendations.join('\n')} onChange={(event) => updateAudit({ ...audit, recommendations: linesToArray(event.target.value) })} />
                  </label>
                  <label>
                    Дорожная карта
                    <textarea rows={6} value={audit.roadmap.join('\n')} onChange={(event) => updateAudit({ ...audit, roadmap: linesToArray(event.target.value) })} />
                  </label>
                </section>
              </>
            )}
          </article>
        </section>
      )}
    </main>
  );
}
