const {
  getAll,
  findById,
  appendRow,
  updateRow,
  deleteRow,
  getNextId
} = require('../../services/sheetsStore');

function normalizeCliente(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
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
    ativo: Number(row.ativo) === 1
  };
}

class Cliente {
  static async create(clienteData) {
    if (clienteData.cnpj) {
      const existing = await getAll('clientes');
      const duplicate = existing.find(
        (row) => String(row.cnpj).trim() === String(clienteData.cnpj).trim()
      );
      if (duplicate) {
        throw new Error('UNIQUE constraint failed: clientes.cnpj');
      }
    }

    const id = await getNextId('clientes');
    const now = new Date().toISOString();
    const payload = {
      id,
      cnpj: clienteData.cnpj || '',
      razao_social: clienteData.razao_social || '',
      nome_fantasia: clienteData.nome_fantasia || '',
      email: clienteData.email || '',
      telefone: clienteData.telefone || '',
      endereco: clienteData.endereco || '',
      cidade: clienteData.cidade || '',
      estado: clienteData.estado || '',
      cep: clienteData.cep || '',
      inscricao_estadual: clienteData.inscricao_estadual || '',
      ativo: clienteData.ativo ?? 1,
      created_at: now,
      updated_at: now
    };

    await appendRow('clientes', payload);
    return { id, ...clienteData, ativo: payload.ativo };
  }

  static async findAll() {
    const rows = await getAll('clientes');
    return rows.map(normalizeCliente);
  }

  static async findById(id) {
    const row = await findById('clientes', id);
    return normalizeCliente(row);
  }

  static async update(id, clienteData) {
    const row = await findById('clientes', id);
    if (!row) return null;

    const now = new Date().toISOString();
    const updated = {
      ...row,
      ...clienteData,
      updated_at: now
    };

    await updateRow('clientes', row.__rowNumber, updated);
    return { id: Number(id), ...clienteData };
  }

  static async delete(id) {
    const row = await findById('clientes', id);
    if (!row) return { deleted: false };
    await deleteRow('clientes', row.__rowNumber);
    return { deleted: true };
  }
}

module.exports = Cliente;
