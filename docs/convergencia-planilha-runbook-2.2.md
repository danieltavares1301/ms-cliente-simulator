# Convergência entre a planilha e o runbook da 2.2

Comparação, em **2026-10-11**, da planilha oficial de cenários com o
[runbook do projeto](runbook-testes-manuais-unificacao-2.2.md) e com o que o
harness codifica (`scripts/runbook/cenarios.ts` e `verificacoes.ts`).

- **Planilha:** `Hom. Unificação de Leads - USER STORY 918914 - [Unificação de
  clientes 2.2] Regra de validação APÓS a aprovação da PAC.xlsx`, aba "Cenários
  de Testes", com 70 TCs. Fica em `docs/unificacao-clientes/` no checkout do
  `com_salesforce_mrv`, fora do git.
- **Como foi feito:** a planilha foi lida só com a biblioteca padrão do Python.
  Cinco agentes compararam 14 TCs cada, só em leitura. Os pontos que mudam o
  catálogo foram conferidos por mim nos dados das duas campanhas de 11/10 e com
  três experimentos avulsos (seção 4).

## 1. Veredito

- **A estrutura converge.** Os 70 IDs, o status de 68 TCs e o fluxo (Jornada
  de Unidade ou Venda Genérica) dos 44 TCs do harness batem. As exceções:
  - o runbook marca o 022 e o 026 como "E2E integrado concluído em 28/08", e a
    planilha ainda os tem como "Não iniciado";
  - 13 TCs (022 e 030 a 041) são da US 1026579 na planilha; o runbook diz
    cobrir só a 918914.
- **O conteúdo converge no essencial, mas não por inteiro.** Dos 70 TCs, 8
  convergem, 51 convergem em parte e 11 divergem:

| Convergência | TCs | O que significa |
|---|---:|---|
| Converge | 8 | sem diferença de conteúdo |
| Em parte | 51 | o harness deixa de conferir algo que a planilha pede, ou o runbook acrescenta uma exigência; a massa e o resultado batem |
| Diverge | 11 | o runbook ou o harness executam outro cenário, ou cobram o que a planilha não pede, com efeito no catálogo de bugs |

- **Nenhum dos 70 TCs fala de ordem de eventos, HTTP, descarte de parciais,
  origem `InsertClientePAC`, Opportunity ou carimbos de data.** Essas regras são
  só do runbook e do harness (seção 3).

## 2. Os 11 TCs que divergem

| TC | O que a planilha descreve | O que o runbook ou o harness fazem | Efeito |
|---|---|---|---|
| 019 | Y aprovado com o mesmo e-mail A e o mesmo celular B do Lead X | aprovam Y com C/D, livres | o cenário da planilha não roda |
| 026 | proíbe atualizar o e-mail e o celular do Lead Y2 reutilizado | o harness não confere os contatos do Y2 | **esconde um bug** (B10, seção 4) |
| 029 | executável: a Account X, incompleta, passa a representar Y | `BLOCKED-FUNCIONAL` por conflito com a regra mestra | fica sem teste até a decisão |
| 044 | o Lead Y já tem os contatos aprovados (C/D) | o harness dá ao Lead Y os contatos E/F, como no 047 | não há o que preservar na planilha |
| 046 | aprova Y com o celular B, o mesmo de X, e reutiliza o Lead que tem B | o runbook trocou B por D sem registrar | **o K2 do 046 é artefato** (seção 4) |
| 047 | não fala dos contatos do Lead Y; só manda a Account Y refletir a PAC | o harness exige o Lead Y com os contatos E/F preservados | a exigência não vem da planilha, e sim da regra da 2.2 (`d6f147d303`) e do teste da QA; **foi mantida** |
| 053 | inclusão de proponente adicional, sem troca do principal | o harness troca o principal na aprovação e exige a Opportunity em Y | o cenário da planilha não roda |
| 055 | inclusão de proponente adicional; o Lead Y não pode mudar os contatos | o harness troca o principal, e a 1ª PAC de X sai com o e-mail A, embora X tenha o C | **o B9 do 055 é artefato** (seção 4) |
| 056 | igual ao 055 | igual ao 055 | **o B9 do 056 é artefato** |
| 057 | inclusão de proponente adicional | o harness repete o TC-041 (troca do principal) | as células do 057 repetem as do 041 |
| 065 | não existe Lead de X | o runbook cria X sincronizado e não diz o esperado | fica `BLOCKED-FUNCIONAL` |

## 3. Regras que só o runbook e o harness têm

