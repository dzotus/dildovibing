/**
 * ClickHouse Compression Calculator
 * 
 * Динамический расчет compression ratio на основе типа сжатия, типов данных
 * и размера данных. Избегает хардкода compressionRatio = 5.0.
 */

export type CompressionType = 'LZ4' | 'ZSTD' | 'LZ4HC' | 'None';

export interface CompressionCalculationParams {
  compressionType: CompressionType;
  dataSize: number; // uncompressed size in bytes
  dataType?: 'text' | 'numeric' | 'mixed'; // тип данных для расчета
  blockSize?: number; // размер блока для сжатия (по умолчанию 1MB)
}

/**
 * Calculates compression ratio for ClickHouse based on compression type and data characteristics
 */
export class ClickHouseCompressionCalculator {
  /**
   * Calculate compression ratio based on compression type and data
   * 
   * Compression ratios (реалистичные значения):
   * - LZ4: 2-4x для текстовых данных, 1.5-2x для числовых
   * - ZSTD: 3-6x для текстовых данных, 2-3x для числовых
   * - LZ4HC: 2.5-5x для текстовых данных, 1.8-2.5x для числовых
   * - None: 1.0 (без сжатия)
   */
  public calculateCompressionRatio(params: CompressionCalculationParams): number {
    const {
      compressionType,
      dataSize,
      dataType = 'mixed',
      blockSize = 1024 * 1024, // 1MB default
    } = params;

    if (compressionType === 'None') {
      return 1.0;
    }

    // Базовые коэффициенты сжатия для разных типов данных
    const baseRatios: Record<CompressionType, { text: [number, number]; numeric: [number, number] }> = {
      LZ4: { text: [2.0, 4.0], numeric: [1.5, 2.0] },
      ZSTD: { text: [3.0, 6.0], numeric: [2.0, 3.0] },
      LZ4HC: { text: [2.5, 5.0], numeric: [1.8, 2.5] },
      None: { text: [1.0, 1.0], numeric: [1.0, 1.0] },
    };

    const ratios = baseRatios[compressionType];
    let [minRatio, maxRatio] = dataType === 'text' ? ratios.text : ratios.numeric;

    // Если mixed, берем среднее между text и numeric
    if (dataType === 'mixed') {
      const textAvg = (ratios.text[0] + ratios.text[1]) / 2;
      const numericAvg = (ratios.numeric[0] + ratios.numeric[1]) / 2;
      minRatio = (textAvg + numericAvg) / 2;
      maxRatio = Math.max(ratios.text[1], ratios.numeric[1]);
    }

    // Большие блоки сжимаются лучше (больше повторяющихся паттернов)
    const blockSizeFactor = Math.min(1.2, 1.0 + Math.log10(dataSize / blockSize) * 0.1);
    
    // Случайная вариация в пределах диапазона (симуляция реального сжатия)
    const randomFactor = minRatio + Math.random() * (maxRatio - minRatio);
    
    // Применяем фактор размера блока
    const compressionRatio = randomFactor * blockSizeFactor;

    return Math.round(compressionRatio * 100) / 100; // Округляем до 2 знаков
  }

  /**
   * Calculate compressed size from uncompressed size
   */
  public calculateCompressedSize(params: CompressionCalculationParams): number {
    const compressionRatio = this.calculateCompressionRatio(params);
    return Math.round(params.dataSize / compressionRatio);
  }

  /**
   * Determine data type from column types
   */
  public determineDataType(columns?: Array<{ name: string; type: string }>): 'text' | 'numeric' | 'mixed' {
    if (!columns || columns.length === 0) {
      return 'mixed';
    }

    const textTypes = ['String', 'FixedString', 'UUID', 'Date', 'DateTime', 'DateTime64'];
    const numericTypes = ['UInt8', 'UInt16', 'UInt32', 'UInt64', 'Int8', 'Int16', 'Int32', 'Int64', 'Float32', 'Float64', 'Decimal'];

    let textCount = 0;
    let numericCount = 0;

    for (const col of columns) {
      const type = col.type || '';
      if (textTypes.some(t => type.includes(t))) {
        textCount++;
      } else if (numericTypes.some(t => type.includes(t))) {
        numericCount++;
      }
    }

    if (textCount > numericCount * 2) {
      return 'text';
    } else if (numericCount > textCount * 2) {
      return 'numeric';
    } else {
      return 'mixed';
    }
  }
}
