import type { EstadoCampanha } from '../repo/zap-campaigns';

export const ESTADOS_CAMPANHA: Record<EstadoCampanha, string> = {
  draft: 'Rascunho', queued: 'Na fila', running: 'Em andamento', paused: 'Pausada',
  completed: 'Concluída', cancelled: 'Cancelada', failed: 'Interrompida por falha',
};
