import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, 
  Modal, KeyboardAvoidingView, Platform, StatusBar,
  SafeAreaView, useWindowDimensions, ActivityIndicator
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { 
  ArrowLeft, Lock, PieChart, ChevronDown, X, Clock, Wand2, ChevronRight, 
  AlertTriangle, Settings2, Wallet, Car, PlusCircle, Trash2, Scale, ArrowDownToLine, Check, Info
} from 'lucide-react-native';

import { RootStackParamList } from '../types/navigation';
// IMPORTANTE: DataService para carregar tabela pelo ID
import { DataService } from '../services/DataService';
import { getTableData, TableMetadata } from '../../data/TableRepository';
import { ConsortiumCalculator, SimulationInput, InstallmentType } from '../utils/ConsortiumCalculator';
import { SimulationStorage } from '../services/SimulationStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'SimulationForm'>;

const ADESAO_OPTIONS = [
  { label: 'Isento', value: 0 },
  { label: '0.5%', value: 0.005 },
  { label: '1%', value: 0.01 },
  { label: '2%', value: 0.02 },
];

const MAX_CREDITS = 50;
const LIMIT_LANCE_EMBUTIDO = 0.25;
const LIMIT_TOTAL_LANCE = 0.99; // Limite de 99% para a soma total dos lances
const GROUPS_DATA_URL = "https://nhnejoanmggvinnfphir.supabase.co/storage/v1/object/public/consorciorecon-json/relacao_grupos.json";

// --- HELPERS ---
const formatCurrencyInput = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const numberValue = Number(cleanValue) / 100;
    return numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const parseCurrencyToFloat = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    return Number(cleanValue) / 100;
};

