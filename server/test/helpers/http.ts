import request from "supertest";
import type { Express } from "express";

export type TestAgent = ReturnType<typeof request.agent>;

export async function csrfToken(agent: TestAgent): Promise<string> {
  const response = await agent.get("/api/auth/csrf");
  if (response.status !== 200 || typeof response.body.csrfToken !== "string") {
    throw new Error(`CSRF endpoint failed with ${response.status}`);
  }
  return response.body.csrfToken as string;
}

export async function loginAgent(
  app: Express,
  email: string,
  password: string,
): Promise<TestAgent> {
  const agent = request.agent(app);
  const token = await csrfToken(agent);
  const response = await agent
    .post("/api/auth/login")
    .set("x-csrf-token", token)
    .send({ email, password });
  if (response.status !== 200) {
    throw new Error(
      `login for ${email} failed with ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }
  return agent;
}
