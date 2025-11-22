import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StatusBar, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// IMPORTANTE: Necessário para gestos funcionarem corretamente (Android/iOS)
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
  const [appData, setAppData] = useState<AppData | null>(null);

  useEffect(() => {
    const load = async () => {
      let initialData: AppData;
      
      try {
        initialData = await DataService.initialize();
        setAppData(initialData);
      } catch (error) {
        console.error("Erro fatal ao carregar dados iniciais:", error);
        return; 
      } finally {
        setIsLoading(false);
      }

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
    // CORREÇÃO: Envolvemos o app no GestureHandlerRootView
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Home" 
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            initialParams={{ tables: appData.tables }} 
          />
          
          <Stack.Screen name="TableSelection" component={TableSelectionScreen} />
          <Stack.Screen name="SimulationForm" component={SimulationFormScreen} />
          <Stack.Screen name="Result" component={ResultScreen} />
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