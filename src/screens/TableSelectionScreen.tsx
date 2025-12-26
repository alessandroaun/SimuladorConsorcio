import React, { useMemo, useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, StyleSheet, 
  StatusBar, useWindowDimensions, Platform, ActivityIndicator 
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, ChevronRight, Car, Home as HomeIcon, Bike, Gem, Info } from 'lucide-react-native';
import { RootStackParamList } from '../types/navigation';
import { Category, PlanType, TableMetadata } from '../../data/TableRepository'; 

// IMPORTANTE: Serviço de dados para busca interna
import { DataService } from '../services/DataService';

type Props = NativeStackScreenProps<RootStackParamList, 'TableSelection'>;

// Helper para obter cores e ícones baseados na categoria
const getCategoryTheme = (cat: string) => {
  switch (cat) {
    case 'AUTO': return { icon: Car, color: '#2563EB', bgLight: '#EFF6FF', label: 'Automóvel' };
    case 'IMOVEL': return { icon: HomeIcon, color: '#059669', bgLight: '#ECFDF5', label: 'Imóvel' };
    case 'MOTO': return { icon: Bike, color: '#D97706', bgLight: '#FFFBEB', label: 'Motocicleta' };
    case 'SERVICOS': return { icon: Gem, color: '#7C3AED', bgLight: '#F5F3FF', label: 'Serviços' };
    default: return { icon: Info, color: '#64748B', bgLight: '#F1F5F9', label: 'Outros' };
  }
};

// Helper para cores do PLANO
const getPlanBadgeStyle = (plan: PlanType) => {
  switch (plan) {
    case 'LIGHT': return { bg: '#DBEAFE', text: '#1E40AF' }; // Azul
    case 'SUPERLIGHT': return { bg: '#fad1d1ff', text: '#5f0606ff' }; // Vermelho suave
    case 'NORMAL': 
    default: return { bg: '#D1FAE5', text: '#065F46' }; // Verde
  }
};

export default function TableSelectionScreen({ route, navigation }: Props) {
  // Agora recebemos APENAS a categoria pela URL (ex: 'IMOVEL')
  const { category } = route.params; 
  
  const theme = useMemo(() => getCategoryTheme(category), [category]);
  const IconComponent = theme.icon;

  // --- ESTADOS PARA DADOS (Correção F5) ---
  const [tables, setTables] = useState<TableMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  // --- BUSCA DE DADOS ---
  useEffect(() => {
    const loadTables = async () => {
      try {
        // Garante que o DataService está inicializado
        const appData = await DataService.initialize();
        // Filtra as tabelas localmente
        const filtered = appData.tables.filter(t => t.category === category);
        setTables(filtered);
      } catch (error) {
        console.error("Erro ao carregar tabelas:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTables();
  }, [category]);

  // --- RESPONSIVIDADE ---
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const MAX_WIDTH = 960;
  
  const contentWidth = Math.min(width, MAX_WIDTH);
  const paddingHorizontal = isDesktop ? 40 : 24;
  
  const numColumns = isDesktop ? 2 : 1;
  const gap = 16;
  const cardWidth = (contentWidth - (paddingHorizontal * 2) - (gap * (numColumns - 1))) / numColumns;

  // --- SMART BACK (Evita ficar preso se der F5) ---
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } else {
      navigation.navigate('Home');
    }
  };

  // --- NAVEGAÇÃO SEGURA (URL LIMPA) ---
  const handleSelectTable = (table: TableMetadata) => {
    // Passa apenas o ID para o formulário. A URL ficará /formulario/2011
    navigation.navigate('SimulationForm', { tableId: table.id });
  };

  if (loading) {
    return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={theme.color} />
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* CABEÇALHO MODERNO RESPONSIVO */}
      <View style={styles.header}>
        <View style={[styles.headerTopRow, { width: contentWidth, paddingHorizontal }]}>
            <TouchableOpacity 
                onPress={handleBack} 
                style={styles.backBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <ArrowLeft color="#0F172A" size={24} />
            </TouchableOpacity>
        </View>

        <View style={[styles.headerTitleRow, { width: contentWidth, paddingHorizontal }]}>
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
      </View>

      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }} 
        showsVerticalScrollIndicator={false}
      >
        <View style={{
            width: contentWidth,
            alignSelf: 'center',
            paddingHorizontal: paddingHorizontal,
            paddingBottom: 40,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: gap,
            marginTop: 8
        }}>
            {tables.length > 0 ? tables.map((table) => {
            const badgeStyle = getPlanBadgeStyle(table.plan);
            
            return (
                <TouchableOpacity 
                    key={table.id} 
                    style={[styles.tableCard, { width: cardWidth }]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectTable(table)}
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
                <View style={[styles.emptyContainer, { width: '100%' }]}>
                    <View style={styles.emptyIconBg}>
                        <Info size={32} color="#EF4444" />
                    </View>
                    <Text style={styles.emptyTitle}>Nenhuma tabela disponível</Text>
                    <Text style={styles.emptySubtitle}>
                        Esta categoria não possui planos ativos no momento. Verifique a conexão ou tente mais tarde.
                    </Text>
                </View>
            )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // HEADER
  header: {
    backgroundColor: '#F8FAFC',
    width: '100%',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, 
    zIndex: 10,
    marginTop: 0,
  },
  
  headerTopRow: {
    width: '100%',
    paddingVertical: 12, 
    alignSelf: 'center',
  },

  backBtn: { 
    width: 40,
    height: 40,
    backgroundColor: '#F1F5F9', 
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },

  headerTitleRow: {
    width: '100%',
    paddingBottom: 24,
    paddingTop: 4,
    alignSelf: 'center',
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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

  // CARD
  tableCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 20, 
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