import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The API is the only thing that talks to OpenAI or the database. The
  // browser bundle must never receive a service-role key or an API key.
  env: {},
};

export default config;
