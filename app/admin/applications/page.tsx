'use client';

import { useEffect, useMemo, useState } from 'react';
import { getTariffLabel } from '@/lib/tariffs';

type ApplicationStatus = 'new' | 'invoice_sent' | 'paid_in_work' | 'completed' | 'rejected';
type TariffCode = 'to_clarify' | 'audit' | 'audit_plus' | 'contract';

type Application = {
  id: string;
  name: string;
  company: string;
  phone: string;
  telegram?: string;
  email?: string;
  category: string;
  productName: string;
  description: string;
  tariff: TariffCode;
  status: ApplicationStatus;
  telegramStatus: 'sent' | 'failed' | 'not_configured';
  createdAt: string;
  productionCost?: string;
  retailPrice?: string;
  monthlyVolume?: string;
  targetNetworks?: string;
  networkLevel?: string;
  networkNames?: string;
  federalNetworks?: string;
  regionalNetworks?: string;
  localNetworks?: string;
  unknownNetworks?: string;
  presentationUrl?: string;
  presentationName?: string;
  presentationSize?: number;
  notes?: string;
};

const statusFlow: Array<{ value: ApplicationStatus; label: string; hint: string }> = [
  { value: 'new', label: 'Новая', hint: 'Заявка получена' },
  { value: 'invoice_sent', label: 'Счёт выставлен', hint: 'Ждём оплату' },
  { value: 'paid_in_work', label: 'В работе', hint: 'Запущен разбор' },
  { value: 'completed', label: 'Завершена', hint: 'Маршрут закрыт' },
  { value: 'rejected', label: 'Отказ', hint: 'Не подходит' }
];

const statusLabels = statusFlow.reduce(
  (acc, item) => ({ ...acc, [item.value]: item.label }),
  {} as Record<ApplicationStatus, string>
);

const telegramLabels = {
  sent: 'Отправлено',
  failed: 'Ошибка',
  not_configured: 'Не настроено'
};

function normalizeStatus(status: string): ApplicationStatus {
  if (status === 'in_work' || status === 'waiting_client') return 'invoice_sent';
  if (['new', 'invoice_sent', 'paid_in_work', 'completed', 'rejected'].includes(status)) {
    return status as ApplicationStatus;
  }
  return 'new';
}

function tariffLabel(value: TariffCode) {
  if (value === 'contract') return 'Сопровождение до контракта';
  return getTariffLabel(value);
}

