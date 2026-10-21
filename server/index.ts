import express from 'express';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApp} from './app';
const app=createApp();if(existsSync('dist/index.html')){app.use(express.static('dist'));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}const port=Number(process.env.PORT??3001);app.listen(port,'0.0.0.0',()=>console.log(`Open Project API listening on port ${port}`));
