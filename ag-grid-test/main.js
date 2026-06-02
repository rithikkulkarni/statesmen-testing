import {
  createGrid,
  ModuleRegistry,
  AllCommunityModule,
} from 'ag-grid-community';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import './style.css';
import { adjustmentRows } from './data/adjustments.js';
import { exceptionRows } from './data/exceptions.js';
import { paymentRows } from './data/payments.js';
import { candyRows } from './data/candy.js';

ModuleRegistry.registerModules([AllCommunityModule]);

const CONFIG_VERSION = 2;
const VIEW_LIBRARY_STORAGE_KEY = 'ag-grid-named-view-library-v1';

const paymentColumnDefs = [
  { field: 'paymentId', filter: 'agNumberColumnFilter' },
  { field: 'customer' },
  { field: 'carrier' },
  { field: 'policyNumber' },
  {
    field: 'amount',
    filter: 'agNumberColumnFilter',
    aggFunc: 'sum',
    valueFormatter: (params) => {
      if (params.value == null || Number.isNaN(Number(params.value))) {
        return '';
      }

      return Number(params.value).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      });
    },
  },
  { field: 'status' },
  { field: 'paymentMethod' },
  { field: 'invoiceDate' },
  { field: 'region' },
];

const candyColumnDefs = [
  { field: 'saleId' },
  { field: 'date' },
  { field: 'month' },
  { field: 'product' },
  { field: 'category' },
  { field: 'store' },
  { field: 'region' },
  { field: 'customerSegment' },
  { field: 'customerType' },
  { field: 'purchaseOccasion' },
  { field: 'marketingChannel' },
  { field: 'promoType' },
  { field: 'discountPct', filter: 'agNumberColumnFilter' },
  { field: 'quantity', filter: 'agNumberColumnFilter' },
  {
    field: 'unitPrice',
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) => params.value == null ? '' : Number(params.value).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
  },
  {
    field: 'grossTotal',
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) => params.value == null ? '' : Number(params.value).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
  },
  {
    field: 'total',
    filter: 'agNumberColumnFilter',
    aggFunc: 'sum',
    valueFormatter: (params) => params.value == null ? '' : Number(params.value).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
  },
  { field: 'satisfaction', filter: 'agNumberColumnFilter' },
  { field: 'paymentMethod' },
];

const datasets = [
  {
    id: 'payments',
    label: 'Payments Baseline',
    columnDefs: paymentColumnDefs,
    rowData: paymentRows,
  },
  {
    id: 'adjustments',
    label: 'Rebills & Adjustments',
    columnDefs: paymentColumnDefs,
    rowData: adjustmentRows,
  },
  {
    id: 'exceptions',
    label: 'Exceptions Queue',
    columnDefs: paymentColumnDefs,
    rowData: exceptionRows,
  },
  {
    id: 'candy',
    label: 'Candy Store Sales',
    columnDefs: candyColumnDefs,
    rowData: candyRows,
  },
];

const datasetIdSet = new Set(datasets.map((dataset) => dataset.id));

function getColumnIds(columnDefsForDataset) {
  return columnDefsForDataset
  .map((columnDef) => columnDef.field)
  .filter((field) => typeof field === 'string');
}

function getNumericColumnSet(columnDefsForDataset) {
  return new Set(
    columnDefsForDataset
    .filter(
      (columnDef) =>
        typeof columnDef.field === 'string' &&
        columnDef.filter === 'agNumberColumnFilter',
    )
    .map((columnDef) => columnDef.field),
  );
}

let columnDefs = paymentColumnDefs;
let baseColumnIds = getColumnIds(columnDefs);
let knownColumns = new Set(baseColumnIds);
let numericFilterColumns = getNumericColumnSet(columnDefs);
const numberFilterTypesWithSingleValue = new Set([
  'equals',
  'notEqual',
  'lessThan',
  'lessThanOrEqual',
  'greaterThan',
  'greaterThanOrEqual',
]);
const numberFilterTypesWithRangeValue = new Set(['inRange']);
const numberFilterTypesWithNoValue = new Set(['blank', 'notBlank']);
const textFilterTypesWithSingleValue = new Set([
  'contains',
  'notContains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
]);
const textFilterTypesWithNoValue = new Set(['blank', 'notBlank']);
const allowedFilterOperators = new Set([
  'equals',
  'notEqual',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'between',
  'oneOf',
  'blank',
  'notBlank',
]);
const supportedAggregationFunctions = new Set([
  'sum',
  'avg',
  'min',
  'max',
  'count',
]);
let numericAggregationColumns = new Set(['amount']);
const totalMetricTokens = new Set([
  'amount',
  'total',
  'count',
  'qty',
  'quantity',
  'volume',
  'units',
  'unit',
  'sum',
]);
const totalIdTokens = new Set(['id', 'identifier', 'key']);
const TOTALS_LABEL = 'Totals';
const CHAT_STICKY_BOTTOM_THRESHOLD = 48;
const CONVERSATIONS_STORAGE_KEY = 'ag-grid-conversations-v1';
const chatMessages = [];
let chatMessageSerial = 0;
let conversations = [];
let currentConversationId = null;
const viewSnapshots = new Map();

