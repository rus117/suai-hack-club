import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CHALLENGE_ID, loadDataset, datasetCsv, getLeaderboard } from '../server/challenge.mjs';
import { openDatabase } from '../server/database.mjs';

test('Titanic split is stable, disjoint, balanced and preserves source missing values', () => {
  const data=loadDataset(null,'titanic-test-secret');
  assert.equal(data.version,CHALLENGE_ID); assert.equal(data.train.length,1009); assert.equal(data.test.length,300);
  assert.equal(data.test.filter(row=>row.isPublic).length,200);
  assert.equal(data.test.filter(row=>row.survived===1).length,114);
  assert.equal([...data.train,...data.test].filter(row=>row.survived===1).length,500);
  assert.equal([...data.train,...data.test].filter(row=>row.age==='').length,263);
  assert.equal(new Set([...data.train,...data.test].map(row=>row.id)).size,1309);
  assert.deepEqual(loadDataset(null,'titanic-test-secret'),data);
  assert.notDeepEqual(loadDataset(null,'another-test-secret').test,data.test);
  const csv=datasetCsv(data,'test');
  assert.equal(csv.split('\n')[0],'id,pclass,sex,age,sibsp,parch,fare,embarked');
  assert.equal(csv.includes('survived'),false); assert.equal(csv.includes('isPublic'),false);
  assert.equal(csv.includes('boat'),false); assert.equal(csv.includes('body'),false);
});

test('new dataset and leaderboard keep old exercise data intact and separate', t => {
  const folder=mkdtempSync(join(tmpdir(),'suai-titanic-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
  const path=join(folder,'dataset.json'); const old=JSON.stringify({version:1,train:[],test:[]});writeFileSync(path,old);
  const fresh=loadDataset(path,'fixed-test-secret');
  assert.equal(readFileSync(path,'utf8'),old);
  assert.deepEqual(loadDataset(path,'fixed-test-secret'),fresh);
  const db=openDatabase(':memory:');t.after(()=>db.close());
  db.prepare(`INSERT INTO registrations (id,event_id,full_name,telegram,display_name,team_mode,team_name,experience,token_hash,consent_version,created_at)
    VALUES ('r','start','Test User','@test_user','test','solo','','beginner','hash','2026-10-07','2026-10-07')`).run();
  db.prepare('INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?,?)').run('old','r',100,100,'https://example.com','old.csv','2026-10-07','2026-10-07','cafe-v1');
  assert.deepEqual(getLeaderboard(db,false),[]);
  db.prepare('INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?,?)').run('new','r',70,60,'https://example.com','new.csv','2026-10-08','2026-10-08',CHALLENGE_ID);
  const board=getLeaderboard(db,false);assert.equal(board[0].score,70);assert.equal(board[0].attempts,1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM submissions').get().n,2);
});
