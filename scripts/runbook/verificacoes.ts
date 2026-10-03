import {
  contaDaPessoa,
  ehPerfilIdentidade,
  type AccountRegistro,
  type Aprovacao,
  type Assercao,
  type EvidenciaIdentidade,
  type Execucao,
  type LeadRegistro,
  type Perfil,
  type Snapshot,
} from './engine.ts';

// Marcadores de contato e o carimbo de pendência pegam escritas indevidas mesmo
// quando o valor gravado coincide (ex.: TC-001, Y com os contatos de X).
const camposAccount = [
  'Id__c',
  'IdProspectSalesforce__c',
  'CPF__pc',
  'PersonEmail',
  'Celular__c',
  'LastName',
  'DataAlteracaoEvento__c',
  'DataAlteracaoEventoContatoEmail__c',
  'DataAlteracaoEventoContatoCelular__c',
  'ContatoDataHoraAtualizacaoEmailPendencia',
] as const;
const camposLead = [
  'Id__c',
  'CPF__c',
  'Email',
  'MobilePhone',
  'CelularSemFormatacao__c',
  'LastName',
] as const;

/** Asserção que, no pool paralelo, pode acusar job de outro RUN (a janela é da org). */
export const NOME_ASSERCAO_JOBS = 'Nenhum job assíncrono com erro na janela do RUN';

function digitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

function vazio(valor: string | null | undefined): boolean {
  return (valor ?? '').trim().length === 0;
}

function celularDoLead(lead: LeadRegistro): string {
  return digitos(lead.CelularSemFormatacao__c) || digitos(lead.MobilePhone);
}

function mesmoCelular(atual: string, esperado: string): boolean {
  // O celular pode voltar com DDI (55) na frente.
  return atual === esperado || atual === `55${esperado}`;
}

/** Asserções sobre o estado final de um RUN, na linguagem do runbook. */
export class Verificador {
  constructor(
    readonly execucao: Execucao,
    readonly aprovacao: Aprovacao,
    readonly final: Snapshot,
    readonly intermediario: Snapshot | null,
    readonly prospectY: string | null,
  ) {}

  get pessoa() {
    return this.aprovacao.pessoa;
  }

  conta(): AccountRegistro | undefined {
    return contaDaPessoa(this.final, this.pessoa, this.aprovacao.idClienteEvento);
  }

  private idsFixture(objeto: 'Account' | 'Lead'): Set<string> {
    return new Set(
      [...this.execucao.fixtures.values()]
        .filter((fixture) => fixture.objeto === objeto)
        .map((fixture) => fixture.registro.Id),
    );
  }

  leadVinculado(conta = this.conta()): LeadRegistro | undefined {
    const prospect = conta?.IdProspectSalesforce__c;
    return prospect
      ? this.final.leads.find(({ Id__c }) => Id__c === prospect)
      : undefined;
  }

  /** Registro da massa com os campos funcionais inalterados (mesmo Salesforce Id). */
  preservado(ref: string, nome = `${ref} preservado`): Assercao {
    const fixture = this.execucao.fixtures.get(ref);
    if (fixture === undefined) {
      return { nome, ok: false, detalhe: `fixture ${ref} inexistente` };
    }
    const atual =
      fixture.objeto === 'Account'
        ? this.final.accounts.find(({ Id }) => Id === fixture.registro.Id)
        : this.final.leads.find(({ Id }) => Id === fixture.registro.Id);
    if (atual === undefined) {
      return { nome, ok: false, detalhe: 'registro não encontrado (apagado?)' };
    }
    const campos =
      fixture.objeto === 'Account' ? camposAccount : camposLead;
    const diferencas = campos.flatMap((campo) => {
      const antes = (fixture.registro as Record<string, unknown>)[campo] ?? null;
      const depois = (atual as Record<string, unknown>)[campo] ?? null;
      return antes === depois ? [] : [{ campo, antes, depois }];
    });
    return {
      nome,
      ok: diferencas.length === 0,
      ...(diferencas.length ? { detalhe: diferencas } : {}),
    };
  }

  xIntacto(): Assercao[] {
    return [
      this.preservado('accountX', 'Account X intacta'),
      this.preservado('leadX', 'Lead X intacto'),
    ];
  }

