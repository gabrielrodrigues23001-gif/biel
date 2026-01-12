const PDFDocument = require('pdfkit');
const Pedido = require('../data/models/Pedido');

exports.gerarPDFPedido = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📝 Gerando PDF para pedido ID: ${id}`);

        // Buscar pedido com itens (ajuste conforme o ORM/relacionamento)
        const pedido = await Pedido.findById(id);

        if (!pedido) {
            return res.status(404).json({
                success: false,
                error: 'Pedido nao encontrado',
            });
        }

        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Pedido_${pedido.numero_pedido}.pdf`
        );

        doc.pipe(res);

        const pageLeft = 50;
        const pageRight = 550;
        const leftColX = 50;
        const rightColX = 320;
        const colWidth = 230;

        const tableColumns = [
            { label: '#', x: 50, width: 18, align: 'left' },
            { label: 'Codigo', x: 70, width: 45, align: 'left' },
            { label: 'Produto', x: 120, width: 145, align: 'left' },
            { label: 'Qtde.', x: 270, width: 40, align: 'right' },
            { label: 'Preco Tabela', x: 320, width: 65, align: 'right' },
            { label: 'Preco Liquido', x: 390, width: 65, align: 'right' },
            { label: 'Preco c/ Impostos', x: 460, width: 70, align: 'right' },
            { label: 'Subtotal', x: 535, width: 35, align: 'right' }
        ];

        const drawTableHeader = (yPos) => {
            doc.font('Helvetica-Bold').fontSize(8);
            tableColumns.forEach((col) => {
                doc.text(col.label, col.x, yPos, { width: col.width, align: col.align });
            });
            doc.moveTo(50, yPos + 12).lineTo(570, yPos + 12).stroke();
        };

        const writeField = (x, y, label, value, width) => {
            const safeValue = value || 'N/A';
            doc.font('Helvetica-Bold').fontSize(9).text(label, x, y);
            const labelWidth = doc.widthOfString(label) + 4;
            doc.font('Helvetica').fontSize(9).text(safeValue, x + labelWidth, y, {
                width: width - labelWidth
            });
            const labelHeight = doc.heightOfString(label, { width });
            const valueHeight = doc.heightOfString(safeValue, { width: width - labelWidth });
            return Math.max(labelHeight, valueHeight);
        };

        // ===== CABECALHO =====
        doc.fontSize(16).font('Helvetica-Bold')
            .text('Icebound foods   ', 50, 50, { align: 'center' });

        doc.fontSize(14).font('Helvetica')
            .text(`Pedido No ${pedido.numero_pedido}`, 50, 70, { align: 'center' });

        doc.moveTo(50, 90).lineTo(550, 90).stroke();

        // ===== REPRESENTADA =====
        let cursorY = 110;
        cursorY += writeField(leftColX, cursorY, 'Representada:', 'Icebound foods', pageRight - pageLeft) + 10;

        // ===== INFORMACOES DO CLIENTE =====
        const rowGap = 8;

        const addRow = (leftLabel, leftValue, rightLabel, rightValue) => {
            const leftHeight = writeField(leftColX, cursorY, leftLabel, leftValue, colWidth);
            const rightHeight = rightLabel
                ? writeField(rightColX, cursorY, rightLabel, rightValue, colWidth)
                : 0;
            cursorY += Math.max(leftHeight, rightHeight) + rowGap;
        };

        addRow('Cliente:', pedido.cliente_nome, 'Nome Fantasia:', pedido.cliente_nome);
        addRow('CNPJ:', pedido.cliente_cnpj, 'Inscricao Estadual:', pedido.cliente_ie);
        addRow('Endereco:', pedido.cliente_endereco, 'CEP:', pedido.cliente_cep);
        addRow('Cidade:', pedido.cliente_cidade, 'Estado:', pedido.cliente_estado);
        addRow('Telefone:', pedido.cliente_telefone, 'E-mail:', pedido.cliente_email);

        // ===== TABELA DE PRODUTOS =====
        const tableTop = cursorY + 8;
        drawTableHeader(tableTop);

        let y = tableTop + 20;
        let itemNumber = 1;
        let quantidadeTotal = 0;
        let valorTotalProdutos = 0;

        doc.font('Helvetica').fontSize(7);

        if (pedido.itens && pedido.itens.length > 0) {
            for (const item of pedido.itens) {
                const quantidade = Number(item.quantidade) || 0;
                const precoTabela = Number(item.preco_unitario) || 0;
                const precoLiquido = precoTabela;
                const precoComImpostos = precoTabela * 1.234; // aproximacao para impostos
                const subtotal = quantidade * precoComImpostos;

                const produtoNome = item.produto_nome || 'Produto';
                const produtoAltura = doc.heightOfString(produtoNome, { width: 145 });
                const rowHeight = Math.max(12, produtoAltura + 2);

                // Quebra de pagina se necessario
                if (y + rowHeight > 680) {
                    doc.addPage();
                    y = 50;
                    drawTableHeader(y);
                    y += 20;
                }

                quantidadeTotal += quantidade;
                valorTotalProdutos += subtotal;

                doc.text(itemNumber.toString(), 50, y, { width: 18 });
                doc.text(item.produto_codigo || 'N/A', 70, y, { width: 45 });
                doc.text(produtoNome, 120, y, { width: 145 });
                doc.text(`${quantidade.toFixed(2)} ${item.unidade_medida || 'MT'}`, 270, y, { width: 40, align: 'right' });
                doc.text(`R$ ${precoTabela.toFixed(2)}`, 320, y, { width: 65, align: 'right' });
                doc.text(`R$ ${precoLiquido.toFixed(2)}`, 390, y, { width: 65, align: 'right' });
                doc.text(`R$ ${precoComImpostos.toFixed(2)}`, 460, y, { width: 70, align: 'right' });
                doc.text(`R$ ${subtotal.toFixed(2)}`, 535, y, { width: 35, align: 'right' });

                y += rowHeight + 4;
                itemNumber++;
            }
        } else {
            doc.text('Nenhum item encontrado', 120, y);
            y += 15;
        }

        // ===== TOTAIS =====
        if (y + 170 > 740) {
            doc.addPage();
            y = 50;
        }

        const totaisY = y + 20;

        const valorTotal = valorTotalProdutos;

        const totalsLeft = 350;
        const totalsWidth = 200;
        const totalsValueWidth = 80;
        const totalsRowHeight = 16;
        let totalsCursor = totaisY;

        doc.fontSize(9).font('Helvetica-Bold');

        const addTotalLine = (label, value) => {
            doc.text(label, totalsLeft, totalsCursor, { width: totalsWidth - totalsValueWidth });
            doc.text(value, totalsLeft + (totalsWidth - totalsValueWidth), totalsCursor, {
                width: totalsValueWidth,
                align: 'right'
            });
            totalsCursor += totalsRowHeight;
        };

        addTotalLine('Qtde. Total:', quantidadeTotal.toFixed(2));
        addTotalLine('Qtde. volumes:', '0 Vol');
        addTotalLine('Peso bruto total:', `${(quantidadeTotal * 17).toFixed(3)} kg`);
        addTotalLine('Total (Preco Tabela):', `R$ ${valorTotalProdutos.toFixed(2)}`);
        addTotalLine('Total de Descontos:', 'R$ 0,00');
        addTotalLine('Valor total em produtos:', `R$ ${valorTotalProdutos.toFixed(2)}`);

        doc.fontSize(10).font('Helvetica-Bold');
        addTotalLine('Valor total:', `R$ ${valorTotal.toFixed(2)}`);

        // ===== CONDICAO DE PAGAMENTO E DATA =====
        const footerY = totalsCursor + 16;

        doc.fontSize(9).font('Helvetica-Bold')
            .text('Condicao de Pagamento:', 50, footerY);
        doc.font('Helvetica')
            .text(pedido.condicao_pagamento || '28,42,56,70,84,98,112,126,140,154', 180, footerY, { width: 360 });

        doc.font('Helvetica-Bold').text('Data de Emissao:', 50, footerY + 15);
        doc.font('Helvetica').text(
            pedido.data_emissao
                ? new Date(pedido.data_emissao).toLocaleDateString('pt-BR')
                : new Date().toLocaleDateString('pt-BR'),
            130,
            footerY + 15
        );

        doc.font('Helvetica-Bold').text('Vendedor:', 320, footerY + 15);
        doc.font('Helvetica').text(pedido.vendedor_nome || 'N/A', 380, footerY + 15, { width: 170 });

        // Finalizar PDF
        doc.end();
        console.log('✅ PDF gerado com sucesso');

    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
        console.error('Stack trace:', error.stack);

        try {
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor ao gerar PDF',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            });
        } catch (responseError) {
            console.error('❌ Erro ao enviar resposta de erro:', responseError);
        }
    }
};
