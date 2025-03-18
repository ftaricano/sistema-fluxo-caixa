const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Garante que o diretório de dados existe
const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Caminho do banco de dados
const dbPath = path.join(dbDir, 'fluxocaixa.db');

// Cria o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao criar/conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
    initDb();
  }
});

// Inicializa as tabelas do banco
function initDb() {
  db.serialize(() => {
    // Habilita as foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Tabela de usuários
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de categorias
    db.run(`CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cor_hex TEXT DEFAULT '#666666',
      usuario_id INTEGER,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    )`);

    // Tabela de transações
    db.run(`CREATE TABLE IF NOT EXISTS transacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      data DATE NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
      categoria_id INTEGER,
      notas TEXT,
      FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    )`);

    // Tabela de anexos
    db.run(`CREATE TABLE IF NOT EXISTS anexos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_arquivo TEXT NOT NULL,
      caminho_local TEXT NOT NULL,
      transacao_id INTEGER,
      upload_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transacao_id) REFERENCES transacoes (id) ON DELETE CASCADE
    )`);

    // Verificar se existe usuário administrador padrão
    db.get('SELECT COUNT(*) as count FROM usuarios', (err, row) => {
      if (err) {
        console.error('Erro ao verificar usuários:', err.message);
        return;
      }
      
      if (row.count === 0) {
        // Criar usuário padrão
        bcrypt.hash('admin123', 10, (hashErr, senhaHash) => {
          if (hashErr) {
            console.error('Erro ao gerar hash da senha:', hashErr.message);
            return;
          }
          
          db.run(
            'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
            ['Administrador', 'admin@example.com', senhaHash],
            function(insertErr) {
              if (insertErr) {
                console.error('Erro ao criar usuário padrão:', insertErr.message);
                return;
              }
              
              const usuarioId = this.lastID;
              console.log('Usuário padrão criado com ID:', usuarioId);
              
              // Depois de criar o usuário, criar as categorias
              criarCategoriasIniciais(usuarioId);
            }
          );
        });
      } else {
        // Se já existe usuário, verificar se há categorias
        db.get('SELECT COUNT(*) as count FROM categorias', (catErr, catRow) => {
          if (catErr) {
            console.error('Erro ao verificar categorias:', catErr.message);
            return;
          }
          
          if (catRow.count === 0) {
            // Buscar ID do primeiro usuário
            db.get('SELECT id FROM usuarios LIMIT 1', (userErr, userRow) => {
              if (userErr || !userRow) {
                console.error('Erro ao buscar usuário:', userErr?.message);
                return;
              }
              
              criarCategoriasIniciais(userRow.id);
            });
          }
        });
      }
    });
  });
}

// Função auxiliar para criar categorias iniciais
function criarCategoriasIniciais(usuarioId) {
  const categoriasIniciais = [
    ['Receitas', '#28a745', usuarioId],
    ['Despesas', '#dc3545', usuarioId],
    ['Investimentos', '#17a2b8', usuarioId],
    ['Transferências', '#6c757d', usuarioId],
    ['Salário', '#28a745', usuarioId],
    ['Alimentação', '#dc3545', usuarioId],
    ['Moradia', '#dc3545', usuarioId],
    ['Transporte', '#dc3545', usuarioId]
  ];
  
  const stmt = db.prepare('INSERT INTO categorias (nome, cor_hex, usuario_id) VALUES (?, ?, ?)');
  
  categoriasIniciais.forEach(categoria => {
    stmt.run(categoria, (err) => {
      if (err) console.error('Erro ao inserir categoria:', err.message);
    });
  });
  
  stmt.finalize();
  console.log('Categorias iniciais criadas com sucesso.');
}

module.exports = db;