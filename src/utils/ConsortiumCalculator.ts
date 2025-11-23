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
  
  // Define a INTENÇÃO do usuário: Quanto % do lance ele QUER usar para reduzir parcela.
  percentualLanceParaParcela: number; // 0 a 100
  
  mesContemplacao: number; 
}

// Interface de Cenário de Amortização
export interface ContemplationScenario {
  mes: number;
  mesRelativo: number;
  novoPrazo: number; // Mantemos float para precisão interna
  parcelasAbatidas: number; // Novo campo para mostrar o abatimento
  novaParcela: number;
  amortizacaoInfo: string;
  creditoEfetivo: number; // Crédito líquido que o cliente irá receber neste cenário
}

// Interface de Resultado
export interface SimulationResult {
  parcelaPreContemplacao: number;
  custoTotal: number;
  taxaAdminValor: number;
  fundoReservaValor: number;
  seguroMensal: number;
  valorAdesao: number;
  totalPrimeiraParcela: number;
  creditoOriginal: number;
  
  // Campos padrão (usados pelo NORMAL e como fallback)
  creditoLiquido: number;
  lanceTotal: number;
  plano: PlanType;
  lanceCartaVal: number; 
  cenariosContemplacao: ContemplationScenario[]; // Usado para o plano NORMAL

  // NOVOS CAMPOS PARA LIGHT/SUPERLIGHT
  // Se null, significa que é plano NORMAL
  cenarioCreditoReduzido: ContemplationScenario[] | null; // Caminho 1
  cenarioCreditoTotal: ContemplationScenario[] | null;    // Caminho 2
  parcelaPosCaminho2: number; // Parcela reajustada do caminho 2 (Baseada no mês de contemplação informado)
}

export class ConsortiumCalculator {

  /**
   * Função auxiliar para calcular o cenário de amortização.
   * Agora aceita 'saldoDevedorReajuste' para aplicar a lógica do Caminho 2 (Light/Superlight).
   */
  private static calculateAmortizationScenario(
    input: SimulationInput, 
    baseParcelaAmortizacao: number,
    creditoEfetivoBase: number,
    prazoTotal: number,
    lanceTotal: number,
    saldoDevedorReajuste: number = 0 // NOVO PARÂMETRO: Valor a ser adicionado ao saldo devedor (Gap do plano)
  ): ContemplationScenario[] {
    
    const { percentualLanceParaParcela, mesContemplacao } = input;
    const cenarios: ContemplationScenario[] = [];
    const mesInicial = mesContemplacao > 0 ? mesContemplacao : 1;

    for (let i = 0; i < 5; i++) {
      const mesAtual = mesInicial + i;
      
      if (mesAtual > prazoTotal) break;

      const prazoTotalRestante = prazoTotal - mesAtual; 
      
      // --- LÓGICA DE REAJUSTE DO CAMINHO 2 ---
      // Se houver saldo a ser incorporado (ex: os 25% ou 50% restantes), divide pelo prazo restante e soma à parcela.
      let parcelaBaseParaCalculo = baseParcelaAmortizacao;
      
      if (saldoDevedorReajuste > 0 && prazoTotalRestante > 0) {
          const acrescimoMensal = saldoDevedorReajuste / prazoTotalRestante;
          parcelaBaseParaCalculo = baseParcelaAmortizacao + acrescimoMensal;
      }
      // ---------------------------------------

      let novaParcela = parcelaBaseParaCalculo;
      let novoPrazo = prazoTotalRestante;
      let parcelasAbatidas = 0;
      let amortizacaoInfo = "";
      
      let reducaoMensalEfetiva: number;

      if (lanceTotal === 0) {
        amortizacaoInfo = "Sem Lance";
        novaParcela = parcelaBaseParaCalculo;
        novoPrazo = prazoTotalRestante;
        reducaoMensalEfetiva = 0;
      } else {
        const lanceIntencionalParaParcela = lanceTotal * (percentualLanceParaParcela / 100);
        // A redução máxima de 40% é aplicada sobre a parcela JÁ reajustada (se for o caso) ou original?
        // Geralmente é sobre a parcela vigente.
        const reducaoMaximaMensal = parcelaBaseParaCalculo * 0.40;
        
        if (prazoTotalRestante <= 0) {
            reducaoMensalEfetiva = 0; 
        } else {
            const reducaoMensalIntencional = lanceIntencionalParaParcela / prazoTotalRestante;
            reducaoMensalEfetiva = Math.min(reducaoMensalIntencional, reducaoMaximaMensal);
        }
        
        novaParcela = parcelaBaseParaCalculo - reducaoMensalEfetiva;

        const lanceConsumidoNaParcela = reducaoMensalEfetiva * prazoTotalRestante;
        const lanceAlocadoParaPrazo = lanceTotal - lanceConsumidoNaParcela; 
        
        if (novaParcela > 0) {
            parcelasAbatidas = lanceAlocadoParaPrazo / novaParcela;
        } else {
            parcelasAbatidas = prazoTotalRestante;
        }

        novoPrazo = prazoTotalRestante - parcelasAbatidas;
        
        if (novoPrazo <= 0) {
            novoPrazo = 0;
            amortizacaoInfo = "Quitado";
            parcelasAbatidas = prazoTotalRestante;
        } else {
            if (reducaoMensalEfetiva >= reducaoMaximaMensal - 0.01) {
                amortizacaoInfo = "Red. Máx. Parcela (40%) + Red. Prazo";
            } else if (reducaoMensalEfetiva > 0) {
                amortizacaoInfo = `Red. Parcela (${percentualLanceParaParcela}%) + Red. Prazo`;
            } else {
                amortizacaoInfo = "Red. Prazo (100%)";
            }
        }
      }
      
      novoPrazo = Math.max(0, novoPrazo);

      cenarios.push({
        mes: mesAtual,
        mesRelativo: i + 1,
        novoPrazo, 
        novaParcela,
        parcelasAbatidas,
        amortizacaoInfo,
        creditoEfetivo: creditoEfetivoBase // Passa o crédito calculado para este cenário
      });
    }

    return cenarios;
  }

