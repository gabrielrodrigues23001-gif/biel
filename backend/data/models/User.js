const bcrypt = require('bcryptjs');
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

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    nome: row.nome || '',
    email: row.email || '',
    senha: row.senha || '',
    nivel_acesso: row.nivel_acesso || 'vendedor',
    telefone: row.telefone || '',
    comissao: toNumber(row.comissao),
    ativo: Number(row.ativo) === 1,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

class User {
  static async create(userData) {
    const {
      nome,
      email,
      senha,
      nivel_acesso = 'vendedor',
      telefone,
      comissao = 0,
      ativo = 1
    } = userData;

    const existing = await getAll('users');
    const duplicate = existing.find(
      (row) => String(row.email).trim().toLowerCase() === String(email).trim().toLowerCase()
    );
    if (duplicate) {
      throw new Error('UNIQUE constraint failed: users.email');
    }

    const id = await getNextId('users');
    const now = new Date().toISOString();
    const hashedPassword = await bcrypt.hash(senha, 10);

    const payload = {
      id,
      nome,
      email,
      senha: hashedPassword,
      nivel_acesso,
      telefone: telefone || '',
      comissao,
      ativo,
      created_at: now,
      updated_at: now
    };

    await appendRow('users', payload);

    return {
      id,
      nome,
      email,
      nivel_acesso,
      telefone,
      comissao,
      ativo
    };
  }

  static async findByEmail(email) {
    const rows = await getAll('users');
    const row = rows.find(
      (user) => String(user.email).trim().toLowerCase() === String(email).trim().toLowerCase()
    );
    if (!row || Number(row.ativo) !== 1) return null;
    return normalizeUser(row);
  }

  static async findById(id) {
    const row = await findById('users', id);
    if (!row || Number(row.ativo) !== 1) return null;
    const user = normalizeUser(row);
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      nivel_acesso: user.nivel_acesso,
      telefone: user.telefone,
      comissao: user.comissao,
      created_at: user.created_at
    };
  }

  static async findByIdIncludeInactive(id) {
    const row = await findById('users', id);
    return normalizeUser(row);
  }

  static async findAll() {
    const rows = await getAll('users');
    return rows.map((row) => {
      const user = normalizeUser(row);
      return {
        id: user.id,
        nome: user.nome,
        email: user.email,
        nivel_acesso: user.nivel_acesso,
        telefone: user.telefone,
        comissao: user.comissao,
        ativo: user.ativo,
        created_at: user.created_at
      };
    });
  }

  static async update(id, userData) {
    const row = await findById('users', id);
    if (!row) return { id };

    const data = { ...userData };
    if (data.senha) {
      data.senha = await bcrypt.hash(data.senha, 10);
    } else {
      delete data.senha;
    }

    const updated = {
      ...row,
      ...data,
      updated_at: new Date().toISOString()
    };

    await updateRow('users', row.__rowNumber, updated);
    return { id: Number(id), ...userData };
  }

  static async deactivate(id) {
    const row = await findById('users', id);
    if (!row) return { deleted: false };

    const updated = {
      ...row,
      ativo: 0,
      updated_at: new Date().toISOString()
    };
    await updateRow('users', row.__rowNumber, updated);
    return { deleted: true };
  }

  static async deletePermanent(id) {
    const row = await findById('users', id);
    if (!row) return { deleted: false };
    await deleteRow('users', row.__rowNumber);
    return { deleted: true };
  }

  static async hasPedidos(id) {
    const pedidos = await getAll('pedidos');
    return pedidos.some((pedido) => Number(pedido.vendedor_id) === Number(id));
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;
