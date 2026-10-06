// Importando o Firebase e os módulos de Autenticação e Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDmgjxM9qWJ5pb7J8zWnrnhO79mrXWLHCk",
  authDomain: "sistema-descontos.firebaseapp.com",
  projectId: "sistema-descontos",
  storageBucket: "sistema-descontos.firebasestorage.app",
  messagingSenderId: "724705105102",
  appId: "1:724705105102:web:6a3090a3be0d3302d4ac9f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let clientes = [];
let clienteAtual = null;
let perfilAtivo = null;

// ==================== MONITOR DE SESSÃO DO FIREBASE AUTH ====================
onAuthStateChanged(auth, (user) => {
  if (user) {
    const email = user.email.toLowerCase();
    
    if (email === 'calibrerep@gmail.com') {
      perfilAtivo = 'admin';
    } else if (email === 'mezavila@mezavila.com') {
      perfilAtivo = 'Consultor 1';
    } else if (email === 'guilhermerepcalibre@gmail.com') {
      perfilAtivo = 'Consultor 2';
    } else {
      perfilAtivo = 'Sem Acesso'; 
    }

    entrarSistemaInterface(perfilAtivo);
  } else {
    perfilAtivo = null;
    sairSistemaInterface();
  }
});

// ==================== REALTIME LISTENER DO FIRESTORE ====================
onSnapshot(collection(db, "clientes"), (snapshot) => {
  clientes = [];
  snapshot.forEach((documento) => {
    clientes.push({ id: documento.id, ...documento.data() });
  });

  if (auth.currentUser) {
    window.filtrarClientes();
    if (clienteAtual) {
      const atualizado = clientes.find(c => c.id === clienteAtual.id);
      if (atualizado) {
        clienteAtual = atualizado;
        renderizarDescontos();
      } else {
        window.voltarParaClientes();
      }
    }
  }
});

window.fazerLogin = async function() {
  const emailInput = document.getElementById('loginEmail').value.trim();
  const senhaInput = document.getElementById('loginSenha').value;

  if (!emailInput || !senhaInput) {
    alert('Preencha o e-mail e a senha.');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, emailInput, senhaInput);
  } catch (error) {
    alert('Erro ao entrar: Verifique as suas credenciais. (' + error.message + ')');
  }
};

window.sairSistema = async function() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
};

function entrarSistemaInterface(perfil) {
  document.getElementById('nomePerfilAtivo').innerText = perfil === 'admin' ? 'Administrador' : perfil;
  document.getElementById('telaLogin').classList.add('hidden');
  document.getElementById('telaClientes').classList.remove('hidden');
  
  // Controlo de visibilidade de botões (Apenas Admin vê Novo Cliente e Backup)
  const btnNovoCliente = document.getElementById('btnNovoCliente');
  const btnBackup = document.getElementById('btnBackup');
  
  if (btnNovoCliente) btnNovoCliente.style.display = perfil === 'admin' ? 'inline-flex' : 'none';
  if (btnBackup) btnBackup.style.display = perfil === 'admin' ? 'inline-flex' : 'none';

  window.filtrarClientes();
}

function sairSistemaInterface() {
  document.getElementById('telaClientes').classList.add('hidden');
  document.getElementById('telaDescontos').classList.add('hidden');
  document.getElementById('telaLogin').classList.remove('hidden');
  const emailField = document.getElementById('loginEmail');
  const senhaField = document.getElementById('loginSenha');
  if (emailField) emailField.value = '';
  if (senhaField) senhaField.value = '';
}

