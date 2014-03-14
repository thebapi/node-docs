/*
 *
 * Copyright (c) 2014 Sajib Sarkar
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  var docs = require('../');

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('nodeDocs', 'Generate documentation from the node modules', function() {
    var done = this.async();

    // merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      dest: 'docs'
    });

    // log (verbose) options before hooking in the reporter
    grunt.verbose.writeflags(options, 'docs options');

    // assume one set of files per task name
    var src = options.src;
    options.dest =  options.dest;

    docs(src, options, function(err, output){
      // Print a success message.
      grunt.log.writeln('Docs created.');
      done(err);
    });
  });
};