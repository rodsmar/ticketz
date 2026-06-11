import { Request, Response } from "express";
import GetPublicSettingService from "../services/SettingServices/GetPublicSettingService";
import PushSubscription from "../models/PushSubscription";
import { getVapidPublicKey } from "../services/PushNotificationService";

export const manifest = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const appName = await GetPublicSettingService({ key: "appName" });
  const logoFavicon = await GetPublicSettingService({ key: "appLogoFavicon" });

  const mimes = {
    svg: "image/svg+xml",
    png: "image/png",
    ico: "image/x-icon"
  };

  let mimeFavicon = "image/svg+xml";

  if (logoFavicon) {
    const extension = logoFavicon.split(".").pop();
    mimeFavicon = mimes[extension] || "image/x-icon";
  }

  const data = {
    short_name: appName || "Ticketz",
    name: appName || "Ticketz - Chat Based Ticket System",
    icons: [
      {
        src: logoFavicon
          ? `/backend/public/${logoFavicon}`
          : "/vector/favicon.svg",
        sizes: "512x512 192x192 64x64 32x32 24x24 16x16",
        type: mimeFavicon,
        purpose: "any maskable"
      },
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#000000",
    background_color: "#ffffff"
  };

  return res.status(200).json(data);
};

export const favicon = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const logoFavicon = await GetPublicSettingService({ key: "appLogoFavicon" });
  res.redirect(302, `/backend/public/${logoFavicon}`);
  return res;
};

export const vapidPublicKey = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const publicKey = await getVapidPublicKey();
  return res.status(200).json({ publicKey });
};

export const subscribePush = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id: userId, companyId } = req.user;
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  const existing = await PushSubscription.findOne({
    where: { userId, companyId, endpoint }
  });

  if (!existing) {
    await PushSubscription.create({
      userId,
      companyId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    });
  }

  return res.status(201).json({ message: "Subscribed" });
};

export const unsubscribePush = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id: userId, companyId } = req.user;
  const { endpoint } = req.body;

  const where = endpoint
    ? { userId, companyId, endpoint }
    : { userId, companyId };

  const subs = await PushSubscription.findAll({ where });
  await Promise.all(subs.map(s => s.destroy()));

  return res.status(200).json({ message: "Unsubscribed" });
};
