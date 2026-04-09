import type { Request, Response } from "express";

export class AuthController {

    async login(req: Request, res: Response) {
        res.send('Login successful');
    }
}

export const authController = new AuthController();