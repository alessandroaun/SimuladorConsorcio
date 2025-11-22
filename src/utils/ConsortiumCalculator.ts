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
  
  // NOVO CAMPO: Substitui os enums antigos.
  // Define a INTENÇÃO do usuário: Quanto % do lance ele QUER usar para reduzir parcela.
  // O sistema tentará usar isso. Se bater no limite de 40%, o resto vai pro prazo automaticamente.
  percentualLanceParaParcela: number; // 0 a 100
  
  mesContemplacao: number; 
}

export interface ContemplationScenario {
  mes: number;
  mesRelativo: number;
  novoPrazo: number; // Mantemos float para precisão interna
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

    // --- 5. GERAÇÃO DA TABELA DE CENÁRIOS (5 MESES) ---
    const cenariosContemplacao: ContemplationScenario[] = [];
    const mesInicial = mesContemplacao > 0 ? mesContemplacao : 1;

    for (let i = 0; i < 5; i++) {
      const mesAtual = mesInicial + i;
      
      if (mesAtual > prazo) break;

      // 1. Definir Saldo Devedor Restante no momento da contemplação
      // Assumimos que as parcelas anteriores a 'mesAtual' já foram pagas ou não entram na conta de amortização.
      // Prazo Restante = Total - Parcelas já passadas (mesAtual).
      const prazoRestante = prazo - mesAtual; 
      
      // Base de cálculo: Parcela Cheia (Normal ou Pós-Light recomposta)
      const baseParcela = tableMeta.plan === 'NORMAL' ? parcelaPre : parcelaPosPadrao;
      
      const saldoDevedorTotal = baseParcela * prazoRestante;
      
      // O Lance abate o saldo devedor TOTAL, independente de como alteramos a parcela/prazo.
      // É matemática pura: Dívida Nova = Dívida Velha - Dinheiro do Lance.
      const saldoPosLance = saldoDevedorTotal - lanceTotal;

      let novoPrazo = prazoRestante;
      let novaParcela = baseParcela;
      let info = "";

      if (saldoPosLance <= 0) {
        novoPrazo = 0;
        novaParcela = 0;
        info = "Quitado";
      } else {
        // 2. Definir a Nova Parcela baseada na preferência do usuário
        
        // Quanto do lance o usuário GOSTARIA de usar para abater parcela?
        const lanceAlocadoIntencao = lanceTotal * (percentualLanceParaParcela / 100);
        
        // Se usássemos esse valor para reduzir linearmente a parcela no prazo restante atual:
        const reducaoMensal = lanceAlocadoIntencao / prazoRestante;
        let parcelaDesejada = baseParcela - reducaoMensal;

        // 3. Aplicar a trava de 40% (A nova parcela não pode ser menor que 60% da original)
        const parcelaMinimaPermitida = baseParcela * 0.60; 

        if (parcelaDesejada < parcelaMinimaPermitida) {
            // Se a redução desejada viola o limite, travamos no limite.
            novaParcela = parcelaMinimaPermitida;
            info = "Max Red. Parcela (40%)";
        } else {
            // Caso contrário, acatamos a parcela calculada pelo percentual escolhido
            novaParcela = parcelaDesejada;
            if (percentualLanceParaParcela > 0) {
                info = `Red. Parcela (${percentualLanceParaParcela}%)`;
            } else {
                info = "Red. Prazo (100%)";
            }
        }

        // 4. Calcular o Novo Prazo Automaticamente
        // Fórmula Mágica: Prazo = Saldo Devedor Restante / Valor da Parcela que vou pagar
        // O 'saldoPosLance' já considera TODO o lance descontado.
        // Portanto, se travamos a parcela em um valor mais alto (devido aos 40%), 
        // o saldo será dividido por um número maior, resultando em menos meses (redução de prazo automática).
        
        if (novaParcela > 0) {
             novoPrazo = saldoPosLance / novaParcela;
        } else {
             novoPrazo = 0;
        }
      }

      cenariosContemplacao.push({
        mes: mesAtual,
        mesRelativo: i + 1,
        novoPrazo, 
        novaParcela,
        amortizacaoInfo: info
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