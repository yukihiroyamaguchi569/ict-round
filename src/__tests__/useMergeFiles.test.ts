import { describe, expect, it } from 'vitest';
import { moveItem } from '../merge/useMergeFiles';

describe('moveItem', () => {
  it('swaps an element with its upper neighbour', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
  });

  it('swaps an element with its lower neighbour', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('moves the last element up and the first element down', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the input list', () => {
    const list = ['a', 'b'];
    moveItem(list, 0, 1);
    expect(list).toEqual(['a', 'b']);
  });

  it('returns the same list when moving the first element up', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 0, -1)).toBe(list);
  });

  it('returns the same list when moving the last element down', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 1, 1)).toBe(list);
  });

  it('returns the same list for a single element in either direction', () => {
    const list = ['a'];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 0, 1)).toBe(list);
  });
});
