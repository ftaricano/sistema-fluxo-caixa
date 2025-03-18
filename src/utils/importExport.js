// src/utils/ImportExport.js - Versão final com suporte a XLSX
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

class ImportExport {
    constructor() {
        // Diretório para armazenar arquivos temporários de exportação
        this.tempDir = path.join(__dirname, '../../temp');
        
        // Criar diretório temp se não existir
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    
    // Detectar tipo de arquivo pelo conteúdo, não pela extensão
    detectarTipoArquivo(caminhoArquivo) {
        try {
            // Ler os primeiros bytes do arquivo para detectar o tipo
            const buffer = Buffer.alloc(8);
            const fd = fs.openSync(caminhoArquivo, 'r');
            fs.readSync(fd, buffer, 0, 8, 0);
            fs.closeSync(fd);
            
            // Verificar assinaturas de arquivo comuns
            const hex = buffer.toString('hex', 0, 8);
            console.log(`Signature hex: ${hex}`);
            
            // Assinatura de arquivos XLSX/DOCX/ZIP (PK..)
            if (hex.startsWith('504b0304')) {
                return 'EXCEL';
            }
            
            // Verificar se é um arquivo CSV (tentar ler as primeiras linhas)
            try {
                const amostra = fs.readFileSync(caminhoArquivo, 'utf8').slice(0, 1000);
                const linhas = amostra.split('\n');
                
                if (linhas.length > 1) {
                    const primeiraLinha = linhas[0];
                    // Verificar se tem vírgulas e se parece um cabeçalho de CSV
                    if (primeiraLinha.includes(',') && 
                        (/data|valor|tipo|descri/i.test(primeiraLinha))) {
                        return 'CSV';
                    }
                }
            } catch (e) {
                // Se não conseguir ler como texto, provavelmente não é CSV
                console.log('Não é CSV:', e.message);
            }
            
            // Se chegou aqui, tentar carregar como Excel de qualquer forma
            try {
                // Tentar abrir como Excel (vai lançar exceção se não for)
                XLSX.readFile(caminhoArquivo, {type: 'binary'});
                return 'EXCEL';
            } catch (e) {
                console.log('Erro ao tentar abrir como Excel:', e.message);
            }
            
            return 'DESCONHECIDO';
        } catch (erro) {
            console.error('Erro ao detectar tipo de arquivo:', erro);
            return 'ERRO';
        }
    }
    
    importarTransacoes(caminhoArquivo) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`Processando arquivo: ${caminhoArquivo}`);
                
                // Detectar o tipo de arquivo pelo conteúdo
                const tipoArquivo = this.detectarTipoArquivo(caminhoArquivo);
                console.log(`Tipo de arquivo detectado: ${tipoArquivo}`);
                
                let transacoes = [];
                
                // Processar o arquivo baseado no tipo detectado
                if (tipoArquivo === 'EXCEL') {
                    transacoes = this.processarArquivoExcel(caminhoArquivo);
                } else if (tipoArquivo === 'CSV') {
                    transacoes = this.processarArquivoCSV(caminhoArquivo);
                } else {
                    return reject(new Error(`Tipo de arquivo não reconhecido ou não suportado. Use arquivos Excel (.xlsx, .xls) ou CSV (.csv)`));
                }
                
                if (transacoes.length === 0) {
                    return reject(new Error('Nenhuma transação válida encontrada no arquivo'));
                }
                
