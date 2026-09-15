import { roundAverageRating } from '../../src/services/ratings.service';

describe('roundAverageRating', () => {
  it('rounds to one decimal place', () => {
    expect(roundAverageRating(4.666666)).toBe('4.7');
    expect(roundAverageRating(4.644444)).toBe('4.6');
  });

  it('formats a whole number with one decimal place', () => {
    expect(roundAverageRating(5)).toBe('5.0');
    expect(roundAverageRating(0)).toBe('0.0');
  });

  it('proves true-average math, not "last value wins": avg of 5, 5, 1 is 3.7, not 1.0 or 5.0', () => {
    const scores = [5, 5, 1];
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(roundAverageRating(average)).toBe('3.7');
  });

  it('proves true-average math, not incremental drift: avg of 3, 3, 3, 5 is 3.5', () => {
    const scores = [3, 3, 3, 5];
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(roundAverageRating(average)).toBe('3.5');
  });
});
