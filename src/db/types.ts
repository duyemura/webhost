import type { Generated, Insertable, Selectable, Updateable } from "kysely";

export interface Database {
  users: UsersTable;
  sites: SitesTable;
  scripts: ScriptsTable;
  business_profiles: BusinessProfilesTable;
}

export interface UsersTable {
  id: Generated<string>;
  email: string;
  google_id: string | null;
  name: string;
  created_at: Generated<Date>;
}

export interface SitesTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  domain_status: Generated<string>;
  cloudflare_hostname_id: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  published_at: Date | null;
  live_published_at: Date | null;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type Site = Selectable<SitesTable>;
export type NewSite = Insertable<SitesTable>;
export type SiteUpdate = Updateable<SitesTable>;

export interface ScriptsTable {
  id: Generated<string>;
  site_id: string;
  type: string;
  label: string;
  tracking_id: string | null;
  code: string | null;
  enabled: Generated<boolean>;
  created_at: Generated<Date>;
}

export type Script = Selectable<ScriptsTable>;
export type NewScript = Insertable<ScriptsTable>;
export type ScriptUpdate = Updateable<ScriptsTable>;

export interface BusinessProfilesTable {
  id: Generated<string>;
  site_id: string;
  biz_name: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: Generated<string>;
  website_url: string | null;
  hours: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type BusinessProfile = Selectable<BusinessProfilesTable>;
export type NewBusinessProfile = Insertable<BusinessProfilesTable>;
export type BusinessProfileUpdate = Updateable<BusinessProfilesTable>;
