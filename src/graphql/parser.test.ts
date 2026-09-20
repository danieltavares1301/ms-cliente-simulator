import { describe, expect, it } from 'vitest';

import {
  GraphqlRequestParseError,
  parseAtualizarClienteGraphqlRequest,
} from './parser';

describe('parseAtualizarClienteGraphqlRequest', () => {
  it('accepts the real application/graphql mutation with fields in any order and mixed literal types', () => {
    const parsed = parseAtualizarClienteGraphqlRequest({
      contentType: 'application/graphql; charset=utf-8',
      body: `mutation{atualizarCliente(cliente:{idProspectSalesforce:"XYZ789",estadoCivil:CASADO,renda:1234.56,dataNascimento:"2000-01-01",nomeCompleto:"Fulano",id:"ABC123",orgaoEmissorDocumento:SSP,nacionalidade:BRASILEIRA,sexo:MASCULINO,cadastroNacional:"12345678900",numeroDocumento:"MG123",dataEmissaoDocumento:"2010-02-03",estadoEmissorDocumento:"MG",naturalidade:"Belo Horizonte",escolaridade:"SUPERIOR",nomeMae:"Maria"}){id}}`,
    });

    expect(parsed.source).toBe('application/graphql');
    expect(parsed.operation).toStrictEqual({
      operation: 'mutation',
      field: 'atualizarCliente',
      cliente: {
        id: 'ABC123',
        nomeCompleto: 'Fulano',
        dataNascimento: '2000-01-01',
        cadastroNacional: '12345678900',
        numeroDocumento: 'MG123',
        dataEmissaoDocumento: '2010-02-03',
        estadoEmissorDocumento: 'MG',
        naturalidade: 'Belo Horizonte',
        escolaridade: 'SUPERIOR',
        nomeMae: 'Maria',
        renda: 1234.56,
        orgaoEmissorDocumento: 'SSP',
        nacionalidade: 'BRASILEIRA',
        sexo: 'MASCULINO',
        estadoCivil: 'CASADO',
        idProspectSalesforce: 'XYZ789',
      },
      selection: ['id'],
    });
  });

  it('accepts the optional application/json wrapper and keeps the same normalized operation', () => {
    const parsed = parseAtualizarClienteGraphqlRequest({
      contentType: 'application/json',
      body: JSON.stringify({
        query:
          'mutation{atualizarCliente(cliente:{id:"ABC123",idProspectSalesforce:"XYZ789"}){id}}',
      }),
    });

    expect(parsed.source).toBe('application/json');
    expect(parsed.operation.cliente).toStrictEqual({
      id: 'ABC123',
      idProspectSalesforce: 'XYZ789',
    });
  });

  it.each([
    {
      name: 'named mutation',
      body: 'mutation AtualizarCliente{atualizarCliente(cliente:{id:"ABC123"}){id}}',
      expectedCode: 'INVALID_GRAPHQL_OPERATION',
      expectedStatus: 422,
    },
    {
      name: 'query operation',
      body: 'query{atualizarCliente(cliente:{id:"ABC123"}){id}}',
      expectedCode: 'INVALID_GRAPHQL_OPERATION',
      expectedStatus: 422,
    },
    {
      name: 'wrong field',
      body: 'mutation{outraCoisa(cliente:{id:"ABC123"}){id}}',
      expectedCode: 'INVALID_GRAPHQL_OPERATION',
      expectedStatus: 422,
    },
    {
      name: 'wrong selection',
      body: 'mutation{atualizarCliente(cliente:{id:"ABC123"}){id nomeCompleto}}',
      expectedCode: 'INVALID_GRAPHQL_SELECTION',
      expectedStatus: 422,
    },
    {
      name: 'wrong argument shape',
      body: 'mutation{atualizarCliente(cliente:"ABC123"){id}}',
      expectedCode: 'INVALID_GRAPHQL_ARGUMENTS',
      expectedStatus: 422,
    },
  ])(
    'rejects $name with a typed, sanitized error',
    ({ body, expectedCode, expectedStatus }) => {
      expect(() =>
        parseAtualizarClienteGraphqlRequest({
          contentType: 'application/graphql',
          body,
        }),
      ).toThrowError(GraphqlRequestParseError);

      try {
        parseAtualizarClienteGraphqlRequest({
          contentType: 'application/graphql',
          body,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(GraphqlRequestParseError);
        expect((error as GraphqlRequestParseError).code).toBe(expectedCode);
        expect((error as GraphqlRequestParseError).status).toBe(expectedStatus);
        expect((error as Error).message).toBe('Invalid GraphQL request');
        expect((error as Error).message).not.toContain('Syntax Error');
        expect((error as Error).message).not.toContain('ABC123');
      }
    },
  );

  it('rejects malformed GraphQL without leaking parser details', () => {
    expect(() =>
      parseAtualizarClienteGraphqlRequest({
        contentType: 'application/graphql',
        body: 'mutation{atualizarCliente(cliente:{id:"ABC123"}){id}',
      }),
    ).toThrowError(GraphqlRequestParseError);

    try {
      parseAtualizarClienteGraphqlRequest({
        contentType: 'application/graphql',
        body: 'mutation{atualizarCliente(cliente:{id:"ABC123"}){id}',
      });
    } catch (error) {
      expect((error as GraphqlRequestParseError).code).toBe(
        'GRAPHQL_PARSE_FAILED',
      );
      expect((error as GraphqlRequestParseError).status).toBe(400);
      expect((error as Error).message).toBe('Invalid GraphQL request');
      expect((error as Error).message).not.toContain('Syntax Error');
      expect((error as Error).message).not.toContain('ABC123');
    }
  });
});
