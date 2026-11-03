import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({
    profile(params) {
      const email = String(params.email ?? "").normalize("NFKC").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        throw new Error("Informe um e-mail válido.");
      }
      return { email };
    },
    validatePasswordRequirements(password) {
      if (password.length < 8 || password.length > 128) {
        throw new Error("A senha deve ter entre 8 e 128 caracteres.");
      }
    },
  })],
});
