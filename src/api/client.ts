// The one client of api the screens call (R18): connect-es over Connect, the wire binary protobuf,
// each call with api's own limit of 30 s, behind the interceptors of the contract's rules. The four
// open views of a package and the legal texts go by a transport of their own, Connect GET with no
// token, no deadline and no header, so that a request is simple, needs no preflight and an HTTP
// cache may keep its answer (R18, R27). A call that does not answer throws an ApiError that says
// what it came to. No DOM beyond fetch.
import { AccountService } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { AttemptService } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { DebugService } from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { LearningService } from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { LegalService } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { ModuleService } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import { PaperService } from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
import { ProgressService } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { WorkService } from "@altnovatrail/contracts/novatrail/api/v1/work_pb.js";
import type { DescService } from "@bufbuild/protobuf";
import {
  type Client,
  Code,
  ConnectError,
  createClient,
  type Interceptor,
  type Transport,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ApiError, parseFailure } from "./failure.ts";
import { type ApiEvents, effects, repeat, signIn } from "./interceptors.ts";
import type { Tokens } from "./tokens.ts";

/** api's own limit of a request (R33 api): no call of app waits longer. */
export const TIMEOUT_MS = 30_000;

export interface ApiOptions {
  /** The origin of api, from /deployment.json. */
  readonly baseUrl: string;
  readonly tokens: Tokens;
  readonly on: ApiEvents;
  readonly fetch?: typeof globalThis.fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  /** A transport in place of the browser's, made with the interceptors: the tests' router. */
  readonly transport?: (interceptors: Interceptor[], method: "POST" | "GET") => Transport;
}

export interface Api {
  readonly account: Client<typeof AccountService>;
  readonly attempt: Client<typeof AttemptService>;
  readonly learning: Client<typeof LearningService>;
  readonly module: Client<typeof ModuleService>;
  /** `CheckPackages`, with the token. */
  readonly package: Client<typeof PackageService>;
  /** The four open views, by Connect GET with no token: `GetManifest` and the others. */
  readonly views: Client<typeof PackageService>;
  readonly progress: Client<typeof ProgressService>;
  /** A task from paper: `FindTasks` and `BeginPaperAttempts` (R71). */
  readonly paper: Client<typeof PaperService>;
  /** `GetLegalTexts`, by Connect GET with no token, as the open views, but past the HTTP cache. */
  readonly legal: Client<typeof LegalService>;
  /** The works kept on the server: `PutWork` (R30). */
  readonly work: Client<typeof WorkService>;
  /**
   * The debug mode of a local run, in a build of the development server alone: a release's build
   * replaces import.meta.env.DEV with false, and the service drops out of it (R72).
   */
  readonly debug?: Client<typeof DebugService>;
}

/** fetch whose failure is the network's: `unavailable`, which the client repeats. */
function networked(fetcher: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input, init) => {
    try {
      return await fetcher(input, init);
    } catch (reason) {
      // An abort — the call's deadline or its caller — is no failure of the network.
      if (init?.signal?.aborted === true || reason instanceof ConnectError) throw reason;
      if (reason instanceof DOMException && reason.name === "AbortError") throw reason;
      throw new ConnectError("the network failed", Code.Unavailable, undefined, undefined, reason);
    }
  };
}

/**
 * A client whose every method throws an ApiError in place of an error of Connect. Each method is
 * made once, so that it is the same function at every reading.
 */
function guarded<S extends DescService>(client: Client<S>): Client<S> {
  const made = new Map<PropertyKey, unknown>();
  return new Proxy(client, {
    get(target, name, receiver) {
      const method: unknown = Reflect.get(target, name, receiver);
      if (typeof method !== "function") return method;
      if (!made.has(name)) {
        // Every method of the contract is unary: its call is a promise.
        const call = method as (...args: unknown[]) => Promise<unknown>;
        made.set(name, async (...args: unknown[]) => {
          try {
            return await call.apply(target, args);
          } catch (reason) {
            throw new ApiError(parseFailure(reason), reason);
          }
        });
      }
      return made.get(name);
    },
  });
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createApi(options: ApiOptions): Api {
  const sleep = options.sleep ?? wait;
  const fetcher = networked(options.fetch ?? globalThis.fetch.bind(globalThis));
  const interceptors = [effects(options.on), signIn(options.tokens), repeat(sleep)];
  const transport =
    options.transport?.(interceptors, "POST") ??
    createConnectTransport({
      baseUrl: options.baseUrl,
      useBinaryFormat: true,
      defaultTimeoutMs: TIMEOUT_MS,
      fetch: fetcher,
      interceptors,
    });
  // No sign-in and no deadline: Connect-Timeout-Ms would make the request one with a preflight.
  const open = [effects(options.on), repeat(sleep)];
  const viewsTransport =
    options.transport?.(open, "GET") ??
    createConnectTransport({
      baseUrl: options.baseUrl,
      useBinaryFormat: true,
      useHttpGet: true,
      fetch: fetcher,
      interceptors: open,
    });
  // The legal texts the same way, but past the HTTP cache: a consent names the version shown, and
  // a version that came out of a cache after a newer came into force api refuses (R27).
  const legalTransport =
    options.transport?.(open, "GET") ??
    createConnectTransport({
      baseUrl: options.baseUrl,
      useBinaryFormat: true,
      useHttpGet: true,
      fetch: (input, init) => fetcher(input, { ...init, cache: "no-cache" }),
      interceptors: open,
    });
  const client = <S extends DescService>(service: S) => guarded(createClient(service, transport));
  return {
    account: client(AccountService),
    attempt: client(AttemptService),
    learning: client(LearningService),
    module: client(ModuleService),
    package: client(PackageService),
    views: guarded(createClient(PackageService, viewsTransport)),
    progress: client(ProgressService),
    paper: client(PaperService),
    legal: guarded(createClient(LegalService, legalTransport)),
    work: client(WorkService),
    ...(import.meta.env.DEV ? { debug: client(DebugService) } : {}),
  };
}
