"use strict";

const mongoose = require('mongoose');
const dotenv = require("dotenv");
dotenv.config();

const geoTiff = require('geoTiff');
const cursorTo = require('readline').cursorTo;
const ElevationsModel = require('./mongo-schema').ElevationsModel;

const fn = './ASTGTMV003_N51W002_dem.tif';
const nPixPerDeg = 3600;
const imgWidth = nPixPerDeg + 1;
const pixelWidth = 1 / nPixPerDeg;
const offset = pixelWidth / 2;
const tileOrigin = getTileOrigin(fn);
const tiffOriginLng = tileOrigin.lng - offset;
const tiffOriginLat = tileOrigin.lat + 1 + offset;
const nRasterChunks = 3601;
const rasterChunkSize = Math.round(imgWidth * imgWidth / nRasterChunks);
const startTime = new Date(Date.now());

/**
 * Mongo connection and Schema
 */

(async () => {

  // do mongo stuff
  await mongoose.connect(`mongodb+srv://root:${process.env.MONGODB_PASSWORD}@cluster0-gplhv.mongodb.net/elevations?retryWrites=true`,
    {useUnifiedTopology: true, useNewUrlParser: true });

  mongoose.connection
    .on('error', console.error.bind(console, 'connection error:'))
    .on('close', () => console.log('MongoDB disconnected'))
    .once('open', () => console.log('MongoDB connected') );

  // process data
  console.log('Reading image ...'); 
  const tiff = await geoTiff.fromFile(fn);
  const img = await tiff.getImage();
  let raster = await img.readRasters();

  console.log('Getting points ...');

  // FOR TESING ONLY
  // raster[0] = raster[0].slice(0,3611);
  // const rasterChunkSize = Math.round(raster[0].length / nRasterChunks);
  // FOR TESING ONLY
  
  const rasterChunks = Array(nRasterChunks).fill(0).map( (_, i) => raster[0].slice(i * rasterChunkSize + 1, (i + 1) * rasterChunkSize + 1));
  raster = null;      // clear raster from memory
  let chunkNumber = 0;
  
  for (const chunk of rasterChunks) {

    // console.log(`Chunk ${chunkNumber + 1} of ${nRasterChunks}`);
    cursorTo(process.stdout, 0, null);
    process.stdout.write(`Chunk ${chunkNumber + 1} of ${nRasterChunks}`);

    const points = [];
    chunk.forEach( (value, i) => {
      const pixelNumber = chunkNumber + i;
      const x = pixelNumber % imgWidth;
      const y = Math.trunc(pixelNumber / imgWidth);
      console.log(getPoint(y, x, value));
      points.push(getPoint(y, x, value));
    })

    // console.log(points);

    // await ElevationsModel.insertMany(points);
    chunkNumber++;

  }

  // finished so tidy up
  console.log('\r\nFinished in ', timeDiff(Date.now()-startTime));
  mongoose.connection.close();

})()



/**
 * Find the origin of the current tiff tile 
 */
function getTileOrigin(fname) {

  const latStr = fname.match(/[NS]\d{2}/)[0];
  const lngStr = fname.match(/[EW]\d{3}/)[0];

  let lat = parseInt(latStr.slice(1), 10);
  let lng = parseInt(lngStr.slice(1), 10);  

  if (latStr[0] === 'S') { lat = -lat; }
  if (lngStr[0] === 'W') { lng = -lng; }

  return {lng, lat};

}


/**
 * Return a geoJSON representation of the current point, with an elevation property
 */
function getPoint(row, col, elev) {

  const lat = (tiffOriginLat - (row * pixelWidth) - offset).toFixed(6)*1;
  const lng = (tiffOriginLng + (col * pixelWidth) + offset).toFixed(6)*1;

  return {
    elevation: elev,
    position: {
      type: "Point",
      coordinates: [lng, lat]
    }
  }


}



function timeDiff(ms) {

  // var msec = diff;
  const hh = Math.floor(ms / 1000 / 60 / 60);
  ms -= hh * 1000 * 60 * 60;
  const mm = Math.floor(ms / 1000 / 60);
  ms -= mm * 1000 * 60;
  const ss = Math.floor(ms / 1000);
  ms -= ss * 1000;

  return String(hh).padStart(2,'0')+':'+
         String(mm).padStart(2,'0')+':'+
         String(ss).padStart(2,'0')+':'+
         String(ms).padStart(3,'0');
}