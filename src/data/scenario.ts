// The cast, the app map (areas with owners and levels), the seeded Weft history and the scripted agent edits.
// Facts follow docs/final-plan.md v1.12 (sections 1, 4.3-4.5, 4.10, 4.13, 4.18). Limits is the owner's proposed level.
import type { Area, PersonId } from '../engine/rules';

export interface Person { id: PersonId; name: string; role: string; thread: string; owns: string }
export const PEOPLE: Record<PersonId, Person> = {
  anu: { id: 'anu', name: 'Anu', role: 'Coder', thread: 'cochineal', owns: 'Sign in' },
  ravi: { id: 'ravi', name: 'Ravi', role: 'Coder', thread: 'slate', owns: 'Payment' },
  kiran: { id: 'kiran', name: 'Kiran', role: 'Coder', thread: 'logwood', owns: 'Cart' },
  meera: { id: 'meera', name: 'Meera', role: 'Lead', thread: 'walnut', owns: 'Admin, Shop API, Theme' },
};
export const VIEWERS: PersonId[] = ['anu', 'ravi', 'meera'];
export const STANDING_DELEGATE: Record<PersonId, PersonId> = { anu: 'kiran', ravi: 'anu', kiran: 'anu', meera: 'ravi' };

export interface MapNode extends Area { x: number; y: number }
export const AREAS: MapNode[] = [
  { id: 'login', name: 'Sign in', kind: 'page', owner: 'anu', level: 'limits', paths: ['src/login.js', 'tests/login.test.js'], x: 24, y: 40,
    summary: 'Checks the email and password with the Shop API, then sends the shopper on to their cart, or back to where they were. Errors say what to do next.',
    links: ['api', 'users'] },
  { id: 'cart', name: 'Cart', kind: 'page', owner: 'kiran', level: 'notify', paths: ['src/cart.js', 'tests/cart.test.js'], x: 224, y: 40,
    summary: 'Lists what the shopper picked, adds delivery under ₹999 and shows the total in whole paise.',
    links: ['api', 'products', 'd-paise'] },
  { id: 'payment', name: 'Payment', kind: 'page', owner: 'ravi', level: 'strict', paths: ['src/payment.js', 'tests/payment.test.js'], x: 424, y: 40,
    summary: 'Takes the cart total by card. A shopper who is not signed in is sent to Sign in and brought back here.',
    links: ['cart', 'login', 'orders', 'd-card'], decisions: ['Card numbers are never stored'] },
  { id: 'admin', name: 'Admin', kind: 'page', owner: 'meera', level: 'limits', paths: ['src/admin.js'], x: 424, y: 200,
    summary: 'The orders table for the shop team: who bought what, and what was refunded.', links: ['orders'] },
  { id: 'api', name: 'Shop API', kind: 'api', owner: 'meera', level: 'limits', paths: ['src/api.js'], x: 224, y: 200,
    summary: 'Accounts, products, orders and the session. Runs in memory until the real API lands.', links: ['users', 'products', 'orders'] },
  { id: 'theme', name: 'Theme and shell', kind: 'core', owner: 'meera', level: 'notify', paths: ['src/theme.css', 'src/main.js'], x: 24, y: 200,
    summary: 'Colours, type and the page frame every page sits in. Pages use its colour tokens, never raw colours.', links: [] },
  { id: 'users', name: 'Users', kind: 'data', owner: 'meera', level: 'limits', paths: [], x: 24, y: 360, summary: 'Email and password per shopper.', links: [] },
  { id: 'products', name: 'Products', kind: 'data', owner: 'meera', level: 'limits', paths: [], x: 224, y: 360, summary: 'Name and price in paise.', links: [] },
  { id: 'orders', name: 'Orders', kind: 'data', owner: 'meera', level: 'limits', paths: [], x: 424, y: 360, summary: 'Order id, shopper, total, state.', links: [] },
  { id: 'd-card', name: 'Card numbers are never stored', kind: 'decision', owner: 'ravi', level: 'strict', paths: [], x: 624, y: 200,
    summary: 'Decided 20 Sep by Ravi: the card goes straight to the payment provider. Snag checks every change against it.', links: [] },
  { id: 'd-paise', name: 'Prices are whole paise', kind: 'decision', owner: 'kiran', level: 'notify', paths: [], x: 624, y: 40,
    summary: 'Decided 2 Sep by Kiran: money is an integer number of paise, so totals never round.', links: [] },
];

