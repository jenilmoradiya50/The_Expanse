/**
 * Core Application Type Definitions for The Expanse
 */

export * from "./database";

export interface AppMetadata {
  name: string;
  version: string;
  environment: "development" | "test" | "production";
}
