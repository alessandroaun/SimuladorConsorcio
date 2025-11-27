import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, 
  Platform, StatusBar, Modal, TextInput, KeyboardAvoidingView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { 
  ArrowLeft, Share2, CheckCircle2, Car, CalendarClock, AlertTriangle, 
  Ban, DollarSign, Calendar, FileText, Info, RefreshCw, TrendingDown,
  User, Phone, Briefcase, X, FileOutput
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { RootStackParamList } from '../types/navigation';
import { ContemplationScenario } from '../utils/ConsortiumCalculator';
import { generateHTML } from '../utils/GeneratePDFHtml';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

type ScenarioMode = 'REDUZIDO' | 'CHEIO';

export default function ResultScreen({ route, navigation }: Props) {
  // Pega quotaCount se vier, senão assume 1
  const { result, input, quotaCount = 1 } = route.params;
  
  // Verifica se o Caminho 1 é viável (não é null)
  const isCaminho1Viable = result.cenarioCreditoReduzido !== null;

  // Estado para controlar qual caminho o usuário está vendo
  const [mode, setMode] = useState<ScenarioMode>(isCaminho1Viable ? 'REDUZIDO' : 'CHEIO');

  // Estados para o Modal de PDF
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfClient, setPdfClient] = useState('');
  const [pdfClientPhone, setPdfClientPhone] = useState(''); // Telefone do Cliente
  const [pdfSeller, setPdfSeller] = useState(''); // Nome Vendedor
  const [pdfSellerPhone, setPdfSellerPhone] = useState(''); // NOVO: Telefone Vendedor

  const isSpecialPlan = result.plano === 'LIGHT' || result.plano === 'SUPERLIGHT';
  const fatorPlano = result.plano === 'LIGHT' ? 0.75 : result.plano === 'SUPERLIGHT' ? 0.50 : 1.0;

  const handleOpenPdfModal = () => {
    setShowPdfModal(true);
  }

  const handleGeneratePDF = async () => {
    setShowPdfModal(false);
    try {
      const html = generateHTML(
        result, 
        input, 
        mode, 
        {
          cliente: pdfClient,
          telefoneCliente: pdfClientPhone,
          vendedor: pdfSeller,
          telefoneVendedor: pdfSellerPhone // Passando o novo campo
        },
        quotaCount
      );
      
      const { uri } = await Print.printToFileAsync({ html });
      
      if (Platform.OS === "ios" || Platform.OS === "android") {
          await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
          Alert.alert("Sucesso", "PDF gerado.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível gerar o PDF.");
    }
  };

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPct = (v: number) => v.toFixed(2).replace('.', ',');

  // --- SELEÇÃO DE DADOS COM BASE NO MODO ---
  let activeScenario: ContemplationScenario[];
  let creditoExibido: number;
  let custoTotalExibido: number;
  let isReajustado = false;

  if (isSpecialPlan && result.cenarioCreditoTotal) { 
      if (mode === 'REDUZIDO' && isCaminho1Viable && result.cenarioCreditoReduzido) {
          activeScenario = result.cenarioCreditoReduzido;
          creditoExibido = activeScenario[0].creditoEfetivo;
          custoTotalExibido = result.custoTotalReduzido || result.custoTotal;
      } else {
          activeScenario = result.cenarioCreditoTotal;
          creditoExibido = activeScenario[0].creditoEfetivo;
          custoTotalExibido = result.custoTotalCheio || result.custoTotal;
          isReajustado = true;
      }
  } else {
      activeScenario = result.cenariosContemplacao;
      creditoExibido = result.creditoLiquido;
      custoTotalExibido = result.custoTotal;
  }

  // --- CÁLCULO PERSONALIZADO DE CUSTO TOTAL (QUANDO TEM CARTA DE AVALIAÇÃO) ---
  if (result.lanceCartaVal > 0) {
      const lanceEmbutido = result.lanceTotal - input.lanceBolso - result.lanceCartaVal;
      const creditoLiquidoNaMaoAjustado = result.creditoOriginal - lanceEmbutido - result.lanceCartaVal;
      
      const taxasSomadas = 
        result.taxaAdminValor + 
        result.fundoReservaValor + 
        result.seguroMensal + 
        result.valorAdesao;

      custoTotalExibido = taxasSomadas + creditoLiquidoNaMaoAjustado;
  }

  const cenarioPrincipal = activeScenario && activeScenario.length > 0 ? activeScenario[0] : null;
  const lanceEmbutidoValor = result.lanceTotal - input.lanceBolso - result.lanceCartaVal;

  const mesContemplacaoRef = Math.max(1, input.mesContemplacao);
  const prazoRestanteOriginal = Math.max(0, input.prazo - mesContemplacaoRef);
  const mesesAbatidosCalc = cenarioPrincipal ? Math.max(0, prazoRestanteOriginal - cenarioPrincipal.novoPrazo) : 0;

  const safeCenario = cenarioPrincipal as any; 
  const reducaoValor = safeCenario?.reducaoValor ?? 0;
  const reducaoPorcentagem = safeCenario?.reducaoPorcentagem ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* CABEÇALHO */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Resultado</Text>
        
        <TouchableOpacity 
          onPress={handleOpenPdfModal} 
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Share2 color="#2563EB" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- HERO CARD --- */}
        <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
                <Text style={styles.heroLabel}>VALOR DA 1ª PARCELA</Text>
                <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>PLANO {result.plano}</Text>
                </View>
            </View>

            <Text style={styles.heroValue}>{formatBRL(result.totalPrimeiraParcela)}</Text>

            <View style={styles.heroFooter}>
                {result.valorAdesao > 0 ? (
                    <View style={styles.heroCheckRow}>
                        <CheckCircle2 color="#4ADE80" size={16} />
                        <Text style={styles.heroFooterText}>
                            Inclui Parcela ({formatBRL(result.parcelaPreContemplacao)}) + Adesão ({formatBRL(result.valorAdesao)})
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.heroFooterText}>Pagamento referente à primeira mensalidade.</Text>
                )}
            </View>
        </View>

        {/* --- SELETOR DE CAMINHO --- */}
        {isSpecialPlan && (
            <View style={styles.toggleContainer}>
                <View style={styles.toggleHeader}>
                    <Text style={styles.sectionTitle}>Opções Pós-Contemplação</Text>
                    <Info size={16} color="#64748B" />
                </View>

                {!isCaminho1Viable && (
                   <View style={styles.blockedAlert}>
                      <Ban color="#EF4444" size={16} />
                      <Text style={styles.blockedText}>
                        Caminho 1 indisponível: Lances excedem saldo devedor ou crédito reduzido.
                      </Text>
                   </View>
                )}

                <View style={styles.toggleTrack}>
                    <TouchableOpacity 
                        style={[
                            styles.toggleOption, 
                            mode === 'REDUZIDO' && styles.toggleOptionActive,
                            !isCaminho1Viable && styles.toggleOptionDisabled
                        ]}
                        onPress={() => isCaminho1Viable && setMode('REDUZIDO')}
                        disabled={!isCaminho1Viable}
                        activeOpacity={0.8}
                    >
                        <Text style={[
                            styles.toggleText, 
                            mode === 'REDUZIDO' && styles.toggleTextActive,
                            !isCaminho1Viable && styles.toggleTextDisabled
                        ]}>
                            Caminho 1 ({fatorPlano*100}%)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.toggleOption, mode === 'CHEIO' && styles.toggleOptionActive]}
                        onPress={() => setMode('CHEIO')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.toggleText, mode === 'CHEIO' && styles.toggleTextActive]}>
                            Caminho 2 (100%)
                        </Text>
                    </TouchableOpacity>
                </View>
                
                <Text style={styles.toggleDescription}>
                    {mode === 'REDUZIDO' 
                        ? `Mantém a parcela original, recebendo crédito proporcional de ${(fatorPlano*100).toFixed(0)}%.`
                        : `Recebe 100% do crédito, com reajuste na parcela para cobrir a diferença.`
                    }
                </Text>

                {result.plano === 'SUPERLIGHT' && mode === 'REDUZIDO' && isCaminho1Viable && (
                    <View style={styles.warningBox}>
                        <AlertTriangle color="#B45309" size={16} />
                        <Text style={styles.warningText}>
                            Lance embutido reduz ainda mais o crédito de 50%.
                        </Text>
                    </View>
                )}
            </View>
        )}

        {/* --- GRID DE MÉTRICAS --- */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={[styles.iconBubble, {backgroundColor: '#EFF6FF'}]}>
                <DollarSign color="#2563EB" size={20} />
            </View>
            <Text style={styles.metricLabel}>
                {isSpecialPlan ? `Crédito Base` : 'Crédito'}
            </Text>
            <Text style={styles.metricValue}>
                {formatBRL(mode === 'REDUZIDO' && isSpecialPlan ? result.creditoOriginal * fatorPlano : result.creditoOriginal)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.iconBubble, {backgroundColor: '#F0FDF4'}]}>
                <Calendar color="#16A34A" size={20} />
            </View>
            <Text style={styles.metricLabel}>Prazo Total</Text>
            <Text style={styles.metricValue}>{input.prazo} meses</Text>
          </View>
        </View>

        {/* --- ANÁLISE DE LANCES --- */}
        {result.lanceTotal > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
                 <Text style={styles.cardTitle}>Análise do Lance</Text>
            </View>
            
            <View style={styles.lanceHighlight}>
                <View>
                    <Text style={styles.lanceLabel}>Lance Total Ofertado</Text>
                    <Text style={styles.lanceValueBig}>{formatBRL(result.lanceTotal)}</Text>
                </View>
                <View style={styles.lanceBadge}>
                    <Text style={styles.lanceBadgeText}>{((result.lanceTotal / result.creditoOriginal) * 100).toFixed(1)}%</Text>
                </View>
            </View>
            
            <View style={styles.lanceBreakdown}>
                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Recursos Próprios (Bolso)</Text>
                    <Text style={styles.breakdownValue}>{formatBRL(input.lanceBolso)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Lance Embutido (Do Crédito)</Text>
                    <Text style={styles.breakdownValue}>{formatBRL(lanceEmbutidoValor)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Carta Avaliação (Bem)</Text>
                    <Text style={styles.breakdownValue}>{formatBRL(result.lanceCartaVal)}</Text>
                </View>
            </View>
            
            <View style={styles.liquidBox}>
                <View style={styles.rowBetween}>
                    <Text style={styles.liquidLabel}>Crédito Líquido na Mão</Text>
                    <Text style={styles.liquidValue}>{formatBRL(creditoExibido)}</Text>
                </View>
                <Text style={styles.liquidDesc}>Valor disponível para compra após descontos.</Text>
            </View>
          </View>
        )}

        {/* --- PREVISÃO PÓS-CONTEMPLAÇÃO --- */}
        {cenarioPrincipal && (
            <View style={styles.card}>
                <View style={[styles.cardHeader, {borderBottomWidth: 0}]}>
                    <Text style={styles.cardTitle}>Simulação Pós-Contemplação</Text>
                    <CalendarClock color="#64748B" size={20} />
                </View>
                
                {/* TABELA LIMPA */}
                <View style={styles.tableContainer}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, {flex: 0.5}]}>Mês</Text>
                        <Text style={[styles.th, {flex: 1.2}]}>Parcela</Text>
                        <Text style={[styles.th, {flex: 1, textAlign: 'right'}]}>Prazo Restante</Text>
                    </View>

                    {activeScenario.map((cenario, index) => (
                        <View key={cenario.mes} style={[styles.tr, index % 2 !== 0 && styles.trAlt]}>
                            <Text style={[styles.td, {flex: 0.5, fontWeight: '600'}]}>{cenario.mes}º</Text>
                            <Text style={[styles.td, {flex: 1.2, color: '#15803D', fontWeight: '700'}]}>
                                {formatBRL(cenario.novaParcela)}
                            </Text>
                            <Text style={[styles.td, {flex: 1, textAlign: 'right'}]}>
                                {Math.round(cenario.novoPrazo)}x
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        )}

        <View style={{height: 20}} />

      </ScrollView>

      {/* --- MODAL DE DADOS PARA PDF --- */}
      <Modal 
        visible={showPdfModal} 
        animationType="slide" 
        transparent 
        onRequestClose={() => setShowPdfModal(false)}
      >
          <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalOverlay}
          >
              <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Gerar Proposta PDF</Text>
                      <TouchableOpacity onPress={() => setShowPdfModal(false)} style={styles.closeBtn}>
                          <X color="#64748B" size={24} />
                      </TouchableOpacity>
                  </View>
                  
                  <ScrollView style={{maxHeight: 500}}>
                      {/* CLIENTE */}
                      <View style={styles.inputGroup}>
                          <View style={styles.labelRow}>
                              <User size={16} color="#64748B" />
                              <Text style={styles.inputLabel}>Nome do Cliente</Text>
                          </View>
                          <TextInput 
                              style={styles.input} 
                              placeholder="Nome completo"
                              value={pdfClient}
                              onChangeText={setPdfClient}
                          />
                      </View>

                      <View style={styles.inputGroup}>
                          <View style={styles.labelRow}>
                              <Phone size={16} color="#64748B" />
                              <Text style={styles.inputLabel}>Telefone Cliente</Text>
                          </View>
                          <TextInput 
                              style={styles.input} 
                              placeholder="(00) 00000-0000"
                              keyboardType="phone-pad"
                              value={pdfClientPhone}
                              onChangeText={setPdfClientPhone}
                          />
                      </View>

                      <View style={styles.divider} />

                      {/* VENDEDOR */}
                      <View style={styles.inputGroup}>
                          <View style={styles.labelRow}>
                              <Briefcase size={16} color="#64748B" />
                              <Text style={styles.inputLabel}>Nome Vendedor / Representante</Text>
                          </View>
                          <TextInput 
                              style={styles.input} 
                              placeholder="Seu nome"
                              value={pdfSeller}
                              onChangeText={setPdfSeller}
                          />
                      </View>

                      <View style={styles.inputGroup}>
                          <View style={styles.labelRow}>
                              <Phone size={16} color="#64748B" />
                              <Text style={styles.inputLabel}>Telefone do Vendedor</Text>
                          </View>
                          <TextInput 
                              style={styles.input} 
                              placeholder="(00) 00000-0000"
                              keyboardType="phone-pad"
                              value={pdfSellerPhone}
                              onChangeText={setPdfSellerPhone}
                          />
                      </View>

                  </ScrollView>

                  <TouchableOpacity style={styles.generateBtn} onPress={handleGeneratePDF}>
                      <FileOutput color="#fff" size={20} style={{marginRight: 8}} />
                      <Text style={styles.generateBtnText}>GERAR PDF</Text>
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // HEADER
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    backgroundColor: '#F8FAFC' 
  },
  iconButton: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // HERO CARD
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroLabel: { color: '#94A3B8', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  planBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  planBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  heroValue: { color: '#fff', fontSize: 38, fontWeight: '800', marginBottom: 16, letterSpacing: -1 },
  heroFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  heroCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroFooterText: { color: '#CBD5E1', fontSize: 13, fontWeight: '500' },

  // TOGGLE SECTION
  toggleContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  toggleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  
  toggleTrack: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 12 },
  toggleOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  toggleOptionActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  toggleOptionDisabled: { opacity: 0.5 },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#0F172A', fontWeight: '700' },
  toggleTextDisabled: { color: '#94A3B8' },
  
  toggleDescription: { fontSize: 13, color: '#64748B', lineHeight: 20, textAlign: 'center', fontStyle: 'italic' },
  
  blockedAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, marginBottom: 12, gap: 8 },
  blockedText: { color: '#EF4444', fontSize: 12, fontWeight: '600', flex: 1 },
  
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', padding: 10, borderRadius: 8, marginTop: 12, gap: 8, borderWidth: 1, borderColor: '#FEF3C7' },
  warningText: { color: '#B45309', fontSize: 12, fontWeight: '600', flex: 1 },

  // METRICS GRID
  metricsGrid: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  metricCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  iconBubble: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricLabel: { fontSize: 12, color: '#64748B', marginBottom: 4, fontWeight: '600' },
  metricValue: { fontSize: 16, fontWeight: '800', color: '#0F172A' },

  // GENERIC CARD
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },

  // LANCE STYLES
  lanceHighlight: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  lanceLabel: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  lanceValueBig: { fontSize: 22, fontWeight: '800', color: '#16A34A' },
  lanceBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  lanceBadgeText: { color: '#16A34A', fontWeight: '700', fontSize: 12 },
  
  lanceBreakdown: { paddingVertical: 16 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { fontSize: 13, color: '#64748B' },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: '#334155' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  
  liquidBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liquidLabel: { fontSize: 14, fontWeight: '700', color: '#334155' },
  liquidValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  liquidDesc: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  
  powerBox: { marginTop: 12, backgroundColor: '#F0F9FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD' },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  powerTitle: { fontSize: 14, fontWeight: '700', color: '#0284C7' },
  powerValue: { fontSize: 20, fontWeight: '800', color: '#0369A1' },
  powerDesc: { fontSize: 12, color: '#0369A1', marginTop: 4, opacity: 0.8 },

  // SCENARIO STYLES
  reajusteAlert: { backgroundColor: '#FEFCE8', padding: 10, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#FEF3C7' },
  reajusteText: { color: '#B45309', fontSize: 12, textAlign: 'center', fontWeight: '600' },
  
  scenarioHighlight: { flexDirection: 'row', backgroundColor: '#F0FDF4', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#DCFCE7' },
  scenarioItem: { flex: 1, alignItems: 'center' },
  scenarioDivider: { width: 1, backgroundColor: '#BBF7D0', marginHorizontal: 10 },
  scenarioLabel: { fontSize: 11, color: '#15803D', textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  scenarioValueMain: { fontSize: 20, color: '#15803D', fontWeight: '800' },
  scenarioValue: { fontSize: 18, color: '#15803D', fontWeight: '700' },

  tableContainer: { borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  th: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tr: { flexDirection: 'row', padding: 12, backgroundColor: '#fff' },
  trAlt: { backgroundColor: '#FAFAFA' },
  td: { fontSize: 13, color: '#334155' },
  tableFooter: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic', marginTop: 12, textAlign: 'center' },

  // DETAILS
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailLabel: { fontSize: 14, color: '#64748B' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, marginTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

  // BUTTONS
  outlineButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  outlineButtonText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  closeBtn: { padding: 4, backgroundColor: '#F1F5F9', borderRadius: 12 },
  
  inputGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#334155' },
  input: { 
      backgroundColor: '#F8FAFC', 
      borderWidth: 1, 
      borderColor: '#E2E8F0', 
      borderRadius: 12, 
      padding: 16, 
      fontSize: 16, 
      color: '#0F172A' 
  },

  generateBtn: { 
      backgroundColor: '#0F172A', 
      borderRadius: 16, 
      padding: 18, 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center',
      marginTop: 24,
      marginBottom: Platform.OS === 'ios' ? 24 : 0
  },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});