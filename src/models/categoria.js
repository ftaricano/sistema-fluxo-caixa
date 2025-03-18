// src/models/categoria.js
class Categoria {
  constructor(db) {
      this.db = db;
  }

  async listar() {
      return new Promise((resolve, reject) => {
          this.db.all('SELECT * FROM categorias ORDER BY nome', [], (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
          });
      });
  }

  async obterPorId(id) {
      return new Promise((resolve, reject) => {
          this.db.get('SELECT * FROM categorias WHERE id = ?', [id], (err, row) => {
              if (err) reject(err);
              else resolve(row);
          });
      });
  }

  async criar(categoria) {
      return new Promise((resolve, reject) => {
          // Verifica se já existe uma categoria com o mesmo nome
          this.db.get(
              'SELECT * FROM categorias WHERE nome = ?',
              [categoria.nome],
              (err, row) => {
                  if (err) {
                      reject(err);
                  } else if (row) {
                      reject(new Error('Já existe uma categoria com este nome'));
                  } else {
                      // Insere a nova categoria
                      this.db.run(
                          'INSERT INTO categorias (nome, descricao) VALUES (?, ?)',
                          [categoria.nome, categoria.descricao || ''],
                          function(err) {
                              if (err) reject(err);
                              else resolve({ id: this.lastID, ...categoria });
                          }
                      );
                  }
              }
          );
      });
  }

  async atualizar(id, categoria) {
      return new Promise((resolve, reject) => {
          // Verifica se já existe outra categoria com o mesmo nome
          this.db.get(
              'SELECT * FROM categorias WHERE nome = ? AND id != ?',
              [categoria.nome, id],
              (err, row) => {
                  if (err) {
                      reject(err);
                  } else if (row) {
                      reject(new Error('Já existe outra categoria com este nome'));
                  } else {
                      // Atualiza a categoria
                      this.db.run(
                          'UPDATE categorias SET nome = ?, descricao = ? WHERE id = ?',
                          [categoria.nome, categoria.descricao || '', id],
                          function(err) {
                              if (err) reject(err);
                              else if (this.changes === 0) {
                                  reject(new Error('Categoria não encontrada'));
                              } else {
                                  resolve({ id, ...categoria });
                              }
                          }
                      );
                  }
              }
          );
      });
  }

  async verificarUsoEmTransacoes(id) {
      return new Promise((resolve, reject) => {
          this.db.get(
              'SELECT COUNT(*) as total FROM transacoes WHERE categoria_id = ?',
              [id],
              (err, row) => {
                  if (err) reject(err);
                  else resolve(row.total > 0);
              }
          );
      });
  }
  
  async remover(id) {
      // Verificar se a categoria está sendo usada
      const emUso = await this.verificarUsoEmTransacoes(id);
      
      if (emUso) {
          throw new Error('Não é possível remover categoria em uso por transações');
      }
      
      return new Promise((resolve, reject) => {
          this.db.run(
              'DELETE FROM categorias WHERE id = ?',
              [id],
              function(err) {
                  if (err) reject(err);
                  else if (this.changes === 0) {
                      reject(new Error('Categoria não encontrada'));
                  } else {
                      resolve({ message: 'Categoria removida com sucesso' });
                  }
              }
          );
      });
  }
}

module.exports = Categoria;