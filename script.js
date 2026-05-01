/* OKK Review — основной скрипт.
   Данные хранятся в localStorage. Заметки оператора — отдельно по каждому кейсу.
   Системные строки в чат не выводятся: показываются только реплики водителя и сотрудника. */
(function () {
  'use strict';

  const STORAGE_KEY = 'okk_review_state_v1';
  const NOTES_KEY = 'okk_review_notes_v1';
  const API_KEY_STORE = 'okk_review_api_v1';
  const FIREBASE_CONFIG = window.ISKUSTV_FIREBASE_CONFIG || null;
  const FIREBASE_ROOT = 'okkReview';
  let firebaseStateRef = null;
  let firebaseNotesRef = null;
  let firebaseUsersRef = null;
  let firebaseReady = false;
  let applyingRemote = false;
  let accessUsers = {};

  // ---------- ДЕМО-ДАННЫЕ ----------
  function demoState() {
    const mk = (id, title, driver, route, status, transcript, hidden) => ({
      id, title, driver, route, status, transcript, hidden,
      info: [
        'Карточка чата',
        `Тема: ${title || 'Без темы'}`,
        `Водитель: ${driver || 'Не указан'}`,
        `Маршрут/город: ${route || 'Не указан'}`,
        `Статус: ${status || 'На проверке'}`
      ].join('\n')
    });

    const anna = [
      mk('a1', 'Смена типа оплаты', 'Иван',   'Ростов → Аэропорт Платов', 'На проверке',
`Водитель: Добрый день
Поставьте только безналичную оплату и все
Профиль по номеру: 79882604647

Сотрудник: Здравствуйте! Вас приветствует таксопарк CASHTAXI.
Изменил вам тип оплаты. Хорошей смены!

Водитель: Спасибо`,
`Сотрудник корректно поздоровался, выполнил задачу и попрощался. Эталон.`),
      mk('a2', 'Вопрос по комиссии', 'Сергей', 'Краснодар, центр', 'На проверке',
`Водитель: Здравствуйте, почему с меня сегодня списали больше обычного?

Сотрудник: Здравствуйте. Проверяю по вашему профилю.
У вас вчера был бонусный заказ, комиссия считается с итоговой суммы.
Пришлю расшифровку в чат.

Водитель: Понял, спасибо`,
`Нужно было сразу прислать расшифровку, а не обещать. Частичный минус.`),
      mk('a3', 'Грубость водителя', 'Олег', 'Москва, ЮАО', 'На проверке',
`Водитель: Вы там вообще работаете? Деньги где

Сотрудник: Здравствуйте. Понимаю ваше раздражение.
Вижу задержку по выплате, передаю в финансовый отдел, ответ в течение часа.

Водитель: Ну наконец-то`,
`Сотрудник не поддался на провокацию, действовал по регламенту.`),
      mk('a4', 'Блокировка аккаунта', 'Мурат', 'Сочи, Адлер', 'На проверке',
`Водитель: У меня заблокирован профиль, почему

Сотрудник: ну сам виноват наверное

Водитель: Что?`,
`Грубое нарушение тона. Требуется разбор с сотрудником.`)
    ];

    const dmitry = [
      mk('d1', 'Заказ не пришёл', 'Артём', 'СПб, Купчино', 'На проверке',
`Водитель: Клиент не вышел, отменил, но деньги не вернули

Сотрудник: Здравствуйте. Проверяю заказ по номеру.
Возврат оформлен, поступит в течение 10 минут.

Водитель: Ок, спасибо`,
`Чётко и по делу. Ок.`),
      mk('d2', 'Навигация не работает', 'Ренат', 'Казань, Приволжский', 'На проверке',
`Водитель: У меня навигатор в приложении висит

Сотрудник: Перезагрузите телефон

Водитель: Не помогло

Сотрудник: Ну тогда не знаю`,
`Сотрудник сдался и не эскалировал проблему. Минус.`),
      mk('d3', 'Смена тарифа', 'Алексей', 'Екатеринбург', 'На проверке',
`Водитель: Хочу перейти на тариф Комфорт

Сотрудник: Добрый день. Для перехода нужна машина не старше 2019 года и чистый рейтинг от 4.8.
По вашим данным условиям соответствуете. Перевожу.

Водитель: Супер, спасибо`,
`Эталонный ответ с условиями.`)
    ];

    const elena = [
      mk('e1', 'Жалоба на пассажира', 'Вадим', 'Новосибирск', 'На проверке',
`Водитель: Пассажир испачкал салон, требую компенсацию

Сотрудник: Здравствуйте. Загрузите фото салона и чек мойки в чат,
оформим компенсацию по регламенту в течение 24 часов.

Водитель: Отправил`,
`Корректно запрошены документы.`),
      mk('e2', 'Вопрос по бонусам', 'Георгий', 'Уфа', 'На проверке',
`Водитель: Где мои бонусы за 50 поездок

Сотрудник: не знаю посмотрите в приложении`,
`Отказ разбираться. Грубое нарушение.`),
      mk('e3', 'ДТП на линии', 'Николай', 'Воронеж', 'На проверке',
`Водитель: Попал в мелкое ДТП, что делать

Сотрудник: Здравствуйте. Сначала убедитесь, что все целы.
Оформите европротокол, если нет пострадавших.
Пришлите мне номер заказа и фото — поставлю смену на паузу, чтобы не капали штрафы.

Водитель: Понял, делаю`,
`Правильная последовательность действий.`)
    ];

    return {
      employees: [
        { id: 'anna',   name: 'Анна Коваль',    avatar: 'АК', role: 'Оператор ОКК, смена день', experience: '2 года в компании',
          about: 'Опытный оператор, ведёт сложные кейсы с водителями.', hint: 'Эталонные ответы, разбирать спорные ситуации.',
          cases: anna },
        { id: 'dmitry', name: 'Дмитрий Орлов',  avatar: 'ДО', role: 'Оператор поддержки', experience: '6 месяцев',
          about: 'Стажёр, часто теряется в нестандартных ситуациях.', hint: 'Смотреть, как реагирует на давление.',
          cases: dmitry },
        { id: 'elena',  name: 'Елена Соловьёва', avatar: 'ЕС', role: 'Старший оператор', experience: '4 года',
          about: 'Ведёт ночную смену, много кейсов по ДТП и жалобам.', hint: 'Проверять тон в конфликтных ситуациях.',
          cases: elena }
      ],
      api: { mode: 'manual', model: 'gpt-4.1-mini', endpoint: 'https://api.openai.com/v1/responses', key: '', instructions: '' },
      trash: { employees: [] },
      activeEmployeeId: 'anna',
      activeCaseId: 'a1'
    };
  }

  // ---------- СОСТОЯНИЕ ----------
  function defaultQualityCriteria() {
    return [
      { id: 'crit_competence', title: 'Слабая компетенция в решении вопроса', type: 'negative', score: '100%', description: 'Сотрудник должен отметить, что оператор не решил вопрос, дал неверный или неполный ответ.' },
      { id: 'crit_personalization', title: 'Недостаточная персонализация', type: 'negative', score: '70%', description: 'Оператор отвечает шаблонно и не уточняет детали ситуации водителя.' },
      { id: 'crit_objections', title: 'Неумение работать с возражениями', type: 'negative', score: '100%', description: 'Оператор не отрабатывает сомнения, негатив или прямое возражение водителя.' },
      { id: 'crit_greeting', title: 'Некорректное приветствие', type: 'negative', score: '100%', description: 'Нет нормального приветствия, названия таксопарка или корректного тона.' }
    ];
  }

  function emptyState() {
    return {
      employees: [],
      cases: [],
      criteria: defaultQualityCriteria(),
      api: demoState().api,
      trash: { employees: [] },
      activeEmployeeId: null,
      activeCaseId: null
    };
  }

  const USE_FIREBASE_SOURCE = !!FIREBASE_CONFIG;
  let state = USE_FIREBASE_SOURCE ? emptyState() : loadState();
  let notes = USE_FIREBASE_SOURCE ? {} : loadNotes();
  let caseFilter = 'all';
  let employeeSearchQuery = '';
  let trainerReviewFilter = 'pending';

  function normalizeStateData(data) {
    const fallback = demoState();
    if (!data || typeof data !== 'object') data = fallback;

    if (!Array.isArray(data.employees)) data.employees = [];
    data.employees = data.employees.filter(Boolean).map(emp => {
      emp.cases = Array.isArray(emp.cases) ? emp.cases.filter(Boolean) : [];
      return emp;
    });

    let cases = Array.isArray(data.cases) ? data.cases.filter(Boolean) : [];
    if (!cases.length && data.employees.length) {
      data.employees.forEach(emp => {
        (emp.cases || []).forEach(c => {
          cases.push(Object.assign({}, c, {
            category: c.category || emp.name || 'Без категории',
            oldEmployeeId: emp.id || ''
          }));
        });
      });
    }

    data.cases = cases.map(c => {
      c.id = c.id || ('case_' + Math.random().toString(36).slice(2));
      c.title = c.title || (c.driver ? 'Чат с ' + c.driver : 'Готовый чат');
      c.category = c.category || 'Без категории';
      c.driver = c.driver || '';
      c.status = c.status || 'На проверке';
      c.info = c.info || '';
      c.transcript = c.transcript || '';
      c.hidden = c.hidden || '';
      return c;
    });

    data.criteria = Array.isArray(data.criteria) && data.criteria.length
      ? data.criteria.filter(Boolean).map((item, idx) => ({
          id: item.id || ('crit_' + Date.now().toString(36) + '_' + idx),
          title: item.title || item.name || 'Критерий качества',
          type: item.type || 'negative',
          score: item.score || '',
          description: item.description || item.expectation || ''
        }))
      : defaultQualityCriteria();

    if (!data.api) data.api = fallback.api;
    if (!data.trash || !Array.isArray(data.trash.employees)) data.trash = { employees: [] };
    if (!data.activeCaseId || !data.cases.some(c => c.id === data.activeCaseId)) {
      data.activeCaseId = data.cases[0] ? data.cases[0].id : null;
    }
    return data;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return demoState();
      const parsed = JSON.parse(raw);
      return normalizeStateData(parsed);
    } catch (_) { return demoState(); }
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (firebaseReady && firebaseStateRef && !applyingRemote) {
      firebaseStateRef.set(state).catch(err => console.warn('Firebase state save error:', err));
    }
  }

  function loadNotes() {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function saveNotes() {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    if (firebaseReady && firebaseNotesRef && !applyingRemote) {
      const payload = Object.keys(notes || {}).length ? notes : null;
      firebaseNotesRef.set(payload).catch(err => console.warn('Firebase notes save error:', err));
    }
  }

  function prepareRemoteState(remote) {
    return normalizeStateData(remote);
  }

  function initFirebaseSync() {
    if (!FIREBASE_CONFIG || !window.firebase || !window.firebase.database) {
      console.warn('Firebase не подключён. Данные сохраняются только локально.');
      return;
    }

    try {
      if (!window.firebase.apps || !window.firebase.apps.length) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
      }
      const db = window.firebase.database();
      firebaseStateRef = db.ref(FIREBASE_ROOT + '/state');
      firebaseNotesRef = db.ref(FIREBASE_ROOT + '/notes');
      firebaseUsersRef = db.ref(FIREBASE_ROOT + '/users');
      firebaseReady = true;

      firebaseStateRef.on('value', snapshot => {
        const remote = snapshot.val();
        if (remote && Array.isArray(remote.employees)) {
          applyingRemote = true;
          state = prepareRemoteState(remote);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          applyingRemote = false;
          renderAll();
        } else if (!remote) {
          applyingRemote = true;
          state = emptyState();
          applyingRemote = false;
          renderAll();
        }
      }, err => console.warn('Firebase state sync error:', err));

      firebaseNotesRef.on('value', snapshot => {
        const remote = snapshot.val();
        applyingRemote = true;
        notes = remote && typeof remote === 'object' ? remote : {};
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
        applyingRemote = false;
        renderAll();
      }, err => console.warn('Firebase notes sync error:', err));

      firebaseUsersRef.on('value', snapshot => {
        accessUsers = snapshot.val() || {};
        renderAccessRequests();
      }, err => console.warn('Firebase users sync error:', err));
    } catch (err) {
      console.warn('Firebase init error:', err);
    }
  }

  function getCurrentNoteKey() {
    const user = window.IskustvAuth && window.IskustvAuth.getUser ? window.IskustvAuth.getUser() : null;
    if (user && user.uid) return user.uid;
    if (user && user.email) return String(user.email).toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    return 'guest';
  }

  function getNoteByUserKey(caseId, userKey) {
    const entry = notes[caseId];
    if (!entry) return null;
    if (entry.byUser) return entry.byUser[userKey || getCurrentNoteKey()] || null;
    if (typeof entry === 'string') return { text: entry, author: 'Сотрудник' };
    if (entry.text) return entry;
    return null;
  }

  function getNoteText(caseId, userKey) {
    const note = getNoteByUserKey(caseId, userKey);
    if (!note) return '';
    if (typeof note === 'string') return note;
    return note.text || '';
  }

  function getNoteAuthor(note) {
    if (!note || typeof note === 'string') return 'Сотрудник';
    return note.author || [note.firstName, note.lastName].filter(Boolean).join(' ') || note.email || 'Сотрудник';
  }

  function getNoteReviewStatus(note) {
    if (!note || typeof note === 'string') return 'pending';
    return note.reviewStatus || 'pending';
  }

  function getNoteReviewLabel(note) {
    const status = getNoteReviewStatus(note);
    if (status === 'accepted') return 'Принято';
    if (status === 'rejected') return 'Отклонено';
    return 'На проверку';
  }

  function getNoteReviewClass(note) {
    const status = getNoteReviewStatus(note);
    if (status === 'accepted') return 'accepted';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  }

  function getCaseNoteCount(caseId) {
    const entry = notes[caseId];
    if (!entry) return 0;
    if (entry.byUser) return Object.values(entry.byUser).filter(n => n && String(n.text || '').trim()).length;
    return getNoteText(caseId).trim() ? 1 : 0;
  }

  function getAllTrainerNoteItems() {
    const items = [];
    Object.keys(notes || {}).forEach(caseId => {
      const owner = findCaseOwner(caseId);
      if (!owner) return;
      const entry = notes[caseId];
      if (!entry) return;
      if (entry.byUser) {
        Object.keys(entry.byUser).forEach(userKey => {
          const note = entry.byUser[userKey];
          const text = note && String(note.text || '').trim();
          if (text) items.push({ caseId, userKey, text, note, employee: owner.employee, caseItem: owner.caseItem });
        });
      } else {
        const text = getNoteText(caseId).trim();
        if (text) items.push({ caseId, userKey: 'legacy', text, note: entry, employee: owner.employee, caseItem: owner.caseItem });
      }
    });
    return items.sort((a, b) => String(b.note.submittedAt || '').localeCompare(String(a.note.submittedAt || '')));
  }

  // ---------- УТИЛИТЫ ----------
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function getEmployee(id) { return state.employees.find(e => e.id === id) || null; }
  function getQualityCriteria() {
    if (!Array.isArray(state.criteria) || !state.criteria.length) state.criteria = defaultQualityCriteria();
    return state.criteria;
  }
  function getCriterion(id) {
    return getQualityCriteria().find(c => c.id === id) || null;
  }
  function getAllCases() {
    return Array.isArray(state.cases) ? state.cases : [];
  }
  function getActiveEmployee() { return null; }
  function getActiveCase() {
    const cases = getAllCases();
    let c = cases.find(x => x.id === state.activeCaseId);
    if (!c) { c = cases[0] || null; state.activeCaseId = c ? c.id : null; }
    return c;
  }
  function getVisibleCases() {
    const allCases = getAllCases();
    const checkedCases = allCases.filter(c => getCaseNoteCount(c.id) > 0);
    const uncheckedCases = allCases.filter(c => getCaseNoteCount(c.id) === 0);
    return caseFilter === 'checked' ? checkedCases : (caseFilter === 'unchecked' ? uncheckedCases : allCases);
  }

  // Парсер текста чата: поддерживаются реплики "Водитель:", "Сотрудник:" и системные блоки "Система:".
  // Строки без новой метки продолжают предыдущее сообщение того же автора.
  // Неизвестные метки по-прежнему игнорируются, а системные блоки показываются как серые служебные вставки прямо внутри диалога.
  function parseTranscript(text) {
    const lines = String(text || '').split(/\r?\n/);
    const messages = [];
    let current = null;
    // Поддерживаем форматы:
    // Водитель: текст
    // Водитель 10:15: текст
    // Водитель [10:15]: текст
    // Сотрудник: текст
    // Сотрудник 10:17: текст
    const labelRe = /^\s*([A-Za-zА-Яа-яЁё ]{2,30})(?:\s*\[?(\d{1,2}:\d{2})\]?)?\s*:\s*(.*)$/;

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const m = line.match(labelRe);
      if (m) {
        const label = m[1].trim().toLowerCase();
        const msgTime = m[2] || '';
        const rest = m[3];
        let who = null;
        if (label === 'водитель' || label === 'driver') who = 'driver';
        else if (label === 'сотрудник' || label === 'оператор' || label === 'agent') who = 'agent';
        else if (label === 'дата' || label === 'date') who = 'date';
        else if (label === 'система' || label === 'событие' || label === 'инфо' || label === 'info' || label === 'system') who = 'system';
        else if (label === 'скрыто' || label === 'только сотрудникам' || label === 'для сотрудников' || label === 'private' || label === 'employee only' || label === 'employee-only') who = 'private';

        if (who) {
          if (current) messages.push(current);
          current = { who, text: rest, time: msgTime };
          continue;
        } else {
          // незнакомая метка — прерываем текущую реплику, эту строку не показываем
          if (current) { messages.push(current); current = null; }
          continue;
        }
      }
      // строка без метки
      if (current) {
        current.text += (current.text ? '\n' : '') + line;
      }
      // если текущей реплики нет — строка игнорируется
    }
    if (current) messages.push(current);
    // чистим пустые
    return messages
      .map(m => ({ who: m.who, text: m.text.trim(), time: m.time || '' }))
      .filter(m => m.text.length > 0);
  }

  function parseInfoGroups(text) {
    const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const groups = [];
    let current = { title: '', rows: [] };

    lines.forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex < 0) {
        if (current.title || current.rows.length) groups.push(current);
        current = { title: line, rows: [] };
        return;
      }
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      current.rows.push({ key, value });
    });

    if (current.title || current.rows.length) groups.push(current);
    return groups;
  }

  function renderInfoHtml(text, mode) {
    const groups = parseInfoGroups(text);
    if (!groups.length) return '';
    const cssMode = mode === 'trainer' ? ' trainer-case-info' : '';
    return `<div class="case-info-card${cssMode}">
      <div class="case-info-card-title">Информация по чату</div>
      ${groups.map(group => `
        <div class="case-info-group">
          ${group.title ? `<div class="case-info-group-title">${escapeHtml(group.title)}</div>` : ''}
          ${group.rows.map(row => `
            <div class="case-info-row">
              <span>${escapeHtml(row.key)}</span>
              <strong>${escapeHtml(row.value || '—')}</strong>
            </div>`).join('')}
        </div>`).join('')}
    </div>`;
  }

  function setCaseInfoPanel(host, text, mode) {
    if (!host) return;
    const html = renderInfoHtml(text, mode);
    host.hidden = !html;
    host.innerHTML = html;
  }

  function insertTranscriptSpeaker(label) {
    const ta = $('caseTranscriptInput');
    if (!ta) return;
    const value = ta.value;
    const start = ta.selectionStart || 0;
    const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const before = value.slice(0, start);
    const after = value.slice(start);
    const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
    const insert = `${prefix}${label} ${now}: `;
    ta.value = before + insert + suffix + after;
    const pos = before.length + insert.length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    renderCaseEditorPreview();
    renderTranscriptEditorHighlight();
  }

  function insertTranscriptSystemInfo() {
    const ta = $('caseTranscriptInput');
    if (!ta) return;
    const value = ta.value;
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
    const template = 'Система: ';
    const insert = `${prefix}${template}${suffix}`;
    ta.value = before + insert + after;
    const pos = before.length + prefix.length + template.length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    renderCaseEditorPreview();
    renderTranscriptEditorHighlight();
  }

  function insertTranscriptDate() {
    const ta = $('caseTranscriptInput');
    if (!ta) return;
    const today = new Date();
    const defaultDate = today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const dateText = prompt('Введите дату, которая будет показана в чате:', defaultDate);
    if (dateText === null) return;
    const cleanDate = String(dateText).trim();
    if (!cleanDate) return;

    const value = ta.value;
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
    const insert = `${prefix}Дата: ${cleanDate}${suffix}`;
    ta.value = before + insert + after;
    const pos = before.length + insert.length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    renderCaseEditorPreview();
    renderTranscriptEditorHighlight();
  }

  function makeSelectedTextPrivate() {
    const ta = $('caseTranscriptInput');
    if (!ta) return;
    const value = ta.value;
    let start = ta.selectionStart || 0;
    let end = ta.selectionEnd || 0;

    if (start === end) {
      const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const nextBreak = value.indexOf('\n', start);
      start = lineStart;
      end = nextBreak < 0 ? value.length : nextBreak;
    }

    const selected = value.slice(start, end).trim();
    const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    let cleanText = selected || 'сообщение только для сотрудников';
    cleanText = cleanText.replace(/^Сотрудник(?:\s*\[?\d{1,2}:\d{2}\]?)?\s*:\s*/i, '');
    cleanText = cleanText.replace(/^Оператор(?:\s*\[?\d{1,2}:\d{2}\]?)?\s*:\s*/i, '');
    cleanText = cleanText.replace(/^Скрыто(?:\s*\[?\d{1,2}:\d{2}\]?)?\s*:\s*/i, '');

    const replacement = `Скрыто ${now}: ${cleanText}`;
    ta.value = value.slice(0, start) + replacement + value.slice(end);
    const pos = start + replacement.length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    renderCaseEditorPreview();
    renderTranscriptEditorHighlight();
  }

  function renderTranscriptHtml(msgs, driverName) {
    return msgs.map(m => {
      if (m.who === 'date') {
        return `
          <div class="msg msg-date">
            <span>${escapeHtml(m.text)}</span>
          </div>`;
      }
      if (m.who === 'private') {
        return `
          <div class="msg msg-private">
            <div class="msg-bubble">
              <div class="msg-text">${escapeHtml(m.text).replace(/\n/g,'<br>')}</div>
              <div class="msg-private-meta">${m.time ? escapeHtml(m.time) : ''}<span class="msg-private-lock">▣</span></div>
            </div>
          </div>`;
      }
      if (m.who === 'system') {
        return `
          <div class="msg msg-system">
            <div class="msg-bubble">
              <div class="msg-text">${escapeHtml(m.text).replace(/\n/g,'<br>')}</div>
              ${m.time ? `<div class="msg-time">${escapeHtml(m.time)}</div>` : ''}
            </div>
          </div>`;
      }
      const side = m.who === 'agent' ? 'right' : 'left';
      const who = m.who === 'agent' ? 'Сотрудник' : driverName;
      return `
        <div class="msg msg-${side}">
          <div class="msg-author">${escapeHtml(who)}</div>
          <div class="msg-bubble">
            <div class="msg-text">${escapeHtml(m.text).replace(/\n/g,'<br>')}</div>
            ${m.time ? `<div class="msg-time">${escapeHtml(m.time)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function getChatCanvas() {
    return $('chatCanvas') || document.querySelector('.crm-chat-canvas');
  }

  function updateChatScrollButtons() {
    const canvas = getChatCanvas();
    const host = $('chatScrollJump');
    const topBtn = $('chatScrollTopBtn');
    const bottomBtn = $('chatScrollBottomBtn');
    if (!canvas || !host || !topBtn || !bottomBtn) return;
    const canScroll = canvas.scrollHeight > canvas.clientHeight + 12;
    host.hidden = !canScroll;
    if (!canScroll) return;
    const atTop = canvas.scrollTop <= 24;
    const atBottom = canvas.scrollTop + canvas.clientHeight >= canvas.scrollHeight - 24;
    topBtn.disabled = atTop;
    bottomBtn.disabled = atBottom;
  }

  function scrollChatToTop() {
    const canvas = getChatCanvas();
    if (!canvas) return;
    canvas.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(updateChatScrollButtons, 250);
  }

  function scrollChatToBottom() {
    const canvas = getChatCanvas();
    if (!canvas) return;
    canvas.scrollTo({ top: canvas.scrollHeight, behavior: 'smooth' });
    setTimeout(updateChatScrollButtons, 250);
  }

  // ---------- РЕНДЕР ----------
  function renderStats() {
    const criteriaCount = getQualityCriteria().length;
    const caseCount = getAllCases().length;
    const notesCount = getAllTrainerNoteItems().length;
    $('stats').innerHTML = `
      <div class="header-stat"><strong>${criteriaCount}</strong><span>критериев</span></div>
      <div class="header-stat"><strong>${caseCount}</strong><span>готовых чатов</span></div>
      <div class="header-stat"><strong>${notesCount}</strong><span>ответов сотрудников</span></div>`;
  }

  function renderEmployeeGrid() {
    const grid = $('employeeGrid');
    if (!grid) return;
    const query = String(employeeSearchQuery || '').trim().toLowerCase();
    const criteria = getQualityCriteria().filter(c => !query || [c.title, c.description, c.type, c.score].join(' ').toLowerCase().includes(query));
    grid.innerHTML = criteria.map(c => `
      <div class="employee-item quality-criterion-item">
        <span class="emp-avatar">${escapeHtml(c.type === 'positive' ? '+' : '−')}</span>
        <span class="emp-info">
          <strong>${escapeHtml(c.title)}</strong>
          <span class="emp-role">${escapeHtml(c.type === 'positive' ? 'Позитивный' : 'Негативный')}${c.score ? ' · ' + escapeHtml(c.score) : ''}</span>
        </span>
      </div>`).join('') || '<p class="muted">Критерии не найдены.</p>';
  }

  function renderActiveEmployeeCard() {
    const host = $('activeEmployeeCard');
    const count = getVisibleCases().length;
    host.innerHTML = `
      <div class="active-emp">
        <div class="active-emp-top">
          <span class="emp-avatar big">Ч</span>
          <div>
            <strong>Все чаты</strong>
            <div class="muted">${count} заданий в списке</div>
          </div>
        </div>
        <p class="emp-hint">Сотрудник выбирает критерий качества и объясняет, какую ошибку нашёл.</p>
      </div>`;
  }

  function renderCaseList() {
    const list = $('caseList');
    const pill = $('queueCount');
    const tabs = $('caseFilterTabs');
    const baseCases = state.activeCategory && state.activeCategory !== 'all'
      ? getAllCases().filter(c => (c.category || 'Без категории') === state.activeCategory)
      : getAllCases();
    const checkedCases = baseCases.filter(c => getCaseNoteCount(c.id) > 0);
    const uncheckedCases = baseCases.filter(c => getCaseNoteCount(c.id) === 0);
    const visibleCases = getVisibleCases();

    pill.textContent = String(visibleCases.length);
    if ($('statsMini')) $('statsMini').textContent = String(baseCases.length);
    if ($('checkedMini')) $('checkedMini').textContent = String(checkedCases.length);
    if ($('uncheckedMini')) $('uncheckedMini').textContent = String(uncheckedCases.length);
    if (tabs) {
      tabs.querySelectorAll('[data-case-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-case-filter') === caseFilter);
      });
    }

    const emptyText = caseFilter === 'checked'
      ? 'В этой категории пока нет чатов с ответами.'
      : (caseFilter === 'unchecked' ? 'В этой категории пока нет чатов без ответов.' : 'Чатов пока нет. Добавьте чат в админ-панели.');

    list.innerHTML = visibleCases.map(c => {
      const hasNote = getCaseNoteCount(c.id) > 0;
      return `
        <button type="button" class="case-item${c.id === state.activeCaseId ? ' active' : ''}" data-case="${escapeHtml(c.id)}">
          <span class="case-title">${escapeHtml(c.title || (c.driver ? 'Чат с ' + c.driver : 'Готовый чат'))}</span>
          <span class="case-sub">${escapeHtml(c.driver || '')}</span>
          <span class="case-tags">
            <span class="case-status">${hasNote ? 'Есть ответы' : escapeHtml(c.status || 'На проверке')}</span>
            ${hasNote ? '<span class="case-note-dot" title="Есть ответы сотрудников">●</span>' : ''}
          </span>
        </button>`;
    }).join('') || `<p class="muted">${emptyText}</p>`;

    list.querySelectorAll('[data-case]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeCaseId = btn.getAttribute('data-case');
        saveState();
        renderChat();
        renderCaseList();
        renderNote();
      });
    });
  }

  function renderChat() {
    const c = getActiveCase();
    const title = $('caseTitle');
    const meta = $('caseMeta');
    const thread = $('transcriptMessages');
    const contactName = $('contactName');
    const contactAvatar = $('contactAvatar');
    const infoPanel = $('caseInfoPanel');

    if (!c) {
      title.textContent = 'Выберите чат';
      meta.textContent = 'Добавьте чат в админ-панели или выберите готовый из списка.';
      contactName.textContent = 'Водитель';
      contactAvatar.textContent = 'В';
      thread.innerHTML = '';
      setCaseInfoPanel(infoPanel, '');
      return;
    }

    title.textContent = c.title || (c.driver ? 'Чат с ' + c.driver : 'Готовый чат');
    const metaParts = [];
    if (c.driver) metaParts.push('Водитель: ' + c.driver);
    if (c.status) metaParts.push(c.status);
    meta.textContent = metaParts.join(' · ') || 'Готовый чат';
    contactName.textContent = c.driver || 'Водитель';
    contactAvatar.textContent = (c.driver || 'В').trim().slice(0,1).toUpperCase();
    setCaseInfoPanel(infoPanel, '');

    const msgs = [];
    if (String(c.info || '').trim()) msgs.push({ who: 'system', text: String(c.info).trim(), time: '' });
    msgs.push(...parseTranscript(c.transcript));
    if (!msgs.length) {
      thread.innerHTML = '<p class="muted">В этом чате пока нет реплик водителя или сотрудника.</p>';
      return;
    }
    thread.innerHTML = renderTranscriptHtml(msgs, c.driver || 'Водитель');
  }

  function renderNote() {
    const c = getActiveCase();
    const ta = $('operatorNote');
    const status = $('noteStatus');
    const criterionSel = $('qualityCriterionSelect');
    if (criterionSel) {
      criterionSel.innerHTML = '<option value="">Выберите критерий качества</option>' + getQualityCriteria().map(cr =>
        `<option value="${escapeHtml(cr.id)}">${escapeHtml(cr.title)}${cr.score ? ' · ' + escapeHtml(cr.score) : ''}</option>`
      ).join('');
    }
    if (!c) {
      if (ta) { ta.value = ''; ta.disabled = true; }
      if (criterionSel) criterionSel.disabled = true;
      if (status) status.textContent = 'Выберите чат, чтобы отправить ответ.';
      return;
    }
    const note = getNoteByUserKey(c.id, getCurrentNoteKey());
    if (ta) { ta.disabled = false; ta.value = note && note.text ? note.text : ''; }
    if (criterionSel) { criterionSel.disabled = false; criterionSel.value = note && note.criterionId ? note.criterionId : ''; }
    if (status) status.textContent = note && note.text ? 'Ответ отправлен на проверку.' : 'Выберите критерий и объясните ошибку.';
  }

  // ---------- АДМИН ----------
  function renderAdmin() {
    renderQualityCriterionSelects();
    renderCaseSelect();
    fillCaseForm();

    // API-блок убран из интерфейса, настройки оставляем только в данных для совместимости.
    if ($('apiMode')) $('apiMode').value = state.api.mode || 'manual';
    if ($('apiModel')) $('apiModel').value = state.api.model || '';
    if ($('apiEndpoint')) $('apiEndpoint').value = state.api.endpoint || '';
    if ($('apiKey')) $('apiKey').value = state.api.key || '';
    if ($('apiInstructions')) $('apiInstructions').value = state.api.instructions || '';

    renderAccessRequests();
    renderTrainerNotes();
    renderTrash();
    const trainerNotesCount = getAllTrainerNoteItems().length;
    $('adminStatus').textContent = `Критериев: ${getQualityCriteria().length}. Чатов всего: ${getAllCases().length}. Ответов сотрудников: ${trainerNotesCount}. В корзине: ${(state.trash && state.trash.employees ? state.trash.employees.length : 0)}.`;
  }

  function findCaseOwner(caseId) {
    const found = getAllCases().find(c => c.id === caseId);
    if (!found) return null;
    return { employee: { name: 'Общий чат' }, caseItem: found };
  }

  function renderTrainerNotes() {
    const host = $('trainerNotesList');
    if (!host) return;
    const allItems = getAllTrainerNoteItems();
    const pendingItems = allItems.filter(item => getNoteReviewStatus(item.note) === 'pending');
    const reviewedItems = allItems.filter(item => getNoteReviewStatus(item.note) === 'accepted');
    const rejectedItems = allItems.filter(item => getNoteReviewStatus(item.note) === 'rejected');
    const items = trainerReviewFilter === 'rejected' ? rejectedItems : (trainerReviewFilter === 'reviewed' ? reviewedItems : pendingItems);

    if ($('pendingReviewCount')) $('pendingReviewCount').textContent = String(pendingItems.length);
    if ($('reviewedReviewCount')) $('reviewedReviewCount').textContent = String(reviewedItems.length);
    if ($('rejectedReviewCount')) $('rejectedReviewCount').textContent = String(rejectedItems.length);
    const folders = $('trainerReviewFolders');
    if (folders) {
      folders.querySelectorAll('[data-review-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-review-filter') === trainerReviewFilter);
      });
    }

    if (!items.length) {
      host.innerHTML = trainerReviewFilter === 'rejected'
        ? '<div class="trainer-note-empty">Отклоненных ответов пока нет.</div>'
        : trainerReviewFilter === 'reviewed'
          ? '<div class="trainer-note-empty">Принятых ответов пока нет.</div>'
          : '<div class="trainer-note-empty">Пока нет ответов на проверку.</div>';
      return;
    }

    host.innerHTML = items.map(item => {
      const when = item.note && item.note.submittedAt ? new Date(item.note.submittedAt).toLocaleString('ru-RU') : '';
      const email = item.note && item.note.email ? ' · ' + item.note.email : '';
      const reviewed = item.note && item.note.reviewedAt ? ' · проверено ' + new Date(item.note.reviewedAt).toLocaleString('ru-RU') : '';
      return `
        <button class="trainer-note-item" type="button" data-open-note="${escapeHtml(item.caseId)}" data-open-note-user="${escapeHtml(item.userKey)}">
          <div class="trainer-note-top">
            <strong>${escapeHtml(item.caseItem.title || (item.caseItem.driver ? 'Чат с ' + item.caseItem.driver : 'Готовый чат'))}</strong>
            <span class="review-status ${getNoteReviewClass(item.note)}">${getNoteReviewLabel(item.note)}</span>
          </div>
          <div class="trainer-note-meta">Ответил: ${escapeHtml(getNoteAuthor(item.note))}${escapeHtml(email)}${when ? ' · ' + escapeHtml(when) : ''}${escapeHtml(reviewed)}</div>
          <div class="trainer-note-criterion">Критерий: ${escapeHtml(item.note && item.note.criterionTitle ? item.note.criterionTitle : 'Не выбран')}</div>
          <div class="trainer-note-text">${escapeHtml(item.text)}</div>
        </button>`;
    }).join('');

    host.querySelectorAll('[data-open-note]').forEach(btn => {
      btn.addEventListener('click', () => openTrainerNote(btn.getAttribute('data-open-note'), btn.getAttribute('data-open-note-user')));
    });
  }

  function openTrainerNote(caseId, userKey) {
    const owner = findCaseOwner(caseId);
    if (!owner) return;
    const modal = $('trainerChatModal');
    const title = $('trainerChatTitle');
    const meta = $('trainerChatMeta');
    const thread = $('trainerChatThread');
    const info = $('trainerChatInfo');
    const noteMeta = $('trainerChatNoteMeta');
    const noteText = $('trainerChatNoteText');
    const note = getNoteByUserKey(caseId, userKey);

    if (!modal || !title || !meta || !thread || !noteMeta || !noteText) return;

    const c = owner.caseItem;
    const noteWhen = note && typeof note !== 'string' && note.submittedAt ? new Date(note.submittedAt).toLocaleString('ru-RU') : '';
    title.textContent = c.driver ? 'Чат с ' + c.driver : 'Готовый чат';
    meta.textContent = `${owner.employee.name || 'Сотрудник'} · ${c.status || 'На проверке'}`;
    modal.dataset.caseId = caseId || '';
    modal.dataset.userKey = userKey || '';
    const reviewLabel = getNoteReviewLabel(note);
    const reviewedBy = note && note.reviewedBy ? ' · проверил: ' + note.reviewedBy : '';
    const reviewedAt = note && note.reviewedAt ? ' · ' + new Date(note.reviewedAt).toLocaleString('ru-RU') : '';
    const criterionText = note && note.criterionTitle ? ` · критерий: ${note.criterionTitle}${note.criterionScore ? ' · ' + note.criterionScore : ''}` : ' · критерий не выбран';
    noteMeta.textContent = `Ответил: ${getNoteAuthor(note)}${note && note.email ? ' · ' + note.email : ''}${noteWhen ? ' · ' + noteWhen : ''}${criterionText} · статус: ${reviewLabel}${reviewedBy}${reviewedAt}`;
    noteText.textContent = note && note.text ? note.text : '';
    updateTrainerReviewButtons(note);
    setCaseInfoPanel(info, '');

    const msgs = [];
    if (String(c.info || '').trim()) msgs.push({ who: 'system', text: String(c.info).trim(), time: '' });
    msgs.push(...parseTranscript(c.transcript));
    if (!msgs.length) {
      thread.innerHTML = '<div class="trainer-chat-empty">В этом чате пока нет сообщений.</div>';
    } else {
      thread.innerHTML = renderTranscriptHtml(msgs, c.driver || 'Водитель');
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function updateTrainerReviewButtons(note) {
    const status = getNoteReviewStatus(note);
    const acceptBtn = $('reviewAcceptBtn');
    const rejectBtn = $('reviewRejectBtn');
    if (acceptBtn) acceptBtn.classList.toggle('is-selected', status === 'accepted');
    if (rejectBtn) rejectBtn.classList.toggle('is-selected', status === 'rejected');
  }

  function setTrainerNoteReview(status) {
    const modal = $('trainerChatModal');
    if (!modal) return;

    const caseId = modal.dataset.caseId;
    const userKey = modal.dataset.userKey;

    if (!caseId || !userKey || !notes[caseId]) {
      alert('Не удалось найти ответ сотрудника. Обновите страницу и попробуйте ещё раз.');
      return;
    }

    const entry = notes[caseId];
    const admin = window.firebase && window.firebase.auth && window.firebase.auth().currentUser;
    const reviewPatch = {
      reviewStatus: status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: admin && admin.email ? admin.email : 'Администратор'
    };

    if (entry.byUser && entry.byUser[userKey]) {
      entry.byUser[userKey] = Object.assign({}, entry.byUser[userKey], reviewPatch);
    } else if (!entry.byUser && userKey === 'legacy') {
      notes[caseId] = Object.assign({}, entry, reviewPatch);
    } else {
      alert('Ответ сотрудника не найден. Обновите страницу и попробуйте ещё раз.');
      return;
    }

    trainerReviewFilter = status === 'rejected' ? 'rejected' : 'reviewed';

    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    closeTrainerChatModal();
    renderStats();
    renderCaseList();
    renderTrainerNotes();

    if (firebaseReady && firebaseNotesRef) {
      firebaseNotesRef.set(notes).catch(err => {
        console.warn('Firebase review status save error:', err);
        alert('Статус изменился на экране, но Firebase не дал сохранить решение. Проверьте правила Realtime Database для okkReview/notes.');
      });
    }
  }

  function closeTrainerChatModal() {
    const modal = $('trainerChatModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function renderAccessRequests() {
    const host = $('accessRequestsList');
    if (!host) return;
    const users = Object.values(accessUsers || {}).filter(u => u && u.role !== 'admin');
    users.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    if (!users.length) {
      host.innerHTML = '<div class="trainer-note-empty">Заявок пока нет.</div>';
      return;
    }
    host.innerHTML = users.map(u => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Без имени';
      const created = u.createdAt ? new Date(u.createdAt).toLocaleString('ru-RU') : '';
      const approved = u.approved === true || u.status === 'approved';
      const rejected = u.status === 'rejected';
      const revoked = u.status === 'revoked';
      const statusClass = approved ? 'ok' : rejected ? 'bad' : revoked ? 'revoked' : 'wait';
      const statusText = approved ? 'Допущен' : rejected ? 'Отклонён' : revoked ? 'Доступ забран' : 'Ожидает';
      return `
        <div class="access-request-item">
          <div class="access-request-person">
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(u.email || '')}${created ? ' · ' + escapeHtml(created) : ''}</span>
          </div>
          <div class="access-request-actions">
            <span class="access-status ${statusClass}">${statusText}</span>
            ${approved ? `<button class="toolbar-btn danger" type="button" data-revoke-user="${escapeHtml(u.uid || '')}">Забрать доступ</button>` : `<button class="toolbar-btn restore" type="button" data-approve-user="${escapeHtml(u.uid || '')}">Пустить</button>`}
            ${rejected || revoked ? '' : `<button class="toolbar-btn danger" type="button" data-reject-user="${escapeHtml(u.uid || '')}">Отклонить</button>`}
            <button class="toolbar-btn access-delete-btn" type="button" data-delete-access-user="${escapeHtml(u.uid || '')}">Удалить из списка</button>
          </div>
        </div>`;
    }).join('');

    host.querySelectorAll('[data-approve-user]').forEach(btn => {
      btn.addEventListener('click', () => approveAccessUser(btn.getAttribute('data-approve-user')));
    });
    host.querySelectorAll('[data-reject-user]').forEach(btn => {
      btn.addEventListener('click', () => rejectAccessUser(btn.getAttribute('data-reject-user')));
    });
    host.querySelectorAll('[data-revoke-user]').forEach(btn => {
      btn.addEventListener('click', () => revokeAccessUser(btn.getAttribute('data-revoke-user')));
    });
    host.querySelectorAll('[data-delete-access-user]').forEach(btn => {
      btn.addEventListener('click', () => deleteAccessUser(btn.getAttribute('data-delete-access-user')));
    });
  }

  function approveAccessUser(uid) {
    if (!uid || !firebaseUsersRef) return;
    const admin = window.firebase && window.firebase.auth && window.firebase.auth().currentUser;
    firebaseUsersRef.child(uid).update({
      approved: true,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: admin && admin.email ? admin.email : 'admin'
    });
  }

  function rejectAccessUser(uid) {
    if (!uid || !firebaseUsersRef) return;
    const admin = window.firebase && window.firebase.auth && window.firebase.auth().currentUser;
    firebaseUsersRef.child(uid).update({
      approved: false,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: admin && admin.email ? admin.email : 'admin'
    });
  }

  function revokeAccessUser(uid) {
    if (!uid || !firebaseUsersRef) return;
    const admin = window.firebase && window.firebase.auth && window.firebase.auth().currentUser;
    if (!confirm('Забрать доступ у этого сотрудника? Он больше не сможет войти в тренажёр.')) return;
    firebaseUsersRef.child(uid).update({
      approved: false,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedBy: admin && admin.email ? admin.email : 'admin'
    });
  }

  function deleteAccessUser(uid) {
    if (!uid || !firebaseUsersRef) return;
    const u = accessUsers && accessUsers[uid] ? accessUsers[uid] : null;
    const label = u && (u.email || [u.firstName, u.lastName].filter(Boolean).join(' ')) ? (u.email || [u.firstName, u.lastName].filter(Boolean).join(' ')) : 'этого сотрудника';
    if (!confirm(`Удалить ${label} из списка доступа? Запись исчезнет из админки.`)) return;
    firebaseUsersRef.child(uid).remove().catch(err => console.warn('Firebase delete access user error:', err));
  }

  function renderTrash() {
    const host = $('trashList');
    if (!host) return;
    const items = state.trash && Array.isArray(state.trash.employees) ? state.trash.employees : [];
    if (!items.length) {
      host.innerHTML = '<div class="trash-empty">Корзина пуста.</div>';
      return;
    }
    host.innerHTML = items.map(e => `
      <div class="trash-item" data-trash-emp="${escapeHtml(e.id)}">
        <div class="trash-person">
          <span class="emp-avatar">${escapeHtml(e.avatar || e.name.slice(0,1))}</span>
          <div>
            <strong>${escapeHtml(e.name || 'Без имени')}</strong>
            <span>${escapeHtml(e.role || '')}${e.deletedAt ? ' · удалён ' + new Date(e.deletedAt).toLocaleString('ru-RU') : ''}</span>
          </div>
        </div>
        <div class="trash-actions">
          <button class="toolbar-btn restore" type="button" data-restore-emp="${escapeHtml(e.id)}">Восстановить</button>
          <button class="toolbar-btn danger" type="button" data-destroy-emp="${escapeHtml(e.id)}">Удалить навсегда</button>
        </div>
      </div>`).join('');

    host.querySelectorAll('[data-restore-emp]').forEach(btn => {
      btn.addEventListener('click', () => restoreEmployee(btn.getAttribute('data-restore-emp')));
    });
    host.querySelectorAll('[data-destroy-emp]').forEach(btn => {
      btn.addEventListener('click', () => destroyEmployee(btn.getAttribute('data-destroy-emp')));
    });
  }

  function fillEmployeeForm(empId) {
    const e = getEmployee(empId) || { name:'', avatar:'', role:'', experience:'', about:'', hint:'' };
    $('employeeName').value = e.name || '';
    $('employeeAvatar').value = e.avatar || '';
    $('employeeRole').value = e.role || '';
    $('employeeExperience').value = e.experience || '';
    $('employeeAbout').value = e.about || '';
    $('employeeHint').value = e.hint || '';
    $('employeeForm').dataset.editing = empId || '__new';
  }

  function renderQualityCriterionSelects() {
    const criteria = getQualityCriteria();
    const adminSel = $('adminCriterionSelect');
    if (adminSel) {
      adminSel.innerHTML = criteria.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`).join('') + '<option value="__new">+ Новый критерий</option>';
      if (!criteria.some(c => c.id === adminSel.value)) adminSel.value = criteria[0] ? criteria[0].id : '__new';
      fillCriterionForm();
    }
    const answerSel = $('qualityCriterionSelect');
    if (answerSel) {
      const current = answerSel.value;
      answerSel.innerHTML = '<option value="">Выберите критерий качества</option>' + criteria.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}${c.score ? ' · ' + escapeHtml(c.score) : ''}</option>`).join('');
      if (criteria.some(c => c.id === current)) answerSel.value = current;
    }
  }

  function fillCriterionForm() {
    const sel = $('adminCriterionSelect');
    if (!sel) return;
    const item = sel.value === '__new' ? null : getCriterion(sel.value);
    if ($('criterionTitleInput')) $('criterionTitleInput').value = item ? item.title || '' : '';
    if ($('criterionTypeInput')) $('criterionTypeInput').value = item ? item.type || 'negative' : 'negative';
    if ($('criterionScoreInput')) $('criterionScoreInput').value = item ? item.score || '' : '';
    if ($('criterionDescriptionInput')) $('criterionDescriptionInput').value = item ? item.description || '' : '';
  }

  function renderCaseSelect() {
    const sel = $('caseSelect');
    if (!sel) return;
    const cases = getAllCases();
    sel.innerHTML = cases.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title || c.driver || c.id)}</option>`).join('')
      + '<option value="__new">+ Новый чат</option>';
    if (cases.find(c => c.id === state.activeCaseId)) sel.value = state.activeCaseId;
    else sel.value = '__new';
  }

  function fillCaseForm() {
    const caseId = $('caseSelect') ? $('caseSelect').value : '__new';
    const c = getAllCases().find(x => x.id === caseId);
    const src = c || { title:'', driver:'', status:'', info:'', transcript:'', hidden:'' };
    if ($('caseTitleInput')) $('caseTitleInput').value = src.title || '';
    $('caseDriverInput').value = src.driver || '';
    $('caseStatusInput').value = src.status || '';
    $('caseInfoInput').value = src.info || '';
    $('caseTranscriptInput').value = src.transcript || '';
    $('caseHiddenInput').value = src.hidden || '';
    $('caseForm').dataset.editing = c ? c.id : '__new';
    renderCaseEditorPreview();
    renderTranscriptEditorHighlight();
  }

  function renderCaseEditorPreview() {
    const host = $('casePreviewThread');
    if (!host) return;
    const driverName = ($('caseDriverInput') && $('caseDriverInput').value.trim()) || 'Водитель';
    const msgs = [];
    if ($('caseInfoInput') && String($('caseInfoInput').value || '').trim()) {
      msgs.push({ who: 'system', text: String($('caseInfoInput').value).trim(), time: '' });
    }
    if ($('caseTranscriptInput')) msgs.push(...parseTranscript($('caseTranscriptInput').value));
    host.innerHTML = msgs.length
      ? renderTranscriptHtml(msgs, driverName)
      : '<div class="admin-chat-preview-empty">Здесь появится предпросмотр чата. Нажмите «Водитель», «Сотрудник», «Дата» или «Инфо» и начните заполнять диалог.</div>';
  }

  function renderTranscriptEditorHighlight() {
    const ta = $('caseTranscriptInput');
    const highlight = $('caseTranscriptHighlight');
    if (!ta || !highlight) return;

    const source = ta.value || '';
    const html = escapeHtml(source || ' ')
      .replace(/^(\s*)(Водитель)(\s*(?:\[?\d{1,2}:\d{2}\]?)?\s*:)/gmi, '$1<span class="hl-driver">$2$3</span>')
      .replace(/^(\s*)(Сотрудник|Оператор)(\s*(?:\[?\d{1,2}:\d{2}\]?)?\s*:)/gmi, '$1<span class="hl-agent">$2$3</span>')
      .replace(/^(\s*)(Дата)(\s*:)/gmi, '$1<span class="hl-date">$2$3</span>')
      .replace(/^(\s*)(Система|Событие|Инфо)(\s*:)/gmi, '$1<span class="hl-info">$2$3</span>')
      .replace(/^(\s*)(Скрыто|Только сотрудникам|Для сотрудников)(\s*(?:\[?\d{1,2}:\d{2}\]?)?\s*:)/gmi, '$1<span class="hl-private">$2$3</span>');

    highlight.innerHTML = html;
    highlight.scrollTop = ta.scrollTop;
    highlight.scrollLeft = ta.scrollLeft;
  }

  // ---------- ОБРАБОТЧИКИ ----------
  function bindEvents() {
    // Навигация по кейсам
    $('prevCaseBtn').addEventListener('click', () => shiftCase(-1));
    $('nextCaseBtn').addEventListener('click', () => shiftCase(+1));

    if ($('chatScrollTopBtn')) $('chatScrollTopBtn').addEventListener('click', scrollChatToTop);
    if ($('chatScrollBottomBtn')) $('chatScrollBottomBtn').addEventListener('click', scrollChatToBottom);
    const chatCanvas = getChatCanvas();
    if (chatCanvas) chatCanvas.addEventListener('scroll', updateChatScrollButtons);
    const transcriptHost = $('transcriptMessages');
    if (transcriptHost && window.MutationObserver) {
      new MutationObserver(() => setTimeout(updateChatScrollButtons, 0)).observe(transcriptHost, { childList: true, subtree: true });
    }
    window.addEventListener('resize', updateChatScrollButtons);

    const createChatBtn = $('createChatBtn');
    if (createChatBtn) createChatBtn.addEventListener('click', () => {
      location.hash = '#admin';
      renderCaseSelect();
      if ($('caseSelect')) $('caseSelect').value = '__new';
      fillCaseForm();
      setTimeout(() => $('caseTitleInput') && $('caseTitleInput').focus(), 120);
    });

    const caseFilterTabs = $('caseFilterTabs');
    if (caseFilterTabs) {
      caseFilterTabs.querySelectorAll('[data-case-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          caseFilter = btn.getAttribute('data-case-filter') || 'all';
          renderCaseList();
        });
      });
    }

    const employeeSearchInput = $('employeeSearchInput');
    if (employeeSearchInput) {
      employeeSearchInput.addEventListener('input', () => {
        employeeSearchQuery = employeeSearchInput.value;
        renderEmployeeGrid();
      });
    }

    // Заметка
    $('saveNoteBtn').addEventListener('click', () => {
      const c = getActiveCase(); if (!c) return;
      const v = $('operatorNote').value.trim();
      const criterionId = $('qualityCriterionSelect') ? $('qualityCriterionSelect').value : '';
      const criterion = getCriterion(criterionId);
      const user = window.IskustvAuth && window.IskustvAuth.getUser ? window.IskustvAuth.getUser() : null;
      const author = window.IskustvAuth && window.IskustvAuth.fullName ? window.IskustvAuth.fullName(user) : '';
      const noteKey = getCurrentNoteKey();
      if (v) {
        if (!criterion) {
          $('noteStatus').textContent = 'Сначала выберите критерий качества.';
          return;
        }
        const entry = notes[c.id] && notes[c.id].byUser ? notes[c.id] : { byUser: {} };
        const oldNote = entry.byUser[noteKey] || {};
        entry.byUser[noteKey] = {
          text: v,
          criterionId: criterion.id,
          criterionTitle: criterion.title,
          criterionType: criterion.type,
          criterionScore: criterion.score,
          criterionDescription: criterion.description,
          reviewStatus: oldNote.reviewStatus || 'pending',
          reviewedAt: oldNote.reviewedAt || '',
          reviewedBy: oldNote.reviewedBy || '',
          author: author || 'Сотрудник',
          uid: user && user.uid ? user.uid : '',
          email: user && user.email ? user.email : '',
          firstName: user && user.firstName ? user.firstName : '',
          lastName: user && user.lastName ? user.lastName : '',
          caseId: c.id,
          submittedAt: new Date().toISOString()
        };
        notes[c.id] = entry;
      } else {
        const entry = notes[c.id];
        if (entry && entry.byUser) {
          delete entry.byUser[noteKey];
          if (!Object.keys(entry.byUser).length) delete notes[c.id];
        } else {
          delete notes[c.id];
        }
      }
      saveNotes();
      renderStats(); renderCaseList(); renderNote(); renderAdmin();
      $('noteStatus').textContent = v ? 'Ответ отправлен бизнес-тренеру.' : 'Ответ удалён.';
    });

    // Экспорт / импорт / сброс
    $('exportBtn').addEventListener('click', exportJson);
    $('importBtn').addEventListener('click', () => $('importInput').click());
    $('importInput').addEventListener('change', importJson);
    $('resetBtn').addEventListener('click', () => {
      if (!confirm('Сбросить данные к демо? Заметки ОКК тоже будут удалены.')) return;
      state = normalizeStateData(demoState()); notes = {};
      saveState(); saveNotes(); renderAll();
    });

    // Категории
    if ($('emptyTrashBtn')) $('emptyTrashBtn').addEventListener('click', emptyTrash);
    document.querySelectorAll('[data-trainer-chat-close]').forEach(btn => btn.addEventListener('click', closeTrainerChatModal));
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeTrainerChatModal(); });
    const reviewFolders = $('trainerReviewFolders');
    if (reviewFolders) reviewFolders.querySelectorAll('[data-review-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        trainerReviewFilter = btn.getAttribute('data-review-filter') || 'pending';
        renderTrainerNotes();
      });
    });
    if ($('reviewAcceptBtn')) $('reviewAcceptBtn').addEventListener('click', () => setTrainerNoteReview('accepted'));
    if ($('reviewRejectBtn')) $('reviewRejectBtn').addEventListener('click', () => setTrainerNoteReview('rejected'));

    if ($('adminCriterionSelect')) $('adminCriterionSelect').addEventListener('change', fillCriterionForm);
    function saveCriterionFromForm() {
      const sel = $('adminCriterionSelect');
      const title = $('criterionTitleInput') ? $('criterionTitleInput').value.trim() : '';
      if (!title) { alert('Введите название критерия.'); return; }
      const data = {
        title,
        type: $('criterionTypeInput') ? $('criterionTypeInput').value : 'negative',
        score: $('criterionScoreInput') ? $('criterionScoreInput').value.trim() : '',
        description: $('criterionDescriptionInput') ? $('criterionDescriptionInput').value.trim() : ''
      };
      if (sel && sel.value && sel.value !== '__new') {
        const item = getCriterion(sel.value);
        if (item) Object.assign(item, data);
      } else {
        state.criteria.push(Object.assign({ id: 'crit_' + Date.now().toString(36) }, data));
      }
      saveState();
      renderAll();
      if ($('adminStatus')) $('adminStatus').textContent = 'Критерий сохранён.';
    }
    function deleteActiveCriterion() {
      const sel = $('adminCriterionSelect');
      if (!sel || sel.value === '__new') return;
      const item = getCriterion(sel.value);
      if (!item) return;
      if (!confirm(`Удалить критерий "${item.title}"? Старые ответы сотрудников сохранят название критерия.`)) return;
      state.criteria = getQualityCriteria().filter(c => c.id !== item.id);
      if (!state.criteria.length) state.criteria = defaultQualityCriteria();
      saveState();
      renderAll();
    }
    if ($('saveCriterionBtn')) $('saveCriterionBtn').addEventListener('click', saveCriterionFromForm);
    if ($('criterionForm')) $('criterionForm').addEventListener('submit', ev => { ev.preventDefault(); saveCriterionFromForm(); });
    if ($('deleteCriterionBtn')) $('deleteCriterionBtn').addEventListener('click', deleteActiveCriterion);

    // Форма чата
    $('caseSelect').addEventListener('change', () => fillCaseForm());
    if ($('addDriverMsgBtn')) $('addDriverMsgBtn').addEventListener('click', () => insertTranscriptSpeaker('Водитель'));
    if ($('addAgentMsgBtn')) $('addAgentMsgBtn').addEventListener('click', () => insertTranscriptSpeaker('Сотрудник'));
    if ($('addDateMsgBtn')) $('addDateMsgBtn').addEventListener('click', insertTranscriptDate);
    if ($('addSystemMsgBtn')) $('addSystemMsgBtn').addEventListener('click', insertTranscriptSystemInfo);
    if ($('privateMessageBtn')) $('privateMessageBtn').addEventListener('click', makeSelectedTextPrivate);
    ['caseTitleInput','caseDriverInput','caseInfoInput','caseTranscriptInput'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('input', () => {
        renderCaseEditorPreview();
        renderTranscriptEditorHighlight();
      });
      if (el && el.tagName === 'SELECT') el.addEventListener('change', renderCaseEditorPreview);
    });
    if ($('caseTranscriptInput')) {
      $('caseTranscriptInput').addEventListener('scroll', renderTranscriptEditorHighlight);
    }
    $('caseForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const editing = $('caseForm').dataset.editing;
      const data = {
        title: ($('caseTitleInput') && $('caseTitleInput').value.trim()) || '',
        driver: $('caseDriverInput').value.trim(),
        status: $('caseStatusInput').value.trim() || 'На проверке',
        info: $('caseInfoInput').value,
        transcript: $('caseTranscriptInput').value,
        hidden: $('caseHiddenInput').value
      };
      data.title = data.title || (data.driver ? 'Чат с ' + data.driver : 'Готовый чат');
      if (editing && editing !== '__new') {
        const c = state.cases.find(x => x.id === editing);
        if (c) Object.assign(c, data);
      } else {
        const id = 'case_' + Date.now().toString(36);
        state.cases.push(Object.assign({ id }, data));
        state.activeCaseId = id;
      }
      saveState(); renderAll();
      if ($('adminStatus')) $('adminStatus').textContent = 'Чат сохранён.';
    });

    // Форма API удалена из интерфейса.
    if ($('apiForm')) $('apiForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      state.api = {
        mode: $('apiMode').value,
        model: $('apiModel').value.trim(),
        endpoint: $('apiEndpoint').value.trim(),
        key: $('apiKey').value,
        instructions: $('apiInstructions').value
      };
      saveState();
      // ключ дополнительно сохраняется в отдельной записи, чтобы не экспортироваться вместе с данными
      try { localStorage.setItem(API_KEY_STORE, state.api.key || ''); } catch (_) {}
      $('adminStatus').textContent = 'API-настройки сохранены.';
    });
  }

  function shiftCase(delta) {
    const cases = getVisibleCases();
    if (!cases.length) return;
    const idx = Math.max(0, cases.findIndex(c => c.id === state.activeCaseId));
    const next = (idx + delta + cases.length) % cases.length;
    state.activeCaseId = cases[next].id;
    saveState();
    renderChat(); renderCaseList(); renderNote();
  }

  function exportJson() {
    const payload = { state, notes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'okk-review-export.json';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function importJson(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data && data.state && Array.isArray(data.state.employees)) {
          state = data.state;
          notes = data.notes && typeof data.notes === 'object' ? data.notes : {};
          saveState(); saveNotes(); renderAll();
          $('adminStatus').textContent = 'Данные импортированы.';
        } else {
          alert('Неверный формат файла.');
        }
      } catch (e) { alert('Не удалось прочитать JSON: ' + e.message); }
    };
    reader.readAsText(file);
  }

  function clearVisibleData() {
    applyingRemote = true;
    state = emptyState();
    notes = {};
    accessUsers = {};
    applyingRemote = false;
    renderAll();
  }

  function renderAll() {
    renderStats();
    renderEmployeeGrid();
    renderActiveEmployeeCard();
    renderCaseList();
    renderChat();
    renderNote();
    renderAdmin();
    setTimeout(updateChatScrollButtons, 0);
  }

  function deleteActiveEmployee() {
    const emp = getActiveEmployee();
    if (!emp) return;
    if (!confirm(`Удалить сотрудника "${emp.name}"? Он будет перемещён в корзину.`)) return;
    state.trash = state.trash || { employees: [] };
    state.trash.employees.unshift(Object.assign({}, emp, { deletedAt: new Date().toISOString() }));
    state.employees = state.employees.filter(e => e.id !== emp.id);
    const next = state.employees[0] || null;
    state.activeEmployeeId = next ? next.id : null;
    state.activeCaseId = next && next.cases[0] ? next.cases[0].id : null;
    saveState();
    renderAll();
  }

  function restoreEmployee(id) {
    state.trash = state.trash || { employees: [] };
    const idx = state.trash.employees.findIndex(e => e.id === id);
    if (idx < 0) return;
    const emp = state.trash.employees.splice(idx, 1)[0];
    delete emp.deletedAt;
    if (state.employees.some(e => e.id === emp.id)) emp.id = 'emp_' + Date.now().toString(36);
    state.employees.push(emp);
    state.activeEmployeeId = emp.id;
    state.activeCaseId = emp.cases && emp.cases[0] ? emp.cases[0].id : null;
    saveState();
    renderAll();
  }

  function destroyEmployee(id) {
    state.trash = state.trash || { employees: [] };
    const emp = state.trash.employees.find(e => e.id === id);
    if (!emp) return;
    if (!confirm(`Удалить "${emp.name}" навсегда? Это действие нельзя отменить.`)) return;
    state.trash.employees = state.trash.employees.filter(e => e.id !== id);
    saveState();
    renderAll();
  }

  function emptyTrash() {
    state.trash = state.trash || { employees: [] };
    if (!state.trash.employees.length) return;
    if (!confirm('Очистить корзину? Все удалённые сотрудники исчезнут навсегда.')) return;
    state.trash.employees = [];
    saveState();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    window.addEventListener('iskustv:access-blocked', clearVisibleData);
    if (USE_FIREBASE_SOURCE) {
      initFirebaseSync();
    } else {
      renderAll();
      initFirebaseSync();
    }
    console.log('OKK Review готов. Firebase sync включён.');
  });
})();