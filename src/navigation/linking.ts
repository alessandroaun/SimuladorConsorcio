import * as Linking from 'expo-linking';
import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation'; // Ajuste o caminho se necessário

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'https://seuapp.com'],
  config: {
    screens: {
      Home: 'inicio',
      TableSelection: 'tabelas',
      SimulationForm: 'formulario',
      Result: 'resultados', 
    },
  },
};

export default linking;