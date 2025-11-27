import { SimulationResult, SimulationInput, ContemplationScenario } from './ConsortiumCalculator';

// --- IMAGENS ---
const LOGO_IMG = "https://intranet.consorciorecon.com.br/media/photo/logo_4Y8K7jg.PNG"; // Mantenha sua URL ou Base64 aqui
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
  const formatPct = (val: number) => `${val.toFixed(2)}%`;
  const formatDate = () => new Date().toLocaleDateString('pt-BR');

  // --- LÓGICA DO CENÁRIO (Mantida intacta) ---
  let activeScenario: ContemplationScenario[];
  let creditoConsiderado = result.creditoLiquido;
  let cenarioTitulo = "Plano Padrão";
  
  const isSpecial = result.plano === 'LIGHT' || result.plano === 'SUPERLIGHT';

  if (isSpecial) {
      if (mode === 'REDUZIDO' && result.cenarioCreditoReduzido) {
          activeScenario = result.cenarioCreditoReduzido;
          creditoConsiderado = activeScenario[0].creditoEfetivo;
          cenarioTitulo = "Crédito Reduzido";
      } else if (result.cenarioCreditoTotal) {
          activeScenario = result.cenarioCreditoTotal;
          creditoConsiderado = activeScenario[0].creditoEfetivo;
          cenarioTitulo = "Crédito Cheio (Reajustado)";
      } else {
          activeScenario = result.cenariosContemplacao;
      }
  } else {
      activeScenario = result.cenariosContemplacao;
  }

  const totalLanceGrafico = result.lanceTotal > 0 ? result.lanceTotal : 1; 
  const pctTaxaAdmin = (result.taxaAdminValor / result.creditoOriginal) * 100;
  const pctFundoReserva = (result.fundoReservaValor / result.creditoOriginal) * 100;

  // Tabela Otimizada Visualmente
  const tableRows = activeScenario.slice(0, 12).map((c, i) => `
    <tr class="${i % 2 !== 0 ? 'row-alt' : ''}">
        <td class="text-center font-bold text-dark">${c.mes}º</td>
        <td class="text-primary font-bold">${formatBRL(c.novaParcela)}</td>
        <td class="text-center text-dark">${Math.round(c.novoPrazo)}x</td>
        <td class="text-xs text-muted" style="text-align: right;">${c.amortizacaoInfo}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Simulação de Consórcio</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;800&family=Open+Sans:wght@400;600&display=swap');
            
            :root {
                --primary: #003366; /* Azul Escuro Institucional */
                --accent: #00a859;  /* Verde Recon/Dinheiro */
                --highlight: #2563eb; /* Azul Vibrante */
                --text: #1e293b;
                --text-muted: #64748b;
                --bg-light: #f8fafc;
                --border: #e2e8f0;
            }

            body { 
                font-family: 'Open Sans', sans-serif; 
                margin: 0; 
                padding: 0; 
                color: var(--text); 
                background: #fff;
                -webkit-print-color-adjust: exact;
            }
            
            /* PAGE SETUP */
            .page {
                width: 210mm;
                min-height: 297mm;
                padding: 10mm 15mm;
                margin: 0 auto;
                position: relative;
                box-sizing: border-box;
                border-top: 8px solid var(--primary); /* Identidade visual no topo */
            }

            /* WATERMARK */
            .watermark {
                position: absolute;
                top: 55%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 70%;
                opacity: 0.03;
                z-index: 0;
            }

            .content { position: relative; z-index: 10; }

            /* HEADER REDESENHADO */
            .header {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                margin-bottom: 25px;
                text-align: center;
            }
            .logo { 
                height: 85px; /* Aumentado conforme solicitado */
                margin-bottom: 12px;
                object-fit: contain;
            }
            .header-title { 
                font-family: 'Montserrat', sans-serif; 
                font-size: 24px; 
                font-weight: 800; 
                color: var(--primary); 
                text-transform: uppercase; 
                letter-spacing: -0.5px; 
            }
            .header-sub { 
                font-size: 11px; 
                color: var(--text-muted); 
                margin-top: 4px; 
                text-transform: uppercase; 
                letter-spacing: 2px;
            }

            /* INFO BAR CLEAN */
            .info-container {
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid var(--border);
                border-top: 1px solid var(--border);
                padding: 12px 5px;
                margin-bottom: 25px;
                background-color: #fafafa;
            }
            .info-box { width: 48%; }
            .info-label { font-size: 8px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }
            .info-val { font-family: 'Montserrat', sans-serif; font-size: 13px; color: var(--text); font-weight: 600; }

            /* GRID DE CARDS */
            .main-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .card {
                background: #fff;
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 15px;
                position: relative;
                box-shadow: 0 2px 5px rgba(0,0,0,0.03);
            }
            
            /* Bordas Coloridas Laterais para Identidade Visual */
            .card-credit { border-left: 5px solid var(--accent); }
            .card-costs  { border-left: 5px solid var(--primary); }
            .card-bid    { border-left: 5px solid #8b5cf6; } /* Roxo para destaque */

            .card-title {
                font-family: 'Montserrat', sans-serif;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                color: var(--text-muted);
                margin-bottom: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .card-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                font-size: 10px;
                border-bottom: 1px dashed #f1f5f9;
                padding-bottom: 2px;
            }
            .card-row:last-child { border-bottom: none; margin-bottom: 0; }
            
            .key { color: var(--text-muted); font-weight: 500; }
            .val { color: var(--text); font-weight: 700; }
            
            .big-number {
                font-family: 'Montserrat', sans-serif;
                font-size: 20px;
                font-weight: 800;
                color: var(--accent);
                display: block;
                margin-top: 2px;
                margin-bottom: 10px;
            }
            
            .total-cost-val { color: var(--primary); font-size: 14px; font-weight: 800; }
            .total-bid-val { color: #8b5cf6; font-size: 14px; font-weight: 800; }

            /* TAGS */
            .badge {
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 8px;
                font-weight: 800;
                text-transform: uppercase;
            }
            .bg-light-blue { background: #e0f2fe; color: #0369a1; }
            .bg-light-green { background: #dcfce7; color: #15803d; }

            /* ALLOCATION BAR */
            .allocation-bar {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 10px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            .alloc-text { font-size: 10px; font-weight: 600; color: #475569; }
            .alloc-highlight { color: var(--primary); font-weight: 800; }

            /* TABLE STYLING */
            .table-wrapper {
                border: 1px solid var(--border);
                border-radius: 8px;
                overflow: hidden;
                margin-bottom: 20px;
            }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { 
                background: #f1f5f9; 
                color: var(--text); 
                padding: 10px; 
                text-align: left; 
                font-family: 'Montserrat', sans-serif;
                font-weight: 700; 
                text-transform: uppercase; 
                font-size: 8px;
                border-bottom: 2px solid #e2e8f0;
            }
            td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
            .row-alt { background: #fafafa; }
            
            .text-center { text-align: center; }
            .text-primary { color: var(--primary); }
            .text-muted { color: #94a3b8; }
            .font-bold { font-weight: 700; }
            .text-xs { font-size: 8px; }

            /* FOOTER */
            .footer {
                text-align: center;
                border-top: 1px solid var(--border);
                padding-top: 15px;
                margin-top: auto;
            }
            .footer p { margin: 2px 0; font-size: 8px; color: #94a3b8; }
            
            .note-box {
                margin-top: 10px;
                padding: 8px;
                background: #fffbeb;
                border: 1px solid #fcd34d;
                border-radius: 4px;
                color: #b45309;
                font-size: 9px;
                text-align: center;
            }

        </style>
      </head>
      <body>
        <div class="page">
            <img src="${WATERMARK_IMG}" class="watermark" />
            
            <div class="content">
                
                <div class="header">
                    <img src="${LOGO_IMG}" class="logo" alt="Logo" />
                    <div class="header-title">Proposta Comercial</div>
                    <div class="header-sub">Simulação de Consórcio • ${formatDate()}</div>
                </div>

                <div class="info-container">
                    <div class="info-box">
                        <div class="info-label">Cliente</div>
                        <div class="info-val">${pdfData.cliente || 'Nome do Cliente'}</div>
                        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${pdfData.telefoneCliente || ''}</div>
                    </div>
                    <div class="info-box" style="text-align: right;">
                        <div class="info-label">Consultor</div>
                        <div class="info-val">${pdfData.vendedor || 'Representante Autorizado'}</div>
                        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${pdfData.telefoneVendedor || ''}</div>
                    </div>
                </div>

                <div class="main-grid">
                    
                    <div class="card card-credit">
                        <div class="card-title">
                            <span>Plano & Crédito</span>
                            <span class="badge bg-light-green">${result.plano}</span>
                        </div>
                        
                        <div style="margin-bottom: 10px;">
                            <span class="key" style="font-size: 9px;">CRÉDITO LÍQUIDO</span>
                            <span class="big-number">${formatBRL(creditoConsiderado)}</span>
                        </div>

                        <div class="card-row">
                            <span class="key">Crédito Original</span>
                            <span class="val">${formatBRL(result.creditoOriginal)}</span>
                        </div>
                        <div class="card-row">
                            <span class="key">Parcela Cheia</span>
                            <span class="val font-bold">${formatBRL(result.parcelaPreContemplacao)}</span>
                        </div>
                         <div class="card-row">
                            <span class="key">Prazo</span>
                            <span class="val">${input.prazo} Meses</span>
                        </div>
                        ${isSpecial ? `
                        <div class="card-row">
                            <span class="key">Opção</span>
                            <span class="val" style="color: var(--highlight);">${cenarioTitulo}</span>
                        </div>` : ''}
                    </div>

                    <div class="card card-costs">
                        <div class="card-title">
                            <span>Taxas & Seguros</span>
                            <span class="badge bg-light-blue">Detalhes</span>
                        </div>
                        <div class="card-row">
                            <span class="key">Taxa Adm. (${formatPct(pctTaxaAdmin)})</span>
                            <span class="val">${formatBRL(result.taxaAdminValor)}</span>
                        </div>
                        <div class="card-row">
                            <span class="key">Fundo Res. (${formatPct(pctFundoReserva)})</span>
                            <span class="val">${formatBRL(result.fundoReservaValor)}</span>
                        </div>
                        <div class="card-row">
                            <span class="key">Seguro (Mês)</span>
                            <span class="val">${formatBRL(result.seguroMensal)}</span>
                        </div>
                        <div class="card-row">
                            <span class="key">Adesão</span>
                            <span class="val">${formatBRL(result.valorAdesao)}</span>
                        </div>
                         <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                            <span class="key" style="display:block; font-size: 8px; margin-bottom: 2px;">CUSTO TOTAL</span>
                            <span class="total-cost-val">${formatBRL(result.custoTotal)}</span>
                        </div>
                    </div>

                    <div class="card card-bid">
                        <div class="card-title">
                            <span>Composição de Lance</span>
                        </div>
                        <div class="card-row">
                            <span class="key">Recurso Próprio</span>
                            <span class="val">${formatBRL(input.lanceBolso)}</span>
                        </div>
                        <div class="card-row">
                            <span class="key">Lance Embutido</span>
                            <span class="val">${formatBRL(result.lanceTotal - input.lanceBolso - result.lanceCartaVal)}</span>
                        </div>
                        <div class="card-row">
                            <span class="key">Carta Avaliação</span>
                            <span class="val">${formatBRL(result.lanceCartaVal)}</span>
                        </div>
                         <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                            <span class="key" style="display:block; font-size: 8px; margin-bottom: 2px;">LANCE TOTAL OFERTADO</span>
                            <span class="total-bid-val">${formatBRL(result.lanceTotal)}</span>
                        </div>
                    </div>
                </div>

                ${result.lanceTotal > 0 ? `
                <div class="allocation-bar">
                    <span class="alloc-text">DESTINO DO LANCE:</span>
                    <span class="alloc-text">Reduzir Prazo: <span class="alloc-highlight">${input.percentualLanceParaParcela < 100 ? `${(100 - input.percentualLanceParaParcela).toFixed(0)}%` : '0%'}</span></span>
                    <span class="alloc-text">Reduzir Parcela: <span class="alloc-highlight">${input.percentualLanceParaParcela.toFixed(0)}%</span></span>
                </div>` : ''}

                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="text-center" style="width: 15%;">Mês</th>
                                <th style="width: 30%;">Nova Parcela Prevista</th>
                                <th class="text-center" style="width: 15%;">Prazo Restante</th>
                                <th style="text-align: right; width: 40%;">Situação / Amortização</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                
                ${quotaCount > 1 ? `
                <div class="note-box">
                    <strong>Atenção:</strong> Os valores acima representam a soma de <strong>${quotaCount} cotas</strong> simuladas em conjunto.
                </div>` : ''}

                <div class="footer">
                    <p>Este documento é uma simulação preliminar e não garante contemplação. Valores sujeitos a alteração conforme tabela vigente.</p>
                    <p>Recon Consórcios © ${new Date().getFullYear()} - Documento Gerado em ${formatDate()}</p>
                </div>
            </div>
        </div>
      </body>
    </html>
  `;
}