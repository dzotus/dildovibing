/**
 * Signature Parser for IDS/IPS
 * Supports Snort rules format and regex patterns
 */

export interface ParsedSnortRule {
  action: 'alert' | 'log' | 'pass' | 'activate' | 'dynamic' | 'drop' | 'reject' | 'sdrop';
  protocol: 'tcp' | 'udp' | 'icmp' | 'ip' | 'all';
  sourceIP: string; // IP or CIDR or 'any'
  sourcePort: string; // Port or 'any' or range like '1024:65535'
  direction: '->' | '<>' | '<-';
  destinationIP: string; // IP or CIDR or 'any'
  destinationPort: string; // Port or 'any' or range
  options: {
    msg?: string;
    sid?: number;
    rev?: number;
    content?: string;
    flags?: string;
    threshold?: string;
    classtype?: string;
    priority?: number;
    [key: string]: string | number | undefined;
  };
  raw: string; // Original rule string
}

export interface SignatureValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed?: ParsedSnortRule;
}

/**
 * Parse Snort rule format
 * Format: action protocol source port direction destination port (options)
 * Example: alert tcp any any -> any 22 (msg:"SSH connection"; sid:1000001;)
 */
export function parseSnortRule(rule: string): SignatureValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Trim and validate
  const trimmed = rule.trim();
  if (!trimmed) {
    return {
      valid: false,
      errors: ['Empty rule'],
      warnings: [],
    };
  }

  // Check if it looks like a Snort rule (has parentheses with options)
  const hasOptions = trimmed.includes('(') && trimmed.includes(')');
  const isSnortFormat = hasOptions && /^(alert|log|pass|activate|dynamic|drop|reject|sdrop)\s+(tcp|udp|icmp|ip)\s+/i.test(trimmed);

  if (!isSnortFormat) {
    // Not a Snort rule, might be a regex pattern
    return {
      valid: true,
      errors: [],
      warnings: ['Not a Snort rule format, treating as regex pattern'],
      parsed: undefined,
    };
  }

  try {
    // Extract action
    const actionMatch = trimmed.match(/^(alert|log|pass|activate|dynamic|drop|reject|sdrop)\s+/i);
    if (!actionMatch) {
      errors.push('Invalid action. Must be one of: alert, log, pass, activate, dynamic, drop, reject, sdrop');
      return { valid: false, errors, warnings };
    }
    const action = actionMatch[1].toLowerCase() as ParsedSnortRule['action'];

    // Extract protocol
    const protocolMatch = trimmed.match(/^(?:alert|log|pass|activate|dynamic|drop|reject|sdrop)\s+(tcp|udp|icmp|ip)\s+/i);
    if (!protocolMatch) {
      errors.push('Invalid protocol. Must be one of: tcp, udp, icmp, ip');
      return { valid: false, errors, warnings };
    }
    const protocol = protocolMatch[1].toLowerCase() as ParsedSnortRule['protocol'];

    // Extract source IP and port
    const sourceMatch = trimmed.match(/^(?:alert|log|pass|activate|dynamic|drop|reject|sdrop)\s+(?:tcp|udp|icmp|ip)\s+([^\s]+)\s+([^\s]+)\s+/i);
    if (!sourceMatch) {
      errors.push('Invalid source IP or port format');
      return { valid: false, errors, warnings };
    }
    const sourceIP = sourceMatch[1];
    const sourcePort = sourceMatch[2];

    // Extract direction
    const directionMatch = trimmed.match(/\s+(->|<>|<-)\s+/);
    if (!directionMatch) {
      errors.push('Invalid direction. Must be one of: ->, <>, <-');
      return { valid: false, errors, warnings };
    }
    const direction = directionMatch[1] as ParsedSnortRule['direction'];

    // Extract destination IP and port
    const destMatch = trimmed.match(/\s+(->|<>|<-)\s+([^\s]+)\s+([^\s]+)\s*\(/);
    if (!destMatch) {
      errors.push('Invalid destination IP or port format');
      return { valid: false, errors, warnings };
    }
    const destinationIP = destMatch[2];
    const destinationPort = destMatch[3];

    // Extract options (everything between parentheses)
    const optionsMatch = trimmed.match(/\(([^)]+)\)/);
    const options: ParsedSnortRule['options'] = {};
    
    if (optionsMatch) {
      const optionsStr = optionsMatch[1];
      
      // Parse options (key:value or key:"value" pairs separated by semicolons)
      const optionPairs = optionsStr.split(';').map(s => s.trim()).filter(s => s);
      
      for (const pair of optionPairs) {
        const colonIndex = pair.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = pair.substring(0, colonIndex).trim();
        let value = pair.substring(colonIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Parse numeric values
        if (key === 'sid' || key === 'rev' || key === 'priority') {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) {
            options[key] = numValue;
          } else {
            warnings.push(`Invalid numeric value for ${key}: ${value}`);
          }
        } else {
          options[key] = value;
        }
      }
    }

    // Validate IP addresses and CIDR
    if (sourceIP !== 'any' && !isValidIPOrCIDR(sourceIP)) {
      errors.push(`Invalid source IP or CIDR: ${sourceIP}`);
    }
    if (destinationIP !== 'any' && !isValidIPOrCIDR(destinationIP)) {
      errors.push(`Invalid destination IP or CIDR: ${destinationIP}`);
    }

    // Validate ports
    if (sourcePort !== 'any' && !isValidPort(sourcePort)) {
      errors.push(`Invalid source port: ${sourcePort}`);
    }
    if (destinationPort !== 'any' && !isValidPort(destinationPort)) {
      errors.push(`Invalid destination port: ${destinationPort}`);
    }

    // Validate required options
    if (!options.msg && !options.content) {
      warnings.push('Rule has no msg or content option - may not be useful');
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    const parsed: ParsedSnortRule = {
      action,
      protocol,
      sourceIP,
      sourcePort,
      direction,
      destinationIP,
      destinationPort,
      options,
      raw: trimmed,
    };

    return { valid: true, errors: [], warnings, parsed };
  } catch (error) {
    return {
      valid: false,
      errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
    };
  }
}

