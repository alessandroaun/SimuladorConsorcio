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

// Importação do Serviço de Dados
import { DataService, AppData } from './src/services/DataService';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  // Estado para guardar os dados que vamos usar no app inteiro
  const [appData, setAppData] = useState<AppData | null>(null);

  useEffect(() => {
    const load = async () => {
      let initialData: AppData;
      
      try {
        // 1. Inicializa os dados (Prioridade: Cache do Celular > Arquivo Local Mock)
        // Isso carrega a versão atual dos dados para renderização inicial rápida
        initialData = await DataService.initialize();
        setAppData(initialData);
      } catch (error) {
        console.error("Erro fatal ao carregar dados iniciais:", error);
        return; 
      } finally {
        // Remove a tela de loading assim que tivermos qualquer dado válido
        setIsLoading(false);
      }

      // 2. Tenta atualizar em segundo plano (Sync com GitHub/API)
      const updatedData = await DataService.syncWithRemote();
      
      if (updatedData) {
         // **CORREÇÃO CRÍTICA:** Se a sincronização trouxer dados novos,
         // atualizamos o estado 'appData' imediatamente.
         setAppData(updatedData);
         console.log("Interface atualizada com dados mais recentes.");
      }
    };

    load();
  }, []);

  // Tela de Splash (Aparece enquanto o DataService.initialize roda)
  if (isLoading || !appData) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ActivityIndicator size="large" color="#0F172A" />
        <Text style={styles.loadingText}>Carregando tabelas...</Text>
        <Text style={styles.loadingSubText}>Verificando atualizações</Text>
      </View>
    );
  }

  // Navegação principal, que só é renderizada depois que os dados (appData) estiverem prontos
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home" 
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          // Correção: Passamos as tabelas carregadas (que agora podem ser as recém-atualizadas)
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