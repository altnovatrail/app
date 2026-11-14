import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { LanguageButtons } from "../i18n/LanguageButtons.tsx";
import { addProfile } from "../storage/profile.ts";
import { setAccount, setSignIn } from "../storage/registry.ts";
import {
  FIREBASE_AUTH,
  PROFILE_SCHEMA,
  profileDatabase,
  REGISTRY,
  SETTINGS,
} from "../storage/schema.ts";
import { readLanguage, writeLanguage } from "../storage/settings.ts";
import { memoryDevice } from "../test/device.ts";
import { fakeSignIn } from "../test/signin.ts";
import { Boot, useDeployment, useStorage } from "./Boot.tsx";

/** A sign-in service with nobody signed in, in place of Firebase Auth. */
const signedOut = () => fakeSignIn();

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
      <Boot
        signIn={signedOut}
        framed
        origin={ORIGIN}
        languages={["en-GB"]}
        device={device()}
        fetcher={fetcher}
      >
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
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={[]}
        device={device()}
        fetcher={fetcher}
      >
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
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device()}
        fetcher={fetcher}
      >
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
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device()}
        fetcher={fetcher}
      >
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
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device()}
        fetcher={fetcher}
      >
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "No connection" })).toBeTruthy();
  });

  it("says the app is not set up, in the device's language, with the operator's line in English", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ ...FILE, measurementId: "G-1" }));
    render(
      <Boot
        signIn={signedOut}
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
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device()}
        fetcher={fetcher}
      >
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
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device()}
        fetcher={fetcher}
      >
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
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device()}
        fetcher={fetcher}
      >
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
      <Boot signIn={signedOut} framed origin={ORIGIN} languages={["en"]} device={device}>
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
        signIn={signedOut}
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

  it("starts no sign-in when the start of the storage failed, and says the data can't be read", async () => {
    const { device } = memoryDevice();
    await setAccount(device, "account-1");
    vi.spyOn(device, "now").mockImplementation(() => {
      throw new Error("no clock");
    });
    const made = vi.fn(() => fakeSignIn());
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device}
        fetcher={async () => json(FILE)}
        signIn={made}
      >
        <Stored />
      </Boot>,
    );
    expect(
      await screen.findByRole("heading", { name: "The data on this device can't be read" }),
    ).toBeTruthy();
    expect(screen.queryByText(/^sign-in /)).toBeNull();
    expect(made).not.toHaveBeenCalled();
  });

  it("starts no sign-in while another tab holds the previous project's, and says so", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await setSignIn(device, { projectId: "previous-project", apiKey: "previous-key" });
    backend.blocked.add(FIREBASE_AUTH);
    const made = vi.fn(() => fakeSignIn());
    render(
      <Boot
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device}
        fetcher={async () => json(FILE)}
        signIn={made}
      >
        <Stored />
      </Boot>,
    );
    expect(
      await screen.findByRole("heading", {
        name: "The app is open in another tab with the previous sign-in. Close that tab and try again",
      }),
    ).toBeTruthy();
    expect(made).not.toHaveBeenCalled();
  });

  it("makes the sign-in service once the project is compared, once, and sets its window's language", async () => {
    const { device } = memoryDevice();
    const service = fakeSignIn();
    const made = vi.fn((_: unknown) => service);
    render(
      <StrictMode>
        <Boot
          framed={false}
          origin={ORIGIN}
          languages={["ru"]}
          device={device}
          fetcher={async () => json(FILE)}
          signIn={made}
        >
          <LanguageButtons />
          <Stored />
        </Boot>
      </StrictMode>,
    );
    expect(await screen.findByText("sign-in same")).toBeTruthy();
    expect(made).toHaveBeenCalledOnce();
    expect(made.mock.calls[0]?.[0]).toEqual(FILE.signIn);
    await vi.waitFor(() => expect(service.languages.at(-1)).toBe("ru"));
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    await vi.waitFor(() => expect(service.languages.at(-1)).toBe("en"));
  });

  it("says the data was erased when the browser erased the origin, in the device's language", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    render(
      <Boot
        signIn={signedOut}
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
        signIn={signedOut}
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
          signIn={signedOut}
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
        signIn={signedOut}
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
        signIn={signedOut}
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
        signIn={signedOut}
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
        { version: PROFILE_SCHEMA.version + 1, stores: {} },
        { create: true, onLost: () => {} },
      );
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "There is a new version of the app",
    );
    expect(screen.getByText("sign-in same")).toBeTruthy();
  });
});