const dom = {
  grid: document.querySelector('#myGrid'),
  configInput: document.querySelector('#configInput'),
  status: document.querySelector('#status'),
  chatPromptInput: document.querySelector('#chatPromptInput'),
  chatSend: document.querySelector('#chatSend'),
  chatStatus: document.querySelector('#chatStatus'),
  analysisOutput: document.querySelector('#analysisOutput'),
  conversationSelect: document.querySelector('#conversationSelect'),
  newChatBtn: document.querySelector('#newChatBtn'),
  questionNav: document.querySelector('#questionNav'),
  datasetSelect: document.querySelector('#datasetSelect'),
  resetView: document.querySelector('#resetView'),
  viewNameInput: document.querySelector('#viewNameInput'),
  saveNamedView: document.querySelector('#saveNamedView'),
  savedViewSelect: document.querySelector('#savedViewSelect'),
  loadSelectedView: document.querySelector('#loadSelectedView'),
  deleteSelectedView: document.querySelector('#deleteSelectedView'),
  applyConfig: document.querySelector('#applyConfig'),
  exportConfig: document.querySelector('#exportConfig'),
  resetConfig: document.querySelector('#resetConfig'),
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function setStatus(message, tone = 'info') {
  if (!dom.status) {
    return;
  }

  dom.status.textContent = message;
  dom.status.setAttribute('data-tone', tone);
}

function setChatStatus(message, tone = 'info') {
  if (!dom.chatStatus) {
    return;
  }

  dom.chatStatus.textContent = message;
  dom.chatStatus.setAttribute('data-tone', tone);
}

function nextChatMessageId() {
  chatMessageSerial += 1;
  return `${Date.now()}-${chatMessageSerial}`;
}

function normalizeChatTextLines(lines) {
  return Array.isArray(lines) ? lines.filter(Boolean).map((line) => String(line)) : [];
}

function scrollChatToBottom(force = false) {
  if (!dom.analysisOutput) {
    return;
  }

  if (force) {
    dom.analysisOutput.scrollTop = dom.analysisOutput.scrollHeight;
    return;
  }

  const distanceFromBottom =
    dom.analysisOutput.scrollHeight -
    dom.analysisOutput.scrollTop -
    dom.analysisOutput.clientHeight;

  if (distanceFromBottom <= CHAT_STICKY_BOTTOM_THRESHOLD) {
    dom.analysisOutput.scrollTop = dom.analysisOutput.scrollHeight;
  }
}

function createChatMessageElement(message) {
  const article = document.createElement('article');
  article.className = `chatMessage chatMessage--${message.role || 'assistant'}`;
  if (message.kind) {
    article.className += ` chatMessage--${message.kind}`;
  }
  article.dataset.messageId = message.id;

  const header = document.createElement('div');
  header.className = 'chatMessageHeader';

  const title = document.createElement('span');
  title.textContent =
    message.title ||
    (message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : 'Assistant');
  header.appendChild(title);

  if (message.timestamp) {
    const time = document.createElement('span');
    time.textContent = new Date(message.timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    header.appendChild(time);
  }

  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'chatMessageBody';

  if (message.role === 'user') {
    body.textContent = message.text || '';
    article.appendChild(body);
    return article;
  }

  if (message.kind === 'analysis_answer' && isPlainObject(message.response)) {
    const answer = document.createElement('p');
    answer.className = 'analysisAnswer';
    answer.textContent = message.response.answer || 'Analysis complete.';
    body.appendChild(answer);

    appendAnalysisSection(body, 'Key Insights', message.response.insights);
    appendAnalysisSection(body, 'Recommended Actions', message.response.recommendedActions);

    if (viewSnapshots.has(message.id) && gridApiRef) {
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'restoreViewBtn ghost';
      restoreBtn.textContent = '↩ Restore this view';
      restoreBtn.addEventListener('click', () => {
        restoreGridSnapshot(gridApiRef, viewSnapshots.get(message.id));
      });
      body.appendChild(restoreBtn);
    }

    if (isPlainObject(message.response?.queryMeta)) {
      const meta = message.response.queryMeta;
      const metaDiv = document.createElement('div');
      metaDiv.className = 'answerMeta';

      const scopeText = meta.scope === 'current_view' ? 'Current view'
        : meta.scope === 'selected_rows' ? 'Selected rows'
        : 'Full dataset';
      const chips = [
        scopeText,
        ...(meta.filtersApplied?.length ? [`Filter: ${meta.filtersApplied.join(', ')}`] : []),
        ...(meta.groupBy?.length ? [`Grouped by: ${meta.groupBy.join(', ')}`] : []),
        ...(meta.aggregations?.length ? [meta.aggregations.join(', ')] : []),
        ...(meta.sortBy ? [`Sorted: ${meta.sortBy}`] : []),
        ...(meta.resultRowCount != null ? [`${meta.resultRowCount} result${meta.resultRowCount !== 1 ? 's' : ''}`] : []),
      ];
      chips.forEach(text => {
        const chip = document.createElement('span');
        chip.className = 'answerMetaChip';
        chip.textContent = text;
        metaDiv.appendChild(chip);
      });
      body.appendChild(metaDiv);
    }

    article.appendChild(body);
    return article;
  }

  if (message.kind === 'clarification' && isPlainObject(message.response)) {
    const prompt = document.createElement('p');
    prompt.className = 'analysisAnswer';
    prompt.textContent =
      message.response.question || 'Please clarify whether you want analysis or a table change.';
    body.appendChild(prompt);
    appendAnalysisSection(body, 'Suggestions', message.response.suggestions);
    article.appendChild(body);
    return article;
  }

  if (message.kind === 'thinking') {
    const spinner = document.createElement('span');
    spinner.className = 'thinkingSpinner';
    body.appendChild(spinner);
    const textSpan = document.createElement('span');
    textSpan.className = 'thinkingText';
    textSpan.textContent = message.text || 'Analyzing...';
    body.appendChild(textSpan);
    article.appendChild(body);
    return article;
  }

  if (message.lines?.length) {
    message.lines.forEach((line) => {
      const paragraph = document.createElement('div');
      paragraph.textContent = line;
      body.appendChild(paragraph);
    });
    article.appendChild(body);
    return article;
  }

  if (message.text) {
    body.textContent = message.text;
  }

  article.appendChild(body);
  return article;
}

function renderChatTranscript(options = {}) {
  if (!dom.analysisOutput) {
    return;
  }

  const shouldStickToBottom =
    options.scrollToBottom === true ||
    (options.scrollToBottom !== false &&
      dom.analysisOutput.scrollHeight - dom.analysisOutput.scrollTop - dom.analysisOutput.clientHeight <=
        CHAT_STICKY_BOTTOM_THRESHOLD);

  dom.analysisOutput.hidden = chatMessages.length === 0;
  dom.analysisOutput.innerHTML = '';

  chatMessages.forEach((message) => {
    dom.analysisOutput.appendChild(createChatMessageElement(message));
  });

  if (shouldStickToBottom) {
    scrollChatToBottom(true);
  }

  renderQuestionNav();
}

function pushChatMessage(message, options = {}) {
  const entry = {
    id: message.id || nextChatMessageId(),
    role: message.role || 'assistant',
    kind: message.kind || 'note',
    title: message.title || '',
    text: message.text || '',
    lines: normalizeChatTextLines(message.lines),
    response: isPlainObject(message.response) ? deepClone(message.response) : null,
    timestamp: message.timestamp || new Date().toISOString(),
  };

  chatMessages.push(entry);
  renderChatTranscript(options);
  return entry;
}

function clearChatTranscript() {
  chatMessages.length = 0;
  viewSnapshots.clear();
  renderChatTranscript({ scrollToBottom: false });
  renderQuestionNav();
}

// ── Conversation management ───────────────────────────────────────────────────

function nextConversationId() {
  return `conv_${Date.now()}_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
}

function loadConversationsFromStorage() {
  try { return JSON.parse(localStorage.getItem(CONVERSATIONS_STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveConversationsToStorage() {
  localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
}

function autoNameConversation(conv) {
  const firstUser = chatMessages.find((m) => m.role === 'user');
  if (firstUser?.text && conv.name === 'New Chat') {
    const t = firstUser.text.trim();
    conv.name = t.length > 52 ? t.slice(0, 52) + '…' : t;
  }
}

function ensureConversation() {
  if (currentConversationId) return;
  const conv = {
    id: nextConversationId(),
    name: 'New Chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    snapshots: {},
  };
  conversations.unshift(conv);
  currentConversationId = conv.id;
  populateConversationSelect();
}

function persistCurrentConversation() {
  if (!currentConversationId) return;
  const conv = conversations.find((c) => c.id === currentConversationId);
  if (!conv) return;
  autoNameConversation(conv);
  conv.messages = deepClone(chatMessages);
  conv.snapshots = Object.fromEntries(viewSnapshots);
  conv.updatedAt = new Date().toISOString();
  saveConversationsToStorage();
  populateConversationSelect();
}

function populateConversationSelect() {
  if (!dom.conversationSelect) return;
  dom.conversationSelect.innerHTML = '';
  if (conversations.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'No saved chats yet';
    opt.disabled = true;
    opt.selected = true;
    dom.conversationSelect.appendChild(opt);
    return;
  }
  conversations.forEach((conv) => {
    const opt = document.createElement('option');
    opt.value = conv.id;
    opt.textContent = conv.name;
    opt.selected = conv.id === currentConversationId;
    dom.conversationSelect.appendChild(opt);
  });
}

function renderQuestionNav() {
  if (!dom.questionNav) return;
  const userMsgs = chatMessages.filter((m) => m.role === 'user');
  dom.questionNav.hidden = userMsgs.length === 0;
  dom.questionNav.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Jump to question…';
  placeholder.disabled = true;
  placeholder.selected = true;
  dom.questionNav.appendChild(placeholder);
  userMsgs.forEach((msg) => {
    const opt = document.createElement('option');
    opt.value = msg.id;
    opt.title = msg.text;
    opt.textContent = msg.text.length > 60 ? msg.text.slice(0, 60) + '…' : msg.text;
    dom.questionNav.appendChild(opt);
  });
}

function captureGridSnapshot() {
  if (!gridApiRef) return null;
  const columnState = gridApiRef.getColumnState() || [];
  const columns = columnState.filter((s) => !s.hide).map((s) => s.colId);
  const sort = columnState
    .filter((s) => s.sort)
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
    .map((s) => ({ field: s.colId, direction: s.sort }));
  const rows = [];
  gridApiRef.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) rows.push(node.data);
  });
  return { datasetId: currentDatasetId, columns, sort, rows: rows.slice(0, 500), isAggregated: false };
}

function restoreGridSnapshot(gridApi, snapshot) {
  if (!snapshot) return;
  const { columns, rows, sort, isAggregated } = snapshot;
  if (!Array.isArray(columns) || columns.length === 0) return;
  if (isAggregated) {
    applyStepResultToGrid(gridApi, { columns, rows, sort });
  } else {
    switchDataset(gridApi, snapshot.datasetId, { syncJson: false });
    if (sort && sort.length > 0) {
      const state = sort.map((s, i) => ({ colId: s.field, sort: s.direction, sortIndex: i }));
      gridApi.applyColumnState({ state, defaultState: { sort: null } });
    }
  }
  scheduleJsonSync();
}

function loadConversation(id, gridApi) {
  const conv = conversations.find((c) => c.id === id);
  if (!conv) return;
  currentConversationId = id;
  chatMessages.length = 0;
  chatMessages.push(...deepClone(conv.messages));
  viewSnapshots.clear();
  Object.entries(conv.snapshots || {}).forEach(([k, v]) => viewSnapshots.set(k, v));
  renderChatTranscript({ scrollToBottom: true });
  renderQuestionNav();
  populateConversationSelect();
  // Restore the most recent snapshot
  let lastSnap = null;
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const m = chatMessages[i];
    if ((m.kind === 'analysis_answer' || m.kind === 'note') && viewSnapshots.has(m.id)) {
      lastSnap = viewSnapshots.get(m.id);
      break;
    }
  }
  if (lastSnap && gridApi) restoreGridSnapshot(gridApi, lastSnap);
}

function startNewConversation() {
  if (chatMessages.filter((m) => m.role === 'user').length > 0) {
    persistCurrentConversation();
  }
  currentConversationId = null;
  clearChatTranscript();
  pushChatMessage(
    {
      role: 'assistant',
      kind: 'system',
      title: 'Ask Analyst',
      text: 'I can answer questions about the data, explain columns, summarize patterns, or change the grid view.',
    },
    { scrollToBottom: false },
  );
}

function updateThinkingMessage(id, text) {
  const message = chatMessages.find((m) => m.id === id);
  if (message) {
    message.text = text;
    const el = dom.analysisOutput?.querySelector(`[data-message-id="${id}"] .thinkingText`);
    if (el) el.textContent = text;
    else renderChatTranscript({ scrollToBottom: false });
  }
}

function replaceThinkingWithAnswer(id, answerEvent) {
  const message = chatMessages.find((m) => m.id === id);
  if (!message) return;
  message.kind = 'analysis_answer';
  message.title = 'Ask Analyst';
  message.text = '';
  message.response = {
    answer: answerEvent.answer || 'Analysis complete.',
    insights: Array.isArray(answerEvent.insights) ? answerEvent.insights : [],
    recommendedActions: Array.isArray(answerEvent.recommendedActions) ? answerEvent.recommendedActions : [],
    queryMeta: isPlainObject(answerEvent.queryMeta) ? answerEvent.queryMeta : null,
  };
  renderChatTranscript({ scrollToBottom: true });
}

function replaceThinkingWithError(id, errorMessage) {
  const message = chatMessages.find((m) => m.id === id);
  if (!message) return;
  message.kind = 'note';
  message.title = 'Error';
  message.text = '';
  message.lines = [errorMessage || 'Analysis failed.'];
  renderChatTranscript({ scrollToBottom: true });
}

function applyStepResultToGrid(gridApi, stepEvent) {
  const { columns, rows, sort } = stepEvent;
  if (!gridApi || !Array.isArray(columns) || columns.length === 0) return;
  // A single-row scalar result (e.g. bare COUNT) isn't a useful grid view — skip it
  if (!Array.isArray(rows) || rows.length <= 1) return;

  const sortMap = new Map((sort || []).map((s, i) => [s.field, { ...s, index: i }]));

  const newColumnDefs = columns.map((col) => ({
    field: col,
    headerName: col.replace(/_/g, ' '),
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 80,
  }));

  withJsonSyncPaused(() => {
    gridApi.setGridOption('columnDefs', newColumnDefs);
    gridApi.setGridOption('rowData', rows || []);
  });

  // Apply sort indicators so column headers reflect the SQL ORDER BY
  const columnState = columns.map((col) => {
    const s = sortMap.get(col);
    return { colId: col, sort: s ? s.direction : null, sortIndex: s ? s.index : null };
  });
  gridApi.applyColumnState({ state: columnState, defaultState: { sort: null } });
}

function getDatasetById(datasetId) {
  return datasets.find((dataset) => dataset.id === datasetId) || datasets[0];
}

function setActiveDatasetSchema(datasetId) {
  const dataset = getDatasetById(datasetId);
  columnDefs = dataset.columnDefs || paymentColumnDefs;
  baseColumnIds = getColumnIds(columnDefs);
  knownColumns = new Set(baseColumnIds);
  numericFilterColumns = getNumericColumnSet(columnDefs);
  numericAggregationColumns = new Set(
    baseColumnIds.filter((field) => numericFilterColumns.has(field)),
  );
}

function getDefaultConfig(datasetId = datasets[0].id) {
  const dataset = getDatasetById(datasetId);
  const columnIds = getColumnIds(dataset.columnDefs || columnDefs);
  const aggregations = {};

  return {
    version: CONFIG_VERSION,
    datasetId: dataset.id,
    columns: {
      order: [...columnIds],
      hidden: [],
      pinned: {},
      widths: {},
    },
    sort: [],
    filters: {},
    groupBy: [],
    aggregations,
    subtotals: {
      enabled: false,
      position: 'bottom',
    },
  };
}

const makeDefaultConfig = getDefaultConfig;

function sanitizeColumnList(rawList, label, warnings) {
  if (!Array.isArray(rawList)) {
    warnings.push(`${label} must be an array.`);
    return [];
  }

  const result = [];
  const seen = new Set();

  rawList.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      warnings.push(`${label}[${index}] must be a string column id.`);
      return;
    }

    const trimmed = entry.trim();

    if (!knownColumns.has(trimmed)) {
      warnings.push(`${label}[${index}] "${trimmed}" is not a known column.`);
      return;
    }

    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  });

  return result;
}

function parseNumericInput(rawValue) {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.replace(/[$,\s]/g, '');
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseTextInput(rawValue) {
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    return trimmed || null;
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return String(rawValue);
  }

  if (typeof rawValue === 'boolean') {
    return rawValue ? 'true' : 'false';
  }

  return null;
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function pickFirstOwnValue(source, keys) {
  for (const key of keys) {
    if (hasOwn(source, key)) {
      return source[key];
    }
  }

  return undefined;
}

function normalizeValueArrayAsText(rawValues) {
  if (!Array.isArray(rawValues)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  rawValues.forEach((entry) => {
    const text = parseTextInput(entry);
    if (!text) {
      return;
    }

    const dedupeKey = text.toLowerCase();
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    normalized.push(text);
  });

  return normalized;
}

function buildTextEqualsFilterFromValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return {
      filterType: 'text',
      type: 'equals',
      filter: values[0],
    };
  }

  return {
    filterType: 'text',
    operator: 'OR',
    conditions: values.map((value) => ({
      filterType: 'text',
      type: 'equals',
      filter: value,
    })),
  };
}

function normalizeTextFilterCondition(colId, rawCondition, warnings, label) {
  if (!isPlainObject(rawCondition)) {
    warnings.push(`${label} must be an object.`);
    return null;
  }

  const type = typeof rawCondition.type === 'string' ? rawCondition.type : null;
  if (!type) {
    warnings.push(`${label} is missing a valid text filter type.`);
    return null;
  }

  if (textFilterTypesWithNoValue.has(type)) {
    return {
      filterType: 'text',
      type,
    };
  }

  if (!textFilterTypesWithSingleValue.has(type)) {
    warnings.push(`${label} has unsupported text filter type "${type}".`);
    return null;
  }

  const parsedFilterValue = parseTextInput(rawCondition.filter);
  if (!parsedFilterValue) {
    warnings.push(`${label} requires a non-empty filter value.`);
    return null;
  }

  return {
    filterType: 'text',
    type,
    filter: parsedFilterValue,
  };
}

function normalizeTextFilterModel(colId, rawModel, warnings) {
  if (!isPlainObject(rawModel)) {
    warnings.push(`filters.${colId} must be an object filter model.`);
    return null;
  }

  if (Object.keys(rawModel).length === 0) {
    warnings.push(`filters.${colId} was empty and was ignored.`);
    return null;
  }

  const filterType =
    typeof rawModel.filterType === 'string' ? rawModel.filterType : undefined;

  if (filterType === 'set') {
    const setValues = normalizeValueArrayAsText(rawModel.values);
    if (setValues.length === 0) {
      warnings.push(`filters.${colId} set filter had no selected values and was ignored.`);
      return null;
    }

    return buildTextEqualsFilterFromValues(setValues);
  }

  const valueArrayCandidate =
    Array.isArray(rawModel.values)
      ? rawModel.values
      : Array.isArray(rawModel.oneOf)
        ? rawModel.oneOf
        : Array.isArray(rawModel.in)
          ? rawModel.in
          : null;
  if (valueArrayCandidate) {
    const setValues = normalizeValueArrayAsText(valueArrayCandidate);
    if (setValues.length === 0) {
      warnings.push(`filters.${colId} value list filter had no selected values and was ignored.`);
      return null;
    }

    return buildTextEqualsFilterFromValues(setValues);
  }

  const shorthandContains = parseTextInput(rawModel.contains);
  if (shorthandContains) {
    return {
      filterType: 'text',
      type: 'contains',
      filter: shorthandContains,
    };
  }

  const shorthandStartsWith = parseTextInput(rawModel.startsWith);
  if (shorthandStartsWith) {
    return {
      filterType: 'text',
      type: 'startsWith',
      filter: shorthandStartsWith,
    };
  }

  const shorthandEndsWith = parseTextInput(rawModel.endsWith);
  if (shorthandEndsWith) {
    return {
      filterType: 'text',
      type: 'endsWith',
      filter: shorthandEndsWith,
    };
  }

  const shorthandEquals = pickFirstOwnValue(rawModel, [
    'equals',
    'is',
    'value',
  ]);
  const parsedEquals = parseTextInput(shorthandEquals);
  if (parsedEquals) {
    return {
      filterType: 'text',
      type: 'equals',
      filter: parsedEquals,
    };
  }

  if (filterType === 'text' || filterType === undefined) {
    if (
      typeof rawModel.operator === 'string' &&
      Array.isArray(rawModel.conditions)
    ) {
      const normalizedConditions = rawModel.conditions
        .map((condition, index) =>
          normalizeTextFilterCondition(
            colId,
            condition,
            warnings,
            `filters.${colId}.conditions[${index}]`,
          ),
        )
        .filter(Boolean);

      if (normalizedConditions.length === 0) {
        warnings.push(`filters.${colId} had no valid conditions and was ignored.`);
        return null;
      }

      if (normalizedConditions.length === 1) {
        return normalizedConditions[0];
      }

      return {
        filterType: 'text',
        operator: rawModel.operator === 'OR' ? 'OR' : 'AND',
        conditions: normalizedConditions,
      };
    }

    const normalizedSingle = normalizeTextFilterCondition(
      colId,
      rawModel,
      warnings,
      `filters.${colId}`,
    );
    if (normalizedSingle) {
      return normalizedSingle;
    }

    return null;
  }

  warnings.push(
    `filters.${colId} filterType "${filterType}" is unsupported for this column and was ignored.`,
  );
  return null;
}

function normalizeNumberFilterShorthand(colId, rawModel, warnings) {
  const hasRangeArray = hasOwn(rawModel, 'range');
  const hasAnyBoundKey = [
    'min',
    'minimum',
    'max',
    'maximum',
    'from',
    'to',
    'gte',
    'gt',
    'lte',
    'lt',
    'ge',
    'le',
    'greaterThan',
    'lessThan',
  ].some((key) => hasOwn(rawModel, key));

  if (!hasRangeArray && !hasAnyBoundKey) {
    return null;
  }

  let lowerType = null;
  let lowerValue = null;
  let upperType = null;
  let upperValue = null;

  if (hasRangeArray) {
    const range = rawModel.range;
    if (Array.isArray(range) && range.length >= 2) {
      const lower = parseNumericInput(range[0]);
      const upper = parseNumericInput(range[1]);

      if (lower == null || upper == null) {
        warnings.push(`filters.${colId}.range must contain numeric min/max values.`);
      } else {
        lowerType = 'greaterThanOrEqual';
        lowerValue = lower;
        upperType = 'lessThanOrEqual';
        upperValue = upper;
      }
    } else {
      warnings.push(`filters.${colId}.range must be an array like [min, max].`);
    }
  }

  if (lowerType == null) {
    const lowerExclusiveRaw = pickFirstOwnValue(rawModel, ['gt', 'greaterThan']);
    const lowerInclusiveRaw = pickFirstOwnValue(rawModel, [
      'min',
      'minimum',
      'from',
      'gte',
      'ge',
    ]);
    const rawLowerValue =
      lowerExclusiveRaw !== undefined ? lowerExclusiveRaw : lowerInclusiveRaw;

    if (rawLowerValue !== undefined) {
      const parsedLower = parseNumericInput(rawLowerValue);
      if (parsedLower == null) {
        warnings.push(`filters.${colId} lower bound must be numeric.`);
      } else {
        lowerType =
          lowerExclusiveRaw !== undefined ? 'greaterThan' : 'greaterThanOrEqual';
        lowerValue = parsedLower;
      }
    }
  }

  if (upperType == null) {
    const upperExclusiveRaw = pickFirstOwnValue(rawModel, ['lt', 'lessThan']);
    const upperInclusiveRaw = pickFirstOwnValue(rawModel, [
      'max',
      'maximum',
      'to',
      'lte',
      'le',
    ]);
    const rawUpperValue =
      upperExclusiveRaw !== undefined ? upperExclusiveRaw : upperInclusiveRaw;

    if (rawUpperValue !== undefined) {
      const parsedUpper = parseNumericInput(rawUpperValue);
      if (parsedUpper == null) {
        warnings.push(`filters.${colId} upper bound must be numeric.`);
      } else {
        upperType = upperExclusiveRaw !== undefined ? 'lessThan' : 'lessThanOrEqual';
        upperValue = parsedUpper;
      }
    }
  }

  if (lowerType == null && upperType == null) {
    warnings.push(
      `filters.${colId} numeric shorthand must include at least one valid bound.`,
    );
    return null;
  }

  if (lowerType && upperType) {
    const lowerIsInclusive = lowerType === 'greaterThanOrEqual';
    const upperIsInclusive = upperType === 'lessThanOrEqual';

    if (lowerIsInclusive && upperIsInclusive) {
      if (lowerValue > upperValue) {
        warnings.push(
          `filters.${colId} min/max were reversed; swapping to keep a valid range.`,
        );
        return {
          filterType: 'number',
          type: 'inRange',
          filter: upperValue,
          filterTo: lowerValue,
        };
      }

      return {
        filterType: 'number',
        type: 'inRange',
        filter: lowerValue,
        filterTo: upperValue,
      };
    }

    return {
      filterType: 'number',
      operator: 'AND',
      conditions: [
        {
          filterType: 'number',
          type: lowerType,
          filter: lowerValue,
        },
        {
          filterType: 'number',
          type: upperType,
          filter: upperValue,
        },
      ],
    };
  }

  if (lowerType) {
    return {
      filterType: 'number',
      type: lowerType,
      filter: lowerValue,
    };
  }

  return {
    filterType: 'number',
    type: upperType,
    filter: upperValue,
  };
}

function normalizeNumberFilterModel(colId, rawModel, warnings) {
  if (!isPlainObject(rawModel)) {
    warnings.push(`filters.${colId} must be an object filter model.`);
    return null;
  }

  if (Object.keys(rawModel).length === 0) {
    warnings.push(`filters.${colId} was empty and was ignored.`);
    return null;
  }

  const shorthandModel = normalizeNumberFilterShorthand(colId, rawModel, warnings);
  if (shorthandModel) {
    return shorthandModel;
  }

  if (
    typeof rawModel.operator === 'string' &&
    Array.isArray(rawModel.conditions)
  ) {
    const normalizedConditions = rawModel.conditions
      .map((condition, index) => {
        const normalized = normalizeNumberFilterModel(colId, condition, warnings);
        if (!normalized) {
          warnings.push(`filters.${colId}.conditions[${index}] was invalid and ignored.`);
        }
        return normalized;
      })
      .filter(Boolean);

    if (normalizedConditions.length === 0) {
      warnings.push(`filters.${colId} had no valid numeric conditions and was ignored.`);
      return null;
    }

    if (normalizedConditions.length === 1) {
      return normalizedConditions[0];
    }

    return {
      filterType: 'number',
      operator: rawModel.operator === 'OR' ? 'OR' : 'AND',
      conditions: normalizedConditions,
    };
  }

  const type = typeof rawModel.type === 'string' ? rawModel.type : null;
  if (!type) {
    warnings.push(`filters.${colId} numeric filter is missing type and was ignored.`);
    return null;
  }

  const normalized = {
    ...rawModel,
    filterType: 'number',
    type,
  };

  if (numberFilterTypesWithNoValue.has(type)) {
    delete normalized.filter;
    delete normalized.filterTo;
    return normalized;
  }

  if (numberFilterTypesWithSingleValue.has(type)) {
    const parsedValue = parseNumericInput(normalized.filter);
    if (parsedValue == null) {
      warnings.push(`filters.${colId}.filter must be numeric for "${type}" filter.`);
      return null;
    }
    normalized.filter = parsedValue;
    delete normalized.filterTo;
    return normalized;
  }

  if (numberFilterTypesWithRangeValue.has(type)) {
    const parsedMin = parseNumericInput(normalized.filter);
    const parsedMax = parseNumericInput(normalized.filterTo);
    if (parsedMin == null || parsedMax == null) {
      warnings.push(`filters.${colId}.inRange requires numeric filter and filterTo values.`);
      return null;
    }

    if (parsedMin > parsedMax) {
      warnings.push(
        `filters.${colId}.inRange filter values were reversed; swapping for a valid range.`,
      );
      normalized.filter = parsedMax;
      normalized.filterTo = parsedMin;
      return normalized;
    }

    normalized.filter = parsedMin;
    normalized.filterTo = parsedMax;
    return normalized;
  }

  return normalized;
}

function normalizeConfigFilter(colId, rawModel, warnings) {
  if (!isPlainObject(rawModel)) {
    warnings.push(`filters.${colId} must be an object.`);
    return null;
  }

  if (typeof rawModel.operator === 'string') {
    const operator = rawModel.operator.trim();
    if (!allowedFilterOperators.has(operator)) {
      warnings.push(`filters.${colId}.operator "${operator}" is not supported.`);
      return null;
    }

    if (operator === 'blank' || operator === 'notBlank') {
      return { operator };
    }

    if (operator === 'oneOf') {
      const values = normalizeValueArrayAsText(rawModel.value);
      if (values.length === 0) {
        warnings.push(`filters.${colId}.value must be a non-empty array for oneOf.`);
        return null;
      }
      return { operator, value: values };
    }

    if (operator === 'between') {
      if (!numericFilterColumns.has(colId)) {
        warnings.push(`filters.${colId}.between is only supported for numeric fields.`);
        return null;
      }

      const rawRange = Array.isArray(rawModel.value)
        ? rawModel.value
        : [rawModel.min, rawModel.max];
      const min = parseNumericInput(rawRange[0]);
      const max = parseNumericInput(rawRange[1]);
      if (min == null || max == null) {
        warnings.push(`filters.${colId}.value must contain numeric [min, max] values.`);
        return null;
      }

      return {
        operator,
        value: min <= max ? [min, max] : [max, min],
      };
    }

    if (numericFilterColumns.has(colId)) {
      const value = parseNumericInput(rawModel.value);
      if (value == null) {
        warnings.push(`filters.${colId}.value must be numeric.`);
        return null;
      }
      return { operator, value };
    }

    if (
      operator === 'greaterThan' ||
      operator === 'greaterThanOrEqual' ||
      operator === 'lessThan' ||
      operator === 'lessThanOrEqual'
    ) {
      warnings.push(`filters.${colId}.${operator} is only supported for numeric fields.`);
      return null;
    }

    const value = parseTextInput(rawModel.value);
    if (!value) {
      warnings.push(`filters.${colId}.value must be a non-empty value.`);
      return null;
    }
    return { operator, value };
  }

  if (numericFilterColumns.has(colId)) {
    const agModel = normalizeNumberFilterModel(colId, rawModel, warnings);
    return agModel ? convertAgGridFilterToConfigFilter(colId, agModel) : null;
  }

  const agModel = normalizeTextFilterModel(colId, rawModel, warnings);
  return agModel ? convertAgGridFilterToConfigFilter(colId, agModel) : null;
}

function convertAgGridFilterToConfigFilter(colId, agModel) {
  if (!isPlainObject(agModel)) {
    return null;
  }

  if (Array.isArray(agModel.conditions) && agModel.conditions.length > 0) {
    const converted = agModel.conditions
      .map((condition) => convertAgGridFilterToConfigFilter(colId, condition))
      .filter(Boolean);

    if (
      agModel.operator === 'OR' &&
      converted.length > 1 &&
      converted.every((condition) => condition.operator === 'equals')
    ) {
      return {
        operator: 'oneOf',
        value: converted.map((condition) => condition.value),
      };
    }

    return converted[0] || null;
  }

  if (agModel.type === 'inRange') {
    const min = parseNumericInput(agModel.filter);
    const max = parseNumericInput(agModel.filterTo);
    if (min == null || max == null) {
      return null;
    }
    return {
      operator: 'between',
      value: min <= max ? [min, max] : [max, min],
    };
  }

  if (agModel.type === 'blank' || agModel.type === 'notBlank') {
    return { operator: agModel.type };
  }

  const operator = typeof agModel.type === 'string' ? agModel.type : 'equals';
  const value = numericFilterColumns.has(colId)
    ? parseNumericInput(agModel.filter)
    : parseTextInput(agModel.filter);

  if (!allowedFilterOperators.has(operator) || value == null || value === '') {
    return null;
  }

  return { operator, value };
}

function convertConfigFilterToAgGridFilter(colId, configFilter) {
  if (!isPlainObject(configFilter)) {
    return null;
  }

  const { operator } = configFilter;
  if (operator === 'blank' || operator === 'notBlank') {
    return {
      filterType: numericFilterColumns.has(colId) ? 'number' : 'text',
      type: operator,
    };
  }

  if (operator === 'oneOf') {
    const values = normalizeValueArrayAsText(configFilter.value);
    if (values.length === 0) {
      return null;
    }

    if (values.length === 1) {
      return {
        filterType: 'text',
        type: 'equals',
        filter: values[0],
      };
    }

    return {
      filterType: 'text',
      operator: 'OR',
      conditions: values.map((value) => ({
        filterType: 'text',
        type: 'equals',
        filter: value,
      })),
    };
  }

  if (operator === 'between') {
    const [rawMin, rawMax] = Array.isArray(configFilter.value)
      ? configFilter.value
      : [];
    const min = parseNumericInput(rawMin);
    const max = parseNumericInput(rawMax);
    if (min == null || max == null) {
      return null;
    }

    return {
      filterType: 'number',
      type: 'inRange',
      filter: min <= max ? min : max,
      filterTo: min <= max ? max : min,
    };
  }

  if (numericFilterColumns.has(colId)) {
    const value = parseNumericInput(configFilter.value);
    if (value == null) {
      return null;
    }

    return {
      filterType: 'number',
      type: operator,
      filter: value,
    };
  }

  const value = parseTextInput(configFilter.value);
  if (!value) {
    return null;
  }

  return {
    filterType: 'text',
    type: operator,
    filter: value,
  };
}

function convertConfigFiltersToAgGridFilters(filters) {
  const agFilters = {};

  Object.entries(filters || {}).forEach(([colId, configFilter]) => {
    const agFilter = convertConfigFilterToAgGridFilter(colId, configFilter);
    if (agFilter) {
      agFilters[colId] = agFilter;
    }
  });

  return agFilters;
}

function convertAgGridFiltersToConfigFilters(filterModel) {
  const configFilters = {};

  Object.entries(filterModel || {}).forEach(([colId, agModel]) => {
    if (!knownColumns.has(colId)) {
      return;
    }

    const configFilter = convertAgGridFilterToConfigFilter(colId, agModel);
    if (configFilter) {
      configFilters[colId] = configFilter;
    }
  });

  return configFilters;
}

function splitFieldTokens(fieldName) {
  if (typeof fieldName !== 'string') {
    return [];
  }

  return fieldName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function isIdLikeColumn(colId) {
  const normalized = String(colId || '').trim();
  const lower = normalized.toLowerCase();
  const tokens = splitFieldTokens(normalized);

  if (tokens.some((token) => totalIdTokens.has(token))) {
    return true;
  }

  if (lower === 'id' || lower.endsWith('id')) {
    return true;
  }

  if (lower.includes('_id') || lower.includes('-id') || lower.includes('identifier')) {
    return true;
  }

  return false;
}

function isMetricLikeColumn(colId) {
  const tokens = splitFieldTokens(colId);
  return tokens.some((token) => totalMetricTokens.has(token));
}

function columnHasNumericValues(rows, colId) {
  if (!Array.isArray(rows)) {
    return false;
  }

  let foundNumeric = false;

  for (const row of rows) {
    if (!isPlainObject(row)) {
      continue;
    }

    const parsedValue = parseNumericInput(row[colId]);
    if (parsedValue != null) {
      foundNumeric = true;
      break;
    }
  }

  return foundNumeric;
}

function deriveAutoTotalColumns(dataset) {
  const rows = Array.isArray(dataset?.rowData) ? dataset.rowData : [];

  return baseColumnIds.filter((colId) => {
    if (isIdLikeColumn(colId)) {
      return false;
    }

    if (!columnHasNumericValues(rows, colId)) {
      return false;
    }

    return isMetricLikeColumn(colId) || numericFilterColumns.has(colId);
  });
}

function resolveTotalsLabelColumnId(gridApi, totalColumnIds) {
  const excluded = new Set(totalColumnIds);
  const displayedColumns =
    typeof gridApi.getAllDisplayedColumns === 'function'
      ? gridApi.getAllDisplayedColumns()
      : [];

  const displayedColumnIds = displayedColumns
    .map((column) =>
      column && typeof column.getColId === 'function' ? column.getColId() : null,
    )
    .filter((colId) => typeof colId === 'string' && knownColumns.has(colId));

  const preferredDisplayed = displayedColumnIds.find(
    (colId) => !excluded.has(colId) && !isIdLikeColumn(colId),
  );
  if (preferredDisplayed) {
    return preferredDisplayed;
  }

  const preferredBase = baseColumnIds.find(
    (colId) => !excluded.has(colId) && !isIdLikeColumn(colId),
  );
  if (preferredBase) {
    return preferredBase;
  }

  return baseColumnIds[0] || null;
}

function buildTotalsPinnedRow(gridApi, totalColumnIds, labelColumnId) {
  if (!Array.isArray(totalColumnIds) || totalColumnIds.length === 0) {
    return null;
  }

  const totals = {};
  totalColumnIds.forEach((colId) => {
    totals[colId] = 0;
  });

  if (typeof gridApi.forEachNodeAfterFilter !== 'function') {
    return null;
  }

  gridApi.forEachNodeAfterFilter((node) => {
    if (!node || node.group || !isPlainObject(node.data)) {
      return;
    }

    totalColumnIds.forEach((colId) => {
      const parsedValue = parseNumericInput(node.data[colId]);
      if (parsedValue != null) {
        totals[colId] += parsedValue;
      }
    });
  });

  const totalRow = {};

  if (labelColumnId && knownColumns.has(labelColumnId)) {
    totalRow[labelColumnId] = TOTALS_LABEL;
  }

  totalColumnIds.forEach((colId) => {
    totalRow[colId] = totals[colId];
  });

  return totalRow;
}

function refreshPinnedBottomTotals(gridApi) {
  if (!gridApi || typeof gridApi.setGridOption !== 'function') {
    return;
  }

  if (!Array.isArray(autoTotalColumnIds) || autoTotalColumnIds.length === 0) {
    gridApi.setGridOption('pinnedBottomRowData', []);
    return;
  }

  const labelColumnId = resolveTotalsLabelColumnId(gridApi, autoTotalColumnIds);
  const totalsRow = buildTotalsPinnedRow(gridApi, autoTotalColumnIds, labelColumnId);

  if (!totalsRow) {
    gridApi.setGridOption('pinnedBottomRowData', []);
    return;
  }

  gridApi.setGridOption('pinnedBottomRowData', [totalsRow]);
}

function normalizeConfig(rawConfig, fallbackDatasetId = currentDatasetId) {
  const warnings = [];
  const sanitized = getDefaultConfig(fallbackDatasetId);

  if (!isPlainObject(rawConfig)) {
    warnings.push('Config must be a JSON object; using defaults.');
    return { config: sanitized, warnings };
  }

  if (typeof rawConfig.version === 'number') {
    sanitized.version = rawConfig.version;
  }

  if (sanitized.version !== CONFIG_VERSION) {
    warnings.push(`version must be ${CONFIG_VERSION}; using version ${CONFIG_VERSION}.`);
    sanitized.version = CONFIG_VERSION;
  }

  if (typeof rawConfig.datasetId === 'string') {
    if (datasetIdSet.has(rawConfig.datasetId)) {
      sanitized.datasetId = rawConfig.datasetId;
    } else {
      warnings.push(`datasetId "${rawConfig.datasetId}" is unknown.`);
    }
  }

  if (isPlainObject(rawConfig.columns)) {
    const { columns } = rawConfig;

    if (columns.order !== undefined) {
      sanitized.columns.order = sanitizeColumnList(
        columns.order,
        'columns.order',
        warnings,
      );
    }

    if (columns.hidden !== undefined) {
      sanitized.columns.hidden = sanitizeColumnList(
        columns.hidden,
        'columns.hidden',
        warnings,
      );
    }

    if (isPlainObject(columns.pinned)) {
      Object.entries(columns.pinned).forEach(([colId, pin]) => {
        if (!knownColumns.has(colId)) {
          warnings.push(`columns.pinned contains unknown column "${colId}".`);
          return;
        }

        if (pin === 'left' || pin === 'right' || pin === null) {
          sanitized.columns.pinned[colId] = pin;
        } else {
          warnings.push(
            `columns.pinned.${colId} must be "left", "right", or null.`,
          );
        }
      });
    }

    if (isPlainObject(columns.widths)) {
      Object.entries(columns.widths).forEach(([colId, width]) => {
        if (!knownColumns.has(colId)) {
          warnings.push(`columns.widths contains unknown column "${colId}".`);
          return;
        }

        if (typeof width !== 'number' || !Number.isFinite(width) || width < 40) {
          warnings.push(
            `columns.widths.${colId} must be a number >= 40 (pixels).`,
          );
          return;
        }

        sanitized.columns.widths[colId] = Math.round(width);
      });
    }
  }

  if (rawConfig.sort !== undefined) {
    if (!Array.isArray(rawConfig.sort)) {
      warnings.push('sort must be an array.');
    } else {
      sanitized.sort = [];

      rawConfig.sort.forEach((sortItem, index) => {
        if (!isPlainObject(sortItem)) {
          warnings.push(`sort[${index}] must be an object.`);
          return;
        }

        const field = String(sortItem.field || sortItem.colId || '').trim();
        const direction = sortItem.direction || sortItem.sort;

        if (!knownColumns.has(field)) {
          warnings.push(`sort[${index}] has unknown field "${field}".`);
          return;
        }

        if (direction !== 'asc' && direction !== 'desc') {
          warnings.push(`sort[${index}].direction must be "asc" or "desc".`);
          return;
        }

        sanitized.sort.push({ field, direction });
      });
    }
  }

  if (rawConfig.filters !== undefined) {
    if (!isPlainObject(rawConfig.filters)) {
      warnings.push('filters must be an object keyed by column id.');
    } else {
      sanitized.filters = {};

      Object.entries(rawConfig.filters).forEach(([colId, model]) => {
        if (!knownColumns.has(colId)) {
          warnings.push(`filters contains unknown column "${colId}".`);
          return;
        }

        const normalizedModel = normalizeConfigFilter(colId, model, warnings);
        if (normalizedModel) {
          sanitized.filters[colId] = normalizedModel;
        }
      });
    }
  }

  if (rawConfig.groupBy !== undefined) {
    sanitized.groupBy = sanitizeColumnList(rawConfig.groupBy, 'groupBy', warnings);
  }

  if (rawConfig.aggregations !== undefined) {
    if (!isPlainObject(rawConfig.aggregations)) {
      warnings.push('aggregations must be an object keyed by column id.');
    } else {
      sanitized.aggregations = {};

      Object.entries(rawConfig.aggregations).forEach(([colId, aggFunc]) => {
        if (!numericAggregationColumns.has(colId)) {
          warnings.push(`aggregations contains unsupported numeric field "${colId}".`);
          return;
        }

        if (
          typeof aggFunc !== 'string' ||
          !supportedAggregationFunctions.has(aggFunc.trim())
        ) {
          warnings.push(
            `aggregations.${colId} must be one of ${[...supportedAggregationFunctions].join(', ')}.`,
          );
          return;
        }

        sanitized.aggregations[colId] = aggFunc.trim();
      });
    }
  }

  if (rawConfig.subtotals !== undefined) {
    if (!isPlainObject(rawConfig.subtotals)) {
      warnings.push('subtotals must be an object.');
    } else {
      const enabled = rawConfig.subtotals.enabled;
      const position = rawConfig.subtotals.position;

      if (typeof enabled === 'boolean') {
        sanitized.subtotals.enabled = enabled;
      } else if (enabled !== undefined) {
        warnings.push('subtotals.enabled must be a boolean.');
      }

      if (position === 'top' || position === 'bottom') {
        sanitized.subtotals.position = position;
      } else if (position !== undefined) {
        warnings.push('subtotals.position must be "top" or "bottom".');
      }
    }
  }

  return { config: sanitized, warnings };
}

function validateConfig(config, dataset = getDatasetById(config?.datasetId)) {
  const { warnings } = normalizeConfig(config, dataset?.id || currentDatasetId);
  return {
    valid: warnings.length === 0,
    errors: warnings,
  };
}

const sanitizeTableConfig = normalizeConfig;

function getSortEntries(columnState) {
  return columnState
    .filter(
      (entry) =>
        knownColumns.has(entry.colId) &&
        (entry.sort === 'asc' || entry.sort === 'desc'),
    )
    .sort((a, b) => {
      const left = Number.isInteger(a.sortIndex)
        ? a.sortIndex
        : Number.MAX_SAFE_INTEGER;
      const right = Number.isInteger(b.sortIndex)
        ? b.sortIndex
        : Number.MAX_SAFE_INTEGER;
      return left - right;
    })
    .map((entry) => ({
      field: entry.colId,
      direction: entry.sort,
    }));
}

function getGroupByEntries(columnState) {
  return columnState
    .filter((entry) => knownColumns.has(entry.colId) && entry.rowGroup)
    .sort((a, b) => {
      const left = Number.isInteger(a.rowGroupIndex)
        ? a.rowGroupIndex
        : Number.MAX_SAFE_INTEGER;
      const right = Number.isInteger(b.rowGroupIndex)
        ? b.rowGroupIndex
        : Number.MAX_SAFE_INTEGER;
      return left - right;
    })
    .map((entry) => entry.colId);
}

function exportTableConfig(gridApi, datasetId) {
  const columnState = gridApi.getColumnState();

  const order = columnState
    .map((entry) => entry.colId)
    .filter((colId) => knownColumns.has(colId));

  const hidden = columnState
    .filter((entry) => knownColumns.has(entry.colId) && entry.hide)
    .map((entry) => entry.colId);

  const pinned = {};
  const widths = {};
  const aggregations = {};

  columnState.forEach((entry) => {
    if (!knownColumns.has(entry.colId)) {
      return;
    }

    if (entry.pinned === 'left' || entry.pinned === 'right') {
      pinned[entry.colId] = entry.pinned;
    }

    if (typeof entry.width === 'number' && Number.isFinite(entry.width)) {
      widths[entry.colId] = Math.round(entry.width);
    }

    if (typeof entry.aggFunc === 'string' && entry.aggFunc.trim()) {
      aggregations[entry.colId] = entry.aggFunc;
    }
  });

  const groupTotalRow = typeof gridApi.getGridOption === 'function'
    ? gridApi.getGridOption('groupTotalRow')
    : undefined;

  return {
    version: CONFIG_VERSION,
    datasetId,
    columns: {
      order,
      hidden,
      pinned,
      widths,
    },
    sort: getSortEntries(columnState),
    filters: convertAgGridFiltersToConfigFilters(gridApi.getFilterModel() || {}),
    groupBy: getGroupByEntries(columnState),
    aggregations,
    subtotals: {
      enabled: groupTotalRow === 'top' || groupTotalRow === 'bottom',
      position: groupTotalRow === 'top' ? 'top' : 'bottom',
    },
  };
}

function writeConfigEditor(config) {
  if (!dom.configInput) {
    return;
  }

  dom.configInput.value = JSON.stringify(config, null, 2);
}

function readNamedViewsFromStorage() {
  const raw = localStorage.getItem(VIEW_LIBRARY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const rawViews = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.views)
        ? parsed.views
        : null;

    if (!rawViews) {
      return [];
    }

    return rawViews
      .filter((view) => isPlainObject(view))
      .map((view) => {
        const id =
          typeof view.id === 'string' && view.id.trim()
            ? view.id
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const name =
          typeof view.name === 'string' && view.name.trim()
            ? view.name.trim()
            : 'Untitled View';
        const config = isPlainObject(view.config) ? view.config : {};
        const createdAt =
          typeof view.createdAt === 'string' ? view.createdAt : new Date().toISOString();
        const updatedAt =
          typeof view.updatedAt === 'string' ? view.updatedAt : new Date().toISOString();

        return { id, name, config, createdAt, updatedAt };
      });
  } catch (_error) {
    return [];
  }
}

function persistNamedViewsToStorage(namedViews) {
  localStorage.setItem(
    VIEW_LIBRARY_STORAGE_KEY,
    JSON.stringify({ views: namedViews }),
  );
}

function sortViewsByName(namedViews) {
  namedViews.sort((left, right) => left.name.localeCompare(right.name));
}

let currentDatasetId = datasets[0].id;
let namedViews = readNamedViewsFromStorage();
sortViewsByName(namedViews);
let jsonSyncTimer = null;
let suppressJsonSync = false;
let gridApiRef = null;
let isAiGenerating = false;
let autoTotalColumnIds = deriveAutoTotalColumns(getDatasetById(currentDatasetId));

function withJsonSyncPaused(work) {
  suppressJsonSync = true;
  try {
    return work();
  } finally {
    suppressJsonSync = false;
  }
}

function scheduleJsonSync() {
  if (!gridApiRef || suppressJsonSync) {
    return;
  }

  if (jsonSyncTimer) {
    clearTimeout(jsonSyncTimer);
  }

  jsonSyncTimer = setTimeout(() => {
    if (!gridApiRef || suppressJsonSync) {
      return;
    }

    writeConfigEditor(exportTableConfig(gridApiRef, currentDatasetId));
  }, 120);
}

function populateDatasetSelector() {
  if (!dom.datasetSelect) {
    return;
  }

  dom.datasetSelect.innerHTML = '';

  datasets.forEach((dataset) => {
    const option = document.createElement('option');
    option.value = dataset.id;
    option.textContent = dataset.label;
    dom.datasetSelect.appendChild(option);
  });

  dom.datasetSelect.value = currentDatasetId;
}

function renderNamedViewSelector(selectedId = null) {
  if (!dom.savedViewSelect) {
    return;
  }

  const previousValue = selectedId || dom.savedViewSelect.value;
  dom.savedViewSelect.innerHTML = '';

  if (namedViews.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No saved views yet';
    dom.savedViewSelect.appendChild(option);
    dom.savedViewSelect.value = '';
    return;
  }

  namedViews.forEach((view) => {
    const option = document.createElement('option');
    option.value = view.id;
    const dataset = getDatasetById(view.config.datasetId);
    option.textContent = `${view.name} (${dataset.label})`;
    dom.savedViewSelect.appendChild(option);
  });

  const canKeepPrevious = namedViews.some((view) => view.id === previousValue);
  dom.savedViewSelect.value = canKeepPrevious ? previousValue : namedViews[0].id;
}

function switchDataset(gridApi, datasetId, options = {}) {
  const dataset = getDatasetById(datasetId);
  setActiveDatasetSchema(dataset.id);
  currentDatasetId = dataset.id;
  autoTotalColumnIds = deriveAutoTotalColumns(dataset);

  if (dom.datasetSelect) {
    dom.datasetSelect.value = currentDatasetId;
  }

  withJsonSyncPaused(() => {
    if (typeof gridApi.setGridOption === 'function') {
      gridApi.setGridOption('columnDefs', columnDefs);
    }
    gridApi.setGridOption('rowData', deepClone(dataset.rowData));
  });

  refreshPinnedBottomTotals(gridApi);

  if (options.syncJson !== false) {
    scheduleJsonSync();
  }

  if (options.statusMessage) {
    setStatus(options.statusMessage, options.tone || 'info');
  }
}

function applyTableConfig(gridApi, rawConfig, options = {}) {
  const targetDatasetId =
    isPlainObject(rawConfig) && datasetIdSet.has(rawConfig.datasetId)
      ? rawConfig.datasetId
      : currentDatasetId;
  setActiveDatasetSchema(targetDatasetId);
  const { config, warnings } = sanitizeTableConfig(rawConfig, currentDatasetId);

  const shouldSwitchDataset = options.allowDatasetSwitch !== false;
  if (shouldSwitchDataset && config.datasetId !== currentDatasetId) {
    switchDataset(gridApi, config.datasetId, { syncJson: false });
  }

  const ordered = config.columns.order.length
    ? config.columns.order
    : [...baseColumnIds];

  const orderedSet = new Set(ordered);
  const allOrderedColIds = [
    ...ordered,
    ...baseColumnIds.filter((colId) => !orderedSet.has(colId)),
  ];

  const hiddenSet = new Set(config.columns.hidden);
  const sortMap = new Map(
    config.sort.map((sortItem, sortIndex) => [
      sortItem.field,
      { sort: sortItem.direction, sortIndex },
    ]),
  );
  const groupMap = new Map(
    config.groupBy.map((colId, rowGroupIndex) => [colId, rowGroupIndex]),
  );
  const aggMap = new Map(Object.entries(config.aggregations));

  const columnState = allOrderedColIds.map((colId) => {
    const stateItem = {
      colId,
      hide: hiddenSet.has(colId),
      sort: null,
      sortIndex: null,
      rowGroup: false,
      rowGroupIndex: null,
      aggFunc: null,
      pinned: null,
    };

    const sortItem = sortMap.get(colId);
    if (sortItem) {
      stateItem.sort = sortItem.sort;
      stateItem.sortIndex = sortItem.sortIndex;
    }

    if (groupMap.has(colId)) {
      stateItem.rowGroup = true;
      stateItem.rowGroupIndex = groupMap.get(colId);
    }

    if (aggMap.has(colId)) {
      stateItem.aggFunc = aggMap.get(colId);
    }

    if (Object.prototype.hasOwnProperty.call(config.columns.pinned, colId)) {
      stateItem.pinned = config.columns.pinned[colId];
    }

    if (Object.prototype.hasOwnProperty.call(config.columns.widths, colId)) {
      stateItem.width = config.columns.widths[colId];
    }

    return stateItem;
  });

  withJsonSyncPaused(() => {
    gridApi.applyColumnState({
      state: columnState,
      applyOrder: true,
    });

    gridApi.setFilterModel(null);
    gridApi.setFilterModel(convertConfigFiltersToAgGridFilters(config.filters));

    if (typeof gridApi.setGridOption === 'function') {
      const subtotalMode = config.subtotals.enabled
        ? config.subtotals.position
        : undefined;
      gridApi.setGridOption('groupTotalRow', subtotalMode);
    }
  });

  refreshPinnedBottomTotals(gridApi);
  renderConfigSummary(config);

  if (options.syncJson !== false) {
    scheduleJsonSync();
  }

  return { config, warnings };
}

function applyConfigToGrid(config) {
  if (!gridApiRef) {
    throw new Error('Grid is not initialized.');
  }

  return applyTableConfig(gridApiRef, config, {
    allowDatasetSwitch: true,
    syncJson: true,
  });
}

function extractConfigFromGrid() {
  if (!gridApiRef) {
    return getDefaultConfig(currentDatasetId);
  }

  return exportTableConfig(gridApiRef, currentDatasetId);
}

function mergeConfigPatch(currentConfig, patch) {
  const current = normalizeConfig(currentConfig, currentDatasetId).config;
  if (!isPlainObject(patch)) {
    return current;
  }

  const merged = deepClone(current);

  if (typeof patch.version === 'number') {
    merged.version = patch.version;
  }

  if (typeof patch.datasetId === 'string') {
    merged.datasetId = patch.datasetId;
  }

  if (isPlainObject(patch.columns)) {
    merged.columns = {
      ...merged.columns,
      ...deepClone(patch.columns),
    };
  }

  if (Array.isArray(patch.sort)) {
    merged.sort = deepClone(patch.sort);
  }

  if (isPlainObject(patch.filters)) {
    merged.filters = {
      ...merged.filters,
      ...deepClone(patch.filters),
    };
  }

  if (Array.isArray(patch.groupBy)) {
    merged.groupBy = deepClone(patch.groupBy);
  }

  if (isPlainObject(patch.aggregations)) {
    merged.aggregations = {
      ...merged.aggregations,
      ...deepClone(patch.aggregations),
    };
  }

  if (isPlainObject(patch.subtotals)) {
    merged.subtotals = {
      ...merged.subtotals,
      ...deepClone(patch.subtotals),
    };
  }

  return normalizeConfig(merged, current.datasetId).config;
}

function upsertNamedView(viewName, config) {
  const now = new Date().toISOString();
  const existingIndex = namedViews.findIndex(
    (view) => view.name.toLowerCase() === viewName.toLowerCase(),
  );

  const nextView = {
    id:
      existingIndex >= 0
        ? namedViews[existingIndex].id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: viewName,
    config,
    createdAt:
      existingIndex >= 0
        ? namedViews[existingIndex].createdAt || now
        : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    namedViews.splice(existingIndex, 1, nextView);
  } else {
    namedViews.push(nextView);
  }

  sortViewsByName(namedViews);
  persistNamedViewsToStorage(namedViews);
  renderNamedViewSelector(nextView.id);
  return nextView;
}

function getSelectedView() {
  if (!dom.savedViewSelect) {
    return null;
  }

  const selectedId = dom.savedViewSelect.value;
  return namedViews.find((view) => view.id === selectedId) || null;
}

function setAiBusyState(isBusy) {
  isAiGenerating = isBusy;

  if (dom.chatSend) {
    dom.chatSend.disabled = isBusy;
    dom.chatSend.textContent = isBusy ? 'Thinking...' : 'Send';
  }
}

function getDatasetSummary() {
  return datasets.map((dataset) => ({
    id: dataset.id,
    label: dataset.label,
    rowCount: dataset.totalRowCount || dataset.rowData.length,
    serverBacked: Boolean(dataset.serverBacked),
    sampleRows: dataset.rowData.slice(0, 3),
  }));
}

function getDatasetSchema(dataset) {
  const previewRow = dataset.rowData[0] || {};
  const fields = getColumnIds(dataset.columnDefs || columnDefs);
  const numericFields = getNumericColumnSet(dataset.columnDefs || columnDefs);
  return fields.map((field) => ({
    field,
    type: numericFields.has(field) ? 'number' : typeof previewRow[field],
    numeric: numericFields.has(field),
  }));
}

function setAnalysisOutput(title, lines = []) {
  const normalizedLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (!title && normalizedLines.length === 0) {
    return;
  }

  pushChatMessage({
    role: 'assistant',
    kind: 'note',
    title: title || 'Assistant',
    lines: normalizedLines,
  });
}

function appendAnalysisSection(parent, title, items) {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (normalizedItems.length === 0) {
    return;
  }

  const section = document.createElement('section');
  section.className = 'analysisSection';

  const heading = document.createElement('h3');
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement('ul');
  normalizedItems.forEach((item) => {
    const listItem = document.createElement('li');
    listItem.textContent = String(item);
    list.appendChild(listItem);
  });
  section.appendChild(list);
  parent.appendChild(section);
}

function hasSuggestedConfigPatch(response) {
  return (
    isPlainObject(response?.suggestedConfigPatch) &&
    Object.keys(response.suggestedConfigPatch).length > 0
  );
}

function renderAnalysisAnswer(response, currentConfig, options = {}) {
  pushChatMessage({
    role: 'assistant',
    kind: 'analysis_answer',
    title: options.title || 'Ask Analyst',
    response,
    text: response.answer || 'Analysis complete.',
  });
}

function renderClarification(response) {
  pushChatMessage({
    role: 'assistant',
    kind: 'clarification',
    title: 'Clarification Needed',
    response,
    text: response.question || 'Please clarify whether you want analysis or a table change.',
  });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function rowMatchesConfigFilter(row, field, filter) {
  if (!isPlainObject(filter)) {
    return true;
  }

  const rowValue = row[field];
  const operator = filter.operator;

  if (operator === 'blank') {
    return rowValue == null || String(rowValue).trim() === '';
  }

  if (operator === 'notBlank') {
    return rowValue != null && String(rowValue).trim() !== '';
  }

  if (numericFilterColumns.has(field)) {
    const numericRowValue = parseNumericInput(rowValue);
    const numericFilterValue = parseNumericInput(filter.value);
    if (numericRowValue == null) {
      return false;
    }

    if (operator === 'between') {
      const [rawMin, rawMax] = Array.isArray(filter.value) ? filter.value : [];
      const min = parseNumericInput(rawMin);
      const max = parseNumericInput(rawMax);
      return min != null && max != null && numericRowValue >= min && numericRowValue <= max;
    }

    if (numericFilterValue == null) {
      return false;
    }

    if (operator === 'equals') return numericRowValue === numericFilterValue;
    if (operator === 'notEqual') return numericRowValue !== numericFilterValue;
    if (operator === 'greaterThan') return numericRowValue > numericFilterValue;
    if (operator === 'greaterThanOrEqual') return numericRowValue >= numericFilterValue;
    if (operator === 'lessThan') return numericRowValue < numericFilterValue;
    if (operator === 'lessThanOrEqual') return numericRowValue <= numericFilterValue;
    return true;
  }

  const textValue = String(rowValue ?? '').toLowerCase();
  const filterValue = String(filter.value ?? '').toLowerCase();

  if (operator === 'oneOf') {
    return normalizeValueArrayAsText(filter.value)
      .map((value) => value.toLowerCase())
      .includes(textValue);
  }

  if (operator === 'equals') return textValue === filterValue;
  if (operator === 'notEqual') return textValue !== filterValue;
  if (operator === 'contains') return textValue.includes(filterValue);
  if (operator === 'notContains') return !textValue.includes(filterValue);
  if (operator === 'startsWith') return textValue.startsWith(filterValue);
  if (operator === 'endsWith') return textValue.endsWith(filterValue);
  return true;
}

function getRowsForConfig(config) {
  const dataset = getDatasetById(config.datasetId);
  return dataset.rowData.filter((row) =>
    Object.entries(config.filters || {}).every(([field, filter]) =>
      rowMatchesConfigFilter(row, field, filter),
    ),
  );
}

function groupRows(rows, fields) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = fields.map((field) => String(row[field] ?? '')).join(' / ');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  });

  return groups;
}

function summarizeRows(rows, aggregationField = 'amount', aggregation = 'sum') {
  const values = rows
    .map((row) => parseNumericInput(row[aggregationField]))
    .filter((value) => value != null);

  if (aggregation === 'count') {
    return rows.length;
  }

  if (values.length === 0) {
    return 0;
  }

  if (aggregation === 'avg') {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  if (aggregation === 'min') {
    return Math.min(...values);
  }

  if (aggregation === 'max') {
    return Math.max(...values);
  }

  return values.reduce((sum, value) => sum + value, 0);
}

function incrementCount(map, key) {
  const normalizedKey = String(key ?? '(blank)');
  map[normalizedKey] = (map[normalizedKey] || 0) + 1;
}

function incrementAmount(map, key, amount) {
  const normalizedKey = String(key ?? '(blank)');
  map[normalizedKey] = (map[normalizedKey] || 0) + (parseNumericInput(amount) || 0);
}

function getCompactRow(row) {
  return {
    paymentId: row.paymentId,
    customer: row.customer,
    carrier: row.carrier,
    amount: row.amount,
    status: row.status,
    paymentMethod: row.paymentMethod,
    invoiceDate: row.invoiceDate,
    region: row.region,
  };
}

function calculateDatasetStats(dataset) {
  const rows = Array.isArray(dataset?.rowData) ? dataset.rowData : [];
  const stats = {
    rowCount: rows.length,
    totalAmount: summarizeRows(rows, 'amount', 'sum'),
    countByStatus: {},
    amountByStatus: {},
    countByCarrier: {},
    amountByCarrier: {},
    failedPaymentTotalsByCarrier: {},
    countByPaymentMethod: {},
    amountByPaymentMethod: {},
    top3HighestAmountRecords: [],
    failedRecords: [],
    pendingRecords: [],
  };

  rows.forEach((row) => {
    incrementCount(stats.countByStatus, row.status);
    incrementAmount(stats.amountByStatus, row.status, row.amount);
    incrementCount(stats.countByCarrier, row.carrier);
    incrementAmount(stats.amountByCarrier, row.carrier, row.amount);
    incrementCount(stats.countByPaymentMethod, row.paymentMethod);
    incrementAmount(stats.amountByPaymentMethod, row.paymentMethod, row.amount);

    if (row.status === 'Failed') {
      incrementAmount(stats.failedPaymentTotalsByCarrier, row.carrier, row.amount);
      stats.failedRecords.push(getCompactRow(row));
    }

    if (row.status === 'Pending') {
      stats.pendingRecords.push(getCompactRow(row));
    }
  });

  stats.top3HighestAmountRecords = [...rows]
    .sort((left, right) => (parseNumericInput(right.amount) || 0) - (parseNumericInput(left.amount) || 0))
    .slice(0, 3)
    .map(getCompactRow);

  return stats;
}

function sortObjectEntriesByValue(source) {
  return Object.entries(source || {}).sort((left, right) => right[1] - left[1]);
}

function getTopEntry(source) {
  return sortObjectEntriesByValue(source)[0] || null;
}

function getDatasetForAnalysis(prompt, currentConfig) {
  return getDatasetById(inferDatasetPatchFromPrompt(prompt) || currentConfig.datasetId);
}

function renderConfigSummary(config) {
  if (!config.groupBy.length && !config.subtotals.enabled) {
    return;
  }

  const rows = getRowsForConfig(config);
  if (config.groupBy.length === 0) {
    setAnalysisOutput('Summary', [
      `${rows.length} rows`,
      `Total amount: ${formatCurrency(summarizeRows(rows, 'amount', 'sum'))}`,
    ]);
    return;
  }

  const aggregationField = Object.keys(config.aggregations)[0] || 'amount';
  const aggregation = config.aggregations[aggregationField] || 'sum';
  const grouped = [...groupRows(rows, config.groupBy).entries()]
    .map(([label, groupRowsForLabel]) => ({
      label,
      count: groupRowsForLabel.length,
      value: summarizeRows(groupRowsForLabel, aggregationField, aggregation),
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);

  setAnalysisOutput(
    `Grouped by ${config.groupBy.join(', ')}`,
    grouped.map((group) =>
      `${group.label || '(blank)'}: ${formatCurrency(group.value)} across ${group.count} rows`,
    ),
  );
}

function inferDatasetPatchFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes('exception')) {
    return 'exceptions';
  }
  if (
    lower.includes('rebill') ||
    lower.includes('adjustment') ||
    lower.includes('adjustments')
  ) {
    return 'adjustments';
  }
  if (lower.includes('payments baseline')) {
    return 'payments';
  }
  if (
    lower.includes('candy') ||
    lower.includes('candies') ||
    lower.includes('chocolate') ||
    lower.includes('gummy') ||
    lower.includes('lollipop') ||
    lower.includes('sweet') ||
    lower.includes('confection')
  ) {
    return 'candy';
  }
  return null;
}

function detectPromptIntent(prompt) {
  const lower = prompt.toLowerCase().trim();
  const tablePatterns = [
    /\bshow\s+(only\s+)?(?:me\s+)?(?:records|rows|payments|items)\b/,
    /\bfilter\b/,
    /\bsort\b/,
    /\bgroup\s+by\b/,
    /\bopen\s+(?:the\s+)?(?:exceptions|rebills|adjustments|payments)\b/,
    /\bswitch\s+to\b/,
    /\bhide\s+(?:column|columns|field|fields|payment|policy|id)\b/,
    /\bmove\s+.+\bfront\b/,
    /\bonly\s+show\b/,
    /\bcreate\s+(?:a\s+)?(?:view|table|grid)\b/,
    /\bsave\s+(?:this|view|table)\b/,
    /\bload\s+(?:view|saved)\b/,
    /\bpin\s+(?:column|columns|field|fields)\b/,
    /\bresize\s+(?:column|columns|field|fields)\b/,
  ];

  if (tablePatterns.some((pattern) => pattern.test(lower))) {
    return 'table_config';
  }

  if (lower.length < 12 || lower.split(/\s+/).length <= 2) {
    return 'clarification';
  }

  return 'analysis_answer';
}

function buildClarificationResponse(prompt) {
  return {
    type: 'clarification',
    question: `Do you want me to analyze the data or change the table view for "${prompt}"?`,
    suggestions: [
      'Try an analysis prompt like "What stands out in this dataset?"',
      'Try a table prompt like "Show failed payments sorted by amount highest first."',
    ],
  };
}

function createBasicPromptPatch(prompt, currentConfig) {
  const lower = prompt.toLowerCase();
  const patch = {};
  const datasetId = inferDatasetPatchFromPrompt(prompt);
  if (datasetId) {
    patch.datasetId = datasetId;
  }

  const filters = {};
  if (lower.includes('failed') || lower.includes('bad') || lower.includes('suspicious')) {
    filters.status = { operator: 'equals', value: 'Failed' };
  }
  if (lower.includes('pending') || lower.includes('unresolved')) {
    filters.status = filters.status
      ? { operator: 'oneOf', value: ['Failed', 'Pending'] }
      : { operator: 'equals', value: 'Pending' };
  }
  if (lower.includes('failed and pending') || lower.includes('failed or pending')) {
    filters.status = { operator: 'oneOf', value: ['Failed', 'Pending'] };
  }
  if (lower.includes('ach')) {
    filters.paymentMethod = { operator: 'equals', value: 'ACH' };
  }
  if (lower.includes('credit card')) {
    filters.paymentMethod = { operator: 'equals', value: 'Credit Card' };
  }
  if (lower.includes('aetna') && lower.includes('cigna')) {
    filters.carrier = { operator: 'oneOf', value: ['Aetna', 'Cigna'] };
  } else if (lower.includes('aetna')) {
    filters.carrier = { operator: 'equals', value: 'Aetna' };
  } else if (lower.includes('cigna')) {
    filters.carrier = { operator: 'equals', value: 'Cigna' };
  }

  ['southeast', 'northeast', 'midwest', 'south', 'west', 'east'].forEach((region) => {
    if (lower.includes(region)) {
      const title = region[0].toUpperCase() + region.slice(1);
      filters.region = filters.region
        ? {
            operator: 'oneOf',
            value: [filters.region.value, title].flat(),
          }
        : { operator: 'equals', value: title };
    }
  });

  const moneyMatch = lower.match(/(?:over|greater than|above)\s*\$?([0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (moneyMatch) {
    filters.amount = {
      operator: 'greaterThan',
      value: parseNumericInput(moneyMatch[1]),
    };
  } else if (lower.includes('high-value') || lower.includes('big ') || lower.includes('important')) {
    filters.amount = {
      operator: 'greaterThanOrEqual',
      value: 1000,
    };
  }

  if (Object.keys(filters).length > 0) {
    patch.filters = filters;
  }

  if (lower.includes('show only') || lower.includes('only relevant columns')) {
    const visible = [];
    [
      ['customer', ['customer']],
      ['carrier', ['carrier']],
      ['amount', ['amount', 'total amount']],
      ['status', ['status']],
      ['invoiceDate', ['invoice date', 'invoice']],
      ['paymentMethod', ['payment method', 'method']],
      ['region', ['region']],
      ['paymentId', ['payment id']],
      ['policyNumber', ['policy number']],
    ].forEach(([field, aliases]) => {
      if (aliases.some((alias) => lower.includes(alias))) {
        visible.push(field);
      }
    });

    if (visible.length === 0) {
      visible.push('customer', 'carrier', 'amount', 'status', 'paymentMethod');
    }

    const visibleSet = new Set(visible);
    patch.columns = {
      order: [...visible, ...baseColumnIds.filter((field) => !visibleSet.has(field))],
      hidden: baseColumnIds.filter((field) => !visibleSet.has(field)),
    };
  }

  if (lower.includes('hide payment id') || lower.includes('hide policy number')) {
    const hidden = new Set(currentConfig.columns.hidden);
    if (lower.includes('payment id')) hidden.add('paymentId');
    if (lower.includes('policy number')) hidden.add('policyNumber');
    patch.columns = {
      ...(patch.columns || {}),
      hidden: [...hidden],
    };
  }

  if (lower.includes('move') && lower.includes('front')) {
    const front = [];
    if (lower.includes('status')) front.push('status');
    if (lower.includes('amount')) front.push('amount');
    if (lower.includes('customer')) front.push('customer');
    if (lower.includes('invoice date')) front.push('invoiceDate');

    if (front.length) {
      const frontSet = new Set(front);
      patch.columns = {
        ...(patch.columns || {}),
        order: [...front, ...baseColumnIds.filter((field) => !frontSet.has(field))],
      };
    }
  }

  const sort = [];
  if (lower.includes('sort first by status') || lower.includes('by status, then amount')) {
    sort.push({ field: 'status', direction: 'asc' });
  }
  if (
    lower.includes('amount highest') ||
    lower.includes('highest to lowest') ||
    lower.includes('largest') ||
    lower.includes('largest amounts') ||
    lower.includes('from highest to lowest')
  ) {
    sort.push({ field: 'amount', direction: 'desc' });
  }
  if (lower.includes('most recent') || lower.includes('invoice date')) {
    sort.push({ field: 'invoiceDate', direction: 'desc' });
  }
  if (sort.length > 0) {
    patch.sort = sort;
  }

  if (lower.includes('group by carrier') || lower.includes('by carrier')) {
    patch.groupBy = ['carrier'];
  }
  if (lower.includes('group by status')) {
    patch.groupBy = ['status'];
  }
  if (lower.includes('group by payment method')) {
    patch.groupBy = ['paymentMethod'];
  }
  if (lower.includes('group by region, then by carrier') || lower.includes('region and carrier')) {
    patch.groupBy = ['region', 'carrier'];
  } else if (lower.includes('group by region')) {
    patch.groupBy = ['region'];
  }

  if (lower.includes('total amount') || lower.includes('subtotal') || lower.includes('amount totals')) {
    patch.aggregations = { amount: 'sum' };
    patch.subtotals = { enabled: true, position: 'bottom' };
  }

  if (lower.includes('collections') || lower.includes('follow-up') || lower.includes('needs attention')) {
    patch.filters = {
      ...(patch.filters || {}),
      status: { operator: 'oneOf', value: ['Failed', 'Pending'] },
    };
    patch.columns = {
      order: [
        'customer',
        'carrier',
        'amount',
        'status',
        'paymentMethod',
        'invoiceDate',
        'region',
        'paymentId',
        'policyNumber',
      ],
      hidden: ['paymentId', 'policyNumber'],
    };
    patch.sort = [{ field: 'amount', direction: 'desc' }];
  }

  return patch;
}

function analyzePrompt(prompt, currentConfig) {
  const lower = prompt.toLowerCase();
  const dataset = getDatasetForAnalysis(prompt, currentConfig);
  const stats = calculateDatasetStats(dataset);
  const basePatch = { datasetId: dataset.id };
  const topFailedCarrier = getTopEntry(stats.failedPaymentTotalsByCarrier);
  const topPaymentMethod = getTopEntry(stats.amountByPaymentMethod);
  const highestFailedRecord = stats.failedRecords
    .slice()
    .sort((left, right) => (right.amount || 0) - (left.amount || 0))[0];
  const topRecords = stats.top3HighestAmountRecords;

  if (lower.includes('highest failed payment')) {
    return {
      type: 'analysis_answer',
      answer: highestFailedRecord
        ? `The highest failed payment is payment ${highestFailedRecord.paymentId} for ${highestFailedRecord.customer} at ${formatCurrency(highestFailedRecord.amount)}.`
        : 'There are no failed payments in this dataset.',
      insights: highestFailedRecord
        ? [
            `${highestFailedRecord.carrier} owns the largest failed individual exposure.`,
            `The record uses ${highestFailedRecord.paymentMethod} and is assigned to ${highestFailedRecord.region}.`,
          ]
        : ['No failed records were found.'],
      recommendedActions: highestFailedRecord
        ? [`Start follow-up with ${highestFailedRecord.customer} and validate the payment method details.`]
        : ['No failed-payment follow-up is needed from this dataset.'],
      supportingRows: highestFailedRecord ? [highestFailedRecord.paymentId] : [],
      suggestedConfigPatch: {
        ...basePatch,
        filters: { status: { operator: 'equals', value: 'Failed' } },
        sort: [{ field: 'amount', direction: 'desc' }],
      },
      metrics: { highestFailedAmount: highestFailedRecord?.amount || 0 },
    };
  }

  if (
    (lower.includes('carrier') && lower.includes('failed') && lower.includes('exposure')) ||
    (lower.includes('carrier') && lower.includes('highest') && lower.includes('failed')) ||
    lower.includes('biggest payment issue')
  ) {
    const carrier = topFailedCarrier?.[0];
    const totalAmount = topFailedCarrier?.[1] || 0;
    const supportingRows = stats.failedRecords
      .filter((row) => row.carrier === carrier)
      .map((row) => row.paymentId);

    return {
      type: 'analysis_answer',
      answer: carrier
        ? `${carrier} has the biggest failed payment exposure at ${formatCurrency(totalAmount)}.`
        : 'No failed payment exposure appears in this dataset.',
      insights: carrier
        ? [
            `${carrier} accounts for ${formatCurrency(totalAmount)} in failed payments.`,
            `${stats.failedRecords.length} failed records appear across ${Object.keys(stats.failedPaymentTotalsByCarrier).length} carriers.`,
          ]
        : ['No failed records were found.'],
      recommendedActions: carrier
        ? [`Prioritize failed ${carrier} records first, then work the remaining failed items by amount.`]
        : ['Keep monitoring, but no carrier-specific failed exposure is present.'],
      supportingRows,
      suggestedConfigPatch: {
        ...basePatch,
        filters: { status: { operator: 'equals', value: 'Failed' } },
        groupBy: ['carrier'],
        aggregations: { amount: 'sum' },
        subtotals: { enabled: true, position: 'bottom' },
        sort: [{ field: 'amount', direction: 'desc' }],
      },
      metrics: { carrier, totalAmount },
    };
  }

  if (lower.startsWith('how many') && lower.includes('failed')) {
    return {
      type: 'analysis_answer',
      answer: `${stats.failedRecords.length} failed payments are in ${dataset.label}.`,
      insights: [
        `Failed payments total ${formatCurrency(summarizeRows(stats.failedRecords, 'amount', 'sum'))}.`,
      ],
      recommendedActions: ['Review failed payments in descending amount order.'],
      supportingRows: stats.failedRecords.map((row) => row.paymentId),
      suggestedConfigPatch: {
        ...basePatch,
        filters: { status: { operator: 'equals', value: 'Failed' } },
        sort: [{ field: 'amount', direction: 'desc' }],
      },
      metrics: { rowCount: stats.failedRecords.length },
    };
  }

  if (lower.includes('total pending amount') || (lower.includes('total') && lower.includes('pending'))) {
    const totalAmount = summarizeRows(stats.pendingRecords, 'amount', 'sum');
    return {
      type: 'analysis_answer',
      answer: `The total pending amount is ${formatCurrency(totalAmount)} across ${stats.pendingRecords.length} records.`,
      insights: [
        `Pending exposure is ${formatCurrency(totalAmount)} out of ${formatCurrency(stats.totalAmount)} total dataset amount.`,
      ],
      recommendedActions: ['Sort pending records by amount and clear the largest open balances first.'],
      supportingRows: stats.pendingRecords.map((row) => row.paymentId),
      suggestedConfigPatch: {
        ...basePatch,
        filters: { status: { operator: 'equals', value: 'Pending' } },
        sort: [{ field: 'amount', direction: 'desc' }],
      },
      metrics: { rowCount: stats.pendingRecords.length, totalAmount },
    };
  }

  if (lower.includes('top 3') || lower.includes('highest payments') || lower.includes('high-value') || lower.includes('unusual')) {
    return {
      type: 'analysis_answer',
      answer: `The three highest-value records are ${topRecords.map((row) => `${row.paymentId} (${formatCurrency(row.amount)})`).join(', ')}.`,
      insights: [
        `The largest single record is ${topRecords[0]?.customer || 'n/a'} at ${formatCurrency(topRecords[0]?.amount || 0)}.`,
        `${topRecords.filter((row) => row.status !== 'Paid').length} of the top 3 are not paid.`,
      ],
      recommendedActions: ['Review the highest unpaid records first because they concentrate the most operational risk.'],
      supportingRows: topRecords.map((row) => row.paymentId),
      suggestedConfigPatch: {
        ...basePatch,
        sort: [{ field: 'amount', direction: 'desc' }],
      },
      metrics: { topAmount: topRecords[0]?.amount || 0 },
    };
  }

  if (lower.includes('prioritize') || lower.includes('focus on') || lower.includes('ops team')) {
    const priorityRows = [...stats.failedRecords, ...stats.pendingRecords]
      .sort((left, right) => (right.amount || 0) - (left.amount || 0))
      .slice(0, 4);

    return {
      type: 'analysis_answer',
      answer: `Prioritize ${priorityRows.map((row) => `${row.paymentId} (${row.customer})`).join(', ')} because they are failed or pending and carry the largest amounts.`,
      insights: [
        `${stats.failedRecords.length} failed and ${stats.pendingRecords.length} pending records need attention.`,
        `The largest priority item is ${priorityRows[0]?.customer || 'n/a'} at ${formatCurrency(priorityRows[0]?.amount || 0)}.`,
      ],
      recommendedActions: [
        'Start with failed payments, then pending payments above $1,000.',
        'Assign owner follow-up by carrier for faster routing.',
      ],
      supportingRows: priorityRows.map((row) => row.paymentId),
      suggestedConfigPatch: {
        ...basePatch,
        filters: { status: { operator: 'oneOf', value: ['Failed', 'Pending'] } },
        sort: [{ field: 'amount', direction: 'desc' }],
        columns: {
          order: ['customer', 'carrier', 'amount', 'status', 'paymentMethod', 'invoiceDate', 'region', 'paymentId', 'policyNumber'],
          hidden: ['policyNumber'],
        },
      },
      metrics: { priorityRowCount: priorityRows.length },
    };
  }

  if (lower.includes('payment method') && (lower.includes('risk') || lower.includes('riskiest'))) {
    const failedByMethod = {};
    stats.failedRecords.forEach((row) => {
      incrementAmount(failedByMethod, row.paymentMethod, row.amount);
    });
    const riskiest = getTopEntry(failedByMethod) || topPaymentMethod;

    return {
      type: 'analysis_answer',
      answer: riskiest
        ? `${riskiest[0]} looks riskiest, with ${formatCurrency(riskiest[1])} tied to failed payment exposure.`
        : 'No payment method stands out as risky from the failed-payment view.',
      insights: [
        `Failed exposure by method: ${sortObjectEntriesByValue(failedByMethod).map(([method, amount]) => `${method}: ${formatCurrency(amount)}`).join('; ') || 'none'}.`,
      ],
      recommendedActions: ['Review failed payments by method and validate whether retries or alternate collection paths are needed.'],
      supportingRows: stats.failedRecords
        .filter((row) => row.paymentMethod === riskiest?.[0])
        .map((row) => row.paymentId),
      suggestedConfigPatch: {
        ...basePatch,
        filters: { status: { operator: 'equals', value: 'Failed' } },
        groupBy: ['paymentMethod'],
        aggregations: { amount: 'sum' },
        subtotals: { enabled: true, position: 'bottom' },
      },
      metrics: { paymentMethod: riskiest?.[0], failedAmount: riskiest?.[1] || 0 },
    };
  }

  if (lower.includes('compare failed') && lower.includes('carrier')) {
    const comparison = sortObjectEntriesByValue(stats.failedPaymentTotalsByCarrier);
    return {
      type: 'analysis_answer',
      answer: comparison.length
        ? `Failed payment exposure by carrier is ${comparison.map(([carrier, amount]) => `${carrier}: ${formatCurrency(amount)}`).join('; ')}.`
        : 'There are no failed payments to compare by carrier.',
      insights: comparison.slice(0, 3).map(([carrier, amount]) => `${carrier} failed total: ${formatCurrency(amount)}.`),
      recommendedActions: ['Work carriers from highest failed exposure to lowest.'],
      supportingRows: stats.failedRecords.map((row) => row.paymentId),
      suggestedConfigPatch: {
        ...basePatch,
        filters: { status: { operator: 'equals', value: 'Failed' } },
        groupBy: ['carrier'],
        aggregations: { amount: 'sum' },
        subtotals: { enabled: true, position: 'bottom' },
      },
      metrics: { failedPaymentTotalsByCarrier: stats.failedPaymentTotalsByCarrier },
    };
  }

  if (
    lower.includes('what stands out') ||
    lower.includes('summarize') ||
    lower.includes('summary') ||
    lower.includes('business summary')
  ) {
    const statusSummary = sortObjectEntriesByValue(stats.amountByStatus)
      .map(([status, amount]) => `${status}: ${formatCurrency(amount)} across ${stats.countByStatus[status] || 0} records`)
      .join('; ');
    const carrier = topFailedCarrier?.[0];

    return {
      type: 'analysis_answer',
      answer: `${dataset.label} has ${stats.rowCount} records totaling ${formatCurrency(stats.totalAmount)}. The main operational signal is ${stats.failedRecords.length} failed payments and ${stats.pendingRecords.length} pending payments, with ${carrier || 'no carrier'} leading failed exposure${carrier ? ` at ${formatCurrency(topFailedCarrier[1])}` : ''}.`,
      insights: [
        `Status mix: ${statusSummary}.`,
        `Top amount record: ${topRecords[0]?.paymentId} for ${topRecords[0]?.customer} at ${formatCurrency(topRecords[0]?.amount || 0)}.`,
        topPaymentMethod ? `${topPaymentMethod[0]} carries the largest payment-method amount at ${formatCurrency(topPaymentMethod[1])}.` : null,
      ].filter(Boolean),
      recommendedActions: [
        'Review failed payments first, sorted by amount.',
        'Use carrier grouping to assign follow-up ownership.',
        'Check pending high-value records before they age into exceptions.',
      ],
      supportingRows: [...new Set([
        ...topRecords.map((row) => row.paymentId),
        ...stats.failedRecords.slice(0, 3).map((row) => row.paymentId),
      ])],
      suggestedConfigPatch: {
        ...basePatch,
        filters: { status: { operator: 'oneOf', value: ['Failed', 'Pending'] } },
        sort: [{ field: 'amount', direction: 'desc' }],
      },
      metrics: {
        rowCount: stats.rowCount,
        totalAmount: stats.totalAmount,
        failedCount: stats.failedRecords.length,
        pendingCount: stats.pendingRecords.length,
      },
    };
  }

  return null;
}

function buildFallbackResponse(prompt, currentConfig, intent = detectPromptIntent(prompt)) {
  if (intent === 'clarification') {
    return buildClarificationResponse(prompt);
  }

  if (intent === 'analysis_answer') {
    const analysisResponse = analyzePrompt(prompt, currentConfig);
    if (analysisResponse) {
      return analysisResponse;
    }

    const dataset = getDatasetForAnalysis(prompt, currentConfig);
    const stats = calculateDatasetStats(dataset);
    return {
      type: 'analysis_answer',
      answer: `${dataset.label} has ${stats.rowCount} records totaling ${formatCurrency(stats.totalAmount)}. Failed and pending records are the main follow-up pool.`,
      insights: [
        `${stats.failedRecords.length} failed records and ${stats.pendingRecords.length} pending records need review.`,
        `The largest record is ${stats.top3HighestAmountRecords[0]?.paymentId || 'n/a'} at ${formatCurrency(stats.top3HighestAmountRecords[0]?.amount || 0)}.`,
      ],
      recommendedActions: [
        'Sort by amount descending.',
        'Review failed and pending records before paid records.',
      ],
      supportingRows: stats.top3HighestAmountRecords.map((row) => row.paymentId),
      suggestedConfigPatch: {
        datasetId: dataset.id,
        filters: { status: { operator: 'oneOf', value: ['Failed', 'Pending'] } },
        sort: [{ field: 'amount', direction: 'desc' }],
      },
    };
  }

  return {
    type: 'table_config_patch',
    patch: createBasicPromptPatch(prompt, currentConfig),
    explanation: 'Generated locally from deterministic fallback parsing.',
  };
}

function resolveAiConfigResponse(responseJson, currentConfig) {
  if (isPlainObject(responseJson?.config)) {
    return {
      type: 'table_config',
      config: responseJson.config,
      explanation: responseJson.explanation,
      model: responseJson.model,
    };
  }

  if (responseJson?.type === 'table_config' && isPlainObject(responseJson.config)) {
    return responseJson;
  }

  if (
    responseJson?.type === 'table_config_patch' &&
    isPlainObject(responseJson.patch)
  ) {
    return {
      ...responseJson,
      config: mergeConfigPatch(currentConfig, responseJson.patch),
    };
  }

  if (responseJson?.type === 'analysis_answer') {
    return {
      ...responseJson,
      insights: Array.isArray(responseJson.insights) ? responseJson.insights : [],
      recommendedActions: Array.isArray(responseJson.recommendedActions)
        ? responseJson.recommendedActions
        : [],
      supportingRows: Array.isArray(responseJson.supportingRows)
        ? responseJson.supportingRows
        : [],
    };
  }

  if (responseJson?.type === 'clarification') {
    return responseJson;
  }

  if (isPlainObject(responseJson?.suggestedConfigPatch)) {
    return {
      type: 'analysis_answer',
      answer: responseJson.answer || 'Analysis complete.',
      insights: Array.isArray(responseJson.insights) ? responseJson.insights : [],
      recommendedActions: Array.isArray(responseJson.recommendedActions)
        ? responseJson.recommendedActions
        : [],
      supportingRows: Array.isArray(responseJson.supportingRows)
        ? responseJson.supportingRows
        : [],
      metrics: responseJson.metrics || {},
      suggestedConfigPatch: responseJson.suggestedConfigPatch,
    };
  }

  throw new Error('AI response did not contain a table config or analysis answer.');
}

function applyAiResponse(gridApi, rawResponse, currentConfig, sourceLabel = 'AI') {
  const resolved = resolveAiConfigResponse(rawResponse, currentConfig);

  if (resolved.type === 'analysis_answer') {
    if (hasSuggestedConfigPatch(resolved) && gridApi) {
      const snapshot = extractConfigFromGrid();
      const mergedConfig = mergeConfigPatch(snapshot, resolved.suggestedConfigPatch);
      const applyResult = applyTableConfig(gridApi, mergedConfig, {
        allowDatasetSwitch: true,
        syncJson: true,
      });
      writeConfigEditor(applyResult.config);
    }
    renderAnalysisAnswer(resolved, currentConfig, {
      title: sourceLabel === 'Fallback parser' ? 'Ask Analyst (Local)' : 'Ask Analyst',
    });
    return { config: extractConfigFromGrid(), warnings: [], type: 'analysis_answer' };
  }

  if (resolved.type === 'clarification') {
    renderClarification(resolved);
    return { config: currentConfig, warnings: [], type: 'clarification' };
  }

  const result = applyTableConfig(gridApi, resolved.config, {
    allowDatasetSwitch: true,
    syncJson: true,
  });
  writeConfigEditor(result.config);

  setAnalysisOutput(`${sourceLabel} Table Update`, [
    resolved.explanation || 'Applied the requested table view.',
  ]);

  return { ...result, type: resolved.type || 'table_config' };
}

async function runStreamingAnalysis(gridApi, prompt, selectedDataset) {
  ensureConversation();
  // Pin the active dataset immediately so follow-up questions default to it
  switchDataset(gridApi, selectedDataset.id, { syncJson: false });

  const thinkingMsg = pushChatMessage(
    { role: 'assistant', kind: 'thinking', text: 'Analyzing your question...' },
    { scrollToBottom: true },
  );

  const schema = getDatasetSchema(selectedDataset);
  const chatHistory = chatMessages
    .slice(-8)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      if (m.role === 'user') return { role: 'user', text: m.text || '' };
      if (m.kind === 'analysis_answer' && isPlainObject(m.response)) {
        return { role: 'assistant', text: m.response.answer || '' };
      }
      return null;
    })
    .filter(Boolean);

  // Capture current grid state for scope handling
  const currentViewRows = [];
  if (gridApiRef) {
    gridApiRef.forEachNodeAfterFilterAndSort(node => {
      if (node.data) currentViewRows.push(node.data);
    });
  }
  const totalRowCount = selectedDataset.totalRowCount ?? selectedDataset.rowData.length;

  const payload = {
    prompt,
    selectedDatasetId: selectedDataset.id,
    selectedDatasetLabel: selectedDataset.label,
    selectedDatasetSchema: schema,
    chatHistory,
    rows: selectedDataset.rowData,
    sampleRows: selectedDataset.rowData.slice(0, 15),
    currentViewRows: currentViewRows.slice(0, 2000),
    totalRowCount,
    currentViewRowCount: currentViewRows.length,
  };

  let receivedAnswer = false;
  let lastAnswerEvent = null;
  let lastStepEvent = null;

  try {
    const response = await fetch('/api/analyze-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    function processBuffer() {
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        let event;
        try { event = JSON.parse(part.slice(6)); } catch { continue; }
        if (event.type === 'status') {
          updateThinkingMessage(thinkingMsg.id, event.text);
          setChatStatus(event.text, 'info');
        } else if (event.type === 'step') {
          lastStepEvent = event;
          applyStepResultToGrid(gridApi, event);
        } else if (event.type === 'answer') {
          receivedAnswer = true;
          lastAnswerEvent = event;
          if (lastStepEvent) {
            viewSnapshots.set(thinkingMsg.id, {
              datasetId: selectedDataset.id,
              columns: lastStepEvent.columns,
              rows: lastStepEvent.rows || [],
              sort: lastStepEvent.sort || [],
              isAggregated: true,
            });
          }
          replaceThinkingWithAnswer(thinkingMsg.id, event);
        } else if (event.type === 'error') {
          replaceThinkingWithError(thinkingMsg.id, event.message);
          setChatStatus(event.message, 'error');
          return true; // signal early exit
        }
      }
      return false;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
        if (processBuffer()) return;
      }
      if (done) break;
    }
    // flush any data that arrived with the final done=true chunk
    if (buffer.trim()) {
      buffer += '\n\n';
      processBuffer();
    }

    if (!receivedAnswer) {
      replaceThinkingWithError(thinkingMsg.id, 'Analysis did not complete. Please try again.');
      setChatStatus('Analysis incomplete.', 'warn');
      return;
    }

    scheduleJsonSync();
    persistCurrentConversation();
    setChatStatus('Analysis complete.', 'success');

  } catch (error) {
    replaceThinkingWithError(thinkingMsg.id, error.message || 'Unexpected error during analysis.');
    setChatStatus(error.message || 'Analysis failed.', 'error');
  }
}

async function generateAndApplyConfigFromPrompt(gridApi) {
  if (!dom.chatPromptInput) {
    return;
  }

  const prompt = dom.chatPromptInput.value.trim();
  if (!prompt) {
    setChatStatus('Enter a prompt before generating a config.', 'warn');
    return;
  }

  if (isAiGenerating) {
    return;
  }

  dom.chatPromptInput.value = '';

  setAiBusyState(true);

  try {
    ensureConversation();
    pushChatMessage(
      {
        role: 'user',
        kind: 'user',
        text: prompt,
      },
      { scrollToBottom: true },
    );

    const currentConfig = extractConfigFromGrid();
    const intent = detectPromptIntent(prompt);
    if (intent === 'clarification') {
      applyAiResponse(gridApi, buildClarificationResponse(prompt), currentConfig, 'Clarification');
      setChatStatus('Clarify whether you want analysis or a table view change.', 'warn');
      return;
    }

    setChatStatus(
      intent === 'analysis_answer'
        ? 'Asking analyst with computed dataset stats...'
        : 'Generating config from your prompt...',
      'info',
    );

    const selectedDataset =
      intent === 'analysis_answer'
        ? getDatasetForAnalysis(prompt, currentConfig)
        : getDatasetById(currentConfig.datasetId);
    setActiveDatasetSchema(selectedDataset.id);

    if (intent === 'analysis_answer') {
      await runStreamingAnalysis(gridApi, prompt, selectedDataset);
      return;
    }

    const analysisContext = {
      selectedDataset,
      selectedDatasetSchema: getDatasetSchema(selectedDataset),
      rows: deepClone(selectedDataset.rowData),
      analysisStats: {},
      previewRows: selectedDataset.rowData.slice(0, 5),
    };
    const recentHistory = chatMessages
      .slice(-8)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => {
        if (m.role === 'user') {
          return { role: 'user', text: m.text || '' };
        }
        if (m.kind === 'analysis_answer' && isPlainObject(m.response)) {
          return { role: 'assistant', text: m.response.answer || '' };
        }
        return null;
      })
      .filter(Boolean);

    const payload = {
      prompt,
      intent,
      currentConfig,
      selectedDatasetId: analysisContext.selectedDataset.id,
      selectedDatasetLabel: analysisContext.selectedDataset.label,
      selectedDatasetSchema: analysisContext.selectedDatasetSchema,
      allowedFields: [...baseColumnIds],
      allowedOperators: [...allowedFilterOperators],
      allowedAggregationFunctions: [...supportedAggregationFunctions],
      rows: analysisContext.rows,
      analysisStats: analysisContext.analysisStats,
      previewRows: analysisContext.previewRows,
      datasets: getDatasetSummary(),
      columns: [...baseColumnIds],
      schemaVersion: CONFIG_VERSION,
      chatHistory: recentHistory,
    };

    let responseJson = null;
    let usedFallback = false;

    try {
      const response = await fetch('/api/generate-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      responseJson = await response.json();
      if (!response.ok) {
        throw new Error(responseJson?.error || 'Failed to generate config.');
      }
    } catch (error) {
      responseJson = buildFallbackResponse(prompt, currentConfig, intent);
      usedFallback = true;
    }

    const result = applyAiResponse(
      gridApi,
      responseJson,
      currentConfig,
      usedFallback ? 'Fallback parser' : 'AI',
    );

    // Capture snapshot for the last analysis_answer message so its restore button works
    if (result.type === 'analysis_answer') {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg?.kind === 'analysis_answer') {
        const snap = captureGridSnapshot();
        if (snap) viewSnapshots.set(lastMsg.id, snap);
      }
    }
    persistCurrentConversation();

    if (result.warnings.length > 0) {
      setChatStatus(
        `${usedFallback ? 'Fallback' : 'AI'} config applied with warnings: ${result.warnings.join(' | ')}`,
        'warn',
      );
    } else {
      const modelLabel = responseJson.model ? ` (${responseJson.model})` : '';
      const modeLabel =
        result.type === 'analysis_answer'
          ? usedFallback
            ? 'AI unavailable; local analyst answer ready'
            : `Analyst answer ready${modelLabel}`
          : usedFallback
            ? 'Fallback config applied'
            : `AI config applied${modelLabel}`;
      setChatStatus(`${modeLabel}.`, 'success');
    }
  } catch (error) {
    setChatStatus(
      error instanceof Error ? error.message : 'Unexpected AI error.',
      'error',
    );
  } finally {
    setAiBusyState(false);
  }
}

function bindConversationControls(gridApi) {
  if (dom.newChatBtn) {
    dom.newChatBtn.addEventListener('click', () => {
      startNewConversation();
    });
  }

  if (dom.conversationSelect) {
    dom.conversationSelect.addEventListener('change', () => {
      const id = dom.conversationSelect.value;
      if (id && id !== currentConversationId) {
        loadConversation(id, gridApi);
      }
    });
  }

  if (dom.questionNav) {
    dom.questionNav.addEventListener('change', () => {
      const msgId = dom.questionNav.value;
      if (!msgId) return;
      const el = dom.analysisOutput?.querySelector(`[data-message-id="${msgId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Reset to placeholder — acts as navigation, not persistent selection
      dom.questionNav.value = '';
    });
  }
}

