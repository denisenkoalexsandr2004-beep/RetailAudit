# Retail Ready Audit

Рабочая папка проекта Retail Ready Audit для ЦЗС™. Здесь собраны исходные документы, HTML-наработки и место для финальной сборки продукта.

## Структура

```txt
docs/
  product/
    retail_ready_description.docx
  technical/
    retail-ready-audit-TZ.docx
  deploy/
    retail-ready-deploy.docx

html/
  current/
    retail_ready_audit.html
    retail_ready_checklist.html
    deploy_guide.html
  variants/
    retail-ready-audit.html

final_product/
  standalone_html/
  nextjs_app/
```

## Что где лежит

- `docs/product/` - коммерческое описание продукта, тарифы, экономика, план запуска.
- `docs/technical/` - основное ТЗ: требования, сценарии, стек, форма, брендинг.
- `docs/deploy/` - инструкция по развёртыванию текущего варианта.
- `html/current/` - актуальная тройка HTML-файлов из текущей сессии.
- `html/variants/` - альтернативные прототипы и версии, которые можно использовать как источник идей.
- `final_product/standalone_html/` - место для единого автономного HTML-файла лендинга и формы.
- `final_product/nextjs_app/` - место для финального Next.js проекта.

## Приоритеты сборки

1. Главный источник требований - `docs/technical/retail-ready-audit-TZ.docx`.
2. Финальный стек первой версии - Next.js 14, SQLite, Telegram Bot API.
3. Обязательный брендинг - ЦЗС™, platforma-czs.ru, цифры платформы и единый стиль.
4. HTML-наработки используются как база для дизайна, текстов и UX, но конфликты решаются по ТЗ.
