import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, ScrollView, Dimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Car, Home as HomeIcon, Bike, Wrench, ChevronRight, LayoutGrid } from 'lucide-react-native';
import { RootStackParamList } from '../types/navigation';

import { Category, TableMetadata } from '../../data/TableRepository'; 

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface BaseCategory {
    id: Category;
    label: string;
    description: string;
    icon: React.ComponentType<any>;
    color: string;      // Cor principal (ícone/texto)
    bgLight: string;    // Cor de fundo suave (bolha do ícone)
}

const { width } = Dimensions.get('window');
// CÁLCULO CORRIGIDO PARA GRID 2x2
// Largura da Tela - (Padding Horizontal E/D: 24+24=48) - (Gap entre colunas: 12)
// Dividido por 2 colunas
const PADDING_HORIZONTAL = 24;
const GAP = 12;
const CARD_WIDTH = (width - (PADDING_HORIZONTAL * 2) - GAP) / 2;

export default function HomeScreen({ navigation, route }: Props) {
  // Configuração visual das categorias com paleta moderna
  const baseCategories: BaseCategory[] = [
    { 
      id: 'AUTO', 
      label: 'Automóvel', 
      description: 'Carros novos e seminovos',
      icon: Car, 
      color: '#2563EB', // Blue 600
      bgLight: '#EFF6FF' // Blue 50
    },
    { 
      id: 'IMOVEL', 
      label: 'Imóvel', 
      description: 'Casas, aptos e terrenos',
      icon: HomeIcon, 
      color: '#059669', // Emerald 600
      bgLight: '#ECFDF5' // Emerald 50
    },
    { 
      id: 'MOTO', 
      label: 'Motocicleta', 
      description: 'Motos de todas as cilindradas',
      icon: Bike, 
      color: '#D97706', // Amber 600
      bgLight: '#FFFBEB' // Amber 50
    },
    { 
      id: 'SERVICOS', 
      label: 'Serviços', 
      description: 'Reformas, festas e estudos',
      icon: Wrench, 
      color: '#7C3AED', // Violet 600
      bgLight: '#F5F3FF' // Violet 50
    },
  ];

  const allTables: TableMetadata[] = route.params?.tables || [];

  const displayCategories = useMemo(() => {
    const availableCategories = new Set(allTables.map(t => t.category));
    return baseCategories.filter(cat => availableCategories.has(cat.id));
  }, [allTables]);

  const handleNavigateToSelection = (categoryId: Category) => {
    const tablesForCategory = allTables.filter(t => t.category === categoryId);
    navigation.navigate('TableSelection', { 
      category: categoryId, 
      tables: tablesForCategory 
    });
  };

  const countTables = (catId: Category) => allTables.filter(t => t.category === catId).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* CABEÇALHO MODERNO */}
        <View style={styles.header}>
          <View style={styles.badgeContainer}>
            <LayoutGrid size={14} color="#64748B" />
            <Text style={styles.badgeText}>SIMULADOR RECON</Text>
          </View>
          <Text style={styles.title}>
            O que você deseja{'\n'}
            <Text style={styles.titleHighlight}>conquistar hoje?</Text>
          </Text>
          <Text style={styles.subtitle}>
            Selecione uma categoria abaixo para iniciar sua simulação personalizada.
          </Text>
        </View>
        
        {/* GRID DE CATEGORIAS */}
        <View style={styles.grid}>
          {displayCategories.map((cat) => {
            const tableCount = countTables(cat.id);
            return (
              <TouchableOpacity 
                key={cat.id} 
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => handleNavigateToSelection(cat.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: cat.bgLight }]}>
                    <cat.icon color={cat.color} size={28} strokeWidth={2} />
                  </View>
                  <View style={[styles.countBadge, { borderColor: cat.bgLight }]}>
                    <Text style={[styles.countText, { color: cat.color }]}>{tableCount}</Text>
                  </View>
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{cat.label}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>{cat.description}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={[styles.actionText, { color: cat.color }]}>Simular</Text>
                  <ChevronRight size={16} color={cat.color} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* ESTADO VAZIO (Fallback) */}
        {displayCategories.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <LayoutGrid size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyText}>Nenhuma tabela carregada</Text>
            <Text style={styles.emptySubText}>
              Não conseguimos carregar as tabelas do servidor. Verifique sua conexão.
            </Text>
          </View>
        )}

        <Text style={styles.footerVersion}>Versão 1.0 • TESTES</Text>
        <Text style={styles.footerVersion}>Alessandro Uchoa</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' // Slate 50
  },
  scrollContent: {
    paddingHorizontal: PADDING_HORIZONTAL,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  
  // HEADER
  header: { 
    marginBottom: 32,
    marginTop: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5
  },
  title: { 
    fontSize: 28, 
    fontWeight: '400', 
    color: '#0F172A', // Slate 900
    lineHeight: 36,
    marginBottom: 8
  },
  titleHighlight: {
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: { 
    fontSize: 15, 
    color: '#64748B', // Slate 500
    lineHeight: 22,
    maxWidth: '90%'
  },

  // GRID
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    // Usamos 'flex-start' para garantir que preencham da esquerda pra direita
    justifyContent: 'flex-start', 
    gap: GAP 
  },
  
  // CARD
  card: { 
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
    // Sombras suaves (iOS & Android)
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9', // Borda sutil
    marginBottom: 8
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  countText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardContent: {
    marginBottom: 16
  },
  cardTitle: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: '#1E293B',
    marginBottom: 4
  },
  cardDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // EMPTY STATE
  emptyState: { 
    padding: 40, 
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyText: { 
    fontSize: 18, 
    color: '#0F172A', 
    fontWeight: 'bold' 
  },
  emptySubText: { 
    fontSize: 14, 
    color: '#64748B', 
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20
  },
  footerVersion: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
    paddingTop: 1,
    marginTop: 10
  }
});