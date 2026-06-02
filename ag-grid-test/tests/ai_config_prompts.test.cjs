const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const { aiTestPrompts } = require('./test_prompts.js');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const API_URL = 'http://127.0.0.1:5173/api/generate-config';
const SERVER_START_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 45_000;
const REQUEST_DELAY_MS = 3_500;
const MAX_PROMPT_RETRIES = 4;
const MIN_RETRY_DELAY_MS = 1_000;
const DEFAULT_RETRY_DELAY_MS = 22_000;

const KNOWN_COLUMNS = [
  'paymentId',
  'customer',
  'carrier',
  'policyNumber',
  'amount',
  'status',
  'paymentMethod',
  'invoiceDate',
  'region',
];
const KNOWN_COLUMN_SET = new Set(KNOWN_COLUMNS);
const KNOWN_DATASET_IDS = ['payments', 'adjustments', 'exceptions'];
const KNOWN_DATASET_SET = new Set(KNOWN_DATASET_IDS);

const DATASET_SUMMARY = [
  {
    id: 'payments',
    label: 'Payments Baseline',
    rowCount: 50,
    sampleRows: [
      {
        paymentId: 1001,
        customer: 'Acme Insurance Group',
        carrier: 'Aetna',
        policyNumber: 'POL-001',
        amount: 1250.45,
        status: 'Paid',
        paymentMethod: 'ACH',
        invoiceDate: '2026-05-01',
        region: 'Southeast',
      },
      {
        paymentId: 1002,
        customer: 'Blue Ridge Health',
        carrier: 'Cigna',
        policyNumber: 'POL-002',
        amount: 2400.0,
        status: 'Failed',
        paymentMethod: 'Credit Card',
        invoiceDate: '2026-05-03',
        region: 'Midwest',
      },
      {
        paymentId: 1003,
        customer: 'NC Mutual',
        carrier: 'Aetna',
        policyNumber: 'POL-003',
        amount: 3400.75,
        status: 'Pending',
        paymentMethod: 'Wire',
        invoiceDate: '2026-05-05',
        region: 'Southeast',
      },
    ],
  },
  {
    id: 'adjustments',
    label: 'Rebills & Adjustments',
    rowCount: 50,
    sampleRows: [
      {
        paymentId: 2001,
        customer: 'Summit Benefit Advisors',
        carrier: 'Aetna',
        policyNumber: 'ADJ-101',
        amount: 410.25,
        status: 'Pending',
        paymentMethod: 'ACH',
        invoiceDate: '2026-04-04',
        region: 'Midwest',
      },
      {
        paymentId: 2002,
        customer: 'Sandhill Coverage',
        carrier: 'Humana',
        policyNumber: 'ADJ-102',
        amount: 980.0,
        status: 'Paid',
        paymentMethod: 'Wire',
        invoiceDate: '2026-04-09',
        region: 'South',
      },
      {
        paymentId: 2003,
        customer: 'Delta Group Health',
        carrier: 'Cigna',
        policyNumber: 'ADJ-103',
        amount: 1450.75,
        status: 'Failed',
        paymentMethod: 'Credit Card',
        invoiceDate: '2026-04-11',
        region: 'Southeast',
      },
    ],
  },
  {
    id: 'exceptions',
    label: 'Exceptions Queue',
    rowCount: 50,
    sampleRows: [
      {
        paymentId: 3001,
        customer: 'Bridgeway Underwriters',
        carrier: 'United',
        policyNumber: 'EXC-201',
        amount: 6120.9,
        status: 'Failed',
        paymentMethod: 'Wire',
        invoiceDate: '2026-03-02',
        region: 'West',
      },
      {
        paymentId: 3002,
        customer: 'Pioneer Benefit Group',
        carrier: 'Aetna',
        policyNumber: 'EXC-202',
        amount: 1125.0,
        status: 'Pending',
        paymentMethod: 'ACH',
        invoiceDate: '2026-03-04',
        region: 'Northeast',
      },
      {
        paymentId: 3003,
        customer: 'Northgate Insurance',
        carrier: 'Cigna',
        policyNumber: 'EXC-203',
        amount: 2999.99,
        status: 'Failed',
        paymentMethod: 'Credit Card',
        invoiceDate: '2026-03-08',
        region: 'South',
      },
    ],
  },
];

function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

