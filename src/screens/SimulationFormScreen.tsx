import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, SafeAreaView, Alert, Switch, Modal, KeyboardAvoidingView, Platform, PanResponder } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Calculator, DollarSign, ShieldCheck, Lock, Car, CalendarDays, PieChart, AlertTriangle, Minus, Plus, Zap } from 'lucide-react-native';
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

// --- Componente de Slider Interativo (Corrigido para evitar conflito com ScrollView) ---
const InteractiveSlider = ({ value, onValueChange, blocked }: { value: number, onValueChange: (val: number) => void, blocked: boolean }) => {
  const [width, setWidth] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      // Solicita ser o respondente imediatamente ao toque iniciar
      onStartShouldSetPanResponder: () => true,
      // CRÍTICO: Captura o evento antes que o ScrollView pai possa vê-lo
      onStartShouldSetPanResponderCapture: () => true, 
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      
      // Impede que o ScrollView roube o gesto de volta se você arrastar na diagonal
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt, gestureState) => {
        // Lógica de toque inicial (tap): Pula direto para onde o dedo tocou
        if (width > 0) {
            const tapX = evt.nativeEvent.locationX;
            updateValue(tapX);
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        // Lógica de arrasto
        if (width > 0) {
             const touchX = evt.nativeEvent.locationX;
             updateValue(touchX);
        }
      },
    })
  ).current;

  const updateValue = (x: number) => {
    let pct = (x / width) * 100;
    
    // Trava nos limites 0 e 100
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    
    onValueChange(Math.round(pct));
  };

  return (
    <View 
      style={styles.sliderContainer} 
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      {/* Trilho Fundo (pointerEvents="none" para garantir que o toque vá para o container pai) */}
      <View style={styles.sliderTrack} pointerEvents="none">
        <View style={[styles.sliderFill, { width: `${value}%`, backgroundColor: blocked ? '#EF4444' : '#0F172A' }]} />
      </View>
      
      {/* Marcador Visual (Thumb) */}
      <View 
        style={[styles.sliderThumb, { left: `${value}%`, borderColor: blocked ? '#EF4444' : '#0F172A' }]}
        pointerEvents="none"
      >
         <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: blocked ? '#EF4444' : '#0F172A' }} />
      </View>
    </View>
  );
};

