const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const multer = require('multer');
const fs = require('fs');

// Modelos
const Usuario = require('./src/models/usuario');
const Categoria = require('./src/models/categoria');
const Transacao = require('./src/models/transacao');
const Anexo = require('./src/models/anexo');
const ImportExport = require('./src/utils/ImportExport');

// Inicializar app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev')); // Logging

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Configurar upload de arquivos
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Rotas para usuários
app.post('/api/usuarios/registrar', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    
    // Verificar se usuário já existe
    const usuarioExistente = await Usuario.buscarPorEmail(email);
    if (usuarioExistente) {
      return res.status(400).json({ error: 'E-mail já cadastrado' });
    }
    
    const usuario = await Usuario.criar(nome, email, senha);
    
    res.status(201).json({ 
      message: 'Usuário criado com sucesso',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }
    
    // Buscar usuário
    const usuario = await Usuario.buscarPorEmail(email);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar senha
    const senhaCorreta = await Usuario.verificarSenha(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    
    // Retornar usuário autenticado (em uma aplicação real, geraria um token JWT)
    res.json({
      message: 'Login realizado com sucesso',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (err) {
    console.error('Erro ao fazer login:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas para categorias
app.get('/api/categorias', async (req, res) => {
  try {
    const usuario_id = req.query.usuario_id || 1; // Em uma app real, pegaria do token
    
    const categorias = await Categoria.listarPorUsuario(usuario_id);
    res.json(categorias);
  } catch (err) {
    console.error('Erro ao listar categorias:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/categorias', async (req, res) => {
  try {
    const { nome, cor_hex, usuario_id } = req.body;
    
    if (!nome) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }
    
    const categoria = await Categoria.criar(nome, cor_hex, usuario_id || 1);
    res.status(201).json(categoria);
  } catch (err) {
    console.error('Erro ao criar categoria:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/categorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cor_hex } = req.body;
    
    if (!nome) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }
    
    const categoria = await Categoria.atualizar(id, nome, cor_hex);
    res.json(categoria);
  } catch (err) {
    console.error('Erro ao atualizar categoria:', err);
    
    if (err.message === 'Categoria não encontrada') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/categorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await Categoria.remover(id);
    res.json({ message: 'Categoria removida com sucesso' });
  } catch (err) {
    console.error('Erro ao remover categoria:', err);
    
    if (err.message === 'Categoria não encontrada') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas para transações
app.get('/api/transacoes', async (req, res) => {
  try {
    const { 
      dataInicio, 
      dataFim, 
      tipo, 
      categoria_id,
      busca
    } = req.query;
    
    const filtros = {
      dataInicio,
      dataFim,
      tipo,
      categoria_id,
      busca
    };
    
    const resultado = await Transacao.listar(filtros);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao listar transações:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/transacoes', async (req, res) => {
  try {
    const { descricao, valor, data, tipo, categoria_id, notas } = req.body;
    
    if (!descricao || valor === undefined || !data || !tipo) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
    }
    
    const transacao = await Transacao.criar(descricao, valor, data, tipo, categoria_id, notas);
    res.status(201).json(transacao);
  } catch (err) {
    console.error('Erro ao criar transação:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/transacoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const transacao = await Transacao.buscarPorId(id);
    
    if (!transacao) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }
    
    // Buscar anexos relacionados
    const anexos = await Anexo.listarPorTransacao(id);
    
    res.json({
      ...transacao,
      anexos
    });
  } catch (err) {
    console.error('Erro ao buscar transação:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/transacoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { descricao, valor, data, tipo, categoria_id, notas } = req.body;
    
    if (!descricao || valor === undefined || !data || !tipo) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
    }
    
    const transacao = await Transacao.atualizar(id, descricao, valor, data, tipo, categoria_id, notas);
    res.json(transacao);
  } catch (err) {
    console.error('Erro ao atualizar transação:', err);
    
    if (err.message === 'Transação não encontrada') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/transacoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await Transacao.remover(id);
    res.json({ message: 'Transação removida com sucesso' });
  } catch (err) {
    console.error('Erro ao remover transação:', err);
    
    if (err.message === 'Transação não encontrada') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas para anexos
app.post('/api/anexos/upload', upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    const { transacao_id } = req.body;
    
    if (!transacao_id) {
      return res.status(400).json({ error: 'ID da transação é obrigatório' });
    }
    
    // Verificar se a transação existe
    const transacao = await Transacao.buscarPorId(transacao_id);
    if (!transacao) {
      // Remover o arquivo
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Transação não encontrada' });
    }
    
    const anexo = await Anexo.criar(
      req.file.originalname,
      req.file.path,
      transacao_id
    );
    
    res.status(201).json({
      ...anexo,
      url: `/uploads/${path.basename(req.file.path)}`
    });
  } catch (err) {
    console.error('Erro ao fazer upload de anexo:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/anexos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const anexo = await Anexo.buscarPorId(id);
    
    if (!anexo) {
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }
    
    res.json({
      ...anexo,
      url: `/uploads/${path.basename(anexo.caminho_local)}`
    });
  } catch (err) {
    console.error('Erro ao buscar anexo:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/anexos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await Anexo.remover(id);
    res.json({ message: 'Anexo removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover anexo:', err);
    
    if (err.message === 'Anexo não encontrado') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas para importação/exportação
app.post('/api/importar', upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    const { mapeamento } = req.body;
    const usuario_id = req.body.usuario_id || 1;
    
    // Validar mapeamento
    if (!mapeamento) {
      return res.status(400).json({ error: 'Mapeamento de colunas não fornecido' });
    }
    
    // Converter mapeamento de string para objeto
    let mapeamentoObj;
    try {
      mapeamentoObj = typeof mapeamento === 'string' ? JSON.parse(mapeamento) : mapeamento;
    } catch (err) {
      return res.status(400).json({ error: 'Formato de mapeamento inválido' });
    }
    
    // Importar transações
    const resultado = await ImportExport.importarTransacoes(
      req.file.path,
      mapeamentoObj,
      usuario_id
    );
    
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao importar transações:', err);
    res.status(500).json({ error: `Erro ao importar: ${err.message}` });
  }
});

app.post('/api/exportar', async (req, res) => {
  try {
    const { filtros, colunas } = req.body;
    
    // Exportar transações
    const resultado = await ImportExport.exportarTransacoes(filtros, colunas);
    
    // Enviar arquivo
    const filePath = resultado.filePath;
    const fileName = path.basename(filePath);
    
    res.json({
      success: true,
      file: `/exports/${fileName}`,
      totalExportado: resultado.totalExportado
    });
  } catch (err) {
    console.error('Erro ao exportar transações:', err);
    res.status(500).json({ error: `Erro ao exportar: ${err.message}` });
  }
});

// Rota para acessar o banco de dados (SQL)
app.post('/api/db/consulta', async (req, res) => {
  try {
    const { sql, params } = req.body;
    
    if (!sql) {
      return res.status(400).json({ error: 'SQL não fornecido' });
    }
    
    // Validação básica para evitar operações destrutivas
    const sqlLower = sql.toLowerCase();
    if (
      sqlLower.includes('drop table') || 
      sqlLower.includes('drop database') ||
      sqlLower.includes('truncate')
    ) {
      return res.status(403).json({ error: 'Operação não permitida' });
    }
    
    // Executar consulta
    const db = require('./src/database/db');
    
    // Determinar o tipo de operação
    if (sqlLower.startsWith('select')) {
      db.all(sql, params || [], (err, rows) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        
        res.json({
          success: true,
          rows,
          rowCount: rows.length
        });
      });
    } else {
      db.run(sql, params || [], function(err) {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        
        res.json({
          success: true,
          changes: this.changes,
          lastID: this.lastID
        });
      });
    }
  } catch (err) {
    console.error('Erro ao executar consulta SQL:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Servir a interface web
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});