import type { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import XLSX from 'xlsx';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data in order
  await knex('import_history').del();
  await knex('engagement_events').del();
  await knex('campaign_sends').del();
  await knex('automations').del();
  await knex('campaigns').del();
  await knex('segments').del();
  await knex('custom_events').del();
  await knex('contacts').del();
  await knex('event_definitions').del();
  await knex('attribute_definitions').del();
  await knex('users').del();

  // 1. Create default user
  const passwordHash = await bcrypt.hash('password123', 10);
  await knex('users').insert({
    id: uuidv4(),
    email: 'admin@example.com',
    password_hash: passwordHash,
  });

  // 2. Create attribute definitions
  await knex('attribute_definitions').insert([
    { id: uuidv4(), name: 'test_credit_score', data_type: 'number' },
    { id: uuidv4(), name: 'test_credit_score_type', data_type: 'text' },
  ]);

  // 3. Create event definitions
  await knex('event_definitions').insert([
    {
      id: uuidv4(),
      name: 'test_credit_score_created',
      description: 'Fired when a credit score record is first created',
    },
    {
      id: uuidv4(),
      name: 'test_credit_score_changed',
      description: "Fired when the contact's credit score value changes",
    },
    {
      id: uuidv4(),
      name: 'test_last_email_opened',
      description: 'Fired when the contact opens any email',
    },
  ]);

  // 4. Generate 50 synthetic contacts
  const contacts: Array<{
    id: string;
    email: string;
    global_unsubscribe: boolean;
    custom_attributes: object;
  }> = [];
  const creditScoreTypes = ['Equifax', 'Experian'];

  for (let i = 1; i <= 50; i++) {
    const creditScore = Math.floor(Math.random() * 901) + 300; // 300-1200
    const creditScoreType = creditScoreTypes[Math.floor(Math.random() * 2)];
    contacts.push({
      id: uuidv4(),
      email: `contact${i}@example.com`,
      global_unsubscribe: false,
      custom_attributes: {
        test_credit_score: creditScore,
        test_credit_score_type: creditScoreType,
      },
    });
  }

  await knex('contacts').insert(contacts);

  // Helper: random date in last N days
  function randomDateInLastDays(days: number): Date {
    const now = new Date();
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
  }

  // Helper: random date in last 12 months
  function randomDateInLastYear(): Date {
    return randomDateInLastDays(365);
  }

  // 5. Generate events for each contact
  const events: Array<{
    id: string;
    contact_id: string;
    event_name: string;
    occurred_at: Date;
    metadata: object;
  }> = [];

  for (const contact of contacts) {
    const attributes = contact.custom_attributes as Record<string, number | string>;
    const currentScore = attributes.test_credit_score as number;

    // test_credit_score_created: always
    const createdDate = randomDateInLastYear();
    events.push({
      id: uuidv4(),
      contact_id: contact.id,
      event_name: 'test_credit_score_created',
      occurred_at: createdDate,
      metadata: {},
    });

    // test_credit_score_changed: ~60% of contacts
    if (Math.random() < 0.6) {
      const changedDate = new Date(
        createdDate.getTime() + Math.random() * (Date.now() - createdDate.getTime())
      );
      const previousScore = Math.floor(Math.random() * 901) + 300;
      events.push({
        id: uuidv4(),
        contact_id: contact.id,
        event_name: 'test_credit_score_changed',
        occurred_at: changedDate,
        metadata: {
          new_score: currentScore,
          previous_score: previousScore,
        },
      });
    }

    // test_last_email_opened: ~70% of contacts
    if (Math.random() < 0.7) {
      events.push({
        id: uuidv4(),
        contact_id: contact.id,
        event_name: 'test_last_email_opened',
        occurred_at: randomDateInLastDays(90),
        metadata: {},
      });
    }
  }

  await knex('custom_events').insert(events);

  // 6. Generate sample XLSX files
  const seedDir = path.join(__dirname);

  // sample_contacts_import.xlsx
  // 10 existing contacts (updated scores) + 10 new contacts
  const existingContacts = contacts.slice(0, 10);
  const contactsImportRows: Array<{
    email: string;
    test_credit_score: number;
    test_credit_score_type: string;
  }> = [];

  for (const c of existingContacts) {
    const attrs = c.custom_attributes as Record<string, number | string>;
    contactsImportRows.push({
      email: c.email,
      test_credit_score: Math.floor(Math.random() * 901) + 300, // updated score
      test_credit_score_type: creditScoreTypes[Math.floor(Math.random() * 2)],
    });
  }

  for (let i = 51; i <= 60; i++) {
    contactsImportRows.push({
      email: `contact${i}@example.com`,
      test_credit_score: Math.floor(Math.random() * 901) + 300,
      test_credit_score_type: creditScoreTypes[Math.floor(Math.random() * 2)],
    });
  }

  const contactsWb = XLSX.utils.book_new();
  const contactsWs = XLSX.utils.json_to_sheet(contactsImportRows);
  XLSX.utils.book_append_sheet(contactsWb, contactsWs, 'Contacts');
  XLSX.writeFile(contactsWb, path.join(seedDir, 'sample_contacts_import.xlsx'));

  // sample_events_import.xlsx
  const eventNames = [
    'test_credit_score_created',
    'test_credit_score_changed',
    'test_last_email_opened',
  ];
  const eventsImportRows: Array<{
    email: string;
    event_name: string;
    occurred_at: string;
    metadata: string;
  }> = [];

  for (let i = 0; i < 30; i++) {
    const contact = contacts[i % contacts.length];
    const eventName = eventNames[i % 3];
    let metadata = '{}';
    if (eventName === 'test_credit_score_changed') {
      const newScore = Math.floor(Math.random() * 901) + 300;
      const prevScore = Math.floor(Math.random() * 901) + 300;
      metadata = JSON.stringify({ new_score: newScore, previous_score: prevScore });
    }
    eventsImportRows.push({
      email: contact.email,
      event_name: eventName,
      occurred_at: randomDateInLastYear().toISOString(),
      metadata,
    });
  }

  const eventsWb = XLSX.utils.book_new();
  const eventsWs = XLSX.utils.json_to_sheet(eventsImportRows);
  XLSX.utils.book_append_sheet(eventsWb, eventsWs, 'Events');
  XLSX.writeFile(eventsWb, path.join(seedDir, 'sample_events_import.xlsx'));

  console.log('Seed completed successfully');
  console.log(`Created 50 contacts with events`);
  console.log(`Generated sample XLSX files in ${seedDir}`);
}
