const {
  supabase,
  throwIfError,
  selectAll,
  selectById,
  insertRow,
  updateById
} = require('../../services/supabaseStore');
const Produto = require('./Produto');

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

function toNumberFromInput(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizePedido(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    numero_pedido: row.numero_pedido || '',
    cliente_id: toNumberFromInput(row.cliente_id),
    vendedor_id: toNumberFromInput(row.vendedor_id),
    data_emissao: row.data_emissao || null,
    valor_total: toNumberFromInput(row.valor_total),
    condicao_pagamento: row.condicao_pagamento || '',
    observacoes: row.observacoes || '',
    status: row.status || 'pendente'
  };
}

class Pedido {
  static async create(pedidoData) {
    const { cliente_id, vendedor_id, condicao_pagamento, observacoes, itens } = pedidoData;
    const now = new Date().toISOString();
    const numeroPedido = `PD${Date.now()}`;

    let valorTotal = 0;
    itens.forEach((item) => {
      const quantidade = toNumberFromInput(item.quantidade);
      const precoUnitario = toNumberFromInput(item.preco_unitario);
      const desconto = toNumberFromInput(item.desconto);
      const subtotal = quantidade * precoUnitario * (1 - desconto / 100);
      valorTotal += subtotal;
    });
    valorTotal *= 1.065;

    const pedidoRow = {
      numero_pedido: numeroPedido,
      cliente_id: cliente_id ?? null,
      vendedor_id: vendedor_id ?? null,
      data_emissao: now,
      valor_total: valorTotal,
      condicao_pagamento: condicao_pagamento || '',
      observacoes: observacoes || '',
      status: 'pendente',
      created_at: now,
      updated_at: now
    };

    const createdPedido = await insertRow('pedidos', pedidoRow, 'id,numero_pedido');
    const pedidoId = createdPedido.id;

    const itensRows = [];
    for (const item of itens) {
      const quantidade = toNumberFromInput(item.quantidade);
      const precoUnitario = toNumberFromInput(item.preco_unitario);
      const desconto = toNumberFromInput(item.desconto);
      const subtotal = quantidade * precoUnitario * (1 - desconto / 100);
      itensRows.push({
        pedido_id: pedidoId,
        produto_id: item.produto_id,
        quantidade,
        preco_unitario: precoUnitario,
        desconto,
        subtotal,
        created_at: now
      });
    }

    if (itensRows.length > 0) {
      const { error } = await supabase.from('pedido_itens').insert(itensRows);
      throwIfError(error);
    }

    for (const item of itens) {
      await Produto.updateStock(item.produto_id, item.quantidade);
    }

    return {
      id: pedidoId,
      numero_pedido: numeroPedido,
      cliente_id,
      vendedor_id,
      valor_total: valorTotal,
      itens
    };
  }

  static async findAll() {
    const [pedidosRows, clientesRows, vendedoresRows, itensRows] = await Promise.all([
      selectAll('pedidos'),
      selectAll('clientes'),
      selectAll('vendedores'),
      selectAll('pedido_itens')
    ]);

    const clientesMap = new Map(
      clientesRows.map((cliente) => [Number(cliente.id), cliente.nome_fantasia || ''])
    );
    const vendedoresMap = new Map(
      vendedoresRows.map((vendedor) => [Number(vendedor.id), vendedor.nome || ''])
    );
    const totalsByPedido = new Map();
    itensRows.forEach((item) => {
      const pedidoId = toNumberFromInput(item.pedido_id);
      const subtotal = toNumberFromInput(item.subtotal);
      if (!pedidoId || !subtotal) return;
      totalsByPedido.set(pedidoId, (totalsByPedido.get(pedidoId) || 0) + subtotal);
    });

    return pedidosRows.map((row) => {
      const pedido = normalizePedido(row);
      const subtotal = totalsByPedido.get(pedido.id) || 0;
      if (!pedido.valor_total && subtotal > 0) {
        pedido.valor_total = subtotal * 1.065;
      }
      return {
        ...pedido,
        cliente_nome: clientesMap.get(pedido.cliente_id) || 'N/A',
        vendedor_nome: vendedoresMap.get(pedido.vendedor_id) || 'N/A'
      };
    });
  }

  static async findAllByVendedor(vendedorId) {
    const pedidos = await this.findAll();
    return pedidos.filter((pedido) => Number(pedido.vendedor_id) === Number(vendedorId));
  }

  static async findById(id) {
    const pedidoRow = await selectById('pedidos', id);
    if (!pedidoRow) return null;

    const pedido = normalizePedido(pedidoRow);

    const [clientesRows, vendedoresRows, produtosRows] = await Promise.all([
      selectAll('clientes'),
      selectAll('vendedores'),
      selectAll('produtos')
    ]);

    const cliente = clientesRows.find((c) => Number(c.id) === pedido.cliente_id);
    const vendedor = vendedoresRows.find((v) => Number(v.id) === pedido.vendedor_id);
    const produtosMap = new Map(
      produtosRows.map((produto) => [Number(produto.id), produto])
    );

    const { data: itensRows, error } = await supabase
      .from('pedido_itens')
      .select('*')
      .eq('pedido_id', pedido.id);
    throwIfError(error);
    const itens = itensRows
      .filter((item) => Number(item.pedido_id) === pedido.id)
      .map((item) => {
        const produto = produtosMap.get(Number(item.produto_id)) || {};
        return {
          id: Number(item.id),
          pedido_id: Number(item.pedido_id),
          produto_id: Number(item.produto_id),
          quantidade: toNumberFromInput(item.quantidade),
          preco_unitario: toNumberFromInput(item.preco_unitario),
          desconto: toNumberFromInput(item.desconto),
          subtotal: toNumberFromInput(item.subtotal),
          produto_nome: produto.nome || '',
          produto_codigo: produto.codigo || '',
          produto_descricao: produto.descricao || '',
          unidade_medida: produto.unidade_medida || 'UN'
        };
      });

    if (!pedido.valor_total && itens.length > 0) {
      const subtotal = itens.reduce((sum, item) => sum + toNumberFromInput(item.subtotal), 0);
      if (subtotal > 0) {
        pedido.valor_total = subtotal * 1.065;
      }
    }

    return {
      ...pedido,
      cliente_nome: cliente?.nome_fantasia || '',
      cliente_cnpj: cliente?.cnpj || '',
      cliente_razao_social: cliente?.razao_social || '',
      cliente_email: cliente?.email || '',
      cliente_telefone: cliente?.telefone || '',
      cliente_endereco: cliente?.endereco || '',
      cliente_cidade: cliente?.cidade || '',
      cliente_estado: cliente?.estado || '',
      cliente_cep: cliente?.cep || '',
      cliente_ie: cliente?.inscricao_estadual || '',
      vendedor_nome: vendedor?.nome || '',
      itens
    };
  }

  static async updateStatus(id, status) {
    const row = await selectById('pedidos', id);
    if (!row) return { updated: false };
    const updated = {
      ...row,
      status,
      updated_at: new Date().toISOString()
    };
    await updateById('pedidos', id, updated, 'id');
    return { updated: true };
  }

  static async delete(id) {
    const pedidoRow = await selectById('pedidos', id);
    if (!pedidoRow) return { deleted: false };

    const { error: itemsError } = await supabase
      .from('pedido_itens')
      .delete()
      .eq('pedido_id', id);
    throwIfError(itemsError);

    const { error: pedidoError } = await supabase.from('pedidos').delete().eq('id', id);
    throwIfError(pedidoError);
    return { deleted: true };
  }
}

module.exports = Pedido;
