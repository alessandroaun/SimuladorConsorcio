import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOCK_DB, TABLES_METADATA, TableMetadata } from '../../data/TableRepository';

const STORAGE_KEY_DB = '@consorcio_db_v1';
const STORAGE_KEY_META = '@consorcio_meta_v1';
const STORAGE_KEY_DATE = '@consorcio_last_update';

// COLOCAREMOS A URL DO SEU JSON AQUI FUTURAMENTE
const REMOTE_API_URL = 'https://raw.githubusercontent.com/alessandroaun/SimuladorConsorcio/refs/heads/master/dados_consorcio.json'; // Mantenha vazio por enquanto para simulação

export interface AppData {
  tables: TableMetadata[];
  db: Record<string, any[]>;
  lastUpdate: string | null;
}

export const DataService = {
  /**
   * Inicializa os dados: 
   * 1. Tenta pegar do cache do celular (AsyncStorage).
   * 2. Se não tiver cache, usa o MOCK_DB local (Hardcoded).
   */
  async initialize(): Promise<AppData> {
    try {
      const cachedDB = await AsyncStorage.getItem(STORAGE_KEY_DB);
      const cachedMeta = await AsyncStorage.getItem(STORAGE_KEY_META);
      const lastUpdate = await AsyncStorage.getItem(STORAGE_KEY_DATE);

      if (cachedDB && cachedMeta) {
        console.log('Dados carregados do cache local.');
        return {
          tables: JSON.parse(cachedMeta),
          db: JSON.parse(cachedDB),
          lastUpdate
        };
      }
    } catch (e) {
      console.error('Erro ao ler cache local:', e);
    }

    console.log('Cache vazio ou erro. Usando dados embarcados (Fallback).');
    return {
      tables: TABLES_METADATA,
      db: MOCK_DB, // Aqui ele usa o MOCK que exportamos no TableRepository
      lastUpdate: null
    };
  },

  /**
   * Chamado em segundo plano para tentar atualizar os dados da nuvem.
   * Retorna os NOVOS dados baixados (AppData) em caso de sucesso, ou null.
   */
  async syncWithRemote(): Promise<AppData | null> {
    if (!REMOTE_API_URL) {
      // Simulação: Apenas simula que a busca foi um sucesso e retorna o MOCK_DB
      // Na prática, se REMOTE_API_URL é vazio, não há sync.
      console.log('Sincronização realizada com sucesso (Simulado).');
      return {
        tables: TABLES_METADATA,
        db: MOCK_DB, 
        lastUpdate: new Date().toISOString()
      };
    }

    try {
      console.log('Buscando atualizações...');
      const response = await fetch(REMOTE_API_URL);
      const apiResult = await response.json();
      
      const { metadata, data } = apiResult;

      if (!data || !metadata) throw new Error("Formato de JSON inválido");

      // Salva no celular para a próxima vez
      await AsyncStorage.setItem(STORAGE_KEY_DB, JSON.stringify(data));
      await AsyncStorage.setItem(STORAGE_KEY_META, JSON.stringify(metadata));
      await AsyncStorage.setItem(STORAGE_KEY_DATE, new Date().toISOString());
      
      console.log('Dados atualizados da nuvem com sucesso.');
      return {
        tables: metadata,
        db: data,
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      console.log('Sem internet ou API indisponível. Mantendo dados atuais.');
      return null;
    }
  }
};