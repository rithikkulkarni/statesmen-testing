import {
  createGrid,
  ModuleRegistry,
  AllCommunityModule,
} from 'ag-grid-community';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import './style.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const CONFIG_VERSION = 2;
const VIEW_LIBRARY_STORAGE_KEY = 'ag-grid-named-view-library-v1';

const datasets = [
  {
    id: 'payments',
    label: 'Payments Baseline',
    rowData: [
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
      {
        paymentId: 1004,
        customer: 'Carolina Benefits',
        carrier: 'United',
        policyNumber: 'POL-004',
        amount: 890.15,
        status: 'Paid',
        paymentMethod: 'ACH',
        invoiceDate: '2026-05-07',
        region: 'West',
      },
      {
        paymentId: 1005,
        customer: 'Premier Insurance Services',
        carrier: 'Humana',
        policyNumber: 'POL-005',
        amount: 5000.0,
        status: 'Failed',
        paymentMethod: 'Credit Card',
        invoiceDate: '2026-05-10',
        region: 'Northeast',
      },
      {
        paymentId: 1006,
        customer: 'Triangle Risk Advisors',
        carrier: 'Cigna',
        policyNumber: 'POL-006',
        amount: 1800.2,
        status: 'Paid',
        paymentMethod: 'ACH',
        invoiceDate: '2026-05-12',
        region: 'South',
      },
      {
        paymentId: 1007,
        customer: 'Metro Employee Benefits',
        carrier: 'United',
        policyNumber: 'POL-007',
        amount: 2150.8,
        status: 'Pending',
        paymentMethod: 'Wire',
        invoiceDate: '2026-05-15',
        region: 'Midwest',
      },
      {
        paymentId: 1008,
        customer: 'Atlantic Insurance Brokers',
        carrier: 'Aetna',
        policyNumber: 'POL-008',
        amount: 4125.33,
        status: 'Failed',
        paymentMethod: 'ACH',
        invoiceDate: '2026-05-18',
        region: 'East',
      },
    ],
  },
  {
    id: 'adjustments',
    label: 'Rebills & Adjustments',
    rowData: [
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
      {
        paymentId: 2004,
        customer: 'Monarch Employee Plans',
        carrier: 'United',
        policyNumber: 'ADJ-104',
        amount: 520.0,
        status: 'Paid',
        paymentMethod: 'ACH',
        invoiceDate: '2026-04-14',
        region: 'West',
      },
      {
        paymentId: 2005,
        customer: 'Harborline Financial',
        carrier: 'Cigna',
        policyNumber: 'ADJ-105',
        amount: 2675.42,
        status: 'Pending',
        paymentMethod: 'Wire',
        invoiceDate: '2026-04-18',
        region: 'Northeast',
      },
      {
        paymentId: 2006,
        customer: 'Old Town Brokerage',
        carrier: 'Aetna',
        policyNumber: 'ADJ-106',
        amount: 320.0,
        status: 'Paid',
        paymentMethod: 'ACH',
        invoiceDate: '2026-04-22',
        region: 'South',
      },
      {
        paymentId: 2007,
        customer: 'Apex Risk Network',
        carrier: 'United',
        policyNumber: 'ADJ-107',
        amount: 1780.14,
        status: 'Failed',
        paymentMethod: 'Credit Card',
        invoiceDate: '2026-04-26',
        region: 'Midwest',
      },
      {
        paymentId: 2008,
        customer: 'Springfield Benefits',
        carrier: 'Humana',
        policyNumber: 'ADJ-108',
        amount: 830.33,
        status: 'Pending',
        paymentMethod: 'ACH',
        invoiceDate: '2026-04-30',
        region: 'Southeast',
      },
    ],
  },
  {
    id: 'exceptions',
    label: 'Exceptions Queue',
    rowData: [
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
      {
        paymentId: 3004,
        customer: 'Greenfield Associates',
        carrier: 'Humana',
        policyNumber: 'EXC-204',
        amount: 455.85,
        status: 'Pending',
        paymentMethod: 'ACH',
        invoiceDate: '2026-03-13',
        region: 'East',
      },
      {
        paymentId: 3005,
        customer: 'Sterling Coverage Co',
        carrier: 'United',
        policyNumber: 'EXC-205',
        amount: 718.7,
        status: 'Paid',
        paymentMethod: 'Wire',
        invoiceDate: '2026-03-16',
        region: 'Midwest',
      },
      {
        paymentId: 3006,
        customer: 'Palisade Benefits',
        carrier: 'Aetna',
        policyNumber: 'EXC-206',
        amount: 5200.13,
        status: 'Failed',
        paymentMethod: 'Credit Card',
        invoiceDate: '2026-03-21',
        region: 'Southeast',
      },
      {
        paymentId: 3007,
        customer: 'Crescent Health Partners',
        carrier: 'Cigna',
        policyNumber: 'EXC-207',
        amount: 1340.0,
        status: 'Pending',
        paymentMethod: 'ACH',
        invoiceDate: '2026-03-25',
        region: 'West',
      },
      {
        paymentId: 3008,
        customer: 'Frontier Insurance Desk',
        carrier: 'Humana',
        policyNumber: 'EXC-208',
        amount: 680.44,
        status: 'Paid',
        paymentMethod: 'ACH',
        invoiceDate: '2026-03-29',
        region: 'South',
      },
    ],
  },
];

