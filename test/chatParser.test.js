const test = require('node:test');
const assert = require('node:assert');
const { parseChatLines } = require('../lib/chatParser');

test('extrait un message de chat global', () => {
  const lines = [
    "[18:12:34][info] [Chat::Global]['Orihusay' (UserId=steam_76561198127885392, IP=79.110.237.21)]: je suis sur didi ci tu veurt"
  ];
  assert.deepStrictEqual(parseChatLines(lines), [{
    time: '18:12:34',
    channel: 'Global',
    name: 'Orihusay',
    userId: 'steam_76561198127885392',
    message: 'je suis sur didi ci tu veurt'
  }]);
});

test('ignore les lignes non-chat et garde l\'ordre', () => {
  const lines = [
    "[18:08:01][info] 'Orihusay' (UserId=steam_1, IP=1.1.1.1) has logged in.",
    "[18:12:34][info] [Chat::Global]['A' (UserId=steam_1, IP=1.1.1.1)]: bonjour",
    "[18:12:40][info] [Chat::Guild]['B' (UserId=steam_2, IP=2.2.2.2)]: salut la guilde"
  ];
  const out = parseChatLines(lines);
  assert.strictEqual(out.length, 2);
  assert.deepStrictEqual(out.map(c => c.message), ['bonjour', 'salut la guilde']);
  assert.strictEqual(out[1].channel, 'Guild');
});

test('gère un message vide et un message contenant des deux-points', () => {
  const lines = [
    "[10:00:00][info] [Chat::Global]['X' (UserId=steam_9, IP=9.9.9.9)]: ",
    "[10:00:05][info] [Chat::Global]['X' (UserId=steam_9, IP=9.9.9.9)]: url : http://a.b/c"
  ];
  const out = parseChatLines(lines);
  assert.strictEqual(out[0].message, '');
  assert.strictEqual(out[1].message, 'url : http://a.b/c');
});

test('entrée invalide -> tableau vide', () => {
  assert.deepStrictEqual(parseChatLines(null), []);
  assert.deepStrictEqual(parseChatLines(['bruit', '']), []);
});
