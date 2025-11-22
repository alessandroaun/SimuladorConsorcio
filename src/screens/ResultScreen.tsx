import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Atualizado para evitar warning
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Share2, CheckCircle2 } from 'lucide-react-native';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ route, navigation }: Props) {
  const { result, input } = route.params;

  const handleExport = () => {
    Alert.alert("Exportar", "Funcionalidade de PDF será implementada aqui.");
  };

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Resultado da Simulação</Text>
        <TouchableOpacity onPress={handleExport}>
          <Share2 color="#0EA5E9" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Cabeçalho Parcela Normal */}
        <View style={styles.resultHeader}>
          <Text style={styles.resultLabel}>PARCELA MENSAL (2ª em diante)</Text>
          <Text style={styles.resultBigValue}>{formatBRL(result.parcelaPreContemplacao)}</Text>
          {result.plano !== 'NORMAL' && (
            <View style={styles.warnBadge}>
              <Text style={styles.warnText}>Plano {result.plano}</Text>
            </View>
          )}
        </View>

        {/* --- NOVO: DESTAQUE PARA PRIMEIRA PARCELA COM ADESÃO --- */}
        {result.valorAdesao > 0 && (
          <View style={styles.highlightBox}>
            <View style={styles.highlightHeader}>
              <CheckCircle2 color="#fff" size={20} />
              <Text style={styles.highlightTitle}>PAGAMENTO NO ATO (1ª PARCELA)</Text>
            </View>
            <Text style={styles.highlightSubtitle}>
              Parcela ({formatBRL(result.parcelaPreContemplacao)}) + Adesão ({formatBRL(result.valorAdesao)})
            </Text>
            <Text style={styles.highlightValue}>{formatBRL(result.totalPrimeiraParcela)}</Text>
          </View>
        )}

        {/* Resumo Crédito/Prazo */}
        <View style={styles.grid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Crédito Total</Text>
            <Text style={styles.statValue}>{formatBRL(result.creditoOriginal)}</Text>
          </View>
           <View style={styles.statBox}>
            <Text style={styles.statLabel}>Prazo</Text>
            <Text style={styles.statValue}>{input.prazo} meses</Text>
          </View>
        </View>

        {/* Seção de Lances (Só aparece se tiver lance) */}
        {result.lanceTotal > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Análise de Contemplação</Text>
            
            <View style={styles.rowBetween}>
              <Text style={styles.text}>Lance Ofertado (Total):</Text>
              <Text style={[styles.textBold, {color: '#22C55E'}]}>{formatBRL(result.lanceTotal)}</Text>
            </View>
            
            <View style={styles.rowBetween}>
              <Text style={styles.text}>% do Crédito:</Text>
              <Text style={styles.textBold}>{((result.lanceTotal / result.creditoOriginal) * 100).toFixed(2)}%</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.rowBetween}>
              <Text style={styles.text}>Crédito Líquido (Na Mão):</Text>
              <Text style={styles.textBold}>{formatBRL(result.creditoLiquido)}</Text>
            </View>
            <Text style={styles.helperText}>Valor disponível para compra do bem após descontar o lance embutido.</Text>
          </View>
        )}

        {/* Detalhamento */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detalhamento Financeiro</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.text}>Taxa Adm Total:</Text>
            <Text style={styles.text}>{formatBRL(result.taxaAdminValor)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.text}>Fundo Reserva:</Text>
            <Text style={styles.text}>{formatBRL(result.fundoReservaValor)}</Text>
          </View>
           <View style={styles.rowBetween}>
            <Text style={styles.text}>Seguro Mensal:</Text>
            <Text style={styles.text}>{formatBRL(result.seguroMensal)}</Text>
          </View>
          
          {result.valorAdesao > 0 && (
             <View style={styles.rowBetween}>
              <Text style={styles.text}>Taxa de Adesão (Ato):</Text>
              <Text style={styles.text}>{formatBRL(result.valorAdesao)}</Text>
            </View>
          )}

          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.textBold}>Custo Total Previsto:</Text>
            <Text style={styles.textBold}>{formatBRL(result.custoTotal)}</Text>
          </View>
        </View>

        {/* Aviso Pós-Contemplação para Planos Light */}
        {result.plano !== 'NORMAL' && (
          <View style={[styles.card, { borderColor: '#22C55E', borderLeftWidth: 4 }]}>
            <Text style={[styles.cardTitle, {color: '#15803D'}]}>Pós-Contemplação (Opção B)</Text>
            <Text style={styles.text}>
              Se você optar por recompor o crédito para 100% ({formatBRL(result.creditoOriginal)}) ao ser contemplado, 
              sua parcela será reajustada para:
            </Text>
            <Text style={styles.newParcela}>{formatBRL(result.parcelaPosContemplacao)}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.mainBtn, {backgroundColor: 'transparent', borderWidth: 1, borderColor: '#0F172A', marginBottom: 20}]} 
          onPress={() => navigation.popToTop()}
        >
            <Text style={[styles.mainBtnText, {color: '#0F172A'}]}>NOVA SIMULAÇÃO</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  navHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { padding: 8, marginRight: 8 },
  navTitle: { fontSize: 18, fontWeight: '600', color: '#0F172A' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  resultHeader: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  resultLabel: { fontSize: 12, color: '#64748B', letterSpacing: 1, textTransform: 'uppercase' },
  resultBigValue: { fontSize: 36, fontWeight: 'bold', color: '#0F172A' },
  warnBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 8 },
  warnText: { color: '#B45309', fontWeight: 'bold', fontSize: 12 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', elevation: 1 },
  statLabel: { fontSize: 12, color: '#64748B' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  text: { fontSize: 14, color: '#334155' },
  textBold: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  helperText: { fontSize: 12, color: '#94A3B8', marginTop: 4, fontStyle: 'italic' },
  newParcela: { fontSize: 24, fontWeight: 'bold', color: '#15803D', marginTop: 4 },
  mainBtn: { borderRadius: 12, padding: 16, alignItems: 'center' },
  mainBtnText: { fontWeight: 'bold', fontSize: 16 },
  
  // NOVOS ESTILOS PARA ADESÃO
  highlightBox: { backgroundColor: '#0F172A', borderRadius: 16, padding: 20, marginBottom: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 4 },
  highlightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  highlightTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  highlightSubtitle: { color: '#94A3B8', fontSize: 12, marginBottom: 4 },
  highlightValue: { color: '#22C55E', fontSize: 32, fontWeight: 'bold' }
});