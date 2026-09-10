import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Só o transporte é substituído; a decisão de estado é a real.
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('../src/lib/db', () => ({ sql }));

import { conferirBanco } from '../src/lib/repo/zap-banco';

const URL_COM_SENHA = 'postgresql://dono:SENHA_SECRETA@ep-exemplo.neon.tech/neondb';

beforeEach(() => { sql.mockReset().mockResolvedValue([]); vi.stubEnv('DATABASE_URL', URL_COM_SENHA); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('conferência do banco', () => {
  it('sem DATABASE_URL não chega a consultar', async () => {
    vi.stubEnv('DATABASE_URL', '');
    await expect(conferirBanco()).resolves.toEqual({ estado: 'sem_variavel' });
    expect(sql).not.toHaveBeenCalled();
  });

  it('variável só com espaços conta como ausente', async () => {
    vi.stubEnv('DATABASE_URL', '   ');
    await expect(conferirBanco()).resolves.toEqual({ estado: 'sem_variavel' });
  });

  it('tabela presente é banco em ordem', async () => {
    sql.mockResolvedValue([{ tabela: 'zap_campaigns' }]);
    await expect(conferirBanco()).resolves.toEqual({ estado: 'ok' });
  });

  it('banco vazio: conecta, responde, mas a tabela não existe', async () => {
    sql.mockResolvedValue([{ tabela: null }]);
    await expect(conferirBanco()).resolves.toEqual({ estado: 'sem_tabelas' });
  });

  it('resposta vazia do driver não vira "ok" por descuido', async () => {
    sql.mockResolvedValue([]);
    await expect(conferirBanco()).resolves.toEqual({ estado: 'sem_tabelas' });
  });

  it('falha de conexão vira estado, nunca exceção na renderização', async () => {
    sql.mockRejectedValue(new Error(`connect ECONNREFUSED ${URL_COM_SENHA}`));
    await expect(conferirBanco()).resolves.toEqual({ estado: 'inacessivel' });
  });

  it('nada do que sai daqui carrega a senha da DATABASE_URL', async () => {
    sql.mockRejectedValue(new Error(`falhou em ${URL_COM_SENHA}`));
    const resultado = await conferirBanco();
    expect(JSON.stringify(resultado)).not.toMatch(/SENHA_SECRETA|neon\.tech|postgresql:/);
  });
});
