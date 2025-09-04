/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as _utils_auth from "../_utils/auth.js";
import type * as http from "../http.js";
import type * as projectMembers from "../projectMembers.js";
import type * as projects from "../projects.js";
import type * as users from "../users.js";
import type * as workos from "../workos.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "_utils/auth": typeof _utils_auth;
  http: typeof http;
  projectMembers: typeof projectMembers;
  projects: typeof projects;
  users: typeof users;
  workos: typeof workos;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
