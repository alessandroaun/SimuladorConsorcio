import { Category, PlanType } from '../src/utils/ConsortiumCalculator';

// 1. Definição da Interface dos Metadados
export interface TableMetadata {
  id: string;
  name: string;
  category: Category;
  plan: PlanType;
  taxaAdmin: number;
  fundoReserva: number;
  seguroPct: number;
  maxLanceEmbutido: number;
}

// 2. Lista de Tabelas Estática (Fallback/Inicial)
export const TABLES_METADATA: TableMetadata[] = [
  // --- AUTOMÓVEL ---
  { id: 't_auto_L', name: 'Auto Light (75%)', category: 'AUTO', plan: 'LIGHT', taxaAdmin: 0.20, fundoReserva: 0.03, seguroPct: 0.00084, maxLanceEmbutido: 0.25 },
  { id: 't_auto_normal', name: 'Auto Normal', category: 'AUTO', plan: 'NORMAL', taxaAdmin: 0.19, fundoReserva: 0.03, seguroPct: 0.00084, maxLanceEmbutido: 0.25 },
  { id: 't_auto_SL', name: 'Auto Super Light', category: 'AUTO', plan: 'SUPERLIGHT', taxaAdmin: 0.22, fundoReserva: 0.03, seguroPct: 0.00084, maxLanceEmbutido: 0.25 },
  { id: 't_auto5121_107_L', name: 'Auto Grp 5121 Light', category: 'AUTO', plan: 'LIGHT', taxaAdmin: 0.20, fundoReserva: 0.03, seguroPct: 0.00084, maxLanceEmbutido: 0.25 },
  { id: 't_auto5121_107_normal', name: 'Auto Grp 5121 Normal', category: 'AUTO', plan: 'NORMAL', taxaAdmin: 0.19, fundoReserva: 0.03, seguroPct: 0.00084, maxLanceEmbutido: 0.25 },

  // --- IMÓVEL ---
  { id: 't_imovel_normal', name: 'Imóvel Normal', category: 'IMOVEL', plan: 'NORMAL', taxaAdmin: 0.22, fundoReserva: 0.03, seguroPct: 0.00059, maxLanceEmbutido: 0.30 },
  { id: 't_imovel2011_202_L', name: 'Imóvel Grp 2011 Light', category: 'IMOVEL', plan: 'LIGHT', taxaAdmin: 0.25, fundoReserva: 0.03, seguroPct: 0.00059, maxLanceEmbutido: 0.30 },
  { id: 't_imovel2011_202_normal', name: 'Imóvel Grp 2011 Normal', category: 'IMOVEL', plan: 'NORMAL', taxaAdmin: 0.25, fundoReserva: 0.03, seguroPct: 0.00059, maxLanceEmbutido: 0.30 },
  { id: 't_imovel2011_202_SL', name: 'Imóvel Grp 2011 Super Light', category: 'IMOVEL', plan: 'SUPERLIGHT', taxaAdmin: 0.25, fundoReserva: 0.03, seguroPct: 0.00059, maxLanceEmbutido: 0.30 },

  // --- MOTO ---
  { id: 't_moto_normal', name: 'Moto Normal', category: 'MOTO', plan: 'NORMAL', taxaAdmin: 0.19, fundoReserva: 0.03, seguroPct: 0.00084, maxLanceEmbutido: 0.0 },
  
  // --- SERVIÇOS ---
  { id: 't_servicos_normal', name: 'Serviços', category: 'SERVICOS', plan: 'NORMAL', taxaAdmin: 0.20, fundoReserva: 0.03, seguroPct: 0.00084, maxLanceEmbutido: 0.0 },
];

// 3. Dados Expandidos (Mock DB Inicial)
export const MOCK_DB: Record<string, any[]> = {
  // (MANTIVE O CONTEÚDO ORIGINAL REDUZIDO AQUI PARA NÃO OCUPAR ESPAÇO,
  // MAS NO SEU ARQUIVO MANTENHA TODO O CONTEÚDO DO MOCK_DB ORIGINAL)
  't_auto_L': [
    { credito: 130000, prazos: [{ prazo: 60, parcela: 2682.32 }, { prazo: 50, parcela: 3673.20 }, { prazo: 36, parcela: 5230.32 }] },
    // ... restante dos dados originais ...
  ],
  // ... certifique-se de manter todo o MOCK_DB original aqui ...
};


// ============================================================================
//  NOVA LÓGICA DINÂMICA (CORREÇÃO DO PROBLEMA)
// ============================================================================

// Variável que segura o banco de dados ATIVO (Pode ser o Mock ou o baixado da internet)
let activeDB: Record<string, any[]> = MOCK_DB;

/**
 * Atualiza o banco de dados em memória com dados novos (vindos do cache ou API).
 * Chamado pelo App.tsx ou DataService.
 */
export const setDatabase = (newDB: Record<string, any[]>) => {
  activeDB = newDB;
  // console.log('TableRepository: Banco de dados atualizado.');
};

/**
 * Retorna os dados da tabela solicitada usando o banco ATIVO.
 */
export const getTableData = (tableId: string) => {
  // Agora lê de activeDB, não mais diretamente do MOCK_DB
  return activeDB[tableId] || []; 
};