import { SimulationResult, SimulationInput } from '../utils/ConsortiumCalculator';
import { TableMetadata } from '../../data/TableRepository'; 

export type RootStackParamList = {
  Home: { tables?: TableMetadata[] };
  TableSelection: { category: string; tables: TableMetadata[] }; 
  SimulationForm: { table: TableMetadata };
  Result: { result: SimulationResult; input: SimulationInput; quotaCount: number};
};