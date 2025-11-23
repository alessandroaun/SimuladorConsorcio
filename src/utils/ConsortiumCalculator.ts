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
  novoPrazo: number;
  parcelasAbatidas: number;
  novaParcela: number;
  amortizacaoInfo: string;
  creditoEfetivo: number;
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
  
  // Campos padrão
  creditoLiquido: number;
  lanceTotal: number;
  plano: PlanType;
  lanceCartaVal: number; 
  cenariosContemplacao: ContemplationScenario[]; 

  // Campos Light/Superlight
  cenarioCreditoReduzido: ContemplationScenario[] | null; 
  cenarioCreditoTotal: ContemplationScenario[] | null;    
  parcelaPosCaminho2: number; 
}

export class ConsortiumCalculator {

  /**
   * Função auxiliar para calcular o cenário de amortização.
   * Agora aceita 'limiteReducaoMensal' (R$) calculado externamente para garantir consistência.
   */
  private static calculateAmortizationScenario(
    input: SimulationInput, 
    baseParcelaOriginal: number, // Parcela ORIGINAL sem reajuste
    creditoEfetivoBase: number,
    prazoTotal: number,
    lanceTotal: number,
    saldoDevedorReajuste: number = 0, // Valor total (Gap) a ser adicionado ao saldo devedor
    limiteReducaoMensal: number // Teto de redução em R$ (baseado na parcela cheia)
  ): ContemplationScenario[] {
    
    const { percentualLanceParaParcela, mesContemplacao } = input;
    const cenarios: ContemplationScenario[] = [];
    const mesInicial = Math.max(1, mesContemplacao > 0 ? mesContemplacao : 1);

    const prazoTotalNum = Number(prazoTotal);
    const lanceTotalNum = Math.max(0, Number(lanceTotal));
    const saldoReajusteNum = Math.max(0, Number(saldoDevedorReajuste));
    const pctParcelaNum = Math.max(0, Math.min(100, Number(percentualLanceParaParcela) || 0));

    // Loop para gerar 5 cenários (mês X, X+1, X+2...)
    for (let i = 0; i < 5; i++) {
      const mesAtual = mesInicial + i;
      
      if (mesAtual >= prazoTotalNum) break;

      // Prazo restante para este cenário específico
      const prazoTotalRestante = Math.max(1, prazoTotalNum - mesAtual); 
      
      // 1. CÁLCULO DA PARCELA BASE
      let parcelaBaseParaCalculo = baseParcelaOriginal;
      
      // No Caminho 2, adicionamos o Gap diluído
      if (saldoReajusteNum > 0.01) {
          const acrescimoMensal = saldoReajusteNum / prazoTotalRestante;
          parcelaBaseParaCalculo = baseParcelaOriginal + acrescimoMensal;
      }

      let novaParcela = parcelaBaseParaCalculo;
      let novoPrazo = prazoTotalRestante;
      let parcelasAbatidas = 0;
      let amortizacaoInfo = "";
      let reducaoMensalEfetiva = 0;

      // 2. APLICAÇÃO DO LANCE
      if (lanceTotalNum > 0.01) {
        const valorLanceParaParcela = lanceTotalNum * (pctParcelaNum / 100);
        const valorLanceParaPrazo = lanceTotalNum - valorLanceParaParcela;

        // -- Redução na Parcela --
        // A redução é limitada pelo 'limiteReducaoMensal' passado (40% da Parcela Cheia ou Ajustada)
        // No Caminho 2, como a parcela base cresce, recalculamos o teto se ele for maior que o fixo,
        // mas para Caminho 1 usamos o teto baseado na cheia para evitar congelamento.
        
        // Lógica de Teto Híbrida:
        // O teto é 40% da parcela VIGENTE ou o limiteReference passado (que é 40% da Cheia), o que for MAIOR.
        // Isso garante que no Caminho 1 destrave (usando a Cheia) e no Caminho 2 acompanhe o crescimento (usando a Vigente).
        const tetoDinamico = Math.max(limiteReducaoMensal, parcelaBaseParaCalculo * 0.40);

        const reducaoMensalIntencional = valorLanceParaParcela / prazoTotalRestante;
        
        // Aplica o teto
        reducaoMensalEfetiva = Math.min(reducaoMensalIntencional, tetoDinamico);
        
        const lanceConsumidoNaParcela = reducaoMensalEfetiva * prazoTotalRestante;
        
        novaParcela = parcelaBaseParaCalculo - reducaoMensalEfetiva;

        // -- Redução no Prazo --
        const sobraDoLanceParcela = Math.max(0, valorLanceParaParcela - lanceConsumidoNaParcela);
        const totalDisponivelParaPrazo = valorLanceParaPrazo + sobraDoLanceParcela;
        
        if (novaParcela > 0.01) {
            parcelasAbatidas = totalDisponivelParaPrazo / novaParcela;
        } else {
            parcelasAbatidas = prazoTotalRestante;
        }

        novoPrazo = Math.max(0, prazoTotalRestante - parcelasAbatidas);
        
        // -- Info --
        if (novoPrazo < 0.1) {
             amortizacaoInfo = "Quitado";
        } else if (reducaoMensalEfetiva >= tetoDinamico - 0.01) {
             amortizacaoInfo = "Red. Máx. Parcela (40%) + Red. Prazo";
        } else if (reducaoMensalEfetiva > 0.01) {
             amortizacaoInfo = `Red. Parcela (${pctParcelaNum.toFixed(0)}%) + Red. Prazo`;
        } else {
             amortizacaoInfo = "Red. Prazo (100% do Lance)";
        }
      } else {
        amortizacaoInfo = "Sem Lance";
      }
      
      cenarios.push({
        mes: mesAtual,
        mesRelativo: i + 1,
        novoPrazo, 
        novaParcela,
        parcelasAbatidas,
        amortizacaoInfo,
        creditoEfetivo: creditoEfetivoBase
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

    // Definição do Fator do Plano
    let fatorPlano = 1.0; 
    if (tableMeta.plan === 'LIGHT') fatorPlano = 0.75;
    if (tableMeta.plan === 'SUPERLIGHT') fatorPlano = 0.50;

    // CÁLCULO DA PARCELA CHEIA (REFERÊNCIA PARA O LIMITE DE 40%)
    // Para planos reduzidos, a parcela raw é pequena. Usamos a cheia para calcular o teto de 40%,
    // evitando que o teto fique muito baixo e congele a redução.
    const parcelaCheiaReferencia = parcelaPre / fatorPlano;
    const limiteReducaoBase = parcelaCheiaReferencia * 0.40;
    
    if (tableMeta.plan === 'NORMAL') {
        const creditoLiquido = credito - lanceEmbutidoValor - lanceCartaVal;
        const custoTotal = creditoLiquido + taxaAdminValor + fundoReservaValor + totalSeguro;

        const cenariosContemplacao = ConsortiumCalculator.calculateAmortizationScenario(
            input, 
            parcelaPre,
            creditoLiquido,
            prazo,
            lanceTotal,
            0,
            limiteReducaoBase // Teto normal
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
          cenarioCreditoReduzido: null,
          cenarioCreditoTotal: null,
          parcelaPosCaminho2: 0
        };

    } else {
        // === PLANOS LIGHT E SUPERLIGHT ===

        // CAMINHO 1: Crédito Reduzido
        const creditoBaseReduzido = credito * fatorPlano;
        const creditoLiquidoReduzido = creditoBaseReduzido - lanceEmbutidoValor - lanceCartaVal;
        
        let cenarioReduzido: ContemplationScenario[] | null = null;

        if (creditoLiquidoReduzido > 0) {
             cenarioReduzido = ConsortiumCalculator.calculateAmortizationScenario(
                input,
                parcelaPre, 
                creditoLiquidoReduzido,
                prazo,
                lanceTotal,
                0, // Sem gap no Caminho 1
                limiteReducaoBase // Teto baseado na parcela cheia (destrava o congelamento)
            );
        }

        // CAMINHO 2: Crédito Cheio (Parcela Reajustada)
        const creditoLiquidoCheio = credito - lanceEmbutidoValor - lanceCartaVal;
        const diferencaCredito = credito * (1 - fatorPlano);
        
        const cenarioCheio = ConsortiumCalculator.calculateAmortizationScenario(
            input,
            parcelaPre, 
            creditoLiquidoCheio,
            prazo,
            lanceTotal,
            diferencaCredito, // Passa o GAP para diluição
            limiteReducaoBase // Teto base (será ajustado dinamicamente se a parcela crescer)
        );

        // Display estático
        const mesRef = input.mesContemplacao > 0 ? input.mesContemplacao : 1;
        const prazoRestanteRef = Math.max(1, prazo - mesRef);
        const acrescimoRef = diferencaCredito / prazoRestanteRef;
        const parcelaReajustadaDisplay = parcelaPre + acrescimoRef;
        
        const custoTotalBase = (cenarioReduzido) 
            ? creditoLiquidoReduzido + taxaAdminValor + fundoReservaValor + totalSeguro
            : creditoLiquidoCheio + taxaAdminValor + fundoReservaValor + totalSeguro;

        const creditoLiquidoDefault = (cenarioReduzido) ? creditoLiquidoReduzido : creditoLiquidoCheio;
        const cenarioDefault = (cenarioReduzido) ? cenarioReduzido : cenarioCheio;

        return {
            parcelaPreContemplacao: parcelaPre,
            seguroMensal,
            custoTotal: custoTotalBase,
            taxaAdminValor,
            fundoReservaValor,
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
    if (input.lanceEmbutidoPct > tableMeta.maxLanceEmbutido) {
      return `Máximo de lance embutido: ${(tableMeta.maxLanceEmbutido * 100).toFixed(0)}%`;
    }
    if (input.credito <= 0) return "Valor de crédito inválido.";
    
    const lanceEmbVal = input.credito * input.lanceEmbutidoPct;
    const totalLances = input.lanceBolso + lanceEmbVal + input.lanceCartaVal;
    
    // Validação contra Crédito Total (Caminho 2)
    const creditoTotalLiquido = input.credito - lanceEmbVal - input.lanceCartaVal;
    
    if (creditoTotalLiquido < 0) {
       return `Atenção: A soma dos lances (Embutido + Carta + Bolso) supera o valor total do crédito. Simulação inviável.`;
    }

    if (totalLances >= input.credito) {
      return "A soma dos lances não pode ser igual ou maior que o crédito total.";
    }

    return null;
  }
}