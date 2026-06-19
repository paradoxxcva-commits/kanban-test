## Проблема
В `src/components/dashboard/tasks-chart.tsx` цвета recharts заданы как `hsl(var(--muted-foreground))`, `hsl(var(--border))`, `hsl(var(--brand))` и т.д. Но токены в `src/styles.css` хранятся в `oklch(...)`, поэтому `hsl(oklch(...))` — невалидный CSS-цвет, и браузер падает в чёрный. Из-за этого даты на оси X, числа на оси Y и сами столбцы сливаются с тёмным фоном.

## Правка
Один файл — `src/components/dashboard/tasks-chart.tsx`, строки 71–85. Заменить все `hsl(var(--X))` на `var(--X)`:

- `CartesianGrid stroke` → `var(--border)`
- `XAxis`/`YAxis` tick `fill` → `var(--muted-foreground)`
- `Tooltip` `cursor.fill` → `color-mix(in oklab, var(--accent) 40%, transparent)`
- `Tooltip` `contentStyle.background` → `var(--popover)`, `border` → `1px solid var(--border)`, добавить `color: var(--popover-foreground)`
- `Tooltip` `labelStyle.color` и `itemStyle.color` → `var(--popover-foreground)` (чтобы текст внутри тултипа был контрастным)
- `Bar fill` → `var(--brand)` (оранжевый акцент проекта)

Логика, данные, переключатель периодов 7/30/90 и группировка по неделям остаются без изменений.

## Проверка
После правки в тёмной теме столбцы должны стать оранжевыми (`--brand`), подписи дат и чисел — светло-серыми (`--muted-foreground`), тултип — с фоном `--popover` и читаемым текстом.