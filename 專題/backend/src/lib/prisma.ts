import { PrismaClient } from '../generated/prisma/index.js';
//import prismaConfig from '../../prisma.config.js';


const prisma = new PrismaClient({})

export default prisma;