/**
 * Validate regex pattern
 */
export function validateRegexPattern(pattern: string): SignatureValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!pattern || pattern.trim().length === 0) {
    return {
      valid: false,
      errors: ['Empty pattern'],
      warnings: [],
    };
  }

  try {
    // Try to create regex
    const regex = new RegExp(pattern);
    
    // Check for potentially dangerous patterns (very broad patterns)
    if (pattern.length < 3) {
      warnings.push('Pattern is very short and may match too many things');
    }
    
    // Check for common issues
    if (pattern === '.*' || pattern === '.+') {
      warnings.push('Pattern matches everything - may cause performance issues');
    }

    return { valid: true, errors: [], warnings };
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
    };
  }
}

/**
 * Validate signature pattern (can be Snort rule or regex)
 */
export function validateSignaturePattern(pattern: string): SignatureValidationResult {
  if (!pattern || pattern.trim().length === 0) {
    return {
      valid: false,
      errors: ['Empty pattern'],
      warnings: [],
    };
  }

  // Try to parse as Snort rule first
  const snortResult = parseSnortRule(pattern);
  if (snortResult.valid && snortResult.parsed) {
    return snortResult;
  }

  // If not a Snort rule, validate as regex
  return validateRegexPattern(pattern);
}

/**
 * Check if string is valid IP address or CIDR
 */
function isValidIPOrCIDR(ip: string): boolean {
  // Check for CIDR notation
  if (ip.includes('/')) {
    const [network, prefixStr] = ip.split('/');
    const prefix = parseInt(prefixStr, 10);
    
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }
    
    return isValidIP(network);
  }
  
  return isValidIP(ip);
}

/**
 * Check if string is valid IPv4 address
 */
function isValidIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return false;
  }
  
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if string is valid port or port range
 */
function isValidPort(port: string): boolean {
  if (port === 'any') {
    return true;
  }
  
  // Check for port range (e.g., "1024:65535")
  if (port.includes(':')) {
    const [start, end] = port.split(':').map(p => parseInt(p, 10));
    if (isNaN(start) || isNaN(end) || start < 0 || start > 65535 || end < 0 || end > 65535 || start > end) {
      return false;
    }
    return true;
  }
  
  // Single port
  const portNum = parseInt(port, 10);
  return !isNaN(portNum) && portNum >= 0 && portNum <= 65535;
}

/**
 * Convert parsed Snort rule to internal signature format
 */
export function convertSnortRuleToSignature(
  parsed: ParsedSnortRule,
  id: string,
  name: string,
  description: string,
  severity: 'critical' | 'high' | 'medium' | 'low',
  enabled: boolean = true
): {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: string;
  action: 'alert' | 'block' | 'log';
  protocol?: 'tcp' | 'udp' | 'icmp' | 'all';
  sourceIP?: string;
  destinationIP?: string;
  port?: number;
  sourcePort?: number;
} {
  // Convert action
  let action: 'alert' | 'block' | 'log' = 'alert';
  if (parsed.action === 'drop' || parsed.action === 'reject' || parsed.action === 'sdrop') {
    action = 'block';
  } else if (parsed.action === 'log') {
    action = 'log';
  }

  // Extract port from destination port (if it's a single port, not a range)
  let port: number | undefined;
  if (parsed.destinationPort !== 'any' && !parsed.destinationPort.includes(':')) {
    const portNum = parseInt(parsed.destinationPort, 10);
    if (!isNaN(portNum)) {
      port = portNum;
    }
  }

  // Extract source port
  let sourcePort: number | undefined;
  if (parsed.sourcePort !== 'any' && !parsed.sourcePort.includes(':')) {
    const portNum = parseInt(parsed.sourcePort, 10);
    if (!isNaN(portNum)) {
      sourcePort = portNum;
    }
  }

  // Use content option as pattern if available
  const pattern = parsed.options.content || parsed.options.msg || '';

  return {
    id,
    name,
    description: description || parsed.options.msg || '',
    enabled,
    severity,
    pattern,
    action,
    protocol: parsed.protocol === 'all' ? 'all' : parsed.protocol,
    sourceIP: parsed.sourceIP !== 'any' ? parsed.sourceIP : undefined,
    destinationIP: parsed.destinationIP !== 'any' ? parsed.destinationIP : undefined,
    port,
    sourcePort,
  };
}
