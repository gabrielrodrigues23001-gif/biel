// Configuração da API
const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '/api';

// Função para chamadas à API
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('mercus_token');
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        },
        ...options
    };

    if (options.body && config.method !== 'GET') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else if (contentType && contentType.includes('application/pdf')) {
            // Para PDF, retornar a resposta diretamente
            return response;
        } else {
            throw new Error('Resposta não é JSON');
        }
        
        if (!response.ok) {
            throw new Error(data.error || `Erro ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error('Erro na API:', error);
        
        // Se for erro de autenticação, redirecionar para login
        if (error.message.includes('401') || error.message.includes('Token')) {
            logout();
        }
        
        throw error;
    }
}

// Estado da aplicação
let state = {
    currentUser: null,
    currentPage: 'dashboard',
    pedidos: [],
    clientes: [],
    produtos: [],
    vendedores: [],
    currentPedido: null,
    currentProdutoId: null,
    currentPageNumber: 1,
    itemsPerPage: 10
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Verificar autenticação
    await checkAuth();
    
    setupEventListeners();
    initializeSearchUI();
    initializeNotificationsUI();
    await loadInitialData();
    initializeCharts();
}

async function checkAuth() {
    const userData = localStorage.getItem('mercus_current_user');
    const token = localStorage.getItem('mercus_token');
    
    if (!userData || !token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Tentar validar o token
        const result = await apiCall('/auth/me');
        state.currentUser = result.user;
        updateUserInterface();
    } catch (error) {
        console.log('Token inválido ou expirado:', error);
        // Se estiver em uma página que não seja login, redirecionar
        if (!window.location.href.includes('login.html')) {
            logout();
        }
    }
}

async function loadInitialData() {
    try {
        await loadClientes();
        await loadProdutos();
        if (state.currentUser?.nivel_acesso === 'admin') {
            await loadVendedores();
        }
        await loadPedidos();
        await loadDashboardData();
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
    }
}

function setupEventListeners() {
    document.addEventListener('click', handleActionButtons);
    document.addEventListener('change', handlePedidoItemChange);
    document.addEventListener('input', handlePedidoItemChange);

    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const menuToggle = document.getElementById('menuToggle');
    const isMobile = () => window.matchMedia('(max-width: 992px)').matches;

    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('active');
        sidebarOverlay?.classList.add('active');
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('active');
        sidebarOverlay?.classList.remove('active');
    }

    function toggleSidebar() {
        if (!sidebar) return;
        if (sidebar.classList.contains('active')) {
            closeSidebar();
            return;
        }
        openSidebar();
    }

    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            navigateToPage(page);
            if (isMobile()) {
                closeSidebar();
            }
        });
    });

    // Menu toggle
    menuToggle?.addEventListener('click', toggleSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // Modal de pedido
    document.getElementById('novoPedidoBtn').addEventListener('click', openPedidoModal);
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeAllModals);
    });
    document.getElementById('cancelPedido').addEventListener('click', closeAllModals);
    document.getElementById('addItemBtn').addEventListener('click', addItemToPedido);
    document.getElementById('savePedido').addEventListener('click', savePedido);
    document.getElementById('generatePDFBtn').addEventListener('click', generatePDF);

    // Modal de cliente
    document.getElementById('novoClienteBtn').addEventListener('click', openClienteModal);
    document.getElementById('cancelCliente').addEventListener('click', closeAllModals);
    document.getElementById('saveCliente').addEventListener('click', saveCliente);

    // Modal de produto
    document.getElementById('novoProdutoBtn')?.addEventListener('click', openProdutoModal);
    document.getElementById('cancelProduto')?.addEventListener('click', closeAllModals);
    document.getElementById('saveProduto')?.addEventListener('click', saveProduto);

    // Modal de vendedor
    document.getElementById('novoVendedorBtn').addEventListener('click', openVendedorModal);
    document.getElementById('cancelVendedor').addEventListener('click', closeAllModals);

    // Relatorios
    setupReportActionButtons();

    document.getElementById('generateReportsPdfBtn')?.addEventListener('click', generateReportsPDF);

    // Filtros
    document.getElementById('statusFilter')?.addEventListener('change', filterPedidos);
    document.getElementById('dateFilter')?.addEventListener('change', filterPedidos);
    document.getElementById('vendedorFilter')?.addEventListener('change', filterPedidos);
    document.getElementById('clearFilters')?.addEventListener('click', clearFilters);
    document.getElementById('clienteStatusFilter')?.addEventListener('change', filterClientes);
    document.getElementById('cidadeFilter')?.addEventListener('input', filterClientes);

    // Paginação
    document.getElementById('prevPage')?.addEventListener('click', previousPage);
    document.getElementById('nextPage')?.addEventListener('click', nextPage);

    // Busca global
    document.getElementById('globalSearch')?.addEventListener('input', performGlobalSearch);

    // Logout
    document.querySelector('.logout-btn').addEventListener('click', logout);

    // View all pedidos
    const viewAllBtn = document.querySelector('.view-all');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToPage('pedidos');
        });
    }
}

function handleActionButtons(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id ? Number(button.dataset.id) : null;
    const status = button.dataset.status;
    const active = button.dataset.active ? Number(button.dataset.active) : null;

    switch (action) {
        case 'view-cliente':
            return viewCliente(id);
        case 'edit-cliente':
            return editCliente(id);
        case 'delete-cliente':
            return deleteCliente(id);
        case 'view-produto':
            return viewProduto(id);
        case 'edit-produto':
            return editProduto(id);
        case 'delete-produto':
            return deleteProduto(id);
        case 'view-pedido':
            return viewPedido(id);
        case 'pdf-pedido':
            return generatePedidoPDF(id);
        case 'toggle-pedido-status':
            return togglePedidoStatus(id, status);
        case 'delete-pedido':
            return deletePedido(id);
        case 'view-vendedor':
            return viewVendedor(id);
        case 'edit-vendedor':
            return editVendedor(id);
        case 'toggle-vendedor':
            return toggleVendedorAtivo(id, active);
        case 'delete-vendedor':
            return deleteVendedorPermanent(id);
        case 'remove-item':
            return removeItem(button);
        default:
            return;
    }
}


function handlePedidoItemChange(event) {
    const target = event.target;
    if (!target) return;

    if (target.classList.contains('produto-select')) {
        updateProdutoInfo(target);
        return;
    }

    if (target.classList.contains('quantidade') ||
        target.classList.contains('preco-unitario') ||
        target.classList.contains('desconto')) {
        calculateItemTotal(target);
    }
}


function setupReportActionButtons() {
    const actions = [
        { selector: '[onclick="generateSalesReport()"]', handler: generateSalesReport },
        { selector: '[onclick="generateClientsReport()"]', handler: generateClientsReport },
        { selector: '[onclick="generateStockReport()"]', handler: generateStockReport },
        { selector: '[onclick="generateFinancialReport()"]', handler: generateFinancialReport }
    ];

    actions.forEach((action) => {
        const btn = document.querySelector(action.selector);
        if (btn) {
            btn.removeAttribute('onclick');
            btn.addEventListener('click', action.handler);
        }
    });
}

function initializeSearchUI() {
    const searchBox = document.querySelector('.search-box');
    const input = document.getElementById('globalSearch');
    if (!searchBox || !input) return;

    let results = document.getElementById('searchResults');
    if (!results) {
        results = document.createElement('div');
        results.id = 'searchResults';
        results.className = 'search-results';
        searchBox.appendChild(results);
    }

    input.addEventListener('focus', () => {
        updateGlobalSearchResults(input.value.trim().toLowerCase());
    });

    results.addEventListener('click', (event) => {
        const item = event.target.closest('.search-item');
        if (!item) return;
        const page = item.getAttribute('data-page');
        const id = item.getAttribute('data-id');
        results.classList.remove('show');

        if (page) {
            navigateToPage(page);
            setTimeout(() => {
                if (page === 'pedidos' && id) {
                    highlightPedidoRow(id);
                }
            }, 300);
        }
    });

    document.addEventListener('click', (event) => {
        if (!searchBox.contains(event.target)) {
            results.classList.remove('show');
        }
    });
}

function updateGlobalSearchResults(searchTerm) {
    const results = document.getElementById('searchResults');
    if (!results) return;

    if (!searchTerm || searchTerm.length < 2) {
        results.classList.remove('show');
        results.innerHTML = '';
        return;
    }

    const sections = buildSearchResults(searchTerm);

    if (sections.length === 0) {
        results.innerHTML = '<div class="search-empty">Sem resultados</div>';
        results.classList.add('show');
        return;
    }

    results.innerHTML = sections.map((section) => {
        const itemsHtml = section.items.map((item) => `
            <div class="search-item" data-page="${item.page}" data-id="${item.id || ''}">
                <div class="search-item-title">${item.title}</div>
                <div class="search-item-subtitle">${item.subtitle}</div>
            </div>
        `).join('');

        return `
            <div class="search-section">
                <div class="search-section-title">${section.title}</div>
                ${itemsHtml}
            </div>
        `;
    }).join('');

    results.classList.add('show');
}

function buildSearchResults(searchTerm) {
    const sections = [];
    const term = searchTerm.toLowerCase();

    const pedidosMatches = state.pedidos
        .filter((pedido) =>
            (pedido.numero_pedido && pedido.numero_pedido.toLowerCase().includes(term)) ||
            (pedido.cliente_nome && pedido.cliente_nome.toLowerCase().includes(term))
        )
        .slice(0, 5)
        .map((pedido) => ({
            id: pedido.id,
            page: 'pedidos',
            title: `Pedido ${pedido.numero_pedido || `PD${pedido.id.toString().padStart(4, '0')}`}`,
            subtitle: `${pedido.cliente_nome || 'N/A'} - ${new Date(pedido.data_emissao).toLocaleDateString('pt-BR')}`
        }));

    if (pedidosMatches.length > 0) {
        sections.push({ title: 'Pedidos', items: pedidosMatches });
    }

    if (state.clientes && state.clientes.length > 0) {
        const clientesMatches = state.clientes
            .filter((cliente) =>
                (cliente.nome_fantasia && cliente.nome_fantasia.toLowerCase().includes(term)) ||
                (cliente.cnpj && cliente.cnpj.includes(term)) ||
                (cliente.cidade && cliente.cidade.toLowerCase().includes(term))
            )
            .slice(0, 5)
            .map((cliente) => ({
                page: 'clientes',
                title: cliente.nome_fantasia,
                subtitle: `${cliente.cidade || 'N/A'} - ${cliente.estado || ''}`
            }));

        if (clientesMatches.length > 0) {
            sections.push({ title: 'Clientes', items: clientesMatches });
        }
    }

    if (state.produtos && state.produtos.length > 0) {
        const produtosMatches = state.produtos
            .filter((produto) =>
                (produto.nome && produto.nome.toLowerCase().includes(term)) ||
                (produto.codigo && produto.codigo.toLowerCase().includes(term)) ||
                (produto.descricao && produto.descricao.toLowerCase().includes(term))
            )
            .slice(0, 5)
            .map((produto) => ({
                page: 'produtos',
                title: `${produto.codigo} - ${produto.nome}`,
                subtitle: produto.descricao || 'Sem descricao'
            }));

        if (produtosMatches.length > 0) {
            sections.push({ title: 'Produtos', items: produtosMatches });
        }
    }

    return sections;
}

function highlightPedidoRow(pedidoId) {
    const row = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
    if (!row) return;

    row.classList.add('row-highlight');
    setTimeout(() => {
        row.classList.remove('row-highlight');
    }, 1500);
}

function initializeNotificationsUI() {
    const bell = document.querySelector('.notifications');
    if (!bell) return;

    let panel = document.getElementById('notificationPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'notificationPanel';
        panel.className = 'notification-panel';
        bell.appendChild(panel);
    }

    bell.addEventListener('click', (event) => {
        event.stopPropagation();
        renderNotificationPanel();
        panel.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        panel.classList.remove('show');
    });
}

function buildNotificationsFromState() {
    const notifications = [];
    const isAdmin = state.currentUser?.nivel_acesso === 'admin';

    if (state.pedidos && state.pedidos.length > 0) {
        const pendentes = state.pedidos.filter((pedido) => pedido.status === 'pendente').length;
        if (pendentes > 0) {
            notifications.push({
                type: 'warning',
                title: 'Pedidos pendentes',
                message: `${pendentes} pedido(s) aguardando aprovacao`
            });
        }
    }

    if (isAdmin && state.produtos && state.produtos.length > 0) {
        const estoqueBaixo = getLowStockCount(state.produtos);
        if (estoqueBaixo > 0) {
            notifications.push({
                type: 'danger',
                title: 'Estoque baixo',
                message: `${estoqueBaixo} produto(s) abaixo do minimo`
            });
        }
    }

    if (notifications.length === 0) {
        notifications.push({
            type: 'info',
            title: 'Sem novas notificacoes',
            message: 'Nenhum alerta no momento'
        });
    }

    return notifications;
}

function renderNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return;

    const notifications = buildNotificationsFromState();

    panel.innerHTML = notifications.map((item) => `
        <div class="notification-item ${item.type}">
            <div class="notification-item-title">${item.title}</div>
            <div class="notification-item-message">${item.message}</div>
        </div>
    `).join('');
}

function refreshNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    const notifications = buildNotificationsFromState();
    const count = notifications.filter((item) => item.type !== 'info').length;
    badge.textContent = count.toString();
    badge.style.display = count > 0 ? 'flex' : 'none';
}

function updateUserInterface() {
    if (state.currentUser) {
        const userNameElement = document.querySelector('.user-name');
        const userRoleElement = document.querySelector('.user-role');
        
        if (userNameElement) {
            userNameElement.textContent = state.currentUser.nome;
        }
        if (userRoleElement) {
            userRoleElement.textContent = state.currentUser.nivel_acesso === 'admin' ? 'Administrador' : 'Vendedor';
        }

        if (state.currentUser.nivel_acesso !== 'admin') {
            applyVendedorView();
            const novoProdutoBtn = document.getElementById('novoProdutoBtn');
            if (novoProdutoBtn) {
                novoProdutoBtn.style.display = 'none';
            }
        }
    }
}

function applyVendedorView() {
    document.querySelectorAll('.nav-item').forEach(item => {
        const page = item.getAttribute('data-page');
        if (page !== 'pedidos' && page !== 'produtos' && page !== 'clientes') {
            item.style.display = 'none';
        }
    });

    const vendedorFilter = document.getElementById('vendedorFilter');
    if (vendedorFilter) {
        const filterGroup = vendedorFilter.closest('.filter-group');
        if (filterGroup) {
            filterGroup.style.display = 'none';
        }
    }

    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.display = 'none';
    }

    navigateToPage('pedidos');
}

// Navegação entre páginas
function navigateToPage(pageName) {
    if (state.currentUser?.nivel_acesso !== 'admin' && pageName !== 'pedidos' && pageName !== 'produtos' && pageName !== 'clientes') {
        pageName = 'pedidos';
    }

    // Atualizar navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNavItem = document.querySelector(`[data-page="${pageName}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }

    // Atualizar conteúdo
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    const activePage = document.getElementById(pageName);
    if (activePage) {
        activePage.classList.add('active');
    }

    // Atualizar título
    const pageTitleElement = document.getElementById('pageTitle');
    if (pageTitleElement && activeNavItem) {
        pageTitleElement.textContent = activeNavItem.textContent.trim();
    }

    state.currentPage = pageName;

    // Carregar dados específicos da página
    switch(pageName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'pedidos':
            loadPedidos();
            break;
        case 'clientes':
            loadClientes();
            break;
        case 'produtos':
            loadProdutos();
            break;
        case 'vendedores':
            loadVendedores();
            break;
        case 'relatorios':
            loadRelatorios();
            break;
    }
}

// Dashboard
let salesChartInstance = null;

function initializeCharts() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    // Dados REAIS para o gráfico baseados nos pedidos
    const vendasPorMes = calcularVendasPorMes(state.pedidos);
    
    if (salesChartInstance) {
        salesChartInstance.destroy();
        salesChartInstance = null;
    }

    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: vendasPorMes.meses,
            datasets: [{
                label: 'Vendas (R$)',
                data: vendasPorMes.valores,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `R$ ${context.parsed.y.toLocaleString('pt-BR')}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function calcularVendasPorMes(pedidos) {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const vendas = new Array(12).fill(0);

    pedidos.forEach(pedido => {
        if (pedido.data_emissao && pedido.status === 'aprovado') {
            const mes = new Date(pedido.data_emissao).getMonth();
            vendas[mes] += toNumberSafe(pedido.valor_total);
        }
    });

    return {
        meses: meses.slice(0, 6),
        valores: vendas.slice(0, 6)
    };
}

async function loadDashboardData() {
    try {
        updateDashboardStats();
        updateRecentOrders(state.pedidos.slice(0, 5));
        initializeCharts();
    } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
    }
}

function updateDashboardStats() {
    // Estatísticas REAIS baseadas nos dados
    const totalVendas = state.pedidos
        .filter((pedido) => pedido.status === 'aprovado')
        .reduce((sum, pedido) => sum + (pedido.valor_total || 0), 0);
    const pedidosAtivos = state.pedidos.filter(p => p.status === 'pendente' || p.status === 'aprovado').length;
    const clientesAtivos = state.clientes.filter(c => c.ativo).length;
    const estoqueBaixo = getLowStockCount(state.produtos);
    const totalProdutos = Array.isArray(state.produtos) ? state.produtos.length : 0;

    // Atualizar cards
    const statCards = document.querySelectorAll('.stat-card h3');
    if (statCards.length >= 4) {
        statCards[0].textContent = totalVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        statCards[1].textContent = pedidosAtivos.toString();
        statCards[2].textContent = clientesAtivos.toString();
        statCards[3].textContent = estoqueBaixo.toString();
    }

    const trendElements = document.querySelectorAll('.stat-card .stat-trend');
    if (trendElements.length >= 4) {
        const trendValues = [totalVendas, pedidosAtivos, clientesAtivos, estoqueBaixo];
        trendValues.forEach((value, index) => {
            const trend = trendElements[index];
            if (!trend) return;
            if (!value || value === 0) {
                trend.style.display = 'none';
            } else {
                trend.style.display = '';
            }
        });

        const estoqueTrend = trendElements[3];
        if (estoqueTrend && estoqueBaixo > 0 && totalProdutos > 0) {
            estoqueTrend.textContent = `${estoqueBaixo} baixo`;
        }
    }
}

function updateRecentOrders(pedidos) {
    const container = document.getElementById('recentOrdersList');
    if (!container) return;

    container.innerHTML = '';

    if (pedidos.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum pedido recente</div>';
        return;
    }

    pedidos.forEach(pedido => {
        const orderElement = document.createElement('div');
        orderElement.className = 'order-item';
        orderElement.innerHTML = `
            <div class="order-info">
                <h4>Pedido ${pedido.numero_pedido || `PD${pedido.id.toString().padStart(4, '0')}`}</h4>
                <div class="order-meta">
                    <span>${pedido.cliente_nome || 'Cliente não encontrado'}</span>
                    <span>${new Date(pedido.data_emissao).toLocaleDateString('pt-BR')}</span>
                    <span>${toNumberSafe(pedido.valor_total).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                </div>
            </div>
            <div class="order-status status-${pedido.status}">${getStatusText(pedido.status)}</div>
        `;
        
        orderElement.addEventListener('click', () => viewPedido(pedido.id));
        container.appendChild(orderElement);
    });
}

// Clientes - COM API
async function loadClientes() {
    try {
        const data = await apiCall('/clientes');
        const clientes = Array.isArray(data.clientes) ? data.clientes : [];
        const visibleClientes = filterClientesByUser(clientes);
        state.clientes = visibleClientes;
        updateClientesTable(visibleClientes);
        updateClienteSelect(visibleClientes);
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        showError('Erro ao carregar clientes: ' + error.message);
    }
}

function filterClientesByUser(clientes) {
    if (state.currentUser?.nivel_acesso === 'admin') {
        return clientes;
    }
    if (state.currentUser?.nivel_acesso === 'vendedor') {
        const userId = Number(state.currentUser.id);
        return clientes.filter((cliente) => Number(cliente.vendedor_id) === userId);
    }
    return clientes;
}

function updateClientesTable(clientes) {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;
    
    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Nenhum cliente encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    const isAdmin = state.currentUser?.nivel_acesso === 'admin';
    const isVendedor = state.currentUser?.nivel_acesso === 'vendedor';
    clientes.forEach(cliente => {
        const tr = document.createElement('tr');
        const actionButtons = isAdmin ? `
                    <button class="btn btn-secondary btn-sm" data-action="view-cliente" data-id="${cliente.id}" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" data-action="edit-cliente" data-id="${cliente.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" data-action="delete-cliente" data-id="${cliente.id}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : isVendedor ? `
                    <button class="btn btn-primary btn-sm" data-action="edit-cliente" data-id="${cliente.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" data-action="delete-cliente" data-id="${cliente.id}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : `
                    <button class="btn btn-secondary btn-sm" data-action="view-cliente" data-id="${cliente.id}" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                `;
        tr.innerHTML = `
            <td>${cliente.cnpj || 'N/A'}</td>
            <td>${cliente.nome_fantasia}</td>
            <td>${cliente.cidade}/${cliente.estado}</td>
            <td>${cliente.telefone || 'N/A'}</td>
            <td><span class="status-badge ${cliente.ativo ? 'success' : 'danger'}">${cliente.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <div class="action-buttons pedidos-actions">
                    ${actionButtons}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterClientes() {
    const statusFilter = document.getElementById('clienteStatusFilter')?.value;
    const cidadeFilter = document.getElementById('cidadeFilter')?.value.toLowerCase();

    let filteredClientes = state.clientes;

    if (statusFilter) {
        filteredClientes = filteredClientes.filter(cliente => 
            statusFilter === 'ativo' ? cliente.ativo : !cliente.ativo
        );
    }

    if (cidadeFilter) {
        filteredClientes = filteredClientes.filter(cliente => 
            cliente.cidade.toLowerCase().includes(cidadeFilter)
        );
    }

    updateClientesTable(filteredClientes);
}

function updateClienteSelect(clientes) {
    const select = document.getElementById('clienteSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um cliente</option>';
    
    clientes.forEach(cliente => {
        if (cliente.ativo) {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = `${cliente.nome_fantasia} - ${cliente.cnpj || 'Sem CNPJ'}`;
            select.appendChild(option);
        }
    });
}

// Produtos - COM API
async function loadProdutos() {
    try {
        const data = await apiCall('/produtos');
        state.produtos = data.produtos;
        updateProdutosTable(state.produtos);
        updateProdutoSelect(state.produtos);
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showError('Erro ao carregar produtos: ' + error.message);
    }
}

function updateProdutosTable(produtos) {
    const tbody = document.getElementById('produtosTableBody');
    if (!tbody) return;
    
    if (produtos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Nenhum produto encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    const isAdmin = state.currentUser?.nivel_acesso === 'admin';

    produtos.forEach(produto => {
        const tr = document.createElement('tr');
        const actionButtons = isAdmin ? `
                <div class="action-buttons">
                    <button class="btn btn-secondary btn-sm" data-action="view-produto" data-id="${produto.id}" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" data-action="edit-produto" data-id="${produto.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" data-action="delete-produto" data-id="${produto.id}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : `
                <div class="action-buttons">
                    <button class="btn btn-secondary btn-sm" data-action="view-produto" data-id="${produto.id}" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            `;
        tr.innerHTML = `
            <td>${produto.codigo}</td>
            <td>${produto.nome}</td>
            <td>${produto.descricao || ''}</td>
            <td>${produto.preco_tabela.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
            <td>${produto.estoque_atual.toFixed(2)} ${produto.unidade_medida}</td>
            <td><span class="status-badge ${produto.ativo ? 'success' : 'danger'}">${produto.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                ${actionButtons}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateProdutoSelect(produtos) {
    const produtoSelects = document.querySelectorAll('.produto-select');
    
    produtoSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione...</option>';
        
        produtos.forEach(produto => {
            if (produto.ativo) {
                const option = document.createElement('option');
                option.value = produto.id;
                option.textContent = `${produto.codigo} - ${produto.nome}`;
                option.setAttribute('data-preco', produto.preco_tabela);
                option.setAttribute('data-descricao', produto.descricao || '');
                select.appendChild(option);
            }
        });
        
        // Restaurar valor anterior se possível
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// PEDIDOS - AGORA FUNCIONANDO DE VERDADE
async function loadPedidos() {
    try {
        const data = await apiCall('/pedidos');
        state.pedidos = data.pedidos;
        updatePedidosTable(state.pedidos);
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        showError('Erro ao carregar pedidos: ' + error.message);
    }
}

function updatePedidosTable(pedidos) {
    const tbody = document.getElementById('pedidosTableBody');
    if (!tbody) return;
    
    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Nenhum pedido encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    const isAdmin = state.currentUser?.nivel_acesso === 'admin';

    pedidos.forEach(pedido => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-pedido-id', pedido.id);
        const deleteButton = isAdmin ? `
                    <button class="btn btn-danger btn-sm" data-action="delete-pedido" data-id="${pedido.id}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : '';
        const toggleButton = isAdmin ? `
                    <button class="btn btn-warning btn-sm" data-action="toggle-pedido-status" data-id="${pedido.id}" data-status="${pedido.status}" title="Alternar status">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                ` : '';
        tr.innerHTML = `
            <td>${pedido.numero_pedido || `PD${pedido.id.toString().padStart(4, '0')}`}</td>
            <td>${pedido.cliente_nome || 'N/A'}</td>
            <td>${pedido.vendedor_nome || 'N/A'}</td>
            <td>${new Date(pedido.data_emissao).toLocaleDateString('pt-BR')}</td>
            <td>${toNumberSafe(pedido.valor_total).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
            <td><span class="order-status status-${pedido.status}">${getStatusText(pedido.status)}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-secondary btn-sm" data-action="view-pedido" data-id="${pedido.id}" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-success btn-sm" data-action="pdf-pedido" data-id="${pedido.id}" title="PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    ${toggleButton}
                    ${deleteButton}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterPedidos() {
    const statusFilter = document.getElementById('statusFilter')?.value;
    const dateFilter = document.getElementById('dateFilter')?.value;
    const vendedorFilter = document.getElementById('vendedorFilter')?.value;

    let filteredPedidos = state.pedidos;

    if (statusFilter) {
        filteredPedidos = filteredPedidos.filter(pedido => pedido.status === statusFilter);
    }

    if (dateFilter) {
        filteredPedidos = filteredPedidos.filter(pedido => 
            pedido.data_emissao.startsWith(dateFilter)
        );
    }

    if (vendedorFilter) {
        filteredPedidos = filteredPedidos.filter(pedido =>
            String(pedido.vendedor_id) === vendedorFilter
        );
    }

    state.currentPageNumber = 1;
    updatePedidosTable(filteredPedidos);
}

// Vendedores (placeholder)
function loadVendedores() {
    state.vendedores = [];
    updateVendedoresTable(state.vendedores);
}

function updateVendedoresTable(vendedores) {
    const tbody = document.getElementById('vendedoresTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Módulo em desenvolvimento</td></tr>';
}

// Vendedores (API)
async function loadVendedores() {
    const tbody = document.getElementById('vendedoresTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Carregando...</td></tr>';
    }

    try {
        const data = await apiCall('/vendedores');
        state.vendedores = data.vendedores;
        updateVendedoresTable(state.vendedores);
        updateVendedorFilterSelect(state.vendedores);
    } catch (error) {
        console.error('Erro ao carregar vendedores:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="error">Erro ao carregar vendedores: ${error.message}</td></tr>`;
        }
    }
}

function updateVendedoresTable(vendedores) {
    const tbody = document.getElementById('vendedoresTableBody');
    if (!tbody) return;

    if (vendedores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Nenhum vendedor encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    vendedores.forEach((vendedor) => {
        const tr = document.createElement('tr');
        const comissao = vendedor.comissao || 0;
        const toggleButton = vendedor.ativo
            ? `
                    <button class="btn btn-warning btn-sm" data-action="toggle-vendedor" data-id="${vendedor.id}" data-active="1" title="Inativar">
                        <i class="fas fa-user-slash"></i>
                    </button>
                `
            : `
                    <button class="btn btn-success btn-sm" data-action="toggle-vendedor" data-id="${vendedor.id}" data-active="0" title="Ativar">
                        <i class="fas fa-user-check"></i>
                    </button>
                `;
        tr.innerHTML = `
            <td>${vendedor.nome}</td>
            <td>${vendedor.email}</td>
            <td>${vendedor.telefone || 'N/A'}</td>
            <td>${comissao.toFixed(2)}%</td>
            <td><span class="status-badge ${vendedor.ativo ? 'success' : 'danger'}">${vendedor.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-secondary btn-sm" data-action="view-vendedor" data-id="${vendedor.id}" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" data-action="edit-vendedor" data-id="${vendedor.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${toggleButton}
                    <button class="btn btn-danger btn-sm" data-action="delete-vendedor" data-id="${vendedor.id}" title="Excluir permanente">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openProdutoModal() {
    const modal = document.getElementById('produtoModal');
    if (!modal) return;

    state.currentProdutoId = null;
    initializeProdutoModal();
    modal.style.display = 'block';
}

function initializeProdutoModal(produto = null) {
    const title = document.getElementById('produtoModalTitle');
    const saveBtn = document.getElementById('saveProduto');

    if (!produto) {
        if (title) title.textContent = 'Novo Produto';
        if (saveBtn) saveBtn.textContent = 'Salvar Produto';
    } else {
        if (title) title.textContent = 'Editar Produto';
        if (saveBtn) saveBtn.textContent = 'Atualizar Produto';
    }

    document.getElementById('produtoCodigo').value = produto?.codigo || '';
    document.getElementById('produtoNome').value = produto?.nome || '';
    document.getElementById('produtoDescricao').value = produto?.descricao || '';
    document.getElementById('produtoPrecoTabela').value = produto?.preco_tabela ?? 0;
    document.getElementById('produtoPrecoCusto').value = produto?.preco_custo ?? 0;
    document.getElementById('produtoEstoqueAtual').value = produto?.estoque_atual ?? 0;
    document.getElementById('produtoEstoqueMinimo').value = produto?.estoque_minimo ?? 0;
    document.getElementById('produtoUnidade').value = produto?.unidade_medida || 'UN';
    const ativo = produto ? !!produto.ativo : true;
    document.getElementById('produtoAtivo').checked = ativo;
}

function parseNumberInput(value) {
    if (value === null || value === undefined || value === '') return 0;
    const sanitized = String(value).replace(',', '.');
    const parsed = parseFloat(sanitized);
    return Number.isNaN(parsed) ? 0 : parsed;
}

async function saveProduto() {
    try {
        const codigo = document.getElementById('produtoCodigo').value.trim();
        const nome = document.getElementById('produtoNome').value.trim();
        const precoTabela = parseNumberInput(document.getElementById('produtoPrecoTabela').value);

        if (!codigo || !nome || precoTabela <= 0) {
            alert('Código, nome e preço de tabela são obrigatórios!');
            return;
        }

        const produtoData = {
            codigo,
            nome,
            descricao: document.getElementById('produtoDescricao').value.trim(),
            preco_tabela: precoTabela,
            preco_custo: parseNumberInput(document.getElementById('produtoPrecoCusto').value),
            estoque_atual: parseNumberInput(document.getElementById('produtoEstoqueAtual').value),
            estoque_minimo: parseNumberInput(document.getElementById('produtoEstoqueMinimo').value),
            unidade_medida: document.getElementById('produtoUnidade').value,
            ativo: document.getElementById('produtoAtivo').checked ? 1 : 0
        };

        if (state.currentProdutoId) {
            await apiCall(`/produtos/${state.currentProdutoId}`, {
                method: 'PUT',
                body: produtoData
            });
            alert('Produto atualizado com sucesso!');
        } else {
            await apiCall('/produtos', {
                method: 'POST',
                body: produtoData
            });
            alert('Produto cadastrado com sucesso!');
        }

        closeAllModals();
        await loadProdutos();
        await loadDashboardData();
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        alert('Erro ao salvar produto: ' + error.message);
    }
}

async function deleteProduto(produtoId) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) {
        return;
    }

    try {
        await apiCall(`/produtos/${produtoId}`, {
            method: 'DELETE'
        });

        alert('Produto excluído com sucesso!');
        await loadProdutos();
        await loadDashboardData();
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        alert('Erro ao excluir produto: ' + error.message);
    }
}

function updateVendedorFilterSelect(vendedores) {
    const select = document.getElementById('vendedorFilter');
    if (!select) return;

    select.innerHTML = '<option value="">Todos</option>';
    vendedores
        .filter((vendedor) => vendedor.ativo)
        .forEach((vendedor) => {
            const option = document.createElement('option');
            option.value = vendedor.id;
            option.textContent = vendedor.nome;
            select.appendChild(option);
        });
}

// Modal de Pedido
function openPedidoModal() {
    document.getElementById('pedidoModal').style.display = 'block';
    initializePedidoModal();
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

function initializePedidoModal() {
    const itensPedidoBody = document.getElementById('itensPedidoBody');
    if (itensPedidoBody) {
        itensPedidoBody.innerHTML = '';
    }
    
    const clienteSelect = document.getElementById('clienteSelect');
    const condicaoPagamento = document.getElementById('condicaoPagamento');
    const observacoesPedido = document.getElementById('observacoesPedido');
    
    if (clienteSelect) clienteSelect.value = '';
    if (condicaoPagamento) condicaoPagamento.value = '28,42,56,70,84,98,112,126,140,154';
    if (observacoesPedido) observacoesPedido.value = '';
    
    state.currentPedido = {
        itens: [],
        cliente_id: '',
        vendedor_id: state.currentUser.id,
        condicao_pagamento: '28,42,56,70,84,98,112,126,140,154',
        observacoes: '',
        status: 'pendente'
    };
    
    updatePedidoTotals();
}

function addItemToPedido() {
    const tbody = document.getElementById('itensPedidoBody');
    if (!tbody) return;

    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>
            <select class="produto-select">
                <option value="">Selecione...</option>
                ${state.produtos.filter(p => p.ativo).map(p => `
                    <option value="${p.id}" 
                            data-preco="${p.preco_tabela}" 
                            data-descricao="${p.descricao || ''}"
                            data-unidade="${p.unidade_medida || 'MT'}">
                        ${p.codigo} - ${p.nome}
                    </option>
                `).join('')}
            </select>
        </td>
        <td>
            <input type="number" class="quantidade" step="0.01" min="0" value="1">
            <small class="unidade-medida">MT</small>
        </td>
        <td>
            <input type="number" class="preco-unitario" step="0.01" min="0" value="0">
        </td>
        <td>
            <input type="number" class="desconto" step="0.01" min="0" max="100" value="0">
            <small>%</small>
        </td>
        <td class="subtotal">R$ 0,00</td>
        <td>
            <button class="btn btn-danger btn-sm" data-action="remove-item" title="Remover item">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(newRow);
}

function updateProdutoInfo(select) {
    const row = select.closest('tr');
    const precoInput = row.querySelector('.preco-unitario');
    const quantidadeInput = row.querySelector('.quantidade');
    const unidadeSpan = row.querySelector('.unidade-medida');
    const selectedOption = select.options[select.selectedIndex];
    
    if (selectedOption.value) {
        const preco = parseFloat(selectedOption.getAttribute('data-preco'));
        const unidade = selectedOption.getAttribute('data-unidade');
        
        precoInput.value = preco.toFixed(2);
        unidadeSpan.textContent = unidade;
        
        // Se quantidade for 0, definir como 1
        if (parseFloat(quantidadeInput.value) === 0) {
            quantidadeInput.value = '1';
        }
        
        calculateItemTotal(select);
    }
}

function calculateItemTotal(input) {
    const row = input.closest('tr');
    const quantidade = parseFloat(row.querySelector('.quantidade').value) || 0;
    const precoUnitario = parseFloat(row.querySelector('.preco-unitario').value) || 0;
    const desconto = parseFloat(row.querySelector('.desconto').value) || 0;
    
    const subtotal = quantidade * precoUnitario;
    const valorComDesconto = subtotal * (1 - desconto / 100);
    
    const subtotalElement = row.querySelector('.subtotal');
    if (subtotalElement) {
        subtotalElement.textContent = valorComDesconto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    }
    
    updatePedidoTotals();
}

function removeItem(button) {
    const row = button.closest('tr');
    row.remove();
    updatePedidoTotals();
}

function updatePedidoTotals() {
    const rows = document.querySelectorAll('#itensPedidoBody tr');
    let totalQuantidade = 0;
    let totalProdutos = 0;
    let totalDescontos = 0;
    
    rows.forEach(row => {
        const quantidade = parseFloat(row.querySelector('.quantidade').value) || 0;
        const precoUnitario = parseFloat(row.querySelector('.preco-unitario').value) || 0;
        const desconto = parseFloat(row.querySelector('.desconto').value) || 0;
        const subtotalText = row.querySelector('.subtotal').textContent;
        const subtotal = parseFloat(subtotalText.replace('R$', '').replace('.', '').replace(',', '.')) || 0;
        
        totalQuantidade += quantidade;
        totalProdutos += quantidade * precoUnitario;
        totalDescontos += (quantidade * precoUnitario) - subtotal;
    });
    
    const totalIPI = (totalProdutos - totalDescontos) * 0.065;
    const valorTotal = (totalProdutos - totalDescontos) + totalIPI;
    
    updateElementText('totalQuantidade', `${totalQuantidade.toFixed(2)} MT`);
    updateElementText('totalProdutos', totalProdutos.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
    updateElementText('totalDescontos', totalDescontos.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
    updateElementText('totalIPI', totalIPI.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
    updateElementText('valorTotal', valorTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
}

function updateElementText(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}

function toNumberSafe(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const normalized = String(value)
        .replace(/[^0-9,.-]/g, '')
        .replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getLowStockCount(produtos) {
    if (!Array.isArray(produtos) || produtos.length === 0) {
        return 0;
    }

    return produtos.filter((produto) => {
        return isLowStockProduto(produto);
    }).length;
}

function getLowStockProducts(produtos) {
    if (!Array.isArray(produtos) || produtos.length === 0) {
        return [];
    }

    return produtos.filter((produto) => isLowStockProduto(produto));
}

function isLowStockProduto(produto) {
    const nomeValido = (produto.nome && produto.nome.trim()) || (produto.codigo && produto.codigo.trim());
    if (!nomeValido) return false;

    const estoqueAtual = Number(produto.estoque_atual);
    const estoqueMinimo = Number(produto.estoque_minimo);

    if (Number.isNaN(estoqueAtual) || Number.isNaN(estoqueMinimo)) {
        return false;
    }

    if (estoqueMinimo <= 0) {
        return false;
    }

    return estoqueAtual <= estoqueMinimo;
}

// SALVAR PEDIDO - FUNCIONANDO DE VERDADE
async function savePedido() {
    try {
        const clienteSelect = document.getElementById('clienteSelect');
        const condicaoPagamento = document.getElementById('condicaoPagamento').value;
        const observacoes = document.getElementById('observacoesPedido').value;
        
        if (!clienteSelect.value) {
            alert('Selecione um cliente!');
            return;
        }
        
        // Coletar itens do pedido
        const itens = [];
        document.querySelectorAll('#itensPedidoBody tr').forEach(row => {
            const produtoSelect = row.querySelector('.produto-select');
            const quantidade = parseFloat(row.querySelector('.quantidade').value) || 0;
            const precoUnitario = parseFloat(row.querySelector('.preco-unitario').value) || 0;
            const desconto = parseFloat(row.querySelector('.desconto').value) || 0;
            
            if (produtoSelect.value && quantidade > 0) {
                itens.push({
                    produto_id: parseInt(produtoSelect.value),
                    quantidade: quantidade,
                    preco_unitario: precoUnitario,
                    desconto: desconto
                });
            }
        });
        
        if (itens.length === 0) {
            alert('Adicione pelo menos um item ao pedido!');
            return;
        }
        
        const pedidoData = {
            cliente_id: parseInt(clienteSelect.value),
            itens: itens,
            condicao_pagamento: condicaoPagamento,
            observacoes: observacoes
        };
        
        const result = await apiCall('/pedidos', {
            method: 'POST',
            body: pedidoData
        });
        
        alert(`Pedido criado com sucesso! Nº: ${result.pedido.numero_pedido}`);
        closeAllModals();
        
        // Atualizar a interface
        await loadPedidos();
        await loadProdutos();
        await loadDashboardData();
        initializeCharts();
        
    } catch (error) {
        console.error('Erro ao salvar pedido:', error);
        alert('Erro ao salvar pedido: ' + error.message);
    }
}

// SALVAR CLIENTE - FUNCIONANDO DE VERDADE
async function saveCliente() {
    try {
        const razaoSocial = document.getElementById('clienteRazaoSocial').value;
        const nomeFantasia = document.getElementById('clienteNomeFantasia').value;
        
        if (!razaoSocial || !nomeFantasia) {
            alert('Razão Social e Nome Fantasia são obrigatórios!');
            return;
        }
        
        const clienteData = {
            cnpj: document.getElementById('clienteCNPJ').value,
            razao_social: razaoSocial,
            nome_fantasia: nomeFantasia,
            email: document.getElementById('clienteEmail').value,
            telefone: document.getElementById('clienteTelefone').value,
            endereco: document.getElementById('clienteEndereco').value,
            cidade: document.getElementById('clienteCidade').value,
            estado: document.getElementById('clienteEstado').value,
            cep: document.getElementById('clienteCEP').value,
            inscricao_estadual: document.getElementById('clienteIE').value
        };
        
        const result = await apiCall('/clientes', {
            method: 'POST',
            body: clienteData
        });
        
        alert(`Cliente ${result.cliente.nome_fantasia} cadastrado com sucesso!`);
        closeAllModals();
        
        // Atualizar a interface
        await loadClientes();
        
    } catch (error) {
        console.error('Erro ao salvar cliente:', error);
        alert('Erro ao salvar cliente: ' + error.message);
    }
}

// Modal de Cliente
function openClienteModal() {
    document.getElementById('clienteModal').style.display = 'block';
    initializeClienteModal();
}

function initializeClienteModal() {
    const form = document.getElementById('clienteForm');
    if (form) {
        form.reset();
    }
}

// Modal de Vendedor
function openVendedorModal() {
    document.getElementById('vendedorModal').style.display = 'block';
    initializeVendedorModal();
}

function initializeVendedorModal() {
    const form = document.getElementById('vendedorForm');
    if (form) {
        form.reset();
    }

    const saveBtn = document.getElementById('saveVendedor');
    saveBtn.textContent = 'Salvar Vendedor';
    saveBtn.onclick = saveVendedor;

    const senhaInput = document.getElementById('vendedorSenha');
    if (senhaInput) {
        senhaInput.required = true;
    }

    const ativoCheckbox = document.getElementById('vendedorAtivo');
    if (ativoCheckbox) {
        ativoCheckbox.checked = true;
    }
}

// Funções de Ação
function viewCliente(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (cliente) {
        alert(`CLIENTE: ${cliente.nome_fantasia}\n\nCNPJ: ${cliente.cnpj || 'N/A'}\nTelefone: ${cliente.telefone || 'N/A'}\nEmail: ${cliente.email || 'N/A'}\nEndereço: ${cliente.endereco || 'N/A'}\nCidade: ${cliente.cidade}/${cliente.estado}\nStatus: ${cliente.ativo ? 'Ativo' : 'Inativo'}`);
    }
}

async function editCliente(clienteId) {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (cliente) {
        // Preencher modal de edição
        document.getElementById('clienteRazaoSocial').value = cliente.razao_social;
        document.getElementById('clienteNomeFantasia').value = cliente.nome_fantasia;
        document.getElementById('clienteCNPJ').value = cliente.cnpj || '';
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteTelefone').value = cliente.telefone || '';
        document.getElementById('clienteEndereco').value = cliente.endereco || '';
        document.getElementById('clienteCidade').value = cliente.cidade || '';
        document.getElementById('clienteEstado').value = cliente.estado || '';
        document.getElementById('clienteCEP').value = cliente.cep || '';
        document.getElementById('clienteIE').value = cliente.inscricao_estadual || '';
        
        // Mostrar modal
        document.getElementById('clienteModal').style.display = 'block';
        
        // Alterar botão salvar para edição
        const saveBtn = document.getElementById('saveCliente');
        saveBtn.textContent = 'Atualizar Cliente';
        saveBtn.onclick = function() { updateCliente(clienteId); };
    }
}

async function updateCliente(clienteId) {
    try {
        const clienteData = {
            cnpj: document.getElementById('clienteCNPJ').value,
            razao_social: document.getElementById('clienteRazaoSocial').value,
            nome_fantasia: document.getElementById('clienteNomeFantasia').value,
            email: document.getElementById('clienteEmail').value,
            telefone: document.getElementById('clienteTelefone').value,
            endereco: document.getElementById('clienteEndereco').value,
            cidade: document.getElementById('clienteCidade').value,
            estado: document.getElementById('clienteEstado').value,
            cep: document.getElementById('clienteCEP').value,
            inscricao_estadual: document.getElementById('clienteIE').value,
            ativo: true
        };
        
        const result = await apiCall(`/clientes/${clienteId}`, {
            method: 'PUT',
            body: clienteData
        });
        
        alert('Cliente atualizado com sucesso!');
        closeAllModals();
        await loadClientes();
        
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        alert('Erro ao atualizar cliente: ' + error.message);
    }
}

async function deleteCliente(clienteId) {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
        try {
            await apiCall(`/clientes/${clienteId}`, {
                method: 'DELETE'
            });
            
            alert('Cliente excluído com sucesso!');
            await loadClientes();
            
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
            alert('Erro ao excluir cliente: ' + error.message);
        }
    }
}

function viewVendedor(vendedorId) {
    const vendedor = state.vendedores.find(v => v.id === vendedorId);
    if (vendedor) {
        alert(`VENDEDOR: ${vendedor.nome}\n\nEmail: ${vendedor.email}\nTelefone: ${vendedor.telefone || 'N/A'}\nNivel: ${vendedor.nivel_acesso}\nComissao: ${(vendedor.comissao || 0).toFixed(2)}%\nStatus: ${vendedor.ativo ? 'Ativo' : 'Inativo'}`);
    }
}

function editVendedor(vendedorId) {
    const vendedor = state.vendedores.find(v => v.id === vendedorId);
    if (!vendedor) return;

    document.getElementById('vendedorNome').value = vendedor.nome;
    document.getElementById('vendedorEmail').value = vendedor.email;
    document.getElementById('vendedorTelefone').value = vendedor.telefone || '';
    document.getElementById('vendedorNivel').value = vendedor.nivel_acesso || 'vendedor';
    document.getElementById('vendedorComissao').value = vendedor.comissao || 0;
    document.getElementById('vendedorAtivo').checked = !!vendedor.ativo;

    const senhaInput = document.getElementById('vendedorSenha');
    senhaInput.value = '';
    senhaInput.required = false;

    document.getElementById('vendedorModal').style.display = 'block';

    const saveBtn = document.getElementById('saveVendedor');
    saveBtn.textContent = 'Atualizar Vendedor';
    saveBtn.onclick = function() { updateVendedor(vendedorId); };
}

async function saveVendedor() {
    try {
        const nome = document.getElementById('vendedorNome').value;
        const email = document.getElementById('vendedorEmail').value;
        const senha = document.getElementById('vendedorSenha').value;

        if (!nome || !email || !senha) {
            alert('Nome, email e senha sao obrigatorios!');
            return;
        }

        const vendedorData = {
            nome,
            email,
            senha,
            telefone: document.getElementById('vendedorTelefone').value,
            nivel_acesso: document.getElementById('vendedorNivel').value,
            comissao: parseFloat(document.getElementById('vendedorComissao').value) || 0,
            ativo: document.getElementById('vendedorAtivo').checked ? 1 : 0
        };

        await apiCall('/vendedores', {
            method: 'POST',
            body: vendedorData
        });

        alert('Vendedor cadastrado com sucesso!');
        closeAllModals();
        await loadVendedores();
    } catch (error) {
        console.error('Erro ao salvar vendedor:', error);
        alert('Erro ao salvar vendedor: ' + error.message);
    }
}

async function updateVendedor(vendedorId) {
    try {
        const vendedorData = {
            nome: document.getElementById('vendedorNome').value,
            email: document.getElementById('vendedorEmail').value,
            telefone: document.getElementById('vendedorTelefone').value,
            nivel_acesso: document.getElementById('vendedorNivel').value,
            comissao: parseFloat(document.getElementById('vendedorComissao').value) || 0,
            ativo: document.getElementById('vendedorAtivo').checked ? 1 : 0
        };

        const senha = document.getElementById('vendedorSenha').value;
        if (senha) {
            vendedorData.senha = senha;
        }

        await apiCall(`/vendedores/${vendedorId}`, {
            method: 'PUT',
            body: vendedorData
        });

        alert('Vendedor atualizado com sucesso!');
        closeAllModals();
        await loadVendedores();
    } catch (error) {
        console.error('Erro ao atualizar vendedor:', error);
        alert('Erro ao atualizar vendedor: ' + error.message);
    }
}

async function toggleVendedorAtivo(vendedorId, ativoAtual) {
    const acao = ativoAtual ? 'inativar' : 'ativar';
    const confirmText = `Deseja ${acao} este vendedor?`;

    if (!confirm(confirmText)) {
        return;
    }

    try {
        await apiCall(`/vendedores/${vendedorId}`, {
            method: 'PUT',
            body: { ativo: ativoAtual ? 0 : 1 }
        });

        alert(`Vendedor ${acao}ado com sucesso!`);
        await loadVendedores();
    } catch (error) {
        console.error(`Erro ao ${acao} vendedor:`, error);
        alert(`Erro ao ${acao} vendedor: ` + error.message);
    }
}

async function deleteVendedorPermanent(vendedorId) {
    if (confirm('Excluir permanentemente este vendedor? Esta acao nao pode ser desfeita.')) {
        try {
            await apiCall(`/vendedores/${vendedorId}/permanent`, {
                method: 'DELETE'
            });

            alert('Vendedor excluido com sucesso!');
            await loadVendedores();
        } catch (error) {
            console.error('Erro ao excluir vendedor:', error);
            alert('Erro ao excluir vendedor: ' + error.message);
        }
    }
}

function viewProduto(produtoId) {
    const produto = state.produtos.find(p => p.id === produtoId);
    if (produto) {
        alert(`PRODUTO: ${produto.nome}\n\nCódigo: ${produto.codigo}\nDescrição: ${produto.descricao || 'N/A'}\nPreço: ${produto.preco_tabela.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}\nEstoque: ${produto.estoque_atual} ${produto.unidade_medida}\nStatus: ${produto.ativo ? 'Ativo' : 'Inativo'}`);
    }
}

function editProduto(produtoId) {
    const produto = state.produtos.find(p => p.id === produtoId);
    if (!produto) {
        alert('Produto não encontrado.');
        return;
    }

    state.currentProdutoId = produtoId;
    initializeProdutoModal(produto);
    document.getElementById('produtoModal').style.display = 'block';
}

async function viewPedido(pedidoId) {
    let pedido = state.pedidos.find(p => p.id === pedidoId);

    try {
        const data = await apiCall(`/pedidos/${pedidoId}`);
        if (data && data.pedido) {
            pedido = data.pedido;
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes do pedido:', error);
    }

    if (!pedido) {
        alert('Pedido nao encontrado.');
        return;
    }

    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
    let mensagem = `PEDIDO: ${pedido.numero_pedido || `PD${pedido.id.toString().padStart(4, '0')}`}\n\n`;
    mensagem += `Cliente: ${pedido.cliente_nome || 'N/A'}\n`;
    mensagem += `Data: ${new Date(pedido.data_emissao).toLocaleDateString('pt-BR')}\n`;
    mensagem += `Valor: ${toNumberSafe(pedido.valor_total).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}\n`;
    mensagem += `Status: ${getStatusText(pedido.status)}\n\n`;
    mensagem += `Itens (${itens.length}):\n`;

    if (itens.length === 0) {
        mensagem += 'Sem itens cadastrados.\n';
    } else {
        itens.forEach((item, index) => {
            const quantidade = toNumberSafe(item.quantidade, 0);
            const precoUnitario = toNumberSafe(item.preco_unitario, 0);
            const subtotal = toNumberSafe(item.subtotal, quantidade * precoUnitario);
            const nomeProduto = item.produto_nome || item.produto_codigo || 'Produto';
            mensagem += `${index + 1}. ${nomeProduto} - ${quantidade} x R$ ${precoUnitario.toFixed(2)} = R$ ${subtotal.toFixed(2)}\n`;
        });
    }

    alert(mensagem);
}

// EXCLUIR PEDIDO - FUNCIONANDO DE VERDADE
async function deletePedido(pedidoId) {
    if (confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) {
        try {
            await apiCall(`/pedidos/${pedidoId}`, {
                method: 'DELETE'
            });
            
            alert('Pedido excluído com sucesso!');
            await loadPedidos();
            await loadDashboardData();
            initializeCharts();
            
        } catch (error) {
            console.error('Erro ao excluir pedido:', error);
            alert('Erro ao excluir pedido: ' + error.message);
        }
    }
}

async function togglePedidoStatus(pedidoId, currentStatus) {
    const nextStatus = currentStatus === 'pendente' ? 'aprovado' : 'pendente';
    const confirmText = `Alterar status para ${getStatusText(nextStatus)}?`;

    if (!confirm(confirmText)) {
        return;
    }

    try {
        await apiCall(`/pedidos/${pedidoId}/status`, {
            method: 'PATCH',
            body: { status: nextStatus }
        });

        alert('Status atualizado com sucesso!');
        await loadPedidos();
        await loadDashboardData();
        initializeCharts();
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        alert('Erro ao atualizar status: ' + error.message);
    }
}

// GERAR PDF DO PEDIDO - FUNCIONANDO DE VERDADE
async function generatePedidoPDF(pedidoId) {
    try {
        // Mostrar loading
        const originalText = 'Gerando PDF...';
        
        const token = localStorage.getItem('mercus_token');
        
        const response = await fetch(`${API_BASE}/pdf/pedido/${pedidoId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao gerar PDF: ' + response.status);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Criar link para download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `Pedido_${pedidoId}.pdf`;
        
        document.body.appendChild(a);
        a.click();
        
        // Limpar
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Mostrar mensagem de sucesso
        showNotification('PDF gerado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        showNotification('Erro ao gerar PDF: ' + error.message, 'error');
    }
}

// Função para mostrar notificações
function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}-circle"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Adicionar ao body
    document.body.appendChild(notification);
    
    // Mostrar animação
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// RELATÓRIOS - FUNCIONANDO DE VERDADE
function generateSalesReport() {
    const totalVendas = state.pedidos.reduce((sum, pedido) => sum + (pedido.valor_total || 0), 0);
    const totalPedidos = state.pedidos.length;
    const mediaVendas = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
    
    let relatorio = `RELATÓRIO DE VENDAS\n\n`;
    relatorio += `Período: Últimos 6 meses\n`;
    relatorio += `Total de Vendas: ${totalVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}\n`;
    relatorio += `Total de Pedidos: ${totalPedidos}\n`;
    relatorio += `Ticket Médio: ${mediaVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}\n\n`;
    
    // Pedidos por status
    const pedidosPorStatus = {};
    state.pedidos.forEach(pedido => {
        pedidosPorStatus[pedido.status] = (pedidosPorStatus[pedido.status] || 0) + 1;
    });
    
    relatorio += `Pedidos por Status:\n`;
    Object.entries(pedidosPorStatus).forEach(([status, count]) => {
        relatorio += `- ${getStatusText(status)}: ${count}\n`;
    });
    
    alert(relatorio);
}

function generateClientsReport() {
    const totalClientes = state.clientes.length;
    const clientesAtivos = state.clientes.filter(c => c.ativo).length;
    const clientesInativos = totalClientes - clientesAtivos;
    
    let relatorio = `RELATÓRIO DE CLIENTES\n\n`;
    relatorio += `Total de Clientes: ${totalClientes}\n`;
    relatorio += `Clientes Ativos: ${clientesAtivos}\n`;
    relatorio += `Clientes Inativos: ${clientesInativos}\n\n`;
    
    // Clientes por estado
    const clientesPorEstado = {};
    state.clientes.forEach(cliente => {
        if (cliente.estado) {
            clientesPorEstado[cliente.estado] = (clientesPorEstado[cliente.estado] || 0) + 1;
        }
    });
    
    relatorio += `Clientes por Estado:\n`;
    Object.entries(clientesPorEstado).forEach(([estado, count]) => {
        relatorio += `- ${estado}: ${count}\n`;
    });
    
    alert(relatorio);
}

function generateStockReport() {
    const totalProdutos = state.produtos.length;
    const produtosAtivos = state.produtos.filter(p => p.ativo).length;
    const estoqueBaixo = getLowStockCount(state.produtos);
    const valorTotalEstoque = state.produtos.reduce((sum, produto) => sum + (produto.estoque_atual * produto.preco_custo || 0), 0);
    
    let relatorio = `RELATÓRIO DE ESTOQUE\n\n`;
    relatorio += `Total de Produtos: ${totalProdutos}\n`;
    relatorio += `Produtos Ativos: ${produtosAtivos}\n`;
    relatorio += `Produtos com Estoque Baixo: ${estoqueBaixo}\n`;
    relatorio += `Valor Total em Estoque: ${valorTotalEstoque.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}\n\n`;
    
    // Produtos com estoque baixo
    if (estoqueBaixo > 0) {
        relatorio += `Produtos com Estoque Baixo:\n`;
        getLowStockProducts(state.produtos).forEach(produto => {
            relatorio += `- ${produto.nome} (${produto.estoque_atual} ${produto.unidade_medida})\n`;
        });
    }
    
    alert(relatorio);
}

function generateFinancialReport() {
    const now = new Date();
    const totalVendas = state.pedidos.reduce((sum, pedido) => {
        if (!pedido.data_emissao) return sum;
        const data = new Date(pedido.data_emissao);
        const sameMonth = data.getMonth() === now.getMonth() && data.getFullYear() === now.getFullYear();
        if (!sameMonth) return sum;
        return sum + toNumberSafe(pedido.valor_total);
    }, 0);
    const pedidosPendentes = state.pedidos.filter(p => p.status === 'pendente').length;
    const valorPendente = state.pedidos
        .filter(p => p.status === 'pendente')
        .reduce((sum, pedido) => sum + (pedido.valor_total || 0), 0);
    
    let relatorio = `RELATÓRIO FINANCEIRO\n\n`;
    relatorio += `Receita Total: ${totalVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}\n`;
    relatorio += `Pedidos Pendentes: ${pedidosPendentes}\n`;
    relatorio += `Valor Pendente: ${valorPendente.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}\n`;
    relatorio += `Valor Aprovado: ${(totalVendas - valorPendente).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}\n`;
    
    alert(relatorio);
}

function addPdfSection(doc, title, lines, startY) {
    let y = startY;
    doc.setFontSize(12);
    doc.text(title, 14, y);
    y += 6;
    doc.setFontSize(10);

    const maxWidth = 180;
    lines.forEach((line) => {
        const split = doc.splitTextToSize(line, maxWidth);
        split.forEach((textLine) => {
            if (y > 280) {
                doc.addPage();
                y = 14;
            }
            doc.text(textLine, 14, y);
            y += 5;
        });
    });

    return y + 4;
}

function generateReportsPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('jsPDF nao carregado.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const now = new Date();
    let y = 14;

    doc.setFontSize(16);
    doc.text('Relatorios - Mercus ERP', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`, 14, y);
    y += 8;

    const totalVendas = state.pedidos.reduce((sum, pedido) => sum + toNumberSafe(pedido.valor_total), 0);
    const totalPedidos = state.pedidos.length;
    const mediaVendas = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
    const pedidosPorStatus = {};
    state.pedidos.forEach((pedido) => {
        pedidosPorStatus[pedido.status] = (pedidosPorStatus[pedido.status] || 0) + 1;
    });
    const vendasLines = [
        'Periodo: ultimos 6 meses',
        `Total de Vendas: ${totalVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`,
        `Total de Pedidos: ${totalPedidos}`,
        `Ticket Medio: ${mediaVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`,
        'Pedidos por Status:'
    ];
    Object.entries(pedidosPorStatus).forEach(([status, count]) => {
        vendasLines.push(`- ${getStatusText(status)}: ${count}`);
    });
    y = addPdfSection(doc, 'Relatorio de Vendas', vendasLines, y);

    const totalClientes = state.clientes.length;
    const clientesAtivos = state.clientes.filter(c => c.ativo).length;
    const clientesInativos = totalClientes - clientesAtivos;
    const clientesLines = [
        `Total de Clientes: ${totalClientes}`,
        `Clientes Ativos: ${clientesAtivos}`,
        `Clientes Inativos: ${clientesInativos}`
    ];
    y = addPdfSection(doc, 'Relatorio de Clientes', clientesLines, y);

    const totalProdutos = state.produtos.length;
    const produtosAtivos = state.produtos.filter(p => p.ativo).length;
    const estoqueBaixo = getLowStockCount(state.produtos);
    const valorTotalEstoque = state.produtos.reduce((sum, produto) => sum + ((produto.estoque_atual || 0) * (produto.preco_custo || 0)), 0);
    const estoqueLines = [
        `Total de Produtos: ${totalProdutos}`,
        `Produtos Ativos: ${produtosAtivos}`,
        `Produtos com Estoque Baixo: ${estoqueBaixo}`,
        `Valor Total em Estoque: ${valorTotalEstoque.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`
    ];
    if (estoqueBaixo > 0) {
        estoqueLines.push('Produtos com estoque baixo:');
        getLowStockProducts(state.produtos).forEach((produto) => {
            estoqueLines.push(`- ${produto.nome} (${produto.estoque_atual} ${produto.unidade_medida})`);
        });
    }
    y = addPdfSection(doc, 'Relatorio de Estoque', estoqueLines, y);

    const pedidosPendentes = state.pedidos.filter(p => p.status === 'pendente').length;
    const valorPendente = state.pedidos
        .filter(p => p.status === 'pendente')
        .reduce((sum, pedido) => sum + toNumberSafe(pedido.valor_total), 0);
    const financeiroLines = [
        `Receita Total: ${totalVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`,
        `Pedidos Pendentes: ${pedidosPendentes}`,
        `Valor Pendente: ${valorPendente.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`,
        `Valor Aprovado: ${(totalVendas - valorPendente).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`
    ];
    addPdfSection(doc, 'Relatorio Financeiro', financeiroLines, y);

    doc.save('relatorios-mercus.pdf');
}

function loadRelatorios() {
    // Carrega dados para a página de relatórios
    console.log('Página de relatórios carregada');
}

// Funções Auxiliares
function getStatusText(status) {
    const statusMap = {
        'pendente': 'Pendente',
        'aprovado': 'Aprovado',
        'faturado': 'Faturado',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
}

function clearFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const dateFilter = document.getElementById('dateFilter');
    const vendedorFilter = document.getElementById('vendedorFilter');
    const clienteStatusFilter = document.getElementById('clienteStatusFilter');
    const cidadeFilter = document.getElementById('cidadeFilter');
    
    if (statusFilter) statusFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    if (vendedorFilter) vendedorFilter.value = '';
    if (clienteStatusFilter) clienteStatusFilter.value = '';
    if (cidadeFilter) cidadeFilter.value = '';
    
    state.currentPageNumber = 1;
    loadPedidos();
    loadClientes();
}

// Paginação
function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / state.itemsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (pageInfo) pageInfo.textContent = `Página ${state.currentPageNumber} de ${totalPages}`;
    if (prevBtn) prevBtn.disabled = state.currentPageNumber === 1;
    if (nextBtn) nextBtn.disabled = state.currentPageNumber === totalPages;
}

function previousPage() {
    if (state.currentPageNumber > 1) {
        state.currentPageNumber--;
        loadPedidos();
    }
}

function nextPage() {
    const totalPages = Math.ceil(state.pedidos.length / state.itemsPerPage);
    if (state.currentPageNumber < totalPages) {
        state.currentPageNumber++;
        loadPedidos();
    }
}

// Busca Global
function performGlobalSearch() {
    const searchTerm = document.getElementById('globalSearch').value.toLowerCase();
    updateGlobalSearchResults(searchTerm);
    
    if (searchTerm.length < 2) {
        switch(state.currentPage) {
            case 'pedidos': loadPedidos(); break;
            case 'clientes': loadClientes(); break;
            case 'produtos': loadProdutos(); break;
        }
        return;
    }

    switch(state.currentPage) {
        case 'pedidos':
            const pedidosFiltrados = state.pedidos.filter(pedido => 
                (pedido.numero_pedido && pedido.numero_pedido.toLowerCase().includes(searchTerm)) ||
                (pedido.cliente_nome && pedido.cliente_nome.toLowerCase().includes(searchTerm))
            );
            updatePedidosTable(pedidosFiltrados);
            break;
            
        case 'clientes':
            const clientesFiltrados = state.clientes.filter(cliente =>
                cliente.nome_fantasia.toLowerCase().includes(searchTerm) ||
                (cliente.cnpj && cliente.cnpj.includes(searchTerm)) ||
                (cliente.cidade && cliente.cidade.toLowerCase().includes(searchTerm))
            );
            updateClientesTable(clientesFiltrados);
            break;
            
        case 'produtos':
            const produtosFiltrados = state.produtos.filter(produto =>
                produto.nome.toLowerCase().includes(searchTerm) ||
                produto.codigo.toLowerCase().includes(searchTerm) ||
                (produto.descricao && produto.descricao.toLowerCase().includes(searchTerm))
            );
            updateProdutosTable(produtosFiltrados);
            break;
    }
}

// Logout
function logout() {
    if (confirm('Deseja sair do sistema?')) {
        localStorage.removeItem('mercus_current_user');
        localStorage.removeItem('mercus_token');
        window.location.href = 'login.html';
    }
}

// Função para mostrar erros
function showError(message) {
    console.error(message);
    // Você pode implementar um sistema de notificação mais sofisticado aqui
    alert('Erro: ' + message);
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Função melhorada para carregar clientes
async function loadClientes() {
    try {
        showLoading('clientesTableBody');
        const data = await apiCall('/clientes');
        state.clientes = data.clientes;
        updateClientesTable(state.clientes);
        updateClienteSelect(state.clientes);
        refreshNotificationBadge();
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        showErrorInTable('clientesTableBody', 'Erro ao carregar clientes: ' + error.message);
    }
}

// Função melhorada para carregar produtos
async function loadProdutos() {
    try {
        showLoading('produtosTableBody');
        const data = await apiCall('/produtos');
        state.produtos = data.produtos;
        updateProdutosTable(state.produtos);
        updateProdutoSelect(state.produtos);
        refreshNotificationBadge();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showErrorInTable('produtosTableBody', 'Erro ao carregar produtos: ' + error.message);
    }
}

// Função melhorada para carregar pedidos
async function loadPedidos() {
    try {
        showLoading('pedidosTableBody');
        const data = await apiCall('/pedidos');
        state.pedidos = data.pedidos;
        updatePedidosTable(state.pedidos);
        refreshNotificationBadge();
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        showErrorInTable('pedidosTableBody', 'Erro ao carregar pedidos: ' + error.message);
    }
}

// Funções auxiliares para UI
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<tr><td colspan="7" class="loading">Carregando...</td></tr>';
    }
}

function showErrorInTable(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<tr><td colspan="7" class="error">${message}</td></tr>`;
    }
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};

// Tecla ESC para fechar modais
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeAllModals();
    }
});

// Placeholder para função antiga (manter compatibilidade)
function generatePDF() {
    alert('Use o botão de PDF em cada pedido para gerar relatórios individuais.');
}
