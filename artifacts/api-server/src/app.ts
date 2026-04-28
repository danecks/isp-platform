import express, { type Express, type Request } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { permisosMiddleware } from "./lib/permisos-middleware";

const app: Express = express();

// Detrás del proxy de Replit (mTLS) — necesario para que rate-limit y req.ip
// vean la IP real del cliente.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Helmet — cabeceras de seguridad estándar ────────────────────────────────
// Configurado para permitir embebido en iframe (preview de Replit) y sin CSP
// agresivo que pueda romper el frontend existente.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    frameguard: false,
  }),
);

// ── CORS — origenes permitidos ─────────────────────────────────────────────
// Permite el mismo origen (sin Origin header), dominios de Replit (.replit.dev,
// .replit.app, .riker.replit.dev, replit.com), el dominio corporativo
// https://ispsa.net (y www) y los listados en ALLOWED_ORIGINS (separados
// por coma).
const extraOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Dominios corporativos siempre permitidos (independiente de ENV).
const CORPORATE_ORIGINS = [
  "https://ispsa.net",
  "https://www.ispsa.net",
];

const REPLIT_HOST_RE = /^https?:\/\/([a-z0-9-]+\.)*replit\.(dev|app|com)$/i;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (REPLIT_HOST_RE.test(origin)) return callback(null, true);
      if (CORPORATE_ORIGINS.includes(origin)) return callback(null, true);
      if (extraOrigins.includes(origin)) return callback(null, true);
      logger.warn({ origin }, "CORS bloqueado: origen no permitido");
      return callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Rate limiting ──────────────────────────────────────────────────────────
// Limit global suave: protege contra DoS / scraping masivo sin afectar el uso
// normal del Pizarrón Operativo (que dispara muchos polls).
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  limit: 600, // 600 req/min/IP — alto para no romper polling actual
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes — reintente en un momento" },
});

// Limit estricto para login: previene fuerza bruta de contraseñas.
// Cuenta por IP + username para que un atacante con muchas IPs siga limitado
// por usuario, y un usuario detrás de NAT no bloquee a otros.
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  limit: 10, // 10 intentos cada 5 min
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const username = String((req.body?.username ?? "")).toLowerCase().trim();
    return `${ipKeyGenerator(req.ip ?? "")}::${username}`;
  },
  message: { error: "Demasiados intentos de inicio de sesión. Espere 5 minutos." },
});

app.use("/api", generalLimiter);
app.use("/api/auth/login", loginLimiter);

app.use("/api", permisosMiddleware as any);
app.use("/api", router);

export default app;
