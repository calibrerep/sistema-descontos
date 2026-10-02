// Importando o Firebase diretamente do Google
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// SUAS CHAVES DO FIREBASE (Copiadas da sua tela)
const firebaseConfig = {
  apiKey: "AIzaSyDmgjxM9qWJ5pb7J8zWnrnhO79mrXWLHCk",
  authDomain: "sistema-descontos.firebaseapp.com",
  projectId: "sistema-descontos",
  storageBucket: "sistema-descontos.firebasestorage.app",
  messagingSenderId: "724705105102",
  appId: "1:724705105102:web:6a3090a3be0d3302d4ac9f"
};

// Inicializando o Banco de Dados
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variáveis de controle
let clientes = [];
let clienteAtual = null;
let perfilAtivo = sessionStorage.getItem('usuarioLogado') || null;

// ==================== LISTENER EM TEMPO REAL DO FIREBASE ====================
// Fica escutando qualquer mudança na nuvem e atualiza a tela instantaneamente
onSnapshot(collection(db, "clientes"), (snapshot) => {
  clientes = [];
  snapshot.forEach((documento) => {
    clientes.push({ id: documento.id, ...documento.data() });
  });

  if (perfilAtivo) {
    window.filtrarClientes();
    
    // Se alguém mexer no cliente que está aberto na tela agora, atualiza os dados
    if (clienteAtual) {
      const atualizado = clientes.find(c => c.id === clienteAtual.id);
      if (atualizado) {
        clienteAtual = atualizado;
        renderizarDescontos();
      } else {
        window.voltarParaClientes(); // Se alguém excluir o cliente, volta pra lista
      }
    }
  }
});

// Inicialização da Tela
window.onload = () => {
  if (perfilAtivo) {
    window.entrarSistema(perfilAtivo);
  }
};

// ==================== SISTEMA DE ACESSO (LOGIN) ====================
window.entrarSistema = function(perfil) {
  perfilAtivo = perfil;
  sessionStorage.setItem('usuarioLogado', perfil);
  
  document.getElementById('nomePerfilAtivo').innerText = perfil === 'admin' ? 'Administrador' : perfil;
  document.getElementById('telaLogin').classList.add('hidden');
  document.getElementById('telaClientes').classList.remove('hidden');
  
  window.filtrarClientes();
};

window.sairSistema = function() {
  perfilAtivo = null;
  sessionStorage.removeItem('usuarioLogado');
  
  document.getElementById('telaClientes').classList.add('hidden');
  document.getElementById('telaDescontos').classList.add('hidden');
  document.getElementById('telaLogin').classList.remove('hidden');
};