function formatFileSize(size?: number) {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

function telegramHref(value?: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\/t\.me\//i.test(raw)) return raw;
  const username = raw.replace(/^@/, '').replace(/[^\w\d_]/g, '');
  return username ? `https://t.me/${username}` : '';
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function metricValue(value?: string, suffix = '') {
  const clean = String(value || '').trim();
  return clean ? `${clean}${suffix}` : '-';
}

export default function AdminApplicationsPage() {
  const [token, setToken] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');

  async function load(currentToken = token) {
    setError('');
    const response = await fetch('/api/admin/applications', {
      headers: { 'x-admin-token': currentToken }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        window.localStorage.removeItem('rra_admin_token');
        setToken('');
        setApplications([]);
        setSelected(null);
      }
      setError(data.message || 'Нет доступа.');
      return;
    }
    const list = (data.applications || []).map((item: Application) => ({
      ...item,
      status: normalizeStatus(String(item.status)),
      tariff: String(item.tariff || 'to_clarify') as TariffCode
    }));
    setApplications(list);
    setSelected((current) => list.find((item: Application) => item.id === current?.id) || list[0] || null);
  }

  async function updateStatus(id: string, status: ApplicationStatus) {
    setUpdatingId(id);
    const response = await fetch('/api/admin/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ id, status })
    });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data.application) {
        const application = {
          ...data.application,
          status: normalizeStatus(String(data.application.status)),
          tariff: String(data.application.tariff || 'to_clarify') as TariffCode
        };
        setApplications((items) => items.map((item) => item.id === id ? application : item));
        setSelected(application);
      } else {
        await load();
      }
    }
    setUpdatingId('');
  }

  async function loginAdmin() {
    setError('');
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) {
      setError(data.message || 'Не удалось войти.');
      return;
    }
    window.localStorage.setItem('rra_admin_token', data.token);
    setToken(data.token);
    setPassword('');
    await load(data.token);
  }

  function logoutAdmin() {
    window.localStorage.removeItem('rra_admin_token');
    setToken('');
    setApplications([]);
    setSelected(null);
  }

  function chooseStatusFilter(value: ApplicationStatus | 'all') {
    setStatusFilter(value);
    const first = value === 'all'
      ? applications[0]
      : applications.find((application) => application.status === value);
    if (first) setSelected(first);
  }

  const csvHref = useMemo(() => {
    const columns: Array<[keyof Application | 'statusLabel' | 'tariffLabel', string]> = [
      ['id', 'ID заявки'],
      ['createdAt', 'Время создания'],
      ['statusLabel', 'Статус'],
      ['tariffLabel', 'Тариф'],
      ['name', 'Имя'],
      ['company', 'Компания'],
      ['phone', 'Телефон'],
      ['telegram', 'Telegram'],
      ['email', 'Email'],
      ['category', 'Категория'],
      ['productName', 'Продукт'],
      ['productionCost', 'Цена товара'],
      ['retailPrice', 'РРЦ'],
      ['monthlyVolume', 'Объём в месяц'],
      ['federalNetworks', 'Федеральные сети'],
      ['regionalNetworks', 'Региональные сети'],
      ['localNetworks', 'Локальные сети'],
      ['unknownNetworks', 'Другие сети'],
      ['presentationUrl', 'Презентация / КП']
    ];
    const rows = applications.map((application) => columns.map(([key]) => {
      if (key === 'statusLabel') return csvEscape(statusLabels[application.status] || application.status);
      if (key === 'tariffLabel') return csvEscape(tariffLabel(application.tariff));
      return csvEscape(application[key]);
    }).join(';'));
    const csv = [columns.map(([, title]) => csvEscape(title)).join(';'), ...rows].join('\r\n');
    return `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(csv)}`;
  }, [applications]);

  useEffect(() => {
    const saved = window.localStorage.getItem('rra_admin_token') || '';
    if (saved) {
      setToken(saved);
      load(saved);
    }
  }, []);

  const selectedStageIndex = selected ? statusFlow.findIndex((item) => item.value === selected.status) : -1;
  const tgLink = telegramHref(selected?.telegram);
  const filteredApplications = statusFilter === 'all'
    ? applications
    : applications.filter((application) => application.status === statusFilter);

  return (
    <main className="adminExact adminRetail">
      <nav className="adminExactNav">
        <a className="adminExactBrand" href="/">
          <span className="adminExactPill">Сейл Трекер</span>
          <span className="adminExactTitle">Ритейл <b>контракт</b></span>
        </a>
        <div className="adminExactLinks">
          {token && selected && <a href={`/admin/applications/${selected.id}/audit`}>Audit Studio</a>}
          {token && <button className="adminExactLogout" type="button" onClick={logoutAdmin}>Выйти</button>}
          <a className="adminExactNavBtn" href="/">Открыть сайт</a>
        </div>
      </nav>

      <section className="adminExactHero">
        <div className="adminExactContainer adminExactHeroGrid">
          <div className="adminExactHeroLeft">
            <div className="adminExactTag">
              <span />
              <b>Платформа Центр Закупок Сетей™</b>
            </div>
            <h1 className={!token ? 'adminLoginTitle' : undefined}>{token ? 'Админка заявок' : 'Вход в админку'}</h1>
            <p>
              {token
                ? 'Единый рабочий стол по заявкам Ритейл контракта: контакты, продукт, КП, экономика, целевые сети и статус сделки.'
                : 'Авторизуйтесь, чтобы открыть заявки поставщиков и управлять этапами работы.'}
            </p>
          </div>
          {!token ? (
            <div className="adminExactLogin">
              <label>
                <span>Логин</span>
                <input value={login} onChange={e => setLogin(e.target.value)} placeholder="admin" autoComplete="username" />
              </label>
              <label>
                <span>Пароль</span>
                <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" type="password" autoComplete="current-password" onKeyDown={e => { if (e.key === 'Enter') loginAdmin(); }} />
              </label>
              <button type="button" onClick={loginAdmin}>Войти</button>
            </div>
          ) : (
            <div className="adminExactSession">
              <span>Сессия активна</span>
              <b>{applications.length} заявок в базе</b>
            </div>
          )}
        </div>
      </section>

      {error && <div className="adminExactError">{error}</div>}

      {token && (
        <>
          <section className="adminExactStats">
            {statusFlow.map(({ value, label, hint }) => (
              <button className={`status-${value} ${statusFilter === value ? 'active' : ''}`} key={value} type="button" onClick={() => chooseStatusFilter(value)}>
                <b>{applications.filter(a => a.status === value).length}</b>
                <span>{label}</span>
                <small>{hint}</small>
              </button>
            ))}
            <a href={csvHref} download="retail-contract-applications.csv">Скачать Excel</a>
          </section>

          <section className="adminExactWork adminExactContainer">
            <div className="adminExactSectionHead">
              <h2>Заявки</h2>
              <p>Быстрый обзор поставщиков, статусов и маршрута до контакта с сетями.</p>
            </div>

            <div className="adminExactListFilter" aria-label="Фильтр статусов заявок">
              <span>Фильтр</span>
              <button type="button" className={statusFilter === 'all' ? 'active' : ''} onClick={() => chooseStatusFilter('all')}>Все</button>
              {statusFlow.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`status-${value} ${statusFilter === value ? 'active' : ''}`}
                  onClick={() => chooseStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <aside className="adminExactList">
              {filteredApplications.length === 0 && (
                <div className="adminExactEmpty">
                  <b>Заявок пока нет</b>
                  <span>{statusFilter === 'all' ? 'После отправки формы заявки появятся здесь.' : 'В этом статусе пока нет заявок.'}</span>
                </div>
              )}
              {filteredApplications.map((app, index) => (
                <button key={app.id} className={`${selected?.id === app.id ? 'selected' : ''} status-${app.status}`} onClick={() => setSelected(app)}>
                  <i className="adminExactLeadNo">{String(index + 1).padStart(2, '0')}</i>
                  <span>{app.id}</span>
                  <b>{app.company || 'Компания не указана'}</b>
                  <small>{app.productName || app.category}</small>
                  <em>{statusLabels[app.status]}</em>
                </button>
              ))}
            </aside>

            {selected && (
              <article className="adminExactDetails">
                <header>
                  <div>
                    <span>{selected.id}</span>
                    <h2>{selected.company}</h2>
                    <p>{selected.productName} · {tariffLabel(selected.tariff)}</p>
                  </div>
                  <a className="adminExactNavBtn" href={`/admin/applications/${selected.id}/audit`}>Открыть Audit Studio</a>
                </header>

                <div className={`adminExactPipeline ${updatingId === selected.id ? 'updating' : ''}`} aria-label="Статус сделки">
                  {statusFlow.map((stage, index) => (
                    <button
                      key={stage.value}
                      type="button"
                      className={[
                        'adminExactStage',
                        `status-${stage.value}`,
                        selected.status === stage.value ? 'active' : '',
                        index < selectedStageIndex ? 'passed' : ''
                      ].join(' ')}
                      onClick={() => updateStatus(selected.id, stage.value)}
                      disabled={updatingId === selected.id}
                    >
                      <small>Этап {index + 1}</small>
                      <span>{stage.label}</span>
                    </button>
                  ))}
                </div>

                <div className="adminExactInfoBlocks">
                  <section className="adminExactInfoBlock">
                    <h3>Контакт</h3>
                    <div className="adminExactGrid">
                      <div><span>Клиент</span><b>{selected.name}</b></div>
                      <div><span>Телефон</span><b>{selected.phone}</b></div>
                      <div><span>Telegram</span><b>{tgLink ? <a className="adminExactTelegramLink" href={tgLink} target="_blank" rel="noreferrer">{selected.telegram}</a> : '-'}</b></div>
                      <div><span>Email</span><b>{selected.email || '-'}</b></div>
                      <div><span>Создана</span><b>{new Date(selected.createdAt).toLocaleString('ru-RU')}</b></div>
                      <div><span>Telegram-статус</span><b>{telegramLabels[selected.telegramStatus]}</b></div>
                    </div>
                  </section>

                  <section className="adminExactInfoBlock">
                    <h3>Экономика и сети</h3>
                    <div className="adminExactGrid">
                      <div><span>Тариф</span><b>{tariffLabel(selected.tariff)}</b></div>
                      <div><span>Цена товара</span><b>{metricValue(selected.productionCost, ' ₽')}</b></div>
                      <div><span>РРЦ</span><b>{metricValue(selected.retailPrice, ' ₽')}</b></div>
                      <div><span>Объём</span><b>{metricValue(selected.monthlyVolume, ' шт/мес')}</b></div>
                      <div><span>Федеральные</span><b>{selected.federalNetworks || '-'}</b></div>
                      <div><span>Региональные</span><b>{selected.regionalNetworks || '-'}</b></div>
                      <div><span>Локальные</span><b>{selected.localNetworks || '-'}</b></div>
                      <div className="wide"><span>Все выбранные сети</span><b>{selected.networkNames || selected.targetNetworks || '-'}</b></div>
                    </div>
                  </section>

                  <section className="adminExactInfoBlock">
                    <h3>Продукт</h3>
                    <div className="adminExactGrid">
                      <div><span>Категория</span><b>{selected.category}</b></div>
                      <div><span>Продукт</span><b>{selected.productName}</b></div>
                      <div className="wide">
                        <span>Презентация / КП</span>
                        <b>
                          {selected.presentationUrl ? (
                            <a href={selected.presentationUrl} target="_blank" rel="noreferrer">
                              {selected.presentationName || 'Открыть файл'} {formatFileSize(selected.presentationSize)}
                            </a>
                          ) : '-'}
                        </b>
                      </div>
                      <div className="wide"><span>Описание</span><b>{selected.description}</b></div>
                      {selected.notes && <div className="wide"><span>Комментарий</span><b>{selected.notes}</b></div>}
                    </div>
                  </section>
                </div>
              </article>
            )}
          </section>
        </>
      )}
    </main>
  );
}