| Regra | Onde | Situação |
|---|---|---|
| Perfis de ordem PA, CA e ME, e os acrescentados pelo harness | runbook §4.1.1 e harness | a planilha não trata de ordem de eventos |
| Descarte dos parciais com HTTP 200 e zero DML em X antes do cliente | runbook §4.2 | é a origem do K1 |
| Opportunity na Account aprovada | runbook §4.6.5 | supõe a troca do principal; nos TCs de proponente adicional, a planilha a deixa com o principal |
| Nenhum job ou log com erro | runbook §4.6.5 | |
| Lead novo com origem `InsertClientePAC` | 001, 016, 036, 041, 057 | a planilha pede só o Lead com CPF, sem contatos |
| "Account X intacta" inclui o carimbo da pendência e os marcadores de evento | harness | a planilha proíbe qualquer mudança na Account X no 038 e no 040; nos 041 a 049, protege os dados cadastrais e o Lead X |
| Lead Y com os contatos preservados | 047 | a planilha não pede (o 019, o 048, o 055 e o 056 pedem; o 047 não); vem da regra do commit `d6f147d303` e do teste da QA de 29/08, e foi mantida |
| Uma Account Z de terceira pessoa | 007 | a planilha não diz de quem é o Lead com C/D |
| Um X que muda para Y | 062 | a planilha só tem a Account Y; as células do B1 (C2, C3) e do B2 (C4) no 062 vêm desse X |

A convenção de contatos da seção 3.1 do runbook define só A/B e C/D. E/F (do
Lead Y preexistente) e G (do candidato) só existem no harness.

## 4. O que muda no catálogo de bugs

Conferido por mim nos dados das campanhas de 11/10 e com execuções avulsas
(arquivos do harness alterados só durante o experimento e restaurados depois):

- **Bug novo, B10 (TC-026).** O Lead Y2, reutilizado e criado sem celular,
  termina com o celular B, o mesmo do Lead X, em 11 dos 13 perfis: PA, CA, ME,
  AM, RC, EP, RL e C1 a C4, nas duas campanhas. Só o AR e o FW o deixam sem
  celular. Fere a planilha ("não deve atualizar o celular do lead selecionado")
  e a regra mestra. O harness não pega porque não confere os contatos do Y2.
  Pela leitura do código, deve ser o mesmo ramo de escrita do B6: o reuso do
  Lead do mesmo CPF preenche contatos vazios sem checar colisão. Isso não foi
  isolado à parte.
- **B9.** No 047, a planilha não pede preservar os contatos do Lead Y; a
  exigência vem da regra da 2.2 (commit `d6f147d303`) e do teste da QA de
  29/08, e o B9 continua valendo ali. No 055 e no 056, o efeito vinha da massa
  incoerente do harness: com a 1ª PAC
  de X levando os contatos que X tem, o AR e o FW só acusam o carimbo do B8, e
  o Lead Y fica intacto (`TC055-AR-31fa8e`, `TC056-FW-ef2334`). O mecanismo do
  B9 continua: a Account Y nasce com os contatos de X, e a PAC aprovada os
  corrige. Mas o estado final que a planilha confere não fica errado.
- **K2 do 046 é artefato.** Com a massa da planilha (o candidato com o celular
  B), o candidato é reutilizado em PA, CA, ME e AR (`TC046-PA-ac4be3`,
  `TC046-CA-14efa3`). O K2 segue com base no 045 (o critério é o e-mail) e no
  049 (e-mail e celular). O resultado reforça a hipótese do catálogo: o Apex
  procura o candidato pelos contatos de X.
- **K1 é regra do runbook.** A planilha do 040 não fala de HTTP nem de descarte.
- **B1 e B8 que só mudam carimbos:** contam no 038 e no 040, em que a planilha
  proíbe qualquer alteração na Account X. Nos 041 a 049, pela letra, não ferem
  a planilha; depende de decidir se o carimbo da pendência conta como alteração
  de X.
- **Têm base na planilha:** B3, B4, B5, B6, B7 e o B2 do 042, que troca o
  celular de X.
- **TCs 053 a 057 e 062:** as células desses TCs vêm de cenários que a planilha
  não descreve.

## 5. Bloqueados e `BLOCKED-FUNCIONAL`

- **Contradição na própria planilha:** 008 (premissas e critério descrevem
  topologias diferentes), 061 (as colunas dizem Venda Genérica, e o Gherkin
  descreve Venda de Unidade), 064 (preservar e preencher o mesmo IdCliente) e
  065 (vincular o IdProspect novo repara uma Account que a planilha manda
  preservar).
- **Conflito com a regra mestra, sem contradição interna:** 029, 052, 058 e
  060 pedem, de forma coerente, mudar para outra pessoa o CPF de registros sem
  IdCliente. O 059 e o 061 pedem a mesma mutação, mas o runbook não os marca
  como `BLOCKED-FUNCIONAL`.
