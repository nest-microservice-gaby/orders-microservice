import { OrderStatus } from "@prisma/client";

export const OrderStatusList = Object.values(OrderStatus).filter((value) => typeof value === 'string') as string[];