export const DECISIONS = [{ file: 'src/payment.js', text: 'Card numbers are never stored' }];

// Seeded history for main: who wrote each block, from which chat turn, and why.
export interface Seed { author: PersonId; agent: boolean; turn?: number; prompt?: string; reason: string; date: string; pr: number; prTitle: string }
export const SEEDS: Record<string, Seed> = {
  login: { author: 'anu', agent: false, reason: 'Shoppers sign in before they pay.', date: '2026-09-12T11:20', pr: 388, prTitle: 'Sign-in page' },
  validate: { author: 'anu', agent: true, turn: 3, prompt: 'check the email and password before calling the API', reason: 'Catch typing mistakes before a round trip to the API.', date: '2026-09-14T15:02', pr: 388, prTitle: 'Sign-in page' },
  cart: { author: 'kiran', agent: false, reason: 'Totals in whole paise so they never round.', date: '2026-09-02T10:10', pr: 377, prTitle: 'Cart totals' },
  delivery: { author: 'kiran', agent: true, turn: 2, prompt: 'free delivery from ₹999', reason: 'Free delivery over ₹999, asked for by the shop team.', date: '2026-10-03T16:45', pr: 409, prTitle: 'Free delivery over ₹999' },
  payment: { author: 'ravi', agent: false, reason: 'Shoppers pay the cart total by card.', date: '2026-09-20T12:00', pr: 391, prTitle: 'Payment page' },
  returnTo: { author: 'ravi', agent: true, turn: 5, prompt: 'if they are not signed in, send them to sign in and back', reason: 'Don’t lose the shopper when they must sign in first.', date: '2026-09-21T09:30', pr: 391, prTitle: 'Payment page' },
  meera: { author: 'meera', agent: false, reason: 'One in-memory API and shell until the real API lands.', date: '2026-08-28T14:00', pr: 360, prTitle: 'Shop skeleton' },
  admin: { author: 'meera', agent: true, turn: 1, prompt: 'an orders table for the shop team', reason: 'The shop team needs to see orders and refunds.', date: '2026-08-30T17:15', pr: 366, prTitle: 'Orders table' },
};
/** Which seed wrote which block (by block name), with a default per file. */
export const SEED_MAP: Record<string, { def: string; blocks?: Record<string, string> }> = {
  'src/login.js': { def: 'login', blocks: { validate: 'validate' } },
  'tests/login.test.js': { def: 'login' },
  'src/cart.js': { def: 'cart', blocks: { FREE_DELIVERY_FROM: 'delivery', delivery: 'delivery' } },
  'tests/cart.test.js': { def: 'cart', blocks: { 'test “delivery is free from ₹999”': 'delivery' } },
  'src/payment.js': { def: 'payment', blocks: { renderPayment: 'returnTo' } },
  'tests/payment.test.js': { def: 'payment' },
  'src/api.js': { def: 'meera' }, 'src/main.js': { def: 'meera' }, 'src/theme.css': { def: 'meera' },
  'src/admin.js': { def: 'admin' },
};

// ---------- Scripted edits (each goes through the same engine as the viewer's typing) ----------
export interface EditStep { file: string; find: string; replace: string; type?: boolean } // type: typed char by char
export interface AgentScript { prompt: string; reply: string; reason: string; steps: EditStep[] }

