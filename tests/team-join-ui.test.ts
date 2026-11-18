import {describe,it,expect} from 'vitest';
import {isTeamCodeInput,joinCopy,joinErrorKey} from '../src/app/join/join-copy';

describe('team-code entry contract',()=>{
  it('accepts the issued alphabet and user formatting while rejecting ambiguous or malformed codes',()=>{
    for(const value of ['ABCD-EFGH-JKLM','abcd efgh jklm','  abcd-efgh-jklm  '])expect(isTeamCodeInput(value)).toBe(true);
    for(const value of ['ABCD-EFGH-JKL','ABCD-EFGH-JKLMN','ABCD-EFGH-JK10','ABCD-EFGH-JKIO','<script>1234','АБВГ-ДЕЖЗ-ИКЛМ'])expect(isTeamCodeInput(value)).toBe(false);
  });
  it('has semantic error and joining instructions in all three languages',()=>{
    const keys=Object.keys(joinCopy.ru).sort();
    for(const locale of ['en','kk'] as const){expect(Object.keys(joinCopy[locale]).sort()).toEqual(keys);for(const value of Object.values(joinCopy[locale]))expect(value.trim().length).toBeGreaterThan(0);}
    expect(joinErrorKey('rate_limited')).toBe('limited');expect(joinErrorKey('unauthenticated')).toBe('signin');expect(joinErrorKey('forbidden')).toBe('unavailable');expect(joinErrorKey('invalid_fields')).toBe('invalid');expect(joinErrorKey('arbitrary-internal-db-error')).toBe('service');
  });
});
