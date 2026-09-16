// Shared test doubles for the serverless handlers.
//
// The api/*.js files follow Vercel's convention — `handler(req, res)` with a
// Node-ish response object — so they can be called directly in a test with a
// small fake. This keeps the tests fast (no HTTP server, no network) while
// still exercising the real handler code, including the validation branches.
//
// This matters because server-dev.js has its own routing: without these tests
// the api/ handlers would never be executed by the dev-server suite.

/** Minimal request double. `body` stands in for Vercel's parsed JSON body. */
export function makeReq({ method = 'GET', url = '/', body, headers = {} } = {}) {
  return { method, url, body, headers };
}

/** Minimal response double that records what the handler did. */
export function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined,
    headers: {},
    jsonPayload: undefined,
    ended: false,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.jsonPayload = payload;
      res.body = payload;
      return res;
    },
    setHeader(name, value) {
      res.headers[name] = value;
    },
    writeHead(code, extraHeaders) {
      res.statusCode = code;
      if (extraHeaders) Object.assign(res.headers, extraHeaders);
      return res;
    },
    write(chunk) {
      (res.chunks ||= []).push(chunk);
      return true;
    },
    end(chunk) {
      if (chunk) (res.chunks ||= []).push(chunk);
      res.ended = true;
      return res;
    }
  };
  return res;
}

/** Invokes a handler with doubles and resolves once it has finished. */
export async function callHandler(handler, { method = 'GET', url = '/', body, headers } = {}) {
  const req = makeReq({ method, url, body, headers });
  const res = makeRes();
  await handler(req, res);
  return res;
}

/** True when the integration tests have the credentials they need. */
export const hasDbCredentials = Boolean(
  process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
);

/** Unique-enough throwaway username, so tests never touch real diary data. */
export function testUsername(label = 'test') {
  return `__${label}_${process.pid}_${Date.now().toString(36)}`;
}