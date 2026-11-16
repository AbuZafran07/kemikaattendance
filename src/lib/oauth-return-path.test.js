import { test, expect } from "bun:test";
import { oauthReturnPath } from "./oauth-return-path";

test("preserves the consent authorization through login", () => {
  expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#confirm")).toBe("/.lovable/oauth/consent?authorization_id=abc#confirm");
});
test("rejects external and malformed return paths", () => {
  for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/login\n", null]) {
    expect(oauthReturnPath(value)).toBe("/");
  }
});