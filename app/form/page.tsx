'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { TariffCode } from '@/lib/tariffs';

type FormState = {
  name: string;
  company: string;
  phone: string;
  telegram: string;
  email: string;
  category: string;
  productName: string;
  description: string;
  tariff: TariffCode;
  productionCost: string;
  retailPrice: string;
  monthlyVolume: string;
  targetNetworks: string;
  notes: string;
  website: string;
};

type CountryOption = {
  code: string;
  dial: string;
  flagUrl: string;
  label: string;
  example: string;
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
  tariff: 'to_clarify',
  productionCost: '',
  retailPrice: '',
  monthlyVolume: '',
  targetNetworks: '',
  notes: '',
  website: ''
};

const categories = ['Молочная продукция', 'Напитки', 'Снеки и закуски', 'Кондитерские изделия', 'Мясная продукция', 'Замороженные продукты', 'Бакалея', 'Другое'];

const phoneCountries: CountryOption[] = [
  { code: 'RU', dial: '+7', flagUrl: 'https://flagcdn.com/48x36/ru.png', label: 'Россия', example: '916 000-00-00' },
  { code: 'BY', dial: '+375', flagUrl: 'https://flagcdn.com/48x36/by.png', label: 'Беларусь', example: '29 000-00-00' },
  { code: 'KZ', dial: '+7', flagUrl: 'https://flagcdn.com/48x36/kz.png', label: 'Казахстан', example: '701 000-00-00' },
  { code: 'UZ', dial: '+998', flagUrl: 'https://flagcdn.com/48x36/uz.png', label: 'Узбекистан', example: '90 000-00-00' },
  { code: 'KG', dial: '+996', flagUrl: 'https://flagcdn.com/48x36/kg.png', label: 'Кыргызстан', example: '555 000-000' },
  { code: 'AM', dial: '+374', flagUrl: 'https://flagcdn.com/48x36/am.png', label: 'Армения', example: '91 000-000' },
  { code: 'AZ', dial: '+994', flagUrl: 'https://flagcdn.com/48x36/az.png', label: 'Азербайджан', example: '50 000-00-00' },
  { code: 'GE', dial: '+995', flagUrl: 'https://flagcdn.com/48x36/ge.png', label: 'Грузия', example: '555 00-00-00' },
  { code: 'TJ', dial: '+992', flagUrl: 'https://flagcdn.com/48x36/tj.png', label: 'Таджикистан', example: '92 000-00-00' },
  { code: 'MD', dial: '+373', flagUrl: 'https://flagcdn.com/48x36/md.png', label: 'Молдова', example: '69 000-000' }
];

function applyDialCode(currentPhone: string, nextDial: string, previousDial?: string) {
  const trimmed = currentPhone.trim();
  if (!trimmed) return '';
  if (previousDial && trimmed.startsWith(previousDial)) {
    return trimmed.slice(previousDial.length).trimStart();
  }
  if (trimmed.startsWith(nextDial)) {
    return trimmed.slice(nextDial.length).trimStart();
  }
  return trimmed.replace(/^\+\d+\s*/, '');
}

export default function FormPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState('');
  const [successId, setSuccessId] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<CountryOption>(phoneCountries[0]);
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement | null>(null);

  const steps = useMemo(() => ['01 О вас', '02 Продукт', '03 Экономика'], []);
  const update = (key: keyof FormState, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const updatePhone = (value: string) => update('phone', applyDialCode(value, phoneCountry.dial, phoneCountry.dial));

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const tariff = query.get('tariff');
    if (tariff === 'audit' || tariff === 'audit_plus') {
      update('tariff', tariff);
    }
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!countryRef.current?.contains(event.target as Node)) {
        setCountryOpen(false);
      }
    }

    if (countryOpen) {
      document.addEventListener('mousedown', handleClick);
    }

    return () => document.removeEventListener('mousedown', handleClick);
  }, [countryOpen]);

  function chooseCountry(nextCountry: CountryOption) {
    setForm((prev) => ({
      ...prev,
      phone: applyDialCode(prev.phone, nextCountry.dial, phoneCountry.dial)
    }));
    setPhoneCountry(nextCountry);
    setCountryOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        phone: `${phoneCountry.dial} ${form.phone}`.trim()
      };
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
              <label className="phoneField">
                Телефон
                <div className="phoneCombo" ref={countryRef}>
                  <button type="button" className={`countryTrigger ${countryOpen ? 'open' : ''}`} onClick={() => setCountryOpen(open => !open)}>
                    <img className="countryFlag" src={phoneCountry.flagUrl} alt="" aria-hidden="true" />
                    <b>{phoneCountry.dial}</b>
                  </button>
                  {countryOpen && (
                    <div className="countryPanel">
                      {phoneCountries.map((country) => (
                        <button type="button" key={country.code} className={`countryOption ${phoneCountry.code === country.code ? 'selected' : ''}`} onClick={() => chooseCountry(country)}>
                          <span className="countryMeta">
                            <img className="countryFlag" src={country.flagUrl} alt="" aria-hidden="true" />
                            <strong>{country.label}</strong>
                          </span>
                          <span className="countryDial">{country.dial}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    required
                    value={form.phone}
                    onChange={e => updatePhone(e.target.value)}
                    placeholder={phoneCountry.example}
                    type="tel"
                  />
                </div>
                <span className="countryHint">Выберите страну слева. В поле вводите номер без кода страны.</span>
              </label>
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
