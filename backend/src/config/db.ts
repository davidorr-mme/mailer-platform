import knex from 'knex';
import { env } from './env';

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(convertKeys);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamelCase(k), convertKeys(v)])
    );
  }
  return obj;
}

const db = knex({
  client: 'pg',
  connection: env.DATABASE_URL,
  postProcessResponse: (result) => {
    if (Array.isArray(result)) return result.map(convertKeys);
    if (result && typeof result === 'object') return convertKeys(result);
    return result;
  },
});

export default db;
