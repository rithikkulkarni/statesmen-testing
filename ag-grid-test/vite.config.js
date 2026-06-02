import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const duckdb = _require('duckdb');

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_AI_PROVIDER = 'gemini';
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.1:8b';
const MAX_REQUEST_BODY_BYTES = 1024 * 128;
const CONFIG_TRANSLATOR_SYSTEM_PROMPT = [
  'You are an AI table configuration and data-analysis assistant.',
  'Classify requests as table_config, analysis_answer, or clarification based on the provided intent.',
  'Convert table manipulation requests into valid version 2 table config JSON or config patches.',
  'Return JSON only. Do not add prose, markdown, or comments.',
  'Return either {"type":"table_config","config":...,"explanation":"..."} or {"type":"table_config_patch","patch":...,"explanation":"..."}.',
  'For data-analysis questions, return {"type":"analysis_answer","answer":"...","insights":["..."],"recommendedActions":["..."],"supportingRows":[paymentId],"suggestedConfigPatch":{...}}.',
  'For ambiguous prompts, return {"type":"clarification","question":"...","suggestions":["..."]}.',
  'Never return the prompt context itself. Do not return keys like allowedFields, allowedColumns, allowedDatasets, allowedSchemas, schemaVersion, previewRows, rows, or analysisStats at the top level.',
  'The top-level JSON object must always include a "type" field.',
  'Do not do arithmetic from scratch. Use analysisStats for numbers and use rows only as evidence/examples.',
  'Analysis answers should be written like a concise business analyst: explain what matters, why, and which records support it.',
  'Always preserve existing settings from currentConfig unless the user clearly asks to change them.',
  'Use only dataset IDs and field names provided in the prompt context.',
  'Never invent fields, operators, aggregation functions, or dataset IDs.',
  'Interpret user intent with these rules:',
  '- "show only <columns>" means hide all non-mentioned columns.',
  '- "move <columns> to the front" means those columns appear first in columns.order.',
  '- "most recent first" means invoiceDate sort desc.',
  '- "largest/highest first" means amount sort desc.',
  '- "failed", "pending", "paid", method, carrier, and region phrases map to filters.',
  '- "over $N", "greater than N", "high-value" map to amount numeric filters.',
  '- filters use { "operator": "...", "value": ... }, not AG Grid filter models.',
  '- numeric filter intent should use greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual, or between.',
  '- for multiple string values, use oneOf with an array value.',
  '- "group by A then B" maps to groupBy order [A, B].',
  '- "total amount" or "subtotal amount" should include aggregations.amount = "sum" for payment datasets.',
  '- If subtotals are requested, set subtotals.enabled = true.',
  '- sort entries use { "field": "...", "direction": "asc"|"desc" }.',
  'For prompts about saving or loading named views, return the best table config implied by the prompt; this endpoint only returns JSON.',
  'If a prompt is ambiguous, make a conservative business-friendly interpretation while keeping unchanged settings from currentConfig.',
].join('\n');

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes = MAX_REQUEST_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;

    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxBytes) {
        reject(new Error('Request body too large.'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = raw ? JSON.parse(raw) : {};
        resolve(parsed);
      } catch (_error) {
        reject(new Error('Invalid JSON request body.'));
      }
    });

    req.on('error', (_error) => {
      reject(new Error('Failed to read request body.'));
    });
  });
}

