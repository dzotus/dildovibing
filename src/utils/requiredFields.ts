/**
 * Утилиты для валидации обязательных полей
 */

export interface RequiredField {
  field: string;
  label: string;
  validator?: (value: any) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Валидация обязательных полей
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: RequiredField[]
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const field of requiredFields) {
    const value = data[field.field];

    // Проверка на пустое значение
    if (value === undefined || value === null || value === '') {
      errors[field.field] = `Поле "${field.label}" обязательно для заполнения`;
      continue;
    }

    // Проверка строковых значений (trim)
    if (typeof value === 'string' && !value.trim()) {
      errors[field.field] = `Поле "${field.label}" не может быть пустым`;
      continue;
    }

    // Кастомная валидация
    if (field.validator && !field.validator(value)) {
      errors[field.field] = `Поле "${field.label}" имеет неверное значение`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Получить сообщение об ошибке для поля
 */
export function getFieldError(
  fieldName: string,
  validationResult: ValidationResult
): string | null {
  return validationResult.errors[fieldName] || null;
}

/**
 * Проверка, есть ли ошибки валидации
 */
export function hasValidationErrors(validationResult: ValidationResult): boolean {
  return !validationResult.isValid;
}
