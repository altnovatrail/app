import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { addProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { profileDatabase, REGISTRY } from "../storage/schema.ts";
import { memoryDevice } from "../test/device.ts";
import { Boot, useDeployment, useStorage } from "./Boot.tsx";

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

/** What the app below Boot sees of the storage. */
function Stored() {
  return <p>sign-in {useStorage().signIn}</p>;
}

const device = () => memoryDevice().device;

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.lang = "en";
});

describe("Boot", () => {
  it("in a frame shows its own screen and asks nothing of the network", () => {
    const fetcher = vi.fn<typeof fetch>();
    render(
      <Boot framed origin={ORIGIN} languages={["en-GB"]} device={device()} fetcher={fetcher}>
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
      <Boot framed={false} origin={ORIGIN} languages={[]} device={device()} fetcher={fetcher}>
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
      <Boot framed={false} origin={ORIGIN} languages={["en"]} device={device()} fetcher={fetcher}>
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
      <Boot framed={false} origin={ORIGIN} languages={["en"]} device={device()} fetcher={fetcher}>
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
      <Boot framed={false} origin={ORIGIN} languages={["en"]} device={device()} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "No connection" })).toBeTruthy();
  });

  it("says the app is not set up, in the device's language, with the operator's line in English", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ ...FILE, measurementId: "G-1" }));
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["ru-RU", "en"]}
        device={device()}
        fetcher={fetcher}
      >
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
      <Boot framed={false} origin={ORIGIN} languages={["en"]} device={device()} fetcher={fetcher}>
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
      <Boot framed={false} origin={ORIGIN} languages={["en"]} device={device()} fetcher={fetcher}>
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
      <Boot framed={false} origin={ORIGIN} languages={["en"]} device={device()} fetcher={fetcher}>
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "No connection" })).toBeTruthy();
  });
});

describe("Boot and the storage", () => {
  it("in a frame opens no storage", () => {
    const { device, backend } = memoryDevice();
    const open = vi.spyOn(backend, "open");
    const remove = vi.spyOn(backend, "remove");
    render(
      <Boot framed origin={ORIGIN} languages={["en"]} device={device}>
        <Stored />
      </Boot>,
    );
    expect(open).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("starts the storage for the file's sign-in project before the app, and gives it to the app", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    backend.failing.add(profileDatabase("p1"));
    const { eraseAccount } = await import("../storage/erase.ts");
    await eraseAccount(device);
    backend.failing.clear();
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device}
        fetcher={async () => json(FILE)}
      >
        <Stored />
      </Boot>,
    );
    expect(await screen.findByText("sign-in same")).toBeTruthy();
    expect(backend.databases.size).toBe(0);
  });

  it("starts the app even when the start of the storage failed", async () => {
    const { device } = memoryDevice();
    await setAccount(device, "account-1");
    vi.spyOn(device, "now").mockImplementation(() => {
      throw new Error("no clock");
    });
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device}
        fetcher={async () => json(FILE)}
      >
        <Stored />
      </Boot>,
    );
    expect(await screen.findByText("sign-in failed")).toBeTruthy();
  });

  it("says the data was erased when the browser erased the origin, in the device's language", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["ru"]}
        device={device}
        fetcher={async () => json(FILE)}
      >
        <Stored />
      </Boot>,
    );
    await screen.findByText("sign-in same");
    act(() => backend.eraseAll());
    expect(
      await screen.findByRole("heading", { name: "Данные на этом устройстве стёрты" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Перезагрузить" })).toBeTruthy();
    expect(screen.queryByText("sign-in same")).toBeNull();
  });

  it("says the data could not be read when the browser closed a connection and the registry is there", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device}
        fetcher={async () => json(FILE)}
      >
        <Stored />
      </Boot>,
    );
    await screen.findByText("sign-in same");
    act(() => backend.closeAll(REGISTRY));
    expect(
      await screen.findByRole("heading", { name: "The data on this device can't be read" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  });

  it("starts the storage once under StrictMode, so that a sign-out it finishes stays finished", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    backend.failing.add(profileDatabase("p1"));
    const { eraseAccount } = await import("../storage/erase.ts");
    await eraseAccount(device);
    backend.failing.clear();
    const remove = vi.spyOn(backend, "remove");
    render(
      <StrictMode>
        <Boot
          framed={false}
          origin={ORIGIN}
          languages={["en"]}
          device={device}
          fetcher={async () => json(FILE)}
        >
          <Stored />
        </Boot>
      </StrictMode>,
    );
    expect(await screen.findByText("sign-in same")).toBeTruthy();
    expect(backend.databases.size).toBe(0);
    expect(remove.mock.calls.filter(([name]) => name === REGISTRY)).toHaveLength(1);
  });

  it("shows nothing of its own when another tab signs out", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device}
        fetcher={async () => json(FILE)}
      >
        <Stored />
      </Boot>,
    );
    await screen.findByText("sign-in same");
    const { eraseAccount } = await import("../storage/erase.ts");
    await act(async () => {
      await eraseAccount(memoryDevice(backend).device);
    });
    expect(screen.getByText("sign-in same")).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("asks no more of the storage once a screen says it is gone", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device}
        fetcher={async () => json(FILE)}
      >
        <Stored />
      </Boot>,
    );
    await screen.findByText("sign-in same");
    act(() => backend.closeAll(REGISTRY));
    await screen.findByRole("heading", { name: "The data on this device can't be read" });
    const open = vi.spyOn(backend, "open");
    act(() => backend.closeAll(REGISTRY));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(open).not.toHaveBeenCalled();
  });

  it("offers a reload when another tab opened a database at a newer version", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device}
        fetcher={async () => json(FILE)}
      >
        <Stored />
      </Boot>,
    );
    await screen.findByText("sign-in same");
    await act(async () => {
      await backend.open(
        profileDatabase("p1"),
        { version: 2, stores: {} },
        { create: true, onLost: () => {} },
      );
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "There is a new version of the app",
    );
    expect(screen.getByText("sign-in same")).toBeTruthy();
  });
});

describe("useStorage", () => {
  it("is there only below Boot", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Stored />)).toThrow("useStorage outside Boot");
  });
});

describe("useDeployment", () => {
  it("is there only below Boot", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Shell />)).toThrow("useDeployment outside Boot");
  });
});
