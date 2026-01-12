const {
  getAll,
  findById,
  appendRow,
  updateRow,
  deleteRow,
  getNextId
} = require('../../services/sheetsStore');

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

function normalizeProduto(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    codigo: row.codigo || '',
    nome: row.nome || '',
    descricao: row.descricao || '',
    preco_tabela: toNumber(row.preco_tabela),
    preco_custo: toNumber(row.preco_custo),
    estoque_atual: toNumber(row.estoque_atual),
    estoque_minimo: toNumber(row.estoque_minimo),
    unidade_medida: row.unidade_medida || 'UN',
    ativo: Number(row.ativo) === 1,
    imagem_url: row.imagem_url || null
  };
}

class Produto {
  static async create(produtoData) {
    if (produtoData.codigo) {
      const existing = await getAll('produtos');
      const duplicate = existing.find(
        (row) => String(row.codigo).trim() === String(produtoData.codigo).trim()
      );
      if (duplicate) {
        throw new Error('UNIQUE constraint failed: produtos.codigo');
      }
    }

    const id = await getNextId('produtos');
    const now = new Date().toISOString();
    const payload = {
      id,
      codigo: produtoData.codigo || '',
      nome: produtoData.nome || '',
      descricao: produtoData.descricao || '',
      preco_tabela: produtoData.preco_tabela ?? 0,
      preco_custo: produtoData.preco_custo ?? 0,
      estoque_atual: produtoData.estoque_atual ?? 0,
      estoque_minimo: produtoData.estoque_minimo ?? 0,
      unidade_medida: produtoData.unidade_medida || 'UN',
      ativo: produtoData.ativo ?? 1,
      imagem_url: produtoData.imagem_url || '',
      created_at: now,
      updated_at: now
    };

    await appendRow('produtos', payload);
    return { id, ...produtoData };
  }

  static async findAll() {
    const rows = await getAll('produtos');
    return rows.map(normalizeProduto);
  }

  static async findById(id) {
    const row = await findById('produtos', id);
    return normalizeProduto(row);
  }

  static async update(id, produtoData) {
    const row = await findById('produtos', id);
    if (!row) return null;

    const now = new Date().toISOString();
    const updated = {
      ...row,
      ...produtoData,
      updated_at: now
    };

    await updateRow('produtos', row.__rowNumber, updated);
    return { id: Number(id), ...produtoData };
  }

  static async delete(id) {
    const row = await findById('produtos', id);
    if (!row) return { deleted: false };
    await deleteRow('produtos', row.__rowNumber);
    return { deleted: true };
  }

  static async updateStock(id, quantidade) {
    const row = await findById('produtos', id);
    if (!row) return { updated: false };
    const updated = {
      ...row,
      estoque_atual: toNumber(row.estoque_atual) - Number(quantidade || 0),
      updated_at: new Date().toISOString()
    };
    await updateRow('produtos', row.__rowNumber, updated);
    return { updated: true };
  }
}

module.exports = Produto;
