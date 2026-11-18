import {describe,expect,it} from 'vitest';
import {timelineMediaRecordIds} from '@/server/workspace-media-contract';
import {reportPolicySelection} from '@/server/workspace-report-model';
import {randomUUID} from 'node:crypto';
describe('bounded timeline metadata and pinned report policy',()=>{
  it('accepts at most 100 distinct bounded record IDs and never turns an empty batch into a full gallery query',()=>{
    expect(timelineMediaRecordIds.parse(['SRC-01',randomUUID()])).toHaveLength(2);
    for(const ids of [[],['same','same'],[''],['a'.repeat(101)],['bad\u0000id'],Array.from({length:101},(_,index)=>'record-'+index)])expect(timelineMediaRecordIds.safeParse(ids).success).toBe(false);
  });
  it('pins an exact version/profile, while missing or malformed anchors fail closed once present',()=>{
    const anchor={schemaVersion:1,versionId:randomUUID(),profileId:randomUUID(),pinnedAt:new Date().toISOString(),reason:'season_handoff'};
    expect(reportPolicySelection(anchor,true)).toEqual({mode:'pinned',versionId:anchor.versionId,profileId:anchor.profileId});
    expect(reportPolicySelection(undefined,false)).toEqual({mode:'legacy'});
    for(const value of [null,{}, {...anchor,versionId:null}, {...anchor,profileId:null},{...anchor,versionId:'invented'}, {...anchor,pinnedAt:'invalid'},{...anchor,reason:'new_season_unreviewed'}])expect(reportPolicySelection(value,true)).toEqual({mode:'blocked'});
  });
});
