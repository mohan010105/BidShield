import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  herfindahlIndex,
  jaccardSimilarity,
  mean,
  median,
  normalizedEntropy,
  relativeBidDistance,
  round,
  stdDev,
  variance,
} from "../common/statistics";

describe("Statistics Module", () => {
  it("calculates mean and median accurately", () => {
    const nums = [10, 20, 30, 40, 50];
    assert.equal(mean(nums), 30);
    assert.equal(median(nums), 30);

    const evenNums = [10, 20, 30, 40];
    assert.equal(median(evenNums), 25);
  });

  it("calculates variance and standard deviation", () => {
    const values = [10, 10, 10, 10];
    assert.equal(variance(values), 0);
    assert.equal(stdDev(values), 0);

    const spread = [2, 4, 4, 4, 5, 5, 7, 9];
    assert.equal(round(mean(spread), 2), 5);
    assert.equal(round(stdDev(spread), 2), 2);
  });

  it("calculates relative bid distance correctly", () => {
    const winningBid = 1000000;
    const bidB = 1080000;
    const bidC = 1082000;
    const bidD = 1085000;

    assert.equal(relativeBidDistance(winningBid, winningBid), 0);
    assert.equal(relativeBidDistance(bidB, winningBid), 8.0);
    assert.equal(relativeBidDistance(bidC, winningBid), 8.2);
    assert.equal(relativeBidDistance(bidD, winningBid), 8.5);
  });

  it("computes Jaccard similarity correctly", () => {
    const groupA = [1, 2, 3, 4];
    const groupB = [2, 3, 4, 5];
    // Intersection = {2,3,4} (3), Union = {1,2,3,4,5} (5) => 3/5 = 0.6
    assert.equal(jaccardSimilarity(groupA, groupB), 0.6);

    const identical = [1, 2, 3];
    assert.equal(jaccardSimilarity(identical, identical), 1.0);

    const disjointA = [1, 2];
    const disjointB = [3, 4];
    assert.equal(jaccardSimilarity(disjointA, disjointB), 0.0);
  });

  it("computes Herfindahl-Hirschman Index (HHI) and normalized entropy", () => {
    // Equal distribution among 3 firms
    const equalShares = [3, 3, 3];
    assert.equal(round(herfindahlIndex(equalShares), 2), 0); // 0 = perfectly equal
    assert.equal(round(normalizedEntropy(equalShares), 2), 1.0); // 1.0 = maximal entropy

    // Total dominance by single firm
    const singleWinner = [9, 0, 0];
    assert.equal(round(herfindahlIndex(singleWinner), 2), 1.0);
    assert.equal(round(normalizedEntropy(singleWinner), 2), 0.0);
  });
});
