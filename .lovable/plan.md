## Шаг 3 — Kanban-доски с Drag-and-Drop

### Что строим
Полноценные канбан-доски в рамках организации: список досок, доска с колонками и задачами, перетаскивание задач между колонками и внутри колонки, CRUD задач и колонок.

### Маршруты
- `/_authenticated/boards` — список досок организации (карточки + кнопка "Создать доску")
- `/_authenticated/boards/$boardId` — сама доска с колонками и задачами

### UI компоненты
- `BoardsList` — сетка карточек досок, модал создания (название, описание, цвет)
- `BoardView` — горизонтальный скролл колонок
- `KanbanColumn` — заголовок (имя, счётчик), список карточек, кнопка "+ Задача", меню (переименовать/удалить)
- `TaskCard` — заголовок, описание (truncate), приоритет, исполнитель (avatar), due date
- `TaskDialog` — модал создания/редактирования задачи (название, описание, приоритет, исполнитель из членов организации, срок)
- `ColumnDialog` — создание/переименование колонки

### Drag-and-Drop
Библиотека `@dnd-kit/core` + `@dnd-kit/sortable` (легковесная, доступная, без багов react-beautiful-dnd).
- Перетаскивание задач между колонками → обновление `column_id` и `position`
- Сортировка внутри колонки → обновление `position`
- Оптимистичное обновление через React Query (`onMutate` + `invalidate` на ошибке)

### Данные
Используем существующие таблицы `boards`, `board_columns`, `tasks`. Доступ — через TanStack server functions с `requireSupabaseAuth`. RLS уже изолирует данные по `org_id`.

Server functions (`src/lib/boards.functions.ts`):
- `listBoards`, `createBoard`, `deleteBoard`
- `getBoardWithColumns(boardId)` — доска + колонки + задачи
- `createColumn`, `renameColumn`, `deleteColumn`
- `createTask`, `updateTask`, `deleteTask`
- `moveTask({ taskId, toColumnId, newPosition })` — атомарная перестановка позиций

Позиции храним как float (`position numeric`) — при вставке между A и B берём `(A+B)/2`, ребалансировка не нужна на старте.

### Сайдбар
Добавим пункт "Доски" в `AppSidebar` со ссылкой на `/boards`.

### Чего НЕ делаем на этом шаге
- Без меток/тегов, чек-листов, комментариев к задачам, вложений, истории изменений — это отдельный шаг при желании.
- Без realtime-синхронизации между пользователями (можно добавить позже через Supabase Realtime).

### Технические детали
- Зависимости: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- Мутации через `useMutation` + `queryClient.invalidateQueries(['board', boardId])`
- Если в `tasks` нет колонки `position` — добавлю миграцией `ALTER TABLE tasks ADD COLUMN position numeric NOT NULL DEFAULT 0` (проверю в текущей схеме перед началом).
- При удалении колонки — задачи переносятся в первую оставшуюся колонку (либо запрет удаления непустой — спрошу при желании, по умолчанию переносим).

После одобрения сразу начну с миграции (если нужна) и зависимостей.
