export interface MetricDatum {
  MetricName: string;
  Value: number;
  Unit?: 'Count' | 'Milliseconds' | 'Seconds';
  Dimensions?: Array<{ Name: string; Value: string }>;
}