const datasetIdSet = new Set(datasets.map((dataset) => dataset.id));

const columnDefs = [
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

const baseColumnIds = columnDefs
  .map((columnDef) => columnDef.field)
  .filter((field) => typeof field === 'string');

const knownColumns = new Set(baseColumnIds);
const numericFilterColumns = new Set(
  columnDefs
    .filter(
      (columnDef) =>
        typeof columnDef.field === 'string' &&
        columnDef.filter === 'agNumberColumnFilter',
    )
    .map((columnDef) => columnDef.field),
);
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

const dom = {
  grid: document.querySelector('#myGrid'),
  configInput: document.querySelector('#configInput'),
  status: document.querySelector('#status'),
  chatPromptInput: document.querySelector('#chatPromptInput'),
  chatSend: document.querySelector('#chatSend'),
  chatClear: document.querySelector('#chatClear'),
  chatStatus: document.querySelector('#chatStatus'),
  datasetSelect: document.querySelector('#datasetSelect'),
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

function getDatasetById(datasetId) {
  return datasets.find((dataset) => dataset.id === datasetId) || datasets[0];
}

function makeDefaultConfig(datasetId) {
  return {
    version: CONFIG_VERSION,
    datasetId,
    columns: {
      order: [...baseColumnIds],
      hidden: [],
      pinned: {},
      widths: {},
    },
    sort: [],
    filters: {},
    groupBy: [],
    aggregations: {
      amount: 'sum',
    },
    subtotals: {
      enabled: false,
      position: 'bottom',
    },
  };
}

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

function sanitizeTableConfig(rawConfig, fallbackDatasetId) {
  const warnings = [];
  const sanitized = makeDefaultConfig(fallbackDatasetId);

  if (!isPlainObject(rawConfig)) {
    warnings.push('Config must be a JSON object; using defaults.');
    return { config: sanitized, warnings };
  }

  if (typeof rawConfig.version === 'number') {
    sanitized.version = rawConfig.version;
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

        const colId = String(sortItem.colId || '').trim();
        const direction = sortItem.sort;

        if (!knownColumns.has(colId)) {
          warnings.push(`sort[${index}] has unknown colId "${colId}".`);
          return;
        }

        if (direction !== 'asc' && direction !== 'desc') {
          warnings.push(`sort[${index}] sort must be "asc" or "desc".`);
          return;
        }

        sanitized.sort.push({ colId, sort: direction });
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

        if (!isPlainObject(model)) {
          warnings.push(`filters.${colId} must be an object filter model.`);
          return;
        }

        if (numericFilterColumns.has(colId)) {
          const normalizedModel = normalizeNumberFilterModel(colId, model, warnings);
          if (normalizedModel) {
            sanitized.filters[colId] = normalizedModel;
          }
          return;
        }

        const normalizedModel = normalizeTextFilterModel(colId, model, warnings);
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
        if (!knownColumns.has(colId)) {
          warnings.push(`aggregations contains unknown column "${colId}".`);
          return;
        }

        if (typeof aggFunc !== 'string' || !aggFunc.trim()) {
          warnings.push(`aggregations.${colId} must be a non-empty string.`);
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
      colId: entry.colId,
      sort: entry.sort,
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
    filters: gridApi.getFilterModel() || {},
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
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
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
        const updatedAt =
          typeof view.updatedAt === 'string' ? view.updatedAt : new Date().toISOString();

        return { id, name, config, updatedAt };
      });
  } catch (_error) {
    return [];
  }
}

function persistNamedViewsToStorage(namedViews) {
  localStorage.setItem(VIEW_LIBRARY_STORAGE_KEY, JSON.stringify(namedViews));
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
  currentDatasetId = dataset.id;
  autoTotalColumnIds = deriveAutoTotalColumns(dataset);

  if (dom.datasetSelect) {
    dom.datasetSelect.value = currentDatasetId;
  }

  withJsonSyncPaused(() => {
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
      sortItem.colId,
      { sort: sortItem.sort, sortIndex },
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
    gridApi.setFilterModel(config.filters);

    if (typeof gridApi.setGridOption === 'function') {
      const subtotalMode = config.subtotals.enabled
        ? config.subtotals.position
        : undefined;
      gridApi.setGridOption('groupTotalRow', subtotalMode);
    }
  });

  refreshPinnedBottomTotals(gridApi);

  if (options.syncJson !== false) {
    scheduleJsonSync();
  }

  return { config, warnings };
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
    dom.chatSend.textContent = isBusy ? 'Generating...' : 'Generate + Apply';
  }
}

