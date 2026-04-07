import knex from 'knex';
import { env } from './env';

const db = knex({
  client: 'pg',
  connection: env.DATABASE_URL,
});

export default db;