function makeDefaultConfig() {
  return {
    version: 2,
    datasetId: 'payments',
    columns: {
      order: [...KNOWN_COLUMNS],
      hidden: [],
      pinned: {},
      widths: {},
    },
  sort: [],
  filters: {},
  groupBy: [],
  aggregations: {},
    subtotals: {
      enabled: false,
      position: 'bottom',
    },
  };
}

function mergeConfigPatch(currentConfig, patch) {
  const merged = JSON.parse(JSON.stringify(currentConfig));
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return merged;
  }

  if (typeof patch.datasetId === 'string') {
    merged.datasetId = patch.datasetId;
  }

  if (patch.columns && typeof patch.columns === 'object' && !Array.isArray(patch.columns)) {
    merged.columns = {
      ...merged.columns,
      ...patch.columns,
    };
  }

  if (Array.isArray(patch.sort)) {
    merged.sort = patch.sort;
  }

  if (patch.filters && typeof patch.filters === 'object' && !Array.isArray(patch.filters)) {
    merged.filters = {
      ...merged.filters,
      ...patch.filters,
    };
  }

  if (Array.isArray(patch.groupBy)) {
    merged.groupBy = patch.groupBy;
  }

  if (patch.aggregations && typeof patch.aggregations === 'object' && !Array.isArray(patch.aggregations)) {
    merged.aggregations = {
      ...merged.aggregations,
      ...patch.aggregations,
    };
  }

  if (patch.subtotals && typeof patch.subtotals === 'object' && !Array.isArray(patch.subtotals)) {
    merged.subtotals = {
      ...merged.subtotals,
      ...patch.subtotals,
    };
  }

  return merged;
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value.toLowerCase());
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, output));
    return output;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStrings(entry, output));
  }

  return output;
}

function collectNumbers(value, output = []) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectNumbers(entry, output));
    return output;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectNumbers(entry, output));
  }

  return output;
}

function hasFilterTokens(config, colId, tokens) {
  const model = config.filters?.[colId];
  if (!model || typeof model !== 'object') {
    return false;
  }

  const values = collectStrings(model);
  return tokens.every((token) =>
    values.some((value) => value.includes(token.toLowerCase())),
  );
}

function hasMinFilterNumber(config, colId, minValue) {
  const model = config.filters?.[colId];
  if (!model || typeof model !== 'object') {
    return false;
  }

  const numbers = collectNumbers(model);
  return numbers.some((value) => value >= minValue);
}

function assertSortIncludes(config, colId, direction, prompt) {
  const matching = config.sort.find(
    (item) =>
      item &&
      (item.field || item.colId) === colId &&
      (item.direction || item.sort) === direction,
  );
  assert.ok(
    matching,
    `Prompt "${prompt}" should include sort ${colId}:${direction}.`,
  );
}

function assertFrontColumns(config, colIds, prompt) {
  const order = config.columns.order;
  const indexes = colIds.map((colId) => order.indexOf(colId));
  const allPresent = indexes.every((index) => index >= 0);
  assert.ok(allPresent, `Prompt "${prompt}" should keep front columns present.`);

  const maxAllowed = colIds.length - 1;
  const atFront = indexes.every((index) => index <= maxAllowed);
  assert.ok(atFront, `Prompt "${prompt}" should move requested columns to front.`);
}

function assertExactFrontOrder(config, colIds, prompt) {
  const actualPrefix = config.columns.order.slice(0, colIds.length);
  assert.deepEqual(
    actualPrefix,
    colIds,
    `Prompt "${prompt}" should set leading order to ${colIds.join(', ')}.`,
  );
}

function assertVisibleOnly(config, visibleCols, prompt) {
  const visibleSet = new Set(visibleCols);
  const hidden = new Set(config.columns.hidden);

  KNOWN_COLUMNS.forEach((colId) => {
    if (visibleSet.has(colId)) {
      assert.ok(
        !hidden.has(colId),
        `Prompt "${prompt}" should keep "${colId}" visible.`,
      );
    } else {
      assert.ok(
        hidden.has(colId),
        `Prompt "${prompt}" should hide "${colId}".`,
      );
    }
  });
}

