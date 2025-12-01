import { TableMetadata, PlanType } from '../../data/TableRepository';

export type InstallmentType = 'C/SV' | 'S/SV';

export interface SimulationInput {
  tableId: string;
  credito: number;
  prazo: number;
  tipoParcela: InstallmentType;
  lanceBolso: number;
  lanceEmbutidoPct: number;
  lanceCartaVal: number;
  taxaAdesaoPct: number;
  percentualLanceParaParcela: number; // 0 a 100
  mesContemplacao: number; 
}

export interface ContemplationScenario {
  mes: number;
  mesRelativo: number;
  novoPrazo: number;
  parcelasAbatidas: number;
  novaParcela: number;
  amortizacaoInfo: string;
  creditoEfetivo: number;
  reducaoValor?: number;
  reducaoPorcentagem?: number;
}

export interface SimulationResult {
  parcelaPreContemplacao: number;
  custoTotal: number;
  custoTotalReduzido?: number;
  custoTotalCheio?: number;
  taxaAdminValor: number;
  fundoReservaValor: number;
  seguroMensal: number;
  valorAdesao: number;
  totalPrimeiraParcela: number;
  creditoOriginal: number;
  creditoLiquido: number;
  lanceTotal: number;
  plano: PlanType;
  lanceCartaVal: number; 
  cenariosContemplacao: ContemplationScenario[]; 
  cenarioCreditoReduzido: ContemplationScenario[] | null; 
  cenarioCreditoTotal: ContemplationScenario[] | null;    
  parcelaPosCaminho2: number; 
}

export class ConsortiumCalculator {

  /**
   * Calcula a projeção linha a linha (Mês 1, Mês 2...) com base nas regras específicas.
   */
  private static calculateProjection(
    input: SimulationInput,
    tableMeta: TableMetadata,
    parcelaTabela: number,      // Parcela "crua" da tabela (reduzida se for Light/SL)
    creditoEfetivo: number,     // Crédito que o cliente pega na mão (Reduzido ou Cheio)
    gapParaCaminho2: number,    // Diferença de crédito para somar (Usado especificamente no Auto Super Light)
    lanceTotal: number,
    isCaminho2: boolean         // Flag para saber se é o Caminho 2 (Crédito Cheio)
  ): ContemplationScenario[] {

    const cenarios: ContemplationScenario[] = [];
    // Proteção contra NaN nas entradas
    const mesInicial = Math.max(1, input.mesContemplacao || 1);
    const prazoTotalInput = input.prazo || 1;
    
    // Fator para converter Parcela Reduzida -> Parcela Cheia
    let fatorPlano = 1.0;
    if (tableMeta.plan === 'LIGHT') fatorPlano = 0.75;
    if (tableMeta.plan === 'SUPERLIGHT') fatorPlano = 0.50;

    // Loop para gerar 5 linhas de previsão
    for (let i = 0; i < 5; i++) {
        const mesSimulacao = mesInicial + i;
        
        // Se ultrapassou o prazo total, para.
        if (mesSimulacao > prazoTotalInput) break;

        // 1. Definição do Prazo Restante neste mês
        const prazoRestante = Math.max(1, prazoTotalInput - mesSimulacao);

        // 2. Definição da Parcela Base neste mês (Antes do Lance)
        let parcelaBase = parcelaTabela || 0;

        if (isCaminho2) {
            // LÓGICA ESPECÍFICA AUTO SUPER LIGHT
            if (gapParaCaminho2 > 0) {
                const acrescimoGap = gapParaCaminho2 / prazoRestante;
                parcelaBase = parcelaTabela + acrescimoGap;
            } 
            // LÓGICA PADRÃO
            else if (fatorPlano > 0 && fatorPlano < 1.0) {
                parcelaBase = parcelaTabela / fatorPlano;
            }
        }

        // 3. Definição do Limite de 40%
        const tetoReducao = parcelaBase * 0.40;

        // 4. Aplicação do Lance
        let novaParcela = parcelaBase;
        let novoPrazo = prazoRestante;
        let info = "";
        let reducaoValor = 0;
        let reducaoPct = 0;

        if (lanceTotal > 0) {
            // Separação do dinheiro - Proteção contra NaN vindo do input
            const rawPct = input.percentualLanceParaParcela;
            const safePct = (isNaN(rawPct) || rawPct === null) ? 0 : rawPct;
            
            const pctDestinoParcela = Math.min(100, Math.max(0, safePct));
            const valorLanceParaParcela = lanceTotal * (pctDestinoParcela / 100);
            const valorLanceParaPrazo = lanceTotal - valorLanceParaParcela; 

            // --- CÁLCULO REDUÇÃO PARCELA ---
            let reducaoCalculada = valorLanceParaParcela / prazoRestante;
            
            // Verifica Teto 40%
            let reducaoEfetiva = reducaoCalculada;
            let sobraPorTeto = 0;

            if (reducaoCalculada > tetoReducao) {
                reducaoEfetiva = tetoReducao;
                // A diferença volta para o bolo do prazo
                const valorUsado = reducaoEfetiva * prazoRestante;
                sobraPorTeto = Math.max(0, valorLanceParaParcela - valorUsado);
                info = "Redução no Valor da Parcela Limitado 40% da parcela atual (Excedente está descontando no Prazo)";
            } else {
                info = pctDestinoParcela > 0 ? "Redução no Valor de Parcela Aplicada" : "Redução no Prazo Restante Aplicada";
            }

            // Aplica redução na parcela
            if (reducaoEfetiva >= parcelaBase) {
                 novaParcela = 0;
            } else {
                 novaParcela = Math.max(0, parcelaBase - reducaoEfetiva);
            }

            reducaoValor = reducaoEfetiva;
            reducaoPct = parcelaBase > 0 ? (reducaoEfetiva / parcelaBase) * 100 : 0;

            // --- CÁLCULO REDUÇÃO PRAZO ---
            // Dinheiro disponível para prazo = Parte Original + Sobra do Teto 40%
            const totalDinheiroPrazo = valorLanceParaPrazo + sobraPorTeto;

            // Quantas parcelas NOVAS esse dinheiro paga?
            let parcelasAbatidas = 0;
            if (novaParcela > 0.01) {
                parcelasAbatidas = totalDinheiroPrazo / novaParcela;
            } else {
                parcelasAbatidas = prazoRestante; // Quitado
            }
            
            // Garante que parcelasAbatidas não seja infinito ou NaN
            if (!isFinite(parcelasAbatidas)) parcelasAbatidas = 0;

            novoPrazo = Math.max(0, prazoRestante - parcelasAbatidas);
            
            if (novoPrazo < 0.1) info = "Quitado";
        }

        // Adiciona ao array
        cenarios.push({
            mes: mesSimulacao,
            mesRelativo: i + 1,
            novoPrazo: novoPrazo || 0, // Fallback
            parcelasAbatidas: Math.max(0, prazoRestante - novoPrazo),
            novaParcela: novaParcela || 0,
            amortizacaoInfo: info || "Normal",
            creditoEfetivo: creditoEfetivo || 0,
            reducaoValor: reducaoValor || 0,
            reducaoPorcentagem: reducaoPct || 0
        });
    }

    return cenarios;
  }

