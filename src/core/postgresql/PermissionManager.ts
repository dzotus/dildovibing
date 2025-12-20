/**
 * Permission Manager for PostgreSQL
 * Manages roles and permissions for database access control
 */

export interface Role {
  name: string;
  login: boolean;
  superuser: boolean;
  permissions?: Permission[];
}

export interface Permission {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  schema?: string;
  table?: string;
  granted: boolean;
}

export interface UserContext {
  role: string;
  username: string;
  permissions: Permission[];
}

/**
 * Permission Manager
 * Manages database roles and permissions
 */
export class PostgreSQLPermissionManager {
  private roles: Map<string, Role> = new Map();
  private defaultRole: Role;

  constructor() {
    // Initialize default roles
    this.defaultRole = {
      name: 'postgres',
      login: true,
      superuser: true,
      permissions: [{ type: 'ALL', granted: true }],
    };
    this.roles.set('postgres', this.defaultRole);

    // Default app_user role
    this.roles.set('app_user', {
      name: 'app_user',
      login: true,
      superuser: false,
      permissions: [
        { type: 'SELECT', granted: true },
        { type: 'INSERT', granted: true },
        { type: 'UPDATE', granted: true },
        { type: 'DELETE', granted: false },
      ],
    });

    // Default readonly role
    this.roles.set('readonly', {
      name: 'readonly',
      login: true,
      superuser: false,
      permissions: [{ type: 'SELECT', granted: true }],
    });
  }

  /**
   * Add or update a role
   */
  addRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  /**
   * Get role by name
   */
  getRole(roleName: string): Role | undefined {
    return this.roles.get(roleName);
  }

  /**
   * Check if user has permission for operation
   */
  hasPermission(
    userContext: UserContext,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    schema?: string,
    table?: string
  ): { allowed: boolean; reason?: string } {
    const role = this.roles.get(userContext.role);
    if (!role) {
      return { allowed: false, reason: `Role "${userContext.role}" not found` };
    }

    // Superuser has all permissions
    if (role.superuser) {
      return { allowed: true };
    }

    // Check role permissions
    const rolePermissions = role.permissions || [];
    for (const perm of rolePermissions) {
      if (perm.type === 'ALL' && perm.granted) {
        return { allowed: true };
      }
      if (perm.type === operation && perm.granted) {
        // Check schema/table match if specified
        if (perm.schema && schema && perm.schema !== schema) {
          continue;
        }
        if (perm.table && table && perm.table !== table) {
          continue;
        }
        return { allowed: true };
      }
    }

    // Check user-specific permissions
    for (const perm of userContext.permissions) {
      if (perm.type === 'ALL' && perm.granted) {
        return { allowed: true };
      }
      if (perm.type === operation && perm.granted) {
        if (perm.schema && schema && perm.schema !== schema) {
          continue;
        }
        if (perm.table && table && perm.table !== table) {
          continue;
        }
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `Permission denied: ${operation} on ${schema || 'public'}.${table || '*'}`,
    };
  }

  /**
   * Grant permission to role
   */
  grantPermission(
    roleName: string,
    permission: Permission
  ): { success: boolean; error?: string } {
    const role = this.roles.get(roleName);
    if (!role) {
      return { success: false, error: `Role "${roleName}" not found` };
    }

    if (!role.permissions) {
      role.permissions = [];
    }

    // Check if permission already exists
    const existing = role.permissions.find(
      (p) =>
        p.type === permission.type &&
        p.schema === permission.schema &&
        p.table === permission.table
    );

    if (existing) {
      existing.granted = permission.granted;
    } else {
      role.permissions.push(permission);
    }

    return { success: true };
  }

  /**
   * Revoke permission from role
   */
  revokePermission(
    roleName: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL',
    schema?: string,
    table?: string
  ): { success: boolean; error?: string } {
    const role = this.roles.get(roleName);
    if (!role) {
      return { success: false, error: `Role "${roleName}" not found` };
    }

    if (!role.permissions) {
      return { success: true }; // No permissions to revoke
    }

    role.permissions = role.permissions.filter(
      (p) =>
        !(
          p.type === operation &&
          p.schema === schema &&
          p.table === table
        )
    );

    return { success: true };
  }

  /**
   * Get all roles
   */
  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Create user context from role name
   */
  createUserContext(roleName: string, username?: string): UserContext | null {
    const role = this.roles.get(roleName);
    if (!role) {
      return null;
    }

    return {
      role: roleName,
      username: username || roleName,
      permissions: role.permissions || [],
    };
  }
}

