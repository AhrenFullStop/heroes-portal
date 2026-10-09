// Stub AI server: returns canned structured mentor JSON for any chat completion.
// Dispatches on the LAST user message so app bodies (system prompt mentions 'money' always) differentiate correctly.
const http = require('http');

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let lastUser = '';
    try {
      const parsed = JSON.parse(body || '{}');
      const msgs = Array.isArray(parsed.messages) ? parsed.messages : [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user') { lastUser = String(msgs[i].content || '').toLowerCase(); break; }
      }
    } catch { /* default below */ }

    let actions = [];
    let reply = 'Stub reply.';
    if (lastUser.includes('driver')) {
      actions = [
        { type: 'create_goal', title: "Get my driver's licence", steps: ['Book learner test', 'Save for lessons', 'Take 10 lessons'] },
        { type: 'log_checkin', mood: 'motivated', note: 'E2E check-in' },
      ];
      reply = 'Stub: goal created.';
    } else if (lastUser.includes('coach')) {
      actions = [{ type: 'escalate_coach', reason: 'E2E test escalation' }];
      reply = 'Stub: coach notified, open the Coach tab.';
    } else if (lastUser.includes('money')) {
      actions = [{ type: 'money_checkin', income: 4500, expenses: { Rent: 1500, Food: 1200, Transport: 400 } }];
      reply = 'Stub: money logged.';
    } else {
      actions = [{ type: 'log_checkin', mood: 'good', note: 'generic stub' }];
      reply = 'Stub: check-in logged.';
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'stub-1',
      object: 'chat.completion',
      model: 'stub',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ reply, actions }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    }));
  });
});

server.listen(process.env.STUB_PORT || 9999, () => console.log('stub AI on', process.env.STUB_PORT || 9999));
