import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, 
  Platform, StatusBar, Modal, TextInput, KeyboardAvoidingView, ActivityIndicator, Linking, useWindowDimensions, Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { 
  ArrowLeft, Share2, CheckCircle2, Car, CalendarClock, AlertTriangle, 
  Ban, DollarSign, Calendar, FileText, Info, RefreshCw, TrendingDown,
  User, Phone, Briefcase, X, FileOutput, Wallet, PieChart, 
  BarChart3, Users, Database, Target, Trophy, TrendingUp, MessageCircle

} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop, Text as SvgText, Line } from 'react-native-svg';

// --- ALTERAÇÃO 1: USAR FILE SYSTEM NATIVO PARA O APK ---
// Se der erro de 'legacy', troque por: import * as FileSystem from 'expo-file-system/legacy';
// Troque a importação antiga por esta:
import * as FileSystem from 'expo-file-system/legacy';

import { RootStackParamList } from '../types/navigation';
import { ConsortiumCalculator, ContemplationScenario, SimulationInput, SimulationResult } from '../utils/ConsortiumCalculator';
import { generateHTML } from '../utils/GeneratePDFHtml';
import { TABLES_METADATA, TableMetadata } from '../../data/TableRepository';
import { SimulationStorage } from '../services/SimulationStorage'; 

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

interface ResultRouteParams {
    result?: SimulationResult;
    input?: SimulationInput;
    quotaCount?: number;
    selectedCredits?: number[];
}

type ScenarioMode = 'REDUZIDO' | 'CHEIO';

// URLs de Dados
const GROUPS_DATA_URL = "https://nhnejoanmggvinnfphir.supabase.co/storage/v1/object/public/consorciorecon-json/relacao_grupos.json";
const GROUPS_STATS_URL = "https://nhnejoanmggvinnfphir.supabase.co/storage/v1/object/public/consorciorecon-json/estatisticas_grupos.json";
const HISTORY_DATA_URL = "https://nhnejoanmggvinnfphir.supabase.co/storage/v1/object/public/consorciorecon-json/historico_assembleias.json";

const STORAGE_KEY_META = '@consorcio_meta_v1';

// Componente Animado
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// --- COMPONENTE DE GRÁFICO (REUTILIZÁVEL) ---
const CustomBarChart = ({ data, color, title, suffix = "", type = "int" }: { data: any[], color: string, title: string, suffix?: string, type?: "int" | "float" }) => {
    if (!data || data.length === 0) return null;

    const chartHeight = 160;
    const chartWidth = 300; // Largura fixa ou dinâmica
    const padding = 20;
    const barWidth = 16;
       
    // Cálculos de Escala
    const values = data.map(d => d.value);
    const maxVal = Math.max(...values) * 1.2 || 10; // 20% de margem no topo
    const minVal = 0;

    const getX = (index: number) => padding + index * ((chartWidth - padding * 2) / (data.length - 1 || 1));
    const getY = (val: number) => chartHeight - padding - ((val - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2);

    // Construção do Caminho da Linha (Curva)
    let pathD = `M ${getX(0)} ${getY(values[0])}`;
    for (let i = 1; i < data.length; i++) {
        // Curva Bezier simples para suavizar
        const x = getX(i);
        const y = getY(values[i]);
        const prevX = getX(i - 1);
        const prevY = getY(values[i - 1]);
        const controlX = (prevX + x) / 2;
        const controlY = (prevY + y) / 2; 
        pathD += ` C ${controlX} ${prevY}, ${controlX} ${y}, ${x} ${y}`;
    }

    return (
        <View style={styles.chartContainer}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                <Text style={styles.chartTitle}>{title}</Text>
                <View style={{flex: 1, height: 1, backgroundColor: '#E2E8F0', marginLeft: 10}} />
            </View>
              
            <View style={{ alignItems: 'center' }}>
                <Svg width={chartWidth} height={chartHeight}>
                    <Defs>
                        <LinearGradient id={`grad${color}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={color} stopOpacity="0.8" />
                            <Stop offset="1" stopColor={color} stopOpacity="0.2" />
                        </LinearGradient>
                    </Defs>

                    {/* Linhas de Grade (Grid Lines) */}
                    {[0, 0.25, 0.5, 0.75, 1].map((factor, i) => {
                        const y = padding + factor * (chartHeight - padding * 2);
                        return <Line key={i} x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#F1F5F9" strokeWidth="1" />;
                    })}

                    {/* Barras */}
                    {data.map((item, i) => {
                        const x = getX(i);
                        const y = getY(item.value);
                        const h = chartHeight - padding - y;
                        return (
                            <React.Fragment key={i}>
                                <Rect
                                    x={x - barWidth / 2}
                                    y={y}
                                    width={barWidth}
                                    height={h}
                                    fill={`url(#grad${color})`}
                                    rx={4}
                                />
                                {/* Rótulo do Eixo X */}
                                <SvgText
                                    x={x}
                                    y={chartHeight - 2}
                                    fontSize="10"
                                    fill="#64748B"
                                    textAnchor="middle"
                                >
                                    {item.label}
                                </SvgText>
                                {/* Rótulo do Valor (Topo da barra) */}
                                <SvgText
                                    x={x}
                                    y={y - 6}
                                    fontSize="12"
                                    fill={color}
                                    fontWeight="bold"
                                    textAnchor="middle"
                                >
                                    {type === 'float' ? item.value.toFixed(1) : item.value}{suffix}
                                </SvgText>
                            </React.Fragment>
                        );
                    })}

                    {/* Curva Suave */}
                    <Path
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />

                    {/* Pontos na Curva */}
                    {data.map((item, i) => (
                        <Circle
                            key={`c${i}`}
                            cx={getX(i)}
                            cy={getY(item.value)}
                            r="3"
                            fill="#fff"
                            stroke={color}
                            strokeWidth="2"
                        />
                    ))}
                </Svg>
            </View>
        </View>
    );
};

