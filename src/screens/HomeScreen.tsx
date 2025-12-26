import React, { useMemo, useEffect, useState, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, 
  StatusBar, ScrollView, Image, useWindowDimensions,
  BackHandler, Alert, ActivityIndicator, Modal, FlatList, RefreshControl,
  TouchableWithoutFeedback, Animated, TextInput, Keyboard, Platform, Easing
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { 
  Car, Home as HomeIcon, Bike, Gem, ChevronRight, 
  LayoutGrid, BarChart3, X, Calendar, DollarSign,  
  TrendingUp, Hourglass, Filter, Check, Megaphone, AlertTriangle, Sparkles, Clock, Trash2,
  Zap, Percent, Target, Users, Award, Briefcase, CalendarClock,
  Star, BrainCircuit, MessageSquare, Send, Search, BarChart4, Eye, EyeOff, XCircle, LineChart,
  Info
} from 'lucide-react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop, Text as SvgText, Line } from 'react-native-svg';

import { RootStackParamList } from '../types/navigation';
import { Category, TableMetadata } from '../../data/TableRepository'; 
import { DataService } from '../services/DataService';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// --- CONFIGURAÇÕES SUPABASE ---
const SUPABASE_URL = "https://nhnejoanmggvinnfphir.supabase.co";

// ⚠️ ATENÇÃO: INSIRA SUA CHAVE AQUI PARA O SALVAMENTO FUNCIONAR
const SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obmVqb2FubWdndmlubmZwaGlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA3NDk5NCwiZXhwIjoyMDgxNjUwOTk0fQ._QXfa-v4YBC_-xazB4A6LrWeB-oxXiIFfboiqbNQh7Q"; 

// --- URLS DOS ARQUIVOS JSON ---
const STORAGE_PATH = "/storage/v1/object/public/consorciorecon-json";
const API_WRITE_PATH = "/storage/v1/object/consorciorecon-json"; // Caminho sem 'public' para escrita

// URL para LEITURA (Pública)
const TICKER_JSON_URL = `${SUPABASE_URL}${STORAGE_PATH}/mensagem_rolante.json`;

// URL para ESCRITA (API)
const TICKER_UPLOAD_URL = `${SUPABASE_URL}${API_WRITE_PATH}/mensagem_rolante.json`;

const MAIN_JSON_URL = `${SUPABASE_URL}${STORAGE_PATH}/relacao_atualizada.json`;
const RELACAO_JSON_URL = `${SUPABASE_URL}${STORAGE_PATH}/relacao_grupos.json`;
const STATS_JSON_URL = `${SUPABASE_URL}${STORAGE_PATH}/estatisticas_grupos.json`;
const HISTORY_JSON_URL = `${SUPABASE_URL}${STORAGE_PATH}/historico_assembleias.json`;
const MODEL_URL = `${SUPABASE_URL}${STORAGE_PATH}/pesos_ia.json`; 
const FINANCIAL_DATA_URL = `${SUPABASE_URL}${STORAGE_PATH}/dados_consorcio.json`;

interface BaseCategory {
  id: Category;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  bgLight: string;
}

// --- INTERFACES ---
interface TickerData {
    messages: string[];
    lastUpdate: string;
}

interface GroupItem {
  "Grupo": number;
  "Espécie": string;
  "Vagas": string;
  "Duração Padrão": number;
  "Ass. Realizadas": number;
  "Prazo Máx. Vendas": number;
  "Máx. Cotas": number;
  "Créditos Disponíveis": string;
  "Lance Normal": string;
  "Lance Fixo": string;
  "Carta Avaliação": string;
  "Lance FGTS": string;
  "Lance Embutido (25%)": string;
  "Dia do Vencimento": number;
  "Próxima Assembleia": string;
  aiPrediction?: AIPrediction; 
  
  smartMatchDetails?: {
      reason: string;
      score: number;
      matchedCredit?: number;
      matchedInstallment?: number;
      matchedPlanType?: 'NORMAL' | 'LIGHT' | 'SUPERLIGHT';
      matchedTerm?: number;
  };
}

interface RelacaoGrupoItem {
  "Grupo": number;
  "PLANO": string; 
  "Lance Fixo Max": string; 
}

interface EstatisticaGrupoItem {
  "Grupo": number;
  "Assembleia": string;
  "Qtd Contemplados": number;
  "Qtd Lance Fixo (30/45)": number;
  "Qtd Lance Livre": number;
  "Media Lance Livre": number; 
  "Menor Lance Livre": number; 
}

interface AIPrediction {
    isOpportunity: boolean;
    suggestedBid: number;
    label: string;
    details: string;
    forecastMsg: string;
}

interface ConsortiumData {
  ultima_atualizacao: string;
  grupos: GroupItem[];
}

interface NeuralWeights {
    layer1: { weights: number[][], bias: number[] };
    layer2: { weights: number[][], bias: number[] };
    output: { weights: number[][], bias: number[] };
}

interface FinancialTableData {
    metadata: any[];
    data: {
        [key: string]: Array<{
            credito: number;
            prazos: Array<{
                prazo: number;
                parcela_CSV: number;
                parcela_SSV: number;
                parcela?: number; 
            }>
        }>
    }
}

const CREDIT_VALUES = [
    13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000, 
    22500, 25000, 27500, 30000, 35000, 40000, 45000, 50000, 
    55000, 60000, 65000, 70000, 75000, 80000, 90000, 100000, 
    110000, 120000, 130000, 140000, 150000, 160000, 180000, 
    190000, 200000, 210000, 220000, 230000, 240000, 250000, 
    260000, 270000, 280000, 290000, 300000
];

// --- MOTOR MATEMÁTICO DA IA ---
const sigmoid = (t: number) => 1 / (1 + Math.exp(-t));

const runNeuralNet = (input: number[], w: NeuralWeights) => {
    const h1 = w.layer1.bias.map((b, j) => { let sum = b; for (let i = 0; i < input.length; i++) { sum += input[i] * w.layer1.weights[i][j]; } return sigmoid(sum); });
    const h2 = w.layer2.bias.map((b, j) => { let sum = b; for (let i = 0; i < h1.length; i++) { sum += h1[i] * w.layer2.weights[i][j]; } return sigmoid(sum); });
    const output = w.output.bias.map((b, j) => { let sum = b; for (let i = 0; i < h2.length; i++) { sum += h2[i] * w.output.weights[i][j]; } return sigmoid(sum); });
    return output[0];
};

// --- COMPONENTE DE GRÁFICO (MANTIDO) ---
// --- COMPONENTE DE GRÁFICO (CORRIGIDO E OTIMIZADO) ---
// --- COMPONENTE DE GRÁFICO (CORRIGIDO: 1 CASA DECIMAL E ALINHAMENTO) ---
const CustomBarChart = ({ data, color, title, suffix = "", type = "int" }: { data: any[], color: string, title: string, suffix?: string, type?: "int" | "float" }) => {
    if (!data || data.length === 0) return null;

    // Dimensões Ajustadas
    const chartHeight = 180; 
    const chartWidth = 320; 
    const padding = 24; 
    const barWidth = 24; // Barras mais largas para acomodar o texto melhor

    const values = data.map(d => d.value);
    
    // Cálculo do Máximo com margem de segurança maior (25%) para o texto não cortar no topo
    const maxVal = Math.max(...values) * 1.25 || 10; 
    const minVal = 0;

    // Nova lógica de distribuição do Eixo X (Centraliza as barras nos slots)
    const usableWidth = chartWidth - (padding * 2);
    const slotWidth = usableWidth / data.length;
    
    const getX = (index: number) => padding + (index * slotWidth) + (slotWidth / 2);
    
    const getY = (val: number) => chartHeight - padding - ((val - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2);

    // Formatação: 1 casa decimal fixa (com arredondamento do toFixed)
    const formatValue = (val: number) => {
        if (type === 'float') {
            // Ex: 15.678 -> "15,7" | 15.000 -> "15,0"
            return val.toFixed(1).replace('.', ',');
        }
        return Math.round(val).toString();
    };

    // Construção da Linha Suave (Bezier)
    let pathD = "";
    if (data.length > 0) {
        pathD = `M ${getX(0)} ${getY(values[0])}`; 
        for (let i = 1; i < data.length; i++) { 
            const x = getX(i); 
            const y = getY(values[i]); 
            const prevX = getX(i - 1); 
            const prevY = getY(values[i - 1]); 
            const controlX = (prevX + x) / 2; 
            pathD += ` C ${controlX} ${prevY}, ${controlX} ${y}, ${x} ${y}`; 
        }
    }

    return (
        <View style={styles.chartContainer}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12, width: '100%', paddingHorizontal: 4}}>
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
                    
                    {/* Linhas de Grade */}
                    {[0, 0.25, 0.5, 0.75, 1].map((factor, i) => { 
                        const y = padding + factor * (chartHeight - padding * 2); 
                        return <Line key={`grid-${i}`} x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#F1F5F9" strokeWidth="1" />; 
                    })}

                    {/* Barras e Texto */}
                    {data.map((item, i) => { 
                        const x = getX(i); 
                        const val = item.value;
                        const y = getY(val); 
                        const h = chartHeight - padding - y; 
                        
                        // Garante que o texto do valor não suba demais e corte
                        const labelY = Math.max(16, y - 8);

                        return (
                            <React.Fragment key={`bar-${i}`}>
                                <Rect 
                                    x={x - barWidth / 2} 
                                    y={y} 
                                    width={barWidth} 
                                    height={h} 
                                    fill={`url(#grad${color})`} 
                                    rx={4} 
                                />
                                {/* Label Data (Eixo X) */}
                                <SvgText 
                                    x={x} 
                                    y={chartHeight - 6} 
                                    fontSize="10" 
                                    fill="#64748B" 
                                    textAnchor="middle"
                                >
                                    {item.label}
                                </SvgText>
                                
                                {/* Valor (Topo da Barra) */}
                                <SvgText 
                                    x={x} 
                                    y={labelY} 
                                    fontSize="11" 
                                    fill={color} 
                                    fontWeight="bold" 
                                    textAnchor="middle"
                                >
                                    {formatValue(val)}{suffix}
                                </SvgText>
                            </React.Fragment>
                        ); 
                    })}

                    {/* Linha de Tendência */}
                    <Path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4" />
                    
                    {/* Pontos na Linha */}
                    {data.map((item, i) => (
                        <Circle 
                            key={`dot-${i}`} 
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

// --- HELPERS E PARSERS ---
const getGroupTypeDetails = (speciesCode: string) => {
    switch (speciesCode) {
        case 'IMV': return { label: 'IMÓVEL', color: '#059669', bgLight: '#ECFDF5', icon: HomeIcon, border: '#059669' };
        case 'AUT': return { label: 'AUTOMÓVEL', color: '#2563EB', bgLight: '#EFF6FF', icon: Car, border: '#2563EB' };
        case 'MOT': return { label: 'MOTOCICLETA', color: '#D97706', bgLight: '#FFFBEB', icon: Bike, border: '#D97706' };
        case 'SRV': return { label: 'SERVIÇOS', color: '#7C3AED', bgLight: '#F5F3FF', icon: Gem, border: '#7C3AED' };
        default: return { label: speciesCode, color: '#64748B', bgLight: '#F1F5F9', icon: LayoutGrid, border: '#E2E8F0' };
    }
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const formatPercent = (value: number) => value.toFixed(2).replace('.', ',');

const parseCreditRange = (creditStr: string) => {
    const cleanStr = creditStr.replace(/R\$/g, '').replace(/\./g, '').trim();
    if (cleanStr.includes(' A ')) {
        const parts = cleanStr.split(' A ');
        return { min: parseFloat(parts[0].replace(',', '.')), max: parseFloat(parts[1].replace(',', '.')) };
    } else {
        const val = parseFloat(cleanStr.replace(',', '.'));
        return { min: val, max: val };
    }
};

const getAgeLabel = (assemblies: number) => {
    if (assemblies < 6) return { label: 'GRUPO NOVO', isNew: true };
    if (assemblies < 12) return { label: `${assemblies} MESES`, isNew: false };
    const years = Math.floor(assemblies / 12);
    return { label: `${years} ${years > 1 ? 'ANOS' : 'ANO'}`, isNew: false };
};

// ---------------------------------------------------------
// --- COMPONENTE NEWS TICKER (DESIGN TV NEWS) ---
// ---------------------------------------------------------
// ---------------------------------------------------------
// --- COMPONENTE NEWS TICKER (CORRIGIDO E OTIMIZADO) ---
// ---------------------------------------------------------
// ---------------------------------------------------------
// --- COMPONENTE NEWS TICKER (CORREÇÃO ANTI-TRAVAMENTO) ---
// ---------------------------------------------------------
// ---------------------------------------------------------
// --- COMPONENTE NEWS TICKER (COM SEPARADOR " - ") ---
// ---------------------------------------------------------
// ---------------------------------------------------------
// --- COMPONENTE NEWS TICKER (ESTILO JORNALÍSTICO) ---
// ---------------------------------------------------------
const NewsTicker = ({ messages }: { messages: string[] }) => {
    const [contentWidth, setContentWidth] = useState(0);
    const translateX = useRef(new Animated.Value(0)).current;
    
    // Referência para podermos parar a animação no cleanup
    const isAnimating = useRef(false);

    useEffect(() => {
        // 1. Se não tiver conteúdo ou largura medida, não faz nada
        if (messages.length === 0 || contentWidth === 0) return;

        // 2. Cálculo da Duração (Velocidade Constante - Ajustada para leitura confortável)
        const speedMsPerPixel = 25; 
        const totalDuration = contentWidth * speedMsPerPixel;

        // 3. Função de Animação Recursiva
        const startAnimation = () => {
            if (!isAnimating.current) return;

            translateX.setValue(0);

            Animated.timing(translateX, {
                toValue: -contentWidth, 
                duration: totalDuration,
                easing: Easing.linear,   
                useNativeDriver: true,
                isInteraction: false     
            }).start(({ finished }) => {
                if (finished && isAnimating.current) {
                    startAnimation();
                }
            });
        };

        isAnimating.current = true;
        startAnimation();

        // 4. Cleanup
        return () => {
            isAnimating.current = false;
            translateX.stopAnimation();
        };
    }, [messages, contentWidth]);

    if (messages.length === 0) return null;

    // Separador estilo jornalístico (Bullet point)
    const SEPARATOR = "   •   "; 

    return (
        <View style={styles.tickerWrapper}>
            {/* ETIQUETA FIXA À ESQUERDA */}
            <View style={styles.tickerLabelContainer}>
                <Megaphone size={10} color="#fff" fill="#fff" style={{marginRight: 4}} />
                <Text style={styles.tickerLabelText}>INFORMATIVOS</Text>
                <View style={styles.tickerTriangle} /> 
            </View>

            {/* ÁREA DE SCROLL */}
            <View style={styles.tickerContainer}>
                <Animated.View 
                    style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        transform: [{ translateX }],
                        // CORREÇÃO ANDROID: Largura forçada para evitar quebra de linha/sobreposição
                        width: 8000, 
                    }}
                >
                    {/* Renderiza 3 blocos para garantir loop infinito visualmente perfeito */}
                    {[1, 2, 3].map((blockId) => (
                        <View 
                            key={`block-${blockId}`} 
                            style={{flexDirection: 'row', alignItems: 'center'}} 
                            onLayout={blockId === 1 ? (e) => setContentWidth(e.nativeEvent.layout.width) : undefined}
                        >
                            {messages.map((msg, index) => (
                                <Text key={`m${blockId}-${index}`} style={styles.tickerText} numberOfLines={1}>
                                    {msg}
                                    <Text style={styles.separator}>{SEPARATOR}</Text>
                                </Text>
                            ))}
                        </View>
                    ))}
                </Animated.View>
            </View>
        </View>
    );
};


// ---------------------------------------------------------
// --- FUNÇÃO GERADORA DE MENSAGENS (GLOBAL) ---
// ---------------------------------------------------------
// ---------------------------------------------------------
// --- FUNÇÃO GERADORA DE MENSAGENS (GLOBAL) ---
// ---------------------------------------------------------
const calculateTickerMessages = (mainData: ConsortiumData, historyData: any[], financialData: any): string[] => {
    const msgs: string[] = [];
    if (!mainData?.grupos) return msgs;

    // --- 1. LÓGICA DE LANÇAMENTO DE NOVOS GRUPOS (0 ou 1 Assembleia) ---
    mainData.grupos.forEach(g => {
        if (g["Ass. Realizadas"] <= 1) {
            let segmento = g["Espécie"];
            // Mapeamento de Siglas para Texto Completo
            if (segmento === 'IMV') segmento = 'Imóvel';
            else if (segmento === 'AUT') segmento = 'Automóvel';
            else if (segmento === 'MOT') segmento = 'Motocicleta';
            else if (segmento === 'SRV') segmento = 'Serviços';

            msgs.push(`Lançamento do novo grupo ${g.Grupo} do segmento ${segmento}, verifique e faça uma simulação!`);
        }
    });

    // --- 2. LÓGICA DE AGRUPAMENTO (AMARELO E VERMELHO) ---
    const yellowGroupsMap: {[key: string]: number[]} = {};
    const redGroups: number[] = [];

    mainData.grupos.forEach(g => {
        const nextAssemblyDateStr = g["Próxima Assembleia"];
        if (!nextAssemblyDateStr) return;

        const [day, month, year] = nextAssemblyDateStr.split('/').map(Number);
        const assemblyDate = new Date(year, month - 1, day);
        const today = new Date(); today.setHours(0, 0, 0, 0); const dayOfWeek = assemblyDate.getDay(); 
        
        const redStartDate = new Date(assemblyDate); const daysToSubtractRed = dayOfWeek === 3 ? 4 : (dayOfWeek === 6 ? 2 : 3); redStartDate.setDate(assemblyDate.getDate() - daysToSubtractRed);
        const yellowStartDate = new Date(redStartDate); yellowStartDate.setDate(redStartDate.getDate() - 7);
        const redEndDate = new Date(assemblyDate); redEndDate.setDate(assemblyDate.getDate() + 1);
        const limitDate = new Date(redStartDate); limitDate.setDate(redStartDate.getDate() - 1);
        
        const weekDays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
        const limitDayName = weekDays[limitDate.getDay()]; 
        const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const assemblyDayStr = `${day}/${monthNames[month-1]}`;
        
        let timeText = `até a próxima ${limitDayName}`; 
        if (today.getTime() === limitDate.getTime()) timeText = `até HOJE`;

        if (today >= redStartDate && today < redEndDate) {
            redGroups.push(g.Grupo);
        } else if (today >= yellowStartDate && today < redStartDate) {
            const key = `${timeText}|${assemblyDayStr}`;
            if (!yellowGroupsMap[key]) yellowGroupsMap[key] = [];
            yellowGroupsMap[key].push(g.Grupo);
        }
    });

    const formatGroupList = (list: number[]) => {
        if (list.length === 0) return "";
        if (list.length === 1) return `no grupo ${list[0]}`;
        const last = list[list.length - 1];
        const others = list.slice(0, list.length - 1).join(", ");
        return `nos grupos ${others} e ${last}`;
    };

    Object.entries(yellowGroupsMap).forEach(([key, groups]) => {
        const [timeText, assemblyDateStr] = key.split('|');
        msgs.push(`Clientes novos cadastrados ${formatGroupList(groups)} ${timeText} participarão da próxima assembleia no dia ${assemblyDateStr}.`);
    });

    if (redGroups.length > 0) {
        msgs.push(`Clientes novos cadastrados ${formatGroupList(redGroups)} participarão da assembleia no próximo mês.`);
    }

    // --- 3. ÚLTIMA ASSEMBLEIA ---
    if (historyData.length > 0) {
        const parseDate = (dateStr: string) => { if (!dateStr) return new Date(0); const [d, m, y] = dateStr.split('/'); return new Date(`${y}-${m}-${d}`); };
        const allDates = historyData.map(h => parseDate(h.Assembleia));
        const maxDate = new Date(Math.max.apply(null, allDates.map(e => e.getTime())));
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - maxDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays <= 5) {
             const day = maxDate.getDate().toString().padStart(2, '0');
             const month = (maxDate.getMonth() + 1).toString().padStart(2, '0');
             const year = maxDate.getFullYear();
             msgs.push(`Os dados referentes à última assembleia do dia ${day}/${month}/${year} já foram atualizados em Relação de Grupos.`);
        }
    }

    // --- 4. NOVAS TABELAS ---
    if (financialData && mainData.ultima_atualizacao) {
        const [datePart] = mainData.ultima_atualizacao.split(' ');
        const [d, m, y] = datePart.split('/').map(Number);
        const updateDate = new Date(y, m - 1, d);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - updateDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 15) {
            msgs.push("Novas tabelas de vendas adicionadas, verifique e faça uma simulação!");
        }
    }

    return msgs;
};

// ---------------------------------------------------------
// --- LÓGICA DE PREDIÇÃO E ANÁLISE AVANÇADA ---
// ---------------------------------------------------------

const norm = { especie: (s: string) => (s === 'IMV' ? 1 : (s === 'AUT' ? 0.5 : 0)), lance: (v: number) => Math.min(v / 100, 1), prazo: (v: number) => Math.min(v / 240, 1) };
const denormalizeBid = (val: number) => Math.max(0, Math.min(val * 100, 100));

const predictWithAI = (weights: NeuralWeights, group: GroupItem, relacaoInfo: RelacaoGrupoItem | undefined, history: any[]): AIPrediction => {
    const parseDate = (dateStr: string) => { if (!dateStr) return new Date(0); const [d, m, y] = dateStr.split('/'); return new Date(`${y}-${m}-${d}`); };
    
    const groupHistory = history.filter(h => String(h.Grupo) === String(group.Grupo)).sort((a, b) => parseDate(b.Assembleia).getTime() - parseDate(a.Assembleia).getTime());
    
    if (groupHistory.length < 3) return { isOpportunity: false, suggestedBid: 0, label: "IA Indisponível", details: "Histórico insuficiente.", forecastMsg: "" };

    const window = groupHistory.slice(0, 8); 

    const getVal = (val: any) => {
        if (typeof val === 'number') return val;
        return parseFloat(String(val).replace('%', '').replace(',', '.')) || 0;
    };

    const minBids = window.map(h => getVal(h["Menor Lance Livre"])).filter(v => v > 0);
    const avgBids = window.map(h => getVal(h["Media Lance Livre"])).filter(v => v > 0);
    const qtdContemplados = window.map(h => getVal(h["Qtd Contemplados"]));

    const avgMinBid = minBids.length > 0 ? minBids.reduce((a, b) => a + b, 0) / minBids.length : 0;
    const avgMediaBid = avgBids.length > 0 ? avgBids.reduce((a, b) => a + b, 0) / avgBids.length : 0;
    const avgContemplations = qtdContemplados.length > 0 ? qtdContemplados.reduce((a, b) => a + b, 0) / qtdContemplados.length : 0;

    // --- ANÁLISE DE TENDÊNCIA E PROGNÓSTICO ---
    let trend = "Estável";
    let forecastMsg = "Há uma possibilidade da média de lance se manter estável ou aproximada para a próxima assembleia.";

    const recentMin = minBids.slice(0, 3);
    const oldMin = minBids.slice(3, 6);

    if (recentMin.length > 0 && oldMin.length > 0) {
        const avgRecent = recentMin.reduce((a,b)=>a+b,0)/recentMin.length;
        const avgOld = oldMin.reduce((a,b)=>a+b,0)/oldMin.length;
        const diff = avgRecent - avgOld;

        if (diff > 1.5) {
            trend = "Alta";
            forecastMsg = "Existe uma tendência de aumento significativo da média de lances para a próxima assembleia, baseada no aquecimento recente do grupo.";
        } else if (diff < -1.5) {
            trend = "Queda";
            forecastMsg = "Há uma certa probabilidade de queda da média de lances livres para a próxima assembleia, seguindo o padrão de resfriamento recente.";
        } else {
             // Se variância baixa
             forecastMsg = "Há uma possibilidade da média de lance se manter o mesmo ou aproximado para a próxima assembleia, indicando estabilidade.";
        }
        
        // Análise de Volume (Booster)
        if (avgContemplations > 10 && avgRecent < 60) {
            forecastMsg = "Grandes volumes de contemplações com lances mais baixos tendem a ter mais chance de contemplação para a próxima assembleia.";
        }
    }

    let predictedBid = avgMinBid;
    if (trend === "Alta") predictedBid += 1.0; 
    
    if (predictedBid === 0 && avgMediaBid > 0) predictedBid = avgMediaBid * 0.9;

    let label = `Tendência ${trend}`;
    let details = `Análise Especialista: Baseado na média real das últimas assembleias, o menor lance contemplado gira em torno de ${predictedBid.toFixed(2)}%.\n\nO grupo mantém uma média de ${avgContemplations.toFixed(0)} contemplações totais por mês e média de lance livre geral de ${avgMediaBid.toFixed(2)}%.`;

    let isOpportunity = false;
    if (predictedBid < 45 || (trend === "Queda" && predictedBid < 55)) {
        label = "💎 Oportunidade Real";
        isOpportunity = true;
    } else if (predictedBid > 65) {
        label = "Alta Concorrência";
    }

    return { isOpportunity, suggestedBid: predictedBid, label, details, forecastMsg };
};

// ---------------------------------------------------------
// --- ASSISTENTE ROBUSTO: LÓGICA SEMÂNTICA ---
// ---------------------------------------------------------

const normalizeText = (text: string) => {
    const expandedText = text.replace(/([\d]+(?:[.,][\d]+)?)\s*(k|mil)/gi, (match, numberPart, multiplier) => {
        const normalizedNum = numberPart.replace(',', '.');
        const val = parseFloat(normalizedNum);
        return isNaN(val) ? match : (val * 1000).toFixed(0); 
    });

    return expandedText
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ""); 
};

const extractEntities = (text: string) => {
    const normalized = normalizeText(text);

    let especie = null;
    if (/(?:m[o0]t[o0]*|motocicleta|biz|duas\s*rodas)/i.test(normalized)) especie = 'MOT';
    else if (/(?:a[u]t[o0]*|carro|autom[oó]vel|ve[ií]culo|fiorino|gol|onix|4\s*rodas)/i.test(normalized)) especie = 'AUT';
    else if (/(?:im[oó]v[e]l|casa|ap(?:artamen)?to|terreno|constru[cç][aã]o|reforma)/i.test(normalized)) especie = 'IMV';
    else if (/(?:servi[cç]o|cirurgia|festa|viagem)/i.test(normalized)) especie = 'SRV';

    let monthsLookback = 6; 
    let isLastAssembly = false;

    const lookbackRegex = /(?:ultim[oa]s?|u[.]?a[.]?|periodo)\s*(\d+)\s*(?:meses|mes|assembleias?)/i;
    const lookbackMatch = normalized.match(lookbackRegex);
    if (lookbackMatch) {
        monthsLookback = parseInt(lookbackMatch[1]);
    }
    
    if (/(?:ultima|ultimo|u[.]?a[.]?)\s*(?:mes|assembleia|resultado|resumo)/i.test(normalized)) {
        monthsLookback = 1;
        isLastAssembly = true;
    }

    const intents = {
        hasParcela: /(?:parcela|pagar|mensal|m[eê]s|valor|presta[cç][aã]o)/i.test(normalized),
        hasLance: /(?:lance|oferta|entrada|dar)/i.test(normalized),
        hasPrazo: /(?:prazo|meses|tempo|x|vezes)/i.test(normalized), 
        hasGrupo: /(?:grupo)/i.test(normalized),
        hasVagas: /(?:vaga|vagas)/i.test(normalized),
        hasContemplacao: /(?:contemplar|contempla[cç][aã]o|contemplad[oa]s?|contempla[cç][õo]es|saindo|sair|contemplando|sorteados?|ganhadores?|vencedores?)/i.test(normalized),
        hasQuantidade: /(?:quantos|quantidade|numero|total|qtd|soma|quantas)/i.test(normalized),
        hasMais: /(?:mais|maior|melhor|bastante|alto)/i.test(normalized),
        hasMenos: /(?:menos|menor|pior|baixo)/i.test(normalized),
        hasFixo: /(?:fixo)/i.test(normalized),
        hasLivre: /(?:livre)/i.test(normalized),
        hasMedia: /(?:media)/i.test(normalized),
        hasLight: /(?:light|reduzida|leve)/i.test(normalized) && !/(?:super)/i.test(normalized),
        hasSuperLight: /(?:super\s*light|superlight|super\s*reduzida)/i.test(normalized),
        hasResultado: /(?:resultado|resumo|relatorio|como\s*foi|detalhes)/i.test(normalized),
        hasChance: /(?:chance|probabilidade|risco|previs[aã]o|ia|tensorflow|futuro|estatistica|analise)/i.test(normalized)
    };

    const termRegex = /(?:prazo|em|x)\s*(\d+)\s*(?:meses|x|vezes|parcelas)?|(\d+)\s*(?:meses|x|vezes|parcelas)/i;
    const termMatch = normalized.match(termRegex);
    let explicitTerm = termMatch ? (parseInt(termMatch[1] || termMatch[2])) : null;

    const numbers = normalized.match(/\d+/g)?.map(Number) || [];

    return { especie, numbers, intents, raw: normalized, explicitTerm, monthsLookback, isLastAssembly };
};

interface InstallmentScenario {
    credit: number;
    term: number;
    planType: 'NORMAL' | 'LIGHT' | 'SUPERLIGHT';
    actualInstallment: number;
    diff: number;
    tableId: string;
}

const findScenariosForCreditAndInstallment = (
    targetCredit: number,
    targetInstallment: number,
    financialData: FinancialTableData,
    especie: string | null
): InstallmentScenario[] => {
    let scenarios: InstallmentScenario[] = [];

    Object.keys(financialData.data).forEach(key => {
        if (especie === 'AUT' && !key.toLowerCase().includes('auto')) return;
        if (especie === 'IMV' && !key.toLowerCase().includes('imovel')) return;
        if (especie === 'MOT' && !key.toLowerCase().includes('moto')) return;

        let currentPlan: 'NORMAL' | 'LIGHT' | 'SUPERLIGHT' = 'NORMAL';
        if (key.includes('_SL')) currentPlan = 'SUPERLIGHT';
        else if (key.includes('_L')) currentPlan = 'LIGHT';

        const table = financialData.data[key];
        const entry = table.find(e => Math.abs(e.credito - targetCredit) < (targetCredit * 0.01));
        
        if (entry) {
            entry.prazos.forEach(p => {
                const val = p.parcela_SSV || p.parcela_CSV || p.parcela || 0;
                if (val === 0) return;
                const diff = Math.abs(val - targetInstallment);
                scenarios.push({
                    credit: entry.credito,
                    term: p.prazo,
                    planType: currentPlan,
                    actualInstallment: val,
                    diff: diff,
                    tableId: key
                });
            });
        }
    });

    return scenarios.sort((a, b) => a.diff - b.diff);
};

const findPossibleCreditsByInstallment = (
    targetInstallment: number, 
    financialData: FinancialTableData, 
    especie: string | null
): InstallmentScenario[] => {
    let scenarios: InstallmentScenario[] = [];
    
    Object.keys(financialData.data).forEach(key => {
        if (especie === 'AUT' && !key.toLowerCase().includes('auto')) return;
        if (especie === 'IMV' && !key.toLowerCase().includes('imovel')) return;
        if (especie === 'MOT' && !key.toLowerCase().includes('moto')) return;

        let currentPlan: 'NORMAL' | 'LIGHT' | 'SUPERLIGHT' = 'NORMAL';
        if (key.includes('_SL')) currentPlan = 'SUPERLIGHT';
        else if (key.includes('_L')) currentPlan = 'LIGHT';

        const table = financialData.data[key];
        table.forEach(entry => {
            entry.prazos.forEach(p => {
                const val = p.parcela_SSV || p.parcela_CSV || p.parcela || 0;
                if (val === 0) return;

                const diff = Math.abs(val - targetInstallment);
                const tolerance = Math.max(50, targetInstallment * 0.1);

                if (diff < tolerance) {
                    scenarios.push({
                        credit: entry.credito,
                        term: p.prazo,
                        planType: currentPlan,
                        actualInstallment: val,
                        diff: diff,
                        tableId: key
                    });
                }
            });
        });
    });

    return scenarios.sort((a, b) => a.diff - b.diff);
};

const calculateGroupPerformance = (
    group: GroupItem, 
    history: any[], 
    months: number, 
    metricType: 'TOTAL' | 'FIXO' | 'LIVRE' | 'MEDIA_LIVRE' | 'MENOR_LIVRE'
) => {
    const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date(0);
        const [d, m, y] = dateStr.split('/');
        return new Date(`${y}-${m}-${d}`);
    };

    const groupHistory = history
        .filter(h => String(h.Grupo) === String(group.Grupo))
        .sort((a, b) => parseDate(b.Assembleia).getTime() - parseDate(a.Assembleia).getTime());

    const slicedHistory = groupHistory.slice(0, months);

    if (slicedHistory.length === 0) return 0;

    let total = 0;
    
    if (metricType === 'TOTAL') {
        total = slicedHistory.reduce((acc, curr) => acc + (parseInt(curr["Qtd Contemplados"]) || 0), 0);
    } else if (metricType === 'FIXO') {
        total = slicedHistory.reduce((acc, curr) => acc + (parseInt(curr["Qtd Lance Fixo (30/45)"]) || 0), 0);
    } else if (metricType === 'LIVRE') {
        total = slicedHistory.reduce((acc, curr) => acc + (parseInt(curr["Qtd Lance Livre"]) || 0), 0);
    } else if (metricType === 'MEDIA_LIVRE') {
        const validRecords = slicedHistory.filter(curr => (parseFloat(String(curr["Media Lance Livre"]).replace(',', '.')) || 0) > 0);
        if (validRecords.length === 0) return 0;
        const sum = validRecords.reduce((acc, curr) => acc + parseFloat(String(curr["Media Lance Livre"]).replace(',', '.')), 0);
        total = sum / validRecords.length;
    } else if (metricType === 'MENOR_LIVRE') {
        const validRecords = slicedHistory.filter(curr => (parseFloat(String(curr["Menor Lance Livre"]).replace(',', '.')) || 0) > 0);
        if (validRecords.length === 0) return 0;
        const sum = validRecords.reduce((acc, curr) => acc + parseFloat(String(curr["Menor Lance Livre"]).replace(',', '.')), 0);
        total = sum / validRecords.length;
    }

    return total;
};


