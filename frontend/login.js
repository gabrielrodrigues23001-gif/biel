// Login flow (separate file to satisfy CSP).
const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '/api';

function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

async function handleLogin(event) {
  if (event && event.preventDefault) {
    event.preventDefault();
  }

  const email = document.getElementById('email')?.value || '';
  const password = document.getElementById('password')?.value || '';
  const btn = document.querySelector('#loginForm button');
  setButtonLoading(btn, true);

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        senha: password
      })
    });

    const result = await response.json();

    if (result.success) {
      localStorage.setItem('mercus_token', result.token);
      localStorage.setItem('mercus_current_user', JSON.stringify(result.user));
      window.location.href = 'index.html';
      return false;
    }

    alert('Erro no login: ' + (result.error || 'Credenciais invalidas'));
  } catch (error) {
    console.error('Erro no login:', error);
    alert('Erro de conexao. Verifique se o servidor esta rodando.');
  } finally {
    setButtonLoading(btn, false);
  }

  return false;
}

function skipLogin() {
  const userData = {
    id: 1,
    nome: 'Administrador Demo',
    email: 'admin@mercus.com',
    nivel_acesso: 'admin',
    telefone: '(11) 99999-9999'
  };

  localStorage.setItem('mercus_current_user', JSON.stringify(userData));
  localStorage.setItem('mercus_token', 'demo_token_skip_login');
  window.location.href = 'index.html';
}

function validateExistingSession() {
  const token = localStorage.getItem('mercus_token');
  const user = localStorage.getItem('mercus_current_user');

  if (token && user) {
    fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => {
        if (response.ok) {
          window.location.href = 'index.html';
        }
      })
      .catch(() => {
        localStorage.removeItem('mercus_token');
        localStorage.removeItem('mercus_current_user');
      });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', handleLogin);
  }

  const skipLink = document.getElementById('skipLoginLink');
  if (skipLink) {
    skipLink.addEventListener('click', (event) => {
      event.preventDefault();
      skipLogin();
    });
  }

  validateExistingSession();
});
