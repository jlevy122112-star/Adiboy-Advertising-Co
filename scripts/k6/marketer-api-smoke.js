import http from "k6/http";
import { check } from "k6";

/** Minimal smoke — extend with login + marketer routes when running against a real env. */
export const options = {
  vus: 5,
  duration: "30s",
};

export default function () {
  const base = __ENV.API_BASE ?? "http://127.0.0.1:4310";
  const res = http.get(`${base}/health`);
  check(res, {
    "health 200": (r) => r.status === 200,
  });
}
