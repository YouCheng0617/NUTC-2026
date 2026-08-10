import { Router } from "express";
import { authCheck, adminCheck, optionalAuthCheck, type AuthRequest } from "../modules/middleware/auth.middleware.js";
import { PetGameController } from "./petGame.controller.js";


const petGameController = new PetGameController();

export function petGameRouter() {
    const router = Router();

    router.post("/rename", authCheck, petGameController.renamePetController);
    router.post("/interact", authCheck, petGameController.interactPetController);
    router.post("/buy", authCheck, petGameController.buyShopItemController);
    router.get("/my-pet", authCheck, petGameController.getMyPetWithInventoryController);

    return router;
}

