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

  // Porcentagens de alocação do lance
  const pctAlocacaoParcela = input.percentualLanceParaParcela || 0;
  const pctAlocacaoPrazo = 100 - pctAlocacaoParcela;

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
                padding: 30px 40px; /* Reduzi um pouco o padding vertical para caber tudo */
                box-sizing: border-box;
                position: relative;
            }

            /* Cabeçalho */
            .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #1e3a8a; /* Azul Recon */
                padding-bottom: 15px;
            }
            
            .logo {
                height: 85px; /* Levemente reduzido */
                width: auto;
                margin-bottom: 10px;
            }
            
            .doc-title {
                font-family: 'Montserrat', sans-serif;
                font-size: 20px;
                font-weight: 800;
                color: #1e3a8a;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin: 0;
            }
            
            .doc-subtitle {
                font-size: 11px;
                color: #64748b;
                margin-top: 4px;
                text-transform: uppercase;
            }

            /* Seção de Destaques (Highlights) */
            .highlights-container {
                display: flex;
                justify-content: space-between;
                gap: 15px;
                margin-bottom: 25px;
                background-color: #f1f5f9;
                padding: 15px;
                border-radius: 12px;
            }

            .highlight-card {
                flex: 1;
                text-align: center;
                border-right: 1px solid #cbd5e1;
            }
            .highlight-card:last-child { border-right: none; }

            .highlight-label {
                font-size: 9px;
                text-transform: uppercase;
                color: #64748b;
                font-weight: 700;
                margin-bottom: 4px;
                letter-spacing: 0.5px;
            }

            .highlight-value {
                font-family: 'Montserrat', sans-serif;
                font-size: 16px;
                font-weight: 800;
                color: #1e3a8a;
            }
            
            .highlight-value.green { color: #15803d; }

            /* Grids de Informação */
            .info-section {
                display: flex;
                gap: 30px;
                margin-bottom: 20px;
            }

            .info-column {
                flex: 1;
            }

            .section-header {
                font-family: 'Montserrat', sans-serif;
                font-size: 11px;
                font-weight: 700;
                color: #1e3a8a;
                text-transform: uppercase;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 5px;
                margin-bottom: 8px;
            }

            .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                font-size: 10px;
            }

            .label { color: #64748b; font-weight: 600; }
            .value { color: #0f172a; font-weight: 700; text-align: right; }

            /* Box de Lance */
            .lance-box {
                border: 1px dashed #94a3b8;
                background-color: #f8fafc;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 20px;
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
                align-items: center; 
                justify-content: flex-start;
            }

            .allocation-bar-container {
                margin-top: 10px;
                background-color: #e2e8f0;
                border-radius: 4px;
                height: 14px;
                width: 100%;
                display: flex;
                overflow: hidden;
            }

            .alloc-segment {
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 8px;
                font-weight: 700;
                color: white;
            }
            
            /* Tabela */
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
            }
            
            thead th {
                background-color: #1e3a8a;
                color: white;
                font-family: 'Montserrat', sans-serif;
                font-size: 9px;
                font-weight: 700;
                text-transform: uppercase;
                padding: 6px 8px;
                text-align: center;
                vertical-align: middle;
            }
            
            td {
                font-size: 10px;
                padding: 6px 8px;
                border-bottom: 1px solid #e2e8f0;
            }

            .text-center { text-align: center; }
            .text-right { text-align: right; }
            
            /* Utilitários de Texto */
            .text-xs { font-size: 9px; }
            .font-bold { font-weight: 700; }
            .text-blue-800 { color: #1e40af; }
            .text-gray-500 { color: #64748b; }

            /* Informativo de Plano Especial */
            .plan-info-box {
                background-color: #eff6ff;
                border: 1px solid #bfdbfe;
                border-radius: 8px;
                padding: 10px;
                margin-bottom: 15px;
            }
            .plan-info-title {
                font-size: 10px;
                font-weight: 800;
                color: #1e40af;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            .plan-info-text {
                font-size: 9px;
                color: #334155;
                line-height: 1.3;
            }
            .plan-info-list {
                margin: 2px 0 0 12px;
                padding: 0;
            }
            .plan-info-highlight {
                color: #1e3a8a;
                font-weight: 700;
            }

            /* Rodapé */
            .footer {
                position: absolute;
                bottom: 15px;
                left: 40px;
                right: 40px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
                padding-top: 10px;
                font-size: 8px;
                color: #94a3b8;
            }
            
            .quota-alert {
                background-color: #fff7ed;
                color: #c2410c;
                border: 1px solid #ffedd5;
                padding: 6px;
                border-radius: 6px;
                font-size: 9px;
                text-align: center;
                margin-top: 5px;
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
                    <div class="highlight-label">Crédito Simulado</div>
                    <div class="highlight-value green">${formatBRL(result.creditoOriginal)}</div>
                </div>
                <div class="highlight-card">
                    <div class="highlight-label">Prazo Total</div>
                    <div class="highlight-value">${input.prazo} Meses</div>
                </div>
                <div class="highlight-card">
                    <div class="highlight-label">Parcela Inicial</div>
                    <div class="highlight-value">${formatBRL(primeiraParcelaValor)}</div>
                </div>
                <div class="highlight-card">
                    <div class="highlight-label">Demais Parcelas</div>
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
                    
                    <!-- TAXA DE ADMINISTRAÇÃO -->
                    <div class="info-row">
                        <span class="label">Taxa de Administração (${formatPct(pctTaxaAdmin)}):</span>
                        <span class="value">${formatBRL(result.taxaAdminValor)}</span>
                    </div>
                    
                    <!-- FUNDO DE RESERVA -->
                    <div class="info-row">
                        <span class="label">Fundo de Reserva (${formatPct(pctFundoReserva)}):</span>
                        <span class="value">${formatBRL(result.fundoReservaValor)}</span>
                    </div>

                    <!-- SEGURO DE VIDA -->
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
                <div class="section-header" style="border:none; text-align:center; margin-bottom:10px;">Composição da Oferta de Lance</div>
                <div class="lance-grid">
                    <div class="lance-item">
                        <div class="highlight-label">Recurso Próprio</div>
                        <div class="value">${formatBRL(input.lanceBolso)}</div>
                    </div>
                    <div class="lance-item">
                        <div class="highlight-label">Lance Embutido (${formatPct(input.lanceEmbutidoPct)})</div>
                        <div class="value">${formatBRL(result.creditoOriginal * input.lanceEmbutidoPct)}</div>
                    </div>
                    <div class="lance-item">
                        <div class="highlight-label">Carta Avaliação</div>
                        <div class="value">${formatBRL(input.lanceCartaVal)}</div>
                    </div>
                    <div class="lance-item">
                        <div class="highlight-label">Lance Total</div>
                        <div class="value" style="color:#1e3a8a;">${formatBRL(result.lanceTotal)}</div>
                    </div>
                </div>
                
                <!-- BARRA DE DESTINAÇÃO DO LANCE -->
                <div style="margin-top: 10px;">
                    <div style="font-size: 9px; color: #64748b; margin-bottom: 2px;">
                        Destinação do Lance: 
                        <strong>${pctAlocacaoPrazo.toFixed(0)}% para Redução de Prazo</strong> | 
                        <strong>${pctAlocacaoParcela.toFixed(0)}% para Redução de Parcela</strong>
                    </div>
                    <div class="allocation-bar-container">
                        <div class="alloc-segment" style="width: ${pctAlocacaoPrazo}%; background-color: #059669;">
                           ${pctAlocacaoPrazo > 15 ? 'PRAZO' : ''}
                        </div>
                        <div class="alloc-segment" style="width: ${pctAlocacaoParcela}%; background-color: #2563EB;">
                           ${pctAlocacaoParcela > 15 ? 'PARCELA' : ''}
                        </div>
                    </div>
                </div>

                <!-- RODAPÉ DO LANCE -->
                <div style="margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="text-align: left;">
                         <span class="highlight-label" style="display:block; margin-bottom:2px; font-size:9px;">Crédito Líquido após a Contemplação:</span>
                         <span style="font-family: 'Montserrat', sans-serif; font-size: 14px; color: #1e3a8a; font-weight: 800;">${formatBRL(creditoLiquidoFinal)}</span>
                    </div>
                    <div style="text-align: right;">
                         <span class="label" style="font-size:9px;">Custo Total do Plano:</span>
                         <span class="value" style="display:block; font-size:11px;">${formatBRL(custoTotal)}</span>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- INFORMATIVO PLANO ESPECIAL (NOVO) -->
            ${isSpecialPlan ? `
            <div class="plan-info-box">
                <div class="plan-info-title">Sobre o Plano ${result.plano}</div>
                <div class="plan-info-text">
                    Este plano oferece parcelas reduzidas de ${formatPct(fatorPlano)} até a contemplação. Ao ser contemplado, você deve escolher entre:
                    <ul class="plan-info-list">
                        <li><span class="plan-info-highlight">Opção 1 (Crédito Reduzido):</span> Recebe ${formatPct(fatorPlano)} do crédito contratado e mantém a parcela menor.</li>
                        <li><span class="plan-info-highlight">Opção 2 (Crédito Cheio):</span> Recebe 100% do crédito, porém a parcela é reajustada para cobrir a diferença.</li>
                    </ul>
                    <div style="margin-top: 4px; font-style: italic; color: #1e40af;">
                        * A tabela abaixo apresenta especificamente o cenário de <strong>${cenarioTitulo}</strong> selecionado nesta simulação.
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- TABELA DE AMORTIZAÇÃO -->
            <div>
                <div class="section-header">Projeção Pós-Contemplação</div>
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

            <!-- RODAPÉ -->
            <div class="footer">
                <p>Este documento é uma simulação preliminar para fins de planejamento financeiro e não representa garantia de contemplação.<br/>
                Os valores podem sofrer alterações conforme as regras vigentes do grupo e assembleias.</p>
            </div>

        </div>
    </body>
    </html>
  `;
}