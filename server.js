// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bodyParser = require('body-parser');

// Importar modelos
const Categoria = require('./src/models/categoria');
const Transacao = require('./src/models/transacao');
const ImportExport = require('./src/utils/importExport');

// Inicializar app Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar banco de dados
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
        process.exit(1);
    }
    console.log('Conectado ao banco de dados SQLite.');
    
    // Habilitar chaves estrangeiras
    db.run('PRAGMA foreign_keys = ON');
    
    // Inicializar banco de dados
    inicializarBancoDados();
});

// Configurar multer para upload de arquivos
const upload = multer({ 
    dest: path.join(__dirname, 'temp/uploads/'),
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB
});

// Inicializar tabelas do banco de dados
function inicializarBancoDados() {
    db.serialize(() => {
        // Criar tabela de categorias
        db.run(`CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            descricao TEXT
        )`);
        
        // Criar tabela de transações
        db.run(`CREATE TABLE IF NOT EXISTS transacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            descricao TEXT,
            valor REAL NOT NULL,
            tipo TEXT NOT NULL,
            categoria_id INTEGER,
            FOREIGN KEY (categoria_id) REFERENCES categorias (id)
        )`);
    });
}

// Rotas para a aplicação web
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Endpoints

// Endpoints para Categorias
app.get('/api/categorias', async (req, res) => {
    try {
        const categoriaModel = new Categoria(db);
        const categorias = await categoriaModel.listar();
        res.json(categorias);
    } catch (erro) {
        console.error('Erro ao listar categorias:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.get('/api/categorias/:id', async (req, res) => {
    try {
        const categoriaModel = new Categoria(db);
        const categoria = await categoriaModel.obterPorId(req.params.id);
        
        if (!categoria) {
            return res.status(404).json({ erro: 'Categoria não encontrada' });
        }
        
        res.json(categoria);
    } catch (erro) {
        console.error('Erro ao obter categoria:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.post('/api/categorias', async (req, res) => {
    try {
        const { nome, descricao } = req.body;
        
        if (!nome) {
            return res.status(400).json({ erro: 'Nome da categoria é obrigatório' });
        }
        
        const categoriaModel = new Categoria(db);
        const novaCategoria = await categoriaModel.criar({ nome, descricao });
        
        res.status(201).json(novaCategoria);
    } catch (erro) {
        console.error('Erro ao criar categoria:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.put('/api/categorias/:id', async (req, res) => {
    try {
        const { nome, descricao } = req.body;
        
        if (!nome) {
            return res.status(400).json({ erro: 'Nome da categoria é obrigatório' });
        }
        
        const categoriaModel = new Categoria(db);
        const categoriaAtualizada = await categoriaModel.atualizar(req.params.id, { nome, descricao });
        
        res.json(categoriaAtualizada);
    } catch (erro) {
        console.error('Erro ao atualizar categoria:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.delete('/api/categorias/:id', async (req, res) => {
    try {
        const categoriaModel = new Categoria(db);
        await categoriaModel.remover(req.params.id);
        
        res.json({ message: 'Categoria removida com sucesso' });
    } catch (erro) {
        console.error('Erro ao remover categoria:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

// Endpoints para Transações
app.get('/api/transacoes', async (req, res) => {
    try {
        const { tipo, dataInicio, dataFim, categoriaId, descricao } = req.query;
        
        const filtros = {};
        if (tipo) filtros.tipo = tipo;
        if (dataInicio) filtros.dataInicio = dataInicio;
        if (dataFim) filtros.dataFim = dataFim;
        if (categoriaId) filtros.categoriaId = categoriaId;
        if (descricao) filtros.descricao = descricao;
        
        const transacaoModel = new Transacao(db);
        const transacoes = await transacaoModel.listar(filtros);
        
        res.json(transacoes);
    } catch (erro) {
        console.error('Erro ao listar transações:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.get('/api/transacoes/:id', async (req, res) => {
    try {
        const transacaoModel = new Transacao(db);
        const transacao = await transacaoModel.obterPorId(req.params.id);
        
        if (!transacao) {
            return res.status(404).json({ erro: 'Transação não encontrada' });
        }
        
        res.json(transacao);
    } catch (erro) {
        console.error('Erro ao obter transação:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.post('/api/transacoes', async (req, res) => {
    try {
        const { data, descricao, valor, tipo, categoria_id } = req.body;
        
        if (!data || !valor || !tipo) {
            return res.status(400).json({ erro: 'Data, valor e tipo são obrigatórios' });
        }
        
        const transacaoModel = new Transacao(db);
        const novaTransacao = await transacaoModel.criar({
            data,
            descricao,
            valor,
            tipo,
            categoria_id
        });
        
        res.status(201).json(novaTransacao);
    } catch (erro) {
        console.error('Erro ao criar transação:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.put('/api/transacoes/:id', async (req, res) => {
    try {
        const { data, descricao, valor, tipo, categoria_id } = req.body;
        
        if (!data || !valor || !tipo) {
            return res.status(400).json({ erro: 'Data, valor e tipo são obrigatórios' });
        }
        
        const transacaoModel = new Transacao(db);
        const transacaoAtualizada = await transacaoModel.atualizar(req.params.id, {
            data,
            descricao,
            valor,
            tipo,
            categoria_id
        });
        
        res.json(transacaoAtualizada);
    } catch (erro) {
        console.error('Erro ao atualizar transação:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.delete('/api/transacoes/:id', async (req, res) => {
    try {
        const transacaoModel = new Transacao(db);
        await transacaoModel.remover(req.params.id);
        
        res.json({ message: 'Transação removida com sucesso' });
    } catch (erro) {
        console.error('Erro ao remover transação:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

// Endpoint para o dashboard
app.get('/api/dashboard', async (req, res) => {
    try {
        // Obter parâmetros de data (período)
        const dataInicio = req.query.dataInicio || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]; // 1º de janeiro do ano atual
        const dataFim = req.query.dataFim || new Date().toISOString().split('T')[0]; // Hoje
        
        // Buscar todas as transações no período
        const transacaoModel = new Transacao(db);
        const transacoes = await transacaoModel.listarPorPeriodo(dataInicio, dataFim);
        
        // Calcular totais
        const totalReceitas = transacoes
            .filter(t => t.tipo === 'receita')
            .reduce((soma, t) => soma + parseFloat(t.valor), 0);
            
        const totalDespesas = transacoes
            .filter(t => t.tipo === 'despesa')
            .reduce((soma, t) => soma + parseFloat(t.valor), 0);
            
        const saldo = totalReceitas - totalDespesas;
        
        // Buscar categorias
        const categoriaModel = new Categoria(db);
        const categorias = await categoriaModel.listar();
        
        // Mapear ID para nome de categoria
        const categoriasMap = {};
        categorias.forEach(cat => {
            categoriasMap[cat.id] = cat.nome;
        });
        
        // Agrupar por categoria
        const transacoesPorCategoria = [];
        const categoriaValores = {};
        
        transacoes.forEach(transacao => {
            const categoriaId = transacao.categoria_id || 0;
            const categoriaNome = transacao.categoria_id ? categoriasMap[transacao.categoria_id] : 'Sem Categoria';
            const valor = parseFloat(transacao.valor);
            
            if (!categoriaValores[categoriaId]) {
                categoriaValores[categoriaId] = {
                    categoria: categoriaNome,
                    valor: 0
                };
            }
            
            if (transacao.tipo === 'receita') {
                categoriaValores[categoriaId].valor += valor;
            } else {
                categoriaValores[categoriaId].valor -= valor;
            }
        });
        
        // Converter para array e ordenar por valor
        for (const id in categoriaValores) {
            transacoesPorCategoria.push(categoriaValores[id]);
        }
        
        transacoesPorCategoria.sort((a, b) => b.valor - a.valor);
        
        // Agrupar por mês
        const transacoesPorMes = [];
        const mesesValores = {};
        
        transacoes.forEach(transacao => {
            const mes = transacao.data.substring(0, 7); // YYYY-MM
            const valor = parseFloat(transacao.valor);
            
            if (!mesesValores[mes]) {
                mesesValores[mes] = {
                    mes,
                    valor: 0
                };
            }
            
            if (transacao.tipo === 'receita') {
                mesesValores[mes].valor += valor;
            } else {
                mesesValores[mes].valor -= valor;
            }
        });
        
        // Converter para array e ordenar por mês
        for (const mes in mesesValores) {
            transacoesPorMes.push(mesesValores[mes]);
        }
        
        transacoesPorMes.sort((a, b) => a.mes.localeCompare(b.mes));
        
        // Montar resposta no formato esperado pelo frontend
        const resposta = {
            resumo: {
                saldo,
                entradas: totalReceitas,
                saidas: totalDespesas
            },
            transacoesPorCategoria,
            transacoesPorMes
        };
        
        res.json(resposta);
    } catch (erro) {
        console.error('Erro ao gerar dashboard:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

// Endpoint para listar transações com resumo
app.get('/api/transacoes/lista', async (req, res) => {
    try {
        const { tipo, dataInicio, dataFim, categoriaId, descricao } = req.query;
        
        const filtros = {};
        if (tipo) filtros.tipo = tipo;
        if (dataInicio) filtros.dataInicio = dataInicio;
        if (dataFim) filtros.dataFim = dataFim;
        if (categoriaId) filtros.categoriaId = categoriaId;
        if (descricao) filtros.descricao = descricao;
        
        const transacaoModel = new Transacao(db);
        const transacoes = await transacaoModel.listar(filtros);
        
        // Calcular resumo
        const totalReceitas = transacoes
            .filter(t => t.tipo === 'receita')
            .reduce((soma, t) => soma + parseFloat(t.valor), 0);
            
        const totalDespesas = transacoes
            .filter(t => t.tipo === 'despesa')
            .reduce((soma, t) => soma + parseFloat(t.valor), 0);
            
        const saldo = totalReceitas - totalDespesas;
        
        // Montar resposta no formato esperado pelo frontend
        const resposta = {
            transacoes,
            resumo: {
                entradas: totalReceitas,
                saidas: totalDespesas,
                saldo
            }
        };
        
        res.json(resposta);
    } catch (erro) {
        console.error('Erro ao listar transações com resumo:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

// Endpoint para gerar resumo de transações por período
app.get('/api/transacoes/resumo', async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        
        // Validar parâmetros
        if (!dataInicio || !dataFim) {
            return res.status(400).json({ erro: 'As datas de início e fim são obrigatórias' });
        }
        
        // Formatar datas para o padrão YYYY-MM-DD
        const dataInicioFormatada = new Date(dataInicio).toISOString().split('T')[0];
        const dataFimFormatada = new Date(dataFim).toISOString().split('T')[0];
        
        // Obter todas as transações no período
        const transacaoModel = new Transacao(db);
        const transacoes = await transacaoModel.listarPorPeriodo(dataInicioFormatada, dataFimFormatada);
        
        // Calcular totais
        const totalReceitas = transacoes
            .filter(t => t.tipo === 'receita')
            .reduce((soma, t) => soma + parseFloat(t.valor), 0);
            
        const totalDespesas = transacoes
            .filter(t => t.tipo === 'despesa')
            .reduce((soma, t) => soma + parseFloat(t.valor), 0);
            
        const saldo = totalReceitas - totalDespesas;
        
        // Agrupar por categoria
        const categoriaModel = new Categoria(db);
        const categorias = await categoriaModel.listar();
        const categoriasMap = {};
        categorias.forEach(cat => {
            categoriasMap[cat.id] = cat.nome;
        });
        
        // Resumo por categoria
        const resumoPorCategoria = {};
        
        transacoes.forEach(transacao => {
            const categoriaId = transacao.categoria_id || 'sem_categoria';
            const categoriaNome = transacao.categoria_id ? categoriasMap[transacao.categoria_id] : 'Sem Categoria';
            
            if (!resumoPorCategoria[categoriaId]) {
                resumoPorCategoria[categoriaId] = {
                    nome: categoriaNome,
                    receitas: 0,
                    despesas: 0,
                    saldo: 0
                };
            }
            
            if (transacao.tipo === 'receita') {
                resumoPorCategoria[categoriaId].receitas += parseFloat(transacao.valor);
            } else {
                resumoPorCategoria[categoriaId].despesas += parseFloat(transacao.valor);
            }
            
            resumoPorCategoria[categoriaId].saldo = 
                resumoPorCategoria[categoriaId].receitas - resumoPorCategoria[categoriaId].despesas;
        });
        
        // Converter para array e ordenar por saldo
        const categoriasPorSaldo = Object.values(resumoPorCategoria)
            .sort((a, b) => b.saldo - a.saldo);
        
        // Resumo por mês (se o período abranger mais de um mês)
        const resumoPorMes = {};
        
        transacoes.forEach(transacao => {
            const mesAno = transacao.data.substring(0, 7); // YYYY-MM
            
            if (!resumoPorMes[mesAno]) {
                resumoPorMes[mesAno] = {
                    mes: mesAno,
                    receitas: 0,
                    despesas: 0,
                    saldo: 0
                };
            }
            
            if (transacao.tipo === 'receita') {
                resumoPorMes[mesAno].receitas += parseFloat(transacao.valor);
            } else {
                resumoPorMes[mesAno].despesas += parseFloat(transacao.valor);
            }
            
            resumoPorMes[mesAno].saldo = 
                resumoPorMes[mesAno].receitas - resumoPorMes[mesAno].despesas;
        });
        
        // Converter para array e ordenar por mês
        const mesesOrdenados = Object.values(resumoPorMes)
            .sort((a, b) => a.mes.localeCompare(b.mes));
        
        // Montar resposta
        const resumo = {
            periodo: {
                inicio: dataInicioFormatada,
                fim: dataFimFormatada
            },
            totais: {
                receitas: totalReceitas,
                despesas: totalDespesas,
                saldo: saldo
            },
            categorias: categoriasPorSaldo,
            meses: mesesOrdenados
        };
        
        res.json(resumo);
    } catch (erro) {
        console.error('Erro ao gerar resumo de transações:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

// Endpoint para importação de transações
app.post('/api/importar', upload.single('arquivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
        }

        const importExport = new ImportExport();
        
        try {
            // Tentar importar as transações
            const transacoes = await importExport.importarTransacoes(req.file.path);
            console.log(`Importação: ${transacoes.length} transações encontradas no arquivo.`);
            
            // Contador de transações importadas com sucesso
            let transacoesImportadas = 0;
            const erros = [];

            // Processar cada transação
            for (const transacao of transacoes) {
                try {
                    // Verificar se a categoria existe pelo nome, se fornecida
                    if (transacao.categoria) {
                        const categoriaModel = new Categoria(db);
                        const categorias = await categoriaModel.listar();
                        const categoriaEncontrada = categorias.find(
                            cat => cat.nome.toLowerCase() === transacao.categoria.toLowerCase()
                        );
                        
                        if (categoriaEncontrada) {
                            transacao.categoria_id = categoriaEncontrada.id;
                        }
                    }
                    
                    // Criar a transação com verificações explícitas
                    const transacaoModel = new Transacao(db);
                    
                    const novaTransacao = {
                        data: transacao.data,
                        descricao: transacao.descricao || '',
                        valor: parseFloat(transacao.valor),
                        tipo: transacao.tipo,
                        categoria_id: transacao.categoria_id || null
                    };
                    
                    // Validação adicional
                    if (isNaN(novaTransacao.valor)) {
                        throw new Error(`Valor inválido: ${transacao.valor}`);
                    }
                    
                    if (novaTransacao.tipo !== 'receita' && novaTransacao.tipo !== 'despesa') {
                        throw new Error(`Tipo inválido: ${transacao.tipo}`);
                    }
                    
                    console.log(`Importando transação: ${JSON.stringify(novaTransacao)}`);
                    await transacaoModel.criar(novaTransacao);
                    
                    transacoesImportadas++;
                } catch (erroTransacao) {
                    console.error(`Erro ao importar transação específica:`, erroTransacao);
                    erros.push(`Erro ao importar transação: ${erroTransacao.message}`);
                }
            }
            
            // Remover o arquivo temporário após o processamento
            try {
                fs.unlinkSync(req.file.path);
            } catch (erroDelete) {
                console.warn(`Aviso: Não foi possível excluir o arquivo temporário: ${erroDelete.message}`);
            }
            
            // Retornar o resultado
            if (transacoesImportadas > 0) {
                return res.status(200).json({
                    mensagem: `${transacoesImportadas} transações importadas com sucesso`,
                    erros: erros.length > 0 ? erros : undefined
                });
            } else {
                return res.status(400).json({
                    erro: 'Nenhuma transação pôde ser importada',
                    detalhes: erros
                });
            }
        } catch (erroImportacao) {
            // Remover o arquivo temporário em caso de erro
            try {
                fs.unlinkSync(req.file.path);
            } catch (erroDelete) {
                console.warn(`Aviso: Não foi possível excluir o arquivo temporário: ${erroDelete.message}`);
            }
            
            throw erroImportacao;
        }
    } catch (erro) {
        console.error('Erro ao importar transações:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

// Endpoint para exportação de transações
app.get('/api/exportar', async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        
        // Obter as transações com base nos filtros
        const transacaoModel = new Transacao(db);
        const filtros = {};
        
        if (dataInicio) filtros.dataInicio = dataInicio;
        if (dataFim) filtros.dataFim = dataFim;
        
        const transacoes = await transacaoModel.listar(filtros);
        
        // Obter todas as categorias para mapear IDs para nomes
        const categoriaModel = new Categoria(db);
        const categorias = await categoriaModel.listar();
        
        // Criar o arquivo de exportação
        const importExport = new ImportExport();
        const { filepath, filename } = await importExport.exportarTransacoes(transacoes, categorias);
        
        // Enviar o arquivo
        res.download(filepath, filename, (err) => {
            if (err) {
                console.error('Erro ao enviar arquivo:', err);
            }
            
            // Não remover o arquivo após o download, 
            // ele será removido pelo método de limpeza programado
        });
    } catch (erro) {
        console.error('Erro ao exportar transações:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    
    // Limpar arquivos temporários na inicialização
    const importExport = new ImportExport();
    importExport.limparArquivosTemporarios();
    
    // Programar limpeza periódica de arquivos temporários (a cada 6 horas)
    setInterval(() => {
        importExport.limparArquivosTemporarios();
    }, 6 * 60 * 60 * 1000);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (erro) => {
    console.error('Erro não tratado:', erro);
});

// Encerramento gracioso
process.on('SIGINT', () => {
    console.log('Encerrando servidor...');
    db.close(() => {
        console.log('Conexão com banco de dados fechada.');
        process.exit(0);
    });
});