function bindControls(gridApi) {
  if (dom.chatSend) {
    dom.chatSend.addEventListener('click', async () => {
      await generateAndApplyConfigFromPrompt(gridApi);
    });
  }

  if (dom.chatClear) {
    dom.chatClear.addEventListener('click', () => {
      if (!dom.chatPromptInput) {
        return;
      }

      dom.chatPromptInput.value = '';
      clearChatTranscript();
      pushChatMessage(
        {
          role: 'assistant',
          kind: 'system',
          title: 'Chat reset',
          text: 'Start a new thread by asking about the selected dataset.',
        },
        { scrollToBottom: false },
      );
      setChatStatus('Chat cleared.', 'info');
    });
  }

  if (dom.chatPromptInput) {
    dom.chatPromptInput.addEventListener('keydown', async (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        await generateAndApplyConfigFromPrompt(gridApi);
      }
    });
  }

  if (dom.datasetSelect) {
    dom.datasetSelect.addEventListener('change', () => {
      const selectedDataset = getDatasetById(dom.datasetSelect.value);
      switchDataset(gridApi, selectedDataset.id, {
        statusMessage: `Switched dataset to "${getDatasetById(dom.datasetSelect.value).label}".`,
      });
    });
  }

  if (dom.saveNamedView) {
    dom.saveNamedView.addEventListener('click', () => {
      const proposedName = dom.viewNameInput ? dom.viewNameInput.value.trim() : '';
      if (!proposedName) {
        setStatus('Enter a view name before saving.', 'warn');
        return;
      }

      const existingView = namedViews.find(
        (view) => view.name.toLowerCase() === proposedName.toLowerCase(),
      );
      if (
        existingView &&
        !window.confirm(`Overwrite existing view "${existingView.name}"?`)
      ) {
        setStatus(`Did not overwrite "${existingView.name}".`, 'info');
        return;
      }

      const currentConfig = extractConfigFromGrid();
      const savedView = upsertNamedView(proposedName, currentConfig);

      if (dom.viewNameInput) {
        dom.viewNameInput.value = '';
      }

      setStatus(`Saved view "${savedView.name}".`, 'success');
    });
  }

  if (dom.loadSelectedView) {
    dom.loadSelectedView.addEventListener('click', () => {
      const view = getSelectedView();
      if (!view) {
        setStatus('Select a saved view to load.', 'warn');
        return;
      }

      const result = applyTableConfig(gridApi, view.config, {
        allowDatasetSwitch: true,
        syncJson: true,
      });

      if (result.warnings.length) {
        setStatus(
          `Loaded "${view.name}" with warnings: ${result.warnings.join(' | ')}`,
          'warn',
        );
      } else {
        setStatus(`Loaded view "${view.name}".`, 'success');
      }
    });
  }

  if (dom.deleteSelectedView) {
    dom.deleteSelectedView.addEventListener('click', () => {
      const view = getSelectedView();
      if (!view) {
        setStatus('No saved view selected to delete.', 'warn');
        return;
      }

      namedViews = namedViews.filter((candidate) => candidate.id !== view.id);
      persistNamedViewsToStorage(namedViews);
      renderNamedViewSelector();
      setStatus(`Deleted view "${view.name}".`, 'success');
    });
  }

  if (dom.applyConfig) {
    dom.applyConfig.addEventListener('click', () => {
      if (!dom.configInput) {
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(dom.configInput.value);
      } catch (error) {
        setStatus(
          `Invalid JSON: ${error instanceof Error ? error.message : 'parse error'}`,
          'error',
        );
        return;
      }

      let configToApply = parsed;
      if (parsed?.type === 'table_config' && isPlainObject(parsed.config)) {
        configToApply = parsed.config;
      } else if (
        parsed?.type === 'table_config_patch' &&
        isPlainObject(parsed.patch)
      ) {
        configToApply = mergeConfigPatch(extractConfigFromGrid(), parsed.patch);
      } else if (isPlainObject(parsed?.suggestedConfigPatch)) {
        configToApply = mergeConfigPatch(extractConfigFromGrid(), parsed.suggestedConfigPatch);
      }

      const result = applyTableConfig(gridApi, configToApply, {
        allowDatasetSwitch: true,
        syncJson: true,
      });

      writeConfigEditor(result.config);

      if (result.warnings.length) {
        setStatus(
          `Applied with warnings: ${result.warnings.join(' | ')}`,
          'warn',
        );
      } else {
        setStatus('JSON config applied.', 'success');
      }
    });
  }

  if (dom.exportConfig) {
    dom.exportConfig.addEventListener('click', () => {
      const config = exportTableConfig(gridApi, currentDatasetId);
      writeConfigEditor(config);
      setStatus('Exported current grid configuration to JSON.', 'success');
    });
  }

  if (dom.resetView) {
    dom.resetView.addEventListener('click', () => {
      switchDataset(gridApi, currentDatasetId, {
        syncJson: true,
        statusMessage: `Reset to default view for "${getDatasetById(currentDatasetId).label}".`,
      });
    });
  }

  if (dom.resetConfig) {
    dom.resetConfig.addEventListener('click', () => {
      const defaultConfig = makeDefaultConfig(currentDatasetId);
      applyTableConfig(gridApi, defaultConfig, {
        allowDatasetSwitch: false,
        syncJson: true,
      });
      setStatus('Reset to default configuration for this dataset.', 'success');
    });
  }
}