const runSmartSearch = (
    queryText: string, 
    allGroups: GroupItem[], 
    stats: EstatisticaGrupoItem[], 
    financialData: FinancialTableData | null,
    aiWeights: NeuralWeights | null,
    history: any[],
    relacaoData: RelacaoGrupoItem[]
): GroupItem[] => {
    // 1. Extração Básica de Entidades
    const { especie, numbers, intents, raw, explicitTerm, monthsLookback, isLastAssembly } = extractEntities(queryText);
    
    // Regex auxiliar para contexto de crédito (sem acento ou com acento)
    const hasCreditoContext = /(?:cr[eé]dito|carta|bem|valor)/i.test(raw);

    let targetGroup: number | null = null;
    let targetCredit: number | null = null;
    let targetInstallment: number | null = null;
    let targetBid: number | null = null;
    let targetTerm: number | null = null;
    let foundPercentBid = false; 

    if (explicitTerm) targetTerm = explicitTerm;

    const parseValueStr = (str: string): number => {
        if (!str) return 0;
        const lower = str.toLowerCase().trim();
        let mult = 1;
        if (lower.includes('k') || lower.includes('mil')) mult = 1000;
        const numStr = lower.replace(/[^0-9,\.]/g, '').replace(',', '.');
        return parseFloat(numStr) * mult;
    };

    // =========================================================================================
    // === PARSING CONTEXTUAL AVANÇADO ===
    // =========================================================================================

    // 0. DETECÇÃO EXPLÍCITA E IMPLÍCITA DE GRUPO
    const explicitGroupMatch = raw.match(/grupo\s*(\d+)/i);
    if (explicitGroupMatch) {
        targetGroup = parseInt(explicitGroupMatch[1], 10);
    } else {
        // --- NOVA LÓGICA SOLICITADA ---
        // Verifica se algum número solto na frase corresponde exatamente a um Grupo existente na relação
        const matchingGroupNumber = numbers.find(num => relacaoData.some(r => r.Grupo === num));
        if (matchingGroupNumber) {
            targetGroup = matchingGroupNumber;
        }
    }

    // 1. LANCE PERCENTUAL (MELHORADO)
    // Tentativa 1: Busca Exata (Número + % ou "por cento")
    let percentMatch = raw.match(/(\d+[\.,]?\d*)\s*(?:%|por\s*cento)/i);

    // Tentativa 2: Busca por Contexto (Palavra "lance" + Número <= 100)
    if (!percentMatch) {
        const contextMatch = raw.match(/(?:lance|oferta|entrada)\s*(?:de\s*)?(\d+[\.,]?\d*)\b|(\d+[\.,]?\d*)\s*(?:de\s*)?(?:lance|oferta|entrada)/i);
        if (contextMatch) {
            const possibleVal = parseFloat((contextMatch[1] || contextMatch[2]).replace(',', '.'));
            if (possibleVal > 0 && possibleVal <= 100) {
                 targetBid = possibleVal;
                 foundPercentBid = true;
            }
        }
    } else {
        targetBid = parseFloat(percentMatch[1].replace(',', '.'));
        foundPercentBid = true; 
    }

    // 2. PRAZO
    const termMatch = raw.match(/(?:em|x)\s*(\d+)|(\d+)\s*(?:meses|x)/i);
    if (termMatch) {
        const val = parseInt(termMatch[1] || termMatch[2], 10);
        if (val <= 300) targetTerm = val;
    }

    // 3. PARCELA
    const installmentMatch = raw.match(/(?:parcela|mensalidade)\s*(?:de\s*)?(?:R\$\s*)?([\d\.,]+)|([\d\.,]+)\s*(?:reais|mensais)/i);
    if (installmentMatch) {
        targetInstallment = parseValueStr(installmentMatch[1] || installmentMatch[2]);
    }

    // 4. CRÉDITO E LANCE EM DINHEIRO
    // Nota: targetGroup já é excluído aqui pelo filtro, garantindo que o número do grupo não vire crédito
    const largeNumbers = numbers
        .filter(n => n >= 1000 && n !== targetTerm && n !== targetGroup)
        .sort((a, b) => b - a);

    if (largeNumbers.length > 0) {
        const creditRegexMatch = raw.match(/(?:cr[eé]dito|carta|bem|valor)\s*(?:de\s*)?(?:R\$\s*)?([\d\.,]+(?:\s*k|\s*mil)?)/i);
        
        if (creditRegexMatch) {
             targetCredit = parseValueStr(creditRegexMatch[1]);
        } else {
             targetCredit = largeNumbers[0];
        }

        if (largeNumbers[0] > (targetCredit || 0) * 1.5) {
             targetCredit = largeNumbers[0];
        }

        if (largeNumbers.length >= 2 && !targetBid && !foundPercentBid) {
            if (largeNumbers[1] !== targetCredit) {
                targetBid = largeNumbers[1];
            }
        }
    }

    // 5. AJUSTES FINAIS
    if (intents.hasGrupo && !targetGroup) {
         const possibleGroup = numbers.find(n => n >= 1000 && n <= 9999 && n !== targetCredit && n !== targetBid);
         if (possibleGroup) targetGroup = possibleGroup;
    }

    if (largeNumbers.length === 1 && targetCredit && !targetBid && intents.hasLance && !hasCreditoContext && !foundPercentBid) {
        targetBid = targetCredit;
        targetCredit = null;
    }

    if (!targetInstallment) {
        const possibleInstallment = numbers.find(n => n > 0 && n < 5000 && n !== targetTerm && n !== targetBid && n !== targetCredit && n !== targetGroup);
        if (possibleInstallment && intents.hasParcela) {
            targetInstallment = possibleInstallment;
        }
    }

    // =========================================================================================
    // === FILTRAGEM DE CANDIDATOS ===
    // =========================================================================================

    let candidates = [...allGroups];

    if (targetGroup) candidates = candidates.filter(g => g.Grupo === targetGroup);
    if (especie) candidates = candidates.filter(g => g["Espécie"] === especie);

    if (targetCredit) {
        candidates = candidates.filter(g => {
            const { min, max } = parseCreditRange(g["Créditos Disponíveis"]);
            return targetCredit! >= min * 0.95 && targetCredit! <= max * 1.05;
        });
    }

    if (targetTerm) candidates = candidates.filter(g => g["Prazo Máx. Vendas"] >= targetTerm!);

    // --- BLOCO 1: Resultado de Assembleia ---
    if ((intents.hasResultado || (isLastAssembly && intents.hasGrupo)) && targetGroup) {
         const statsItem = stats.find(s => s.Grupo === targetGroup);
         if (statsItem && candidates.length > 0) {
             const g = candidates[0];
             const relInfo = relacaoData.find(r => r.Grupo === g.Grupo);
             const percentualFixo = relInfo?.["Lance Fixo Max"] || "??%";
             const reason = `📆 ${statsItem.Assembleia}:\n🏆 Total: ${statsItem["Qtd Contemplados"]} | 🔒 Fixo: ${statsItem["Qtd Lance Fixo (30/45)"]} (${percentualFixo})\n🎲 Livre: ${statsItem["Qtd Lance Livre"]} | 📊 Média: ${formatPercent(statsItem["Media Lance Livre"])}% | 📉 Menor: ${formatPercent(statsItem["Menor Lance Livre"])}%`;
             return [{ ...g, smartMatchDetails: { score: 500, reason: reason, matchedCredit: 0 } }];
         }
    }

    // --- BLOCO 2: Ranking Estatístico ---
    if (intents.hasContemplacao || (intents.hasQuantidade && (intents.hasGrupo || targetGroup || intents.hasContemplacao)) || (intents.hasLance && !targetBid && (intents.hasMais || intents.hasMenos || intents.hasMedia || intents.hasFixo || intents.hasLivre || intents.hasMedia))) {
        let metric: 'TOTAL' | 'FIXO' | 'LIVRE' | 'MEDIA_LIVRE' | 'MENOR_LIVRE' = 'TOTAL';
        if (intents.hasFixo) metric = 'FIXO';
        else if (intents.hasLivre && !intents.hasMedia && !intents.hasMenos) metric = 'LIVRE';
        else if (intents.hasMedia) metric = 'MEDIA_LIVRE';
        else if (intents.hasMenos && intents.hasLance) metric = 'MENOR_LIVRE';
        
        const rankedByPerformance = candidates.map(g => {
            const value = calculateGroupPerformance(g, history, monthsLookback, metric);
            let score = value;
            if (metric === 'MENOR_LIVRE' || metric === 'MEDIA_LIVRE') score = 100 - value; 
            let reason = "";
            const timeLabel = isLastAssembly ? "na última assembleia" : `nos últimos ${monthsLookback} meses`;
            if (metric === 'TOTAL') reason = `🏆 ${value} contemplações totais ${timeLabel}`;
            else if (metric === 'FIXO') reason = `🔒 ${value} contemplações por Lance Fixo ${timeLabel}`;
            else if (metric === 'LIVRE') reason = `🎲 ${value} contemplações por Lance Livre ${timeLabel}`;
            else if (metric === 'MEDIA_LIVRE') reason = `📊 Média de ${value.toFixed(2)}% no Lance Livre ${timeLabel}`;
            else if (metric === 'MENOR_LIVRE') reason = `📉 Média do Menor Lance Livre: ${value.toFixed(2)}% ${timeLabel}`;
            if ((metric === 'MEDIA_LIVRE' || metric === 'MENOR_LIVRE') && value === 0) score = -1;
            return { ...g, smartMatchDetails: { score: score, reason: reason, matchedCredit: targetCredit || 0 } };
        });
        return rankedByPerformance.filter(g => g.smartMatchDetails!.score >= 0).sort((a, b) => b.smartMatchDetails!.score - a.smartMatchDetails!.score).slice(0, 10) as GroupItem[];
    }
    
    // --- BLOCO 3: Busca Direta ---
    if (targetGroup && candidates.length === 1) {
         return [{ ...candidates[0], smartMatchDetails: { reason: "Pesquisa de grupo realizada.", score: 100 } }];
    }

    // --- BLOCO 4: Financeiro (COM PRIORIZAÇÃO DO PLANO NORMAL) ---
    let validInstallmentScenarios: InstallmentScenario[] = [];
    let foundPlanType: 'NORMAL' | 'LIGHT' | 'SUPERLIGHT' | null = null;

    const sortByPlanPriority = (a: InstallmentScenario, b: InstallmentScenario) => {
        const priority = (p: string) => p === 'NORMAL' ? 0 : (p === 'LIGHT' ? 1 : 2);
        const pA = priority(a.planType);
        const pB = priority(b.planType);
        const diffGap = Math.abs(a.diff - b.diff);
        if (diffGap < 150) { 
            return pA - pB; 
        }
        return a.diff - b.diff;
    };

    if (targetCredit && targetInstallment && financialData) {
        validInstallmentScenarios = findScenariosForCreditAndInstallment(targetCredit, targetInstallment, financialData, especie);
        if (validInstallmentScenarios.length > 0) {
            validInstallmentScenarios.sort(sortByPlanPriority);
            foundPlanType = validInstallmentScenarios[0].planType;
        }
    }
    else if (targetInstallment && financialData && !targetCredit) {
        validInstallmentScenarios = findPossibleCreditsByInstallment(targetInstallment, financialData, especie);
        if (validInstallmentScenarios.length > 0) {
            validInstallmentScenarios.sort(sortByPlanPriority);
            targetCredit = validInstallmentScenarios[0].credit;
            foundPlanType = validInstallmentScenarios[0].planType;
        }
    }

    if (intents.hasSuperLight) foundPlanType = 'SUPERLIGHT';
    else if (intents.hasLight && !foundPlanType) foundPlanType = 'LIGHT';

    // --- LOOP PRINCIPAL DE PONTUAÇÃO ---
    const scored = candidates.map(g => {
        let score = 0;
        let reasons: string[] = [];
        const { min, max } = parseCreditRange(g["Créditos Disponíveis"]);
        const maxTermGroup = g["Prazo Máx. Vendas"]; 

        const relInfo = relacaoData.find(r => r.Grupo === g.Grupo);
        const planoGrupo = relInfo?.PLANO?.toUpperCase() || "NORMAL";
        let acceptsLight = planoGrupo.includes("LIGHT");
        let acceptsSuperLight = planoGrupo.includes("SUPERLIGHT");

        let finalMatchedCredit = targetCredit || 0;
        let finalMatchedTerm = targetTerm || 0;
        let finalMatchedPlan: 'NORMAL' | 'LIGHT' | 'SUPERLIGHT' = foundPlanType || 'NORMAL';
        let finalMatchedInstallment = targetInstallment || 0;

        if (targetInstallment && validInstallmentScenarios.length > 0) {
            const compatibleScenario = validInstallmentScenarios.find(s => {
                const creditOk = s.credit >= min && s.credit <= max;
                const termOk = s.term <= maxTermGroup;
                
                let targetCreditMatch = true;
                if (targetCredit) {
                    targetCreditMatch = (s.credit >= targetCredit * 0.9 && s.credit <= targetCredit * 1.1);
                }

                let planOk = true;
                if (s.planType === 'LIGHT' && !acceptsLight) planOk = false;
                if (s.planType === 'SUPERLIGHT' && !acceptsSuperLight) planOk = false;
                
                return creditOk && termOk && planOk && targetCreditMatch;
            });

            if (compatibleScenario) {
                const isExactInstallment = Math.abs(compatibleScenario.actualInstallment - targetInstallment) < 50;
                score += 250; 
                if (targetCredit && Math.abs(compatibleScenario.actualInstallment - targetInstallment) > 100) {
                     reasons.push(`Compatível com o crédito de ${formatCurrency(compatibleScenario.credit)}: Menor parcela possível ${formatCurrency(compatibleScenario.actualInstallment)} (${compatibleScenario.planType})`);
                } else {
                     reasons.push(`Parcela de ${formatCurrency(compatibleScenario.actualInstallment)} em ${compatibleScenario.term}x (${compatibleScenario.planType})`);
                }
                finalMatchedCredit = compatibleScenario.credit;
                finalMatchedTerm = compatibleScenario.term;
                finalMatchedPlan = compatibleScenario.planType;
                finalMatchedInstallment = compatibleScenario.actualInstallment;
            } else {
                if (targetCredit && targetCredit >= min && targetCredit <= max) {
                    score += 50; 
                    reasons.push(`Comporta o crédito, mas a parcela solicitada requer prazo/plano diferente.`);
                } else {
                    return null;
                }
            }
        }
        else if (targetCredit && targetTerm) {
            let matchesCredit = targetCredit >= min && targetCredit <= max;
            let matchesTerm = targetTerm <= maxTermGroup; 
            if (matchesCredit && matchesTerm) {
                const diff = maxTermGroup - targetTerm;
                if (diff === 0) {
                    score += 250; reasons.push(`🎯 Prazo exato de ${targetTerm} meses e Crédito compatível`);
                } else if (diff <= 12) {
                     score += 180; reasons.push(`Prazo próximo (${maxTermGroup} meses) e Crédito compatível`);
                } else {
                     score += 150 - (diff * 0.5); reasons.push(`Compatível com o crédito de ${formatCurrency(targetCredit)} (Prazo Máx: ${maxTermGroup})`);
                }
            } else { return null; }
        } 
        else if (targetCredit) {
            if (targetCredit >= min && targetCredit <= max) {
                score += 100; reasons.push(`Compatível com o crédito de ${formatCurrency(targetCredit)}.`);
            } else { return null; }
        }

        if (foundPlanType === 'SUPERLIGHT') {
            if (!acceptsSuperLight) { if (intents.hasSuperLight) return null; } 
            else { score += 50; reasons.push("Aceita plano SUPERLIGHT"); }
        } else if (foundPlanType === 'LIGHT') {
            if (!acceptsLight) { if (intents.hasLight) return null; } 
            else { score += 30; reasons.push("Aceita plano LIGHT"); }
        }

        if (targetTerm && !targetCredit && !targetInstallment) {
            if (maxTermGroup >= targetTerm) {
                 score += 100; reasons.push(`Permite prazo de ${targetTerm} meses`);
            } else { return null; }
        }

        // =========================================================
        // === ANÁLISE DE LANCE INTELIGENTE (EQUIVALÊNCIA %) ===
        // =========================================================
        if (targetBid && !targetCredit) {
            const avgLow = calculateGroupPerformance(g, history, 6, 'MENOR_LIVRE');
            if (avgLow > 0) {
                let matchedSomething = false;

                // --- CASO 1: LANCE EM PORCENTAGEM (Ex: "50%") ---
                if (targetBid <= 100) {
                    const yourPct = targetBid;
                    if (yourPct < 99) {
                        const diff = yourPct - avgLow; 
                        if (diff >= -10) { 
                            score += (diff >= 0) ? 500 : 50;
                            const msg = diff >= 0 ? `supera a média histórica dos menores lances nos últimos meses` : `está abaixo da média dos menores lances nos últimos meses`;
                            reasons.push(`✅ SITUAÇÃO 1 (SÓ BOLSO): Sua oferta de ${yourPct.toFixed(2)}% ${msg} (${avgLow.toFixed(2)}%).`);
                            matchedSomething = true;
                        }
                    }
                    const acceptsEmbedded = g["Lance Embutido (25%)"]?.toUpperCase().includes("SIM");
                    if (acceptsEmbedded) {
                        const totalPct = yourPct + 25; 
                        if (totalPct < 99) {
                            const diff = totalPct - avgLow; 
                            if (diff >= -10) {
                                score += (diff >= 0) ? 450 : 100;
                                const msg = diff >= 0 ? `Supera a média dos menores lances nos últimos meses` : `Fica abaixo da média dos menores lances nos últimos meses`;
                                
                                // === ALTERAÇÃO SOLICITADA AQUI ===
                                // Exibe o Crédito de referência (MAX) para contextualizar
                                reasons.push(`🚀 SITUAÇÃO 2 (COM EMBUTIDO): Para o crédito máximo de ${formatCurrency(max)}, com 25% de embutido, total de ${totalPct.toFixed(2)}%. ${msg} (${avgLow.toFixed(2)}%).`);
                                
                                // Se não houver crédito definido, usa o max para exibição no card
                                if (finalMatchedCredit === 0) finalMatchedCredit = max;
                                
                                matchedSomething = true;
                            }
                        }
                    }
                }
                
                // --- CASO 2: LANCE EM DINHEIRO (Ex: "25 mil") ---
                else {
                    const requiredPct = avgLow / 100;
                    const maxCreditPocket = targetBid / requiredPct;

                    if (maxCreditPocket >= min) {
                        const feasibleCredit = Math.min(maxCreditPocket, max);
                        const yourPct = (targetBid / feasibleCredit) * 100;

                        if (yourPct < 99) {
                            const diff = yourPct - avgLow; 
                            if (diff >= -10) {
                                score += (diff >= 0) ? 500 : 50;
                                const status = diff >= 0 ? "supera" : "está abaixo de";
                                reasons.push(`✅ SITUAÇÃO 1 (SÓ BOLSO): Para crédito de ${formatCurrency(feasibleCredit)}, seu lance representa ${yourPct.toFixed(2)}%. ${status} a média (${avgLow.toFixed(2)}%).`);
                                finalMatchedCredit = feasibleCredit;
                                matchedSomething = true;
                            }
                        }
                    }
                    // Lógica de embutido para dinheiro
                    const acceptsEmbedded = g["Lance Embutido (25%)"]?.toUpperCase().includes("SIM");
                    if (acceptsEmbedded) {
                         const denominator = requiredPct - 0.25;
                         let maxCreditEmbedded = (denominator <= 0.01) ? max : targetBid / denominator;
                         if (maxCreditEmbedded >= min) {
                            const feasibleCreditEmb = Math.min(maxCreditEmbedded, max);
                            const totalBidValue = targetBid + (feasibleCreditEmb * 0.25);
                            const totalPct = (totalBidValue / feasibleCreditEmb) * 100;
                            if (totalPct < 99) {
                                if (!matchedSomething || feasibleCreditEmb > (finalMatchedCredit * 1.05)) {
                                    const diff = totalPct - avgLow;
                                    if (diff >= -10) {
                                         score += (diff >= 0) ? 450 : 100;
                                         const statusEmb = diff >= 0 ? "supera" : "está abaixo de";
                                         reasons.push(`🚀 SITUAÇÃO 2 (COM EMBUTIDO): Com embutido para ${formatCurrency(feasibleCreditEmb)}, total vai para ${totalPct.toFixed(2)}%. ${statusEmb} a média (${avgLow.toFixed(2)}%).`);
                                         if (finalMatchedCredit < feasibleCreditEmb) finalMatchedCredit = feasibleCreditEmb;
                                         matchedSomething = true;
                                    }
                                }
                            }
                         }
                    }
                }
                if (!matchedSomething) return null;
            } else {
                 score += 10;
                 reasons.push(`Grupo sem histórico suficiente.`);
            }
        } 
        
        // --- CASO 3: LANCE E CRÉDITO JÁ DEFINIDOS ---
        else if (targetBid) {
            let pocketPercent = 0;
            if (targetBid < 100) {
                pocketPercent = targetBid;
            } else if (finalMatchedCredit) {
                pocketPercent = (targetBid / finalMatchedCredit) * 100;
            }
            if (pocketPercent >= 99) return null;

            const acceptsEmbedded = g["Lance Embutido (25%)"]?.toUpperCase().includes("SIM");
            const totalPotentialPercent = acceptsEmbedded ? pocketPercent + 25 : pocketPercent;
            if (totalPotentialPercent > 124) return null;

            const historicalAvgLow = calculateGroupPerformance(g, history, 6, 'MENOR_LIVRE');
            
            if (historicalAvgLow > 0) {
                const margin = totalPotentialPercent - historicalAvgLow;
                if (margin < -15) return null;
                if (margin >= 0) {
                    score += 300; 
                    reasons.push(`Cobre a média de lance do grupo de ${historicalAvgLow.toFixed(1)}% (Margem: +${margin.toFixed(2)}%).`);
                } else {
                    score += 50;
                    reasons.push(`Abaixo da média de lance do grupo de ${historicalAvgLow.toFixed(1)}% (Diferença: ${margin.toFixed(2)}%).`);
                }
            } else {
                reasons.push("Não há histórico recente para comparação.");
            }
            let bidDetails = `A oferta de lance seria ${totalPotentialPercent.toFixed(1)}%`;
            if (acceptsEmbedded) bidDetails += ` (${pocketPercent.toFixed(1)}% do bolso + 25% de lance embutido).`;
            else bidDetails += ` (somente recursos próprios).`;
            reasons.push(bidDetails);
        }
        else if (intents.hasChance) {
             reasons.push(`⚠️ Probabilidade estatística.`);
        }
        else if (targetBid && !finalMatchedCredit && !targetCredit) {
             score += 10;
             reasons.push(`Lance identificado.`);
        }

        if (!targetCredit && !targetTerm && !targetBid && !targetInstallment && especie) {
            score += 10;
        }

        return {
            ...g,
            smartMatchDetails: {
                score,
                reason: reasons.length > 0 ? reasons.join("\n") : "Compatível com a busca",
                matchedCredit: finalMatchedCredit,
                matchedInstallment: finalMatchedInstallment,
                matchedPlanType: finalMatchedPlan,
                matchedTerm: finalMatchedTerm
            }
        };
    }).filter(g => g !== null && g.smartMatchDetails!.score > 0);

    return scored.sort((a, b) => b!.smartMatchDetails!.score - a!.smartMatchDetails!.score).slice(0, 10) as GroupItem[];
};

