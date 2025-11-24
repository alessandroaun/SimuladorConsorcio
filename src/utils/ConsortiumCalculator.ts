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
   * Corrigido: Garante fluxo correto do lance excedente para o prazo quando o teto da parcela é atingido, 
   * especialmente em planos de parcela fixa (NORMAL ou Caminho 1).
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
    
    // Mes inicial base (onde o usuário diz que será contemplado)
    const mesContemplacaoNum = Math.max(1, mesContemplacao > 0 ? mesContemplacao : 1);

    const prazoTotalNum = Number(prazoTotal);
    const lanceTotalNum = Math.max(0, Number(lanceTotal));
    const saldoReajusteNum = Math.max(0, Number(saldoDevedorReajuste));
    const pctParcelaNum = Math.max(0, Math.min(100, Number(percentualLanceParaParcela) || 0));

    // --- PASSO 1: SIMULAR O CENÁRIO NO MÊS DA CONTEMPLAÇÃO PARA DESCOBRIR QUANDO O PLANO ACABA ---
    // Precisamos saber o "Novo Prazo" resultante logo após o lance ser aplicado no mês de contemplação.
    
    let prazoRestanteNoMomentoDoLance = Math.max(1, prazoTotalNum - mesContemplacaoNum);
    let parcelaBaseNoMomentoDoLance = baseParcelaOriginal;
    
    if (saldoDevedorReajuste > 0.0001) {
       const acrescimoMensal = saldoReajusteNum / prazoRestanteNoMomentoDoLance;
       parcelaBaseNoMomentoDoLance = baseParcelaOriginal + acrescimoMensal;
    }

    let novoPrazoPosLance = prazoRestanteNoMomentoDoLance;
    let novaParcelaPosLance = parcelaBaseNoMomentoDoLance;
    let infoAmortizacaoFinal = "";

    if (lanceTotalNum > 0.01) {
        // Lógica de cálculo (Igual à anterior, mas usada apenas para prever o fim)
        const valorLanceParaParcelaIntencional = lanceTotalNum * (pctParcelaNum / 100);
        const reducaoMensalIntencional = valorLanceParaParcelaIntencional / prazoRestanteNoMomentoDoLance;
        const tetoDinamico = Math.max(limiteReducaoMensal, parcelaBaseNoMomentoDoLance * 0.40);
        const reducaoMensalEfetiva = Math.min(reducaoMensalIntencional, tetoDinamico);
        
        novaParcelaPosLance = parcelaBaseNoMomentoDoLance - reducaoMensalEfetiva;
        
        const lanceConsumidoNaParcela = reducaoMensalEfetiva * prazoRestanteNoMomentoDoLance;
        const lanceTotalOriginal = lanceTotalNum;
        const valorLanceParaPrazoIntencional = lanceTotalOriginal * ( (100 - pctParcelaNum) / 100 );
        const sobraDoLanceParcela = Math.max(0, valorLanceParaParcelaIntencional - lanceConsumidoNaParcela);
        const totalDisponivelParaPrazo = valorLanceParaPrazoIntencional + sobraDoLanceParcela;
        
        let parcelasAbatidas = 0;
        if (novaParcelaPosLance > 0.01) {
            parcelasAbatidas = totalDisponivelParaPrazo / novaParcelaPosLance;
        } else {
            parcelasAbatidas = prazoRestanteNoMomentoDoLance;
        }
        
        novoPrazoPosLance = Math.max(0, prazoRestanteNoMomentoDoLance - parcelasAbatidas);

        // Define string de info
        if (novoPrazoPosLance < 0.1) infoAmortizacaoFinal = "Quitado";
        else if (Math.abs(reducaoMensalEfetiva - tetoDinamico) < 0.01) infoAmortizacaoFinal = "Red. Máx. Parcela (40%) + Red. Prazo";
        else if (reducaoMensalEfetiva > 0.01) infoAmortizacaoFinal = `Red. Parcela (${pctParcelaNum.toFixed(0)}%) + Red. Prazo`;
        else infoAmortizacaoFinal = "Red. Prazo (100% do Lance)";
    }

    // --- PASSO 2: DEFINIR A JANELA DE VISUALIZAÇÃO ---
    // O mês final efetivo do plano é o Mês da Contemplação + Novo Prazo (arredondado para cima)
    const mesFinalEfetivo = Math.ceil(mesContemplacaoNum + novoPrazoPosLance);
    
    // Queremos mostrar 5 meses. A janela ideal termina no mesFinalEfetivo.
    // Ex: Se paga tudo no mês 34 (mesContemplacao 33 + 1 prazo), queremos ver: 30, 31, 32, 33, 34.
    // O 'end' do loop deve ser mesFinalEfetivo.
    // O 'start' do loop deve ser mesFinalEfetivo - 4.
    // Mas o 'start' não pode ser menor que 1.
    // E também, se o mesFinalEfetivo for muito longe (ex: mes 80), e a contemplação foi no 33, 
    // a janela deve começar no 33 (comportamento padrão).
    // REGRA: Se (mesContemplacao + 5) ultrapassa mesFinalEfetivo, então ajustamos a janela para terminar em mesFinalEfetivo.
    
    let loopStart = mesContemplacaoNum;
    
    // Se a visualização padrão (começando no mês de contemplação) mostraria muitos "0x" (porque acabou antes),
    // empurramos a janela para trás.
    if (loopStart + 4 > mesFinalEfetivo) {
        loopStart = Math.max(1, mesFinalEfetivo - 4);
    }

    // --- PASSO 3: GERAR AS 5 LINHAS ---
    for (let i = 0; i < 5; i++) {
        const mesAtual = loopStart + i;
        
        // Se já passamos do mês final efetivo, paramos de gerar linhas para não mostrar "Quitado" repetido,
        // OU se o usuário pediu estritamente 5 meses e já ajustamos a janela, esse caso deve ser raro,
        // mas garantimos que pare se exceder o prazo total original.
        if (mesAtual > prazoTotalNum && mesAtual > mesFinalEfetivo) break;

        // Objeto de cenário
        let cenario: ContemplationScenario;

        // CASO A: Mês Anterior à Contemplação (Só acontece se a janela foi empurrada para trás)
        if (mesAtual < mesContemplacaoNum) {
            // Antes do lance, é tudo "Normal"
            const prazoRestantePre = prazoTotalNum - mesAtual;
            cenario = {
                mes: mesAtual,
                mesRelativo: i + 1, // Apenas índice visual
                novoPrazo: prazoRestantePre,
                novaParcela: baseParcelaOriginal,
                parcelasAbatidas: 0,
                amortizacaoInfo: "Pré-Lance",
                creditoEfetivo: creditoEfetivoBase
            };
        } 
        // CASO B: Mês da Contemplação ou Futuro (Pós-Lance)
        else {
             // Se o mês atual já passou do mês final calculado (ex: mês 35 quando acabou no 34)
             if (mesAtual > mesFinalEfetivo || (Math.abs(novoPrazoPosLance) < 0.1 && mesAtual > mesContemplacaoNum)) {
                 cenario = {
                    mes: mesAtual,
                    mesRelativo: i + 1,
                    novoPrazo: 0,
                    novaParcela: 0,
                    parcelasAbatidas: 0,
                    amortizacaoInfo: "Quitado",
                    creditoEfetivo: creditoEfetivoBase
                 };
             } else {
                 // É o mês do lance ou meses seguintes ativos
                 // O novo prazo vai decaindo mês a mês a partir do cálculo do lance
                 const mesesPassadosDesdeLance = mesAtual - mesContemplacaoNum;
                 const prazoRestanteDinamico = Math.max(0, novoPrazoPosLance - mesesPassadosDesdeLance);
                 
                 cenario = {
                    mes: mesAtual,
                    mesRelativo: i + 1,
                    novoPrazo: prazoRestanteDinamico,
                    novaParcela: novaParcelaPosLance,
                    parcelasAbatidas: 0, // Valor informativo estático do momento do lance
                    amortizacaoInfo: infoAmortizacaoFinal,
                    creditoEfetivo: creditoEfetivoBase
                 };
             }
        }
        
        // Pequena limpeza: Se geramos uma linha "Quitado", garantimos que seja a última se o loop permitir,
        // mas a lógica da janela (loopStart) já tenta manter ela na 5ª posição.
        // Se por acaso gerarmos múltiplas linhas de "Quitado" (ex: mesFinal=2, loopStart=1 -> 1, 2, 3(0x), 4(0x)...),
        // filtramos visualmente ou deixamos. O pedido foi "apenas 1 mês 0x".
        // Vamos forçar break se o ANTERIOR já era quitado.
        if (cenarios.length > 0 && cenarios[cenarios.length - 1].novoPrazo === 0 && cenario.novoPrazo === 0) {
            // Já mostramos uma linha de 0x, não mostra mais.
            break; 
        }

        cenarios.push(cenario);
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
            limiteReducaoBase 
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
                0, 
                limiteReducaoBase
            );
        }

        // CAMINHO 2: Crédito Cheio
        const creditoLiquidoCheio = credito - lanceEmbutidoValor - lanceCartaVal;
        const diferencaCredito = credito * (1 - fatorPlano);
        
        const cenarioCheio = ConsortiumCalculator.calculateAmortizationScenario(
            input,
            parcelaPre, 
            creditoLiquidoCheio,
            prazo,
            lanceTotal,
            diferencaCredito,
            limiteReducaoBase 
        );

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
    
    // Validação contra Crédito Total
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