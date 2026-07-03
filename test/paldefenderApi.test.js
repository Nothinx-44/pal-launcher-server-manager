const test = require('node:test');
const assert = require('node:assert');
const { COMMANDS } = require('../lib/paldefenderApi');

test('COMMANDS : chaque commande a un label et une fonction run', () => {
  Object.entries(COMMANDS).forEach(([key, cmd]) => {
    assert.ok(cmd.label, `${key} doit avoir un label`);
    assert.strictEqual(typeof cmd.run, 'function', `${key}.run doit être une fonction`);
  });
});

test('COMMANDS : les commandes cibllant un joueur/IP sont marquées correctement', () => {
  assert.strictEqual(COMMANDS.kick.needsPlayer, true);
  assert.strictEqual(COMMANDS.banip.needsIp, true);
  assert.ok(!COMMANDS.broadcast.needsPlayer && !COMMANDS.broadcast.needsIp, 'broadcast ne cible ni joueur ni IP');
});
