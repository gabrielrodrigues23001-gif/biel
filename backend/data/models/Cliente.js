const {
  supabase,
  throwIfError,
  selectAll,
  selectById,
  insertRow,
  updateById,
  deleteById
} = require('../../services/supabaseStore');

function normalizeCliente(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    vendedor_id: row.vendedor_id ? Number(row.vendedor_id) : null,
    cnpj: row.cnpj || null,
    razao_social: row.razao_social || '',
    nome_fantasia: row.nome_fantasia || '',
    email: row.email || null,
    telefone: row.telefone || null,
    endereco: row.endereco || null,
    cidade: row.cidade || null,
    estado: row.estado || null,
    cep: row.cep || null,
    inscricao_estadual: row.inscricao_estadual || null,
    ativo: row.ativo === true || Number(row.ativo) === 1
  };
}

function normalizeAtivo(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

class Cliente {
  static async create(clienteData) {
    if (clienteData.cnpj) {
      const cnpj = String(clienteData.cnpj).trim();
      const { data: duplicate, error } = await supabase
        .from('clientes')
        .select('id')
        .eq('cnpj', cnpj)
        .maybeSingle();
      throwIfError(error);
      if (duplicate) throw new Error('UNIQUE constraint failed: clientes.cnpj');
    }

    const now = new Date().toISOString();
    const payload = {
      vendedor_id: clienteData.vendedor_id ?? null,
      cnpj: clienteData.cnpj ? String(clienteData.cnpj).trim() : null,
      razao_social: clienteData.razao_social || '',
      nome_fantasia: clienteData.nome_fantasia || '',
      email: clienteData.email || null,
      telefone: clienteData.telefone || null,
      endereco: clienteData.endereco || null,
      cidade: clienteData.cidade || null,
      estado: clienteData.estado || null,
      cep: clienteData.cep || null,
      inscricao_estadual: clienteData.inscricao_estadual || null,
      ativo: normalizeAtivo(clienteData.ativo),
      created_at: now,
      updated_at: now
    };

    const created = await insertRow('clientes', payload);
    return normalizeCliente(created);
  }

  static async findAll() {
    const rows = await selectAll('clientes');
    return rows.map(normalizeCliente);
  }

  static async findById(id) {
    const row = await selectById('clientes', id);
    return normalizeCliente(row);
  }

  static async update(id, clienteData) {
    const row = await selectById('clientes', id);
    if (!row) return null;

    const now = new Date().toISOString();
    const data = { ...clienteData };
    if (data.ativo !== undefined) {
      data.ativo = normalizeAtivo(data.ativo);
    }
    const updated = {
      ...row,
      ...data,
      updated_at: now
    };

    await updateById('clientes', id, updated, 'id');
    return { id: Number(id), ...clienteData };
  }

  static async delete(id) {
    const row = await selectById('clientes', id);
    if (!row) return { deleted: false };
    await deleteById('clientes', id);
    return { deleted: true };
  }
}

module.exports = Cliente;
