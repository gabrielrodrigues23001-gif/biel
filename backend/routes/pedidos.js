const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const { authenticate } = require('../middleware/auth');

// Todas as rotas exigem autenticação
router.use(authenticate);

router.get('/', pedidoController.getAllPedidos);
router.get('/:id', pedidoController.getPedidoById);
router.post('/', pedidoController.createPedido);
router.patch('/:id/status', pedidoController.updatePedidoStatus);
router.delete('/:id', pedidoController.deletePedido);

module.exports = router;