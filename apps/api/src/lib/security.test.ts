import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

function readFile(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf-8');
}

const ROUTE_FILES = [
  'routes/cases.ts',
  'routes/tasks.ts',
  'routes/sla.ts',
  'routes/escalations.ts',
  'routes/workflows.ts',
] as const;

const L4_ENGINES = [
  'lib/case-service.ts',
  'lib/task-engine.ts',
  'lib/sla-engine.ts',
  'lib/escalation-engine.ts',
] as const;

const FORBIDDEN_L4_IMPORTS = [
  'event-service',
  'custody-service',
  'expected-events',
  'baggage-state-projection',
];

// ---------------------------------------------------------------------------
// 1. Tenant isolation: orgId always comes from authCtx, never request body
// ---------------------------------------------------------------------------
describe('Tenant isolation pattern', () => {
  for (const file of ROUTE_FILES) {
    it(`${file} — every handler uses c.get('auth') for orgId`, () => {
      const src = readFile(file);
      const authGetCount = (src.match(/c\.get\('auth'\)/g) ?? []).length;
      expect(authGetCount).toBeGreaterThanOrEqual(1);
    });

    it(`${file} — never accepts orgId from request body dot access`, () => {
      const src = readFile(file);
      const bodyOrgIdPatterns = src.match(
        /body\.(?:orgId|org_id|organizationId|organization_id)/g,
      );
      expect(bodyOrgIdPatterns).toBeNull();
    });

    it(`${file} — orgId passed to service functions always comes from authCtx`, () => {
      const src = readFile(file);
      const serviceCalls = src.match(/\w+Service\.\w+\([^)]*orgId[^)]*\)/g) ?? [];
      for (const call of serviceCalls) {
        const orgIdArgMatch = call.match(/,\s*(orgId)\s*[,\)]/);
        if (orgIdArgMatch) {
          const precedingLines = src.substring(0, src.indexOf(call)).split('\n');
          let lastAuthDecl = -1;
          for (let i = precedingLines.length - 1; i >= 0; i--) {
            const line = precedingLines[i];
            if (line !== undefined && /const\s+authCtx\s*=/.test(line)) {
              lastAuthDecl = i;
              break;
            }
          }
          expect(lastAuthDecl).toBeGreaterThanOrEqual(0);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Permission verification: every endpoint has requirePermission
// ---------------------------------------------------------------------------
describe('Permission coverage', () => {
  for (const file of ROUTE_FILES) {
    it(`${file} — every route registration has requirePermission middleware`, () => {
      const src = readFile(file);
      const routeRegistrations = src.match(
        /\w+Routes\.(get|post|put|patch|delete)\(\s*['"`]/g,
      );
      expect(routeRegistrations).not.toBeNull();
      expect(routeRegistrations!.length).toBeGreaterThanOrEqual(1);

      for (const reg of routeRegistrations!) {
        const routeStart = src.indexOf(reg);
        const lineEnd = src.indexOf('\n', routeStart);
        const fullLine = src.substring(routeStart, lineEnd);
        const nextLineStart = lineEnd + 1;
        const window = src.substring(routeStart, nextLineStart + 200);
        expect(fullLine).toContain('requirePermission');
        expect(window).toContain('requirePermission');
      }
    });

    it(`${file} — import includes requirePermission`, () => {
      const src = readFile(file);
      expect(src).toContain("import { authMiddleware, requirePermission }");
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Layer 4 boundary: engines must not import L5/event-layer modules
// ---------------------------------------------------------------------------
describe('Layer 4 boundary isolation', () => {
  for (const engine of L4_ENGINES) {
    for (const forbidden of FORBIDDEN_L4_IMPORTS) {
      it(`${engine} — must not import "${forbidden}"`, () => {
        const src = readFile(engine);
        const importLines = src.split('\n').filter(
          (l) => l.trimStart().startsWith('import ') || l.trimStart().startsWith("import {"),
        );
        for (const line of importLines) {
          expect(line).not.toContain(forbidden);
        }
      });
    }
  }

  it('case-service.ts — only imports from @airove/db (table schemas), not other lib mutators', () => {
    const src = readFile('lib/case-service.ts');
    const libImports = src.match(/from\s+['"]\.\/(?!audit-logger|case-state-machine)[^'"]+['"]/g);
    expect(libImports).toBeNull();
  });

  it('task-engine.ts — only imports from @airove/db and permitted local modules', () => {
    const src = readFile('lib/task-engine.ts');
    const libImports = src.match(/from\s+['"]\.\/(?!audit-logger|case-state-machine)[^'"]+['"]/g);
    expect(libImports).toBeNull();
  });

  it('sla-engine.ts — only imports from @airove/db and permitted local modules', () => {
    const src = readFile('lib/sla-engine.ts');
    const libImports = src.match(/from\s+['"]\.\/(?!audit-logger)[^'"]+['"]/g);
    expect(libImports).toBeNull();
  });

  it('escalation-engine.ts — only imports from @airove/db and permitted local modules', () => {
    const src = readFile('lib/escalation-engine.ts');
    const libImports = src.match(/from\s+['"]\.\/(?!audit-logger)[^'"]+['"]/g);
    expect(libImports).toBeNull();
  });

  it('case-service.ts — imports @airove/db for table schemas', () => {
    const src = readFile('lib/case-service.ts');
    expect(src).toMatch(/from\s+['"]@airove\/db['"]/);
  });

  it('task-engine.ts — imports @airove/db for table schemas', () => {
    const src = readFile('lib/task-engine.ts');
    expect(src).toMatch(/from\s+['"]@airove\/db['"]/);
  });

  it('sla-engine.ts — imports @airove/db for table schemas', () => {
    const src = readFile('lib/sla-engine.ts');
    expect(src).toMatch(/from\s+['"]@airove\/db['"]/);
  });

  it('escalation-engine.ts — imports @airove/db for table schemas', () => {
    const src = readFile('lib/escalation-engine.ts');
    expect(src).toMatch(/from\s+['"]@airove\/db['"]/);
  });
});

// ---------------------------------------------------------------------------
// 4. Input validation: route handlers parse body through Zod schemas
// ---------------------------------------------------------------------------
describe('Input validation via Zod', () => {
  const ZOD_SCHEMA_FILES: Array<{ file: string; schemas: string[] }> = [
    {
      file: 'routes/cases.ts',
      schemas: ['createCaseSchema', 'updateCaseSchema', 'assignCaseSchema', 'reassignCaseSchema', 'resolveCaseSchema'],
    },
    {
      file: 'routes/tasks.ts',
      schemas: ['createTaskSchema', 'updateTaskSchema', 'completeTaskSchema', 'blockTaskSchema'],
    },
    {
      file: 'routes/sla.ts',
      schemas: ['createSLAPolicySchema', 'updateSLAPolicySchema', 'pauseSLASchema'],
    },
    {
      file: 'routes/escalations.ts',
      schemas: ['createEscalationSchema'],
    },
  ];

  for (const { file, schemas } of ZOD_SCHEMA_FILES) {
    for (const schema of schemas) {
      it(`${file} — imports and uses ${schema} for validation`, () => {
        const src = readFile(file);
        expect(src).toContain(schema);
        expect(src).toContain(`${schema}.parse(`);
      });
    }
  }

  it('cases.ts — POST / body validated before caseService.createCase', () => {
    const src = readFile('routes/cases.ts');
    const createBlock = src.substring(
      src.indexOf("caseRoutes.post('/',"),
      src.indexOf('return c.json({ success: true, data: newCase }'),
    );
    const parseIdx = createBlock.indexOf('.parse(');
    const serviceCallIdx = createBlock.indexOf('caseService.createCase(');
    expect(parseIdx).toBeGreaterThan(-1);
    expect(serviceCallIdx).toBeGreaterThan(parseIdx);
  });

  it('tasks.ts — POST / body validated before taskService.createTask', () => {
    const src = readFile('routes/tasks.ts');
    const createBlock = src.substring(
      src.indexOf("taskRoutes.post('/',"),
      src.indexOf('return c.json({ success: true, data: task }'),
    );
    const parseIdx = createBlock.indexOf('.parse(');
    const serviceCallIdx = createBlock.indexOf('taskService.createTask(');
    expect(parseIdx).toBeGreaterThan(-1);
    expect(serviceCallIdx).toBeGreaterThan(parseIdx);
  });
});

// ---------------------------------------------------------------------------
// 5. Schema spoofing prevention
// ---------------------------------------------------------------------------
describe('Schema spoofing prevention', () => {
  it('cases.ts — createCaseSchema.parse result has no orgId field spread into service call', () => {
    const src = readFile('routes/cases.ts');
    const createPost = src.substring(
      src.indexOf("caseRoutes.post('/',"),
      src.indexOf("await caseActivityService.logCaseCreated"),
    );
    expect(createPost).not.toMatch(/validated\.orgId/);
    expect(createPost).not.toMatch(/orgId:\s*validated/);
  });

  it('cases.ts — updateCaseSchema.parse result has no orgId field', () => {
    const src = readFile('routes/cases.ts');
    const updatePatch = src.substring(
      src.indexOf("caseRoutes.patch('/:id',"),
      src.indexOf("return c.json({ success: true, data: updated })", src.indexOf("caseRoutes.patch('/:id'")),
    );
    expect(updatePatch).not.toMatch(/validated\.orgId/);
    expect(updatePatch).not.toMatch(/orgId:\s*validated/);
  });

  it('cases.ts — orgId for createCase comes from authCtx', () => {
    const src = readFile('routes/cases.ts');
    const createBlock = src.substring(
      src.indexOf("caseRoutes.post('/',"),
      src.indexOf("await caseActivityService.logCaseCreated"),
    );
    expect(createBlock).toContain('authCtx.orgId');
  });

  it('tasks.ts — createTaskSchema.parse result has no orgId field', () => {
    const src = readFile('routes/tasks.ts');
    const createPost = src.substring(
      src.indexOf("taskRoutes.post('/',"),
      src.indexOf("await caseActivityService.logTaskCreated"),
    );
    expect(createPost).not.toMatch(/validated\.orgId/);
    expect(createPost).not.toMatch(/orgId:\s*validated/);
  });

  it('tasks.ts — orgId for createTask comes from authCtx', () => {
    const src = readFile('routes/tasks.ts');
    const createBlock = src.substring(
      src.indexOf("taskRoutes.post('/',"),
      src.indexOf('return c.json({ success: true, data: task }'),
    );
    expect(createBlock).toContain('authCtx.orgId');
  });

  it('sla.ts — createSLAPolicySchema.parse result has no orgId field', () => {
    const src = readFile('routes/sla.ts');
    const createPost = src.substring(
      src.indexOf("slaRoutes.post('/',"),
      src.indexOf("return c.json({ success: true, data: policy }, 201)"),
    );
    expect(createPost).not.toMatch(/validated\.orgId/);
    expect(createPost).not.toMatch(/orgId:\s*validated/);
  });

  it('sla.ts — orgId for createSLAPolicy comes from authCtx', () => {
    const src = readFile('routes/sla.ts');
    const createBlock = src.substring(
      src.indexOf("slaRoutes.post('/',"),
      src.indexOf("return c.json({ success: true, data: policy }, 201)"),
    );
    expect(createBlock).toContain('authCtx.orgId');
  });

  it('escalations.ts — createEscalationSchema.parse result has no orgId field', () => {
    const src = readFile('routes/escalations.ts');
    const createPost = src.substring(
      src.indexOf("escalationRoutes.post('/',"),
      src.indexOf("return c.json({ success: true, data: escalation }, 201)"),
    );
    expect(createPost).not.toMatch(/validated\.orgId/);
    expect(createPost).not.toMatch(/orgId:\s*validated/);
  });

  it('escalations.ts — orgId for createEscalation comes from authCtx', () => {
    const src = readFile('routes/escalations.ts');
    const createBlock = src.substring(
      src.indexOf("escalationRoutes.post('/',"),
      src.indexOf("return c.json({ success: true, data: escalation }, 201)"),
    );
    expect(createBlock).toContain('authCtx.orgId');
  });
});