- **Limitação técnica:** 050. A busca pós-PAC (`getClientePosPac`) não usa
  e-mail nem celular.
- **Bloqueio só em parte justificado:** 028. A planilha já fixa "a mais
  recentemente modificada"; só não diz de quem são os prospects antigos.
- **Problemas que o runbook não registra:** no 069 e no 070, o Lead está
  vinculado a uma Account sem IdProspect, o que a seção 3.3 não permite.
- **Proponente adicional:** onze TCs (057 a 061, 063 e 066 a 070), além dos
  051 a 056, descrevem a inclusão de um proponente na jornada. O harness só
  modela a troca do principal na aprovação.

## 6. Duas versões do runbook

O runbook do projeto foi copiado do `com_salesforce_mrv` em 23/09 e exige três
perfis (PA, CA e ME). A cópia que está hoje em `docs/unificacao-clientes/`, no
checkout do `com_salesforce_mrv`, exige seis:
- os mesmos três;
- `ORDEM-PAC-MUTAVEL`;
- `ORDEM-PAC-APROVADA-REENTREGUE`;
- `ORDEM-INTERVENCAO-MANUAL-POS-PAC`.

Ela acrescenta ainda dois perfis condicionais, `ORDEM-CORRIDA-QUEUEABLE-VS-PAC`
e `ORDEM-PARCIAIS-ANTES-IDENTIDADE-ANTIGA`, e registra resultados de agosto que
a cópia do projeto não tem. Nenhuma das duas versões tira os perfis da
planilha, que não trata de ordem de eventos.

## 7. Alinhamento feito em 12/10

O harness foi alinhado à planilha em 12/10 e medido na
[campanha alinhada](resultado-runbook-completo-alinhado-2026-10-12.md):

1. **Massa e execução como na planilha:**
   - o 019 aprova Y com A/B;
   - no 044, o Lead Y tem os contatos aprovados;
   - no 046, o candidato tem o celular B;
   - a 1ª PAC de X sai com os contatos que X tem.
2. **Verificações que a planilha pede, comuns a todos os TCs:**
   - contatos e IdCliente da Account aprovada;
   - nenhuma Account a mais com o CPF aprovado;
   - CPF e contatos do Proponente.

   Passaram nos 466 RUNs em que rodaram.
3. **Verificações por TC:** o CPF e os contatos do Lead no 004, os contatos do
   Lead no 039 e os contatos do Lead Y2 no 026. Esta última acusa o B10 em 11
   perfis.
4. **O 047** mantém a exigência de preservar os contatos do Lead Y, que vem da
   regra da 2.2 e do teste da QA, e não da planilha. Ela chegou a ser tirada e
   voltou no mesmo dia; com ela, o B9 aparece no 047, no AR e no FW.
5. **Os 053 a 057**, de proponente adicional, saíram do `--todos`
   (`foraDoModelo` em `scripts/runbook/cenarios.ts`).

Pendente:

- **Extras a decidir com PO/QA:** a origem `InsertClientePAC` do Lead novo e
  o carimbo da pendência na Account X.
- **Leituras do runbook que seguem como estão:**
  - a Account Z do 007;
  - o candidato sem CPF do 012 e do 013;
  - a caixa do IdCliente no 014 e no 015;
  - o critério de "mais recente" do 025;
  - o X a mais do 062.
- **Versão do runbook:** escolher a que vale, com três ou seis perfis.

## 8. Os 70 TCs

"Fora" é TC que o harness não roda (bloqueado na planilha ou
`BLOCKED-FUNCIONAL`). A tabela mostra a situação antes do alinhamento de
12/10: depois dele, o 019, o 026, o 044 e o 046 seguem a planilha, o 047 mantém
a exigência da 2.2 e os 053 a 057 saíram do `--todos`.

