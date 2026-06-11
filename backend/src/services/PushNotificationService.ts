import webpush from "web-push";
import Setting from "../models/Setting";
import PushSubscription from "../models/PushSubscription";
import User from "../models/User";
import UserQueue from "../models/UserQueue";
import { logger } from "../utils/logger";
import { Op } from "sequelize";

let vapidInitialized = false;

const ensureVapidKeys = async (): Promise<void> => {
  if (vapidInitialized) return;

  let publicKey = await getSuperSetting("_vapidPublicKey");
  let privateKey = await getSuperSetting("_vapidPrivateKey");

  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    await setSuperSetting("_vapidPublicKey", keys.publicKey);
    await setSuperSetting("_vapidPrivateKey", keys.privateKey);
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    logger.info("VAPID keys generated and stored");
  }

  webpush.setVapidDetails(
    `mailto:${process.env.MAIL_FROM || "admin@ticketz.local"}`,
    publicKey,
    privateKey
  );

  vapidInitialized = true;
};

const getSuperSetting = async (key: string): Promise<string | undefined> => {
  const setting = await Setting.findOne({ where: { companyId: 1, key } });
  return setting?.value;
};

const setSuperSetting = async (key: string, value: string): Promise<void> => {
  await Setting.findOrCreate({
    where: { key, companyId: 1 },
    defaults: { key, value, companyId: 1 }
  });
  await Setting.update({ value }, { where: { key, companyId: 1 } });
};

export const getVapidPublicKey = async (): Promise<string> => {
  await ensureVapidKeys();
  return getSuperSetting("_vapidPublicKey");
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag: string;
  url: string;
}

const sendToSubscription = async (
  sub: PushSubscription,
  payload: PushPayload
): Promise<void> => {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      },
      JSON.stringify(payload)
    );
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await sub.destroy();
      logger.debug({ subId: sub.id }, "Removed expired push subscription");
    } else {
      logger.warn({ err, subId: sub.id }, "Push notification failed");
    }
  }
};

const getUserIdsToPush = async (
  companyId: number,
  ticketUserId: number | null,
  ticketQueueId: number | null
): Promise<number[]> => {
  if (ticketUserId) {
    return [ticketUserId];
  }

  if (ticketQueueId) {
    const userQueues = await UserQueue.findAll({
      where: { queueId: ticketQueueId }
    });
    return userQueues.map(uq => uq.userId);
  }

  const admins = await User.findAll({
    where: { companyId, profile: "admin" }
  });
  return admins.map(u => u.id);
};

export const sendPushNotification = async (
  companyId: number,
  ticketUserId: number | null,
  ticketQueueId: number | null,
  payload: PushPayload
): Promise<void> => {
  try {
    await ensureVapidKeys();

    const userIds = await getUserIdsToPush(
      companyId,
      ticketUserId,
      ticketQueueId
    );

    if (!userIds.length) return;

    const subscriptions = await PushSubscription.findAll({
      where: { userId: { [Op.in]: userIds }, companyId }
    });

    if (!subscriptions.length) return;

    await Promise.all(subscriptions.map(sub => sendToSubscription(sub, payload)));
  } catch (err) {
    logger.warn({ err }, "sendPushNotification error");
  }
};