// ==================== GESTÃO DE CLIENTES ====================
function renderizarClientes(lista) {
  const tbody = document.getElementById('tabelaClientesCorpo');
  tbody.innerHTML = '';

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500 text-sm">Nenhum cliente visível para o seu perfil.</td></tr>`;
    return;
  }

  lista.forEach(cli => {
    const tr = document.createElement('tr');
    tr.className = "border-b hover:bg-gray-50 text-sm";
    tr.innerHTML = `
      <td class="p-3 font-semibold text-blue-600">${cli.codigo}</td>
      <td class="p-3">
        <div class="font-bold text-gray-900">${cli.razao}</div>
        <div class="text-xs text-gray-500">${cli.fantasia || '-'}</div>
      </td>
      <td class="p-3">
        <span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded border">${cli.consultor}</span>
      </td>
      <td class="p-3 text-center space-x-2">
        <button onclick="abrirTabelaDescontos('${cli.id}')" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs px-2 py-1 rounded font-semibold">📋 Descontos</button>
        <button onclick="abrirModalCliente('${cli.id}')" class="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded font-semibold">✏️ Editar</button>
        ${perfilAtivo === 'admin' ? `<button onclick="excluirCliente('${cli.id}')" class="bg-red-100 hover:bg-red-200 text-red-800 text-xs px-2 py-1 rounded font-semibold">🗑️</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.filtrarClientes = function() {
  const termo = document.getElementById('campoBusca').value.toLowerCase().trim();
  
  let filtrados = clientes.filter(c => {
    if (perfilAtivo !== 'admin' && c.consultor !== perfilAtivo) return false;
    return c.codigo.toLowerCase().includes(termo) ||
           c.razao.toLowerCase().includes(termo) ||
           (c.cnpj && c.cnpj.includes(termo));
  });

  renderizarClientes(filtrados);
};

// ==================== MODAL DE CLIENTE E SALVAMENTO NA NUVEM ====================
window.abrirModalCliente = function(id = null) {
  document.getElementById('formCliente').reset();
  document.getElementById('cliId').value = '';

  const selectConsultor = document.getElementById('cliConsultor');
  if (perfilAtivo !== 'admin') {
    selectConsultor.value = perfilAtivo;
    selectConsultor.disabled = true;
  } else {
    selectConsultor.disabled = false;
  }

  if (id) {
    const cli = clientes.find(c => c.id === id);
    if (cli) {
      document.getElementById('modalTitulo').innerText = 'Editar Cliente';
      document.getElementById('cliId').value = cli.id;
      document.getElementById('cliCodigo').value = cli.codigo;
      document.getElementById('cliConsultor').value = cli.consultor;
      document.getElementById('cliRazao').value = cli.razao;
      document.getElementById('cliFantasia').value = cli.fantasia || '';
      document.getElementById('cliCnpj').value = cli.cnpj || '';
    }
  } else {
    document.getElementById('modalTitulo').innerText = 'Cadastrar Novo Cliente';
  }

  document.getElementById('modalCliente').classList.remove('hidden');
};

window.fecharModalCliente = function() {
  document.getElementById('modalCliente').classList.add('hidden');
};

// SALVAR NO FIREBASE
window.salvarCliente = async function(e) {
  e.preventDefault();
  const idAtual = document.getElementById('cliId').value;
  
  // Se for cliente novo, cria um ID aleatório, senão usa o ID existente
  const idDocumento = idAtual ? idAtual : Date.now().toString(); 
  
  // Resgata os descontos antigos caso seja uma edição
  const descontosAntigos = idAtual ? clientes.find(c => c.id === idAtual)?.descontos || [] : [];

  const dados = {
    codigo: document.getElementById('cliCodigo').value.trim(),
    consultor: document.getElementById('cliConsultor').value,
    razao: document.getElementById('cliRazao').value.trim(),
    fantasia: document.getElementById('cliFantasia').value.trim(),
    cnpj: document.getElementById('cliCnpj').value.trim(),
    descontos: descontosAntigos 
  };

  try {
    // Comando para gravar no Firebase
    await setDoc(doc(db, "clientes", idDocumento), dados);
    window.fecharModalCliente();
  } catch (error) {
    alert("Erro ao salvar no banco de dados: " + error);
  }
};

window.excluirCliente = async function(id) {
  if (confirm("Tem certeza que deseja apagar este cliente e sua tabela de descontos? Essa ação é irreversível na nuvem.")) {
    try {
      await deleteDoc(doc(db, "clientes", id));
    } catch (error) {
      alert("Erro ao excluir: " + error);
    }
  }
};

// ==================== PLANILHA DE DESCONTOS DO CLIENTE ====================
window.abrirTabelaDescontos = function(clienteId) {
  clienteAtual = clientes.find(c => c.id === clienteId);
  if (!clienteAtual) return;

  document.getElementById('detalheCodigo').innerText = clienteAtual.codigo;
  document.getElementById('detalheRazao').innerText = clienteAtual.razao;
  document.getElementById('detalheFantasia').innerText = clienteAtual.fantasia ? `(${clienteAtual.fantasia})` : '';
  document.getElementById('detalheCnpj').innerText = clienteAtual.cnpj ? `CNPJ: ${clienteAtual.cnpj}` : '';
  document.getElementById('detalheConsultor').innerText = `Atendido por: ${clienteAtual.consultor}`;

  renderizarDescontos();

  document.getElementById('telaClientes').classList.add('hidden');
  document.getElementById('telaDescontos').classList.remove('hidden');
};

window.voltarParaClientes = function() {
  clienteAtual = null;
  document.getElementById('telaDescontos').classList.add('hidden');
  document.getElementById('telaClientes').classList.remove('hidden');
  window.filtrarClientes();
};

function renderizarDescontos() {
  const tbody = document.getElementById('tabelaDescontosCorpo');
  tbody.innerHTML = '';

  if (!clienteAtual.descontos || clienteAtual.descontos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-500 text-sm">Nenhum produto/desconto cadastrado.</td></tr>`;
    return;
  }

  clienteAtual.descontos.forEach((prod, index) => {
    const tr = document.createElement('tr');
    tr.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    tr.innerHTML = `
      <td class="border border-gray-200 p-2 text-sm">${prod.nome}</td>
      <td class="border border-gray-200 p-2 text-right">
        <input type="number" step="0.01" value="${prod.desconto}" onchange="window.atualizarProduto(${prod.id}, 'desconto', this.value)" class="w-full bg-transparent border-b border-transparent focus:border-blue-500 p-1 text-sm text-right outline-none font-mono" />
      </td>
      <td class="border border-gray-200 p-2 text-center no-print">
        <button onclick="window.excluirProduto(${prod.id})" class="text-red-600 hover:text-red-800 text-xs font-semibold">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.adicionarProduto = async function() {
  const nome = document.getElementById('prodNome').value.trim();
  const desconto = parseFloat(document.getElementById('prodDesconto').value);

  if (!nome || isNaN(desconto)) {
    alert('Preencha o produto e o desconto.');
    return;
  }

  const novosDescontos = [...(clienteAtual.descontos || [])];
  novosDescontos.push({ id: Date.now(), nome, desconto });

  // Salva a alteração direto no Firebase
  await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos });

  document.getElementById('prodNome').value = '';
  document.getElementById('prodDesconto').value = '';
};

window.atualizarProduto = async function(id, campo, valor) {
  const novosDescontos = [...clienteAtual.descontos];
  const prodIndex = novosDescontos.findIndex(p => p.id === id);
  
  if (prodIndex > -1) {
    novosDescontos[prodIndex][campo] = campo === 'desconto' ? parseFloat(valor) || 0 : valor;
    await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos });
  }
};

window.excluirProduto = async function(id) {
  if (confirm('Remover este produto?')) {
    const novosDescontos = clienteAtual.descontos.filter(p => p.id !== id);
    await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos });
  }
};