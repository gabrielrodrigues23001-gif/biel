const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');

// Todas as rotas exigem autenticação
router.use(authenticate);

router.get('/', produtoController.getAllProdutos);
router.get('/:id', produtoController.getProdutoById);
router.post('/', requireAdmin, produtoController.createProduto);
router.put('/:id', requireAdmin, produtoController.updateProduto);
router.delete('/:id', requireAdmin, produtoController.deleteProduto);

module.exports = router;
