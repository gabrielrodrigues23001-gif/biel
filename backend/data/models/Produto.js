const {
  supabase,
  throwIfError,
  selectAll,
  selectById,
  insertRow,
  updateById,
  deleteById
} = require('../../services/supabaseStore');

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

function normalizeAtivo(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
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
    ativo: row.ativo === true || Number(row.ativo) === 1,
    imagem_url: row.imagem_url || null
  };
}

class Produto {
  static async create(produtoData) {
    if (produtoData.codigo) {
      const codigo = String(produtoData.codigo).trim();
      const { data: duplicate, error } = await supabase
        .from('produtos')
        .select('id')
        .eq('codigo', codigo)
        .maybeSingle();
      throwIfError(error);
      if (duplicate) throw new Error('UNIQUE constraint failed: produtos.codigo');
    }

    const now = new Date().toISOString();
    const payload = {
      codigo: produtoData.codigo ? String(produtoData.codigo).trim() : '',
      nome: produtoData.nome || '',
      descricao: produtoData.descricao || '',
      preco_tabela: produtoData.preco_tabela ?? 0,
      preco_custo: produtoData.preco_custo ?? 0,
      estoque_atual: produtoData.estoque_atual ?? 0,
      estoque_minimo: produtoData.estoque_minimo ?? 0,
      unidade_medida: produtoData.unidade_medida || 'UN',
      ativo: normalizeAtivo(produtoData.ativo),
      imagem_url: produtoData.imagem_url || null,
      created_at: now,
      updated_at: now
    };

    const created = await insertRow('produtos', payload);
    return normalizeProduto(created);
  }

  static async findAll() {
    const rows = await selectAll('produtos');
    return rows.map(normalizeProduto);
  }

  static async findById(id) {
    const row = await selectById('produtos', id);
    return normalizeProduto(row);
  }

  static async update(id, produtoData) {
    const row = await selectById('produtos', id);
    if (!row) return null;

    const now = new Date().toISOString();
    const data = { ...produtoData };
    if (data.ativo !== undefined) {
      data.ativo = normalizeAtivo(data.ativo);
    }
    const updated = {
      ...row,
      ...data,
      updated_at: now
    };

    await updateById('produtos', id, updated, 'id');
    return { id: Number(id), ...produtoData };
  }

  static async delete(id) {
    const row = await selectById('produtos', id);
    if (!row) return { deleted: false };
    await deleteById('produtos', id);
    return { deleted: true };
  }

  static async updateStock(id, quantidade) {
    const row = await selectById('produtos', id);
    if (!row) return { updated: false };
    const updated = {
      ...row,
      estoque_atual: toNumber(row.estoque_atual) - Number(quantidade || 0),
      updated_at: new Date().toISOString()
    };
    await updateById('produtos', id, updated, 'id');
    return { updated: true };
  }
}

module.exports = Produto;
