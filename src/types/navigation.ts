import { TableMetadata } from '../../data/TableRepository';
import { SimulationResult, SimulationInput } from '../utils/ConsortiumCalculator';

export type RootStackParamList = {
  Home: undefined;
  TableSelection: undefined;
  SimulationForm: { table: TableMetadata };
  Result: { 
    result: SimulationResult; 
    input: SimulationInput;
    quotaCount: number; // Adicionado aqui para corrigir o erro de tipo
  };
};