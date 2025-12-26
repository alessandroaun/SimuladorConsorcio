import { SimulationResult, SimulationInput, ContemplationScenario } from './ConsortiumCalculator';

// --- IMAGENS ---
// O expo-print lida bem com imagens remotas (HTTPS), não precisa converter para Base64
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
  const formatSeguroPct = (val: number) => `${(val * 100).toFixed(4).replace('.', ',').replace(/0+$/, '').replace(/,$/, '')}%`; 
  const formatDate = () => new Date().toLocaleDateString('pt-BR');
  
  const formatPhone = (phone: string) => {
    if (!phone) return 'Não informado';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) { 
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) { 
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)} ${cleaned.slice(6)}`;
    }
    return phone; 
  };

  // --- LÓGICA DE EXIBIÇÃO DE DADOS DO CLIENTE E CONSULTOR ---

  // 1. Cliente: Verifica se tem dados para mostrar ou ocultar
  const hasClienteName = !!pdfData.cliente && pdfData.cliente.trim() !== '';
  const hasClientePhone = !!pdfData.telefoneCliente && pdfData.telefoneCliente.trim() !== '';
  const showClientSection = hasClienteName || hasClientePhone;

  // 2. Consultor: Define telefone padrão se não informado
  const displayVendedorPhone = (pdfData.telefoneVendedor && pdfData.telefoneVendedor.trim() !== '') 
    ? formatPhone(pdfData.telefoneVendedor) 
    : '(35) 3539 8150';


  // --- 1. LÓGICA DE SELEÇÃO DE CENÁRIO E CRÉDITO LÍQUIDO ---
  let activeScenario: ContemplationScenario[];
  let cenarioTitulo = "Plano Padrão";
  let creditoLiquidoFinal = 0;
  
  // Verifica se é plano especial e define o cenário ativo
  const isSpecialPlan = result.plano === 'LIGHT' || result.plano === 'SUPERLIGHT';
  const isCaminho1Viable = result.cenarioCreditoReduzido !== null;

  if (isSpecialPlan && result.cenarioCreditoTotal) {
      if (mode === 'REDUZIDO' && isCaminho1Viable && result.cenarioCreditoReduzido) {
          activeScenario = result.cenarioCreditoReduzido;
          cenarioTitulo = "Crédito Reduzido";
          creditoLiquidoFinal = activeScenario[0].creditoEfetivo;
      } else {
          // Modo CHEIO ou fallback
          activeScenario = result.cenarioCreditoTotal;
          cenarioTitulo = "Crédito Total (100%)";
          creditoLiquidoFinal = activeScenario[0].creditoEfetivo;
      }
  } else {
      // Plano Normal
      activeScenario = result.cenariosContemplacao;
      cenarioTitulo = "Plano Padrão";
      creditoLiquidoFinal = result.creditoLiquido;
  }

  // --- 2. LÓGICA DE DISTRIBUIÇÃO DO LANCE ---
  let realPctAlocacaoParcela = 0;

  if (result.lanceTotal > 0 && activeScenario && activeScenario.length > 0) {
      const primeiroMesCenario = activeScenario[0];
      const reducaoMensalNaTabela = primeiroMesCenario.reducaoValor || 0;
      const mesContemplacao = primeiroMesCenario.mes;
      const prazoRestanteNoMomento = Math.max(1, input.prazo - mesContemplacao);
      const totalDinheiroUsadoNaParcela = reducaoMensalNaTabela * prazoRestanteNoMomento;
      realPctAlocacaoParcela = (totalDinheiroUsadoNaParcela / result.lanceTotal) * 100;
      realPctAlocacaoParcela = Math.min(100, Math.max(0, realPctAlocacaoParcela));
  } else {
      realPctAlocacaoParcela = input.percentualLanceParaParcela || 0;
  }

  const realPctAlocacaoPrazo = 100 - realPctAlocacaoParcela;

  // --- CÁLCULOS FINAIS DE CUSTO ---
  const fatorPlano = result.plano === 'LIGHT' ? 0.75 : result.plano === 'SUPERLIGHT' ? 0.50 : 1.0;
  const totalSeguroNoPrazo = result.seguroMensal * input.prazo;
  const lanceEmbutidoValor = result.lanceTotal - input.lanceBolso - result.lanceCartaVal; 

  const valorReducaoCreditoBase = (isSpecialPlan && mode === 'REDUZIDO') 
    ? (result.creditoOriginal * (1 - fatorPlano)) 
    : 0;

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
  
  // Porcentagens para exibição
  const seguroPercentual = result.creditoOriginal > 0 ? (result.seguroMensal / result.creditoOriginal) : 0;
  const totalSeguroVida = result.seguroMensal > 0 ? (result.seguroMensal * input.prazo) : 0;
  const totalComposicao = result.taxaAdminValor + result.fundoReservaValor + totalSeguroVida + result.valorAdesao;
  const pctTaxaAdmin = result.creditoOriginal > 0 ? (result.taxaAdminValor / result.creditoOriginal) : 0;
  const pctFundoReserva = result.creditoOriginal > 0 ? (result.fundoReservaValor / result.creditoOriginal) : 0;

  // Categoria Label e Título
  const getCategoryLabel = (tableId: string) => {
      const lowerId = tableId.toLowerCase();
      if (lowerId.includes('auto')) return 'AUTOMÓVEL';
      if (lowerId.includes('imovel')) return 'IMÓVEL';
      if (lowerId.includes('moto')) return 'MOTOCICLETA';
      if (lowerId.includes('servico')) return 'SERVIÇOS';
      return 'BEM';
  };
  const categoryLabel = getCategoryLabel(input.tableId);

  let titleCategory = 'Bem';
  if (categoryLabel === 'AUTOMÓVEL' || categoryLabel === 'MOTOCICLETA') {
      titleCategory = 'Veículo';
  } else if (categoryLabel === 'IMÓVEL') {
      titleCategory = 'Imóvel';
  } else if (categoryLabel === 'SERVIÇOS') {
      titleCategory = 'Serviços';
  }

  // Lances Pct
  const lanceTotalPct = result.creditoOriginal > 0 ? (result.lanceTotal / result.creditoOriginal) : 0;
  const lanceBolsoPct = result.creditoOriginal > 0 ? (input.lanceBolso / result.creditoOriginal) : 0;
  const lanceCartaPct = result.creditoOriginal > 0 ? (input.lanceCartaVal / result.creditoOriginal) : 0;

  // Gerar linhas da tabela
  const tableRows = activeScenario.map((scenario, index) => {
      const rowBackground = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `
      <tr style="background-color: ${rowBackground};">
          <td class="text-center py-2 text-gray-700 font-bold">${scenario.mes}</td>
          <td class="text-center py-2 text-blue-800 font-bold">${formatBRL(scenario.novaParcela)}</td>
          <td class="text-center py-2 text-gray-600">${Math.round(scenario.novoPrazo)}</td>
          <td class="text-right py-2 text-gray-500 text-xs">${scenario.amortizacaoInfo}</td>
      </tr>
  `}).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Simulação ${pdfData.cliente}</title>
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

            .page-container {
                width: 210mm;
                min-height: 297mm;
                margin: 0 auto;
                background: white;
                padding: 30px 40px;
                box-sizing: border-box;
                position: relative;
            }

            .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #1e3a8a;
                padding-bottom: 15px;
            }
            
            .logo {
                height: 85px;
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
                font-size: 12px;
                color: #64748b;
                margin-top: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

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
            .text-xs { font-size: 9px; }
            .font-bold { font-weight: 700; }
            .text-blue-800 { color: #1e40af; }
            .text-gray-500 { color: #64748b; }

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

            .footer {
                position: absolute;
                bottom: 15px;
                left: 40px;
                right: 40px;
                text-align: center;
                border-top: none;
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
            
            <div class="header">
                <img src="${LOGO_IMG}" class="logo" alt="Recon Consórcios" />
                <h1 class="doc-title">Proposta de Simulação</h1>
                <p class="doc-subtitle">
                    PLANO: <span style="color: #1e40af; font-weight: 800;">${categoryLabel}</span> ${result.creditoOriginal > 0 ? result.plano : ''}
                </p>
            </div>

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

            <div class="info-section">
                <div class="info-column">
                    
                    ${showClientSection ? `
                    <div class="section-header">Dados do Cliente</div>
                    ${hasClienteName ? `
                    <div class="info-row">
                        <span class="label">Nome:</span>
                        <span class="value">${pdfData.cliente}</span>
                    </div>` : ''}
                    ${hasClientePhone ? `
                    <div class="info-row">
                        <span class="label">Contato:</span>
                        <span class="value">${formatPhone(pdfData.telefoneCliente)}</span>
                    </div>` : ''}
                    <div style="height: 4px;"></div>
                    ` : ''}

                    <div class="section-header">Dados do Consultor</div>
                    <div class="info-row">
                        <span class="label">Nome:</span>
                        <span class="value">${pdfData.vendedor || 'Consórcio Nacional Recon'}</span>
                    </div>
                     <div class="info-row">
                        <span class="label">Contato:</span>
                        <span class="value">${displayVendedorPhone}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Data da Simulação:</span>
                        <span class="value">${formatDate()}</span>
                    </div>
                </div>

                <div class="info-column">
                    <div class="section-header">Composição Financeira</div>
                    
                    <div class="info-row">
                        <span class="label">Taxa de Administração (${formatPct(pctTaxaAdmin)}):</span>
                        <span class="value">${formatBRL(result.taxaAdminValor)}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="label">Fundo de Reserva (${formatPct(pctFundoReserva)}):</span>
                        <span class="value">${formatBRL(result.fundoReservaValor)}</span>
                    </div>

                    ${result.seguroMensal > 0 ? `
                    <div class="info-row">
                        <span class="label">Seguro de Vida:</span>
                        <span class="value">${formatSeguroPct(seguroPercentual)} ao mês</span>
                    </div>` : ''}

                    <div class="info-row">
                        <span class="label">Adesão:</span>
                        <span class="value">${formatBRL(result.valorAdesao)}</span>
                    </div>

                    <div class="info-row" style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
                        <span class="label" style="color: #1e3a8a; font-weight: 800;">Total:</span>
                        <span class="value" style="color: #1e3a8a; font-weight: 800;">${formatBRL(totalComposicao)}</span>
                    </div>
                </div>
            </div>

            <div class="lance-box">
                <div class="section-header" style="border:none; text-align:center; margin-bottom:10px;">Composição da Oferta de Lance</div>
                <div class="lance-grid">
                    <div class="lance-item">
                        <div class="highlight-label">Recurso Próprio (${formatPct(lanceBolsoPct)})</div>
                        <div class="value">${formatBRL(input.lanceBolso)}</div>
                    </div>
                    <div class="lance-item">
                        <div class="highlight-label">Lance Embutido (${formatPct(input.lanceEmbutidoPct)})</div>
                        <div class="value">${formatBRL(result.creditoOriginal * input.lanceEmbutidoPct)}</div>
                    </div>
                    <div class="lance-item">
                        <div class="highlight-label">Carta Avaliação (${formatPct(lanceCartaPct)})</div>
                        <div class="value">${formatBRL(input.lanceCartaVal)}</div>
                    </div>
                    <div class="lance-item">
                        <div class="highlight-label">
                            Lance Total <span style="color: #1e40af; font-weight: 800;">(${formatPct(lanceTotalPct)})</span>
                        </div>
                        <div class="value" style="color:#1e3a8a;">${formatBRL(result.lanceTotal)}</div>
                    </div>
                </div>
                
                ${result.lanceTotal > 0 ? `
                <div style="margin-top: 10px;">
                    <div style="font-size: 9px; color: #64748b; margin-bottom: 2px;">
                        Destinação do Lance: 
                        <strong>${realPctAlocacaoPrazo.toFixed(0)}% para Redução de Prazo</strong> | 
                        <strong>${realPctAlocacaoParcela.toFixed(0)}% para Redução de Parcela</strong>
                    </div>
                    <div class="allocation-bar-container">
                        <div class="alloc-segment" style="width: ${realPctAlocacaoPrazo}%; background-color: #059669;">
                           ${realPctAlocacaoPrazo > 15 ? 'PRAZO' : ''}
                        </div>
                        <div class="alloc-segment" style="width: ${realPctAlocacaoParcela}%; background-color: #2563EB;">
                           ${realPctAlocacaoParcela > 15 ? 'PARCELA' : ''}
                        </div>
                    </div>
                </div>
                ` : ''}

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

            ${quotaCount > 1 ? `
            <div class="quota-alert">
                <strong>Nota:</strong> Os valores acima representam uma consolidação de <strong>${quotaCount} cotas</strong>.
            </div>` : ''}

            <div class="footer">
                <p>Este documento é uma simulação preliminar para fins de planejamento financeiro e não representa garantia de contemplação.<br/>
                Os valores podem sofrer alterações conforme as regras vigentes do grupo e assembleias.</p>
            </div>

        </div>
    </body>
    </html>
  `;
}