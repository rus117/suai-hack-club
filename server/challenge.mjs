import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

export const CHALLENGE_ID = 'titanic-v1';
export const FEATURE_COLUMNS = ['id', 'pclass', 'sex', 'age', 'sibsp', 'parch', 'fare', 'embarked'];

function seededRandom(secret) {
  let counter = 0;
  return () => createHmac('sha256', secret).update(`${CHALLENGE_ID}:${counter++}`).digest().readUInt32BE() / 4294967296;
}
export function loadDataset(path, secret) {
  // Keep the previous exercise's dataset intact; use a distinct file for Titanic.
  const target = path ? `${path.replace(/\.json$/, '')}-${CHALLENGE_ID}.json` : null;
  if (target && existsSync(target)) {
    const saved = JSON.parse(readFileSync(target, 'utf8'));
    if (saved.version !== CHALLENGE_ID || saved.train.length !== 1009 || saved.test.length !== 300) throw new Error('Unexpected Titanic dataset; restore a consistent backup.');
    return saved;
  }
  const random = seededRandom(secret);
  const shuffle = values => {
    const result = [...values];
    for (let i=result.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  };
  const source = parse(readFileSync(new URL('./datasets/titanic.csv', import.meta.url)), { columns:true, skip_empty_lines:true });
  if(source.length !== 1309) throw new Error('Titanic source must contain 1309 passengers.');
  const rows = shuffle(source).map((row,index)=>({ ...row, id:String(20000+index), survived:Number(row.survived) }));
  const train=[], test=[];
  for(const label of [0,1]) {
    const group=shuffle(rows.filter(row=>row.survived===label));
    const testCount=label===1 ? 114 : 186;
    const publicCount=label===1 ? 76 : 124;
    test.push(...group.slice(0,testCount).map((row,index)=>({...row,isPublic:index<publicCount})));
    train.push(...group.slice(testCount));
  }
  const dataset={version:CHALLENGE_ID,train:shuffle(train),test:shuffle(test)};
  if(target) writeFileSync(target,JSON.stringify(dataset),{mode:0o600,flag:'wx'});
  return dataset;
}

export function datasetCsv(dataset, kind) {
  if (kind === 'sample_submission') return 'id,survived\n' + dataset.test.map(row => `${row.id},0`).join('\n') + '\n';
  const columns = kind === 'train' ? [...FEATURE_COLUMNS, 'survived'] : FEATURE_COLUMNS;
  return columns.join(',') + '\n' + dataset[kind].map(row => columns.map(column => row[column]).join(',')).join('\n') + '\n';
}

export function scorePredictions(buffer, dataset) {
  let records;
  try {
    records = parse(buffer, { bom: true, columns: false, skip_empty_lines: true, trim: true, max_record_size: 1024 });
  } catch {
    throw new Error('Не удалось прочитать CSV. Используй запятую как разделитель и кодировку UTF-8.');
  }
  if (records[0]?.join(',') !== 'id,survived') throw new Error('В CSV нужны ровно два столбца: id,survived.');
  const rows = records.slice(1);
  if (rows.length !== dataset.test.length) throw new Error(`Нужно ${dataset.test.length} предсказаний — по одному для каждой строки test.csv.`);
  const predictions = new Map();
  const expectedIds = new Set(dataset.test.map(row => row.id));
  for (const [id, prediction, ...extra] of rows) {
    if (extra.length || !expectedIds.has(id) || predictions.has(id) || !['0', '1'].includes(prediction)) {
      throw new Error('Проверь ID: без пропусков и повторений, только из test.csv. Значения survived — 0 или 1.');
    }
    predictions.set(id, Number(prediction));
  }
  function f1(partition) {
    let tp = 0, fp = 0, fn = 0;
    for (const row of partition) {
      const prediction = predictions.get(row.id);
      if (prediction === 1 && row.survived === 1) tp++;
      if (prediction === 1 && row.survived === 0) fp++;
      if (prediction === 0 && row.survived === 1) fn++;
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
      FROM submissions s JOIN registrations r ON r.id = s.registration_id WHERE r.status != 'withdrawn' AND s.challenge_id='${CHALLENGE_ID}'
    )
    SELECT r.display_name AS name, s.${score} AS score, s.created_at AS submittedAt,
      (SELECT count(*) FROM submissions sub WHERE sub.registration_id = r.id AND sub.challenge_id='${CHALLENGE_ID}') AS attempts
    FROM ranked s JOIN registrations r ON r.id = s.registration_id
    WHERE s.choice = 1 ORDER BY s.${score} DESC, s.created_at ASC, s.id ASC
  `).all().map((entry, index) => ({ rank: index + 1, ...entry, score: Math.round(entry.score * 100) / 100 }));
}
