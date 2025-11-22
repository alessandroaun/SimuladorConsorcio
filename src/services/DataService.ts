// services/DataService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  MOCK_DB, 
  TABLES_METADATA, 
  TableMetadata, 
  setDatabase // <--- Importe a nova função
} from '../../data/TableRepository';

const STORAGE_KEY_DB = '@consorcio_db_v1';
const STORAGE_KEY_META = '@consorcio_meta_v1';
const STORAGE_KEY_DATE = '@consorcio_last_update';

// URL do seu GitHub (JSON Raw)
const REMOTE_API_URL = 'https://raw.githubusercontent.com/alessandroaun/SimuladorConsorcio/refs/heads/master/dados_consorcio.json';

export interface AppData {
  tables: TableMetadata[];
  db: Record<string, any[]>;
  lastUpdate: string | null;
}

export const DataService = {
  async initialize(): Promise<AppData> {
    try {
      const cachedDB = await AsyncStorage.getItem(STORAGE_KEY_DB);
      const cachedMeta = await AsyncStorage.getItem(STORAGE_KEY_META);
      const lastUpdate = await AsyncStorage.getItem(STORAGE_KEY_DATE);

      if (cachedDB && cachedMeta) {
        const parsedDB = JSON.parse(cachedDB);
        const parsedMeta = JSON.parse(cachedMeta);

        // ATUALIZA O REPOSITÓRIO COM O CACHE
        setDatabase(parsedDB); 
        
        console.log('Dados carregados do cache local.');
        return {
          tables: parsedMeta,
          db: parsedDB,
          lastUpdate
        };
      }
    } catch (e) {
      console.error('Erro ao ler cache local:', e);
    }

    console.log('Cache vazio. Usando dados embarcados.');
    // Reseta para o Mock caso não tenha cache
    setDatabase(MOCK_DB); 
    
    return {
      tables: TABLES_METADATA,
      db: MOCK_DB,
      lastUpdate: null
    };
  },

  async syncWithRemote(): Promise<AppData | null> {
    try {
      console.log('Buscando atualizações no GitHub...');
      // Adicione um timestamp para evitar cache do próprio fetch/network
      const response = await fetch(`${REMOTE_API_URL}?t=${new Date().getTime()}`);
      const apiResult = await response.json();
      
      // IMPORTANTE: O JSON do GitHub deve ter a estrutura { metadata: [], data: {} }
      const { metadata, data } = apiResult;

      if (!data || !metadata) throw new Error("Formato de JSON inválido");

      await AsyncStorage.setItem(STORAGE_KEY_DB, JSON.stringify(data));
      await AsyncStorage.setItem(STORAGE_KEY_META, JSON.stringify(metadata));
      await AsyncStorage.setItem(STORAGE_KEY_DATE, new Date().toISOString());
      
      // ATUALIZA O REPOSITÓRIO COM O DADO NOVO
      setDatabase(data);

      console.log('Dados atualizados da nuvem com sucesso.');
      return {
        tables: metadata,
        db: data,
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      console.log('Erro ao buscar remoto:', error);
      return null;
    }
  }
};