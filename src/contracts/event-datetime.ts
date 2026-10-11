import { z } from 'zod';

const eventDateTimePattern =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?(?:Z|\+00:00)?$/;

const birthDatePattern =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:Z)?)?$/;

function isCalendarDate(value: string): boolean {
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/**
 * Event timestamps as the real publishers send them (section 4 of
 * docs/origem-dos-eventos-no-salesforce.md), all read by Apex in mrv-staging:
 *
 * - MS Clientes: UTC with `Z` and 0 to 7 fraction digits;
 * - MS de crédito: `eventTime` with `Z` (Brasília time labeled as UTC) and
 *   `dataAlteracao` without offset, with 2 or 3 fraction digits;
 * - Plataforma BFF: `EventTime` with `+00:00` and `DataAlteracao` without
 *   offset.
 *
 * Fields that are not event payloads keep `apexCompatibleUtcDateTimeSchema`.
 */
export const eventDateTimeSchema = z
  .string()
  .regex(
    eventDateTimePattern,
    'Expected ISO datetime with up to 7 fraction digits, ending in Z, +00:00 or without offset',
  )
  .refine(isCalendarDate, 'Invalid calendar date');

/**
 * Birth date: date only, or the `yyyy-MM-ddTHH:mm:ssZ` form that MS Clientes
 * publishes. Apex `Date.valueOf` keeps only the date part.
 */
export const birthDateSchema = z
  .string()
  .regex(birthDatePattern, 'Expected yyyy-MM-dd or yyyy-MM-ddTHH:mm:ssZ')
  .refine(isCalendarDate, 'Invalid calendar date');