export default function ResultScreen({ route, navigation }: Props) {
  // --- RESPONSIVIDADE ---
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const isSmallMobile = windowWidth < 380;
      
  const MAX_WIDTH = 960;
  const contentWidth = Math.min(windowWidth, MAX_WIDTH);
  const paddingHorizontal = isDesktop ? 32 : 24;

// Função para abrir o modal
  const handleOpenWhatsappModal = () => {
    setShowWhatsappModal(true);
    {/* --- NOVO BOTÃO: ENVIAR RESUMO (WHATSAPP) --- */}
          <TouchableOpacity 
            style={[styles.shareBtn, { backgroundColor: '#25D366', marginTop: 12, borderColor: '#1ebc57' }]} 
            onPress={handleOpenWhatsappModal} // <--- ALTERADO PARA ABRIR O MODAL
          >
            <MessageCircle size={20} color="#fff" />
            <Text style={styles.shareBtnText}>Enviar Resumo (WhatsApp)</Text>
          </TouchableOpacity>
  };

  // Função que realmente envia a mensagem (Chamada pelo botão do Modal)
  const handleSendWhatsapp = () => {
    if (!activeResult || !activeInput) return;

    // --- FORMATADORES ---
    const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatPct = (val: number) => `${(val * 100).toFixed(2).replace('.', ',')}%`;
    
    // --- LÓGICA DE CATEGORIA ---
    const getCategoryLabel = (tableId: string) => {
      const lowerId = tableId.toLowerCase();
      if (lowerId.includes('auto')) return 'AUTOMÓVEL';
      if (lowerId.includes('imovel')) return 'IMÓVEL';
      if (lowerId.includes('moto')) return 'MOTOCICLETA';
      if (lowerId.includes('servico')) return 'SERVIÇOS';
      return 'BEM';
    };
    
    const categoryLabel = getCategoryLabel(activeInput.tableId);
    
    // --- CÁLCULOS AUXILIARES ---
    const isSpecialPlan = activeResult.plano === 'LIGHT' || activeResult.plano === 'SUPERLIGHT';
    const primeiraParcelaValor = activeResult.totalPrimeiraParcela;
    const lanceTotalPct = activeResult.creditoOriginal > 0 ? (activeResult.lanceTotal / activeResult.creditoOriginal) : 0;
    
    // Usa pdfClient (o mesmo estado do PDF para manter consistência) ou um padrão
    const nomeClienteFinal = pdfClient.trim() || 'Cliente Especial';

    // --- GERAR MENSAGEM ---
    const whatsappMessage = `
*Simulação Recon - ${nomeClienteFinal}*

Olá! Segue o resumo da simulação:

📋 *Plano:* ${categoryLabel} ${activeResult.creditoOriginal > 0 ? activeResult.plano : ''}
💰 *Crédito:* ${formatBRL(activeResult.creditoOriginal)}
📅 *Prazo:* ${activeInput.prazo} meses

*Valores:*
🔹 1ª Parcela: ${formatBRL(primeiraParcelaValor)}
🔹 Demais Parcelas: ${formatBRL(activeResult.parcelaPreContemplacao)}

*Oferta de Lance:*
💵 Recurso Próprio: ${formatBRL(activeInput.lanceBolso)}
🏦 Lance Embutido: ${formatPct(activeInput.lanceEmbutidoPct)}
📊 *Total de Lance:* ${formatBRL(activeResult.lanceTotal)} (${formatPct(lanceTotalPct)})

${isSpecialPlan ? `_Plano ${activeResult.plano}: Parcela reduzida até a contemplação._` : ''}

_Esta é uma simulação preliminar. Sujeito a alterações._
    `.trim();

    // --- ENVIAR PARA WHATSAPP ---
    const url = `whatsapp://send?text=${encodeURIComponent(whatsappMessage)}`;
    
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          return Linking.openURL(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`);
        }
      })
      .catch((err) => console.error('Erro ao abrir WhatsApp', err));
      
    // Fecha o modal após enviar
    setShowWhatsappModal(false);
  };

  // --- ANIMAÇÃO DE PULSAÇÃO DO BOTÃO ---
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  // --- ESTADOS DE DADOS ---
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [originalResult, setOriginalResult] = useState<SimulationResult | null>(null);
  const [activeResult, setActiveResult] = useState<SimulationResult | null>(null);
  const [activeInput, setActiveInput] = useState<SimulationInput | null>(null);
  const [quotaCount, setQuotaCount] = useState(1);
  const [rawSelectedCredits, setRawSelectedCredits] = useState<number[]>([]);

  // Estados de Interface
  const [mesInput, setMesInput] = useState('1');
  const [mode, setMode] = useState<ScenarioMode>('CHEIO');
  const [currentTable, setCurrentTable] = useState<TableMetadata | undefined>(undefined);

  // --- 1. CARREGAMENTO DOS DADOS ---
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSimulationData = async () => {
        try {
          const params = route.params as unknown as ResultRouteParams | undefined;

          // A. Tenta carregar via Rota
          if (params?.result) {
            const { result, input, quotaCount: qCount, selectedCredits } = params;
              
            if (isActive && result && input) {
              setOriginalResult(result);
              setActiveResult(result);
              setActiveInput(input);
              setQuotaCount(qCount || 1);
              setRawSelectedCredits(selectedCredits || []);
              setMesInput((input.mesContemplacao || 1).toString());
                
              const canReduce = result.cenarioCreditoReduzido !== null;
              setMode(canReduce ? 'REDUZIDO' : 'CHEIO');
                
              setIsDataLoaded(true);
            }
            return;
          }

          // B. Tenta carregar via Storage
          const stored = await SimulationStorage.getSimulation();
            
          if (isActive) {
            if (stored) {
              setOriginalResult(stored.result);
              setActiveResult(stored.result);
              setActiveInput(stored.input);
              setQuotaCount(stored.quotaCount);
              setMesInput((stored.input.mesContemplacao || 1).toString());

              const credits = (stored.input as any).selectedCredits || []; 
              setRawSelectedCredits(credits);

              const canReduce = stored.result.cenarioCreditoReduzido !== null;
              setMode(canReduce ? 'REDUZIDO' : 'CHEIO');

              setIsDataLoaded(true);
            } else {
              Alert.alert("Atenção", "Nenhuma simulação encontrada.");
              navigation.navigate('Home'); 
            }
          }
        } catch (error) {
          console.error("Erro ao carregar simulação:", error);
        }
      };

      loadSimulationData();

      return () => { isActive = false; };
    }, [route.params])
  );

  // --- 2. CARREGAMENTO DE METADADOS DA TABELA ---
  useEffect(() => {
    if (!activeInput) return;
    const staticTable = TABLES_METADATA.find(t => t.id === activeInput.tableId);
    if (staticTable) setCurrentTable(staticTable);

    const loadDynamicMetadata = async () => {
      try {
        const cachedMeta = await AsyncStorage.getItem(STORAGE_KEY_META);
        if (cachedMeta) {
          const dynamicTables: TableMetadata[] = JSON.parse(cachedMeta);
          const found = dynamicTables.find(t => t.id === activeInput.tableId);
          if (found) setCurrentTable(found);
        }
      } catch (error) {
        console.log('Erro ao carregar metadados dinâmicos:', error);
      }
    };
    loadDynamicMetadata();
  }, [activeInput]);

  // --- LÓGICA DE RECÁLCULO DO MÊS ---
  const handleMesChange = (text: string) => {
    if (!activeInput || !originalResult || !currentTable) return;
    const cleaned = text.replace(/[^0-9]/g, '');
    setMesInput(cleaned);
    const mes = parseInt(cleaned);
      
    if (!isNaN(mes) && mes > 0 && mes <= activeInput.prazo) {
        const newInput: SimulationInput = { ...activeInput, mesContemplacao: mes };
        const newResult = ConsortiumCalculator.calculate(
          newInput, 
          currentTable, 
          originalResult.parcelaPreContemplacao 
        );
        setActiveResult(newResult);
        setActiveInput(newInput);
    }
  };

  const dataEstimada = useMemo(() => {
    const mes = parseInt(mesInput);
    if (!mes || isNaN(mes)) return null;
    const hoje = new Date();
    const dataFutura = new Date(hoje.setMonth(hoje.getMonth() + mes));
    return dataFutura.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }, [mesInput]);

  // --- ESTADOS PARA PDF ---
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); // NOVO ESTADO
  const [pdfClient, setPdfClient] = useState('');
  const [pdfClientPhone, setPdfClientPhone] = useState(''); 
  const [pdfSeller, setPdfSeller] = useState(''); 
  const [pdfSellerPhone, setPdfSellerPhone] = useState(''); 

  // Estados para Grupos e Histórico
  const [groupsData, setGroupsData] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<any[]>([]); 
  const [historyData, setHistoryData] = useState<any[]>([]); 
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
      
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const timeStamp = new Date().getTime();
        const groupsUrl = `${GROUPS_DATA_URL}?t=${timeStamp}`;
        const statsUrl = `${GROUPS_STATS_URL}?t=${timeStamp}`;
        const historyUrl = `${HISTORY_DATA_URL}?t=${timeStamp}`;

        const [groupsResponse, statsResponse, historyResponse] = await Promise.all([
            fetch(groupsUrl),
            fetch(statsUrl),
            fetch(historyUrl)
        ]);

        if (groupsResponse.ok) {
          const data = await groupsResponse.json();
          setGroupsData(data);
        }
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            setStatsData(stats);
        }
        if (historyResponse.ok) {
            const hist = await historyResponse.json();
            setHistoryData(hist);
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setIsLoadingGroups(false);
      }
    };
    fetchAllData();
  }, []);

  // --- PROCESSAMENTO DO HISTÓRICO PARA GRÁFICOS ---
  const getGroupChartsData = useMemo(() => {
    if (!selectedGroup || !historyData.length) return { chartContemplados: [], chartLances: [], chartMenorLance: [] };

    // Função Auxiliar para converter String em Objeto Date seguro
    const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date(0); 

        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
        }
        return new Date(dateStr);
    };

    const formatDateLabel = (dateObj: Date) => {
        if (isNaN(dateObj.getTime())) return '-';
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const month = months[dateObj.getMonth()];
        const year = dateObj.getFullYear().toString().slice(-2); 
        return `${month}/${year}`;
    };

    const groupHistory = historyData.filter((h: any) => String(h.Grupo) === String(selectedGroup.Grupo));

    groupHistory.sort((a: any, b: any) => {
        const dateA = parseDate(a.Assembleia);
        const dateB = parseDate(b.Assembleia);
        return dateA.getTime() - dateB.getTime();
    });

    const last8 = groupHistory.slice(-8);

    const chartContemplados = last8.map((h: any) => {
        const d = parseDate(h.Assembleia);
        return {
            label: formatDateLabel(d),
            value: parseInt(h['Qtd Contemplados'] || 0)
        };
    });

    const chartLances = last8.map((h: any) => {
        const d = parseDate(h.Assembleia);
        let rawVal = h['Media Lance Livre'];
        if (typeof rawVal === 'string') rawVal = parseFloat(rawVal.replace('%', '').replace(',', '.'));
        return {
            label: formatDateLabel(d),
            value: rawVal || 0
        };
    });

    const chartMenorLance = last8.map((h: any) => {
        const d = parseDate(h.Assembleia);
        let rawVal = h['Menor Lance Livre'];
        if (typeof rawVal === 'string') rawVal = parseFloat(rawVal.replace('%', '').replace(',', '.'));
        return {
            label: formatDateLabel(d),
            value: rawVal || 0
        };
    });

    return { chartContemplados, chartLances, chartMenorLance };
  }, [selectedGroup, historyData]);

  // --- LÓGICA DE GRUPOS COMPATÍVEIS ---
  const compatibleGroupsMap = useMemo(() => {
    if (isLoadingGroups || groupsData.length === 0 || !currentTable || !activeInput || !activeResult) return [];

    const categoryMap: Record<string, string> = {
      'AUTO': 'VEÍCULO',
      'MOTO': 'VEÍCULO',
      'IMOVEL': 'IMÓVEL',
      'SERVICOS': 'SERVIÇO'
    };
    const targetType = categoryMap[currentTable.category];
    const tablePlan = currentTable.plan || 'NORMAL';

    let creditsList: number[] = [];
    if (Array.isArray(rawSelectedCredits) && rawSelectedCredits.length > 0) {
        creditsList = rawSelectedCredits;
    } else {
        const individualCredit = quotaCount > 1 ? activeResult.creditoOriginal / quotaCount : activeResult.creditoOriginal;
        creditsList = [individualCredit];
    }
    const uniqueCredits = [...new Set(creditsList)].sort((a, b) => b - a);

    return uniqueCredits.map(creditVal => {
        const groups = groupsData.filter((group: any) => {
             // 1. Filtro de Categoria
             if (group.TIPO !== targetType) return false;
             
             // 2. Filtro de Prazo
             if (activeInput.prazo > group["Prazo Máximo"]) return false;

             // 3. Lógica de Compatibilidade de Planos
             if (tablePlan !== 'NORMAL') {
                 const groupPlan = group["PLANO"] ? group["PLANO"].toUpperCase() : "NORMAL";
                 if (groupPlan === 'NORMAL') return false;
                 if (tablePlan === 'SUPERLIGHT') {
                     if (!groupPlan.includes('SUPERLIGHT')) return false;
                 }
             }

             // 4. Filtro de Faixa de Crédito
             const rangeString = group["Créditos Disponíveis"];
             if (!rangeString) return false;

             const rangeParts = rangeString.replace(/\./g, '').split(' até ');
             if (rangeParts.length !== 2) return false;
             
             const minCredit = parseFloat(rangeParts[0]);
             const maxCredit = parseFloat(rangeParts[1]);

             if (creditVal < minCredit || creditVal > maxCredit) return false;

             // 5. Exceções Hardcoded
             const groupName = String(group.Grupo);
             if (groupName === '2011') {
                if (activeInput.prazo <= 200 || creditVal < 200000) return false;
             }
             if (groupName === '5121') {
                 if (activeInput.prazo <= 100 || creditVal < 80000) return false;
             }
             return true;
        }).map((g: any) => g.Grupo);

        return {
            creditValue: creditVal,
            groups: groups
        };
    });
  }, [activeInput, activeResult, groupsData, isLoadingGroups, quotaCount, currentTable, rawSelectedCredits]);

  const handleGroupPress = (groupName: string) => {
    const groupDetails = groupsData.find((g: any) => String(g.Grupo) === String(groupName));
    const groupStats = statsData.find((s: any) => String(s.Grupo) === String(groupName));
    if (groupDetails) {
        setSelectedGroup({ ...groupDetails, ...groupStats });
    }
  };

  const getBidAnalysis = (group: any) => {
    if (!group || !activeResult) return null;
    const userBidPct = (activeResult.lanceTotal / activeResult.creditoOriginal) * 100;
      
    const parseValue = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseFloat(val.replace(',', '.').replace('%', ''));
        return 0;
    };

    const minBid = parseValue(group['Menor Lance Livre']);
    const avgBid = parseValue(group['Media Lance Livre']);

    let status: 'high' | 'medium' | 'low' | 'unknown' = 'unknown';
    let message = '';

    if (avgBid > 0 && userBidPct >= avgBid) {
        status = 'high';
        message = 'Seu lance supera a média da última assembleia! Excelentes chances.';
    } else if (minBid > 0 && userBidPct >= minBid) {
        status = 'medium';
        message = 'Lance competitivo. Você está acima do lance mínimo contemplado.';
    } else if (minBid > 0 && userBidPct < minBid) {
        status = 'low';
        message = 'Atenção: Seu lance está abaixo do mínimo contemplado na última assembleia.';
    } else {
        status = 'unknown';
        message = 'Dados insuficientes para comparação precisa.';
    }
    return { userBidPct, minBid, avgBid, status, message };
  };

  const handleOpenPdfModal = () => setShowPdfModal(true);

  // --- ALTERAÇÃO 2: LÓGICA DE PDF ATUALIZADA PARA ANDROID ---
// --- FUNÇÃO CORRIGIDA ---
const handleGeneratePDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    if (!activeResult || !activeInput) {
        setIsGeneratingPdf(false);
        return;
    }

    try {
      const html = generateHTML(
        activeResult, 
        activeInput, 
        mode, 
        {
          cliente: pdfClient.trim(),
          telefoneCliente: pdfClientPhone,
          vendedor: pdfSeller,
          telefoneVendedor: pdfSellerPhone 
        } as any, 
        quotaCount
      );
       
      // Fallback para Web
      if (Platform.OS === 'web') {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); }, 500);
          } else {
              Alert.alert("Atenção", "Por favor, permita pop-ups para gerar o PDF.");
          }
          setShowPdfModal(false);
          setIsGeneratingPdf(false);
          return; 
      }

      // 1. Gera o PDF
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      
      // 2. Prepara nome do arquivo
      const nomeClienteLimpo = pdfClient ? pdfClient.trim().replace(/[^a-zA-Z0-9À-ÿ]/g, '_') : 'Cliente';
      const valorTotalCredito = quotaCount > 1 ? activeResult.creditoOriginal : (activeResult.creditoOriginal * quotaCount);
      const valorFormatado = valorTotalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
      const fileName = `Simulacao_${nomeClienteLimpo}_R$${valorFormatado}.pdf`;
      
      // 3. Renomeia usando FileSystem Nativo
      // --- SOLUÇÃO DO ERRO DE TIPAGEM ---
      // Usamos 'as any' para garantir que o TypeScript não bloqueie o build,
      // pois sabemos que documentDirectory existe no runtime do Android.
      const fs = FileSystem as any;
      let targetDirectory = fs.documentDirectory || fs.cacheDirectory;
      
      // Fallback de segurança
      if (!targetDirectory && uri) {
        const lastSlashIndex = uri.lastIndexOf('/');
        if (lastSlashIndex !== -1) targetDirectory = uri.substring(0, lastSlashIndex + 1);
      }
      
      let finalUri = uri; 
      if (targetDirectory) {
        try {
            const dirPath = targetDirectory.endsWith('/') ? targetDirectory : targetDirectory + '/';
            const newUri = dirPath + fileName;
            await FileSystem.moveAsync({ from: uri, to: newUri });
            finalUri = newUri;
        } catch (moveError) {
            console.warn("Erro ao renomear arquivo:", moveError);
        }
      }

      // 4. Fecha o modal
      setShowPdfModal(false);

      // 5. Compartilha
      setTimeout(async () => {
         if (Platform.OS === "ios" || Platform.OS === "android") {
            const fileInfo = await FileSystem.getInfoAsync(finalUri);
            
            if (fileInfo.exists) {
                await Sharing.shareAsync(finalUri, { 
                  UTI: 'com.adobe.pdf', 
                  mimeType: 'application/pdf',
                  dialogTitle: `Compartilhar Simulação - ${pdfClient}`
                });
            } else {
                Alert.alert("Erro", "Arquivo de PDF não encontrado.");
            }
         }
      }, 200);

    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível gerar o PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      
  // --- RENDERIZAÇÃO ---
  if (!isDataLoaded || !activeResult || !activeInput) {
    return (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC'}}>
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={{marginTop: 16, color: '#64748B'}}>Carregando resultados...</Text>
        </View>
    );
  }

  const isCaminho1Viable = activeResult.cenarioCreditoReduzido !== null;
  const isSpecialPlan = activeResult.plano === 'LIGHT' || activeResult.plano === 'SUPERLIGHT';
  const fatorPlano = activeResult.plano === 'LIGHT' ? 0.75 : activeResult.plano === 'SUPERLIGHT' ? 0.50 : 1.0;

  let activeScenario: ContemplationScenario[];
  let creditoExibido: number;
  let isReajustado = false;

  if (isSpecialPlan && activeResult.cenarioCreditoTotal) { 
      if (mode === 'REDUZIDO' && isCaminho1Viable && activeResult.cenarioCreditoReduzido) {
          activeScenario = activeResult.cenarioCreditoReduzido;
          creditoExibido = activeScenario[0].creditoEfetivo;
      } else {
          activeScenario = activeResult.cenarioCreditoTotal;
          creditoExibido = activeScenario[0].creditoEfetivo;
          isReajustado = true;
      }
  } else {
      activeScenario = activeResult.cenariosContemplacao;
      creditoExibido = activeResult.creditoLiquido;
  }

  const cenarioPrincipal = activeScenario && activeScenario.length > 0 ? activeScenario[0] : null;
  const lanceEmbutidoValor = activeResult.lanceTotal - activeInput.lanceBolso - activeResult.lanceCartaVal;

  const mesContemplacaoRef = Math.max(1, activeInput.mesContemplacao);
  const prazoRestanteOriginal = Math.max(0, activeInput.prazo - mesContemplacaoRef);
  const mesesAbatidosCalc = cenarioPrincipal ? Math.max(0, prazoRestanteOriginal - cenarioPrincipal.novoPrazo) : 0;

  const safeCenario = cenarioPrincipal as any; 
  const reducaoValor = safeCenario?.reducaoValor ?? 0;
  const reducaoPorcentagem = safeCenario?.reducaoPorcentagem ?? 0;

  const totalSeguroNoPrazo = activeResult.seguroMensal * activeInput.prazo;
  const valorReducaoCreditoBase = (isSpecialPlan && mode === 'REDUZIDO') 
    ? (activeResult.creditoOriginal * (1 - fatorPlano)) 
    : 0;

  let custoTotalExibido = 
      activeResult.creditoOriginal + 
      activeResult.taxaAdminValor + 
      activeResult.fundoReservaValor + 
      totalSeguroNoPrazo + 
      activeResult.valorAdesao - 
      lanceEmbutidoValor - 
      activeResult.lanceCartaVal - 
      valorReducaoCreditoBase;

  const analysis = selectedGroup ? getBidAnalysis(selectedGroup) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
       
      {/* HEADER */}
      <View style={styles.headerWrapper}>
        <View style={[styles.headerContent, { width: contentWidth, paddingHorizontal }]}>
            <TouchableOpacity 
                onPress={() => {
                    if (navigation.canGoBack()) {
                        navigation.goBack();
                    } else {
                        if (activeInput?.tableId) {
                            navigation.replace('SimulationForm', { tableId: activeInput.tableId });
                        } else {
                            navigation.navigate('Home');
                        }
                    }
                }} 
                style={styles.backBtn} 
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <ArrowLeft color="#0F172A" size={24} />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Resultado</Text>
            
            {/* CONTAINER DOS BOTÕES (COLUNA) */}
            <View style={{flexDirection: 'column', gap: 6, alignItems: 'flex-end'}}>
                
                {/* 1. Botão Compartilhar PDF */}
                <AnimatedTouchableOpacity 
                    onPress={handleOpenPdfModal} 
                    style={[
                        styles.headerActionBtn, 
                        { backgroundColor: '#334155', transform: [{ scale: pulseAnim }] }
                    ]} 
                    hitSlop={{ top: 5, bottom: 5, left: 10, right: 10 }}
                >
                    <Share2 color="#fff" size={16} />
                    <Text style={styles.headerActionBtnText}>COMPARTILHAR PDF</Text>
                </AnimatedTouchableOpacity>

                {/* 2. Botão WhatsApp */}
                <TouchableOpacity 
                    style={[styles.headerActionBtn, { backgroundColor: '#25D366' }]} 
                    onPress={handleOpenWhatsappModal} 
                >
                    <MessageCircle size={16} color="#fff" />
                    <Text style={styles.headerActionBtnText}>ENVIAR RESUMO</Text>
                </TouchableOpacity>

            </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { width: contentWidth, alignSelf: 'center', paddingHorizontal: paddingHorizontal }
        ]} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* HERO CARD */}
        <View style={styles.heroContainer}>
            <View style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                    <View>
                        <Text style={styles.heroLabel}>PARCELA INICIAL</Text>
                        <Text style={styles.heroValue}>{formatBRL(activeResult.totalPrimeiraParcela)}</Text>
                    </View>
                    <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>{activeResult.plano}</Text>
                    </View>
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroBottomRow}>
                    {activeResult.valorAdesao > 0 ? (
                        <View style={styles.heroDetailItem}>
                            <CheckCircle2 color="#4ADE80" size={14} style={{marginRight: 6}} />
                            <Text style={styles.heroDetailText}>
                                Parcela {formatBRL(activeResult.parcelaPreContemplacao)} + Adesão {formatBRL(activeResult.valorAdesao)}
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

        {/* SELETOR DE CAMINHO */}
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

        {/* CARDS DE MÉTRICAS */}
        <View style={styles.gridContainer}>
          <View style={styles.gridCard}>
            <View style={styles.gridHeader}>
                <View style={[styles.iconCircle, {backgroundColor: '#EFF6FF'}]}>
                    <DollarSign color="#3B82F6" size={20} />
                </View>
            </View>
            <View style={styles.gridContent}>
                <Text style={styles.gridLabel} numberOfLines={1} adjustsFontSizeToFit>
                    {isSpecialPlan ? `Crédito Base` : 'Crédito SIMULADO'}
                </Text>
                <Text style={styles.gridValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatBRL(mode === 'REDUZIDO' && isSpecialPlan ? activeResult.creditoOriginal * fatorPlano : activeResult.creditoOriginal)}
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
                <Text style={styles.gridValue} numberOfLines={1} adjustsFontSizeToFit>{activeInput.prazo} meses</Text>
            </View>
          </View>
        </View>

        {/* ANÁLISE DE LANCES */}
        {activeResult.lanceTotal > 0 && (
          <View style={styles.contentCard}>
            <View style={styles.cardHeaderRow}>
                 <Text style={styles.cardTitle}>Composição do Lance</Text>
                 <View style={styles.percentBadge}>
                    <Text style={styles.percentText}>{((activeResult.lanceTotal / activeResult.creditoOriginal) * 100).toFixed(2)}%</Text>
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
                    <Text style={styles.lanceRowValue}>{formatBRL(activeInput.lanceBolso)}</Text>
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

                {activeResult.lanceCartaVal > 0 && (
                    <View style={styles.lanceRow}>
                        <View style={styles.lanceRowLeft}>
                            <View style={[styles.miniIcon, {backgroundColor: '#F0F9FF'}]}>
                                <Car size={14} color="#0284C7" />
                            </View>
                            <Text style={styles.lanceRowLabel}>Carta Avaliação</Text>
                        </View>
                        <Text style={styles.lanceRowValue}>{formatBRL(activeResult.lanceCartaVal)}</Text>
                    </View>
                )}

                <View style={styles.dashDivider} />

                <View style={styles.totalLanceRow}>
                    <Text style={styles.totalLanceLabel}>Total Ofertado</Text>
                    <Text style={styles.totalLanceValue}>{formatBRL(activeResult.lanceTotal)}</Text>
                </View>
            </View>

            {/* CRÉDITO LÍQUIDO */}
            <View style={styles.featuredBox}>
                <Text style={styles.featuredValue}>{formatBRL(creditoExibido)}</Text>
                <Text style={styles.featuredLabel}>CRÉDITO LÍQUIDO</Text>
                <Text style={styles.featuredSub}>Disponível para compra do bem</Text>
            </View>

             {activeResult.lanceCartaVal > 0 && (
                <View style={styles.infoFooter}>
                    <Text style={styles.infoFooterText}>
                        Poder de Compra Total: <Text style={{fontWeight: '700', color: '#0F172A'}}>{formatBRL(creditoExibido + activeResult.lanceCartaVal)}</Text>
                    </Text>
                </View>
            )}
          </View>
        )}

        {/* DETALHAMENTO FINANCEIRO */}
        <View style={styles.contentCard}>
            <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Custos e Taxas</Text>
                <FileText color="#94A3B8" size={18} />
            </View>

            <View style={styles.costList}>
                <View style={styles.costItem}>
                    <Text style={styles.costLabel}>
                        Taxa Adm. Total ({currentTable ? (currentTable.taxaAdmin * 100).toFixed(0) : 0}%)
                    </Text>
                    <View style={styles.costDots} />
                    <Text style={styles.costValue}>{formatBRL(activeResult.taxaAdminValor)}</Text>
                </View>
                <View style={styles.costItem}>
                    <Text style={styles.costLabel}>
                        Fundo Reserva ({currentTable ? (currentTable.fundoReserva * 100).toFixed(0) : 0}%)
                    </Text>
                    <View style={styles.costDots} />
                    <Text style={styles.costValue}>{formatBRL(activeResult.fundoReservaValor)}</Text>
                </View>
                <View style={styles.costItem}>
                    <Text style={styles.costLabel}>
                        Seguro Mensal ({currentTable ? (currentTable.seguroPct * 100).toFixed(3).replace('.', ',') : '0,0000'}% a.m)
                    </Text>
                    <View style={styles.costDots} />
                    <Text style={styles.costValue}>{formatBRL(totalSeguroNoPrazo)}</Text>
                </View>
                <View style={styles.costItem}>
                    <Text style={styles.costLabel}>
                        Taxa de Adesão ({activeInput.taxaAdesaoPct ? (activeInput.taxaAdesaoPct * 100).toFixed(1).replace('.0', '') : 0}%)
                    </Text>
                    <View style={styles.costDots} />
                    <Text style={styles.costValue}>{formatBRL(activeResult.valorAdesao)}</Text>
                </View>
            </View>

            <View style={styles.grandTotalBox}>
                <Text style={styles.grandTotalLabel}>Custo Total Estimado</Text>
                <Text style={styles.grandTotalValue}>{formatBRL(custoTotalExibido)}</Text>
            </View>
        </View>

        {/* GRUPOS COMPATÍVEIS */}
        {isLoadingGroups ? (
            <View style={[styles.contentCard, { padding: 30, alignItems: 'center' }]}>
               <ActivityIndicator size="small" color="#334155" />
               <Text style={{ marginTop: 12, color: '#64748B', fontSize: 13 }}>Buscando grupos atualizados...</Text>
            </View>
        ) : (
            <>
                {compatibleGroupsMap.length > 0 ? (
                    compatibleGroupsMap.map((item, index) => (
                        <View key={index} style={styles.contentCard}>
                             
                            <View style={[styles.cardHeaderRow, { alignItems: 'flex-start', marginBottom: 12 }]}>
                                <View style={{flex: 1, paddingRight: 8}}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                        <Text style={styles.cardTitle}>Grupos Compatíveis</Text>
                                        <Text style={[styles.cardSubtitle, { marginTop: 6, color: '#1E293B', fontWeight: '600' }]}>
                                         {formatBRL(item.creditValue)}
                                        </Text>
                                    </View>

                                     <View style={styles.inlineHintContainer}>
                                          <Info size={12} color="#2563EB" />
                                          <Text style={styles.inlineHintText}>
                                                Toque nos grupos para análise de lance
                                           </Text>
                                     </View>
                                </View>
                                <Users color="#94A3B8" size={20} style={{marginTop: 2}} />
                            </View>
                             
                            <View style={styles.badgesContainer}>
                                {item.groups.length > 0 ? (
                                    item.groups.map((grupo: string) => {
                                        const groupDetails = groupsData.find((g: any) => String(g.Grupo) === String(grupo));
                                        const groupStats = statsData.find((s: any) => String(s.Grupo) === String(grupo));
                                        const fullGroupData = { ...groupDetails, ...groupStats };
                                        const analysis = getBidAnalysis(fullGroupData);

                                        let badgeStyle = styles.groupBadge;
                                        let textStyle = styles.groupBadgeText;

                                        if (analysis) {
                                            if (analysis.status === 'high') {
                                                badgeStyle = styles.badgeHigh; textStyle = styles.badgeTextHigh;
                                            } else if (analysis.status === 'medium') {
                                                badgeStyle = styles.badgeMedium; textStyle = styles.badgeTextMedium;
                                            } else if (analysis.status === 'low') {
                                                badgeStyle = styles.badgeLow; textStyle = styles.badgeTextLow;
                                            }
                                        }

                                        return (
                                            <TouchableOpacity 
                                                key={grupo} 
                                                style={badgeStyle}
                                                onPress={() => handleGroupPress(grupo)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={textStyle}>{grupo}</Text>
                                            </TouchableOpacity>
                                        );
                                    })
                                ) : (
                                    <Text style={styles.noGroupsText}>Nenhum grupo encontrado para este valor específico.</Text>
                                )}
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.contentCard}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.cardTitle}>Grupos Compatíveis</Text>
                            <Users color="#94A3B8" size={18} />
                        </View>
                        <Text style={styles.noGroupsText}>Nenhum grupo encontrado com estes parâmetros.</Text>
                    </View>
                )}
            </>
        )}

        {/* PREVISÃO PÓS-CONTEMPLAÇÃO COM CONTROLE INTEGRADO */}
        {cenarioPrincipal && (
            <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                    <View>
                        <Text style={styles.cardTitle}>Simulação de Contemplação</Text>
                        <Text style={styles.cardSubtitle}>Simule o momento em que seu cliente deseja ser contemplado</Text> 
                    </View>
                    <CalendarClock color="#94A3B8" size={20} />
                </View>

                {/* --- ÁREA INTEGRADA: CONTROLES DE SIMULAÇÃO --- */}
                <View style={styles.simulationControlBox}>
                  <View style={styles.simulationControlItem}>
                      <Text style={styles.simulationLabel}>SIMULAR MÊS</Text>
                      <View style={styles.inputContent}>
                        <TextInput 
                          style={[styles.simulationInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                          keyboardType="numeric" 
                          value={mesInput}
                          onChangeText={handleMesChange}
                          placeholder="1"
                          placeholderTextColor="#94A3B8"
                          maxLength={3}
                          selectTextOnFocus
                        />
                        <Text style={styles.simulationSuffix}>º mês</Text>
                      </View>
                  </View>

                  <View style={styles.verticalDivider} />

                  <View style={styles.simulationControlItem}>
                      <Text style={styles.simulationLabel}>MÊS DA ASSEMBLEIA</Text>
                      <View style={styles.dateRow}>
                        <CalendarClock size={16} color="#2563EB" />
                        <Text style={styles.simulationDateValue}>
                            {dataEstimada ? dataEstimada.replace('.', '') : '--'}
                        </Text>
                      </View>
                  </View>
               </View>
               
               {isReajustado && (
                   <View style={styles.infoBanner}>
                       <Info size={14} color="#0369A1" style={{marginTop: 2}} />
                       <Text style={styles.infoBannerText}>
                           Houve reajuste na parcela para compensar a diferença do Crédito Cheio.
                       </Text>
                   </View>
               )}
               
               {activeResult.lanceTotal > 0 && (
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
            onPress={() => {
            navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
             });
            }}
            >
            <RefreshCw color="#64748B" size={18} style={{marginRight: 8}} />
            <Text style={styles.resetButtonText}>Nova Simulação</Text>
        </TouchableOpacity>
        <View style={{height: 40}} />

      </ScrollView>

      {/* MODAL DE DADOS PARA PDF */}
      <Modal 
        visible={showPdfModal} 
        animationType="fade" 
        transparent 
        onRequestClose={() => { if(!isGeneratingPdf) setShowPdfModal(false) }}
      >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
              <View style={[
                  styles.modalCard,
                  { 
                      width: isDesktop ? 500 : '100%', 
                      alignSelf: 'center',
                      maxHeight: isDesktop ? '90%' : undefined 
                  }
              ]}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Gerar Proposta</Text>
                      {!isGeneratingPdf && (
                        <TouchableOpacity onPress={() => setShowPdfModal(false)} style={styles.closeModalBtn}>
                            <X color="#64748B" size={24} />
                        </TouchableOpacity>
                      )}
                  </View>
                   
                  <ScrollView style={{maxHeight: 400}} showsVerticalScrollIndicator={false}>
                      <Text style={styles.modalSectionTitle}>Dados do Cliente</Text>
                      <View style={styles.formGroup}>
                          <View style={styles.inputContainer}>
                              <User size={18} color="#94A3B8" />
                              <TextInput 
                                  style={[styles.modalInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                                  placeholder="Nome do cliente"
                                  value={pdfClient}
                                  onChangeText={setPdfClient}
                                  onBlur={() => setPdfClient(pdfClient.trim())} 
                                  placeholderTextColor="#94A3B8"
                                  editable={!isGeneratingPdf}
                              />
                          </View>
                          <View style={[styles.inputContainer, {marginTop: 10}]}>
                              <Phone size={18} color="#94A3B8" />
                              <TextInput 
                                  style={[styles.modalInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                                  placeholder="Telefone / WhatsApp"
                                  keyboardType="phone-pad"
                                  value={pdfClientPhone}
                                  onChangeText={setPdfClientPhone}
                                  placeholderTextColor="#94A3B8"
                                  editable={!isGeneratingPdf}
                              />
                          </View>
                      </View>

                      <Text style={styles.modalSectionTitle}>Dados do Vendedor</Text>
                      <View style={styles.formGroup}>
                            <View style={styles.inputContainer}>
                              <Briefcase size={18} color="#94A3B8" />
                              <TextInput 
                                  style={[styles.modalInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                                  placeholder="Seu nome"
                                  value={pdfSeller}
                                  onChangeText={setPdfSeller}
                                  placeholderTextColor="#94A3B8"
                                  editable={!isGeneratingPdf}
                              />
                          </View>
                          <View style={[styles.inputContainer, {marginTop: 10}]}>
                              <Phone size={18} color="#94A3B8" />
                              <TextInput 
                                  style={[styles.modalInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                                  placeholder="Seu telefone / whatsapp"
                                  keyboardType="phone-pad"
                                  value={pdfSellerPhone}
                                  onChangeText={setPdfSellerPhone}
                                  placeholderTextColor="#94A3B8"
                                  editable={!isGeneratingPdf}
                              />
                          </View>
                      </View>
                  </ScrollView>

                  <TouchableOpacity 
                    style={[styles.generateButton, isGeneratingPdf && {opacity: 0.8}]} 
                    onPress={handleGeneratePDF}
                    disabled={isGeneratingPdf}
                  >
                      {isGeneratingPdf ? (
                        <ActivityIndicator color="#fff" size="small" style={{marginRight: 10}} />
                      ) : (
                        <FileOutput color="#fff" size={20} style={{marginRight: 10}} />
                      )}
                      <Text style={styles.generateButtonText}>
                        {isGeneratingPdf ? "GERANDO..." : "GERAR DOCUMENTO"}
                      </Text>
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
      </Modal>
      {/* MODAL WHATSAPP */}
      <Modal 
        visible={showWhatsappModal} 
        animationType="fade" 
        transparent 
        onRequestClose={() => setShowWhatsappModal(false)}
      >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
              <View style={[
                  styles.modalCard,
                  { 
                      width: isDesktop ? 400 : '90%', 
                      alignSelf: 'center'
                  }
              ]}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Enviar no WhatsApp</Text>
                      <TouchableOpacity onPress={() => setShowWhatsappModal(false)} style={styles.closeModalBtn}>
                          <X color="#64748B" size={24} />
                      </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.modalSectionTitle}>Identificação</Text>
                  <View style={styles.formGroup}>
                      <View style={styles.inputContainer}>
                          <User size={18} color="#94A3B8" />
                          <TextInput 
                              style={[styles.modalInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                              placeholder="Nome do cliente"
                              value={pdfClient}
                              onChangeText={setPdfClient} // Usa o mesmo state do PDF
                              placeholderTextColor="#94A3B8"
                              autoFocus={true}
                          />
                      </View>
                  </View>

                  <TouchableOpacity 
                    style={[styles.generateButton, { backgroundColor: '#25D366' }]} 
                    onPress={handleSendWhatsapp}
                  >
                      <MessageCircle color="#fff" size={20} style={{marginRight: 10}} />
                      <Text style={styles.generateButtonText}>ENVIAR RESUMO</Text>
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
      </Modal>
       
      {/* MODAL DE DETALHES DO GRUPO */}
      <Modal 
          visible={!!selectedGroup} 
          animationType="fade" 
          transparent 
          onRequestClose={() => setSelectedGroup(null)}
      >
          <View style={styles.groupModalBackdrop}>
               <View style={styles.groupModalCard}>
                   {/* Header do Modal */}
                   <View style={styles.groupModalHeader}>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                             <View style={styles.groupIconBg}>
                                 <Database size={24} color="#2563EB" />
                             </View>
                             <View>
                                 <Text style={styles.groupModalTitle}>Grupo {selectedGroup?.Grupo}</Text>
                                 <Text style={styles.groupModalSubtitle}>{selectedGroup?.TIPO} • {selectedGroup?.["Prazo Máximo"]} meses</Text>
                             </View>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedGroup(null)} style={styles.closeRoundBtn}>
                            <X color="#64748B" size={20} />
                        </TouchableOpacity>
                   </View>
                   
                   <ScrollView style={styles.groupModalScroll} showsVerticalScrollIndicator={false}>
                                                                                                      
                       {/* Seção de Análise do Lance (Se existir lance) */}
                       {analysis && analysis.status !== 'unknown' && (
                           <View style={[
                               styles.analysisCard, 
                               analysis.status === 'high' ? styles.analysisHigh : 
                               analysis.status === 'medium' ? styles.analysisMedium : styles.analysisLow
                           ]}>
                               <View style={styles.analysisHeader}>
                                   {analysis.status === 'high' ? <Trophy size={18} color="#15803D" /> :
                                    analysis.status === 'medium' ? <TrendingUp size={18} color="#B45309" /> :
                                    <AlertTriangle size={18} color="#B91C1C" />}
                                   <Text style={[
                                        styles.analysisTitle,
                                        analysis.status === 'high' ? {color: '#15803D'} :
                                        analysis.status === 'medium' ? {color: '#B45309'} : {color: '#B91C1C'}
                                   ]}>
                                         Análise do Seu Lance
                                   </Text>
                               </View>
                               
                               <View style={styles.analysisMetrics}>
                                   <View>
                                         <Text style={styles.analysisLabel}>Seu Lance</Text>
                                         <Text style={styles.analysisValue}>{analysis.userBidPct.toFixed(2)}%</Text>
                                   </View>
                                   <View style={styles.analysisSeparator} />
                                   <View>
                                         <Text style={styles.analysisLabel}>Média do Grupo</Text>
                                         <Text style={styles.analysisValue}>{analysis.avgBid.toFixed(2)}%</Text>
                                   </View>
                               </View>
                               
                               <View style={styles.progressBarBg}>
                                   <View style={[
                                        styles.progressBarFill, 
                                        { width: `${Math.min(100, (analysis.userBidPct / (analysis.avgBid * 1.2)) * 100)}%` },
                                        analysis.status === 'high' ? {backgroundColor: '#22C55E'} :
                                        analysis.status === 'medium' ? {backgroundColor: '#F59E0B'} : {backgroundColor: '#EF4444'}
                                   ]} />
                                   <View style={[styles.avgMarker, { left: `${Math.min(100, (analysis.avgBid / (analysis.avgBid * 1.2)) * 100)}%` }]} />
                               </View>

                               <Text style={styles.analysisMessage}>
                                   {analysis.message}
                               </Text>
                           </View>
                       )}

                       <View style={styles.infoGrid}>
                           <View style={styles.infoBox}>
                               <Text style={styles.infoBoxLabel}>Créditos Disponíveis</Text>
                               <Text style={styles.infoBoxValue}>{selectedGroup?.["Créditos Disponíveis"]}</Text>
                           </View>
                            <View style={styles.infoBox}>
                               <Text style={styles.infoBoxLabel}>Última Assembleia</Text>
                               <Text style={styles.infoBoxValue}>{selectedGroup?.Assembleia || 'A definir'}</Text>
                           </View>
                       </View>

                       <Text style={styles.sectionDividerTitle}>Estatísticas da Última Assembleia</Text>

                       {/* Estatísticas Principais */}
                       <View style={styles.statsRow}>
                           <View style={styles.statCard}>
                               <Users size={20} color="#3B82F6" style={{marginBottom: 8}}/>
                               <Text style={styles.statValue}>{selectedGroup?.['Qtd Contemplados'] || '-'}</Text>
                               <Text style={styles.statLabel}>Número de Contemplados</Text>
                           </View>
                           <View style={styles.statCard}>
                               <Target size={20} color="#8B5CF6" style={{marginBottom: 8}}/>
                               <Text style={styles.statValue}>{selectedGroup?.['Qtd Lance Fixo (30/45)'] || '-'}</Text>
                               <Text style={styles.statLabel}>
                                   Contemplados por Lance Fixo{selectedGroup?.['Lance Fixo Max'] ? ` de ${selectedGroup['Lance Fixo Max']}` : ''}
                               </Text>
                           </View>
                           <View style={styles.statCard}>
                               <DollarSign size={20} color="#10B981" style={{marginBottom: 8}}/>
                               <Text style={styles.statValue}>{selectedGroup?.['Qtd Lance Livre'] || '-'}</Text>
                               <Text style={styles.statLabel}>Contemplados por Lance Livre</Text>
                           </View>
                       </View>

                       {/* Dados Detalhados */}
                       <View style={styles.detailedStatsContainer}>
                            <View style={styles.detailedRow}>
                               <View style={styles.detailedIconBox}>
                                   <TrendingDown size={16} color="#F59E0B" />
                               </View>
                               <View style={{flex: 1}}>
                                   <Text style={styles.detailedLabel}>Percentual do Menor Lance Livre</Text>
                                   <Text style={styles.detailedValue}>
                                         {selectedGroup?.['Menor Lance Livre'] ? `${selectedGroup['Menor Lance Livre']}%` : '-'}
                                   </Text>
                               </View>
                            </View>
                            <View style={styles.detailedDivider} />
                            <View style={styles.detailedRow}>
                               <View style={[styles.detailedIconBox, {backgroundColor: '#ECFDF5'}]}>
                                   <BarChart3 size={16} color="#10B981" />
                               </View>
                               <View style={{flex: 1}}>
                                   <Text style={styles.detailedLabel}>Percentual da Média de Lances Livres</Text>
                                   <Text style={styles.detailedValue}>
                                         {selectedGroup?.['Media Lance Livre'] ? `${selectedGroup['Media Lance Livre']}%` : '-'}
                                   </Text>
                               </View>
                            </View>
                       </View>

                       {selectedGroup?.['Lances Fixos'] && (
                            <View style={styles.fixedBidContainer}>
                                <View style={styles.fixedBidIcon}>
                                     <Target size={20} color="#0369A1" />
                                </View>
                                <Text style={styles.fixedBidText}>
                                   Este grupo pode contemplar com Lances Fixos de {selectedGroup['Lances Fixos']}.
                                </Text>
                            </View>
                       )}

                       {/* --- NOVOS GRÁFICOS DE HISTÓRICO --- */}
                       {getGroupChartsData.chartContemplados.length > 0 && (
                           <View style={{marginTop: 10, marginBottom: 20}}>
                               <Text style={styles.sectionDividerTitle}>Histórico das últimas assembleias</Text>
                               
                               {/* Gráfico 1: Quantidade de Contemplados */}
                               <CustomBarChart 
                                   data={getGroupChartsData.chartContemplados} 
                                   color="#16A34A" // Verde
                                   title="Quantidade de Contemplações"
                               />
                               
                               <View style={{height: 20}} />

                               {/* Gráfico 2: Média de Lances */}
                               <CustomBarChart 
                                   data={getGroupChartsData.chartLances} 
                                   color="#F59E0B" // Laranja
                                   title="Médias de Lances Livres"
                                   suffix="%"
                                   type="float"
                               />

                               <View style={{height: 20}} />

                               {/* Gráfico 3: Menor Lance Livre (NOVO) */}
                               <CustomBarChart 
                                   data={getGroupChartsData.chartMenorLance} 
                                   color="#E11D48" // Vermelho/Rose para diferenciar (Indicando "Mínimo")
                                   title="Menores Lances Livres"
                                   suffix="%"
                                   type="float"
                               />
                           </View>
                       )}

                   </ScrollView>

                   <View style={styles.groupModalFooter}>
                       <TouchableOpacity style={styles.groupCloseButton} onPress={() => setSelectedGroup(null)}>
                           <Text style={styles.groupCloseButtonText}>FECHAR DETALHES</Text>
                       </TouchableOpacity>
                   </View>
               </View>
         </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
   
  // HEADER RESPONSIVO PADRONIZADO
  headerWrapper: {
    backgroundColor: '#F8FAFC',
    width: '100%',
    alignItems: 'center', // Centraliza o conteúdo interno
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', flex: 1, textAlign: 'center' },
   
  // BOTÃO DE NAVEGAÇÃO E AÇÃO (Direita)
  navBtn: { 
    height: 40,
    minWidth: 40,
    paddingHorizontal: 12, // Permite crescer se tiver texto
    backgroundColor: '#F1F5F9', // Cor base suave (cinza claro)
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  // BOTÃO VOLTAR PADRONIZADO (Esquerda - Fixo 40x40)
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
   
  // SCROLL CONTENT
  scrollContent: { paddingBottom: 40, paddingTop: 10 },

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

  // --- ÁREA DE CONTROLE DE SIMULAÇÃO INTEGRADA ---
  simulationControlBox: { 
    flexDirection: 'row', 
    backgroundColor: '#F1F5F9', // Cinza muito suave para destacar dentro do card branco
    borderRadius: 16, 
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  simulationControlItem: {
    flex: 1,
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#CBD5E1',
    marginHorizontal: 16
  },
  simulationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  inputContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  simulationInput: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    padding: 0,
    minWidth: 40,
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
    marginRight: 4,
    textAlign: 'center'
  },
  simulationSuffix: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  simulationDateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'capitalize'
  },
  // ---------------------------------------------------

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

  // MODAL PDF
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

  // BADGES DE GRUPOS - ESTILOS BASE E DINÂMICOS
  badgesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
   
  // Badge Padrão (Azul Escuro / Unknown)
  groupBadge: {
    backgroundColor: '#0F172A', 
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  groupBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Badge High (Verde - Supera Média)
  badgeHigh: {
    backgroundColor: '#D1FAE5', // Green 100
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1FAE5' // Green 400
  },
  badgeTextHigh: { color: '#065F46', fontSize: 13, fontWeight: '700' }, // Green 900

  // Badge Medium (Amarelo - Supera Mínimo)
  badgeMedium: {
    backgroundColor: '#fddf8dff', // Yellow 100
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fddf8dff' // Yellow 400
  },
  badgeTextMedium: { color: '#B45309', fontSize: 13, fontWeight: '700' }, // Yellow 900

  // Badge Low (Vermelho - Abaixo Mínimo)
  badgeLow: {
    backgroundColor: '#fad1d1ff', // Red 100
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fad1d1ff' // Red 400
  },
  badgeTextLow: { color: '#5f0606ff', fontSize: 13, fontWeight: '700' }, // Red 900

  noGroupsText: { color: '#64748B', fontSize: 13, fontStyle: 'italic', marginTop: 4 },

  // NOVA DICA INLINE
  inlineHintContainer: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      alignItems: 'center',
      backgroundColor: '#EFF6FF',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 6,
  },
  inlineHintText: {
      fontSize: 10,
      color: '#2563EB',
      fontWeight: '600'
  },

  // MODAL DE DETALHES DO GRUPO (NOVO)
  groupModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  groupModalCard: { 
      backgroundColor: '#fff', 
      borderRadius: 24, 
      width: '100%', 
      maxWidth: 480, // Largura máxima para Desktop
      maxHeight: '85%',
      alignSelf: 'center', 
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 20,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column'
  },
  groupModalHeader: { 
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
      padding: 24, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF'
  },
  groupIconBg: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  groupModalTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  groupModalSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 2 },
   
  closeRoundBtn: { 
      width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', 
      alignItems: 'center', justifyContent: 'center' 
  },
   
  groupModalScroll: { padding: 24 },

  // NOVA SEÇÃO DE LANCES FIXOS
  fixedBidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE', // Azul bem claro (Sky 100)
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#7DD3FC' // Azul Sky 300
  },
  fixedBidIcon: {
    marginRight: 10
  },
  fixedBidText: {
    fontSize: 13,
    color: '#0369A1', // Azul Sky 700
    fontWeight: '600',
    flex: 1,
    lineHeight: 18
  },

  // CARD DE ANÁLISE DE LANCE
  analysisCard: { 
      borderRadius: 16, padding: 16, marginBottom: 24, 
      borderWidth: 1,
      shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  analysisHigh: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  analysisMedium: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  analysisLow: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },

  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  analysisTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
   
  analysisMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  analysisLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  analysisValue: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  analysisSeparator: { width: 1, height: '100%', backgroundColor: 'rgba(0,0,0,0.1)' },

  progressBarBg: { height: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4, marginBottom: 12, position: 'relative' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  avgMarker: { position: 'absolute', top: -2, width: 2, height: 12, backgroundColor: '#0F172A', opacity: 0.5 },

  analysisMessage: { fontSize: 13, fontWeight: '500', color: '#334155', lineHeight: 18 },

  // GRID DE INFORMAÇÕES
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  infoBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  infoBoxLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  infoBoxValue: { fontSize: 14, color: '#0F172A', fontWeight: '700' },

  sectionDividerTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },

  // ESTATÍSTICAS PRINCIPAIS
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { 
      flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center',
      shadowColor: '#64748B', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  statLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', textAlign: 'center' },

  // ESTATÍSTICAS DETALHADAS
  detailedStatsContainer: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginBottom: 20 },
  detailedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailedIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' },
  detailedLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  detailedValue: { fontSize: 16, color: '#0F172A', fontWeight: '700' },
  detailedDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },

  // OUTROS CAMPOS
  othersContainer: { marginTop: 8 },
  otherRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  otherLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  otherValue: { fontSize: 13, color: '#334155', fontWeight: '600' },

  groupModalFooter: { padding: 24, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  groupCloseButton: { backgroundColor: '#0F172A', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  groupCloseButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },

  // ESTILOS DE GRÁFICO (Chart)
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    width: '100%'
  },
  chartTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E3A8A', // Cor padrão (Azul), o botão do Whats sobrescreve para Verde
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8, // Espaço entre ícone e texto
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Centraliza o conteúdo
    paddingVertical: 6,       // Altura menor para caber dois no header
    paddingHorizontal: 10,
    borderRadius: 8,
    width: 140,               // LARGURA FIXA para garantir que ambos tenham o mesmo tamanho
  },
  headerActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,             // Fonte um pouco menor para não quebrar
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
  },

});