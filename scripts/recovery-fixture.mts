import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import sharp from 'sharp';
import type { WorkspaceUser } from '../src/server/workspace-service';

// Only launched by verify-isolated-recovery.mjs, with new synthetic databases.
const database = new URL(process.env.DATABASE_URL || '').pathname.slice(1);
const runtimeUrl = new URL(process.env.DATABASE_URL || ''), ownerUrl = new URL(process.env.DATABASE_MIGRATION_URL || '');
if (!/^tracelab_unified_test_recovery_[0-9]+_[a-f0-9]{8}(?:_restored)?$/.test(database)
  || process.env.IZNERA_RECOVERY_DATABASE !== database || ownerUrl.pathname !== runtimeUrl.pathname
  || ownerUrl.hostname !== runtimeUrl.hostname || (ownerUrl.port || '5432') !== (runtimeUrl.port || '5432')
  || ![runtimeUrl, ownerUrl].every(url => ['postgres:', 'postgresql:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.search && !url.hash))
  throw new Error('Recovery fixtures require a uniquely named disposable database.');
const [phase, stateFile] = process.argv.slice(2);
if (!stateFile || !['seed', 'verify'].includes(phase)) throw new Error('Expected seed/verify and a fixture manifest path.');
const { pool } = await import('../src/db/index');
const { executeWorkspaceCommand, getWorkspace } = await import('../src/server/workspace-service');
const { uploadWorkspaceMedia, readWorkspaceMedia } = await import('../src/server/workspace-media-service');
const { createWorkspaceReport, downloadWorkspaceReport } = await import('../src/server/workspace-report-service');
const { uploadMetadata } = await import('../src/server/workspace-media-contract');
const owner = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL });
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
type Fixture = { user: WorkspaceUser; outsider: WorkspaceUser; teamId: string; projectId: string;
  artifactId: string; recordId: string; exportId: string; photoHash: string; thumbnailHash: string; reportHash: string };
try {
  for (const connection of [owner, pool]) {
    const actual = (await connection.query('SELECT current_database() AS name')).rows[0]?.name;
    if (actual !== database) throw new Error('Actual recovery fixture database does not match its isolated target.');
  }
  if (phase === 'seed') {
    const user: WorkspaceUser = { id: randomUUID(), displayName: 'Recovery fixture student', locale: 'en' };
    const outsider: WorkspaceUser = { id: randomUUID(), displayName: 'Recovery fixture outsider', locale: 'en' };
    for (const person of [user, outsider]) {
      await owner.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'synthetic-only',$3,'en')", [person.id, person.id + '@example.invalid', person.displayName]);
      await owner.query('INSERT INTO account_verification(user_id,verified_at) VALUES($1,now())', [person.id]);
    }
    const state = await executeWorkspaceCommand(user, { command: 'createTeam', requestId: randomUUID(), args: [{
      name: 'Isolated recovery fixture', season: 'Recovery fixture season', project: 'Recovery fixture project', timezone: 'UTC', program: 'OTHER', locale: 'en',
    }] });
    const teamId = state.team!.id, projectId = state.activeProjectId!;
    const photo = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#b94132' } }).png().toBuffer();
    const media = await uploadWorkspaceMedia(user, uploadMetadata.parse({ teamId, projectId, requestId: randomUUID(),
      kind: 'photo', name: 'Synthetic recovery photo', filename: 'synthetic.png', caption: 'A saved student observation.',
      alt: 'Synthetic solid-color fixture', occurredAt: '2026-11-01T10:00:00Z' }), photo);
    const report = await createWorkspaceReport(user, { projectId, requestId: randomUUID(), format: 'json', locale: 'en',
      purpose: 'engineering', acknowledgeWarnings: true });
    const savedPhoto = await readWorkspaceMedia(user, media.artifactId!, false);
    const thumbnail = await readWorkspaceMedia(user, media.artifactId!, true);
    const savedReport = await downloadWorkspaceReport(user, report.exportId);
    const fixture: Fixture = { user, outsider, teamId, projectId, artifactId: media.artifactId!, recordId: media.recordId!,
      exportId: report.exportId, photoHash: hash(savedPhoto.bytes), thumbnailHash: hash(thumbnail.bytes), reportHash: hash(savedReport.bytes) };
    await writeFile(stateFile, JSON.stringify(fixture, null, 2));
    console.log('Synthetic team, authored photo, thumbnail and immutable report created through application services.');
  } else {
    const fixture: Fixture = JSON.parse(await readFile(stateFile, 'utf8'));
    const state = await getWorkspace(fixture.user, { team: fixture.teamId, project: fixture.projectId });
    const project = state.projects.find(item => item.id === fixture.projectId);
    assert(project?.records.some(record => record.id === fixture.recordId), 'Restored workspace record missing');
    const photo = await readWorkspaceMedia(fixture.user, fixture.artifactId, false);
    const thumb = await readWorkspaceMedia(fixture.user, fixture.artifactId, true);
    const report = await downloadWorkspaceReport(fixture.user, fixture.exportId);
    assert.equal(hash(photo.bytes), fixture.photoHash);
    assert.equal(hash(thumb.bytes), fixture.thumbnailHash);
    assert.equal(hash(report.bytes), fixture.reportHash);
    assert.equal(photo.item.authorUserId, fixture.user.id, 'Authorship was not restored');
    assert.equal(photo.item.caption, 'A saved student observation.');
    await assert.rejects(readWorkspaceMedia(fixture.outsider, fixture.artifactId, false), { status: 404 });
    await assert.rejects(downloadWorkspaceReport(fixture.outsider, fixture.exportId), { status: 403 });
    console.log('PASS: restored project, author, original photo, thumbnail and report match; foreign-user media/report access denied.');
  }
} finally { await owner.end(); await pool.end(); }
