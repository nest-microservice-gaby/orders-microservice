import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
    PORT: number;
    PRODUCT_MICROSERVICE_HOST: string;
    PRODUCT_MICROSERVICE_PORT: string;

}

const envVarsSchema = joi.object({
    PORT: joi.number().required().default(3000),
    PRODUCT_MICROSERVICE_HOST: joi.string().required(),
    PRODUCT_MICROSERVICE_PORT: joi.string().required(),

}).unknown(true);

const { error, value } = envVarsSchema.validate(process.env, {
    abortEarly: false,
});

if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value

export const envs = {
    port: envVars.PORT,
    productMicroserviceHost: envVars.PRODUCT_MICROSERVICE_HOST,
    productMicroservicePort: parseInt(envVars.PRODUCT_MICROSERVICE_PORT),
};