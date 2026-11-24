import assert from 'node:assert/strict';
import test from 'node:test';
import { visionMoments } from '../domain/vision-moments.ts';

test('five ordered images remain distinct with three narration fragments', () => {
  const moments = visionMoments(['a', 'b', 'c', 'd', 'e'], ['eins', 'zwei', 'drei']);
  assert.deepEqual(moments, [
    { imageId: 'a', text: 'eins' },
    { imageId: 'b' },
    { imageId: 'c', text: 'zwei' },
    { imageId: 'd' },
    { imageId: 'e', text: 'drei' },
  ]);
});

test('image and text order survives empty, unequal and duplicate input', () => {
  for (const [imageCount, textCount] of [[0, 0], [0, 3], [1, 1], [1, 5], [3, 0], [3, 3], [8, 1], [20, 8]]) {
    const images = Array.from({ length: imageCount }, (_, index) => String(index % 3));
    const text = Array.from({ length: textCount }, (_, index) => `Text ${index}`);
    const moments = visionMoments(images, text);
    assert.equal(moments.length, Math.max(imageCount, textCount));
    assert.deepEqual(moments.flatMap(moment => moment.imageId ?? []), images);
    assert.deepEqual(moments.flatMap(moment => moment.text ?? []), text);
  }
});
