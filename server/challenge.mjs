import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

export const FEATURE_COLUMNS = ['id', 'day_of_week', 'hour', 'temperature', 'rain', 'is_exam_week', 'nearby_classes', 'menu_type', 'previous_visitors'];

function seededRandom(secret) {
  let counter = 0;
  return () => createHmac('sha256', secret).update(String(counter++)).digest().readUInt32BE() / 4294967296;
}

export function loadDataset(path, secret) {
  if (path && existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  const random = seededRandom(secret);
  const rows = Array.from({ length: 1500 }, (_, index) => {
    const day = Math.floor(random() * 7);
    const hour = 8 + Math.floor(random() * 12);
    const rain = Number(random() < 0.35);
    const exam = Number(random() < 0.25);
    const classes = day < 5 ? Math.floor(random() * 12) : Math.floor(random() * 4);
    const previous = Math.floor(random() * 65);
    const menu = ['regular', 'student_combo', 'special'][Math.floor(random() * 3)];
    const lunch = hour >= 12 && hour <= 14;
    const logit = -4.5 + Number(lunch) * 2.3 + classes * 0.20 + previous * 0.045
      + Number(menu === 'student_combo') * 0.8 + rain * 0.35 - exam * 0.45 - Number(day >= 5) * 0.8;
    return {
      id: String(10000 + index), day_of_week: day, hour,
      temperature: Math.round((-5 + random() * 25) * 10) / 10,
      rain, is_exam_week: exam, nearby_classes: classes, menu_type: menu,
      previous_visitors: previous, busy: Number(random() < 1 / (1 + Math.exp(-logit))),
      partitionKey: random(),
    };
  });
  const train = rows.slice(0, 1200);
  const test = rows.slice(1200).sort((a, b) => a.partitionKey - b.partitionKey)
    .map((row, index) => ({ ...row, isPublic: index < 200 })).sort((a, b) => Number(a.id) - Number(b.id));
  const dataset = { version: 1, train, test };
  if (path) writeFileSync(path, JSON.stringify(dataset), { mode: 0o600, flag: 'wx' });
  return dataset;
}

export function datasetCsv(dataset, kind) {
  if (kind === 'sample_submission') return 'id,busy\n' + dataset.test.map(row => `${row.id},0`).join('\n') + '\n';
  const columns = kind === 'train' ? [...FEATURE_COLUMNS, 'busy'] : FEATURE_COLUMNS;
  return columns.join(',') + '\n' + dataset[kind].map(row => columns.map(column => row[column]).join(',')).join('\n') + '\n';
}

export function scorePredictions(buffer, dataset) {
  let records;
  try {
    records = parse(buffer, { bom: true, columns: false, skip_empty_lines: true, trim: true, max_record_size: 1024 });
  } catch {
    throw new Error('Не удалось прочитать CSV. Используй запятую как разделитель и кодировку UTF-8.');
  }
  if (records[0]?.join(',') !== 'id,busy') throw new Error('В CSV нужны ровно два столбца: id,busy.');
  const rows = records.slice(1);
  if (rows.length !== dataset.test.length) throw new Error(`Нужно ${dataset.test.length} предсказаний — по одному для каждой строки test.csv.`);
  const predictions = new Map();
  const expectedIds = new Set(dataset.test.map(row => row.id));
  for (const [id, prediction, ...extra] of rows) {
    if (extra.length || !expectedIds.has(id) || predictions.has(id) || !['0', '1'].includes(prediction)) {
      throw new Error('Проверь ID: без пропусков и повторений, только из test.csv. Значения busy — 0 или 1.');
    }
    predictions.set(id, Number(prediction));
  }
  function f1(partition) {
    let tp = 0, fp = 0, fn = 0;
    for (const row of partition) {
      const prediction = predictions.get(row.id);
      if (prediction === 1 && row.busy === 1) tp++;
      if (prediction === 1 && row.busy === 0) fp++;
      if (prediction === 0 && row.busy === 1) fn++;
    }
    return 2 * tp + fp + fn === 0 ? 0 : 100 * 2 * tp / (2 * tp + fp + fn);
  }
  return { publicScore: f1(dataset.test.filter(row => row.isPublic)), privateScore: f1(dataset.test.filter(row => !row.isPublic)) };
}

export function getLeaderboard(db, final) {
  const score = final ? 'private_score' : 'public_score';
  // Freeze each participant's best public submission before comparing private scores.
  return db.prepare(`
    WITH ranked AS (
      SELECT s.*, ROW_NUMBER() OVER (PARTITION BY registration_id ORDER BY s.public_score DESC, s.created_at ASC, s.id ASC) AS choice
      FROM submissions s JOIN registrations r ON r.id = s.registration_id WHERE r.status != 'withdrawn'
    )
    SELECT r.display_name AS name, s.${score} AS score, s.created_at AS submittedAt,
      (SELECT count(*) FROM submissions sub WHERE sub.registration_id = r.id) AS attempts
    FROM ranked s JOIN registrations r ON r.id = s.registration_id
    WHERE s.choice = 1 ORDER BY s.${score} DESC, s.created_at ASC, s.id ASC
  `).all().map((entry, index) => ({ rank: index + 1, ...entry, score: Math.round(entry.score * 100) / 100 }));
}