function assertConfigShape(config, prompt) {
  assert.ok(config && typeof config === 'object', `Prompt "${prompt}" must return an object config.`);
  assert.equal(config.version, 2, `Prompt "${prompt}" should return version 2.`);
  assert.ok(
    KNOWN_DATASET_SET.has(config.datasetId),
    `Prompt "${prompt}" returned unknown datasetId "${config.datasetId}".`,
  );

  assert.ok(config.columns && typeof config.columns === 'object', `Prompt "${prompt}" missing columns object.`);
  assert.ok(Array.isArray(config.columns.order), `Prompt "${prompt}" columns.order must be an array.`);
  assert.ok(Array.isArray(config.columns.hidden), `Prompt "${prompt}" columns.hidden must be an array.`);
  assert.ok(config.columns.pinned && typeof config.columns.pinned === 'object', `Prompt "${prompt}" columns.pinned must be an object.`);
  assert.ok(config.columns.widths && typeof config.columns.widths === 'object', `Prompt "${prompt}" columns.widths must be an object.`);

  const seenOrder = new Set();
  config.columns.order.forEach((colId) => {
    assert.ok(KNOWN_COLUMN_SET.has(colId), `Prompt "${prompt}" order includes unknown column "${colId}".`);
    assert.ok(!seenOrder.has(colId), `Prompt "${prompt}" order includes duplicate column "${colId}".`);
    seenOrder.add(colId);
  });

  config.columns.hidden.forEach((colId) => {
    assert.ok(KNOWN_COLUMN_SET.has(colId), `Prompt "${prompt}" hidden includes unknown column "${colId}".`);
  });

  Object.entries(config.columns.pinned).forEach(([colId, pinned]) => {
    assert.ok(KNOWN_COLUMN_SET.has(colId), `Prompt "${prompt}" pinned includes unknown column "${colId}".`);
    assert.ok(
      pinned === 'left' || pinned === 'right' || pinned === null,
      `Prompt "${prompt}" pinned value for "${colId}" must be left/right/null.`,
    );
  });

  Object.entries(config.columns.widths).forEach(([colId, width]) => {
    assert.ok(KNOWN_COLUMN_SET.has(colId), `Prompt "${prompt}" widths includes unknown column "${colId}".`);
    assert.ok(
      typeof width === 'number' && Number.isFinite(width) && width >= 40,
      `Prompt "${prompt}" width for "${colId}" must be number >= 40.`,
    );
  });

  assert.ok(Array.isArray(config.sort), `Prompt "${prompt}" sort must be an array.`);
  config.sort.forEach((sortItem, index) => {
    assert.ok(sortItem && typeof sortItem === 'object', `Prompt "${prompt}" sort[${index}] must be an object.`);
    assert.ok(
      KNOWN_COLUMN_SET.has(sortItem.field || sortItem.colId),
      `Prompt "${prompt}" sort[${index}] has unknown field "${sortItem.field || sortItem.colId}".`,
    );
    assert.ok(
      (sortItem.direction || sortItem.sort) === 'asc' ||
        (sortItem.direction || sortItem.sort) === 'desc',
      `Prompt "${prompt}" sort[${index}] direction must be asc/desc.`,
    );
  });

  assert.ok(config.filters && typeof config.filters === 'object', `Prompt "${prompt}" filters must be an object.`);
  Object.entries(config.filters).forEach(([colId, filterModel]) => {
    assert.ok(KNOWN_COLUMN_SET.has(colId), `Prompt "${prompt}" filters include unknown column "${colId}".`);
    assert.ok(
      filterModel && typeof filterModel === 'object' && !Array.isArray(filterModel),
      `Prompt "${prompt}" filters.${colId} must be an object.`,
    );
  });

  assert.ok(Array.isArray(config.groupBy), `Prompt "${prompt}" groupBy must be an array.`);
  config.groupBy.forEach((colId) => {
    assert.ok(KNOWN_COLUMN_SET.has(colId), `Prompt "${prompt}" groupBy includes unknown column "${colId}".`);
  });

  assert.ok(config.aggregations && typeof config.aggregations === 'object', `Prompt "${prompt}" aggregations must be an object.`);
  Object.entries(config.aggregations).forEach(([colId, agg]) => {
    assert.ok(KNOWN_COLUMN_SET.has(colId), `Prompt "${prompt}" aggregations include unknown column "${colId}".`);
    assert.ok(typeof agg === 'string' && agg.trim(), `Prompt "${prompt}" aggregation for "${colId}" must be a non-empty string.`);
  });

  assert.ok(config.subtotals && typeof config.subtotals === 'object', `Prompt "${prompt}" subtotals must be an object.`);
  assert.equal(typeof config.subtotals.enabled, 'boolean', `Prompt "${prompt}" subtotals.enabled must be boolean.`);
  assert.ok(
    config.subtotals.position === 'top' || config.subtotals.position === 'bottom',
    `Prompt "${prompt}" subtotals.position must be top/bottom.`,
  );
}

