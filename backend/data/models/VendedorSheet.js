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

function normalizeVendedor(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    nome: row.nome || '',
    email: row.email || '',
    telefone: row.telefone || '',
    nivel_acesso: row.nivel_acesso || 'vendedor',
    comissao: toNumber(row.comissao),
    ativo: row.ativo === true || Number(row.ativo) === 1
  };
}

class VendedorSheet {
  static async create(vendedorData, forcedId = null) {
    const now = new Date().toISOString();
    const payload = {
      ...(forcedId ? { id: forcedId } : {}),
      nome: vendedorData.nome || '',
      email: vendedorData.email ? String(vendedorData.email).trim().toLowerCase() : '',
      telefone: vendedorData.telefone || '',
      nivel_acesso: vendedorData.nivel_acesso || 'vendedor',
      comissao: vendedorData.comissao ?? 0,
      ativo: normalizeAtivo(vendedorData.ativo),
      created_at: now,
      updated_at: now
    };
    const created = await insertRow('vendedores', payload);
    return normalizeVendedor(created);
  }

  static async findAll() {
    const rows = await selectAll('vendedores');
    return rows.map(normalizeVendedor);
  }

  static async findById(id) {
    const row = await selectById('vendedores', id);
    return normalizeVendedor(row);
  }

  static async update(id, vendedorData) {
    const row = await selectById('vendedores', id);
    if (!row) return null;
    const data = { ...vendedorData };
    if (data.ativo !== undefined) {
      data.ativo = normalizeAtivo(data.ativo);
    }
    const updated = {
      ...row,
      ...data,
      updated_at: new Date().toISOString()
    };
    await updateById('vendedores', id, updated, 'id');
    return { id: Number(id), ...vendedorData };
  }

  static async deactivate(id) {
    return this.update(id, { ativo: false });
  }

  static async delete(id) {
    const row = await selectById('vendedores', id);
    if (!row) return { deleted: false };
    await deleteById('vendedores', id);
    return { deleted: true };
  }

  static async hasPedidos(id) {
    const { error, count } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('vendedor_id', id);
    throwIfError(error);
    return Number(count || 0) > 0;
  }
}

module.exports = VendedorSheet;
