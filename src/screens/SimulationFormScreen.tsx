import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, 
  Alert, Switch, Modal, KeyboardAvoidingView, Platform, StatusBar,
  SafeAreaView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { 
  ArrowLeft, Calculator, DollarSign, ShieldCheck, Lock, 
  CalendarDays, PieChart, Percent, ChevronDown, X, Clock, Wand2, ChevronRight 
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

  // Scroll Ref para auto-scroll quando teclado abrir
  const scrollViewRef = useRef<ScrollView>(null);

  // --- STATES ---
  const [creditoInput, setCreditoInput] = useState('');
  const [prazoIdx, setPrazoIdx] = useState<number | null>(null);
  const [tipoParcela, setTipoParcela] = useState<InstallmentType>('S/SV');
  const [adesaoPct, setAdesaoPct] = useState(0);
  const [mesContemplacaoInput, setMesContemplacaoInput] = useState(''); 

  // --- STATES DE MODAL E LANCES ---
  const [showLanceModal, setShowLanceModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  
  const [lanceEmbInput, setLanceEmbInput] = useState(''); 
  const [lanceBolso, setLanceBolso] = useState('');       
  const [lanceCartaInput, setLanceCartaInput] = useState(''); 
  
  // --- STATES DE PERCENTUAL ---
  const [pctParaParcelaInput, setPctParaParcelaInput] = useState('0'); 
  const [pctParaPrazoInput, setPctParaPrazoInput] = useState('100'); 
  
  const percentualLanceParaParcela = parseFloat(pctParaParcelaInput) || 0;
  const percentualLanceParaPrazo = parseFloat(pctParaPrazoInput) || 0;

  // --- HELPERS E CÁLCULOS ---
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
    setPrazoIdx(null); 
    setLanceEmbInput('');
    setLanceBolso('');
    setLanceCartaInput('');
  }, [creditoInput]);

  const handleCurrencyChange = (text: string, setter: (val: string) => void) => {
      setter(formatCurrencyInput(text));
  };
  
  // --- LANCE EMBUTIDO ---
  const maxLancePermitido = selectedRow ? selectedRow.credito * table.maxLanceEmbutido : 0;
  
  const handleChangeLanceEmbutido = (text: string) => {
    const numericValue = parseCurrencyToFloat(text);
    if (numericValue > maxLancePermitido) {
      setLanceEmbInput(formatCurrencyInput(maxLancePermitido.toFixed(2).replace('.', '')));
      Alert.alert("Limite Atingido", `O lance embutido máximo é de ${(table.maxLanceEmbutido * 100).toFixed(0)}% (${formatCurrency(maxLancePermitido)}).`);
    } else {
      setLanceEmbInput(formatCurrencyInput(text));
    }
  };

  const handleQuickLanceSelect = (pct: number) => {
    if (!selectedRow) return;
    const val = selectedRow.credito * pct;
    const valString = (val * 100).toFixed(0); 
    
    if (pct <= table.maxLanceEmbutido) {
        setLanceEmbInput(formatCurrencyInput(valString));
    } else {
        const maxString = (maxLancePermitido * 100).toFixed(0);
        setLanceEmbInput(formatCurrencyInput(maxString));
    }
  };

  // --- SINC E VALIDAÇÃO DE PERCENTUAIS ---
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
      if (type === 'parcela') { setPctParaParcelaInput(limitedValue); setPctParaPrazoInput('0'); }
      else { setPctParaPrazoInput(limitedValue); setPctParaParcelaInput('0'); }
      return;
    }
    if (type === 'parcela') {
      setPctParaParcelaInput(text);
      if (text === '') setPctParaPrazoInput('100');
      else setPctParaPrazoInput(Math.min(100, Math.max(0, 100 - numericValue)).toString());
    } else { 
      setPctParaPrazoInput(text);
      if (text === '') setPctParaParcelaInput('0');
      else setPctParaParcelaInput(Math.min(100, Math.max(0, 100 - numericValue)).toString());
    }
  };

  const currentCredito = selectedRow ? selectedRow.credito : 0;
  const valLanceEmb = parseCurrencyToFloat(lanceEmbInput);
  const valLanceBolso = parseCurrencyToFloat(lanceBolso);
  const valLanceCarta = parseCurrencyToFloat(lanceCartaInput);
  
  const totalLances = valLanceEmb + valLanceBolso + valLanceCarta;
  const totalLancePct = currentCredito > 0 ? (totalLances / currentCredito) * 100 : 0;

  const dataEstimada = useMemo(() => {
    const mes = parseInt(mesContemplacaoInput);
    if (!mes || isNaN(mes)) return null;
    
    const hoje = new Date();
    const dataFutura = new Date(hoje.setMonth(hoje.getMonth() + mes));
    return dataFutura.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [mesContemplacaoInput]);

  const limitInfo = useMemo(() => {
    if (!currentParcelaValue || prazoIdx === null || totalLances === 0) {
        return { isValid: true, message: '', maxPermittedPct: 100 };
    }
    const prazoTotal = availablePrazos[prazoIdx].prazo;
    const rawMes = parseInt(mesContemplacaoInput) || 1;
    const mesPrevisto = Math.min(prazoTotal, Math.max(1, rawMes));
    const prazoRestante = Math.max(1, prazoTotal - mesPrevisto); 
    
    const maxReductionValuePerMonth = currentParcelaValue * 0.40; 
    const totalReductionCapacity = maxReductionValuePerMonth * prazoRestante; 
    let maxPermittedPct = (totalReductionCapacity / totalLances) * 100;
    maxPermittedPct = Math.min(100, maxPermittedPct); 

    return { 
        isValid: true, 
        message: '', 
        maxPermittedPct: Math.floor(maxPermittedPct)
    };
  }, [percentualLanceParaParcela, totalLances, currentParcelaValue, prazoIdx, mesContemplacaoInput, availablePrazos]);

  const handleSetMaxPct = () => {
    if (totalLances === 0 || prazoIdx === null) {
        Alert.alert("Atenção", "Preencha o crédito, prazo e lances.");
        return;
    }
    const maxPct = limitInfo.maxPermittedPct;
    setPctParaParcelaInput(maxPct.toString());
    setPctParaPrazoInput((100 - maxPct).toString());
  };

  const handleSelectCredit = (value: number) => {
    setCreditoInput(value.toString());
    setShowCreditModal(false);
  };

  const handleCalculate = () => {
    if (!selectedRow || prazoIdx === null) {
      Alert.alert("Dados incompletos", "Por favor, selecione um crédito válido e um prazo.");
      return;
    }
    if(!currentParcelaValue) {
       Alert.alert("Erro", "Parcela não disponível.");
       return;
    }

    const prazoTotal = availablePrazos[prazoIdx].prazo;
    let mesContemplacao = parseInt(mesContemplacaoInput) || 1; 
    
    if (mesContemplacao > prazoTotal) {
      Alert.alert("Mês Inválido", `O mês de contemplação não pode ser superior ao prazo do plano (${prazoTotal} meses).`);
      return;
    }
    mesContemplacao = Math.max(1, mesContemplacao);

    const prazoRestante = Math.max(1, prazoTotal - mesContemplacao);
    const saldoDevedorEstimado = currentParcelaValue * prazoRestante;

    if (totalLances > saldoDevedorEstimado + 10) {
        Alert.alert(
            "Simulação Inválida",
            `Lance (${formatCurrency(totalLances)}) supera o saldo devedor (${formatCurrency(saldoDevedorEstimado)}).`
        );
        return;
    }

    const lanceEmbPctCalculado = selectedRow.credito > 0 ? valLanceEmb / selectedRow.credito : 0;

    const input: SimulationInput = {
      tableId: table.id,
      credito: selectedRow.credito,
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
    navigation.navigate('Result', { result, input });
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* CABEÇALHO FIXO */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Simular {table.category}</Text>
          <Text style={styles.headerSubtitle}>{table.name}</Text>
        </View>
      </View>

      {/* WRAPPER PARA CORRIGIR TECLADO */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" // Importante para permitir toque em botões com teclado aberto
        >
          
          {/* CARD CRÉDITO */}
          <View style={styles.card}>
            <Text style={styles.label}>Valor do Crédito</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowCreditModal(true)}
              activeOpacity={0.7}
            >
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={[styles.selectText, !creditoInput && {color: '#94A3B8'}]}>
                    {creditoInput ? formatCurrency(parseFloat(creditoInput)) : 'Toque para selecionar'}
                </Text>
              </View>
              <ChevronDown color="#64748B" size={20} />
            </TouchableOpacity>
          </View>

          {/* CARD PRAZO */}
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
                  <Text style={[styles.pillText, idx === prazoIdx && styles.pillTextActive]}>
                    {p.prazo}x
                  </Text>
                </TouchableOpacity>
              )) : (
                <Text style={styles.helperText}>Selecione um crédito válido acima.</Text>
              )}
            </View>
          </View>
          
          {/* BOTÃO DE LANCES */}
          <TouchableOpacity 
            style={[styles.lanceCard, !selectedRow && styles.disabledCard]} 
            onPress={() => {
              if (selectedRow) setShowLanceModal(true);
              else Alert.alert("Atenção", "Selecione um valor de crédito primeiro.");
            }}
            activeOpacity={selectedRow ? 0.7 : 1}
            disabled={!creditoInput}
          >
            <View style={styles.lanceIconBox}>
              {selectedRow ? <DollarSign color="#2563EB" size={24} /> : <Lock color="#94A3B8" size={24} />}
            </View>
            
            <View style={{flex: 1}}>
              <Text style={[styles.cardTitle, !selectedRow && {color: '#94A3B8'}]}>Configurar Lances</Text>
              <Text style={styles.cardSubtitle}>
                  {totalLances > 0 
                    ? `Total: ${formatCurrency(totalLances)} (${totalLancePct.toFixed(1)}%)` 
                    : 'Nenhum lance ofertado (Opcional)'}
              </Text>
            </View>
            
            <ChevronRight color="#CBD5E1" size={20} />
          </TouchableOpacity>

          {/* TAXA DE ADESÃO */}
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
          
          {/* CARD DE PREVISÃO DE CONTEMPLAÇÃO (MOVIDO PARA CÁ) */}
          <View style={styles.contemplationCard}>
            <View style={styles.contemplationHeader}>
                <CalendarDays color="#fff" size={20} />
                <Text style={styles.contemplationTitle}>Quando deseja ser contemplado?</Text>
            </View>
            
            <View style={styles.contemplationBody}>
                {/* Input com auto-scroll */}
                <View style={styles.contemplationInputWrapper}>
                    <TextInput 
                      style={styles.contemplationInput}
                      keyboardType="numeric" 
                      placeholder="1" 
                      value={mesContemplacaoInput}
                      onChangeText={setMesContemplacaoInput}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      maxLength={3}
                      // CORREÇÃO DE TECLADO: Rola para o fundo ao focar
                      onFocus={() => {
                        setTimeout(() => {
                           scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 250);
                      }}
                    />
                    <Text style={styles.contemplationSuffix}>º mês</Text>
                </View>
                
                {dataEstimada && (
                    <View style={styles.dateProjection}>
                        <Clock size={16} color="#64748B" style={{marginRight: 8}} />
                        {/* Flex: 1 para permitir quebra de linha do texto */}
                        <Text style={styles.dateProjectionText}>
                            Estimado para:{'\n'}
                            <Text style={{fontWeight: '700', color: '#2563EB', fontSize: 13}}>
                              {dataEstimada.charAt(0).toUpperCase() + dataEstimada.slice(1)}
                            </Text>
                        </Text>
                    </View>
                )}
            </View>
            <Text style={styles.contemplationHelper}>
              Calcularemos a amortização a partir deste mês.
            </Text>
          </View>

          {/* SEGURO (MOVIDO PARA O FINAL) */}
          <View style={styles.card}>
            {isSeguroObrigatorio ? (
              <View style={styles.mandatoryBox}>
                <View style={styles.mandatoryHeader}>
                  <ShieldCheck color="#0EA5E9" size={20} style={{marginRight: 8}} />
                  <Text style={styles.mandatoryTitle}>Seguro Incluso</Text>
                </View>
                <Text style={styles.mandatoryDesc}>
                  O seguro prestamista é obrigatório nesta tabela e já compõe o valor da parcela.
                </Text>
              </View>
            ) : (
              <View style={styles.switchRow}>
                <View>
                    <Text style={styles.label}>Seguro Prestamista</Text>
                    <Text style={styles.helperText}>Proteção para o consorciado</Text>
                </View>
                <Switch 
                  value={tipoParcela === 'C/SV'}
                  onValueChange={(v) => setTipoParcela(v ? 'C/SV' : 'S/SV')}
                  trackColor={{true: '#0EA5E9', false: '#E2E8F0'}}
                  thumbColor={'#fff'}
                />
              </View>
            )}
          </View>

          {/* ESPAÇO EXTRA PARA TECLADO NÃO COBRIR O ÚLTIMO CARD */}
          <View style={{height: 120}} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BOTÃO CALCULAR */}
      <View style={styles.footerContainer}>
        <TouchableOpacity 
            style={[styles.mainBtn, !limitInfo.isValid && styles.mainBtnDisabled]} 
            onPress={handleCalculate} 
            disabled={!limitInfo.isValid}
        >
          <Calculator color="#fff" size={24} style={{marginRight: 8}} />
          <Text style={styles.mainBtnText}>CALCULAR SIMULAÇÃO</Text>
        </TouchableOpacity>
      </View>


      {/* --- MODAL CRÉDITO --- */}
      <Modal visible={showCreditModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreditModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
             <Text style={styles.modalTitle}>Selecione o Crédito</Text>
             <TouchableOpacity onPress={() => setShowCreditModal(false)} style={styles.closeModalBtn}>
                <X color="#64748B" size={24} />
             </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {availableCredits.map((credit, index) => (
              <TouchableOpacity key={index} style={[styles.modalOption, parseFloat(creditoInput) === credit && styles.modalOptionActive]} onPress={() => handleSelectCredit(credit)}>
                <Text style={parseFloat(creditoInput) === credit ? styles.modalOptionTextActive : styles.modalOptionText}>{formatCurrency(credit)}</Text>
                {parseFloat(creditoInput) === credit && <View style={styles.activeDot} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* --- MODAL LANCES --- */}
      <Modal visible={showLanceModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowLanceModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
             <Text style={styles.modalTitle}>Configurar Lances</Text>
             <TouchableOpacity onPress={() => setShowLanceModal(false)} style={styles.closeModalBtn}>
                <X color="#64748B" size={24} />
             </TouchableOpacity>
          </View>
          
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{padding: 20, paddingBottom: 20}} 
            style={{ flex: 1 }}
          >
            
            {/* LANCE EMBUTIDO COM OPÇÃO 0% */}
            <View style={styles.lanceSection}>
                <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Lance Embutido</Text>
                    <View style={styles.badge}>
                       <Text style={styles.badgeText}>Máx: {formatCurrency(maxLancePermitido)}</Text>
                    </View>
                </View>
                <TextInput 
                    style={styles.textInputMoney} 
                    keyboardType="numeric" 
                    value={lanceEmbInput} 
                    onChangeText={(t) => handleChangeLanceEmbutido(t)} 
                    placeholder="R$ 0,00" 
                    placeholderTextColor="#94A3B8"
                />
                <View style={styles.quickTags}>
                    {/* ADICIONADO 0% NA LISTA DE FILTRO */}
                    {[0, 0.10, 0.25, 0.30].filter(p => p <= table.maxLanceEmbutido || p === 0).map(pct => (
                        <TouchableOpacity key={pct} style={styles.quickTag} onPress={() => handleQuickLanceSelect(pct)}>
                            <Text style={styles.quickTagText}>{(pct*100).toFixed(0)}%</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* LANCE DO BOLSO */}
            <View style={styles.lanceSection}>
                <Text style={styles.sectionTitle}>Lance do Bolso (Recursos Próprios)</Text>
                <TextInput 
                    style={styles.textInputMoney} 
                    keyboardType="numeric" 
                    value={lanceBolso} 
                    onChangeText={(t) => handleCurrencyChange(t, setLanceBolso)} 
                    placeholder="R$ 0,00" 
                    placeholderTextColor="#94A3B8"
                />
            </View>

             {/* LANCE CARTA */}
             <View style={styles.lanceSection}>
                <Text style={styles.sectionTitle}>Lance Carta de Avaliação (Bem)</Text>
                <TextInput 
                    style={styles.textInputMoney} 
                    keyboardType="numeric" 
                    value={lanceCartaInput} 
                    onChangeText={(t) => handleCurrencyChange(t, setLanceCartaInput)} 
                    placeholder="R$ 0,00" 
                    placeholderTextColor="#94A3B8"
                />
            </View>

            {/* DESTINO DO LANCE */}
            <View style={styles.allocationCard}>
               <View style={styles.rowStart}>
                 <PieChart color="#0F172A" size={18} style={{marginRight: 8}} />
                 <Text style={styles.allocationTitle}>Destino do Lance (Total: 100%)</Text>
               </View>
               <Text style={styles.allocationDesc}>
                  Defina quanto do lance será usado para reduzir o prazo ou o valor da parcela.
               </Text>

               <View style={styles.percentRow}>
                   <View style={{flex: 1}}>
                       <Text style={styles.percentLabel}>Reduzir Prazo</Text>
                       <View style={styles.percentInputWrapper}>
                           <TextInput style={styles.percentInput} keyboardType="numeric" value={pctParaPrazoInput} onChangeText={(text) => handlePercentualChange(text, 'prazo')} placeholder="0" />
                           <Percent size={14} color="#64748B" />
                       </View>
                   </View>

                   <View style={{flex: 1}}>
                       <Text style={styles.percentLabel}>Reduzir Parcela</Text>
                       <View style={styles.percentInputWrapper}>
                           <TextInput style={styles.percentInput} keyboardType="numeric" value={pctParaParcelaInput} onChangeText={(text) => handlePercentualChange(text, 'parcela')} placeholder="0" />
                           <Percent size={14} color="#64748B" />
                       </View>
                       {/* BOTÃO 'USAR MÁX' DESTACADO */}
                       {totalLances > 0 && (
                            <TouchableOpacity style={styles.useMaxBtnHighlight} onPress={handleSetMaxPct}>
                                <Wand2 size={12} color="#fff" style={{marginRight: 4}}/>
                                <Text style={styles.useMaxTextHighlight}>Usar Máx ({limitInfo.maxPermittedPct}%)</Text>
                            </TouchableOpacity>
                       )}
                   </View>
               </View>
               
               {totalLances > 0 && (
                 <View style={styles.summaryBox}>
                    <Text style={styles.summaryText}>P/ Prazo: <Text style={{fontWeight:'bold'}}>{formatCurrency(totalLances * (percentualLanceParaPrazo/100))}</Text></Text>
                    <Text style={styles.summaryText}>P/ Parcela: <Text style={{fontWeight:'bold'}}>{formatCurrency(totalLances * (percentualLanceParaParcela/100))}</Text></Text>
                 </View>
               )}
            </View>

          </ScrollView>

          <View style={[styles.footerContainer, { position: 'relative' }]}>
             <View style={styles.rowBetween}>
                <View>
                    <Text style={styles.footerLabel}>Total Lances</Text>
                    <Text style={styles.footerTotal}>{formatCurrency(totalLances)}</Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                     <Text style={styles.footerLabel}>% do Crédito</Text>
                     <Text style={[styles.footerPct, {color: totalLancePct > 30 ? '#16A34A' : '#EAB308'}]}>{totalLancePct.toFixed(2)}%</Text>
                </View>
             </View>
             
              <TouchableOpacity style={[styles.mainBtn, {marginTop: 16}]} onPress={() => setShowLanceModal(false)}>
                  <Text style={styles.mainBtnText}>CONFIRMAR</Text>
              </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  
  // HEADER
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    // Ajuste seguro para não sobrepor a câmera/status bar
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 60, 
    paddingBottom: 24, 
    backgroundColor: '#F8FAFC' 
  },
  backBtn: { marginRight: 16, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  headerSubtitle: { fontSize: 14, color: '#64748B', marginTop: 2 },

  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

  // CARDS
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  label: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  
  // SELECT INPUT
  selectInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  selectText: { fontSize: 16, fontWeight: '600', color: '#0F172A' },

  // PILLS
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8FAFC' },
  pillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  pillText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  pillTextActive: { color: '#FFFFFF' },
  helperText: { fontSize: 13, color: '#94A3B8', marginTop: 8 },

  // LANCE CARD (Moderno)
  lanceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  disabledCard: { opacity: 0.6, backgroundColor: '#F8FAFC' },
  lanceIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  cardSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },

  // CARD CONTEMPLAÇÃO REDESENHADO
  contemplationCard: { 
    backgroundColor: '#0F172A', 
    borderRadius: 20, 
    padding: 24, 
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6
  },
  contemplationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  contemplationTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  // Body agora permite melhor distribuição
  contemplationBody: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 16 
  },
  
  contemplationInputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  contemplationInput: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '800', 
    width: 40, 
    textAlign: 'center', 
    padding: 0 
  },
  contemplationSuffix: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600', marginLeft: 2 },
  
  // Box da data redesenhado para não vazar texto
  dateProjection: { 
    flex: 1, 
    marginLeft: 16,
    backgroundColor: '#FFFFFF', // Fundo branco para destaque
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: {width: 0, height: 2},
    elevation: 2
  },
  dateProjectionText: { 
    color: '#64748B', 
    fontSize: 10, 
    fontWeight: '600',
    flexShrink: 1, // Permite encolher se necessário
    flexWrap: 'wrap' // Permite quebra de linha
  },
  contemplationHelper: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18, marginTop: 4 },

  // INPUTS DE MOEDA
  textInputMoney: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 18, 
    fontWeight: '600',
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    color: '#0F172A' 
  },
  
  // SWITCH AREA
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  // MANDATORY BOX
  mandatoryBox: { backgroundColor: '#F0F9FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD' },
  mandatoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mandatoryTitle: { fontSize: 14, fontWeight: '700', color: '#0369A1' },
  mandatoryDesc: { fontSize: 13, color: '#0C4A6E', lineHeight: 20 },

  // FOOTER BUTTON
  footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  mainBtn: { backgroundColor: '#0F172A', borderRadius: 16, paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  mainBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0 },
  mainBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  // MODAL STYLES
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  closeModalBtn: { padding: 4 },
  
  modalOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalOptionActive: { backgroundColor: '#F8FAFC' },
  modalOptionText: { fontSize: 16, color: '#334155' },
  modalOptionTextActive: { fontSize: 16, fontWeight: '700', color: '#2563EB' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },

  // LANCE MODAL INTERNALS
  lanceSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#EF4444', fontSize: 11, fontWeight: '700' },
  
  quickTags: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE' },
  quickTagText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },

  allocationCard: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  rowStart: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  allocationTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  allocationDesc: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  
  percentRow: { flexDirection: 'row', gap: 16 },
  percentLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6 },
  percentInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12 },
  percentInput: { flex: 1, paddingVertical: 10, fontSize: 16, color: '#0F172A', fontWeight: '600' },
  
  // ESTILO NOVO PARA BOTÃO 'USAR MÁX'
  useMaxBtnHighlight: { 
    marginTop: 8, 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB', // Blue 600
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  useMaxTextHighlight: { 
    fontSize: 11, 
    color: '#FFFFFF', 
    fontWeight: '700' 
  },
  
  summaryBox: { marginTop: 16, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10, borderTopWidth: 1, borderTopColor: '#BBF7D0', gap: 4 },
  summaryText: { fontSize: 13, color: '#166534' },

  footerLabel: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  footerTotal: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  footerPct: { fontSize: 16, fontWeight: '700' }
});