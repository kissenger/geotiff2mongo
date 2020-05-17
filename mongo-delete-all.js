"use strict";

const mongoose = require('mongoose');
const dotenv = require("dotenv");
dotenv.config();

const ElevationsModel = require('./mongo-schema').ElevationsModel;


/**
 * Mongo connection and Schema
 */

(async () => {
  await mongoose.connect(`mongodb+srv://root:${process.env.MONGODB_PASSWORD}@cluster0-gplhv.mongodb.net/elevations?retryWrites=true`,
    {useUnifiedTopology: true, useNewUrlParser: true });
})();

mongoose.connection
.on('error', console.error.bind(console, 'connection error:'))
.once('open', function() {console.log('MongoDB connected');
});

ElevationsModel.deleteMany({})
  .then( () => {
    mongoose.connection.close();
    console.log('done');
   })
  .catch( err => console.log(err))