export default function SimulationFormScreen({ route, navigation }: Props) {
  // CORREÇÃO 1: Recebemos apenas o ID, não o objeto table inteiro
  const { tableId } = route.params;

  // CORREÇÃO 2: Estados para carregar a tabela
  const [table, setTable] = useState<TableMetadata | null>(null);
  const [isLoadingTable, setIsLoadingTable] = useState(true);

  const scrollViewRef = useRef<ScrollView>(null);

  // --- RESPONSIVIDADE ---
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  // Verifica se está em modo Retrato (Altura maior que largura)
  const isPortrait = windowHeight > windowWidth;
  
  // Lógica solicitada: Em desktop PAISAGEM (move para header), caso contrário (Mobile ou Retrato) fica embaixo
  const shouldMoveToHeader = isDesktop && !isPortrait;

  const MAX_WIDTH = 960;
  const contentWidth = Math.min(windowWidth, MAX_WIDTH);
  const paddingHorizontal = isDesktop ? 40 : 24;

  // --- STATES DO FORMULÁRIO ---
  const [credits, setCredits] = useState<string[]>(['']);
  const [prazoIdx, setPrazoIdx] = useState<number | null>(null);
  const [tipoParcela, setTipoParcela] = useState<InstallmentType>('S/SV');
  const [adesaoPct, setAdesaoPct] = useState(0);

  const [showLanceModal, setShowLanceModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number>(0); 
    
  const [lanceEmbInput, setLanceEmbInput] = useState(''); 
  const [lanceBolso, setLanceBolso] = useState('');        
  const [lanceCartaInput, setLanceCartaInput] = useState(''); 
    
  const [pctParaParcelaInput, setPctParaParcelaInput] = useState('0'); 
  const [pctParaPrazoInput, setPctParaPrazoInput] = useState('100'); 
    
  const percentualLanceParaParcela = parseFloat(pctParaParcelaInput) || 0;
  const percentualLanceParaPrazo = parseFloat(pctParaPrazoInput) || 0;

  const [groupsData, setGroupsData] = useState<any[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '' });

  // --- CORREÇÃO 3: Efeito para carregar dados da tabela pelo ID ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const appData = await DataService.initialize();
        const foundTable = appData.tables.find(t => t.id === tableId);
        
        if (foundTable) {
            setTable(foundTable);
        } else {
            // Se não achar (URL inválida), volta pra home
            navigation.navigate('Home');
        }
      } catch (error) {
        console.error("Erro ao carregar tabela:", error);
      } finally {
        setIsLoadingTable(false);
      }
    };
    loadData();
  }, [tableId]);

  // Carrega rawData apenas quando 'table' estiver disponível
  const rawData = useMemo(() => {
      if (!table) return [];
      return getTableData(table.id);
  }, [table]);

  const showAlert = (title: string, message: string) => {
    setCustomAlert({ visible: true, title, message });
  };

  const closeAlert = () => {
    setCustomAlert({ ...customAlert, visible: false });
  };

  // --- FETCH DE GRUPOS ---
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const url = `${GROUPS_DATA_URL}?t=${new Date().getTime()}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setGroupsData(data);
        }
      } catch (error) {
        console.error("Erro ao buscar grupos:", error);
      } finally {
        setIsLoadingGroups(false);
      }
    };
    fetchGroups();
  }, []);

  // --- SMART BACK: Lida com F5 ---
  const handleBack = () => {
      if (navigation.canGoBack()) {
          navigation.goBack();
      } else {
          // Se perdeu o histórico, volta para a seleção da categoria correta
          if (table) {
              navigation.navigate('TableSelection', { category: table.category });
          } else {
              navigation.navigate('Home');
          }
      }
  };

  // --- LÓGICA DE FILTRO DE GRUPOS ---
  const getCompatibleGroups = (creditValue: number) => {
    if (prazoIdx === null || isLoadingGroups || groupsData.length === 0 || !table) return [];
      
    const selectedPrazoData = availablePrazos[prazoIdx];
    if (!selectedPrazoData) return [];
    const prazoSelecionado = selectedPrazoData.prazo;

    const categoryMap: Record<string, string> = {
      'AUTO': 'VEÍCULO',
      'MOTO': 'VEÍCULO',
      'IMOVEL': 'IMÓVEL',
      'SERVICOS': 'SERVIÇO'
    };
    const targetType = categoryMap[table.category];

    // Obtém o plano da tabela atual (ex: NORMAL, LIGHT, SUPERLIGHT)
    const tablePlan = table.plan || 'NORMAL';

    return groupsData.filter((group: any) => {
          // 1. Filtro de Tipo (Categoria)
          if (group.TIPO !== targetType) return false;
          
          // 2. Filtro de Prazo Máximo do Grupo
          if (prazoSelecionado > group["Prazo Máximo"]) return false;

          // 3. Lógica de Compatibilidade de Planos (Solicitada)
          // Se a tabela for NORMAL, não filtra (mostra todos os grupos).
          // Se for LIGHT ou SUPERLIGHT, filtra conforme as regras.
          if (tablePlan !== 'NORMAL') {
              const groupPlan = group["PLANO"] ? group["PLANO"].toUpperCase() : "NORMAL";

              // Se o grupo é "NORMAL", ele só aceita tabelas NORMAL.
              // Como a tabela atual NÃO é NORMAL (é LIGHT ou SUPERLIGHT), descartamos este grupo.
              if (groupPlan === 'NORMAL') return false;

              // Se a tabela atual é SUPERLIGHT
              if (tablePlan === 'SUPERLIGHT') {
                  // O grupo deve aceitar explicitamente SUPERLIGHT.
                  // (Se for apenas "LIGHT", rejeita. Se for "LIGHT E SUPERLIGHT", aceita).
                  if (!groupPlan.includes('SUPERLIGHT')) return false;
              }
              
              // Se a tabela atual for LIGHT:
              // Grupos "LIGHT" aceitam. Grupos "LIGHT E SUPERLIGHT" também aceitam.
              // O grupo "NORMAL" já foi filtrado acima.
              // Portanto, nenhuma lógica adicional necessária aqui.
          }

          // 4. Filtro de Faixa de Crédito
          const rangeString = group["Créditos Disponíveis"];
          if (!rangeString) return false;

          const rangeParts = rangeString.replace(/\./g, '').split(' até ');
          if (rangeParts.length !== 2) return false;
          
          const minCredit = parseFloat(rangeParts[0]);
          const maxCredit = parseFloat(rangeParts[1]);

          if (creditValue < minCredit || creditValue > maxCredit) return false;

          // 5. Exceções Hardcoded
          const groupName = String(group.Grupo);
          if (groupName === '2011') {
             if (prazoSelecionado <= 200 || creditValue < 200000) return false;
          }
          if (groupName === '5121') {
              if (prazoSelecionado <= 100 || creditValue < 80000) return false;
          }

          return true;
    }).map((g: any) => g.Grupo);
  };

  // --- HELPERS E CÁLCULOS ---
  const availableCredits = useMemo(() => rawData.map(r => r.credito).sort((a,b) => a-b), [rawData]);
    
  const mainRow = useMemo(() => {
    if (!credits[0]) return null;
    const val = parseFloat(credits[0]);
    return rawData.find(r => r.credito === val) || null;
  }, [credits, rawData]);

  const availablePrazos = useMemo(() => {
    const validValues = credits.map(c => parseFloat(c)).filter(v => v > 0);
    if (validValues.length === 0) return [];

    const rows = validValues.map(v => rawData.find(r => r.credito === v)).filter(r => !!r);
    if (rows.length === 0) return [];

    const basePrazos = rows[0]!.prazos;
    const commonPrazos = basePrazos.filter((pBase: any) => {
        const prazoNum = pBase.prazo;
        return rows.every(r => r!.prazos.some((p: any) => p.prazo === prazoNum));
    });

    return commonPrazos;
  }, [credits, rawData]);

  // CORREÇÃO: Lógica de Seguro Obrigatório
  const isSeguroObrigatorio = useMemo(() => {
    if (!table) return false;

    // EXCEÇÃO PRIORITÁRIA: Se o ID da tabela contiver "5121", NUNCA é obrigatório.
    // Isso sobrepõe qualquer regra de categoria ou plano.
    if (String(table.id).includes('5121')) {
        return false;
    }

    // REGRA GERAL: AUTO + (LIGHT ou SUPERLIGHT) = Obrigatório
    if (table.category === 'AUTO' && (table.plan === 'LIGHT' || table.plan === 'SUPERLIGHT')) {
        return true;
    }

    // Fallback: Se não tem opção de parcelas (CSV/SSV), então é fixo (geralmente obrigatório)
    if (availablePrazos.length > 0) {
      const sample = availablePrazos[0] as any;
      // Se a estrutura de dados só tiver 'parcela' e não 'parcela_SSV',
      // significa que não há opção sem seguro na fonte de dados.
      return sample.parcela !== undefined;
    }
    return false;
  }, [availablePrazos, table]);

  const totalCreditoSimulacao = useMemo(() => {
      return credits.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  }, [credits]);

  const currentParcelaValue = useMemo(() => {
     if (!mainRow || prazoIdx === null) return 0;
     const targetPrazoData = availablePrazos[prazoIdx];
     if (!targetPrazoData) return 0;

     const targetPrazo = targetPrazoData.prazo;
     let totalParcela = 0;

     credits.forEach((creditValStr) => {
         const val = parseFloat(creditValStr);
         if (!val) return;
         const row = rawData.find(r => r.credito === val);
         if (row) {
             const pData = row.prazos.find((p: any) => p.prazo === targetPrazo);
             if (pData) {
                 if (pData.parcela) totalParcela += pData.parcela;
                 else totalParcela += (tipoParcela === 'C/SV' ? pData.parcela_CSV : pData.parcela_SSV);
             }
         }
     });
     return totalParcela;
  }, [credits, rawData, prazoIdx, tipoParcela, availablePrazos, mainRow]);

  useEffect(() => {
    if (isSeguroObrigatorio) setTipoParcela('C/SV');
  }, [isSeguroObrigatorio]);

  useEffect(() => {
    if (!mainRow) setPrazoIdx(null); 
  }, [credits[0]]);

  useEffect(() => {
    if (prazoIdx !== null && prazoIdx >= availablePrazos.length) {
        setPrazoIdx(null);
    }
  }, [availablePrazos, prazoIdx]);

  const handleCurrencyChange = (text: string, setter: (val: string) => void) => {
      setter(formatCurrencyInput(text));
  };
    
  const maxLancePermitido = totalCreditoSimulacao * LIMIT_LANCE_EMBUTIDO;
    
  const handleChangeLanceEmbutido = (text: string) => {
    const numericValue = parseCurrencyToFloat(text);
    if (numericValue > maxLancePermitido) {
      setLanceEmbInput(formatCurrencyInput(maxLancePermitido.toFixed(2).replace('.', '')));
      showAlert("Limite Atingido", `O lance embutido máximo é de ${(LIMIT_LANCE_EMBUTIDO * 100).toFixed(0)}% do total.`);
    } else {
      setLanceEmbInput(formatCurrencyInput(text));
    }
  };

  const handleQuickLanceSelect = (pct: number) => {
    if (totalCreditoSimulacao <= 0) return;
    const val = totalCreditoSimulacao * pct;
    const valString = (val * 100).toFixed(0); 
      
    if (pct <= LIMIT_LANCE_EMBUTIDO) {
        setLanceEmbInput(formatCurrencyInput(valString));
    } else {
        const maxString = (maxLancePermitido * 100).toFixed(0);
        setLanceEmbInput(formatCurrencyInput(maxString));
    }
  };

  const handlePercentualChange = (text: string, type: 'parcela' | 'prazo') => {
    let cleanText = text.replace(/[^0-9.]/g, '');
    if ((cleanText.match(/\./g) || []).length > 1) return;

    if (cleanText === '') {
        if (type === 'parcela') {
            setPctParaParcelaInput('');
            setPctParaPrazoInput('100');
        } else {
            setPctParaPrazoInput('');
            setPctParaParcelaInput('100');
        }
        return;
    }

    const val = parseFloat(cleanText);
    if (val > 100) cleanText = '100'; 

    const numVal = parseFloat(cleanText) || 0;
    const complementVal = Math.max(0, 100 - numVal);
    const complementStr = Number.isInteger(complementVal) 
        ? complementVal.toString() 
        : complementVal.toFixed(2).replace(/\.?0+$/, '');

    if (type === 'parcela') {
        setPctParaParcelaInput(cleanText);
        setPctParaPrazoInput(complementStr);
    } else {
        setPctParaPrazoInput(cleanText);
        setPctParaParcelaInput(complementStr);
    }
  };

  const valLanceEmb = parseCurrencyToFloat(lanceEmbInput);
  const valLanceBolso = parseCurrencyToFloat(lanceBolso);
  const valLanceCarta = parseCurrencyToFloat(lanceCartaInput);
    
  // --- LÓGICA DE VALIDAÇÃO DE LANCE TOTAL (99%) ---
  const maxTotalLancePermitido = totalCreditoSimulacao * LIMIT_TOTAL_LANCE;

  const handleChangeLanceBolso = (text: string) => {
    const numericValue = parseCurrencyToFloat(text);
    // Calcula quanto seria o total com esse novo valor de bolso
    const currentOtherLances = valLanceEmb + valLanceCarta;
    const potentialTotal = currentOtherLances + numericValue;

    if (potentialTotal > maxTotalLancePermitido) {
        // Se passar, define o valor máximo possível para este campo
        const maxAllowedForField = Math.max(0, maxTotalLancePermitido - currentOtherLances);
        setLanceBolso(formatCurrencyInput(maxAllowedForField.toFixed(2).replace('.', '')));
        showAlert("Limite Atingido", `A soma total dos lances não pode ultrapassar ${(LIMIT_TOTAL_LANCE * 100).toFixed(0)}% do crédito selecionado.`);
    } else {
        setLanceBolso(formatCurrencyInput(text));
    }
  };

  const handleChangeLanceCarta = (text: string) => {
    const numericValue = parseCurrencyToFloat(text);
    // Calcula quanto seria o total com esse novo valor de carta
    const currentOtherLances = valLanceEmb + valLanceBolso;
    const potentialTotal = currentOtherLances + numericValue;

    if (potentialTotal > maxTotalLancePermitido) {
        // Se passar, define o valor máximo possível para este campo
        const maxAllowedForField = Math.max(0, maxTotalLancePermitido - currentOtherLances);
        setLanceCartaInput(formatCurrencyInput(maxAllowedForField.toFixed(2).replace('.', '')));
        showAlert("Limite Atingido", `A soma total dos lances não pode ultrapassar ${(LIMIT_TOTAL_LANCE * 100).toFixed(0)}% do crédito selecionado.`);
    } else {
        setLanceCartaInput(formatCurrencyInput(text));
    }
  };

  const totalLances = valLanceEmb + valLanceBolso + valLanceCarta;
  const totalLancePct = totalCreditoSimulacao > 0 ? (totalLances / totalCreditoSimulacao) * 100 : 0;
  const isLanceTotalInvalid = totalLancePct >= 100;

  const handleSaveLance = () => {
    if (isLanceTotalInvalid) {
        showAlert("Atenção", "Você não poderá salvar lances igual ou superior a 100% do valor do crédito.");
        return;
    }
    setShowLanceModal(false);
  };

  const limitInfo = useMemo(() => {
    if (!currentParcelaValue || prazoIdx === null || totalLances === 0 || !table) {
        return { isValid: true, message: '', maxPermittedPct: 100, isExceeding40PercentRule: false };
    }
    const prazoTotal = availablePrazos[prazoIdx]?.prazo;
    if (!prazoTotal) return { isValid: false, message: '', maxPermittedPct: 0, isExceeding40PercentRule: false };

    const rawMes = 1;
    const mesPrevisto = Math.min(prazoTotal, Math.max(1, rawMes));
    const prazoRestante = Math.max(1, prazoTotal - mesPrevisto); 
      
    let fatorPlano = 1.0;
    if (table.plan === 'LIGHT') fatorPlano = 0.75;
    if (table.plan === 'SUPERLIGHT') fatorPlano = 0.50;

    const parcelaBaseParaLimite = currentParcelaValue / fatorPlano;
    const maxReductionValuePerMonth = parcelaBaseParaLimite * 0.40; 
    const totalReductionCapacity = maxReductionValuePerMonth * prazoRestante; 
      
    let pctToHit40Rule = (totalReductionCapacity / totalLances) * 100;
    pctToHit40Rule = Math.min(100, pctToHit40Rule); 
      
    const userTypedPct = percentualLanceParaParcela;
    const isExceeding40PercentRule = userTypedPct > pctToHit40Rule;

    return { 
        isValid: true, 
        message: '', 
        maxPermittedPct: Math.floor(pctToHit40Rule),
        isExceeding40PercentRule: isExceeding40PercentRule
    };
  }, [percentualLanceParaParcela, totalLances, currentParcelaValue, prazoIdx, availablePrazos, table]);

  const handleSetMaxPct = () => {
    if (totalLances === 0 || prazoIdx === null) {
        showAlert("Atenção", "Preencha o crédito, prazo e lances.");
        return;
    }
    const maxPct = limitInfo.maxPermittedPct;
    setPctParaParcelaInput(maxPct.toString());
    setPctParaPrazoInput((100 - maxPct).toString());
  };

  const handleDistributeHalf = () => {
      if (totalLances === 0) return;
      setPctParaParcelaInput('50');
      setPctParaPrazoInput('50');
  };

  const handleOpenCreditModal = (index: number) => {
      setEditingIndex(index);
      setShowCreditModal(true);
  }

  const handleSelectCredit = (value: number) => {
    const newCredits = [...credits];
    newCredits[editingIndex] = value.toString();
    setCredits(newCredits);
    setShowCreditModal(false);
  };

  const handleAddCredit = () => {
      if (credits.length >= MAX_CREDITS) {
          showAlert("Limite Atingido", `Máximo de ${MAX_CREDITS} créditos permitidos.`);
          return;
      }
      setCredits([...credits, '']);
      setTimeout(() => handleOpenCreditModal(credits.length), 200);
  };

  const handleRemoveCredit = (indexToRemove: number) => {
      if (credits.length <= 1) {
          const newCredits = [...credits];
          newCredits[0] = '';
          setCredits(newCredits);
          return;
      }
      const newCredits = credits.filter((_, idx) => idx !== indexToRemove);
      setCredits(newCredits);
  };

  const handleCalculate = async () => {
    if (!table) return;

    if (!mainRow || prazoIdx === null) {
      showAlert("Dados incompletos", "Por favor, selecione ao menos o primeiro crédito e um prazo.");
      return;
    }
    if(!currentParcelaValue) {
       showAlert("Erro", "Parcela não disponível.");
       return;
    }

    const prazoTotal = availablePrazos[prazoIdx]?.prazo;
    if (!prazoTotal) {
          showAlert("Erro", "Prazo selecionado inválido ou indisponível.");
          return;
    }

    const mesContemplacao = 1;
    const lanceEmbPctCalculado = totalCreditoSimulacao > 0 ? valLanceEmb / totalCreditoSimulacao : 0;

    const input: SimulationInput = {
      tableId: table.id,
      credito: totalCreditoSimulacao,
      prazo: prazoTotal,
      tipoParcela,
      lanceBolso: valLanceBolso,
      lanceEmbutidoPct: lanceEmbPctCalculado,
      lanceCartaVal: valLanceCarta,
      percentualLanceParaParcela, 
      taxaAdesaoPct: adesaoPct,
      mesContemplacao: mesContemplacao
    };

    const error = ConsortiumCalculator.validate(input, table);
    if (error) {
      showAlert("Erro de Validação", error);
      return;
    }

    const result = ConsortiumCalculator.calculate(input, table, currentParcelaValue);
    
    const numericCredits = credits
      .map(c => parseFloat(c))
      .filter(val => !isNaN(val) && val > 0);

    // Salva no Storage para navegação limpa
    // Adicionamos 'selectedCredits' no input salvo para recuperar na ResultScreen
    await SimulationStorage.saveSimulation(result, { ...input, selectedCredits: numericCredits } as any, numericCredits.length);

    // @ts-ignore
    navigation.navigate('Result'); 
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  const getButtonOpacity = () => limitInfo.isValid ? 1 : 0.5;

  // COMPONENTE DO CARD FLUTUANTE DE LANCES (Extraído para reutilização)
  const FloatingCardComponent = (
    <View style={[
        styles.floatingCard, 
        // REMOVIDO: styles.floatingCardInHeader que causava a largura dinâmica.
        // ADICIONADO: Margem apenas para garantir respiro se a tela for estreitar muito
        shouldMoveToHeader && { marginHorizontal: 20 }
    ]}>
        <View style={styles.floatingInfoContainer}>
             <Text style={styles.floatingLabel}>VALOR TOTAL DO LANCE</Text>
             <View style={styles.floatingValuesRow}>
                 <Text style={styles.floatingValue}>{formatCurrency(totalLances)}</Text>
                 <Text style={[styles.floatingPct, isLanceTotalInvalid && { color: '#EF4444' }]}> 
                      ({totalLancePct.toFixed(1)}%)
                 </Text>
             </View>
        </View>

        <TouchableOpacity 
             style={[
                 styles.floatingSaveBtn,
                 isLanceTotalInvalid && { backgroundColor: '#475569', opacity: 0.8 } 
             ]} 
             onPress={handleSaveLance}
             activeOpacity={0.8}
        >
             <Check size={18} color={isLanceTotalInvalid ? "#94A3B8" : "#0F172A"} style={{marginRight: 6}} />
             <Text style={[
                 styles.floatingSaveBtnText,
                 isLanceTotalInvalid && { color: '#94A3B8' }
             ]}>SALVAR</Text>
        </TouchableOpacity>
    </View>
  );

  // --- LOADING STATE ---
  if (isLoadingTable || !table) {
      return (
          <View style={[styles.mainContainer, { justifyContent: 'center', alignItems: 'center' }]}>
              <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
              <ActivityIndicator size="large" color="#0F172A" />
              <Text style={{marginTop: 16, color: '#64748B'}}>Carregando tabela...</Text>
          </View>
      );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* HEADER RESPONSIVO E ALINHADO */}
      <View style={styles.header}>
         <View style={[styles.headerContent, { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal }]}>
            <TouchableOpacity 
              onPress={handleBack} // Smart Back
              style={styles.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft color="#0F172A" size={24} />
            </TouchableOpacity>
            <View style={{flex: 1, alignItems: 'center'}}>
                <Text style={styles.headerTitle}>Nova Simulação</Text>
                <Text style={styles.headerSubtitle}>{table.name}</Text>
            </View>
            <View style={{width: 40}} /> 
         </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={[
              styles.scrollContent, 
              { 
                  width: '100%', 
                  maxWidth: MAX_WIDTH, 
                  alignSelf: 'center',
                  paddingHorizontal: paddingHorizontal 
              }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" 
        >
          
          {/* LISTA DE CRÉDITOS */}
          {credits.map((creditVal, index) => {
              const isFirst = index === 0;
              const hasValue = !!creditVal;
              const numericVal = parseFloat(creditVal);
              const titleText = credits.length > 1 ? `VALOR DO CRÉDITO ${index + 1}` : `VALOR DO CRÉDITO`;

              const compatibleGroups = (hasValue && prazoIdx !== null) 
                  ? getCompatibleGroups(numericVal) 
                  : [];

              return (
                  <View key={index} style={{position: 'relative', marginBottom: isFirst ? 24 : 12}}>
                      <TouchableOpacity 
                        style={[
                            styles.heroCreditCard, 
                            !isFirst && { marginTop: -12, borderColor: '#3B82F6', zIndex: 1 } 
                        ]}
                        onPress={() => handleOpenCreditModal(index)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.heroRow}>
                            <Text style={[styles.heroLabel, !isFirst && {color: '#2563EB'}]}>
                                {titleText}
                            </Text>
                            <View style={[styles.heroEditIcon, !isFirst && {backgroundColor: '#DBEAFE'}]}>
                                <ChevronDown size={16} color={isFirst ? "#3B82F6" : "#2563EB"} />
                            </View>
                        </View>
                        
                        {hasValue ? (
                            <Text style={[styles.heroValue, !isFirst && {color: '#1E40AF'}]}>
                                {formatCurrency(numericVal)}
                            </Text>
                        ) : (
                            <Text style={[styles.heroValue, {color: isFirst ? '#CBD5E1' : '#93C5FD'}]}>
                                R$ 0,00
                            </Text>
                        )}
                        
                        {/* FOOTER DO CARD COM LINHA AZUL + GRUPOS INLINE */}
                        <View style={styles.heroFooterRow}>
                            <View style={[styles.heroFooterLine, !isFirst && {backgroundColor: '#2563EB'}]} />

                            {hasValue && prazoIdx !== null && (
                                <View style={styles.inlineGroupsContainer}>
                                    {isLoadingGroups ? (
                                        <ActivityIndicator size="small" color="#94A3B8" style={{marginLeft: 12}} />
                                    ) : compatibleGroups.length > 0 ? (
                                        <ScrollView 
                                          horizontal 
                                          showsHorizontalScrollIndicator={false} 
                                          contentContainerStyle={styles.inlineGroupsList}
                                          style={{flexGrow: 0}}
                                        >
                                            {compatibleGroups.map((grupo) => (
                                                <View key={grupo} style={styles.miniBadgeInline}>
                                                    <Text style={styles.miniBadgeText}>{grupo}</Text>
                                                </View>
                                            ))}                                     
                                        </ScrollView>
                                    ) : (
                                        <Text style={styles.noGroupsInlineText}>Nenhum grupo.</Text>
                                    )}                                     
                                </View>
                            )}
                        </View>

                      </TouchableOpacity>

                      {!isFirst && (
                          <TouchableOpacity 
                            style={styles.removeBtn} 
                            onPress={() => handleRemoveCredit(index)}
                            hitSlop={{top:10, bottom:10, left:10, right:10}}
                        >
                            <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                  </View>
              );
          })}

          {credits.length < MAX_CREDITS && credits[0] !== '' && (
            <TouchableOpacity style={styles.addCreditBtn} onPress={handleAddCredit}>
                <PlusCircle size={18} color="#fff" />
                <Text style={styles.addCreditText}>Clique para adicionar mais um crédito a simulação</Text>
            </TouchableOpacity>
          )}

          {credits.length > 1 && totalCreditoSimulacao > 0 && (
              <View style={styles.totalSumContainer}>
                  <Text style={styles.totalSumLabel}>TOTAL SIMULADO</Text>
                  <Text style={styles.totalSumValue}>{formatCurrency(totalCreditoSimulacao)}</Text>
              </View>
          )}

          {/* PRAZOS */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
                <Clock size={16} color="#64748B" />
                <Text style={styles.groupLabel}>Prazo de Pagamento</Text>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
              {availablePrazos.length > 0 ? availablePrazos.map((p: any, idx: number) => (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.modernPill, idx === prazoIdx && styles.modernPillActive]}
                  onPress={() => setPrazoIdx(idx)}
                  disabled={!credits[0]}
                >
                  <Text style={[styles.modernPillText, idx === prazoIdx && styles.modernPillTextActive]}>
                    {p.prazo}x
                  </Text>
                </TouchableOpacity>
              )) : (
                <Text style={styles.helperText}>
                    {credits[0] ? "Nenhum prazo comum a todos os créditos." : "Selecione o primeiro crédito acima."}
                </Text>
              )}
            </ScrollView>
          </View>

          {/* OPÇÕES ADICIONAIS */}
          <View style={styles.optionsRow}>
              <View style={[styles.optionCol, { flex: 1.2 }]}>
                 <Text style={styles.miniLabel}>Taxa de Adesão</Text>
                 <View style={styles.gridContainer}>
                    {ADESAO_OPTIONS.map((opt) => (
                        <TouchableOpacity 
                            key={opt.value} 
                            style={[styles.gridPill, adesaoPct === opt.value && styles.gridPillActive]}
                            onPress={() => setAdesaoPct(opt.value)}
                        >
                            <Text style={[styles.gridPillText, adesaoPct === opt.value && styles.tinyPillTextActive]}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                 </View>
              </View>

              <View style={[styles.optionCol, { flex: 0.8 }]}>
                 <Text style={styles.miniLabel}>Seguro de Vida</Text>
                 <View style={{flex:1, justifyContent: 'center'}}>
                    {isSeguroObrigatorio ? (
                        <View style={styles.lockBadge}>
                            <Lock size={12} color="#0369A1" />
                            <Text style={styles.lockText}>Obrigatório</Text>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            style={[styles.newSwitchContainer, tipoParcela === 'C/SV' ? styles.newSwitchActive : styles.newSwitchInactive]}
                            onPress={() => setTipoParcela(tipoParcela === 'C/SV' ? 'S/SV' : 'C/SV')}
                            activeOpacity={0.9}
                        >
                            <View style={styles.newSwitchKnobLayout}>
                                <View style={[
                                    styles.newSwitchKnob, 
                                    tipoParcela === 'C/SV' ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }
                                ]} />
                            </View>
                            <Text style={[styles.newSwitchText, tipoParcela === 'C/SV' ? {left: 10, color: '#fff'} : {right: 10, color: '#64748B'}]}>
                                {tipoParcela === 'C/SV' ? 'Sim' : 'Não'}
                            </Text>
                        </TouchableOpacity>
                    )}
                 </View>
              </View>
          </View>

          {/* CARD DE LANCES */}
          <TouchableOpacity 
            style={[styles.lanceSummaryCard, !mainRow && styles.disabledCard]} 
            onPress={() => {
              if (mainRow) setShowLanceModal(true);
              else showAlert("Atenção", "Selecione um valor de crédito primeiro.");
            }}
            activeOpacity={mainRow ? 0.8 : 1}
            disabled={!credits[0]}
          >
            <View style={styles.lanceSummaryLeft}>
                <View style={[styles.iconCircle, totalLances > 0 ? {backgroundColor: '#ECFDF5'} : {backgroundColor: '#F1F5F9'}]}>
                    <Wallet size={24} color={totalLances > 0 ? '#10B981' : '#94A3B8'} />
                </View>
            </View>
            
            <View style={styles.lanceSummaryContent}>
                <Text style={styles.lanceSummaryTitle}>Simular Oferta de Lance</Text>
                {totalLances > 0 ? (
                    <View>
                        <Text style={styles.lanceSummaryValue}>{formatCurrency(totalLances)}</Text>
                        <Text style={styles.lanceSummarySubtitle}>Equivale a {totalLancePct.toFixed(1)}% do crédito total</Text>
                    </View>
                ) : (
                    <Text style={styles.lanceSummarySubtitle}>Clique para configurar uma oferta de lance</Text>
                )}
            </View>
            <View style={styles.lanceSummaryAction}>
                {totalLances > 0 ? <Settings2 size={20} color="#64748B" /> : <ChevronRight size={20} color="#CBD5E1" />}
            </View>
          </TouchableOpacity>

          <View style={{height: 120}} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footerContainer}>
        <View style={{ width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 0 }}>
            <TouchableOpacity 
                style={[styles.mainBtn, {opacity: getButtonOpacity()}]} 
                onPress={handleCalculate} 
                disabled={!limitInfo.isValid}
            >
            <Wand2 color="#fff" size={20} style={{marginRight: 8}} />
            <Text style={styles.mainBtnText}>GERAR SIMULAÇÃO</Text>
            </TouchableOpacity>
        </View>
      </View>


      {/* MODAL CRÉDITO */}
      <Modal visible={showCreditModal} animationType="fade" transparent onRequestClose={() => setShowCreditModal(false)}>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { maxWidth: 500, alignSelf: 'center', width: '100%' }]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Selecione o Crédito {editingIndex + 1}</Text>
                    <TouchableOpacity onPress={() => setShowCreditModal(false)} style={styles.closeBtn}>
                        <X color="#64748B" size={24} />
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                    {availableCredits.map((credit, index) => {
                        const currentVal = parseFloat(credits[editingIndex]);
                        const isSelected = currentVal === credit;
                        return (
                        <TouchableOpacity key={index} style={[styles.creditOption, isSelected && styles.creditOptionActive]} onPress={() => handleSelectCredit(credit)}>
                            <Text style={[styles.creditOptionText, isSelected && styles.creditOptionTextActive]}>
                                {formatCurrency(credit)}
                            </Text>
                            {isSelected && <View style={styles.checkCircle}><View style={styles.checkDot}/></View>}
                        </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
      </Modal>

      {/* MODAL LANCES */}
      <Modal visible={showLanceModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowLanceModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
            <SafeAreaView style={styles.modalFullContainer}>
                
                {/* Header */}
                <View style={{ width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', zIndex: 10 }}>
                    <View style={styles.modalHeader}>
                        {/* Título alinhado à esquerda */}
                        <Text style={styles.modalTitle}>Configuração de Lances</Text>

                        {/* SE FOR DESKTOP PAISAGEM: Renderiza o card flutuante CENTRALIZADO (Absolute) */}
                        {shouldMoveToHeader && (
                             <View style={{ 
                                 position: 'absolute', 
                                 left: 0, 
                                 right: 0, 
                                 top: 0, 
                                 bottom: 0, 
                                 justifyContent: 'center', 
                                 alignItems: 'center',
                                 pointerEvents: 'box-none' // Permite clicar nos itens abaixo nas laterais se necessário
                             }}>
                                 {/* O card manterá o maxWidth: 400 do estilo original */}
                                 {FloatingCardComponent}
                             </View>
                        )}

                        {/* Botão de Fechar alinhado à direita */}
                        {!isLanceTotalInvalid && (
                            <TouchableOpacity onPress={() => setShowLanceModal(false)} style={styles.closeBtn}>
                                <X color="#64748B" size={24} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                
                {/* Container Principal Relativo para posicionar o Card Flutuante */}
                <View style={{ flex: 1, position: 'relative' }}>
                    <ScrollView 
                        showsVerticalScrollIndicator={false} 
                        contentContainerStyle={{
                            padding: 24, 
                            paddingBottom: shouldMoveToHeader ? 40 : 120, // Ajuste de padding se o card não estiver embaixo
                            width: '100%',
                            maxWidth: MAX_WIDTH,
                            alignSelf: 'center'
                        }}
                    >
                        {/* INPUTS DE VALOR */}
                        <Text style={styles.modalSectionTitle}>Fontes do Lance</Text>
                        
                        <View style={styles.inputCard}>
                            <View style={styles.inputCardHeader}>
                                <PieChart size={16} color="#6366F1" />
                                <Text style={styles.inputCardLabel}>Lance Embutido (Do Crédito)</Text>
                            </View>
                            <TextInput 
                                style={[styles.modalInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                                keyboardType="numeric" 
                                value={lanceEmbInput} 
                                onChangeText={(t) => handleChangeLanceEmbutido(t)} 
                                placeholder="R$ 0,00" 
                                placeholderTextColor="#CBD5E1"
                            />
                            <View style={styles.quickTags}>
                                    <Text style={styles.quickLabel}>Sugestões:</Text>
                                {[0, 0.15, 0.25].filter(p => p <= LIMIT_LANCE_EMBUTIDO || p === 0).map(pct => (
                                    <TouchableOpacity key={pct} style={styles.tag} onPress={() => handleQuickLanceSelect(pct)}>
                                        <Text style={styles.tagText}>{(pct*100).toFixed(0)}%</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.rowInputs}>
                            <View style={[styles.inputCard, {flex: 1, marginRight: 8}]}>
                                <View style={styles.inputCardHeader}>
                                    <Wallet size={16} color="#10B981" />
                                    <Text style={styles.inputCardLabel}>Lance do Bolso</Text>
                                </View>
                                <TextInput 
                                    style={[styles.modalInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                                    keyboardType="numeric" 
                                    value={lanceBolso} 
                                    onChangeText={handleChangeLanceBolso} 
                                    placeholder="R$ 0,00" 
                                />
                            </View>
                            <View style={[styles.inputCard, {flex: 1, marginLeft: 8}]}>
                                <View style={styles.inputCardHeader}>
                                    <Car size={16} color="#F59E0B" />
                                    <Text style={styles.inputCardLabel}>Lance Avaliação</Text>
                                </View>
                                <TextInput 
                                    style={[styles.modalInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                                    keyboardType="numeric" 
                                    value={lanceCartaInput} 
                                    onChangeText={handleChangeLanceCarta} 
                                    placeholder="R$ 0,00" 
                                />
                            </View>
                        </View>

                        {/* ALOCAÇÃO */}
                        <View style={{marginTop: 4}}>
                            <Text style={styles.modalSectionTitle}>Onde usar as amortizações do lance?</Text>
                            
                            <View style={styles.allocationBox}>
                                <View style={styles.allocationBar}>
                                    <View style={[styles.barSegment, {flex: percentualLanceParaPrazo, backgroundColor: '#3B82F6'}]} />
                                    <View style={[styles.barSegment, {flex: percentualLanceParaParcela, backgroundColor: '#8B5CF6'}]} />
                                </View>

                                {/* Alocação com espaçamento otimizado */}
                                <View style={styles.allocationInputs}>
                                    <View style={styles.allocCol}>
                                        <Text style={styles.allocLabel}>Para Reduzir no Prazo</Text>
                                        <View style={styles.allocInputWrap}>
                                            <TextInput 
                                                style={[styles.allocInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                                                keyboardType="numeric" 
                                                value={pctParaPrazoInput} 
                                                onChangeText={(text) => handlePercentualChange(text, 'prazo')} 
                                            />
                                            <Text style={styles.allocSuffix}>%</Text>
                                        </View>
                                        {totalLances > 0 && (
                                            <Text style={styles.allocationValueText}>
                                                {formatCurrency(totalLances * (percentualLanceParaPrazo / 100))}
                                            </Text>
                                        )}
                                    </View>
                                    
                                    <View style={styles.allocCol}>
                                        <Text style={styles.allocLabel}>Para Reduzir na Parcela</Text>
                                        <View style={styles.allocInputWrap}>
                                            <TextInput 
                                                style={[styles.allocInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} 
                                                keyboardType="numeric" 
                                                value={pctParaParcelaInput} 
                                                onChangeText={(text) => handlePercentualChange(text, 'parcela')} 
                                            />
                                            <Text style={styles.allocSuffix}>%</Text>
                                        </View>
                                        {totalLances > 0 && (
                                            <Text style={[styles.allocationValueText, { color: '#8B5CF6' }]}>
                                                {formatCurrency(totalLances * (percentualLanceParaParcela / 100))}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                {/* BOTÕES DE DISTRIBUIÇÃO */}
                                {totalLances > 0 && (
                                    <View style={styles.distributionButtonsContainer}>
                                            <TouchableOpacity style={styles.distributionBtn} onPress={handleDistributeHalf}>
                                                <Scale color="#fff" size={16} style={{marginRight: 6}} />
                                                <Text style={styles.distributionBtnText}>Distribuir 50/50%</Text>
                                            </TouchableOpacity>
                                            
                                            <TouchableOpacity style={styles.distributionBtn} onPress={handleSetMaxPct}>
                                                <ArrowDownToLine color="#fff" size={16} style={{marginRight: 6}} />
                                                <Text style={styles.distributionBtnText}>Máximo para Parcela</Text>
                                            </TouchableOpacity>
                                    </View>
                                )}

                                {limitInfo.isExceeding40PercentRule && (
                                    <View style={styles.warningBox}>
                                        <AlertTriangle size={14} color="#B45309" />
                                        <Text style={styles.warningText}>O valor da parcela não deve ser inferior a 60% do valor dela atual (consulte a regra). O excedente agora irá ser destinado para reduzir no prazo.</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>

                    {/* --- SE NÃO ESTIVER NO HEADER (Mobile ou Retrato), RENDERIZA EMBAIXO --- */}
                    {!shouldMoveToHeader && (
                        <View style={styles.floatingContainer}>
                             {FloatingCardComponent}
                        </View>
                    )}

                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL DE ALERTA CUSTOMIZADO --- */}
      <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={closeAlert}>
        <View style={styles.alertOverlay}>
            <View style={styles.alertBox}>
                <View style={styles.alertHeader}>
                    <Info color="#0F172A" size={24} />
                    <Text style={styles.alertTitle}>{customAlert.title}</Text>
                </View>
                <Text style={styles.alertMessage}>{customAlert.message}</Text>
                <TouchableOpacity onPress={closeAlert} style={styles.alertButton}>
                    <Text style={styles.alertButtonText}>ENTENDI</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  
  header: { 
      backgroundColor: '#F8FAFC', 
      zIndex: 10,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, 
      borderBottomWidth: 1, 
      borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  headerContent: {
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingVertical: 12, 
  },
  
  backBtn: { 
    width: 40,
    height: 40,
    backgroundColor: '#F1F5F9', 
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },

  headerTitle: { fontSize: 14, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  
  scrollContent: { 
      paddingBottom: 100,
      paddingTop: 20
  },
  
  heroCreditCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, shadowColor: '#64748B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heroLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 1 },
  heroEditIcon: { backgroundColor: '#EFF6FF', padding: 6, borderRadius: 8 },
  heroValue: { fontSize: 36, fontWeight: '800', color: '#0F172A', letterSpacing: -1 },
  
  heroFooterRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroFooterLine: { 
    height: 4, 
    width: 40, 
    backgroundColor: '#3B82F6', 
    borderRadius: 2 
  },
  
  inlineGroupsContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 16,
      justifyContent: 'flex-start'
  },
  inlineGroupsList: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
  },
  inlineGroupsLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: '#94A3B8',
      marginRight: 6,
  },
  noGroupsInlineText: {
      fontSize: 11,
      color: '#94A3B8',
      fontStyle: 'italic',
  },
  miniBadgeInline: {
    backgroundColor: '#1d88a3ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  
  addCreditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, marginTop: -10, marginBottom: 24, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  addCreditText: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 8 },
  removeBtn: { position: 'absolute', top: -24, right: 12, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 12, zIndex: 10 },
  totalSumContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 16, borderRadius: 16, marginBottom: 24 },
  totalSumLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 1 },
  totalSumValue: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  inputGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  groupLabel: { fontSize: 16, fontWeight: '700', color: '#334155' },
  pillScroll: { gap: 10, paddingRight: 20 },
  modernPill: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  modernPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A', shadowColor: '#0F172A', shadowOpacity: 0.2, shadowOffset: {width: 0, height: 4}, shadowRadius: 8 },
  modernPillText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  modernPillTextActive: { color: '#FFFFFF' },
  helperText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic' },
  lanceSummaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 24, marginTop: 8, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#64748B', shadowOpacity: 0.05, shadowOffset: {width: 0, height: 4}, elevation: 2 },
  disabledCard: { opacity: 0.6, backgroundColor: '#F8FAFC' },
  lanceSummaryLeft: { marginRight: 16 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  lanceSummaryContent: { flex: 1 },
  lanceSummaryTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  lanceSummaryValue: { fontSize: 18, fontWeight: '800', color: '#10B981', marginVertical: 2 },
  lanceSummarySubtitle: { fontSize: 12, color: '#64748B' },
  lanceSummaryAction: { paddingLeft: 8 },
  optionsRow: { flexDirection: 'row', gap: 16, marginBottom: 16, alignItems: 'stretch' },
  optionCol: { }, 
  miniLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8, textTransform: 'uppercase' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridPill: { width: '47%', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  gridPillActive: { backgroundColor: '#334155' },
  gridPillText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  tinyPillTextActive: { color: '#fff' },
  newSwitchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E2E8F0', borderRadius: 24, height: 48, paddingHorizontal: 4, position: 'relative', width: '100%' },
  newSwitchActive: { backgroundColor: '#0EA5E9' },
  newSwitchInactive: { backgroundColor: '#E2E8F0' },
  newSwitchKnobLayout: { flex: 1, justifyContent: 'center' },
  newSwitchKnob: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  newSwitchText: { position: 'absolute', fontSize: 14, fontWeight: '700', width: '100%', textAlign: 'center', zIndex: -1 },
  lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0F9FF', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, alignSelf: 'flex-start' },
  lockText: { fontSize: 12, color: '#0369A1', fontWeight: '700' },
  
  footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  mainBtn: { backgroundColor: '#0F172A', borderRadius: 18, paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  mainBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  closeBtn: { padding: 4, backgroundColor: '#F1F5F9', borderRadius: 12 },
  creditOption: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  creditOptionActive: { backgroundColor: '#F8FAFC' },
  creditOptionText: { fontSize: 18, color: '#334155', fontWeight: '500' },
  creditOptionTextActive: { color: '#2563EB', fontWeight: '700' },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  checkDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2563EB' },
  
  modalFullContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalSectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  inputCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  inputCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  inputCardLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  modalInput: { fontSize: 18, fontWeight: '600', color: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8, width: '100%' },
  quickTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  quickLabel: { fontSize: 12, color: '#94A3B8' },
  tag: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  rowInputs: { flexDirection: 'row' },
  
  allocationBox: { 
      backgroundColor: '#fff', 
      borderRadius: 20, 
      padding: 12, 
      borderWidth: 1, 
      borderColor: '#E2E8F0' 
  },
  allocationBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 20, backgroundColor: '#F1F5F9' },
  barSegment: { height: '100%' },
  allocationInputs: { 
      flexDirection: 'row', 
      gap: 8 
  },
  allocCol: { flex: 1 },
  allocLabel: { fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: '600' },
  allocInputWrap: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      borderWidth: 1, 
      borderColor: '#E2E8F0', 
      borderRadius: 12, 
      paddingHorizontal: 8, 
      paddingVertical: 8 
  },
  allocInput: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0F172A', padding: 0, width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' },
  allocSuffix: { fontSize: 14, color: '#94A3B8', fontWeight: '600', marginRight: 8 },
  allocationValueText: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#3B82F6' },
  
  distributionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  distributionBtn: {
    flex: 1,
    backgroundColor: '#3B82F6', // Azul principal
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  distributionBtnText: {
    color: '#fff',
    fontSize: 11, 
    fontWeight: '700',
    textAlign: 'center'
  },
  
  warningBox: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8 },
  warningText: { color: '#B45309', fontSize: 11, fontWeight: '600', flex: 1 },

  floatingContainer: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0,
      shadowRadius: 20,
      elevation: 10
  },
  // Quando estiver no header, removemos a largura fixa e ajustamos bordas
  floatingCardInHeader: {
      maxWidth: '100%',
      width: 'auto',
      borderWidth: 0,
      paddingVertical: 6,
      paddingHorizontal: 12,
      // Se necessário, ajustar background para combinar com header
  },
  floatingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#1E293B', 
      borderRadius: 50,
      paddingVertical: 10,
      paddingHorizontal: 16,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: '#334155'
  },
  floatingInfoContainer: {
      flex: 1,
      paddingRight: 12
  },
  floatingLabel: {
      fontSize: 10, 
      color: '#94A3B8', 
      fontWeight: '700', 
      textTransform: 'uppercase',
      marginBottom: 2
  },
  floatingValuesRow: {
      flexDirection: 'row',
      alignItems: 'baseline'
  },
  floatingValue: {
      fontSize: 18,
      color: '#FFFFFF',
      fontWeight: '800',
  },
  floatingPct: {
      fontSize: 12,
      color: '#4ADE80', 
      fontWeight: '600',
      marginLeft: 4
  },
  floatingSaveBtn: {
      backgroundColor: '#FFFFFF', 
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
  },
  floatingSaveBtnText: {
      color: '#0F172A',
      fontWeight: '800',
      fontSize: 13,
      letterSpacing: 0.5
  },

  miniBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  alertBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center'
  },
  alertMessage: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  alertButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center'
  },
  alertButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  }
});