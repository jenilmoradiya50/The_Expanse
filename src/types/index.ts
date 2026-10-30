/**
 * Core Application Type Definitions for The Expanse
 */

export interface AppMetadata {
  name: string;
  version: string;
  environment: "development" | "test" | "production";
}
