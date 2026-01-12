const User = require('../data/models/User');
const VendedorSheet = require('../data/models/VendedorSheet');

exports.getAllVendedores = async (req, res) => {
  try {
    const vendedores = await VendedorSheet.findAll();

    res.json({
      success: true,
      vendedores
    });
  } catch (error) {
    console.error('Erro ao buscar vendedores:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.getVendedorById = async (req, res) => {
  try {
    const { id } = req.params;
    const vendedor = await VendedorSheet.findById(id);

    if (!vendedor) {
      return res.status(404).json({
        success: false,
        error: 'Vendedor nao encontrado'
      });
    }

    res.json({
      success: true,
      vendedor
    });
  } catch (error) {
    console.error('Erro ao buscar vendedor:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.createVendedor = async (req, res) => {
  try {
    const { nome, email, senha, nivel_acesso, telefone, comissao, ativo } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Nome, email e senha sao obrigatorios'
      });
    }

    const user = await User.create({
      nome,
      email,
      senha,
      nivel_acesso: nivel_acesso || 'vendedor',
      telefone,
      comissao: comissao ?? 0,
      ativo: ativo ?? 1
    });

    const vendedor = await VendedorSheet.create(
      {
        nome,
        email,
        nivel_acesso: nivel_acesso || 'vendedor',
        telefone,
        comissao: comissao ?? 0,
        ativo: ativo ?? 1
      },
      user.id
    );

    res.status(201).json({
      success: true,
      message: 'Vendedor criado com sucesso',
      vendedor
    });
  } catch (error) {
    console.error('Erro ao criar vendedor:', error);

    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        success: false,
        error: 'Email ja cadastrado'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.updateVendedor = async (req, res) => {
  try {
    const { id } = req.params;
    const vendedorData = { ...req.body };

    if (vendedorData.senha === '') {
      delete vendedorData.senha;
    }

    const userUpdate = { ...vendedorData };
    if (userUpdate.senha === undefined) {
      delete userUpdate.senha;
    }

    await User.update(id, userUpdate);

    const vendedor = await VendedorSheet.update(id, {
      nome: vendedorData.nome,
      email: vendedorData.email,
      telefone: vendedorData.telefone,
      nivel_acesso: vendedorData.nivel_acesso,
      comissao: vendedorData.comissao,
      ativo: vendedorData.ativo
    });

    if (!vendedor) {
      return res.status(404).json({
        success: false,
        error: 'Vendedor nao encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Vendedor atualizado com sucesso',
      vendedor
    });
  } catch (error) {
    console.error('Erro ao atualizar vendedor:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.deleteVendedor = async (req, res) => {
  try {
    const { id } = req.params;

    await User.deactivate(id);
    const result = await VendedorSheet.deactivate(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Vendedor nao encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Vendedor desativado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao desativar vendedor:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.deleteVendedorPermanent = async (req, res) => {
  try {
    const { id } = req.params;
    const vendedor = await VendedorSheet.findById(id);

    if (!vendedor) {
      return res.status(404).json({
        success: false,
        error: 'Vendedor nao encontrado'
      });
    }

    const hasPedidos = await VendedorSheet.hasPedidos(id);
    if (hasPedidos) {
      return res.status(400).json({
        success: false,
        error: 'Vendedor possui pedidos vinculados'
      });
    }

    await User.deletePermanent(id);
    const result = await VendedorSheet.delete(id);

    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Vendedor nao encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Vendedor excluido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir vendedor:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};
