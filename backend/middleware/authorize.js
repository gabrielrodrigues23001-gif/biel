exports.requireAdmin = (req, res, next) => {
  const role = req.user?.nivel_acesso;
  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado'
    });
  }

  next();
};

exports.requireAdminOrVendedor = (req, res, next) => {
  const role = req.user?.nivel_acesso;
  if (role !== 'admin' && role !== 'vendedor') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado'
    });
  }

  next();
};
