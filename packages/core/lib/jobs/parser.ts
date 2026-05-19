import { MetricFieldSpec } from './types';

export class MetricsParser {
  /**
   * Scans terminal/process stdout block for predefined metrics schemas.
   * Returns a key-value record of any parsed metrics found in this block.
   */
  static scan(output: string, schema: MetricFieldSpec[]): Record<string, any> {
    const extracted: Record<string, any> = {};
    for (const field of schema) {
      try {
        const regex = new RegExp(field.regexPattern);
        const match = output.match(regex);
        if (match && match[1]) {
          // Clean formatting like percentage signs, dollar signs, or commas
          const cleanVal = match[1].replace(/[%,$]/g, '').trim();
          extracted[field.key] = this.castType(cleanVal, field.format);
        }
      } catch (err) {
        // Silently capture regex compile or match errors to prevent process halts
      }
    }
    return extracted;
  }

  private static castType(value: string, format: string): any {
    switch (format) {
      case 'integer':
        return parseInt(value, 10);
      case 'decimal':
      case 'percentage':
        return parseFloat(value);
      default:
        return value;
    }
  }
}
