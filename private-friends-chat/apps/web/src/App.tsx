import { type FormEvent, useEffect, useState } from "react";
import type { HealthResponse } from "@private-chat/shared";

interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}

const apiUrl = import.meta.env.VITE_API_URL ?? "";

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const [healthResponse, sessionResponse] = await Promise.all([
          fetch(`${apiUrl}/api/health`),
          fetch(`${apiUrl}/api/auth/me`, { credentials: "include" }),
        ]);
        if (healthResponse.ok)
          setHealth((await healthResponse.json()) as HealthResponse);
        if (sessionResponse.ok)
          setUser(
            ((await sessionResponse.json()) as { user: CurrentUser }).user,
          );
      } catch {
        setError("Could not reach the API.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadSession();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const rawPayload = await response.text();
      let payload: { user?: CurrentUser; error?: { message: string } } | null =
        null;
      try {
        payload = rawPayload
          ? (JSON.parse(rawPayload) as {
              user?: CurrentUser;
              error?: { message: string };
            })
          : null;
      } catch {
        // A proxy or unavailable API can return an empty/non-JSON response.
      }
      if (!response.ok || !payload?.user)
        throw new Error(
          payload?.error?.message ??
            "The sign-in service did not respond. Please check the private chat server and try again.",
        );
      setUser(payload.user);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await fetch(`${apiUrl}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  return (
    <main>
      <section aria-labelledby="app-title">
        <p className="eyebrow">Private, invite-only</p>
        <h1 id="app-title">Private Friends Chat</h1>
        {user ? (
          <div className="authenticated">
            <p>
              Signed in as <strong>{user.displayName}</strong> (@{user.username}
              )
            </p>
            <p className="role">{user.role}</p>
            <button type="button" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void login(event)}>
            <p>
              Sign in with the account created by your invitation or
              administrator.
            </p>
            <label>
              Email or username
              <input
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button disabled={isLoading} type="submit">
              {isLoading ? "Please wait…" : "Log in"}
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
        <p className={health ? "status healthy" : "status"} role="status">
          {health
            ? "API connected · private access enabled"
            : "Checking API connection…"}
        </p>
      </section>
    </main>
  );
}