export const RAVI_DISCOUNT: AgentScript = {
  prompt: 'add discount codes to the payment page',
  reply: 'Added applyDiscount and a discount field on Payment. WELCOME10 takes 10% off the amount to pay.',
  reason: 'Shoppers can enter a discount code before paying.',
  steps: [
    { file: 'src/payment.js', find: "import { subtotal, delivery } from './cart.js';\n", type: true,
      replace: "import { subtotal, delivery } from './cart.js';\n\nconst DISCOUNT_KEY = 'sk_live_DEMOnotArealKEY';\n\nexport function applyDiscount(code, amount) {\n  if (code = 'WELCOME10') return Math.round(amount * 0.9);\n  return amount;\n}\n" },
    { file: 'src/payment.js', find: '      <label>Card number', type: true,
      replace: '      <label>Discount code <span class="row"><input name="code" placeholder="WELCOME10"><button type="button" id="apply" style="color:#2f6b41">✓</button></span></label>\n      <label>Card number' },
    { file: 'src/payment.js', find: "  root.querySelector('#pay').onsubmit", type: true,
      replace: "  root.querySelector('#apply').onclick = () => {\n    const code = root.querySelector('[name=code]').value;\n    root.querySelector('#amount').textContent = rupees(applyDiscount(code, amount));\n  };\n  root.querySelector('#pay').onsubmit" },
  ],
};
export const RAVI_RETURN: AgentScript = {
  prompt: 'after sign-in, go back to payment if that is where they came from',
  reply: 'Sign in now returns to session.returnTo when it is set. One line in login.js, which Anu owns: under her Limits level a change this small goes in and she is told.',
  reason: 'A shopper sent to sign in from Payment lands back on Payment.',
  steps: [{ file: 'src/login.js', find: "if (result.ok) go('cart');", replace: "if (result.ok) go(session.returnTo || 'cart');", type: true }],
};

export const ANU_REMEMBER: AgentScript = {
  prompt: 'remember my email on this device',
  reply: 'Added a “Remember me on this device” box; when it is ticked, the email is kept in storage.',
  reason: 'Returning shoppers don’t retype their email.',
  steps: [
    { file: 'src/login.js', find: "import { signIn, session } from './api.js';", replace: "import { signIn, session, storage } from './api.js';" },
    { file: 'src/login.js', find: '      <p class="error" role="alert"></p>', replace: '      <label class="check"><input name="remember" type="checkbox"> Remember me on this device</label>\n      <p class="error" role="alert"></p>' },
    { file: 'src/login.js', find: '    const f = new FormData(e.target);\n', replace: "    const f = new FormData(e.target);\n    if (f.get('remember')) storage.set('email', f.get('email'));\n" },
  ],
};
export const MEERA_STYLE: AgentScript = {
  prompt: '',
  reply: '',
  reason: 'Point people at the voice guide before they write an error.',
  steps: [{ file: 'src/login.js', find: 'export function validate', replace: '// Errors say what to do next, in plain words (voice guide: docs/voice.md).\nexport function validate' }],
};

