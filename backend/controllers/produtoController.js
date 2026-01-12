const Produto = require('../data/models/Produto');

exports.getAllProdutos = async (req, res) => {
  try {
    const produtos = await Produto.findAll();
    
    res.json({
      success: true,
      produtos
    });

  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.getProdutoById = async (req, res) => {
  try {
    const { id } = req.params;
    const produto = await Produto.findById(id);

    if (!produto) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    res.json({
      success: true,
      produto
    });

  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.createProduto = async (req, res) => {
  try {
    const produtoData = req.body;

    // Validações básicas
    if (!produtoData.codigo || !produtoData.nome || !produtoData.preco_tabela) {
      return res.status(400).json({
        success: false,
        error: 'Código, nome e preço de tabela são obrigatórios'
      });
    }

    const produto = await Produto.create(produtoData);

    res.status(201).json({
      success: true,
      message: 'Produto criado com sucesso',
      produto
    });

  } catch (error) {
    console.error('Erro ao criar produto:', error);
    
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        success: false,
        error: 'Código do produto já existe'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.updateProduto = async (req, res) => {
  try {
    const { id } = req.params;
    const produtoData = req.body;

    const produto = await Produto.update(id, produtoData);

    if (!produto) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Produto atualizado com sucesso',
      produto
    });

  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.deleteProduto = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await Produto.delete(id);

    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Produto excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};
