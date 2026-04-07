import type { Knex } from 'knex';

interface DateRange {
  unit: 'days' | 'weeks' | 'months';
  value: number;
  direction: 'last' | 'next';
}

interface Condition {
  type: 'attribute' | 'event';
  field: string;
  operator: string;
  value?: unknown;
  dateRange?: DateRange;
}

interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

interface SegmentLogic {
  operator: 'AND' | 'OR';
  groups: ConditionGroup[];
}

function buildDateRangeClause(dateRange: DateRange): string {
  const { unit, value, direction } = dateRange;
  if (direction === 'last') {
    return `AND occurred_at >= NOW() - INTERVAL '${value} ${unit}'`;
  } else {
    return `AND occurred_at <= NOW() + INTERVAL '${value} ${unit}'`;
  }
}

function buildAttributeCondition(condition: Condition): string {
  const { field, operator, value } = condition;
  const jsonPath = `custom_attributes->>'${field}'`;
  const numericPath = `(custom_attributes->>'${field}')::numeric`;
  const boolPath = `(custom_attributes->>'${field}')::boolean`;

  switch (operator) {
    case 'equals':
      return `${jsonPath} = '${String(value).replace(/'/g, "''")}'`;
    case 'not_equals':
      return `${jsonPath} != '${String(value).replace(/'/g, "''")}'`;
    case 'contains':
      return `${jsonPath} ILIKE '%${String(value).replace(/'/g, "''").replace(/%/g, '\\%')}%'`;
    case 'not_contains':
      return `${jsonPath} NOT ILIKE '%${String(value).replace(/'/g, "''").replace(/%/g, '\\%')}%'`;
    case 'greater_than':
      return `${numericPath} > ${Number(value)}`;
    case 'less_than':
      return `${numericPath} < ${Number(value)}`;
    case 'between': {
      const vals = value as [number, number];
      return `${numericPath} BETWEEN ${Number(vals[0])} AND ${Number(vals[1])}`;
    }
    case 'is_set':
      return `(${jsonPath} IS NOT NULL AND ${jsonPath} != '')`;
    case 'is_not_set':
      return `(${jsonPath} IS NULL OR ${jsonPath} = '')`;
    case 'is_true':
      return `${boolPath} = true`;
    case 'is_false':
      return `${boolPath} = false`;
    default:
      return 'TRUE';
  }
}

function buildEventCondition(condition: Condition): string {
  const { field, operator, value, dateRange } = condition;
  const dateClause = dateRange ? buildDateRangeClause(dateRange) : '';
  const escapedField = field.replace(/'/g, "''");

  switch (operator) {
    case 'has_occurred':
      return `EXISTS (
        SELECT 1 FROM custom_events ce
        WHERE ce.contact_id = contacts.id
          AND ce.event_name = '${escapedField}'
          ${dateClause}
      )`;
    case 'has_not_occurred':
      return `NOT EXISTS (
        SELECT 1 FROM custom_events ce
        WHERE ce.contact_id = contacts.id
          AND ce.event_name = '${escapedField}'
          ${dateClause}
      )`;
    case 'occurred_more_than':
      return `(
        SELECT COUNT(*) FROM custom_events ce
        WHERE ce.contact_id = contacts.id
          AND ce.event_name = '${escapedField}'
          ${dateClause}
      ) > ${Number(value)}`;
    case 'occurred_exactly':
      return `(
        SELECT COUNT(*) FROM custom_events ce
        WHERE ce.contact_id = contacts.id
          AND ce.event_name = '${escapedField}'
          ${dateClause}
      ) = ${Number(value)}`;
    case 'occurred_at_least':
      return `(
        SELECT COUNT(*) FROM custom_events ce
        WHERE ce.contact_id = contacts.id
          AND ce.event_name = '${escapedField}'
          ${dateClause}
      ) >= ${Number(value)}`;
    default:
      return 'TRUE';
  }
}

function buildConditionSQL(condition: Condition): string {
  if (condition.type === 'attribute') {
    return buildAttributeCondition(condition);
  } else if (condition.type === 'event') {
    return buildEventCondition(condition);
  }
  return 'TRUE';
}

function buildGroupSQL(group: ConditionGroup): string {
  if (!group.conditions || group.conditions.length === 0) {
    return 'TRUE';
  }

  const clauses = group.conditions.map(buildConditionSQL);
  const joiner = group.operator === 'OR' ? ' OR ' : ' AND ';
  return `(${clauses.join(joiner)})`;
}

export async function evaluateSegment(logic: SegmentLogic, db: Knex): Promise<string[]> {
  const query = db('contacts').where({ global_unsubscribe: false }).select('id');

  if (!logic || !logic.groups || logic.groups.length === 0) {
    const results = await query;
    return results.map((r: { id: string }) => r.id);
  }

  const nonEmptyGroups = logic.groups.filter(
    (g) => g.conditions && g.conditions.length > 0
  );

  if (nonEmptyGroups.length === 0) {
    const results = await query;
    return results.map((r: { id: string }) => r.id);
  }

  const groupClauses = nonEmptyGroups.map(buildGroupSQL);
  const topLevelJoiner = logic.operator === 'OR' ? ' OR ' : ' AND ';
  const whereClause = `(${groupClauses.join(topLevelJoiner)})`;

  const results = await query.whereRaw(whereClause);
  return results.map((r: { id: string }) => r.id);
}

export async function countSegment(logic: SegmentLogic, db: Knex): Promise<number> {
  const query = db('contacts').where({ global_unsubscribe: false });

  if (!logic || !logic.groups || logic.groups.length === 0) {
    const [{ count }] = await query.count('id as count');
    return parseInt(String(count));
  }

  const nonEmptyGroups = logic.groups.filter(
    (g) => g.conditions && g.conditions.length > 0
  );

  if (nonEmptyGroups.length === 0) {
    const [{ count }] = await query.count('id as count');
    return parseInt(String(count));
  }

  const groupClauses = nonEmptyGroups.map(buildGroupSQL);
  const topLevelJoiner = logic.operator === 'OR' ? ' OR ' : ' AND ';
  const whereClause = `(${groupClauses.join(topLevelJoiner)})`;

  const [{ count }] = await query.whereRaw(whereClause).count('id as count');
  return parseInt(String(count));
}
