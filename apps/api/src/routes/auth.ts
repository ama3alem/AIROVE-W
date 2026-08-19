import { Hono } from 'hono';
import { auth } from '../lib/auth';

export const authRoutes = new Hono();

authRoutes.post('/sign-up', async (c) => {
  const body = await c.req.json();
  const result = await auth.api.signUpEmail({
    body: {
      email: body.email,
      password: body.password,
      name: body.name,
    },
  });
  return c.json({ success: true, data: result });
});

authRoutes.post('/sign-in', async (c) => {
  const body = await c.req.json();
  const result = await auth.api.signInEmail({
    body: {
      email: body.email,
      password: body.password,
    },
  });
  return c.json({ success: true, data: result });
});

authRoutes.post('/sign-out', async (c) => {
  await auth.api.signOut({
    headers: c.req.raw.headers,
  });
  return c.json({ success: true });
});

authRoutes.get('/session', async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  return c.json({ success: true, data: session });
});