                resolve(transacoes);
            } catch (erro) {
                reject(new Error(`Erro ao processar arquivo: ${erro.message}`));
            }
        });
    }
    
    processarArquivoExcel(caminhoArquivo) {
        console.log('Processando como arquivo Excel...');
        
        try {
            // Ler o arquivo Excel
            const workbook = XLSX.readFile(caminhoArquivo);
            
            // Obter a primeira planilha
            const primeiraSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[primeiraSheet];
            
            // Converter para JSON
            const dados = XLSX.utils.sheet_to_json(worksheet);
            console.log(`Encontradas ${dados.length} linhas na planilha Excel`);
            
            if (dados.length === 0) {
                throw new Error('Planilha vazia ou sem dados');
            }
            
            // Mapear os cabeçalhos da planilha para os campos do sistema
            const primeiroItem = dados[0];
            const cabecalhos = Object.keys(primeiroItem);
            console.log('Cabeçalhos encontrados:', cabecalhos);
            
            // Mapeamento de campos
            const mapeamentoCampos = {};
            
            for (const cabecalho of cabecalhos) {
                const cabecalhoNormalizado = cabecalho.toLowerCase().trim();
                
                // Mapeamento para o campo 'data'
                if (/data|date|dt/.test(cabecalhoNormalizado)) {
                    mapeamentoCampos[cabecalho] = 'data';
                } 
                // Mapeamento para o campo 'descricao'
                else if (/desc|obs|descrição|descricao|name|nome/.test(cabecalhoNormalizado)) {
                    mapeamentoCampos[cabecalho] = 'descricao';
                } 
                // Mapeamento para o campo 'valor'
                else if (/valor|value|amount|preco|preço|montante/.test(cabecalhoNormalizado)) {
                    mapeamentoCampos[cabecalho] = 'valor';
                } 
                // Mapeamento para o campo 'tipo'
                else if (/tipo|type|receita|despesa|entrada|saída|saida|operacao|operação/.test(cabecalhoNormalizado)) {
                    mapeamentoCampos[cabecalho] = 'tipo';
                } 
                // Mapeamento para o campo 'categoria'
                else if (/cat|categoria|category/.test(cabecalhoNormalizado)) {
                    mapeamentoCampos[cabecalho] = 'categoria';
                }
            }
            
            console.log('Mapeamento de campos:', mapeamentoCampos);
            
            // Verificar se os campos obrigatórios estão mapeados
            const camposObrigatorios = ['data', 'valor', 'tipo'];
            const camposMapeados = Object.values(mapeamentoCampos);
            
            for (const campo of camposObrigatorios) {
                if (!camposMapeados.includes(campo)) {
                    throw new Error(`Campo obrigatório não encontrado: ${campo}. Cabeçalhos disponíveis: ${cabecalhos.join(', ')}`);
                }
            }
            
            // Processar os dados
            const transacoes = [];
            
            for (const item of dados) {
                // Criar objeto de transação
                const transacao = {};
                
                for (const [cabecalho, campo] of Object.entries(mapeamentoCampos)) {
                    if (item[cabecalho] !== undefined) {
                        let valor = item[cabecalho];
                        
                        // Formatação específica para cada campo
                        if (campo === 'data') {
                            // Se for um número serial de data do Excel, converter para data
                            if (typeof valor === 'number') {
                                const data = XLSX.SSF.parse_date_code(valor);
                                valor = `${data.y}-${String(data.m).padStart(2, '0')}-${String(data.d).padStart(2, '0')}`;
                            } else if (typeof valor === 'string') {
                                // Tentar converter string para data no formato YYYY-MM-DD
                                const match = valor.match(/(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})/);
                                if (match) {
                                    // Determinar qual é o ano (pode estar na posição 1 ou 3)
                                    let ano, mes, dia;
                                    if (match[1].length === 4 || parseInt(match[1]) > 31) {
                                        ano = match[1];
                                        mes = match[2];
                                        dia = match[3];
                                    } else if (match[3].length === 4 || parseInt(match[3]) > 31) {
                                        dia = match[1];
                                        mes = match[2];
                                        ano = match[3];
                                    } else {
                                        // Assumir formato DD/MM/YYYY
                                        dia = match[1];
                                        mes = match[2];
                                        ano = match[3];
                                        if (ano.length === 2) ano = '20' + ano;
                                    }
                                    valor = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                                }
                            }
                        } else if (campo === 'valor') {
                            // Garantir que o valor é um número
                            valor = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[^\d.,]/g, '').replace(',', '.'));
                        } else if (campo === 'tipo') {
                            // Normalizar o tipo
                            valor = String(valor).toLowerCase();
                            if (/receita|entrada|in|income|crédito|credito|positivo|\+/.test(valor)) {
                                valor = 'receita';
                            } else {
                                valor = 'despesa';
                            }
                        }
                        
                        transacao[campo] = valor;
                    }
                }
                
                // Verificar se todos os campos obrigatórios estão presentes e válidos
                const camposFaltantes = [];
                
                for (const campo of camposObrigatorios) {
                    if (transacao[campo] === undefined || transacao[campo] === '' || 
                        (campo === 'valor' && isNaN(transacao[campo]))) {
                        camposFaltantes.push(campo);
                    }
                }
                
                if (camposFaltantes.length === 0) {
                    transacoes.push(transacao);
                } else {
                    console.warn(`Linha ignorada - campos faltantes ou inválidos: ${camposFaltantes.join(', ')}`, item);
                }
            }
            
            return transacoes;
        } catch (erro) {
            console.error('Erro no processamento do Excel:', erro);
            throw erro;
        }
    }
    
    processarArquivoCSV(caminhoArquivo) {
        console.log('Processando como arquivo CSV...');
        
        // Ler o arquivo como texto
        const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');
        
        // Separar linhas
        const linhas = conteudo.split('\n');
        
        // Se o arquivo está vazio ou tem apenas o cabeçalho
        if (linhas.length <= 1) {
            throw new Error('Arquivo vazio ou sem dados');
        }
        
        // Obter cabeçalhos da primeira linha e normalizá-los
        const cabecalhos = linhas[0].split(',').map(header => header.trim());
        
        // Mapear cabeçalhos para os campos do sistema
        const mapeamentoCampos = {};
        
        for (let i = 0; i < cabecalhos.length; i++) {
            const cabecalho = cabecalhos[i].toLowerCase();
            
            // Mapeamento para o campo 'data'
            if (/data|date|dt/.test(cabecalho)) {
                mapeamentoCampos[i] = 'data';
            } 
            // Mapeamento para o campo 'descricao'
            else if (/desc|obs|descrição|descricao|name|nome/.test(cabecalho)) {
                mapeamentoCampos[i] = 'descricao';
            } 
            // Mapeamento para o campo 'valor'
            else if (/valor|value|amount|preco|preço|montante/.test(cabecalho)) {
                mapeamentoCampos[i] = 'valor';
            } 
            // Mapeamento para o campo 'tipo'
            else if (/tipo|type|receita|despesa|entrada|saída|saida|operacao|operação/.test(cabecalho)) {
                mapeamentoCampos[i] = 'tipo';
            } 
            // Mapeamento para o campo 'categoria'
            else if (/cat|categoria|category/.test(cabecalho)) {
                mapeamentoCampos[i] = 'categoria';
            }
        }
        
        console.log('Mapeamento de campos CSV:', mapeamentoCampos);
        
        // Verificar se os campos obrigatórios estão mapeados
        const camposObrigatorios = ['data', 'valor', 'tipo'];
        const camposMapeados = Object.values(mapeamentoCampos);
        
        for (const campo of camposObrigatorios) {
            if (!camposMapeados.includes(campo)) {
                throw new Error(`Campo obrigatório não encontrado: ${campo}. Cabeçalhos disponíveis: ${cabecalhos.join(', ')}`);
            }
        }
        
        // Processar os dados
        const transacoes = [];
        
        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim();
            if (!linha) continue; // Pular linhas vazias
            
            const valores = linha.split(',').map(valor => valor.trim());
            
            // Criar objeto de transação
            const transacao = {};
            
            for (const [indice, campo] of Object.entries(mapeamentoCampos)) {
                // Verificar se o índice está dentro do intervalo válido
                if (indice < valores.length) {
                    let valor = valores[indice];
                    
                    // Processamento específico para o tipo
                    if (campo === 'tipo') {
                        valor = valor.toLowerCase();
                        
                        if (/receita|entrada|in|income|crédito|credito|positivo|\+/.test(valor)) {
                            valor = 'receita';
                        } else {
                            valor = 'despesa';
                        }
                    } else if (campo === 'valor') {
                        // Converter para número
                        valor = parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.'));
                    }
                    
                    transacao[campo] = valor;
                }
            }
            
            // Verificar se todos os campos obrigatórios estão presentes e não vazios
            const camposFaltantes = camposObrigatorios.filter(
                campo => transacao[campo] === undefined || transacao[campo] === '' || 
                (campo === 'valor' && isNaN(transacao[campo]))
            );
            
            if (camposFaltantes.length === 0) {
                transacoes.push(transacao);
            } else {
                console.warn(`Linha ${i} ignorada - campos faltantes ou inválidos: ${camposFaltantes.join(', ')}`);
            }
        }
        
        return transacoes;
    }
    
    exportarTransacoes(transacoes, categorias) {
        return new Promise((resolve, reject) => {
            try {
                // Criar mapa de ID para nome de categoria
                const categoriasMap = {};
                categorias.forEach(cat => {
                    categoriasMap[cat.id] = cat.nome;
                });
                
                // Dados formatados para Excel
                const dados = transacoes.map(t => ({
                    'Data': t.data,
                    'Descrição': t.descricao || '',
                    'Valor': parseFloat(t.valor),
                    'Tipo': t.tipo === 'receita' ? 'Receita' : 'Despesa',
                    'Categoria': t.categoria_id ? categoriasMap[t.categoria_id] : ''
                }));
                
                // Criar workbook
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(dados);
                
                // Adicionar planilha ao workbook
                XLSX.utils.book_append_sheet(wb, ws, 'Transações');
                
                // Define o nome do arquivo com timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `transacoes_${timestamp}.xlsx`;
                const filepath = path.join(this.tempDir, filename);
                
                // Escrever o arquivo
                XLSX.writeFile(wb, filepath);
                
                resolve({
                    filepath,
                    filename
                });
            } catch (erro) {
                reject(new Error(`Erro ao exportar transações: ${erro.message}`));
            }
        });
    }
    
    // Função para limpar arquivos temporários mais antigos que X horas
    limparArquivosTemporarios(horasMax = 24) {
        try {
            if (!fs.existsSync(this.tempDir)) return;
            
            const arquivos = fs.readdirSync(this.tempDir);
            const agora = new Date();
            
            arquivos.forEach(arquivo => {
                const caminhoArquivo = path.join(this.tempDir, arquivo);
                
                try {
                    const stat = fs.statSync(caminhoArquivo);
                    
                    // Calcula a diferença em horas
                    const horasAtras = (agora - stat.mtime) / (1000 * 60 * 60);
                    
                    // Remove arquivos mais antigos que horasMax
                    if (horasAtras > horasMax) {
                        fs.unlinkSync(caminhoArquivo);
                        console.log(`Arquivo temporário removido: ${arquivo}`);
                    }
                } catch (erroStat) {
                    console.warn(`Erro ao verificar arquivo ${arquivo}:`, erroStat);
                }
            });
        } catch (erro) {
            console.error('Erro ao limpar arquivos temporários:', erro);
        }
    }
}

module.exports = ImportExport;