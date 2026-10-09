import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, initSchema } from '../server/src/db';

async function main(): Promise<void> {
  await initSchema();
  console.log('[seed] schema ensured');

  // Demo alumni (idempotent)
  const alumni = [
    { username: 'sipho', display_name: 'Sipho Dlamini', password: 'heroes123' },
    { username: 'lindiwe', display_name: 'Lindiwe Mokoena', password: 'heroes123' },
  ];
  for (const a of alumni) {
    const hash = await bcrypt.hash(a.password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES ($1, $2, $3, 'alumnus') ON CONFLICT (username) DO NOTHING`,
      [a.username, hash, a.display_name]
    );
  }
  console.log('[seed] demo alumni ensured (sipho / lindiwe, password heroes123)');

  const sipho = await pool.query(`SELECT id FROM users WHERE username = 'sipho'`);
  const siphoId = sipho.rows[0].id;
  const lindiwe = await pool.query(`SELECT id FROM users WHERE username = 'lindiwe'`);
  const lindiweId = lindiwe.rows[0].id;

  // Workouts (idempotent by title)
  const workouts = [
    { title: 'Street 20', description: 'Push-ups, sit-ups, squats, planks. No equipment, no excuses. 4 rounds.', level: 'home', duration_min: 20, sort: 1 },
    { title: 'Hill Sprints', description: 'Find a hill. 8 sprints up, walk down. Legs and lungs.', level: 'home', duration_min: 25, sort: 2 },
    { title: 'Gym Push Day', description: 'Bench 4x8, shoulder press 3x10, dips 3x10, triceps rope 3x12.', level: 'gym', duration_min: 50, sort: 3 },
    { title: 'Gym Pull Day', description: 'Deadlift 4x6, rows 3x10, pull-ups 3x max, bicep curls 3x12.', level: 'gym', duration_min: 55, sort: 4 },
    { title: 'Full Body Basics', description: 'Squat 3x10, bench 3x10, row 3x10, core circuit. Form first.', level: 'gym', duration_min: 45, sort: 5 },
    { title: 'Road 5km', description: '5km run or brisk walk. Time it. Beat it next week.', level: 'home', duration_min: 30, sort: 6 },
  ];
  for (const w of workouts) {
    await pool.query(
      `INSERT INTO workouts (title, description, level, duration_min, sort)
       SELECT $1, $2, $3, $4, $5 WHERE NOT EXISTS (SELECT 1 FROM workouts WHERE title = $1)`,
      [w.title, w.description, w.level, w.duration_min, w.sort]
    );
  }
  console.log('[seed] workouts ensured');

  // Opportunities (idempotent by title)
  const opportunities = [
    { title: 'Junior Warehouse Assistant', org: 'Takealot DC', kind: 'job', location: 'Cape Town (Montague Gardens)', apply_url: 'https://careers.takealot.com', description: 'Entry-level warehouse role. Shift work, training provided. Matric required.', closes_on: '2026-11-30' },
    { title: 'YES Programme - Youth Employment Service', org: 'YES4Youth', kind: 'learnership', location: 'Nationwide', apply_url: 'https://yes4youth.co.za', description: '12-month paid workplace experience for ages 18-25. Multiple host companies.', closes_on: '2026-12-15' },
    { title: 'NSFAS Bursary 2027', org: 'NSFAS', kind: 'bursary', location: 'Nationwide', apply_url: 'https://nsfas.org.za', description: 'Full funding for TVET college or university study. Apply with certified ID and results.', closes_on: '2027-01-31' },
    { title: 'Coding Fundamentals Course', org: 'Zenzeleni Labs', kind: 'training', location: 'Online', apply_url: 'https://zenzeleni.dev', description: 'Free 10-week intro to coding. Evening sessions, data bundles provided.', closes_on: '2026-10-31' },
    { title: 'Retail Cashier - peak season', org: 'Shoprite', kind: 'job', location: 'Johannesburg (multiple)', apply_url: 'https://careers.shoprite.co.za', description: 'Seasonal cashier roles. Walk-in applications at store HR offices.', closes_on: '2026-11-15' },
    { title: 'Solar PV Installer Learnership', org: 'GreenX Training', kind: 'learnership', location: 'Gauteng', apply_url: 'https://greenx.co.za', description: '3-month learnership with stipend. Leads to PV installer certification.', closes_on: '2026-11-20' },
  ];
  for (const o of opportunities) {
    await pool.query(
      `INSERT INTO opportunities (title, org, kind, location, apply_url, description, closes_on)
       SELECT $1, $2, $3, $4, $5, $6, $7 WHERE NOT EXISTS (SELECT 1 FROM opportunities WHERE title = $1)`,
      [o.title, o.org, o.kind, o.location, o.apply_url, o.description, o.closes_on]
    );
  }
  console.log('[seed] opportunities ensured');

  // Circle posts (idempotent by content prefix)
  const posts = [
    { userId: siphoId, content: 'First week at the warehouse done. Tired but proud. The 4am alarm is getting easier.' },
    { userId: lindiweId, content: 'Finished my NSFAS application. Certifying documents at the police station on Saturday if anyone wants to come with.' },
    { userId: siphoId, content: 'Ran my first 5km without stopping. 38 minutes. Coach said next month we chase 33.' },
  ];
  for (const p of posts) {
    await pool.query(
      `INSERT INTO circle_posts (user_id, content)
       SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM circle_posts WHERE content = $2)`,
      [p.userId, p.content]
    );
  }
  const firstPost = await pool.query(`SELECT id FROM circle_posts WHERE content LIKE 'First week at the warehouse%'`);
  if (firstPost.rows.length > 0) {
    await pool.query(
      `INSERT INTO circle_comments (post_id, user_id, content)
       SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM circle_comments WHERE content = $3)`,
      [firstPost.rows[0].id, lindiweId, 'Well done brother! Proud of you.']
    );
  }
  console.log('[seed] circle posts ensured');

  await pool.end();
  console.log('[seed] done');
}

main().catch((err) => {
  console.error('[seed] fatal:', err);
  process.exit(1);
});
