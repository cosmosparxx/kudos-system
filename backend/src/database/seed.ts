import { query } from './db.js';

await query(`
  INSERT INTO users (name, email, department, role)
  VALUES
    ('Anjali Sharma', 'anjali@example.com', 'Engineering', 'user'),
    ('Rahul Kumar', 'rahul@example.com', 'Engineering', 'user'),
    ('Priya Singh', 'priya@example.com', 'Design', 'user')
  ON CONFLICT (email) DO NOTHING;
`);

console.log('Test users added');

process.exit(0);