  static calculate(input: SimulationInput, tableMeta: TableMetadata, rawParcela: number): SimulationResult {
    const { credito, prazo, lanceEmbutidoPct, lanceBolso, lanceCartaVal, tipoParcela, taxaAdesaoPct } = input;
    
    // --- Cálculos Básicos ---
    const seguroRate = tipoParcela === 'C/SV' ? tableMeta.seguroPct : 0;
    const seguroMensal = credito * seguroRate;
    const taxaAdminValor = credito * tableMeta.taxaAdmin;
    const fundoReservaValor = credito * tableMeta.fundoReserva;
    const valorAdesao = credito * taxaAdesaoPct;

    const lanceEmbutidoValor = credito * lanceEmbutidoPct;
    const lanceTotal = lanceBolso + lanceEmbutidoValor + lanceCartaVal; 

    const parcelaPre = rawParcela;
    const totalPrimeiraParcela = parcelaPre + valorAdesao;
    const totalSeguro = seguroMensal * prazo;
    
    // --- LÓGICA BIFURCADA ---
    
    if (tableMeta.plan === 'NORMAL') {
        // === LÓGICA ORIGINAL DO PLANO NORMAL (INALTERADA) ===
        const creditoLiquido = credito - lanceEmbutidoValor - lanceCartaVal;
        const custoTotal = creditoLiquido + taxaAdminValor + fundoReservaValor + totalSeguro;

        const cenariosContemplacao = ConsortiumCalculator.calculateAmortizationScenario(
            input, 
            parcelaPre,
            creditoLiquido,
            prazo,
            lanceTotal,
            0 // Saldo Devedor Reajuste é 0 no Normal
        );

        return {
          parcelaPreContemplacao: parcelaPre,
          seguroMensal,
          custoTotal,
          taxaAdminValor,
          fundoReservaValor,
          valorAdesao,
          totalPrimeiraParcela,
          creditoOriginal: credito,
          creditoLiquido,
          lanceTotal,
          plano: tableMeta.plan,
          lanceCartaVal,
          cenariosContemplacao,
          // Campos LIGHT/SL nulos
          cenarioCreditoReduzido: null,
          cenarioCreditoTotal: null,
          parcelaPosCaminho2: 0
        };

    } else {
        // === LÓGICA PLANOS LIGHT (75%) E SUPERLIGHT (50%) ===
        let fatorPlano = 0.75; // LIGHT
        if (tableMeta.plan === 'SUPERLIGHT') fatorPlano = 0.50;

        // CAMINHO 1: Crédito Reduzido, Mesma Parcela
        const creditoBaseReduzido = credito * fatorPlano;
        const creditoLiquidoReduzido = creditoBaseReduzido - lanceEmbutidoValor - lanceCartaVal;
        
        const cenarioReduzido = ConsortiumCalculator.calculateAmortizationScenario(
            input,
            parcelaPre, // Mantém parcela original
            creditoLiquidoReduzido,
            prazo,
            lanceTotal,
            0 // Não há reajuste de saldo no Caminho 1
        );

        // CAMINHO 2: Crédito Cheio, Parcela Reajustada dinamicamente
        const creditoLiquidoCheio = credito - lanceEmbutidoValor - lanceCartaVal;
        
        // Cálculo do GAP (Acréscimo de Saldo Devedor)
        // Ex: Crédito 100k, Superlight (50%). Já paga por 50k. Faltam 50k.
        // Gap = 100k * (1 - 0.5) = 50k.
        const diferencaCredito = credito * (1 - fatorPlano);
        
        // Calculamos a parcela "exibida" na tela de resumo (baseada no mês de contemplação inputado ou mês 1)
        const mesRef = input.mesContemplacao > 0 ? input.mesContemplacao : 1;
        const prazoRestanteRef = Math.max(1, prazo - mesRef);
        const acrescimoRef = diferencaCredito / prazoRestanteRef;
        const parcelaReajustadaDisplay = parcelaPre + acrescimoRef;

        const cenarioCheio = ConsortiumCalculator.calculateAmortizationScenario(
            input,
            parcelaPre, // Passamos a parcela ORIGINAL base...
            creditoLiquidoCheio,
            prazo,
            lanceTotal,
            diferencaCredito // ...e o valor TOTAL a ser reajustado. A função diluirá isso mês a mês.
        );
        
        const custoTotalBase = creditoLiquidoReduzido + taxaAdminValor + fundoReservaValor + totalSeguro;

        return {
            parcelaPreContemplacao: parcelaPre,
            seguroMensal,
            custoTotal: custoTotalBase,
            taxaAdminValor,
            fundoReservaValor,
            valorAdesao,
            totalPrimeiraParcela,
            creditoOriginal: credito,
            creditoLiquido: creditoLiquidoReduzido, 
            lanceTotal,
            plano: tableMeta.plan,
            lanceCartaVal,
            cenariosContemplacao: cenarioReduzido, 
            
            // Preenchendo os cenários específicos
            cenarioCreditoReduzido: cenarioReduzido,
            cenarioCreditoTotal: cenarioCheio,
            parcelaPosCaminho2: parcelaReajustadaDisplay // Usado para exibição inicial se necessário
        };
    }
  }

