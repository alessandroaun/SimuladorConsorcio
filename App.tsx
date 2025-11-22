import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StatusBar, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './src/types/navigation';

// Importação das telas
import HomeScreen from './src/screens/HomeScreen';
import TableSelectionScreen from './src/screens/TableSelectionScreen';
import SimulationFormScreen from './src/screens/SimulationFormScreen';
import ResultScreen from './src/screens/ResultScreen';

// Importação do Serviço de Dados e do Repository Setter
import { DataService, AppData } from './src/services/DataService';
import { setDatabase } from './data/TableRepository'; // <--- IMPORTANTE

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [appData, setAppData] = useState<AppData | null>(null);

  useEffect(() => {
    const load = async () => {
      let initialData: AppData | null = null;
      
      try {
        // 1. Inicializa os dados (Cache Local ou Mock)
        initialData = await DataService.initialize();
        
        if (initialData) {
          setAppData(initialData);
          
          // --- CORREÇÃO CRÍTICA ---
          // Injeta os dados carregados no Repository para que as telas 
          // que usam getTableData() vejam os dados corretos.
          setDatabase(initialData.db);
        }

      } catch (error) {
        console.error("Erro fatal ao carregar dados iniciais:", error);
        // Mesmo com erro, remove loading para não travar app (opcional)
      } finally {
        setIsLoading(false);
      }

      // 2. Tenta atualizar em segundo plano (Sync com GitHub)
      // Se der erro aqui, não tem problema, pois já temos o initialData rodando
      const updatedData = await DataService.syncWithRemote();
      
      if (updatedData) {
         setAppData(updatedData);
         
         // --- CORREÇÃO CRÍTICA ---
         // Se baixou coisa nova, atualiza o Repository global novamente
         setDatabase(updatedData.db);
         
         console.log("Interface e Repositório atualizados com dados da nuvem.");
      }
    };

    load();
  }, []);

  // Tela de Loading
  if (isLoading || !appData) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ActivityIndicator size="large" color="#0F172A" />
        <Text style={styles.loadingText}>Carregando tabelas...</Text>
        <Text style={styles.loadingSubText}>Verificando atualizações...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home" 
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          // Passa os metadados das tabelas (lista de categorias/nomes)
          initialParams={{ tables: appData.tables }} 
        />
        
        <Stack.Screen name="TableSelection" component={TableSelectionScreen} />
        <Stack.Screen name="SimulationForm" component={SimulationFormScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC'
  },
  loadingText: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A'
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B'
  }
});