  contasDoCpf(esperado: number): Assercao {
    const contas = this.final.accounts.filter(
      ({ CPF__pc }) => CPF__pc === this.pessoa.cpf,
    );
    return {
      nome: `${esperado} Account(s) com o CPF aprovado`,
      ok: contas.length === esperado,
      detalhe: { encontradas: contas.map(({ Id, Id__c }) => ({ Id, Id__c })) },
    };
  }

  leadsDoCpf(esperado: number): Assercao {
    const leads = this.final.leads.filter(
      ({ CPF__c }) => CPF__c === this.pessoa.cpf,
    );
    return {
      nome: `${esperado} Lead(s) com o CPF aprovado`,
      ok: leads.length === esperado,
      detalhe: { encontrados: leads.map(({ Id, Id__c }) => ({ Id, Id__c })) },
    };
  }

  contaReutilizada(ref: string): Assercao {
    const conta = this.conta();
    const fixture = this.execucao.fixtures.get(ref)?.registro.Id;
    return {
      nome: `Account aprovada é a ${ref} (mesmo Salesforce Id)`,
      ok: conta !== undefined && conta.Id === fixture,
      detalhe: { esperado: fixture, obtido: conta?.Id ?? null },
    };
  }

  contaNova(): Assercao {
    const conta = this.conta();
    return {
      nome: 'Account aprovada é nova',
      ok: conta !== undefined && !this.idsFixture('Account').has(conta.Id),
      detalhe: { obtido: conta?.Id ?? null },
    };
  }

  contaComIdCliente(): Assercao {
    const conta = this.conta();
    return {
      nome: 'Account aprovada com o IdCliente aprovado',
      ok:
        (conta?.Id__c ?? '').toLowerCase() ===
        this.pessoa.idCliente.toLowerCase(),
      detalhe: { obtido: conta?.Id__c ?? null },
    };
  }

  contaSemProspect(): Assercao {
    const conta = this.conta();
    return {
      nome: 'Caso C: Account aprovada sem IdProspect',
      ok: conta !== undefined && vazio(conta.IdProspectSalesforce__c),
      detalhe: { obtido: conta?.IdProspectSalesforce__c ?? null },
    };
  }

  contaComContatos(email: string, celular: string): Assercao {
    const conta = this.conta();
    return {
      nome: 'Account aprovada com os contatos da PAC',
      ok:
        (conta?.PersonEmail ?? '').toLowerCase() === email.toLowerCase() &&
        mesmoCelular(digitos(conta?.Celular__c), celular),
      detalhe: { email: conta?.PersonEmail ?? null, celular: conta?.Celular__c ?? null },
    };
  }

  vinculo(): Assercao {
    const conta = this.conta();
    const lead = this.leadVinculado(conta);
    return {
      nome: 'Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c)',
      ok: lead !== undefined,
      detalhe: { prospect: conta?.IdProspectSalesforce__c ?? null },
    };
  }

  /** Lead novo vinculado à Account aprovada; `null` exige o campo vazio. */
  leadNovo(esperado: {
    email: string | null;
    celular: string | null;
    origemInsertClientePac?: boolean;
  }): Assercao {
    const lead = this.leadVinculado();
    const problemas: string[] = [];
    if (lead === undefined) {
      problemas.push('nenhum Lead vinculado à Account aprovada');
    } else {
      if (this.idsFixture('Lead').has(lead.Id)) problemas.push('é um Lead da massa, não novo');
      if (lead.CPF__c !== this.pessoa.cpf) problemas.push(`CPF ${lead.CPF__c ?? 'vazio'}`);
      const email = (lead.Email ?? '').toLowerCase();
      if (esperado.email === null ? email !== '' : email !== esperado.email.toLowerCase()) {
        problemas.push(`e-mail ${lead.Email ?? 'vazio'}`);
      }
      const celular = celularDoLead(lead);
      if (
        esperado.celular === null
          ? celular !== ''
          : !mesmoCelular(celular, esperado.celular)
      ) {
        problemas.push(`celular ${celular || 'vazio'}`);
      }
      if (
        esperado.origemInsertClientePac &&
        !(lead.DescricaoOrigem__c ?? '').includes('InsertClientePAC')
      ) {
        problemas.push(`DescricaoOrigem__c ${lead.DescricaoOrigem__c ?? 'vazio'}`);
      }
    }
    const partes = [
      esperado.email === null ? 'sem e-mail' : 'com o e-mail aprovado',
      esperado.celular === null ? 'sem celular' : 'com o celular aprovado',
      ...(esperado.origemInsertClientePac ? ['origem InsertClientePAC'] : []),
    ];
    return {
      nome: `Lead novo vinculado, ${partes.join(', ')}`,
      ok: problemas.length === 0,
      ...(problemas.length ? { detalhe: problemas } : {}),
    };
  }

