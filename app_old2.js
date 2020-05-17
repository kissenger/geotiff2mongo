
"use strict";

const geoTiff = require('geoTiff');
const cursorTo = require('readline').cursorTo;
const createWriteStream = require('fs').createWriteStream;

const fn = './ASTGTMV003_N35E024_dem.tif';

const imgWidth = 3601;

geoTiff.fromFile(fn)
  .then( tiff => {
    console.log('get image ...');
    return tiff.getImage() })

  .then( img => {
    console.log('read raster ...'); 
    return img.readRasters() })

  .then( raster => {
    console.log('group pixels ...');

    // create a new groups collection
    // 

    

    console.log('grouping rows ...');
    const rasterRows = getRowsFromRaster(raster[0], imgWidth);
    const rowGroups = rasterRows.map(row => findGroupsInRow(row));
    
    console.log('merging groups ...');
    const groups = new GroupsCollection(rowGroups);
    groups.findAndMerge();

    console.log('writing to file ...');
    writeToFile(groups);

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
      groupsInRow.push(new Group(rowNumber, pixel0, pixelN, data[pixelN]));
      
      pixel0 = pixel - 1;
    }
  }
  return groupsInRow;

}


class Group{
  constructor(rowNumber, start, end, elev) {
    this.id = '' + rowNumber + start;
    this.elev = elev;
    this[rowNumber] = {
      startEnd: [{start, end}],
      min: start
    }
  }

  makeEmpty() {
    this.id = '';
    this.elev = null;
    Object.keys(this).forEach(key => delete this[key]);
  }

  // asumes group is an instance of Group 
  mergeWith(groupToMerge) {

    let result = false;
    Object.keys(groupToMerge).forEach( key => {
      if (key !== 'id' && key !== 'elev') {
        if (this.getRow(key)) {
          result = this._mergeRow(groupToMerge[key], key)
        } else {
          this[key] = groupToMerge[key];
          result = true;
        }
        groupToMerge[key].startEnd = [];
      }
    })

    return result;

  }

  _mergeRow(rowToMerge, rowNumber) {
    let mergeSuccess = false;
    rowToMerge.startEnd.forEach( se => {
      if (this._isStartEndUnique(this[rowNumber].startEnd, se)) {
        this[rowNumber].startEnd.push(se);
        this[rowNumber].min = Math.min(this[rowNumber].min, rowToMerge.min);
        mergeSuccess = true;
      }
    })
    return mergeSuccess;
  }


  // returns the specified row if it exists, or false if not
  getRow(row) {
    if (!!this[row]) {
      return this[row];
    } else {
      return false;
    }
  }

  _isStartEndUnique(startEndPairs, startEndToFind) {
    return !startEndPairs.some( pair => this._compairPair(pair, startEndToFind));
  }

  _compairPair(pair1, pair2) {
    return pair1.start === pair2.start && pair1.end === pair2.end;
  }


}


class GroupsCollection{

  constructor(rowGroups) {
    this.rows = rowGroups;
    // this.nRowGroups = rowGroups.length;
    this.groups = [];

  }
  
  findAndMerge() {

    let searchGroups = [];
    this.rows.forEach( (rowOfGroups, iRow) => {
      process.stdout.write('.');
      if (iRow === 0) {
        this.groups = [...rowOfGroups];
        searchGroups = [...rowOfGroups];
      } else {

        // while (searchGroups) {
          // process.stdout.write(',');
          // console.log(searchGroups.length);
          searchGroups = this._compareGroups(searchGroups, rowOfGroups, iRow);
        // }

      } 
    })
  }

  _compareGroups(lowerGroups, upperGroups, iRow) {

    // const lowerGroupsModified = [];
    const isLowerToRightOfUpper = (lower, upper) => lower.min > upper.startEnd[0].end;
    const doesElevationMatch = (lowerElev, upperElev) => lowerElev === upperElev;
    const doesStartEndOverlap = (lwr, upr) => lwr.start <= upr.start && lwr.end >= upr.start;

    upperGroups.forEach( upGrp => {

      const upperGroupData = upGrp.getRow(iRow);
      const uppStartEnd = upperGroupData.startEnd[0];
      let catchThisGroup;
      

      // this is a for loop because we need to break out under some conditions
      for (let i = 0; i < lowerGroups.length; i++) {



        let lwGrp = lowerGroups[i];
        const lowerGroupData = lwGrp.getRow(iRow - 1);

        if (isLowerToRightOfUpper(lowerGroupData, upperGroupData)) { 
          break; 
        }


        if (doesElevationMatch(lwGrp.elev, upGrp.elev)) {
          
          lowerGroupData.startEnd.forEach( (lwrStartEnd) => {
            if (doesStartEndOverlap(lwrStartEnd, uppStartEnd)) {
              
              if (!!catchThisGroup && lwGrp.id === catchThisGroup.lw.id) {
                catchThisGroup.up.makeEmpty();
              }
              catchThisGroup = {lw: lwGrp, up: upGrp};
              upGrp.mergeWith(lwGrp);
              lwGrp = upGrp;
            }
          })
        }
      }
    })

    return upperGroups;
  }


    
}




// printProgess
// cursorTo(process.stdout, 0, null);
// process.stdout.write((iRow/nRows*100).toFixed(1) + '%');


function writeToFile(groups) {

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

}




// if (group.rowExists(iRow-1)) {

//   let i = 0;
//   const groupLastRow = group.getRow(iRow-1);
//   console.log(i, groupLastRow, groupLastRow.startEndPairs.length);
//   while (isOverlapPossible(groupLastRow.max, iCol) && i < groupLastRow.startEndPairs.length) {

//     const startEndPair = groupLastRow.startEndPairs[i];
//     console.log(i, startEndPair);
//     if (doRangesOverlap(startEndPair.start, startEndPair.end, iCol0, iColN) && group.elev === elev) {
//       isMerged = true;
//       group.addToGroup(iRow, iCol0, iColN);
//       if (!isDuplicate(alteredGroups, group)) { alteredGroups.push(group); }
//     }

//     i++;

//     // grp[iRow-1].forEach( e => {
//       // console.log(iRow, iCol, e.start, e.end, iCol0, iCol - 1, rangesOverlap(e.start, e.end, iCol0, iCol - 1), 
//       //   rangesOverlap(e.start, e.end, iCol0, iCol - 1) && grp.elev === elev, grp.start >= iCol)
//     console.log(groupLastRow.max, iCol, isOverlapPossible(groupLastRow.max, iCol))
      
//   }
// }
// });


// // no matching group on previous row found, so push a new group
// if (!isMerged) { 
// newGroups.push(new Group(iRow, iCol0, iColN, elev)); 
// }

// iCol0 = iCol;