describe("Boot and the device's language", () => {
  it("draws the first screen in the language chosen on this device, read before it", async () => {
    const { device } = memoryDevice();
    await writeLanguage(device, "ru");
    render(
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={device}
        fetcher={async () => json({}, 404)}
      >
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "Приложение не настроено" })).toBeTruthy();
    // The page's language and title come in the effects after the screen.
    await vi.waitFor(() => {
      expect(document.documentElement.lang).toBe("ru");
      expect(document.title).toBe("Приложение не настроено — NovaTrail");
    });
  });

  it("takes the device's languages when the settings cannot be read, or name a language the build has not", async () => {
    const { device, backend } = memoryDevice();
    await backend.open(SETTINGS, { version: 9, stores: {} }, { create: true, onLost: () => {} });
    const { unmount } = render(
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["ru-RU"]}
        device={device}
        fetcher={async () => json({}, 404)}
      >
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "Приложение не настроено" })).toBeTruthy();
    unmount();
    const other = memoryDevice();
    await writeLanguage(other.device, "kk");
    render(
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={other.device}
        fetcher={async () => json({}, 404)}
      >
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "This app isn't set up" })).toBeTruthy();
  });

  it("draws the first screen when the settings do not open in time, in the device's languages", async () => {
    const { device, backend } = memoryDevice();
    const open = backend.open.bind(backend);
    vi.spyOn(backend, "open").mockImplementation((name, schema, options) =>
      name === SETTINGS ? new Promise(() => {}) : open(name, schema, options),
    );
    render(
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["ru"]}
        device={device}
        settingsWait={50}
        fetcher={async () => json({}, 404)}
      >
        <Shell />
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "Приложение не настроено" })).toBeTruthy();
  });

  it("tells the other tabs of no choice it could not keep", async () => {
    const { device, backend } = memoryDevice();
    await backend.open(SETTINGS, { version: 9, stores: {} }, { create: true, onLost: () => {} });
    const tab = (tabDevice = device) => (
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={tabDevice}
        fetcher={async () => json(FILE)}
      >
        <LanguageButtons />
      </Boot>
    );
    render(tab());
    const other = document.createElement("div");
    document.body.append(other);
    render(tab(memoryDevice(backend).device), { container: other });
    await vi.waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Русский" })).toHaveLength(2),
    );
    const [mine, theirs] = screen.getAllByRole("button", { name: "Русский" });
    await userEvent.click(mine as HTMLElement);
    expect(mine?.getAttribute("aria-pressed")).toBe("true");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(theirs?.getAttribute("aria-pressed")).toBe("false");
    other.remove();
  });

  it("in a frame takes the device's languages, not the settings", async () => {
    const { device } = memoryDevice();
    await writeLanguage(device, "ru");
    render(
      <Boot signIn={signedOut} framed origin={ORIGIN} languages={["en"]} device={device}>
        <Shell />
      </Boot>,
    );
    expect(
      screen.getByRole("heading", { name: "This app opens only in a tab of its own" }),
    ).toBeTruthy();
  });

  it("changes the screen at once on a tap, keeps the choice, and tells the other tabs", async () => {
    const { device, backend } = memoryDevice();
    const tab = (tabDevice = device) => (
      <Boot
        signIn={signedOut}
        framed={false}
        origin={ORIGIN}
        languages={["en"]}
        device={tabDevice}
        fetcher={async () => json(FILE)}
      >
        <LanguageButtons />
      </Boot>
    );
    render(tab());
    const second = memoryDevice(backend).device;
    const other = document.createElement("div");
    document.body.append(other);
    render(tab(second), { container: other });
    await vi.waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Русский" })).toHaveLength(2),
    );
    const [mine, theirs] = screen.getAllByRole("button", { name: "Русский" });
    await userEvent.click(mine as HTMLElement);
    expect(mine?.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("group", { name: "Язык" }).length).toBeGreaterThan(0);
    await vi.waitFor(() => expect(theirs?.getAttribute("aria-pressed")).toBe("true"));
    expect(await readLanguage(device)).toBe("ru");
    other.remove();
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
