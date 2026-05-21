import type { Metadata } from 'next';
import './globals.css';
import SupportWidget from './components/SupportWidget';

export const metadata: Metadata = {
  title: 'Retail Ready Аудит — Центр Закупок Сетей™',
  description: 'Проверка готовности FMCG-продукта к переговорам с розничными сетями.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <SupportWidget />
      </body>
    </html>
  );
}
