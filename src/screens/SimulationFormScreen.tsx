import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, 
  Alert, Modal, KeyboardAvoidingView, Platform, StatusBar,
  SafeAreaView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { 
  ArrowLeft, Lock, CalendarDays, PieChart, ChevronDown, X, Clock, Wand2, ChevronRight, 
  AlertTriangle, Settings2, Wallet, Car, PlusCircle, Trash2
} from 'lucide-react-native';

import { RootStackParamList } from '../types/navigation';
import { getTableData } from '../../data/TableRepository';
import { ConsortiumCalculator, SimulationInput, InstallmentType } from '../utils/ConsortiumCalculator';

type Props = NativeStackScreenProps<RootStackParamList, 'SimulationForm'>;

const ADESAO_OPTIONS = [
  { label: 'Isento', value: 0 },
  { label: '0.5%', value: 0.005 },
  { label: '1%', value: 0.01 },
  { label: '2%', value: 0.02 },
];

const MAX_CREDITS = 50;

// --- HELPER: MÁSCARA DE MOEDA ---
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
  const { table } = route.params;
  const rawData = getTableData(table.id);

  const scrollViewRef = useRef<ScrollView>(null);

  // --- STATES ---
  const [credits, setCredits] = useState<string[]>(['']); // Inicia com 1 slot vazio

  const [prazoIdx, setPrazoIdx] = useState<number | null>(null);
  const [tipoParcela, setTipoParcela] = useState<InstallmentType>('S/SV');
  const [adesaoPct, setAdesaoPct] = useState(0);
  const [mesContemplacaoInput, setMesContemplacaoInput] = useState(''); 

  const [showLanceModal, setShowLanceModal] = useState(false);
  
  // Controle do Modal de Crédito
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number>(0); 
  
  const [lanceEmbInput, setLanceEmbInput] = useState(''); 
  const [lanceBolso, setLanceBolso] = useState('');       
  const [lanceCartaInput, setLanceCartaInput] = useState(''); 
  
  // Inicializando com valores seguros
  const [pctParaParcelaInput, setPctParaParcelaInput] = useState('0'); 
  const [pctParaPrazoInput, setPctParaPrazoInput] = useState('100'); 
  
  const percentualLanceParaParcela = parseFloat(pctParaParcelaInput) || 0;
  const percentualLanceParaPrazo = parseFloat(pctParaPrazoInput) || 0;

  // --- HELPERS E CÁLCULOS ---
  const availableCredits = useMemo(() => rawData.map(r => r.credito).sort((a,b) => a-b), [rawData]);
  
  // Seleção da Linha Principal
  const mainRow = useMemo(() => {
    const val = parseFloat(credits[0]);
    return rawData.find(r => r.credito === val) || null;
  }, [credits, rawData]);

  // --- LÓGICA DE INTERSECÇÃO DE PRAZOS ---
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

  const isSeguroObrigatorio = useMemo(() => {
    if (availablePrazos.length > 0) {
      const sample = availablePrazos[0] as any;
      return sample.parcela !== undefined;
    }
    return false;
  }, [availablePrazos]);

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

  // *** REMOVIDO O USEEFFECT QUE CAUSAVA O LOOP INFINITO AQUI ***

  const handleCurrencyChange = (text: string, setter: (val: string) => void) => {
      setter(formatCurrencyInput(text));
  };
  
  const maxLancePermitido = totalCreditoSimulacao * table.maxLanceEmbutido;
  
  const handleChangeLanceEmbutido = (text: string) => {
    const numericValue = parseCurrencyToFloat(text);
    if (numericValue > maxLancePermitido) {
      setLanceEmbInput(formatCurrencyInput(maxLancePermitido.toFixed(2).replace('.', '')));
      Alert.alert("Limite Atingido", `O lance embutido máximo é de ${(table.maxLanceEmbutido * 100).toFixed(0)}% do total.`);
    } else {
      setLanceEmbInput(formatCurrencyInput(text));
    }
  };

  const handleQuickLanceSelect = (pct: number) => {
    if (totalCreditoSimulacao <= 0) return;
    const val = totalCreditoSimulacao * pct;
    const valString = (val * 100).toFixed(0); 
    
    if (pct <= table.maxLanceEmbutido) {
        setLanceEmbInput(formatCurrencyInput(valString));
    } else {
        const maxString = (maxLancePermitido * 100).toFixed(0);
        setLanceEmbInput(formatCurrencyInput(maxString));
    }
  };

  // --- CORREÇÃO: Lógica unificada no evento de mudança (Sem useEffect) ---
  const handlePercentualChange = (text: string, type: 'parcela' | 'prazo') => {
    // 1. Limpeza do input
    let cleanText = text.replace(/[^0-9.]/g, '');
    
    // Evita múltiplos pontos decimais
    if ((cleanText.match(/\./g) || []).length > 1) return;

    // Se estiver vazio, define o outro como 100%
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

    // Verifica limite de 100%
    const val = parseFloat(cleanText);
    if (val > 100) {
        cleanText = '100'; 
    }

    // Calcula o complemento (100 - valor)
    const numVal = parseFloat(cleanText) || 0;
    const complementVal = Math.max(0, 100 - numVal);
    
    // Formata o complemento para string (sem casas decimais desnecessárias)
    const complementStr = Number.isInteger(complementVal) 
        ? complementVal.toString() 
        : complementVal.toFixed(2).replace(/\.?0+$/, '');

    // 2. Atualiza AMBOS os estados simultaneamente
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
  
  const totalLances = valLanceEmb + valLanceBolso + valLanceCarta;
  const totalLancePct = totalCreditoSimulacao > 0 ? (totalLances / totalCreditoSimulacao) * 100 : 0;

  const dataEstimada = useMemo(() => {
    const mes = parseInt(mesContemplacaoInput);
    if (!mes || isNaN(mes)) return null;
    
    const hoje = new Date();
    const dataFutura = new Date(hoje.setMonth(hoje.getMonth() + mes));
    return dataFutura.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [mesContemplacaoInput]);

  const limitInfo = useMemo(() => {
    if (!currentParcelaValue || prazoIdx === null || totalLances === 0) {
        return { isValid: true, message: '', maxPermittedPct: 100, isExceeding40PercentRule: false };
    }
    const prazoTotal = availablePrazos[prazoIdx]?.prazo;
    if (!prazoTotal) return { isValid: false, message: '', maxPermittedPct: 0, isExceeding40PercentRule: false };

    const rawMes = parseInt(mesContemplacaoInput) || 1;
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
  }, [percentualLanceParaParcela, totalLances, currentParcelaValue, prazoIdx, mesContemplacaoInput, availablePrazos, table.plan]);

  const handleSetMaxPct = () => {
    if (totalLances === 0 || prazoIdx === null) {
        Alert.alert("Atenção", "Preencha o crédito, prazo e lances.");
        return;
    }
    const maxPct = limitInfo.maxPermittedPct;
    // Aqui usamos set direto, pois não é evento de digitação
    setPctParaParcelaInput(maxPct.toString());
    setPctParaPrazoInput((100 - maxPct).toString());
  };

  // --- GESTÃO DE MÚLTIPLOS CRÉDITOS ---
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
          Alert.alert("Limite Atingido", `Máximo de ${MAX_CREDITS} créditos permitidos.`);
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

  const handleCalculate = () => {
    if (!mainRow || prazoIdx === null) {
      Alert.alert("Dados incompletos", "Por favor, selecione ao menos o primeiro crédito e um prazo.");
      return;
    }
    if(!currentParcelaValue) {
       Alert.alert("Erro", "Parcela não disponível.");
       return;
    }

    const prazoTotal = availablePrazos[prazoIdx]?.prazo;
    if (!prazoTotal) {
         Alert.alert("Erro", "Prazo selecionado inválido ou indisponível.");
         return;
    }

    let mesContemplacao = parseInt(mesContemplacaoInput) || 1; 
    
    if (mesContemplacao > prazoTotal) {
      Alert.alert("Mês Inválido", `O mês de contemplação não pode ser superior ao prazo do plano (${prazoTotal} meses).`);
      return;
    }
    mesContemplacao = Math.max(1, mesContemplacao);

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
      Alert.alert("Erro de Validação", error);
      return;
    }

    const result = ConsortiumCalculator.calculate(input, table, currentParcelaValue);
    const quotaCount = credits.filter(c => parseFloat(c) > 0).length;

    navigation.navigate('Result', { result, input, quotaCount });
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  const getButtonOpacity = () => limitInfo.isValid ? 1 : 0.5;

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <View style={{flex: 1, alignItems: 'center'}}>
           <Text style={styles.headerTitle}>Nova Simulação</Text>
           <Text style={styles.headerSubtitle}>{table.name}</Text>
        </View>
        <View style={{width: 32}} /> 
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" 
        >
          
          {/* LISTA DE CRÉDITOS */}
          {credits.map((creditVal, index) => {
              const isFirst = index === 0;
              const hasValue = !!creditVal;
              const titleText = credits.length > 1 ? `VALOR DO CRÉDITO ${index + 1}` : `VALOR DO CRÉDITO`;

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
                                {formatCurrency(parseFloat(creditVal))}
                            </Text>
                        ) : (
                            <Text style={[styles.heroValue, {color: isFirst ? '#CBD5E1' : '#93C5FD'}]}>
                                R$ 0,00
                            </Text>
                        )}
                        <View style={[styles.heroFooterLine, !isFirst && {backgroundColor: '#2563EB'}]} />
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
                 <Text style={styles.miniLabel}>Seguro Prestamista</Text>
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
              else Alert.alert("Atenção", "Selecione um valor de crédito primeiro.");
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
                <Text style={styles.lanceSummaryTitle}>Ofertar Lance</Text>
                {totalLances > 0 ? (
                    <View>
                        <Text style={styles.lanceSummaryValue}>{formatCurrency(totalLances)}</Text>
                        <Text style={styles.lanceSummarySubtitle}>Equivale a {totalLancePct.toFixed(1)}% do crédito total</Text>
                    </View>
                ) : (
                    <Text style={styles.lanceSummarySubtitle}>Antecipe sua contemplação</Text>
                )}
            </View>
            <View style={styles.lanceSummaryAction}>
                {totalLances > 0 ? <Settings2 size={20} color="#64748B" /> : <ChevronRight size={20} color="#CBD5E1" />}
            </View>
          </TouchableOpacity>

          {/* TIMELINE CARD */}
          <View style={styles.timelineCard}>
             <View style={styles.timelineHeader}>
                 <CalendarDays color="#fff" size={18} />
                 <Text style={styles.timelineTitle}>Projeção de Contemplação</Text>
             </View>
             
             <View style={styles.timelineBody}>
                 <View style={{flex: 1}}>
                    <Text style={styles.timelineLabel}>Mês estimado</Text>
                    <View style={styles.timelineInputContainer}>
                        <TextInput 
                          style={styles.timelineInput}
                          keyboardType="numeric" 
                          placeholder="1" 
                          value={mesContemplacaoInput}
                          onChangeText={setMesContemplacaoInput}
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          maxLength={3}
                          onFocus={() => {
                             setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250);
                          }}
                        />
                        <Text style={styles.timelineSuffix}>º mês</Text>
                    </View>
                 </View>
                 
                 {dataEstimada && (
                     <View style={styles.timelineResult}>
                         <Text style={styles.timelineResultLabel}>DATA APROXIMADA</Text>
                         <Text style={styles.timelineResultValue}>
                            {dataEstimada.charAt(0).toUpperCase() + dataEstimada.slice(1)}
                         </Text>
                     </View>
                 )}
             </View>
          </View>
          <View style={{height: 120}} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footerContainer}>
        <TouchableOpacity 
            style={[styles.mainBtn, {opacity: getButtonOpacity()}]} 
            onPress={handleCalculate} 
            disabled={!limitInfo.isValid}
        >
          <Wand2 color="#fff" size={20} style={{marginRight: 8}} />
          <Text style={styles.mainBtnText}>GERAR SIMULAÇÃO</Text>
        </TouchableOpacity>
      </View>


      {/* MODAL CRÉDITO */}
      <Modal visible={showCreditModal} animationType="fade" transparent onRequestClose={() => setShowCreditModal(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
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
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Configuração de Lances</Text>
                    <TouchableOpacity onPress={() => setShowLanceModal(false)} style={styles.closeBtn}>
                        <X color="#64748B" size={24} />
                    </TouchableOpacity>
                </View>
                
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding: 24, paddingBottom: 40}}>
                    {/* INPUTS DE VALOR */}
                    <Text style={styles.modalSectionTitle}>Fontes do Lance</Text>
                    
                    <View style={styles.inputCard}>
                        <View style={styles.inputCardHeader}>
                            <PieChart size={16} color="#6366F1" />
                            <Text style={styles.inputCardLabel}>Lance Embutido (Do Crédito)</Text>
                        </View>
                        <TextInput 
                            style={styles.modalInput} 
                            keyboardType="numeric" 
                            value={lanceEmbInput} 
                            onChangeText={(t) => handleChangeLanceEmbutido(t)} 
                            placeholder="R$ 0,00" 
                            placeholderTextColor="#CBD5E1"
                        />
                        <View style={styles.quickTags}>
                             <Text style={styles.quickLabel}>Sugestões:</Text>
                            {[0, 0.20, 0.25, 0.30].filter(p => p <= table.maxLanceEmbutido || p === 0).map(pct => (
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
                                <Text style={styles.inputCardLabel}>Bolso</Text>
                            </View>
                            <TextInput 
                                style={styles.modalInput} 
                                keyboardType="numeric" 
                                value={lanceBolso} 
                                onChangeText={(t) => handleCurrencyChange(t, setLanceBolso)} 
                                placeholder="R$ 0,00" 
                            />
                        </View>
                        <View style={[styles.inputCard, {flex: 1, marginLeft: 8}]}>
                            <View style={styles.inputCardHeader}>
                                <Car size={16} color="#F59E0B" />
                                <Text style={styles.inputCardLabel}>Avaliação</Text>
                            </View>
                            <TextInput 
                                style={styles.modalInput} 
                                keyboardType="numeric" 
                                value={lanceCartaInput} 
                                onChangeText={(t) => handleCurrencyChange(t, setLanceCartaInput)} 
                                placeholder="R$ 0,00" 
                            />
                        </View>
                    </View>

                    {/* ALOCAÇÃO */}
                    <View style={{marginTop: 4}}>
                        <Text style={styles.modalSectionTitle}>Como usar o lance?</Text>
                        
                        <View style={styles.allocationBox}>
                            <View style={styles.allocationBar}>
                                <View style={[styles.barSegment, {flex: percentualLanceParaPrazo, backgroundColor: '#3B82F6'}]} />
                                <View style={[styles.barSegment, {flex: percentualLanceParaParcela, backgroundColor: '#8B5CF6'}]} />
                            </View>

                            <View style={styles.allocationInputs}>
                                <View style={styles.allocCol}>
                                    <Text style={styles.allocLabel}>Reduzir Prazo</Text>
                                    <View style={styles.allocInputWrap}>
                                        <TextInput 
                                            style={styles.allocInput} 
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
                                    <Text style={styles.allocLabel}>Reduzir Parcela</Text>
                                    <View style={styles.allocInputWrap}>
                                        <TextInput 
                                            style={styles.allocInput} 
                                            keyboardType="numeric" 
                                            value={pctParaParcelaInput} 
                                            onChangeText={(text) => handlePercentualChange(text, 'parcela')} 
                                        />
                                        <Text style={styles.allocSuffix}>%</Text>
                                        
                                        {totalLances > 0 && (
                                            <TouchableOpacity style={styles.magicBtnInline} onPress={handleSetMaxPct}>
                                                <Text style={styles.magicBtnText}>Max</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {totalLances > 0 && (
                                        <Text style={[styles.allocationValueText, { color: '#8B5CF6' }]}>
                                            {formatCurrency(totalLances * (percentualLanceParaParcela / 100))}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {limitInfo.isExceeding40PercentRule && (
                                <View style={styles.warningBox}>
                                    <AlertTriangle size={14} color="#B45309" />
                                    <Text style={styles.warningText}>Limite de 40% excedido. O excedente irá para o prazo.</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* TOTAL FOOTER MODAL */}
                    <View style={styles.totalBox}>
                         <View>
                             <Text style={styles.totalLabel}>LANCE TOTAL</Text>
                             <Text style={styles.totalValue}>{formatCurrency(totalLances)}</Text>
                         </View>
                         <View style={{alignItems: 'flex-end'}}>
                             <Text style={styles.totalPctLabel}>EQUIVALÊNCIA</Text>
                             <Text style={styles.totalPctValue}>{totalLancePct.toFixed(2)}%</Text>
                         </View>
                    </View>
                    
                    <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowLanceModal(false)}>
                        <Text style={styles.confirmBtnText}>SALVAR CONFIGURAÇÃO</Text>
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 60, paddingBottom: 24, backgroundColor: '#F8FAFC', zIndex: 10 },
  backBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 12 },
  headerTitle: { fontSize: 14, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
  heroCreditCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, shadowColor: '#64748B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heroLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 1 },
  heroEditIcon: { backgroundColor: '#EFF6FF', padding: 6, borderRadius: 8 },
  heroValue: { fontSize: 36, fontWeight: '800', color: '#0F172A', letterSpacing: -1 },
  heroFooterLine: { height: 4, width: 40, backgroundColor: '#3B82F6', borderRadius: 2, marginTop: 16 },
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
  timelineCard: { backgroundColor: '#0F172A', borderRadius: 24, padding: 24, marginBottom: 24, shadowColor: '#0F172A', shadowOpacity: 0.25, shadowOffset: {width: 0, height: 8}, elevation: 8 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  timelineTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  timelineBody: { flexDirection: 'row', gap: 24 },
  timelineLabel: { color: '#94A3B8', fontSize: 12, marginBottom: 8 },
  timelineInputContainer: { flexDirection: 'row', alignItems: 'baseline', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 4 },
  timelineInput: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', width: 50, padding: 0 },
  timelineSuffix: { fontSize: 14, color: '#64748B', marginLeft: 4 },
  timelineResult: { flex: 1, justifyContent: 'center' },
  timelineResultLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  timelineResultValue: { color: '#3B82F6', fontSize: 16, fontWeight: '700' },
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
  allocationBox: { backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  allocationBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 20, backgroundColor: '#F1F5F9' },
  barSegment: { height: '100%' },
  allocationInputs: { flexDirection: 'row', gap: 16 },
  allocCol: { flex: 1 },
  allocLabel: { fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: '600' },
  allocInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  allocInput: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0F172A', padding: 0 },
  allocSuffix: { fontSize: 14, color: '#94A3B8', fontWeight: '600', marginRight: 8 },
  allocationValueText: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#3B82F6' },
  magicBtnInline: { backgroundColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  magicBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  warningBox: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8 },
  warningText: { color: '#B45309', fontSize: 11, fontWeight: '600', flex: 1 },
  totalBox: { marginTop: 24, backgroundColor: '#1E293B', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  totalValue: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  totalPctLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  totalPctValue: { color: '#4ADE80', fontSize: 18, fontWeight: '700', marginTop: 4 },
  confirmBtn: { backgroundColor: '#2563EB', margin: 24, borderRadius: 16, padding: 18, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 }
});