import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorCard from "@/app/error";

// The boundary logs on mount; keep the test output clean.
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function makeError(over: Partial<Error & { digest?: string }> = {}) {
  return Object.assign(new Error("PGRST205: table not found"), over) as Error & {
    digest?: string;
  };
}

describe("error card content", () => {
  it("says something went wrong in plain language", () => {
    render(<ErrorCard error={makeError()} unstable_retry={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/can't reach your data/i)).toBeInTheDocument();
  });

  it("offers a retry", () => {
    render(<ErrorCard error={makeError()} unstable_retry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("shows the digest so a report can be traced", () => {
    render(
      <ErrorCard error={makeError({ digest: "abc123" })} unstable_retry={vi.fn()} />,
    );
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("omits the reference line when there is no digest", () => {
    render(<ErrorCard error={makeError()} unstable_retry={vi.fn()} />);
    expect(screen.queryByText(/^Reference:/)).not.toBeInTheDocument();
  });

  it("logs the error for the server console", () => {
    const err = makeError();
    render(<ErrorCard error={err} unstable_retry={vi.fn()} />);
    expect(console.error).toHaveBeenCalledWith(err);
  });
});

describe("error card retry", () => {
  it("calls Next's retry, not a page reload", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorCard error={makeError()} unstable_retry={retry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("can be retried more than once when the first attempt fails", async () => {
    // The boundary re-renders itself on a failed retry, so the button has to
    // come back rather than staying stuck on "Retrying…".
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorCard error={makeError()} unstable_retry={retry} />);

    const button = screen.getByRole("button", { name: "Try again" });
    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(2);
  });
});

describe("error card leaks nothing", () => {
  it("does not put internals in the user-facing copy", () => {
    render(
      <ErrorCard
        error={makeError({ message: "postgres://user:pw@db.internal:5432" })}
        unstable_retry={vi.fn()}
      />,
    );
    // In dev the raw message renders in a debug <pre>; the prose around it
    // must never carry credentials or hostnames.
    expect(screen.getByText(/can't reach your data/i).textContent).not.toContain(
      "postgres://",
    );
  });
});