  static validate(input: SimulationInput, tableMeta: TableMetadata): string | null {
    if (input.lanceEmbutidoPct > tableMeta.maxLanceEmbutido) {
      return `Máximo de lance embutido: ${(tableMeta.maxLanceEmbutido * 100).toFixed(0)}%`;
    }
    if (input.credito <= 0) return "Valor de crédito inválido.";
    
    const lanceEmbVal = input.credito * input.lanceEmbutidoPct;
    const totalLances = input.lanceBolso + lanceEmbVal + input.lanceCartaVal;
    
    // Validação conservadora baseada no crédito reduzido
    let baseCreditoValidacao = input.credito;
    if (tableMeta.plan === 'LIGHT') baseCreditoValidacao = input.credito * 0.75;
    if (tableMeta.plan === 'SUPERLIGHT') baseCreditoValidacao = input.credito * 0.50;

    const creditoQueSobra = baseCreditoValidacao - lanceEmbVal - input.lanceCartaVal;
    
    if (creditoQueSobra < 0) {
       return `Atenção: Com esse lance embutido e/ou carta, o crédito líquido a receber no plano ${tableMeta.plan} (Caminho 1) seria negativo ou zero.`;
    }

    if (totalLances >= input.credito) {
      return "A soma dos lances não pode ser igual ou maior que o crédito total.";
    }

    return null;
  }
}