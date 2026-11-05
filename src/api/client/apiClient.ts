import axios from "axios";

import { applyResponseInterceptor } from "../interceptors/responseInterceptor";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const configuredDevApiProxyTarget = import.meta.env.VITE_DEV_API_PROXY_TARGET?.trim();

const PRODUCTION_API_BASE_URL = "https://abdulraahmann-schedule-backend-demo.hf.space";

export const API_BASE_URL = import.meta.env.DEV ? "" : configuredApiBaseUrl || PRODUCTION_API_BASE_URL;

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