  static calculate(input: SimulationInput, tableMeta: TableMetadata, rawParcela: number): SimulationResult {
    // Sanitização de entradas principais
    const credito = input.credito || 0;
    const prazo = input.prazo || 1;
    const lanceEmbutidoPct = input.lanceEmbutidoPct || 0;
    const lanceBolso = input.lanceBolso || 0;
    const lanceCartaVal = input.lanceCartaVal || 0;
    const taxaAdesaoPct = input.taxaAdesaoPct || 0;
    const tipoParcela = input.tipoParcela;

    // --- Valores Fixos ---
    const seguroRate = tipoParcela === 'C/SV' ? tableMeta.seguroPct : 0;
    const seguroMensal = credito * seguroRate;
    const taxaAdminValor = credito * tableMeta.taxaAdmin;
    const fundoReservaValor = credito * tableMeta.fundoReserva;
    const valorAdesao = credito * taxaAdesaoPct;

    const lanceEmbutidoValor = credito * lanceEmbutidoPct;
    const lanceTotal = lanceBolso + lanceEmbutidoValor + lanceCartaVal; 
    const totalPrimeiraParcela = (rawParcela || 0) + valorAdesao;

    // Fatores de Plano
    let fatorPlano = 1.0;
    if (tableMeta.plan === 'LIGHT') fatorPlano = 0.75;
    if (tableMeta.plan === 'SUPERLIGHT') fatorPlano = 0.50;

    // 1. CÁLCULO PLANO NORMAL
    if (tableMeta.plan === 'NORMAL') {
        const creditoLiquido = credito - lanceEmbutidoValor - lanceCartaVal;
        const custoTotal = (rawParcela || 0) * prazo; 

        const cenarios = ConsortiumCalculator.calculateProjection(
            input,
            tableMeta,
            rawParcela || 0,
            creditoLiquido,
            0, // Sem gap
            lanceTotal,
            false
        );

        return {
          parcelaPreContemplacao: rawParcela || 0,
          custoTotal,
          custoTotalReduzido: custoTotal,
          custoTotalCheio: custoTotal,
          taxaAdminValor,
          fundoReservaValor,
          seguroMensal,
          valorAdesao,
          totalPrimeiraParcela,
          creditoOriginal: credito,
          creditoLiquido,
          lanceTotal,
          plano: tableMeta.plan,
          lanceCartaVal,
          cenariosContemplacao: cenarios,
          cenarioCreditoReduzido: null,
          cenarioCreditoTotal: null,
          parcelaPosCaminho2: 0
        };
    } 
    
    // 2. CÁLCULO PLANOS LIGHT / SUPERLIGHT (AUTO & IMOVEL)
    else {
        const mesRef = Math.max(1, input.mesContemplacao || 1);
        const prazoRestanteRef = Math.max(1, prazo - mesRef);

        // --- CAMINHO 1: CRÉDITO REDUZIDO ---
        const creditoBaseReduzido = credito * fatorPlano;
        const creditoLiquidoReduzido = creditoBaseReduzido - lanceEmbutidoValor - lanceCartaVal;
        
        let cenarioReduzido: ContemplationScenario[] | null = null;
        let custoTotalReduzido = 0;

        const isCaminho1Viavel = (creditoLiquidoReduzido > 0) && (lanceTotal < creditoBaseReduzido);

        if (isCaminho1Viavel) {
             cenarioReduzido = ConsortiumCalculator.calculateProjection(
                input,
                tableMeta,
                rawParcela || 0, // Parcela Reduzida
                creditoLiquidoReduzido,
                0, // Sem Gap
                lanceTotal,
                false
            );
            // Custo C1
            custoTotalReduzido = ((rawParcela || 0) * mesRef) + ((rawParcela || 0) * prazoRestanteRef); 
        }

        // --- CAMINHO 2: CRÉDITO CHEIO ---
        const creditoLiquidoCheio = credito - lanceEmbutidoValor - lanceCartaVal;
        
        let gapParaCaminho2 = 0;
        let parcelaReajustadaDisplay = 0;

        const isAutoSuperLight = tableMeta.category === 'AUTO' && tableMeta.plan === 'SUPERLIGHT';

        if (isAutoSuperLight) {
             gapParaCaminho2 = credito * (1 - fatorPlano);
             const acrescimoDisplay = gapParaCaminho2 / prazoRestanteRef;
             parcelaReajustadaDisplay = (rawParcela || 0) + acrescimoDisplay;
        } else {
             if (fatorPlano > 0) {
                parcelaReajustadaDisplay = (rawParcela || 0) / fatorPlano;
             }
        }

        const cenarioCheio = ConsortiumCalculator.calculateProjection(
            input,
            tableMeta,
            rawParcela || 0, // Passamos a reduzida
            creditoLiquidoCheio,
            gapParaCaminho2, 
            lanceTotal,
            true // Flag Caminho 2
        );

        const custoTotalCheio = ((rawParcela || 0) * mesRef) + (parcelaReajustadaDisplay * prazoRestanteRef);

        const cenarioDefault = cenarioReduzido ? cenarioReduzido : cenarioCheio;
        const creditoLiquidoDefault = cenarioReduzido ? creditoLiquidoReduzido : creditoLiquidoCheio;
        const custoTotalDefault = cenarioReduzido ? custoTotalReduzido : custoTotalCheio;

        return {
            parcelaPreContemplacao: rawParcela || 0,
            custoTotal: custoTotalDefault,
            custoTotalReduzido,
            custoTotalCheio,
            taxaAdminValor,
            fundoReservaValor,
            seguroMensal,
            valorAdesao,
            totalPrimeiraParcela,
            creditoOriginal: credito,
            creditoLiquido: creditoLiquidoDefault, 
            lanceTotal,
            plano: tableMeta.plan,
            lanceCartaVal,
            cenariosContemplacao: cenarioDefault, 
            cenarioCreditoReduzido: cenarioReduzido,
            cenarioCreditoTotal: cenarioCheio,
            parcelaPosCaminho2: parcelaReajustadaDisplay 
        };
    }
  }

  static validate(input: SimulationInput, tableMeta: TableMetadata): string | null {
    const lanceEmbutidoPct = input.lanceEmbutidoPct || 0;
    
    if (lanceEmbutidoPct > tableMeta.maxLanceEmbutido) {
      return `Máximo de lance embutido: ${(tableMeta.maxLanceEmbutido * 100).toFixed(0)}%`;
    }
    if (!input.credito || input.credito <= 0) return "Valor de crédito inválido.";
    
    const lanceEmbVal = input.credito * lanceEmbutidoPct;
    const totalLances = (input.lanceBolso || 0) + lanceEmbVal + (input.lanceCartaVal || 0);
    
    const creditoTotalLiquido = input.credito - lanceEmbVal - (input.lanceCartaVal || 0);
    if (creditoTotalLiquido < 0) {
       return `Atenção: A soma dos lances supera o valor total do crédito. Simulação inviável.`;
    }

    if (totalLances >= input.credito) {
      return "A soma dos lances não pode ser igual ou maior que o crédito total.";
    }

    return null;
  }
}