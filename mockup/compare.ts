// The command of the comparison (R58 in docs/decisions.md): the screen test draws app's screen in
// its frame, and this, in Node, opens the same state of the mockup in a new context of the same
// browser, reads each region on either side, takes a snapshot of both and writes what it found to
// mockup/out/. The mockup is the one of the spec folder NOVATRAIL_MOCKUP_SPEC names, spec/ by
// default.
import type { BrowserCommand } from "vitest/node";
import {
  compareRegion,
  deviceContext,
  openState,
  outName,
  readRegion,
  reportLines,
  serveMockup,
  stateUrl,
  writeOut,
} from "../scripts/mockup.ts";
import type { Device, Difference, Region } from "./regions.ts";

/** The spec folder whose mockup the run opens. */
export const SPEC = process.env.NOVATRAIL_MOCKUP_SPEC ?? "spec";

/** One server of the mockup for the whole run, started by the first comparison, again after a failure. */
let served: Promise<{ origin: string }> | undefined;

export const mockupCompare: BrowserCommand<
  [state: string, device: Device, regions: readonly Region[]]
> = async (ctx, state, device, regions): Promise<Difference[]> => {
  served ??= serveMockup(SPEC).catch((error: unknown) => {
    served = undefined;
    throw error;
  });
  const { origin } = await served;
  const browser = ctx.context.browser();
  if (browser === null) throw new Error("the comparison needs the test's browser");
  const engine = browser.browserType().name();
  const frame = await ctx.frame();
  const context = await deviceContext(browser, device);
  try {
    const { page, problems } = await openState(context, stateUrl(origin, state, device));
    if (problems.length > 0)
      throw new Error(`the mockup's ${state} on ${device} in ${engine}: ${problems.join("; ")}`);
    await page
      .locator("#frame")
      .screenshot({ path: outName(state, device, engine, "mockup.png"), animations: "disabled" });
    await ctx.iframe
      .owner()
      .screenshot({ path: outName(state, device, engine, "app.png"), animations: "disabled" });
    const differences: Difference[] = [];
    for (const region of regions)
      differences.push(
        ...compareRegion(
          region,
          await readRegion(page, region.mockup),
          await readRegion(frame, region.app),
        ),
      );
    writeOut(outName(state, device, engine, "json"), `${JSON.stringify(differences, null, 2)}\n`);
    console.log(reportLines(state, device, engine, differences).join("\n"));
    return differences;
  } finally {
    await context.close();
  }
};
