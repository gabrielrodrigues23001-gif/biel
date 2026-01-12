const {
  getSpreadsheetInfo,
  getValues,
  updateValues,
  appendValues,
  batchUpdate
} = require('./sheetsClient');

const SHEET_CONFIG = {
  clientes: [
    'id',
    'cnpj',
    'razao_social',
    'nome_fantasia',
    'email',
    'telefone',
    'endereco',
    'cidade',
    'estado',
    'cep',
    'inscricao_estadual',
    'ativo',
    'created_at',
    'updated_at'
  ],
  produtos: [
    'id',
    'codigo',
    'nome',
    'descricao',
    'preco_tabela',
    'preco_custo',
    'estoque_atual',
    'estoque_minimo',
    'unidade_medida',
    'ativo',
    'imagem_url',
    'created_at',
    'updated_at'
  ],
  pedidos: [
    'id',
    'numero_pedido',
    'cliente_id',
    'vendedor_id',
    'data_emissao',
    'valor_total',
    'condicao_pagamento',
    'observacoes',
    'status',
    'created_at',
    'updated_at'
  ],
  pedido_itens: [
    'id',
    'pedido_id',
    'produto_id',
    'quantidade',
    'preco_unitario',
    'desconto',
    'subtotal',
    'created_at'
  ],
  users: [
    'id',
    'nome',
    'email',
    'senha',
    'nivel_acesso',
    'telefone',
    'comissao',
    'ativo',
    'created_at',
    'updated_at'
  ],
  vendedores: [
    'id',
    'nome',
    'email',
    'telefone',
    'nivel_acesso',
    'comissao',
    'ativo',
    'created_at',
    'updated_at'
  ]
};

let initialized = false;
let sheetIds = {};
const cache = {};
const DEFAULT_CACHE_TTL_MS = 30000;

function getCacheTtl() {
  const raw = process.env.SHEETS_CACHE_TTL_MS;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? DEFAULT_CACHE_TTL_MS : parsed;
}

function getCacheEntry(sheetName) {
  const entry = cache[sheetName];
  if (!entry) return null;
  const ttl = getCacheTtl();
  if (Date.now() - entry.fetchedAt > ttl) {
    delete cache[sheetName];
    return null;
  }
  return entry;
}

function setCacheEntry(sheetName, rows) {
  cache[sheetName] = {
    rows,
    fetchedAt: Date.now()
  };
}

function invalidateCache(sheetName) {
  if (sheetName) {
    delete cache[sheetName];
  } else {
    Object.keys(cache).forEach((key) => delete cache[key]);
  }
}

function columnLetter(index) {
  let result = '';
  let temp = index + 1;
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    temp = Math.floor((temp - 1) / 26);
  }
  return result;
}

function getHeaders(sheetName) {
  const headers = SHEET_CONFIG[sheetName];
  if (!headers) {
    throw new Error(`Sheet ${sheetName} not configured`);
  }
  return headers;
}

async function ensureSheets() {
  if (initialized) return;

  const info = await getSpreadsheetInfo();
  const existing = info.sheets || [];
  const existingByName = new Map(
    existing.map((sheet) => [sheet.properties.title, sheet.properties.sheetId])
  );

  const requests = [];
  Object.keys(SHEET_CONFIG).forEach((sheetName) => {
    if (!existingByName.has(sheetName)) {
      requests.push({
        addSheet: { properties: { title: sheetName } }
      });
    }
  });

  if (requests.length > 0) {
    await batchUpdate(requests);
  }

  const refreshed = await getSpreadsheetInfo();
  sheetIds = {};
  (refreshed.sheets || []).forEach((sheet) => {
    sheetIds[sheet.properties.title] = sheet.properties.sheetId;
  });

  for (const sheetName of Object.keys(SHEET_CONFIG)) {
    const headers = getHeaders(sheetName);
    const values = await getValues(`${sheetName}!1:1`);
    const row = values.values?.[0] || [];
    const needsHeader =
      row.length === 0 ||
      headers.some((header, index) => row[index] !== header);

    if (needsHeader) {
      await updateValues(`${sheetName}!A1:${columnLetter(headers.length - 1)}1`, [headers]);
    }
  }

  initialized = true;
}

async function getAll(sheetName) {
  await ensureSheets();
  const cached = getCacheEntry(sheetName);
  if (cached) return cached.rows;
  const values = await getValues(`${sheetName}!A:Z`);
  const rows = values.values || [];
  if (rows.length <= 1) {
    setCacheEntry(sheetName, []);
    return [];
  }
  const headers = rows[0];
  const result = rows.slice(1).map((row, index) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? '';
    });
    obj.__rowNumber = index + 2;
    return obj;
  });
  setCacheEntry(sheetName, result);
  return result;
}

async function findById(sheetName, id) {
  const all = await getAll(sheetName);
  return all.find((row) => Number(row.id) === Number(id)) || null;
}

async function appendRow(sheetName, row) {
  await ensureSheets();
  const headers = getHeaders(sheetName);
  const values = headers.map((header) => row[header] ?? '');
  await appendValues(`${sheetName}!A:${columnLetter(headers.length - 1)}`, [values]);
  invalidateCache(sheetName);
}

async function updateRow(sheetName, rowNumber, row) {
  await ensureSheets();
  const headers = getHeaders(sheetName);
  const values = headers.map((header) => row[header] ?? '');
  const range = `${sheetName}!A${rowNumber}:${columnLetter(headers.length - 1)}${rowNumber}`;
  await updateValues(range, [values]);
  invalidateCache(sheetName);
}

async function deleteRow(sheetName, rowNumber) {
  await ensureSheets();
  const sheetId = sheetIds[sheetName];
  if (sheetId === undefined) {
    throw new Error(`Sheet ${sheetName} not found`);
  }
  await batchUpdate([
    {
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: rowNumber - 1,
          endIndex: rowNumber
        }
      }
    }
  ]);
  invalidateCache(sheetName);
}

async function getNextId(sheetName) {
  const all = await getAll(sheetName);
  const maxId = all.reduce((max, row) => {
    const id = Number(row.id);
    return Number.isNaN(id) ? max : Math.max(max, id);
  }, 0);
  return maxId + 1;
}

module.exports = {
  SHEET_CONFIG,
  getHeaders,
  getAll,
  findById,
  appendRow,
  updateRow,
  deleteRow,
  getNextId,
  invalidateCache
};
