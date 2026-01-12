const Pedido = require('../data/models/Pedido');

exports.getAllPedidos = async (req, res) => {
  try {
    const pedidos = req.user?.nivel_acesso === 'admin'
      ? await Pedido.findAll()
      : await Pedido.findAllByVendedor(req.userId);

    res.json({
      success: true,
      pedidos
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.getPedidoById = async (req, res) => {
  try {
    const { id } = req.params;
    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return res.status(404).json({
        success: false,
        error: 'Pedido nao encontrado'
      });
    }

    if (req.user?.nivel_acesso !== 'admin' && pedido.vendedor_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    res.json({
      success: true,
      pedido
    });
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.createPedido = async (req, res) => {
  try {
    const { cliente_id, itens, condicao_pagamento, observacoes } = req.body;

    if (!cliente_id || !itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cliente e itens sao obrigatorios'
      });
    }

    for (let item of itens) {
      if (!item.produto_id || !item.quantidade || !item.preco_unitario) {
        return res.status(400).json({
          success: false,
          error: 'Cada item deve ter produto_id, quantidade e preco_unitario'
        });
      }
    }

    const pedidoData = {
      cliente_id,
      vendedor_id: req.userId,
      itens,
      condicao_pagamento: condicao_pagamento || '28,42,56,70,84,98,112,126,140,154',
      observacoes: observacoes || ''
    };

    const pedido = await Pedido.create(pedidoData);

    res.status(201).json({
      success: true,
      message: 'Pedido criado com sucesso',
      pedido
    });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor: ' + error.message
    });
  }
};

exports.updatePedidoStatus = async (req, res) => {
  try {
    if (req.user?.nivel_acesso !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const statusValidos = ['pendente', 'aprovado', 'faturado', 'cancelado'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status invalido'
      });
    }

    const result = await Pedido.updateStatus(id, status);

    if (!result.updated) {
      return res.status(404).json({
        success: false,
        error: 'Pedido nao encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Status do pedido atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.deletePedido = async (req, res) => {
  try {
    if (req.user?.nivel_acesso !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const { id } = req.params;

    const result = await Pedido.delete(id);

    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Pedido nao encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Pedido excluido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};
