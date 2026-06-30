import serverless from 'serverless-http';
import { createApp } from '../server';

export default serverless(createApp());
