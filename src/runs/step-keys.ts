// Reentregas físicas (`deliveryPolicy.duplicateCount`) viram steps próprios,
// com a chave do step do fixture mais um sufixo. O fixture persistido só
// guarda o step base, então quem precisa dele (replay, agendamento) resolve a
// chave base primeiro.
const REDELIVERY_SUFFIX = /-redelivery-\d+$/;

export function redeliveryStepKey(stepKey: string, index: number): string {
  return `${stepKey}-redelivery-${index}`;
}

export function baseStepKey(stepKey: string): string {
  return stepKey.replace(REDELIVERY_SUFFIX, '');
}
