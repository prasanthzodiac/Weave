// acme/shop: the sample app the team is building. Plain ES modules; the preview builds and runs them live.
export const MAIN_FILES: Record<string, string> = {
'src/main.js': `import './theme.css';
import { renderLogin } from './login.js';
import { renderCart } from './cart.js';
import { renderPayment } from './payment.js';
import { renderAdmin } from './admin.js';
import { session } from './api.js';

const pages = { login: renderLogin, cart: renderCart, payment: renderPayment, admin: renderAdmin };
const names = { login: 'Sign in', cart: 'Cart', payment: 'Payment', admin: 'Admin' };

export function go(name) {
  const app = document.getElementById('app');
  app.innerHTML = \`
    <header class="top">
      <strong class="brand">acme shop</strong>
      <nav>\${Object.keys(pages).map((p) => \`<a href="#" data-go="\${p}" class="\${p === name ? 'on' : ''}">\${names[p]}</a>\`).join('')}</nav>
      <span class="who">\${session.user || 'Not signed in'}</span>
    </header>
    <main id="page"></main>\`;
  app.querySelectorAll('[data-go]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); go(a.dataset.go); };
  });
  pages[name](app.querySelector('#page'), go);
}

go('login');
`,
'src/api.js': `// Shop API. In this preview it runs in memory: no server.
export const products = [
  { id: 'nb', name: 'Dot grid notebook', price: 34900 },
  { id: 'pen', name: 'Brass pen', price: 120000 },
  { id: 'pouch', name: 'Canvas pouch', price: 49900 },
];

const accounts = { 'anu@acme.shop': 'thread9', 'ravi@acme.shop': 'shuttle7' };
const memory = {};

export const session = { user: null, returnTo: null, cart: [{ id: 'nb', qty: 2 }, { id: 'pouch', qty: 1 }] };
export const storage = { get: (k) => memory[k], set: (k, v) => { memory[k] = v; } };

export function signIn(email, password) {
  return accounts[email] === password;
}

export function priceOf(id) {
  const p = products.find((x) => x.id === id);
  return p ? p.price : 0;
}

export function rupees(paise) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export const orders = [
  { id: 'A-1041', who: 'priya@mail.in', total: 129800, state: 'paid' },
  { id: 'A-1042', who: 'sam@mail.in', total: 34900, state: 'paid' },
  { id: 'A-1043', who: 'dev@mail.in', total: 49900, state: 'refunded' },
];
`,
'src/login.js': `import { signIn, session } from './api.js';

export function validate(email, password) {
  if (!email.includes('@')) return 'Enter the email you shop with.';
  if (password.length < 6) return 'Passwords have at least 6 characters.';
  return '';
}

export function submitLogin(email, password) {
  const problem = validate(email, password);
  if (problem) return { ok: false, message: problem };
  if (!signIn(email, password)) return { ok: false, message: 'That email and password don’t match.' };
  session.user = email;
  return { ok: true };
}

export function renderLogin(root, go) {
  root.innerHTML = \`
    <form class="card" id="login">
      <h1>Sign in</h1>
      <p class="muted">Sign in to you account to see your cart and pay.</p>
      <label>Email <input name="email" type="email" value="anu@acme.shop"></label>
      <label>Password <input name="password" type="password" placeholder="thread9"></label>
      <p class="error" role="alert"></p>
      <button class="primary">Sign in</button>
    </form>\`;
  root.querySelector('#login').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const result = submitLogin(f.get('email'), f.get('password'));
    if (result.ok) go('cart');
    else root.querySelector('.error').textContent = result.message;
  };
}
`,
'src/cart.js': `import { session, priceOf, rupees, products } from './api.js';

export const FREE_DELIVERY_FROM = 99900;

export function subtotal(cart) {
  return cart.reduce((sum, line) => sum + priceOf(line.id) * line.qty, 0);
}

export function delivery(amount) {
  return amount >= FREE_DELIVERY_FROM ? 0 : 4900;
}

export function renderCart(root, go) {
  const rows = session.cart.map((line) => {
    const p = products.find((x) => x.id === line.id);
    return \`<li><span>\${p.name} × \${line.qty}</span><span>\${rupees(p.price * line.qty)}</span></li>\`;
  }).join('');
  const s = subtotal(session.cart);
  root.innerHTML = \`
    <section class="card">
      <h1>Your cart</h1>
      <ul class="lines">\${rows}</ul>
      <p class="sum"><span>Delivery</span><span>\${delivery(s) ? rupees(delivery(s)) : 'Free'}</span></p>
      <p class="sum total"><span>Total</span><span>\${rupees(s + delivery(s))}</span></p>
      <button class="primary" id="pay">Go to payment</button>
    </section>\`;
  root.querySelector('#pay').onclick = () => go('payment');
}
`,
'src/payment.js': `import { session, rupees } from './api.js';
import { subtotal, delivery } from './cart.js';

export function total(cart) {
  const s = subtotal(cart);
  return s + delivery(s);
}

export function renderPayment(root, go) {
  if (!session.user) {
    session.returnTo = 'payment';
    return go('login');
  }
  const amount = total(session.cart);
  root.innerHTML = \`
    <form class="card" id="pay">
      <h1>Payment</h1>
      <p class="sum total"><span>To pay</span><span id="amount">\${rupees(amount)}</span></p>
      <label>Card number <input name="card" inputmode="numeric" placeholder="4242 4242 4242 4242"></label>
      <button class="primary">Pay \${rupees(amount)}</button>
      <p class="muted" role="status"></p>
    </form>\`;
  root.querySelector('#pay').onsubmit = (e) => {
    e.preventDefault();
    root.querySelector('[role=status]').textContent = 'Paid. A receipt is on its way to ' + session.user + '.';
  };
}
`,
'src/admin.js': `import { orders, rupees } from './api.js';

export function refundable(order) {
  return order.state === 'paid';
}

export function renderAdmin(root) {
  root.innerHTML = \`
    <section class="card wide">
      <h1>Orders</h1>
      <table>
        <tr><th>Order</th><th>Customer</th><th>Total</th><th>State</th></tr>
        \${orders.map((o) => \`<tr><td>\${o.id}</td><td>\${o.who}</td><td>\${rupees(o.total)}</td><td>\${o.state}</td></tr>\`).join('')}
      </table>
    </section>\`;
}
`,
'src/theme.css': `:root {
  --ink: #23211e;
  --muted: #6b665f;
  --line: #e6e1d8;
  --paper: #ffffff;
  --ground: #f7f5f0;
  --accent: #1f5c4a;
  --ok: #2f6b41;
  --bad: #b0352b;
}

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font: 15px/1.5 system-ui, sans-serif;
}

.top {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
  flex-wrap: wrap;
}

.top nav a { margin-right: 12px; color: var(--muted); text-decoration: none; }
.top nav a.on { color: var(--ink); font-weight: 600; }
.brand { letter-spacing: -0.01em; }
.who { margin-left: auto; color: var(--muted); font-size: 13px; }

.card {
  max-width: 380px;
  margin: 28px auto;
  padding: 24px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 10px;
}

.card.wide { max-width: 640px; }
h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
label { display: grid; gap: 4px; margin: 12px 0; font-size: 13px; color: var(--muted); }
input { padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px; font: inherit; color: var(--ink); }
.primary { width: 100%; margin-top: 8px; padding: 10px; border: 0; border-radius: 6px; background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.muted { color: var(--muted); }
.error { min-height: 1.5em; margin: 0; color: var(--bad); font-size: 13px; }
.lines { padding: 0; list-style: none; }
.lines li, .sum { display: flex; justify-content: space-between; margin: 6px 0; }
.total { font-weight: 600; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
td, th { padding: 6px 4px; border-bottom: 1px solid var(--line); text-align: left; }
`,
'tests/login.test.js': `import { validate, submitLogin } from '../src/login.js';

test('an email without @ is refused', () => {
  expect(validate('anu', 'thread9')).toBe('Enter the email you shop with.');
});

test('a short password is refused', () => {
  expect(validate('anu@acme.shop', 'abc')).toBe('Passwords have at least 6 characters.');
});

test('the right password signs in', () => {
  expect(submitLogin('anu@acme.shop', 'thread9').ok).toBe(true);
});
`,
'tests/cart.test.js': `import { subtotal, delivery } from '../src/cart.js';

test('subtotal adds every line', () => {
  expect(subtotal([{ id: 'nb', qty: 2 }])).toBe(69800);
});

test('delivery is free from ₹999', () => {
  expect(delivery(99900)).toBe(0);
});
`,
'tests/payment.test.js': `import { total } from '../src/payment.js';

test('total adds delivery under ₹999', () => {
  expect(total([{ id: 'nb', qty: 1 }])).toBe(39800);
});
`,
};
