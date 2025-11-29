import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOCK_DB, TABLES_METADATA, TableMetadata, setDatabase } from '../../data/TableRepository';

const STORAGE_KEY_DB = '@consorcio_db_v1';
const STORAGE_KEY_META = '@consorcio_meta_v1';
const STORAGE_KEY_DATE = '@consorcio_last_update';

// ==================================================================================
// CONFIGURAÇÃO DA API REMOTA (SOLUÇÃO PARA ERRO 429)
// ==================================================================================
// NÃO use 'raw.githubusercontent.com' diretamente, pois ele bloqueia (Erro 429).
// USE 'cdn.jsdelivr.net'. É gratuito, rápido e próprio para isso.
//
// Formato: https://cdn.jsdelivr.net/gh/{SEU_USUARIO}/{SEU_REPOSITORIO}@{BRANCH}/{CAMINHO_DO_ARQUIVO}
// Exemplo: https://cdn.jsdelivr.net/gh/alessandroaun/simuladorconsorcio@main/dados_consorcio.json
// ==================================================================================

//const REMOTE_API_URL = 'https://cdn.jsdelivr.net/gh/alessandroaun/SimuladorConsorcio@master/dados_consorcio.json';
const REMOTE_API_URL = 'https://raw.githubusercontent.com/alessandroaun/SimuladorConsorcio/refs/heads/master/dados_consorcio.json';

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
        const parsedDB = JSON.parse(cachedDB);
        
        // CRUCIAL: Atualiza o repositório para usar os dados do cache
        setDatabase(parsedDB);

        return {
          tables: JSON.parse(cachedMeta),
          db: parsedDB,
          lastUpdate
        };
      }
    } catch (e) {
      console.error('Erro ao ler cache local:', e);
    }

    console.log('Cache vazio ou erro. Usando dados embarcados (Fallback).');
    
    // CRUCIAL: Garante que o repositório use o Mock se não houver cache
    setDatabase(MOCK_DB);

    return {
      tables: TABLES_METADATA,
      db: MOCK_DB,
      lastUpdate: null
    };
  },

  /**
   * Chamado em segundo plano para tentar atualizar os dados da nuvem.
   * Retorna os NOVOS dados baixados (AppData) em caso de sucesso, ou null.
   */
  async syncWithRemote(): Promise<AppData | null> {
    // Verifica se a URL ainda é a padrão/exemplo antes de tentar
    if (!REMOTE_API_URL || REMOTE_API_URL.includes('SEU_USUARIO')) {
      console.log('AVISO: URL remota não configurada. Pulando sync.');
      return null;
    }

    try {
      console.log(`Buscando atualizações em: ${REMOTE_API_URL}`);
      
      // Adicionamos um timestamp na query string para evitar cache stale durante desenvolvimento
      // Em produção, você pode remover o `?t=...` para aproveitar o cache do CDN
      const urlComCacheBuster = `${REMOTE_API_URL}?t=${new Date().getTime()}`;
      
      const response = await fetch(urlComCacheBuster);
      
      if (!response.ok) {
        throw new Error(`Falha ao buscar dados: ${response.status} ${response.statusText}`);
      }
      
      const apiResult = await response.json();
      
      // Validação básica da estrutura
      const { metadata, data } = apiResult;
      if (!data || !metadata) throw new Error("Formato de JSON inválido (esperado { metadata, data })");

      // Salva no celular para a próxima vez
      await AsyncStorage.setItem(STORAGE_KEY_DB, JSON.stringify(data));
      await AsyncStorage.setItem(STORAGE_KEY_META, JSON.stringify(metadata));
      await AsyncStorage.setItem(STORAGE_KEY_DATE, new Date().toISOString());
      
      console.log('Dados atualizados da nuvem e salvos no cache.');
      
      // CRUCIAL: Atualiza o repositório imediatamente com os novos dados da nuvem
      setDatabase(data);

      return {
        tables: metadata,
        db: data,
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      console.log('Erro na sincronização (pode ser falta de internet ou URL errada):', error);
      return null;
    }
  }
};