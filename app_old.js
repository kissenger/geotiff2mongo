
"use strict"

const geoTiff = require('geoTiff');
const cursorTo = require('readline').cursorTo;
const createWriteStream = require('fs').createWriteStream;

const fn = './ASTGTMV003_N35E024_dem.tif';

const nPixPerDeg = 3600;
const pixelWidth = 1 / nPixPerDeg;
// const offset = pixelWidth / 2;
const imgWidth = 3601;

// const latStr = fn.match(/([NS])(\d{2})/);
// const lngStr = fn.match(/([EW])(\d{3})/);

// const tileOriginLat = latStr[1] === 'S' ? -parseInt(latStr[2], 10) : parseInt(latStr[2], 10);
// const tileOriginLng = lngStr[1] === 'E' ? -parseInt(lngStr[2], 10) : parseInt(lngStr[2], 10);

// const tiffOriginLng = tileOriginLng - offset;
// const tiffOriginLat = tileOriginLat + 1 + offset;

// console.log(tileOriginLat, tileOriginLng);

geoTiff.fromFile(fn)
  .then( tiff => {
    console.log('get image ...');
    return tiff.getImage() })

  .then( img => {
    console.log('read raster ...'); 
    return img.readRasters() })

  .then( raster => {
    console.log('group pixels ...');

    // read raster into array of arrays
    let xyArray = [];
    for (let i = 0, ny = imgWidth; i < ny; i++) {
      const start = i * imgWidth;
      const end = start + imgWidth - 1;
      xyArray.push(raster[0].slice(start, end));
    }

    // loop through each row
    let groups = [];
    let alteredGroups = [];
    let newGroups = [];

    // for (let iRow = 0, nRows = imgWidth; iRow < nRows; iRow++) {
    img.forEach( row => {

      printProgress(row)

      const searchGroups = [...alteredGroups, ...newGroups];
      alteredGroups = [];
      newGroups = [];

      let iCol0 = 0;

      getPixelGroups()

      getPixelGroups() {
        
      }
      for (let iCol = 1, nCols = imgWidth; iCol < nCols; iCol++) {
        const elev = xyArray[iRow][iCol-1];
        
        // if this elevation doesnt match the last one then last element was the end of the previous group
        if ( hasElevationChanged(xyArray[iRow][iCol], elev) || isLastColumn(iCol, nCols) ) {

          const iColN = isLastColumn(iCol, nCols) ? iCol : iCol - 1;
          // look at all the groups from the previous row and if any overlap then add these pixels to that group
          
          // console.log(searchGroups);

          let isMerged = false;
          console.log(searchGroups.length + '--------------------------------');

          searchGroups.forEach( group => {
            console.log(group);

            if (group.rowExists(iRow-1)) {

              let i = 0;
              const groupLastRow = group.getRow(iRow-1);
              console.log(i, groupLastRow, groupLastRow.startEndPairs.length);
              while (isOverlapPossible(groupLastRow.max, iCol) && i < groupLastRow.startEndPairs.length) {

                const startEndPair = groupLastRow.startEndPairs[i];
                console.log(i, startEndPair);
                if (doRangesOverlap(startEndPair.start, startEndPair.end, iCol0, iColN) && group.elev === elev) {
                  isMerged = true;
                  group.addToGroup(iRow, iCol0, iColN);
                  if (!isDuplicate(alteredGroups, group)) { alteredGroups.push(group); }
                }

                i++;

                // grp[iRow-1].forEach( e => {
                  // console.log(iRow, iCol, e.start, e.end, iCol0, iCol - 1, rangesOverlap(e.start, e.end, iCol0, iCol - 1), 
                  //   rangesOverlap(e.start, e.end, iCol0, iCol - 1) && grp.elev === elev, grp.start >= iCol)
                console.log(groupLastRow.max, iCol, isOverlapPossible(groupLastRow.max, iCol))
                  
              }
            }
          });



          // let i = 0;
          // let isMerged = false;
          // let flag = searchGroups.length > 0;
          // // console.log(searchGroups.map(sg=>Object.keys(sg).map(key=>({row: key, startEnd: sg[key]}))));
          // console.log(searchGroups.length + '--------------------------------');
          // while (flag) {
            
          //   const grp = searchGroups[i++];

          //   if (grp.rowExists(iRow-1)) {

          //     // for each set of grouped indexes in the group
          //     grp[iRow-1].forEach( e => {
          //       console.log(iRow, iCol, e.start, e.end, iCol0, iCol - 1, rangesOverlap(e.start, e.end, iCol0, iCol - 1), 
          //         rangesOverlap(e.start, e.end, iCol0, iCol - 1) && grp.elev === elev, grp.start >= iCol)
          //       if (rangesOverlap(e.start, e.end, iCol0, iCol - 1) && grp.elev === elev) {
          //         isMerged = true;
          //         grp.addToGroup(iRow, iCol0, iCol-1);
          //         if (!isDuplicate(alteredGroups, grp)) { alteredGroups.push(grp); }
          //       }
          //     });

          //   }

          //   flag = grp.start < iCol;
          // } 

          // no matching group on previous row found, so push a new group
          if (!isMerged) { 
            newGroups.push(new Group(iRow, iCol0, iColN, elev)); 
          }

          iCol0 = iCol;

        }
        
        
      }
      groups.push(...newGroups);
    }

    console.log('\r\nwriting to file ...');
    const file = createWriteStream('./output.json');
    const nGroups = groups.length;
    file.on('finish', () => { resolve(true) });
    file.on('error', e => console.log(e));
    file.on('open', () => {
      Object.keys(groups).forEach( (key, i) => {
        if ( i % 100000 === 0 || i === nGroups - 1) { 
          cursorTo(process.stdout, 0, null);
          process.stdout.write((i/nGroups*100).toFixed(1) + '%');
        }
        file.write(JSON.stringify(groups[key]) + '\r\n');
      })
      process.stdout.write('\r\n');
      console.log('done');
      file.finish;
    
      });

}).catch( e => console.log(e) );


function doRangesOverlap(lastRowStart, lastRowEnd, thisRowStart, thisRowEnd) {
  return lastRowStart <= thisRowEnd && lastRowEnd >= thisRowStart
}

function isDuplicate(objArray, obj) {
  return objArray.some( o => o.id === obj.id)
}

function isOverlapPossible(thisRangeStart, colIndex) {
  return thisRangeStart > colIndex
}

function hasElevationChanged(lastElevation, thisElevation) {
  return thisElevation !== lastElevation;
}

function isLastColumn(thisColumn, numberOfColumns) {
  return thisColumn === numberOfColumns - 1;
}

class Group{

  constructor(row, start, end, elev) {
    this[row] = {
      max: end, 
      startEndPairs: [{start, end}]
    };
    this.elev = elev; 
    this.id = '' + row + start;
  }
  
  rowExists(row) {
    return !!this[row];
  }

  addToGroup(row, start, end) {
    if (this.rowExists(row)) {
      if( !this.isDuplicateStartEnd(row, start, end)) {
        this[row].startEndPairs.push({start, end});
        this[row].max = end > this[row].max ? end : this[row].ax
      }
    } else {
      this[row] = {
        max: end, 
        startEndPairs: [{start, end}]
      };
    }
  }

  getRow(row) {
    if (this.rowExists(row)) {
      return this[row];
    } else {
      throw new Error('row not found');
    }
  }

  isDuplicateStartEnd(row, start, end) {
    return this[row].startEndPairs
      .map( pair => JSON.stringify(pair))
      .includes(JSON.stringify({start, end}));
  }
  

}

class image{
  constructor() {
    this.rows = [];
  }

  addRow(array) {
    this.rows.push(new imgRow(array));
  }

  
}


class imgRow{
  
  constructor(array) {
    this.elevs = array;
  }

  groupPixels() {
    let i0 = 0;
    const rowGroups = this.elevs.reduce( (_, i, elevs) => {
      if (elevs[i] !== elevs[i-1]) {
        rowGroups.push(new groupWithinRow(i0, i-1, elevs[i-1]))
        i0 = i - 1;
      }
    })
  }

}

class groupWithinRow{
  constructor(start, end, elev) {
    this.start = start;
    this.end = end;
    this.elev = elev;
  }
}



// printProgess
// cursorTo(process.stdout, 0, null);
// process.stdout.write((iRow/nRows*100).toFixed(1) + '%');