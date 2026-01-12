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

function normalizeVendedor(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    nome: row.nome || '',
    email: row.email || '',
    telefone: row.telefone || '',
    nivel_acesso: row.nivel_acesso || 'vendedor',
    comissao: toNumber(row.comissao),
    ativo: Number(row.ativo) === 1
  };
}

class VendedorSheet {
  static async create(vendedorData, forcedId = null) {
    const id = forcedId || (await getNextId('vendedores'));
    const now = new Date().toISOString();
    const payload = {
      id,
      nome: vendedorData.nome || '',
      email: vendedorData.email || '',
      telefone: vendedorData.telefone || '',
      nivel_acesso: vendedorData.nivel_acesso || 'vendedor',
      comissao: vendedorData.comissao ?? 0,
      ativo: vendedorData.ativo ?? 1,
      created_at: now,
      updated_at: now
    };
    await appendRow('vendedores', payload);
    return { id, ...vendedorData };
  }

  static async findAll() {
    const rows = await getAll('vendedores');
    return rows.map(normalizeVendedor);
  }

  static async findById(id) {
    const row = await findById('vendedores', id);
    return normalizeVendedor(row);
  }

  static async update(id, vendedorData) {
    const row = await findById('vendedores', id);
    if (!row) return null;
    const updated = {
      ...row,
      ...vendedorData,
      updated_at: new Date().toISOString()
    };
    await updateRow('vendedores', row.__rowNumber, updated);
    return { id: Number(id), ...vendedorData };
  }

  static async deactivate(id) {
    return this.update(id, { ativo: 0 });
  }

  static async delete(id) {
    const row = await findById('vendedores', id);
    if (!row) return { deleted: false };
    await deleteRow('vendedores', row.__rowNumber);
    return { deleted: true };
  }

  static async hasPedidos(id) {
    const pedidos = await getAll('pedidos');
    return pedidos.some((pedido) => Number(pedido.vendedor_id) === Number(id));
  }
}

module.exports = VendedorSheet;
