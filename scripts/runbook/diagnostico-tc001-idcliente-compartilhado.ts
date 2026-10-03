import {
  connectToTargetOrg,
  logStructured,
  parseCliArguments,
} from '../stress-o10-concurrent-events-lib.ts';
import { Execucao, contaDaPessoa, resumirEstado, type Aprovacao } from './engine.ts';

/**
 * Diagnóstico ad-hoc (fora do catálogo dos 44 TCs): testa se o bug do TC-001
 * ("Account X foi atualizada em vez de criar Account/Lead novos para o CPF
 * Y") é reproduzível quando os eventos parciais/cliente da aprovação
 * carregam o MESMO `idcliente` de X — a hipótese de que, no mundo real, o
 * MS Cliente mantém o `idCliente` original da jornada mesmo quando a PAC é
 * aprovada para um CPF divergente (só o CPF muda, não o idCliente).
 *
 * A modelagem padrão dos 44 TCs (`scripts/runbook/cenarios.ts`) sempre gera
 * um `idCliente` novo e distinto para Y, o que faz a busca de identidade
 * nunca encontrar Account X por ID_CLIENTE (só por fallback de IdProspect,
 * já protegido mesmo na versão revertida). Este script isola a variável.
 *
 * `npx tsx scripts/runbook/diagnostico-tc001-idcliente-compartilhado.ts`
 */
async function main(): Promise<void> {
  const cli = parseCliArguments(process.argv.slice(2));
  const conexao = await connectToTargetOrg(cli);
  const execucao = new Execucao(conexao, 'TC-001-DIAG', 'PA', cli.requestTimeoutMs);

  await execucao.preparar();
  await execucao.precheck();
  await execucao.xSincronizado();

  const aprovacao: Aprovacao = {
    pessoa: execucao.y,
    email: execucao.contatos.emailA,
    celular: execucao.contatos.celularB,
    tipoEventoCliente: 'cliente-insert',
    // Hipótese: o idCliente do evento é o MESMO de X, não um novo para Y.
    idClienteEvento: execucao.x.idCliente,
  };

  logStructured('diag-config', {
    run: execucao.run,
    idClienteX: execucao.x.idCliente,
    idClienteEvento: aprovacao.idClienteEvento,
    cpfX: execucao.x.cpf,
    cpfY: execucao.y.cpf,
  });

  try {
    const { final } = await execucao.executarCadeia(aprovacao, 90_000);
    const contaX = contaDaPessoa(final, execucao.x, execucao.x.idCliente);
    const contaYouXAposEvento = contaDaPessoa(final, execucao.y, aprovacao.idClienteEvento);

    logStructured('diag-resultado', {
      contaX,
      contaEncontradaPeloIdClienteEvento: contaYouXAposEvento,
      totalAccounts: final.accounts.length,
      totalLeads: final.leads.length,
      resumo: resumirEstado(final),
    });

    const xFoiAlterada =
      contaX !== undefined &&
      (contaX.CPF__pc === execucao.y.cpf || contaX.PersonEmail === aprovacao.email);
    logStructured('diag-veredito', {
      bugReproduzido: xFoiAlterada,
      explicacao: xFoiAlterada
        ? 'Account X (mesmo Id__c) passou a refletir dados do CPF Y — bug reproduzido.'
        : 'Account X manteve seus próprios dados — bug NÃO reproduzido nesta variante.',
    });
  } finally {
    const cleanup = await execucao.limpar();
    logStructured('diag-cleanup', cleanup);
  }
}

main().catch((error: unknown) => {
  logStructured('diag-fatal-error', {
    message: error instanceof Error ? error.message : 'Erro desconhecido',
  });
  process.exitCode = 1;
});