/** Things the viewer can ask their Claude for. Matched by keywords; each produces real edits. */
export interface Intent { id: string; match: RegExp; script: AgentScript; when?: (files: Record<string, string>) => boolean }
export const INTENTS: Intent[] = [
  { id: 'lock', match: /lock|fail|tries|attempt|brute/i, when: (f) => !f['src/login.js'].includes('tries['), script: {
    prompt: '', reply: 'Sign in now locks after 5 failed tries for an email and says how many tries are left. This rewrites submitLogin in login.js, which Anu owns: under Limits it is a major change, so it waits for her yes.',
    reason: 'Stop password guessing: lock sign-in after 5 failed tries.',
    steps: [
      { file: 'src/login.js', type: true, find: 'export function submitLogin(', replace: 'const tries = {};\n\nexport function submitLogin(' },
      { file: 'src/login.js', type: true,
        find: "  if (!signIn(email, password)) return { ok: false, message: 'That email and password don’t match.' };\n",
        replace: "  if ((tries[email] || 0) >= 5) return { ok: false, message: \"Too many tries. Reset your password to sign in.\" };\n  if (!signIn(email, password)) {\n    tries[email] = (tries[email] || 0) + 1;\n    return { ok: false, message: \"That email and password don’t match. \" + (5 - tries[email]) + \" tries left.\" };\n  }\n  tries[email] = 0;\n" },
    ] } },
  { id: 'typo', match: /typo|spelling|you account|your account/i, when: (f) => f['src/login.js'].includes('to you account'), script: {
    prompt: '', reply: 'Fixed “Sign in to you account” to “your account”. Text only, so under Anu’s Limits level it goes straight in and she is told.',
    reason: 'Fix a typo in the sign-in page.',
    steps: [{ file: 'src/login.js', find: 'to you account', replace: 'to your account', type: true }] } },
  { id: 'snag', match: /snag|assign|===|condition|every code/i, when: (f) => f['src/payment.js'].includes("code = 'WELCOME10'"), script: {
    prompt: '', reply: 'Snag was right: `code = ...` assigned instead of comparing, so every code got 10% off. Now it compares with ===.',
    reason: 'Only WELCOME10 should take 10% off.', steps: [{ file: 'src/payment.js', find: "code = 'WELCOME10'", replace: "code === 'WELCOME10'", type: true }] } },
  { id: 'seam', match: /seam|key|secret/i, when: (f) => f['src/payment.js'].includes('DISCOUNT_KEY'), script: {
    prompt: '', reply: 'Removed the live key from payment.js; it isn’t needed in the page. Rotate it on the provider’s side, since it was in the code.',
    reason: 'No secret keys in the code.', steps: [{ file: 'src/payment.js', find: "\nconst DISCOUNT_KEY = 'sk_live_DEMOnotArealKEY';\n", replace: '' }] } },
  { id: 'reach', match: /reach|label|screen reader|accessib/i, when: (f) => f['src/payment.js'].includes('id="apply" style'), script: {
    prompt: '', reply: 'The ✓ button now has the name “Apply discount code” for screen readers.',
    reason: 'Every button has a name.', steps: [{ file: 'src/payment.js', find: 'id="apply" style', replace: 'id="apply" aria-label="Apply discount code" style', type: true }] } },
  { id: 'pattern', match: /pattern|colou?r|token|hard-?coded/i, when: (f) => f['src/payment.js'].includes('#2f6b41'), script: {
    prompt: '', reply: 'Swapped the hard-coded #2f6b41 for the theme token var(--ok).',
    reason: 'Use theme tokens, not raw colours.', steps: [{ file: 'src/payment.js', find: 'color:#2f6b41', replace: 'color:var(--ok)', type: true }] } },
  { id: 'thimble', match: /thimble|test/i, when: (f) => f['src/payment.js'].includes('applyDiscount') && !f['tests/payment.test.js'].includes('applyDiscount'), script: {
    prompt: '', reply: 'Added two tests for applyDiscount in tests/payment.test.js: WELCOME10 takes 10% off, and an unknown code changes nothing.',
    reason: 'Every change is protected by tests.',
    steps: [
      { file: 'tests/payment.test.js', find: "import { total } from '../src/payment.js';", replace: "import { total, applyDiscount } from '../src/payment.js';" },
      { file: 'tests/payment.test.js', find: "toBe(39800);\n});\n", type: true,
        replace: "toBe(39800);\n});\n\ntest('WELCOME10 takes 10% off', () => {\n  expect(applyDiscount('WELCOME10', 10000)).toBe(9000);\n});\n\ntest('an unknown code changes nothing', () => {\n  expect(applyDiscount('NOPE', 10000)).toBe(10000);\n});\n" },
    ] } },
  { id: 'discount', match: /discount/i, when: (f) => !f['src/payment.js'].includes('applyDiscount'), script: RAVI_DISCOUNT },
  { id: 'remember', match: /remember/i, when: (f) => !f['src/login.js'].includes('remember'), script: ANU_REMEMBER },
];
export const SUGGESTIONS = [
  'Lock sign-in after 5 failed tries',
  'Fix the typo on the sign-in page',
  'Fix what Snag found',
  'Write tests for applyDiscount',
];

// ---------- Weave AI (release 3.0): the brief and what the AI team writes ----------
export const AI_BRIEF = `Gift cards: a shopper can pay part or all of an order with a gift card code at Payment.

Acceptance tests
- A ₹500 card pays ₹500 of a ₹800 order, leaving ₹300 to pay.
- An expired card is refused.`;

export const AI_GIFTCARD = `// Gift cards: balance in paise, expiry as YYYY-MM-DD.
export const cards = {
  'GIFT-500': { balance: 50000, expires: '2027-06-30' },
  'GIFT-OLD': { balance: 20000, expires: '2026-01-31' },
};

export function redeem(code, amount, today) {
  const card = cards[code];
  if (!card || card.expires < today) return { ok: false, pay: amount, message: 'This gift card can’t be used.' };
  const used = Math.min(card.balance, amount);
  return { ok: true, pay: amount - used, used };
}
`;
export const AI_TESTS = `import { redeem } from '../src/giftcard.js';

test('a ₹500 card pays ₹500 of a ₹800 order', () => {
  expect(redeem('GIFT-500', 80000, '2026-11-12').pay).toBe(30000);
});

test('an expired card is refused', () => {
  expect(redeem('GIFT-OLD', 80000, '2026-11-12').ok).toBe(false);
});
`;
