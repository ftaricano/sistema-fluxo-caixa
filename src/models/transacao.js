const db = require('../database/db');

class Transacao {
  // Criar nova transação
  static criar(descricao, valor, data, tipo, categoria_id, notas) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO transacoes (descricao, valor, data, tipo, categoria_id, notas) VALUES (?, ?, ?, ?, ?, ?)';
      
      db.run(sql, [descricao, valor, data, tipo, categoria_id, notas], function(err) {
        if (err) {
          return reject(err);
        }
        
        resolve({
          id: this.lastID,
          descricao,
          valor,
          data,
          tipo,
          categoria_id,
          notas
        });
      });
    });
  }

  // Listar todas as transações com filtros
  static listar(filtros = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT t.*, c.nome as categoria_nome, c.cor_hex 
        FROM transacoes t
        LEFT JOIN categorias c ON t.categoria_id = c.id
        WHERE 1=1
      `;
      
      const params = [];
      
      // Aplicar filtros
      if (filtros.dataInicio) {
        sql += ' AND t.data >= ?';
        params.push(filtros.dataInicio);
      }
      
      if (filtros.dataFim) {
        sql += ' AND t.data <= ?';
        params.push(filtros.dataFim);
      }
      
      if (filtros.tipo) {
        sql += ' AND t.tipo = ?';
        params.push(filtros.tipo);
      }
      
      if (filtros.categoria_id) {
        sql += ' AND t.categoria_id = ?';
        params.push(filtros.categoria_id);
      }
      
      if (filtros.busca) {
        sql += ' AND t.descricao LIKE ?';
        params.push(`%${filtros.busca}%`);
      }
      
      // Ordenação
      sql += ' ORDER BY t.data DESC, t.id DESC';
      
      // Executar consulta
      db.all(sql, params, (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        // Calcular totais
        const totais = {
          entradas: 0,
          saidas: 0,
          saldo: 0
        };
        
        rows.forEach(row => {
          if (row.tipo === 'ENTRADA') {
            totais.entradas += row.valor;
          } else {
            totais.saidas += row.valor;
          }
        });
        
        totais.saldo = totais.entradas - totais.saidas;
        
        resolve({
          transacoes: rows,
          totais
        });
      });
    });
  }

  // Buscar transação por ID
  static buscarPorId(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT t.*, c.nome as categoria_nome, c.cor_hex 
        FROM transacoes t
        LEFT JOIN categorias c ON t.categoria_id = c.id
        WHERE t.id = ?
      `;
      
      db.get(sql, [id], (err, row) => {
        if (err) {
          return reject(err);
        }
        
        resolve(row);
      });
    });
  }

  // Atualizar transação
  static atualizar(id, descricao, valor, data, tipo, categoria_id, notas) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE transacoes 
        SET descricao = ?, valor = ?, data = ?, tipo = ?, categoria_id = ?, notas = ?
        WHERE id = ?
      `;
      
      db.run(sql, [descricao, valor, data, tipo, categoria_id, notas, id], function(err) {
        if (err) {
          return reject(err);
        }
        
        if (this.changes === 0) {
          return reject(new Error('Transação não encontrada'));
        }
        
        resolve({
          id,
          descricao,
          valor,
          data,
          tipo,
          categoria_id,
          notas,
          updated: true
        });
      });
    });
  }

  // Remover transação
  static remover(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM transacoes WHERE id = ?';
      
      db.run(sql, [id], function(err) {
        if (err) {
          return reject(err);
        }
        
        if (this.changes === 0) {
          return reject(new Error('Transação não encontrada'));
        }
        
        resolve({ removed: true });
      });
    });
  }

  // Obter resumo por período
  static resumoPorPeriodo(dataInicio, dataFim) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          strftime('%Y-%m', data) as periodo,
          SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END) as total_entradas,
          SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END) as total_saidas,
          SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE -valor END) as saldo
        FROM transacoes
        WHERE data BETWEEN ? AND ?
        GROUP BY periodo
        ORDER BY periodo
      `;
      
      db.all(sql, [dataInicio, dataFim], (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        resolve(rows);
      });
    });
  }
}

module.exports = Transacao;