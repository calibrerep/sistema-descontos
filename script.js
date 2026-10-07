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
let mostrarApenasPendencias = false; 

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
        if (!document.getElementById('telaDescontos').classList.contains('hidden')) {
          renderizarDescontos();
        }
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

window.fazerBackup = function() {
  if (perfilAtivo !== 'admin') return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clientes, null, 2));
  const link = document.createElement('a');
  link.setAttribute("href", dataStr);
  link.setAttribute("download", "Backup_Sistema_Descontos_" + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-') + ".json");
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// ==================== GESTÃO DE CLIENTES & FILTROS ====================

window.alternarFiltroPendencias = function() {
  mostrarApenasPendencias = !mostrarApenasPendencias;
  const btn = document.getElementById('btnFiltroPendencias');
  
  if (mostrarApenasPendencias) {
    btn.classList.replace('bg-amber-100', 'bg-amber-500');
    btn.classList.replace('text-amber-800', 'text-white');
    btn.innerText = '✖ Limpar Filtro';
  } else {
    btn.classList.replace('bg-amber-500', 'bg-amber-100');
    btn.classList.replace('text-white', 'text-amber-800');
    btn.innerText = '⚠️ Ver Pendências';
  }
  
  window.filtrarClientes();
};

window.filtrarClientes = function() {
  const campoBusca = document.getElementById('campoBusca');
  if (!campoBusca) return;
  const termo = campoBusca.value.toLowerCase().trim();
  
  let filtrados = clientes.filter(c => {
    if (perfilAtivo !== 'admin' && c.consultor !== perfilAtivo) return false;
    
    const temPendencia = c.descontos && c.descontos.some(p => p.status === 'pendente');
    if (mostrarApenasPendencias && !temPendencia) return false;

    return c.codigo.toLowerCase().includes(termo) ||
           c.razao.toLowerCase().includes(termo) ||
           (c.cnpj && c.cnpj.includes(termo));
  });

  filtrados.sort((a, b) => a.razao.localeCompare(b.razao));
  renderizarClientes(filtrados);
};

function renderizarClientes(lista) {
  const tbody = document.getElementById('tabelaClientesCorpo');
  tbody.innerHTML = '';

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500 text-sm">Nenhum cliente encontrado.</td></tr>`;
    return;
  }

  lista.forEach(cli => {
    const temPendencia = cli.descontos && cli.descontos.some(p => p.status === 'pendente');
    const badgePendencia = (perfilAtivo === 'admin' && temPendencia) ? '<span class="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold ml-1 animate-pulse">⚠️ Aprovar</span>' : '';
    
    const dataAtualizacao = cli.ultimaAtualizacao ? new Date(cli.ultimaAtualizacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' }) : 'Sem data';

    const tr = document.createElement('tr');
    tr.className = "border-b hover:bg-gray-50 text-sm";
    
    let acoesHtml = `
      <div class="flex flex-wrap justify-center gap-1">
        <button onclick="abrirTabelaDescontos('${cli.id}')" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs px-2 py-1 rounded font-semibold">📋 Descontos</button>
      </div>
    `;

    if (perfilAtivo === 'admin') {
      acoesHtml += `
        <div class="flex flex-wrap justify-center gap-1 mt-1">
          <button onclick="abrirModalCliente('${cli.id}')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs px-2 py-1 rounded font-semibold">✏️ Editar</button>
          <button onclick="excluirCliente('${cli.id}')" class="bg-red-100 hover:bg-red-200 text-red-800 text-xs px-2 py-1 rounded font-semibold">🗑️ Excluir</button>
        </div>
      `;
    }

    tr.innerHTML = `
      <td class="p-3 font-semibold text-blue-600">${cli.codigo}</td>
      <td class="p-3">
        <div class="font-bold text-gray-900">${cli.razao} ${badgePendencia}</div>
        <div class="text-xs text-gray-500 mb-1">${cli.fantasia || '-'}</div>
        <div class="text-[10px] text-gray-400 font-medium">🕒 Atualizado: ${dataAtualizacao}</div>
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

window.abrirModalCliente = function(id = null) {
  if (perfilAtivo !== 'admin') return;

  document.getElementById('formCliente').reset();
  document.getElementById('cliId').value = '';

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
      document.getElementById('cliColuna1').value = cli.coluna1 || 'Desc. Prazo (%)';
      document.getElementById('cliColuna2').value = cli.coluna2 || 'Desc. Vista (%)';
    }
  } else {
    document.getElementById('modalTitulo').innerText = 'Cadastrar Novo Cliente';
    document.getElementById('cliColuna1').value = 'Desc. Prazo (%)';
    document.getElementById('cliColuna2').value = 'Desc. Vista (%)';
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

  const clienteDuplicado = clientes.find(c => 
    c.id !== idAtual && 
    (c.codigo.toLowerCase() === codigoDigitado.toLowerCase() || (cnpjDigitado && c.cnpj === cnpjDigitado))
  );

  if (clienteDuplicado) {
    alert('Atenção: Já existe um cliente com este Código ou CNPJ!');
    return;
  }

  const idDocumento = idAtual ? idAtual : Date.now().toString(); 
  const clienteAntigo = idAtual ? clientes.find(c => c.id === idAtual) : null;
  const descontosAntigos = clienteAntigo ? clienteAntigo.descontos || [] : [];
  
  const ultimaAtualizacao = clienteAntigo ? clienteAntigo.ultimaAtualizacao : new Date().toISOString();

  const dados = {
    codigo: codigoDigitado,
    consultor: document.getElementById('cliConsultor').value,
    razao: document.getElementById('cliRazao').value.trim(),
    fantasia: document.getElementById('cliFantasia').value.trim(),
    cnpj: cnpjDigitado,
    coluna1: document.getElementById('cliColuna1').value.trim() || 'Desc. Prazo (%)',
    coluna2: document.getElementById('cliColuna2').value.trim() || 'Desc. Vista (%)',
    descontos: descontosAntigos,
    ultimaAtualizacao: ultimaAtualizacao
  };

  try {
    await setDoc(doc(db, "clientes", idDocumento), dados);
    window.fecharModalCliente();
  } catch (error) {
    alert("Erro ao salvar: " + error);
  }
};

window.excluirCliente = async function(id) {
  if (perfilAtivo !== 'admin') return;
  if (confirm("Tem certeza que deseja apagar este cliente e sua tabela?")) {
    try {
      await deleteDoc(doc(db, "clientes", id));
    } catch (error) {
      alert("Erro ao excluir: " + error);
    }
  }
};

// ==================== TABELA DE DESCONTOS ====================

window.abrirTabelaDescontos = function(clienteId) {
  clienteAtual = clientes.find(c => c.id === clienteId);
  if (!clienteAtual) return;

  document.getElementById('detalheCodigo').innerText = clienteAtual.codigo;
  document.getElementById('detalheRazao').innerText = clienteAtual.razao;
  document.getElementById('detalheFantasia').innerText = clienteAtual.fantasia ? `(${clienteAtual.fantasia})` : '';
  document.getElementById('detalheCnpj').innerText = clienteAtual.cnpj ? `CNPJ: ${clienteAtual.cnpj}` : '';
  document.getElementById('detalheConsultor').innerText = `Atendido por: ${clienteAtual.consultor}`;

  const nomeCol1 = clienteAtual.coluna1 || 'Desc. Prazo (%)';
  const nomeCol2 = clienteAtual.coluna2 || 'Desc. Vista (%)';
  
  document.getElementById('thColuna1').innerText = nomeCol1;
  document.getElementById('thColuna2').innerText = nomeCol2;
  document.getElementById('labelInputCol1').innerText = nomeCol1 + ':';
  document.getElementById('labelInputCol2').innerText = nomeCol2 + ':';

  const btnImportarExcel = document.getElementById('btnImportarExcel');
  const btnExcluirTodos = document.getElementById('btnExcluirTodos');
  const btnAprovarTodos = document.getElementById('btnAprovarTodos');
  
  if (btnImportarExcel) btnImportarExcel.style.display = perfilAtivo === 'admin' ? 'inline-flex' : 'none';
  if (btnExcluirTodos) btnExcluirTodos.style.display = perfilAtivo === 'admin' ? 'inline-flex' : 'none';
  if (btnAprovarTodos) {
    const temPendencias = clienteAtual.descontos && clienteAtual.descontos.some(p => p.status === 'pendente');
    btnAprovarTodos.style.display = (perfilAtivo === 'admin' && temPendencias) ? 'inline-flex' : 'none';
  }

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
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500 text-sm">Nenhum produto/desconto cadastrado.</td></tr>`;
    return;
  }

  const descontosOrdenados = [...clienteAtual.descontos].sort((a, b) => a.nome.localeCompare(b.nome));

  descontosOrdenados.forEach((prod) => {
    const tr = document.createElement('tr');
    const isPendente = prod.status === 'pendente';
    
    tr.className = isPendente ? 'bg-amber-50' : 'bg-white';

    const valPrazo = prod.desconto !== undefined && prod.desconto !== null ? (prod.desconto <= 1 ? Number((prod.desconto * 100).toFixed(2)) : Number(Number(prod.desconto).toFixed(2))) : '';
    const valVista = prod.descontoVista !== undefined && prod.descontoVista !== null ? (prod.descontoVista <= 1 ? Number((prod.descontoVista * 100).toFixed(2)) : Number(Number(prod.descontoVista).toFixed(2))) : '';

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
      acoesHtml = isPendente ? `<span class="text-xs text-amber-700 font-bold">Em análise</span>` : `<span class="text-xs text-emerald-700 font-bold">Aprovado</span>`;
    }

    // NOVIDADE: A coluna de Produto agora tem um input de texto em vez de ser fixa
    tr.innerHTML = `
      <td class="border border-gray-200 p-2">
        <input type="text" id="input-nome-${prod.id}" value="${prod.nome}" class="w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 rounded p-1 text-sm font-medium text-gray-900 outline-none transition-colors" />
        ${isPendente ? `<div class="text-[11px] text-amber-700 font-bold mt-1 ml-1">⚠️ Sugestão pendente</div>` : ''}
      </td>
      <td class="border border-gray-200 p-2 text-right">
        <input type="number" step="0.01" value="${valPrazo}" id="input-prazo-${prod.id}" class="w-full bg-transparent border border-gray-300 rounded p-1 text-sm text-right outline-none font-mono" />
      </td>
      <td class="border border-gray-200 p-2 text-right">
        <input type="number" step="0.01" value="${valVista}" id="input-vista-${prod.id}" class="w-full bg-transparent border border-gray-300 rounded p-1 text-sm text-right outline-none font-mono" />
      </td>
      <td class="border border-gray-200 p-2 text-center no-print">
        <div class="flex flex-col items-center gap-1">
          ${acoesHtml}
          ${perfilAtivo !== 'admin' ? 
            (!isPendente ? `<button onclick="sugerirAlteracao(${prod.id})" class="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-0.5 rounded font-semibold mt-1">Sugerir</button>` : '') 
            : `<button onclick="salvarAdminDireto(${prod.id})" class="bg-gray-700 hover:bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded font-semibold mt-1">Atualizar</button>`}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// === LÓGICAS DE ATUALIZAÇÃO DA TABELA ===

window.adicionarProduto = async function() {
  const prodNome = document.getElementById('prodNome');
  const prodDesconto = document.getElementById('prodDesconto');
  const prodDescontoVista = document.getElementById('prodDescontoVista');
  
  if (!prodNome || !prodDesconto) return;
  const nome = prodNome.value.trim();
  const desconto = parseFloat(prodDesconto.value) || 0;
  const descontoVista = prodDescontoVista && prodDescontoVista.value ? parseFloat(prodDescontoVista.value) : 0;

  if (!nome) { alert('Preencha o nome do produto.'); return; }
  const jaExiste = (clienteAtual.descontos || []).some(p => p.nome.toLowerCase() === nome.toLowerCase());
  if (jaExiste) { alert('Atenção: Este produto já está cadastrado!'); return; }

  const novosDescontos = [...(clienteAtual.descontos || [])];
  novosDescontos.push({ 
    id: Date.now(), 
    nome, 
    desconto, 
    descontoVista, 
    status: perfilAtivo === 'admin' ? 'aprovado' : 'pendente',
    valorAntigo: null
  });

  try {
    await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos, ultimaAtualizacao: new Date().toISOString() });
    prodNome.value = ''; prodDesconto.value = ''; if (prodDescontoVista) prodDescontoVista.value = '';
  } catch (erro) { alert("Erro ao gravar: " + erro.message); }
};

window.sugerirAlteracao = async function(id) {
  const nomeEl = document.getElementById(`input-nome-${id}`); // Lê o novo nome
  const prazoEl = document.getElementById(`input-prazo-${id}`);
  const vistaEl = document.getElementById(`input-vista-${id}`);
  if (!prazoEl || !vistaEl || !nomeEl) return;
  
  const novoNome = nomeEl.value.trim();
  if (!novoNome) { alert("O nome do produto não pode ficar vazio."); return; }

  const novosDescontos = [...clienteAtual.descontos];

  // Verifica se o utilizador não renomeou para um produto que já existe (ignorando o id atual)
  const jaExiste = novosDescontos.some(p => p.id !== id && p.nome.toLowerCase() === novoNome.toLowerCase());
  if (jaExiste) { alert('Já existe outro produto com este nome na tabela!'); return; }

  const prodIndex = novosDescontos.findIndex(p => p.id === id);
  
  if (prodIndex > -1) {
    novosDescontos[prodIndex].nome = novoNome;
    novosDescontos[prodIndex].desconto = parseFloat(prazoEl.value) || 0;
    novosDescontos[prodIndex].descontoVista = parseFloat(vistaEl.value) || 0;
    novosDescontos[prodIndex].status = 'pendente';

    try {
      await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos, ultimaAtualizacao: new Date().toISOString() });
      alert('Sugestão (nome/valores) enviada para o Administrador!');
    } catch (erro) { alert("Erro ao gravar: " + erro.message); }
  }
};

window.salvarAdminDireto = async function(id) {
  if (perfilAtivo !== 'admin') return;
  
  const nomeEl = document.getElementById(`input-nome-${id}`); // Lê o novo nome
  const prazoEl = document.getElementById(`input-prazo-${id}`);
  const vistaEl = document.getElementById(`input-vista-${id}`);
  if (!prazoEl || !vistaEl || !nomeEl) return;
  
  const novoNome = nomeEl.value.trim();
  if (!novoNome) { alert("O nome do produto não pode ficar vazio."); return; }

  const novosDescontos = [...clienteAtual.descontos];

  // Verifica se não renomeou para um produto que já existe
  const jaExiste = novosDescontos.some(p => p.id !== id && p.nome.toLowerCase() === novoNome.toLowerCase());
  if (jaExiste) { alert('Já existe outro produto com este nome na tabela!'); return; }

  const prodIndex = novosDescontos.findIndex(p => p.id === id);
  
  if (prodIndex > -1) {
    novosDescontos[prodIndex].nome = novoNome;
    novosDescontos[prodIndex].desconto = parseFloat(prazoEl.value) || 0;
    novosDescontos[prodIndex].descontoVista = parseFloat(vistaEl.value) || 0;
    novosDescontos[prodIndex].status = 'aprovado';
    novosDescontos[prodIndex].valorAntigo = null;

    try {
      await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos, ultimaAtualizacao: new Date().toISOString() });
      alert('Produto atualizado com sucesso!');
    } catch (erro) { alert("Erro ao gravar: " + erro.message); }
  }
};

window.aprovarProduto = async function(id) {
  if (perfilAtivo !== 'admin') return;
  const novosDescontos = [...clienteAtual.descontos];
  const prod = novosDescontos.find(p => p.id === id);
  if (prod) {
    prod.status = 'aprovado'; prod.valorAntigo = null;
    await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos, ultimaAtualizacao: new Date().toISOString() });
  }
};

window.aprovarTodosProdutos = async function() {
  if (perfilAtivo !== 'admin') return;
  if (!clienteAtual || !clienteAtual.descontos) return;

  if (confirm(`Aprovar todas as sugestões pendentes do cliente "${clienteAtual.razao}" de uma só vez?`)) {
    const novosDescontos = clienteAtual.descontos.map(p => {
      if (p.status === 'pendente') {
        return { ...p, status: 'aprovado', valorAntigo: null };
      }
      return p;
    });
    
    try {
      await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos, ultimaAtualizacao: new Date().toISOString() });
      alert('Todos os produtos foram aprovados!');
    } catch (erro) {
      alert("Erro ao aprovar em lote: " + erro.message);
    }
  }
};

window.rejeitarProduto = async function(id) {
  if (perfilAtivo !== 'admin') return;
  const novosDescontos = [...clienteAtual.descontos];
  const filtrados = novosDescontos.filter(p => p.id !== id);
  await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: filtrados, ultimaAtualizacao: new Date().toISOString() });
};

window.excluirProduto = async function(id) {
  if (perfilAtivo !== 'admin') return;
  if (confirm('Remover este produto?')) {
    const novosDescontos = clienteAtual.descontos.filter(p => p.id !== id);
    await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos, ultimaAtualizacao: new Date().toISOString() });
  }
};

window.excluirTodosProdutos = async function() {
  if (perfilAtivo !== 'admin' || !clienteAtual) return;
  if (confirm(`Tem a certeza que deseja apagar TODOS os produtos da tabela do cliente "${clienteAtual.razao}"?`)) {
    try {
      await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: [], ultimaAtualizacao: new Date().toISOString() });
      alert('Tabela limpa com sucesso.');
    } catch (error) { alert("Erro ao excluir: " + error.message); }
  }
};

// ==================== EXPORTAÇÃO PARA EXCEL ====================
window.exportarExcel = function() {
  if (!clienteAtual || !clienteAtual.descontos || clienteAtual.descontos.length === 0) {
    alert('Não há produtos cadastrados para exportar nesta tabela.');
    return;
  }
  
  const nomeCol1 = clienteAtual.coluna1 || 'Desc. Prazo (%)';
  const nomeCol2 = clienteAtual.coluna2 || 'Desc. Vista (%)';

  const dadosExportacao = clienteAtual.descontos.map(p => ({
    'Produto / Referência': p.nome,
    [nomeCol1]: p.desconto !== null ? Number(p.desconto).toFixed(2) : '0.00',
    [nomeCol2]: p.descontoVista !== null ? Number(p.descontoVista).toFixed(2) : '0.00',
    'Status no Sistema': p.status === 'aprovado' ? 'Aprovado' : 'Pendente (Aguardando Aprovação)'
  }));

  const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tabela de Preços");
  
  const nomeArquivo = `Tabela_${clienteAtual.razao.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '')}.xlsx`;
  XLSX.writeFile(workbook, nomeArquivo);
};

// ==================== IMPORTAÇÃO DE EXCEL ====================
window.processarExcel = async function(event) {
  if (perfilAtivo !== 'admin') return;
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet);
      
      if (json.length === 0) { alert("O ficheiro Excel está vazio."); event.target.value = ''; return; }

      let adicionados = 0;
      const novosDescontos = [...(clienteAtual.descontos || [])];

      json.forEach((linha, index) => {
        const chaves = Object.keys(linha);
        let nomeProduto = null; let valorPrazo = 0; let valorVista = 0;
        let col1Detectada = null; let col2Detectada = null;

        chaves.forEach((chave) => {
          const chaveLower = chave.toLowerCase().trim();
          if (chaveLower.includes('produto') || chaveLower.includes('referencia') || chaveLower.includes('nome')) {
            nomeProduto = String(linha[chave]).trim();
          } else {
            if (!col1Detectada) { col1Detectada = chave; valorPrazo = parseFloat(linha[chave]) || 0; }
            else if (!col2Detectada) { col2Detectada = chave; valorVista = parseFloat(linha[chave]) || 0; }
          }
        });

        if (valorPrazo > 0 && valorPrazo <= 1) valorPrazo = valorPrazo * 100;
        if (valorVista > 0 && valorVista <= 1) valorVista = valorVista * 100;

        if (nomeProduto) {
          const jaExiste = novosDescontos.some(p => p.nome.toLowerCase() === nomeProduto.toLowerCase());
          if (!jaExiste) {
            novosDescontos.push({
              id: Date.now() + index,
              nome: nomeProduto,
              desconto: Number(valorPrazo.toFixed(2)),
              descontoVista: Number(valorVista.toFixed(2)),
              status: 'aprovado',
              valorAntigo: null
            });
            adicionados++;
          }
        }
      });

      if (adicionados > 0) {
        await setDoc(doc(db, "clientes", clienteAtual.id), { ...clienteAtual, descontos: novosDescontos, ultimaAtualizacao: new Date().toISOString() });
        alert(`Importação concluída! ${adicionados} produtos adicionados.`);
      } else {
        alert("Nenhum produto novo encontrado ou todos já estavam cadastrados.");
      }
    } catch (erro) { alert("Erro ao processar o Excel: " + erro.message); }
    event.target.value = '';
  };
  reader.readAsArrayBuffer(file);
};
