// Elementos globais
const navLinks = {
    dashboard: document.getElementById('nav-dashboard'),
    transacoes: document.getElementById('nav-transacoes'),
    categorias: document.getElementById('nav-categorias'),
    importexport: document.getElementById('nav-importexport'),
    db: document.getElementById('nav-db')
  };
  
  const sections = {
    dashboard: document.getElementById('section-dashboard'),
    transacoes: document.getElementById('section-transacoes'),
    categorias: document.getElementById('section-categorias'),
    importexport: document.getElementById('section-importexport'),
    db: document.getElementById('section-db')
  };
  
  // Modais
  const modalTransacao = new bootstrap.Modal(document.getElementById('modal-transacao'));
  const modalCategoria = new bootstrap.Modal(document.getElementById('modal-categoria'));
  
  // Estado da aplicação
  const appState = {
    categorias: [],
    transacaoAtual: null,
    categoriaAtual: null
  };
  
  // Formatadores
  const formatadores = {
    moeda: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    data: new Intl.DateTimeFormat('pt-BR')
  };
  
  // ==================
  // Funções de inicialização
  // ==================
  
  // Inicializa a aplicação
  async function init() {
    // Carregar categorias
    await carregarCategorias();
    
    // Inicializar eventos
    setupEventListeners();
    
    // Carregar dashboard inicial
    carregarDashboard();
  }
  
  // Configura os eventos
  function setupEventListeners() {
    // Navegação
    for (const [key, link] of Object.entries(navLinks)) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        mostrarSecao(key);
      });
    }
    
    // Transações
    document.getElementById('btn-nova-transacao').addEventListener('click', novaTransacao);
    document.getElementById('btn-salvar-transacao').addEventListener('click', salvarTransacao);
    document.getElementById('form-filtros').addEventListener('submit', (e) => {
      e.preventDefault();
      carregarTransacoes();
    });
    document.getElementById('btn-add-categoria').addEventListener('click', () => {
      appState.categoriaAtual = null;
      document.getElementById('modal-categoria-titulo').textContent = 'Nova Categoria';
      document.getElementById('form-categoria').reset();
      document.getElementById('categoria-id').value = '';
      modalCategoria.show();
    });
    
    // Categorias
    document.getElementById('btn-nova-categoria').addEventListener('click', novaCategoria);
    document.getElementById('btn-salvar-categoria').addEventListener('click', salvarCategoria);
    
    // Importação/Exportação
    document.getElementById('arquivo-importacao').addEventListener('change', prepararMapeamento);
    document.getElementById('form-importar').addEventListener('submit', importarTransacoes);
    document.getElementById('form-exportar').addEventListener('submit', exportarTransacoes);
    
    // Acesso ao Banco
    document.getElementById('form-sql').addEventListener('submit', executarSQL);
  }
  
  // Mostra uma seção e esconde as outras
  function mostrarSecao(secao) {
    // Atualizar navegação
    for (const [key, link] of Object.entries(navLinks)) {
      link.classList.toggle('active', key === secao);
    }
    
    // Mostrar/esconder seções
    for (const [key, element] of Object.entries(sections)) {
      element.classList.toggle('d-none', key !== secao);
    }
    
    // Carregar conteúdo específico da seção
    switch(secao) {
      case 'dashboard':
        carregarDashboard();
        break;
      case 'transacoes':
        carregarTransacoes();
        break;
      case 'categorias':
        carregarListaCategorias();
        break;
      case 'importexport':
        prepararImportExport();
        break;
    }
  }
  
  // ==================
  // Funções do Dashboard
  // ==================
  
  // Carrega os dados do dashboard
  async function carregarDashboard() {
    try {
      // Carregar resumo de transações
      const response = await fetch('/api/transacoes');
      const data = await response.json();
      
      // Atualizar contadores
      document.getElementById('saldo-atual').textContent = formatadores.moeda.format(data.totais.saldo);
      document.getElementById('total-entradas').textContent = formatadores.moeda.format(data.totais.entradas);
      document.getElementById('total-saidas').textContent = formatadores.moeda.format(data.totais.saidas);
      
      // Carregar gráficos
      carregarGraficoFluxo();
      carregarGraficoCategorias();
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      alert('Erro ao carregar dashboard. Veja o console para mais detalhes.');
    }
  }
  
  // Carrega o gráfico de fluxo de caixa
  async function carregarGraficoFluxo() {
    try {
      // Definir período dos últimos 6 meses
      const hoje = new Date();
      const dataFim = hoje.toISOString().split('T')[0];
      
      const dataInicio = new Date();
      dataInicio.setMonth(hoje.getMonth() - 5);
      dataInicio.setDate(1);
      
      const inicio = dataInicio.toISOString().split('T')[0];
      
      // Buscar dados para o gráfico
      const response = await fetch(`/api/transacoes/resumo?dataInicio=${inicio}&dataFim=${dataFim}`);
      const data = await response.json();
      
      // Preparar dados para o gráfico
      const labels = [];
      const entradas = [];
      const saidas = [];
      const saldos = [];
      
      // Se não tiver dados, usar dados zerados para 6 meses
      if (data.length === 0) {
        for (let i = 0; i < 6; i++) {
          const mes = new Date();
          mes.setMonth(hoje.getMonth() - 5 + i);
          
          labels.push(mes.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }));
          entradas.push(0);
          saidas.push(0);
          saldos.push(0);
        }
      } else {
        data.forEach(item => {
          const [ano, mes] = item.periodo.split('-');
          const data = new Date(ano, mes - 1);
          
          labels.push(data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }));
          entradas.push(item.total_entradas);
          saidas.push(item.total_saidas);
          saldos.push(item.saldo);
        });
      }
      
      // Criar gráfico
      const ctx = document.getElementById('chart-fluxo').getContext('2d');
      
      if (window.chartFluxo) {
        window.chartFluxo.destroy();
      }
      
      window.chartFluxo = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Entradas',
              data: entradas,
              backgroundColor: 'rgba(40, 167, 69, 0.7)',
            },
            {
              label: 'Saídas',
              data: saidas,
              backgroundColor: 'rgba(220, 53, 69, 0.7)',
            },
            {
              label: 'Saldo',
              data: saldos,
              type: 'line',
              borderColor: 'rgba(0, 123, 255, 1)',
              backgroundColor: 'rgba(0, 123, 255, 0.1)',
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Erro ao carregar gráfico de fluxo:', error);
    }
  }
  
  // Carrega o gráfico de categorias
  async function carregarGraficoCategorias() {
    try {
      // Buscar dados das últimas transações por categoria
      const response = await fetch('/api/transacoes');
      const { transacoes } = await response.json();
      
      // Agrupar por categoria
      const categorias = {};
      
      transacoes.forEach(transacao => {
        const categoria = transacao.categoria_nome || 'Sem Categoria';
        
        if (!categorias[categoria]) {
          categorias[categoria] = {
            entradas: 0,
            saidas: 0,
            cor: transacao.cor_hex || '#666666'
          };
        }
        
        if (transacao.tipo === 'ENTRADA') {
          categorias[categoria].entradas += transacao.valor;
        } else {
          categorias[categoria].saidas += transacao.valor;
        }
      });
      
      // Preparar dados para o gráfico
      const labels = [];
      const valores = [];
      const cores = [];
      
      // Usar apenas as 5 maiores categorias de saída
      const categoriasList = Object.entries(categorias)
        .map(([nome, dados]) => ({ nome, valor: dados.saidas, cor: dados.cor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);
      
      categoriasList.forEach(cat => {
        labels.push(cat.nome);
        valores.push(cat.valor);
        cores.push(cat.cor);
      });
      
      // Criar gráfico
      const ctx = document.getElementById('chart-categorias').getContext('2d');
      
      if (window.chartCategorias) {
        window.chartCategorias.destroy();
      }
      
      window.chartCategorias = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: valores,
            backgroundColor: cores,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    } catch (error) {
      console.error('Erro ao carregar gráfico de categorias:', error);
    }
  }
  
  // ==================
  // Funções de Transações
  // ==================
  
  // Carrega a lista de transações
  async function carregarTransacoes() {
    try {
      // Obter filtros
      const dataInicio = document.getElementById('filtro-data-inicio').value;
      const dataFim = document.getElementById('filtro-data-fim').value;
      const categoria = document.getElementById('filtro-categoria').value;
      const tipo = document.getElementById('filtro-tipo').value;
      const busca = document.getElementById('filtro-busca').value;
      
      // Construir URL com filtros
      let url = '/api/transacoes?';
      const params = [];
      
      if (dataInicio) params.push(`dataInicio=${dataInicio}`);
      if (dataFim) params.push(`dataFim=${dataFim}`);
      if (categoria) params.push(`categoria_id=${categoria}`);
      if (tipo) params.push(`tipo=${tipo}`);
      if (busca) params.push(`busca=${encodeURIComponent(busca)}`);
      
      url += params.join('&');
      
      // Buscar transações
      const response = await fetch(url);
      const data = await response.json();
      
      // Atualizar resumo
      document.getElementById('resumo-entradas').textContent = `Entradas: ${formatadores.moeda.format(data.totais.entradas)}`;
      document.getElementById('resumo-saidas').textContent = `Saídas: ${formatadores.moeda.format(data.totais.saidas)}`;
      document.getElementById('resumo-saldo').textContent = `Saldo: ${formatadores.moeda.format(data.totais.saldo)}`;
      
      // Limpar tabela
      const tbody = document.getElementById('tabela-transacoes');
      tbody.innerHTML = '';
      
      // Verificar se existem transações
      if (data.transacoes.length === 0) {
        document.getElementById('transacoes-vazio').classList.remove('d-none');
        return;
      }
      
      document.getElementById('transacoes-vazio').classList.add('d-none');
      
      // Preencher tabela
      data.transacoes.forEach(transacao => {
        const row = document.createElement('tr');
        
        // Formatar data
        const data = new Date(transacao.data);
        const dataFormatada = formatadores.data.format(data);
        
        // Formatar valor
        const valorFormatado = formatadores.moeda.format(transacao.valor);
        
        // Contagem de anexos
        let anexosBadge = '';
        if (transacao.anexos_count && transacao.anexos_count > 0) {
          anexosBadge = `<span class="badge bg-primary anexo-badge">${transacao.anexos_count}</span>`;
        }
        
        row.innerHTML = `
          <td>${dataFormatada}</td>
          <td>${transacao.descricao}</td>
          <td>
            <span class="categoria-cor" style="background-color: ${transacao.cor_hex || '#666666'}"></span>
            ${transacao.categoria_nome || 'Sem categoria'}
          </td>
          <td class="${transacao.tipo === 'ENTRADA' ? 'text-success' : 'text-danger'}">
            ${transacao.tipo === 'ENTRADA' ? '+' : '-'}${valorFormatado}
          </td>
          <td>${anexosBadge}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-primary editar-transacao" data-id="${transacao.id}">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger excluir-transacao" data-id="${transacao.id}">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        `;
        
        // Adicionar eventos aos botões
        const btnEditar = row.querySelector('.editar-transacao');
        btnEditar.addEventListener('click', () => editarTransacao(transacao.id));
        
        const btnExcluir = row.querySelector('.excluir-transacao');
        btnExcluir.addEventListener('click', () => excluirTransacao(transacao.id));
        
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      alert('Erro ao carregar transações. Veja o console para mais detalhes.');
    }
  }
  
  // Prepara o modal para nova transação
  function novaTransacao() {
    // Limpar formulário
    document.getElementById('form-transacao').reset();
    document.getElementById('transacao-id').value = '';
    document.getElementById('anexos-container').classList.add('d-none');
    
    // Preencher select de categorias
    preencherSelectCategorias();
    
    // Definir data atual
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('transacao-data').value = hoje;
    
    // Atualizar título
    document.getElementById('modal-transacao-titulo').textContent = 'Nova Transação';
    
    // Resetar estado
    appState.transacaoAtual = null;
    
    // Mostrar modal
    modalTransacao.show();
  }
  
  // Carrega os dados de uma transação para edição
  async function editarTransacao(id) {
    try {
      // Buscar transação
      const response = await fetch(`/api/transacoes/${id}`);
      const transacao = await response.json();
      
      // Salvar no estado
      appState.transacaoAtual = transacao;
      
      // Preencher formulário
      document.getElementById('transacao-id').value = transacao.id;
      document.getElementById('transacao-descricao').value = transacao.descricao;
      document.getElementById('transacao-valor').value = transacao.valor;
      document.getElementById('transacao-data').value = transacao.data;
      document.getElementById('transacao-tipo').value = transacao.tipo;
      document.getElementById('transacao-categoria').value = transacao.categoria_id || '';
      document.getElementById('transacao-notas').value = transacao.notas || '';
      
      // Preencher select de categorias
      preencherSelectCategorias(transacao.categoria_id);
      
      // Verificar se existem anexos
      if (transacao.anexos && transacao.anexos.length > 0) {
        document.getElementById('anexos-container').classList.remove('d-none');
        
        const listaAnexos = document.getElementById('lista-anexos');
        listaAnexos.innerHTML = '';
        
        transacao.anexos.forEach(anexo => {
          const item = document.createElement('div');
          item.className = 'list-group-item d-flex justify-content-between align-items-center';
          item.innerHTML = `
            <a href="${anexo.url}" target="_blank">${anexo.nome_arquivo}</a>
            <button type="button" class="btn btn-sm btn-danger excluir-anexo" data-id="${anexo.id}">
              <i class="bi bi-trash"></i>
            </button>
          `;
          
          // Adicionar evento ao botão de excluir
          const btnExcluir = item.querySelector('.excluir-anexo');
          btnExcluir.addEventListener('click', () => excluirAnexo(anexo.id));
          
          listaAnexos.appendChild(item);
        });
      } else {
        document.getElementById('anexos-container').classList.add('d-none');
      }
      
      // Atualizar título
      document.getElementById('modal-transacao-titulo').textContent = 'Editar Transação';
      
      // Mostrar modal
      modalTransacao.show();
    } catch (error) {
      console.error('Erro ao carregar transação:', error);
      alert('Erro ao carregar transação. Veja o console para mais detalhes.');
    }
  }
  
  // Salva os dados da transação
  async function salvarTransacao() {
    try {
      // Obter dados do formulário
      const id = document.getElementById('transacao-id').value;
      const descricao = document.getElementById('transacao-descricao').value;
      const valor = parseFloat(document.getElementById('transacao-valor').value);
      const data = document.getElementById('transacao-data').value;
      const tipo = document.getElementById('transacao-tipo').value;
      const categoria_id = document.getElementById('transacao-categoria').value || null;
      const notas = document.getElementById('transacao-notas').value;
      
      // Validar dados
      if (!descricao || isNaN(valor) || !data || !tipo) {
        alert('Preencha os campos obrigatórios.');
        return;
      }
      
      // Criar objeto da transação
      const transacao = {
        descricao,
        valor,
        data,
        tipo,
        categoria_id,
        notas
      };
      
      let response;
      
      // Criar ou atualizar
      if (id) {
        response = await fetch(`/api/transacoes/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(transacao)
        });
      } else {
        response = await fetch('/api/transacoes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(transacao)
        });
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar transação');
      }
      
      // Verificar se há anexo para upload
      const fileInput = document.getElementById('transacao-anexo');
      if (fileInput.files.length > 0) {
        await uploadAnexo(fileInput.files[0], result.id || id);
      }
      
      // Fechar modal e recarregar lista
      modalTransacao.hide();
      carregarTransacoes();
      
      // Atualizar dashboard também
      carregarDashboard();
      
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      alert('Erro ao salvar transação. Veja o console para mais detalhes.');
    }
  }
  
  // Exclui uma transação
  async function excluirTransacao(id) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/transacoes/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erro ao excluir transação');
      }
      
      // Recarregar lista
      carregarTransacoes();
      
      // Atualizar dashboard também
      carregarDashboard();
      
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      alert('Erro ao excluir transação. Veja o console para mais detalhes.');
    }
  }
  
  // Faz upload de um anexo
  async function uploadAnexo(file, transacaoId) {
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('transacao_id', transacaoId);
      
      const response = await fetch('/api/anexos/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erro ao fazer upload do anexo');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao fazer upload do anexo:', error);
      throw error;
    }
  }
  
  // Exclui um anexo
  async function excluirAnexo(id) {
    if (!confirm('Tem certeza que deseja excluir este anexo?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/anexos/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erro ao excluir anexo');
      }
      
      // Recarregar transação para atualizar lista de anexos
      if (appState.transacaoAtual) {
        await editarTransacao(appState.transacaoAtual.id);
      }
      
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      alert('Erro ao excluir anexo. Veja o console para mais detalhes.');
    }
  }
  
  // ==================
  // Funções de Categorias
  // ==================
  
  // Carrega as categorias
  async function carregarCategorias() {
    try {
      const response = await fetch('/api/categorias');
      const categorias = await response.json();
      
      // Salvar no estado
      appState.categorias = categorias;
      
      return categorias;
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      return [];
    }
  }
  
  // Preenche o select de categorias
  function preencherSelectCategorias(categoriaId = null) {
    const select = document.getElementById('transacao-categoria');
    const exportSelect = document.getElementById('export-categoria');
    const filtroSelect = document.getElementById('filtro-categoria');
    
    // Limpar selects
    select.innerHTML = '<option value="">Selecione...</option>';
    
    if (exportSelect) {
      exportSelect.innerHTML = '<option value="">Todas as categorias</option>';
    }
    
    if (filtroSelect) {
      filtroSelect.innerHTML = '<option value="">Todas</option>';
    }
    
    // Preencher com categorias
    appState.categorias.forEach(categoria => {
      const option = document.createElement('option');
      option.value = categoria.id;
      option.textContent = categoria.nome;
      option.selected = categoria.id == categoriaId;
      select.appendChild(option);
      
      if (exportSelect) {
        const exportOption = option.cloneNode(true);
        exportOption.selected = false;
        exportSelect.appendChild(exportOption);
      }
      
      if (filtroSelect) {
        const filtroOption = option.cloneNode(true);
        filtroOption.selected = false;
        filtroSelect.appendChild(filtroOption);
      }
    });
  }
  
  // Prepara o modal para nova categoria
  function novaCategoria() {
    // Limpar formulário
    document.getElementById('form-categoria').reset();
    document.getElementById('categoria-id').value = '';
    
    // Definir cor padrão
    document.getElementById('categoria-cor').value = '#3498db';
    
    // Atualizar título
    document.getElementById('modal-categoria-titulo').textContent = 'Nova Categoria';
    
    // Resetar estado
    appState.categoriaAtual = null;
    
    // Mostrar modal
    modalCategoria.show();
  }
  
  // Carrega os dados de uma categoria para edição
  async function editarCategoria(id) {
    try {
      // Buscar categoria
      const categoria = appState.categorias.find(c => c.id == id);
      
      if (!categoria) {
        throw new Error('Categoria não encontrada');
      }
      
      // Salvar no estado
      appState.categoriaAtual = categoria;
      
      // Preencher formulário
      document.getElementById('categoria-id').value = categoria.id;
      document.getElementById('categoria-nome').value = categoria.nome;
      document.getElementById('categoria-cor').value = categoria.cor_hex || '#3498db';
      
      // Atualizar título
      document.getElementById('modal-categoria-titulo').textContent = 'Editar Categoria';
      
      // Mostrar modal
      modalCategoria.show();
    } catch (error) {
      console.error('Erro ao carregar categoria:', error);
      alert('Erro ao carregar categoria. Veja o console para mais detalhes.');
    }
  }
  
  // Salva os dados da categoria
  async function salvarCategoria() {
    try {
      // Obter dados do formulário
      const id = document.getElementById('categoria-id').value;
      const nome = document.getElementById('categoria-nome').value;
      const cor_hex = document.getElementById('categoria-cor').value;
      
      // Validar dados
      if (!nome) {
        alert('Nome da categoria é obrigatório.');
        return;
      }
      
      // Criar objeto da categoria
      const categoria = {
        nome,
        cor_hex,
        usuario_id: 1 // Em um app real, viria do usuário logado
      };
      
      let response;
      
      // Criar ou atualizar
      if (id) {
        response = await fetch(`/api/categorias/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(categoria)
        });
      } else {
        response = await fetch('/api/categorias', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(categoria)
        });
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar categoria');
      }
      
      // Fechar modal e recarregar lista
      modalCategoria.hide();
      
      // Recarregar categorias
      await carregarCategorias();
      
      // Recarregar lista
      carregarListaCategorias();
      
      // Atualizar selects
      preencherSelectCategorias();
      
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      alert('Erro ao salvar categoria. Veja o console para mais detalhes.');
    }
  }
  
  // Carrega a lista de categorias
  async function carregarListaCategorias() {
    try {
      // Recarregar categorias
      const categorias = await carregarCategorias();
      
      // Limpar tabela
      const tbody = document.getElementById('tabela-categorias');
      tbody.innerHTML = '';
      
      // Verificar se existem categorias
      if (categorias.length === 0) {
        document.getElementById('categorias-vazio').classList.remove('d-none');
        return;
      }
      
      document.getElementById('categorias-vazio').classList.add('d-none');
      
      // Preencher tabela
      categorias.forEach(categoria => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
          <td>
            <span class="categoria-cor" style="background-color: ${categoria.cor_hex || '#666666'}"></span>
          </td>
          <td>${categoria.nome}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-primary editar-categoria" data-id="${categoria.id}">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger excluir-categoria" data-id="${categoria.id}">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        `;
        
        // Adicionar eventos aos botões
        const btnEditar = row.querySelector('.editar-categoria');
        btnEditar.addEventListener('click', () => editarCategoria(categoria.id));
        
        const btnExcluir = row.querySelector('.excluir-categoria');
        btnExcluir.addEventListener('click', () => excluirCategoria(categoria.id));
        
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      alert('Erro ao carregar categorias. Veja o console para mais detalhes.');
    }
  }
  
  // Exclui uma categoria
  async function excluirCategoria(id) {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/categorias/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erro ao excluir categoria');
      }
      
      // Recarregar categorias
      await carregarCategorias();
      
      // Recarregar lista
      carregarListaCategorias();
      
      // Atualizar selects
      preencherSelectCategorias();
      
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      alert('Erro ao excluir categoria. Veja o console para mais detalhes.');
    }
  }
  
  // ==================
  // Funções de Importação/Exportação
  // ==================
  
  // Prepara a tela de importação/exportação
  function prepararImportExport() {
    // Preencher selects com categorias
    preencherSelectCategorias();
  }
  
  // Prepara o mapeamento de colunas para importação
  function prepararMapeamento(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Verificar extensão
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    if (fileExt !== 'xlsx' && fileExt !== 'xls' && fileExt !== 'csv') {
      alert('Formato de arquivo não suportado. Use Excel (.xlsx, .xls) ou CSV.');
      event.target.value = '';
      return;
    }
    
    // Mostrar área de mapeamento
    document.getElementById('mapeamento-container').classList.remove('d-none');
    
    // Aqui, em uma aplicação real, faríamos uma leitura preliminar do arquivo
    // para detectar automaticamente as colunas. Para simplificar, usaremos campos fixos.
    
    const camposMapeamento = document.getElementById('campos-mapeamento');
    camposMapeamento.innerHTML = '';
    
    // Criar campos de mapeamento
    const campos = [
      { id: 'data', label: 'Data' },
      { id: 'descricao', label: 'Descrição' },
      { id: 'valor', label: 'Valor' },
      { id: 'tipo', label: 'Tipo (opcional)' },
      { id: 'categoria', label: 'Categoria (opcional)' },
      { id: 'notas', label: 'Notas (opcional)' }
    ];
    
    campos.forEach((campo, index) => {
      const colDiv = document.createElement('div');
      colDiv.className = 'col-md-6 mb-2';
      
      colDiv.innerHTML = `
        <label class="form-label">${campo.label}</label>
        <select class="form-select" id="mapeamento-${campo.id}">
          <option value="-1">Não mapear</option>
          <option value="0"${index === 0 ? ' selected' : ''}>Coluna A</option>
          <option value="1"${index === 1 ? ' selected' : ''}>Coluna B</option>
          <option value="2"${index === 2 ? ' selected' : ''}>Coluna C</option>
          <option value="3"${index === 3 ? ' selected' : ''}>Coluna D</option>
          <option value="4"${index === 4 ? ' selected' : ''}>Coluna E</option>
          <option value="5"${index === 5 ? ' selected' : ''}>Coluna F</option>
        </select>
      `;
      
      camposMapeamento.appendChild(colDiv);
    });
  }
  
  // Importa transações
  async function importarTransacoes(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('arquivo-importacao');
    
    if (!fileInput.files.length) {
      alert('Selecione um arquivo para importar.');
      return;
    }
    
    try {
      // Obter mapeamento
      const mapeamento = {
        descricao: parseInt(document.getElementById('mapeamento-descricao').value),
        valor: parseInt(document.getElementById('mapeamento-valor').value),
        data: parseInt(document.getElementById('mapeamento-data').value),
        tipo: parseInt(document.getElementById('mapeamento-tipo').value),
        categoria: parseInt(document.getElementById('mapeamento-categoria').value),
        notas: parseInt(document.getElementById('mapeamento-notas').value)
      };
      
      // Validar campos obrigatórios
      if (mapeamento.descricao === -1 || mapeamento.valor === -1 || mapeamento.data === -1) {
        alert('Os campos Data, Descrição e Valor são obrigatórios.');
        return;
      }
      
      // Criar FormData
      const formData = new FormData();
      formData.append('arquivo', fileInput.files[0]);
      formData.append('mapeamento', JSON.stringify(mapeamento));
      formData.append('usuario_id', 1); // Em um app real, viria do usuário logado
      
      // Mostrar loading
      const btnImportar = document.getElementById('btn-importar');
      const textoBotaoOriginal = btnImportar.innerHTML;
      btnImportar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Importando...';
      btnImportar.disabled = true;
      
      // Enviar requisição
      const response = await fetch('/api/importar', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao importar transações');
      }
      
      // Mostrar resultado
      const resultadoDiv = document.getElementById('resultado-importacao');
      const resultadoTexto = document.getElementById('resultado-importacao-texto');
      
      resultadoTexto.innerHTML = `
        Importação concluída com sucesso.<br>
        ${result.sucessos} transações importadas.<br>
        ${result.falhas} erros encontrados.
      `;
      
      resultadoDiv.classList.remove('d-none');
      
      // Recarregar dados
      await carregarCategorias();
      carregarDashboard();
      
    } catch (error) {
      console.error('Erro ao importar transações:', error);
      alert('Erro ao importar transações. Veja o console para mais detalhes.');
    } finally {
      // Restaurar botão
      const btnImportar = document.getElementById('btn-importar');
      btnImportar.innerHTML = '<i class="bi bi-upload"></i> Importar';
      btnImportar.disabled = false;
    }
  }
  
  // Exporta transações
  async function exportarTransacoes(event) {
    event.preventDefault();
    
    try {
      // Obter filtros
      const dataInicio = document.getElementById('export-data-inicio').value;
      const dataFim = document.getElementById('export-data-fim').value;
      const categoria = document.getElementById('export-categoria').value;
      const tipo = document.getElementById('export-tipo').value;
      
      // Obter colunas selecionadas
      const colunas = [];
      document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        colunas.push(checkbox.value);
      });
      
      if (colunas.length === 0) {
        alert('Selecione pelo menos uma coluna para exportar.');
        return;
      }
      
      // Criar filtros
      const filtros = {
        dataInicio,
        dataFim,
        categoria_id: categoria,
        tipo
      };
      
      // Mostrar loading
      const btnExportar = document.getElementById('btn-exportar');
      const textoBotaoOriginal = btnExportar.innerHTML;
      btnExportar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Exportando...';
      btnExportar.disabled = true;
      
      // Enviar requisição
      const response = await fetch('/api/exportar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filtros,
          colunas
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao exportar transações');
      }
      
      // Mostrar resultado
      const resultadoDiv = document.getElementById('resultado-exportacao');
      const resultadoTexto = document.getElementById('resultado-exportacao-texto');
      const linkDownload = document.getElementById('link-download');
      
      resultadoTexto.textContent = `${result.totalExportado} transações exportadas.`;
      linkDownload.href = result.file;
      
      resultadoDiv.classList.remove('d-none');
      
    } catch (error) {
      console.error('Erro ao exportar transações:', error);
      alert('Erro ao exportar transações. Veja o console para mais detalhes.');
    } finally {
      // Restaurar botão
      const btnExportar = document.getElementById('btn-exportar');
      btnExportar.innerHTML = '<i class="bi bi-download"></i> Exportar';
      btnExportar.disabled = false;
    }
  }
  
  // ==================
  // Funções do Banco de Dados
  // ==================
  
  // Executa uma consulta SQL
  async function executarSQL(event) {
    event.preventDefault();
    
    const sql = document.getElementById('sql-query').value;
    
    if (!sql) {
      alert('Digite uma consulta SQL.');
      return;
    }
    
    try {
      // Executar consulta
      const response = await fetch('/api/db/consulta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao executar SQL');
      }
      
      // Mostrar resultado
      const resultadoDiv = document.getElementById('sql-result');
      
      if (result.rows) {
        // Resultado de SELECT
        let html = `<p class="text-success">${result.rowCount} registro(s) encontrado(s).</p>`;
        
        if (result.rows.length > 0) {
          html += '<div class="table-responsive"><table class="table table-sm table-striped">';
          
          // Cabeçalho
          html += '<thead><tr>';
          for (const key of Object.keys(result.rows[0])) {
            html += `<th>${key}</th>`;
          }
          html += '</tr></thead>';
          
          // Linhas
          html += '<tbody>';
          for (const row of result.rows) {
            html += '<tr>';
            for (const value of Object.values(row)) {
              html += `<td>${value !== null ? value : '<em>null</em>'}</td>`;
            }
            html += '</tr>';
          }
          html += '</tbody></table></div>';
        }
        
        resultadoDiv.innerHTML = html;
      } else {
        // Resultado de INSERT, UPDATE, DELETE
        resultadoDiv.innerHTML = `
          <p class="text-success">Operação executada com sucesso.</p>
          <p>${result.changes || 0} registro(s) afetado(s).</p>
        `;
      }
    } catch (error) {
      console.error('Erro ao executar SQL:', error);
      
      // Mostrar erro
      const resultadoDiv = document.getElementById('sql-result');
      resultadoDiv.innerHTML = `
        <div class="alert alert-danger">
          <h6>Erro ao executar SQL</h6>
          <p>${error.message}</p>
        </div>
      `;
    }
  }
  
  // Inicializar aplicação quando o DOM estiver pronto
  document.addEventListener('DOMContentLoaded', init);