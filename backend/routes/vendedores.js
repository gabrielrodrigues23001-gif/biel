const express = require('express');
const router = express.Router();
const vendedorController = require('../controllers/vendedorController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');

router.use(authenticate);
router.use(requireAdmin);

router.get('/', vendedorController.getAllVendedores);
router.get('/:id', vendedorController.getVendedorById);
router.post('/', vendedorController.createVendedor);
router.put('/:id', vendedorController.updateVendedor);
router.delete('/:id/permanent', vendedorController.deleteVendedorPermanent);
router.delete('/:id', vendedorController.deleteVendedor);

module.exports = router;
