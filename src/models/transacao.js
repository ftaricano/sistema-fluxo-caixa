// src/models/transacao.js
class Transacao {
    constructor(db) {
        this.db = db;
    }

    async listar(filtros = {}) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM transacoes';
            const params = [];
            
            // Construir a parte WHERE da query com base nos filtros
            const condicoes = [];
            
            if (filtros.tipo) {
                condicoes.push('tipo = ?');
                params.push(filtros.tipo);
            }
            
            if (filtros.dataInicio) {
                condicoes.push('data >= ?');
                params.push(filtros.dataInicio);
            }
            
            if (filtros.dataFim) {
                condicoes.push('data <= ?');
                params.push(filtros.dataFim);
            }
            
            if (filtros.categoriaId) {
                condicoes.push('categoria_id = ?');
                params.push(filtros.categoriaId);
            }
            
            if (filtros.descricao) {
                condicoes.push('descricao LIKE ?');
                params.push(`%${filtros.descricao}%`);
            }
            
            if (condicoes.length > 0) {
                query += ' WHERE ' + condicoes.join(' AND ');
            }
            
            // Ordenação e limite
            query += ' ORDER BY data DESC, id DESC';
            
            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
    
    async listarPorPeriodo(dataInicio, dataFim) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM transacoes 
                 WHERE data >= ? AND data <= ?
                 ORDER BY data DESC`,
                [dataInicio, dataFim],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async obterPorId(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM transacoes WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async criar(transacao) {
        return new Promise((resolve, reject) => {
            // Validar os campos obrigatórios
            if (!transacao.data || !transacao.valor || !transacao.tipo) {
                return reject(new Error('Data, valor e tipo são obrigatórios'));
            }
            
            // Validar o tipo
            if (transacao.tipo !== 'receita' && transacao.tipo !== 'despesa') {
                return reject(new Error('Tipo inválido. Use "receita" ou "despesa"'));
            }
            
            // Validar valor
            const valor = parseFloat(transacao.valor);
            if (isNaN(valor) || valor <= 0) {
                return reject(new Error('Valor deve ser um número positivo'));
            }
            
            // Inserir a transação
            this.db.run(
                `INSERT INTO transacoes (data, descricao, valor, tipo, categoria_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    transacao.data,
                    transacao.descricao || '',
                    transacao.valor,
                    transacao.tipo,
                    transacao.categoria_id || null
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...transacao });
                }
            );
        });
    }

    async atualizar(id, transacao) {
        return new Promise((resolve, reject) => {
            // Validar os campos obrigatórios
            if (!transacao.data || !transacao.valor || !transacao.tipo) {
                return reject(new Error('Data, valor e tipo são obrigatórios'));
            }
            
            // Validar o tipo
            if (transacao.tipo !== 'receita' && transacao.tipo !== 'despesa') {
                return reject(new Error('Tipo inválido. Use "receita" ou "despesa"'));
            }
            
            // Validar valor
            const valor = parseFloat(transacao.valor);
            if (isNaN(valor) || valor <= 0) {
                return reject(new Error('Valor deve ser um número positivo'));
            }
            
            // Atualizar a transação
            this.db.run(
                `UPDATE transacoes 
                 SET data = ?, descricao = ?, valor = ?, tipo = ?, categoria_id = ?
                 WHERE id = ?`,
                [
                    transacao.data,
                    transacao.descricao || '',
                    transacao.valor,
                    transacao.tipo,
                    transacao.categoria_id || null,
                    id
                ],
                function(err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Transação não encontrada'));
                    } else {
                        resolve({ id, ...transacao });
                    }
                }
            );
        });
    }

    async remover(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM transacoes WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else if (this.changes === 0) {
                    reject(new Error('Transação não encontrada'));
                } else {
                    resolve({ message: 'Transação removida com sucesso' });
                }
            });
        });
    }
}

module.exports = Transacao;