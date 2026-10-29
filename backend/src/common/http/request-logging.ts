import { randomUUID } from 'node:crypto';
import { stdSerializers, type Logger } from 'pino';
import { pinoHttp } from 'pino-http';

const REQUEST_ID_PATTERN = /^[\w.-]{1,128}$/;

// The share token is a bearer capability and sits in the path of the public read, so it must not
// reach the logs through the logged URL (AB-1008).
const SHARE_TOKEN_IN_PATH = /(\/public\/shares\/)[^/?#]+/;
export const redactUrl = (url: string): string => url.replace(SHARE_TOKEN_IN_PATH, '$1[redacted]');

export const createRequestLogger = (logger: Logger) =>
  pinoHttp({
    logger,
    serializers: {
      req: stdSerializers.wrapRequestSerializer((req) => ({ ...req, url: redactUrl(req.url) })),
    },
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
