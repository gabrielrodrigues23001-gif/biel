// Configurações globais do sistema
window.APP_CONFIG = {
    API_BASE: '/api',
    APP_NAME: 'Mercus ERP',
    VERSION: '1.0.0'
};

// Funções utilitárias globais
window.formatarMoeda = function(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
};

window.formatarData = function(dataString) {
    return new Date(dataString).toLocaleDateString('pt-BR');
};

window.validarEmail = function(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};
