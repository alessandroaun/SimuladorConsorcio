import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, ChevronRight, Car, Home as HomeIcon, Bike, Wrench, Info } from 'lucide-react-native';
import { RootStackParamList } from '../types/navigation';
import { Category, PlanType } from '../../data/TableRepository'; 

type Props = NativeStackScreenProps<RootStackParamList, 'TableSelection'>;

// Helper para obter cores e ícones baseados na categoria (Consistência com HomeScreen)
const getCategoryTheme = (cat: string) => {
  switch (cat) {
    case 'AUTO': return { icon: Car, color: '#2563EB', bgLight: '#EFF6FF', label: 'Automóvel' };
    case 'IMOVEL': return { icon: HomeIcon, color: '#059669', bgLight: '#ECFDF5', label: 'Imóvel' };
    case 'MOTO': return { icon: Bike, color: '#D97706', bgLight: '#FFFBEB', label: 'Motocicleta' };
    case 'SERVICOS': return { icon: Wrench, color: '#7C3AED', bgLight: '#F5F3FF', label: 'Serviços' };
    default: return { icon: Info, color: '#64748B', bgLight: '#F1F5F9', label: 'Outros' };
  }
};

// Helper para cores do PLANO
const getPlanBadgeStyle = (plan: PlanType) => {
  switch (plan) {
    case 'LIGHT': return { bg: '#DBEAFE', text: '#1E40AF' }; // Azul
    case 'SUPERLIGHT': return { bg: '#D1FAE5', text: '#065F46' }; // Verde
    case 'NORMAL': 
    default: return { bg: '#F1F5F9', text: '#475569' }; // Cinza/Slate
  }
};

export default function TableSelectionScreen({ route, navigation }: Props) {
  const { category, tables } = route.params;
  
  const theme = useMemo(() => getCategoryTheme(category), [category]);
  const IconComponent = theme.icon;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* CABEÇALHO MODERNO */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft color="#0F172A" size={30} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <View style={[styles.iconBubble, { backgroundColor: theme.bgLight }]}>
             <IconComponent color={theme.color} size={24} />
          </View>
          <View>
            <Text style={styles.headerTitle}>{theme.label}</Text>
            <Text style={styles.headerSubtitle}>{tables.length} tabelas disponíveis</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {tables.length > 0 ? tables.map((table) => {
          const badgeStyle = getPlanBadgeStyle(table.plan);
          
          return (
            <TouchableOpacity 
              key={table.id} 
              style={styles.tableCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('SimulationForm', { table })}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.tableName}>{table.name}</Text>
                    <View style={[styles.planBadge, { backgroundColor: badgeStyle.bg }]}>
                        <Text style={[styles.planBadgeText, { color: badgeStyle.text }]}>
                            PLANO {table.plan}
                        </Text>
                    </View>
                </View>
                <ChevronRight color="#CBD5E1" size={20} />
              </View>

              <View style={styles.divider} />

              <View style={styles.metaContainer}>
                <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Taxa Adm.</Text>
                    <Text style={styles.metaValue}>{(table.taxaAdmin * 100).toFixed(2)}%</Text>
                </View>
                <View style={styles.metaSeparator} />
                <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Fundo Res.</Text>
                    <Text style={styles.metaValue}>{(table.fundoReserva * 100).toFixed(0)}%</Text>
                </View>
                <View style={styles.metaSeparator} />
                <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Seguro</Text>
                    <Text style={styles.metaValue}>{(table.seguroPct * 100).toFixed(4)}%</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }) : (
            <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                    <Info size={32} color="#EF4444" />
                </View>
                <Text style={styles.emptyTitle}>Nenhuma tabela disponível</Text>
                <Text style={styles.emptySubtitle}>
                    Esta categoria não possui planos ativos no momento. Verifique a conexão ou tente mais tarde.
                </Text>
            </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // HEADER
  header: { 
    paddingHorizontal: 24, 
    paddingTop: 16, 
    paddingBottom: 24,
    backgroundColor: '#F8FAFC',
  },
  backBtn: { 
    alignSelf: 'flex-start',
    padding: 1,
    paddingVertical: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: -24,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },

  scrollContent: { 
    paddingHorizontal: 24,
    paddingBottom: 40 
  },

  // CARD
  tableCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 16,
    // Sombra Glassmorphism/Modern
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tableName: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#1E293B',
    marginBottom: 8
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },

  // META INFO GRID
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
  },
  metaSeparator: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },

  // EMPTY STATE
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#0F172A',
    marginBottom: 8
  },
  emptySubtitle: { 
    fontSize: 14, 
    color: '#64748B', 
    textAlign: 'center',
    lineHeight: 20
  }
});