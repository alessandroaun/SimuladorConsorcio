// Definimos os tipos aqui para evitar dependência circular
export type Category = 'AUTO' | 'IMOVEL' | 'MOTO' | 'SERVICOS';
export type PlanType = 'NORMAL' | 'LIGHT' | 'SUPERLIGHT';

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

// 3. Dados Expandidos (Mock DB Inicial Completo)
export const MOCK_DB: Record<string, any[]> = {
  // ========================================================================
  // AUTOMÓVEL
  // ========================================================================
  't_auto_L': [
    { credito: 130000, prazos: [{ prazo: 60, parcela: 2682.32 }, { prazo: 50, parcela: 3673.20 }, { prazo: 36, parcela: 5230.32 }] },
    { credito: 120000, prazos: [{ prazo: 60, parcela: 2475.98 }, { prazo: 50, parcela: 3390.65 }, { prazo: 36, parcela: 4827.98 }] },
    { credito: 110000, prazos: [{ prazo: 60, parcela: 2269.65 }, { prazo: 50, parcela: 3108.10 }, { prazo: 36, parcela: 4425.65 }] },
    { credito: 100000, prazos: [{ prazo: 80, parcela: 1328.32 }, { prazo: 72, parcela: 1464.43 }, { prazo: 60, parcela: 1736.65 }, { prazo: 50, parcela: 2063.32 }, { prazo: 36, parcela: 2825.54 }, { prazo: 25, parcela: 4023.32 }] },
    { credito: 90000, prazos: [{ prazo: 80, parcela: 1195.49 }, { prazo: 72, parcela: 1317.99 }, { prazo: 60, parcela: 1562.99 }, { prazo: 50, parcela: 1856.99 }, { prazo: 36, parcela: 2542.99 }] },
    { credito: 80000, prazos: [{ prazo: 80, parcela: 1062.66 }, { prazo: 72, parcela: 1171.54 }, { prazo: 60, parcela: 1389.32 }, { prazo: 50, parcela: 1650.66 }] },
    { credito: 75000, prazos: [{ prazo: 80, parcela: 996.24 }, { prazo: 72, parcela: 1098.32 }, { prazo: 60, parcela: 1302.49 }, { prazo: 50, parcela: 1547.49 }] },
    { credito: 70000, prazos: [{ prazo: 80, parcela: 929.82 }, { prazo: 72, parcela: 1025.09 }, { prazo: 60, parcela: 1215.66 }] }
  ],

  't_auto_normal': [
    { credito: 130000, prazos: [
        { prazo: 50, parcela_CSV: 3305.22, parcela_SSV: 3172.00 }, 
        { prazo: 36, parcela_CSV: 4538.78, parcela_SSV: 4405.56 },
        { prazo: 25, parcela_CSV: 6477.22, parcela_SSV: 6344.00 }
      ] 
    },
    { credito: 120000, prazos: [
        { prazo: 50, parcela_CSV: 3050.98, parcela_SSV: 2928.00 },
        { prazo: 36, parcela_CSV: 4189.64, parcela_SSV: 4066.67 },
        { prazo: 25, parcela_CSV: 5978.98, parcela_SSV: 5856.00 }
      ]
    },
    { credito: 110000, prazos: [
        { prazo: 50, parcela_CSV: 2796.73, parcela_SSV: 2684.00 },
        { prazo: 36, parcela_CSV: 3840.51, parcela_SSV: 3727.78 },
        { prazo: 25, parcela_CSV: 5480.73, parcela_SSV: 5368.00 }
      ]
    },
    { credito: 100000, prazos: [
        { prazo: 100, parcela_CSV: 1322.48, parcela_SSV: 1220.00 }, 
        { prazo: 80, parcela_CSV: 1627.48, parcela_SSV: 1525.00 },
        { prazo: 72, parcela_CSV: 1796.92, parcela_SSV: 1694.44 },
        { prazo: 60, parcela_CSV: 2135.81, parcela_SSV: 2033.33 },
        { prazo: 50, parcela_CSV: 2542.48, parcela_SSV: 2440.00 },
        { prazo: 36, parcela_CSV: 3491.37, parcela_SSV: 3388.89 }
      ] 
    },
    { credito: 75000, prazos: [
        { prazo: 80, parcela_CSV: 1220.61, parcela_SSV: 1143.75 }, 
        { prazo: 72, parcela_CSV: 1347.69, parcela_SSV: 1270.83 },
        { prazo: 60, parcela_CSV: 1601.86, parcela_SSV: 1525.00 }
      ] 
    },
    { credito: 70000, prazos: [
        { prazo: 80, parcela_CSV: 1139.24, parcela_SSV: 1067.50 },
        { prazo: 60, parcela_CSV: 1495.07, parcela_SSV: 1423.33 }
      ]
    },
    { credito: 65000, prazos: [
        { prazo: 80, parcela_CSV: 1057.86, parcela_SSV: 991.25 },
        { prazo: 60, parcela_CSV: 1388.28, parcela_SSV: 1321.67 }
      ]
    }
  ],

  't_auto_SL': [
    { credito: 100000, prazos: [{ prazo: 80, parcela: 1042.50 }, { prazo: 72, parcela: 1146.67 }, { prazo: 60, parcela: 1355.00 }, { prazo: 50, parcela: 1605.00 }, { prazo: 36, parcela: 2188.33 }] },
    { credito: 90000, prazos: [{ prazo: 80, parcela: 938.25 }, { prazo: 72, parcela: 1032.00 }, { prazo: 60, parcela: 1219.50 }, { prazo: 50, parcela: 1444.50 }] },
    { credito: 80000, prazos: [{ prazo: 80, parcela: 834.00 }, { prazo: 72, parcela: 917.33 }, { prazo: 60, parcela: 1084.00 }, { prazo: 50, parcela: 1284.00 }] },
    { credito: 75000, prazos: [{ prazo: 80, parcela: 781.88 }, { prazo: 72, parcela: 860.00 }, { prazo: 60, parcela: 1016.25 }] },
    { credito: 70000, prazos: [{ prazo: 80, parcela: 729.75 }, { prazo: 72, parcela: 802.67 }, { prazo: 60, parcela: 948.50 }] },
    { credito: 65000, prazos: [{ prazo: 80, parcela: 677.63 }, { prazo: 72, parcela: 745.33 }, { prazo: 60, parcela: 880.75 }] }
  ],

  't_auto5121_107_L': [
    { credito: 110000, prazos: [{ prazo: 107, parcela_CSV: 1121.13, parcela_SSV: 1007.48 }] },
    { credito: 100000, prazos: [{ prazo: 107, parcela_CSV: 1019.21, parcela_SSV: 915.89 }] },
    { credito: 90000, prazos: [{ prazo: 107, parcela_CSV: 917.29, parcela_SSV: 824.30 }] },
    { credito: 80000, prazos: [{ prazo: 107, parcela_CSV: 815.37, parcela_SSV: 732.71 }] }
  ],

  't_auto5121_107_normal': [
    { credito: 110000, prazos: [{ prazo: 107, parcela_CSV: 1366.93, parcela_SSV: 1254.21 }] },
    { credito: 100000, prazos: [{ prazo: 107, parcela_CSV: 1242.67, parcela_SSV: 1140.19 }] },
    { credito: 90000, prazos:  [{ prazo: 107, parcela_CSV: 1118.40, parcela_SSV: 1026.17 }] },
    { credito: 80000, prazos:  [{ prazo: 107, parcela_CSV: 994.13, parcela_SSV: 912.15 }] }
  ],

  // ========================================================================
  // IMÓVEL
  // ========================================================================
  't_imovel_normal': [
    { credito: 250000, prazos: [
        { prazo: 200, parcela_CSV: 1788.80, parcela_SSV: 1600.00 }, 
        { prazo: 180, parcela_CSV: 1920.49, parcela_SSV: 1736.11 },
        { prazo: 160, parcela_CSV: 2137.50, parcela_SSV: 1953.13 },
        { prazo: 140, parcela_CSV: 2397.19, parcela_SSV: 2214.29 },
        { prazo: 120, parcela_CSV: 2541.67, parcela_SSV: 2541.67 },
        { prazo: 100, parcela_CSV: 3203.48, parcela_SSV: 3025.00 }
      ] 
    },
    { credito: 240000, prazos: [
        { prazo: 200, parcela_CSV: 1717.25, parcela_SSV: 1536.00 },
        { prazo: 180, parcela_CSV: 1843.67, parcela_SSV: 1666.67 },
        { prazo: 160, parcela_CSV: 2052.00, parcela_SSV: 1875.00 }
      ] 
    },
    { credito: 230000, prazos: [
        { prazo: 200, parcela_CSV: 1645.70, parcela_SSV: 1472.00 },
        { prazo: 180, parcela_CSV: 1766.85, parcela_SSV: 1597.22 }
      ] 
    },
    { credito: 220000, prazos: [
        { prazo: 200, parcela_CSV: 1574.14, parcela_SSV: 1408.00 },
        { prazo: 180, parcela_CSV: 1690.03, parcela_SSV: 1527.78 }
      ] 
    },
    { credito: 210000, prazos: [
        { prazo: 200, parcela_CSV: 1502.59, parcela_SSV: 1344.00 },
        { prazo: 180, parcela_CSV: 1613.21, parcela_SSV: 1458.33 }
      ] 
    }
  ],

  't_imovel2011_202_L': [
    { credito: 300000, prazos: [{ prazo: 202, parcela_CSV: 1756.26, parcela_SSV: 1520.70 }] },
    { credito: 290000, prazos: [{ prazo: 202, parcela_CSV: 1697.72, parcela_SSV: 1478.71 }] },
    { credito: 280000, prazos: [{ prazo: 202, parcela_CSV: 1639.18, parcela_SSV: 1427.72 }] },
    { credito: 270000, prazos: [{ prazo: 202, parcela_CSV: 1580.64, parcela_SSV: 1376.73 }] },
    { credito: 260000, prazos: [{ prazo: 202, parcela_CSV: 1522.09, parcela_SSV: 1325.74 }] },
    { credito: 250000, prazos: [{ prazo: 202, parcela_CSV: 1463.55, parcela_SSV: 1274.75 }] },
    { credito: 240000, prazos: [{ prazo: 202, parcela_CSV: 1405.01, parcela_SSV: 1223.76 }] },
    { credito: 230000, prazos: [{ prazo: 202, parcela_CSV: 1346.47, parcela_SSV: 1172.77 }] },
    { credito: 220000, prazos: [{ prazo: 202, parcela_CSV: 1287.93, parcela_SSV: 1121.78 }] },
    { credito: 210000, prazos: [{ prazo: 202, parcela_CSV: 1229.38, parcela_SSV: 1070.79 }] }
  ],

  't_imovel2011_202_normal': [
    { credito: 300000, prazos: [{ prazo: 202, parcela_CSV: 2127.55, parcela_SSV: 1900.99 }] },
    { credito: 290000, prazos: [{ prazo: 202, parcela_CSV: 2056.63, parcela_SSV: 1837.62 }] },
    { credito: 280000, prazos: [{ prazo: 202, parcela_CSV: 1985.71, parcela_SSV: 1774.26 }] },
    { credito: 270000, prazos: [{ prazo: 202, parcela_CSV: 1914.80, parcela_SSV: 1710.89 }] },
    { credito: 260000, prazos: [{ prazo: 202, parcela_CSV: 1843.88, parcela_SSV: 1647.52 }] },
    { credito: 250000, prazos: [{ prazo: 202, parcela_CSV: 1772.96, parcela_SSV: 1584.16 }] },
    { credito: 240000, prazos: [{ prazo: 202, parcela_CSV: 1702.04, parcela_SSV: 1520.79 }] },
    { credito: 230000, prazos: [{ prazo: 202, parcela_CSV: 1631.12, parcela_SSV: 1457.43 }] },
    { credito: 220000, prazos: [{ prazo: 202, parcela_CSV: 1560.20, parcela_SSV: 1394.06 }] }
  ],

  't_imovel2011_202_SL': [
    { credito: 300000, prazos: [{ prazo: 202, parcela_CSV: 1177.06, parcela_SSV: 950.50 }] },
    { credito: 290000, prazos: [{ prazo: 202, parcela_CSV: 1137.82, parcela_SSV: 918.81 }] },
    { credito: 280000, prazos: [{ prazo: 202, parcela_CSV: 1098.58, parcela_SSV: 887.13 }] },
    { credito: 270000, prazos: [{ prazo: 202, parcela_CSV: 1059.35, parcela_SSV: 855.45 }] },
    { credito: 260000, prazos: [{ prazo: 202, parcela_CSV: 1020.11, parcela_SSV: 823.76 }] },
    { credito: 250000, prazos: [{ prazo: 202, parcela_CSV: 980.88, parcela_SSV: 792.08 }] },
    { credito: 240000, prazos: [{ prazo: 202, parcela_CSV: 941.64, parcela_SSV: 760.40 }] },
    { credito: 230000, prazos: [{ prazo: 202, parcela_CSV: 902.41, parcela_SSV: 728.71 }] },
    { credito: 220000, prazos: [{ prazo: 202, parcela_CSV: 863.17, parcela_SSV: 697.03 }] },
    { credito: 210000, prazos: [{ prazo: 202, parcela_CSV: 823.94, parcela_SSV: 665.35 }] }
  ],

  // ========================================================================
  // MOTOCICLETA
  // ========================================================================
  't_moto_normal': [
    { credito: 30000, prazos: [
        { prazo: 80, parcela_CSV: 488.24, parcela_SSV: 457.50 },
        { prazo: 72, parcela_CSV: 539.08, parcela_SSV: 508.33 },
        { prazo: 60, parcela_CSV: 640.74, parcela_SSV: 610.00 },
        { prazo: 50, parcela_CSV: 762.74, parcela_SSV: 732.00 },
        { prazo: 36, parcela_CSV: 1047.41, parcela_SSV: 1016.67 },
        { prazo: 25, parcela_CSV: 1494.74, parcela_SSV: 1464.00 }
      ] 
    },
    { credito: 27500, prazos: [
        { prazo: 80, parcela_CSV: 447.56, parcela_SSV: 419.38 },
        { prazo: 72, parcela_CSV: 494.15, parcela_SSV: 465.97 },
        { prazo: 60, parcela_CSV: 587.35, parcela_SSV: 559.17 },
        { prazo: 50, parcela_CSV: 699.18, parcela_SSV: 671.00 },
        { prazo: 36, parcela_CSV: 960.13, parcela_SSV: 931.94 },
        { prazo: 25, parcela_CSV: 1370.18, parcela_SSV: 1342.00 }
      ] 
    },
    { credito: 25000, prazos: [
        { prazo: 80, parcela_CSV: 406.87, parcela_SSV: 381.25 },
        { prazo: 72, parcela_CSV: 449.23, parcela_SSV: 423.61 },
        { prazo: 60, parcela_CSV: 533.95, parcela_SSV: 508.33 },
        { prazo: 50, parcela_CSV: 635.62, parcela_SSV: 610.00 },
        { prazo: 36, parcela_CSV: 872.84, parcela_SSV: 847.22 },
        { prazo: 25, parcela_CSV: 1245.62, parcela_SSV: 1220.00 }
      ] 
    },
    { credito: 22500, prazos: [
        { prazo: 80, parcela_CSV: 366.18, parcela_SSV: 343.12 },
        { prazo: 72, parcela_CSV: 404.31, parcela_SSV: 381.25 },
        { prazo: 60, parcela_CSV: 480.56, parcela_SSV: 457.50 },
        { prazo: 50, parcela_CSV: 572.06, parcela_SSV: 549.00 },
        { prazo: 36, parcela_CSV: 785.56, parcela_SSV: 762.50 }
      ] 
    }
  ],

  // ========================================================================
  // SERVIÇOS
  // ========================================================================
  't_servicos_normal': [
    { credito: 20000, prazos: [{ prazo: 25, parcela_CSV: 1004.66, parcela_SSV: 984.00 }] },
    { credito: 19000, prazos: [{ prazo: 25, parcela_CSV: 954.43, parcela_SSV: 934.80 }] },
    { credito: 18000, prazos: [{ prazo: 25, parcela_CSV: 904.20, parcela_SSV: 885.60 }] },
    { credito: 17000, prazos: [{ prazo: 25, parcela_CSV: 853.96, parcela_SSV: 836.40 }] },
    { credito: 16000, prazos: [{ prazo: 25, parcela_CSV: 803.73, parcela_SSV: 787.20 }] },
    { credito: 15000, prazos: [{ prazo: 25, parcela_CSV: 753.50, parcela_SSV: 738.00 }] },
    { credito: 14000, prazos: [{ prazo: 25, parcela_CSV: 703.26, parcela_SSV: 688.80 }] },
    { credito: 13000, prazos: [{ prazo: 25, parcela_CSV: 653.03, parcela_SSV: 639.60 }] }
  ]
};

// ============================================================================
//  NOVA LÓGICA DINÂMICA
// ============================================================================

// Variável que segura o banco de dados ATIVO (Inicialmente usa o Mock)
let activeDB: Record<string, any[]> = MOCK_DB;

/**
 * Atualiza o banco de dados em memória com dados novos (vindos do cache ou API).
 * Chamado pelo App.tsx ou DataService quando novos dados são carregados.
 */
export const setDatabase = (newDB: Record<string, any[]>) => {
  activeDB = newDB;
  console.log('TableRepository: Banco de dados atualizado com', Object.keys(newDB).length, 'tabelas.');
};

/**
 * Retorna os dados da tabela solicitada usando o banco ATIVO.
 * Assim, se o app tiver baixado dados novos, esta função retornará eles.
 */
export const getTableData = (tableId: string) => {
  return activeDB[tableId] || []; 
};