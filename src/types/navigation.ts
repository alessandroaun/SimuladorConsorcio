import { SimulationResult, SimulationInput } from '../utils/ConsortiumCalculator';
import { TableMetadata } from '../../data/TableRepository'; // Garante que TableMetadata esteja disponível

export type RootStackParamList = {
  Home: { tables?: TableMetadata[] };
  // ATUALIZADO: A rota TableSelection DEVE aceitar 'category' E 'tables'.
  TableSelection: { category: string; tables: TableMetadata[] }; 
  SimulationForm: { table: TableMetadata };
  Result: { result: SimulationResult; input: SimulationInput };
};