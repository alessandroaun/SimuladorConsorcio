import { SimulationResult, SimulationInput, ContemplationScenario } from './ConsortiumCalculator';

// --- IMAGENS ---
const LOGO_IMG = "https://intranet.consorciorecon.com.br/media/photo/logo_4Y8K7jg.PNG"; 
const WATERMARK_IMG = "https://intranet.consorciorecon.com.br/media/photo/logo_4Y8K7jg.PNG";

export const generateHTML = (
  result: SimulationResult, 
  input: SimulationInput, 
  mode: 'REDUZIDO' | 'CHEIO',
  pdfData: { 
    cliente: string; 
    telefoneCliente: string; 
    vendedor: string; 
    telefoneVendedor: string; 
  },
  quotaCount: number = 1
) => {
  
  // --- FORMATADORES ---
  const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPct = (val: number) => `${(val * 100).toFixed(2).replace('.', ',')}%`;
  // Formatador específico para seguro (mais casas decimais, ex: 0,084%)
  const formatSeguroPct = (val: number) => `${(val * 100).toFixed(4).replace('.', ',').replace(/0+$/, '').replace(/,$/, '')}%`; 
  const formatDate = () => new Date().toLocaleDateString('pt-BR');

  // --- LÓGICA DO CENÁRIO ---
  let activeScenario: ContemplationScenario[];
  let cenarioTitulo = "Plano Padrão";
  let creditoLiquidoFinal = 0; // Valor líquido na mão do cliente
  
  if (mode === 'REDUZIDO' && result.cenarioCreditoReduzido) {
    const cenariosReduzidos = result.cenarioCreditoReduzido as any as ContemplationScenario[];
    activeScenario = cenariosReduzidos;
    cenarioTitulo = "Crédito Reduzido";
    
    // No modo REDUZIDO, o crédito efetivo já é o valor abatido.
    const creditoEfetivoScenario = cenariosReduzidos.length > 0 ? cenariosReduzidos[0].creditoEfetivo : result.creditoLiquido;
    creditoLiquidoFinal = creditoEfetivoScenario - input.lanceCartaVal;

  } else if (mode === 'CHEIO' && result.cenarioCreditoTotal) {
    const cenariosCheios = result.cenarioCreditoTotal as any as ContemplationScenario[];
    activeScenario = cenariosCheios;
    cenarioTitulo = "Crédito Total (100%)";
    
    // No modo CHEIO, o cliente recebe a carta cheia, mas paga o lance embutido dela.
    const creditoEfetivoScenario = cenariosCheios.length > 0 ? cenariosCheios[0].creditoEfetivo : result.creditoLiquido;
    creditoLiquidoFinal = creditoEfetivoScenario - (result.creditoOriginal * input.lanceEmbutidoPct) - input.lanceCartaVal;

  } else {
      activeScenario = result.cenariosContemplacao;
      cenarioTitulo = "Plano Padrão";
      creditoLiquidoFinal = result.creditoLiquido;
  }

  // --- CÁLCULOS FINAIS ---
  
  // Definição de Fatores para cálculo do custo (recuperando lógica do plano)
  const isSpecialPlan = result.plano === 'LIGHT' || result.plano === 'SUPERLIGHT';
  const fatorPlano = result.plano === 'LIGHT' ? 0.75 : result.plano === 'SUPERLIGHT' ? 0.50 : 1.0;

  // Variáveis auxiliares para a fórmula
  const totalSeguroNoPrazo = result.seguroMensal * input.prazo;
  const lanceEmbutidoValor = result.lanceTotal - input.lanceBolso - result.lanceCartaVal;
  
  // Se for crédito reduzido, calcula o valor que foi abatido do crédito base
  const valorReducaoCreditoBase = (isSpecialPlan && mode === 'REDUZIDO') 
    ? (result.creditoOriginal * (1 - fatorPlano)) 
    : 0;

  // FÓRMULA CORRIGIDA: Crédito + Taxas - Lances Embutidos - Carta - Redução
  const custoTotal = 
      result.creditoOriginal + 
      result.taxaAdminValor + 
      result.fundoReservaValor + 
      totalSeguroNoPrazo + 
      result.valorAdesao - 
      lanceEmbutidoValor - 
      result.lanceCartaVal - 
      valorReducaoCreditoBase;

  const primeiraParcelaValor = result.totalPrimeiraParcela;
  
  // Cálculo da porcentagem do seguro para exibição
  const seguroPercentual = result.creditoOriginal > 0 ? (result.seguroMensal / result.creditoOriginal) : 0;
  
  // Cálculo do Total da Composição Financeira (Display do quadro de composição)
  // Soma: Taxa Adm + FR + Seguro Total (Mensal * Prazo) + Adesão
  const totalSeguroVida = result.seguroMensal > 0 ? (result.seguroMensal * input.prazo) : 0;
  const totalComposicao = result.taxaAdminValor + result.fundoReservaValor + totalSeguroVida + result.valorAdesao;

  // Porcentagens para exibição nos títulos
  const pctTaxaAdmin = result.creditoOriginal > 0 ? (result.taxaAdminValor / result.creditoOriginal) : 0;
  const pctFundoReserva = result.creditoOriginal > 0 ? (result.fundoReservaValor / result.creditoOriginal) : 0;

  // Gerar linhas da tabela com design limpo e ARREDONDAMENTO do prazo
  const tableRows = activeScenario.map((scenario, index) => {
      const rowBackground = index % 2 === 0 ? '#ffffff' : '#f8fafc'; // Zebra striping suave
      return `
      <tr style="background-color: ${rowBackground};">
          <td class="text-center py-2 text-gray-700 font-bold">${scenario.mes}</td>
          <td class="text-center py-2 text-blue-800 font-bold">${formatBRL(scenario.novaParcela)}</td>
          <td class="text-center py-2 text-gray-600">${Math.round(scenario.novoPrazo)}</td>
          <td class="text-right py-2 text-gray-500 text-xs">${scenario.amortizacaoInfo}</td>
      </tr>
  `}).join('');

  // --- CSS INLINE OTIMIZADO PARA PDF ---
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Simulação Recon</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;600&display=swap');
            
            @page { size: A4; margin: 0; }
            
            body { 
                font-family: 'Open Sans', Helvetica, Arial, sans-serif; 
                margin: 0; 
                padding: 0; 
                background-color: #ffffff;
                color: #334155;
                -webkit-print-color-adjust: exact;
            }

            /* Container Principal A4 */
            .page-container {
                width: 210mm;
                min-height: 297mm;
                margin: 0 auto;
                background: white;
                padding: 40px;
                box-sizing: border-box;
                position: relative;
            }

            /* Cabeçalho */
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #1e3a8a; /* Azul Recon */
                padding-bottom: 20px;
            }
            
            .logo {
                height: 80px; /* Aumentado de 60px para 80px */
                width: auto;
                margin-bottom: 15px;
            }
            
            .doc-title {
                font-family: 'Montserrat', sans-serif;
                font-size: 22px;
                font-weight: 800;
                color: #1e3a8a;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin: 0;
            }
            
            .doc-subtitle {
                font-size: 12px;
                color: #64748b;
                margin-top: 5px;
                text-transform: uppercase;
            }

            /* Seção de Destaques (Highlights) */
            .highlights-container {
                display: flex;
                justify-content: space-between;
                gap: 15px;
                margin-bottom: 30px;
                background-color: #f1f5f9;
                padding: 20px;
                border-radius: 12px;
            }

            .highlight-card {
                flex: 1;
                text-align: center;
                border-right: 1px solid #cbd5e1;
            }
            .highlight-card:last-child { border-right: none; }

            .highlight-label {
                font-size: 10px;
                text-transform: uppercase;
                color: #64748b;
                font-weight: 700;
                margin-bottom: 5px;
                letter-spacing: 0.5px;
            }

            .highlight-value {
                font-family: 'Montserrat', sans-serif;
                font-size: 18px;
                font-weight: 800;
                color: #1e3a8a;
            }
            
            .highlight-value.green { color: #15803d; }

            /* Grids de Informação */
            .info-section {
                display: flex;
                gap: 30px;
                margin-bottom: 30px;
            }

            .info-column {
                flex: 1;
            }

            .section-header {
                font-family: 'Montserrat', sans-serif;
                font-size: 12px;
                font-weight: 700;
                color: #1e3a8a;
                text-transform: uppercase;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 5px;
                margin-bottom: 10px;
            }

            .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 11px;
            }

            .label { color: #64748b; font-weight: 600; }
            .value { color: #0f172a; font-weight: 700; text-align: right; }

            /* Box de Lance */
            .lance-box {
                border: 1px dashed #94a3b8;
                background-color: #f8fafc;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 30px;
            }
            
            .lance-grid {
                display: flex;
                justify-content: space-between;
                gap: 10px;
            }
            
            .lance-item {
                text-align: center;
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center; /* Centraliza horizontalmente */
                justify-content: flex-start;
            }
            
            /* Tabela */
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            
            thead th {
                background-color: #1e3a8a;
                color: white;
                font-family: 'Montserrat', sans-serif;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                padding: 8px 10px;
                text-align: center; /* Centraliza cabeçalhos */
                vertical-align: middle;
            }
            
            td {
                font-size: 11px; /* Aumentado para 11px */
                padding: 10px 10px;
                border-bottom: 1px solid #e2e8f0;
            }

            .text-center { text-align: center; }
            .text-right { text-align: right; }
            
            /* Utilitários de Texto */
            .text-xs { font-size: 9px; }
            .font-bold { font-weight: 700; }
            .text-blue-800 { color: #1e40af; }
            .text-gray-500 { color: #64748b; }

            /* Rodapé */
            .footer {
                position: absolute;
                bottom: 15px; /* Empurrado para o fundo (era 30px) */
                left: 40px;
                right: 40px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
                padding-top: 15px;
                font-size: 9px;
                color: #94a3b8;
            }
            
            .quota-alert {
                background-color: #fff7ed;
                color: #c2410c;
                border: 1px solid #ffedd5;
                padding: 8px;
                border-radius: 6px;
                font-size: 10px;
                text-align: center;
                margin-top: 10px;
            }

        </style>
    </head>
    <body>
        <div class="page-container">
            
            <!-- CABEÇALHO -->
            <div class="header">
                <img src="${LOGO_IMG}" class="logo" alt="Recon Consórcios" />
                <h1 class="doc-title">Proposta de Simulação</h1>
                <p class="doc-subtitle">Plano: ${result.creditoOriginal > 0 ? result.plano : 'Detalhes do Plano'}</p>
            </div>

            <!-- DESTAQUES PRINCIPAIS (KPIs) -->
            <div class="highlights-container">
                <div class="highlight-card">
                    <div class="highlight-label">Crédito Contratado</div>
                    <div class="highlight-value green">${formatBRL(result.creditoOriginal)}</div>
                </div>
                <div class="highlight-card">
                    <div class="highlight-label">Prazo Total</div>
                    <div class="highlight-value">${input.prazo} Meses</div>
                </div>
                <div class="highlight-card">
                    <div class="highlight-label">1ª Parcela</div>
                    <div class="highlight-value">${formatBRL(primeiraParcelaValor)}</div>
                </div>
                <div class="highlight-card">
                    <div class="highlight-label">Parcela Mensal</div>
                    <div class="highlight-value">${formatBRL(result.parcelaPreContemplacao)}</div>
                </div>
            </div>

            <!-- INFORMAÇÕES DETALHADAS (2 Colunas) -->
            <div class="info-section">
                <!-- Coluna 1: Cliente e Consultor -->
                <div class="info-column">
                    <div class="section-header">Dados do Cliente</div>
                    <div class="info-row">
                        <span class="label">Nome:</span>
                        <span class="value">${pdfData.cliente || 'Não informado'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Consultor:</span>
                        <span class="value">${pdfData.vendedor || 'Recon'}</span>
                    </div>
                     <div class="info-row">
                        <span class="label">Contato:</span>
                        <span class="value">${pdfData.telefoneVendedor || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Data da Simulação:</span>
                        <span class="value">${formatDate()}</span>
                    </div>
                </div>

                <!-- Coluna 2: Detalhes Financeiros -->
                <div class="info-column">
                    <div class="section-header">Composição Financeira</div>
                    
                    <!-- TAXA DE ADMINISTRAÇÃO (Valor em R$, % no título) -->
                    <div class="info-row">
                        <span class="label">Taxa de Administração (${formatPct(pctTaxaAdmin)}):</span>
                        <span class="value">${formatBRL(result.taxaAdminValor)}</span>
                    </div>
                    
                    <!-- FUNDO DE RESERVA (Valor em R$, % no título) -->
                    <div class="info-row">
                        <span class="label">Fundo de Reserva (${formatPct(pctFundoReserva)}):</span>
                        <span class="value">${formatBRL(result.fundoReservaValor)}</span>
                    </div>

                    <!-- SEGURO DE VIDA (Condicional) -->
                    ${result.seguroMensal > 0 ? `
                    <div class="info-row">
                        <span class="label">Seguro de Vida:</span>
                        <span class="value">${formatSeguroPct(seguroPercentual)} ao mês</span>
                    </div>` : ''}

                    <!-- ADESÃO -->
                    <div class="info-row">
                        <span class="label">Adesão:</span>
                        <span class="value">${formatBRL(result.valorAdesao)}</span>
                    </div>

                    <!-- LINHA DE TOTALIZAÇÃO -->
                    <div class="info-row" style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
                        <span class="label" style="color: #1e3a8a; font-weight: 800;">Total:</span>
                        <span class="value" style="color: #1e3a8a; font-weight: 800;">${formatBRL(totalComposicao)}</span>
                    </div>
                </div>
            </div>

            <!-- SESSÃO DE LANCE (Condicional) -->
            ${result.lanceTotal > 0 ? `
            <div class="lance-box">
                <div class="section-header" style="border:none; text-align:center; margin-bottom:15px;">Composição da Oferta de Lance</div>
                <div class="lance-grid">
                    <div class="lance-item">
                        <div class="highlight-label">Recurso Próprio</div>
                        <div class="value">${formatBRL(input.lanceBolso)}</div>
                    </div>
                    <div class="lance-item">
                        <div class="highlight-label">Lance Embutido (${formatPct(input.lanceEmbutidoPct)})</div>
                        <div class="value">${formatBRL(result.creditoOriginal * input.lanceEmbutidoPct)}</div>
                    </div>
                    <!-- ITEM RENOMEADO: Carta de Avaliação (Sem quebra de linha) -->
                    <div class="lance-item">
                        <div class="highlight-label">Carta de Avaliação</div>
                        <div class="value">${formatBRL(input.lanceCartaVal)}</div>
                    </div>
                    <div class="lance-item">
                        <div class="highlight-label">Lance Total</div>
                        <div class="value" style="color:#1e3a8a;">${formatBRL(result.lanceTotal)}</div>
                    </div>
                </div>
                
                <!-- RODAPÉ DO LANCE -->
                <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="text-align: left;">
                         <span class="highlight-label" style="display:block; margin-bottom:4px; font-size:11px;">Crédito Líquido após a Contemplação:</span>
                         <span style="font-family: 'Montserrat', sans-serif; font-size: 16px; color: #1e3a8a; font-weight: 800;">${formatBRL(creditoLiquidoFinal)}</span>
                    </div>
                    <div style="text-align: right;">
                         <span class="label" style="font-size:10px;">Custo Total do Plano:</span>
                         <span class="value" style="display:block; font-size:12px;">${formatBRL(custoTotal)}</span>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- TABELA DE AMORTIZAÇÃO -->
            <div>
                <div class="section-header">Projeção Pós-Contemplação: ${cenarioTitulo}</div>
                <table>
                    <thead>
                        <tr>
                            <th class="text-center" width="15%">Mês da<br>Contemplação</th>
                            <th class="text-center" width="25%">Parcela<br>Prevista</th>
                            <th class="text-center" width="15%">Prazo<br>Restante</th>
                            <th class="text-right" width="45%">Situação da<br>amortização de Lance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>

            <!-- ALERTA DE MÚLTIPLAS COTAS -->
            ${quotaCount > 1 ? `
            <div class="quota-alert">
                <strong>Nota:</strong> Os valores acima representam uma consolidação de <strong>${quotaCount} cotas</strong>.
            </div>` : ''}

            <!-- RODAPÉ (Limpado e movido para o fundo) -->
            <div class="footer">
                <p>Este documento é uma simulação preliminar para fins de planejamento financeiro e não representa garantia de contemplação.<br/>
                Os valores podem sofrer alterações conforme as regras vigentes do grupo e assembleias.</p>
            </div>

        </div>
    </body>
    </html>
  `;
}