function normalizeGeminiModel(model) {
  const trimmed = typeof model === 'string' ? model.trim() : '';
  const fallback = trimmed || DEFAULT_GEMINI_MODEL;
  return fallback.replace(/^models\//, '');
}

function normalizeAiProvider(provider) {
  const normalized = String(provider || DEFAULT_AI_PROVIDER).trim().toLowerCase();
  return normalized === 'ollama' ? 'ollama' : 'gemini';
}

function extractJsonObjectText(rawText) {
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) {
    return '';
  }

  if (text.startsWith('{') && text.endsWith('}')) {
    return text;
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function parseModelJson(rawText, modelName) {
  const jsonText = extractJsonObjectText(rawText);
  if (!jsonText) {
    throw new Error(`${modelName} returned an empty response.`);
  }

  try {
    return JSON.parse(jsonText);
  } catch (_error) {
    throw new Error(`${modelName} output was not valid JSON.`);
  }
}

function isFullTableConfig(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.version === 2 &&
    typeof value.datasetId === 'string' &&
    value.columns &&
    typeof value.columns === 'object' &&
    Array.isArray(value.sort) &&
    value.filters &&
    typeof value.filters === 'object'
  );
}

function normalizeParsedModelResult(parsedResult, { modelLabel, intent }) {
  if (!parsedResult || typeof parsedResult !== 'object' || Array.isArray(parsedResult)) {
    throw new Error(`${modelLabel} returned JSON, but not an object.`);
  }

  if (typeof parsedResult.type === 'string') {
    return parsedResult;
  }

  if (isFullTableConfig(parsedResult)) {
    return {
      type: 'table_config',
      config: parsedResult,
    };
  }

  if (
    intent === 'analysis_answer' &&
    typeof parsedResult.answer === 'string' &&
    parsedResult.answer.trim()
  ) {
    const supportingRows = Array.isArray(parsedResult.supportingRows)
      ? parsedResult.supportingRows
          .map((row) => {
            if (typeof row === 'number' || typeof row === 'string') {
              return row;
            }

            if (row && typeof row === 'object') {
              return row.rowNumber || row.paymentId || row.RowId || null;
            }

            return null;
          })
          .filter((row) => row != null)
      : [];

    return {
      type: 'analysis_answer',
      answer: parsedResult.answer,
      insights: Array.isArray(parsedResult.insights) ? parsedResult.insights : [],
      recommendedActions: Array.isArray(parsedResult.recommendedActions)
        ? parsedResult.recommendedActions
        : [],
      supportingRows,
      suggestedConfigPatch:
        parsedResult.suggestedConfigPatch &&
        typeof parsedResult.suggestedConfigPatch === 'object' &&
        !Array.isArray(parsedResult.suggestedConfigPatch)
          ? parsedResult.suggestedConfigPatch
          : {},
    };
  }

  throw new Error(
    `${modelLabel} returned JSON, but it did not contain a valid table config, analysis answer, or clarification.`,
  );
}

function extractGeminiErrorMessage(responseJson) {
  if (typeof responseJson?.error?.message === 'string' && responseJson.error.message.trim()) {
    return responseJson.error.message.trim();
  }

  if (typeof responseJson?.promptFeedback?.blockReason === 'string') {
    return `Gemini blocked the request (${responseJson.promptFeedback.blockReason}).`;
  }

  return null;
}

function extractRetryAfterSeconds(responseJson, fallbackMessage) {
  const details = Array.isArray(responseJson?.error?.details)
    ? responseJson.error.details
    : [];

  for (const detail of details) {
    if (
      detail &&
      typeof detail === 'object' &&
      typeof detail.retryDelay === 'string'
    ) {
      const match = detail.retryDelay.match(/([0-9]+(?:\.[0-9]+)?)s/i);
      if (match) {
        const parsed = Number.parseFloat(match[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
  }

  if (typeof fallbackMessage === 'string') {
    const messageMatch = fallbackMessage.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
    if (messageMatch) {
      const parsed = Number.parseFloat(messageMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

function extractGeminiResponseText(responseJson) {
  if (!Array.isArray(responseJson?.candidates)) {
    return '';
  }

  const textParts = [];

  responseJson.candidates.forEach((candidate) => {
    if (!Array.isArray(candidate?.content?.parts)) {
      return;
    }

    candidate.content.parts.forEach((part) => {
      if (typeof part?.text === 'string') {
        textParts.push(part.text);
      }
    });
  });

  return textParts.join('\n').trim();
}

function makeJsonSchema(allowedDatasets, allowedColumns) {
  const pinnedProps = Object.fromEntries(
    allowedColumns.map((column) => [column, { type: ['string', 'null'] }]),
  );

  const widthProps = Object.fromEntries(
    allowedColumns.map((column) => [column, { type: 'number', minimum: 40 }]),
  );

  const filtersProps = Object.fromEntries(
    allowedColumns.map((column) => [
      column,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          operator: {
            type: 'string',
            enum: [
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
            ],
          },
          value: {
            type: ['string', 'number', 'boolean', 'array', 'null'],
          },
        },
        required: ['operator'],
      },
    ]),
  );

  const aggregationsProps = Object.fromEntries(
    allowedColumns
      .filter((column) => column === 'amount')
      .map((column) => [
        column,
        { type: 'string', enum: ['sum', 'avg', 'min', 'max', 'count'] },
      ]),
  );

  const configSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      version: {
        type: 'number',
        enum: [2],
      },
      datasetId: {
        type: 'string',
        enum: allowedDatasets,
      },
      columns: {
        type: 'object',
        additionalProperties: false,
        properties: {
          order: {
            type: 'array',
            items: {
              type: 'string',
              enum: allowedColumns,
            },
          },
          hidden: {
            type: 'array',
            items: {
              type: 'string',
              enum: allowedColumns,
            },
          },
          pinned: {
            type: 'object',
            additionalProperties: false,
            properties: pinnedProps,
          },
          widths: {
            type: 'object',
            additionalProperties: false,
            properties: widthProps,
          },
        },
        required: ['order', 'hidden', 'pinned', 'widths'],
      },
      sort: {
        type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
            field: {
              type: 'string',
              enum: allowedColumns,
            },
            direction: {
              type: 'string',
              enum: ['asc', 'desc'],
            },
          },
          required: ['field', 'direction'],
        },
      },
      filters: {
        type: 'object',
        additionalProperties: false,
        properties: filtersProps,
      },
      groupBy: {
        type: 'array',
        items: {
          type: 'string',
          enum: allowedColumns,
        },
      },
      aggregations: {
        type: 'object',
        additionalProperties: false,
        properties: aggregationsProps,
      },
      subtotals: {
        type: 'object',
        additionalProperties: false,
        properties: {
          enabled: {
            type: 'boolean',
          },
          position: {
            type: 'string',
            enum: ['top', 'bottom'],
          },
        },
        required: ['enabled', 'position'],
      },
    },
    required: [
      'version',
      'datasetId',
      'columns',
      'sort',
      'filters',
      'groupBy',
      'aggregations',
      'subtotals',
    ],
  };

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: {
        type: 'string',
        enum: ['table_config', 'table_config_patch', 'analysis_answer', 'clarification'],
      },
      config: configSchema,
      patch: {
        type: 'object',
        additionalProperties: true,
      },
      answer: {
        type: 'string',
      },
      insights: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      recommendedActions: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      supportingRows: {
        type: 'array',
        items: {
          type: ['number', 'string'],
        },
      },
      metrics: {
        type: 'object',
        additionalProperties: true,
      },
      suggestedConfigPatch: {
        type: 'object',
        additionalProperties: true,
      },
      question: {
        type: 'string',
      },
      suggestions: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      explanation: {
        type: 'string',
      },
    },
    required: ['type'],
  };
}

function buildModelPrompt({
  prompt,
  intent,
  currentConfig,
  selectedDatasetId,
  selectedDatasetLabel,
  selectedDatasetSchema,
  allowedFields,
  allowedOperators,
  allowedAggregationFunctions,
  rows,
  analysisStats,
  previewRows,
  datasets,
  columns,
  schemaVersion,
}) {
  return `
User request:
${prompt}

Detected intent:
${intent || 'table_config'}

Current table config:
${JSON.stringify(currentConfig, null, 2)}

Selected dataset:
${JSON.stringify({ id: selectedDatasetId, label: selectedDatasetLabel }, null, 2)}

Selected dataset schema:
${JSON.stringify(selectedDatasetSchema || [], null, 2)}

Allowed fields:
${JSON.stringify(allowedFields || columns, null, 2)}

Allowed operators:
${JSON.stringify(allowedOperators || [], null, 2)}

Allowed aggregation functions:
${JSON.stringify(allowedAggregationFunctions || [], null, 2)}

Preview rows:
${JSON.stringify(previewRows || [], null, 2)}

Evidence/sample rows, never the full production dataset:
${JSON.stringify(rows || [], null, 2)}

Locally calculated analysis stats:
${JSON.stringify(analysisStats || {}, null, 2)}

Allowed datasets:
${JSON.stringify(datasets, null, 2)}

Allowed columns:
${JSON.stringify(columns, null, 2)}

Schema version:
${schemaVersion}
`;
}

function buildAnalysisModelPrompt({
  prompt,
  selectedDatasetId,
  selectedDatasetLabel,
  selectedDatasetSchema,
  rows,
  analysisStats,
  previewRows,
  chatHistory,
}) {
  const historyLines = Array.isArray(chatHistory) && chatHistory.length > 0
    ? chatHistory
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n')
    : null;

  return `
Dataset:
${JSON.stringify({ id: selectedDatasetId, label: selectedDatasetLabel }, null, 2)}

Schema:
${JSON.stringify(selectedDatasetSchema || [], null, 2)}

Computed analysis stats:
${JSON.stringify(analysisStats || {}, null, 2)}

Evidence rows:
${JSON.stringify(rows || [], null, 2)}

Preview rows:
${JSON.stringify(previewRows || [], null, 2)}
${historyLines ? `\nPrior conversation (for context only — do not repeat or summarize it):\n${historyLines}\n` : ''}
Current user message:
${prompt}

Return exactly one JSON object with this shape:
{
  "type": "analysis_answer",
  "answer": "helpful conversational answer",
  "insights": ["optional useful detail grounded in metadata, evidence rows, or computed stats"],
  "recommendedActions": ["optional next step if useful"],
  "supportingRows": [],
  "suggestedConfigPatch": {}
}

Rules:
- Use computed analysis stats for numbers.
- Use evidence rows for examples only.
- supportingRows must be an array of rowNumber values only, not full row objects.
- Do not echo the schema, allowed fields, or this prompt.
- If the question asks about a field that does not exist, say so directly and suggest the closest available dimensions.
- You are allowed to answer simple schema or metadata questions directly, such as listing columns or explaining a field.
- This is a back-and-forth chat. Use prior conversation context to interpret follow-up questions. Stay grounded in the supplied dataset — do not invent data from outside it.
`;
}

async function requestConfigFromGemini(payload, { apiKey, model }) {
  const {
    prompt,
    intent,
    currentConfig,
    selectedDatasetId,
    selectedDatasetLabel,
    selectedDatasetSchema,
    allowedFields,
    allowedOperators,
    allowedAggregationFunctions,
    rows,
    analysisStats,
    previewRows,
    datasets,
    columns,
    schemaVersion,
    chatHistory,
  } = payload;

  const normalizedModel = normalizeGeminiModel(model);
  const promptText =
    intent === 'analysis_answer'
      ? buildAnalysisModelPrompt({
          prompt,
          selectedDatasetId,
          selectedDatasetLabel,
          selectedDatasetSchema,
          rows,
          analysisStats,
          previewRows,
          chatHistory,
        })
      : buildModelPrompt({
          prompt,
          intent,
          currentConfig,
          selectedDatasetId,
          selectedDatasetLabel,
          selectedDatasetSchema,
          allowedFields,
          allowedOperators,
          allowedAggregationFunctions,
          rows,
          analysisStats,
          previewRows,
          datasets,
          columns,
          schemaVersion,
        });

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/${normalizedModel}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: CONFIG_TRANSLATOR_SYSTEM_PROMPT,
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  let responseJson = {};
  try {
    responseJson = await response.json();
  } catch (_error) {
    responseJson = {};
  }

  if (!response.ok) {
    const apiMessage =
      extractGeminiErrorMessage(responseJson) ||
      'Gemini API request failed while generating config.';
    const error = new Error(apiMessage);
    error.statusCode = response.status;
    const retryAfterSec = extractRetryAfterSeconds(responseJson, apiMessage);
    if (retryAfterSec) {
      error.retryAfterSec = retryAfterSec;
    }
    throw error;
  }

  const modelError = extractGeminiErrorMessage(responseJson);
  if (modelError) {
    throw new Error(modelError);
  }

  const rawText = extractGeminiResponseText(responseJson);
  if (!rawText) {
    throw new Error('Gemini returned an empty response.');
  }

  const parsedConfig = parseModelJson(rawText, 'Gemini');
  const normalizedResult = normalizeParsedModelResult(parsedConfig, {
    modelLabel: 'Gemini',
    intent,
  });

  const modelVersion = responseJson?.modelVersion || normalizedModel;
  return {
    ...normalizedResult,
    model: modelVersion,
  };
}

async function requestConfigFromOllama(payload, { baseUrl, model }) {
  const {
    prompt,
    intent,
    currentConfig,
    selectedDatasetId,
    selectedDatasetLabel,
    selectedDatasetSchema,
    allowedFields,
    allowedOperators,
    allowedAggregationFunctions,
    rows,
    analysisStats,
    previewRows,
    datasets,
    columns,
    schemaVersion,
    chatHistory,
  } = payload;

  const normalizedBaseUrl =
    typeof baseUrl === 'string' && baseUrl.trim()
      ? baseUrl.trim().replace(/\/$/, '')
      : DEFAULT_OLLAMA_BASE_URL;
  const normalizedModel =
    typeof model === 'string' && model.trim()
      ? model.trim()
      : DEFAULT_OLLAMA_MODEL;
  const promptText =
    intent === 'analysis_answer'
      ? buildAnalysisModelPrompt({
          prompt,
          selectedDatasetId,
          selectedDatasetLabel,
          selectedDatasetSchema,
          rows,
          analysisStats,
          previewRows,
          chatHistory,
        })
      : buildModelPrompt({
          prompt,
          intent,
          currentConfig,
          selectedDatasetId,
          selectedDatasetLabel,
          selectedDatasetSchema,
          allowedFields,
          allowedOperators,
          allowedAggregationFunctions,
          rows,
          analysisStats,
          previewRows,
          datasets,
          columns,
          schemaVersion,
        });

  const response = await fetch(`${normalizedBaseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: normalizedModel,
      system: CONFIG_TRANSLATOR_SYSTEM_PROMPT,
      prompt: promptText,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1,
      },
    }),
  });

  let responseJson = {};
  try {
    responseJson = await response.json();
  } catch (_error) {
    responseJson = {};
  }

  if (!response.ok) {
    const message =
      typeof responseJson?.error === 'string' && responseJson.error.trim()
        ? responseJson.error.trim()
        : 'Ollama API request failed while generating config.';
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const parsedConfig = parseModelJson(responseJson.response, 'Ollama');
  const normalizedResult = normalizeParsedModelResult(parsedConfig, {
    modelLabel: 'Ollama',
    intent,
  });
  return {
    ...normalizedResult,
    model: `ollama/${normalizedModel}`,
  };
}

async function requestConfigFromModel(payload, settings) {
  if (settings.provider === 'ollama') {
    return requestConfigFromOllama(payload, settings);
  }

  return requestConfigFromGemini(payload, settings);
}

function validateClientPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Request payload must be a JSON object.');
  }

  if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
    throw new Error('`prompt` must be a non-empty string.');
  }

  if (
    !payload.currentConfig ||
    typeof payload.currentConfig !== 'object' ||
    Array.isArray(payload.currentConfig)
  ) {
    throw new Error('`currentConfig` must be an object.');
  }

  if (!Array.isArray(payload.datasets) || payload.datasets.length === 0) {
    throw new Error('`datasets` must be a non-empty array.');
  }

  if (!Array.isArray(payload.columns) || payload.columns.length === 0) {
    throw new Error('`columns` must be a non-empty array.');
  }

  if (typeof payload.schemaVersion !== 'number') {
    throw new Error('`schemaVersion` must be a number.');
  }
}

// ── DuckDB ──────────────────────────────────────────────────────────────────

let _duckdbInitPromise = null;

function getDuckDBConnection() {
  if (!_duckdbInitPromise) {
    _duckdbInitPromise = new Promise((resolve) => {
      const db = new duckdb.Database(':memory:');
      const conn = db.connect();
      resolve(conn);
    });
  }
  return _duckdbInitPromise;
}

async function queryDuckDB(sql) {
  const conn = await getDuckDBConnection();
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// ── Structured query builder ──────────────────────────────────────────────────
// The model outputs structured operation JSON; we generate SQL — never the model.

function quoteName(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function quoteLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (Array.isArray(val)) return '(' + val.map(quoteLiteral).join(', ') + ')';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

const CONDITION_OPS = {
  eq:       (col, val) => `${col} = ${quoteLiteral(val)}`,
  ne:       (col, val) => `${col} != ${quoteLiteral(val)}`,
  gt:       (col, val) => `${col} > ${quoteLiteral(val)}`,
  lt:       (col, val) => `${col} < ${quoteLiteral(val)}`,
  gte:      (col, val) => `${col} >= ${quoteLiteral(val)}`,
  lte:      (col, val) => `${col} <= ${quoteLiteral(val)}`,
  in:       (col, val) => `${col} IN ${quoteLiteral(Array.isArray(val) ? val : [val])}`,
  not_in:   (col, val) => `${col} NOT IN ${quoteLiteral(Array.isArray(val) ? val : [val])}`,
  contains: (col, val) => `${col} ILIKE ${quoteLiteral('%' + String(val) + '%')}`,
  like:     (col, val) => `${col} LIKE ${quoteLiteral(val)}`,
  between:  (col, val) => Array.isArray(val) && val.length >= 2
    ? `${col} BETWEEN ${quoteLiteral(val[0])} AND ${quoteLiteral(val[1])}`
    : 'TRUE',
  is_null:  (col)      => `${col} IS NULL`,
  not_null: (col)      => `${col} IS NOT NULL`,
};

function buildConditionSql(condition) {
  const col = quoteName(condition.column);
  const fn = CONDITION_OPS[condition.op || 'eq'];
  if (!fn) throw new Error(`Unknown filter operator "${condition.op}"`);
  return fn(col, condition.value);
}

function buildAggSql(agg) {
  const fn = String(agg.fn || 'COUNT').toUpperCase();
  const alias = quoteName(agg.alias || `${fn}_${agg.column}`);
  if (fn === 'COUNT_DISTINCT') return `COUNT(DISTINCT ${quoteName(agg.column)}) AS ${alias}`;
  const col = agg.column === '*' ? '*' : quoteName(agg.column);
  return `${fn}(${col}) AS ${alias}`;
}

function buildStepSql(step, source) {
  switch (step.op) {
    case 'filter': {
      const conds = (step.conditions || []).map(buildConditionSql);
      const logic = step.logic === 'OR' ? ' OR ' : ' AND ';
      const where = conds.length ? `WHERE ${conds.join(logic)}` : '';
      return `SELECT * FROM ${source}${where ? ' ' + where : ''}`;
    }
    case 'groupBy': {
      const groupCols = (step.columns || []).map(quoteName);
      const aggs = (step.aggregations || []).map(buildAggSql);
      const select = [...groupCols, ...aggs].join(', ');
      let sql = `SELECT ${select} FROM ${source}`;
      if (groupCols.length > 0) sql += ` GROUP BY ${groupCols.join(', ')}`;
      if (step.sort) {
        const dir = String(step.sort.direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        sql += ` ORDER BY ${quoteName(step.sort.column)} ${dir}`;
      }
      if (step.limit) sql += ` LIMIT ${Math.max(1, Number(step.limit))}`;
      return sql;
    }
    case 'sort': {
      const orderBy = (step.by || []).map(b => {
        const dir = String(b.direction || 'ASC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        return `${quoteName(b.column)} ${dir}`;
      }).join(', ');
      let sql = `SELECT * FROM ${source}${orderBy ? ` ORDER BY ${orderBy}` : ''}`;
      if (step.limit) sql += ` LIMIT ${Math.max(1, Number(step.limit))}`;
      return sql;
    }
    case 'select': {
      const cols = (step.columns || []).map(quoteName).join(', ');
      return `SELECT ${cols || '*'} FROM ${source}`;
    }
    case 'topN': {
      const dir = String(step.direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const n = Math.max(1, Number(step.n) || 10);
      return `SELECT * FROM ${source} ORDER BY ${quoteName(step.column)} ${dir} LIMIT ${n}`;
    }
    case 'distinct': {
      const cols = (step.columns || []).map(quoteName);
      const colSql = cols.join(', ') || '*';
      return `SELECT DISTINCT ${colSql} FROM ${source} ORDER BY ${colSql}`;
    }
    case 'pivot': {
      const fn = String(step.fn || 'COUNT').toUpperCase();
      const valCol = step.valueColumn ? quoteName(step.valueColumn) : null;
      const using = (fn === 'COUNT' || !valCol) ? 'COUNT(*)' : `${fn}(${valCol})`;
      return `SELECT * FROM (PIVOT ${source} ON ${quoteName(step.colColumn)} USING ${using} GROUP BY ${quoteName(step.rowColumn)}) ORDER BY ${quoteName(step.rowColumn)}`;
    }
    case 'timeSeries': {
      const gran = ['day','week','month','quarter','year'].includes(step.granularity)
        ? step.granularity : 'month';
      const aggs = (step.aggregations || []).map(buildAggSql).join(', ');
      return `SELECT DATE_TRUNC('${gran}', TRY_CAST(${quoteName(step.dateColumn)} AS DATE)) AS period, ${aggs} FROM ${source} GROUP BY period ORDER BY period ASC`;
    }
    case 'compare': {
      const metricAggs = (step.metrics || []).map(buildAggSql).join(', ') || 'COUNT(*) AS "count"';
      const parts = (step.segments || []).map(seg => {
        const conds = (seg.conditions || []).map(buildConditionSql);
        const logic = seg.logic === 'OR' ? ' OR ' : ' AND ';
        const where = conds.length ? ` WHERE ${conds.join(logic)}` : '';
        return `SELECT ${quoteLiteral(seg.label)} AS segment, ${metricAggs} FROM ${source}${where}`;
      });
      return parts.join('\nUNION ALL\n');
    }
    default:
      throw new Error(`Unknown operation: "${step.op}"`);
  }
}

function extractSortFromStep(step) {
  switch (step.op) {
    case 'sort':
      return (step.by || []).map(b => ({
        field: b.column,
        direction: String(b.direction || 'asc').toLowerCase() === 'asc' ? 'asc' : 'desc',
      }));
    case 'groupBy':
      return step.sort ? [{
        field: step.sort.column,
        direction: String(step.sort.direction || 'DESC').toLowerCase() === 'asc' ? 'asc' : 'desc',
      }] : [];
    case 'topN':
      return [{ field: step.column, direction: String(step.direction || 'DESC').toLowerCase() === 'asc' ? 'asc' : 'desc' }];
    case 'timeSeries':
      return [{ field: 'period', direction: 'asc' }];
    default:
      return [];
  }
}

function getStepColumnRefs(step) {
  switch (step.op) {
    case 'filter':
      return (step.conditions || []).map(c => c.column).filter(Boolean);
    case 'groupBy':
      // step.sort.column is excluded: it may be an aggregation alias, not a real schema column
      return [
        ...(step.columns || []),
        ...(step.aggregations || []).map(a => a.column).filter(c => c && c !== '*'),
      ].filter(Boolean);
    case 'sort':
      return (step.by || []).map(b => b.column).filter(Boolean);
    case 'select':
    case 'distinct':
      return step.columns || [];
    case 'topN':
      return [step.column].filter(Boolean);
    case 'pivot':
      return [step.rowColumn, step.colColumn, step.valueColumn].filter(Boolean);
    case 'timeSeries':
      return [
        step.dateColumn,
        ...(step.aggregations || []).map(a => a.column).filter(c => c && c !== '*'),
      ].filter(Boolean);
    case 'compare':
      return [
        ...(step.segments || []).flatMap(s => (s.conditions || []).map(c => c.column)),
        ...(step.metrics || []).map(m => m.column).filter(c => c && c !== '*'),
      ].filter(Boolean);
    default:
      return [];
  }
}

// Only validate the first step — later steps may reference aliases from prior results
function validateStepColumns(step, schema, stepIndex) {
  if (stepIndex > 0) return;
  const validCols = new Set((schema || []).map(f => f.field));
  const refs = getStepColumnRefs(step);
  const invalid = refs.filter(col => !validCols.has(col));
  if (invalid.length > 0) {
    throw new Error(
      `Step 1 (${step.op}) references unknown column(s): ${invalid.join(', ')}. ` +
      `Valid columns: ${[...validCols].join(', ')}`,
    );
  }
}

// Compute which column names a step produces given its input columns.
// Returns null for ops where output columns can't be determined statically (pivot).
function getStepOutputColumns(step, inputColumns) {
  switch (step.op) {
    case 'filter':
    case 'sort':
    case 'topN':
      return [...inputColumns];
    case 'select':
    case 'distinct':
      return [...(step.columns || [])];
    case 'groupBy':
      return [
        ...(step.columns || []),
        ...(step.aggregations || []).map(a => a.alias || `${String(a.fn).toUpperCase()}_${a.column}`),
      ];
    case 'timeSeries':
      return ['period', ...(step.aggregations || []).map(a => a.alias || `${String(a.fn).toUpperCase()}_${a.column}`)];
    case 'compare':
      return ['segment', ...(step.metrics || []).map(m => m.alias || `${String(m.fn).toUpperCase()}_${m.column}`)];
    default:
      return null; // pivot: column names depend on data values, unknowable statically
  }
}

// Drop steps whose column references can't be satisfied by the current pipeline state.
// This catches redundant/misplaced steps the model generates (e.g. a second groupBy that
// references the original `amount` column after it was already aliased to `totalAmount`).
function pruneInvalidSteps(steps, schema) {
  const originalCols = (schema || []).map(f => f.field);
  let currentCols = [...originalCols];
  const valid = [];

  for (const step of steps) {
    const refs = getStepColumnRefs(step);
    const colSet = new Set(currentCols);
    const missing = refs.filter(col => !colSet.has(col));

    if (missing.length > 0) {
      console.log(`[stream] pruning step (${step.op}) — references unavailable columns: ${missing.join(', ')}`);
      continue;
    }

    valid.push(step);
    const next = getStepOutputColumns(step, currentCols);
    if (next !== null) currentCols = next;
  }

  return valid;
}

// Reorder steps so filter/sort ops on original schema columns always precede aggregations.
// Models often generate groupBy before filter, which loses original columns in the pipeline.
function reorderStepPlan(steps, schema) {
  const originalCols = new Set((schema || []).map(f => f.field));
  const AGG_OPS = new Set(['groupBy', 'timeSeries', 'pivot', 'compare']);

  // Filters whose conditions reference ONLY original schema columns can safely move before any agg step.
  // Filters on computed aliases (e.g. totalRevenue > 1000) must stay after the agg that created them.
  const preFilters = [];
  const rest = [];

  for (const step of steps) {
    if (step.op === 'filter') {
      const refs = getStepColumnRefs(step);
      if (refs.length > 0 && refs.every(col => originalCols.has(col))) {
        preFilters.push(step);
        continue;
      }
    }
    rest.push(step);
  }

  // Only reorder if there's actually an agg step that a filter was crossing
  const hasAggInRest = rest.some(s => AGG_OPS.has(s.op));
  if (preFilters.length === 0 || !hasAggInRest) return steps;

  console.log('[stream] reordered step plan: moved', preFilters.length, 'filter(s) before aggregation');
  return [...preFilters, ...rest];
}

async function ensureDatasetTable(tableId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const conn = await getDuckDBConnection();
  // NDJSON (one object per line) — most reliable format for read_json_auto
  const ndjson = rows.map((r) => JSON.stringify(r)).join('\n');
  const tmpFile = path.join(os.tmpdir(), `dq_${tableId}.ndjson`).replace(/\\/g, '/');
  fs.writeFileSync(tmpFile, ndjson, 'utf8');
  // Use conn.run (not conn.all) for DDL — conn.all on DDL corrupts the connection state
  return new Promise((resolve, reject) => {
    conn.run(
      `CREATE OR REPLACE VIEW "${tableId}" AS SELECT * FROM read_json_auto('${tmpFile}')`,
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

// ── Streaming model prompts ──────────────────────────────────────────────────

function buildFewShotExamples(selectedDatasetId) {
  const isPayment = ['payments', 'adjustments', 'exceptions'].includes(selectedDatasetId);
  const isCandy = selectedDatasetId === 'candy';
  const ex = (q, a) => ({ q, a });

  const shared = [
    // Direct reasoning — no SQL needed
    ex(
      'What should we focus on operationally?',
      { needsQuery: false, answer: 'Focus on the highest-risk or highest-value items first. Review any failures or anomalies before routine records.', insights: ['Prioritizing by value maximizes impact per hour of effort.'], recommendedActions: ['Sort by the primary metric descending and work top-down.'] }
    ),
    // Current view scope
    ex(
      'Within the current view, what does the total come to?',
      { needsQuery: true, scope: 'current_view', steps: [
        { label: 'Summing amounts in current view', op: 'groupBy', columns: [], aggregations: [{ column: 'amount', fn: 'SUM', alias: 'totalAmount' }] },
      ]}
    ),
  ];

  const paymentExamples = !isPayment ? [] : [
    // Whole-dataset scalar aggregate — columns MUST be [] for a grand total
    ex(
      'What is the total value of all payments?',
      { needsQuery: true, scope: 'base_dataset', steps: [
        { label: 'Summing all payment amounts', op: 'groupBy', columns: [], aggregations: [{ column: 'amount', fn: 'SUM', alias: 'totalAmount' }] },
      ]}
    ),
    // Filter → scalar aggregate (the most common failure pattern)
    ex(
      'What is the total value of failed payments?',
      { needsQuery: true, scope: 'base_dataset', steps: [
        { label: 'Filtering to failed payments', op: 'filter', conditions: [{ column: 'status', op: 'eq', value: 'Failed' }] },
        { label: 'Summing failed payment amounts', op: 'groupBy', columns: [], aggregations: [{ column: 'amount', fn: 'SUM', alias: 'totalFailedAmount' }] },
      ]}
    ),
    // Filter → grouped count — "riskiest" pattern
    ex(
      'Which payment method appears riskiest?',
      { needsQuery: true, scope: 'base_dataset', steps: [
        { label: 'Filtering to failed payments', op: 'filter', conditions: [{ column: 'status', op: 'eq', value: 'Failed' }] },
        { label: 'Counting failures and total exposure by payment method', op: 'groupBy', columns: ['paymentMethod'], aggregations: [{ column: '*', fn: 'COUNT', alias: 'failedCount' }, { column: 'amount', fn: 'SUM', alias: 'failedTotal' }], sort: { column: 'failedTotal', direction: 'DESC' } },
      ]}
    ),
    // Simple grouped count without filter
    ex(
      'How many payments are there by status?',
      { needsQuery: true, scope: 'base_dataset', steps: [
        { label: 'Counting payments by status', op: 'groupBy', columns: ['status'], aggregations: [{ column: '*', fn: 'COUNT', alias: 'count' }, { column: 'amount', fn: 'SUM', alias: 'totalAmount' }], sort: { column: 'count', direction: 'DESC' } },
      ]}
    ),
    // Ranking carriers
    ex(
      'Which carrier has the biggest failed payment exposure?',
      { needsQuery: true, scope: 'base_dataset', steps: [
        { label: 'Filtering to failed payments', op: 'filter', conditions: [{ column: 'status', op: 'eq', value: 'Failed' }] },
        { label: 'Ranking carriers by failed exposure', op: 'groupBy', columns: ['carrier'], aggregations: [{ column: 'amount', fn: 'SUM', alias: 'failedExposure' }, { column: '*', fn: 'COUNT', alias: 'failedCount' }], sort: { column: 'failedExposure', direction: 'DESC' } },
      ]}
    ),
    // Strategy — direct answer
    ex(
      'What should we prioritize for collections follow-up?',
      { needsQuery: false, answer: 'Prioritize high-value failed and pending payments first, grouped by carrier to assign ownership. Work top-down by amount to maximize recovery.', insights: ['Failed payments represent immediate recovery risk.', 'Pending payments may age into exceptions if unresolved.'], recommendedActions: ['Filter to Failed and Pending, sort by amount descending, assign by carrier.'] }
    ),
  ];

  const candyExamples = !isCandy ? [] : [
    // Whole-dataset scalar
    ex(
      'What is our total revenue?',
      { needsQuery: true, scope: 'base_dataset', steps: [
        { label: 'Summing all sales revenue', op: 'groupBy', columns: [], aggregations: [{ column: 'total', fn: 'SUM', alias: 'totalRevenue' }, { column: '*', fn: 'COUNT', alias: 'transactions' }] },
      ]}
    ),
    // Filter → scalar
    ex(
      'What is the total revenue from gummy products?',
      { needsQuery: true, scope: 'base_dataset', steps: [
        { label: 'Filtering to gummy category', op: 'filter', conditions: [{ column: 'category', op: 'eq', value: 'Gummy' }] },
        { label: 'Summing gummy revenue', op: 'groupBy', columns: [], aggregations: [{ column: 'total', fn: 'SUM', alias: 'gummyRevenue' }] },
      ]}
    ),
    // Ranking products
    ex(
      'Which products are selling the most?',
      { needsQuery: true, scope: 'base_dataset', steps: [
        { label: 'Ranking products by quantity sold', op: 'groupBy', columns: ['product', 'category'], aggregations: [{ column: 'quantity', fn: 'SUM', alias: 'totalQuantity' }, { column: 'total', fn: 'SUM', alias: 'totalRevenue' }], sort: { column: 'totalQuantity', direction: 'DESC' }, limit: 15 },
      ]}
    ),
    // Marketing channel analysis
    ex(
      'Which marketing channel drives the most revenue?',
      { needsQuery: true, scope: 'base_dataset', steps: [
        { label: 'Analyzing revenue by marketing channel', op: 'groupBy', columns: ['marketingChannel'], aggregations: [{ column: 'total', fn: 'SUM', alias: 'totalRevenue' }, { column: '*', fn: 'COUNT', alias: 'transactions' }], sort: { column: 'totalRevenue', direction: 'DESC' } },
      ]}
    ),
    // Strategy — direct answer
    ex(
      'Which age group should we target for marketing?',
      { needsQuery: false, answer: 'Younger segments (Kids, Teens) dominate high-volume categories like Gummy, Sour, and Lollipop. Adults and Seniors drive Chocolate and Hard Candy — higher unit prices but lower volume.', insights: ['Impulse buys skew younger; gifting and personal treat occasions skew adult.'], recommendedActions: ['Run social media campaigns targeting Teens for Gummy/Sour. Target Adults with chocolate premium bundles during holidays.'] }
    ),
  ];

  return [...paymentExamples, ...candyExamples, ...shared];
}

function buildStructuredQueryPrompt({ prompt, selectedDatasetId, selectedDatasetLabel, selectedDatasetSchema, sampleRows, chatHistory, totalRowCount, currentViewRowCount }) {
  const allFields = (selectedDatasetSchema || []).map(f => f.field);
  const numericFields = (selectedDatasetSchema || []).filter(f => f.numeric).map(f => f.field);
  const textFields = allFields.filter(f => !numericFields.includes(f));

  const historyBlock = Array.isArray(chatHistory) && chatHistory.length > 0
    ? `Conversation so far:\n${chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}\n\n`
    : '';
  const sampleBlock = Array.isArray(sampleRows) && sampleRows.length > 0
    ? `\nSample rows (shows real values):\n${JSON.stringify(sampleRows.slice(0, 8), null, 2)}`
    : '';
  const viewContext = (typeof currentViewRowCount === 'number' && typeof totalRowCount === 'number')
    ? `\nGrid state: ${currentViewRowCount} of ${totalRowCount} rows currently visible (grid may be filtered/sorted)`
    : '';

  const examples = buildFewShotExamples(selectedDatasetId);
  const examplesBlock = examples.length > 0
    ? `\nEXAMPLES — follow these exact patterns:\n${examples.map((e, i) =>
        `[${i + 1}] Q: "${e.q}"\n    A: ${JSON.stringify(e.a)}`
      ).join('\n')}\n`
    : '';

  return `You are a data analyst assistant. Decide whether the question requires querying the data or can be answered directly.

${historyBlock}User question: ${prompt}

Dataset: ${selectedDatasetLabel}
Table: ${selectedDatasetId}
Total rows in dataset: ${totalRowCount || 'unknown'}${viewContext}
All columns: ${allFields.join(', ')}
Numeric columns: ${numericFields.join(', ')}
Text/categorical columns: ${textFields.join(', ')}${sampleBlock}

Return ONE of these two JSON shapes:

── SHAPE A: Direct answer (no query needed) ──
Use when: strategy, interpretation, recommendations, demographic reasoning, or general knowledge questions.
{
  "needsQuery": false,
  "answer": "2-4 sentence answer",
  "insights": ["key observation"],
  "recommendedActions": ["optional next step"]
}

── SHAPE B: Structured query ──
Use when: counting, ranking, aggregating, filtering, or comparing actual data values.
{
  "needsQuery": true,
  "scope": "base_dataset",
  "steps": [
    { "label": "Filtering to chocolate products", "op": "filter", ... },
    { "label": "Ranking products by revenue", "op": "groupBy", ... }
  ]
}

SCOPE field (required for needsQuery: true):
- "base_dataset" — DEFAULT. Always use this unless the user explicitly asks about what is currently visible. Queries the full original dataset regardless of any grid filters the user has applied.
- "current_view" — Use ONLY when the user explicitly says: "current view", "visible rows", "shown rows", "this filtered table", "these rows", "what I'm looking at". Queries only the rows currently visible in the grid.
- "selected_rows" — Use ONLY when the user says "selected rows" or "highlighted rows".

When in doubt, use "base_dataset". A question like "which carrier uses ACH the most?" always means the full dataset even if the grid happens to be filtered to ACH.

Each step runs on the result of the previous step. Use 1–3 steps. End with the most informative result for the grid.

AVAILABLE OPERATIONS:

filter — Remove rows that don't match conditions
{ "op": "filter", "conditions": [{"column": "colName", "op": "eq|ne|gt|lt|gte|lte|in|not_in|contains|between|is_null|not_null", "value": ...}], "logic": "AND" }
  op values: eq (=), ne (≠), gt (>), lt (<), gte (≥), lte (≤), in (value is array), not_in (value is array), contains (substring match), between (value is [min, max]), is_null / not_null (no value)

groupBy — Group rows and compute aggregates per group
{ "op": "groupBy", "columns": ["groupCol"], "aggregations": [{"column": "numericCol", "fn": "SUM|AVG|COUNT|COUNT_DISTINCT|MIN|MAX", "alias": "friendlyName"}], "sort": {"column": "aliasOrCol", "direction": "DESC"}, "limit": 20 }
  Use column "*" with fn "COUNT" to count rows per group. alias is required.
  IMPORTANT: COUNT(column) counts ALL non-null values of that column — it does NOT filter by value. To count only rows matching a condition (e.g. failed payments), add a filter step before this groupBy, then use COUNT("*").

sort — Reorder rows
{ "op": "sort", "by": [{"column": "col", "direction": "DESC"}], "limit": 50 }

select — Show only specific columns
{ "op": "select", "columns": ["col1", "col2"] }

topN — Get top or bottom N rows by a column value
{ "op": "topN", "column": "col", "direction": "DESC", "n": 10 }

distinct — Get unique value combinations
{ "op": "distinct", "columns": ["col"] }

pivot — Cross-tabulate two categorical columns
{ "op": "pivot", "rowColumn": "colA", "colColumn": "colB", "valueColumn": "numericCol", "fn": "COUNT|SUM|AVG" }

timeSeries — Group by a date field over time
{ "op": "timeSeries", "dateColumn": "dateCol", "granularity": "day|week|month|quarter|year", "aggregations": [{"column": "col", "fn": "SUM", "alias": "name"}] }

compare — Side-by-side summary of two data segments
{ "op": "compare", "segments": [{"label": "Segment A", "conditions": [...], "logic": "AND"}, {"label": "Segment B", "conditions": [...]}], "metrics": [{"column": "col", "fn": "SUM", "alias": "name"}] }
${examplesBlock}
RULES:
- Use ONLY these exact column names from the original dataset: ${allFields.join(', ')}
- Steps execute in sequence — each step only sees columns produced by the previous step, NOT the original dataset columns
- ALWAYS filter before aggregating: filter → groupBy (never groupBy → filter on an original column)
- After a groupBy, only the group columns and aggregation aliases exist — do not reference original columns in later steps
- After a filter, all original columns still exist — safe to groupBy, sort, or select after filtering
- "label" is a short present-continuous phrase shown while the step runs (e.g. "Filtering to paid transactions")
- For "how many X?" questions: use groupBy with COUNT to show a breakdown, never a single scalar
- For comparisons between categories: prefer groupBy or compare rather than multiple filter steps
- For time-based questions: use timeSeries if a date column exists
- Never invent column names`;
}

function describeAgg(a) {
  const fn = String(a.fn || 'COUNT').toUpperCase();
  const col = a.column === '*' ? 'every row' : `non-null "${a.column}" values`;
  const meaning = fn === 'COUNT' || fn === 'COUNT_DISTINCT'
    ? `counts ${col} per group — NOT filtered to any specific value unless a FILTER step preceded this`
    : `${fn} of "${a.column}" per group`;
  return `${fn}(${a.column}) as "${a.alias}" [${meaning}]`;
}

function describeSteps(steps) {
  const hasFilter = (steps || []).some(s => s.op === 'filter');
  const lines = (steps || []).map((s, i) => {
    const n = i + 1;
    switch (s.op) {
      case 'filter': {
        const conds = (s.conditions || [])
          .map(c => `${c.column} ${c.op} ${Array.isArray(c.value) ? '[' + c.value.join(', ') + ']' : c.value}`)
          .join(` ${s.logic || 'AND'} `);
        return `Step ${n}: FILTER — keep only rows where ${conds}`;
      }
      case 'groupBy': {
        const aggs = (s.aggregations || []).map(describeAgg).join(', ');
        const sort = s.sort ? `, sorted by ${s.sort.column} ${s.sort.direction}` : '';
        return `Step ${n}: GROUP BY ${(s.columns || []).join(', ')} → ${aggs}${sort}`;
      }
      case 'sort':
        return `Step ${n}: SORT by ${(s.by || []).map(b => `${b.column} ${b.direction}`).join(', ')}`;
      case 'topN':
        return `Step ${n}: TOP ${s.n} rows by ${s.column} ${s.direction}`;
      case 'distinct':
        return `Step ${n}: DISTINCT values of ${(s.columns || []).join(', ')}`;
      case 'timeSeries':
        return `Step ${n}: TIME SERIES — group ${s.dateColumn} by ${s.granularity} → ${(s.aggregations || []).map(describeAgg).join(', ')}`;
      case 'compare':
        return `Step ${n}: COMPARE — ${(s.segments || []).map(seg => seg.label).join(' vs ')}`;
      default:
        return `Step ${n}: ${s.op}`;
    }
  });

  if (!hasFilter) {
    lines.push('NOTE: No FILTER step was applied — all aggregations are over the complete unfiltered dataset.');
  }

  return lines.join('\n');
}

function computeSummaryFacts(columns, rows, steps) {
  const facts = { resultRowCount: rows.length, distinctCounts: {} };

  for (const col of columns) {
    const unique = new Set(rows.map(r => r[col]).filter(v => v != null && v !== ''));
    facts.distinctCounts[col] = unique.size;
  }

  const lastGroupBy = [...steps].reverse().find(s => s.op === 'groupBy');
  if (lastGroupBy && rows.length > 0 && lastGroupBy.sort?.column) {
    const metricCol = lastGroupBy.sort.column;
    const groupCol = lastGroupBy.columns?.[0];
    if (rows[0][metricCol] != null) {
      facts.groupColumn = groupCol;
      facts.metricColumn = metricCol;
      facts.topGroup = rows[0][groupCol];
      facts.topValue = rows[0][metricCol];
      facts.runnerUpGroup = rows[1]?.[groupCol] ?? null;
      facts.runnerUpValue = rows[1]?.[metricCol] ?? null;
      facts.distinctGroupCount = facts.distinctCounts[groupCol] ?? rows.length;
    }
  }

  return facts;
}

function buildFinalAnswerPrompt({ prompt, selectedDatasetLabel, finalResults, chatHistory, scope, summaryFacts, steps }) {
  const historyBlock = Array.isArray(chatHistory) && chatHistory.length > 0
    ? `Prior conversation:\n${chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}\n\n`
    : '';

  const scopeLabel = scope === 'current_view'
    ? 'the current visible grid view (a user-filtered subset of the full dataset)'
    : scope === 'selected_rows'
    ? 'the user-selected rows only (a subset)'
    : 'the full base dataset (all rows, no grid filters applied)';

  const queryDesc = describeSteps(steps);
  const factsBlock = summaryFacts
    ? `\nVerified facts computed from query results (use these numbers — do not invent others):\n${JSON.stringify(summaryFacts, null, 2)}\n`
    : '';

  return `You are a data analyst. Write a concise answer grounded strictly in the query results below.

${historyBlock}User question: ${prompt}

Dataset: ${selectedDatasetLabel}
Data scope: ${scopeLabel}

Exact query that was executed:
${queryDesc || '(no steps)'}
${factsBlock}
Result columns: ${JSON.stringify(finalResults.columns)}
Result rows: ${JSON.stringify(finalResults.rows, null, 2)}

Return JSON only:
{
  "answer": "2-4 sentence answer grounded in the result rows above",
  "insights": ["key finding 1", "key finding 2"],
  "recommendedActions": ["optional next step"]
}

Rules:
- The result rows contain EXACTLY what the query computed — nothing more, nothing less
- CRITICAL: Column aliases are just labels. COUNT("status") aliased "failedPayments" still counts ALL non-null status values — it is NOT a count of failed rows unless a FILTER step for status = 'Failed' appears above. Read the step description, not the alias.
- If no FILTER step exists for a condition (e.g. status = 'Failed'), every COUNT/SUM is over all rows. Never say "X failed payments" if the query never filtered to failed rows.
- Ground every number in the actual result rows and verified facts — never invent figures
- Do NOT claim a category is absent unless distinctCounts explicitly shows 0 for it
- If distinctGroupCount > 1, acknowledge all groups — do not say "only X exists"
- State clearly whether this answer is based on the full dataset, a filtered view, or selected rows
- 1-3 insights max
- Return valid JSON only`;
}

async function callModel(promptText, { provider, apiKey, geminiModel, ollamaBaseUrl, ollamaModel }) {
  if (provider === 'ollama') {
    const base = (ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, '');
    const response = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel || DEFAULT_OLLAMA_MODEL,
        system: 'Return only valid JSON. No prose, no markdown fences.',
        prompt: promptText,
        stream: false,
        format: 'json',
        options: { temperature: 0.1 },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Ollama error');
    return parseModelJson(json.response, 'Ollama');
  }

  const model = normalizeGeminiModel(geminiModel);
  const response = await fetch(`${GEMINI_API_BASE_URL}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Return only valid JSON. No prose, no markdown fences.' }] },
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(extractGeminiErrorMessage(json) || 'Gemini error');
  return parseModelJson(extractGeminiResponseText(json), 'Gemini');
}

// ── Plugin ───────────────────────────────────────────────────────────────────

function aiConfigRoutePlugin({ provider, apiKey, geminiModel, ollamaBaseUrl, ollamaModel }) {
  const handler = async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    if (provider === 'gemini' && !apiKey) {
      sendJson(res, 500, {
        error:
          'Missing GEMINI_API_KEY. Set it in your shell (or .env), or set AI_PROVIDER=ollama to use a local Ollama model.',
      });
      return;
    }

    try {
      const payload = await readJsonBody(req);
      validateClientPayload(payload);

      const result = await requestConfigFromModel(payload, {
        provider,
        apiKey,
        model: provider === 'ollama' ? ollamaModel : geminiModel,
        baseUrl: ollamaBaseUrl,
      });
      sendJson(res, 200, result);
    } catch (error) {
      const statusCode =
        error instanceof Error && Number.isInteger(error.statusCode)
          ? error.statusCode
          : 400;

      const responsePayload = {
        error: error instanceof Error ? error.message : 'Unknown error.',
      };

      if (
        error instanceof Error &&
        typeof error.retryAfterSec === 'number' &&
        Number.isFinite(error.retryAfterSec) &&
        error.retryAfterSec > 0
      ) {
        const retryAfterSec = Math.max(1, Math.ceil(error.retryAfterSec));
        responsePayload.retryAfterSec = retryAfterSec;
        if (statusCode === 429) {
          res.setHeader('Retry-After', String(retryAfterSec));
        }
      }

      sendJson(res, statusCode, responsePayload);
    }
  };

  const settings = { provider, apiKey, geminiModel, ollamaBaseUrl, ollamaModel };

  const analyzeStreamHandler = async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    function sendEvent(type, data = {}) {
      try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch (_) {}
    }

    try {
      const payload = await readJsonBody(req, 1024 * 512);

      if (!payload.prompt || !payload.selectedDatasetId) {
        sendEvent('error', { message: 'Missing prompt or dataset.' });
        res.end();
        return;
      }

      if (provider === 'gemini' && !apiKey) {
        sendEvent('error', { message: 'Missing GEMINI_API_KEY.' });
        res.end();
        return;
      }

      // Register in-memory datasets as DuckDB views so SQL can query them
      if (Array.isArray(payload.rows) && payload.rows.length > 0) {
        await ensureDatasetTable(payload.selectedDatasetId, payload.rows);
      }

      sendEvent('status', { text: 'Analyzing your question...' });

      // Call 1: decide whether a structured query is needed or answer directly
      console.log('[stream] deciding approach for:', payload.prompt);
      let decision;
      try {
        decision = await callModel(buildStructuredQueryPrompt(payload), settings);
        console.log('[stream] decision:', JSON.stringify(decision));
      } catch (decisionErr) {
        console.error('[stream] decision failed:', decisionErr.message);
        throw decisionErr;
      }

      if (decision.needsQuery === false) {
        // Direct answer — no query needed
        sendEvent('answer', {
          answer: decision.answer || '',
          insights: Array.isArray(decision.insights) ? decision.insights : [],
          recommendedActions: Array.isArray(decision.recommendedActions) ? decision.recommendedActions : [],
        });
        sendEvent('done', {});
      } else {
        // Structured query — build SQL from operation plan and execute steps
        if (!Array.isArray(decision.steps) || decision.steps.length === 0) {
          throw new Error('Model chose query mode but returned no steps.');
        }

        const schema = payload.selectedDatasetSchema || [];
        const steps = pruneInvalidSteps(reorderStepPlan(decision.steps, schema), schema);

        if (steps.length === 0) {
          throw new Error('No executable steps remain after validating the query plan.');
        }

        // Enforce scope: current_view and selected_rows use a separate registered view
        const scope = typeof decision.scope === 'string' ? decision.scope : 'base_dataset';
        let currentSource;
        if (scope === 'current_view' && Array.isArray(payload.currentViewRows) && payload.currentViewRows.length > 0) {
          const viewId = `__current_view_${payload.selectedDatasetId}`;
          await ensureDatasetTable(viewId, payload.currentViewRows);
          currentSource = `"${viewId}"`;
          console.log('[stream] scope=current_view,', payload.currentViewRows.length, 'rows');
        } else if (scope === 'selected_rows' && Array.isArray(payload.selectedRows) && payload.selectedRows.length > 0) {
          const selId = `__selected_${payload.selectedDatasetId}`;
          await ensureDatasetTable(selId, payload.selectedRows);
          currentSource = `"${selId}"`;
          console.log('[stream] scope=selected_rows,', payload.selectedRows.length, 'rows');
        } else {
          currentSource = `"${payload.selectedDatasetId}"`;
        }

        let finalColumns = [];
        let finalRows = [];

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];

          // Validate column references against original schema (first step only)
          validateStepColumns(step, schema, i);

          sendEvent('status', { text: `${step.label || 'Processing data'}...` });

          const sql = buildStepSql(step, currentSource);
          console.log(`[stream] step ${i} (${step.op}):`, sql);

          let rawRows;
          try {
            rawRows = await queryDuckDB(sql);
          } catch (sqlErr) {
            console.error(`[stream] step ${i} SQL error:`, sqlErr.message);
            sendEvent('error', { message: `Query step ${i + 1} failed: ${sqlErr.message}` });
            res.end();
            return;
          }

          const keys = rawRows.length > 0
            ? Object.keys(rawRows[0]).filter(k => !k.startsWith('__'))
            : [];
          const cleanRows = rawRows.map(row => {
            const out = {};
            keys.forEach(k => {
              const v = row[k];
              out[k] = typeof v === 'bigint' ? Number(v) : v;
            });
            return out;
          });

          finalColumns = keys;
          finalRows = cleanRows;

          // Register result as a view so the next step can query it
          if (i < steps.length - 1 && cleanRows.length > 0) {
            const stepViewId = `__step_${i}`;
            await ensureDatasetTable(stepViewId, cleanRows);
            currentSource = `"${stepViewId}"`;
          }

          sendEvent('step', {
            label: step.label || 'Processing data...',
            columns: finalColumns,
            rows: cleanRows.slice(0, 500),
            totalRows: cleanRows.length,
            sort: extractSortFromStep(step),
          });
        }

        // Call 2: natural language answer grounded in real query results
        sendEvent('status', { text: 'Summarizing findings...' });
        console.log('[stream] generating answer from', finalRows.length, 'rows, scope=', scope);

        const summaryFacts = computeSummaryFacts(finalColumns, finalRows, steps);

        const answerJson = await callModel(
          buildFinalAnswerPrompt({
            prompt: payload.prompt,
            selectedDatasetLabel: payload.selectedDatasetLabel,
            finalResults: { columns: finalColumns, rows: finalRows.slice(0, 50) },
            chatHistory: payload.chatHistory,
            scope,
            summaryFacts,
            steps,
          }),
          settings,
        );
        console.log('[stream] answer:', JSON.stringify(answerJson));

        // Build query metadata for the UI explain panel
        const queryMeta = {
          scope,
          filtersApplied: steps
            .filter(s => s.op === 'filter')
            .flatMap(s => (s.conditions || []).map(c =>
              `${c.column} ${c.op} ${Array.isArray(c.value) ? c.value.join(', ') : c.value}`
            )),
          groupBy: steps.filter(s => s.op === 'groupBy').flatMap(s => s.columns || []),
          aggregations: steps.filter(s => s.op === 'groupBy').flatMap(s =>
            (s.aggregations || []).map(a => `${a.fn}(${a.column}) → ${a.alias}`)
          ),
          sortBy: (() => {
            const gb = steps.find(s => s.op === 'groupBy' && s.sort);
            if (gb) return `${gb.sort.column} ${gb.sort.direction}`;
            const so = steps.find(s => s.op === 'sort' && s.by?.[0]);
            if (so) return `${so.by[0].column} ${so.by[0].direction}`;
            const tn = steps.find(s => s.op === 'topN');
            if (tn) return `${tn.column} ${tn.direction}`;
            return null;
          })(),
          resultRowCount: finalRows.length,
          distinctGroupCount: summaryFacts.distinctGroupCount ?? null,
        };

        sendEvent('answer', {
          answer: answerJson.answer || '',
          insights: Array.isArray(answerJson.insights) ? answerJson.insights : [],
          recommendedActions: Array.isArray(answerJson.recommendedActions) ? answerJson.recommendedActions : [],
          queryMeta,
        });
        sendEvent('done', {});
      }

    } catch (error) {
      console.error('[stream] unhandled error:', error.message, error.stack);
      sendEvent('error', { message: error instanceof Error ? error.message : 'Analysis failed.' });
    }

    try { res.end(); } catch (_) {}
  };

  return {
    name: 'ai-config-route',
    configureServer(server) {
      server.middlewares.use('/api/generate-config', handler);
      server.middlewares.use('/api/analyze-stream', analyzeStreamHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/generate-config', handler);
      server.middlewares.use('/api/analyze-stream', analyzeStreamHandler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const provider = normalizeAiProvider(env.AI_PROVIDER || process.env.AI_PROVIDER);
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const geminiModel = env.GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const ollamaBaseUrl =
    env.OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
  const ollamaModel =
    env.OLLAMA_MODEL || process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;

  return {
    plugins: [
      aiConfigRoutePlugin({
        provider,
        apiKey,
        geminiModel,
        ollamaBaseUrl,
        ollamaModel,
      }),
    ],
  };
});
