import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';
import { NATS_SERVICE } from '../config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger(OrdersService.name);
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected orders');
  }


  async create(createOrderDto: CreateOrderDto) {
    try {

      // Confirm the product IDs
      const productsId = createOrderDto.items.map(product => product.productId);
      console.log(productsId);

      const products: any[] = await firstValueFrom(this.client.send({ cmd: 'validate-product' }, { ids: productsId }));

      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const price = products.find(product => product.id === orderItem.productId).price;
        return price * orderItem.quantity + acc;

      }, 0) // Calculate the total amount

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return orderItem.quantity + acc;
      }, 0) // Calculate the total items

      // crear una trasaccion de base de datos
      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          status: 'PENDING',
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map(item => ({
                price: products.find(product => product.id === item.productId).price,
                quantity: item.quantity,
                productId: item.productId
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true
            }
          }
        }
      });


      return {
        ...order,
        OrderItem: order.OrderItem.map(orderItems => ({
          ...orderItems,
          name: products.find(product => product.id === orderItems.productId).name
        }))
      };
    } catch (error) {
      console.log(error);
      throw new RpcException({ status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' });
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const totalPages = await this.order.count({
      where: {
        status: orderPaginationDto.status
      }
    });

    const currentPage = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit

    return {
      data: await this.order.findMany({
        skip: (currentPage! - 1) * perPage!,
        take: perPage,
        where: {
          status: orderPaginationDto.status
        }
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: Math.ceil(totalPages / perPage!)
      }
    }
  }
  async findOne(id: string) {


    const order = await this.order.findFirst({
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true
          }
        }
      }
    })

    if (!order) {
      throw new RpcException({ status: HttpStatus.NOT_FOUND, message: 'Order not found' });
    }

    const productIds = order.OrderItem.map(orderItem => orderItem.productId);
    const products : any[] = await firstValueFrom(this.client.send({ cmd: 'validate-product' }, { ids: productIds }));


    return {
      ...order,
      OrderItem: order.OrderItem.map(orderItems => ({
        ...orderItems,
        name: products.find(product => product.id === orderItems.productId).name
      }))
    };
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    try {
      const { id, status } = changeOrderStatusDto;
      const order = await this.findOne(id);

      if (order.status === status) {
        return order;
      }

      return await this.order.update({
        where: { id },
        data: { status }
      });

    } catch (error) {
      console.log(error);
      throw new RpcException({ status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' });
    }

  }

}
