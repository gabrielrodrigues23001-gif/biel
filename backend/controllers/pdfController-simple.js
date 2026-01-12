const PDFDocument = require('pdfkit');
const Pedido = require('../data/models/Pedido');

exports.gerarPDFPedido = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`?? Buscando pedido ${id} para PDF`);

        // Buscar pedido
        const pedido = await Pedido.findById(id);
        
        if (!pedido) {
            return res.status(404).json({
                success: false,
                error: 'Pedido nÆo encontrado'
            });
        }

        console.log('?? Pedido encontrado, criando PDF...');

        // Criar PDF simples para testar
        const doc = new PDFDocument();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=teste_${pedido.numero_pedido}.pdf`);

        doc.pipe(res);

        // Conte£do m¡nimo para testar
        doc.fontSize(20).text('MERCUS ERP - TESTE PDF', 100, 100);
        doc.fontSize(12).text(`Pedido: ${pedido.numero_pedido}`, 100, 150);
        doc.text(`Cliente: ${pedido.cliente_nome || 'N/A'}`, 100, 170);
        doc.text(`Valor Total: R$ ${pedido.valor_total || '0.00'}`, 100, 190);
        doc.text(`Data: ${new Date(pedido.data_emissao).toLocaleDateString('pt-BR')}`, 100, 210);
        doc.text(`Observacoes: ${pedido.observacoes || 'N/A'}`, 100, 230);

        doc.end();
        console.log('? PDF de teste gerado com sucesso');

    } catch (error) {
        console.error('? Erro cr¡tico ao gerar PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Falha na gera‡Æo do PDF: ' + error.message
        });
    }
};
