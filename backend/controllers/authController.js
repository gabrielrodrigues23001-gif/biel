const jwt = require('jsonwebtoken');
const User = require('../data/models/User');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Email e senha são obrigatórios'
      });
    }

    // Buscar usuário
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Verificar senha
    const isPasswordValid = await User.comparePassword(senha, user.senha);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Gerar token
    const token = generateToken(user.id);

    // Retornar dados do usuário (sem a senha)
    const userData = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      nivel_acesso: user.nivel_acesso,
      telefone: user.telefone
    };

    res.json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

exports.bootstrapAdmin = async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Nome, email e senha sao obrigatorios'
      });
    }

    const existing = await User.findAll();
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Bootstrap ja realizado'
      });
    }

    const user = await User.create({
      nome,
      email,
      senha,
      nivel_acesso: 'admin',
      ativo: 1
    });

    res.status(201).json({
      success: true,
      message: 'Admin criado com sucesso',
      user
    });
  } catch (error) {
    console.error('Erro no bootstrap:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};
