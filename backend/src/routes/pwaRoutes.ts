import express from "express";
import isAuth from "../middleware/isAuth";
import * as PwaController from "../controllers/PwaController";

const pwaRoutes = express.Router();

pwaRoutes.get("/manifest.json", PwaController.manifest);
pwaRoutes.get("/favicon.ico", PwaController.favicon);
pwaRoutes.get("/push/vapid-public-key", PwaController.vapidPublicKey);
pwaRoutes.post("/push/subscribe", isAuth, PwaController.subscribePush);
pwaRoutes.post("/push/unsubscribe", isAuth, PwaController.unsubscribePush);

export default pwaRoutes;
