import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('attribute_definitions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).unique().notNullable();
    table.string('data_type', 20).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('event_definitions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).unique().notNullable();
    table.text('description').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('contacts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).unique().notNullable();
    table.boolean('global_unsubscribe').defaultTo(false);
    table.jsonb('custom_attributes').defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX contacts_custom_attributes_gin ON contacts USING GIN (custom_attributes)');

  await knex.schema.createTable('custom_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    table.string('event_name', 255).notNullable();
    table.timestamp('occurred_at', { useTz: true }).notNullable();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.index('contact_id');
    table.index('event_name');
  });

  await knex.schema.createTable('segments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.text('description').defaultTo('');
    table.jsonb('logic').notNullable().defaultTo('{}');
    table.integer('contact_count').defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('campaigns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('subject_line', 500).notNullable().defaultTo('');
    table.string('preview_text', 500).nullable().defaultTo('');
    table.string('sender_name', 255).nullable().defaultTo('');
    table.string('sender_email', 255).nullable().defaultTo('');
    table.jsonb('template_json').defaultTo('[]');
    table.text('template_html').defaultTo('');
    table.string('status', 20).defaultTo('draft');
    table.timestamp('scheduled_at', { useTz: true }).nullable();
    table.timestamp('sent_at', { useTz: true }).nullable();
    table.uuid('segment_id').nullable().references('id').inTable('segments').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('automations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('status', 20).defaultTo('draft');
    table.jsonb('entry_criteria').defaultTo('{}');
    table.jsonb('exit_criteria').defaultTo('[]');
    table.uuid('target_segment_id').nullable().references('id').inTable('segments').onDelete('SET NULL');
    table.jsonb('workflow_json').defaultTo('{"nodes":[],"edges":[]}');
    table.integer('enrolled_count').defaultTo(0);
    table.integer('completed_count').defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('campaign_sends', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE');
    table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    table.uuid('automation_id').nullable().references('id').inTable('automations').onDelete('SET NULL');
    table.string('status', 20).defaultTo('queued');
    table.timestamp('sent_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.index('campaign_id');
    table.index('contact_id');
  });

  await knex.schema.createTable('engagement_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('campaign_send_id').notNullable().references('id').inTable('campaign_sends').onDelete('CASCADE');
    table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    table.string('type', 30).notNullable();
    table.text('url').nullable();
    table.timestamp('occurred_at', { useTz: true }).defaultTo(knex.fn.now());
    table.index('campaign_send_id');
    table.index('contact_id');
    table.index('type');
  });

  await knex.schema.createTable('import_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('import_type', 20).notNullable();
    table.string('file_name', 500).notNullable();
    table.integer('rows_processed').defaultTo(0);
    table.integer('contacts_created').defaultTo(0);
    table.integer('contacts_updated').defaultTo(0);
    table.integer('events_created').defaultTo(0);
    table.integer('errors_count').defaultTo(0);
    table.jsonb('error_log').defaultTo('[]');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('import_history');
  await knex.schema.dropTableIfExists('engagement_events');
  await knex.schema.dropTableIfExists('campaign_sends');
  await knex.schema.dropTableIfExists('automations');
  await knex.schema.dropTableIfExists('campaigns');
  await knex.schema.dropTableIfExists('segments');
  await knex.schema.dropTableIfExists('custom_events');
  await knex.raw('DROP INDEX IF EXISTS contacts_custom_attributes_gin');
  await knex.schema.dropTableIfExists('contacts');
  await knex.schema.dropTableIfExists('event_definitions');
  await knex.schema.dropTableIfExists('attribute_definitions');
  await knex.schema.dropTableIfExists('users');
}
