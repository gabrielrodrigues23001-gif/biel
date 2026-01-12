const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireAdminOrVendedor } = require('../middleware/authorize');

// Todas as rotas exigem autenticação
router.use(authenticate);

router.get('/', clienteController.getAllClientes);
router.get('/:id', clienteController.getClienteById);
router.post('/', requireAdminOrVendedor, clienteController.createCliente);
router.put('/:id', requireAdminOrVendedor, clienteController.updateCliente);
router.delete('/:id', requireAdminOrVendedor, clienteController.deleteCliente);

module.exports = router;
