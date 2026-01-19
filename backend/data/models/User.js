const bcrypt = require('bcryptjs');
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

function normalizeEmail(email) {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

function normalizeAtivo(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
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
    ativo: row.ativo === true || Number(row.ativo) === 1,
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

    const emailNormalized = normalizeEmail(email);
    const { data: duplicate, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailNormalized)
      .maybeSingle();
    throwIfError(error);
    if (duplicate) throw new Error('UNIQUE constraint failed: users.email');

    const now = new Date().toISOString();
    const hashedPassword = await bcrypt.hash(senha, 10);

    const payload = {
      nome,
      email: emailNormalized,
      senha: hashedPassword,
      nivel_acesso,
      telefone: telefone || '',
      comissao,
      ativo: normalizeAtivo(ativo),
      created_at: now,
      updated_at: now
    };

    const created = await insertRow(
      'users',
      payload,
      'id,nome,email,nivel_acesso,telefone,comissao,ativo'
    );
    return created;
  }

  static async findByEmail(email) {
    const emailNormalized = normalizeEmail(email);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', emailNormalized)
      .eq('ativo', true)
      .maybeSingle();
    throwIfError(error);
    if (!data) return null;
    return normalizeUser(data);
  }

  static async findById(id) {
    const row = await selectById('users', id);
    if (!row || row.ativo !== true) return null;
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
    const row = await selectById('users', id);
    return normalizeUser(row);
  }

  static async findAll() {
    const rows = await selectAll('users');
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
    const row = await selectById('users', id);
    if (!row) return { id };

    const data = { ...userData };
    if (data.senha) {
      data.senha = await bcrypt.hash(data.senha, 10);
    } else {
      delete data.senha;
    }
    if (data.ativo !== undefined) {
      data.ativo = normalizeAtivo(data.ativo);
    }

    const updated = {
      ...row,
      ...data,
      updated_at: new Date().toISOString()
    };

    await updateById('users', id, updated, 'id');
    return { id: Number(id), ...userData };
  }

  static async deactivate(id) {
    const row = await selectById('users', id);
    if (!row) return { deleted: false };

    const updated = {
      ...row,
      ativo: false,
      updated_at: new Date().toISOString()
    };
    await updateById('users', id, updated, 'id');
    return { deleted: true };
  }

  static async deletePermanent(id) {
    const row = await selectById('users', id);
    if (!row) return { deleted: false };
    await deleteById('users', id);
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

  static async comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;