function assertPromptIntent(config, prompt) {
  if (prompt === 'Show only customer, carrier, amount, status, and invoice date.') {
    assertVisibleOnly(
      config,
      ['customer', 'carrier', 'amount', 'status', 'invoiceDate'],
      prompt,
    );
  }

  if (prompt === 'Hide payment ID and policy number.') {
    assert.ok(
      config.columns.hidden.includes('paymentId'),
      `Prompt "${prompt}" should hide paymentId.`,
    );
    assert.ok(
      config.columns.hidden.includes('policyNumber'),
      `Prompt "${prompt}" should hide policyNumber.`,
    );
  }

  if (prompt === 'Move status and amount to the front of the table.') {
    assertFrontColumns(config, ['status', 'amount'], prompt);
  }

  if (prompt === 'Sort the table by amount from highest to lowest.') {
    assertSortIncludes(config, 'amount', 'desc', prompt);
  }

  if (prompt === 'Show the most recent invoices first.') {
    assertSortIncludes(config, 'invoiceDate', 'desc', prompt);
  }

  if (prompt === 'Filter to only failed payments.') {
    assert.ok(
      hasFilterTokens(config, 'status', ['failed']),
      `Prompt "${prompt}" should filter status to failed.`,
    );
  }

  if (prompt === 'Show only ACH payments.') {
    assert.ok(
      hasFilterTokens(config, 'paymentMethod', ['ach']),
      `Prompt "${prompt}" should filter paymentMethod to ACH.`,
    );
  }

  if (prompt === 'Only show payments over $2,000.') {
    assert.ok(
      hasMinFilterNumber(config, 'amount', 2000),
      `Prompt "${prompt}" should filter amount >= 2000.`,
    );
  }

  if (prompt === 'Show failed payments over $2,000.') {
    assert.ok(
      hasFilterTokens(config, 'status', ['failed']),
      `Prompt "${prompt}" should filter status to failed.`,
    );
    assert.ok(
      hasMinFilterNumber(config, 'amount', 2000),
      `Prompt "${prompt}" should filter amount >= 2000.`,
    );
  }

  if (prompt === 'Show Aetna and Cigna records only.') {
    assert.ok(
      hasFilterTokens(config, 'carrier', ['aetna', 'cigna']),
      `Prompt "${prompt}" should filter carrier to Aetna and Cigna.`,
    );
  }

  if (prompt === 'Show me high-value failed payments, with the largest amounts first.') {
    assert.ok(
      hasFilterTokens(config, 'status', ['failed']),
      `Prompt "${prompt}" should filter status to failed.`,
    );
    assert.ok(
      hasMinFilterNumber(config, 'amount', 1000),
      `Prompt "${prompt}" should include a high-value amount filter.`,
    );
    assertSortIncludes(config, 'amount', 'desc', prompt);
  }

  if (prompt === 'I only care about failed or pending payments. Hide everything else.') {
    assert.ok(
      hasFilterTokens(config, 'status', ['failed', 'pending']),
      `Prompt "${prompt}" should filter status to failed/pending.`,
    );
  }

  if (prompt === 'Show me failed credit card payments.') {
    assert.ok(
      hasFilterTokens(config, 'status', ['failed']),
      `Prompt "${prompt}" should filter status to failed.`,
    );
    assert.ok(
      hasFilterTokens(config, 'paymentMethod', ['credit', 'card']),
      `Prompt "${prompt}" should filter paymentMethod to credit card.`,
    );
  }

  if (prompt === 'Find ACH payments that are still pending.') {
    assert.ok(
      hasFilterTokens(config, 'paymentMethod', ['ach']),
      `Prompt "${prompt}" should filter paymentMethod to ACH.`,
    );
    assert.ok(
      hasFilterTokens(config, 'status', ['pending']),
      `Prompt "${prompt}" should filter status to pending.`,
    );
  }

  if (prompt === 'Show me all records from the Southeast region.') {
    assert.ok(
      hasFilterTokens(config, 'region', ['southeast']),
      `Prompt "${prompt}" should filter region to Southeast.`,
    );
  }

  if (prompt === 'Show Northeast and Midwest records sorted by invoice date.') {
    assert.ok(
      hasFilterTokens(config, 'region', ['northeast', 'midwest']),
      `Prompt "${prompt}" should filter region to Northeast and Midwest.`,
    );
    assert.ok(
      config.sort.some((entry) => (entry.field || entry.colId) === 'invoiceDate'),
      `Prompt "${prompt}" should sort by invoiceDate.`,
    );
  }

  if (prompt === 'Group payments by carrier and show the total amount for each carrier.') {
    assert.ok(
      config.groupBy.includes('carrier'),
      `Prompt "${prompt}" should group by carrier.`,
    );
    assert.ok(
      typeof config.aggregations.amount === 'string',
      `Prompt "${prompt}" should include amount aggregation.`,
    );
  }

  if (prompt === 'Group by status and subtotal the amount.') {
    assert.ok(
      config.groupBy.includes('status'),
      `Prompt "${prompt}" should group by status.`,
    );
    assert.ok(
      typeof config.aggregations.amount === 'string',
      `Prompt "${prompt}" should include amount aggregation.`,
    );
    assert.ok(
      config.subtotals.enabled,
      `Prompt "${prompt}" should enable subtotals.`,
    );
  }

  if (prompt === 'Group failed payments by region.') {
    assert.ok(
      config.groupBy.includes('region'),
      `Prompt "${prompt}" should group by region.`,
    );
    assert.ok(
      hasFilterTokens(config, 'status', ['failed']),
      `Prompt "${prompt}" should filter status to failed.`,
    );
  }

  if (prompt === 'Group by payment method and show total amount.') {
    assert.ok(
      config.groupBy.includes('paymentMethod'),
      `Prompt "${prompt}" should group by paymentMethod.`,
    );
    assert.ok(
      typeof config.aggregations.amount === 'string',
      `Prompt "${prompt}" should include amount aggregation.`,
    );
  }

  if (prompt === 'Show total payment amount by carrier, sorted highest to lowest.') {
    assert.ok(
      config.groupBy.includes('carrier'),
      `Prompt "${prompt}" should group by carrier.`,
    );
    assert.ok(
      typeof config.aggregations.amount === 'string',
      `Prompt "${prompt}" should include amount aggregation.`,
    );
    assertSortIncludes(config, 'amount', 'desc', prompt);
  }

  if (prompt === 'Group by region, then by carrier.') {
    assert.deepEqual(
      config.groupBy.slice(0, 2),
      ['region', 'carrier'],
      `Prompt "${prompt}" should group by region then carrier.`,
    );
  }

  if (prompt === 'Switch to the Rebills & Adjustments dataset.') {
    assert.equal(config.datasetId, 'adjustments', `Prompt "${prompt}" should switch datasetId to adjustments.`);
  }

  if (prompt === 'Open the Exceptions Queue.') {
    assert.equal(config.datasetId, 'exceptions', `Prompt "${prompt}" should switch datasetId to exceptions.`);
  }

  if (prompt === 'Use the Payments Baseline dataset and show only failed records.') {
    assert.equal(config.datasetId, 'payments', `Prompt "${prompt}" should switch datasetId to payments.`);
    assert.ok(
      hasFilterTokens(config, 'status', ['failed']),
      `Prompt "${prompt}" should filter status to failed.`,
    );
  }

  if (prompt === 'Switch to adjustments and show pending items over $1,000.') {
    assert.equal(config.datasetId, 'adjustments', `Prompt "${prompt}" should switch datasetId to adjustments.`);
    assert.ok(
      hasFilterTokens(config, 'status', ['pending']),
      `Prompt "${prompt}" should filter status to pending.`,
    );
    assert.ok(
      hasMinFilterNumber(config, 'amount', 1000),
      `Prompt "${prompt}" should filter amount >= 1000.`,
    );
  }

  if (prompt === 'Open exceptions and show high-value failed payments.') {
    assert.equal(config.datasetId, 'exceptions', `Prompt "${prompt}" should switch datasetId to exceptions.`);
    assert.ok(
      hasFilterTokens(config, 'status', ['failed']),
      `Prompt "${prompt}" should filter status to failed.`,
    );
    assert.ok(
      hasMinFilterNumber(config, 'amount', 1000),
      `Prompt "${prompt}" should include a high-value amount filter.`,
    );
  }

  if (prompt === 'Show me failed payments over $2,000, grouped by carrier, with amount totals.') {
    assert.ok(
      hasFilterTokens(config, 'status', ['failed']),
      `Prompt "${prompt}" should filter status to failed.`,
    );
    assert.ok(
      hasMinFilterNumber(config, 'amount', 2000),
      `Prompt "${prompt}" should filter amount >= 2000.`,
    );
    assert.ok(
      config.groupBy.includes('carrier'),
      `Prompt "${prompt}" should group by carrier.`,
    );
    assert.ok(
      typeof config.aggregations.amount === 'string',
      `Prompt "${prompt}" should include amount aggregation.`,
    );
  }

  if (prompt === 'Create a follow-up view with only customer, carrier, amount, status, and payment method. Show failed and pending payments first.') {
    assertVisibleOnly(
      config,
      ['customer', 'carrier', 'amount', 'status', 'paymentMethod'],
      prompt,
    );
    assert.ok(
      hasFilterTokens(config, 'status', ['failed', 'pending']),
      `Prompt "${prompt}" should filter status to failed/pending.`,
    );
  }

  if (prompt === 'Switch to the Exceptions Queue and show high-value failed payments sorted from largest to smallest.') {
    assert.equal(config.datasetId, 'exceptions', `Prompt "${prompt}" should switch datasetId to exceptions.`);
    assert.ok(
      hasFilterTokens(config, 'status', ['failed']),
      `Prompt "${prompt}" should filter status to failed.`,
    );
    assert.ok(
      hasMinFilterNumber(config, 'amount', 1000),
      `Prompt "${prompt}" should include a high-value amount filter.`,
    );
    assertSortIncludes(config, 'amount', 'desc', prompt);
  }

  if (prompt === 'Group payments by region and carrier, then show total amount for each group.') {
    assert.deepEqual(
      config.groupBy.slice(0, 2),
      ['region', 'carrier'],
      `Prompt "${prompt}" should group by region then carrier.`,
    );
    assert.ok(
      typeof config.aggregations.amount === 'string',
      `Prompt "${prompt}" should include amount aggregation.`,
    );
  }

  if (prompt === 'Show pending ACH payments and move customer, amount, and invoice date to the front.') {
    assert.ok(
      hasFilterTokens(config, 'status', ['pending']),
      `Prompt "${prompt}" should filter status to pending.`,
    );
    assert.ok(
      hasFilterTokens(config, 'paymentMethod', ['ach']),
      `Prompt "${prompt}" should filter paymentMethod to ACH.`,
    );
    assertExactFrontOrder(config, ['customer', 'amount', 'invoiceDate'], prompt);
  }

  if (prompt === 'Create a clean executive view showing carrier, status, region, and total amount grouped by carrier.') {
    assertVisibleOnly(config, ['carrier', 'status', 'region', 'amount'], prompt);
    assert.ok(
      config.groupBy.includes('carrier'),
      `Prompt "${prompt}" should group by carrier.`,
    );
    assert.ok(
      typeof config.aggregations.amount === 'string',
      `Prompt "${prompt}" should include amount aggregation.`,
    );
  }
}

