import { beforeEach, describe, expect, it, vi } from 'vitest';

// Saída falsa da Salesforce CLI por subcomando; nada aqui chama a CLI de verdade.
const saidas = new Map<string, unknown>();
const chamadas: string[][] = [];

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return {
    ...original,
    execFile: (
      _comando: string,
      args: string[],
      _opcoes: unknown,
      callback: (erro: Error | null, resultado: { stdout: string; stderr: string }) => void,
    ) => {
      chamadas.push(args);
      const chave = args.slice(0, args.indexOf('--target-org')).join(' ');
      callback(null, { stdout: JSON.stringify(saidas.get(chave)), stderr: '' });
    },
  };
});

const { loadOrgAccess } = await import('./stress-o10-concurrent-events-lib.ts');

const TOKEN = '00DHZ000006mzDp!AQEAQ-token-sintetico';

function display(accessToken: string) {
  return {
    status: 0,
    result: {
      accessToken,
      instanceUrl: 'https://mrvcomercial--danieldev.sandbox.my.salesforce.com/',
      id: '00DHZ000006mzDp2AI',
      alias: 'mrv-devDan',
      username: 'qa@example.com',
    },
  };
}

describe('loadOrgAccess', () => {
  beforeEach(() => {
    saidas.clear();
    chamadas.length = 0;
  });

  it('pega o token com show-access-token quando o org display o esconde (CLI 2.152 ou mais nova)', async () => {
    saidas.set('org display', display('[REDACTED]'));
    saidas.set('org auth show-access-token', { status: 0, result: { accessToken: TOKEN } });

    const acesso = await loadOrgAccess('sf', 'mrv-devDan');

    expect(acesso.accessToken).toBe(TOKEN);
    expect(acesso.instanceUrl).toBe('https://mrvcomercial--danieldev.sandbox.my.salesforce.com');
    expect(chamadas).toEqual([
      ['org', 'display', '--target-org', 'mrv-devDan', '--json'],
      ['org', 'auth', 'show-access-token', '--target-org', 'mrv-devDan', '--json'],
    ]);
  });

  it('usa o token do org display quando a CLI ainda o mostra', async () => {
    saidas.set('org display', display(TOKEN));

    const acesso = await loadOrgAccess('sf', 'mrv-devDan');

    expect(acesso.accessToken).toBe(TOKEN);
    expect(chamadas).toHaveLength(1);
  });
});