const getAssemblyStatus = (nextAssemblyDateStr: string) => {
    if (!nextAssemblyDateStr) return null;
    const [day, month, year] = nextAssemblyDateStr.split('/').map(Number);
    const assemblyDate = new Date(year, month - 1, day);
    const today = new Date(); today.setHours(0, 0, 0, 0); const dayOfWeek = assemblyDate.getDay(); 
    const redStartDate = new Date(assemblyDate); const daysToSubtractRed = dayOfWeek === 3 ? 4 : (dayOfWeek === 6 ? 2 : 3); redStartDate.setDate(assemblyDate.getDate() - daysToSubtractRed);
    const yellowStartDate = new Date(redStartDate); yellowStartDate.setDate(redStartDate.getDate() - 7);
    const redEndDate = new Date(assemblyDate); redEndDate.setDate(assemblyDate.getDate() + 1);
    const limitDate = new Date(redStartDate); limitDate.setDate(redStartDate.getDate() - 1);
    if (today >= redStartDate && today < redEndDate) { return { type: 'RED', message: 'Clientes novos cadastrados participarão da assembleia do próximo mês' }; } 
    else if (today >= yellowStartDate && today < redStartDate) { const weekDays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']; const limitDayName = weekDays[limitDate.getDay()]; const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']; const assemblyDayStr = `${day}/${monthNames[month-1]}`; let timeText = `até a próxima ${limitDayName}`; if (today.getTime() === limitDate.getTime()) timeText = `até HOJE`; return { type: 'YELLOW', message: `Novos clientes cadastrados ${timeText} participarão da próxima assembleia no dia ${assemblyDayStr}.` }; } return null;
};

