import { SimulationResult, SimulationInput, ContemplationScenario } from './ConsortiumCalculator';

export const generateHTML = (
  result: SimulationResult, 
  input: SimulationInput, 
  mode: 'REDUZIDO' | 'CHEIO'
) => {
  
  // --- FORMATADORES ---
  const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPct = (val: number) => `${val.toFixed(2)}%`;
  const formatDate = () => new Date().toLocaleDateString('pt-BR');

  // --- LÓGICA DE DADOS DO CENÁRIO ---
  let activeScenario: ContemplationScenario[];
  let creditoConsiderado = result.creditoLiquido;
  let parcelaConsiderada = result.parcelaPreContemplacao;
  let cenarioTitulo = "Normal";
  
  const isSpecial = result.plano === 'LIGHT' || result.plano === 'SUPERLIGHT';

  if (isSpecial) {
      if (mode === 'REDUZIDO' && result.cenarioCreditoReduzido) {
          activeScenario = result.cenarioCreditoReduzido;
          creditoConsiderado = activeScenario[0].creditoEfetivo;
          cenarioTitulo = "Crédito Reduzido (Caminho 1)";
      } else if (result.cenarioCreditoTotal) {
          activeScenario = result.cenarioCreditoTotal;
          creditoConsiderado = activeScenario[0].creditoEfetivo;
          parcelaConsiderada = result.parcelaPosCaminho2; 
          cenarioTitulo = "Crédito Total - Parcela Reajustada (Caminho 2)";
      } else {
          activeScenario = result.cenariosContemplacao;
      }
  } else {
      activeScenario = result.cenariosContemplacao;
  }

  // --- CÁLCULOS DE PORCENTAGEM REVERSA (Para exibir na coluna de taxas) ---
  // Como temos apenas os valores absolutos no result, calculamos a % aproximada baseada no crédito original
  const pctTaxaAdmin = (result.taxaAdminValor / result.creditoOriginal) * 100;
  const pctFundoReserva = (result.fundoReservaValor / result.creditoOriginal) * 100;
  
  // Lances
  const lanceEmbutidoVal = result.lanceTotal - input.lanceBolso - result.lanceCartaVal;
  const lanceTotalPct = (result.lanceTotal / result.creditoOriginal) * 100;

  // Percentuais de alocação do lance (Intenção do usuário)
  const pctAbatidoPrazo = 100 - input.percentualLanceParaParcela;
  const pctAbatidoParcela = input.percentualLanceParaParcela;

  // --- GERAR LINHAS DA TABELA DE PREVISÃO ---
  const tableRows = activeScenario.map((cenario, index) => `
    <tr class="${index % 2 === 0 ? 'bg-gray' : ''}">
      <td style="text-align: center;">${cenario.mes}º</td>
      <td style="color: #166534; font-weight: bold;">${formatBRL(cenario.novaParcela)}</td>
      <td style="text-align: center;">${Math.round(cenario.novoPrazo)}x</td>
      <td style="font-size: 9px; color: #555;">${cenario.amortizacaoInfo}</td>
    </tr>
  `).join('');

  // --- HTML COMPLETO ---
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page { margin: 20px; }
          body { font-family: 'Arial', sans-serif; font-size: 10px; color: #333; line-height: 1.3; }
          
          /* LAYOUT */
          .container { width: 100%; max-width: 800px; margin: 0 auto; }
          .row { display: flex; width: 100%; }
          .col { flex: 1; padding: 5px; }
          .col-33 { width: 33.33%; float: left; padding: 5px; box-sizing: border-box; }
          
          /* CABEÇALHO */
          .header-box { border: 1px solid #000; padding: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
          .logo-area { font-size: 18px; font-weight: bold; color: #0F172A; text-transform: uppercase; }
          .slogan { font-size: 10px; color: #555; margin-top: 2px; }
          .date-area { text-align: right; font-size: 10px; }

          /* DADOS CLIENTE */
          .client-box { border: 1px solid #000; margin-bottom: 15px; }
          .client-row { border-bottom: 1px solid #ccc; display: flex; }
          .client-row:last-child { border-bottom: none; }
          .client-cell { flex: 1; padding: 5px 8px; border-right: 1px solid #ccc; }
          .client-cell:last-child { border-right: none; }
          .label { font-weight: bold; font-size: 9px; color: #000; text-transform: uppercase; }
          .field-value { font-size: 10px; margin-top: 2px; }

          /* GRADE DE 3 COLUNAS (PRODUTO | TAXAS | LANCES) */
          .main-grid { border: 1px solid #000; margin-bottom: 15px; overflow: hidden; }
          .grid-header { background-color: #0F172A; color: white; font-weight: bold; padding: 5px; text-align: center; text-transform: uppercase; font-size: 10px; }
          .grid-col { border-right: 1px solid #000; }
          .grid-col:last-child { border-right: none; }
          
          .data-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ddd; }
          .data-row:last-child { border-bottom: none; }
          .data-key { font-weight: bold; font-size: 9px; }
          .data-val { text-align: right; font-size: 9px; }
          
          /* PREVISÃO */
          .projection-box { border: 1px solid #000; margin-top: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th { background-color: #ccc; font-weight: bold; font-size: 9px; padding: 5px; border-bottom: 1px solid #000; text-align: left; }
          td { padding: 5px; font-size: 10px; border-bottom: 1px solid #eee; }
          .bg-gray { background-color: #f9f9f9; }

          .footer { margin-top: 30px; font-size: 8px; text-align: center; color: #777; border-top: 1px solid #ccc; padding-top: 5px; }
          
          /* UTILITÁRIOS DE COR */
          .text-blue { color: #0F172A; }
          .text-green { color: #166534; }
          .font-bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
            
            <!-- 1. CABEÇALHO -->
            <div class="header-box">
                <div>
                    <div class="logo-area">CONSÓRCIO RECON</div>
                    <div class="slogan">Junto com você em cada conquista.</div>
                </div>
                <div class="date-area">
                    <div>Data: ${formatDate()}</div>
                    <div style="margin-top:4px;">Representante: Consórcio Nacional Recon</div>
                </div>
            </div>

            <!-- 2. DADOS DO CLIENTE (LAYOUT FIXO) -->
            <div class="client-box">
                <div class="client-row">
                    <div class="client-cell">
                        <div class="label">Cliente:</div>
                        <div class="field-value">__________________________________________</div>
                    </div>
                    <div class="client-cell">
                        <div class="label">Telefone:</div>
                        <div class="field-value">(___) _____-____</div>
                    </div>
                </div>
                <div class="client-row">
                    <div class="client-cell">
                        <div class="label">Vendedor:</div>
                        <div class="field-value">__________________________________________</div>
                    </div>
                    <div class="client-cell">
                        <div class="label">Plano Selecionado:</div>
                        <div class="field-value font-bold">${result.plano} (${cenarioTitulo})</div>
                    </div>
                </div>
            </div>

            <!-- 3. BLOCO PRINCIPAL (3 COLUNAS) -->
            <div class="main-grid">
                <div style="display: flex;">
                    
                    <!-- COLUNA 1: PRODUTO -->
                    <div class="col grid-col">
                        <div class="grid-header">PRODUTO</div>
                        <div style="padding: 5px;">
                            <div class="data-row">
                                <span class="data-key">CRÉDITO ORIGINAL:</span>
                                <span class="data-val">${formatBRL(result.creditoOriginal)}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-key">PARCELA ATUAL:</span>
                                <span class="data-val text-blue font-bold">${formatBRL(parcelaConsiderada)}</span>
                            </div>
                             <div class="data-row">
                                <span class="data-key">PRAZO:</span>
                                <span class="data-val">${input.prazo} meses</span>
                            </div>
                            <div class="data-row" style="margin-top: 10px; border-top: 1px solid #000; padding-top: 5px;">
                                <span class="data-key">CRÉDITO LÍQUIDO:</span>
                                <span class="data-val font-bold" style="font-size: 11px;">${formatBRL(creditoConsiderado)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- COLUNA 2: TAXAS E SEGUROS -->
                    <div class="col grid-col">
                        <div class="grid-header">TAXAS E SEGUROS</div>
                        <div style="padding: 5px;">
                            <div class="data-row">
                                <span class="data-key">TAXA ADM (${pctTaxaAdmin.toFixed(2)}%):</span>
                                <span class="data-val">${formatBRL(result.taxaAdminValor)}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-key">FUNDO RESERVA (${pctFundoReserva.toFixed(0)}%):</span>
                                <span class="data-val">${formatBRL(result.fundoReservaValor)}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-key">SEGURO (MENSAL):</span>
                                <span class="data-val">${formatBRL(result.seguroMensal)}</span>
                            </div>
                             <div class="data-row">
                                <span class="data-key">ADESÃO:</span>
                                <span class="data-val">${formatBRL(result.valorAdesao)}</span>
                            </div>
                            <div class="data-row" style="margin-top: 10px; border-top: 1px solid #000; padding-top: 5px;">
                                <span class="data-key">CUSTO TOTAL:</span>
                                <span class="data-val font-bold">${formatBRL(result.custoTotal)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- COLUNA 3: LANCES -->
                    <div class="col grid-col">
                        <div class="grid-header">LANCES</div>
                        <div style="padding: 5px;">
                             <div class="data-row">
                                <span class="data-key">LANCE LIVRE (BOLSO):</span>
                                <span class="data-val">${formatBRL(input.lanceBolso)}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-key">LANCE EMBUTIDO:</span>
                                <span class="data-val">${formatBRL(lanceEmbutidoVal)}</span>
                            </div>
                             <div class="data-row">
                                <span class="data-key">CARTA AVALIAÇÃO:</span>
                                <span class="data-val">${formatBRL(result.lanceCartaVal)}</span>
                            </div>
                            <div class="data-row" style="border-bottom: 1px solid #000;">
                                <span class="data-key">TOTAL LANCE:</span>
                                <span class="data-val font-bold text-green">${formatBRL(result.lanceTotal)}</span>
                            </div>
                            <div class="data-row" style="margin-top: 5px;">
                                <span class="data-key">PERCENTUAL TOTAL:</span>
                                <span class="data-val font-bold">${formatPct(lanceTotalPct)}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- 4. ALOCAÇÃO DO LANCE -->
            ${result.lanceTotal > 0 ? `
            <div style="border: 1px solid #000; padding: 5px; margin-bottom: 15px; background-color: #f0f0f0;">
                <div style="display: flex; justify-content: space-around; font-size: 9px;">
                    <div>
                        <strong>DESTINO DO LANCE:</strong>
                    </div>
                    <div>
                        ABATIMENTO NO PRAZO: <strong>${formatPct(pctAbatidoPrazo)}</strong>
                    </div>
                    <div>
                        ABATIMENTO NA PARCELA: <strong>${formatPct(pctAbatidoParcela)}</strong>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- 5. TABELA DE PREVISÃO -->
            <div class="projection-box">
                <div class="grid-header" style="background-color: #334155;">PREVISÃO PÓS-CONTEMPLAÇÃO (PRÓXIMOS 5 MESES)</div>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: center;">MÊS</th>
                            <th>NOVA PARCELA</th>
                            <th style="text-align: center;">NOVO PRAZO</th>
                            <th>OBSERVAÇÃO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>

            <div class="footer">
                Documento gerado eletronicamente. Os valores apresentados são estimativas e podem sofrer alterações conforme as regras contratuais do grupo.
                <br/>Simulador Interno - Uso Exclusivo.
            </div>
        </div>
      </body>
    </html>
  `;
}