import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BACKGROUND_SYNC_BUDGET_MS,
  isDefinitiveRefusal,
  MANUAL_RETRY_BUDGET_MS,
  MAX_RECORDS_PER_BATCH,
  MAX_SELFIES_PER_BATCH,
  nextAttemptTimeoutMs,
  planBatches,
  PUNCH_FLUSH_BUDGET_MS,
  selfieFileName,
  UPLOAD_MAX_MS,
  uploadTimeoutMs,
} from './syncBatching.ts';

/**
 * Roda com `npm test` (node --test, sem emulador e sem módulo nativo — ver o cabeçalho de
 * ./syncBatching.ts). O que estes testes guardam é o motivo de a fila do app ter travado em
 * produção: lote grande demais para o tempo que ele tinha.
 */

const comSelfie = (n: number) => Array.from({ length: n }, (_, i) => ({ selfie_uri: `/doc/s${i}.jpg`, id: i }));
const semSelfie = (n: number) => Array.from({ length: n }, (_, i) => ({ selfie_uri: null, id: 100 + i }));

describe('planBatches', () => {
  it('não deixa um lote passar do teto de selfies', () => {
    const batches = planBatches(comSelfie(10));

    assert.equal(batches.length, 4);
    assert.deepEqual(batches.map((b) => b.length), [3, 3, 3, 1]);
    batches.forEach((batch) => assert.ok(batch.length <= MAX_SELFIES_PER_BATCH));
  });

  it('agrupa mais marcações quando elas não carregam foto', () => {
    const batches = planBatches(semSelfie(60));

    assert.deepEqual(batches.map((b) => b.length), [MAX_RECORDS_PER_BATCH, MAX_RECORDS_PER_BATCH, 10]);
  });

  /**
   * A ordem é o que faz o servidor acertar o tipo da batida: ele corrige entrada/saída lendo a
   * marcação anterior já gravada. Um lote fora de ordem grava uma saída antes da entrada dela.
   */
  it('preserva a ordem da fila ao partir', () => {
    const fila = [...comSelfie(2), ...semSelfie(2), ...comSelfie(2)];

    const achatado = planBatches(fila).flat().map((r) => r.id);

    assert.deepEqual(achatado, fila.map((r) => r.id));
  });

  it('devolve lista vazia para fila vazia', () => {
    assert.deepEqual(planBatches([]), []);
  });

  it('não parte uma fila que já cabe num lote só', () => {
    assert.equal(planBatches(comSelfie(3)).length, 1);
    assert.equal(planBatches(semSelfie(MAX_RECORDS_PER_BATCH)).length, 1);
  });
});

describe('uploadTimeoutMs', () => {
  /**
   * O caso que travou o app: antes, QUALQUER lote tinha 10s. Um lote com foto não cabe em 10s
   * em rede de celular, então ele falhava sempre e levava a fila inteira junto.
   */
  it('dá muito mais tempo que os 10s do cliente quando há foto', () => {
    assert.ok(uploadTimeoutMs(comSelfie(1)) > 10_000);
    assert.ok(uploadTimeoutMs(comSelfie(3)) > uploadTimeoutMs(comSelfie(1)));
  });

  it('não passa do teto absoluto', () => {
    assert.equal(uploadTimeoutMs(comSelfie(50)), UPLOAD_MAX_MS);
  });

  it('cobra só o básico quando não há foto para subir', () => {
    assert.equal(uploadTimeoutMs(semSelfie(25)), uploadTimeoutMs([]));
  });
});

describe('nextAttemptTimeoutMs', () => {
  it('limita a tentativa ao que sobra do orçamento', () => {
    const sobra = 7_000;

    assert.equal(nextAttemptTimeoutMs(comSelfie(3), BACKGROUND_SYNC_BUDGET_MS - sobra, BACKGROUND_SYNC_BUDGET_MS), sobra);
  });

  /** Lote que nasce com timeout curto demais falha por tempo mesmo com a rede boa — e não marca nada. */
  it('desiste em vez de começar um lote que não tem tempo de terminar', () => {
    assert.equal(nextAttemptTimeoutMs(comSelfie(1), BACKGROUND_SYNC_BUDGET_MS - 1_000, BACKGROUND_SYNC_BUDGET_MS), null);
    assert.equal(nextAttemptTimeoutMs(comSelfie(1), BACKGROUND_SYNC_BUDGET_MS, BACKGROUND_SYNC_BUDGET_MS), null);
  });

  /**
   * O envio disparado no toque segura a gravação da batida nova. Ele tem que caber em poucos
   * segundos, senão bater ponto passa a esperar a fila inteira.
   */
  it('mantém o envio do toque curto', () => {
    assert.ok(PUNCH_FLUSH_BUDGET_MS <= 10_000);
    assert.ok((nextAttemptTimeoutMs(comSelfie(3), 0, PUNCH_FLUSH_BUDGET_MS) ?? 0) <= PUNCH_FLUSH_BUDGET_MS);
  });

  /** Quem está esperando na tela espera menos; o que roda sozinho pode esperar mais. */
  it('ordena os três orçamentos pela paciência de quem espera', () => {
    assert.ok(PUNCH_FLUSH_BUDGET_MS < MANUAL_RETRY_BUDGET_MS);
    assert.ok(MANUAL_RETRY_BUDGET_MS < BACKGROUND_SYNC_BUDGET_MS);
  });
});

describe('selfieFileName', () => {
  /**
   * O caso do iPhone: o UUID do contêiner do app muda numa atualização, e o caminho absoluto
   * gravado antes aponta para um arquivo que não existe mais.
   */
  it('acha o mesmo nome em contêineres diferentes do iOS', () => {
    const antes = 'file:///var/mobile/Containers/Data/Application/AAAA-1111/Documents/selfie_1.jpg';
    const depois = 'file:///var/mobile/Containers/Data/Application/BBBB-2222/Documents/selfie_1.jpg';

    assert.equal(selfieFileName(antes), 'selfie_1.jpg');
    assert.equal(selfieFileName(antes), selfieFileName(depois));
  });

  it('aguenta caminho do android, nulo e lixo', () => {
    assert.equal(selfieFileName('/data/user/0/br.com.pontocronos/files/selfie_2.jpg'), 'selfie_2.jpg');
    assert.equal(selfieFileName(null), null);
    assert.equal(selfieFileName(''), null);
    assert.equal(selfieFileName('file:///pasta/'), null);
  });
});

describe('isDefinitiveRefusal', () => {
  it('tira da fila o que o servidor nunca vai aceitar como está', () => {
    assert.equal(isDefinitiveRefusal(403), true);
    assert.equal(isDefinitiveRefusal(422), true);
  });

  it('mantém na fila o que pode dar certo na próxima', () => {
    assert.equal(isDefinitiveRefusal(undefined), false, 'sem resposta = sem rede');
    assert.equal(isDefinitiveRefusal(401), false, 'token expirado: sobe depois de entrar de novo');
    assert.equal(isDefinitiveRefusal(408), false);
    assert.equal(isDefinitiveRefusal(429), false);
    assert.equal(isDefinitiveRefusal(500), false);
    assert.equal(isDefinitiveRefusal(503), false);
  });
});
