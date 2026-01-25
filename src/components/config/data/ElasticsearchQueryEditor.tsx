import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

interface ElasticsearchQueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

// Elasticsearch API endpoints for autocomplete
const elasticsearchEndpoints = [
  { label: 'GET /_search', type: 'endpoint', info: 'Search documents' },
  { label: 'POST /_search', type: 'endpoint', info: 'Search documents' },
  { label: 'GET /_cluster/health', type: 'endpoint', info: 'Cluster health' },
  { label: 'GET /_cluster/stats', type: 'endpoint', info: 'Cluster statistics' },
  { label: 'GET /_nodes', type: 'endpoint', info: 'List nodes' },
  { label: 'GET /_nodes/stats', type: 'endpoint', info: 'Node statistics' },
  { label: 'GET /_cat/indices', type: 'endpoint', info: 'List indices (cat API)' },
  { label: 'GET /_cat/indices?v', type: 'endpoint', info: 'List indices with headers' },
  { label: 'PUT /{index}', type: 'endpoint', info: 'Create index' },
  { label: 'GET /{index}', type: 'endpoint', info: 'Get index info' },
  { label: 'DELETE /{index}', type: 'endpoint', info: 'Delete index' },
  { label: 'GET /{index}/_mapping', type: 'endpoint', info: 'Get index mapping' },
  { label: 'PUT /{index}/_mapping', type: 'endpoint', info: 'Update index mapping' },
  { label: 'GET /{index}/_settings', type: 'endpoint', info: 'Get index settings' },
  { label: 'POST /{index}/_doc', type: 'endpoint', info: 'Index document' },
  { label: 'PUT /{index}/_doc/{id}', type: 'endpoint', info: 'Index document with ID' },
  { label: 'GET /{index}/_doc/{id}', type: 'endpoint', info: 'Get document' },
  { label: 'DELETE /{index}/_doc/{id}', type: 'endpoint', info: 'Delete document' },
  { label: 'POST /{index}/_update/{id}', type: 'endpoint', info: 'Update document' },
  { label: 'POST /_bulk', type: 'endpoint', info: 'Bulk operations' },
];

// Elasticsearch query DSL keywords
const queryKeywords = [
  { label: 'match_all', type: 'query', info: 'Match all documents' },
  { label: 'match', type: 'query', info: 'Full-text search' },
  { label: 'term', type: 'query', info: 'Exact term match' },
  { label: 'terms', type: 'query', info: 'Match any of the terms' },
  { label: 'range', type: 'query', info: 'Range query' },
  { label: 'bool', type: 'query', info: 'Boolean query' },
  { label: 'must', type: 'clause', info: 'Must match (AND)' },
  { label: 'should', type: 'clause', info: 'Should match (OR)' },
  { label: 'must_not', type: 'clause', info: 'Must not match (NOT)' },
  { label: 'filter', type: 'clause', info: 'Filter clause' },
  { label: 'wildcard', type: 'query', info: 'Wildcard query' },
  { label: 'exists', type: 'query', info: 'Field exists query' },
  { label: 'prefix', type: 'query', info: 'Prefix query' },
  { label: 'regexp', type: 'query', info: 'Regexp query' },
  { label: 'fuzzy', type: 'query', info: 'Fuzzy query' },
  { label: 'multi_match', type: 'query', info: 'Multi-field match' },
  { label: 'match_phrase', type: 'query', info: 'Phrase match' },
  { label: 'nested', type: 'query', info: 'Nested query' },
  { label: 'geo_distance', type: 'query', info: 'Geo distance query' },
  { label: 'script', type: 'query', info: 'Script query' },
];

// JSON structure helpers
const jsonHelpers = [
  { label: 'query', type: 'property', info: 'Query object' },
  { label: 'aggs', type: 'property', info: 'Aggregations' },
  { label: 'sort', type: 'property', info: 'Sort order' },
  { label: 'from', type: 'property', info: 'From offset' },
  { label: 'size', type: 'property', info: 'Result size' },
  { label: '_source', type: 'property', info: 'Source filtering' },
  { label: 'highlight', type: 'property', info: 'Highlighting' },
  { label: 'min_score', type: 'property', info: 'Minimum score' },
];

// Combine all completions
const allCompletions = [
  ...elasticsearchEndpoints,
  ...queryKeywords,
  ...jsonHelpers,
];

// Custom autocomplete function
function elasticsearchAutocomplete(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\w*/);
  
  // If no word and not explicit trigger, don't show completions
  if (!word && !context.explicit) {
    return null;
  }

  // If word exists but is empty and not explicit, don't show
  if (word && word.from === word.to && !context.explicit) {
    return null;
  }

  const query = word?.text.toLowerCase() || '';
  const filtered = allCompletions.filter(item =>
    item.label.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    return null;
  }

  return {
    from: word?.from ?? context.pos,
    options: filtered.map(item => ({
      label: item.label,
      type: item.type,
      info: item.info,
    })),
  };
}

export function ElasticsearchQueryEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  className = '',
}: ElasticsearchQueryEditorProps) {
  // Custom extensions for Elasticsearch
  const extensions = [
    json(),
    autocompletion({
      override: [elasticsearchAutocomplete],
      activateOnTyping: true,
      maxRenderedOptions: 20,
    }),
    EditorView.theme({
      '&': {
        fontSize: '14px',
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
      },
      '.cm-content': {
        padding: '12px',
        minHeight: '200px',
      },
      '.cm-editor': {
        borderRadius: '6px',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-scroller': {
        overflow: 'auto',
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.focusChanged && !update.view.hasFocus && onBlur) {
        onBlur();
      }
    }),
  ];

  return (
    <div className={`relative ${className}`}>
      <CodeMirror
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        extensions={extensions}
        theme={oneDark}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightSelectionMatches: true,
          tabSize: 2,
        }}
        className={`${error ? 'border-destructive' : ''} rounded-md border`}
        style={{
          borderColor: error ? 'rgb(239 68 68)' : undefined,
        }}
      />
      {error && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 text-sm text-destructive bg-background/95 p-2 rounded border border-destructive">
          <span className="text-xs">⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
