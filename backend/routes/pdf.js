const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/pedido/:id', pdfController.gerarPDFPedido);

module.exports = router;
