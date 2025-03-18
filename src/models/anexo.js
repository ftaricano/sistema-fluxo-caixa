const db = require('../database/db');
const fs = require('fs');
const path = require('path');

class Anexo {
  // Criar novo anexo
  static criar(nome_arquivo, caminho_local, transacao_id) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO anexos (nome_arquivo, caminho_local, transacao_id) VALUES (?, ?, ?)';
      
      db.run(sql, [nome_arquivo, caminho_local, transacao_id], function(err) {
        if (err) {
          return reject(err);
        }
        
        resolve({
          id: this.lastID,
          nome_arquivo,
          caminho_local,
          transacao_id
        });
      });
    });
  }

  // Listar anexos por transação
  static listarPorTransacao(transacao_id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM anexos WHERE transacao_id = ? ORDER BY upload_em DESC';
      
      db.all(sql, [transacao_id], (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        resolve(rows);
      });
    });
  }

  // Buscar anexo por ID
  static buscarPorId(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM anexos WHERE id = ?';
      
      db.get(sql, [id], (err, row) => {
        if (err) {
          return reject(err);
        }
        
        resolve(row);
      });
    });
  }

  // Remover anexo
  static remover(id) {
    return new Promise((resolve, reject) => {
      // Primeiro buscamos o anexo para obter o caminho do arquivo
      this.buscarPorId(id)
        .then(anexo => {
          if (!anexo) {
            return reject(new Error('Anexo não encontrado'));
          }

          // Remover o arquivo físico
          try {
            fs.unlinkSync(anexo.caminho_local);
          } catch (err) {
            console.error('Erro ao remover arquivo físico:', err);
            // Continua mesmo se não conseguir remover o arquivo
          }

          // Remover registro do banco
          const sql = 'DELETE FROM anexos WHERE id = ?';
          
          db.run(sql, [id], function(err) {
            if (err) {
              return reject(err);
            }
            
            if (this.changes === 0) {
              return reject(new Error('Anexo não encontrado'));
            }
            
            resolve({ removed: true });
          });
        })
        .catch(err => reject(err));
    });
  }
}

module.exports = Anexo;