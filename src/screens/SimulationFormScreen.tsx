import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, SafeAreaView, Alert, Switch, Modal, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Calculator, DollarSign, ShieldCheck, Lock, Car, CalendarDays, PieChart, AlertTriangle, Percent, ChevronDown } from 'lucide-react-native';
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

export default function SimulationFormScreen({ route, navigation }: Props) {
  const { table } = route.params;
  const rawData = getTableData(table.id);

  // --- STATES DE ENTRADA BÁSICA ---
  const [creditoInput, setCreditoInput] = useState('');
  const [prazoIdx, setPrazoIdx] = useState<number | null>(null);
  const [tipoParcela, setTipoParcela] = useState<InstallmentType>('S/SV');
  const [adesaoPct, setAdesaoPct] = useState(0);
  const [mesContemplacaoInput, setMesContemplacaoInput] = useState(''); 

  // --- STATES DE MODAL E LANCES ---
  const [showLanceModal, setShowLanceModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false); // NOVO STATE PARA MODAL DE CRÉDITO
  const [lanceEmbInput, setLanceEmbInput] = useState(''); 
  const [lanceBolso, setLanceBolso] = useState('');
  const [lanceCartaInput, setLanceCartaInput] = useState('');
  
  // --- STATES DE PERCENTUAL (AGORA EM TEXTO) ---
  const [pctParaParcelaInput, setPctParaParcelaInput] = useState('0'); 
  const [pctParaPrazoInput, setPctParaPrazoInput] = useState('100'); 
  
  // Conversão de texto para número
  const percentualLanceParaParcela = parseFloat(pctParaParcelaInput) || 0;
  const percentualLanceParaPrazo = parseFloat(pctParaPrazoInput) || 0;

  // --- HELPERS ---
  // Obtém e ordena os créditos disponíveis da tabela
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

  // Limpa estados dependentes quando o crédito é alterado
  useEffect(() => {
    setPrazoIdx(null); // Limpa prazo
    setLanceEmbInput('');
    setLanceBolso('');
    setLanceCartaInput('');
  }, [creditoInput]);
  
  // --- FUNÇÕES DE LANCE EMBUTIDO ---
  const maxLancePermitido = selectedRow ? selectedRow.credito * table.maxLanceEmbutido : 0;
  
  const handleChangeLanceEmbutido = (text: string) => {
    const numericValue = parseFloat(text) || 0;
    if (numericValue > maxLancePermitido) {
      setLanceEmbInput(maxLancePermitido.toFixed(2));
      Alert.alert("Limite Atingido", `O lance embutido máximo é de ${(table.maxLanceEmbutido * 100).toFixed(0)}% (${maxLancePermitido.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}).`);
    } else {
      setLanceEmbInput(text);
    }
  };

  const handleQuickLanceSelect = (pct: number) => {
    if (!selectedRow) return;
    const val = selectedRow.credito * pct;
    if (pct <= table.maxLanceEmbutido) {
        setLanceEmbInput(val.toFixed(2));
    } else {
        setLanceEmbInput(maxLancePermitido.toFixed(2));
    }
  };
  // ---------------------------------------------------


  // --- LÓGICA DE SINCRONIZAÇÃO E VALIDAÇÃO DE PERCENTUAIS ---

  useEffect(() => {
    const pctParcela = parseFloat(pctParaParcelaInput) || 0;
    const pctPrazo = parseFloat(pctParaPrazoInput) || 0;

    if (pctParcela + pctPrazo !== 100) {
        if (pctParaParcelaInput !== '' && pctParaParcelaInput !== '100' && pctParaParcelaInput !== '0') {
            const newPrazo = Math.min(100, Math.max(0, 100 - pctParcela));
            setPctParaPrazoInput(newPrazo.toString());
        } 
        else if (pctParaPrazoInput !== '' && pctParaPrazoInput !== '100' && pctParaPrazoInput !== '0') {
            const newParcela = Math.min(100, Math.max(0, 100 - pctPrazo));
            setPctParaParcelaInput(newParcela.toString());
        }
    }
  }, [pctParaParcelaInput, pctParaPrazoInput]);

  const handlePercentualChange = (text: string, type: 'parcela' | 'prazo') => {
    const numericValue = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
    
    if (numericValue > 100) {
      const limitedValue = '100';
      if (type === 'parcela') {
        setPctParaParcelaInput(limitedValue);
        setPctParaPrazoInput('0');
      } else {
        setPctParaPrazoInput(limitedValue);
        setPctParaParcelaInput('0');
      }
      return;
    }

    if (type === 'parcela') {
      setPctParaParcelaInput(text);
      if (text === '') {
          setPctParaPrazoInput('100');
      } else {
          const newPrazo = Math.min(100, Math.max(0, 100 - numericValue));
          setPctParaPrazoInput(newPrazo.toString());
      }
    } else { // type === 'prazo'
      setPctParaPrazoInput(text);
      if (text === '') {
          setPctParaParcelaInput('0');
      } else {
          const newParcela = Math.min(100, Math.max(0, 100 - numericValue));
          setPctParaParcelaInput(newParcela.toString());
      }
    }
  };


  // --- CÁLCULOS DE LANCES E VALIDAÇÃO ---
  const currentCredito = selectedRow ? selectedRow.credito : 0;
  const currentLanceEmb = parseFloat(lanceEmbInput) || 0;
  const currentLanceBolso = parseFloat(lanceBolso) || 0;
  const currentLanceCarta = parseFloat(lanceCartaInput) || 0;
  const totalLances = currentLanceEmb + currentLanceBolso + currentLanceCarta;
  const totalLancePct = currentCredito > 0 ? (totalLances / currentCredito) * 100 : 0;

  const limitInfo = useMemo(() => {
    const pctParaParcela = parseFloat(pctParaParcelaInput) || 0;

    if (!currentParcelaValue || prazoIdx === null || totalLances === 0) {
        return { isValid: true, message: '', maxPermittedPct: 100 };
    }

    const prazoTotal = availablePrazos[prazoIdx].prazo;
    const mesPrevisto = parseInt(mesContemplacaoInput) || 1;
    const prazoRestante = Math.max(1, prazoTotal - mesPrevisto); 
    
    const maxReductionValuePerMonth = currentParcelaValue * 0.40; 
    const totalReductionCapacity = maxReductionValuePerMonth * prazoRestante; 
    let maxPermittedPct = (totalReductionCapacity / totalLances) * 100;
    maxPermittedPct = Math.min(100, maxPermittedPct); 
    
    const isValid = pctParaParcela <= maxPermittedPct + 0.01;
    const message = !isValid 
        ? `Redução excessiva! O máximo permitido é ${Math.floor(maxPermittedPct)}% do lance, respeitando o limite de 40% da parcela.` 
        : '';

    return { 
        isValid, 
        message, 
        maxPermittedPct: Math.floor(maxPermittedPct)
    };
  }, [percentualLanceParaParcela, totalLances, currentParcelaValue, prazoIdx, mesContemplacaoInput, availablePrazos]);

  const handleSetMaxPct = () => {
    if (totalLances === 0 || prazoIdx === null) {
        Alert.alert("Atenção", "Preencha o crédito, prazo e lances para calcular o máximo permitido.");
        return;
    }
    const maxPct = limitInfo.maxPermittedPct;
    const newPrazoPct = 100 - maxPct;
    setPctParaParcelaInput(maxPct.toString());
    setPctParaPrazoInput(newPrazoPct.toString());
  };

  // --- FUNÇÃO PARA ATUALIZAR CRÉDITO NO MODAL ---
  const handleSelectCredit = (value: number) => {
    setCreditoInput(value.toString());
    setShowCreditModal(false);
  };
  // ---------------------------------------------


  // Função principal de cálculo
  const handleCalculate = () => {
    if (!selectedRow || prazoIdx === null) {
      Alert.alert("Dados incompletos", "Por favor, selecione um crédito válido e um prazo.");
      return;
    }
    if(!currentParcelaValue) {
       Alert.alert("Erro", "Parcela não disponível.");
       return;
    }
    if (!limitInfo.isValid) {
      Alert.alert("Ajuste Necessário", limitInfo.message);
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
      percentualLanceParaParcela, 
      taxaAdesaoPct: adesaoPct,
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
        {/* 1. VALOR DO CRÉDITO (SUBSTITUÍDO PELO SELECTOR) */}
        <View style={styles.card}>
          <Text style={styles.label}>Valor do Crédito (R$)</Text>
          <TouchableOpacity 
            style={styles.selectInput}
            onPress={() => setShowCreditModal(true)}
          >
            <Text style={creditoInput ? styles.selectText : styles.selectPlaceholder}>
              {creditoInput ? formatCurrency(parseFloat(creditoInput)) : 'Selecione o valor do crédito'}
            </Text>
            <ChevronDown color="#94A3B8" size={20} />
          </TouchableOpacity>
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
                disabled={!creditoInput}
              >
                <Text style={[styles.pillText, idx === prazoIdx && styles.pillTextActive]}>{p.prazo}x</Text>
              </TouchableOpacity>
            )) : (
              <Text style={styles.helperText}>Selecione um crédito válido para ver os prazos.</Text>
            )}
          </View>
        </View>
        
        {/* 3. BOTÃO DE CONFIGURAR LANCES */}
        <TouchableOpacity 
          style={[styles.lanceBtn, !selectedRow && styles.lanceBtnDisabled]} 
          onPress={() => {
            if (selectedRow) setShowLanceModal(true);
            else Alert.alert("Atenção", "Selecione um valor de crédito primeiro.");
          }}
          activeOpacity={selectedRow ? 0.7 : 1}
          disabled={!creditoInput} // Desabilita se não houver crédito selecionado
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


        {/* 6. PREVISÃO DE CONTEMPLAÇÃO */}
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


        {/* BOTÃO CALCULAR */}
        <TouchableOpacity style={styles.mainBtn} onPress={handleCalculate} disabled={!limitInfo.isValid}>
          <Calculator color="#fff" size={24} style={{marginRight: 8}} />
          <Text style={styles.mainBtnText}>CALCULAR SIMULAÇÃO</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* --- MODAL DE SELEÇÃO DE CRÉDITO (NOVO) --- */}
      <Modal
        visible={showCreditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreditModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Selecione o Crédito</Text>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {availableCredits.map((credit, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.creditOption,
                  parseFloat(creditoInput) === credit && styles.creditOptionActive,
                ]}
                onPress={() => handleSelectCredit(credit)}
              >
                <Text style={parseFloat(creditoInput) === credit ? styles.creditTextActive : styles.creditText}>
                  {formatCurrency(credit)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity 
            style={[styles.mainBtn, {margin: 20}]}
            onPress={() => setShowCreditModal(false)}
          >
            <Text style={styles.mainBtnText}>FECHAR</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* --- MODAL DE LANCES --- */}
      <Modal 
        visible={showLanceModal} 
        animationType="slide" 
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanceModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Configurar Lances</Text>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
            
            {/* 1. INPUTS DE VALORES */}
            <View style={styles.inputGroup}>
                <View style={styles.rowBetween}>
                    <Text style={styles.label}>Lance Embutido (R$)</Text>
                    <Text style={styles.limitText}>Máx: {formatCurrency(maxLancePermitido)} ({ (table.maxLanceEmbutido * 100).toFixed(0) }%)</Text>
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

            {/* 2. DESTINO DO LANCE (AGORA COM DOIS INPUTS) */}
            <View style={[styles.inputGroup, !limitInfo.isValid && styles.allocationError]}>
               <View style={styles.rowBetween}>
                 <Text style={styles.label}>Destino do Lance (Total: 100%)</Text>
                 <PieChart color="#0F172A" size={20} />
               </View>
               
               <Text style={styles.helperText}>A soma dos percentuais deve ser 100%. Máx. 40% de redução na parcela.</Text>

               <View style={styles.percentInputRow}>
                   {/* INPUT PERCENTUAL PARA PRAZO */}
                   <View style={styles.percentInputBox}>
                       <Text style={styles.percentLabel}>Abater no Prazo (Meses)</Text>
                       <View style={styles.inputWithIcon}>
                           <TextInput 
                               style={styles.percentInput} 
                               keyboardType="numeric" 
                               value={pctParaPrazoInput}
                               onChangeText={(text) => handlePercentualChange(text, 'prazo')}
                               placeholder="0 - 100"
                           />
                           <Percent size={18} color="#64748B" style={styles.percentIcon} />
                       </View>
                   </View>

                   {/* INPUT PERCENTUAL PARA PARCELA */}
                   <View style={styles.percentInputBox}>
                       <Text style={styles.percentLabel}>Abater na Parcela (Valor)</Text>
                       <View style={styles.inputWithIcon}>
                           <TextInput 
                               style={[styles.percentInput, !limitInfo.isValid && styles.errorInput]} 
                               keyboardType="numeric" 
                               value={pctParaParcelaInput}
                               onChangeText={(text) => handlePercentualChange(text, 'parcela')}
                               placeholder="0 - 100"
                           />
                           <Percent size={18} color="#64748B" style={styles.percentIcon} />
                       </View>
                       {/* BOTÃO DE MÁXIMO PERMITIDO */}
                       {totalLances > 0 && (
                            <TouchableOpacity 
                                style={styles.maxPctButton} 
                                onPress={handleSetMaxPct}
                            >
                                <Text style={styles.maxPctButtonText}>
                                    Usar Máx. ({limitInfo.maxPermittedPct}%)
                                </Text>
                            </TouchableOpacity>
                       )}
                   </View>
               </View>
               
               {/* Resumo da alocação e Validação */}
               {totalLances > 0 && (
                 <View style={styles.allocationSummary}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.allocText}>
                            P/ Prazo ({percentualLanceParaPrazo.toFixed(0)}%): <Text style={{fontWeight:'bold'}}>{formatCurrency(totalLances * (percentualLanceParaPrazo/100))}</Text>
                        </Text>
                    </View>
                    <View style={[styles.rowBetween, {marginTop: 4}]}>
                        <Text style={styles.allocText}>
                            P/ Parcela ({percentualLanceParaParcela.toFixed(0)}%): <Text style={{fontWeight:'bold'}}>{formatCurrency(totalLances * (percentualLanceParaParcela/100))}</Text>
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
                    else Alert.alert("Ajuste Necessário", limitInfo.message);
                }}
                activeOpacity={limitInfo.isValid ? 0.7 : 1}
                disabled={!limitInfo.isValid}
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
  
  // NOVO ESTILO PARA O INPUT DE SELEÇÃO
  selectInput: { 
    backgroundColor: '#F1F5F9', 
    borderRadius: 8, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#CBD5E1', 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
  },
  selectText: { fontSize: 18, color: '#0F172A', fontWeight: 'bold' },
  selectPlaceholder: { fontSize: 18, color: '#94A3B8' },
  
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
  
  lanceBtn: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16,
    alignItems: 'center', 
    borderWidth: 2,
    borderColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  lanceBtnDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', opacity: 0.7, shadowColor: 'transparent', elevation: 0 },
  lanceBtnText: { marginLeft: 12, fontSize: 16, fontWeight: '700', color: '#0F172A' },
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

  percentInputRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginTop: 8 },
  percentInputBox: { flex: 1 },
  percentLabel: { fontSize: 12, color: '#64748B', marginBottom: 4, fontWeight: '500' },
  percentInput: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8, padding: 12, paddingRight: 40, fontSize: 16, borderWidth: 1, borderColor: '#CBD5E1', color: '#0F172A', textAlign: 'right' },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center' },
  percentIcon: { position: 'absolute', right: 12 },
  errorInput: { borderColor: '#EF4444', borderWidth: 2 },
  
  maxPctButton: { 
    backgroundColor: '#E0F2FE', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 8, 
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  maxPctButtonText: { 
    color: '#0284C7', 
    fontWeight: 'bold', 
    fontSize: 12 
  },
  
  allocationSummary: { marginTop: 16, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8, borderTopWidth: 1, borderTopColor: '#DCFCE7' },
  allocationError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  allocText: { fontSize: 14, color: '#166534' },
  errorBox: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center', padding: 4 },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1, fontWeight: '600' },

  // ESTILOS DO NOVO MODAL DE CRÉDITO
  creditOption: { 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0', 
    backgroundColor: '#fff',
  },
  creditOptionActive: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  creditText: {
    fontSize: 16,
    color: '#0F172A',
  },
  creditTextActive: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  }
});