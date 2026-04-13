import jwt, { type SignOptions } from "jsonwebtoken";

/*ts很哭的多載問題*/
interface JwtPayload {
    id: number;
    email: string;
}


export const generateToken = (
    payload: JwtPayload,
    secretKey: string,
    expiresIn: SignOptions["expiresIn"] = "7d"  /*告訴ts定義*/

): string => {

    const secret = process.env.JWT_SECRET_KEY || secretKey;

    const token = jwt.sign(
        { id: payload.id, email: payload.email },
        secret,
        { expiresIn: expiresIn }
    )
    return token;
};