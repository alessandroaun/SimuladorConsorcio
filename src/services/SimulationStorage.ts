import AsyncStorage from '@react-native-async-storage/async-storage';
import { SimulationResult, SimulationInput } from '../utils/ConsortiumCalculator';

const KEY_RESULT = '@consorcio_last_result';
const KEY_INPUT = '@consorcio_last_input';
const KEY_QUOTA = '@consorcio_last_quota';

export const SimulationStorage = {
  saveSimulation: async (result: SimulationResult, input: SimulationInput, quotaCount: number) => {
    try {
      const data = [
        ['@consorcio_last_result', JSON.stringify(result)],
        ['@consorcio_last_input', JSON.stringify(input)],
        ['@consorcio_last_quota', quotaCount.toString()]
      ];
      // @ts-ignore
      await AsyncStorage.multiSet(data);
    } catch (e) {
      console.error("Erro ao salvar simulação", e);
    }
  },

  getSimulation: async () => {
    try {
      const values = await AsyncStorage.multiGet([KEY_RESULT, KEY_INPUT, KEY_QUOTA]);
      
      const resultStr = values[0][1];
      const inputStr = values[1][1];
      const quotaStr = values[2][1];

      if (!resultStr || !inputStr) return null;

      return {
        result: JSON.parse(resultStr) as SimulationResult,
        input: JSON.parse(inputStr) as SimulationInput,
        quotaCount: quotaStr ? parseInt(quotaStr) : 1
      };
    } catch (e) {
      console.error("Erro ao recuperar simulação", e);
      return null;
    }
  }
};