  /** O Lead vinculado à Account aprovada é o da massa (mesmo Salesforce Id). */
  leadReutilizado(
    ref: string,
    opcoes: { cpfPreenchido?: boolean; contatosPreservados?: boolean } = {},
  ): Assercao {
    const lead = this.leadVinculado();
    const fixture = this.execucao.fixtures.get(ref)?.registro as LeadRegistro | undefined;
    const problemas: string[] = [];
    if (lead === undefined || fixture === undefined || lead.Id !== fixture.Id) {
      problemas.push(
        `Lead vinculado ${lead?.Id ?? 'nenhum'} ≠ ${ref} ${fixture?.Id ?? '?'}`,
      );
    } else {
      if (opcoes.cpfPreenchido && lead.CPF__c !== this.pessoa.cpf) {
        problemas.push(`CPF ${lead.CPF__c ?? 'vazio'}`);
      }
      if (
        opcoes.contatosPreservados &&
        ((lead.Email ?? '') !== (fixture.Email ?? '') ||
          celularDoLead(lead) !== celularDoLead(fixture))
      ) {
        problemas.push(
          `contatos alterados: ${lead.Email ?? 'vazio'} / ${celularDoLead(lead) || 'vazio'}`,
        );
      }
    }
    const extras = [
      ...(opcoes.cpfPreenchido ? ['CPF preenchido'] : []),
      ...(opcoes.contatosPreservados ? ['contatos preservados'] : []),
    ];
    return {
      nome: `Lead ${ref} reutilizado e vinculado${extras.length ? ` (${extras.join(', ')})` : ''}`,
      ok: problemas.length === 0,
      ...(problemas.length ? { detalhe: problemas } : {}),
    };
  }

  /** Critérios comuns da simulação (runbook §4.6.5 e catálogo §11). */
  comuns(opcoes: { xAlteravel?: boolean; jobs: unknown[]; logs: unknown[] }): Assercao[] {
    const conta = this.conta();
    const assercoes: Assercao[] = [];
    if (!opcoes.xAlteravel) assercoes.push(...this.xIntacto());
    assercoes.push({
      nome: 'PAC no status aprovado',
      ok: this.final.pac?.Status__c === 'CREDITO_APROVADO_CONDICIONADO',
      detalhe: { obtido: this.final.pac?.Status__c ?? null },
    });
    const proponente = this.final.proponente;
    const problemasProponente: string[] = [];
    if (proponente === null) problemasProponente.push('Proponente não encontrado');
    else {
      if (proponente.Proponente__c !== conta?.Id) {
        problemasProponente.push(`Proponente__c ${proponente.Proponente__c ?? 'vazio'}`);
      }
      if (this.prospectY !== null && proponente.IdProponente__c !== this.prospectY) {
        problemasProponente.push(`IdProponente__c ${proponente.IdProponente__c ?? 'vazio'}`);
      }
    }
    assercoes.push({
      nome: `Proponente principal na Account aprovada${this.prospectY ? ' com PROS-Y' : ''}`,
      ok: problemasProponente.length === 0,
      ...(problemasProponente.length ? { detalhe: problemasProponente } : {}),
    });
    assercoes.push({
      nome: 'Opportunity na Account aprovada',
      ok: conta !== undefined && this.final.oportunidade?.AccountId === conta.Id,
      detalhe: {
        conta: conta?.Id ?? null,
        oportunidade: this.final.oportunidade?.AccountId ?? null,
      },
    });
    // Nos MATCH, X é a própria pessoa aprovada e os parciais são dela.
    if (this.intermediario !== null && !opcoes.xAlteravel) {
      assercoes.push(...this.parciaisSemEfeito(this.intermediario));
    }
    assercoes.push({
      nome: NOME_ASSERCAO_JOBS,
      ok: opcoes.jobs.length === 0,
      ...(opcoes.jobs.length ? { detalhe: opcoes.jobs } : {}),
    });
    assercoes.push({
      nome: 'Nenhum LogIntegracao__c error correlacionado',
      ok: opcoes.logs.length === 0,
      ...(opcoes.logs.length ? { detalhe: opcoes.logs } : {}),
    });
    return assercoes;
  }

