const User = require('./models/User');
const Cliente = require('./models/Cliente');
const Produto = require('./models/Produto');

exports.initialize = async () => {
  try {
    console.log('🔄 Inicializando dados do sistema...');

    // Criar usuário admin
    try {
      await User.create({
        nome: 'Administrador',
        email: 'admin@mercus.com',
        senha: 'admin123',
        nivel_acesso: 'admin',
        telefone: '(11) 99999-9999'
      });
      console.log('✅ Usuário admin criado');
    } catch (error) {
      console.log('ℹ️  Usuário admin já existe');
    }

    // Criar alguns clientes de exemplo
    const clientes = [
      {
        cnpj: '12.345.678/0001-90',
        razao_social: 'Empresa ABC Ltda',
        nome_fantasia: 'ABC Comércio',
        email: 'contato@abc.com',
        telefone: '(11) 3333-4444',
        endereco: 'Rua das Flores, 123',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01234-567',
        inscricao_estadual: '123.456.789.110'
      },
      {
        cnpj: '98.765.432/0001-10',
        razao_social: 'Companhia XYZ S/A',
        nome_fantasia: 'XYZ Distribuidora',
        email: 'vendas@xyz.com',
        telefone: '(11) 5555-6666',
        endereco: 'Av. Principal, 456',
        cidade: 'Rio de Janeiro',
        estado: 'RJ',
        cep: '04567-890',
        inscricao_estadual: '987.654.321.000'
      }
    ];

    for (let cliente of clientes) {
      try {
        await Cliente.create(cliente);
        console.log(`✅ Cliente ${cliente.nome_fantasia} criado`);
      } catch (error) {
        console.log(`ℹ️  Cliente ${cliente.nome_fantasia} já existe`);
      }
    }

    // Criar alguns produtos de exemplo
    const produtos = [
      {
        codigo: 'PROD001',
        nome: 'Notebook Dell Inspiron',
        descricao: 'Notebook Dell Inspiron 15, 8GB RAM, 256GB SSD',
        preco_tabela: 2899.90,
        preco_custo: 2200.00,
        estoque_atual: 15,
        estoque_minimo: 5,
        unidade_medida: 'UN'
      },
      {
        codigo: 'PROD002',
        nome: 'Mouse Wireless Logitech',
        descricao: 'Mouse sem fio Logitech M170',
        preco_tabela: 49.90,
        preco_custo: 35.00,
        estoque_atual: 50,
        estoque_minimo: 20,
        unidade_medida: 'UN'
      },
      {
        codigo: 'PROD003',
        nome: 'Teclado Mecânico RGB',
        descricao: 'Teclado mecânico com iluminação RGB',
        preco_tabela: 299.90,
        preco_custo: 210.00,
        estoque_atual: 25,
        estoque_minimo: 10,
        unidade_medida: 'UN'
      },
      {
        codigo: 'PROD004',
        nome: 'Monitor 24" Samsung',
        descricao: 'Monitor LED 24 polegadas Full HD',
        preco_tabela: 799.90,
        preco_custo: 650.00,
        estoque_atual: 8,
        estoque_minimo: 3,
        unidade_medida: 'UN'
      }
    ];

    for (let produto of produtos) {
      try {
        await Produto.create(produto);
        console.log(`✅ Produto ${produto.nome} criado`);
      } catch (error) {
        console.log(`ℹ️  Produto ${produto.nome} já existe`);
      }
    }

    console.log('🎉 Dados inicializados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar dados:', error);
  }
};

// Executar inicialização se chamado diretamente
if (require.main === module) {
  exports.initialize();
}