const PulsatingBadge = () => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(scaleAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }), Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true })])).start(); }, []);
    return (<Animated.View style={[styles.pulsatingContainer, { transform: [{ scale: scaleAnim }] }]}><AlertTriangle size={12} color="#DC2626" /><Text style={styles.pulsatingText}>Restam poucas vagas</Text></Animated.View>);
};
const PulsatingExclamation = () => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(scaleAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }), Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true })])).start(); }, []);
    return (<Animated.View style={{ transform: [{ scale: scaleAnim }], marginRight: 8, marginTop: 2 }}><AlertTriangle size={18} color="#DC2626" fill="#DC2626" /></Animated.View>);
}

const PulsatingButton = ({ onPress, active }: { onPress: () => void, active: boolean }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => { 
        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 800, useNativeDriver: true })
            ])
        ).start(); 
    }, []);

    // ADICIONADO: cursor: 'pointer' para efeito de mãozinha (Web)
    return (
        <TouchableWithoutFeedback onPress={onPress}>
            <Animated.View style={[styles.pulsatingBtn, { backgroundColor: active ? '#D97706' : '#2563EB', transform: [{ scale: scaleAnim }], ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}) } as any]}>
                <MessageSquare size={20} color="#fff" fill="#fff" />
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const DataListRow = ({ label, value, icon: Icon }: { label: string, value: string | number, icon: any }) => (<View style={styles.dataListRow}><View style={styles.dataListLabelContainer}><View style={styles.iconBox}><Icon size={14} color="#64748B" /></View><Text style={styles.dataListLabel}>{label}</Text></View><Text style={styles.dataListValue}>{value}</Text></View>);
const SectionHeader = ({ title }: { title: string }) => (<View style={styles.sectionHeader}><View style={styles.sectionHeaderLine} /><Text style={styles.sectionHeaderText}>{title}</Text><View style={styles.sectionHeaderLine} /></View>);
// --- NOVO COMPONENTE: BOTÃO RELAÇÃO DE GRUPOS PULSANTE ---
const PulsatingReportButton = ({ onPress }: { onPress: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <Animated.View style={[
          styles.reportBtn, 
          { 
            transform: [{ scale: scaleAnim }],
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}) 
          } as any
      ]}>
        <View style={styles.reportBtnIconBox}>
            <BarChart3 color="#FFFFFF" size={16} strokeWidth={2.5} />
        </View>
        <Text style={styles.reportBtnText}>Relação de Grupos</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export default function HomeScreen({ navigation }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const isSmallMobile = windowWidth < 380;
  // Definição de tela pequena para responsividade dos filtros
  const isSmallScreen = windowWidth < 400; 

  const MAX_WIDTH = 960;
  const GAP = 12;
  const paddingHorizontal = isDesktop ? 32 : (isSmallMobile ? 16 : 24);
  const contentWidth = Math.min(windowWidth, MAX_WIDTH);
  const cardWidth = Math.floor((contentWidth - (paddingHorizontal * 2) - GAP) / 2);

  const [allTables, setAllTables] = useState<TableMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isFetchingReport, setIsFetchingReport] = useState(false);
  
  const [mainData, setMainData] = useState<ConsortiumData | null>(null);
  const [relacaoData, setRelacaoData] = useState<RelacaoGrupoItem[]>([]);
  const [statsData, setStatsData] = useState<EstatisticaGrupoItem[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [financialData, setFinancialData] = useState<FinancialTableData | null>(null);

  // NOVO STATE PARA TICKER
  const [tickerMessages, setTickerMessages] = useState<string[]>([]);

  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null);
  
  const [selectedVencimento, setSelectedVencimento] = useState<number | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [selectedCredit, setSelectedCredit] = useState<number | null>(null);
  const [isPotentialFilterActive, setIsPotentialFilterActive] = useState(false); 
  const [showVencimentoSelector, setShowVencimentoSelector] = useState(false);
  const [showCreditSelector, setShowCreditSelector] = useState(false);

  const [aiWeights, setAiWeights] = useState<NeuralWeights | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [chatResults, setChatResults] = useState<GroupItem[] | null>(null);
  const [assistantExplanation, setAssistantExplanation] = useState<string | null>(null);

  const [showPrediction, setShowPrediction] = useState(false);

  const [vencimentoButtonPos, setVencimentoButtonPos] = useState({ x: 0, y: 0 });
  const [creditButtonPos, setCreditButtonPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const loadData = async () => {
        try { 
            const data = await DataService.initialize(); 
            setAllTables(data.tables);
            
            // 1. CARREGAMENTO IMEDIATO DAS MENSAGENS DO TICKER
            fetchTickerMessages();

            // 2. CARREGAMENTO IMEDIATO DOS DADOS COMPLETOS E CÁLCULOS
            // Isso roda em background, sem bloquear a tela inicial
            fetchReportData();
        } catch (error) { console.error("Erro ao carregar tabelas:", error); } 
        finally { setIsLoading(false); }
    };
    loadData();
  }, []);

  const fetchTickerMessages = async () => {
      try {
          // Lê do endpoint público (Rápido)
          const res = await fetch(`${TICKER_JSON_URL}?t=${new Date().getTime()}`, { headers: { 'Cache-Control': 'no-cache' } });
          if (res.ok) {
              const data: TickerData = await res.json();
              if (data && Array.isArray(data.messages)) {
                  setTickerMessages(data.messages);
                  console.log("Mensagens carregadas do Supabase com sucesso.");
              }
          }
      } catch (e) {
          console.log("Não foi possível carregar as mensagens pré-definidas, aguardando cálculo manual.", e);
      }
  };

  const syncTickerMessages = async (main: ConsortiumData, hist: any[], fin: any) => {
      const calculated = calculateTickerMessages(main, hist, fin);
      
      // Compara se mudou (lógica simples de comparação de string)
      const currentStr = JSON.stringify(tickerMessages);
      const newStr = JSON.stringify(calculated);

      if (currentStr !== newStr && calculated.length > 0) {
          console.log("Detectada atualização nas mensagens. Tentando salvar no servidor...");
          setTickerMessages(calculated); // Atualiza Local
          
          if (!SUPABASE_API_KEY) {
              console.warn("⚠️ Chave de API do Supabase não configurada. O arquivo JSON não será atualizado no servidor.");
              return;
          }

          // Tenta salvar no Supabase
          try {
              const fileBody = JSON.stringify({
                  lastUpdate: new Date().toISOString(),
                  messages: calculated
              });

              // PUT no Supabase Storage (API)
              // Usamos TICKER_UPLOAD_URL que aponta para a API, não para a URL pública
              const res = await fetch(TICKER_UPLOAD_URL, {
                  method: 'POST', // Supabase Storage usa POST para upload/upsert na rota /object/
                  headers: {
                      'Authorization': `Bearer ${SUPABASE_API_KEY}`,
                      'Content-Type': 'application/json',
                      'x-upsert': 'true' // Importante para sobrescrever
                  },
                  body: fileBody
              });

              if (res.ok) {
                  console.log("✅ Mensagens atualizadas no servidor com sucesso!");
              } else {
                  console.error("Erro ao salvar mensagens no servidor:", res.status, await res.text());
              }
          } catch (e) {
              console.error("Erro de conexão ao salvar mensagens:", e);
          }
      }
  };
  
  const baseCategories: BaseCategory[] = [
    { id: 'AUTO', label: 'Automóvel', description: 'Novos e seminovos', icon: Car, color: '#2563EB', bgLight: '#EFF6FF' },
    { id: 'IMOVEL', label: 'Imóvel', description: 'Casas, aptos e terrenos', icon: HomeIcon, color: '#059669', bgLight: '#ECFDF5' },
    { id: 'MOTO', label: 'Motocicleta', description: 'Todas as cilindradas', icon: Bike, color: '#D97706', bgLight: '#FFFBEB' },
    { id: 'SERVICOS', label: 'Serviços', description: 'Cirurgias, festas e etc', icon: Gem, color: '#7C3AED', bgLight: '#F5F3FF' },
  ];

  const displayCategories = useMemo(() => {
    if (isLoading) return baseCategories;
    const availableCategories = new Set(allTables.map(t => t.category));
    return baseCategories.filter(cat => availableCategories.has(cat.id));
  }, [allTables, isLoading]);

  const handleNavigateToSelection = (categoryId: Category) => navigation.navigate('TableSelection', { category: categoryId });
  const countTables = (catId: Category) => allTables.filter(t => t.category === catId).length;

  // Função agora chamada no useEffect inicial
  const fetchReportData = async () => {
    // Não usamos setIsFetchingReport aqui para não bloquear a UI inicial,
    // mas se o modal estiver aberto, ele usará o estado local.
    // Se for o fetch inicial, deixamos silencioso.
    
    try {
      const timestamp = new Date().getTime();
      const [mainRes, relacaoRes, statsRes, historyRes, finRes] = await Promise.all([
        fetch(`${MAIN_JSON_URL}?t=${timestamp}`, { headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`${RELACAO_JSON_URL}?t=${timestamp}`, { headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`${STATS_JSON_URL}?t=${timestamp}`, { headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`${HISTORY_JSON_URL}?t=${timestamp}`, { headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`${FINANCIAL_DATA_URL}?t=${timestamp}`, { headers: { 'Cache-Control': 'no-cache' } })
      ]);

      const mData = await mainRes.json();
      const hData = await historyRes.json();
      const fData = await finRes.json();

      setMainData(mData);
      setRelacaoData(await relacaoRes.json());
      setStatsData(await statsRes.json());
      setHistoryData(hData);
      setFinancialData(fData);

      // Sincroniza e calcula mensagens em background
      syncTickerMessages(mData, hData, fData);

    } catch (error) { 
        console.log("Erro ao buscar dados iniciais (pode ser ignorado se offline):", error);
    } 
  };

  useEffect(() => {
      if (aiWeights) return; 
      if (!MODEL_URL.includes('http')) return; 

      const loadModel = async () => {
          setIsTraining(true);
          try {
              const res = await fetch(`${MODEL_URL}?t=${new Date().getTime()}`, { headers: { 'Cache-Control': 'no-cache' } });
              if (!res.ok) throw new Error("Falha ao baixar pesos da IA");
              
              const weightsData = await res.json();
              setAiWeights(weightsData);
              console.log("Pesos da IA Carregados com sucesso!");
          } catch (e) { console.log("Erro IA:", e); } finally { setIsTraining(false); }
      };
      if (modalVisible) setTimeout(loadModel, 500);
  }, [modalVisible]); 

  // NOVO: Função para limpar completamente o estado do assistente
  const handleClearAssistantSearch = () => {
      setChatMessage("");
      setChatResults(null);
      setAssistantExplanation(null);
      Keyboard.dismiss();
  };

  const handleSmartSearch = () => {
      if (!chatMessage.trim()) return;
      Keyboard.dismiss();
      setIsThinking(true);
      setChatResults(null);
      setAssistantExplanation(null);
      
      setSelectedVencimento(null); setSelectedSpecies(null); setSelectedCredit(null); setIsPotentialFilterActive(false); closeAllSelectors();

      setTimeout(() => {
        if (!mainData || !statsData) { Alert.alert("Aguarde", "Os dados ainda estão sendo carregados..."); setIsThinking(false); return; }

        const results = runSmartSearch(chatMessage, mainData.grupos, statsData, financialData, aiWeights, historyData, relacaoData);
        
        if (results.length > 0) {
            setChatResults(results);
            const top = results[0].smartMatchDetails!;
            
            if (top.reason.includes('🏆') || top.reason.includes('🔒') || top.reason.includes('🎲') || top.reason.includes('📊') || top.reason.includes('📉') || top.reason.includes('🎯') || top.reason.includes('🤖')) {
                 setAssistantExplanation(`Analisei o histórico e previsões para encontrar as melhores opções.`);
            } 
            else if ((top.matchedCredit || 0) > 0 && (top.matchedInstallment || 0) > 0) {
                let planText = "Normal";
                if(top.matchedPlanType === 'LIGHT') planText = "Light";
                if(top.matchedPlanType === 'SUPERLIGHT') planText = "Superlight";
                setAssistantExplanation(`Encontrei grupos para crédito de ${formatCurrency(top.matchedCredit || 0)} com parcelas compatíveis no plano ${planText}.`);
            } else if ((top.matchedInstallment || 0) > 0) {
                let planText = "Normal";
                if(top.matchedPlanType === 'LIGHT') planText = "Light";
                if(top.matchedPlanType === 'SUPERLIGHT') planText = "Superlight";
                setAssistantExplanation(`Encontrei parcelas próximas de ${formatCurrency(top.matchedInstallment || 0)} no plano ${planText}.`);
            } else if ((top.matchedCredit || 0) > 0) {
                if (top.matchedTerm) {
                     setAssistantExplanation(`Encontrei grupos para ${formatCurrency(top.matchedCredit || 0)} no prazo de ${top.matchedTerm} meses.`);
                } else {
                     setAssistantExplanation(`Encontrei grupos compatíveis com crédito de ${formatCurrency(top.matchedCredit || 0)}.`);
                }
            } else if (top.matchedTerm) {
                setAssistantExplanation(`Encontrei grupos com prazo máximo compatível com ${top.matchedTerm} meses.`);
            } else {
                setAssistantExplanation(`Encontrei ${results.length} opções baseadas na sua solicitação.`);
            }
        } else {
            setChatResults([]);
            setAssistantExplanation("Não encontrei grupos que correspondam exatamente a todos os critérios (Crédito, Prazo ou Regras do Grupo).");
        }
        setIsThinking(false);
      }, 800);
  };

  const handleOpenReportModal = () => { 
      setModalVisible(true); 
      // O fetchReportData já rodou no inicio. 
      // Se quiser garantir refresh ao abrir:
      fetchReportData(); 
      clearAllFilters(); 
      setShowAssistant(false); 
  };
  const handleOpenStats = (group: GroupItem) => { setSelectedGroup(group); setStatsModalVisible(true); setShowPrediction(false); };
  const clearAllFilters = () => { setSelectedVencimento(null); setSelectedSpecies(null); setSelectedCredit(null); setIsPotentialFilterActive(false); closeAllSelectors(); handleClearAssistantSearch(); }
  const closeAllSelectors = () => { setShowVencimentoSelector(false); setShowCreditSelector(false); };
  const toggleSpecies = (species: string) => { closeAllSelectors(); setSelectedSpecies(prev => prev === species ? null : species); };

  const filteredGroups = useMemo(() => {
    if (chatResults !== null) return chatResults;
    if (!mainData?.grupos) return [];
    
    let filtered = mainData.grupos.filter(group => {
        if (selectedVencimento && group["Dia do Vencimento"] !== selectedVencimento) return false;
        if (selectedSpecies && group["Espécie"] !== selectedSpecies) return false;
        if (selectedCredit) {
            const { min, max } = parseCreditRange(group["Créditos Disponíveis"]);
            if (selectedCredit < min || selectedCredit > max) return false;
        }
        return true;
    });

    if (aiWeights && historyData.length > 0) {
        filtered = filtered.map(group => {
            const relInfo = relacaoData.find(r => r.Grupo === group.Grupo);
            const prediction = predictWithAI(aiWeights, group, relInfo, historyData);
            return { ...group, aiPrediction: prediction };
        });
    }

    if (isPotentialFilterActive) {
        filtered = filtered
            .filter((g: any) => g.aiPrediction && g.aiPrediction.isOpportunity)
            .sort((a: any, b: any) => (a.aiPrediction?.suggestedBid || 100) - (b.aiPrediction?.suggestedBid || 100));
    }

    return filtered;
  }, [mainData, selectedVencimento, selectedSpecies, selectedCredit, isPotentialFilterActive, historyData, aiWeights, chatResults]);

  const getGroupChartsData = useMemo(() => {
      if (!selectedGroup || !historyData.length) return { chartContemplados: [], chartLances: [], chartMenorLance: [] };
      const parseDate = (dateStr: string) => {
          if (!dateStr) return new Date(0);
          if (dateStr.includes('/')) {
              const parts = dateStr.split('/');
              if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
          return new Date(dateStr);
      };
      const formatDateLabel = (dateObj: Date) => {
          if (isNaN(dateObj.getTime())) return '-';
          const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          return `${months[dateObj.getMonth()]}/${dateObj.getFullYear().toString().slice(-2)}`;
      };
      const groupHistory = historyData.filter((h: any) => String(h.Grupo) === String(selectedGroup.Grupo));
      groupHistory.sort((a: any, b: any) => parseDate(a.Assembleia).getTime() - parseDate(b.Assembleia).getTime());
      const last8 = groupHistory.slice(-8);

      return { 
          chartContemplados: last8.map((h: any) => ({ label: formatDateLabel(parseDate(h.Assembleia)), value: parseInt(h['Qtd Contemplados'] || 0) })), 
          chartLances: last8.map((h: any) => ({ label: formatDateLabel(parseDate(h.Assembleia)), value: (typeof h['Media Lance Livre'] === 'string' ? parseFloat(h['Media Lance Livre'].replace('%', '').replace(',', '.')) : h['Media Lance Livre']) || 0 })), 
          chartMenorLance: last8.map((h: any) => ({ label: formatDateLabel(parseDate(h.Assembleia)), value: (typeof h['Menor Lance Livre'] === 'string' ? parseFloat(h['Menor Lance Livre'].replace('%', '').replace(',', '.')) : h['Menor Lance Livre']) || 0 })) 
      };
  }, [selectedGroup, historyData]);

  const renderGroupItem = ({ item }: { item: any }) => {
    const typeDetails = getGroupTypeDetails(item["Espécie"]);
    const isEsgotado = item.Vagas === "0";
    const poucasVagas = !isEsgotado && (parseInt(item.Vagas.replace('+', '')) || 0) < 20 && !item.Vagas.includes('+');
    const ageInfo = getAgeLabel(item["Ass. Realizadas"]);
    const relacaoInfo = relacaoData.find(r => r.Grupo === item.Grupo);
    const plano = relacaoInfo?.PLANO?.toUpperCase() || "NORMAL";
    const isLight = plano.includes("LIGHT");

    const aiData: AIPrediction | undefined = item.aiPrediction;
    const isSmartResult = !!item.smartMatchDetails;

    return (
      <TouchableOpacity style={[styles.groupCard, { borderColor: isSmartResult ? '#10B981' : typeDetails.border, borderWidth: isSmartResult ? 2 : 2 }]} activeOpacity={0.7} onPress={() => handleOpenStats(item)}>
        <View style={styles.groupHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1}}>
            <View style={[styles.groupBadge, { backgroundColor: typeDetails.color }]}>
              <Text style={styles.groupBadgeText}>{item.Grupo}</Text>
            </View>
            <View style={{flex: 1}}>
                <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}>
                    <Text style={[styles.speciesText, { color: typeDetails.color }]}>{typeDetails.label}</Text>
                </View>
                <View style={{flexDirection: 'row', gap: 4, flexWrap: 'wrap', maxWidth: 180}}>
                    {ageInfo.isNew && <View style={styles.newGroupBadge}><Sparkles size={8} color="#fff" /><Text style={styles.newGroupText}>GRUPO NOVO</Text></View>}
                    {isLight && <View style={[styles.planBadge, {backgroundColor: '#7C3AED'}]}><Zap size={8} color="#fff" fill="#fff" /><Text style={styles.planText}>{plano.includes("SUPERLIGHT") ? "LIGHT E SUPERLIGHT" : "PLANO LIGHT"}</Text></View>}
                </View>
            </View>
          </View>
          <View style={{alignItems: 'flex-end'}}>
             <View style={[styles.statusBadge, { backgroundColor: isEsgotado ? '#FEF2F2' : '#ECFDF5' }]}>
                 {isEsgotado ? <X size={12} color="#DC2626" /> : <Check size={12} color="#059669" />}
                 <Text style={[styles.statusText, { color: isEsgotado ? "#DC2626" : "#059669" }]}>{isEsgotado ? "Esgotado" : `Vagas: ${item.Vagas}`}</Text>
             </View>
             {poucasVagas && <PulsatingBadge />}
          </View>
        </View>

        <View style={styles.compactCreditContainer}>
          <Text style={styles.compactCreditLabel}>Créditos Disponíveis</Text>
          <Text style={styles.compactCreditValue}>{item["Créditos Disponíveis"]}</Text>
        </View>

        <View style={styles.glassDetailsContainer}>
            <View style={styles.glassDetailItem}><Text style={styles.glassLabel}>Prazo Máximo</Text><Text style={styles.glassValue}>{item["Prazo Máx. Vendas"]} meses</Text></View>
            <View style={styles.glassSeparator} />
            <View style={styles.glassDetailItem}><Text style={styles.glassLabel}>Realizadas</Text><Text style={styles.glassValue}>{item["Ass. Realizadas"]} assembleias</Text></View>
            <View style={styles.glassSeparator} />
            <View style={styles.glassDetailItem}><Text style={styles.glassLabel}>Próxima Ass.</Text><Text style={styles.glassValue}>{item["Próxima Assembleia"]}</Text></View>
        </View>
        
        <View style={styles.cardFooterInfo}>
             <View style={styles.footerRow}><DollarSign size={14} color="#475569" /><Text style={styles.footerInfoText}>Vencimento dia {item["Dia do Vencimento"]}</Text></View>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                {!ageInfo.isNew && (<View style={styles.ageBadge}><Clock size={10} color="#64748B" /><Text style={styles.ageText}>{ageInfo.label}</Text></View>)}
                {item["Lance Fixo"] !== "NÃO" && (<View style={styles.lanceFixoTag}><Megaphone size={12} color="#fff" fill="#fff" /><Text style={styles.lanceFixoText}>FIXO {item["Lance Fixo"].replace("SIM-", "")}</Text></View>)}
             </View>
        </View>

        {isSmartResult && (
             <View style={styles.smartMatchBox}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4}}>
                    <BrainCircuit size={14} color="#166534" />
                    <Text style={{fontSize: 12, color: '#166534', fontWeight: 'bold'}}>Análise Inteligente:</Text>
                </View>
                <Text style={{fontSize: 11, color: '#15803D', lineHeight: 16}}>{item.smartMatchDetails.reason}</Text>
            </View>
        )}
      </TouchableOpacity>
    );
  };

const renderStatsContent = () => {
      if (!selectedGroup) return null;
      const statsItem = statsData.find(s => s.Grupo === selectedGroup.Grupo);
      const relacaoItem = relacaoData.find(r => r.Grupo === selectedGroup.Grupo);
      const percentualFixo = relacaoItem?.["Lance Fixo Max"] || "??%";
      const typeDetails = getGroupTypeDetails(selectedGroup["Espécie"]);
      let lancesFixosStr = selectedGroup["Lance Fixo"].includes("-") ? selectedGroup["Lance Fixo"].split("-")[1].replace("/", "% e ") + "%" : "15% e 30%";
      const warningInfo = getAssemblyStatus(selectedGroup["Próxima Assembleia"]);
      const { chartContemplados, chartLances, chartMenorLance } = getGroupChartsData;
      
      const plano = relacaoItem?.PLANO?.toUpperCase() || "NORMAL";
      const isLight = plano.includes("LIGHT");

      const aiData: AIPrediction | undefined = selectedGroup.aiPrediction || (aiWeights ? predictWithAI(aiWeights, selectedGroup, relacaoItem, historyData) : undefined);
      
      let tagColor = '#059669'; 
      let tagBg = '#ECFDF5';
      if (aiData) {
          if (aiData.suggestedBid < 45) { tagColor = '#D97706'; tagBg = '#FFFBEB'; }
          else { tagColor = '#7C3AED'; tagBg = '#F5F3FF'; }
      }

      if (!statsItem) return (<View style={styles.loadingContainer}><AlertTriangle size={40} color="#F59E0B" /><Text style={{marginTop: 12, color: '#64748B'}}>Estatísticas indisponíveis.</Text></View>);

      return (
          <ScrollView contentContainerStyle={{padding: 24, paddingBottom: 40}} showsVerticalScrollIndicator={false}>
              {isLight && (<View style={styles.absoluteLightBadge}><Zap size={10} color="#fff" fill="#fff"/><Text style={styles.absoluteLightText}>{plano.includes("SUPERLIGHT") ? "LIGHT / SUPERLIGHT" : "ACEITA PLANO LIGHT"}</Text></View>)}
              <View style={styles.statsHeaderContainer}>
                  <View style={styles.headerCenterColumn}>
                      <View style={[styles.bigGroupBadge, {backgroundColor: typeDetails.color}]}><Text style={styles.bigGroupBadgeText}>{selectedGroup.Grupo}</Text></View>
                      <Text style={[styles.speciesText, {color: typeDetails.color, fontSize: 16, marginTop: 4}]}>{typeDetails.label}</Text>
                      {showPrediction && aiData && (
                          <View style={[styles.statsAnalysisCard, { backgroundColor: tagBg, borderColor: tagColor }]}>
                              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4}}>
                                  <BrainCircuit size={14} color={tagColor} />
                                  <Text style={[styles.analysisCardTitle, { color: tagColor, marginBottom: 0 }]}>{aiData.label}</Text>
                              </View>
                              <Text style={[styles.analysisCardDetails, { color: tagColor }]}>{aiData.details}</Text>
                              
                              {/* NOVO PARAGRAFO DE PREVISÃO */}
                              <View style={{marginTop: 10, marginBottom: 4}}>
                                <Text style={[styles.forecastMsgText, { color: tagColor }]}>{aiData.forecastMsg}</Text>
                              </View>

                              <View style={{marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 6, width: '100%'}}>
                                  <Text style={styles.disclaimerText}>Nota: Esta é uma estimativa estatística baseada no histórico de dados do grupo. Não há garantia de contemplação.</Text>
                              </View>
                          </View>
                      )}
                  </View>
              </View>
              {warningInfo && (<View style={[styles.warningBox, warningInfo.type === 'RED' ? {backgroundColor: '#FEF2F2', borderColor: '#FEE2E2'} : {backgroundColor: '#FFFBEB', borderColor: '#FEF3C7'}]}>{warningInfo.type === 'RED' ? <PulsatingExclamation /> : <AlertTriangle size={18} color="#D97706" style={{marginRight: 8, marginTop: 2}} />}<Text style={[styles.warningText, warningInfo.type === 'RED' ? {color: '#B91C1C'} : {color: '#B45309'}]}>{warningInfo.message}</Text></View>)}
              <View style={{marginTop: 8}}>
                <SectionHeader title="Informações básicas do grupo" />
                <View style={styles.repositionedTagsContainer}>
                    <View style={styles.pillTag}><CalendarClock size={12} color="#475569" /><Text style={styles.pillTagText}>Vencimento dia {selectedGroup["Dia do Vencimento"]}</Text></View>
                    <View style={styles.pillTag}><Megaphone size={12} color="#475569" /><Text style={styles.pillTagText}>Fixos: {lancesFixosStr}</Text></View>
                </View>
                <View style={styles.dataListContainer}><DataListRow label="Máx. Cotas" value={selectedGroup["Máx. Cotas"]} icon={Users} /><DataListRow label="Duração Padrão" value={`${selectedGroup["Duração Padrão"]} meses`} icon={Clock} /><DataListRow label="Lance FGTS" value={selectedGroup["Lance FGTS"]} icon={Briefcase} /><DataListRow label="Prazo Máx. Vendas" value={`${selectedGroup["Prazo Máx. Vendas"]} meses`} icon={Hourglass} /><DataListRow label="Ass. Realizadas" value={selectedGroup["Ass. Realizadas"]} icon={Check} /><DataListRow label="Carta Avaliação" value={selectedGroup["Carta Avaliação"]} icon={Award} /></View>
              </View>
              <View style={{marginTop: 10}}>
                  <SectionHeader title="Informações da última assembleia" />
                  <View style={styles.totalContempladosCard}><View style={{flexDirection:'row', alignItems:'center', gap: 8}}><View style={[styles.iconCircle, {backgroundColor: '#EFF6FF', marginBottom: 0}]}><Target size={20} color="#2563EB" /></View><Text style={styles.totalContempladosLabel}>Total Contemplados</Text></View><Text style={styles.totalContempladosValue}>{statsItem["Qtd Contemplados"]}</Text></View>
                  <View style={styles.flowChartContainer}><Text style={styles.flowTitle}>Contemplados por</Text><View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}><View style={styles.flowTree}><View style={styles.flowVerticalLine} /><View style={styles.flowBranch}><View style={styles.flowConnector} /><View style={styles.flowContent}><View style={[styles.flowValueBox, {borderColor: '#A7F3D0', borderWidth: 1}]}><Text style={styles.flowValueText}>{statsItem["Qtd Lance Livre"]}</Text></View><Text style={styles.flowLabelText}>Lance Livre</Text></View></View><View style={[styles.flowBranch, {marginTop: 12}]}><View style={[styles.flowConnector, {borderBottomLeftRadius: 12}]} /><View style={styles.flowContent}><View style={[styles.flowValueBox, {backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1}]}><Text style={[styles.flowValueText, {color: '#7C3AED'}]}>{statsItem["Qtd Lance Fixo (30/45)"]}</Text></View><Text style={styles.flowLabelText}>Lance Fixo {percentualFixo}</Text></View></View></View><View style={styles.dateMiniCard}><Text style={styles.dateMiniLabel}>Data da Última Assembleia</Text><Text style={styles.dateMiniValue}>{statsItem.Assembleia}</Text></View></View></View>
                  <View style={styles.statRow}><View style={[styles.statCard, {flex: 1}]}><View style={[styles.iconCircle, {backgroundColor: '#FFFBEB'}]}><TrendingUp size={20} color="#D97706" /></View><Text style={styles.statValue}>{formatPercent(statsItem["Media Lance Livre"])}%</Text><Text style={styles.statLabel}>Média Lance Livre</Text></View><View style={[styles.statCard, {flex: 1}]}><View style={[styles.iconCircle, {backgroundColor: '#FEF2F2'}]}><Percent size={20} color="#DC2626" /></View><Text style={styles.statValue}>{formatPercent(statsItem["Menor Lance Livre"])}%</Text><Text style={styles.statLabel}>Menor Lance Livre</Text></View></View>
              </View>
              
              {/* ALTERAÇÃO AQUI: Títulos em caixa alta e remoção do sufixo % */}
              {chartContemplados.length > 0 && (
                  <View style={{marginTop: 10}}>
                      <SectionHeader title="Histórico das últimas assembleias" />
                      
                      <CustomBarChart 
                          data={chartContemplados} 
                          color="#16A34A" 
                          title="Quantidade de Contemplações" 
                      />
                      <View style={{height: 16}} />
                      
                      <CustomBarChart 
                          data={chartLances} 
                          color="#F59E0B" 
                          title="PERCENTUAL DAS MÉDIAS DE LANCES LIVRES" 
                          suffix="" 
                          type="float" 
                      />
                      <View style={{height: 16}} />
                      
                      <CustomBarChart 
                          data={chartMenorLance} 
                          color="#E11D48" 
                          title="PERCENTUAL DOS MENORES LANCES LIVRES" 
                          suffix="" 
                          type="float" 
                      />
                  </View>
              )}
          </ScrollView>
      );
  };

  useEffect(() => {
    const backAction = () => {
      if (statsModalVisible) { setStatsModalVisible(false); return true; }
      if (modalVisible) { 
          if(showAssistant) { setShowAssistant(false); handleClearAssistantSearch(); return true; }
          if(showVencimentoSelector || showCreditSelector) { closeAllSelectors(); return true; } 
          setModalVisible(false); return true; 
      }
      if (navigation.isFocused()) { Alert.alert("Sair", "Deseja sair?", [{ text: "Não", style: "cancel" }, { text: "SIM", onPress: () => BackHandler.exitApp() }]); return true; }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [navigation, modalVisible, statsModalVisible, showVencimentoSelector, showCreditSelector, showAssistant]);

  if (isLoading) return (<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#0F172A" /></View>);

  // VARIAVEIS DE ESTILO RESPONSIVO PARA O RENDER
  // Reduz tamanhos em telas pequenas
  const isCompact = windowWidth < 420; 
  const chipPaddingH = isCompact ? 8 : 12; // Padding interno menor
  const chipPaddingV = isCompact ? 4 : 6;
  const chipGap = isCompact ? 4 : 8;       // Gap bem apertado (4px)
  const chipFontSize = isCompact ? 11 : 12; // Fonte levemente menor
  const iconSize = isCompact ? 12 : 14;
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <ScrollView contentContainerStyle={[styles.scrollContent, { width: contentWidth, alignSelf: 'center', paddingHorizontal: paddingHorizontal }]} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}><Image source={require('../../assets/logo_recon.png')} style={styles.logo} resizeMode="contain" /></View>
        <View style={styles.pageTitleContainer}>
            <View style={styles.titleRow}>
                <View style={{ flex: 1, marginRight: 8 }}><Text style={styles.title}>O que você deseja{'\n'}<Text style={styles.titleHighlight}>simular hoje?</Text></Text></View>
                <PulsatingReportButton onPress={handleOpenReportModal} />
            </View>
            <Text style={styles.subtitle}>Selecione uma categoria abaixo para iniciar.</Text>
        </View>
        <View style={[styles.grid, { gap: GAP }]}>
          {displayCategories.map((cat) => {
            const tableCount = countTables(cat.id);
            return (
              <TouchableOpacity key={cat.id} style={[styles.card, { width: cardWidth }]} activeOpacity={0.7} onPress={() => handleNavigateToSelection(cat.id)}>
                <View style={styles.cardHeader}><View style={[styles.iconContainer, { backgroundColor: cat.bgLight }]}><cat.icon color={cat.color} size={28} strokeWidth={2} /></View><View style={[styles.countBadge, { borderColor: cat.bgLight }]}><Text style={[styles.countText, { color: cat.color }]}>{tableCount}</Text></View></View>
                <View style={styles.cardContent}><Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit>{cat.label}</Text><Text style={styles.cardDesc} numberOfLines={2}>{cat.description}</Text></View>
                <View style={styles.cardFooter}><Text style={[styles.actionText, { color: cat.color }]}>Simular</Text><ChevronRight size={16} color={cat.color} /></View>
              </TouchableOpacity>
            );
          })}
        </View>
        {displayCategories.length === 0 && !isLoading && (<View style={styles.emptyState}><LayoutGrid size={32} color="#94A3B8" /><Text style={styles.emptyText}>Nenhuma tabela</Text></View>)}
        
        {/* COMPONENTE NEWS TICKER INSERIDO AQUI */}
        <NewsTicker messages={tickerMessages} />

        <View style={styles.footerContainer}><Text style={styles.footerVersion}>VERSÃO DE TESTES - SIMULADOR RECON</Text><Text style={styles.footerVersion}>Desenvolvido por Alessandro Uchoa</Text></View>
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setModalVisible(false)}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
          <View style={[styles.modalContent, isDesktop ? { width: 600, height: 600 } : { width: '92%', maxHeight: '80%' }]}>
            <View style={styles.innerShadowOverlay} pointerEvents="none" />
            
            <View style={styles.modalHeader}>
                <View style={{flex: 1}}><Text style={styles.modalTitle}>RELAÇÃO DE GRUPOS</Text><Text style={styles.modalSubtitle}>{mainData?.ultima_atualizacao ? `Última atualização: ${mainData.ultima_atualizacao}` : 'Buscando dados...'}</Text></View>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    {isTraining ? (<View style={[styles.headerFilterBtn, { opacity: 0.7 }]}><ActivityIndicator size="small" color="#D97706" /><Text style={{fontSize: 10, color: '#D97706', marginLeft: 4}}>CARREGANDO...</Text></View>) : (
                        <PulsatingButton onPress={() => { setShowAssistant(!showAssistant); if(showAssistant) { handleClearAssistantSearch(); }}} active={showAssistant} />
                    )}
                    <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}><X size={24} color="#64748B" /></TouchableOpacity>
                </View>
                
            </View>

            {/* CAIXA DE CHAT DO ASSISTENTE */}
            {showAssistant && (
                <View style={styles.assistantContainer}>
                    <View style={styles.inputWrapper}>
                        <Search size={18} color="#94A3B8" style={{marginLeft: 12}} />
                        <TextInput style={[styles.assistantInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} placeholder="Ex: Grupo de auto para crédito de 50 mil" placeholderTextColor="#94A3B8" value={chatMessage} onChangeText={setChatMessage} onSubmitEditing={handleSmartSearch} autoFocus={true} selectionColor="#2563EB" />
                        {chatMessage.length > 0 && (<TouchableOpacity onPress={handleClearAssistantSearch} style={{padding: 8}}><XCircle size={16} color="#94A3B8" /></TouchableOpacity>)}
                        {chatMessage.length > 0 && (<TouchableOpacity onPress={handleSmartSearch} style={styles.sendIconBtn}><Send size={16} color="#fff" /></TouchableOpacity>)}
                    </View>
                    {isThinking && <Text style={styles.thinkingText}>Consultando tabelas e inicializando inteligência de dados...</Text>}
                    {assistantExplanation && !isThinking && <View style={styles.explanationBox}><Sparkles size={12} color="#D97706" style={{marginTop: 2}} /><Text style={styles.explanationText}>{assistantExplanation}</Text></View>}
                </View>
            )}

            <View style={styles.filterBar}>
                {/* ScrollView Horizontal de volta, mas com estilos dinâmicos para apertar os itens em telas pequenas */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={{
                        paddingHorizontal: isCompact ? 8 : 12, 
                        paddingVertical: 8, 
                        gap: chipGap 
                    }}
                >
                    {/* BOTÃO VENCIMENTO (Abreviado em telas < 420px) */}
                    <TouchableOpacity 
                        style={[styles.filterChip, selectedVencimento ? styles.activeFilter : null, {paddingHorizontal: chipPaddingH, paddingVertical: chipPaddingV}]} 
                        onPress={(e) => { 
                            if(showVencimentoSelector) { closeAllSelectors(); } 
                            else { closeAllSelectors(); setVencimentoButtonPos({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }); setShowVencimentoSelector(true); } 
                        }}
                    >
                        <Calendar size={iconSize} color={selectedVencimento ? "#fff" : "#475569"} />
                        <Text style={[styles.filterText, selectedVencimento ? {color: '#fff'} : null, {fontSize: chipFontSize}]}>
                            {selectedVencimento ? `Dia ${selectedVencimento}` : (isCompact ? 'Venc.' : 'Vencimento')}
                        </Text>
                    </TouchableOpacity>

                    {/* BOTÃO CRÉDITO */}
                    <TouchableOpacity 
                        style={[styles.filterChip, selectedCredit ? styles.activeFilter : null, {paddingHorizontal: chipPaddingH, paddingVertical: chipPaddingV}]} 
                        onPress={(e) => { 
                            if(showCreditSelector) { closeAllSelectors(); } 
                            else { closeAllSelectors(); setCreditButtonPos({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }); setShowCreditSelector(true); } 
                        }}
                    >
                        <DollarSign size={iconSize} color={selectedCredit ? "#fff" : "#475569"} />
                        <Text style={[styles.filterText, selectedCredit ? {color: '#fff'} : null, {fontSize: chipFontSize}]}>
                            {selectedCredit ? formatCurrency(selectedCredit) : 'Crédito'}
                        </Text>
                    </TouchableOpacity>

                    {/* DIVISOR REMOVIDO PARA ECONOMIZAR ESPAÇO */}
                    
                    {/* BOTÃO IMÓVEL */}
                    <TouchableOpacity 
                        style={[styles.filterChip, selectedSpecies === 'IMV' ? {backgroundColor: '#059669', borderColor: '#059669'} : null, {paddingHorizontal: chipPaddingH, paddingVertical: chipPaddingV}]} 
                        onPress={() => toggleSpecies('IMV')}
                    >
                        <Text style={[styles.filterText, selectedSpecies === 'IMV' ? {color: '#fff'} : null, {fontSize: chipFontSize}]}>IMÓVEL</Text>
                    </TouchableOpacity>

                    {/* BOTÃO AUTO */}
                    <TouchableOpacity 
                        style={[styles.filterChip, selectedSpecies === 'AUT' ? {backgroundColor: '#2563EB', borderColor: '#2563EB'} : null, {paddingHorizontal: chipPaddingH, paddingVertical: chipPaddingV}]} 
                        onPress={() => toggleSpecies('AUT')}
                    >
                        <Text style={[styles.filterText, selectedSpecies === 'AUT' ? {color: '#fff'} : null, {fontSize: chipFontSize}]}>AUTO</Text>
                    </TouchableOpacity>

                    {/* BOTÃO MOTO */}
                    <TouchableOpacity 
                        style={[styles.filterChip, selectedSpecies === 'MOT' ? {backgroundColor: '#D97706', borderColor: '#D97706'} : null, {paddingHorizontal: chipPaddingH, paddingVertical: chipPaddingV}]} 
                        onPress={() => toggleSpecies('MOT')}
                    >
                        <Text style={[styles.filterText, selectedSpecies === 'MOT' ? {color: '#fff'} : null, {fontSize: chipFontSize}]}>MOTO</Text>
                    </TouchableOpacity>

                    {/* BOTÃO LIMPAR */}
                    {(selectedVencimento || selectedCredit || selectedSpecies || isPotentialFilterActive || chatResults) && (
                        <TouchableOpacity 
                            style={[styles.filterChip, {borderColor: '#FECACA', backgroundColor: '#FEF2F2', paddingHorizontal: chipPaddingH, paddingVertical: chipPaddingV}]} 
                            onPress={clearAllFilters}
                        >
                            <Trash2 size={iconSize} color="#DC2626" />
                            <Text style={[styles.filterText, {color: '#DC2626', fontSize: chipFontSize}]}>LIMPAR</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
                {(showVencimentoSelector || showCreditSelector) && (<TouchableWithoutFeedback onPress={closeAllSelectors}><View style={styles.dropdownOverlay} /></TouchableWithoutFeedback>)}
                {showVencimentoSelector && (<View style={[styles.vencimentoDrawer, { left: 16, top: 45 }]}><TouchableOpacity style={styles.drawerItem} onPress={() => {setSelectedVencimento(10); setShowVencimentoSelector(false);}}><Text style={[styles.drawerText, selectedVencimento === 10 && styles.activeDrawerText]}>Dia 10</Text>{selectedVencimento === 10 && <Check size={14} color="#2563EB" />}</TouchableOpacity><TouchableOpacity style={styles.drawerItem} onPress={() => {setSelectedVencimento(20); setShowVencimentoSelector(false);}}><Text style={[styles.drawerText, selectedVencimento === 20 && styles.activeDrawerText]}>Dia 20</Text>{selectedVencimento === 20 && <Check size={14} color="#2563EB" />}</TouchableOpacity><TouchableOpacity style={[styles.drawerItem, {borderTopWidth: 1, borderColor: '#F1F5F9'}]} onPress={() => {setSelectedVencimento(null); setShowVencimentoSelector(false);}}><Text style={{fontSize: 11, color: '#DC2626'}}>Limpar</Text></TouchableOpacity></View>)}
                {showCreditSelector && (<View style={[styles.creditDropdown, { left: 60, top: 45 }]}><ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{padding: 4}}><TouchableOpacity style={styles.drawerItem} onPress={() => {setSelectedCredit(null); setShowCreditSelector(false);}}><Text style={{fontSize: 11, color: '#DC2626'}}>Qualquer Valor</Text></TouchableOpacity>{CREDIT_VALUES.map((val) => (<TouchableOpacity key={val} style={[styles.drawerItem, selectedCredit === val && {backgroundColor: '#EFF6FF'}]} onPress={() => {setSelectedCredit(val); setShowCreditSelector(false);}}><Text style={[styles.drawerText, selectedCredit === val && styles.activeDrawerText]}>{formatCurrency(val)}</Text>{selectedCredit === val && <Check size={14} color="#2563EB" />}</TouchableOpacity>))}</ScrollView></View>)}
            </View>

            {isFetchingReport && !mainData ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /><Text style={{marginTop: 10, color: '#64748B'}}>Buscando grupos...</Text></View>
            ) : (
                <FlatList
    // --- CORREÇÃO 2: FORÇAR RE-RENDER DO LAYOUT ---
    // Mudamos a 'key' dinamicamente. Se tem mensagem de chat, a key é 'SEARCH_MODE'.
    // Se não tem, é 'LIST_MODE'. Isso obriga o React a redesenhar a lista do zero
    // quando você limpa o filtro, eliminando o espaço em branco bugado.
    key={chatMessage.length > 0 ? 'SEARCH_MODE' : 'LIST_MODE'}
    
    data={filteredGroups}
    keyExtractor={(item) => item.Grupo.toString()}
    renderItem={renderGroupItem}
    contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
    refreshControl={<RefreshControl refreshing={isFetchingReport} onRefresh={fetchReportData} />}
    
    // Melhora a performance e evita buracos brancos em listas longas
    removeClippedSubviews={false} 
    initialNumToRender={20}

    ListEmptyComponent={
        <View style={styles.emptyList}>
            <Filter size={40} color="#CBD5E1" />
            <Text style={{color: '#94A3B8', marginTop: 10, textAlign: 'center'}}>
                {/* Texto dinâmico para dar feedback correto ao usuário */}
                {chatMessage.length > 0 
                    ? "A IA não encontrou grupos compatíveis com sua solicitação exata." 
                    : "Nenhum grupo encontrado com os filtros manuais selecionados."}
            </Text>
            <TouchableOpacity onPress={clearAllFilters} style={{marginTop: 10}}>
                <Text style={{color: '#2563EB', fontWeight: 'bold'}}>Limpar Filtros</Text>
            </TouchableOpacity>
        </View>
    }
    ItemSeparatorComponent={() => <View style={{height: 12}} />}
    showsVerticalScrollIndicator={false}
/>
            )}
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={statsModalVisible} onRequestClose={() => setStatsModalVisible(false)}>
          <View style={styles.statsModalOverlay}>
              <TouchableWithoutFeedback onPress={() => setStatsModalVisible(false)}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
              <View style={[styles.statsModalContent, isDesktop ? {width: 500} : {width: '92%'}]}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>ESTATÍSTICAS DO GRUPO</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                          <TouchableOpacity 
                              style={[styles.closeBtn, {backgroundColor: showPrediction ? '#F5F3FF' : '#F8FAFC', borderColor: showPrediction ? '#7C3AED' : '#E2E8F0', borderWidth: 1}]} 
                              onPress={() => setShowPrediction(!showPrediction)}
                          >
                              {showPrediction ? <Eye size={20} color="#7C3AED" /> : <BrainCircuit size={20} color="#94A3B8" />}
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setStatsModalVisible(false)} style={styles.closeBtn}><X size={24} color="#64748B" /></TouchableOpacity>
                      </View>
                  </View>
                  {renderStatsContent()}
              </View>
          </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  navBtn: { height: 40, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingVertical: 4 },
  navBtnText: { fontSize: 11, fontWeight: '700', color: '#D97706', marginLeft: 6, flexShrink: 1, textAlign: 'center' },
  scrollContent: { paddingTop: 12, paddingBottom: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 4, marginTop: 35 },
  logo: { width: 200, height: 100 },
  pageTitleContainer: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '400', color: '#0F172A', lineHeight: 30 },
  titleHighlight: { fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#64748B', lineHeight: 20, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, shadowColor: '#64748B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12, minHeight: 160 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  iconContainer: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  countBadge: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1 },
  countText: { fontSize: 10, fontWeight: 'bold' },
  cardContent: { marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  cardDesc: { fontSize: 11, color: '#64748B', lineHeight: 15 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 4 },
  actionText: { fontSize: 12, fontWeight: '700' },
  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  emptyText: { fontSize: 18, color: '#0F172A', fontWeight: 'bold' },
  footerContainer: { marginTop: 20, alignItems: 'center' },
  footerVersion: { textAlign: 'center', fontSize: 11, color: '#94A3B8', marginBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { 
      backgroundColor: '#FFFFFF', 
      borderRadius: 24, 
      
      // Sombra Externa (Levanta o modal do fundo escuro)
      shadowColor: "#000", 
      shadowOffset: { width: 0, height: 12 }, 
      shadowOpacity: 0.35, 
      shadowRadius: 22, 
      elevation: 30, 
      
      // Isso garante que a sombra interna respeite as curvas
      overflow: 'hidden', 

      // MOLDURA 3D SÓLIDA
      borderWidth: 6, 
      borderColor: '#FFFFFF' // Moldura branca física
  },

  // --- NOVO ESTILO: CAMADA DE SOMBRA INTERNA ---
  innerShadowOverlay: {
      ...StyleSheet.absoluteFillObject, // Cobre 100% do modalContent
      zIndex: 100, // Garante que fique POR CIMA do Header e da Lista
      borderRadius: 18, // Levemente menor que o pai para encaixar na borda
      
      ...Platform.select({
        web: {
           // A sombra inset agora está numa camada acima de tudo
           boxShadow: 'inset 0px 0px 16px rgba(0,0,0,0.25)' 
        },
        default: {
           // No Android/iOS não temos inset shadow fácil. 
           // Usamos uma borda interna transparente semi-visível para dar profundidade
           borderWidth: 2,
           borderColor: 'rgba(0,0,0,0.15)'
        }
      })
  },
  reportBtn: {
    backgroundColor: '#ebf4ffff', // Fundo claro (Amber 50)
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#091a5fff', // Borda destaque
    shadowColor: '#091a5fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 160
  },
  reportBtnIconBox: {
    backgroundColor: '#091a5fff', // Fundo do ícone escuro
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  reportBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#091a5fff', // Texto escuro para contraste
    flexShrink: 1
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#fff' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#091a5fff' },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  closeBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyList: { alignItems: 'center', marginTop: 40 },
  statsModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
  statsModalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, maxHeight: '80%', paddingBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 25, overflow: 'hidden' },
  statsHeaderContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', marginBottom: 12, position: 'relative' },
  headerCenterColumn: { alignItems: 'center', marginTop: 10, width: '100%' },
  headerTagsAbsolute: { position: 'absolute', right: 0, top: 0, alignItems: 'flex-end', gap: 6 },
  bigGroupBadge: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: {width: 0, height: 4}, shadowRadius: 8, elevation: 5 },
  bigGroupBadgeText: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  pillTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  pillTagText: { fontSize: 10, color: '#475569', fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  sectionHeaderLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  sectionHeaderText: { marginHorizontal: 12, fontSize: 12, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  dataListContainer: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  dataListRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dataListLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  dataListLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  dataListValue: { fontSize: 12, color: '#0F172A', fontWeight: '700' },
  totalContempladosCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#DBEAFE' },
  totalContempladosLabel: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  totalContempladosValue: { fontSize: 24, fontWeight: '900', color: '#1E40AF' },
  flowChartContainer: { marginBottom: 16 },
  flowTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' },
  flowTree: { marginLeft: 0, paddingLeft: 0, flex: 1 },
  flowVerticalLine: { position: 'absolute', left: 0, top: 0, bottom: 20, width: 2, backgroundColor: '#E2E8F0' },
  flowBranch: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  flowConnector: { width: 16, height: 24, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#E2E8F0', borderBottomLeftRadius: 0, marginRight: 8, marginTop: -24 },
  flowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  flowValueBox: { backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 50, alignItems: 'center' },
  flowValueText: { color: '#047857', fontWeight: '800', fontSize: 14 },
  flowLabelText: { fontSize: 13, color: '#334155', fontWeight: '600' },
  dateMiniCard: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 16, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 100 },
  dateMiniLabel: { fontSize: 9, color: '#64748B', textAlign: 'center', marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' },
  dateMiniValue: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  statRow: { flexDirection: 'row', gap: 16 },
  statCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#64748B', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginVertical: 2 },
  statLabel: { fontSize: 9, color: '#64748B', textTransform: 'uppercase', fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },
  warningBox: { marginTop: 16, flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderRadius: 12, borderWidth: 1, width: '100%' },
  warningText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18, textAlign: 'justify' },
  filterBar: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', zIndex: 50 },
  filterChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', gap: 4 },
  activeFilter: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  verticalDivider: { width: 1, height: 20, backgroundColor: '#E2E8F0', marginHorizontal: 4 },
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -1000, backgroundColor: 'transparent', zIndex: 40 },
  vencimentoDrawer: { position: 'absolute', backgroundColor: '#fff', borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 15, borderWidth: 1, borderColor: '#E2E8F0', width: 120, zIndex: 60 },
  creditDropdown: { position: 'absolute', backgroundColor: '#fff', borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 15, borderWidth: 1, borderColor: '#E2E8F0', width: 150, maxHeight: 250, zIndex: 60 },
  drawerItem: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drawerText: { fontSize: 13, color: '#334155' },
  activeDrawerText: { fontWeight: 'bold', color: '#2563EB' },
  groupCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  groupBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 55 },
  groupBadgeText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  speciesText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  newGroupBadge: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginTop: 2, alignSelf: 'flex-start', gap: 2 },
  newGroupText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  planBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginTop: 2, alignSelf: 'flex-start', gap: 2 },
  planText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  pulsatingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-end' },
  pulsatingText: { fontSize: 10, color: '#DC2626', fontWeight: '600' },
  miniPotentialTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, gap: 4, borderWidth: 1 },
  miniPotentialText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  compactCreditContainer: { alignItems: 'center', paddingVertical: 8, marginBottom: 8, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  compactCreditLabel: { fontSize: 9, color: '#64748B', textTransform: 'uppercase', fontWeight: '600', marginBottom: 2 },
  compactCreditValue: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  glassDetailsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(241, 245, 249, 0.6)', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10, marginBottom: 12 },
  glassDetailItem: { alignItems: 'center', flex: 1 },
  glassLabel: { fontSize: 10, color: '#64748B', marginBottom: 2 },
  glassValue: { fontSize: 11, fontWeight: '700', color: '#334155' },
  glassSeparator: { width: 1, height: '80%', backgroundColor: '#CBD5E1' },
  cardFooterInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerInfoText: { fontSize: 11, color: '#475569', fontWeight: '500' },
  lanceFixoTag: { backgroundColor: '#3B82F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, shadowColor: "#3B82F6", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
  lanceFixoText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  ageBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ageText: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  chartContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', width: '100%' },
  chartTitle: { fontSize: 12, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' },
  headerFilterBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FEF3C7', borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B' },
  activeHeaderFilter: { backgroundColor: '#D97706', borderColor: '#D97706' },
  statsAnalysisCard: { marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center', width: '100%', maxWidth: 300, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  analysisCardDetails: { fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  analysisCardTitle: { fontSize: 14, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
  absoluteLightBadge: { position: 'absolute', top: 0, left: 0, backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 6, borderBottomRightRadius: 16, borderTopLeftRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 10 },
  absoluteLightText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  assistantContainer: { paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#F1F5F9' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  assistantInput: { flex: 1, height: 44, paddingHorizontal: 12, color: '#0F172A', fontSize: 14 },
  sendIconBtn: { padding: 10, backgroundColor: '#2563EB', borderRadius: 10, margin: 4 },
  thinkingText: { fontSize: 11, color: '#64748B', marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  smartMatchBox: { backgroundColor: '#F0FDF4', padding: 8, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#BBF7D0' },
  explanationBox: { marginTop: 8, flexDirection: 'row', gap: 6, padding: 8, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FEF3C7' },
  explanationText: { fontSize: 11, color: '#B45309', flex: 1, lineHeight: 16 },
  pulsatingBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: "#2563EB", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  repositionedTagsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: -8 },
  disclaimerText: { fontSize: 10, color: '#64748B', fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  forecastMsgText: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', fontStyle: 'italic', lineHeight: 15 },
  // ESTILOS DO NEWS TICKER - REDESIGN RETANGULAR TIPO JORNAL
 tickerWrapper: {
    width: '100%',
    height: 28, // Altura reduzida e elegante
    backgroundColor: '#091a5fff', // Fundo escuro (Slate 900)
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    // Removemos bordas arredondadas e margin lateral para parecer uma faixa de TV
    // Se quiser arredondado, descomente abaixo:
    // marginHorizontal: 16,
    // borderRadius: 4,
    // width: 'auto',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tickerLabelContainer: {
    backgroundColor: '#017a4f', // Vermelho "Breaking News"
    height: '100%',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10, // Garante que fique acima do texto
  },
  tickerLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tickerTriangle: {
    // Cria um efeito visual de seta na etiqueta (opcional)
    position: 'absolute',
    right: -8,
    top: 0,
    width: 0, 
    height: 0, 
    borderTopWidth: 28, // Mesma altura do container
    borderTopColor: '#017a4f',
    borderRightWidth: 10,
    borderRightColor: 'transparent',
  },
  tickerContainer: {
    flex: 1,
    height: '100%',
    overflow: 'hidden', // Corta o texto que sai da área
    justifyContent: 'center',
    paddingLeft: 12, // Espaço após a seta vermelha
  },
  tickerText: {
    color: '#F8FAFC', // Texto quase branco para contraste
    fontSize: 11, // Fonte menor e mais nítida
    fontWeight: '600',
    letterSpacing: 0.2,
    // No Android, includeFontPadding false ajuda a centralizar verticalmente fontes pequenas
    includeFontPadding: false, 
    textAlignVertical: 'center'
  },
  separator: {
    color: '#94A3B8', // Cinza azulado para o separador
    fontSize: 10,
    fontWeight: 'bold',
  }
});