function buildRequestPayload(prompt) {
  return {
    prompt,
    currentConfig: makeDefaultConfig(),
    datasets: DATASET_SUMMARY,
    columns: [...KNOWN_COLUMNS],
    schemaVersion: 2,
  };
}

function parseRetryDelayMs(response, responseJson) {
  const headerValue = response.headers.get('retry-after');
  if (headerValue) {
    const parsedHeader = Number.parseFloat(headerValue);
    if (Number.isFinite(parsedHeader) && parsedHeader > 0) {
      return Math.ceil(parsedHeader * 1000);
    }
  }

  if (
    responseJson &&
    typeof responseJson.retryAfterSec === 'number' &&
    Number.isFinite(responseJson.retryAfterSec) &&
    responseJson.retryAfterSec > 0
  ) {
    return Math.ceil(responseJson.retryAfterSec * 1000);
  }

  if (typeof responseJson?.error === 'string') {
    const messageMatch = responseJson.error.match(
      /retry in\s+([0-9]+(?:\.[0-9]+)?)s/i,
    );
    if (messageMatch) {
      const parsed = Number.parseFloat(messageMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.ceil(parsed * 1000);
      }
    }
  }

  return DEFAULT_RETRY_DELAY_MS;
}

function isRetryableRateLimit(response, responseJson) {
  if (response.status === 429) {
    return true;
  }

  if (typeof responseJson?.error !== 'string') {
    return false;
  }

  const message = responseJson.error.toLowerCase();
  return (
    message.includes('resource_exhausted') ||
    message.includes('quota exceeded') ||
    message.includes('retry in')
  );
}

