import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { config } from "../config.js";

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // /api/auth/google is auto-registered by @fastify/oauth2 via startRedirectPath

  // Google redirects here after user grants consent
  app.get("/api/auth/google/callback", async (req, reply) => {
    const tokenResponse = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req, reply);
    const accessToken = tokenResponse.token.access_token as string;

    // Fetch Google profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      return reply.internalServerError("Failed to fetch Google profile.");
    }

    const profile = (await profileRes.json()) as GoogleUserInfo;

    // Find or create user
    let user = await db
      .selectFrom("users")
      .select(["id", "email", "name"])
      .where("google_id", "=", profile.sub)
      .executeTakeFirst();

    if (!user) {
      // Check if email is already registered (edge case: same email, different Google account)
      const byEmail = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", profile.email)
        .executeTakeFirst();

      if (byEmail) {
        // Link Google ID to existing account
        user = await db
          .updateTable("users")
          .set({ google_id: profile.sub })
          .where("id", "=", byEmail.id)
          .returning(["id", "email", "name"])
          .executeTakeFirstOrThrow();
      } else {
        user = await db
          .insertInto("users")
          .values({
            email: profile.email,
            name: profile.name,
            google_id: profile.sub,
          })
          .returning(["id", "email", "name"])
          .executeTakeFirstOrThrow();
      }
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email });

    // Redirect to frontend with token in URL — frontend reads it and stores in localStorage
    return reply.redirect(`${config.frontendUrl}?token=${token}`);
  });

  app.get(
    "/api/auth/me",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const user = await db
        .selectFrom("users")
        .select(["id", "email", "name", "created_at"])
        .where("id", "=", req.user.sub)
        .executeTakeFirst();

      if (!user) return reply.notFound();
      return user;
    }
  );
};