// ==================== FUNÇÃO DE BACKUP ====================
window.fazerBackup = function() {
  if (perfilAtivo !== 'admin') {
    alert('Acesso negado.');
    return;
  }
  
  // Converte a base de dados num ficheiro de texto JSON
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clientes, null, 2));
  const link = document.createElement('a');
  link.setAttribute("href", dataStr);
  link.setAttribute("download", "Backup_Sistema_Descontos_" + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-') + ".json");
  document.body.appendChild(link);
  link.click();
  link.remove();
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
    const temPendencia = cli.descontos && cli.descontos.some(p => p.status === 'pendente');
    const badgePendencia = (perfilAtivo === 'admin' && temPendencia) ? '<span class="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold ml-1 animate-pulse">⚠️ Aprovar</span>' : '';

    const tr = document.createElement('tr');
    tr.className = "border-b hover:bg-gray-50 text-sm";
    
    let acoesHtml = `
      <button onclick="abrirTabelaDescontos('${cli.id}')" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs px-2 py-1 rounded font-semibold">📋 Descontos</button>
    `;

    if (perfilAtivo === 'admin') {
      acoesHtml += `
        <button onclick="abrirModalCliente('${cli.id}')" class="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded font-semibold ml-1">✏️ Editar</button>
        <button onclick="excluirCliente('${cli.id}')" class="bg-red-100 hover:bg-red-200 text-red-800 text-xs px-2 py-1 rounded font-semibold ml-1">🗑️</button>
      `;
    }

    tr.innerHTML = `
      <td class="p-3 font-semibold text-blue-600">${cli.codigo}</td>
      <td class="p-3">
        <div class="font-bold text-gray-900">${cli.razao} ${badgePendencia}</div>
        <div class="text-xs text-gray-500">${cli.fantasia || '-'}</div>
      </td>
      <td class="p-3">
        <span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded border">${cli.consultor}</span>
      </td>
      <td class="p-3 text-center">
        ${acoesHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.filtrarClientes = function() {
  const campoBusca = document.getElementById('campoBusca');
  if (!campoBusca) return;
  const termo = campoBusca.value.toLowerCase().trim();
  
  let filtrados = clientes.filter(c => {
    if (perfilAtivo !== 'admin' && c.consultor !== perfilAtivo) return false;
    return c.codigo.toLowerCase().includes(termo) ||
           c.razao.toLowerCase().includes(termo) ||
           (c.cnpj && c.cnpj.includes(termo));
  });

  // NOVIDADE: ORDENAÇÃO ALFABÉTICA DOS CLIENTES PELA RAZÃO SOCIAL
  filtrados.sort((a, b) => a.razao.localeCompare(b.razao));

  renderizarClientes(filtrados);
};

window.abrirModalCliente = function(id = null) {
  if (perfilAtivo !== 'admin') {
    alert('Acesso negado. Apenas o Administrador pode cadastrar ou editar clientes.');
    return;
  }

  document.getElementById('formCliente').reset();
  document.getElementById('cliId').value = '';

  const selectConsultor = document.getElementById('cliConsultor');
  selectConsultor.disabled = false;

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

window.salvarCliente = async function(e) {
  e.preventDefault();
  if (perfilAtivo !== 'admin') return;

  const idAtual = document.getElementById('cliId').value;
  
  const codigoDigitado = document.getElementById('cliCodigo').value.trim();
  const cnpjDigitado = document.getElementById('cliCnpj').value.trim();

  // NOVIDADE: BLOQUEIO DE CLIENTES DUPLICADOS
  const clienteDuplicado = clientes.find(c => 
    c.id !== idAtual && // Não compara com ele mesmo na hora de editar
    (c.codigo.toLowerCase() === codigoDigitado.toLowerCase() || (cnpjDigitado && c.cnpj === cnpjDigitado))
  );

  if (clienteDuplicado) {
    alert('Atenção: Já existe um cliente cadastrado com este Código ou CNPJ!');
    return; // Para a execução e não salva
  }

  const idDocumento = idAtual ? idAtual : Date.now().toString(); 
  const descontosAntigos = idAtual ? clientes.find(c => c.id === idAtual)?.descontos || [] : [];

  const dados = {
    codigo: codigoDigitado,
    consultor: document.getElementById('cliConsultor').value,
    razao: document.getElementById('cliRazao').value.trim(),
    fantasia: document.getElementById('cliFantasia').value.trim(),
    cnpj: cnpjDigitado,
    descontos: descontosAntigos 
  };

  try {
    await setDoc(doc(db, "clientes", idDocumento), dados);
    window.fecharModalCliente();
  } catch (error) {
    alert("Erro ao salvar no banco de dados: " + error);
  }
};

window.excluirCliente = async function(id) {
  if (perfilAtivo !== 'admin') {
    alert('Acesso negado.');
    return;
  }

  if (confirm("Tem certeza que deseja apagar este cliente e sua tabela de descontos? Essa ação é irreversível na nuvem.")) {
    try {
      await deleteDoc(doc(db, "clientes", id));
    } catch (error) {
      alert("Erro ao excluir: " + error);
    }
  }
};

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

  // NOVIDADE: ORDENAÇÃO ALFABÉTICA DOS PRODUTOS
  const descontosOrdenados = [...clienteAtual.descontos].sort((a, b) => a.nome.localeCompare(b.nome));

  descontosOrdenados.forEach((prod) => {
    const tr = document.createElement('tr');
    const isPendente = prod.status === 'pendente';
    
    tr.className = isPendente ? 'bg-amber-50' : 'bg-white';
    
    let acoesHtml = '';
    if (perfilAtivo === 'admin') {
      if (isPendente) {
        acoesHtml = `
          <div class="flex justify-center gap-1">
            <button onclick="aprovarProduto(${prod.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2 py-1 rounded font-semibold">✔ Aprovar</button>
            <button onclick="rejeitarProduto(${prod.id})" class="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded font-semibold">✖ Rejeitar</button>
          </div>
        `;
      } else {
        acoesHtml = `
          <div class="flex justify-center items-center gap-2">
            <span class="text-xs text-emerald-700 font-bold">Aprovado</span>
            <button onclick="window.excluirProduto(${prod.id})" class="text-red-600 hover:text-red-800 text-xs font-semibold">Excluir</button>
          </div>
        `;
      }
    } else {
      if (isPendente) {
        acoesHtml = `<span class="text-xs text-amber-700 font-bold">Aguardando aprovação</span>`;
      } else {
        acoesHtml = `<span class="text-xs text-emerald-700 font-bold">Aprovado (Válido)</span>`;
      }
    }

    const valorExibido = (isPendente && perfilAtivo !== 'admin') ? (prod.valorAntigo !== undefined && prod.valorAntigo !== null ? prod.valorAntigo : prod.desconto) : prod.desconto;

    tr.innerHTML = `
      <td class="border border-gray-200 p-2 text-sm">
        ${prod.nome}
        ${isPendente ? `<div class="text-[11px] text-amber-700 font-bold mt-1">⚠️ Sugestão pendente: <b>${prod.desconto}%</b> (Valor atual válido: ${prod.valorAntigo !== null ? prod.valorAntigo : 'Nenhum'}%)</div>` : ''}
      </td>
      <td class="border border-gray-200 p-2 text-right">
        <input type="number" step="0.01" value="${valorExibido}" id="input-prod-${prod.id}" class="w-full bg-transparent border border-gray-300 rounded p-1 text-sm text-right outline-none font-mono" />
      </td>
      <td class="border border-gray-200 p-2 text-center no-print">
        <div class="flex flex-col items-center gap-1">
          ${acoesHtml}
          ${perfilAtivo !== 'admin' ? 
            (isPendente ? `<span class="text-[10px] text-amber-600 font-semibold">Em análise</span>` : `<button onclick="sugerirAlteracao(${prod.id})" class="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-0.5 rounded font-semibold mt-1">Sugerir Alteração</button>`) 
            : `<button onclick="salvarAdminDireto(${prod.id})" class="bg-gray-700 hover:bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded font-semibold mt-1">Atualizar</button>`}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.adicionarProduto = async function() {
  const prodNome = document.getElementById('prodNome');
  const prodDesconto = document.getElementById('prodDesconto');
  if (!prodNome || !prodDesconto) return;

  const nome = prodNome.value.trim();
  const desconto = parseFloat(prodDesconto.value);

  if (!nome || isNaN(desconto)) {
    alert('Preencha o produto e o desconto.');
    return;
  }

  // NOVIDADE: BLOQUEIO DE PRODUTOS REPETIDOS
  const jaExiste = (clienteAtual.descontos || []).some(p => p.nome.toLowerCase() === nome.toLowerCase());
  if (jaExiste) {
    alert('Atenção: Este produto ou referência já está cadastrado para este cliente!');
    return;
  }

  const novosDescontos = [...(clienteAtual.descontos || [])];
  const statusInicial = perfilAtivo === 'admin' ? 'aprovado' : 'pendente';

  novosDescontos.push({ 
    id: Date.now(), 
    nome, 
    desconto, 
    status: statusInicial,
    valorAntigo: statusInicial === 'pendente' ? 0 : null
  });

  try {
    await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos });
    prodNome.value = '';
    prodDesconto.value = '';
  } catch (erro) {
    alert("Ocorreu um erro ao gravar: " + erro.message);
  }
};

