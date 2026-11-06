import axios from "axios";

import { applyResponseInterceptor } from "../interceptors/responseInterceptor";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const configuredDevApiProxyTarget = import.meta.env.VITE_DEV_API_PROXY_TARGET?.trim();

/**
 * Production: by default the app calls /api on its own address and the hosting (vercel.json) forwards it
 * to the backend. Frontend and API then count as one site, so the HttpOnly sign-in cookies work in every
 * browser (Safari blocks cookies between different sites). Set VITE_API_BASE_URL only to call another address.
 */
export const API_BASE_URL = import.meta.env.DEV ? "" : configuredApiBaseUrl || "";

export const API_TARGET_URL = import.meta.env.DEV
  ? configuredDevApiProxyTarget || configuredApiBaseUrl || "http://localhost:8080"
  : API_BASE_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  // Sign-in lives in HttpOnly cookies set by the server; the browser attaches them itself.
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    // Required by the server on every change (anti-forgery). Other websites cannot add it.
    "X-Requested-With": "XMLHttpRequest",
  },
});

applyResponseInterceptor(apiClient);