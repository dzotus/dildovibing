/**
 * Prometheus Relabeling Engine
 * Реализует relabel_configs для обработки labels перед сохранением метрик
 * 
 * Поддерживаемые actions:
 * - replace: заменяет значение label
 * - keep: сохраняет target если regex совпадает
 * - drop: удаляет target если regex совпадает
 * - hashmod: вычисляет hashmod для label
 * - labelmap: переименовывает labels по regex
 * - labeldrop: удаляет labels по regex
 * - labelkeep: сохраняет только labels по regex
 */

export interface RelabelConfig {
  source_labels?: string[];
  separator?: string;
  target_label?: string;
  regex?: string;
  replacement?: string;
  action?: 'replace' | 'keep' | 'drop' | 'hashmod' | 'labelmap' | 'labeldrop' | 'labelkeep';
  modulus?: number;
}

export interface RelabelInput {
  labels: Record<string, string>;
  __address__?: string;
  __metrics_path__?: string;
  __scheme__?: string;
}

export interface RelabelResult {
  labels: Record<string, string>;
  keep: boolean; // false если target должен быть отброшен
}

/**
 * Prometheus Relabeling Engine
 */
export class PrometheusRelabeling {
  /**
   * Применяет relabel_configs к labels
   */
  static applyRelabeling(
    input: RelabelInput,
    relabelConfigs: RelabelConfig[]
  ): RelabelResult {
    let labels = { ...input.labels };
    let keep = true;

    for (const config of relabelConfigs) {
      const action = config.action || 'replace';
      
      switch (action) {
        case 'replace':
          labels = this.applyReplace(labels, config, input);
          break;
        
        case 'keep':
          if (!this.matchesRegex(labels, config, input)) {
            keep = false;
            return { labels, keep };
          }
          break;
        
        case 'drop':
          if (this.matchesRegex(labels, config, input)) {
            keep = false;
            return { labels, keep };
          }
          break;
        
        case 'hashmod':
          labels = this.applyHashmod(labels, config, input);
          break;
        
        case 'labelmap':
          labels = this.applyLabelmap(labels, config);
          break;
        
        case 'labeldrop':
          labels = this.applyLabeldrop(labels, config);
          break;
        
        case 'labelkeep':
          labels = this.applyLabelkeep(labels, config);
          break;
      }
    }

    return { labels, keep };
  }

  /**
   * Применяет replace action
   */
  private static applyReplace(
    labels: Record<string, string>,
    config: RelabelConfig,
    input: RelabelInput
  ): Record<string, string> {
    if (!config.source_labels || !config.target_label) {
      return labels;
    }

    // Собираем значения source_labels
    const separator = config.separator || ';';
    const sourceValues = config.source_labels
      .map(label => {
        // Проверяем специальные мета-метки
        if (label === '__address__') return input.__address__ || '';
        if (label === '__metrics_path__') return input.__metrics_path__ || '';
        if (label === '__scheme__') return input.__scheme__ || '';
        return labels[label] || '';
      })
      .join(separator);

    // Применяем regex
    const regex = this.compileRegex(config.regex || '.*');
    const replacement = config.replacement || '$1';
    
    const result = sourceValues.replace(regex, replacement);
    
    // Если regex совпал, устанавливаем target_label
    if (regex.test(sourceValues)) {
      labels[config.target_label] = result;
    }

    return labels;
  }

  /**
   * Проверяет совпадение regex
   */
  private static matchesRegex(
    labels: Record<string, string>,
    config: RelabelConfig,
    input: RelabelInput
  ): boolean {
    if (!config.source_labels) {
      return false;
    }

    const separator = config.separator || ';';
    const sourceValues = config.source_labels
      .map(label => {
        if (label === '__address__') return input.__address__ || '';
        if (label === '__metrics_path__') return input.__metrics_path__ || '';
        if (label === '__scheme__') return input.__scheme__ || '';
        return labels[label] || '';
      })
      .join(separator);

    const regex = this.compileRegex(config.regex || '.*');
    return regex.test(sourceValues);
  }

  /**
   * Применяет hashmod action
   */
  private static applyHashmod(
    labels: Record<string, string>,
    config: RelabelConfig,
    input: RelabelInput
  ): Record<string, string> {
    if (!config.source_labels || !config.target_label || !config.modulus) {
      return labels;
    }

    const separator = config.separator || ';';
    const sourceValues = config.source_labels
      .map(label => {
        if (label === '__address__') return input.__address__ || '';
        if (label === '__metrics_path__') return input.__metrics_path__ || '';
        if (label === '__scheme__') return input.__scheme__ || '';
        return labels[label] || '';
      })
      .join(separator);

    // Простой hash (FNV-1a)
    let hash = 2166136261;
    for (let i = 0; i < sourceValues.length; i++) {
      hash ^= sourceValues.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    
    const mod = Math.abs(hash) % config.modulus;
    labels[config.target_label] = String(mod);

    return labels;
  }

  /**
   * Применяет labelmap action
   */
  private static applyLabelmap(
    labels: Record<string, string>,
    config: RelabelConfig
  ): Record<string, string> {
    if (!config.regex) {
      return labels;
    }

    const regex = this.compileRegex(config.regex);
    const replacement = config.replacement || '$1';
    const newLabels: Record<string, string> = {};

    for (const [key, value] of Object.entries(labels)) {
      const match = key.match(regex);
      if (match) {
        const newKey = replacement.replace(/\$(\d+)/g, (_, n) => {
          const index = parseInt(n);
          return match[index] || '';
        });
        newLabels[newKey] = value;
      } else {
        newLabels[key] = value;
      }
    }

    return newLabels;
  }

  /**
   * Применяет labeldrop action
   */
  private static applyLabeldrop(
    labels: Record<string, string>,
    config: RelabelConfig
  ): Record<string, string> {
    if (!config.regex) {
      return labels;
    }

    const regex = this.compileRegex(config.regex);
    const newLabels: Record<string, string> = {};

    for (const [key, value] of Object.entries(labels)) {
      if (!regex.test(key)) {
        newLabels[key] = value;
      }
    }

    return newLabels;
  }

  /**
   * Применяет labelkeep action
   */
  private static applyLabelkeep(
    labels: Record<string, string>,
    config: RelabelConfig
  ): Record<string, string> {
    if (!config.regex) {
      return labels;
    }

    const regex = this.compileRegex(config.regex);
    const newLabels: Record<string, string> = {};

    for (const [key, value] of Object.entries(labels)) {
      if (regex.test(key)) {
        newLabels[key] = value;
      }
    }

    return newLabels;
  }

  /**
   * Компилирует regex из строки (поддерживает Prometheus regex синтаксис)
   */
  private static compileRegex(pattern: string): RegExp {
    try {
      // Prometheus использует RE2 синтаксис, но для симуляции используем стандартный JS regex
      // Убираем якоря если они есть (Prometheus не требует их)
      let regexPattern = pattern;
      if (regexPattern.startsWith('^')) regexPattern = regexPattern.slice(1);
      if (regexPattern.endsWith('$')) regexPattern = regexPattern.slice(0, -1);
      
      return new RegExp(regexPattern);
    } catch (e) {
      // Если невалидный regex, возвращаем паттерн который ничего не матчит
      return /(?!)/;
    }
  }
}
