import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/account", () => ({
  claimAccount: vi.fn(),
  setAccountPassword: vi.fn(),
  signInToAccount: vi.fn(),
  signOutOfAccount: vi.fn(),
}));

const { ClaimForm, PasswordForm, SignInForm, SignOutButton } = await import(
  "@/components/account-panel"
);

describe("ClaimForm", () => {
  it("asks for an email", () => {
    render(<ClaimForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });

  it("asks for NO password", () => {
    // Supabase refuses to set one on an anonymous user with no email yet, so
    // collecting it here would only fail the whole claim.
    render(<ClaimForm />);
    expect(screen.queryByLabelText("Password")).toBeNull();
  });
});

describe("PasswordForm", () => {
  it("asks for a password", () => {
    render(<PasswordForm />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("hints a new password to the browser's password manager", () => {
    render(<PasswordForm />);
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autoComplete",
      "new-password",
    );
  });

  it("asks for no email, since the address is already attached by then", () => {
    render(<PasswordForm />);
    expect(screen.queryByLabelText("Email")).toBeNull();
  });
});

describe("SignInForm on a browser with nothing in it", () => {
  it("does not warn about losing anything", () => {
    render(<SignInForm hasLocalData={false} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("lets the user sign in straight away", () => {
    render(<SignInForm hasLocalData={false} />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("offers the saved password to the password manager", () => {
    render(<SignInForm hasLocalData={false} />);
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autoComplete",
      "current-password",
    );
  });
});

describe("SignInForm on a browser that already holds entries", () => {
  it("warns that they become unreachable", () => {
    render(<SignInForm hasLocalData />);
    expect(screen.getByText(/no longer be reachable here/i)).toBeInTheDocument();
  });

  it("blocks sign-in until the warning is acknowledged", () => {
    // Swapping ledgers is not something to do by muscle memory.
    render(<SignInForm hasLocalData />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("enables sign-in once the box is ticked", async () => {
    const user = userEvent.setup();
    render(<SignInForm hasLocalData />);
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("blocks it again if the box is unticked", async () => {
    const user = userEvent.setup();
    render(<SignInForm hasLocalData />);
    const box = screen.getByRole("checkbox");
    await user.click(box);
    await user.click(box);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });
});

describe("SignOutButton", () => {
  it("renders a submit inside its own form", () => {
    render(<SignOutButton />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.closest("form")).not.toBeNull();
  });
});
