import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Car, Home as HomeIcon, Bike, Wrench } from 'lucide-react-native';
import { RootStackParamList } from '../types/navigation';
import { Category } from '../utils/ConsortiumCalculator'; 
import { TableMetadata } from '../../data/TableRepository'; // Necessário para tipagem local

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface BaseCategory {
    id: Category;
    label: string;
    icon: React.ComponentType<any>;
    color: string;
}

export default function HomeScreen({ navigation, route }: Props) {
  const baseCategories: BaseCategory[] = [
    { id: 'AUTO', label: 'Automóvel', icon: Car, color: '#3B82F6' },
    { id: 'IMOVEL', label: 'Imóvel', icon: HomeIcon, color: '#10B981' },
    { id: 'MOTO', label: 'Motocicleta', icon: Bike, color: '#F59E0B' },
    { id: 'SERVICOS', label: 'Serviços', icon: Wrench, color: '#8B5CF6' },
  ];

  // 1. Acessa as tabelas ATUALIZADAS passadas pelo App.tsx (tables: TableMetadata[])
  const allTables: TableMetadata[] = route.params?.tables || [];

  const displayCategories = useMemo(() => {
    const availableCategories = new Set(allTables.map(t => t.category));
    return baseCategories.filter(cat => availableCategories.has(cat.id));
  }, [allTables]);

  // FUNÇÃO CRÍTICA: Filtra as tabelas e navega
  const handleNavigateToSelection = (categoryId: Category) => {
    // 2. Filtra a lista completa de tabelas (que contém os dados do GitHub) pela categoria clicada
    const tablesForCategory = allTables.filter(t => t.category === categoryId);
    
    // 3. Navega, enviando os DOIS parâmetros necessários para a próxima tela
    navigation.navigate('TableSelection', { 
      category: categoryId, 
      tables: tablesForCategory // <-- RESOLVE O ERRO DE TIPAGEM AGORA
    });
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Simulador de Consórcio</Text>
        {/* Mostra quantas tabelas foram carregadas */}
        <Text style={styles.subtitle}>Selecione uma categoria para iniciar ({allTables.length} tabelas carregadas)</Text>
      </View>
      
      <View style={styles.grid}>
        {/* Usa a lista FILTRADA/DINÂMICA */}
        {displayCategories.map((cat) => (
          <TouchableOpacity 
            key={cat.id} 
            style={[styles.catCard, { backgroundColor: cat.color }]}
            // Chama a nova função de navegação, que envia todos os parâmetros
            onPress={() => handleNavigateToSelection(cat.id)}
          >
            <View style={styles.iconBubble}>
              <cat.icon color="#fff" size={32} />
            </View>
            <Text style={styles.catText}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
        
        {displayCategories.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhuma tabela de consórcio encontrada.</Text>
            <Text style={styles.emptySubText}>Verifique a conexão ou os dados remotos.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0F172A' },
  subtitle: { fontSize: 16, color: '#64748B', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 16 },
  catCard: { width: '47%', aspectRatio: 1.1, borderRadius: 20, padding: 16, justifyContent: 'space-between', elevation: 3 },
  iconBubble: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  catText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptyState: { padding: 20, width: '100%', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#0F172A', fontWeight: 'bold' },
  emptySubText: { fontSize: 14, color: '#64748B', marginTop: 5 },
});