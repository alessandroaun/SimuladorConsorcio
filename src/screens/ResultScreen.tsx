import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Share2, CheckCircle2, Car, CalendarClock, AlertTriangle } from 'lucide-react-native';
import { RootStackParamList } from '../types/navigation';
import { ContemplationScenario } from '../utils/ConsortiumCalculator';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

type ScenarioMode = 'REDUZIDO' | 'CHEIO';

export default function ResultScreen({ route, navigation }: Props) {
  const { result, input } = route.params;
  
  // Estado para controlar qual caminho o usuário está vendo (apenas para LIGHT/SL)
  const [mode, setMode] = useState<ScenarioMode>('REDUZIDO');

  const isSpecialPlan = result.plano === 'LIGHT' || result.plano === 'SUPERLIGHT';
  const fatorPlano = result.plano === 'LIGHT' ? 0.75 : result.plano === 'SUPERLIGHT' ? 0.50 : 1.0;

  const handleExport = () => {
    Alert.alert("Exportar", "Funcionalidade de PDF será implementada aqui.");
  };

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatMeses = (v: number) => `${v.toFixed(1)} meses`;

  // --- SELEÇÃO DE DADOS COM BASE NO MODO ---
  let activeScenario: ContemplationScenario[];
  let creditoExibido: number;
  let isReajustado = false;

  // Lógica de Seleção: Se for plano especial e tiver os dados dos cenários, usa o modo selecionado
  if (isSpecialPlan && result.cenarioCreditoReduzido && result.cenarioCreditoTotal) {
      if (mode === 'REDUZIDO') {
          // Caminho 1: Crédito Reduzido, Parcela Original
          activeScenario = result.cenarioCreditoReduzido;
          // O crédito efetivo já vem calculado dentro do cenário (considerando lances)
          creditoExibido = activeScenario[0].creditoEfetivo; 
      } else {
          // Caminho 2: Crédito Cheio, Parcela Reajustada
          activeScenario = result.cenarioCreditoTotal;
          creditoExibido = activeScenario[0].creditoEfetivo;
          isReajustado = true;
      }
  } else {
      // Plano NORMAL (Fallback)
      activeScenario = result.cenariosContemplacao;
      creditoExibido = result.creditoLiquido;
  }

  const cenarioPrincipal = activeScenario[0];
  const lanceEmbutidoValor = result.lanceTotal - input.lanceBolso - result.lanceCartaVal;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Resultado da Simulação</Text>
        <TouchableOpacity onPress={handleExport}>
          <Share2 color="#0EA5E9" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* --- SELETOR DE CAMINHO (APENAS LIGHT/SUPERLIGHT) --- */}
        {isSpecialPlan && (
            <View style={styles.toggleContainer}>
                <Text style={styles.toggleLabel}>Escolha o caminho pós-contemplação:</Text>
                <View style={styles.toggleRow}>
                    <TouchableOpacity 
                        style={[styles.toggleBtn, mode === 'REDUZIDO' && styles.toggleBtnActive]}
                        onPress={() => setMode('REDUZIDO')}
                    >
                        <Text style={[styles.toggleBtnText, mode === 'REDUZIDO' && styles.toggleBtnTextActive]}>
                            Caminho 1{'\n'}
                            (Crédito {fatorPlano*100}%)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.toggleBtn, mode === 'CHEIO' && styles.toggleBtnActive]}
                        onPress={() => setMode('CHEIO')}
                    >
                        <Text style={[styles.toggleBtnText, mode === 'CHEIO' && styles.toggleBtnTextActive]}>
                            Caminho 2{'\n'}
                            (Crédito 100%)
                        </Text>
                    </TouchableOpacity>
                </View>
                
                {/* DESCRIÇÃO DO CAMINHO SELECIONADO */}
                <View style={styles.pathDescription}>
                    <Text style={styles.pathDescText}>
                        {mode === 'REDUZIDO' 
                            ? `Você mantém a parcela atual, mas recebe apenas ${fatorPlano*100}% do crédito contratado (menos lances).`
                            : `Você recebe 100% do crédito (menos lances), mas a parcela é reajustada para cobrir a diferença.`
                        }
                    </Text>
                </View>

                {/* ALERTA ESPECÍFICO SUPERLIGHT CAMINHO 1 */}
                {result.plano === 'SUPERLIGHT' && mode === 'REDUZIDO' && (
                    <View style={styles.riskAlert}>
                        <AlertTriangle color="#B91C1C" size={20} />
                        <Text style={styles.riskAlertText}>
                            Atenção: No Superlight, o lance embutido reduz ainda mais seus 50% de crédito. Você pode acabar recebendo apenas 25% do valor total da carta.
                        </Text>
                    </View>
                )}
            </View>
        )}

        {/* --- CABEÇALHO: DESTAQUE PARA A 1ª PARCELA --- */}
        <View style={styles.highlightBox}>
            <View style={styles.rowBetween}>
                <Text style={styles.highlightTitle}>VALOR DA 1ª PARCELA</Text>
                <View style={styles.planBadgeInverse}>
                    <Text style={styles.planBadgeText}>PLANO {result.plano}</Text>
                </View>
            </View>

            <Text style={styles.highlightValue}>{formatBRL(result.totalPrimeiraParcela)}</Text>

            {result.valorAdesao > 0 ? (
                <View style={styles.adesaoRow}>
                    <CheckCircle2 color="#4ADE80" size={18} style={{marginRight: 6}}/>
                    <Text style={styles.highlightSubtitle}>
                        Incluso: Parcela ({formatBRL(result.parcelaPreContemplacao)}) + Adesão ({formatBRL(result.valorAdesao)})
                    </Text>
                </View>
            ) : (
                <Text style={styles.highlightSubtitle}>
                   Referente ao pagamento no ato (sem taxa de adesão).
                </Text>
            )}
        </View>

        {/* Resumo Crédito/Prazo */}
        <View style={styles.grid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>
                {isSpecialPlan ? `Crédito Base (${mode === 'REDUZIDO' ? fatorPlano*100 : '100'}%)` : 'Crédito Contratado'}
            </Text>
            <Text style={styles.statValue}>
                {/* Mostra o Crédito Bruto (antes dos lances) correspondente ao modo */}
                {formatBRL(mode === 'REDUZIDO' && isSpecialPlan ? result.creditoOriginal * fatorPlano : result.creditoOriginal)}
            </Text>
          </View>
           <View style={styles.statBox}>
            <Text style={styles.statLabel}>Prazo</Text>
            <Text style={styles.statValue}>{input.prazo} meses</Text>
          </View>
        </View>

        {/* Lances */}
        {result.lanceTotal > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Análise de Contemplação</Text>
            
            <View style={styles.rowBetween}>
              <Text style={styles.text}>Lance Ofertado (Total):</Text>
              <Text style={[styles.textBold, {color: '#22C55E'}]}>{formatBRL(result.lanceTotal)}</Text>
            </View>
            
            <View style={styles.rowBetween}>
              <Text style={styles.text}>% do Crédito Original:</Text>
              <Text style={styles.textBold}>{((result.lanceTotal / result.creditoOriginal) * 100).toFixed(2)}%</Text>
            </View>
            
            <View style={styles.subDetailBox}>
                <Text style={styles.subDetailTitle}>Composição do Lance:</Text>
                <View style={styles.rowBetween}>
                    <Text style={styles.subDetailText}>• Recursos Próprios (Bolso):</Text>
                    <Text style={styles.subDetailText}>{formatBRL(input.lanceBolso)}</Text>
                </View>
                <View style={styles.rowBetween}>
                    <Text style={styles.subDetailText}>• Lance Embutido (Do Crédito):</Text>
                    <Text style={styles.subDetailText}>{formatBRL(lanceEmbutidoValor)}</Text>
                </View>
                <View style={styles.rowBetween}>
                    <Text style={styles.subDetailText}>• Carta de Avaliação (Bem):</Text>
                    <Text style={styles.subDetailText}>{formatBRL(result.lanceCartaVal)}</Text>
                </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.rowBetween}>
              <Text style={styles.text}>Crédito Líquido (Recebido):</Text>
              <Text style={[styles.textBold, {fontSize: 16}]}>{formatBRL(creditoExibido)}</Text>
            </View>
            <Text style={styles.helperText}>
                Valor disponível para compra do bem (Líquido final).
            </Text>
            

            {result.lanceCartaVal > 0 && (
                <View style={styles.infoBox}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
                        <Car color="#0284C7" size={20} style={{marginRight: 8}}/>
                        <Text style={styles.infoTitle}>Poder de Compra Real</Text>
                    </View>
                    
                    <Text style={styles.infoText}>
                        Ao ser contemplado, você receberá <Text style={{fontWeight:'bold'}}>{formatBRL(creditoExibido)}</Text> em dinheiro. 
                        Somando ao seu bem ofertado ({formatBRL(result.lanceCartaVal)}), você compra um bem de valor total:
                    </Text>

                    <View style={styles.dividerLight} />
                    
                    <View style={styles.rowBetween}>
                        <Text style={styles.infoTotalLabel}>Valor Total do Bem:</Text>
                        <Text style={styles.infoTotalValue}>{formatBRL(creditoExibido + result.lanceCartaVal)}</Text>
                    </View>
                </View>
            )}
          </View>
        )}

        {/* TABELA DE PREVISÃO PÓS-CONTEMPLAÇÃO */}
        {cenarioPrincipal && (
            <View style={styles.card}>
                <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>
                        {isReajustado ? 'Previsão (Parcela Reajustada)' : 'Previsão Pós-Contemplação'}
                    </Text>
                    <CalendarClock color="#64748B" size={20} />
                </View>
                
                {/* Aviso se a parcela foi reajustada (Caminho 2) */}
                {isReajustado && (
                    <View style={[styles.infoBox, {backgroundColor: '#FEFCE8', borderColor: '#FDE047', marginBottom: 12, marginTop: 0}]}>
                        <Text style={[styles.infoText, {color: '#854D0E'}]}>
                            Como você optou por 100% do crédito, a parcela foi reajustada para cobrir a diferença não paga anteriormente.
                        </Text>
                    </View>
                )}

                <Text style={[styles.helperText, {marginBottom: 12}]}>
                    Simulação para os 5 meses seguintes a partir da parcela {cenarioPrincipal.mes}º.
                </Text>

                {/* Resumo Abatimento */}
                 {result.lanceTotal > 0 && (
                    <View style={[styles.infoBox, {backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', marginBottom: 12}]}>
                         <View style={styles.rowBetween}>
                            <Text style={[styles.text, {color: '#059669'}]}>Nova Parcela (Abatimento):</Text>
                            <Text style={[styles.textBold, {color: '#059669', fontSize: 16}]}>{formatBRL(cenarioPrincipal.novaParcela)}</Text>
                        </View>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.text, {color: '#059669'}]}>Parcelas Abatidas:</Text>
                            <Text style={[styles.textBold, {color: '#059669', fontSize: 16}]}>{cenarioPrincipal.parcelasAbatidas.toFixed(1)}x</Text>
                        </View>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.text, {color: '#059669'}]}>Novo Prazo Estimado:</Text>
                            <Text style={[styles.textBold, {color: '#059669', fontSize: 16}]}>{formatMeses(cenarioPrincipal.novoPrazo)}</Text>
                        </View>
                    </View>
                 )}


                <View style={[styles.tableRowHeader, {backgroundColor: '#F1F5F9'}]}>
                    <Text style={[styles.tableHeaderCol, {flex: 0.4}]}>Mês</Text>
                    <Text style={[styles.tableHeaderCol, {flex: 1}]}>Parcela</Text>
                    <Text style={[styles.tableHeaderCol, {flex: 1}]}>Novo Prazo</Text>
                </View>

                {activeScenario.map((cenario) => (
                    <View key={cenario.mes} style={styles.tableRow}>
                        <Text style={[styles.tableCell, {flex: 0.4, fontWeight: 'bold'}]}>{cenario.mes}º</Text>
                        <Text style={[styles.tableCell, {flex: 1, color: '#15803D', fontWeight: 'bold'}]}>
                            {formatBRL(cenario.novaParcela)}
                        </Text>
                        <Text style={[styles.tableCell, {flex: 1}]}>
                            {/* Arredonda para exibição */}
                            {Math.round(cenario.novoPrazo)}x
                        </Text>
                    </View>
                ))}
                
                <Text style={[styles.helperText, {marginTop: 8, fontSize: 10}]}>
                   * Prazo exibido arredondado. Detalhe: {cenarioPrincipal.amortizacaoInfo}
                </Text>
            </View>
        )}

        {/* Detalhamento */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detalhamento Financeiro</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.text}>Taxa Adm Total:</Text>
            <Text style={styles.text}>{formatBRL(result.taxaAdminValor)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.text}>Fundo Reserva:</Text>
            <Text style={styles.text}>{formatBRL(result.fundoReservaValor)}</Text>
          </View>
           <View style={styles.rowBetween}>
            <Text style={styles.text}>Seguro Mensal:</Text>
            <Text style={styles.text}>{formatBRL(result.seguroMensal)}</Text>
          </View>
          
          <View style={styles.rowBetween}>
             <Text style={styles.text}>Taxa de Adesão (Ato):</Text>
             <Text style={styles.text}>{formatBRL(result.valorAdesao)}</Text>
          </View>
          

          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.textBold}>Custo Total Previsto:</Text>
            <Text style={styles.textBold}>{formatBRL(result.custoTotal)}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.mainBtn, {backgroundColor: 'transparent', borderWidth: 1, borderColor: '#0F172A', marginBottom: 20}]} 
          onPress={() => navigation.popToTop()}
        >
            <Text style={[styles.mainBtnText, {color: '#0F172A'}]}>NOVA SIMULAÇÃO</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  navHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { padding: 8, marginRight: 8 },
  navTitle: { fontSize: 18, fontWeight: '600', color: '#0F172A' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  highlightBox: { 
      backgroundColor: '#0F172A', 
      borderRadius: 16, 
      padding: 20, 
      marginBottom: 24, 
      shadowColor: '#000', 
      shadowOpacity: 0.2, 
      shadowRadius: 5, 
      elevation: 4 
  },
  highlightTitle: { color: '#94A3B8', fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  highlightValue: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginVertical: 8 },
  highlightSubtitle: { color: '#CBD5E1', fontSize: 13 },
  planBadgeInverse: { backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  planBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  adesaoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 8 },

  grid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', elevation: 1 },
  statLabel: { fontSize: 12, color: '#64748B' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  text: { fontSize: 14, color: '#334155' },
  textBold: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  helperText: { fontSize: 12, color: '#94A3B8', marginTop: 4, fontStyle: 'italic' },
  mainBtn: { borderRadius: 12, padding: 16, alignItems: 'center' },
  mainBtnText: { fontWeight: 'bold', fontSize: 16 },
  
  subDetailBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  subDetailTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748B', marginBottom: 8, textTransform: 'uppercase' },
  subDetailText: { fontSize: 12, color: '#475569' },
  
  infoBox: { marginTop: 16, backgroundColor: '#F0F9FF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#BAE6FD' },
  infoTitle: { color: '#0284C7', fontWeight: 'bold', fontSize: 14 },
  infoText: { color: '#334155', fontSize: 13, lineHeight: 20 },
  dividerLight: { height: 1, backgroundColor: '#BAE6FD', marginVertical: 12 },
  infoTotalLabel: { color: '#0369A1', fontWeight: 'bold', fontSize: 14 },
  infoTotalValue: { color: '#0369A1', fontWeight: 'bold', fontSize: 18 },

  tableRowHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', borderRadius: 6 },
  tableHeaderCol: { fontSize: 12, fontWeight: 'bold', color: '#64748B', textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tableCell: { fontSize: 13, color: '#334155', textAlign: 'center' },

  // --- ESTILOS DO TOGGLE (NOVO) ---
  toggleContainer: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, elevation: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  toggleBtnActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  toggleBtnText: { fontSize: 12, color: '#64748B', textAlign: 'center', fontWeight: '600' },
  toggleBtnTextActive: { color: '#fff' },
  pathDescription: { marginTop: 12, padding: 12, backgroundColor: '#F1F5F9', borderRadius: 8 },
  pathDescText: { fontSize: 13, color: '#334155', fontStyle: 'italic' },
  riskAlert: { flexDirection: 'row', gap: 8, marginTop: 12, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FECACA' },
  riskAlertText: { flex: 1, fontSize: 12, color: '#B91C1C', fontWeight: '600' },
});