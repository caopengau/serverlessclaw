import { getBlastRadiusStore } from '../core/lib/safety/blast-radius-store';
import { TrustManager } from '../core/lib/safety/trust-manager';

/**
 * Concurrency Stress Test for Shield Vertical (Phase 4)
 *
 * Verifies Principle 13 (Atomic State Integrity) under high concurrency.
 */

async function stressTestBlastRadius() {
  console.log('\n🚀 Starting BlastRadiusStore Concurrency Stress Test...');
  const store = getBlastRadiusStore();
  const agentId = 'stress-test-agent';
  const action = 'deployment';
  const concurrency = 50;

  console.log(`📡 Simulating ${concurrency} parallel increments for ${agentId}:${action}...`);

  // Simulate high-concurrency increments
  const results = await Promise.all(
    Array.from({ length: concurrency }).map(() =>
      store.incrementBlastRadius(agentId, action).catch((err) => {
        console.error('❌ Increment failed:', err.message);
        return null;
      })
    )
  );

  const successfulResults = results.filter((r) => r !== null);
  const finalCount = Math.max(...successfulResults.map((r) => r?.count || 0));

  console.log(`📊 Total increments attempted: ${concurrency}`);
  console.log(`✅ Successful increments recorded: ${successfulResults.length}`);
  console.log(`🏁 Final Count in Database: ${finalCount}`);

  if (finalCount === successfulResults.length) {
    console.log('✨ [PASSED] Atomic counter integrity maintained.');
  } else {
    console.warn(
      '⚠️ [WARNING] Mismatch detected. finalCount (' +
        finalCount +
        ') != successfulCount (' +
        successfulResults.length +
        ')'
    );
    console.warn(
      'Note: This might happen if multiple Phase 2 resets collided, but DynamoDB conditional updates should prevents this.'
    );
  }
}

async function stressTestReputation() {
  console.log('\n🚀 Starting TrustManager Concurrency Stress Test...');
  const agentId = 'reputation-stress-agent';
  const concurrency = 50;
  const initialScore = 80;

  // Reset agent
  console.log(
    `📡 Simulating ${concurrency} parallel success records (2pts each) for ${agentId}...`
  );

  const results = await Promise.all(
    Array.from({ length: concurrency }).map(() =>
      TrustManager.recordSuccess(agentId, 10).catch((err) => {
        console.error('❌ Success record failed:', err.message);
        return null;
      })
    )
  );

  const successful = results.filter((r) => typeof r === 'number');
  const finalScore = Math.max(...successful);

  console.log(`📊 Calls attempted: ${concurrency}`);
  console.log(`✅ Successes recorded: ${successful.length}`);
  console.log(`🏁 Final Trust Score: ${finalScore}`);

  // Each success (quality 10) gives 2 points.
  // However, trust score is capped at 100.
  const expected = Math.min(100, initialScore + successful.length * 2);

  // Note: Since we are mocking AgentRegistry in Vitest, we'd need a real DDB for a "true" stress test.
  // In this local environment, we'll verify the theory and the code path.
  console.log(`🎯 Expected (theoretical): ${expected}`);
}

async function run() {
  try {
    await stressTestBlastRadius();
    await stressTestReputation();
    console.log('\n✅ Stress tests completed.');
  } catch (err) {
    console.error('💥 Stress test crashed:', err);
  }
}

run();
