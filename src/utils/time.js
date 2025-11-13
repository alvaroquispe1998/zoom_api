import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import tz from "dayjs/plugin/timezone.js";


dayjs.extend(utc);
dayjs.extend(tz);


export function parseLocal(input, timezone) {
// Acepta string con o sin Z; si tiene Z, dayjs.tz lo convierte a local
return dayjs.tz(input, timezone);
}


export function toUTC(d) {
return d.utc();
}


export function formatLocal(d, timezone, mask = "YYYY-MM-DD HH:mm") {
return d.tz(timezone).format(mask);
}