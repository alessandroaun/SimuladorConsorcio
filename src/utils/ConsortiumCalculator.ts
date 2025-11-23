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

export interface ContemplationScenario {
  mes: number;
  mesRelativo: number;
  novoPrazo: number; // Mantemos float para precisão interna
  parcelasAbatidas: number; // Novo campo para mostrar o abatimento
  novaParcela: number;
  amortizacaoInfo: string;
}

export interface SimulationResult {
  parcelaPreContemplacao: number;
  parcelaPosContemplacao: number;
  custoTotal: number;
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
}

export class ConsortiumCalculator {
  static calculate(input: SimulationInput, tableMeta: TableMetadata, rawParcela: number): SimulationResult {
    const { credito, prazo, lanceEmbutidoPct, lanceBolso, lanceCartaVal, tipoParcela, taxaAdesaoPct, percentualLanceParaParcela, mesContemplacao } = input;
    
    // --- Cálculos Básicos ---
    const seguroRate = tipoParcela === 'C/SV' ? tableMeta.seguroPct : 0;
    const seguroMensal = credito * seguroRate;
    const taxaAdminValor = credito * tableMeta.taxaAdmin;
    const fundoReservaValor = credito * tableMeta.fundoReserva;
    const valorAdesao = credito * taxaAdesaoPct;

    const lanceEmbutidoValor = credito * lanceEmbutidoPct;
    const lanceTotal = lanceBolso + lanceEmbutidoValor + lanceCartaVal;
    const creditoLiquido = credito - lanceEmbutidoValor - lanceCartaVal;

    const parcelaPre = rawParcela;

    // --- Lógica Pós-Contemplação Padrão (Base para cálculo do saldo devedor) ---
    let fatorPlano = 1.0;
    if (tableMeta.plan === 'LIGHT') fatorPlano = 0.75;
    if (tableMeta.plan === 'SUPERLIGHT') fatorPlano = 0.50;

    let parcelaPosPadrao = parcelaPre;
    if (tableMeta.plan !== 'NORMAL') {
      const diferencaCredito = credito * (1 - fatorPlano);
      const acrescimo = diferencaCredito / prazo; 
      parcelaPosPadrao = parcelaPre + acrescimo;
    }

    // --- GERAÇÃO DA TABELA DE CENÁRIOS (5 MESES) ---
    const cenariosContemplacao: ContemplationScenario[] = [];
    const mesInicial = mesContemplacao > 0 ? mesContemplacao : 1;
    
    // A parcela base a ser amortizada é a parcela cheia PÓS-recomposição do crédito, se for o caso
    const baseParcelaAmortizacao = tableMeta.plan === 'NORMAL' ? parcelaPre : parcelaPosPadrao;


    for (let i = 0; i < 5; i++) {
      const mesAtual = mesInicial + i;
      
      if (mesAtual > prazo) break;

      // O Prazo Restante é o prazo total menos o mês de contemplação.
      const prazoTotalRestante = prazo - mesAtual; 
      
      let novaParcela = baseParcelaAmortizacao;
      let novoPrazo = prazoTotalRestante;
      let parcelasAbatidas = 0;
      let amortizacaoInfo = "";
      
      // Variável declarada aqui para garantir escopo correto fora dos IFs/ELSEs.
      let reducaoMensalEfetiva: number; 

      if (lanceTotal === 0) {
        amortizacaoInfo = "Sem Lance";
        novaParcela = baseParcelaAmortizacao;
        novoPrazo = prazoTotalRestante;
        reducaoMensalEfetiva = 0; // Inicializa para caso lanceTotal seja 0
      } else {
        // --- CÁLCULO DE AMORTIZAÇÃO (Lógica Reajustada) ---
        
        // 1. Lance Alocado para Redução de Parcela (Valor INTENCIONAL)
        const lanceIntencionalParaParcela = lanceTotal * (percentualLanceParaParcela / 100);
        
        // 2. Definir Redução Máxima Mensal Permitida (40% da parcela base)
        // CORREÇÃO: Variável 'baseParcelaAmortizacao' utilizada corretamente aqui
        const reducaoMaximaMensal = baseParcelaAmortizacao * 0.40;
        
        // Se o Prazo Restante for 0, não há mais meses para diluir a redução.
        if (prazoTotalRestante <= 0) {
            reducaoMensalEfetiva = 0; 
        } else {
            // 3. Redução Mensal Intencional (em R$/mês)
            const reducaoMensalIntencional = lanceIntencionalParaParcela / prazoTotalRestante;
            
            // 4. Nova Parcela (respeitando o limite de 40%)
            reducaoMensalEfetiva = Math.min(reducaoMensalIntencional, reducaoMaximaMensal);
        }
        
        novaParcela = baseParcelaAmortizacao - reducaoMensalEfetiva;

        // 5. Lance Remanescente para Abatimento de Prazo
        // O lance consumido na parcela é a Redução Efetiva * Prazo Restante. 
        const lanceConsumidoNaParcela = reducaoMensalEfetiva * prazoTotalRestante;
        const lanceAlocadoParaPrazo = lanceTotal - lanceConsumidoNaParcela;
        
        // 6. Abatimento de Prazo: Quantas parcelas o lance remanescente compra.
        if (novaParcela > 0) {
            parcelasAbatidas = lanceAlocadoParaPrazo / novaParcela;
        } else {
            // Se a nova parcela for zero (crédito totalmente quitado de uma vez)
            parcelasAbatidas = prazoTotalRestante;
        }

        // 7. Novo Prazo Final
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
      
      // Garante que o prazo não seja negativo
      novoPrazo = Math.max(0, novoPrazo);

      cenariosContemplacao.push({
        mes: mesAtual,
        mesRelativo: i + 1,
        novoPrazo, 
        novaParcela,
        parcelasAbatidas: parcelasAbatidas, // Novo campo
        amortizacaoInfo
      });
    }

    const totalPrimeiraParcela = parcelaPre + valorAdesao;
    
    // Custo Total = Crédito Líquido + Taxas + Seguros
    const totalSeguro = seguroMensal * prazo;
    const custoTotal = creditoLiquido + taxaAdminValor + fundoReservaValor + totalSeguro;

    return {
      parcelaPreContemplacao: parcelaPre,
      parcelaPosContemplacao: parcelaPosPadrao,
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
      cenariosContemplacao
    };
  }

  static validate(input: SimulationInput, tableMeta: TableMetadata): string | null {
    if (input.lanceEmbutidoPct > tableMeta.maxLanceEmbutido) {
      return `Máximo de lance embutido: ${(tableMeta.maxLanceEmbutido * 100).toFixed(0)}%`;
    }
    if (input.credito <= 0) return "Valor de crédito inválido.";
    
    const lanceEmbVal = input.credito * input.lanceEmbutidoPct;
    const totalLances = input.lanceBolso + lanceEmbVal + input.lanceCartaVal;
    if (totalLances >= input.credito) {
      return "A soma dos lances não pode ser igual ou maior que o crédito total.";
    }

    return null;
  }
}