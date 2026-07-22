const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Sandbox : DATA_DIR doit être posé AVANT de charger le module (même pattern que baseTracker.test.js)
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-test-'));
const playerCounts = require('../lib/playerCounts');
const { writeJson } = require('../lib/jsonStore');

test('points() filtre sur la fenêtre demandée', () => {
  const now = Date.now();
  writeJson(playerCounts.COUNTS_FILE, {
    points: [
      { t: now - 8 * 24 * 3600e3, c: 5 },  // plus vieux que la rétention (7 j)
      { t: now - 2 * 24 * 3600e3, c: 3 },  // dans 7 j mais hors 24 h
      { t: now - 3600e3, c: 7 },           // dans 24 h
      { t: now - 60e3, c: null }           // point "hors ligne" récent
    ]
  });
  const day = playerCounts.points(24 * 3600e3);
  assert.deepStrictEqual(day.map(p => p.c), [7, null]);
  const week = playerCounts.points(playerCounts.RETENTION_MS);
  assert.deepStrictEqual(week.map(p => p.c), [3, 7, null]);
});

test('points() sans fichier renvoie une liste vide', () => {
  fs.rmSync(playerCounts.COUNTS_FILE, { force: true });
  assert.deepStrictEqual(playerCounts.points(), []);
});
