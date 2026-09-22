"use client";
import { ENABLED_COUNTRIES } from "@/lib/countries";
import { useCountry } from "@/components/country-provider";
export function CountrySelector(){const {country,setCountry}=useCountry();return <label className="country-selector"><span className="sr-only">Current browsing country</span><select value={country.code} onChange={(event)=>setCountry(event.target.value)} aria-label="Current browsing country">{ENABLED_COUNTRIES.map((item)=><option key={item.code} value={item.code}>{item.flag} {item.name}</option>)}</select></label>;}
