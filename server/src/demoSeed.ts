// Realistic demo data for the admin overview: 8 alumni with 6 weeks of history.
import { pool } from './db';
import bcrypt from 'bcryptjs';

const FIRST = ['Thabo','Sipho','Lindiwe','Lebo','Bongani','Ayanda','Musa','Nkosi','Themba','Katlego'];
const LAST = ['Dlamini','Mokoena','Nkosi','Khumalo','Zulu','Mahlangu','Sithole','Ndlovu'];
const MOODS = ['good','motivated','okay','tired','struggling'];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)]; }
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10);
}

export async function seedAdminDemo() {
  const existing = await pool.query("SELECT id FROM users WHERE username LIKE 'demo_%'");
  if (existing.rows.length >= 8) {
    console.log('[demo] demo members already present, skipping');
    return;
  }
  const names: {username: string, display: string}[] = [];
  for (let i = 0; i < 8; i++) {
    const f = FIRST[(i*3+1)%FIRST.length], l = LAST[(i*2)%LAST.length];
    names.push({ username: `demo_${f.toLowerCase()}`, display: `${f} ${l}` });
  }
  const ids: number[] = [];
  for (const nm of names) {
    const r = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES ($1, $2, $3, 'alumnus')
       ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id`,
      [nm.username, bcrypt.hashSync('demo1234', 10), nm.display]
    );
    ids.push(r.rows[0].id);
  }
  console.log('[demo] users ensured:', ids.length);

  for (let i = 0; i < ids.length; i++) {
    const uid = ids[i];
    // Engagement archetypes: 0 = thriving, 1 = steady, 2 = fading (mood decline), 3 = disengaged, 4 = coach-needed
    const archetype = i % 5;
    // 6 weeks of check-ins with different patterns
    for (let d = 41; d >= 0; d--) {
      const skip = (archetype === 3 && d % 2 === 0) || (archetype === 1 && d % 5 === 0) || Math.random() < 0.15;
      if (skip) continue;
      let mood: string;
      if (archetype === 0) mood = rand(['good','motivated','motivated','good']);
      else if (archetype === 2) mood = d > 30 ? rand(['good','motivated']) : d > 15 ? rand(['okay','tired']) : rand(['tired','struggling','struggling']);
      else if (archetype === 4) mood = rand(['struggling','tired','struggling','okay']);
      else mood = rand(MOODS.slice(0, archetype === 1 ? 3 : 4));
      await pool.query(
        `INSERT INTO checkins (user_id, checkin_date, mood, note, source)
         VALUES ($1,$2,$3,$4,'chat') ON CONFLICT (user_id, checkin_date) DO NOTHING`,
        [uid, daysAgo(d), mood, archetype === 4 && d < 5 ? 'Been struggling since the move. Family stuff.' : null]
      );
    }
    // Goals
    const goalSets = [
      ['Get my driver licence', ['Pass learner test','10 driving lessons','Book test date']],
      ['Find a job in Cape Town', ['Fix my CV','Apply to 5 places','Practice interview']],
      ['Save R3000 by December', ['Open savings account','R250 every Friday']],
      ['Get fit again', ['Run 3x per week','No sugar for a month']],
    ];
    const nGoals = archetype === 3 ? 0 : (archetype === 0 ? 3 : archetype === 2 ? 2 : 2);
    for (let g = 0; g < nGoals; g++) {
      const [title, steps] = goalSets[(i+g)%goalSets.length];
      const gr = await pool.query('INSERT INTO goals (user_id, title) VALUES ($1,$2) RETURNING id', [uid, `${title} ${g>0?`(${g+1})`:''}`]);
      for (let s = 0; s < steps.length; s++) {
        const done = archetype === 0 ? Math.random() < 0.7 : archetype === 2 ? s === 0 : Math.random() < 0.4;
        await pool.query('INSERT INTO goal_steps (goal_id, label, done, position) VALUES ($1,$2,$3,$4)', [gr.rows[0].id, steps[s], done, s]);
      }
    }
    // Chat activity: disengaged members have none; everyone else recent.
    if (archetype !== 3) {
      const lastActive = daysAgo(archetype === 2 ? 1 : Math.floor(Math.random() * 3));
      await pool.query("INSERT INTO chat_messages (user_id, role, content) VALUES ($1,'user','Money check-in: made 4200 this month')", [uid]);
      await pool.query("INSERT INTO chat_messages (user_id, role, content) VALUES ($1,'assistant','Sharp. Let us look at the numbers.')", [uid]);
      await pool.query(`UPDATE chat_messages SET created_at = $2::timestamptz WHERE id IN (SELECT id FROM chat_messages WHERE user_id=$1 ORDER BY id DESC LIMIT 2)`, [uid, lastActive]);
    }
    // Coach thread for archetype 4
    if (archetype === 4) {
      await pool.query("INSERT INTO coach_messages (user_id, direction, content, resolved) VALUES ($1,'to_coach','Can I talk to someone? Things at home are heavy right now.',false)", [uid]);
    }
    // Money snapshot
    if (archetype !== 3 && i % 2 === 0) {
      await pool.query(
        `INSERT INTO money_snapshots (user_id, month_year, income, expenses, ai_summary)
         VALUES ($1, to_char(now(),'YYYY-MM'), $2, $3, 'Demo snapshot')
         ON CONFLICT (user_id, month_year) DO NOTHING`,
        [uid, 4200 + i*300, JSON.stringify({rent: 1800, food: 1200, transport: 400})]
      );
    }
    // Workout logs
    const wk = archetype === 0 ? 4 : archetype === 2 ? 1 : 2;
    for (let d = 0; d < 7; d++) {
      if (d < wk) await pool.query('INSERT INTO workout_logs (user_id, done_on) VALUES ($1,$2)', [uid, daysAgo(d*2)]);
    }
  }
  console.log('[demo] realistic 6-week history seeded for 8 members (password: demo1234)');
}
