import "@fastify/jwt";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { OAuth2Namespace } from "@fastify/oauth2";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void>;
    googleOAuth2: OAuth2Namespace;
  }
}
