/*
 * videojs-docs
 * https://github.com/videojs/videojs-doc-generator
 *
 * Copyright (c) 2013 Brightcove Inc.
 * Licensed under the MIT license.
 */

'use strict';

var esdoc = require('./esdoc'),
    template = require('./docsjson-to-md'),
    fs = require('fs'),
    path = require('path'),
    util= require('util'),
    _ = require('underscore'),
    mkdirp = require('mkdirp');


function collectFiles (source, options, callback) {

  var dirtyFiles = [],
    ignore  = options.ignore || [],
    files   = [];

  // If more paths are given with the --source flag
  if(source.split(',').length > 1){
    var dirtyPaths = source.split(',');

    dirtyPaths.forEach(function(dirtyPath){
      dirtyFiles = dirtyFiles.concat(require('walkdir').sync(path.resolve(process.cwd(), dirtyPath),{follow_symlinks:true}));
    });
  }
  // Just one path given with the --source flag
  else {
    source  = path.resolve(process.cwd(), source);
    dirtyFiles = require('walkdir').sync(source,{follow_symlinks:true}); // tee hee!
  }

  dirtyFiles.forEach(function(file){
    file = path.relative(process.cwd(), file);

    var doNotIgnore = _.all(ignore, function(d){
      // return true if no part of the path is in the ignore list
      return (file.indexOf(d) === -1);
    });

    if ((file.substr(-2) === 'js') && doNotIgnore) {
      files.push(file);
    }
  });
  //console.log(files)
  return files;
};

/**
 * process one or a set of javascript files
 * 
 * @param  {String|Array} files A string or array of file locations
 * @param  {String|Array} [options] An options object
 * @param  {Function} [callback] The callback with err, and a DocsJSON {Object}
 */
module.exports = function (files, options, callback) {
  var dest;

  options = options || {};
  callback = callback || function () {};
  dest = options.dest;

  files = collectFiles("lib", {});
  files = "lib/services/videos.js";




  esdoc.process(files, options, function(err, docEntries){
    var fileHash;

    if (err) { return callback(err); }

  // util.log("The file name is :: "+ JSON.stringify(docEntries));

    fileHash = template(docEntries);

    if (dest) {
      dest = path.resolve(options.dest);

      if (!fs.existsSync(dest)) {
        mkdirp.sync(dest);
      }

      Object.keys(fileHash).forEach(function(fileName){
        fs.writeFileSync(path.resolve(dest + '/' + fileName), fileHash[fileName]);
      });

      callback(err, fileHash);
    } else {
      callback(err, fileHash);
    }
  });

};