window.sugerirAlteracao = async function(id) {
  const inputEl = document.getElementById(`input-prod-${id}`);
  if (!inputEl) return;
  const novoValor = parseFloat(inputEl.value) || 0;
  
  const novosDescontos = [...clienteAtual.descontos];
  const prodIndex = novosDescontos.findIndex(p => p.id === id);
  
  if (prodIndex > -1) {
    const produto = novosDescontos[prodIndex];
    if (produto.status !== 'pendente') {
      produto.valorAntigo = produto.desconto;
    }
    produto.desconto = novoValor;
    produto.status = 'pendente';

    try {
      await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos });
      alert('Sugestão de alteração enviada para o Administrador!');
    } catch (erro) {
      alert("Ocorreu um erro ao gravar: " + erro.message);
    }
  }
};

window.salvarAdminDireto = async function(id) {
  if (perfilAtivo !== 'admin') return;

  const inputEl = document.getElementById(`input-prod-${id}`);
  if (!inputEl) return;
  const novoValor = parseFloat(inputEl.value) || 0;
  
  const novosDescontos = [...clienteAtual.descontos];
  const prodIndex = novosDescontos.findIndex(p => p.id === id);
  
  if (prodIndex > -1) {
    novosDescontos[prodIndex].desconto = novoValor;
    novosDescontos[prodIndex].status = 'aprovado';
    novosDescontos[prodIndex].valorAntigo = null;

    try {
      await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos });
      alert('Desconto atualizado com sucesso!');
    } catch (erro) {
      alert("Erro ao gravar: " + erro.message);
    }
  }
};