function bindGridSyncEvents(gridApi) {
  const syncDerivedState = () => {
    refreshPinnedBottomTotals(gridApi);
    scheduleJsonSync();
  };

  const syncEventNames = [
    'sortChanged',
    'filterChanged',
    'columnMoved',
    'columnVisible',
    'columnPinned',
    'columnRowGroupChanged',
    'columnValueChanged',
  ];

  syncEventNames.forEach((eventName) => {
    gridApi.addEventListener(eventName, syncDerivedState);
  });

  gridApi.addEventListener('columnResized', (event) => {
    if (event.finished) {
      syncDerivedState();
    }
  });
}

async function initialize() {
  if (!dom.grid) {
    console.error('Grid div not found');
    return;
  }

  const initialDataset = getDatasetById(currentDatasetId);
  setActiveDatasetSchema(initialDataset.id);

  const gridOptions = {
    rowData: deepClone(initialDataset.rowData),
    columnDefs,
    alwaysMultiSort: true,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 120,
    },
    animateRows: true,
    rowGroupPanelShow: 'always',
    sideBar: ['columns', 'filters'],
  };

  const gridApi = createGrid(dom.grid, gridOptions);
  gridApiRef = gridApi;

  conversations = loadConversationsFromStorage();
  populateDatasetSelector();
  renderNamedViewSelector();
  populateConversationSelect();
  bindControls(gridApi);
  bindConversationControls(gridApi);
  bindGridSyncEvents(gridApi);
  clearChatTranscript();
  pushChatMessage(
    {
      role: 'assistant',
      kind: 'system',
      title: 'Ask Analyst',
      text:
        'I can answer questions about the data, explain columns, summarize patterns, or change the grid view.',
    },
    { scrollToBottom: false },
  );

  const defaultConfig = makeDefaultConfig(currentDatasetId);
  applyTableConfig(gridApi, defaultConfig, {
    allowDatasetSwitch: false,
    syncJson: true,
  });
  writeConfigEditor(defaultConfig);

  setStatus(
    'Ready. Multi-sort is on: click additional headers to add secondary sorting.',
    'info',
  );
  setChatStatus('Ask for a table change or business analysis in plain English.', 'info');
  setAiBusyState(false);

  window.applyTableConfig = (config) =>
    applyTableConfig(gridApi, config, { allowDatasetSwitch: true, syncJson: true });
  window.exportTableConfig = () => exportTableConfig(gridApi, currentDatasetId);
  window.getDefaultConfig = getDefaultConfig;
  window.normalizeConfig = normalizeConfig;
  window.validateConfig = validateConfig;
  window.mergeConfigPatch = mergeConfigPatch;
  window.applyConfigToGrid = applyConfigToGrid;
  window.extractConfigFromGrid = extractConfigFromGrid;
}

initialize();