async function postConfigPrompt(prompt) {
  for (let attempt = 1; attempt <= MAX_PROMPT_RETRIES + 1; attempt += 1) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildRequestPayload(prompt)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    let json = {};
    try {
      json = await response.json();
    } catch (_error) {
      json = {};
    }

    if (response.ok) {
      const config =
        json?.type === 'table_config_patch'
          ? mergeConfigPatch(makeDefaultConfig(), json.patch)
          : json.config;
      assert.ok(
        config && typeof config === 'object',
        `Prompt "${prompt}" should return a config object.`,
      );
      return config;
    }

    if (isRetryableRateLimit(response, json) && attempt <= MAX_PROMPT_RETRIES) {
      const retryDelayMs = Math.max(
        MIN_RETRY_DELAY_MS,
        parseRetryDelayMs(response, json),
      );
      await delay(retryDelayMs);
      continue;
    }

    assert.fail(
      `Prompt "${prompt}" failed API call with status ${response.status}: ${json.error || 'unknown error'}`,
    );
  }

  assert.fail(`Prompt "${prompt}" exceeded max retry attempts.`);
}

function formatChildExitError(prefix, code, signal, logs) {
  return new Error(
    `${prefix} (code=${String(code)}, signal=${String(signal)})\n\n${logs}`,
  );
}

