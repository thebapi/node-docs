/*
 * esdoc
 */

'use strict';

var esprima = require('esprima'),
    estraverse = require('estraverse'),
    escope = require('escope'),
    dox = require('dox'),
    fs = require('fs'),
    path = require('path'),
    util = require('util'),
    _ = require('lodash'),
    comment = require('./comment.js');

function generateId (entry) {

  var id, separator, idName;

  id = '';
  separator = (entry.instance) ? '#' : '.';

  if (entry.memberof) {
    id += entry.memberof + separator;
  }

  idName = entry.src.name.replace(/\.js$/, "").split("/").slice(1).join(".")+ separator;
  if (entry.type === 'event') {
    id += 'event:';
  }

  return idName + entry.name;
}

/**
 * process one or a set of javascript files
 * 
 * @param  {String|Array} files A string or array of file locations
 * @param  {Object} [options] An options object
 * @param  {Function} [callback] The callback with err, and a DocsJSON {Object}
 */
exports.process = function(files, options, callback) {
  var docEntries = {};

  options = options || {};
  callback = callback || function(){};
  
  if (!util.isArray(files)) { 
    files = [files];
  }

  files.forEach(function(file){
    var str, parseOptions;

    str = fs.readFileSync(path.resolve(file), { encoding: 'utf-8' });
    parseOptions = {
      srcName: file
    };

    if (options.baseURL) {
      parseOptions.srcURL = options.baseURL + file;
    }

    _.extend(docEntries, exports.parse(str, parseOptions));
  });

  callback(null, docEntries);
};

/**
 * parse a string of javascript
 * 
 * @param  {String} str     The string of javascript
 * @param  {Object} options An options object
 * @return {Array}          A list of doc entries
 */
exports.parse = function(str, options) {
  var entries, ast, nodesByLineNum, commentsByLineNum, codeLines,
      parentObjects, scopeLevel;

  options = options || {};

  // a list of doc entries will be returned
  entries = {};

  // parse AST of js string, Spidermonkey Parser API format
  ast = esprima.parse(str, { comment: true, loc: true, raw: true });

  // { line number: highest node that is defined on the line }
  nodesByLineNum = {};

  // { line number: comment that immediately preceds the line }
  commentsByLineNum = {};

  ast.comments.forEach(function(commentNode){
    // assume block comments with double asterisk only for now, ex. /** */
    if (commentNode.type === 'Block' && commentNode.value.indexOf('*') === 0) {
      // assume the line immediately following the comment is being defined
      commentsByLineNum[commentNode.loc.end.line + 1] = commentNode;
    }
  });

  // split the code string for referencing by line number (1-based array)
  codeLines = ('\n'+str).split('\n');

  // when traversing, track the current object scope
  // ex. when looking at the node for `c` in `a.b = { c: d }`, the scope is a.b
  parentObjects = [];
  // once we get inside function scopes we can't (yet) infer full member IDs
  // and relationships. tags will have to be relied on at that level for now
  scopeLevel = 0;

  // traverse down the abstract syntax tree. weeee!
  estraverse.traverse(ast, {
    // entering a node and all of its children
    enter: function(node, parent){
      debugger;
      var entry, commentNode, commentStr, lineNum, lineStr;

      // the top node in the ast is always 'Program'
      if (node.type === 'Program') {
        return;
      }

      if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
        // we're no longer in global scope. stuff gets hard
        scopeLevel++;
      }

      // if we're diving into an object, keep track of how deep
      if (node.type === 'ObjectExpression') {
        if (parent.type === 'VariableDeclarator') {
          parentObjects.push(parent.id.name);
        } else if (parent.type === 'Property') {
          parentObjects.push(parent.key.name);
        }
      } else if (node.type === 'AssignmentExpression') {
       // parentObjects = parentObjects.concat(getMemberFullName(node.left).split('.'));
      }

      lineNum = node.loc && node.loc.start.line;
      commentNode = commentsByLineNum[lineNum];

      // only document if this line of code has a comment
      // and if this line of code has not been addressed through a higher node
      if (commentNode && !nodesByLineNum[lineNum]) {
        // record that we have addressed this line of code
        nodesByLineNum[lineNum] = node;

        // remove block comment syntax from comment
        commentStr = commentNode.value.replace(/^\*/, '').replace(/^[ \t]*\* ?/gm, '');

        // get the string of the first line of code
        lineStr = codeLines[lineNum].trim();

        // start building a doc entry
        entry = {
          src: {
            line: lineNum
          }
        };

        // ex: "https://github.com/videojs/video.js/blob/master/src/js/core.js"
        if (options.srcURL) {
          entry.src.url = options.srcURL;
        }

        // ex: "src/js/core.js"
        if (options.srcName) {
          entry.src.name = options.srcName;
        }

        // get info from the code string
        _.extend(entry, exports.parseCommentCodeString(lineStr, entry));

//        // get info from the AST
//        _.extend(entry, exports.parseCommentCodeAST(node, {
//          scopeLevel: scopeLevel,
//          parentObjects: parentObjects
//        }));

        // get info from the comment text and tags
        _.extend(entry, comment.parse(commentStr));

        entries[generateId(entry)] = entry;
      }
    },
    // leaving a node and all of its children
    leave: function(node, parent){
      if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
        scopeLevel--;
      }

      if (node.type === 'ObjectExpression') {
        parentObjects.pop();
      } else if (node.type === 'AssignmentExpression') {
        //parentObjects = parentObjects.slice(0, -(getMemberFullName(node.left).split('.').length));
      }
    }
  });

  //entries = analyzeRelationships(entries);

  return entries;
};

/**
 * parse info from the first line of code after a comment
 *
 * @param  {String} str The line of code
 * @return {Object}     Doc entry info
 */
exports.parseCommentCodeString = function(str, passedEntry){
  var context, entry;

  context = dox.parseCodeContext(str);
  entry = {};
 util.log("Printing context");
  util.log(util.inspect(context));
  if (!context) {
    return entry;
  }

  // only set the key if there is a value
  if (context.name) { entry.name = context.name; }
  if (context.type) {
    if (context.type === 'property' || context.type === 'declaration') {
      entry.type = 'member';
    } else if (context.type === 'method' || context.type === 'function') {
      entry.type = 'function';
    }
  }
  if (context.cons) {
    entry.memberof = context.cons;
    entry.instance = true;
  }
  if (context.receiver) {
    entry.memberof = context.receiver;
  }

  if(entry.memberof == "exports"){
    entry.memberof = passedEntry.src.name.replace(/\.js$/, "").split("/").slice(1).join(".");
  }
  return entry;
};