export default function SimulationFormScreen({ route, navigation }: Props) {
  const { table } = route.params;
  const rawData = getTableData(table.id);

  // --- STATES DE ENTRADA BÁSICA ---
  const [creditoInput, setCreditoInput] = useState('');
  const [prazoIdx, setPrazoIdx] = useState<number | null>(null);
  const [tipoParcela, setTipoParcela] = useState<InstallmentType>('S/SV');
  const [adesaoPct, setAdesaoPct] = useState(0);
  const [mesContemplacaoInput, setMesContemplacaoInput] = useState(''); 

  // --- STATES DE LANCES ---
  const [showLanceModal, setShowLanceModal] = useState(false);
  const [lanceEmbInput, setLanceEmbInput] = useState(''); 
  const [lanceBolso, setLanceBolso] = useState('');
  const [lanceCartaInput, setLanceCartaInput] = useState('');
  
  // --- STATE DE AMORTIZAÇÃO (PERCENTUAL) ---
  const [percentualLanceParaParcela, setPercentualLanceParaParcela] = useState(0); 

  // --- HELPERS ---
  const availableCredits = useMemo(() => rawData.map(r => r.credito).sort((a,b) => a-b), [rawData]);
  
  const selectedRow = useMemo(() => {
    const val = parseFloat(creditoInput);
    return rawData.find(r => r.credito === val) || null;
  }, [creditoInput, rawData]);

  const availablePrazos = selectedRow ? selectedRow.prazos : [];

  const isSeguroObrigatorio = useMemo(() => {
    if (availablePrazos.length > 0) {
      const sample = availablePrazos[0] as any;
      return sample.parcela !== undefined;
    }
    return false;
  }, [availablePrazos]);

  const currentParcelaValue = useMemo(() => {
     if (!selectedRow || prazoIdx === null) return 0;
     const p = availablePrazos[prazoIdx];
     if (p.parcela) return p.parcela;
     return tipoParcela === 'C/SV' ? p.parcela_CSV : p.parcela_SSV;
  }, [selectedRow, prazoIdx, tipoParcela, availablePrazos]);

  useEffect(() => {
    if (isSeguroObrigatorio) setTipoParcela('C/SV');
  }, [isSeguroObrigatorio]);

  useEffect(() => {
    setLanceEmbInput('');
    setLanceBolso('');
    setLanceCartaInput('');
  }, [creditoInput]);

  // --- CÁLCULOS DE LANCES ---
  const maxLancePermitido = selectedRow ? selectedRow.credito * 0.25 : 0;
  const currentCredito = selectedRow ? selectedRow.credito : 0;
  
  const currentLanceEmb = parseFloat(lanceEmbInput) || 0;
  const currentLanceBolso = parseFloat(lanceBolso) || 0;
  const currentLanceCarta = parseFloat(lanceCartaInput) || 0;
  const totalLances = currentLanceEmb + currentLanceBolso + currentLanceCarta;
  const totalLancePct = currentCredito > 0 ? (totalLances / currentCredito) * 100 : 0;

  // --- VALIDAÇÃO & CÁLCULO DE LIMITE (40%) ---
  const limitInfo = useMemo(() => {
    if (!currentParcelaValue || prazoIdx === null || totalLances === 0) {
        return { isValid: true, message: '', maxPermittedPct: 100 };
    }

    const prazoTotal = availablePrazos[prazoIdx].prazo;
    const mesPrevisto = parseInt(mesContemplacaoInput) || 1;
    const prazoRestante = Math.max(1, prazoTotal - mesPrevisto); 
    
    // Cálculo inverso: Qual o percentual MÁXIMO do lance que posso usar na parcela
    // sem ferir a regra dos 40% (ou seja, sobrando pelo menos 60% da parcela original)?
    
    const maxReductionValue = currentParcelaValue * 0.40; // Max que pode reduzir em R$
    const totalReductionCapacity = maxReductionValue * prazoRestante; // Total em R$ que pode ser absorvido pelo prazo restante
    
    // Percentual do lance que resulta nessa redução
    let maxPermittedPct = (totalReductionCapacity / totalLances) * 100;
    
    // Trava de segurança
    if (maxPermittedPct > 100) maxPermittedPct = 100;
    if (maxPermittedPct < 0) maxPermittedPct = 0;

    const isValid = percentualLanceParaParcela <= maxPermittedPct + 0.5; // Margem pequena para arredondamento

    return { 
        isValid, 
        maxPermittedPct: Math.floor(maxPermittedPct),
        message: !isValid ? `Redução excessiva. O máximo permitido para este cenário é aprox. ${Math.floor(maxPermittedPct)}% do lance.` : ''
    };
  }, [percentualLanceParaParcela, totalLances, currentParcelaValue, prazoIdx, mesContemplacaoInput, availablePrazos]);

  const handleChangeLanceEmbutido = (text: string) => {
    const numericValue = parseFloat(text) || 0;
    if (numericValue > maxLancePermitido) {
      setLanceEmbInput(maxLancePermitido.toFixed(2));
      Alert.alert("Limite Atingido", `O lance embutido máximo é de 25% (${maxLancePermitido.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}).`);
    } else {
      setLanceEmbInput(text);
    }
  };

  const handleQuickLanceSelect = (pct: number) => {
    if (!selectedRow) return;
    const val = selectedRow.credito * pct;
    setLanceEmbInput(val.toFixed(2));
  };

  // Funções de Ajuste Fino (Botões laterais)
  const increment = () => setPercentualLanceParaParcela(p => Math.min(p + 1, 100));
  const decrement = () => setPercentualLanceParaParcela(p => Math.max(p - 1, 0));
  const setPreset = (val: number) => setPercentualLanceParaParcela(val);

  const handleCalculate = () => {
    if (!selectedRow || prazoIdx === null) {
      Alert.alert("Dados incompletos", "Por favor, selecione um crédito válido e um prazo.");
      return;
    }
    if(!currentParcelaValue) {
       Alert.alert("Erro", "Parcela não disponível.");
       return;
    }

    const lanceEmbValor = parseFloat(lanceEmbInput) || 0;
    const lanceEmbPctCalculado = lanceEmbValor / selectedRow.credito;

    const input: SimulationInput = {
      tableId: table.id,
      credito: selectedRow.credito,
      prazo: availablePrazos[prazoIdx].prazo,
      tipoParcela,
      lanceBolso: parseFloat(lanceBolso) || 0,
      lanceEmbutidoPct: lanceEmbPctCalculado,
      lanceCartaVal: parseFloat(lanceCartaInput) || 0, 
      taxaAdesaoPct: adesaoPct,
      percentualLanceParaParcela, 
      mesContemplacao: parseInt(mesContemplacaoInput) || 0
    };

    const error = ConsortiumCalculator.validate(input, table);
    if (error) {
      Alert.alert("Erro de Validação", error);
      return;
    }

    const result = ConsortiumCalculator.calculate(input, table, currentParcelaValue);
    navigation.navigate('Result', { result, input });
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Simular {table.category}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. VALOR DO CRÉDITO */}
        <View style={styles.card}>
          <Text style={styles.label}>Valor do Crédito (R$)</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="numeric" 
            placeholder="Ex: 100000" 
            value={creditoInput}
            onChangeText={setCreditoInput}
            placeholderTextColor="#94A3B8"
          />
          {!selectedRow && availableCredits.length > 0 && (
            <View style={styles.chipContainer}>
              {availableCredits.slice(0, 6).map((c) => (
                <TouchableOpacity key={c} onPress={() => setCreditoInput(c.toString())} style={styles.chip}>
                  <Text style={styles.chipText}>{c >= 1000 ? (c/1000).toFixed(0)+'k' : c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 2. PRAZO */}
        <View style={styles.card}>
          <Text style={styles.label}>Prazo (Meses)</Text>
          <View style={styles.pillsContainer}>
            {availablePrazos.length > 0 ? availablePrazos.map((p: any, idx: number) => (
              <TouchableOpacity 
                key={idx} 
                style={[styles.pill, idx === prazoIdx && styles.pillActive]}
                onPress={() => setPrazoIdx(idx)}
              >
                <Text style={[styles.pillText, idx === prazoIdx && styles.pillTextActive]}>{p.prazo}x</Text>
              </TouchableOpacity>
            )) : (
              <Text style={styles.helperText}>Digite um crédito válido para ver os prazos.</Text>
            )}
          </View>
        </View>

        {/* 3. PREVISÃO DE CONTEMPLAÇÃO */}
        <View style={styles.card}>
           <View style={styles.rowBetween}>
             <Text style={styles.label}>Previsão de Contemplação (Mês)</Text>
             <CalendarDays color="#64748B" size={20} />
           </View>
           <TextInput 
             style={styles.input} 
             keyboardType="numeric" 
             placeholder="Ex: 4 (Padrão: 1º mês)" 
             value={mesContemplacaoInput}
             onChangeText={setMesContemplacaoInput}
             placeholderTextColor="#94A3B8"
           />
           <Text style={styles.helperText}>Informe em qual mês planeja ser contemplado.</Text>
        </View>

        {/* 4. TAXA DE ADESÃO */}
        <View style={styles.card}>
          <Text style={styles.label}>Taxa de Adesão (1ª Parcela)</Text>
          <View style={styles.pillsContainer}>
            {ADESAO_OPTIONS.map((opt) => (
              <TouchableOpacity 
                key={opt.value} 
                style={[styles.pill, adesaoPct === opt.value && styles.pillActive]}
                onPress={() => setAdesaoPct(opt.value)}
              >
                <Text style={[styles.pillText, adesaoPct === opt.value && styles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 5. SEGURO TOGGLE */}
        <View style={styles.card}>
          {isSeguroObrigatorio ? (
            <View style={styles.mandatoryContainer}>
              <View style={styles.mandatoryHeader}>
                 <ShieldCheck color="#0EA5E9" size={24} />
                 <Text style={styles.mandatoryTitle}>Seguro Prestamista Incluso</Text>
              </View>
              <Text style={styles.mandatoryText}>
                Nesta tabela, o seguro de vida já é obrigatório e está embutido no valor da parcela.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Seguro Prestamista</Text>
                <Switch 
                  value={tipoParcela === 'C/SV'}
                  onValueChange={(v) => setTipoParcela(v ? 'C/SV' : 'S/SV')}
                  trackColor={{true: '#0EA5E9', false: '#E2E8F0'}}
                />
              </View>
            </>
          )}
        </View>

        {/* BOTÃO DE CONFIGURAR LANCES */}
        <TouchableOpacity 
          style={[styles.lanceBtn, !selectedRow && styles.lanceBtnDisabled]} 
          onPress={() => {
            if (selectedRow) setShowLanceModal(true);
            else Alert.alert("Atenção", "Selecione um valor de crédito primeiro.");
          }}
          activeOpacity={selectedRow ? 0.7 : 1}
        >
          <View style={{flexDirection:'row', alignItems:'center'}}>
            {selectedRow ? (
               <DollarSign color="#0F172A" size={20} />
            ) : (
               <Lock color="#94A3B8" size={20} />
            )}
            <Text style={[styles.lanceBtnText, !selectedRow && {color: '#94A3B8'}]}>
              Configurar Lances
            </Text>
          </View>
          <Text style={styles.lanceBtnValue}>
            {totalLances > 0 ? `${totalLancePct.toFixed(1)}% (Total)` : 'Opcional'}
          </Text>
        </TouchableOpacity>

        {/* BOTÃO CALCULAR */}
        <TouchableOpacity style={styles.mainBtn} onPress={handleCalculate}>
          <Calculator color="#fff" size={24} style={{marginRight: 8}} />
          <Text style={styles.mainBtnText}>CALCULAR SIMULAÇÃO</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* --- MODAL DE LANCES --- */}
      <Modal visible={showLanceModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Configurar Lances</Text>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
            
            {/* 1. INPUTS DE VALORES */}
            <View style={styles.inputGroup}>
                <View style={styles.rowBetween}>
                    <Text style={styles.label}>Lance Embutido (R$)</Text>
                    <Text style={styles.limitText}>Máx: {formatCurrency(maxLancePermitido)} (25%)</Text>
                </View>
                <TextInput 
                    style={styles.input} 
                    keyboardType="numeric" 
                    value={lanceEmbInput}
                    onChangeText={handleChangeLanceEmbutido}
                    placeholder="0.00"
                />
                <View style={styles.quickBtnContainer}>
                    <Text style={styles.quickLabel}>Rápido:</Text>
                    {[0.10, 0.25].map(pct => (
                    <TouchableOpacity key={pct} style={styles.quickBtn} onPress={() => handleQuickLanceSelect(pct)}>
                        <Text style={styles.quickBtnText}>{pct*100}%</Text>
                    </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.inputGroup}>
                <View style={styles.rowBetween}>
                    <Text style={styles.label}>Lance Carta de Avaliação (R$)</Text>
                    <Car color="#64748B" size={20} />
                </View>
                <TextInput 
                    style={styles.input} 
                    keyboardType="numeric" 
                    value={lanceCartaInput}
                    onChangeText={setLanceCartaInput}
                    placeholder="Valor do veículo/imóvel usado"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Lance do Bolso (R$)</Text>
                <TextInput 
                    style={styles.input} 
                    keyboardType="numeric" 
                    value={lanceBolso}
                    onChangeText={setLanceBolso}
                    placeholder="Recursos próprios (Dinheiro)"
                />
            </View>

            {/* 2. DESTINO DO LANCE (COM SLIDER HÍBRIDO INTERATIVO) */}
            <View style={styles.inputGroup}>
               <View style={styles.rowBetween}>
                 <Text style={styles.label}>Destino do Lance</Text>
                 <PieChart color="#0F172A" size={20} />
               </View>
               
               <Text style={styles.helperText}>Use a barra (arraste) ou os botões para ajustar.</Text>

               {/* CONTROLE HÍBRIDO: Slider Interativo + Botões Laterais */}
               <View style={styles.sliderWrapper}>
                  {/* Botão Menos */}
                  <TouchableOpacity onPress={decrement} style={styles.roundBtnSmall} activeOpacity={0.6}>
                    <Minus size={16} color="#0F172A" />
                  </TouchableOpacity>

                  {/* SLIDER INTERATIVO */}
                  <InteractiveSlider 
                    value={percentualLanceParaParcela} 
                    onValueChange={setPercentualLanceParaParcela}
                    blocked={!limitInfo.isValid} 
                  />

                  {/* Botão Mais */}
                  <TouchableOpacity onPress={increment} style={styles.roundBtnSmall} activeOpacity={0.6}>
                    <Plus size={16} color="#0F172A" />
                  </TouchableOpacity>
               </View>
               
               <View style={styles.sliderLabelsContainer}>
                  <Text style={[styles.sliderLabelText, {color: '#64748B'}]}>Prazo ({100 - percentualLanceParaParcela}%)</Text>
                  <Text style={[styles.sliderLabelText, {color: !limitInfo.isValid ? '#EF4444' : '#0F172A', fontWeight: 'bold'}]}>
                     Parcela ({percentualLanceParaParcela}%)
                  </Text>
               </View>

               {/* BOTÕES DE ATALHO (PRESETS) */}
               <View style={styles.presetsRow}>
                  <TouchableOpacity onPress={() => setPreset(0)} style={[styles.presetBtn, percentualLanceParaParcela === 0 && styles.presetBtnActive]}>
                    <Text style={[styles.presetBtnText, percentualLanceParaParcela === 0 && styles.presetBtnTextActive]}>Prazo (0%)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setPreset(50)} style={[styles.presetBtn, percentualLanceParaParcela === 50 && styles.presetBtnActive]}>
                    <Text style={[styles.presetBtnText, percentualLanceParaParcela === 50 && styles.presetBtnTextActive]}>50/50</Text>
                  </TouchableOpacity>

                  {/* BOTÃO INTELIGENTE: MÁXIMO PERMITIDO */}
                  <TouchableOpacity 
                    onPress={() => setPreset(limitInfo.maxPermittedPct)} 
                    style={[styles.presetBtn, { borderColor: '#EAB308', backgroundColor: '#FEFCE8' }]}
                  >
                    <View style={{flexDirection:'row', alignItems:'center', gap: 4}}>
                        <Zap size={12} color="#CA8A04" fill="#CA8A04" />
                        <Text style={[styles.presetBtnText, {color: '#CA8A04'}]}>Máx ({limitInfo.maxPermittedPct}%)</Text>
                    </View>
                  </TouchableOpacity>
               </View>
               
               {/* Resumo da alocação */}
               {totalLances > 0 && (
                 <View style={[styles.allocationSummary, !limitInfo.isValid && styles.allocationError]}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.allocText}>
                            P/ Parcela: <Text style={{fontWeight:'bold'}}>{formatCurrency(totalLances * (percentualLanceParaParcela/100))}</Text>
                        </Text>
                        <Text style={styles.allocText}>
                            P/ Prazo: <Text style={{fontWeight:'bold'}}>{formatCurrency(totalLances * ((100-percentualLanceParaParcela)/100))}</Text>
                        </Text>
                    </View>

                    {!limitInfo.isValid && (
                        <View style={styles.errorBox}>
                            <AlertTriangle size={16} color="#EF4444" />
                            <Text style={styles.errorText}>{limitInfo.message}</Text>
                        </View>
                    )}
                 </View>
               )}
            </View>

          </ScrollView>

          {/* CARD DE RESUMO E CONFIRMAÇÃO */}
          <View style={styles.summaryCard}>
              <View style={styles.rowBetween}>
                  <Text style={styles.summaryLabel}>Total de Lances Ofertados:</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(totalLances)}</Text>
              </View>
              <View style={styles.rowBetween}>
                  <Text style={styles.summaryLabel}>Percentual do Crédito:</Text>
                  <Text style={[styles.summaryValue, { color: totalLancePct > 40 ? '#EAB308' : '#22C55E' }]}>
                      {totalLancePct.toFixed(2)}%
                  </Text>
              </View>
              
              <TouchableOpacity 
                style={[styles.mainBtn, {marginTop: 16}, !limitInfo.isValid && styles.mainBtnDisabled]} 
                onPress={() => {
                    if(limitInfo.isValid) setShowLanceModal(false);
                    else Alert.alert("Ajuste Necessário", "Diminua a porcentagem destinada à parcela ou use o botão 'Máx'.");
                }}
                activeOpacity={limitInfo.isValid ? 0.7 : 1}
              >
                  <Text style={styles.mainBtnText}>
                      {limitInfo.isValid ? "CONFIRMAR LANCES" : "AJUSTE O LANCE"}
                  </Text>
              </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  navHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { padding: 8, marginRight: 8 },
  navTitle: { fontSize: 18, fontWeight: '600', color: '#0F172A' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginBottom: 8 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 12, fontSize: 18, borderWidth: 1, borderColor: '#CBD5E1', color: '#0F172A' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { color: '#0284C7', fontWeight: '600', fontSize: 12 },
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' },
  pillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  pillText: { color: '#334155' },
  pillTextActive: { color: '#fff', fontWeight: 'bold' },
  helperText: { fontSize: 12, color: '#64748B', marginTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  lanceBtn: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  lanceBtnDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', opacity: 0.7 },
  lanceBtnText: { marginLeft: 12, fontSize: 16, fontWeight: '500', color: '#0F172A' },
  lanceBtnValue: { color: '#0F172A', fontWeight: 'bold' },
  
  mainBtn: { backgroundColor: '#0F172A', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  mainBtnDisabled: { backgroundColor: '#94A3B8' },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', padding: 20, textAlign: 'center', color: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  inputGroup: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  
  mandatoryContainer: { backgroundColor: '#F0F9FF', borderRadius: 8, padding: 12, borderLeftWidth: 4, borderLeftColor: '#0EA5E9' },
  mandatoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mandatoryTitle: { fontSize: 16, fontWeight: 'bold', color: '#0369A1', marginLeft: 8 },
  mandatoryText: { fontSize: 14, color: '#334155', lineHeight: 20 },

  limitText: { fontSize: 12, color: '#DC2626', fontWeight: '600', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  quickBtnContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  quickLabel: { fontSize: 14, color: '#64748B', marginRight: 4 },
  quickBtn: { backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  quickBtnText: { color: '#334155', fontWeight: '600', fontSize: 12 },

  summaryCard: { padding: 20, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: 30 },
  summaryLabel: { fontSize: 16, color: '#64748B' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },

  // ESTILOS DO SLIDER HÍBRIDO (ATUALIZADO)
  sliderWrapper: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
  roundBtnSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  sliderContainer: { flex: 1, height: 40, justifyContent: 'center' },
  sliderTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  sliderFill: { height: '100%', backgroundColor: '#0F172A' },
  sliderThumb: { position: 'absolute', width: 24, height: 24, backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, borderColor: '#0F172A', marginLeft: -12, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.2, elevation: 2, alignItems: 'center', justifyContent: 'center' },
  
  sliderLabelsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4, marginBottom: 8 },
  sliderLabelText: { fontSize: 12 },

  // ESTILOS DE PRESETS
  presetsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  presetBtnActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  presetBtnText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  presetBtnTextActive: { color: '#fff' },

  allocationSummary: { marginTop: 8, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8, borderTopWidth: 1, borderTopColor: '#DCFCE7' },
  allocationError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  allocText: { fontSize: 12, color: '#166534' },
  errorBox: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  errorText: { color: '#EF4444', fontSize: 11, flex: 1, fontWeight: '600' }
});