let devServerProcess = null;
let devServerLogs = '';

async function waitForApiReady() {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (devServerProcess && devServerProcess.exitCode !== null) {
      throw formatChildExitError(
        'Vite dev server exited before tests started',
        devServerProcess.exitCode,
        null,
        devServerLogs,
      );
    }

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        signal: AbortSignal.timeout(2_000),
      });

      if ([200, 400, 405, 500].includes(response.status)) {
        return;
      }
    } catch (_error) {
      // Wait and retry until timeout.
    }

    await delay(250);
  }

  throw new Error(
    `Timed out waiting for ${API_URL} to become ready.\n\n${devServerLogs}`,
  );
}

loadEnvFile(path.join(PROJECT_ROOT, '.env'));
const SKIP_REASON = process.env.GEMINI_API_KEY
  ? false
  : 'GEMINI_API_KEY is missing. Set it in .env before running this suite.';

test.before(async () => {
  if (SKIP_REASON) {
    return;
  }

  if (process.platform === 'win32') {
    devServerProcess = spawn(
      'cmd.exe',
      ['/d', '/s', '/c', 'npm.cmd run dev'],
      {
        cwd: PROJECT_ROOT,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
  } else {
    devServerProcess = spawn('npm', ['run', 'dev'], {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  }

  devServerProcess.stdout.on('data', (chunk) => {
    devServerLogs += chunk.toString();
  });

  devServerProcess.stderr.on('data', (chunk) => {
    devServerLogs += chunk.toString();
  });

  await waitForApiReady();
});

test.after(async () => {
  if (!devServerProcess || devServerProcess.exitCode !== null) {
    return;
  }

  devServerProcess.kill('SIGTERM');
  await delay(500);

  if (devServerProcess.exitCode === null) {
    devServerProcess.kill('SIGKILL');
  }
});

test(
  'ai prompt configs match expected structure and prompt intent',
  { skip: SKIP_REASON },
  async (t) => {
    for (const prompt of aiTestPrompts) {
      await t.test(prompt, async () => {
        const config = await postConfigPrompt(prompt);
        assertConfigShape(config, prompt);
        assertPromptIntent(config, prompt);
        await delay(REQUEST_DELAY_MS);
      });
    }
  },
);
