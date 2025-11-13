import dotenv from "dotenv";
dotenv.config();


export const cfg = {
port: parseInt(process.env.PORT || "3000", 10),
tzDefault: process.env.TZ_DEFAULT || "America/Lima",
zoom: {
accountId: process.env.ZOOM_ACCOUNT_ID,
clientId: process.env.ZOOM_CLIENT_ID,
clientSecret: process.env.ZOOM_CLIENT_SECRET
},
singleUserId: process.env.ZOOM_USER_ID || null,
hostsEnv: (process.env.ZOOM_HOSTS || "")
.split(",")
.map(s => s.trim())
.filter(Boolean),
maxConcurrent: Number(process.env.MAX_CONCURRENT || 2),
zoomPageSize: Number(process.env.ZOOM_PAGE_SIZE || 20),
};