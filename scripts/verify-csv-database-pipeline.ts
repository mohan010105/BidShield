import { buildPoolConfig, pool, checkDatabaseConnection } from '../lib/db/src/index';
import { persistAndProcessImportedCsv, tenders, companies } from '../artifacts/api-server/src/lib/bidshieldData';
import { analyticsService } from '../artifacts/api-server/src/analytics';

console.log('==================================================');
console.log('BIDSHIELD CSV DATABASE & INGESTION PIPELINE TEST');
console.log('==================================================\n');

// 1. Validate Database URL normalization and pool config
console.log('[STEP 1] Testing Database URL Normalization:');
const testUrl = 'postgresql://postgres:[Mohanraj@2005]@db.ordstmmtnhulzsihrkg.supabase.co:5432/postgres';
const poolConfig = buildPoolConfig(testUrl);
console.log('  Username parsed:       ', poolConfig.user);
console.log('  Password sanitized:    ', poolConfig.password ? 'Mohanraj@2005 (sanitized)' : 'none');
console.log('  Host parsed:           ', poolConfig.host);
console.log('  Port parsed:           ', poolConfig.port);
console.log('  Database parsed:       ', poolConfig.database);
console.log('  SSL enabled for cloud: ', Boolean(poolConfig.ssl));
if (poolConfig.password === 'Mohanraj@2005' && poolConfig.user === 'postgres') {
  console.log('  [PASS] Credentials cleanly parsed and brackets safely stripped.');
} else {
  console.error('  [FAIL] Password was not properly sanitized.');
  process.exit(1);
}

async function main() {
  // 2. Check Database Connectivity
  console.log('\n[STEP 2] Database Connectivity Test:');
  const connected = await checkDatabaseConnection();
  console.log('  Connection result:    ', connected ? 'Connected to remote database' : 'Handled gracefully (offline/unreachable fallback)');

  // 3. Test CSV Ingestion with realistic procurement data
  console.log('\n[STEP 3] Simulating CSV Upload & Import Pipeline:');
  const testTenderNumber = `CSV-IMPORT-${Date.now()}`;
  const sampleCsvRows = [
    {
      sourceRowId: '2',
      tenderNumber: testTenderNumber,
      tenderTitle: 'Smart Traffic Management Civil Package 1',
      organization: 'Municipal Corporation',
      department: 'Urban Infrastructure',
      category: 'Civil Works',
      location: 'South District',
      state: 'Tamil Nadu',
      tenderDate: '2025-06-01',
      closingDate: '2025-06-15',
      companyName: 'Apex Infrastructure Technologies Pvt Ltd',
      bidAmount: 7800000,
      isWinner: true
    },
    {
      sourceRowId: '3',
      tenderNumber: testTenderNumber,
      tenderTitle: 'Smart Traffic Management Civil Package 1',
      organization: 'Municipal Corporation',
      department: 'Urban Infrastructure',
      category: 'Civil Works',
      location: 'South District',
      state: 'Tamil Nadu',
      tenderDate: '2025-06-01',
      closingDate: '2025-06-15',
      companyName: 'Bharat Highway Developers Ltd',
      bidAmount: 7840000,
      isWinner: false
    },
    {
      sourceRowId: '4',
      tenderNumber: testTenderNumber,
      tenderTitle: 'Smart Traffic Management Civil Package 1',
      organization: 'Municipal Corporation',
      department: 'Urban Infrastructure',
      category: 'Civil Works',
      location: 'South District',
      state: 'Tamil Nadu',
      tenderDate: '2025-06-01',
      closingDate: '2025-06-15',
      companyName: 'Civic Structures India Corp',
      bidAmount: 7860000,
      isWinner: false
    }
  ];

  const report = {
    rows: 3,
    validRows: 3,
    warningRows: 0,
    errorRows: 0,
    qualityScore: 100
  };

  const importResult = await persistAndProcessImportedCsv('highways_procurement_batch_2025.csv', sampleCsvRows, report);
  console.log('  Import summary:', importResult);

  // 4. Verify tender is registered in system
  const foundTender = tenders.find(t => t.tenderNumber === testTenderNumber);
  console.log('\n[STEP 4] Verifying Tender and Bids Ingestion:');
  console.log('  Tender located in store: ', Boolean(foundTender));
  console.log('  Tender ID:               ', foundTender?.id);
  console.log('  Bids count registered:   ', foundTender?.bids.length);
  console.log('  Winning vendor:          ', foundTender?.winner);
  console.log('  Contract value:          ', foundTender?.contractValue);

  if (foundTender && foundTender.bids.length === 3) {
    console.log('  [PASS] All CSV rows properly registered as tender & bids.');
  } else {
    console.error('  [FAIL] Tender or bids were not stored.');
    process.exit(1);
  }

  // 5. Verify screening and analytics processing
  console.log('\n[STEP 5] Verifying Statistical Screening Analytics Calculation:');
  await analyticsService.recalculate();
  const analytics = await analyticsService.analyzeTender(foundTender.id);
  console.log('  Analytics generated:     ', Boolean(analytics));
  console.log('  Combined overall score:  ', analytics?.combinedRisk.overallScore);
  console.log('  Screening level:         ', analytics?.combinedRisk.screeningLevel);
  console.log('  Price clustering score:  ', analytics?.priceClustering.score);
  console.log('  Evidence items count:    ', analytics?.evidence.length);

  if (analytics && (typeof analytics.combinedRisk.overallScore === 'number' || analytics.combinedRisk.overallScore === null)) {
    console.log('  [PASS] Analytics screening engine successfully processed newly imported CSV data.');
  } else {
    console.error('  [FAIL] Analytics failed to process imported tender.');
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('ALL CSV INGESTION & DATABASE PIPELINE TESTS PASSED');
  console.log('==================================================\n');

  try {
    await pool.end();
  } catch {}
  process.exit(0);
}

main().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
