import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROUTES_DIR = path.resolve(__dirname, '../routes');

function read(name: string): string {
  return fs.readFileSync(path.join(ROUTES_DIR, name), 'utf-8');
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertRoute(source: string, method: string, pattern: string) {
  const regex = new RegExp(
    `\\.${method.toLowerCase()}\\s*\\(\\s*['"\`/]${escapeRegex(pattern)}`,
    'i',
  );
  expect(source).toMatch(regex);
}

function extractRouteBlock(source: string, method: string, pattern: string): string {
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = method.toLowerCase();
  const startRegex = new RegExp(
    `(?:^|\\n)\\s*\\w+Routes\\.${m}\\s*\\(\\s*['"\`/]${escapedPattern}`,
    'i',
  );
  const match = source.match(startRegex);
  if (match) {
    const startIdx = source.indexOf(match[0]);
    let braceDepth = 0;
    let endIdx = startIdx;
    let foundFirstBrace = false;
    for (let i = startIdx; i < source.length; i++) {
      if (source[i] === '{') {
        braceDepth++;
        foundFirstBrace = true;
      } else if (source[i] === '}') {
        braceDepth--;
        if (foundFirstBrace && braceDepth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
    return source.substring(startIdx, endIdx);
  }
  return '';
}

function assertPermission(source: string, method: string, pattern: string, permission: string) {
  const routeBlock = extractRouteBlock(source, method, pattern);
  expect(routeBlock).toContain(`requirePermission(PERMISSIONS.${permission})`);
}

function assertSchema(source: string, method: string, pattern: string, schemaName: string) {
  const routeBlock = extractRouteBlock(source, method, pattern);
  expect(routeBlock).toMatch(new RegExp(`${schemaName}\\.parse`));
}

// ─── cases.ts ───────────────────────────────────────────────────────────────

describe('cases.ts route contracts', () => {
  const src = read('cases.ts');

  it('GET / requires CASE_READ', () => {
    assertRoute(src, 'get', '/');
    assertPermission(src, 'get', '/', 'CASE_READ');
  });

  it('POST / requires CASE_CREATE and parses createCaseSchema', () => {
    assertRoute(src, 'post', '/');
    assertPermission(src, 'post', '/', 'CASE_CREATE');
    assertSchema(src, 'post', '/', 'createCaseSchema');
  });

  it('GET /:id requires CASE_READ', () => {
    assertRoute(src, 'get', '/:id');
    assertPermission(src, 'get', '/:id', 'CASE_READ');
  });

  it('PATCH /:id requires CASE_UPDATE and parses updateCaseSchema', () => {
    assertRoute(src, 'patch', '/:id');
    assertPermission(src, 'patch', '/:id', 'CASE_UPDATE');
    assertSchema(src, 'patch', '/:id', 'updateCaseSchema');
  });

  it('POST /:id/assign requires CASE_ASSIGN and parses assignCaseSchema', () => {
    assertRoute(src, 'post', '/:id/assign');
    assertPermission(src, 'post', '/:id/assign', 'CASE_ASSIGN');
    assertSchema(src, 'post', '/:id/assign', 'assignCaseSchema');
  });

  it('POST /:id/reassign requires CASE_REASSIGN and parses reassignCaseSchema', () => {
    assertRoute(src, 'post', '/:id/reassign');
    assertPermission(src, 'post', '/:id/reassign', 'CASE_REASSIGN');
    assertSchema(src, 'post', '/:id/reassign', 'reassignCaseSchema');
  });

  it('POST /:id/escalate requires CASE_ESCALATE', () => {
    assertRoute(src, 'post', '/:id/escalate');
    assertPermission(src, 'post', '/:id/escalate', 'CASE_ESCALATE');
  });

  it('POST /:id/resolve requires CASE_UPDATE and parses resolveCaseSchema', () => {
    assertRoute(src, 'post', '/:id/resolve');
    assertPermission(src, 'post', '/:id/resolve', 'CASE_UPDATE');
    assertSchema(src, 'post', '/:id/resolve', 'resolveCaseSchema');
  });

  it('POST /:id/close requires CASE_CLOSE', () => {
    assertRoute(src, 'post', '/:id/close');
    assertPermission(src, 'post', '/:id/close', 'CASE_CLOSE');
  });

  it('POST /:id/reopen requires CASE_REOPEN', () => {
    assertRoute(src, 'post', '/:id/reopen');
    assertPermission(src, 'post', '/:id/reopen', 'CASE_REOPEN');
  });

  it('GET /:id/timeline requires CASE_READ', () => {
    assertRoute(src, 'get', '/:id/timeline');
    assertPermission(src, 'get', '/:id/timeline', 'CASE_READ');
  });

  it('POST /:id/comments requires CASE_UPDATE', () => {
    assertRoute(src, 'post', '/:id/comments');
    assertPermission(src, 'post', '/:id/comments', 'CASE_UPDATE');
  });
});

// ─── tasks.ts ───────────────────────────────────────────────────────────────

describe('tasks.ts route contracts', () => {
  const src = read('tasks.ts');

  it('GET / requires TASK_READ', () => {
    assertRoute(src, 'get', '/');
    assertPermission(src, 'get', '/', 'TASK_READ');
  });

  it('POST / requires TASK_CREATE and parses createTaskSchema', () => {
    assertRoute(src, 'post', '/');
    assertPermission(src, 'post', '/', 'TASK_CREATE');
    assertSchema(src, 'post', '/', 'createTaskSchema');
  });

  it('GET /:id requires TASK_READ', () => {
    assertRoute(src, 'get', '/:id');
    assertPermission(src, 'get', '/:id', 'TASK_READ');
  });

  it('PATCH /:id requires TASK_UPDATE and parses updateTaskSchema', () => {
    assertRoute(src, 'patch', '/:id');
    assertPermission(src, 'patch', '/:id', 'TASK_UPDATE');
    assertSchema(src, 'patch', '/:id', 'updateTaskSchema');
  });

  it('POST /:id/assign requires TASK_ASSIGN', () => {
    assertRoute(src, 'post', '/:id/assign');
    assertPermission(src, 'post', '/:id/assign', 'TASK_ASSIGN');
  });

  it('POST /:id/start requires TASK_UPDATE', () => {
    assertRoute(src, 'post', '/:id/start');
    assertPermission(src, 'post', '/:id/start', 'TASK_UPDATE');
  });

  it('POST /:id/complete requires TASK_COMPLETE and parses completeTaskSchema', () => {
    assertRoute(src, 'post', '/:id/complete');
    assertPermission(src, 'post', '/:id/complete', 'TASK_COMPLETE');
    assertSchema(src, 'post', '/:id/complete', 'completeTaskSchema');
  });

  it('POST /:id/block requires TASK_UPDATE and parses blockTaskSchema', () => {
    assertRoute(src, 'post', '/:id/block');
    assertPermission(src, 'post', '/:id/block', 'TASK_UPDATE');
    assertSchema(src, 'post', '/:id/block', 'blockTaskSchema');
  });

  it('POST /:id/cancel requires TASK_UPDATE', () => {
    assertRoute(src, 'post', '/:id/cancel');
    assertPermission(src, 'post', '/:id/cancel', 'TASK_UPDATE');
  });
});

// ─── sla.ts ─────────────────────────────────────────────────────────────────

describe('sla.ts route contracts', () => {
  const src = read('sla.ts');

  it('GET / requires CASE_READ', () => {
    assertRoute(src, 'get', '/');
    assertPermission(src, 'get', '/', 'CASE_READ');
  });

  it('POST / requires CASE_UPDATE and parses createSLAPolicySchema', () => {
    assertRoute(src, 'post', '/');
    assertPermission(src, 'post', '/', 'CASE_UPDATE');
    assertSchema(src, 'post', '/', 'createSLAPolicySchema');
  });

  it('GET /:id requires CASE_READ', () => {
    assertRoute(src, 'get', '/:id');
    assertPermission(src, 'get', '/:id', 'CASE_READ');
  });

  it('PATCH /:id requires CASE_UPDATE and parses updateSLAPolicySchema', () => {
    assertRoute(src, 'patch', '/:id');
    assertPermission(src, 'patch', '/:id', 'CASE_UPDATE');
    assertSchema(src, 'patch', '/:id', 'updateSLAPolicySchema');
  });

  it('DELETE /:id requires CASE_UPDATE', () => {
    assertRoute(src, 'delete', '/:id');
    assertPermission(src, 'delete', '/:id', 'CASE_UPDATE');
  });
});

// ─── escalations.ts ─────────────────────────────────────────────────────────

describe('escalations.ts route contracts', () => {
  const src = read('escalations.ts');

  it('GET / requires CASE_READ', () => {
    assertRoute(src, 'get', '/');
    assertPermission(src, 'get', '/', 'CASE_READ');
  });

  it('POST / requires CASE_ESCALATE and parses createEscalationSchema', () => {
    assertRoute(src, 'post', '/');
    assertPermission(src, 'post', '/', 'CASE_ESCALATE');
    assertSchema(src, 'post', '/', 'createEscalationSchema');
  });

  it('GET /:id requires CASE_READ', () => {
    assertRoute(src, 'get', '/:id');
    assertPermission(src, 'get', '/:id', 'CASE_READ');
  });

  it('POST /:id/acknowledge requires CASE_ESCALATE', () => {
    assertRoute(src, 'post', '/:id/acknowledge');
    assertPermission(src, 'post', '/:id/acknowledge', 'CASE_ESCALATE');
  });

  it('POST /:id/resolve requires CASE_ESCALATE', () => {
    assertRoute(src, 'post', '/:id/resolve');
    assertPermission(src, 'post', '/:id/resolve', 'CASE_ESCALATE');
  });

  it('POST /auto-escalate requires CASE_ESCALATE and checks isSuperAdmin', () => {
    assertRoute(src, 'post', '/auto-escalate');
    assertPermission(src, 'post', '/auto-escalate', 'CASE_ESCALATE');
    expect(src).toContain('isSuperAdmin');
  });
});

// ─── workflows.ts ───────────────────────────────────────────────────────────

describe('workflows.ts route contracts', () => {
  const src = read('workflows.ts');

  it('GET / requires CASE_READ', () => {
    assertRoute(src, 'get', '/');
    assertPermission(src, 'get', '/', 'CASE_READ');
  });

  it('POST / requires CASE_UPDATE', () => {
    assertRoute(src, 'post', '/');
    assertPermission(src, 'post', '/', 'CASE_UPDATE');
  });

  it('GET /:id requires CASE_READ', () => {
    assertRoute(src, 'get', '/:id');
    assertPermission(src, 'get', '/:id', 'CASE_READ');
  });

  it('PATCH /:id requires CASE_UPDATE', () => {
    assertRoute(src, 'patch', '/:id');
    assertPermission(src, 'patch', '/:id', 'CASE_UPDATE');
  });

  it('POST /:id/activate requires CASE_UPDATE', () => {
    assertRoute(src, 'post', '/:id/activate');
    assertPermission(src, 'post', '/:id/activate', 'CASE_UPDATE');
  });

  it('POST /:id/deactivate requires CASE_UPDATE', () => {
    assertRoute(src, 'post', '/:id/deactivate');
    assertPermission(src, 'post', '/:id/deactivate', 'CASE_UPDATE');
  });
});
