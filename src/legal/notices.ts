/// <reference types="vite/client" />
// The notices of third-party code that the page of notices shows (R25 and R31 in
// docs/decisions.md): NOTICE and LICENSE of this repository, the same two files the release puts
// beside index.html, taken into the build as text when it is made. So the page reads nothing from
// the network, and what it shows is, byte for byte, what the archive of the same build holds. No
// DOM.
import license from "../../LICENSE?raw";
import notice from "../../NOTICE?raw";

/** NOTICE: the app's own notice, and the packages of the build with their licenses and notices. */
export const NOTICE: string = notice;

/** LICENSE: the Apache License, Version 2.0, the license of the app. */
export const LICENSE: string = license;
