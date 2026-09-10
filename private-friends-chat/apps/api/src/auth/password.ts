import argon2 from "argon2";

const options = {
  type: 2 as const,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}
