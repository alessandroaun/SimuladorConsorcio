/**
 * ============================================================================
 * ConsortiumCalculator.ts
 * Lógica central de cálculo financeiro do simulador.
 * ============================================================================
 */

// --- Tipos e Interfaces ---

export type PlanType = 'NORMAL' | 'LIGHT' | 'SUPERLIGHT';
export type InstallmentType = 'C/SV' | 'S/SV'; // Com Seguro Vida / Sem Seguro Vida
export type Category = 'AUTO' | 'IMOVEL' | 'MOTO' | 'SERVICOS';

export interface TableMetadata {
  id: string;
  name: string;
  category: Category;
  plan: PlanType;
  taxaAdmin: number;
  fundoReserva: number;
  seguroPct?: number;
  maxLanceEmbutido: number;
}

export interface SimulationInput {
  tableId: string;
  credito: number;
  prazo: number;
  tipoParcela: InstallmentType;
  lanceBolso: number;
  lanceEmbutidoPct: number;
  lanceCartaVal: number;
  taxaAdesaoPct: number; // NOVO: 0, 0.005, 0.01 ou 0.02
}

export interface AmortizationRow {
  mes: number;
  saldoDevedor: number;
  valorPago: number;
}

export interface SimulationResult {
  // Valores Mensais
  parcelaPreContemplacao: number;
  parcelaPosContemplacao: number;
  
  // Detalhamento da Parcela
  seguroMensal: number;
  
  // NOVO: Detalhamento Adesão (1ª Parcela)
  valorAdesao: number;
  totalPrimeiraParcela: number;

  // Totais
  custoTotal: number;
  taxaAdminValor: number;
  fundoReservaValor: number;
  
  // Lances e Crédito
  creditoOriginal: number;
  creditoLiquido: number;
  lanceTotal: number;
  lanceEmbutidoValor: number;
  
  // Metadados
  plano: PlanType;
  amortizacao: AmortizationRow[];
}

// --- Constantes de Negócio ---
const SEGURO_RATES = {
  IMOVEL: 0.00059,
  OUTROS: 0.00084
};

export class ConsortiumCalculator {

  static calculate(
    input: SimulationInput, 
    tableMeta: TableMetadata, 
    rawParcela: number
  ): SimulationResult {
    
    const { credito, prazo, lanceEmbutidoPct, lanceBolso, lanceCartaVal, tipoParcela, taxaAdesaoPct } = input;

    // 1. Seguro
    const defaultSeguroRate = tableMeta.category === 'IMOVEL' ? SEGURO_RATES.IMOVEL : SEGURO_RATES.OUTROS;
    const seguroRate = tableMeta.seguroPct || defaultSeguroRate;
    
    let valorSeguroMensal = credito * seguroRate;
    if (tipoParcela === 'S/SV') {
        valorSeguroMensal = 0;
    }

    // 2. Totais Administrativos
    const taxaAdminValor = credito * tableMeta.taxaAdmin;
    const fundoReservaValor = credito * tableMeta.fundoReserva;

    // 3. Parcela Pré (Recorrente)
    let parcelaPre = rawParcela;

    // --- NOVA LÓGICA: TAXA DE ADESÃO ---
    const valorAdesao = credito * taxaAdesaoPct;
    // A primeira parcela é a soma da parcela mensal normal + a taxa de adesão
    const totalPrimeiraParcela = parcelaPre + valorAdesao;

    // 4. Planos Light/SL
    let fatorPlano = 1.0;
    if (tableMeta.plan === 'LIGHT') fatorPlano = 0.75;
    if (tableMeta.plan === 'SUPERLIGHT') fatorPlano = 0.50;

    // 5. Lances
    const lanceEmbutidoValor = credito * lanceEmbutidoPct;
    const lanceTotal = lanceBolso + lanceEmbutidoValor + lanceCartaVal;
    const creditoLiquido = credito - lanceEmbutidoValor - lanceCartaVal;

    // 6. Pós-Contemplação
    let parcelaPos = parcelaPre;
    if (tableMeta.plan !== 'NORMAL') {
      const diferencaCredito = credito * (1 - fatorPlano);
      const acrescimo = diferencaCredito / prazo;
      parcelaPos = parcelaPre + acrescimo;
    }

    // 7. Custo Total
    // O custo total considera a parcela normal vezes o prazo + a taxa de adesão paga na entrada
    const custoTotal = (parcelaPre * prazo) + valorAdesao;

    // 8. Amortização
    const amortizacao: AmortizationRow[] = [];
    let saldoDevedorTecnico = custoTotal; 
    let acumuladoPago = 0;

    for (let i = 1; i <= prazo; i++) {
      // Se for o mês 1, o cliente paga mais (com adesão), mas para fins de amortização de saldo devedor
      // a taxa de adesão é um custo extra que não necessariamente abate saldo da carta da mesma forma.
      // Para simplificar o gráfico, vamos somar o valor pago real.
      let valorPagoNoMes = parcelaPre;
      if (i === 1) valorPagoNoMes += valorAdesao;

      acumuladoPago += valorPagoNoMes;
      saldoDevedorTecnico -= valorPagoNoMes; // Simplificação gráfica
      
      if (saldoDevedorTecnico < 0) saldoDevedorTecnico = 0;

      amortizacao.push({
        mes: i,
        saldoDevedor: saldoDevedorTecnico,
        valorPago: acumuladoPago
      });
    }

    return {
      parcelaPreContemplacao: parcelaPre,
      parcelaPosContemplacao: parcelaPos,
      seguroMensal: valorSeguroMensal,
      
      // NOVOS CAMPOS
      valorAdesao,
      totalPrimeiraParcela,

      custoTotal,
      taxaAdminValor,
      fundoReservaValor,
      
      creditoOriginal: credito,
      creditoLiquido,
      lanceTotal,
      lanceEmbutidoValor,
      
      plano: tableMeta.plan,
      amortizacao
    };
  }

  static validate(input: SimulationInput, tableMeta: TableMetadata): string | null {
    if (input.lanceEmbutidoPct > tableMeta.maxLanceEmbutido) {
      return `O lance embutido máximo para esta tabela é de ${(tableMeta.maxLanceEmbutido * 100).toFixed(0)}%`;
    }
    if (input.credito <= 0) return "O valor do crédito deve ser maior que zero.";
    if (input.prazo <= 0) return "Selecione um prazo válido.";
    
    return null;
  }
}