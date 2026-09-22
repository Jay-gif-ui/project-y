import { ENABLED_COUNTRIES } from "@/lib/countries";
export const SUPPORTED_REGIONS = ENABLED_COUNTRIES.map(({ code, name }) => [code, name] as const);
