import { NextResponse } from 'next/server';

import { scenarioDetailSchema } from '../../../../../src/contracts';
import {
  scenarioCatalog,
  toScenarioMetadata,
} from '../../../../../src/scenarios/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ scenarioKey: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { scenarioKey } = await context.params;
  const scenario = scenarioCatalog.getActive(scenarioKey);
  if (!scenario) {
    return NextResponse.json(
      {
        error: {
          code: 'SCENARIO_NOT_FOUND',
          message: 'Scenario not found',
          requestId: `req_${crypto.randomUUID()}`,
        },
      },
      { status: 404 },
    );
  }

  const body = scenarioDetailSchema.parse({
    ...toScenarioMetadata(scenario),
    variablesSchema: scenario.variablesSchema,
    steps: scenario.steps.map(
      ({ key, target, eventType, delayMs, deliveryPolicy }) => ({
        key,
        target,
        eventType,
        delayMs,
        deliveryPolicy,
      }),
    ),
  });

  return NextResponse.json(body);
}
