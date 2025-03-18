const db = require('../database/db');
const bcrypt = require('bcrypt');

class Usuario {
  // Criar um novo usuário
  static async criar(nome, email, senha) {
    return new Promise((resolve, reject) => {
      // Hash da senha
      bcrypt.hash(senha, 10, (err, hash) => {
        if (err) {
          return reject(err);
        }

        const sql = 'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)';
        
        db.run(sql, [nome, email, hash], function(err) {
          if (err) {
            return reject(err);
          }
          
          resolve({
            id: this.lastID,
            nome,
            email
          });
        });
      });
    });
  }

  // Encontrar usuário por e-mail
  static buscarPorEmail(email) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM usuarios WHERE email = ?';
      
      db.get(sql, [email], (err, row) => {
        if (err) {
          return reject(err);
        }
        
        resolve(row);
      });
    });
  }

  // Verificar senha
  static async verificarSenha(senhaEntrada, senhaHash) {
    return await bcrypt.compare(senhaEntrada, senhaHash);
  }

  // Listar todos os usuários
  static listarTodos() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, nome, email, criado_em FROM usuarios';
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        resolve(rows);
      });
    });
  }
}

module.exports = Usuario;