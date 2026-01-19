const Cliente = require('../data/models/Cliente');
const VendedorSheet = require('../data/models/VendedorSheet');

exports.getAllClientes = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    
    res.json({
      success: true,
      clientes
    });

  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await Cliente.findById(id);

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    res.json({
      success: true,
      cliente
    });

  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.createCliente = async (req, res) => {
  try {
    const clienteData = req.body;

    // Validações básicas
    if (!clienteData.razao_social || !clienteData.nome_fantasia) {
      return res.status(400).json({
        success: false,
        error: 'Razão social e nome fantasia são obrigatórios'
      });
    }

    if (!clienteData.vendedor_id && req.userId) {
      clienteData.vendedor_id = req.userId;
    }
    if (clienteData.vendedor_id) {
      const vendedorId = Number(clienteData.vendedor_id);
      let vendedor = await VendedorSheet.findById(vendedorId);
      if (!vendedor && req.user && req.user.id === vendedorId) {
        vendedor = await VendedorSheet.create(
          {
            nome: req.user.nome,
            email: req.user.email,
            telefone: req.user.telefone,
            nivel_acesso: req.user.nivel_acesso,
            comissao: req.user.comissao ?? 0,
            ativo: true
          },
          vendedorId
        );
      }
      if (!vendedor) {
        return res.status(400).json({
          success: false,
          error: 'Vendedor nao encontrado'
        });
      }
    }

    const cliente = await Cliente.create(clienteData);

    res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      cliente
    });

  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        success: false,
        error: 'CNPJ já cadastrado'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const clienteData = req.body;

    if (req.user?.nivel_acesso !== 'admin') {
      delete clienteData.vendedor_id;
    }

    const cliente = await Cliente.update(id, clienteData);

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Cliente atualizado com sucesso',
      cliente
    });

  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente nÆo encontrado'
      });
    }

    const vendedorId = cliente.vendedor_id ? Number(cliente.vendedor_id) : null;
    if (req.user?.nivel_acesso !== 'admin' && vendedorId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const result = await Cliente.delete(id);

    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Cliente excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

