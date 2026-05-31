import type { Request, Response, NextFunction } from 'express';

export interface AuditEntry {
  timestamp:  string;
  userId:     string | null;
  action:     string;
  resource:   string;
  resourceId: string | null;
  ip:         string;
  userAgent:  string;
  status:     number;
}

// Critical actions that always get logged
const AUDITED_PATTERNS: { method: string; pattern: RegExp; action: string }[] = [
  { method: 'POST',   pattern: /^\/auth\//,               action: 'auth'                   },
  { method: 'POST',   pattern: /^\/content\/generate$/,   action: 'content.generate'       },
  { method: 'POST',   pattern: /^\/schedule$/,            action: 'schedule.confirm'        },
  { method: 'POST',   pattern: /^\/integrations\//,       action: 'integration.connect'     },
  { method: 'POST',   pattern: /^\/rewards\/lootbox/,     action: 'rewards.lootbox'         },
  { method: 'POST',   pattern: /^\/organizations/,        action: 'organizations.create'    },
  { method: 'PUT',    pattern: /^\/admin\//,              action: 'admin.update'            },
  { method: 'PATCH',  pattern: /^\/admin\//,              action: 'admin.update'            },
  { method: 'DELETE', pattern: /.*/,                      action: 'resource.delete'         },
];

/**
 * Middleware that logs critical actions after the response is sent.
 * Attach after route handlers on endpoints that need auditing.
 */
export const auditLog = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const matched = AUDITED_PATTERNS.find(
    p => p.method === req.method && p.pattern.test(req.path),
  );

  if (!matched) {
    next();
    return;
  }

  res.on('finish', () => {
    const entry: AuditEntry = {
      timestamp:  new Date().toISOString(),
      userId:     req.user?.id ?? null,
      action:     matched.action,
      resource:   req.path,
      resourceId: extractResourceId(req.path),
      ip:         req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent:  req.headers['user-agent'] ?? 'unknown',
      status:     res.statusCode,
    };

    // Write to audit_logs table or structured log output
    // TODO: replace with DB insert:
    // await db.insert('audit_logs', entry);
    console.log('[AUDIT]', JSON.stringify(entry));
  });

  next();
};

function extractResourceId(path: string): string | null {
  const match = path.match(/\/([a-f0-9-]{8,})(?:\/|$)/i);
  return match ? match[1] : null;
}
