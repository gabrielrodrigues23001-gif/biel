const express = require('express');
const router = express.Router();

router.get('/pdf-simple', (req, res) => {
    try {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=teste_simples.pdf');

        doc.pipe(res);
        doc.fontSize(25).text('PDF TESTE - FUNCIONANDO!', 100, 100);
        doc.text('Mercus ERP', 100, 150);
        doc.text(new Date().toLocaleString('pt-BR'), 100, 200);
        doc.end();
        
        console.log('✅ PDF teste gerado com sucesso');
    } catch (error) {
        console.error('❌ Erro no PDF teste:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;