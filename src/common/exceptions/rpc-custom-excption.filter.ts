import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

@Catch(RpcException)
export class RpcCustomExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToRpc();
    const response = ctx.getContext();

    const rpcError = exception.getError();

    if (typeof rpcError === 'object' && 'status' in rpcError && 'message' in rpcError) {
      const status = typeof rpcError.status === 'number' && !isNaN(rpcError.status) ? rpcError.status : 400;
      return response.status(status).json(rpcError)
    }

    response.status(400).json({
      statusCode: 400,
      message: rpcError,
    });
  }
}