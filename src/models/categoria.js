const db = require('../database/db');

class Categoria {
  // Criar nova categoria
  static criar(nome, cor_hex, usuario_id = null) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO categorias (nome, cor_hex, usuario_id) VALUES (?, ?, ?)';
      
      db.run(sql, [nome, cor_hex || '#666666', usuario_id], function(err) {
        if (err) {
          return reject(err);
        }
        
        resolve({
          id: this.lastID,
          nome,
          cor_hex,
          usuario_id
        });
      });
    });
  }

  // Listar todas as categorias de um usuário
  static listarPorUsuario(usuario_id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM categorias WHERE usuario_id = ? ORDER BY nome';
      
      db.all(sql, [usuario_id], (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        resolve(rows);
      });
    });
  }

  // Atualizar categoria
  static atualizar(id, nome, cor_hex) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE categorias SET nome = ?, cor_hex = ? WHERE id = ?';
      
      db.run(sql, [nome, cor_hex, id], function(err) {
        if (err) {
          return reject(err);
        }
        
        if (this.changes === 0) {
          return reject(new Error('Categoria não encontrada'));
        }
        
        resolve({
          id,
          nome,
          cor_hex,
          updated: true
        });
      });
    });
  }

  // Remover categoria
  static remover(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM categorias WHERE id = ?';
      
      db.run(sql, [id], function(err) {
        if (err) {
          return reject(err);
        }
        
        if (this.changes === 0) {
          return reject(new Error('Categoria não encontrada'));
        }
        
        resolve({ removed: true });
      });
    });
  }

  // Buscar categoria por ID
  static buscarPorId(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM categorias WHERE id = ?';
      
      db.get(sql, [id], (err, row) => {
        if (err) {
          return reject(err);
        }
        
        resolve(row);
      });
    });
  }
}

module.exports = Categoria;