window.aprovarProduto = async function(id) {
  if (perfilAtivo !== 'admin') return;

  const novosDescontos = [...clienteAtual.descontos];
  const prod = novosDescontos.find(p => p.id === id);
  if (prod) {
    prod.status = 'aprovado';
    prod.valorAntigo = null;
    await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos });
  }
};

window.rejeitarProduto = async function(id) {
  if (perfilAtivo !== 'admin') return;

  const novosDescontos = [...clienteAtual.descontos];
  const prodIndex = novosDescontos.findIndex(p => p.id === id);
  
  if (prodIndex > -1) {
    const prod = novosDescontos[prodIndex];
    if (prod.valorAntigo !== null && prod.valorAntigo !== undefined) {
      prod.desconto = prod.valorAntigo;
      prod.status = 'aprovado';
      prod.valorAntigo = null;
      await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos });
    } else {
      const filtrados = novosDescontos.filter(p => p.id !== id);
      await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: filtrados });
    }
  }
};

window.excluirProduto = async function(id) {
  if (perfilAtivo !== 'admin') {
    alert('Apenas o Administrador pode excluir produtos da tabela.');
    return;
  }

  if (confirm('Remover este produto?')) {
    const novosDescontos = clienteAtual.descontos.filter(p => p.id !== id);
    await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos });
  }
};