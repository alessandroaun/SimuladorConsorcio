import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, 
  Platform, StatusBar, Modal, TextInput, KeyboardAvoidingView, Dimensions, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { 
  ArrowLeft, Share2, CheckCircle2, Car, CalendarClock, AlertTriangle, 
  Ban, DollarSign, Calendar, FileText, Info, RefreshCw, TrendingDown,
  User, Phone, Briefcase, X, FileOutput, Wallet, PieChart, ChevronRight,
  BarChart3, Globe, Users
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Importação do WebView para exibir o PowerBI
import { WebView } from 'react-native-webview';

// CORREÇÃO: Importação padrão. O código já protege o uso na web com 'if (Platform.OS === 'web')'
import * as FileSystem from 'expo-file-system';

import { RootStackParamList } from '../types/navigation';
import { ContemplationScenario } from '../utils/ConsortiumCalculator';
import { generateHTML } from '../utils/GeneratePDFHtml';
import { TABLES_METADATA } from '../../data/TableRepository';

// REMOVIDO: Importação local
// import GROUPS_DATA from '../data/json/groups_data.json';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

type ScenarioMode = 'REDUZIDO' | 'CHEIO';

const { width, height } = Dimensions.get('window');

// URL do PowerBI fornecido
const POWERBI_URL = "https://app.powerbi.com/view?r=eyJrIjoiNmJlOTI0ZTYtY2UwNi00NmZmLWE1NzQtNjUwNjUxZTk3Nzg0IiwidCI6ImFkMjI2N2U3LWI4ZTctNDM4Ni05NmFmLTcxZGVhZGQwODY3YiJ9";

// URL para o JSON de Grupos (Hospedado externamente)
// Usamos o CDN do JSDelivr para garantir performance e contornar cache agressivo
const GROUPS_DATA_URL = "https://cdn.jsdelivr.net/gh/alessandroaun/SimuladorConsorcio@master/relacao_grupos.json";

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
  const [pdfClientPhone, setPdfClientPhone] = useState(''); 
  const [pdfSeller, setPdfSeller] = useState(''); 
  const [pdfSellerPhone, setPdfSellerPhone] = useState(''); 

  // Estado para o Modal do PowerBI
  const [showPowerBi, setShowPowerBi] = useState(false);

  // Estados para Grupos Online
  const [groupsData, setGroupsData] = useState<any[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  const isSpecialPlan = result.plano === 'LIGHT' || result.plano === 'SUPERLIGHT';
  const fatorPlano = result.plano === 'LIGHT' ? 0.75 : result.plano === 'SUPERLIGHT' ? 0.50 : 1.0;

  // BUSCA OS DADOS DOS GRUPOS NA INTERNET
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        // Adiciona timestamp para evitar cache stale (igual ao DataService)
        const url = `${GROUPS_DATA_URL}?t=${new Date().getTime()}`;
        console.log("Buscando grupos em:", url);
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setGroupsData(data);
        } else {
          console.warn("Falha ao baixar grupos:", response.status);
        }
      } catch (error) {
        console.error("Erro ao buscar grupos:", error);
      } finally {
        setIsLoadingGroups(false);
      }
    };

    fetchGroups();
  }, []);

  // Lógica para filtrar Grupos Compatíveis
  const compatibleGroups = useMemo(() => {
    // Se ainda está carregando ou não tem dados, retorna vazio
    if (isLoadingGroups || groupsData.length === 0) return [];

    // 1. Identificar a categoria da simulação atual
    const currentTable = TABLES_METADATA.find(t => t.id === input.tableId);
    if (!currentTable) return [];

    // Mapeamento atualizado: AUTO e MOTO viram "VEÍCULO"
    const categoryMap: Record<string, string> = {
      'AUTO': 'VEÍCULO',
      'MOTO': 'VEÍCULO',
      'IMOVEL': 'IMÓVEL',
      'SERVICOS': 'SERVIÇO'
    };

    const targetType = categoryMap[currentTable.category];

    return groupsData.filter((group: any) => {
      // Filtro 1: Tipo/Categoria
      if (group.TIPO !== targetType) return false;

      // Filtro 2: Prazo (O prazo da simulação deve ser menor ou igual ao máximo do grupo)
      if (input.prazo > group["Prazo Máximo"]) return false;

      // Filtro 3: Faixa de Crédito
      const rangeString = group["Créditos Disponíveis"];
      if (!rangeString) return false;

      const rangeParts = rangeString.replace(/\./g, '').split(' até ');
      if (rangeParts.length !== 2) return false;
      
      const minCredit = parseFloat(rangeParts[0]);
      const maxCredit = parseFloat(rangeParts[1]);

      // Compara com o crédito original de UMA cota (limite do grupo é por cota)
      if (result.creditoOriginal < minCredit || result.creditoOriginal > maxCredit) return false;

      return true;
    }).map((g: any) => g.Grupo); // Retorna apenas os números dos grupos
  }, [input.tableId, input.prazo, result.creditoOriginal, groupsData, isLoadingGroups]);

  const handleOpenPdfModal = () => {
    setShowPdfModal(true);
  }

  const handleGeneratePDF = async () => {
    // Fecha o modal antes de processar para evitar UI travada
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
          telefoneVendedor: pdfSellerPhone 
        },
        quotaCount
      );
      
      // --- LÓGICA ESPECÍFICA PARA WEB (CORRIGIDA) ---
      if (Platform.OS === 'web') {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 500);
          } else {
             Alert.alert("Atenção", "Por favor, permita pop-ups para gerar o PDF.");
          }
          return; 
      }

      // --- LÓGICA PARA ANDROID / IOS (NATIVA) ---
      const { uri } = await Print.printToFileAsync({ 
        html,
        base64: false 
      });
      
      const nomeClienteLimpo = pdfClient 
        ? pdfClient.replace(/[^a-zA-Z0-9]/g, '_') 
        : 'Cliente';
      
      const valorTotalCredito = result.creditoOriginal * quotaCount;
      const valorFormatado = valorTotalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
      const fileName = `Simulacao_${nomeClienteLimpo}_R$${valorFormatado}.pdf`;
      
      const fs = FileSystem as any;
      let targetDirectory = fs.documentDirectory || fs.cacheDirectory;

      if (!targetDirectory && uri) {
        const lastSlashIndex = uri.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
            targetDirectory = uri.substring(0, lastSlashIndex + 1);
        }
      }

      let finalUri = uri; 

      if (targetDirectory) {
        try {
            const newUri = targetDirectory + fileName;
            await fs.moveAsync({
                from: uri,
                to: newUri
            });
            finalUri = newUri; 
        } catch (moveError) {
            console.warn("Não foi possível renomear o arquivo, compartilhando com nome original.", moveError);
        }
      }

      await Sharing.shareAsync(finalUri, { 
        UTI: '.pdf', 
        mimeType: 'application/pdf',
        dialogTitle: `Compartilhar Simulação - ${pdfClient}`
      });

    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível gerar o PDF.");
    }
  };

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  // --- SELEÇÃO DE DADOS COM BASE NO MODO ---
  let activeScenario: ContemplationScenario[];
  let creditoExibido: number;
  let isReajustado = false;

  if (isSpecialPlan && result.cenarioCreditoTotal) { 
      if (mode === 'REDUZIDO' && isCaminho1Viable && result.cenarioCreditoReduzido) {
          activeScenario = result.cenarioCreditoReduzido;
          creditoExibido = activeScenario[0].creditoEfetivo;
      } else {
          activeScenario = result.cenarioCreditoTotal;
          creditoExibido = activeScenario[0].creditoEfetivo;
          isReajustado = true;
      }
  } else {
      activeScenario = result.cenariosContemplacao;
      creditoExibido = result.creditoLiquido;
  }

  const cenarioPrincipal = activeScenario && activeScenario.length > 0 ? activeScenario[0] : null;
  const lanceEmbutidoValor = result.lanceTotal - input.lanceBolso - result.lanceCartaVal;

  const mesContemplacaoRef = Math.max(1, input.mesContemplacao);
  const prazoRestanteOriginal = Math.max(0, input.prazo - mesContemplacaoRef);
  const mesesAbatidosCalc = cenarioPrincipal ? Math.max(0, prazoRestanteOriginal - cenarioPrincipal.novoPrazo) : 0;

  const safeCenario = cenarioPrincipal as any; 
  const reducaoValor = safeCenario?.reducaoValor ?? 0;
  const reducaoPorcentagem = safeCenario?.reducaoPorcentagem ?? 0;

  const totalSeguroNoPrazo = result.seguroMensal * input.prazo;
  const valorReducaoCreditoBase = (isSpecialPlan && mode === 'REDUZIDO') 
    ? (result.creditoOriginal * (1 - fatorPlano)) 
    : 0;

  let custoTotalExibido = 
      result.creditoOriginal + 
      result.taxaAdminValor + 
      result.fundoReservaValor + 
      totalSeguroNoPrazo + 
      result.valorAdesao - 
      lanceEmbutidoValor - 
      result.lanceCartaVal - 
      valorReducaoCreditoBase;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* CABEÇALHO MODERNO */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft color="#1E293B" size={22} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Resultado</Text>
        
        <View style={{flexDirection: 'row', gap: 8}}>
            {/* BOTÃO POWER BI */}
            <TouchableOpacity 
              onPress={() => setShowPowerBi(true)} 
              style={[styles.actionButton, {backgroundColor: '#F59E0B'}]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <BarChart3 color="#fff" size={18} />
            </TouchableOpacity>

            {/* BOTÃO PDF */}
            <TouchableOpacity 
              onPress={handleOpenPdfModal} 
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Share2 color="#fff" size={18} />
              <Text style={styles.actionButtonText}>PDF</Text>
            </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- HERO CARD PREMIUM --- */}
        <View style={styles.heroContainer}>
            <View style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                    <View>
                        <Text style={styles.heroLabel}>1ª PARCELA + ADESÃO</Text>
                        <Text style={styles.heroValue}>{formatBRL(result.totalPrimeiraParcela)}</Text>
                    </View>
                    <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>{result.plano}</Text>
                    </View>
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroBottomRow}>
                    {result.valorAdesao > 0 ? (
                        <View style={styles.heroDetailItem}>
                            <CheckCircle2 color="#4ADE80" size={14} style={{marginRight: 6}} />
                            <Text style={styles.heroDetailText}>
                                Parcela {formatBRL(result.parcelaPreContemplacao)} + Adesão {formatBRL(result.valorAdesao)}
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.heroDetailText}>Pagamento referente à primeira mensalidade.</Text>
                    )}
                </View>
            </View>
            <View style={styles.heroCardLayer1} />
            <View style={styles.heroCardLayer2} />
        </View>

        {/* --- SELETOR DE CAMINHO --- */}
        {isSpecialPlan && (
            <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Cenário Pós-Contemplação</Text>
                    <Info size={16} color="#94A3B8" />
                </View>

                {!isCaminho1Viable && (
                   <View style={styles.errorBanner}>
                      <Ban color="#EF4444" size={16} />
                      <Text style={styles.errorText}>
                        Opção de Crédito Reduzido indisponível para esta configuração.
                      </Text>
                   </View>
                )}

                <View style={styles.switchContainer}>
                    <TouchableOpacity 
                        style={[
                            styles.switchButton, 
                            mode === 'REDUZIDO' && styles.switchActive,
                            !isCaminho1Viable && styles.switchDisabled
                        ]}
                        onPress={() => isCaminho1Viable && setMode('REDUZIDO')}
                        disabled={!isCaminho1Viable}
                        activeOpacity={0.9}
                    >
                        <Text style={[
                            styles.switchText, 
                            mode === 'REDUZIDO' ? styles.switchTextActive : styles.switchTextInactive
                        ]}>
                            Crédito Reduzido ({fatorPlano*100}%)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.switchButton, mode === 'CHEIO' && styles.switchActive]}
                        onPress={() => setMode('CHEIO')}
                        activeOpacity={0.9}
                    >
                        <Text style={[styles.switchText, mode === 'CHEIO' ? styles.switchTextActive : styles.switchTextInactive]}>
                            Crédito Cheio (100%)
                        </Text>
                    </TouchableOpacity>
                </View>
                
                <Text style={styles.helperText}>
                    {mode === 'REDUZIDO' 
                        ? `Mantém a parcela original. O crédito é ajustado proporcionalmente.`
                        : `Recebe o crédito total. A parcela é reajustada para cobrir a diferença.`
                    }
                </Text>
            </View>
        )}

        {/* --- CARDS DE MÉTRICAS --- */}
        <View style={styles.gridContainer}>
          <View style={styles.gridCard}>
            <View style={styles.gridHeader}>
                <View style={[styles.iconCircle, {backgroundColor: '#EFF6FF'}]}>
                    <DollarSign color="#3B82F6" size={20} />
                </View>
            </View>
            <View style={styles.gridContent}>
                <Text style={styles.gridLabel} numberOfLines={1} adjustsFontSizeToFit>
                    {isSpecialPlan ? `Crédito Base` : 'Crédito Contratado'}
                </Text>
                <Text style={styles.gridValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatBRL(mode === 'REDUZIDO' && isSpecialPlan ? result.creditoOriginal * fatorPlano : result.creditoOriginal)}
                </Text>
            </View>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.gridHeader}>
                <View style={[styles.iconCircle, {backgroundColor: '#F0FDF4'}]}>
                    <Calendar color="#16A34A" size={20} />
                </View>
            </View>
            <View style={styles.gridContent}>
                <Text style={styles.gridLabel} numberOfLines={1} adjustsFontSizeToFit>Prazo Total</Text>
                <Text style={styles.gridValue} numberOfLines={1} adjustsFontSizeToFit>{input.prazo} meses</Text>
            </View>
          </View>
        </View>

        {/* --- ANÁLISE DE LANCES --- */}
        {result.lanceTotal > 0 && (
          <View style={styles.contentCard}>
            <View style={styles.cardHeaderRow}>
                 <Text style={styles.cardTitle}>Composição do Lance</Text>
                 <View style={styles.percentBadge}>
                    <Text style={styles.percentText}>{((result.lanceTotal / result.creditoOriginal) * 100).toFixed(2)}%</Text>
                 </View>
            </View>
            
            <View style={styles.lanceList}>
                <View style={styles.lanceRow}>
                    <View style={styles.lanceRowLeft}>
                        <View style={[styles.miniIcon, {backgroundColor: '#F1F5F9'}]}>
                             <Wallet size={14} color="#64748B" />
                        </View>
                        <Text style={styles.lanceRowLabel}>Recursos Próprios</Text>
                    </View>
                    <Text style={styles.lanceRowValue}>{formatBRL(input.lanceBolso)}</Text>
                </View>

                {lanceEmbutidoValor > 0 && (
                    <View style={styles.lanceRow}>
                        <View style={styles.lanceRowLeft}>
                            <View style={[styles.miniIcon, {backgroundColor: '#FFF7ED'}]}>
                                <PieChart size={14} color="#EA580C" />
                            </View>
                            <Text style={styles.lanceRowLabel}>Lance Embutido</Text>
                        </View>
                        <Text style={styles.lanceRowValue}>{formatBRL(lanceEmbutidoValor)}</Text>
                    </View>
                )}

                {result.lanceCartaVal > 0 && (
                    <View style={styles.lanceRow}>
                        <View style={styles.lanceRowLeft}>
                            <View style={[styles.miniIcon, {backgroundColor: '#F0F9FF'}]}>
                                <Car size={14} color="#0284C7" />
                            </View>
                            <Text style={styles.lanceRowLabel}>Carta Avaliação</Text>
                        </View>
                        <Text style={styles.lanceRowValue}>{formatBRL(result.lanceCartaVal)}</Text>
                    </View>
                )}

                <View style={styles.dashDivider} />

                <View style={styles.totalLanceRow}>
                    <Text style={styles.totalLanceLabel}>Total Ofertado</Text>
                    <Text style={styles.totalLanceValue}>{formatBRL(result.lanceTotal)}</Text>
                </View>
            </View>

            {/* CRÉDITO LÍQUIDO */}
            <View style={styles.featuredBox}>
                <Text style={styles.featuredValue}>{formatBRL(creditoExibido)}</Text>
                <Text style={styles.featuredLabel}>CRÉDITO LÍQUIDO</Text>
                <Text style={styles.featuredSub}>Disponível para compra do bem</Text>
            </View>

            {/* PODER DE COMPRA */}
             {result.lanceCartaVal > 0 && (
                <View style={styles.infoFooter}>
                    <Text style={styles.infoFooterText}>
                        Poder de Compra Total: <Text style={{fontWeight: '700', color: '#0F172A'}}>{formatBRL(creditoExibido + result.lanceCartaVal)}</Text>
                    </Text>
                </View>
            )}
          </View>
        )}

        {/* --- DETALHAMENTO FINANCEIRO --- */}
        <View style={styles.contentCard}>
            <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Custos e Taxas</Text>
                <FileText color="#94A3B8" size={18} />
            </View>

            <View style={styles.costList}>
                <View style={styles.costItem}>
                    <Text style={styles.costLabel}>Taxa Adm. Total</Text>
                    <View style={styles.costDots} />
                    <Text style={styles.costValue}>{formatBRL(result.taxaAdminValor)}</Text>
                </View>
                <View style={styles.costItem}>
                    <Text style={styles.costLabel}>Fundo Reserva</Text>
                    <View style={styles.costDots} />
                    <Text style={styles.costValue}>{formatBRL(result.fundoReservaValor)}</Text>
                </View>
                <View style={styles.costItem}>
                    <Text style={styles.costLabel}>Seguro Mensal (Total)</Text>
                    <View style={styles.costDots} />
                    <Text style={styles.costValue}>{formatBRL(totalSeguroNoPrazo)}</Text>
                </View>
                <View style={styles.costItem}>
                    <Text style={styles.costLabel}>Taxa de Adesão</Text>
                    <View style={styles.costDots} />
                    <Text style={styles.costValue}>{formatBRL(result.valorAdesao)}</Text>
                </View>
            </View>

            <View style={styles.grandTotalBox}>
                <Text style={styles.grandTotalLabel}>Custo Total Estimado</Text>
                <Text style={styles.grandTotalValue}>{formatBRL(custoTotalExibido)}</Text>
            </View>
        </View>

        {/* --- NOVO CARD: GRUPOS COMPATÍVEIS --- */}
        <View style={styles.contentCard}>
            <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Grupos Compatíveis</Text>
                <Users color="#94A3B8" size={18} />
            </View>
            
            {isLoadingGroups ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#334155" />
                <Text style={{ marginTop: 8, color: '#64748B', fontSize: 12 }}>Buscando grupos atualizados...</Text>
              </View>
            ) : (
              <View style={styles.badgesContainer}>
                 {compatibleGroups.length > 0 ? (
                   compatibleGroups.map((grupo) => (
                      <View key={grupo} style={styles.groupBadge}>
                          <Text style={styles.groupBadgeText}>{grupo}</Text>
                      </View>
                   ))
                 ) : (
                   <Text style={styles.noGroupsText}>Nenhum grupo encontrado com estes parâmetros.</Text>
                 )}
              </View>
            )}
        </View>

        {/* --- PREVISÃO PÓS-CONTEMPLAÇÃO --- */}
        {cenarioPrincipal && (
            <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                    <View>
                        <Text style={styles.cardTitle}>Após Contemplação</Text>
                        <Text style={styles.cardSubtitle}>Previsão baseada no mês {cenarioPrincipal.mes}</Text>
                    </View>
                    <CalendarClock color="#94A3B8" size={20} />
                </View>

                {isReajustado && (
                    <View style={styles.infoBanner}>
                        <Info size={14} color="#0369A1" style={{marginTop: 2}} />
                        <Text style={styles.infoBannerText}>
                            Houve reajuste na parcela para compensar a diferença do Crédito Cheio.
                        </Text>
                    </View>
                )}
                
                {result.lanceTotal > 0 && (
                    <View style={styles.bigNumbersContainer}>
                        <View style={styles.bigNumberItem}>
                            <Text style={styles.bigNumberLabel}>Nova Parcela</Text>
                            <Text style={styles.bigNumberValue}>{formatBRL(cenarioPrincipal.novaParcela)}</Text>
                            {reducaoValor > 0 && (
                                <View style={styles.trendBadge}>
                                    <TrendingDown size={10} color="#15803D" />
                                    <Text style={styles.trendText}>
                                        -{formatBRL(reducaoValor)} ({reducaoPorcentagem.toFixed(1)}%)
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.verticalSep} />
                        <View style={styles.bigNumberItem}>
                            <Text style={styles.bigNumberLabel}>Meses Abatidos</Text>
                            <Text style={styles.bigNumberValue}>{mesesAbatidosCalc.toFixed(1)}x</Text>
                        </View>
                    </View>
                )}
                
                <View style={styles.modernTable}>
                    <View style={styles.tableHead}>
                        <Text style={[styles.th, {flex: 0.8}]}>Mês</Text>
                        <Text style={[styles.th, {flex: 2}]}>Parcela Prevista</Text>
                        <Text style={[styles.th, {flex: 1.5, textAlign: 'right'}]}>Prazo</Text>
                    </View>

                    {activeScenario.map((cenario, index) => (
                        <View key={cenario.mes} style={styles.tableRow}>
                            <Text style={[styles.td, {flex: 0.8, fontWeight: '600', color: '#64748B'}]}>{cenario.mes}º</Text>
                            <Text style={[styles.td, {flex: 2, fontWeight: '700', color: '#0F172A'}]}>
                                {formatBRL(cenario.novaParcela)}
                            </Text>
                            <Text style={[styles.td, {flex: 1.5, textAlign: 'right', color: '#64748B'}]}>
                                {Math.round(cenario.novoPrazo)}x
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        )}

        <TouchableOpacity 
            style={styles.resetButton} 
            onPress={() => navigation.popToTop()}
        >
            <RefreshCw color="#64748B" size={18} style={{marginRight: 8}} />
            <Text style={styles.resetButtonText}>Nova Simulação</Text>
        </TouchableOpacity>

        <View style={{height: 40}} />

      </ScrollView>

      {/* --- MODAL DE DADOS PARA PDF --- */}
      <Modal 
        visible={showPdfModal} 
        animationType="fade" 
        transparent 
        onRequestClose={() => setShowPdfModal(false)}
      >
          <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalBackdrop}
          >
              <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Gerar Proposta</Text>
                      <TouchableOpacity onPress={() => setShowPdfModal(false)} style={styles.closeModalBtn}>
                          <X color="#64748B" size={24} />
                      </TouchableOpacity>
                  </View>
                  
                  <ScrollView style={{maxHeight: 400}} showsVerticalScrollIndicator={false}>
                      <Text style={styles.modalSectionTitle}>Dados do Cliente</Text>
                      <View style={styles.formGroup}>
                          <View style={styles.inputContainer}>
                              <User size={18} color="#94A3B8" />
                              <TextInput 
                                  style={styles.modalInput} 
                                  placeholder="Nome completo"
                                  value={pdfClient}
                                  onChangeText={setPdfClient}
                                  placeholderTextColor="#94A3B8"
                              />
                          </View>
                          <View style={[styles.inputContainer, {marginTop: 10}]}>
                              <Phone size={18} color="#94A3B8" />
                              <TextInput 
                                  style={styles.modalInput} 
                                  placeholder="Telefone / WhatsApp"
                                  keyboardType="phone-pad"
                                  value={pdfClientPhone}
                                  onChangeText={setPdfClientPhone}
                                  placeholderTextColor="#94A3B8"
                              />
                          </View>
                      </View>

                      <Text style={styles.modalSectionTitle}>Dados do Vendedor</Text>
                      <View style={styles.formGroup}>
                           <View style={styles.inputContainer}>
                              <Briefcase size={18} color="#94A3B8" />
                              <TextInput 
                                  style={styles.modalInput} 
                                  placeholder="Seu nome"
                                  value={pdfSeller}
                                  onChangeText={setPdfSeller}
                                  placeholderTextColor="#94A3B8"
                              />
                          </View>
                          <View style={[styles.inputContainer, {marginTop: 10}]}>
                              <Phone size={18} color="#94A3B8" />
                              <TextInput 
                                  style={styles.modalInput} 
                                  placeholder="Seu telefone"
                                  keyboardType="phone-pad"
                                  value={pdfSellerPhone}
                                  onChangeText={setPdfSellerPhone}
                                  placeholderTextColor="#94A3B8"
                              />
                          </View>
                      </View>
                  </ScrollView>

                  <TouchableOpacity style={styles.generateButton} onPress={handleGeneratePDF}>
                      <FileOutput color="#fff" size={20} style={{marginRight: 10}} />
                      <Text style={styles.generateButtonText}>GERAR DOCUMENTO</Text>
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL DO POWER BI (NOVO) --- */}
      <Modal
        visible={showPowerBi}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPowerBi(false)}
      >
        <SafeAreaView style={{flex: 1, backgroundColor: '#0F172A'}}>
           <View style={styles.powerBiHeader}>
              <Text style={styles.powerBiTitle}>Relação de Grupos</Text>
              <TouchableOpacity onPress={() => setShowPowerBi(false)} style={styles.closePowerBiBtn}>
                 <X color="#fff" size={24} />
              </TouchableOpacity>
           </View>
           
           {/* WEBVIEW INTERATIVO */}
           <View style={{flex: 1, backgroundColor: '#fff'}}>
              <WebView 
                source={{ uri: POWERBI_URL }}
                style={{ flex: 1 }}
                startInLoadingState
                renderLoading={() => (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0F172A" />
                        <Text style={styles.loadingText}>Carregando Relação de Grupos...</Text>
                    </View>
                )}
                // Configurações para melhorar a experiência
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scalesPageToFit={true}
              />
           </View>
        </SafeAreaView>
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
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    backgroundColor: '#F8FAFC',
    zIndex: 10
  },
  iconButton: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', flex: 1, textAlign: 'center' },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  actionButtonText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 },

  // HERO CARD
  heroContainer: { marginBottom: 24, marginTop: 10 },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    zIndex: 3,
    position: 'relative',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10
  },
  heroCardLayer1: { position: 'absolute', bottom: -6, left: 16, right: 16, height: 20, backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: 24, zIndex: 2 },
  heroCardLayer2: { position: 'absolute', bottom: -12, left: 32, right: 32, height: 20, backgroundColor: 'rgba(15, 23, 42, 0.2)', borderRadius: 24, zIndex: 1 },
  
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  heroValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  planBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  planBadgeText: { color: '#E2E8F0', fontSize: 10, fontWeight: '700' },
  
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  heroBottomRow: { flexDirection: 'row', alignItems: 'center' },
  heroDetailItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 222, 128, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  heroDetailText: { color: '#CBD5E1', fontSize: 12, fontWeight: '500' },

  // SECTIONS
  sectionContainer: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  
  // SWITCH
  switchContainer: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 16, padding: 4, height: 50 },
  switchButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  switchActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  switchDisabled: { opacity: 0.6 },
  switchText: { fontSize: 13, fontWeight: '600' },
  switchTextActive: { color: '#0F172A', fontWeight: '700' },
  switchTextInactive: { color: '#64748B' },
  helperText: { fontSize: 12, color: '#64748B', marginTop: 10, marginHorizontal: 4, lineHeight: 18 },
  
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: '#B91C1C', fontSize: 12, fontWeight: '600', marginLeft: 8, flex: 1 },

  // GRID CARDS
  gridContainer: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  gridCard: { 
      flex: 1, 
      backgroundColor: '#FFFFFF', 
      borderRadius: 20, 
      padding: 16, 
      flexDirection: 'column', 
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      minHeight: 110,
      shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 
  },
  gridHeader: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12
  },
  gridContent: {
      width: '100%'
  },
  iconCircle: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gridLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  gridValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

  // CONTENT CARD
  contentCard: { 
      backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 24,
      shadowColor: '#64748B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  cardSubtitle: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  
  // LANCE STYLING
  percentBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  percentText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  lanceList: { gap: 14 },
  lanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lanceRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  lanceRowLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  lanceRowValue: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  dashDivider: { height: 1, borderTopWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', marginVertical: 4 },
  totalLanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLanceLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  totalLanceValue: { fontSize: 16, fontWeight: '800', color: '#16A34A' },

  // FEATURED BOX
  featuredBox: { 
      backgroundColor: '#1E293B', borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center',
      marginTop: 8, shadowColor: '#1E293B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6
  },
  featuredValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginBottom: 4 },
  featuredLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  featuredSub: { color: '#64748B', fontSize: 12, marginTop: 4 },
  infoFooter: { marginTop: 12, alignItems: 'center' },
  infoFooterText: { fontSize: 13, color: '#64748B' },

  // COST LIST
  costList: { gap: 12, marginBottom: 16 },
  costItem: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  costLabel: { fontSize: 14, color: '#64748B' },
  costDots: { flex: 1, borderBottomWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dotted', marginHorizontal: 8 },
  costValue: { fontSize: 14, fontWeight: '600', color: '#334155' },
  grandTotalBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandTotalLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  grandTotalValue: { fontSize: 18, fontWeight: '800', color: '#1E293B' },

  // POST CONTEMPLATION
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F0F9FF', padding: 12, borderRadius: 12, marginBottom: 20, gap: 10 },
  infoBannerText: { fontSize: 12, color: '#0369A1', flex: 1, lineHeight: 18 },
  
  bigNumbersContainer: { flexDirection: 'row', marginBottom: 24, justifyContent: 'space-around', alignItems: 'center' },
  bigNumberItem: { alignItems: 'center' },
  bigNumberLabel: { fontSize: 12, color: '#64748B', textTransform: 'uppercase', fontWeight: '600', marginBottom: 6 },
  bigNumberValue: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  verticalSep: { width: 1, height: 40, backgroundColor: '#E2E8F0' },
  trendBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  trendText: { fontSize: 10, color: '#15803D', fontWeight: '700', marginLeft: 4 },

  modernTable: { },
  tableHead: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  th: { fontSize: 12, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  td: { fontSize: 14 },

  // RESET BUTTON
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16 },
  resetButtonText: { color: '#64748B', fontWeight: '600', fontSize: 14 },

  // MODAL
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 20}, shadowOpacity: 0.25, shadowRadius: 24, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  closeModalBtn: { padding: 4 },
  modalSectionTitle: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },
  formGroup: { marginBottom: 24 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, height: 50 },
  modalInput: { flex: 1, marginLeft: 12, fontSize: 15, color: '#1E293B', fontWeight: '500' },
  
  generateButton: { backgroundColor: '#0F172A', borderRadius: 14, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  generateButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  // ESTILOS DO POWER BI
  powerBiHeader: {
    height: 60,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  powerBiTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closePowerBiBtn: { padding: 8 },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999
  },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14, fontWeight: '600' },

  // BADGES DE GRUPOS
  badgesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupBadge: {
    backgroundColor: '#0F172A', // Cor escura para destaque
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  groupBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  noGroupsText: { color: '#64748B', fontSize: 13, fontStyle: 'italic', marginTop: 4 },

});