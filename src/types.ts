/**
 * Types mirroring schema/profile.schema.json.
 * Keep these two files in sync manually; Slice 1 has no schema->type codegen.
 */

export const SCHEMA_VERSION = "1.0.0" as const;

export interface Metric {
  id: string;
  label: string;
  value: string;
}

export interface Achievement {
  id: string;
  bulletPoint: string;
  metrics: Metric[];
}

export interface Role {
  id: string;
  title: string;
  organization: string;
  /** YYYY-MM */
  startDate: string;
  /** YYYY-MM, or null if the role is current/ongoing. */
  endDate: string | null;
  achievements: Achievement[];
}

export interface Skill {
  id: string;
  name: string;
  category: string;
}

export interface MasterProfile {
  schemaVersion: typeof SCHEMA_VERSION;
  profileId: string;
  roles: Role[];
  skills: Skill[];
}