function getDatasetSummary() {
  return datasets.map((dataset) => ({
    id: dataset.id,
    label: dataset.label,
    rowCount: dataset.rowData.length,
    sampleRows: dataset.rowData.slice(0, 3),
  }));
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

  setAiBusyState(true);
  setChatStatus('Generating config from your prompt...', 'info');

  try {
    const currentConfig = exportTableConfig(gridApi, currentDatasetId);
    const payload = {
      prompt,
      currentConfig,
      datasets: getDatasetSummary(),
      columns: [...baseColumnIds],
      schemaVersion: CONFIG_VERSION,
    };

    const response = await fetch('/api/generate-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseJson = await response.json();
    if (!response.ok) {
      throw new Error(responseJson?.error || 'Failed to generate config.');
    }

    const result = applyTableConfig(gridApi, responseJson.config, {
      allowDatasetSwitch: true,
      syncJson: true,
    });

    writeConfigEditor(result.config);

    if (result.warnings.length > 0) {
      setChatStatus(
        `AI config applied with warnings: ${result.warnings.join(' | ')}`,
        'warn',
      );
    } else {
      const modelLabel = responseJson.model ? ` (${responseJson.model})` : '';
      setChatStatus(`AI config applied${modelLabel}.`, 'success');
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
      setChatStatus('Prompt cleared.', 'info');
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
      switchDataset(gridApi, dom.datasetSelect.value, {
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

      const currentConfig = exportTableConfig(gridApi, currentDatasetId);
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

      const result = applyTableConfig(gridApi, parsed, {
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

function initialize() {
  if (!dom.grid) {
    console.error('Grid div not found');
    return;
  }

  const initialDataset = getDatasetById(currentDatasetId);

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

  populateDatasetSelector();
  renderNamedViewSelector();
  bindControls(gridApi);
  bindGridSyncEvents(gridApi);

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
  setChatStatus('Ask for table changes in plain English, then click Generate + Apply.', 'info');
  setAiBusyState(false);

  window.applyTableConfig = (config) =>
    applyTableConfig(gridApi, config, { allowDatasetSwitch: true, syncJson: true });
  window.exportTableConfig = () => exportTableConfig(gridApi, currentDatasetId);
}

initialize();
