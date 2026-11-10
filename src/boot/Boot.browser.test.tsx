import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { Boot, useDeployment } from "./Boot.tsx";

const ORIGIN = "https://app.example.org";
const FILE = {
  format: 1,
  api: "https://api.example.org",
  signIn: {
    service: "firebase",
    apiKey: "synthetic-web-api-key",
    authDomain: "example-project.firebaseapp.com",
    projectId: "example-project",
    appId: "synthetic-web-app-id",
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** What the app below Boot sees: the api it was given. */
function Shell() {
  return <p>api {useDeployment().api}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.lang = "en";
});

describe("Boot", () => {
  it("in a frame shows its own screen and asks nothing of the network", () => {
    const fetcher = vi.fn<typeof fetch>();
    render(
      <Boot framed origin={ORIGIN} languages={["en-GB"]} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    expect(
      screen.getByRole("heading", { name: "This app opens only in a tab of its own" }),
    ).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("gives the app the file once it is read, and nothing before", async () => {
    let answer: (response: Response) => void = () => {};
    const fetcher = vi.fn<typeof fetch>(() => new Promise((resolve) => (answer = resolve)));
    render(
      <Boot framed={false} origin={ORIGIN} languages={[]} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    expect(screen.queryByText(/^api /)).toBeNull();
    await act(async () => answer(json(FILE)));
    expect(await screen.findByText("api https://api.example.org")).toBeTruthy();
  });

  it("offers to try again without a connection, and starts once the file comes", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json(FILE));
    render(
      <Boot framed={false} origin={ORIGIN} languages={["en"]} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "No connection" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("api https://api.example.org")).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps the screen and its button while it asks again", async () => {
    let answer: (response: Response) => void = () => {};
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    render(
      <Boot framed={false} origin={ORIGIN} languages={["en"]} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    const button = await screen.findByRole("button", { name: "Try again" });
    await userEvent.click(button);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Try again" })).toBe(button);
    expect(document.activeElement).toBe(button);
    await act(async () => answer(json(FILE)));
    expect(await screen.findByText("api https://api.example.org")).toBeTruthy();
  });

  it("takes a failure the reading cannot name as no connection", async () => {
    const odd = {
      get status(): number {
        throw new Error("odd");
      },
    } as unknown as Response;
    const fetcher = vi.fn<typeof fetch>(async () => odd);
    render(
      <Boot framed={false} origin={ORIGIN} languages={["en"]} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "No connection" })).toBeTruthy();
  });

  it("says the app is not set up, in the device's language, with the operator's line in English", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ ...FILE, measurementId: "G-1" }));
    render(
      <Boot framed={false} origin={ORIGIN} languages={["ru-RU", "en"]} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "Приложение не настроено" })).toBeTruthy();
    expect(screen.getByText("Нужна помощь взрослого")).toBeTruthy();
    const line = screen.getByText(/^For whoever deployed this copy:/);
    expect(line.textContent).toBe(
      "For whoever deployed this copy: /deployment.json is refused by schema: measurementId.",
    );
    expect(line.getAttribute("lang")).toBe("en");
    expect(document.documentElement.lang).toBe("ru");
  });

  it("offers a reload when a module of the build is gone, over what it shows, and reloads on a tap", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(FILE));
    render(
      <Boot framed={false} origin={ORIGIN} languages={["en"]} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    await screen.findByText("api https://api.example.org");
    const event = new Event("vite:preloadError", { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("There is a new version of the app");
    expect(screen.getByText("api https://api.example.org")).toBeTruthy();
  });

  it("shows the offer over the failure screens too, and before the file is read", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 404))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { unmount } = render(
      <Boot framed={false} origin={ORIGIN} languages={["en"]} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    act(() => {
      window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "This app isn't set up" })).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    unmount();
    render(
      <Boot framed={false} origin={ORIGIN} languages={["en"]} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "No connection" })).toBeTruthy();
  });
});

describe("useDeployment", () => {
  it("is there only below Boot", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Shell />)).toThrow("useDeployment outside Boot");
  });
});
