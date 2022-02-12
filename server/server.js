import express from 'express'
import { readdirSync } from 'fs'
import cors from 'cors'
import mongoose from 'mongoose'
const morgan = require('morgan') 
require('dotenv').config()

const app = express();

//mongo connect
mongoose
  .connect(process.env.DATABASE, {})
  .then(() => console.log("DB connected"))
  .catch((err) => console.log("DB Error => ", err));

//middlewares
//damit die cors policy datenaustausch zwischen domains funktioniert
app.use(cors())
app.use(morgan('dev'))
//to get post bodies - less. 24
app.use(express.json())

//routes
readdirSync('./routes').map((r) => app.use('/api', require(`./routes/${r}`)))
//normales vorgehen - für jede einzelne route: app.use('/api', router)

const port = process.env.PORT || 8000
app.listen(port, () => console.log(`Listening on port ${port}`))