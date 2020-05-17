
"use strict";

const geoTiff = require('geoTiff');
const createWriteStream = require('fs').createWriteStream;
const file = createWriteStream('./output.json');
const cursorTo = require('readline').cursorTo;

const fn = './ASTGTMV003_N51W002_dem.tif';
const nPixPerDeg = 3600;
const imgWidth = 3601;
const pixelWidth = 1 / nPixPerDeg;
const offset = pixelWidth / 2;

const tileOrigin = getTileOrigin(fn);
const tiffOriginLng = tileOrigin.lng - offset;
const tiffOriginLat = tileOrigin.lat + 1 + offset;



geoTiff.fromFile(fn)
  .then( tiff => {
    console.log('get image ...');
    return tiff.getImage() })

  .then( img => {
    console.log('read raster ...'); 
    return img.readRasters() })

  .then( raster => {
    console.log('getting points ...');
    raster[0].slice(0,10).forEach( (value, i) => {
      
      console.log('.');
      const x = i % imgWidth;
      const y = Math.trunc(i / imgWidth);

      file.write(JSON.stringify(getPoint(y, x, value) )+ '\r\n');

    })


    // console.log('split into rows ...');
    // const rasterRows = getRowsFromRaster(raster[0], imgWidth);

    // console.log('grouping rows ...');
    // rasterRows.forEach(row => {
    //   console.log('.');
    //   const groups = findGroupsInRow(row);
    //   groups.forEach( grp => {
    //     const polygon = getPolygon(grp);
    //     file.write(JSON.stringify(polygon) + '\r\n');
    //   });
    // })


    // const rows = rasterRows.map(row => findGroupsInRow(row));

    // console.log('convert to polygons and write to file ...');
    // // const polygons = [];
    // rows.forEach( row => {
    //   row.forEach( grp => {
    //     // console.log(grp.row, grp.start, grp.end);
    //     const bbox = getBoundingBox(grp.row, grp.start, grp.end);
    //     // console.log(JSON.stringify(bbox2Polygon(bbox)));
    //     file.write(JSON.stringify(bbox2Polygon(bbox)) + '\r\n');
    //     // polygons.push(bbox2Polygon(bbox));
    //   })
    // })
      
    console.log('done ...');
    
    // console.log('writing to file ...');
    // writeToFile(polygons);

  })



/**
 * Assumes raster represents square image of [pixelsPerRow x pixelsPerRow] dimensions
 */
function getRowsFromRaster(raster, pixelsPerRow) {
  const rows = [];
  for (let i = 0, ny = pixelsPerRow; i < ny; i++) {
    const start = i * pixelsPerRow;
    const end = start + pixelsPerRow;
    const data = raster.slice(start, end);
    rows.push({rowNumber: i, data});
  };
  return rows;
}


function findGroupsInRow(row) {

  const isLastInRow = (i, n) => i === n - 1;
  const hasElevChanged = (lastElev, thisElev) => lastElev !== thisElev;
  const groupsInRow = [];
  const rowNumber = row.rowNumber;
  const data = row.data;

  let pixel0 = 0;
  for (let pixel = 1, nPixels = data.length; pixel < nPixels; pixel++) {
    if ( hasElevChanged(data[pixel], data[pixel-1]) || isLastInRow(pixel, nPixels)) {
      const pixelN = isLastInRow(pixel) ? pixel : pixel - 1;
      groupsInRow.push({row: rowNumber, start: pixel0, end: pixelN, elev: data[pixelN]});
      pixel0 = pixel - 1;
    }
  }
  return groupsInRow;

}


function getPoint(row, col, elev) {
  const lat = (tiffOriginLat - row * pixelWidth + offset).toFixed(8);
  const lng = (tiffOriginLng + col * pixelWidth + offset).toFixed(8);

  return {
    elevation: elev,
    position: {
      type: "Point",
      coordinates: [lng, lat]
    }
  }


}


function getPolygon(row, startColumn, endColumn) {

  const maxLat = (tiffOriginLat - row * pixelWidth).toFixed(8)*1;
  const minLat = (tiffOriginLat - (row + 1) * pixelWidth).toFixed(8)*1;
  const minLng = (tiffOriginLng + startColumn * pixelWidth).toFixed(8)*1;
  const maxLng = (tiffOriginLng + (endColumn + 1) * pixelWidth).toFixed(8)*1;

  const bbox =  {minLat, maxLat, minLng, maxLng};

  return {
    type: "Polygon",
    coordinates: [
      [bbox.minLng, bbox.minLat],
      [bbox.maxLng, bbox.minLat],
      [bbox.maxLng, bbox.maxLat],
      [bbox.minLng, bbox.maxLat],
      [bbox.minLng, bbox.minLat]
    ]}

}


function getTileOrigin(fname) {

  const latStr = fname.match(/[NS]\d{2}/)[0];
  const lngStr = fname.match(/[EW]\d{3}/)[0];

  let lat = parseInt(latStr.slice(1), 10);
  let lng = parseInt(lngStr.slice(1), 10);  

  if (latStr[0] === 'S') {
    lat = -lat;
  }

  if (lngStr[0] === 'W') {
    lng = -lng;
  }

  return {lng, lat};
}


// function writeToFile(polygons) {

//   const file = createWriteStream('./output.json');
//   const nGroups = polygons.length;
//   file.on('finish', () => { resolve(true) });
//   file.on('error', e => console.log(e));
//   file.on('open', () => {

//     Object.keys(groups).forEach( (key, i) => {
//       if ( i % 100000 === 0 || i === nGroups - 1) { 
//         cursorTo(process.stdout, 0, null);
//         process.stdout.write((i/nGroups*100).toFixed(1) + '%');
//       }
//       file.write(JSON.stringify(groups[key]) + '\r\n');
//     })

//     process.stdout.write('\r\n');
//     console.log('done');
//     file.finish;
  
//     });

// }


