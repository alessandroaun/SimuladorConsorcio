import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StatusBar, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// IMPORTANTE: Necessário para gestos funcionarem corretamente (Android/iOS)
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// IMPORTANTE: Necessário para deep linking e navegação correta na Web
import * as Linking from 'expo-linking';

import { RootStackParamList } from './src/types/navigation';

// Importação das telas
import HomeScreen from './src/screens/HomeScreen';
import TableSelectionScreen from './src/screens/TableSelectionScreen';
import SimulationFormScreen from './src/screens/SimulationFormScreen';
import ResultScreen from './src/screens/ResultScreen';

// Importação do Serviço de Dados
import { DataService, AppData } from './src/services/DataService';

const Stack = createNativeStackNavigator<RootStackParamList>();

// --- CONFIGURAÇÃO DE LINKING PARA WEB ---
const linking = {
  prefixes: [Linking.createURL('/'), 'https://seuapp.com'],
  config: {
    screens: {
      Home: 'inicio',
      TableSelection: 'tabelas/:category', // URL fica: /tabelas/IMOVEL
      SimulationForm: 'formulario/:tableId', // URL fica: /formulario/2011 (Recebe o ID)
      Result: 'resultados',
    },
  },
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  // O estado appData é mantido aqui para garantir que o DataService inicializou,
  // mas não precisamos mais passá-lo via props para as rotas.
  const [appData, setAppData] = useState<AppData | null>(null);

  useEffect(() => {
    const load = async () => {
      let initialData: AppData;
      
      try {
        // Inicializa o serviço e carrega do cache/local
        initialData = await DataService.initialize();
        setAppData(initialData);
      } catch (error) {
        console.error("Erro fatal ao carregar dados iniciais:", error);
        // Em produção, aqui você poderia setar um estado de erro global
        return; 
      } finally {
        setIsLoading(false);
      }

      // Tenta atualizar os dados em background (silencioso)
      const updatedData = await DataService.syncWithRemote();
      
      if (updatedData) {
         setAppData(updatedData);
         console.log("Interface atualizada com dados mais recentes.");
      }
    };

    load();
  }, []);

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer 
        linking={linking} 
        documentTitle={{ formatter: (options, route) => options?.title ?? route?.name }}
      >
        <Stack.Navigator 
          initialRouteName="Home" 
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            // CORREÇÃO: Removemos initialParams. A Home buscará dados do DataService.
            options={{ title: 'Simulador Recon - Início' }}
          />
          
          <Stack.Screen 
            name="TableSelection" 
            component={TableSelectionScreen} 
            options={{ title: 'Simulador Recon - Seleção de Tabelas' }}
          />
          
          <Stack.Screen 
            name="SimulationForm" 
            component={SimulationFormScreen} 
            options={{ title: 'Simulador Recon - Nova Simulação' }}
          />
          
          <Stack.Screen 
            name="Result" 
            component={ResultScreen} 
            options={{ title: 'Simulador Recon - Resultado' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
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