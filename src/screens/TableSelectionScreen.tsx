import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { RootStackParamList } from '../types/navigation';
// REMOVIDA: A lista de tabelas não é mais importada, ela vem da navegação.
// import { TABLES_METADATA } from '../../data/TableRepository'; 

type Props = NativeStackScreenProps<RootStackParamList, 'TableSelection'>;

export default function TableSelectionScreen({ route, navigation }: Props) {
  // CORREÇÃO: Desestruturamos 'category' E 'tables' dos parâmetros de rota.
  // A lista 'tables' agora contém os dados ATUALIZADOS do GitHub, filtrados pelo HomeScreen.
  const { category, tables } = route.params; 

  // REMOVIDA: A linha abaixo era a fonte do problema, pois usava a lista estática:
  // const tables = TABLES_METADATA.filter(t => t.category === category);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity 
          // O onPress faz navigation.goBack() para voltar à HomeScreen
          onPress={() => navigation.goBack()} 
          style={styles.backBtn}
        >
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Tabelas {category} ({tables.length})</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tables.length > 0 ? tables.map((table) => (
          <TouchableOpacity 
            key={table.id} 
            style={styles.tableCard}
            // Ao clicar, navegamos para o formulário, passando a tabela selecionada
            onPress={() => navigation.navigate('SimulationForm', { table })}
          >
            <View style={styles.tableRow}>
              <View style={{flex: 1}}>
                <Text style={styles.tableName}>{table.name}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: table.plan === 'NORMAL' ? '#E0F2FE' : '#FEF9C3' }]}>
                    <Text style={[styles.badgeText, { color: table.plan === 'NORMAL' ? '#0284C7' : '#854D0E' }]}>
                      {table.plan}
                    </Text>
                  </View>
                </View>
                <Text style={styles.tableMeta}>
                  Taxa Adm: {(table.taxaAdmin * 100).toFixed(2)}% | Fundo: {(table.fundoReserva * 100).toFixed(0)}%
                </Text>
              </View>
              <ChevronRight color="#94A3B8" size={24} />
            </View>
          </TouchableOpacity>
        )) : (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Nenhuma tabela disponível</Text>
                <Text style={styles.emptySubtitle}>Esta categoria não possui planos ativos no momento. Verifique o JSON remoto.</Text>
            </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  navHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { padding: 8, marginRight: 8 },
  navTitle: { fontSize: 18, fontWeight: '600', color: '#0F172A' },
  scrollContent: { padding: 16 },
  tableCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tableName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  badgeRow: { flexDirection: 'row', marginTop: 6, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  tableMeta: { fontSize: 12, color: '#64748B' },
  emptyContainer: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#FFDEDE', marginTop: 20 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#B91C1C' },
  emptySubtitle: { fontSize: 14, color: '#DC2626', marginTop: 5 }
});