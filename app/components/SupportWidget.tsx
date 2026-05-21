'use client';

import { useState } from 'react';
import styles from './SupportWidget.module.css';

const TELEGRAM_URL = 'https://t.me/darya_kornilceva';
const TELEGRAM_LABEL = '@darya_kornilceva';

export default function SupportWidget() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <aside className={styles.widget} aria-label="24/7 поддержка">
      <div className={`${styles.menu} ${isMenuOpen ? styles.menuOpen : ''}`} aria-hidden={!isMenuOpen}>
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noreferrer"
          className={`${styles.menuItem} ${styles.telegram}`}
          aria-label="Написать в Telegram"
        >
          <span>TG</span>
          <strong>{TELEGRAM_LABEL}</strong>
        </a>
      </div>

      <button
        type="button"
        className={`${styles.mainButton} ${isMenuOpen ? styles.mainButtonOpen : ''}`}
        onClick={() => setIsMenuOpen((current) => !current)}
        aria-expanded={isMenuOpen}
        aria-label={isMenuOpen ? 'Закрыть поддержку' : 'Открыть поддержку'}
      >
        {isMenuOpen ? (
          <span aria-hidden="true">×</span>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.messageIcon}>
            <path d="M5.5 17.2 4 21l4.1-1.35c1.08.42 2.35.65 3.9.65 4.7 0 8-2.72 8-7.15S16.7 6 12 6 4 8.72 4 13.15c0 1.6.55 2.98 1.5 4.05Z" />
            <path d="M8.2 12.3h7.6M8.2 15h5.2" />
          </svg>
        )}
      </button>
    </aside>
  );
}
