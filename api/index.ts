import serverless from 'serverless-http';
import { createApp } from '../server';

const app = createApp();

export default serverless(app);
