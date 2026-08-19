import { pgTable, varchar, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id'),
  name: varchar('name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  isPlatform: boolean('is_platform').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  resource: varchar('resource', { length: 50 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id').notNull(),
  permissionId: uuid('permission_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const membershipRoles = pgTable('membership_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  membershipId: uuid('membership_id').notNull(),
  roleId: uuid('role_id').notNull(),
  grantedBy: uuid('granted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
