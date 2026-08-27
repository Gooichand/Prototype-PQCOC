import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

export type ForensicRole = "Investigator" | "Examiner" | "Reviewer";

const ROLE_PERMISSIONS: Record<ForensicRole, string[]> = {
  Investigator: ["createDemoCase", "acquireDemo", "registerLocalCopy", "handover"],
  Examiner: ["verify", "runBenchmark", "benchmarks", "auditExport"],
  Reviewer: ["tamper", "resetTamper", "resetPresentationDemo", "dashboard", "cases", "evidence", "timeline", "investigators", "seedDemo", "capability"],
};

export function isRoleAllowed(role: ForensicRole, procedureName: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(procedureName) ?? false;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export function createRoleGuard(allowedRoles: ForensicRole[]) {
  return t.middleware(async opts => {
    const { ctx, next, path } = opts;
    const procedureName = path.split(".").pop() ?? "";

    if (!ctx.user) {
      return next({ ctx });
    }

    const userRole = (ctx.user as any).forensicRole as ForensicRole | undefined;
    if (userRole && !allowedRoles.includes(userRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Role "${userRole}" is not authorised for "${procedureName}". Required: ${allowedRoles.join(" or ")}.`,
      });
    }

    return next({ ctx });
  });
}

export const investigatorProcedure = t.procedure.use(createRoleGuard(["Investigator"]));
export const examinerProcedure = t.procedure.use(createRoleGuard(["Examiner"]));
export const reviewerProcedure = t.procedure.use(createRoleGuard(["Reviewer"]));
export const multiRoleProcedure = t.procedure.use(createRoleGuard(["Investigator", "Examiner", "Reviewer"]));
