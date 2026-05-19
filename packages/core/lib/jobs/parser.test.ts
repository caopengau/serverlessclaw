import { MetricsParser } from './parser';
import { MetricsSchema } from './types';

describe('Jobs MetricsParser', () => {
  const schema: MetricsSchema[] = [
    {
      key: 'total_trades',
      label: 'Total Trades Volume',
      format: 'integer',
      regexPattern: 'Total Trades Executed:\\s+([\\d,]+)',
    },
    {
      key: 'win_rate',
      label: 'Trading Win Rate',
      format: 'percentage',
      regexPattern: 'Win Rate:\\s+(\\d+\\.\\d+)%',
    },
    {
      key: 'cumulative_return',
      label: 'Cumulative Net Return',
      format: 'percentage',
      regexPattern: 'Cumulative Net Return:\\s+([+-]?\\d+\\.\\d+)%',
    },
  ];

  it('correctly extracts integer and percentage values from subprocess stdout streams', () => {
    const stdout = `
==================================================
SIMULATION RESULTS FOR MODEL: xauusd_lgbm_model_fee_0.3.bin
Fee per trade: 0.003 USD points | Horizon: 15 minutes
==================================================
Total Trades Executed:   14,601
Win Rate:                50.15%
Cumulative Net Return:   +0.5234%
Average Return per Trade: +0.0000%
==================================================
    `;

    const metrics = MetricsParser.scan(stdout, schema);

    expect(metrics).toEqual({
      total_trades: 14601,
      win_rate: 50.15,
      cumulative_return: 0.5234,
    });
  });

  it('correctly parses negative returns and strips commas in integers', () => {
    const stdout = `
Total Trades Executed:   1,234
Win Rate:                44.50%
Cumulative Net Return:   -1.4500%
    `;

    const metrics = MetricsParser.scan(stdout, schema);

    expect(metrics).toEqual({
      total_trades: 1234,
      win_rate: 44.5,
      cumulative_return: -1.45,
    });
  });

  it('returns empty object when no matches are found', () => {
    const stdout = 'Some random output without the metrics we want...';
    const metrics = MetricsParser.scan(stdout, schema);
    expect(metrics).toEqual({});
  });
});
