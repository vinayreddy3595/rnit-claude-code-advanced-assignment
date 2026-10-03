// Synthetic fixtures only. No real employee data.
import { openDb } from './db.js';

export const FIXTURES = {
  employeeA: { id: 'u-a', tenant: 'north', name: 'Employee A', role: 'employee', token: 'tok-north-employee-a' },
  managerB: { id: 'u-b', tenant: 'north', name: 'Manager B', role: 'manager', token: 'tok-north-manager-b' },
  managerC: { id: 'u-c', tenant: 'south', name: 'Manager C', role: 'manager', token: 'tok-south-manager-c' },
};

export function seed(db) {
  const addUser = db.prepare('INSERT OR IGNORE INTO users (id, tenant_id, name, role, token) VALUES (?, ?, ?, ?, ?)');
  for (const u of Object.values(FIXTURES)) addUser.run(u.id, u.tenant, u.name, u.role, u.token);
  const addReq = db.prepare(
    'INSERT OR IGNORE INTO leave_requests (id, tenant_id, employee_id, days) VALUES (?, ?, ?, ?)',
  );
  addReq.run('101', 'north', 'u-a', 3);
  addReq.run('102', 'north', 'u-a', 1);
  addReq.run('201', 'south', 'u-x', 2);
  return db;
}

if (process.argv[1]?.endsWith('seed.js')) {
  seed(openDb(process.env.DB_FILE ?? 'leave.db'));
  console.log('Seeded synthetic tenants north/south into', process.env.DB_FILE ?? 'leave.db');
}
