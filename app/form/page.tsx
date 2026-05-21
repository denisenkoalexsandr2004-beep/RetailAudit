'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type FormState = {
  name: string;
  company: string;
  phone: string;
  telegram: string;
  email: string;
  category: string;
  productName: string;
  description: string;
  tariff: 'audit' | 'audit_plus';
  productionCost: string;
  retailPrice: string;
  monthlyVolume: string;
  targetNetworks: string;
  notes: string;
  website: string;
};

const initialState: FormState = {
  name: '',
  company: '',
  phone: '',
  telegram: '',
  email: '',
  category: '',
  productName: '',
  description: '',
  tariff: 'audit',
  productionCost: '',
  retailPrice: '',
  monthlyVolume: '',
  targetNetworks: '',
  notes: '',
  website: ''
};

const categories = ['Молочная продукция', 'Напитки', 'Снеки и закуски', 'Кондитерские изделия', 'Мясная продукция', 'Замороженные продукты', 'Бакалея', 'Другое'];

export default function FormPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState('');
  const [successId, setSuccessId] = useState('');
  const [loading, setLoading] = useState(false);

  const steps = useMemo(() => ['01 О вас', '02 Продукт', '03 Экономика'], []);
  const update = (key: keyof FormState, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    const tariff = new URLSearchParams(window.location.search).get('tariff');
    if (tariff === 'audit_plus') update('tariff', 'audit_plus');
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus('');
    setLoading(true);
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Заявка не отправлена.');
      setSuccessId(data.id || data.applicationId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Заявка не отправлена.');
    } finally {
      setLoading(false);
    }
  }

  if (successId) {
    return (
      <main className="formShell successShell">
        <section className="successCard">
          <div className="successIcon">✓</div>
          <h1>Заявка принята</h1>
          <p>Данные сохранены, менеджер Центра Закупок Сетей™ получил уведомление или увидит заявку в админке.</p>
          <div className="applicationId">ID заявки: {successId}</div>
          <Link className="secondary dark" href="/">Вернуться на главную</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="formShell">
      <Link className="backLink" href="/">← Retail Ready Аудит</Link>
      <section className="formIntro">
        <span>Заявка на аудит</span>
        <h1>Расскажите о продукте</h1>
        <p>3 шага. После отправки заявка сохраняется в базе и уходит менеджеру в Telegram.</p>
      </section>

      <form className="formCard" onSubmit={submit}>
        <label className="honeypotField" aria-hidden="true">
          Сайт компании
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => update('website', e.target.value)} />
        </label>

        <div className="progressTabs">
          {steps.map((label, index) => (
            <button type="button" className={step === index ? 'active' : step > index ? 'done' : ''} key={label} onClick={() => setStep(index)}>
              {step > index ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="formStep">
            <h2>О вас</h2>
            <div className="fieldGrid">
              <label>Имя и фамилия<input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Иванов Алексей" /></label>
              <label>Компания<input required value={form.company} onChange={e => update('company', e.target.value)} placeholder="ООО Название" /></label>
              <label>Телефон<input required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+7 916 000-00-00" /></label>
              <label>Telegram<input value={form.telegram} onChange={e => update('telegram', e.target.value)} placeholder="@username" /></label>
              <label>Email<input value={form.email} onChange={e => update('email', e.target.value)} placeholder="client@company.ru" /></label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="formStep">
            <h2>Продукт</h2>
            <div className="fieldGrid">
              <label>Категория<select required value={form.category} onChange={e => update('category', e.target.value)}><option value="">Выберите</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
              <label>Название продукта<input required value={form.productName} onChange={e => update('productName', e.target.value)} placeholder="Йогурт Утро 200 г" /></label>
            </div>
            <label className="fullField">Описание продукта<textarea required rows={6} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Состав, упаковка, срок годности, УТП, текущие точки продаж..." /></label>
          </div>
        )}

        {step === 2 && (
          <div className="formStep">
            <h2>Экономика</h2>
            <div className="tariffSwitch">
              <button type="button" className={form.tariff === 'audit' ? 'selected' : ''} onClick={() => update('tariff', 'audit')}>Аудит · 50 000 ₽</button>
              <button type="button" className={form.tariff === 'audit_plus' ? 'selected' : ''} onClick={() => update('tariff', 'audit_plus')}>Аудит + Переговоры · 150 000 ₽</button>
            </div>
            <div className="fieldGrid">
              <label>Себестоимость, ₽<input type="number" min="0" value={form.productionCost} onChange={e => update('productionCost', e.target.value)} /></label>
              <label>РРЦ, ₽<input type="number" min="0" value={form.retailPrice} onChange={e => update('retailPrice', e.target.value)} /></label>
              <label>Объём, шт/мес<input type="number" min="0" value={form.monthlyVolume} onChange={e => update('monthlyVolume', e.target.value)} /></label>
              <label>Целевые сети<input value={form.targetNetworks} onChange={e => update('targetNetworks', e.target.value)} placeholder="Пятёрочка, ВкусВилл" /></label>
            </div>
            <label className="fullField">Комментарий<textarea rows={4} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Что важно знать эксперту" /></label>
          </div>
        )}

        {status && <div className="formError">{status}</div>}

        <div className="formActions">
          <button type="button" className="secondary dark" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>Назад</button>
          {step < 2 ? (
            <button type="button" className="primary" onClick={() => setStep(s => Math.min(2, s + 1))}>Далее</button>
          ) : (
            <button className="primary" disabled={loading}>{loading ? 'Отправка...' : 'Отправить заявку'}</button>
          )}
        </div>
      </form>
    </main>
  );
}

