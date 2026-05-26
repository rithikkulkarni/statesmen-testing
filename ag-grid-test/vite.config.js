import { defineConfig, loadEnv } from 'vite';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const MAX_REQUEST_BODY_BYTES = 1024 * 128;
const CONFIG_TRANSLATOR_SYSTEM_PROMPT = [
  'You convert natural-language table requests into AG Grid table config JSON.',
  'Return exactly one complete JSON object for schema version 2. Do not add prose.',
  'Always preserve existing settings from currentConfig unless the user clearly asks to change them.',
  'Use only dataset IDs and column IDs provided in the prompt context.',
  'Interpret user intent with these rules:',
  '- "show only <columns>" means hide all non-mentioned columns.',
  '- "move <columns> to the front" means those columns appear first in columns.order.',
  '- "most recent first" means invoiceDate sort desc.',
  '- "largest/highest first" means amount sort desc.',
  '- "failed", "pending", "paid", method, carrier, and region phrases map to filters.',
  '- "over $N", "greater than N", "high-value" map to amount numeric filters.',
  '- numeric filter intent should support min/max/range: use number filter model types greaterThanOrEqual, lessThanOrEqual, or inRange.',
  '- for string filters, use AG Grid text filter models (filterType "text"), not set filter models.',
  '- "group by A then B" maps to groupBy order [A, B].',
  '- "total amount" or "subtotal amount" should include aggregations.amount = "sum".',
  '- If subtotals are requested, set subtotals.enabled = true.',
  'For prompts about saving or loading named views, return the best table config implied by the prompt; this endpoint only returns config JSON.',
  'If a prompt is ambiguous, make a conservative business-friendly interpretation while keeping unchanged settings from currentConfig.',
].join('\n');

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;

    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_REQUEST_BODY_BYTES) {
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
        type: ['object', 'null'],
        additionalProperties: true,
      },
    ]),
  );

  const aggregationsProps = Object.fromEntries(
    allowedColumns.map((column) => [column, { type: 'string' }]),
  );

  return {
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
            colId: {
              type: 'string',
              enum: allowedColumns,
            },
            sort: {
              type: 'string',
              enum: ['asc', 'desc'],
            },
          },
          required: ['colId', 'sort'],
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
}

function buildModelPrompt({
  prompt,
  currentConfig,
  datasets,
  columns,
  schemaVersion,
}) {
  return `
User request:
${prompt}

Current table config:
${JSON.stringify(currentConfig, null, 2)}

Allowed datasets:
${JSON.stringify(datasets, null, 2)}

Allowed columns:
${JSON.stringify(columns, null, 2)}

Schema version:
${schemaVersion}
`;
}

async function requestConfigFromModel(payload, { apiKey, model }) {
  const {
    prompt,
    currentConfig,
    datasets,
    columns,
    schemaVersion,
  } = payload;

  const normalizedModel = normalizeGeminiModel(model);
  const allowedDatasets = datasets.map((dataset) => dataset.id);
  const schema = makeJsonSchema(allowedDatasets, columns);

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
                text: buildModelPrompt({
                  prompt,
                  currentConfig,
                  datasets,
                  columns,
                  schemaVersion,
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
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

  let parsedConfig;
  try {
    parsedConfig = JSON.parse(rawText);
  } catch (_error) {
    throw new Error('Gemini output was not valid JSON.');
  }

  return {
    config: parsedConfig,
    model: responseJson?.modelVersion || normalizedModel,
  };
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

function aiConfigRoutePlugin({ apiKey, model }) {
  const handler = async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    if (!apiKey) {
      sendJson(res, 500, {
        error:
          'Missing GEMINI_API_KEY. Set it in your shell (or .env) before running npm run dev.',
      });
      return;
    }

    try {
      const payload = await readJsonBody(req);
      validateClientPayload(payload);

      const result = await requestConfigFromModel(payload, { apiKey, model });
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

  return {
    name: 'ai-config-route',
    configureServer(server) {
      server.middlewares.use('/api/generate-config', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/generate-config', handler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  return {
    plugins: [aiConfigRoutePlugin({ apiKey, model })],
  };
});