  /**
   * Perfis C1 a C4: o RUN só vale se as PACs em análise chegaram ao Proponente
   * e o gatilho aconteceu. Em C1 e C2, X também tem que estar intacta antes da
   * pendência, o que atribui a ela qualquer mudança posterior.
   */
  evidenciasDoPerfil(
    perfil: Perfil,
    evidencia: EvidenciaIdentidade | null,
    xAlteravel: boolean,
  ): Assercao[] {
    if (!ehPerfilIdentidade(perfil)) return [];
    const proponente = evidencia?.precondicao?.proponente ?? null;
    const contaX = this.execucao.fixtures.get('accountX')?.registro.Id;
    const contaDoProponente =
      proponente?.Proponente__c == null
        ? null
        : proponente.Proponente__c === contaX
          ? 'X'
          : proponente.Proponente__c === this.conta()?.Id
            ? 'aprovada'
            : 'outra';
    const assercoes: Assercao[] = [
      {
        nome: `${perfil}: PACs em análise aplicadas ao Proponente`,
        ok:
          proponente !== null &&
          digitos(proponente.CpfProponente__c) === digitos(this.pessoa.cpf) &&
          (proponente.EmailAtualizado__c ?? '').toLowerCase() === this.aprovacao.email.toLowerCase(),
        // Onde o Proponente ficou diz se o caminho alcançou X neste TC.
        detalhe: { contaDoProponente },
      },
      perfil === 'C4'
        ? {
            nome: 'C4: contestação pendente antes das PACs em análise',
            ok: evidencia?.contestacoesAntes === 1,
            detalhe: { pendentes: evidencia?.contestacoesAntes ?? null },
          }
        : {
            nome: `${perfil}: pendência aplicada (flag ligada)`,
            ok: this.final.proponente?.EnviarNotificacaoPendencia__c === true,
          },
    ];
    if ((perfil === 'C1' || perfil === 'C2') && !xAlteravel) {
      assercoes.push(
        evidencia?.precondicao
          ? {
              ...new Verificador(
                this.execucao,
                this.aprovacao,
                evidencia.precondicao,
                null,
                null,
              ).preservado('accountX'),
              nome: `${perfil}: Account X intacta antes da pendência`,
            }
          : { nome: `${perfil}: Account X intacta antes da pendência`, ok: false, detalhe: 'sem snapshot' },
      );
    }
    return assercoes;
  }

  /**
   * PA: contato/endereço de Y com PROS-X antes do cliente não podem mexer em
   * X nem criar estrutura parcial de Y (descarte defensivo, runbook §4.2).
   */
  private parciaisSemEfeito(estado: Snapshot): Assercao[] {
    const naoFixture = (id: string, objeto: 'Account' | 'Lead') =>
      !this.idsFixture(objeto).has(id);
    const contasNovas = estado.accounts.filter(({ Id }) => naoFixture(Id, 'Account'));
    const leadsNovos = estado.leads.filter(({ Id }) => naoFixture(Id, 'Lead'));
    const antesX = new Verificador(
      this.execucao,
      this.aprovacao,
      estado,
      null,
      null,
    );
    return [
      {
        ...antesX.preservado('accountX'),
        nome: 'PA: Account X intacta depois dos parciais',
      },
      {
        nome: 'PA: nenhuma Account/Lead criada pelos parciais',
        ok: contasNovas.length === 0 && leadsNovos.length === 0,
        ...(contasNovas.length || leadsNovos.length
          ? {
              detalhe: {
                accounts: contasNovas.map(({ Id }) => Id),
                leads: leadsNovos.map(({ Id }) => Id),
              },
            }
          : {}),
      },
    ];
  }
}
