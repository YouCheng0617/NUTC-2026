import bcrypt from 'bcrypt';

/*鹽質，將密碼改為復雜以免被破解*/
const saltRounds = 10;
export const hashPassword = async (password: string): Promise<string> => {
    return await bcrypt.hash(password, saltRounds);
};

/*驗證密碼*/
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return await bcrypt.compare(password, hash);
};