| TC | Convergência | Ponto principal |
|---|---|---|
| 001 | em parte | Lead só com CPF e origem `InsertClientePAC` vêm do 016; pela letra do 001, um Lead com A/B passaria |
| 002 | converge | |
| 003 | em parte | a atualização da Account e do Lead no MATCH não é conferida |
| 004 | em parte | o CPF no Lead X, ponto central do TC, não é conferido |
| 005 | em parte | contatos da Account Y não conferidos |
| 006 | em parte | contatos da Account Y não conferidos |
| 007 | em parte | a Account Z é leitura do runbook; contatos e unicidade da Account Y não conferidos |
| 008 | em parte (fora) | contradição confirmada; há uma terceira topologia possível |
| 009 | em parte | contatos da Account Y; o Lead Y preservado é pedido e conferido |
| 010 | em parte | contatos e unicidade da Account Y |
| 011 | em parte | idem; o título do critério foi copiado do 010 |
| 012 | em parte | o candidato "sem CPF" é leitura; o ramo que gera IdProspect não roda |
| 013 | em parte | idem; o B5 tem base |
| 014 | em parte | a caixa do IdCliente gravado muda para a do evento; nenhuma fonte diz se deve ser mantida |
| 015 | em parte | o reuso pode vir pelo CPF; o TC não isola o match do IdCliente sem caixa |
| 016 | em parte | origem `InsertClientePAC` a mais; IdCliente e contatos da Account não conferidos |
| 017 | em parte | contatos e IdCliente da Account Y |
| 018 | em parte | contatos e IdCliente da Account Y |
| 019 | **diverge** | a planilha aprova Y com os mesmos A/B do Lead X |
| 020 | em parte | contatos da Account Y |
| 021 | em parte | contatos e unicidade; o B4 tem base |
| 022 | em parte | contatos e unicidade; é da US 1026579 |
| 023 | em parte | contatos e IdCliente da Account Y |
| 024 | em parte | contatos do Lead Y preso; unicidade |
| 025 | em parte | a variante com IdProspect não roda; o critério de "mais recente" não é distinguido |
| 026 | **diverge** | contatos do Lead Y2 não conferidos: esconde o B10 |
| 027 | em parte | contatos e unicidade |
| 028 | em parte (fora) | bloqueio só em parte justificado |
| 029 | **diverge** (fora) | executável na planilha; bloqueado pela regra mestra |
| 030 | converge (fora) | |
| 031 | em parte (fora) | mutação X→Y sem condição; o runbook chama de X o 2º proponente |
| 032 | converge (fora) | |
| 033 | em parte (fora) | a colisão é dedução do runbook |
| 034 | em parte (fora) | a planilha pede as duas colisões; o runbook admite uma |
| 035 | em parte (fora) | idem ao 034 |
| 036 | em parte (fora) | origem `InsertClientePAC` a mais |
| 037 | em parte (fora) | mutação Y→Z sem condição |
| 038 | em parte | contatos de Y1; B1 e B2 contam mesmo só com carimbo |
| 039 | em parte | contatos do Lead (C/D) não conferidos |
| 040 | em parte | K1 é regra do runbook; a cadeia E2E não fecha sem Lead X |
| 041 | em parte | origem `InsertClientePAC` a mais; B1 e B8 só com carimbo não ferem a letra |
| 042 | em parte | idem; o B2 troca o celular de X e fere |
| 043 | em parte | unicidade e contatos da Account Y |
| 044 | **diverge** | na planilha, o Lead Y já tem os contatos aprovados |
| 045 | em parte | o K2 tem base; gravar o CPF Y no candidato é a mais |
| 046 | **diverge** | celular B trocado por D; com B, o K2 some |
| 047 | **diverge** | a planilha não pede preservar os contatos do Lead Y |
| 048 | em parte | contatos da Account; preservar o Lead Y é explícito |
| 049 | em parte | o K2 tem base (e-mail e celular) |
| 050 | em parte (fora) | limitação técnica, não contradição |
| 051 | em parte (fora) | não pede Account Y |
| 052 | em parte (fora) | conflito com a regra mestra |
| 053 | **diverge** | proponente adicional modelado como troca do principal |
| 054 | em parte | X principal e proponente ao mesmo tempo; Opportunity a mais |
| 055 | **diverge** | proponente adicional; massa incoerente; com a massa coerente, o B9 some |
| 056 | **diverge** | idem ao 055 |
| 057 | **diverge** | proponente adicional; o harness repete o 041 |
| 058 | em parte (fora) | conflito com a regra mestra |
| 059 | em parte (fora) | mesma mutação Y→Z, sem bloqueio funcional no runbook |
| 060 | em parte (fora) | conflito com a regra mestra; origem da alteração indefinida |
| 061 | em parte (fora) | contradição Venda Genérica × Venda de Unidade; a massa do runbook sai sem IdProspect |
| 062 | em parte | o harness acrescenta um X que a planilha não tem |
| 063 | em parte (fora) | conferir o Lead completo ao desbloquear |
| 064 | em parte (fora) | contradição: preservar e preencher o mesmo IdCliente |
| 065 | **diverge** (fora) | sem Lead X na planilha; reparo × preservação |
| 066 | converge (fora) | |
| 067 | converge (fora) | |
| 068 | converge (fora) | o desempate pela última modificação é explícito |
| 069 | converge (fora) | vínculo impossível, que o runbook não registra |
| 070 | converge (fora) | ambiguidade declarada; vínculo impossível |
