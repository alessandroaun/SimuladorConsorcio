import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, SafeAreaView, Alert, Switch, Modal } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Calculator, DollarSign, ShieldCheck, Lock } from 'lucide-react-native';
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

  // States
  const [creditoInput, setCreditoInput] = useState('');
  const [prazoIdx, setPrazoIdx] = useState<number | null>(null);
  const [tipoParcela, setTipoParcela] = useState<InstallmentType>('S/SV');
  const [adesaoPct, setAdesaoPct] = useState(0);
  
  // Lance States
  const [showLanceModal, setShowLanceModal] = useState(false);
  
  // Agora controlamos o lance embutido por Valor Monetário (string para input)
  const [lanceEmbInput, setLanceEmbInput] = useState(''); 
  const [lanceBolso, setLanceBolso] = useState('');

  // Helpers
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

  useEffect(() => {
    if (isSeguroObrigatorio) {
      setTipoParcela('C/SV');
    }
  }, [isSeguroObrigatorio]);

  // Limpa lances se trocar o crédito para evitar inconsistências
  useEffect(() => {
    setLanceEmbInput('');
    setLanceBolso('');
  }, [creditoInput]);

  // --- Lógica do Modal de Lances ---
  const maxLancePermitido = selectedRow ? selectedRow.credito * 0.25 : 0;

  const handleChangeLanceEmbutido = (text: string) => {
    // Permite apenas números
    const numericValue = parseFloat(text) || 0;
    
    if (numericValue > maxLancePermitido) {
      // Se passar do limite, trava no máximo
      setLanceEmbInput(maxLancePermitido.toFixed(2));
      Alert.alert("Limite Atingido", `O lance embutido máximo é de 25% (${maxLancePermitido.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}).`);
    } else {
      setLanceEmbInput(text);
    }
  };

  const handleQuickLanceSelect = (pct: number) => {
    if (!selectedRow) return;
    const val = selectedRow.credito * pct;
    setLanceEmbInput(val.toFixed(2)); // Preenche o input com o valor calculado
  };
  // ---------------------------------

  const handleCalculate = () => {
    if (!selectedRow || prazoIdx === null) {
      Alert.alert("Dados incompletos", "Por favor, selecione um crédito válido e um prazo.");
      return;
    }

    const prazoObj = availablePrazos[prazoIdx];
    
    let rawParcela = 0;
    if (prazoObj.parcela) {
      rawParcela = prazoObj.parcela;
    } else {
      rawParcela = tipoParcela === 'C/SV' ? prazoObj.parcela_CSV : prazoObj.parcela_SSV;
    }

    if(!rawParcela) {
       Alert.alert("Erro", "Parcela não disponível para este tipo de seguro/prazo.");
       return;
    }

    // Converte o valor digitado (R$) de volta para porcentagem para a calculadora
    const lanceEmbValor = parseFloat(lanceEmbInput) || 0;
    const lanceEmbPctCalculado = lanceEmbValor / selectedRow.credito;

    const input: SimulationInput = {
      tableId: table.id,
      credito: selectedRow.credito,
      prazo: prazoObj.prazo,
      tipoParcela,
      lanceBolso: parseFloat(lanceBolso) || 0,
      lanceEmbutidoPct: lanceEmbPctCalculado, // Envia a % calculada
      lanceCartaVal: 0,
      taxaAdesaoPct: adesaoPct 
    };

    const error = ConsortiumCalculator.validate(input, table);
    if (error) {
      Alert.alert("Erro de Validação", error);
      return;
    }

    const result = ConsortiumCalculator.calculate(input, table, rawParcela);
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
        {/* CREDITO INPUT */}
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

        {/* PRAZO SELECTION */}
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
          <Text style={styles.helperText}>
            Valor adicional cobrado apenas no ato da contratação.
          </Text>
        </View>

        {/* SEGURO TOGGLE */}
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
              <Text style={styles.helperText}>
                {tipoParcela === 'C/SV' ? 'Com proteção (Incluso na parcela)' : 'Sem seguro de vida'}
              </Text>
            </>
          )}
        </View>

        {/* LANCES BUTTON */}
        <TouchableOpacity 
          // Desabilita se não tiver crédito selecionado
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
            {(parseFloat(lanceEmbInput) > 0 || parseFloat(lanceBolso) > 0) ? 'Ativo' : 'Opcional'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mainBtn} onPress={handleCalculate}>
          <Calculator color="#fff" size={24} style={{marginRight: 8}} />
          <Text style={styles.mainBtnText}>CALCULAR SIMULAÇÃO</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL DE LANCES */}
      <Modal visible={showLanceModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Configurar Lances</Text>
          
          {/* INPUT DE LANCE EMBUTIDO */}
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Lance Embutido (R$)</Text>
            {/* Aviso de limite ao lado da label */}
            <Text style={styles.limitText}>
              Máx: {formatCurrency(maxLancePermitido)} (25%)
            </Text>
          </View>
          
          <TextInput 
            style={styles.input} 
            keyboardType="numeric" 
            value={lanceEmbInput}
            onChangeText={handleChangeLanceEmbutido}
            placeholder="0.00"
          />
          
          {/* BOTÕES RÁPIDOS */}
          <View style={styles.quickBtnContainer}>
             <Text style={styles.quickLabel}>Seleção Rápida:</Text>
             {[0, 0.10, 0.25].map(pct => (
               <TouchableOpacity 
                key={pct} 
                style={styles.quickBtn}
                onPress={() => handleQuickLanceSelect(pct)}
               >
                 <Text style={styles.quickBtnText}>{pct*100}%</Text>
               </TouchableOpacity>
             ))}
          </View>
          <Text style={styles.helperText}>Desconta do crédito para facilitar a contemplação.</Text>

          <Text style={[styles.label, {marginTop: 24}]}>Lance do Bolso (R$)</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="numeric" 
            value={lanceBolso}
            onChangeText={setLanceBolso}
            placeholder="0.00"
          />

          <TouchableOpacity style={[styles.mainBtn, {marginTop: 40}]} onPress={() => setShowLanceModal(false)}>
            <Text style={styles.mainBtnText}>CONFIRMAR LANCES</Text>
          </TouchableOpacity>
        </View>
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
  
  // Botão de Lance e Estado Desabilitado
  lanceBtn: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  lanceBtnDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', opacity: 0.7 },
  lanceBtnText: { marginLeft: 12, fontSize: 16, fontWeight: '500', color: '#0F172A' },
  lanceBtnValue: { color: '#64748B' },
  
  mainBtn: { backgroundColor: '#0F172A', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalContainer: { flex: 1, padding: 24, backgroundColor: '#fff' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 32, textAlign: 'center', color: '#0F172A' },
  
  mandatoryContainer: { backgroundColor: '#F0F9FF', borderRadius: 8, padding: 12, borderLeftWidth: 4, borderLeftColor: '#0EA5E9' },
  mandatoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mandatoryTitle: { fontSize: 16, fontWeight: 'bold', color: '#0369A1', marginLeft: 8 },
  mandatoryText: { fontSize: 14, color: '#334155', lineHeight: 20 },

  // Novos Estilos para o Modal de Lances Atualizado
  limitText: { fontSize: 12, color: '#DC2626', fontWeight: '600', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 8 },
  quickBtnContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  quickLabel: { fontSize: 14, color: '#64748B', marginRight: 4 },
  quickBtn: { backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  quickBtnText: { color: '#334155', fontWeight: '600', fontSize: 12 }
});