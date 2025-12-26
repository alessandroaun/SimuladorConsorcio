import { SimulationResult, SimulationInput } from '../utils/ConsortiumCalculator';
import { TableMetadata } from '../../data/TableRepository'; 

export type RootStackParamList = {
  Home: undefined; // Sem parametros na URL
  TableSelection: { category: string }; // Apenas a categoria (ex: 'IMOVEL')
  SimulationForm: { tableId: string }; // Apenas o ID (ex: '2011')
  Result: undefined; // Tudo via Storage
};