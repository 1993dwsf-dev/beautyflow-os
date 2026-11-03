/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments from "../appointments.js";
import type * as auth from "../auth.js";
import type * as clients from "../clients.js";
import type * as commissions from "../commissions.js";
import type * as crm from "../crm.js";
import type * as demo from "../demo.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as invoices from "../invoices.js";
import type * as lib_booking from "../lib/booking.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_scheduling from "../lib/scheduling.js";
import type * as lib_tenant from "../lib/tenant.js";
import type * as orgs from "../orgs.js";
import type * as payments from "../payments.js";
import type * as publicApi from "../publicApi.js";
import type * as reports from "../reports.js";
import type * as retention from "../retention.js";
import type * as services from "../services.js";
import type * as staff from "../staff.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appointments: typeof appointments;
  auth: typeof auth;
  clients: typeof clients;
  commissions: typeof commissions;
  crm: typeof crm;
  demo: typeof demo;
  http: typeof http;
  inventory: typeof inventory;
  invoices: typeof invoices;
  "lib/booking": typeof lib_booking;
  "lib/helpers": typeof lib_helpers;
  "lib/permissions": typeof lib_permissions;
  "lib/scheduling": typeof lib_scheduling;
  "lib/tenant": typeof lib_tenant;
  orgs: typeof orgs;
  payments: typeof payments;
  publicApi: typeof publicApi;
  reports: typeof reports;
  retention: typeof retention;
  services: typeof services;
  staff: typeof staff;
  users: typeof users;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
