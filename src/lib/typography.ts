/**
 * Система типографики ArchiPhoenix
 * 
 * Единые константы для размеров, весов и стилей текста
 * Используется для обеспечения визуальной согласованности
 */

export const typography = {
  // Заголовки
  heading: {
    h1: 'text-2xl font-bold text-foreground',
    h2: 'text-lg font-semibold text-foreground',
    h3: 'text-sm font-semibold text-foreground',
    h4: 'text-xs font-semibold text-foreground',
    h5: 'text-[10px] font-semibold text-muted-foreground uppercase',
  },
  
  // Основной текст
  body: {
    base: 'text-sm text-foreground',
    small: 'text-xs text-foreground',
    micro: 'text-[10px] text-foreground',
  },
  
  // Вторичный текст
  muted: {
    base: 'text-sm text-muted-foreground',
    small: 'text-xs text-muted-foreground',
    micro: 'text-[10px] text-muted-foreground',
  },
  
  // Моноширинный шрифт
  mono: {
    base: 'font-mono text-sm text-foreground',
    small: 'font-mono text-xs text-foreground',
    micro: 'font-mono text-[10px] text-foreground',
  },
  
  // Семантические цвета для статусов
  status: {
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-destructive',
    info: 'text-primary',
  },
} as const;

/**
 * Утилита для получения классов типографики
 */
export function getTypographyClass(
  type: 'heading' | 'body' | 'muted' | 'mono',
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'base' | 'small' | 'micro'
): string {
  if (type === 'heading') {
    return typography.heading[level as 'h1' | 'h2' | 'h3' | 'h4' | 'h5'];
  }
  if (type === 'body') {
    return typography.body[level as 'base' | 'small' | 'micro'];
  }
  if (type === 'muted') {
    return typography.muted[level as 'base' | 'small' | 'micro'];
  }
  if (type === 'mono') {
    return typography.mono[level as 'base' | 'small' | 'micro'];
  }
  return '';
}









