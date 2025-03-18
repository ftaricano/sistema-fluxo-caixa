const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const Transacao = require('../models/transacao');
const Categoria = require('../models/categoria');

class ImportExport {
  // Importar transações de um arquivo Excel
  static async importarTransacoes(filePath, mapeamento, usuarioId) {
    try {
      // Ler o arquivo
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Converter para JSON
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Verificar se há dados
      if (data.length <= 1) {
        throw new Error('Arquivo vazio ou contém apenas cabeçalhos');
      }
      
      // Extrair cabeçalhos
      const headers = data[0];
      
      // Validar mapeamento
      const requiredFields = ['descricao', 'valor', 'data', 'tipo'];
      for (const field of requiredFields) {
        if (!mapeamento[field] || mapeamento[field] === -1) {
          throw new Error(`Campo obrigatório não mapeado: ${field}`);
        }
      }
      
      // Processar linhas
      const transacoes = [];
      const erros = [];
      
      // Obter todas as categorias existentes
      const categorias = await Categoria.listarPorUsuario(usuarioId);
      const categoriasMap = new Map();
      categorias.forEach(cat => categoriasMap.set(cat.nome.toLowerCase(), cat.id));
      
      // Processar dados (começando da linha 1, pulando cabeçalhos)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        try {
          // Se a linha estiver vazia, pular
          if (!row || row.length === 0) continue;
          
          const descricao = row[mapeamento.descricao] || '';
          
          // Se não tiver descrição, pular
          if (!descricao) continue;
          
          let valor = row[mapeamento.valor];
          if (typeof valor === 'string') {
            // Limpar valor (remover R$, ., etc)
            valor = valor.replace(/[^\d,-]/g, '')
                         .replace(',', '.');
          }
          valor = parseFloat(valor);
          
          if (isNaN(valor)) {
            erros.push(`Linha ${i+1}: Valor inválido`);
            continue;
          }
          
          // Processar data
          let data = row[mapeamento.data];
          if (typeof data === 'string') {
            // Tentar converter várias formatações de data
            const dateParts = data.split(/[\/.-]/);
            if (dateParts.length === 3) {
              // Assumir formato DD/MM/YYYY ou MM/DD/YYYY ou YYYY/MM/DD
              if (dateParts[0].length === 4) {
                // YYYY/MM/DD
                data = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
              } else if (parseInt(dateParts[0]) > 12) {
                // DD/MM/YYYY
                data = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
              } else {
                // MM/DD/YYYY (padrão Excel)
                data = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
              }
            } else {
              erros.push(`Linha ${i+1}: Formato de data inválido`);
              continue;
            }
          } else if (data instanceof Date) {
            // Converter para formato YYYY-MM-DD
            data = data.toISOString().split('T')[0];
          } else {
            erros.push(`Linha ${i+1}: Formato de data não reconhecido`);
            continue;
          }
          
          // Determinar o tipo
          let tipo = 'SAIDA';
          if (mapeamento.tipo !== undefined && mapeamento.tipo !== -1) {
            const tipoValue = row[mapeamento.tipo];
            if (tipoValue) {
              const tipoStr = tipoValue.toString().toLowerCase();
              if (tipoStr.includes('entrada') || tipoStr.includes('receita') || tipoStr.includes('crédito') || 
                  tipoStr === 'e' || tipoStr === 'c' || tipoStr === '+') {
                tipo = 'ENTRADA';
              }
            }
          } else if (valor > 0) {
            tipo = 'ENTRADA';
          } else {
            // Se valor for negativo, convertemos para positivo e mantemos como SAIDA
            valor = Math.abs(valor);
          }
          
          // Processar categoria
          let categoria_id = null;
          if (mapeamento.categoria !== undefined && mapeamento.categoria !== -1) {
            const categoriaValue = row[mapeamento.categoria];
            if (categoriaValue) {
              const categoriaNome = categoriaValue.toString().toLowerCase();
              if (categoriasMap.has(categoriaNome)) {
                categoria_id = categoriasMap.get(categoriaNome);
              } else {
                // Criar nova categoria
                try {
                  const novaCat = await Categoria.criar(categoriaValue, '#666666', usuarioId);
                  categoria_id = novaCat.id;
                  categoriasMap.set(categoriaNome, novaCat.id);
                } catch (err) {
                  console.error('Erro ao criar categoria:', err);
                }
              }
            }
          }
          
          // Obter notas, se mapeadas
          let notas = '';
          if (mapeamento.notas !== undefined && mapeamento.notas !== -1) {
            notas = row[mapeamento.notas] || '';
          }
          
          // Criar a transação
          const transacao = await Transacao.criar(
            descricao,
            valor,
            data,
            tipo,
            categoria_id,
            notas
          );
          
          transacoes.push(transacao);
          
        } catch (err) {
          erros.push(`Linha ${i+1}: ${err.message}`);
        }
      }
      
      return {
        transacoes,
        erros,
        total: transacoes.length,
        sucessos: transacoes.length,
        falhas: erros.length
      };
      
    } catch (err) {
      throw err;
    }
  }

  // Exportar transações para Excel
  static async exportarTransacoes(filtros, colunas) {
    try {
      // Buscar transações
      const { transacoes } = await Transacao.listar(filtros);
      
      if (transacoes.length === 0) {
        throw new Error('Nenhuma transação encontrada para exportar');
      }
      
      // Definir colunas a serem exportadas
      const colunasDisponiveis = {
        data: 'Data',
        descricao: 'Descrição',
        valor: 'Valor',
        tipo: 'Tipo',
        categoria_nome: 'Categoria',
        notas: 'Notas'
      };
      
      let colunasExportar = {};
      
      // Se não foram especificadas colunas, exportar todas
      if (!colunas || colunas.length === 0) {
        colunasExportar = colunasDisponiveis;
      } else {
        // Filtrar apenas colunas válidas
        colunas.forEach(col => {
          if (colunasDisponiveis[col]) {
            colunasExportar[col] = colunasDisponiveis[col];
          }
        });
      }
      
      // Criar dados para exportação
      const dados = [];
      
      // Adicionar cabeçalhos
      const headers = Object.values(colunasExportar);
      dados.push(headers);
      
      // Adicionar dados
      transacoes.forEach(item => {
        const row = [];
        
        Object.keys(colunasExportar).forEach(key => {
          if (key === 'valor') {
            row.push(item.tipo === 'ENTRADA' ? item.valor : -item.valor);
          } else {
            row.push(item[key]);
          }
        });
        
        dados.push(row);
      });
      
      // Criar planilha
      const ws = XLSX.utils.aoa_to_sheet(dados);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transações');
      
      // Criar diretório para exportações se não existir
      const exportDir = path.join(__dirname, '../../exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      // Nome do arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(exportDir, `transacoes_${timestamp}.xlsx`);
      
      // Salvar arquivo
      XLSX.writeFile(wb, filePath);
      
      return { 
        filePath,
        totalExportado: transacoes.length 
      };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = ImportExport;