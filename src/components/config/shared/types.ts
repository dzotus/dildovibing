export type ConfigFieldValue = string | number | boolean | string[];

export type ConfigFieldType =
  | 'text'
  | 'password'
  | 'number'
  | 'select'
  | 'toggle'
  | 'textarea'
  | 'list';

export interface ConfigFieldOption {
  label: string;
  value: string;
}

export interface ConfigField {
  id: string;
  label: string;
  type: ConfigFieldType;
  description?: string;
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: ConfigFieldOption[];
  defaultListItem?: string;
  rows?: number;
}

export interface ConfigSection {
  id: string;
  title: string;
  description?: string;
  fields: ConfigField[];
}

export interface ComponentProfile {
  id: string;
  title: string;
  description: string;
  docsUrl?: string;
  badge?: string;
  defaults: Record<string, ConfigFieldValue>;
  sections: ConfigSection[];
}

