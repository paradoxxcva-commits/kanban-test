## Шаг 4 — Календарь задач + iCal-фид

### Что строим
Полноценный календарь задач организации с месячной/недельной сеткой, быстрым созданием задач канбана прямо из календаря, и публичным iCal-фидом для синхронизации с внешними календарями (Yandex, Google, Apple).

### Маршруты
- `/_authenticated/calendar` — страница календаря (месяц / неделя)
- `/api/public/ical/:token` — публичный endpoint, возвращающий `.ics` по защищённому токену пользователя

### UI компоненты
- `CalendarPage` — обёртка с переключателем видов (Месяц / Неделя) и навигацией по периодам
- `MonthView` — сетка 7×N с ячейками-днями; задачи отображаются как цветные плашки (приоритет → цвет)
- `WeekView` — 7 колонок-дней с вертикальным списком задач
- `CalendarTaskPopover` — поповер при клике на день/задачу: быстрое создание задачи (название, доска, колонка, приоритет, срок) или редактирование существующей
- `CalendarSettings` — диалог настройки iCal: показ защищённого URL, кнопка «Скопировать ссылку», кнопка «Сбросить токен»

### Данные
Используем существующую таблицу `tasks` (поле `due_date`).

Новая таблица `calendar_tokens`:
- `id uuid primary key`
- `user_id uuid references auth.users`
- `token text unique not null` — случайный 32-символьный hex-токен
- `created_at timestamptz default now()`
- `revoked_at timestamptz nullable`
- RLS: пользователь видит только свой токен, super_admin — все

### iCal-фид (ICS)
- Server route `/api/public/ical/:token` — без auth, но токен должен быть активным (revoked_at is null)
- Запрос: по токену находим user_id → берём задачи этого пользователя из доступных ему досок (org_id) с `due_date is not null`
- Формат: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID`, по задаче — `VEVENT` с `UID` (task id), `SUMMARY` (title), `DESCRIPTION`, `DTSTART` (due_date), `DTSTAMP`, `URL` (ссылка на доску)
- Content-Type: `text/calendar; charset=utf-8`

### Server functions
- `listCalendarTasks({ from, to })` — задачи пользователя за период (из досок его org + личные), включая board/column названия
- `createTaskFromCalendar({ title, boardId, columnId, dueDate, priority })` — создаёт задачу в выбранной колонке
- `getOrCreateCalendarToken()` — возвращает/создаёт токен iCal для текущего пользователя
- `revokeCalendarToken()` — отзывает токен (устанавливает revoked_at)

### Интеграция с Kanban
- Задачи, созданные из календаря, попадают в выбранную доску/колонку и сразу видны на Kanban-доске
- При изменении `due_date` в TaskDialog на доске — задача сдвигается в календаре автоматически

### Сайдбар
Добавим пункт «Календарь» в `AppSidebar` со ссылкой на `/calendar`.

### Чего НЕ делаем на этом шаге
- Без полноценного drag-and-drop перетаскивания задач между днями в календаре (можно добавить позже)
- Без повторяющихся/рекуррентных задач
- Без email-напоминаний

### Технические детали
- Библиотека календаря: нативная сетка на CSS Grid + date-fns (уже используем), без тяжёлых сторонних calendar-компонентов
- iCal генерация: ручная строковая сборка (RFC 5545), без сторонних библиотек — лёгкий edge-совместимый код
- Токен: `crypto.randomBytes(16).toString('hex')` в server function
- Миграция: `CREATE TABLE calendar_tokens (...)` + RLS + GRANT
- Realtime: не требуется

После одобрения начну с миграции `calendar_tokens` и server functions, затем UI.