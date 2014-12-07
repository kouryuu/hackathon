/**
  @preserve
  Copyright Joyent, Inc. and other Node contributors.

  Permission is hereby granted, free of charge, to any person obtaining a
  copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to permit
  persons to whom the Software is furnished to do so, subject to the
  following conditions:

  The above copyright notice and this permission notice shall be included
  in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  USE OR OTHER DEALINGS IN THE SOFTWARE.

  Original at: https://github.com/joyent/node/blob/master/lib/util.js
*/

(function(){
// The maximum length of a line in the stylized output.
var MAX_COLUMNS = 80;
/**
 * Echos the value of a value. Tries to print the value out in the best way
 * possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Boolean} showHidden Flag that shows hidden (not enumerable)
 *    properties of objects.
 * @param {Number} depth Depth in which to descend in object. Default is 2.
 * @param {Boolean} colors Flag to turn on ANSI escape codes to color the
 *    output. Default is false (no coloring).
 */
var inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object.keys(value);
    var keys = showHidden ? Object.getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > MAX_COLUMNS) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};

function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}

function isRegExp(re) {
  var s = '' + re;
  return re instanceof RegExp || // easy case
         // duck-type for context-switching evalcx case
         typeof(re) === 'function' &&
         re.constructor.name === 'RegExp' &&
         re.compile &&
         re.test &&
         re.exec &&
         s.match(/^\/.*\/[gim]{0,3}$/);
}

function isDate(d) {
  return d instanceof Date;
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


var formatRegExp = /%[sdj%]/g;
var format = function(f) {
  if (typeof f !== 'string') {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j': return JSON.stringify(args[i++]);
      case '%%': return '%';
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (x === null || typeof x !== 'object') {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};

var times = {};
self.console = {
  log: function () {
    Sandboss.out(format.apply(this, arguments) + '\n');
  },
  dir: function (obj) {
    Sandboss.out(inspect(obj) + '\n');
  },
  time: function (label) {
    times[label] = Date.now();
  },
  timeEnd: function (label) {
    var duration = Date.now() - times[label];
    self.console.log('%s: %dms', label, duration);
  },
  read: function (cb) {
    cb = cb || function () {};
    Sandboss.input(cb);
  },
  inspect: inspect
};

})();
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var traceur = (function() {
  'use strict';

  /**
   * Builds an object structure for the provided namespace path,
   * ensuring that names that already exist are not overwritten. For
   * example:
   * "a.b.c" -> a = {};a.b={};a.b.c={};
   * @param {string} name Name of the object that this file defines.
   * @private
   */
  function exportPath(name) {
    var parts = name.split('.');
    var cur = traceur;

    for (var part; parts.length && (part = parts.shift());) {
      if (part in cur) {
        cur = cur[part];
      } else {
        cur = cur[part] = {};
      }
    }
    return cur;
  };

  /**
   * @param {string} name
   * @param {!Function} fun
   */
  function define(name, fun) {
    var obj = exportPath(name);
    var exports = fun();
    for (var propertyName in exports) {
      // Maybe we should check the prototype chain here? The current usage
      // pattern is always using an object literal so we only care about own
      // properties.
      var propertyDescriptor = Object.getOwnPropertyDescriptor(exports,
                                                               propertyName);
      if (propertyDescriptor)
        Object.defineProperty(obj, propertyName, propertyDescriptor);
    }
  }

  function assert(b) {
    if (!b)
      throw Error('Assertion failed');
  }

  // Cached path to the current script file in an HTML hosting environment.
  var path;

  // Use comma expression to use global eval.
  var global = ('global', eval)('this');

  var uidCounter = 0;

  /**
   * Returns a new unique ID.
   * @return {number}
   */
  function getUid() {
    return ++uidCounter;
  }

  function inherits(ctor, superCtor, members) {
    var name;
    function BASE() {}
    BASE.prototype = superCtor.prototype;
    ctor.prototype = new BASE();
    for (name in members) {
      if (members.hasOwnProperty(name)) {
        ctor.prototype[name] = members[name];
      }
    }
  }
  global.traceur = {
    define: define,
    assert: assert,
    getUid: getUid,
    inherits: inherits
  };

  return global.traceur;
})();
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('util', function() {
  'use strict';

  /**
   * A simple O(1) object map. It requires that the key object have a
   * {@code uid} property.
   */
  function ObjectMap() {
    this.keys_ = Object.create(null);
    this.values_ = Object.create(null);
  }

  ObjectMap.prototype = {
    put: function(key, value) {
      var uid = key.uid;
      this.keys_[uid] = key;
      this.values_[uid] = value;
    },
    get: function(key) {
      return this.values_[key.uid];
    },
    containsKey: function(key) {
      return key.uid in this.keys_;
    },
    addAll: function(other) {
      for (var uid in other.keys_) {
        this.keys_[uid] = other.keys_[uid];
        this.values_[uid] = other.values_[uid];
      }
    },
    keys: function() {
      return Object.keys(this.keys_).map(function(uid) {
        return this.keys_[uid];
      }, this);
    },
    values: function() {
      return Object.keys(this.values_).map(function(uid) {
        return this.values_[uid];
      }, this);
    },
    remove: function(key) {
      var uid = key.uid;
      delete this.keys_[uid];
      delete this.values_[uid];
    }
  };

  return {
    ObjectMap: ObjectMap
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('util', function() {
  'use strict';

  /**
   * A range of positions in a source string.
   * @param {SourcePosition} start Start is inclusive.
   * @param {SourcePosition} end End is exclusive.
   * @constructor
   */
  function SourceRange(start, end) {
    this.start = start;
    this.end = end;
  }

  return {
    SourceRange: SourceRange
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('util', function() {
  'use strict';

  /**
   * A position in a source string - includes offset, line and column.
   * @param {SourceFile} source
   * @param {number} offset
   * @param {number} line
   * @param {number} column
   * @constructor
   */
  function SourcePosition(source, offset, line, column) {
    this.source = source;
    this.offset = offset;
    this.line = line;
    this.column = column;
  }

  SourcePosition.prototype = {
    toString: function() {
      return (this.source ? this.source.name : '') +
          '(' + (this.line + 1) + ', ' + (this.column + 1) + ')';
    }
  };

  return {
    SourcePosition: SourcePosition
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var assert = traceur.assert;

  /**
   * A Token in a javascript file.
   * Immutable.
   * A plain old data structure. Should contain data members and simple
   * accessors only.
   * @param {traceur.syntax.TokenType} type
   * @param {traceur.util.SourceRange} location
   * @constructor
   */
  function Token(type, location) {
    this.type = type;
    this.location = location;
  }

  Token.prototype = {
    /** @return {traceur.util.SourcePosition} */
    getStart: function() {
      return this.location.start;
    },

    toString: function() {
      return this.type.toString();
    },

    /** @return {traceur.syntax.IdentifierToken} */
    asIdentifier: function() {
      assert(this instanceof traceur.syntax.IdentifierToken);
      return this;
    },

    /** @return {traceur.syntax.LiteralToken} */
    asLiteral: function() {
      assert(this instanceof traceur.syntax.LiteralToken);
      return this;
    }
  };

  // Export
  return {
    Token: Token
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  // 7.5 Tokens
  /**
   * @enum {string}
   */
  var TokenType = {
    END_OF_FILE: 'End of File',
    ERROR: 'error',

    // 7.6 Identifier Names and Identifiers
    IDENTIFIER: 'identifier',

    // 7.6.1.1 keywords
    BREAK: 'break',
    CASE: 'case',
    CATCH: 'catch',
    CONTINUE: 'continue',
    DEBUGGER: 'debugger',
    DEFAULT: 'default',
    DELETE: 'delete',
    DO: 'do',
    ELSE: 'else',
    FINALLY: 'finally',
    FOR: 'for',
    FUNCTION: 'function',
    IF: 'if',
    IN: 'in',
    INSTANCEOF: 'instanceof',
    NEW: 'new',
    RETURN: 'return',
    SWITCH: 'switch',
    THIS: 'this',
    THROW: 'throw',
    TRY: 'try',
    TYPEOF: 'typeof',
    VAR: 'var',
    VOID: 'void',
    WHILE: 'while',
    WITH: 'with',

    // 7.6.1.2 Future reserved words
    CLASS: 'class',
    CONST: 'const',
    ENUM: 'enum',
    EXPORT: 'export',
    EXTENDS: 'extends',
    IMPORT: 'import',
    SUPER: 'super',

    // Future reserved words in strict mode
    IMPLEMENTS: 'implements',
    INTERFACE: 'interface',
    LET: 'let',
    PACKAGE: 'package',
    PRIVATE: 'private',
    PROTECTED: 'protected',
    PUBLIC: 'public',
    STATIC: 'static',
    YIELD: 'yield',

    // 7.7 Punctuators
    OPEN_CURLY: '{',
    CLOSE_CURLY: '}',
    OPEN_PAREN: '(',
    CLOSE_PAREN: ')',
    OPEN_SQUARE: '[',
    CLOSE_SQUARE: ']',
    PERIOD: '.',
    SEMI_COLON: ';',
    COMMA: ',',
    OPEN_ANGLE: '<',
    CLOSE_ANGLE: '>',
    LESS_EQUAL: '<=',
    GREATER_EQUAL: '>=',
    EQUAL_EQUAL: '==',
    NOT_EQUAL: '!=',
    EQUAL_EQUAL_EQUAL: '===',
    NOT_EQUAL_EQUAL: '!==',
    PLUS: '+',
    MINUS: '-',
    STAR: '*',
    PERCENT: '%',
    PLUS_PLUS: '++',
    MINUS_MINUS: '--',
    LEFT_SHIFT: '<<',
    RIGHT_SHIFT: '>>',
    UNSIGNED_RIGHT_SHIFT: '>>>',
    AMPERSAND: '&',
    BAR: '|',
    CARET: '^',
    BANG: '!',
    TILDE: '~',
    AND: '&&',
    OR: '||',
    QUESTION: '?',
    COLON: ':',
    EQUAL: '=',
    PLUS_EQUAL: '+=',
    MINUS_EQUAL: '-=',
    STAR_EQUAL: '*=',
    PERCENT_EQUAL: '%=',
    LEFT_SHIFT_EQUAL: '<<=',
    RIGHT_SHIFT_EQUAL: '>>=',
    UNSIGNED_RIGHT_SHIFT_EQUAL: '>>>=',
    AMPERSAND_EQUAL: '&=',
    BAR_EQUAL: '|=',
    CARET_EQUAL: '^=',
    SLASH: '/',
    SLASH_EQUAL: '/=',
    POUND: '#',

    // 7.8 Literals
    NULL: 'null',
    TRUE: 'true',
    FALSE: 'false',
    NUMBER: 'number literal',
    STRING: 'string literal',
    REGULAR_EXPRESSION: 'regular expression literal',

    // Harmony extensions
    SPREAD: '...',
    AWAIT: 'await'
  };

  return {
    TokenType: TokenType
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * A token representing a javascript literal. Includes string, regexp, and
 * number literals. Boolean and null literals are represented as regular keyword
 * tokens.
 *
 * The value just includes the raw lexeme. For string literals it includes the
 * begining and ending delimiters.
 *
 * TODO: Regexp literals should have their own token type.
 * TODO: A way to get the processed value, rather than the raw value.
 */
traceur.define('syntax', function() {
  'use strict';

  var Token = traceur.syntax.Token;

  /**
   * @param {traceur.syntax.TokenType} type
   * @param {string} value
   * @param {traceur.util.SourceRange} location
   * @constructor
   * @extends {Token}
   */
  function LiteralToken(type, value, location) {
    Token.call(this, type, location);
    this.value = value;
  }

  traceur.inherits(LiteralToken, Token, {
    __proto__: Token.prototype,
    toString: function() {
      return this.value;
    }
  });

  return {
    LiteralToken: LiteralToken
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var Token = traceur.syntax.Token;
  var TokenType = traceur.syntax.TokenType;

  /**
   * A token representing an identifier.
   * @param {traceur.util.SourceRange} location
   * @param {string} value
   * @constructor
   * @extends {Token}
   */
  function IdentifierToken(location, value) {
    Token.call(this, TokenType.IDENTIFIER, location);
    this.value = value;
  }

  traceur.inherits(IdentifierToken, Token, {
    __proto__: Token.prototype,
    toString: function() {
      return this.value;
    }
  });

  return {
    IdentifierToken: IdentifierToken
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;

  /**
   * The javascript keywords.
   */
  var keywords = [
    // 7.6.1.1 Keywords
    'break',
    'case',
    'catch',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'finally',
    'for',
    'function',
    'if',
    'in',
    'instanceof',
    'new',
    'return',
    'switch',
    'this',
    'throw',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',

    // 7.6.1.2 Future Reserved Words
    'class',
    'const',
    'enum',
    'export',
    'extends',
    'import',
    'super',

    // Future Reserved Words in a strict context
    'implements',
    'interface',
    'let',
    'package',
    'private',
    'protected',
    'public',
    'static',
    'yield',

    // 7.8 Literals
    'null',
    'true',
    'false',

    // Traceur Specific
    'await'
  ];

  var Keywords = { };

  var keywordsByName = Object.create(null);
  var keywordsByType = Object.create(null);

  function Keyword(value, type) {
    this.value = value;
    this.type = type;
  }
  Keyword.prototype = {
    toString: function() {
      return this.value;
    }
  };

  keywords.forEach(function(value) {
    var uc = value.toUpperCase();
    if (uc.indexOf('__') === 0) {
      uc = uc.substring(2);
    }

    var kw = new Keyword(value, TokenType[uc]);

    Keywords[uc] = kw;
    keywordsByName[kw.value] = kw;
    keywordsByType[kw.type] = kw;
  });

  Keywords.isKeyword = function(value) {
    return value !== '__proto__' && value in keywordsByName;
  };

  /**
   * @return {TokenType}
   */
  Keywords.getTokenType = function(value) {
    if (value == '__proto__')
      return null;
    return keywordsByName[value].type;
  };

  Keywords.get = function(value) {
    if (value == '__proto__')
      return null;
    return keywordsByName[value];
  };

  //Keywords.get = function(TokenType token) {
  //  return keywordsByType.get(token);
  //}

  // Export
  return {
    Keywords: Keywords
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var SourceRange = traceur.util.SourceRange;
  var SourcePosition = traceur.util.SourcePosition;

  /**
   * Maps offsets into a source string into line/column positions.
   *
   * Immutable.
   *
   * @param {SourceFile} sourceFile
   * @constructor
   */
  function LineNumberTable(sourceFile) {
    this.sourceFile_ = sourceFile;
    this.lineStartOffsets_ = computeLineStartOffsets(sourceFile.contents);
  }

  /**
   * Taken from Closure Library
   */
  function binarySearch(arr, target) {
    var left = 0;
    var right = arr.length - 1;
    while (left <= right) {
      var mid = (left + right) >> 1;
      if (target > arr[mid]) {
        left = mid + 1;
      } else if (target < arr[mid]) {
        right = mid - 1;
      } else {
        return mid;
      }
    }
    // Not found, left is the insertion point.
    return -(left + 1);
  }

  // Largest int that can be distinguished
  // assert(n + 1 === n)
  // assert(n - 1 !== n)
  var MAX_INT_REPRESENTATION = 9007199254740992;

  function computeLineStartOffsets(source) {
    var lineStartOffsets = [];
    lineStartOffsets.push(0);
    for (var index = 0; index < source.length; index++) {
      var ch = source.charAt(index);
      if (isLineTerminator(ch)) {
        if (index < source.length && ch == '\r' &&
            source.charAt(index + 1) == '\n') {
          index++;
        }
        lineStartOffsets.push(index + 1);
      }
    }
    lineStartOffsets.push(MAX_INT_REPRESENTATION);
    return lineStartOffsets;
  }

  function isLineTerminator(ch) {
    switch (ch) {
      case '\n': // Line Feed
      case '\r':  // Carriage Return
      case '\u2028':  // Line Separator
      case '\u2029':  // Paragraph Separator
        return true;
      default:
        return false;
    }
  }

  LineNumberTable.prototype = {
    /**
     * @return {SourcePosition}
     */
    getSourcePosition: function(offset) {
      var line = this.getLine(offset);
      return new SourcePosition(this.sourceFile_, offset, line,
                                this.getColumn(line, offset));
    },

    getLine: function(offset) {
      var index = binarySearch(this.lineStartOffsets_, offset);
      // start of line
      if (index >= 0) {
        return index;
      }
      return -index - 2;
    },

    offsetOfLine: function(line) {
      return this.lineStartOffsets_[line];
    },

    getColumn: function(var_args) {
      var line, offset;
      if (arguments.length >= 2) {
        line = arguments[0];
        offset = arguments[1];
      } else {
        offset = arguments[0];
        line = this.getLine(offset);
      }
      return offset - this.offsetOfLine(line);
    },

    /** @return {SourceRange} */
    getSourceRange: function(startOffset, endOffset) {
      return new SourceRange(this.getSourcePosition(startOffset),
                             this.getSourcePosition(endOffset));
    }
  };

  return {
    LineNumberTable: LineNumberTable
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var LineNumberTable = traceur.syntax.LineNumberTable;

  /**
   * A source file.
   *
   * Immutable.
   *
   * @param {string} name
   * @param {string} content
   * @constructor
   */
  function SourceFile(name, contents) {
    this.name = name;
    this.contents = contents;
    this.lineNumberTable = new LineNumberTable(this);
    this.uid = traceur.getUid();
    Object.freeze(this);
  }

  return {
    SourceFile: SourceFile
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var Token = traceur.syntax.Token;
  var TokenType = traceur.syntax.TokenType;
  var LiteralToken = traceur.syntax.LiteralToken;
  var IdentifierToken = traceur.syntax.IdentifierToken;
  var Keywords = traceur.syntax.Keywords;

  var SourcePosition = traceur.util.SourcePosition;

  /**
   * Scans javascript source code into tokens. All entrypoints assume the
   * caller is not expecting a regular expression literal except for
   * nextRegularExpressionLiteralToken.
   *
   * 7 Lexical Conventions
   *
   * TODO: 7.1 Unicode Format-Control Characters
   *
   * @param {ErrorReport} errorReporter
   * @param {SourceFile} file
   * @param {number=} opt_offset
   * @constructor
   */
  function Scanner(errorReporter, file, opt_offset) {
    this.errorReporter_ = errorReporter;
    this.source_ = file;
    this.index_ = opt_offset || 0;
    this.currentTokens_ = [];
  }

  function isWhitespace(ch) {
    switch (ch) {
      case '\u0009':  // Tab
      case '\u000B':  // Vertical Tab
      case '\u000C':  // Form Feed
      case '\u0020':  // Space
      case '\u00A0':  // No-break space
      case '\uFEFF':  // Byte Order Mark
      case '\n':      // Line Feed
      case '\r':      // Carriage Return
      case '\u2028':  // Line Separator
      case '\u2029':  // Paragraph Separator
        // TODO: there are other Unicode 'Zs' chars that should go here.
        return true;
      default:
        return false;
    }
  }

  // 7.3 Line Terminators
  function isLineTerminator(ch) {
    switch (ch) {
      case '\n': // Line Feed
      case '\r':  // Carriage Return
      case '\u2028':  // Line Separator
      case '\u2029':  // Paragraph Separator
        return true;
      default:
        return false;
    }
  }

  function isDecimalDigit(ch) {
    var cc = ch.charCodeAt(0);
    return cc >= 48 && cc <= 57;
  }

  function isHexDigit(ch) {
    var cc = ch.charCodeAt(0);
    // 0 - 9
    return cc >= 48 && cc <= 57 ||
           // A - F
           cc >= 65 && cc <= 70 ||
           // a - f
           cc >= 97 && cc <= 102;

  }

  function isIdentifierStart(ch) {
    switch (ch) {
      case '$':
      case '_':
        return true;
      default:
        return isUnicodeLetter(ch);
    }
  }

  // This is auto generated from the unicode tables.
  // The tables are at:
  // http://www.fileformat.info/info/unicode/category/Lu/list.htm
  // http://www.fileformat.info/info/unicode/category/Ll/list.htm
  // http://www.fileformat.info/info/unicode/category/Lt/list.htm
  // http://www.fileformat.info/info/unicode/category/Lm/list.htm
  // http://www.fileformat.info/info/unicode/category/Lo/list.htm
  // http://www.fileformat.info/info/unicode/category/Nl/list.htm

  var unicodeLetterTable =
      [[65, 90], [97, 122], [170, 170], [181, 181], [186, 186], [192, 214],
       [216, 246], [248, 705], [710, 721], [736, 740], [748, 748], [750, 750],
       [880, 884], [886, 887], [890, 893], [902, 902], [904, 906], [908, 908],
       [910, 929], [931, 1013], [1015, 1153], [1162, 1319], [1329, 1366],
       [1369, 1369], [1377, 1415], [1488, 1514], [1520, 1522], [1568, 1610],
       [1646, 1647], [1649, 1747], [1749, 1749], [1765, 1766], [1774, 1775],
       [1786, 1788], [1791, 1791], [1808, 1808], [1810, 1839], [1869, 1957],
       [1969, 1969], [1994, 2026], [2036, 2037], [2042, 2042], [2048, 2069],
       [2074, 2074], [2084, 2084], [2088, 2088], [2112, 2136], [2308, 2361],
       [2365, 2365], [2384, 2384], [2392, 2401], [2417, 2423], [2425, 2431],
       [2437, 2444], [2447, 2448], [2451, 2472], [2474, 2480], [2482, 2482],
       [2486, 2489], [2493, 2493], [2510, 2510], [2524, 2525], [2527, 2529],
       [2544, 2545], [2565, 2570], [2575, 2576], [2579, 2600], [2602, 2608],
       [2610, 2611], [2613, 2614], [2616, 2617], [2649, 2652], [2654, 2654],
       [2674, 2676], [2693, 2701], [2703, 2705], [2707, 2728], [2730, 2736],
       [2738, 2739], [2741, 2745], [2749, 2749], [2768, 2768], [2784, 2785],
       [2821, 2828], [2831, 2832], [2835, 2856], [2858, 2864], [2866, 2867],
       [2869, 2873], [2877, 2877], [2908, 2909], [2911, 2913], [2929, 2929],
       [2947, 2947], [2949, 2954], [2958, 2960], [2962, 2965], [2969, 2970],
       [2972, 2972], [2974, 2975], [2979, 2980], [2984, 2986], [2990, 3001],
       [3024, 3024], [3077, 3084], [3086, 3088], [3090, 3112], [3114, 3123],
       [3125, 3129], [3133, 3133], [3160, 3161], [3168, 3169], [3205, 3212],
       [3214, 3216], [3218, 3240], [3242, 3251], [3253, 3257], [3261, 3261],
       [3294, 3294], [3296, 3297], [3313, 3314], [3333, 3340], [3342, 3344],
       [3346, 3386], [3389, 3389], [3406, 3406], [3424, 3425], [3450, 3455],
       [3461, 3478], [3482, 3505], [3507, 3515], [3517, 3517], [3520, 3526],
       [3585, 3632], [3634, 3635], [3648, 3654], [3713, 3714], [3716, 3716],
       [3719, 3720], [3722, 3722], [3725, 3725], [3732, 3735], [3737, 3743],
       [3745, 3747], [3749, 3749], [3751, 3751], [3754, 3755], [3757, 3760],
       [3762, 3763], [3773, 3773], [3776, 3780], [3782, 3782], [3804, 3805],
       [3840, 3840], [3904, 3911], [3913, 3948], [3976, 3980], [4096, 4138],
       [4159, 4159], [4176, 4181], [4186, 4189], [4193, 4193], [4197, 4198],
       [4206, 4208], [4213, 4225], [4238, 4238], [4256, 4293], [4304, 4346],
       [4348, 4348], [4352, 4680], [4682, 4685], [4688, 4694], [4696, 4696],
       [4698, 4701], [4704, 4744], [4746, 4749], [4752, 4784], [4786, 4789],
       [4792, 4798], [4800, 4800], [4802, 4805], [4808, 4822], [4824, 4880],
       [4882, 4885], [4888, 4954], [4992, 5007], [5024, 5108], [5121, 5740],
       [5743, 5759], [5761, 5786], [5792, 5866], [5870, 5872], [5888, 5900],
       [5902, 5905], [5920, 5937], [5952, 5969], [5984, 5996], [5998, 6000],
       [6016, 6067], [6103, 6103], [6108, 6108], [6176, 6263], [6272, 6312],
       [6314, 6314], [6320, 6389], [6400, 6428], [6480, 6509], [6512, 6516],
       [6528, 6571], [6593, 6599], [6656, 6678], [6688, 6740], [6823, 6823],
       [6917, 6963], [6981, 6987], [7043, 7072], [7086, 7087], [7104, 7141],
       [7168, 7203], [7245, 7247], [7258, 7293], [7401, 7404], [7406, 7409],
       [7424, 7615], [7680, 7957], [7960, 7965], [7968, 8005], [8008, 8013],
       [8016, 8023], [8025, 8025], [8027, 8027], [8029, 8029], [8031, 8061],
       [8064, 8116], [8118, 8124], [8126, 8126], [8130, 8132], [8134, 8140],
       [8144, 8147], [8150, 8155], [8160, 8172], [8178, 8180], [8182, 8188],
       [8305, 8305], [8319, 8319], [8336, 8348], [8450, 8450], [8455, 8455],
       [8458, 8467], [8469, 8469], [8473, 8477], [8484, 8484], [8486, 8486],
       [8488, 8488], [8490, 8493], [8495, 8505], [8508, 8511], [8517, 8521],
       [8526, 8526], [8544, 8584], [11264, 11310], [11312, 11358],
       [11360, 11492], [11499, 11502], [11520, 11557], [11568, 11621],
       [11631, 11631], [11648, 11670], [11680, 11686], [11688, 11694],
       [11696, 11702], [11704, 11710], [11712, 11718], [11720, 11726],
       [11728, 11734], [11736, 11742], [11823, 11823], [12293, 12295],
       [12321, 12329], [12337, 12341], [12344, 12348], [12353, 12438],
       [12445, 12447], [12449, 12538], [12540, 12543], [12549, 12589],
       [12593, 12686], [12704, 12730], [12784, 12799], [13312, 13312],
       [19893, 19893], [19968, 19968], [40907, 40907], [40960, 42124],
       [42192, 42237], [42240, 42508], [42512, 42527], [42538, 42539],
       [42560, 42606], [42623, 42647], [42656, 42735], [42775, 42783],
       [42786, 42888], [42891, 42894], [42896, 42897], [42912, 42921],
       [43002, 43009], [43011, 43013], [43015, 43018], [43020, 43042],
       [43072, 43123], [43138, 43187], [43250, 43255], [43259, 43259],
       [43274, 43301], [43312, 43334], [43360, 43388], [43396, 43442],
       [43471, 43471], [43520, 43560], [43584, 43586], [43588, 43595],
       [43616, 43638], [43642, 43642], [43648, 43695], [43697, 43697],
       [43701, 43702], [43705, 43709], [43712, 43712], [43714, 43714],
       [43739, 43741], [43777, 43782], [43785, 43790], [43793, 43798],
       [43808, 43814], [43816, 43822], [43968, 44002], [44032, 44032],
       [55203, 55203], [55216, 55238], [55243, 55291], [63744, 64045],
       [64048, 64109], [64112, 64217], [64256, 64262], [64275, 64279],
       [64285, 64285], [64287, 64296], [64298, 64310], [64312, 64316],
       [64318, 64318], [64320, 64321], [64323, 64324], [64326, 64433],
       [64467, 64829], [64848, 64911], [64914, 64967], [65008, 65019],
       [65136, 65140], [65142, 65276], [65313, 65338], [65345, 65370],
       [65382, 65470], [65474, 65479], [65482, 65487], [65490, 65495],
       [65498, 65500], [65536, 65547], [65549, 65574], [65576, 65594],
       [65596, 65597], [65599, 65613], [65616, 65629], [65664, 65786],
       [65856, 65908], [66176, 66204], [66208, 66256], [66304, 66334],
       [66352, 66378], [66432, 66461], [66464, 66499], [66504, 66511],
       [66513, 66517], [66560, 66717], [67584, 67589], [67592, 67592],
       [67594, 67637], [67639, 67640], [67644, 67644], [67647, 67669],
       [67840, 67861], [67872, 67897], [68096, 68096], [68112, 68115],
       [68117, 68119], [68121, 68147], [68192, 68220], [68352, 68405],
       [68416, 68437], [68448, 68466], [68608, 68680], [69635, 69687],
       [69763, 69807], [73728, 74606], [74752, 74850], [77824, 78894],
       [92160, 92728], [110592, 110593], [119808, 119892], [119894, 119964],
       [119966, 119967], [119970, 119970], [119973, 119974], [119977, 119980],
       [119982, 119993], [119995, 119995], [119997, 120003], [120005, 120069],
       [120071, 120074], [120077, 120084], [120086, 120092], [120094, 120121],
       [120123, 120126], [120128, 120132], [120134, 120134], [120138, 120144],
       [120146, 120485], [120488, 120512], [120514, 120538], [120540, 120570],
       [120572, 120596], [120598, 120628], [120630, 120654], [120656, 120686],
       [120688, 120712], [120714, 120744], [120746, 120770], [120772, 120779],
       [131072, 131072], [173782, 173782], [173824, 173824], [177972, 177972],
       [177984, 177984], [178205, 178205], [194560, 195101]];

  /**
   * UnicodeLetter
   * any character in the Unicode categories "Uppercase letter (Lu)", "Lowercase
   * letter (Ll)", "Titlecase letter (Lt)", "Modifier letter (Lm)", "Other
   * letter (Lo)", or "Letter number (Nl)".
   */
  function isUnicodeLetter(ch) {
    var cc = ch.charCodeAt(0);
    for (var i = 0; i < unicodeLetterTable.length; i++) {
      if (cc < unicodeLetterTable[i][0])
        return false;
      if (cc <= unicodeLetterTable[i][1])
        return true;
    }
    return false;
  }

  Scanner.prototype = {
    /**
     * @type {ErrorReporter}
     * @private
     */
    errorReporter_: null,

    /**
     * @type {SourceFile}
     * @private
     */
    source_: null,

    /**
     * @type {Array.<Token>}
     * @private
     */
    currentTokens_: null,

    /**
     * @type {number}
     * @private
     */
    index_: -1,

    /** @return {LineNumberTable} */
    getLineNumberTable_: function() {
      return this.getFile().lineNumberTable;
    },

    /** @return {SourceFile} */
    getFile: function() {
      return this.source_;
    },

    /** @return {number} */
    getOffset: function() {
      return this.currentTokens_.length == 0 ?
          this.index_ : this.peekToken().location.start.offset;
    },

    /** @return {SourcePosition} */
    getPosition: function() {
      return this.getPosition_(this.getOffset());
    },

    /**
     * @private
     * @return {SourcePosition}
     */
    getPosition_: function(offset) {
      return this.getLineNumberTable_().getSourcePosition(offset);
    },

    /**
     * @return {SourceRange}
     * @private
     */
    getTokenRange_: function(startOffset) {
      return this.getLineNumberTable_().getSourceRange(startOffset,
                                                       this.index_);
    },

    /** @return {Token} */
    nextToken: function() {
      this.peekToken();
      return this.currentTokens_.shift();
    },

    clearTokenLookahead_: function() {
      this.index_ = this.getOffset();
      this.currentTokens_.length = 0;
    },

    /** @return {LiteralToken} */
    nextRegularExpressionLiteralToken: function() {
      this.clearTokenLookahead_();

      var beginToken = this.index_;

      // leading '/'
      this.nextChar_();

      // body
      if (!this.skipRegularExpressionBody_()) {
        return new LiteralToken(TokenType.REGULAR_EXPRESSION,
                                this.getTokenString_(beginToken),
                                this.getTokenRange_(beginToken));
      }

      // separating '/'
      if (this.peekChar_() != '/') {
        this.reportError_('Expected \'/\' in regular expression literal');
        return new LiteralToken(TokenType.REGULAR_EXPRESSION,
                                this.getTokenString_(beginToken),
                                this.getTokenRange_(beginToken));
      }
      this.nextChar_();

      // flags
      while (this.isIdentifierPart_(this.peekChar_())) {
        this.nextChar_();
      }

      return new LiteralToken(TokenType.REGULAR_EXPRESSION,
                              this.getTokenString_(beginToken),
                              this.getTokenRange_(beginToken));
    },

    skipRegularExpressionBody_: function() {
      if (!this.isRegularExpressionFirstChar_(this.peekChar_())) {
        this.reportError_('Expected regular expression first char');
        return false;
      }
      if (!this.skipRegularExpressionChar_()) {
        return false;
      }
      while (!this.isAtEnd_() &&
             this.isRegularExpressionChar_(this.peekChar_())) {
        if (!this.skipRegularExpressionChar_()) {
          return false;
        }
      }
      return true;
    },

    skipRegularExpressionChar_: function() {
      switch (this.peekChar_()) {
        case '\\':
          return this.skipRegularExpressionBackslashSequence_();
        case '[':
          return this.skipRegularExpressionClass_();
        default:
          this.nextChar_();
          return true;
      }
    },

    skipRegularExpressionBackslashSequence_: function() {
      this.nextChar_();
      if (isLineTerminator(this.peekChar_())) {
        this.reportError_('New line not allowed in regular expression literal');
        return false;
      }
      this.nextChar_();
      return true;
    },

    skipRegularExpressionClass_: function() {
      this.nextChar_();
      while (!this.isAtEnd_() && this.peekRegularExpressionClassChar_()) {
        if (!this.skipRegularExpressionClassChar_()) {
          return false;
        }
      }
      if (this.peekChar_() != ']') {
        this.reportError_('\']\' expected');
        return false;
      }
      this.nextChar_();
      return true;
    },

    peekRegularExpressionClassChar_: function() {
      return this.peekChar_() != ']' &&
          !isLineTerminator(this.peekChar_());
    },

    skipRegularExpressionClassChar_: function() {
      if (this.peek_('\\')) {
        return this.skipRegularExpressionBackslashSequence_();
      }
      this.nextChar_();
      return true;
    },

    isRegularExpressionFirstChar_: function(ch) {
      return this.isRegularExpressionChar_(ch) && ch != '*';
    },

    isRegularExpressionChar_: function(ch) {
      switch (ch) {
        case '/':
          return false;
        case '\\':
        case '[':
          return true;
        default:
          return !isLineTerminator(ch);
      }
    },

    /**
     * @return {Token}
     */
    peekToken: function(opt_index) {
      var index = opt_index || 0;
      while (this.currentTokens_.length <= index) {
        this.currentTokens_.push(this.scanToken_());
      }
      return this.currentTokens_[index];
    },

    isAtEnd_: function() {
      return this.index_ >= this.source_.contents.length;
    },

    // 7.2 White Space
    skipWhitespace_: function() {
      while (!this.isAtEnd_() && this.peekWhitespace_()) {
        this.nextChar_();
      }
    },

    peekWhitespace_: function() {
      return isWhitespace(this.peekChar_());
    },

    // 7.4 Comments
    skipComments_: function() {
      while (this.skipComment_()) {}
    },

    skipComment_: function() {
      this.skipWhitespace_();
      if (!this.isAtEnd_() && this.peek_('/')) {
        switch (this.peekChar_(1)) {
          case '/':
            this.skipSingleLineComment_();
            return true;
          case '*':
            this.skipMultiLineComment_();
            return true;
        }
      }
      return false;
    },

    skipSingleLineComment_: function() {
      while (!this.isAtEnd_() && !isLineTerminator(this.peekChar_())) {
        this.nextChar_();
      }
    },

    skipMultiLineComment_: function() {
      this.nextChar_(); // '/'
      this.nextChar_(); // '*'
      while (!this.isAtEnd_() &&
             (this.peekChar_() != '*' || this.peekChar_(1) != '/')) {
        this.nextChar_();
      }
      this.nextChar_();
      this.nextChar_();
    },

    /**
     * @private
     * @return {Token}
     */
    scanToken_: function() {
      this.skipComments_();
      var beginToken = this.index_;
      if (this.isAtEnd_()) {
        return this.createToken_(TokenType.END_OF_FILE, beginToken);
      }
      var ch = this.nextChar_();
      switch (ch) {
        case '{': return this.createToken_(TokenType.OPEN_CURLY, beginToken);
        case '}': return this.createToken_(TokenType.CLOSE_CURLY, beginToken);
        case '(': return this.createToken_(TokenType.OPEN_PAREN, beginToken);
        case ')': return this.createToken_(TokenType.CLOSE_PAREN, beginToken);
        case '[': return this.createToken_(TokenType.OPEN_SQUARE, beginToken);
        case ']': return this.createToken_(TokenType.CLOSE_SQUARE,
            beginToken);
        case '.':
          if (isDecimalDigit(this.peekChar_())) {
            return this.scanNumberPostPeriod_(beginToken);
          }

          // Harmony spread operator
          if (this.peek_('.') && this.peekChar_(1) == '.') {
            this.nextChar_();
            this.nextChar_();
            return this.createToken_(TokenType.SPREAD, beginToken);
          }

          return this.createToken_(TokenType.PERIOD, beginToken);
        case ';': return this.createToken_(TokenType.SEMI_COLON, beginToken);
        case ',': return this.createToken_(TokenType.COMMA, beginToken);
        case '~': return this.createToken_(TokenType.TILDE, beginToken);
        case '?': return this.createToken_(TokenType.QUESTION, beginToken);
        case ':': return this.createToken_(TokenType.COLON, beginToken);
        case '<':
          switch (this.peekChar_()) {
            case '<':
              this.nextChar_();
              if (this.peek_('=')) {
                this.nextChar_();
                return this.createToken_(TokenType.LEFT_SHIFT_EQUAL,
                    beginToken);
              }
              return this.createToken_(TokenType.LEFT_SHIFT, beginToken);
            case '=':
              this.nextChar_();
              return this.createToken_(TokenType.LESS_EQUAL, beginToken);
            default:
              return this.createToken_(TokenType.OPEN_ANGLE, beginToken);
          }
        case '>':
          switch (this.peekChar_()) {
            case '>':
              this.nextChar_();
              switch (this.peekChar_()) {
                case '=':
                  this.nextChar_();
                  return this.createToken_(TokenType.RIGHT_SHIFT_EQUAL,
                                           beginToken);
                case '>':
                  this.nextChar_();
                  if (this.peek_('=')) {
                    this.nextChar_();
                    return this.createToken_(
                        TokenType.UNSIGNED_RIGHT_SHIFT_EQUAL, beginToken);
                  }
                  return this.createToken_(TokenType.UNSIGNED_RIGHT_SHIFT,
                                           beginToken);
                default:
                  return this.createToken_(TokenType.RIGHT_SHIFT, beginToken);
              }
            case '=':
              this.nextChar_();
              return this.createToken_(TokenType.GREATER_EQUAL, beginToken);
            default:
              return this.createToken_(TokenType.CLOSE_ANGLE, beginToken);
          }
        case '=':
          if (this.peek_('=')) {
            this.nextChar_();
            if (this.peek_('=')) {
              this.nextChar_();
              return this.createToken_(TokenType.EQUAL_EQUAL_EQUAL,
                  beginToken);
            }
            return this.createToken_(TokenType.EQUAL_EQUAL, beginToken);
          }
          return this.createToken_(TokenType.EQUAL, beginToken);
        case '!':
          if (this.peek_('=')) {
            this.nextChar_();
            if (this.peek_('=')) {
              this.nextChar_();
              return this.createToken_(TokenType.NOT_EQUAL_EQUAL, beginToken);
            }
            return this.createToken_(TokenType.NOT_EQUAL, beginToken);
          }
          return this.createToken_(TokenType.BANG, beginToken);
        case '*':
          if (this.peek_('=')) {
            this.nextChar_();
            return this.createToken_(TokenType.STAR_EQUAL, beginToken);
          }
          return this.createToken_(TokenType.STAR, beginToken);
        case '%':
          if (this.peek_('=')) {
            this.nextChar_();
            return this.createToken_(TokenType.PERCENT_EQUAL, beginToken);
          }
          return this.createToken_(TokenType.PERCENT, beginToken);
        case '^':
          if (this.peek_('=')) {
            this.nextChar_();
            return this.createToken_(TokenType.CARET_EQUAL, beginToken);
          }
          return this.createToken_(TokenType.CARET, beginToken);
        case '/':
          if (this.peek_('=')) {
            this.nextChar_();
            return this.createToken_(TokenType.SLASH_EQUAL, beginToken);
          }
          return this.createToken_(TokenType.SLASH, beginToken);
        case '+':
          switch (this.peekChar_()) {
            case '+':
              this.nextChar_();
              return this.createToken_(TokenType.PLUS_PLUS, beginToken);
            case '=':
              this.nextChar_();
              return this.createToken_(TokenType.PLUS_EQUAL, beginToken);
            default:
              return this.createToken_(TokenType.PLUS, beginToken);
          }
        case '-':
          switch (this.peekChar_()) {
            case '-':
              this.nextChar_();
              return this.createToken_(TokenType.MINUS_MINUS, beginToken);
            case '=':
              this.nextChar_();
              return this.createToken_(TokenType.MINUS_EQUAL, beginToken);
            default:
              return this.createToken_(TokenType.MINUS, beginToken);
          }
        case '&':
          switch (this.peekChar_()) {
            case '&':
              this.nextChar_();
              return this.createToken_(TokenType.AND, beginToken);
            case '=':
              this.nextChar_();
              return this.createToken_(TokenType.AMPERSAND_EQUAL, beginToken);
            default:
              return this.createToken_(TokenType.AMPERSAND, beginToken);
          }
        case '|':
          switch (this.peekChar_()) {
            case '|':
              this.nextChar_();
              return this.createToken_(TokenType.OR, beginToken);
            case '=':
              this.nextChar_();
              return this.createToken_(TokenType.BAR_EQUAL, beginToken);
            default:
              return this.createToken_(TokenType.BAR, beginToken);
          }
        case '#':
          return this.createToken_(TokenType.POUND, beginToken);
          // TODO: add NumberToken
          // TODO: character following NumericLiteral must not be an
          //       IdentifierStart or DecimalDigit
        case '0':
          return this.scanPostZero_(beginToken);
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          return this.scanPostDigit_(beginToken);
        case '"':
        case '\'':
          return this.scanStringLiteral_(beginToken, ch);
        default:
          return this.scanIdentifierOrKeyword_(beginToken, ch);
      }
    },

    /**
     * @return {Token}
     * @private
     */
    scanNumberPostPeriod_: function(beginToken) {
      this.skipDecimalDigits_();
      return this.scanExponentOfNumericLiteral_(beginToken);
    },

    /**
     * @return {Token}
     * @private
     */
    scanPostDigit_: function(beginToken) {
      this.skipDecimalDigits_();
      return this.scanFractionalNumericLiteral_(beginToken);
    },

    /**
     * @return {Token}
     * @private
     */
    scanPostZero_: function(beginToken) {
      switch (this.peekChar_()) {
        case 'x':
        case 'X':
          this.nextChar_();
          if (!isHexDigit(this.peekChar_())) {
            this.reportError_(
                'Hex Integer Literal must contain at least one digit');
          }
          this.skipHexDigits_();
          return new LiteralToken(TokenType.NUMBER,
                                  this.getTokenString_(beginToken),
                                  this.getTokenRange_(beginToken));
        case '.':
          return this.scanFractionalNumericLiteral_(beginToken);
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          return this.scanPostDigit_(beginToken);
        default:
          return new LiteralToken(TokenType.NUMBER,
                                  this.getTokenString_(beginToken),
                                  this.getTokenRange_(beginToken));
      }
    },

    /**
     * @param {TokenType} type
     * @param {number} beginToken
     * @return {Token}
     * @private
     */
    createToken_: function(type, beginToken) {
      return new Token(type, this.getTokenRange_(beginToken));
    },

    /**
     * @return {Token}
     * @private
     */
    scanIdentifierOrKeyword_: function(beginToken, ch) {
      if (ch == '\\') {
        // TODO: Unicode escape sequence
        throw Error('Unicode escape sequence at line ' +
                    this.getPosition().line);
      }
      if (!isIdentifierStart(ch)) {
        this.reportError_(this.getPosition_(beginToken),
            'Character code \'' +
            ch.charCodeAt(0) +
                    '\' is not a valid identifier start char');
        return this.createToken_(TokenType.ERROR, beginToken);
      }

      while (this.isIdentifierPart_(this.peekChar_())) {
        this.nextChar_();
      }
      if (ch == '\\') {
        // TODO: Unicode escape sequence
        throw Error('Unicode escape sequence at line ' +
                    this.getPosition().line);
      }

      var value = this.source_.contents.substring(beginToken, this.index_);
      if (Keywords.isKeyword(value)) {
        return new Token(Keywords.getTokenType(value),
                         this.getTokenRange_(beginToken));
      }

      return new IdentifierToken(this.getTokenRange_(beginToken), value);
    },

    isIdentifierPart_: function(ch) {
      // TODO: identifier part character classes
      // CombiningMark
      //   Non-Spacing mark (Mn)
      //   Combining spacing mark(Mc)
      // Connector punctuation (Pc)
      // Zero Width Non-Joiner
      // Zero Width Joiner
      return isIdentifierStart(ch) || isDecimalDigit(ch);
    },

    /**
     * @return {Token}
     * @private
     */
    scanStringLiteral_: function(beginIndex, terminator) {
      while (this.peekStringLiteralChar_(terminator)) {
        if (!this.skipStringLiteralChar_()) {
          return new LiteralToken(TokenType.STRING,
                                  this.getTokenString_(beginIndex),
                                  this.getTokenRange_(beginIndex));
        }
      }
      if (this.peekChar_() != terminator) {
        this.reportError_(this.getPosition_(beginIndex),
                          'Unterminated String Literal');
      } else {
        this.nextChar_();
      }
      return new LiteralToken(TokenType.STRING,
                              this.getTokenString_(beginIndex),
                              this.getTokenRange_(beginIndex));
    },

    getTokenString_: function(beginIndex) {
      return this.source_.contents.substring(beginIndex, this.index_);
    },

    peekStringLiteralChar_: function(terminator) {
      return !this.isAtEnd_() && this.peekChar_() != terminator &&
          !isLineTerminator(this.peekChar_());
    },

    skipStringLiteralChar_: function() {
      if (this.peek_('\\')) {
        return this.skipStringLiteralEscapeSequence_();
      }
      this.nextChar_();
      return true;
    },

    skipStringLiteralEscapeSequence_: function() {
      this.nextChar_();
      if (this.isAtEnd_()) {
        this.reportError_('Unterminated string literal escape sequence');
        return false;
      }
      if (isLineTerminator(this.peekChar_())) {
        this.skipLineTerminator_();
        return true;
      }

      switch (this.nextChar_()) {
        case '\'':
        case '"':
        case '\\':
        case 'b':
        case 'f':
        case 'n':
        case 'r':
        case 't':
        case 'v':
        case '0':
          return true;
        case 'x':
          return this.skipHexDigit_() && this.skipHexDigit_();
        case 'u':
          return this.skipHexDigit_() && this.skipHexDigit_() &&
              this.skipHexDigit_() && this.skipHexDigit_();
        default:
          return true;
      }
    },

    skipHexDigit_: function() {
      if (!isHexDigit(this.peekChar_())) {
        this.reportError_('Hex digit expected');
        return false;
      }
      this.nextChar_();
      return true;
    },

    skipLineTerminator_: function() {
      var first = this.nextChar_();
      if (first == '\r' && this.peek_('\n')) {
        this.nextChar_();
      }
    },

    /**
     * @return {LiteralToken}
     * @private
     */
    scanFractionalNumericLiteral_: function(beginToken) {
      if (this.peek_('.')) {
        this.nextChar_();
        this.skipDecimalDigits_();
      }
      return this.scanExponentOfNumericLiteral_(beginToken);
    },

    /**
     * @return {LiteralToken}
     * @private
     */
    scanExponentOfNumericLiteral_: function(beginToken) {
      switch (this.peekChar_()) {
        case 'e':
        case 'E':
          this.nextChar_();
          switch (this.peekChar_()) {
            case '+':
            case '-':
              this.nextChar_();
              break;
          }
          if (!isDecimalDigit(this.peekChar_())) {
            this.reportError_('Exponent part must contain at least one digit');
          }
          this.skipDecimalDigits_();
          break;
        default:
          break;
      }
      return new LiteralToken(TokenType.NUMBER,
                              this.getTokenString_(beginToken),
                              this.getTokenRange_(beginToken));
    },

    skipDecimalDigits_: function() {
      while (isDecimalDigit(this.peekChar_())) {
        this.nextChar_();
      }
    },

    skipHexDigits_: function() {
      while (isHexDigit(this.peekChar_())) {
        this.nextChar_();
      }
    },

    nextChar_: function() {
      if (this.isAtEnd_()) {
        // Work around strict mode bug in Chrome.
        return '\x00';
      }
      return this.source_.contents.charAt(this.index_++);
    },

    peek_: function(ch) {
      return this.peekChar_() == ch;
    },

    peekChar_: function(opt_offset) {
      // Work around strict mode bug in Chrome.
      return this.source_.contents.charAt(
          this.index_ + (opt_offset || 0)) || '\x00';
    },

    reportError_: function(var_args) {
      var position, message;
      if (arguments.length == 1) {
        position = this.getPosition();
        message = arguments[0];
      } else {
        position = arguments[0];
        message = arguments[1];
      }

      this.errorReporter_.reportError(position, message);
    }
  };

  return {
    Scanner: Scanner
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var PredefinedName = {
    ADD_CONTINUATION: 'addContinuation',
    APPLY: 'apply',
    ARGUMENTS: 'arguments',
    ARRAY: 'Array',
    BIND: 'bind',
    CALL: 'call',
    CALLBACK: 'callback',
    CAPTURED_ARGUMENTS: '$arguments',
    CAPTURED_THIS: '$this',
    CAUGHT_EXCEPTION: '$caughtException',
    CLOSE: 'close',
    CONFIGURABLE: 'configurable',
    CONSTRUCTOR: 'constructor',
    CONTINUATION: '$continuation',
    CREATE: 'create',
    CREATE_CALLBACK: '$createCallback',
    CREATE_CLASS: 'createClass',
    CREATE_ERRBACK: '$createErrback',
    CREATE_PROMISE: 'createPromise',
    CREATE_TRAIT: 'createTrait',
    CURRENT: 'current',
    DEFERRED: 'Deferred',
    DEFINE_GETTER: '__defineGetter__',
    DEFINE_PROPERTY: 'defineProperty',
    DEFINE_SETTER: '__defineSetter__',
    ENUMERABLE: 'enumerable',
    ERR: '$err',
    ERRBACK: 'errback',
    FINALLY_FALL_THROUGH: '$finallyFallThrough',
    FIELD_INITIALIZER_METHOD: '$field_initializer_',
    FREEZE: 'freeze',
    GET: 'get',
    INIT: '$init',
    IS_DONE: 'isDone',
    ITERATOR: '__iterator__',
    LENGTH: 'length',
    LOOKUP_GETTER: '__lookupGetter__',
    LOOKUP_SETTER: '__lookupSetter__',
    MIXIN: 'mixin',
    MODULE: 'module',
    MOVE_NEXT: 'moveNext',
    NEW: 'new',
    NEW_STATE: '$newState',
    OBJECT: 'Object',
    OBJECT_NAME: 'Object',
    PARAM: '$param',
    PROTO: '__proto__',
    PROTOTYPE: 'prototype',
    PUSH: 'push',
    REQUIRE: 'require',
    RESOLVE: 'resolve',
    REQUIRES: 'requires',
    REQUIRED: 'required',
    RESULT: '$result',
    RUNTIME: 'runtime',
    SET: 'set',
    SPREAD: 'spread',
    SPREAD_NEW: 'spreadNew',
    SLICE: 'slice',
    STATE: '$state',
    STATIC: '$static',
    STORED_EXCEPTION: '$storedException',
    SUPER_CALL: 'superCall',
    SUPER_GET: 'superGet',
    THAT: '$that',
    THEN: 'then',
    TRACEUR: 'traceur',
    TRAIT: 'trait',
    TYPE_ERROR: 'TypeError',
    UNDEFINED: 'undefined',
    VALUE: 'value',
    $VALUE: '$value',
    WAIT_TASK: '$waitTask',
    WRITABLE: 'writable',
    getParameterName: function(index) {
      // TODO: consider caching these
      return '$' + index;
    }
  };

  // Export
  return {
    PredefinedName: PredefinedName
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax.trees', function() {
  'use strict';

  /**
   * The types of concrete parse trees.
   *
   * The name of the ParseTreeType must match the name of the class that it
   * applies to. For example the DerivedTree class should use
   * ParseTreeType.DERIVED.
   *
   * @enum {string}
   */
  var ParseTreeType = {
    ARGUMENT_LIST: 'ARGUMENT_LIST',
    ARRAY_LITERAL_EXPRESSION: 'ARRAY_LITERAL_EXPRESSION',
    ARRAY_PATTERN: 'ARRAY_PATTERN',
    AWAIT_STATEMENT: 'AWAIT_STATEMENT',
    BINARY_OPERATOR: 'BINARY_OPERATOR',
    BLOCK: 'BLOCK',
    BREAK_STATEMENT: 'BREAK_STATEMENT',
    CALL_EXPRESSION: 'CALL_EXPRESSION',
    CASE_CLAUSE: 'CASE_CLAUSE',
    CATCH: 'CATCH',
    CLASS_DECLARATION: 'CLASS_DECLARATION',
    CLASS_EXPRESSION: 'CLASS_EXPRESSION',
    COMMA_EXPRESSION: 'COMMA_EXPRESSION',
    CONDITIONAL_EXPRESSION: 'CONDITIONAL_EXPRESSION',
    CONTINUE_STATEMENT: 'CONTINUE_STATEMENT',
    DEBUGGER_STATEMENT: 'DEBUGGER_STATEMENT',
    DEFAULT_CLAUSE: 'DEFAULT_CLAUSE',
    DEFAULT_PARAMETER: 'DEFAULT_PARAMETER',
    DO_WHILE_STATEMENT: 'DO_WHILE_STATEMENT',
    EMPTY_STATEMENT: 'EMPTY_STATEMENT',
    EXPORT_DECLARATION: 'EXPORT_DECLARATION',
    EXPORT_PATH: 'EXPORT_PATH',
    EXPORT_PATH_LIST: 'EXPORT_PATH_LIST',
    EXPORT_PATH_SPECIFIER: 'EXPORT_PATH_SPECIFIER',
    EXPORT_PATH_SPECIFIER_SET: 'EXPORT_PATH_SPECIFIER_SET',
    EXPORT_SPECIFIER: 'EXPORT_SPECIFIER',
    EXPORT_SPECIFIER_SET: 'EXPORT_SPECIFIER_SET',
    EXPRESSION_STATEMENT: 'EXPRESSION_STATEMENT',
    FIELD_DECLARATION: 'FIELD_DECLARATION',
    FINALLY: 'FINALLY',
    FORMAL_PARAMETER_LIST: 'FORMAL_PARAMETER_LIST',
    FOR_EACH_STATEMENT: 'FOR_EACH_STATEMENT',
    FOR_IN_STATEMENT: 'FOR_IN_STATEMENT',
    FOR_STATEMENT: 'FOR_STATEMENT',
    FUNCTION_DECLARATION: 'FUNCTION_DECLARATION',
    GET_ACCESSOR: 'GET_ACCESSOR',
    IDENTIFIER_EXPRESSION: 'IDENTIFIER_EXPRESSION',
    IF_STATEMENT: 'IF_STATEMENT',
    IMPORT_DECLARATION: 'IMPORT_DECLARATION',
    IMPORT_PATH: 'IMPORT_PATH',
    IMPORT_SPECIFIER: 'IMPORT_SPECIFIER',
    LABELLED_STATEMENT: 'LABELLED_STATEMENT',
    LITERAL_EXPRESSION: 'LITERAL_EXPRESSION',
    MEMBER_EXPRESSION: 'MEMBER_EXPRESSION',
    MEMBER_LOOKUP_EXPRESSION: 'MEMBER_LOOKUP_EXPRESSION',
    MISSING_PRIMARY_EXPRESSION: 'MISSING_PRIMARY_EXPRESSION',
    MIXIN: 'MIXIN',
    MIXIN_RESOLVE: 'MIXIN_RESOLVE',
    MIXIN_RESOLVE_LIST: 'MIXIN_RESOLVE_LIST',
    MODULE_DECLARATION: 'MODULE_DECLARATION',
    MODULE_DEFINITION: 'MODULE_DEFINITION',
    MODULE_EXPRESSION: 'MODULE_EXPRESSION',
    MODULE_REQUIRE: 'MODULE_REQUIRE',
    MODULE_SPECIFIER: 'MODULE_SPECIFIER',
    NEW_EXPRESSION: 'NEW_EXPRESSION',
    NULL: 'NULL',
    OBJECT_LITERAL_EXPRESSION: 'OBJECT_LITERAL_EXPRESSION',
    OBJECT_PATTERN: 'OBJECT_PATTERN',
    OBJECT_PATTERN_FIELD: 'OBJECT_PATTERN_FIELD',
    PAREN_EXPRESSION: 'PAREN_EXPRESSION',
    POSTFIX_EXPRESSION: 'POSTFIX_EXPRESSION',
    PROGRAM: 'PROGRAM',
    PROPERTY_NAME_ASSIGNMENT: 'PROPERTY_NAME_ASSIGNMENT',
    QUALIFIED_REFERENCE: 'QUALIFIED_REFERENCE',
    REQUIRES_MEMBER: 'REQUIRES_MEMBER',
    REST_PARAMETER: 'REST_PARAMETER',
    RETURN_STATEMENT: 'RETURN_STATEMENT',
    SET_ACCESSOR: 'SET_ACCESSOR',
    SPREAD_EXPRESSION: 'SPREAD_EXPRESSION',
    SPREAD_PATTERN_ELEMENT: 'SPREAD_PATTERN_ELEMENT',
    STATE_MACHINE: 'STATE_MACHINE',
    SUPER_EXPRESSION: 'SUPER_EXPRESSION',
    SWITCH_STATEMENT: 'SWITCH_STATEMENT',
    THIS_EXPRESSION: 'THIS_EXPRESSION',
    THROW_STATEMENT: 'THROW_STATEMENT',
    TRAIT_DECLARATION: 'TRAIT_DECLARATION',
    TRY_STATEMENT: 'TRY_STATEMENT',
    UNARY_EXPRESSION: 'UNARY_EXPRESSION',
    VARIABLE_DECLARATION: 'VARIABLE_DECLARATION',
    VARIABLE_DECLARATION_LIST: 'VARIABLE_DECLARATION_LIST',
    VARIABLE_STATEMENT: 'VARIABLE_STATEMENT',
    WHILE_STATEMENT: 'WHILE_STATEMENT',
    WITH_STATEMENT: 'WITH_STATEMENT',
    YIELD_STATEMENT: 'YIELD_STATEMENT'
  };

  return {
    ParseTreeType: ParseTreeType
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax.trees', function() {
  'use strict';

  var assert = traceur.assert;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;

  var typeToNameMap = Object.create(null);

  // Add the exceptions
  typeToNameMap[ParseTreeType.NULL] = 'NullTree';
  typeToNameMap[ParseTreeType.IMPORT_PATH] = 'ImportPath';

  function getCapitalizedName(type) {
    var name = type.toString();
    return ('_' + name.toLowerCase()).replace(/_(\w)/g, function(_, c) {
      return c.toUpperCase();
    });
  }

  /**
   * This returns the name for a ParseTreeType. For example if the type
   * CASE_CLAUSE is passed in this returns CaseClause.
   * @param {ParseTreeType} type
   * @return {string}
   */
  function getTreeNameForType(type) {
    // Cache.
    if (type in typeToNameMap)
      return typeToNameMap[type];

    var name = getCapitalizedName(type);
    return typeToNameMap[type] = name;
  }

  /**
   * An abstract syntax tree for JavaScript parse trees.
   * Immutable.
   * A plain old data structure. Should include data members and simple
   * accessors only.
   *
   * Derived classes should have a 'Tree' suffix. Each concrete derived class
   * should have a ParseTreeType whose name matches the derived class name.
   *
   * A parse tree derived from source should have a non-null location. A parse
   * tree that is synthesized by the compiler may have a null location.
   *
   * When adding a new subclass of ParseTree you must also do the following:
   *   - add a new entry to ParseTreeType
   *   - modify ParseTreeVisitor.visit(ParseTree) for new ParseTreeType
   *   - add ParseTreeVisitor.visit(XTree)
   *   - modify ParseTreeTransformer.transform(ParseTree) for new ParseTreeType
   *   - add ParseTreeTransformer.transform(XTree)
   *   - add ParseTreeWriter.visit(XTree)
   *   - add ParseTreeValidator.visit(XTree)
   *
   * @param {traceur.syntax.trees.ParseTreeType} type
   * @param {traceur.util.SourceRange} location
   * @constructor
   */
  function ParseTree(type, location) {
    this.type = type;
    this.location = location;
  }

  /**
   * This replacer is for use to when converting to a JSON string if you
   * don't want location. Call JSON.stringfy(tree, ParseTree.stripLocation)
   * @param {string} key
   * @param {*} value
   * @return {*}
   */
  ParseTree.stripLocation = function(key, value) {
    if (key === 'location') {
      return undefined;
    }
    return value;
  };

  ParseTree.prototype = {
    /** @return {boolean} */
    isNull: function() {
      return this.type === ParseTreeType.NULL;
    },

    /** @return {boolean} */
    isPattern: function() {
      switch (this.type) {
        case ParseTreeType.ARRAY_PATTERN:
        case ParseTreeType.OBJECT_PATTERN:
          return true;
        case ParseTreeType.PAREN_EXPRESSION:
          return this.expression.isPattern();
        default:
          return false;
      }
    },

    /** @return {boolean} */
    isLeftHandSideExpression: function() {
      switch (this.type) {
        case ParseTreeType.THIS_EXPRESSION:
        case ParseTreeType.CLASS_EXPRESSION:
        case ParseTreeType.SUPER_EXPRESSION:
        case ParseTreeType.IDENTIFIER_EXPRESSION:
        case ParseTreeType.LITERAL_EXPRESSION:
        case ParseTreeType.ARRAY_LITERAL_EXPRESSION:
        case ParseTreeType.OBJECT_LITERAL_EXPRESSION:
        case ParseTreeType.NEW_EXPRESSION:
        case ParseTreeType.MEMBER_EXPRESSION:
        case ParseTreeType.MEMBER_LOOKUP_EXPRESSION:
        case ParseTreeType.CALL_EXPRESSION:
        case ParseTreeType.FUNCTION_DECLARATION:
          return true;
        case ParseTreeType.PAREN_EXPRESSION:
          return this.expression.isLeftHandSideExpression();
        default:
          return false;
      }
    },

    // TODO: enable classes and traits
    /** @return {boolean} */
    isAssignmentExpression: function() {
      switch (this.type) {
        case ParseTreeType.FUNCTION_DECLARATION:
        case ParseTreeType.BINARY_OPERATOR:
        case ParseTreeType.THIS_EXPRESSION:
        case ParseTreeType.IDENTIFIER_EXPRESSION:
        case ParseTreeType.LITERAL_EXPRESSION:
        case ParseTreeType.ARRAY_LITERAL_EXPRESSION:
        case ParseTreeType.OBJECT_LITERAL_EXPRESSION:
        case ParseTreeType.MISSING_PRIMARY_EXPRESSION:
        case ParseTreeType.CONDITIONAL_EXPRESSION:
        case ParseTreeType.UNARY_EXPRESSION:
        case ParseTreeType.POSTFIX_EXPRESSION:
        case ParseTreeType.MEMBER_EXPRESSION:
        case ParseTreeType.NEW_EXPRESSION:
        case ParseTreeType.CALL_EXPRESSION:
        case ParseTreeType.MEMBER_LOOKUP_EXPRESSION:
        case ParseTreeType.PAREN_EXPRESSION:
        case ParseTreeType.SUPER_EXPRESSION:
          return true;
        default:
          return false;
      }
    },

    // ECMA 262 11.2:
    // MemberExpression :
    //    PrimaryExpression
    //    FunctionExpression
    //    MemberExpression [ Expression ]
    //    MemberExpression . IdentifierName
    //    new MemberExpression Arguments
    /** @return {boolean} */
    isMemberExpression: function() {
      switch (this.type) {
        // PrimaryExpression
        case ParseTreeType.THIS_EXPRESSION:
        case ParseTreeType.CLASS_EXPRESSION:
        case ParseTreeType.SUPER_EXPRESSION:
        case ParseTreeType.IDENTIFIER_EXPRESSION:
        case ParseTreeType.LITERAL_EXPRESSION:
        case ParseTreeType.ARRAY_LITERAL_EXPRESSION:
        case ParseTreeType.OBJECT_LITERAL_EXPRESSION:
        case ParseTreeType.PAREN_EXPRESSION:
        // FunctionExpression
        case ParseTreeType.FUNCTION_DECLARATION:
        // MemberExpression [ Expression ]
        case ParseTreeType.MEMBER_LOOKUP_EXPRESSION:
        // MemberExpression . IdentifierName
        case ParseTreeType.MEMBER_EXPRESSION:
        // CallExpression:
        //   CallExpression . IdentifierName
        case ParseTreeType.CALL_EXPRESSION:
          return true;

        // new MemberExpression Arguments
        case ParseTreeType.NEW_EXPRESSION:
          return this.args != null;
      }

      return false;
    },

    /** @return {boolean} */
    isExpression: function() {
      return this.isAssignmentExpression() ||
          this.type == ParseTreeType.COMMA_EXPRESSION;
    },

    /** @return {boolean} */
    isAssignmentOrSpread: function() {
      return this.isAssignmentExpression() ||
          this.type == ParseTreeType.SPREAD_EXPRESSION;
    },

    /** @return {boolean} */
    isRestParameter: function() {
      return this.type == ParseTreeType.REST_PARAMETER;
    },

    /** @return {boolean} */
    isSpreadPatternElement: function() {
      return this.type == ParseTreeType.SPREAD_PATTERN_ELEMENT;
    },

    /**
     * In V8 any source element may appear where statement appears in the ECMA
     * grammar.
     * @return {boolean}
     */
    isStatement: function() {
      return this.isSourceElement();
    },

    /**
     * This function reflects the ECMA standard, or what we would expect to
     * become the ECMA standard. Most places use isStatement instead which
     * reflects where code on the web diverges from the standard.
     * @return {boolean}
     */
    isStatementStandard: function() {
      switch (this.type) {
        case ParseTreeType.BLOCK:
        case ParseTreeType.AWAIT_STATEMENT:
        case ParseTreeType.VARIABLE_STATEMENT:
        case ParseTreeType.EMPTY_STATEMENT:
        case ParseTreeType.EXPRESSION_STATEMENT:
        case ParseTreeType.IF_STATEMENT:
        case ParseTreeType.DO_WHILE_STATEMENT:
        case ParseTreeType.WHILE_STATEMENT:
        case ParseTreeType.FOR_EACH_STATEMENT:
        case ParseTreeType.FOR_IN_STATEMENT:
        case ParseTreeType.FOR_STATEMENT:
        case ParseTreeType.CONTINUE_STATEMENT:
        case ParseTreeType.BREAK_STATEMENT:
        case ParseTreeType.RETURN_STATEMENT:
        case ParseTreeType.YIELD_STATEMENT:
        case ParseTreeType.WITH_STATEMENT:
        case ParseTreeType.SWITCH_STATEMENT:
        case ParseTreeType.LABELLED_STATEMENT:
        case ParseTreeType.THROW_STATEMENT:
        case ParseTreeType.TRY_STATEMENT:
        case ParseTreeType.DEBUGGER_STATEMENT:
          return true;
        default:
          return false;
      }
    },

    /** @return {boolean} */
    isSourceElement: function() {
      switch (this.type) {
        case ParseTreeType.FUNCTION_DECLARATION:
        case ParseTreeType.CLASS_DECLARATION:
        case ParseTreeType.TRAIT_DECLARATION:
          return true;
      }
      return this.isStatementStandard();
    },

    /** @return {boolean} */
    isProgramElement: function() {
      switch (this.type) {
        case ParseTreeType.VARIABLE_DECLARATION:
        case ParseTreeType.FUNCTION_DECLARATION:
        case ParseTreeType.IMPORT_DECLARATION:
        case ParseTreeType.MODULE_DECLARATION:
        case ParseTreeType.MODULE_DEFINITION:
        case ParseTreeType.EXPORT_DECLARATION:
        case ParseTreeType.CLASS_DECLARATION:
        case ParseTreeType.TRAIT_DECLARATION:
          return true;
      }
      return this.isStatementStandard();
    }
  };

  return {
    getTreeNameForType: getTreeNameForType,
    ParseTree: ParseTree
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax.trees', function() {
  'use strict';

  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;

  var instance;

  /**
   * @constructor
   * @extends {ParseTree}
   */
  function NullTree() {
    if (instance)
      return instance;
    ParseTree.call(this, ParseTreeType.NULL, null);
    Object.freeze(this);
    instance = this;
  }

  traceur.inherits(NullTree, ParseTree, {
    __proto__: ParseTree.prototype
  });

  return {
    NullTree: NullTree
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax.trees', function() {
  'use strict';

  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;

  /**
   * This creates the ParseTree class for the given type and arguments.
   * @param {ParseTreeType} type The type of token this tree represents.
   * @param {...string} var_args Name of the arguments and fields to create on
   *     the class.
   * @return {Function}
   */
  function create(type, var_args) {
    var args = arguments;
    var Tree = function(location) {
      traceur.syntax.trees.ParseTree.call(this, type, location);
      for (var i = 1; i < args.length; i++) {
        this[args[i]] = arguments[i];
      }
      Object.freeze(this);
    };
    traceur.inherits(Tree, ParseTree, {
      __proto__: ParseTree.prototype
    });
    return Tree;
  }

  // All trees but NullTree

  return {
    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} args
     * @constructor
     * @extends {ParseTree}
     */
    ArgumentList: create(
        ParseTreeType.ARGUMENT_LIST,
        'args'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} elements
     * @constructor
     * @extends {ParseTree}
     */
    ArrayLiteralExpression: create(
        ParseTreeType.ARRAY_LITERAL_EXPRESSION,
        'elements'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} elements
     * @constructor
     * @extends {ParseTree}
     */
    ArrayPattern: create(
        ParseTreeType.ARRAY_PATTERN,
        'elements'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {IdentifierToken} identifier
     * @param {ParseTree} expression
     * @constructor
     * @extends {ParseTree}
     */
    AwaitStatement: create(
        ParseTreeType.AWAIT_STATEMENT,
        'identifier',
        'expression'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} left
     * @param {Token} operator
     * @param {ParseTree} right
     * @constructor
     * @extends {ParseTree}
     */
    BinaryOperator: create(
        ParseTreeType.BINARY_OPERATOR,
        'left',
        'operator',
        'right'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} statements
     * @constructor
     * @extends {ParseTree}
     */
    Block: create(
        ParseTreeType.BLOCK,
        'statements'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} name
     * @constructor
     * @extends {ParseTree}
     */
    BreakStatement: create(
        ParseTreeType.BREAK_STATEMENT,
        'name'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} operand
     * @param {ArgumentList} args
     * @constructor
     * @extends {ParseTree}
     */
    CallExpression: create(
        ParseTreeType.CALL_EXPRESSION,
        'operand',
        'args'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} expression
     * @param {Array.<ParseTree>} statements
     * @constructor
     * @extends {ParseTree}
     */
    CaseClause: create(
        ParseTreeType.CASE_CLAUSE,
        'expression',
        'statements'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} exceptionName
     * @param {ParseTree} catchBody
     * @constructor
     * @extends {ParseTree}
     */
    Catch: create(
        ParseTreeType.CATCH,
        'exceptionName',
        'catchBody'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} name
     * @param {ParseTree} superClass
     * @param {Array.<ParseTree>} elements
     * @constructor
     * @extends {ParseTree}
     */
    ClassDeclaration: create(
        ParseTreeType.CLASS_DECLARATION,
        'name',
        'superClass',
        'elements'),

    /**
     * @param {traceur.util.SourceRange} location
     * @constructor
     * @extends {ParseTree}
     */
    ClassExpression: create(ParseTreeType.CLASS_EXPRESSION),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} expressions
     * @constructor
     * @extends {ParseTree}
     */
    CommaExpression: create(
        ParseTreeType.COMMA_EXPRESSION,
        'expressions'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} condition
     * @param {ParseTree} left
     * @param {ParseTree} right
     * @constructor
     * @extends {ParseTree}
     */
    ConditionalExpression: create(
        ParseTreeType.CONDITIONAL_EXPRESSION,
        'condition',
        'left',
        'right'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} name
     * @constructor
     * @extends {ParseTree}
     */
    ContinueStatement: create(
        ParseTreeType.CONTINUE_STATEMENT,
        'name'),

    /**
     * @param {traceur.util.SourceRange} location
     * @constructor
     * @extends {ParseTree}
     */
    DebuggerStatement: create(ParseTreeType.DEBUGGER_STATEMENT),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} statements
     * @constructor
     * @extends {ParseTree}
     */
    DefaultClause: create(
        ParseTreeType.DEFAULT_CLAUSE,
        'statements'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.trees.IdentifierExpression} identifier
     * @param {ParseTree} expression
     * @constructor
     * @extends {ParseTree}
     */
    DefaultParameter: create(
        ParseTreeType.DEFAULT_PARAMETER,
        'identifier',
        'expression'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} body
     * @param {ParseTree} condition
     * @constructor
     * @extends {ParseTree}
     */
    DoWhileStatement: create(
        ParseTreeType.DO_WHILE_STATEMENT,
        'body',
        'condition'),

    /**
     * @param {traceur.util.SourceRange} location
     * @constructor
     * @extends {ParseTree}
     */
    EmptyStatement: create(ParseTreeType.EMPTY_STATEMENT),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} declaration
     * @constructor
     * @extends {ParseTree}
     */
    ExportDeclaration: create(
        ParseTreeType.EXPORT_DECLARATION,
        'declaration'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} paths
     * @constructor
     * @extends {ParseTree}
     */
    ExportPathList: create(ParseTreeType.EXPORT_PATH_LIST, 'paths'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} specifiers
     * @constructor
     * @extends {ParseTree}
     */
    ExportPathSpecifierSet: create(ParseTreeType.EXPORT_PATH_SPECIFIER_SET, 'specifiers'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Token} identifier
     * @param {ParseTree} specifier
     * @constructor
     * @extends {ParseTree}
     */
    ExportPathSpecifier: create(ParseTreeType.EXPORT_PATH_SPECIFIER, 'identifier', 'specifier'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} moduleExpression
     * @param {ParseTree} specifier
     * @constructor
     * @extends {ParseTree}
     */
    ExportPath: create(ParseTreeType.EXPORT_PATH, 'moduleExpression', 'specifier'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Token} lhs
     * @param {Token} rhs
     * @constructor
     * @extends {ParseTree}
     */
    ExportSpecifier: create(ParseTreeType.EXPORT_SPECIFIER, 'lhs', 'rhs'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} specifiers
     * @constructor
     * @extends {ParseTree}
     */
    ExportSpecifierSet: create(ParseTreeType.EXPORT_SPECIFIER_SET, 'specifiers'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} expression
     * @constructor
     * @extends {ParseTree}
     */
    ExpressionStatement: create(
        ParseTreeType.EXPRESSION_STATEMENT,
        'expression'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {boolean} isStatic
     * @param {boolean} isConst
     * @param {Array.<traceur.syntax.trees.VariableDeclaration>}
     *     declarations
     * @constructor
     * @extends {ParseTree}
     */
    FieldDeclaration: create(
        ParseTreeType.FIELD_DECLARATION,
        'isStatic',
        'isConst',
        'declarations'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} block
     * @constructor
     * @extends {ParseTree}
     */
    Finally: create(
        ParseTreeType.FINALLY,
        'block'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.trees.VariableDeclarationList} initializer
     * @param {ParseTree} collection
     * @param {ParseTree} body
     * @constructor
     * @extends {ParseTree}
     */
    ForEachStatement: create(
        ParseTreeType.FOR_EACH_STATEMENT,
        'initializer',
        'collection',
        'body'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} initializer
     * @param {ParseTree} collection
     * @param {ParseTree} body
     * @constructor
     * @extends {ParseTree}
     */
    ForInStatement: create(
        ParseTreeType.FOR_IN_STATEMENT,
        'initializer',
        'collection',
        'body'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} parameters
     * @constructor
     * @extends {ParseTree}
     */
    FormalParameterList: create(
        ParseTreeType.FORMAL_PARAMETER_LIST,
        'parameters'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} initializer
     * @param {ParseTree} condition
     * @param {ParseTree} increment
     * @param {ParseTree} body
     * @constructor
     * @extends {ParseTree}
     */
    ForStatement: create(
        ParseTreeType.FOR_STATEMENT,
        'initializer',
        'condition',
        'increment',
        'body'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} name
     * @param {Boolean} isStatic
     * @param {traceur.syntax.trees.FormalParameterList} formalParameterList
     * @param {traceur.syntax.trees.Block} functionBody
     * @constructor
     * @extends {ParseTree}
     */
    FunctionDeclaration: create(
        ParseTreeType.FUNCTION_DECLARATION,
        'name',
        'isStatic',
        'formalParameterList',
        'functionBody'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.Token} propertyName
     * @param {boolean} isStatic
     * @param {Block} body
     * @constructor
     * @extends {ParseTree}
     */
    GetAccessor: create(
        ParseTreeType.GET_ACCESSOR,
        'propertyName',
        'isStatic',
        'body'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} identifierToken
     * @constructor
     * @extends {ParseTree}
     */
    IdentifierExpression: create(
        ParseTreeType.IDENTIFIER_EXPRESSION,
        'identifierToken'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} condition
     * @param {ParseTree} ifClause
     * @param {ParseTree} elseClause
     * @constructor
     * @extends {ParseTree}
     */
    IfStatement: create(
        ParseTreeType.IF_STATEMENT,
        'condition',
        'ifClause',
        'elseClause'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} importPathList
     * @constructor
     * @extends {ParseTree}
     */
    ImportDeclaration: create(
        ParseTreeType.IMPORT_DECLARATION,
        'importPathList'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.trees.ModuleExpression} moduleExpression
     * @param {traceur.syntax.trees.ImportSpecifierSet} importSpecifierSet
     * @constructor
     * @extends {ParseTree}
     */
    ImportPath: create(
        ParseTreeType.IMPORT_PATH,
        'moduleExpression',
        'importSpecifierSet'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} lhs
     * @param {traceur.syntax.IdentifierToken} rhs
     * @constructor
     * @extends {ParseTree}
     */
    ImportSpecifier: create(
        ParseTreeType.IMPORT_SPECIFIER,
        'lhs',
        'rhs'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {trauce.syntax.Token|
     *     traceur.syntax.IdentifierToken|Array.<ImportSpecifier>} specifiers
     * @constructor
     * @extends {ParseTree}
     */
    ImportSpecifierSet: create(
        ParseTreeType.IMPORT_SPECIFIER_SET,
        'specifiers'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} name
     * @param {ParseTree} statement
     * @constructor
     * @extends {ParseTree}
     */
    LabelledStatement: create(
        ParseTreeType.LABELLED_STATEMENT,
        'name',
        'statement'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.Token} literalToken
     * @constructor
     * @extends {ParseTree}
     */
    LiteralExpression: create(
        ParseTreeType.LITERAL_EXPRESSION,
        'literalToken'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} operand
     * @param {traceur.syntax.IdentifierToken} memberName
     * @constructor
     * @extends {ParseTree}
     */
    MemberExpression: create(
        ParseTreeType.MEMBER_EXPRESSION,
        'operand',
        'memberName'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} operand
     * @param {ParseTree} memberExpression
     * @constructor
     * @extends {ParseTree}
     */
    MemberLookupExpression: create(
        ParseTreeType.MEMBER_LOOKUP_EXPRESSION,
        'operand',
        'memberExpression'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.Token} nextToken
     * @constructor
     * @extends {ParseTree}
     */
    MissingPrimaryExpression: create(
        ParseTreeType.MISSING_PRIMARY_EXPRESSION,
        'nextToken'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} resolves
     * @constructor
     * @extends {ParseTree}
     */
    MixinResolveList: create(
        ParseTreeType.MIXIN_RESOLVE_LIST,
        'resolves'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} from
     * @param {traceur.syntax.IdentifierToken} to
     * @constructor
     * @extends {ParseTree}
     */
    MixinResolve: create(
        ParseTreeType.MIXIN_RESOLVE,
        'from',
        'to'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} name
     * @param {traceur.syntax.trees.MixinResolveList} mixinResolves
     * @constructor
     * @extends {ParseTree}
     */
    Mixin: create(
        ParseTreeType.MIXIN,
        'name',
        'mixinResolves'),


    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} specifiers
     * @constructor
     * @extends {ParseTree}
     */
    ModuleDeclaration: create(
        ParseTreeType.MODULE_DECLARATION,
        'specifiers'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} name
     * @param {Array.<ParseTree>} elements
     * @constructor
     * @extends {ParseTree}
     */
    ModuleDefinition: create(
        ParseTreeType.MODULE_DEFINITION,
        'name',
        'elements'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.trees.ParseTree} reference
     * @param {Array.<traceur.syntax.IdentifierToken>} identifiers
     * @constructor
     * @extends {ParseTree}
     */
    ModuleExpression: create(
        ParseTreeType.MODULE_EXPRESSION,
        'reference',
        'identifiers'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.Token} url
     * @constructor
     * @extends {ParseTree}
     */
    ModuleRequire: create(
        ParseTreeType.MODULE_REQUIRE,
        'url'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} identifier
     * @param {ParseTree} expression
     * @constructor
     * @extends {ParseTree}
     */
    ModuleSpecifier: create(
        ParseTreeType.MODULE_SPECIFIER,
        'identifier',
        'expression'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} operand
     * @param {traceur.syntax.trees.ArgumentList} args
     * @constructor
     * @extends {ParseTree}
     */
    NewExpression: create(
        ParseTreeType.NEW_EXPRESSION,
        'operand',
        'args'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} propertyNameAndValues
     * @constructor
     * @extends {ParseTree}
     */
    ObjectLiteralExpression: create(
        ParseTreeType.OBJECT_LITERAL_EXPRESSION,
        'propertyNameAndValues'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} identifier
     * @param {?ParseTree} element
     * @constructor
     * @extends {ParseTree}
     */
    ObjectPatternField: create(
        ParseTreeType.OBJECT_PATTERN_FIELD,
        'identifier',
        'element'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} fields
     * @constructor
     * @extends {ParseTree}
     */
    ObjectPattern: create(
        ParseTreeType.OBJECT_PATTERN,
        'fields'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} expression
     * @constructor
     * @extends {ParseTree}
     */
    ParenExpression: create(
        ParseTreeType.PAREN_EXPRESSION,
        'expression'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} operand
     * @param {traceur.syntax.Token} operator
     * @constructor
     * @extends {ParseTree}
     */
    PostfixExpression: create(
        ParseTreeType.POSTFIX_EXPRESSION,
        'operand',
        'operator'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {Array.<ParseTree>} programElements
     * @constructor
     * @extends {ParseTree}
     */
    Program: create(
        ParseTreeType.PROGRAM,
        'programElements'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.Token} name
     * @param {ParseTree} value
     * @constructor
     * @extends {ParseTree}
     */
    PropertyNameAssignment: create(
        ParseTreeType.PROPERTY_NAME_ASSIGNMENT,
        'name',
        'value'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} moduleExpression
     * @param {Token} identifier
     * @constructor
     * @extends {ParseTree}
     */
    QualifiedReference: create(ParseTreeType.QUALIFIED_REFERENCE, 'moduleExpression', 'identifier'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} name
     * @constructor
     * @extends {ParseTree}
     */
    RequiresMember: create(
        ParseTreeType.REQUIRES_MEMBER,
        'name'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} identifier
     * @constructor
     * @extends {ParseTree}
     */
    RestParameter: create(
        ParseTreeType.REST_PARAMETER,
        'identifier'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} expression
     * @constructor
     * @extends {ParseTree}
     */
    ReturnStatement: create(
        ParseTreeType.RETURN_STATEMENT,
        'expression'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.Token} propertyName
     * @param {boolean} isStatic
     * @param {traceur.syntax.IdentifierToken} parameter
     * @param {traceur.syntax.trees.Block} body
     * @constructor
     * @extends {ParseTree}
     */
    SetAccessor: create(
        ParseTreeType.SET_ACCESSOR,
        'propertyName',
        'isStatic',
        'parameter',
        'body'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} expression
     * @constructor
     * @extends {ParseTree}
     */
    SpreadExpression: create(
        ParseTreeType.SPREAD_EXPRESSION,
        'expression'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} lvalue
     * @constructor
     * @extends {ParseTree}
     */
    SpreadPatternElement: create(
        ParseTreeType.SPREAD_PATTERN_ELEMENT,
        'lvalue'),

    /**
     * @param {traceur.util.SourceRange} location
     * @constructor
     * @extends {ParseTree}
     */
    SuperExpression: create(ParseTreeType.SUPER_EXPRESSION),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} expression
     * @param {Array.<ParseTree>} caseClauses
     * @constructor
     * @extends {ParseTree}
     */
    SwitchStatement: create(
        ParseTreeType.SWITCH_STATEMENT,
        'expression',
        'caseClauses'),

    /**
     * @param {traceur.util.SourceRange} location
     * @constructor
     * @extends {ParseTree}
     */
    ThisExpression: create(ParseTreeType.THIS_EXPRESSION),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} value
     * @constructor
     * @extends {ParseTree}
     */
    ThrowStatement: create(
        ParseTreeType.THROW_STATEMENT,
        'value'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.IdentifierToken} name
     * @param {Array.<ParseTree>} elements
     * @constructor
     * @extends {ParseTree}
     */
    TraitDeclaration: create(
        ParseTreeType.TRAIT_DECLARATION,
        'name',
        'elements'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} body
     * @param {ParseTree} catchBlock
     * @param {ParseTree} finallyBlock
     * @constructor
     * @extends {ParseTree}
     */
    TryStatement: create(
        ParseTreeType.TRY_STATEMENT,
        'body',
        'catchBlock',
        'finallyBlock'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.Token} operator
     * @param {ParseTree} operand
     * @constructor
     * @extends {ParseTree}
     */
    UnaryExpression: create(
        ParseTreeType.UNARY_EXPRESSION,
        'operator',
        'operand'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.TokenType} declarationType
     * @param {Array.<traceur.syntax.trees.VariableDeclaration>}
     *     declarations
     * @constructor
     * @extends {ParseTree}
     */
    VariableDeclarationList: create(
        ParseTreeType.VARIABLE_DECLARATION_LIST,
        'declarationType',
        'declarations'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} lvalue
     * @param {ParseTree} initializer
     * @constructor
     * @extends {ParseTree}
     */
    VariableDeclaration: create(
        ParseTreeType.VARIABLE_DECLARATION,
        'lvalue',
        'initializer'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {traceur.syntax.trees.VariableDeclarationList} declarations
     * @constructor
     * @extends {ParseTree}
     */
    VariableStatement: create(
        ParseTreeType.VARIABLE_STATEMENT,
        'declarations'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} condition
     * @param {ParseTree} body
     * @constructor
     * @extends {ParseTree}
     */
    WhileStatement: create(
        ParseTreeType.WHILE_STATEMENT,
        'condition',
        'body'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} expression
     * @param {ParseTree} body
     * @constructor
     * @extends {ParseTree}
     */
    WithStatement: create(
        ParseTreeType.WITH_STATEMENT,
        'expression',
        'body'),

    /**
     * @param {traceur.util.SourceRange} location
     * @param {ParseTree} expression
     * @param {boolean} isYieldFor
     * @constructor
     * @extends {ParseTree}
     */
    YieldStatement: create(
        ParseTreeType.YIELD_STATEMENT,
        'expression',
        'isYieldFor')
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('util', function() {
  'use strict';

  /**
   * A conduit for reporting errors and warnings to the user using the Firebug
   * console API.
   */
  function ErrorReporter() {}

  ErrorReporter.prototype = {
    hadError_: false,

    /**
     * @param {traceur.util.SourcePosition} location
     * @param {string} format
     */
    reportError: function(location, format, var_args) {
      this.hadError_ = true;
      var args = Array.prototype.slice.call(arguments, 2);
      this.reportMessageInternal(location, 'error', format, args);
    },

    /**
     * @param {traceur.util.SourcePosition} location
     * @param {string} format
     */
    reportWarning: function(location, format, var_args) {
      var args = Array.prototype.slice.call(arguments, 2);
      this.reportMessageInternal(location, 'warn', format, args);
    },

    /**
     * @param {traceur.util.SourcePosition} location
     * @param {string} kind
     * @param {string} format
     * @param {Array} args
     */
    reportMessageInternal: function(location, kind, format, args) {
      if (location)
        format = location + ': ' + format;
      console[kind].apply(console, [format].concat(args));
    },

    hadError: function() {
      return this.hadError_;
    },

    clearError: function() {
      this.hadError_ = false;
    }
  };

  return {
    ErrorReporter: ErrorReporter
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('util', function() {
  'use strict';

  var ErrorReporter = traceur.util.ErrorReporter;

  /**
   * An error reporter that doesn't output errors; it just records
   * whether an error occurred.
   *
   * <p>{@code MutedErrorReporter} instances are used by the parser to
   * observe whether speculative parses fail before committing to
   * parsing them.
   */
  function MutedErrorReporter() {}

  traceur.inherits(MutedErrorReporter, ErrorReporter, {
    __proto__: ErrorReporter.prototype,

    reportMessageInternal: function(location, message) {
      // message.dropOn(floor);
    }
  });

  return {
    MutedErrorReporter: MutedErrorReporter
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var MutedErrorReporter = traceur.util.MutedErrorReporter;
  var SourceRange = traceur.util.SourceRange;

  var Keywords = traceur.syntax.Keywords;
  var TokenType = traceur.syntax.TokenType;
  var PredefinedName = traceur.syntax.PredefinedName;

  var ArgumentList = traceur.syntax.trees.ArgumentList;
  var ArrayLiteralExpression = traceur.syntax.trees.ArrayLiteralExpression;
  var ArrayPattern = traceur.syntax.trees.ArrayPattern;
  var AwaitStatement = traceur.syntax.trees.AwaitStatement;
  var BinaryOperator = traceur.syntax.trees.BinaryOperator;
  var Block = traceur.syntax.trees.Block;
  var BreakStatement = traceur.syntax.trees.BreakStatement;
  var CallExpression = traceur.syntax.trees.CallExpression;
  var CaseClause = traceur.syntax.trees.CaseClause;
  var Catch = traceur.syntax.trees.Catch;
  var ClassDeclaration = traceur.syntax.trees.ClassDeclaration;
  var ClassExpression = traceur.syntax.trees.ClassExpression;
  var CommaExpression = traceur.syntax.trees.CommaExpression;
  var ConditionalExpression = traceur.syntax.trees.ConditionalExpression;
  var ContinueStatement = traceur.syntax.trees.ContinueStatement;
  var DebuggerStatement = traceur.syntax.trees.DebuggerStatement;
  var DefaultClause = traceur.syntax.trees.DefaultClause;
  var DefaultParameter = traceur.syntax.trees.DefaultParameter;
  var DoWhileStatement = traceur.syntax.trees.DoWhileStatement;
  var EmptyStatement = traceur.syntax.trees.EmptyStatement;
  var ExportDeclaration = traceur.syntax.trees.ExportDeclaration;
  var ExportPath = traceur.syntax.trees.ExportPath;
  var ExportPathList = traceur.syntax.trees.ExportPathList;
  var ExportPathSpecifier = traceur.syntax.trees.ExportPathSpecifier;
  var ExportPathSpecifierSet = traceur.syntax.trees.ExportPathSpecifierSet;
  var ExportSpecifier = traceur.syntax.trees.ExportSpecifier;
  var ExportSpecifierSet = traceur.syntax.trees.ExportSpecifierSet;
  var ExpressionStatement = traceur.syntax.trees.ExpressionStatement;
  var FieldDeclaration = traceur.syntax.trees.FieldDeclaration;
  var Finally = traceur.syntax.trees.Finally;
  var ForEachStatement = traceur.syntax.trees.ForEachStatement;
  var ForInStatement = traceur.syntax.trees.ForInStatement;
  var ForStatement = traceur.syntax.trees.ForStatement;
  var FormalParameterList = traceur.syntax.trees.FormalParameterList;
  var FunctionDeclaration = traceur.syntax.trees.FunctionDeclaration;
  var GetAccessor = traceur.syntax.trees.GetAccessor;
  var IdentifierExpression = traceur.syntax.trees.IdentifierExpression;
  var IdentifierToken = traceur.syntax.IdentifierToken;
  var IfStatement = traceur.syntax.trees.IfStatement;
  var ImportDeclaration = traceur.syntax.trees.ImportDeclaration;
  var ImportPath = traceur.syntax.trees.ImportPath;
  var ImportSpecifier = traceur.syntax.trees.ImportSpecifier;
  var ImportSpecifierSet = traceur.syntax.trees.ImportSpecifierSet;
  var LabelledStatement = traceur.syntax.trees.LabelledStatement;
  var LiteralExpression = traceur.syntax.trees.LiteralExpression;
  var MemberExpression = traceur.syntax.trees.MemberExpression;
  var MemberLookupExpression = traceur.syntax.trees.MemberLookupExpression;
  var MissingPrimaryExpression = traceur.syntax.trees.MissingPrimaryExpression;
  var Mixin = traceur.syntax.trees.Mixin;
  var MixinResolve = traceur.syntax.trees.MixinResolve;
  var MixinResolveList = traceur.syntax.trees.MixinResolveList;
  var ModuleDeclaration = traceur.syntax.trees.ModuleDeclaration;
  var ModuleDefinition = traceur.syntax.trees.ModuleDefinition;
  var ModuleExpression = traceur.syntax.trees.ModuleExpression;
  var ModuleRequire = traceur.syntax.trees.ModuleRequire;
  var ModuleSpecifier = traceur.syntax.trees.ModuleSpecifier;
  var NewExpression = traceur.syntax.trees.NewExpression;
  var NullTree = traceur.syntax.trees.NullTree;
  var ObjectLiteralExpression = traceur.syntax.trees.ObjectLiteralExpression;
  var ObjectPattern = traceur.syntax.trees.ObjectPattern;
  var ObjectPatternField = traceur.syntax.trees.ObjectPatternField;
  var ParenExpression = traceur.syntax.trees.ParenExpression;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var PostfixExpression = traceur.syntax.trees.PostfixExpression;
  var Program = traceur.syntax.trees.Program;
  var PropertyNameAssignment = traceur.syntax.trees.PropertyNameAssignment;
  var QualifiedReference = traceur.syntax.trees.QualifiedReference;
  var RequiresMember = traceur.syntax.trees.RequiresMember;
  var RestParameter = traceur.syntax.trees.RestParameter;
  var ReturnStatement = traceur.syntax.trees.ReturnStatement;
  var SetAccessor = traceur.syntax.trees.SetAccessor;
  var SpreadExpression = traceur.syntax.trees.SpreadExpression;
  var SpreadPatternElement = traceur.syntax.trees.SpreadPatternElement;
  var SuperExpression = traceur.syntax.trees.SuperExpression;
  var SwitchStatement = traceur.syntax.trees.SwitchStatement;
  var ThisExpression = traceur.syntax.trees.ThisExpression;
  var ThrowStatement = traceur.syntax.trees.ThrowStatement;
  var TraitDeclaration = traceur.syntax.trees.TraitDeclaration;
  var TryStatement = traceur.syntax.trees.TryStatement;
  var UnaryExpression = traceur.syntax.trees.UnaryExpression;
  var VariableDeclaration = traceur.syntax.trees.VariableDeclaration;
  var VariableDeclarationList = traceur.syntax.trees.VariableDeclarationList;
  var VariableStatement = traceur.syntax.trees.VariableStatement;
  var WhileStatement = traceur.syntax.trees.WhileStatement;
  var WithStatement = traceur.syntax.trees.WithStatement;
  var YieldStatement = traceur.syntax.trees.YieldStatement;

  /**
   * Parses a javascript file.
   *
   * The various this.parseX_() methods never return null - even when parse errors are encountered.
   * Typically this.parseX_() will return a XTree ParseTree. Each ParseTree that is created includes its
   * source location. The typical pattern for a this.parseX_() method is:
   *
   * XTree this.parseX_() {
   *   var start = this.getTreeStartLocation_();
   *   parse X grammar element and its children
   *   return new XTree(this.getTreeLocation_(start), children);
   * }
   *
   * this.parseX_() methods must consume at least 1 token - even in error cases. This prevents infinite
   * loops in the parser.
   *
   * Many this.parseX_() methods are matched by a 'boolean this.peekX_()' method which will return true if
   * the beginning of an X appears at the current location. There are also this.peek_() methods which
   * examine the next token. this.peek_() methods must not consume any tokens.
   *
   * The this.eat_() method consumes a token and reports an error if the consumed token is not of the
   * expected type. The this.eatOpt_() methods consume the next token iff the next token is of the expected
   * type and return the consumed token or null if no token was consumed.
   *
   * When parse errors are encountered, an error should be reported and the parse should return a best
   * guess at the current parse tree.
   *
   * When parsing lists, the preferred pattern is:
   *   this.eat_(LIST_START);
   *   var elements = [];
   *   while (this.peekListElement_()) {
   *     elements.push(this.parseListElement_());
   *   }
   *   this.eat_(LIST_END);
   */
  function Parser(errorReporter, var_args) {
    this.errorReporter_ = errorReporter;
    var scanner;
    if (arguments[1] instanceof traceur.syntax.Scanner) {
      scanner = arguments[1];
    } else {
      scanner = new traceur.syntax.Scanner(errorReporter, arguments[1],
                                           arguments[2]);
    }
    this.scanner_ = scanner;
  }

  /**
   * Differentiates between parsing for 'In' vs. 'NoIn'
   * Variants of expression grammars.
   */
  var Expression = {
    NO_IN: 'NO_IN',
    NORMAL: 'NORMAL'
  };

  // Kinds of destructuring patterns
  var PatternKind = {
    // A var, let, const; catch head; or formal parameter list--only
    // identifiers are allowed as lvalues
    INITIALIZER: 'INITIALIZER',
    // An assignment or for-in initializer--any lvalue is allowed
    ANY: 'ANY'
  };

  function declarationDestructuringFollow(token) {
    return token === TokenType.EQUAL;
  }

  function arraySubPatternFollowSet(token) {
    return token === TokenType.COMMA || token === TokenType.CLOSE_SQUARE;
  }

  function objectSubPatternFollowSet(token) {
    return token === TokenType.COMMA || token === TokenType.CLOSE_CURLY;
  }

  Parser.prototype = {
    /**
     * @type {Token}
     * @private
     */
    lastToken_: null,

    // 14 Program
    /**
     * @return {Program}
     */
    parseProgram: function(opt_load) {
      //var t = new Timer("Parse Program");
      var start = this.getTreeStartLocation_();
      var programElements = this.parseProgramElements_(!!opt_load);
      this.eat_(TokenType.END_OF_FILE);
      //t.end();
      return new Program(this.getTreeLocation_(start), programElements);
    },

    /**
     * @return {Array.<ParseTree>}
     * @private
     */
    parseProgramElements_: function(load) {
      var result = [];

      while (!this.peek_(TokenType.END_OF_FILE)) {
        result.push(this.parseProgramElement_(load));
      }

      return result;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekProgramElement_: function() {
      return this.peekFunction_() ||
             this.peekVariableDeclarationList_() ||
             this.peekImportDeclaration_() ||
             this.peekExportDeclaration_() ||
             this.peekModuleDeclaration_() ||
             this.peekClassDeclaration_() ||
             this.peekTraitDeclaration_() ||
             this.peekStatement_();
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseProgramElement_: function(load) {
      if (this.peekVariableDeclarationList_()) {
        return this.parseVariableStatement_();
      }
      // Function is handled in parseStatement_
      // Class is handled in parseStatement_
      // Trait is handled in parseStatement_
      if (this.peekImportDeclaration_(load)) {
        return this.parseImportDeclaration_(load);
      }
      if (this.peekExportDeclaration_(load)) {
        return this.parseExportDeclaration_(load);
      }
      if (this.peekModuleDeclaration_(load)) {
        return this.parseModuleDeclaration_(load);
      }
      return this.parseStatement_();
    },

    // ClassDeclaration
    // TraitDeclaration
    // ModuleDeclaration
    // TODO: ImportDeclaration
    // TODO: ScriptBlock
    // Statement (other than BlockStatement)
    // FunctionDeclaration
    /*
    peekScriptElement_: function() {
      return this.peekModuleDeclaration_() ||
              this.peekSourceElement_();
    }
  */

    // module  identifier { ModuleElement* }
    /**
    * @return {boolean}
    * @private
    */
    peekModuleDefinition_: function() {
      return this.peekPredefinedString_(PredefinedName.MODULE) &&
          this.peek_(TokenType.IDENTIFIER, 1) &&
          this.peek_(TokenType.OPEN_CURLY, 2);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseModuleDefinition_: function(load) {

      // ModuleDeclaration ::= "module" ModuleSpecifier(load) ("," ModuleSpecifier(load))* ";"
      //              | ModuleDefinition(load)
      // ModuleDefinition(load) ::= "module" Identifier "{" ModuleBody(load) "}"
      // ModuleSpecifier(load) ::= Identifier "=" ModuleExpression(load)

      var start = this.getTreeStartLocation_();
      this.eatId_(); // module
      var name = this.eatId_();
      this.eat_(TokenType.OPEN_CURLY);
      var result = [];
      while (this.peekModuleElement_()) {
        result.push(this.parseModuleElement_(load));
      }
      this.eat_(TokenType.CLOSE_CURLY);
      return new ModuleDefinition(this.getTreeLocation_(start), name, result);
    },

    // ModuleSpecifier(load) ::= Identifier "=" ModuleExpression(load)
    parseModuleSpecifier_: function(load) {
      var start = this.getTreeStartLocation_();
      var identifier = this.eatId_();
      this.eat_(TokenType.EQUAL);
      var expression = this.parseModuleExpression_(load, false);
      return new ModuleSpecifier(this.getTreeLocation_(start), identifier,
                                 expression);
    },

    parseModuleExpression_: function(load, leaveTrailingIdentifier) {
      // ModuleExpression(load) ::= ModuleReference(load)
      //                         | ModuleExpression(load) "." IdentifierName
      var start = this.getTreeStartLocation_();
      var reference = this.parseModuleReference_(load);
      var identifierNames = [];
      while (this.peek_(TokenType.PERIOD) && this.peekIdName_(1)) {
        if (leaveTrailingIdentifier && !this.peek_(TokenType.PERIOD, 2)) {
          break;
        }
        this.eat_(TokenType.PERIOD);
        identifierNames.push(this.eatIdName_());
      }
      return new ModuleExpression(this.getTreeLocation_(start), reference,
          identifierNames);
    },

    /**
     * @private
     * @return {ModeuleRequireTree|IdentifierExpression}
     */
    parseModuleReference_: function(load) {
      // ModuleReference(load) ::= Identifier
      //                        | [load = true] "require" "(" StringLiteral ")"

      var start = this.getTreeStartLocation_();
      if (load && this.peekPredefinedString_(PredefinedName.REQUIRE)) {
        this.eat_(TokenType.IDENTIFIER); // require
        this.eat_(TokenType.OPEN_PAREN);
        var url = this.eat_(TokenType.STRING);
        this.eat_(TokenType.CLOSE_PAREN);
        return new ModuleRequire(this.getTreeLocation_(start), url);
      }
      return this.parseIdentifierExpression_();
    },

    // ClassDeclaration
    // TraitDeclaration
    // ImportDeclaration
    // ExportDeclaration
    // ModuleDeclaration
    // TODO: ModuleBlock
    // Statement (other than BlockStatement)
    // FunctionDeclaration

    /**
     * @return {boolean}
     * @private
     */
    peekModuleElement_: function() {
      // ModuleElement is currently same as ProgramElement.
      return this.peekProgramElement_();
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseModuleElement_: function(load) {
      // ModuleElement is currently same as ProgramElement.
      return this.parseProgramElement_(load);
    },

    //  ImportDeclaration ::= 'import' ImportPath (',' ImportPath)* ';'
    /**
     * @return {boolean}
     * @private
     */
    peekImportDeclaration_: function() {
      return this.peek_(TokenType.IMPORT);
    },

    // ImportDeclaration(load) ::= "import" ImportPath(load)
    //                                     ("," ImportPath(load))* ";"
    /**
     * @return {ParseTree}
     * @private
     */
    parseImportDeclaration_: function(load) {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.IMPORT);
      var importPathList = [];

      importPathList.push(this.parseImportPath_(load));
      while (this.peek_(TokenType.COMMA)) {
        this.eat_(TokenType.COMMA);
        importPathList.push(this.parseImportPath_(load));
      }
      this.eatPossibleImplicitSemiColon_();

      return new ImportDeclaration(this.getTreeLocation_(start),
          importPathList);
    },

    // ImportPath(load) ::= ModuleExpression(load) "." ImportSpecifierSet
    /**
     * @return {ParseTree}
     * @private
     */
    parseImportPath_: function(load) {
      var start = this.getTreeStartLocation_();

      var moduleExpression = this.parseModuleExpression_(load, true);
      this.eat_(TokenType.PERIOD);
      var importSpecifierSet = this.parseImportSpecifierSet_();

      return new ImportPath(this.getTreeLocation_(start),
          moduleExpression, importSpecifierSet);
    },

    //ImportSpecifierSet ::= "*"
    //                  | IdentifierName
    //                  | "{" (ImportSpecifier ("," ImportSpecifier)*)? ","? "}"
    /**
     * @param {SourcePosition} start
     * @param {Array.<IdentifierToken>} qualifiedPath
     * @return {ParseTree|Token|Array.<Token>}
     * @private
     */
    parseImportSpecifierSet_: function() {
      if (this.peek_(TokenType.OPEN_CURLY)) {
        var start = this.getTreeStartLocation_();
        this.eat_(TokenType.OPEN_CURLY);

        var specifiers = [this.parseImportSpecifier_()];
        while (this.peek_(TokenType.COMMA)) {
          this.eat_(TokenType.COMMA);
          if (this.peek_(TokenType.CLOSE_CURLY))
            break;
          specifiers.push(this.parseImportSpecifier_());
        }
        this.eat_(TokenType.CLOSE_CURLY);

        return new ImportSpecifierSet(this.getTreeLocation_(start), specifiers);
      }

      if (this.peek_(TokenType.STAR)) {
        var star = this.eat_(TokenType.STAR);
        return new ImportSpecifierSet(this.getTreeLocation_(start), star);
      }

      return this.parseIdentifierExpression_();
    },

    // ImportSpecifier ::= IdentifierName (":" Identifier)?
    /**
     * @return {ParseTree}
     * @private
     */
    parseImportSpecifier_: function() {
      var start = this.getTreeStartLocation_();
      var lhs = this.eatIdName_();
      var rhs = null;
      if (this.peek_(TokenType.COLON)) {
        this.eat_(TokenType.COLON);
        rhs = this.eatId_();
      }
      return new ImportSpecifier(this.getTreeLocation_(start),
          lhs, rhs);
    },

    // export  VariableStatement
    // export  FunctionDeclaration
    // export  ConstStatement
    // export  ClassDeclaration
    // export  TraitDeclaration
    // export  module  ModuleDefinition
    // TODO: export  module ModuleLoad (',' ModuleLoad)* ';'
    // TODO: export  ExportPath (',' ExportPath)* ';'
    /**
     * @return {boolean}
     * @private
     */
    peekExportDeclaration_: function(load) {
      return this.peek_(TokenType.EXPORT);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseExportDeclaration_: function(load) {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.EXPORT);
      var exportTree;
      switch (this.peekType_()) {
        case TokenType.VAR:
        case TokenType.CONST:
          exportTree = this.parseVariableStatement_();
          break;
        case TokenType.FUNCTION:
        case TokenType.POUND:
          exportTree = this.parseFunctionDeclaration_();
          break;
        case TokenType.CLASS:
          exportTree = this.parseClassDeclaration_();
          break;
        case TokenType.IDENTIFIER:
          if (this.peekModuleDeclaration_(load)) {
            exportTree = this.parseModuleDeclaration_(load);
          } else if (this.peekTraitDeclaration_()) {
            exportTree = this.parseTraitDeclaration_();
          } else if (this.peekExportPath_()) {
            exportTree = this.parseExportPathList_();
            this.eatPossibleImplicitSemiColon_();
          } else {
            throw Error('unreached');
          }
          break;
        case TokenType.OPEN_CURLY:
          exportTree = this.parseExportPathList_();
          this.eatPossibleImplicitSemiColon_();
          break;
        default:
          this.reportError_('Unexpected symbol \'' + this.peekToken_() + '\'');
          return null;
      }
      return new ExportDeclaration(this.getTreeLocation_(start), exportTree);
    },

    parseExportPathList_: function() {
      // This is part of the ExportDeclaration production
      // ExportPath ("," ExportPath)*
      var start = this.getTreeStartLocation_();
      var paths = [this.parseExportPath_()];
      while (this.peek_(TokenType.COMMA)) {
        this.eat_(TokenType.COMMA);
        paths.push(this.parseExportPath_());
      }
      return new ExportPathList(this.getTreeEndLocation_(start), paths);
    },

    peekExportPath_: function() {
      return this.peek_(TokenType.OPEN_CURLY) || this.peekId_();
    },

    parseExportPath_: function() {
      // ExportPath ::= ModuleExpression(false) "." ExportSpecifierSet
      //             | ExportPathSpecifierSet
      //             | Identifier

      if (this.peek_(TokenType.OPEN_CURLY))
        return this.parseExportPathSpecifierSet_();

      if (this.peek_(TokenType.PERIOD, 1)) {
        var start = this.getTreeStartLocation_();
        var expression = this.parseModuleExpression_(false, true);
        this.eat_(TokenType.PERIOD);
        var specifierSet = this.parseExportSpecifierSet_();
        return new ExportPath(start, expression, specifierSet);
      }

      return this.parseIdentifierExpression_();
    },

    peekExportSpecifierSet_: function() {
      return this.peek_(TokenType.OPEN_CURLY) ||
          this.peekIdName_();
    },

    parseExportSpecifierSet_: function() {
      // ExportSpecifierSet ::= IdentifierName
      //     | "{" ExportSpecifier ("," ExportSpecifier)* ","? "}"

      if (!this.peek_(TokenType.OPEN_CURLY))
        return this.parseIdentifierExpression_();

      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.OPEN_CURLY);
      var specifiers = [this.parseExportSpecifier_()];
      while (this.peek_(TokenType.COMMA)) {
        this.eat_(TokenType.COMMA);
        if (this.peek_(TokenType.CLOSE_CURLY))
          break;
        specifiers.push(this.parseExportSpecifier_());
      }
      this.eat_(TokenType.CLOSE_CURLY);

      return new ExportSpecifierSet(this.getTreeLocation_(start),
          specifiers);
    },

    parseExportSpecifier_: function() {
      // ExportSpecifier ::= IdentifierName (":" IdentifierName)?

      var start = this.getTreeStartLocation_();
      var lhs = this.eatIdName_();
      var rhs = null;
      if (this.peek_(TokenType.COLON)) {
        this.eat_(TokenType.COLON);
        rhs = this.eatIdName_();
      }
      return new ExportSpecifier(this.getTreeLocation_(start), lhs, rhs);
    },

    peekId_: function() {
      return this.peek_(TokenType.IDENTIFIER);
    },

    peekIdName_: function(opt_index) {
      var type = this.peekType_(opt_index);
      return type == TokenType.IDENTIFIER || Keywords.isKeyword(type);
    },

    peekExportPathSpecifierSet_: function() {
      return this.peek_(TokenType.OPEN_CURLY) && this.peekExportPathSpecifier_(1);
    },

    parseExportPathSpecifierSet_: function() {
      // ExportPathSpecifierSet ::= "{" ExportPathSpecifier ("," ExportPathSpecifier)* ","? "}"
      var start = this.getTreeStartLocation_();

      this.eat_(TokenType.OPEN_CURLY);
      var specifiers = [this.parseExportPathSpecifier_()];
      while (this.peek_(TokenType.COMMA)) {
        this.eat_(TokenType.COMMA);
        if (this.peek_(TokenType.CLOSE_CURLY))
          break;
        specifiers.push(this.parseExportPathSpecifier_());
      }
      this.eat_(TokenType.CLOSE_CURLY);

      return new ExportPathSpecifierSet(this.getTreeLocation_(start),
                                        specifiers);
    },

    peekExportPathSpecifier_: function(opt_index) {
      return this.peekIdName_(opt_index);
    },

    parseExportPathSpecifier_: function() {
      // ExportPathSpecifier ::= Identifier
      //                      | IdentifierName ":" Identifier
      //                      | IdentifierName ":" QualifiedReference

      if (!this.peek_(TokenType.COLON, 1))
        return this.parseIdentifierExpression_();

      var start = this.getTreeStartLocation_();
      var identifier = this.eatIdName_();
      this.eat_(TokenType.COLON);

      var specifier;
      if (this.peek_(TokenType.PERIOD, 1))
        specifier = this.parseQualifiedReference_();
      else
        specifier = this.parseIdentifierExpression_();

      return new ExportPathSpecifier(this.getTreeLocation_(start),
                                     identifier, specifier);
    },

    parseQualifiedReference_: function() {
      // QualifiedReference ::= ModuleExpression(false) "." IdentifierName

      var start = this.getTreeStartLocation_();
      var moduleExpression = this.parseModuleExpression_(false, true);
      this.eat_(TokenType.PERIOD);
      var identifierName = this.eatIdName_();

      return new QualifiedReference(this.getTreeLocation_(start),
          moduleExpression, identifierName);
    },

    // TODO: ModuleLoadRedeclarationList
    // ModuleDefinition
    /**
     * @return {boolean}
     * @private
     */
    peekModuleDeclaration_: function() {
      // ModuleDeclaration ::= "module" ModuleSpecifier(load) ("," ModuleSpecifier(load))* ";"
      //                    | ModuleDefinition(load)
      // ModuleDefinition(load) ::= "module" Identifier "{" ModuleBody(load) "}"
      // ModuleSpecifier(load) ::= Identifier "=" ModuleExpression(load)
      return this.peekPredefinedString_(PredefinedName.MODULE) &&
          this.peek_(TokenType.IDENTIFIER, 1) &&
          (this.peek_(TokenType.EQUAL, 2) ||
           this.peek_(TokenType.OPEN_CURLY, 2));
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseModuleDeclaration_: function(load) {
      if (this.peekModuleDefinition_(load))
        return this.parseModuleDefinition_(load);

      var start = this.getTreeStartLocation_();
      this.eatId_(); // module

      var specifiers = [this.parseModuleSpecifier_(load)];
      while (this.peek_(TokenType.COMMA)) {
        this.eat_(TokenType.COMMA);
        specifiers.push(this.parseModuleSpecifier_(load));
      }
      this.eatPossibleImplicitSemiColon_();
      return new ModuleDeclaration(this.getTreeLocation_(start),
          specifiers);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekTraitDeclaration_: function() {
      return this.peekPredefinedString_(PredefinedName.TRAIT);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseTraitDeclaration_: function() {
      var start = this.getTreeStartLocation_();
      this.eatId_(); // trait
      var name = this.eatId_();
      this.eat_(TokenType.OPEN_CURLY);
      var elements = this.parseTraitElements_();
      this.eat_(TokenType.CLOSE_CURLY);
      return new TraitDeclaration(this.getTreeLocation_(start), name, elements);
    },

    /**
     * @return {Array.<ParseTree>}
     * @private
     */
    parseTraitElements_: function() {
      var result = [];

      while (this.peekTraitElement_()) {
        result.push(this.parseTraitElement_());
      }

      return result;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekTraitElement_: function() {
      // TODO: require statement
      // TODO: mixin statement
      // TODO: access modifiers
      switch (this.peekType_()) {
        case TokenType.FUNCTION:
        case TokenType.POUND:
        case TokenType.IDENTIFIER:
          return true;
        default:
          return false;
      }
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseTraitElement_: function() {
      // TODO: fields?
      // TODO: allow static in traits?
      // TODO: access modifiers
      if (this.peekGetAccessor_(false)) {
        return this.parseGetAccessor_();
      }
      if (this.peekSetAccessor_(false)) {
        return this.parseSetAccessor_();
      }
      if (this.peekMixin_()) {
        return this.parseMixin_();
      }
      if (this.peekRequiresMember_()) {
        return this.parseRequiresMember_();
      }

      return this.parseMethodDeclaration_(false);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekRequiresMember_: function() {
      return this.peekPredefinedString_(PredefinedName.REQUIRES) && this.peek_(TokenType.IDENTIFIER, 1);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseRequiresMember_: function() {
      var start = this.getTreeStartLocation_();
      this.eatId_(); // requires
      var name = this.eatId_();
      this.eat_(TokenType.SEMI_COLON);
      return new RequiresMember(this.getTreeLocation_(start), name);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekMixin_: function() {
      return this.peekPredefinedString_(PredefinedName.MIXIN) && this.peek_(TokenType.IDENTIFIER, 1);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekClassDeclaration_: function() {
      return this.peek_(TokenType.CLASS);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseClassDeclaration_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.CLASS);
      var name = this.eatId_();
      var superClass = null;
      if (this.peek_(TokenType.COLON)) {
        this.eat_(TokenType.COLON);
        superClass = this.parseExpression_();
      }
      this.eat_(TokenType.OPEN_CURLY);
      var elements = this.parseClassElements_();
      this.eat_(TokenType.CLOSE_CURLY);
      return new ClassDeclaration(this.getTreeLocation_(start), name, superClass, elements);
    },

    /**
     * @return {Array.<ParseTree>}
     * @private
     */
    parseClassElements_: function() {
      var result = [];

      while (this.peekClassElement_()) {
        result.push(this.parseClassElement_());
      }

      return result;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekClassElement_: function() {
      switch (this.peekType_()) {
        case TokenType.FUNCTION:
        case TokenType.POUND:
        case TokenType.IDENTIFIER:
        case TokenType.VAR:
        case TokenType.CONST:
        case TokenType.CLASS:
        case TokenType.NEW:
          return true;
        default:
          return false;
      }
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseClassElement_: function() {
      if (this.peekConstructorDeclaration_()) {
        return this.parseConstructorDeclaration_();
      }
      if (this.peekMethodDeclaration_()) {
        return this.parseMethodDeclaration_(true);
      }
      // TODO: access modifiers
      if (this.peekGetAccessor_(true)) {
        return this.parseGetAccessor_();
      }
      if (this.peekSetAccessor_(true)) {
        return this.parseSetAccessor_();
      }
      if (this.peekMixin_()) {
        return this.parseMixin_();
      }
      if (this.peekRequiresMember_()) {
        return this.parseRequiresMember_();
      }

      return this.parseFieldDeclaration_();
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseFieldDeclaration_: function() {
      var start = this.getTreeStartLocation_();

      var isStatic = this.eatOpt_(TokenType.CLASS) != null;

      var binding = this.peekType_();
      var isConst = false;
      switch (binding) {
        case TokenType.CONST:
          this.eat_(TokenType.CONST);
          isConst = true;
          break;
        case TokenType.VAR:
          this.eat_(TokenType.VAR);
          break;
      }

      var declarations = [];

      declarations.push(this.parseVariableDeclaration_(isStatic, binding, Expression.NORMAL));
      while (this.peek_(TokenType.COMMA)) {
        this.eat_(TokenType.COMMA);
        declarations.push(this.parseVariableDeclaration_(isStatic, binding, Expression.NORMAL));
      }
      this.eat_(TokenType.SEMI_COLON);
      return new FieldDeclaration(
          this.getTreeLocation_(start), isStatic, isConst, declarations);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseMixin_: function() {
      var start = this.getTreeStartLocation_();
      this.eatId_(); // mixin
      var name = this.eatId_();
      var mixinResolves = null;
      if (this.peek_(TokenType.OPEN_CURLY)) {
        mixinResolves = this.parseMixinResolves_();
      }
      this.eat_(TokenType.SEMI_COLON);
      return new Mixin(this.getTreeLocation_(start), name, mixinResolves);
    },

    /**
     * @return {MixinResolveList}
     * @private
     */
    parseMixinResolves_: function() {
      var start = this.getTreeStartLocation_();
      var result = [];

      this.eat_(TokenType.OPEN_CURLY);
      while (this.peek_(TokenType.IDENTIFIER)) {
        result.push(this.parseMixinResolve_());
        if (null == this.eatOpt_(TokenType.COMMA)) {
          break;
        }
      }
      this.eat_(TokenType.CLOSE_CURLY);

      return new MixinResolveList(this.getTreeLocation_(start), result);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseMixinResolve_: function() {
      var start = this.getTreeStartLocation_();
      // TODO: need distinguishing syntax for 'requires' resolves
      // requires x,
      var from = this.eatId_();
      this.eat_(TokenType.COLON);
      var to = this.eatId_();
      return new MixinResolve(this.getTreeLocation_(start), from, to);
    },

    /**
     * @param {boolean} allowStatic
     * @return {ParseTree}
     * @private
     */
    parseMethodDeclaration_: function(allowStatic) {
      var start = this.getTreeStartLocation_();
      var isStatic = allowStatic && this.eatOpt_(TokenType.CLASS) != null;
      if (this.peekFunction_()) {
        this.nextToken_(); // function or #
      }
      return this.parseFunctionDeclarationTail_(start, isStatic, this.eatId_());
    },

    /**
     * @return {boolean}
     * @private
     */
    peekMethodDeclaration_: function() {
      var index = this.peek_(TokenType.CLASS) ? 1 : 0;
      return this.peekFunction_(index) ||
          (this.peek_(TokenType.IDENTIFIER, index) && this.peek_(TokenType.OPEN_PAREN, index + 1));
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseConstructorDeclaration_: function() {
      var start = this.getTreeStartLocation_();
      var isStatic = this.eatOpt_(TokenType.CLASS) != null;
      return this.parseFunctionDeclarationTail_(start, isStatic, this.eatIdName_());
    },

    /**
     * @return {boolean}
     * @private
     */
    peekConstructorDeclaration_: function() {
      var index = this.peek_(TokenType.CLASS) ? 1 : 0;
      return this.peek_(TokenType.NEW, index) &&
          this.peek_(TokenType.OPEN_PAREN, index + 1);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseSourceElement_: function() {
      if (this.peekFunction_()) {
        return this.parseFunctionDeclaration_();
      }
      if (this.peekClassDeclaration_()) {
        return this.parseClassDeclaration_();
      }
      if (this.peekTraitDeclaration_()) {
        return this.parseTraitDeclaration_();
      }

      // Harmony let block scoped bindings. let can only appear in
      // a block, not as a standalone statement: if() let x ... illegal
      if (this.peek_(TokenType.LET)) {
        return this.parseVariableStatement_();
      }
      // const and var are handled inside parseStatement

      return this.parseStatementStandard_();
    },

    /**
     * @return {boolean}
     * @private
     */
    peekSourceElement_: function() {
      return this.peekFunction_() || this.peekClassDeclaration_() ||
          this.peekTraitDeclaration_() || this.peekStatementStandard_() ||
          this.peek_(TokenType.LET);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekFunction_: function(opt_index) {
      var index = opt_index || 0;
      return this.peek_(TokenType.FUNCTION, index) || this.peek_(TokenType.POUND, index);
    },

    // 13 Function Definition
    /**
     * @return {ParseTree}
     * @private
     */
    parseFunctionDeclaration_: function() {
      var start = this.getTreeStartLocation_();
      this.nextToken_(); // function or #
      return this.parseFunctionDeclarationTail_(start, false, this.eatId_());
    },

    /**
     * @param {SourcePosition} start
     * @param {boolean} isStatic
     * @param {IdentifierToken} name
     * @return {ParseTree}
     * @private
     */
    parseFunctionDeclarationTail_: function(start, isStatic, name) {
      this.eat_(TokenType.OPEN_PAREN);
      var formalParameterList = this.parseFormalParameterList_();
      this.eat_(TokenType.CLOSE_PAREN);
      var functionBody = this.parseFunctionBody_();
      return new FunctionDeclaration(this.getTreeLocation_(start), name, isStatic, formalParameterList, functionBody);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseFunctionExpression_: function() {
      var start = this.getTreeStartLocation_();
      this.nextToken_(); // function or #
      var name = this.eatIdOpt_();
      this.eat_(TokenType.OPEN_PAREN);
      var formalParameterList = this.parseFormalParameterList_();
      this.eat_(TokenType.CLOSE_PAREN);
      var functionBody = this.parseFunctionBody_();
      return new FunctionDeclaration(this.getTreeLocation_(start), name, false, formalParameterList, functionBody);
    },

    /**
     * @return {FormalParameterList}
     * @private
     */
    parseFormalParameterList_: function() {
      // FormalParameterList :
      //   ... Identifier
      //   FormalParameterListNoRest
      //   FormalParameterListNoRest , ... Identifier
      //
      // FormalParameterListNoRest :
      //   Identifier
      //   Identifier = AssignmentExprssion
      //   FormalParameterListNoRest , Identifier
      var result = [];

      var hasDefaultParameters = false;

      while (this.peek_(TokenType.IDENTIFIER) || this.peek_(TokenType.SPREAD)) {
        if (this.peek_(TokenType.SPREAD)) {
          var start = this.getTreeStartLocation_();
          this.eat_(TokenType.SPREAD);
          result.push(new RestParameter(this.getTreeLocation_(start), this.eatId_()));

          // Rest parameters must be the last parameter; so we must be done.
          break;
        } else {
          // TODO: implement pattern parsing here

          // Once we have seen a default parameter all remaining params must either be default or
          // rest parameters.
          if (hasDefaultParameters || this.peek_(TokenType.EQUAL, 1)) {
            result.push(this.parseDefaultParameter_());
            hasDefaultParameters = true;
          } else {
            result.push(this.parseIdentifierExpression_());
          }
        }

        if (!this.peek_(TokenType.CLOSE_PAREN)) {
          this.eat_(TokenType.COMMA);
        }
      }

      return new FormalParameterList(null, result);
    },

    /**
     * @return {DefaultParameter}
     * @private
     */
    parseDefaultParameter_: function() {
      var start = this.getTreeStartLocation_();
      var ident = this.parseIdentifierExpression_();
      this.eat_(TokenType.EQUAL);
      var expr = this.parseAssignmentExpression_();
      return new DefaultParameter(this.getTreeLocation_(start), ident, expr);
    },

    /**
     * @return {Block}
     * @private
     */
    parseFunctionBody_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.OPEN_CURLY);
      var result = this.parseSourceElementList_();
      this.eat_(TokenType.CLOSE_CURLY);
      return new Block(this.getTreeLocation_(start), result);
    },

    /**
     * @return {Array.<ParseTree>}
     * @private
     */
    parseSourceElementList_: function() {
      var result = [];

      while (this.peekSourceElement_()) {
        result.push(this.parseSourceElement_());
      }

      return result;
    },

    /**
     * @return {SpreadExpression}
     * @private
     */
    parseSpreadExpression_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.SPREAD);
      var operand = this.parseAssignmentExpression_();
      return new SpreadExpression(this.getTreeLocation_(start), operand);
    },

    // 12 Statements

    /**
     * In V8, all source elements may appear where statements occur in the grammar.
     *
     * @return {ParseTree}
     * @private
     */
    parseStatement_: function() {
      return this.parseSourceElement_();
    },

    /**
     * This function reflects the ECMA standard. Most places use parseStatement instead.
     *
     * @return {ParseTree}
     * @private
     */
    parseStatementStandard_: function() {
      switch (this.peekType_()) {
        case TokenType.OPEN_CURLY:
          return this.parseBlock_();
        case TokenType.AWAIT:
          return this.parseAwaitStatement_();
        case TokenType.CONST:
        case TokenType.VAR:
          return this.parseVariableStatement_();
        case TokenType.SEMI_COLON:
          return this.parseEmptyStatement_();
        case TokenType.IF:
          return this.parseIfStatement_();
        case TokenType.DO:
          return this.parseDoWhileStatement_();
        case TokenType.WHILE:
          return this.parseWhileStatement_();
        case TokenType.FOR:
          return this.parseForStatement_();
        case TokenType.CONTINUE:
          return this.parseContinueStatement_();
        case TokenType.BREAK:
          return this.parseBreakStatement_();
        case TokenType.RETURN:
          return this.parseReturnStatement_();
        case TokenType.YIELD:
          return this.parseYieldStatement_();
        case TokenType.WITH:
          return this.parseWithStatement_();
        case TokenType.SWITCH:
          return this.parseSwitchStatement_();
        case TokenType.THROW:
          return this.parseThrowStatement_();
        case TokenType.TRY:
          return this.parseTryStatement_();
        case TokenType.DEBUGGER:
          return this.parseDebuggerStatement_();
        default:
          if (this.peekLabelledStatement_()) {
            return this.parseLabelledStatement_();
          }
          return this.parseExpressionStatement_();
      }
    },

    /**
     * In V8 all source elements may appear where statements appear in the grammar.
     *
     * @return {boolean}
     * @private
     */
    peekStatement_: function() {
      return this.peekSourceElement_();
    },

    /**
     * This function reflects the ECMA standard. Most places use peekStatement instead.
     *
     * @return {boolean}
     * @private
     */
    peekStatementStandard_: function() {
      switch (this.peekType_()) {
        case TokenType.OPEN_CURLY:
        case TokenType.AWAIT:
        case TokenType.VAR:
        case TokenType.CONST:
        case TokenType.SEMI_COLON:
        case TokenType.IF:
        case TokenType.DO:
        case TokenType.WHILE:
        case TokenType.FOR:
        case TokenType.CONTINUE:
        case TokenType.BREAK:
        case TokenType.RETURN:
        case TokenType.YIELD:
        case TokenType.WITH:
        case TokenType.SWITCH:
        case TokenType.THROW:
        case TokenType.TRY:
        case TokenType.DEBUGGER:
        case TokenType.IDENTIFIER:
        case TokenType.THIS:
        case TokenType.CLASS:
        case TokenType.SUPER:
        case TokenType.NUMBER:
        case TokenType.STRING:
        case TokenType.NULL:
        case TokenType.TRUE:
        case TokenType.SLASH: // regular expression literal
        case TokenType.SLASH_EQUAL: // regular expression literal
        case TokenType.FALSE:
        case TokenType.OPEN_SQUARE:
        case TokenType.OPEN_PAREN:
        case TokenType.NEW:
        case TokenType.DELETE:
        case TokenType.VOID:
        case TokenType.TYPEOF:
        case TokenType.PLUS_PLUS:
        case TokenType.MINUS_MINUS:
        case TokenType.PLUS:
        case TokenType.MINUS:
        case TokenType.TILDE:
        case TokenType.BANG:
          return true;
        default:
          return false;
      }
    },

    // 12.1 Block
    /**
     * @return {Block}
     * @private
     */
    parseBlock_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.OPEN_CURLY);
      // Spec says Statement list. However functions are also embedded in the wild.
      var result = this.parseSourceElementList_();
      this.eat_(TokenType.CLOSE_CURLY);
      return new Block(this.getTreeLocation_(start), result);
    },

    /**
     * @return {Array.<ParseTree>}
     * @private
     */
    parseStatementList_: function() {
      var result = [];
      while (this.peekStatement_()) {
        result.push(this.parseStatement_());
      }
      return result;
    },

    // 12.2 Variable Statement
    /**
     * @return {VariableStatement}
     * @private
     */
    parseVariableStatement_: function() {
      var start = this.getTreeStartLocation_();
      var declarations = this.parseVariableDeclarationList_();
      this.checkInitializers_(declarations);
      this.eatPossibleImplicitSemiColon_();
      return new VariableStatement(this.getTreeLocation_(start), declarations);
    },

    /**
     * @return {VariableDeclarationList}
     * @private
     */
    parseVariableDeclarationListNoIn_: function() {
      return this.parseVariableDeclarationList_(Expression.NO_IN);
    },

    /**
     * @param {Expression=} opt_expressionIn
     * @return {VariableDeclarationList}
     * @private
     */
    parseVariableDeclarationList_: function(opt_expressionIn) {
      var expressionIn = opt_expressionIn || Expression.NORMAL;
      var token = this.peekType_();

      switch (token) {
        case TokenType.CONST:
        case TokenType.LET:
        case TokenType.VAR:
          this.eat_(token);
          break;
        default:
          throw Error('unreachable');
      }

      var start = this.getTreeStartLocation_();
      var declarations = [];

      declarations.push(this.parseVariableDeclaration_(false, token, expressionIn));
      while (this.peek_(TokenType.COMMA)) {
        this.eat_(TokenType.COMMA);
        declarations.push(this.parseVariableDeclaration_(false, token, expressionIn));
      }
      return new VariableDeclarationList(
          this.getTreeLocation_(start), token, declarations);
    },

    /**
     * @param {boolean} isStatic
     * @param {TokenType} binding
     * @param {Expression} expressionIn
     * @return {VariableDeclaration}
     * @private
     */
    parseVariableDeclaration_: function(isStatic, binding, expressionIn) {
      var start = this.getTreeStartLocation_();
      var lvalue;
      if (this.peekPattern_(PatternKind.INITIALIZER, declarationDestructuringFollow)) {
        lvalue = this.parsePattern_(PatternKind.INITIALIZER);
      } else {
        lvalue = this.parseIdentifierExpression_();
      }
      var initializer = null;
      if (this.peek_(TokenType.EQUAL)) {
        initializer = this.parseInitializer_(expressionIn);
      } else if (binding == TokenType.CONST) {
        this.reportError_('const variables must have an initializer');
      } else if (lvalue.isPattern()) {
        this.reportError_('destructuring must have an initializer');
      }
      return new VariableDeclaration(this.getTreeLocation_(start), lvalue, initializer);
    },

    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseInitializer_: function(expressionIn) {
      this.eat_(TokenType.EQUAL);
      return this.parseAssignment_(expressionIn);
    },

    // 12.3 Empty Statement
    /**
     * @return {EmptyStatement}
     * @private
     */
    parseEmptyStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.SEMI_COLON);
      return new EmptyStatement(this.getTreeLocation_(start));
    },

    // 12.4 Expression Statement
    /**
     * @return {ExpressionStatement}
     * @private
     */
    parseExpressionStatement_: function() {
      var start = this.getTreeStartLocation_();
      var expression = this.parseExpression_();
      this.eatPossibleImplicitSemiColon_();
      return new ExpressionStatement(this.getTreeLocation_(start), expression);
    },

    // 12.5 If Statement
    /**
     * @return {IfStatement}
     * @private
     */
    parseIfStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.IF);
      this.eat_(TokenType.OPEN_PAREN);
      var condition = this.parseExpression_();
      this.eat_(TokenType.CLOSE_PAREN);
      var ifClause = this.parseStatement_();
      var elseClause = null;
      if (this.peek_(TokenType.ELSE)) {
        this.eat_(TokenType.ELSE);
        elseClause = this.parseStatement_();
      }
      return new IfStatement(this.getTreeLocation_(start), condition, ifClause, elseClause);
    },

    // 12.6 Iteration Statements

    // 12.6.1 The do-while Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseDoWhileStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.DO);
      var body = this.parseStatement_();
      this.eat_(TokenType.WHILE);
      this.eat_(TokenType.OPEN_PAREN);
      var condition = this.parseExpression_();
      this.eat_(TokenType.CLOSE_PAREN);
      this.eatPossibleImplicitSemiColon_();
      return new DoWhileStatement(this.getTreeLocation_(start), body, condition);
    },

    // 12.6.2 The while Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseWhileStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.WHILE);
      this.eat_(TokenType.OPEN_PAREN);
      var condition = this.parseExpression_();
      this.eat_(TokenType.CLOSE_PAREN);
      var body = this.parseStatement_();
      return new WhileStatement(this.getTreeLocation_(start), condition, body);
    },

    // 12.6.3 The for Statement
    // 12.6.4 The for-in Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseForStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.FOR);
      this.eat_(TokenType.OPEN_PAREN);
      if (this.peekVariableDeclarationList_()) {
        var variables = this.parseVariableDeclarationListNoIn_();
        if (this.peek_(TokenType.IN)) {
          // for-in: only one declaration allowed
          if (variables.declarations.length > 1) {
            this.reportError_('for-in statement may not have more than one variable declaration');
          }
          // for-in: if let/const binding used, initializer is illegal
          if ((variables.declarationType == TokenType.LET ||
               variables.declarationType == TokenType.CONST)) {
            var declaration = variables.declarations[0];
            if (declaration.initializer != null) {
              this.reportError_('let/const in for-in statement may not have initializer');
            }
          }

          return this.parseForInStatement_(start, variables);
        } else if (this.peek_(TokenType.COLON)) {
          // for-in: only one declaration allowed
          if (variables.declarations.length > 1) {
            this.reportError_('for-each statement may not have more than one variable declaration');
          }
          // for-each: initializer is illegal
          var declaration = variables.declarations[0];
          if (declaration.initializer != null) {
            this.reportError_('for-each statement may not have initializer');
          }

          return this.parseForEachStatement_(start, variables);
        } else {
          // for statement: let and const must have initializers
          this.checkInitializers_(variables);
          return this.parseForStatement2_(start, variables);
        }
      }

      if (this.peek_(TokenType.SEMI_COLON)) {
        return this.parseForStatement2_(start, null);
      }

      var initializer = this.parseExpressionNoIn_();
      if (this.peek_(TokenType.IN)) {
        return this.parseForInStatement_(start, initializer);
      }

      return this.parseForStatement2_(start, initializer);
    },

    // The for-each Statement
    // for  (  { let | var }  identifier  :  expression  )  statement
    /**
     * @param {SourcePosition} start
     * @param {VariableDeclarationList} initializer
     * @return {ParseTree}
     * @private
     */
    parseForEachStatement_: function(start, initializer) {
      this.eat_(TokenType.COLON);
      var collection = this.parseExpression_();
      this.eat_(TokenType.CLOSE_PAREN);
      var body = this.parseStatement_();
      return new ForEachStatement(this.getTreeLocation_(start), initializer, collection, body);
    },

    /**
     * Checks variable declaration in variable and for statements.
     *
     * @param {VariableDeclarationList} variables
     * @return {void}
     * @private
     */
    checkInitializers_: function(variables) {
      if (variables.declarationType == TokenType.LET ||
          variables.declarationType == TokenType.CONST) {
        for (var i = 0; i < variables.declarations.length; i++) {
          var declaration = variables.declarations[i];
          if (declaration.initializer == null) {
            this.reportError_('let/const in for statement must have an initializer');
            break;
          }
        }
      }
    },

    /**
     * @return {boolean}
     * @private
     */
    peekVariableDeclarationList_: function() {
      switch (this.peekType_()) {
        case TokenType.VAR:
        case TokenType.CONST:
        case TokenType.LET:
          return true;
        default:
          return false;
      }
    },

    // 12.6.3 The for Statement
    /**
     * @param {SourcePosition} start
     * @param {ParseTree} initializer
     * @return {ParseTree}
     * @private
     */
    parseForStatement2_: function(start, initializer) {
      this.eat_(TokenType.SEMI_COLON);

      var condition = null;
      if (!this.peek_(TokenType.SEMI_COLON)) {
        condition = this.parseExpression_();
      }
      this.eat_(TokenType.SEMI_COLON);

      var increment = null;
      if (!this.peek_(TokenType.CLOSE_PAREN)) {
        increment = this.parseExpression_();
      }
      this.eat_(TokenType.CLOSE_PAREN);
      var body = this.parseStatement_();
      return new ForStatement(this.getTreeLocation_(start), initializer, condition, increment, body);
    },

    // 12.6.4 The for-in Statement
    /**
     * @param {SourcePosition} start
     * @param {ParseTree} initializer
     * @return {ParseTree}
     * @private
     */
    parseForInStatement_: function(start, initializer) {
      this.eat_(TokenType.IN);
      var collection = this.parseExpression_();
      this.eat_(TokenType.CLOSE_PAREN);
      var body = this.parseStatement_();
      return new ForInStatement(this.getTreeLocation_(start), initializer, collection, body);
    },

    // 12.7 The continue Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseContinueStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.CONTINUE);
      var name = null;
      if (!this.peekImplicitSemiColon_()) {
        name = this.eatIdOpt_();
      }
      this.eatPossibleImplicitSemiColon_();
      return new ContinueStatement(this.getTreeLocation_(start), name);
    },

    // 12.8 The break Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseBreakStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.BREAK);
      var name = null;
      if (!this.peekImplicitSemiColon_()) {
        name = this.eatIdOpt_();
      }
      this.eatPossibleImplicitSemiColon_();
      return new BreakStatement(this.getTreeLocation_(start), name);
    },

    //12.9 The return Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseReturnStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.RETURN);
      var expression = null;
      if (!this.peekImplicitSemiColon_()) {
        expression = this.parseExpression_();
      }
      this.eatPossibleImplicitSemiColon_();
      return new ReturnStatement(this.getTreeLocation_(start), expression);
    },

    // Harmony: The yield Statement
    //  yield  [expression];
    /**
     * @return {ParseTree}
     * @private
     */
    parseYieldStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.YIELD);
      var expression = null;
      var isYieldFor = false;
      if (this.peek_(TokenType.FOR)) {
        this.eat_(TokenType.FOR);
        isYieldFor = true;
      }
      if (!this.peekImplicitSemiColon_()) {
        expression = this.parseExpression_();
      }
      this.eatPossibleImplicitSemiColon_();
      return new YieldStatement(
          this.getTreeLocation_(start), expression, isYieldFor);
    },

    // Harmony?: The await Statement
    // TODO: await should be an expression, not a statement
    // await[ identifier = ] expression;
    /**
     * @return {ParseTree}
     * @private
     */
    parseAwaitStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.AWAIT);
      var identifier = null;
      if (this.peek_(TokenType.IDENTIFIER) && this.peek_(TokenType.EQUAL, 1)) {
        identifier = this.eatId_();
        this.eat_(TokenType.EQUAL);
      }
      var expression = this.parseExpression_();
      this.eatPossibleImplicitSemiColon_();
      return new AwaitStatement(this.getTreeLocation_(start), identifier, expression);
    },

    // 12.10 The with Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseWithStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.WITH);
      this.eat_(TokenType.OPEN_PAREN);
      var expression = this.parseExpression_();
      this.eat_(TokenType.CLOSE_PAREN);
      var body = this.parseStatement_();
      return new WithStatement(this.getTreeLocation_(start), expression, body);
    },

    // 12.11 The switch Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseSwitchStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.SWITCH);
      this.eat_(TokenType.OPEN_PAREN);
      var expression = this.parseExpression_();
      this.eat_(TokenType.CLOSE_PAREN);
      this.eat_(TokenType.OPEN_CURLY);
      var caseClauses = this.parseCaseClauses_();
      this.eat_(TokenType.CLOSE_CURLY);
      return new SwitchStatement(this.getTreeLocation_(start), expression, caseClauses);
    },

    /**
     * @return {Array.<ParseTree>}
     * @private
     */
    parseCaseClauses_: function() {
      var foundDefaultClause = false;
      var result = [];

      while (true) {
        var start = this.getTreeStartLocation_();
        switch (this.peekType_()) {
          case TokenType.CASE:
            this.eat_(TokenType.CASE);
            var expression = this.parseExpression_();
            this.eat_(TokenType.COLON);
            var statements = this.parseCaseStatementsOpt_();
            result.push(new CaseClause(this.getTreeLocation_(start), expression, statements));
            break;
          case TokenType.DEFAULT:
            if (foundDefaultClause) {
              this.reportError_('Switch statements may have at most one default clause');
            } else {
              foundDefaultClause = true;
            }
            this.eat_(TokenType.DEFAULT);
            this.eat_(TokenType.COLON);
            result.push(new DefaultClause(this.getTreeLocation_(start), this.parseCaseStatementsOpt_()));
            break;
          default:
            return result;
        }
      }
    },

    /**
     * @return {Array.<ParseTree>}
     * @private
     */
    parseCaseStatementsOpt_: function() {
      return this.parseStatementList_();
    },

    // 12.12 Labelled Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseLabelledStatement_: function() {
      var start = this.getTreeStartLocation_();
      var name = this.eatId_();
      this.eat_(TokenType.COLON);
      return new LabelledStatement(this.getTreeLocation_(start), name, this.parseStatement_());
    },

    /**
     * @return {boolean}
     * @private
     */
    peekLabelledStatement_: function() {
      return this.peek_(TokenType.IDENTIFIER) &&
          this.peek_(TokenType.COLON, 1);
    },

    // 12.13 Throw Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseThrowStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.THROW);
      var value = null;
      if (!this.peekImplicitSemiColon_()) {
        value = this.parseExpression_();
      }
      this.eatPossibleImplicitSemiColon_();
      return new ThrowStatement(this.getTreeLocation_(start), value);
    },

    // 12.14 Try Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseTryStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.TRY);
      var body = this.parseBlock_();
      var catchBlock = null;
      if (this.peek_(TokenType.CATCH)) {
        catchBlock = this.parseCatch_();
      }
      var finallyBlock = null;
      if (this.peek_(TokenType.FINALLY)) {
        finallyBlock = this.parseFinallyBlock_();
      }
      if (catchBlock == null && finallyBlock == null) {
        this.reportError_("'catch' or 'finally' expected.");
      }
      return new TryStatement(this.getTreeLocation_(start), body, catchBlock, finallyBlock);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseCatch_: function() {
      var start = this.getTreeStartLocation_();
      var catchBlock;
      this.eat_(TokenType.CATCH);
      this.eat_(TokenType.OPEN_PAREN);
      var exceptionName = this.eatId_();
      this.eat_(TokenType.CLOSE_PAREN);
      var catchBody = this.parseBlock_();
      catchBlock = new Catch(this.getTreeLocation_(start), exceptionName, catchBody);
      return catchBlock;
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseFinallyBlock_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.FINALLY);
      var finallyBlock = this.parseBlock_();
      return new Finally(this.getTreeLocation_(start), finallyBlock);
    },

    // 12.15 The Debugger Statement
    /**
     * @return {ParseTree}
     * @private
     */
    parseDebuggerStatement_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.DEBUGGER);
      this.eatPossibleImplicitSemiColon_();

      return new DebuggerStatement(this.getTreeLocation_(start));
    },

    // 11.1 Primary Expressions
    /**
     * @return {ParseTree}
     * @private
     */
    parsePrimaryExpression_: function() {
      switch (this.peekType_()) {
        case TokenType.CLASS:
          return this.parseClassExpression_();
        case TokenType.SUPER:
          return this.parseSuperExpression_();
        case TokenType.THIS:
          return this.parseThisExpression_();
        case TokenType.IDENTIFIER:
          return this.parseIdentifierExpression_();
        case TokenType.NUMBER:
        case TokenType.STRING:
        case TokenType.TRUE:
        case TokenType.FALSE:
        case TokenType.NULL:
          return this.parseLiteralExpression_();
        case TokenType.OPEN_SQUARE:
          return this.parseArrayLiteral_();
        case TokenType.OPEN_CURLY:
          return this.parseObjectLiteral_();
        case TokenType.OPEN_PAREN:
          return this.parseParenExpression_();
        case TokenType.SLASH:
        case TokenType.SLASH_EQUAL:
          return this.parseRegularExpressionLiteral_();
        default:
          return this.parseMissingPrimaryExpression_();
      }
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseClassExpression_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.CLASS);
      return new ClassExpression(this.getTreeLocation_(start));
    },

    /**
     * @return {SuperExpression}
     * @private
     */
    parseSuperExpression_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.SUPER);
      return new SuperExpression(this.getTreeLocation_(start));
    },

    /**
     * @return {ThisExpression}
     * @private
     */
    parseThisExpression_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.THIS);
      return new ThisExpression(this.getTreeLocation_(start));
    },

    /**
     * @return {IdentifierExpression}
     * @private
     */
    parseIdentifierExpression_: function() {
      var start = this.getTreeStartLocation_();
      var identifier = this.eatId_();
      return new IdentifierExpression(this.getTreeLocation_(start), identifier);
    },

    /**
     * @return {LiteralExpression}
     * @private
     */
    parseLiteralExpression_: function() {
      var start = this.getTreeStartLocation_();
      var literal = this.nextLiteralToken_();
      return new LiteralExpression(this.getTreeLocation_(start), literal);
    },

    /**
     * @return {Token}
     * @private
     */
    nextLiteralToken_: function() {
      return this.nextToken_();
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseRegularExpressionLiteral_: function() {
      var start = this.getTreeStartLocation_();
      var literal = this.nextRegularExpressionLiteralToken_();
      return new LiteralExpression(this.getTreeLocation_(start), literal);
    },

    // 11.1.4 Array Literal Expression
    /**
     * @return {ParseTree}
     * @private
     */
    parseArrayLiteral_: function() {
      // ArrayLiteral :
      //   [ Elisionopt ]
      //   [ ElementList ]
      //   [ ElementList , Elisionopt ]
      //
      // ElementList :
      //   Elisionopt AssignmentOrSpreadExpression
      //   ElementList , Elisionopt AssignmentOrSpreadExpression
      //
      // Elision :
      //   ,
      //   Elision ,

      var start = this.getTreeStartLocation_();
      var elements = [];

      this.eat_(TokenType.OPEN_SQUARE);
      while (this.peek_(TokenType.COMMA) || this.peek_(TokenType.SPREAD) || this.peekAssignmentExpression_()) {
        if (this.peek_(TokenType.COMMA)) {
          elements.push(new NullTree());
        } else {
          if (this.peek_(TokenType.SPREAD)) {
            elements.push(this.parseSpreadExpression_());
          } else {
            elements.push(this.parseAssignmentExpression_());
          }
        }
        if (!this.peek_(TokenType.CLOSE_SQUARE)) {
          this.eat_(TokenType.COMMA);
        }
      }
      this.eat_(TokenType.CLOSE_SQUARE);
      return new ArrayLiteralExpression(
          this.getTreeLocation_(start), elements);
    },

    // 11.1.4 Object Literal Expression
    /**
     * @return {ParseTree}
     * @private
     */
    parseObjectLiteral_: function() {
      var start = this.getTreeStartLocation_();
      var result = [];

      this.eat_(TokenType.OPEN_CURLY);
      while (this.peekPropertyAssignment_()) {
        result.push(this.parsePropertyAssignment_());
        if (this.eatOpt_(TokenType.COMMA) == null) {
          break;
        }
      }
      this.eat_(TokenType.CLOSE_CURLY);
      return new ObjectLiteralExpression(this.getTreeLocation_(start), result);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekPropertyAssignment_: function() {
      return this.peekPropertyName_(0);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekPropertyName_: function(tokenIndex) {
      var type = this.peekType_(tokenIndex);
      switch (type) {
        case TokenType.IDENTIFIER:
        case TokenType.STRING:
        case TokenType.NUMBER:
          return true;
        default:
          return Keywords.isKeyword(type);
      }
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parsePropertyAssignment_: function() {
      var type = this.peekType_();
      switch (type) {
        case TokenType.STRING:
        case TokenType.NUMBER:
          return this.parsePropertyNameAssignment_();
        default:
          traceur.assert(type == TokenType.IDENTIFIER ||
              Keywords.isKeyword(type));
          if (this.peekGetAccessor_(false)) {
            return this.parseGetAccessor_();
          } else if (this.peekSetAccessor_(false)) {
            return this.parseSetAccessor_();
          } else {
            return this.parsePropertyNameAssignment_();
          }
      }
    },

    /**
     * @param {boolean} allowStatic
     * @return {boolean}
     * @private
     */
    peekGetAccessor_: function(allowStatic) {
      var index = allowStatic && this.peek_(TokenType.CLASS) ? 1 : 0;
      return this.peekPredefinedString_(PredefinedName.GET, index) && this.peekPropertyName_(index + 1);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekPredefinedString_: function(string, opt_index) {
      var index = opt_index || 0;
      return this.peek_(TokenType.IDENTIFIER, index) && this.peekToken_(index).value === string;
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseGetAccessor_: function() {
      var start = this.getTreeStartLocation_();
      var isStatic = this.eatOpt_(TokenType.CLASS) != null;
      this.eatId_(); // get
      var propertyName = this.nextToken_();
      this.eat_(TokenType.OPEN_PAREN);
      this.eat_(TokenType.CLOSE_PAREN);
      var body = this.parseFunctionBody_();
      return new GetAccessor(this.getTreeLocation_(start), propertyName, isStatic, body);
    },

    /**
     *@param {boolean} allowStatic
     * @return {boolean}
     * @private
     */
    peekSetAccessor_: function(allowStatic) {
      var index = allowStatic && this.peek_(TokenType.CLASS) ? 1 : 0;
      return this.peekPredefinedString_(PredefinedName.SET, index) && this.peekPropertyName_(index + 1);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseSetAccessor_: function() {
      var start = this.getTreeStartLocation_();
      var isStatic = this.eatOpt_(TokenType.CLASS) != null;
      this.eatId_(); // set
      var propertyName = this.nextToken_();
      this.eat_(TokenType.OPEN_PAREN);
      var parameter = this.eatId_();
      this.eat_(TokenType.CLOSE_PAREN);
      var body = this.parseFunctionBody_();
      return new SetAccessor(this.getTreeLocation_(start), propertyName, isStatic, parameter, body);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parsePropertyNameAssignment_: function() {
      var start = this.getTreeStartLocation_();
      var name = this.nextToken_();
      this.eat_(TokenType.COLON);
      var value = this.parseAssignmentExpression_();
      return new PropertyNameAssignment(this.getTreeLocation_(start), name, value);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseParenExpression_: function() {
      var start = this.getTreeStartLocation_();
      this.eat_(TokenType.OPEN_PAREN);
      var result = this.parseExpression_();
      this.eat_(TokenType.CLOSE_PAREN);
      return new ParenExpression(this.getTreeLocation_(start), result);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseMissingPrimaryExpression_: function() {
      var start = this.getTreeStartLocation_();
      this.reportError_('primary expression expected');
      var token = this.nextToken_();
      return new MissingPrimaryExpression(this.getTreeLocation_(start), token);
    },

    // 11.14 Expressions
    /**
     * @return {ParseTree}
     * @private
     */
    parseExpressionNoIn_: function() {
      return this.parse_(Expression.NO_IN);
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseExpression_: function() {
      return this.parse_(Expression.NORMAL);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekExpression_: function() {
      switch (this.peekType_()) {
        case TokenType.BANG:
        case TokenType.CLASS:
        case TokenType.DELETE:
        case TokenType.FALSE:
        case TokenType.FUNCTION:
        case TokenType.IDENTIFIER:
        case TokenType.MINUS:
        case TokenType.MINUS_MINUS:
        case TokenType.NEW:
        case TokenType.NULL:
        case TokenType.NUMBER:
        case TokenType.OPEN_CURLY:
        case TokenType.OPEN_PAREN:
        case TokenType.OPEN_SQUARE:
        case TokenType.PLUS:
        case TokenType.PLUS_PLUS:
        case TokenType.SLASH: // regular expression literal
        case TokenType.SLASH_EQUAL:
        case TokenType.STRING:
        case TokenType.SUPER:
        case TokenType.THIS:
        case TokenType.TILDE:
        case TokenType.TRUE:
        case TokenType.TYPEOF:
        case TokenType.VOID:
          return true;
        default:
          return false;
      }
    },

    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parse_: function(expressionIn) {
      var start = this.getTreeStartLocation_();
      var result = this.parseAssignment_(expressionIn);
      if (this.peek_(TokenType.COMMA)) {
        var exprs = [];
        exprs.push(result);
        while (this.peek_(TokenType.COMMA)) {
          this.eat_(TokenType.COMMA);
          exprs.push(this.parseAssignment_(expressionIn));
        }
        return new CommaExpression(this.getTreeLocation_(start), exprs);
      }
      return result;
    },

    // 11.13 Assignment expressions
    /**
     * @return {ParseTree}
     * @private
     */
    parseAssignmentExpression_: function() {
      return this.parseAssignment_(Expression.NORMAL);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekAssignmentExpression_: function() {
      return this.peekExpression_();
    },

    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseAssignment_: function(expressionIn) {
      var start = this.getTreeStartLocation_();

      var left = this.peekParenPatternAssignment_() ?
          this.parseParenPattern_() :
          this.parseConditional_(expressionIn);

      if (this.peekAssignmentOperator_()) {
        if (!left.isLeftHandSideExpression() && !left.isPattern()) {
          this.reportError_('Left hand side of assignment must be new, call, member, function, primary expressions or destructuring pattern');
        }
        var operator = this.nextToken_();
        var right = this.parseAssignment_(expressionIn);
        return new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekAssignmentOperator_: function() {
      switch (this.peekType_()) {
        case TokenType.EQUAL:
        case TokenType.STAR_EQUAL:
        case TokenType.SLASH_EQUAL:
        case TokenType.PERCENT_EQUAL:
        case TokenType.PLUS_EQUAL:
        case TokenType.MINUS_EQUAL:
        case TokenType.LEFT_SHIFT_EQUAL:
        case TokenType.RIGHT_SHIFT_EQUAL:
        case TokenType.UNSIGNED_RIGHT_SHIFT_EQUAL:
        case TokenType.AMPERSAND_EQUAL:
        case TokenType.CARET_EQUAL:
        case TokenType.BAR_EQUAL:
          return true;
        default:
          return false;
      }
    },

    // 11.12 Conditional Expression
    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseConditional_: function(expressionIn) {
      var start = this.getTreeStartLocation_();
      var condition = this.parseLogicalOR_(expressionIn);
      if (this.peek_(TokenType.QUESTION)) {
        this.eat_(TokenType.QUESTION);
        var left = this.parseAssignment_(expressionIn);
        this.eat_(TokenType.COLON);
        var right = this.parseAssignment_(expressionIn);
        return new ConditionalExpression(this.getTreeLocation_(start), condition, left, right);
      }
      return condition;
    },

    // 11.11 Logical OR
    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseLogicalOR_: function(expressionIn) {
      var start = this.getTreeStartLocation_();
      var left = this.parseLogicalAND_(expressionIn);
      while (this.peek_(TokenType.OR)) {
        var operator = this.eat_(TokenType.OR);
        var right = this.parseLogicalAND_(expressionIn);
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    // 11.11 Logical AND
    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseLogicalAND_: function(expressionIn) {
      var start = this.getTreeStartLocation_();
      var left = this.parseBitwiseOR_(expressionIn);
      while (this.peek_(TokenType.AND)) {
        var operator = this.eat_(TokenType.AND);
        var right = this.parseBitwiseOR_(expressionIn);
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    // 11.10 Bitwise OR
    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseBitwiseOR_: function(expressionIn) {
      var start = this.getTreeStartLocation_();
      var left = this.parseBitwiseXOR_(expressionIn);
      while (this.peek_(TokenType.BAR)) {
        var operator = this.eat_(TokenType.BAR);
        var right = this.parseBitwiseXOR_(expressionIn);
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    // 11.10 Bitwise XOR
    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseBitwiseXOR_: function(expressionIn) {
      var start = this.getTreeStartLocation_();
      var left = this.parseBitwiseAND_(expressionIn);
      while (this.peek_(TokenType.CARET)) {
        var operator = this.eat_(TokenType.CARET);
        var right = this.parseBitwiseAND_(expressionIn);
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    // 11.10 Bitwise AND
    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseBitwiseAND_: function(expressionIn) {
      var start = this.getTreeStartLocation_();
      var left = this.parseEquality_(expressionIn);
      while (this.peek_(TokenType.AMPERSAND)) {
        var operator = this.eat_(TokenType.AMPERSAND);
        var right = this.parseEquality_(expressionIn);
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    // 11.9 Equality Expression
    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseEquality_: function(expressionIn) {
      var start = this.getTreeStartLocation_();
      var left = this.parseRelational_(expressionIn);
      while (this.peekEqualityOperator_()) {
        var operator = this.nextToken_();
        var right = this.parseRelational_(expressionIn);
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekEqualityOperator_: function() {
      switch (this.peekType_()) {
        case TokenType.EQUAL_EQUAL:
        case TokenType.NOT_EQUAL:
        case TokenType.EQUAL_EQUAL_EQUAL:
        case TokenType.NOT_EQUAL_EQUAL:
          return true;
        default:
          return false;
      }
    },

    // 11.8 Relational
    /**
     * @param {Expression} expressionIn
     * @return {ParseTree}
     * @private
     */
    parseRelational_: function(expressionIn) {
      var start = this.getTreeStartLocation_();
      var left = this.parseShiftExpression_();
      while (this.peekRelationalOperator_(expressionIn)) {
        var operator = this.nextToken_();
        var right = this.parseShiftExpression_();
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    /**
     * @param {Expression} expressionIn
     * @return {boolean}
     * @private
     */
    peekRelationalOperator_: function(expressionIn) {
      switch (this.peekType_()) {
        case TokenType.OPEN_ANGLE:
        case TokenType.CLOSE_ANGLE:
        case TokenType.GREATER_EQUAL:
        case TokenType.LESS_EQUAL:
        case TokenType.INSTANCEOF:
          return true;
        case TokenType.IN:
          return expressionIn == Expression.NORMAL;
        default:
          return false;
      }
    },

    // 11.7 Shift Expression
    /**
     * @return {ParseTree}
     * @private
     */
    parseShiftExpression_: function() {
      var start = this.getTreeStartLocation_();
      var left = this.parseAdditiveExpression_();
      while (this.peekShiftOperator_()) {
        var operator = this.nextToken_();
        var right = this.parseAdditiveExpression_();
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekShiftOperator_: function() {
      switch (this.peekType_()) {
        case TokenType.LEFT_SHIFT:
        case TokenType.RIGHT_SHIFT:
        case TokenType.UNSIGNED_RIGHT_SHIFT:
          return true;
        default:
          return false;
      }
    },

    // 11.6 Additive Expression
    /**
     * @return {ParseTree}
     * @private
     */
    parseAdditiveExpression_: function() {
      var start = this.getTreeStartLocation_();
      var left = this.parseMultiplicativeExpression_();
      while (this.peekAdditiveOperator_()) {
        var operator = this.nextToken_();
        var right = this.parseMultiplicativeExpression_();
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekAdditiveOperator_: function() {
      switch (this.peekType_()) {
        case TokenType.PLUS:
        case TokenType.MINUS:
          return true;
        default:
          return false;
      }
    },

    // 11.5 Multiplicative Expression
    /**
     * @return {ParseTree}
     * @private
     */
    parseMultiplicativeExpression_: function() {
      var start = this.getTreeStartLocation_();
      var left = this.parseUnaryExpression_();
      while (this.peekMultiplicativeOperator_()) {
        var operator = this.nextToken_();
        var right = this.parseUnaryExpression_();
        left = new BinaryOperator(this.getTreeLocation_(start), left, operator, right);
      }
      return left;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekMultiplicativeOperator_: function() {
      switch (this.peekType_()) {
        case TokenType.STAR:
        case TokenType.SLASH:
        case TokenType.PERCENT:
          return true;
        default:
          return false;
      }
    },

    // 11.4 Unary Operator
    /**
     * @return {ParseTree}
     * @private
     */
    parseUnaryExpression_: function() {
      var start = this.getTreeStartLocation_();
      if (this.peekUnaryOperator_()) {
        var operator = this.nextToken_();
        var operand = this.parseUnaryExpression_();
        return new UnaryExpression(this.getTreeLocation_(start), operator, operand);
      }
      return this.parsePostfixExpression_();
    },

    /**
     * @return {boolean}
     * @private
     */
    peekUnaryOperator_: function() {
      switch (this.peekType_()) {
        case TokenType.DELETE:
        case TokenType.VOID:
        case TokenType.TYPEOF:
        case TokenType.PLUS_PLUS:
        case TokenType.MINUS_MINUS:
        case TokenType.PLUS:
        case TokenType.MINUS:
        case TokenType.TILDE:
        case TokenType.BANG:
          return true;
        default:
          return false;
      }
    },

    // 11.3 Postfix Expression
    /**
     * @return {ParseTree}
     * @private
     */
    parsePostfixExpression_: function() {
      var start = this.getTreeStartLocation_();
      var operand = this.parseLeftHandSideExpression_();
      while (this.peekPostfixOperator_()) {
        var operator = this.nextToken_();
        operand = new PostfixExpression(this.getTreeLocation_(start), operand, operator);
      }
      return operand;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekPostfixOperator_: function() {
      if (this.peekImplicitSemiColon_()) {
        return false;
      }
      switch (this.peekType_()) {
        case TokenType.PLUS_PLUS:
        case TokenType.MINUS_MINUS:
          return true;
        default:
          return false;
      }
    },

    // 11.2 Left hand side expression
    //
    // Also inlines the call expression productions
    /**
     * @return {ParseTree}
     * @private
     */
    parseLeftHandSideExpression_: function() {
      var start = this.getTreeStartLocation_();
      var operand = this.parseNewExpression_();

      // this test is equivalent to is member expression
      if (!(operand instanceof NewExpression) ||
          operand.args != null) {

        // The Call expression productions
        while (this.peekCallSuffix_()) {
          switch (this.peekType_()) {
            case TokenType.OPEN_PAREN:
              var args = this.parseArguments_();
              operand = new CallExpression(this.getTreeLocation_(start), operand, args);
              break;
            case TokenType.OPEN_SQUARE:
              this.eat_(TokenType.OPEN_SQUARE);
              var member = this.parseExpression_();
              this.eat_(TokenType.CLOSE_SQUARE);
              operand = new MemberLookupExpression(this.getTreeLocation_(start), operand, member);
              break;
            case TokenType.PERIOD:
              this.eat_(TokenType.PERIOD);
              operand = new MemberExpression(this.getTreeLocation_(start), operand, this.eatIdName_());
              break;
          }
        }
      }
      return operand;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekCallSuffix_: function() {
      return this.peek_(TokenType.OPEN_PAREN) ||
          this.peek_(TokenType.OPEN_SQUARE) ||
          this.peek_(TokenType.PERIOD);
    },

    // 11.2 Member Expression without the new production
    /**
     * @return {ParseTree}
     * @private
     */
    parseMemberExpressionNoNew_: function() {
      var start = this.getTreeStartLocation_();
      var operand;
      if (this.peekFunction_()) {
        operand = this.parseFunctionExpression_();
      } else {
        operand = this.parsePrimaryExpression_();
      }
      while (this.peekMemberExpressionSuffix_()) {
        if (this.peek_(TokenType.OPEN_SQUARE)) {
          this.eat_(TokenType.OPEN_SQUARE);
          var member = this.parseExpression_();
          this.eat_(TokenType.CLOSE_SQUARE);
          operand = new MemberLookupExpression(this.getTreeLocation_(start), operand, member);
        } else {
          this.eat_(TokenType.PERIOD);
          operand = new MemberExpression(this.getTreeLocation_(start), operand, this.eatIdName_());
        }
      }
      return operand;
    },

    /**
     * @return {boolean}
     * @private
     */
    peekMemberExpressionSuffix_: function() {
      return this.peek_(TokenType.OPEN_SQUARE) || this.peek_(TokenType.PERIOD);
    },

    // 11.2 New Expression
    /**
     * @return {ParseTree}
     * @private
     */
    parseNewExpression_: function() {
      if (this.peek_(TokenType.NEW)) {
        var start = this.getTreeStartLocation_();
        this.eat_(TokenType.NEW);
        var operand = this.parseNewExpression_();
        var args = null;
        if (this.peek_(TokenType.OPEN_PAREN)) {
          args = this.parseArguments_();
        }
        return new NewExpression(this.getTreeLocation_(start), operand, args);
      } else {
        return this.parseMemberExpressionNoNew_();
      }
    },

    /**
     * @return {ArgumentList}
     * @private
     */
    parseArguments_: function() {
      // ArgumentList :
      //   AssignmentOrSpreadExpression
      //   ArgumentList , AssignmentOrSpreadExpression
      //
      // AssignmentOrSpreadExpression :
      //   ... AssignmentExpression
      //   AssignmentExpression

      var start = this.getTreeStartLocation_();
      var args = [];

      this.eat_(TokenType.OPEN_PAREN);
      while (this.peekAssignmentOrSpread_()) {
        args.push(this.parseAssignmentOrSpead_());

        if (!this.peek_(TokenType.CLOSE_PAREN)) {
          this.eat_(TokenType.COMMA);
        }
      }
      this.eat_(TokenType.CLOSE_PAREN);
      return new ArgumentList(this.getTreeLocation_(start), args);
    },

    /**
     * Whether we have a spread expression or an assignment next.
     *
     * This does not peek the operand for the spread expression. This means that
     * {@code parseAssignmentOrSpred} might still fail when this returns true.
     */
    /**
     * @return {boolean}
     * @private
     */
    peekAssignmentOrSpread_: function() {
      return this.peek_(TokenType.SPREAD) || this.peekAssignmentExpression_();
    },

    /**
     * @return {ParseTree}
     * @private
     */
    parseAssignmentOrSpead_: function() {
      if (this.peek_(TokenType.SPREAD)) {
        return this.parseSpreadExpression_();
      }
      return this.parseAssignmentExpression_();
    },

    // Destructuring; see
    // http://wiki.ecmascript.org/doku.php?id=harmony:destructuring
    //
    // SpiderMonkey is much more liberal in where it allows
    // parenthesized patterns, for example, it allows [x, ([y, z])] but
    // those inner parentheses aren't allowed in the grammar on the ES
    // wiki. This implementation conservatively only allows parentheses
    // at the top-level of assignment statements.
    //
    // Rhino has some destructuring support, but it lags SpiderMonkey;
    // for example, Rhino crashes parsing ({x: f().foo}) = {x: 123}.

    // TODO: implement numbers and strings as labels in object destructuring
    // TODO: implement destructuring bind in formal parameter lists
    // TODO: implement destructuring bind in catch headers
    // TODO: implement destructuring bind in for-in when iterators are
    // supported
    // TODO: implement destructuring bind in let bindings when let
    // bindings are supported

    /**
     * @return {boolean}
     * @private
     */
    peekParenPatternAssignment_: function() {
      if (!this.peekParenPatternStart_()) {
        return false;
      }
      var p = this.createLookaheadParser_();
      p.parseParenPattern_();
      return !p.errorReporter_.hadError() && p.peek_(TokenType.EQUAL);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekParenPatternStart_: function() {
      var index = 0;
      while (this.peek_(TokenType.OPEN_PAREN, index)) {
        index++;
      }
      return this.peekPatternStart_(index);
    },

    /**
     * @return {boolean}
     * @private
     */
    peekPatternStart_: function(opt_index) {
      var index = opt_index || 0;
      return this.peek_(TokenType.OPEN_SQUARE, index) || this.peek_(TokenType.OPEN_CURLY, index);
    },

    /**
     * @param {PatternKind=} opt_kind
     * @return {ParseTree}
     * @private
     */
    parseParenPattern_: function(opt_kind) {
      var kind = opt_kind || PatternKind.ANY;
      if (this.peek_(TokenType.OPEN_PAREN)) {
        var start = this.getTreeStartLocation_();
        this.eat_(TokenType.OPEN_PAREN);
        var result = this.parseParenPattern_(kind);
        this.eat_(TokenType.CLOSE_PAREN);
        return new ParenExpression(this.getTreeLocation_(start), result);
      } else {
        return this.parsePattern_(kind);
      }
    },

    /**
     * @param {PatternKind} kind
     * @param {function(TokenType) : boolean} follow
     * @return {boolean}
     * @private
     */
    peekPattern_: function(kind, follow) {
      if (!this.peekPatternStart_()) {
        return false;
      }
      var p = this.createLookaheadParser_();
      p.parsePattern_(kind);
      return !p.errorReporter_.hadError() && follow(p.peekType_());
    },

    /**
     * @param {PatternKind} kind
     * @param {function(TokenType) : boolean} follow
     * @return {boolean}
     * @private
     */
    peekParenPattern_: function(kind, follow) {
      if (!this.peekParenPatternStart_()) {
        return false;
      }
      var p = this.createLookaheadParser_();
      p.parsePattern_(kind);
      return !p.errorReporter_.hadError() && follow(p.peekType_());
    },

    /**
     * @param {PatternKind} kind
     * @return {ParseTree}
     * @private
     */
    parsePattern_: function(kind) {
      switch (this.peekType_()) {
        case TokenType.OPEN_SQUARE:
          return this.parseArrayPattern_(kind);
        case TokenType.OPEN_CURLY:
        default:
          return this.parseObjectPattern_(kind);
      }
    },

    /**
     * @return {boolean}
     * @private
     */
    peekPatternElement_: function() {
      return this.peekExpression_() || this.peek_(TokenType.SPREAD);
    },

    // Element ::= Pattern | LValue | ... LValue
    /**
     * @param {PatternKind} kind
     * @param {function(TokenType) : boolean} follow
     * @return {ParseTree}
     * @private
     */
    parsePatternElement_: function(kind, follow) {
      // [ or { are preferably the start of a sub-pattern
      if (this.peekParenPattern_(kind, follow)) {
        return this.parseParenPattern_(kind);
      }

      // An element that's not a sub-pattern

      var spread = false;
      var start = this.getTreeStartLocation_();
      if (this.peek_(TokenType.SPREAD)) {
        this.eat_(TokenType.SPREAD);
        spread = true;
      }

      var lvalue = this.parseLeftHandSideExpression_();

      if (kind == PatternKind.INITIALIZER &&
          lvalue.type != ParseTreeType.IDENTIFIER_EXPRESSION) {
        this.reportError_('lvalues in initializer patterns must be identifiers');
      }

      return spread ?
          new SpreadPatternElement(this.getTreeLocation_(start), lvalue) :
          lvalue;
    },

    // Pattern ::= ... | "[" Element? ("," Element?)* "]"
    /**
     * @param {PatternKind} kind
     * @return {ParseTree}
     * @private
     */
    parseArrayPattern_: function(kind) {
      var start = this.getTreeStartLocation_();
      var elements = [];
      this.eat_(TokenType.OPEN_SQUARE);
      while (this.peek_(TokenType.COMMA) || this.peekPatternElement_()) {
        if (this.peek_(TokenType.COMMA)) {
          this.eat_(TokenType.COMMA);
          elements.push(new NullTree());
        } else {
          var element = this.parsePatternElement_(kind, arraySubPatternFollowSet);
          elements.push(element);

          if (element.isSpreadPatternElement()) {
            // Spread can only appear in the posterior, so we must be done
            break;
          } else if (this.peek_(TokenType.COMMA)) {
            // Consume the comma separator
            this.eat_(TokenType.COMMA);
          } else {
            // Otherwise we must be done
            break;
          }
        }
      }
      this.eat_(TokenType.CLOSE_SQUARE);
      return new ArrayPattern(this.getTreeLocation_(start), elements);
    },

    // Pattern ::= "{" (Field ("," Field)* ","?)? "}" | ...
    /**
     * @param {PatternKind} kind
     * @return {ParseTree}
     * @private
     */
    parseObjectPattern_: function(kind) {
      var start = this.getTreeStartLocation_();
      var fields = [];
      this.eat_(TokenType.OPEN_CURLY);
      while (this.peekObjectPatternField_(kind)) {
        fields.push(this.parseObjectPatternField_(kind));

        if (this.peek_(TokenType.COMMA)) {
          // Consume the comma separator
          this.eat_(TokenType.COMMA);
        } else {
          // Otherwise we must be done
          break;
        }
      }
      this.eat_(TokenType.CLOSE_CURLY);
      return new ObjectPattern(this.getTreeLocation_(start), fields);
    },

    /**
     * @param {PatternKind} kind
     * @return {boolean}
     * @private
     */
    peekObjectPatternField_: function(kind) {
      return this.peek_(TokenType.IDENTIFIER);
    },

    /**
     * @param {PatternKind} kind
     * @return {ParseTree}
     * @private
     */
    parseObjectPatternField_: function(kind) {
      var start = this.getTreeStartLocation_();
      var identifier = this.eatId_();
      var element = null;
      if (this.peek_(TokenType.COLON)) {
        this.eat_(TokenType.COLON);
        element = this.parsePatternElement_(kind, objectSubPatternFollowSet);

        if (element.isSpreadPatternElement()) {
          this.reportError_('Rest can not be used in object patterns');
        }
      }
      return new ObjectPatternField(this.getTreeLocation_(start),
          identifier, element);
    },

    /**
     * Consume a (possibly implicit) semi-colon. Reports an error if a semi-colon is not present.
     *
     * @return {void}
     * @private
     */
    eatPossibleImplicitSemiColon_: function() {
      if (this.peek_(TokenType.SEMI_COLON) && this.peekToken_().location.start.line == this.getLastLine_()) {
        this.eat_(TokenType.SEMI_COLON);
        return;
      }
      if (this.peekImplicitSemiColon_()) {
        return;
      }

      this.reportError_('Semi-colon expected');
    },

    /**
     * Returns true if an implicit or explicit semi colon is at the current location.
     *
     * @return {boolean}
     * @private
     */
    peekImplicitSemiColon_: function() {
      return this.getNextLine_() > this.getLastLine_() ||
          this.peek_(TokenType.SEMI_COLON) ||
          this.peek_(TokenType.CLOSE_CURLY) ||
          this.peek_(TokenType.END_OF_FILE);
    },

    /**
     * Returns the line number of the most recently consumed token.
     *
     * @return {number}
     * @private
     */
    getLastLine_: function() {
      return this.lastToken_.location.end.line;
    },

    /**
     * Returns the line number of the next token.
     *
     * @return {number}
     * @private
     */
    getNextLine_: function() {
      return this.peekToken_().location.start.line;
    },

    /**
     * Consumes the next token if it is of the expected type. Otherwise returns null.
     * Never reports errors.
     *
     * @param {TokenType} expectedTokenType
     * @return {Token} The consumed token, or null if the next token is not of the expected type.
     * @private
     */
    eatOpt_: function(expectedTokenType) {
      if (this.peek_(expectedTokenType)) {
        return this.eat_(expectedTokenType);
      }
      return null;
    },

    /**
     * Shorthand for this.eatOpt_(TokenType.IDENTIFIER)
     *
     * @return {IdentifierToken}
     * @private
     */
    eatIdOpt_: function() {
      return (this.peek_(TokenType.IDENTIFIER)) ? this.eatId_() : null;
    },

    /**
     * Shorthand for this.eat_(TokenType.IDENTIFIER)
     *
     * @return {IdentifierToken}
     * @private
     */
    eatId_: function() {
      var result = this.eat_(TokenType.IDENTIFIER);
      return result;
    },

    /**
     * Eats an identifier or keyword. Equivalent to IdentifierName in the spec.
     *
     * @return {Token}
     * @private
     */
    eatIdName_: function() {
      var t = this.nextToken_();
      if (t.type != TokenType.IDENTIFIER) {
        if (!Keywords.isKeyword(t.type)) {
          this.reportExpectedError_(t, 'identifier');
          return null;
        }
        return new IdentifierToken(t.location, t.type);
      }
      return t;
    },

    /**
     * Consumes the next token. If the consumed token is not of the expected type then
     * report an error and return null. Otherwise return the consumed token.
     *
     * @param {TokenType} expectedTokenType
     * @return {Token} The consumed token, or null if the next token is not of the expected type.
     * @private
     */
    eat_: function(expectedTokenType) {
      var token = this.nextToken_();
      if (token.type != expectedTokenType) {
        this.reportExpectedError_(token, expectedTokenType);
        return null;
      }
      return token;
    },

    /**
     * Report a 'X' expected error message.
     * @param {Token} token The location to report the message at.
     * @param {Object} expected The thing that was expected.
     *
     * @return {void}
     * @private
     */
    reportExpectedError_: function(token, expected) {
      this.reportError_(token, "'" + expected + "' expected");
    },

    /**
     * Returns a SourcePosition for the start of a parse tree that starts at the current location.
     *
     * @return {SourcePosition}
     * @private
     */
    getTreeStartLocation_: function() {
      return this.peekToken_().location.start;
    },

    /**
     * Returns a SourcePosition for the end of a parse tree that ends at the current location.
     *
     * @return {SourcePosition}
     * @private
     */
    getTreeEndLocation_: function() {
      return this.lastToken_.location.end;
    },

    /**
     * Returns a SourceRange for a parse tree that starts at {start} and ends at the current location.
     *
     * @return {SourceRange}
     * @private
     */
    getTreeLocation_: function(start) {
      return new SourceRange(start, this.getTreeEndLocation_());
    },

    /**
     * Consumes the next token and returns it. Will return a never ending stream of
     * TokenType.END_OF_FILE at the end of the file so callers don't have to check for EOF explicitly.
     *
     * Tokenizing is contextual. this.nextToken_() will never return a regular expression literal.
     *
     * @return {Token}
     * @private
     */
    nextToken_: function() {
      this.lastToken_ = this.scanner_.nextToken();
      return this.lastToken_;
    },

    /**
     * Consumes a regular expression literal token and returns it.
     *
     * @return {LiteralToken}
     * @private
     */
    nextRegularExpressionLiteralToken_: function() {
      var lastToken = this.scanner_.nextRegularExpressionLiteralToken();
      this.lastToken_ = lastToken;
      return lastToken;
    },

    /**
     * Returns true if the index-th next token is of the expected type. Does not consume any tokens.
     *
     * @param {TokenType} expectedType
     * @param {number=} opt_index
     * @return {boolean}
     * @private
     */
    peek_: function(expectedType, opt_index) {
      return this.peekType_(opt_index || 0) == expectedType;
    },

    /**
     * Returns the TokenType of the index-th next token. Does not consume any tokens.
     *
     * @return {TokenType}
     * @private
     */
    peekType_: function(opt_index) {
      return this.peekToken_(opt_index || 0).type;
    },

    /**
     * Returns the index-th next token. Does not consume any tokens.
     *
     * @return {Token}
     * @private
     */
    peekToken_: function(opt_index) {
      return this.scanner_.peekToken(opt_index || 0);
    },

    /**
     * Forks the parser at the current point and returns a new
     * parser. The new parser observes but does not report errors. This
     * can be used for speculative parsing:
     *
     * <pre>
     * var p = this.createLookaheadParser_();
     * if (p.parseX() != null &amp;&amp; !p.errorReporter_.hadError()) {
     *   return this.parseX_();  // speculation succeeded, so roll forward
     * } else {
     *   return this.parseY_();  // try something else
     * }
     * </pre>
     *
     * @return {Parser}
     * @private
     */
    createLookaheadParser_: function() {
      return new Parser(new MutedErrorReporter(),
                        this.scanner_.getFile(),
                        this.scanner_.getOffset());
    },

    /**
     * Reports an error message at a given token.
     * @param {traceur.util.SourcePostion} token The location to report the message at.
     * @param {string} message The message to report in String.format style.
     *
     * @return {void}
     * @private
     */
    reportError_: function(var_args) {
      if (arguments.length == 1)
        this.errorReporter_.reportError(this.scanner_.getPosition(), arguments[0]);
      else
        this.errorReporter_.reportError(arguments[0].getStart(), arguments[1]);
    }
  };

  return {
    Parser: Parser
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var getTreeNameForType = traceur.syntax.trees.getTreeNameForType;

  /**
   * A base class for traversing a ParseTree in top down (pre-Order) traversal.
   *
   * A node is visited before its children. Derived classes may (but are not
   * obligated) to override the specific visit(XTree) methods to add custom
   * processing for specific ParseTree types. An override of a visit(XTree)
   * method is responsible for visiting its children.
   */
  function ParseTreeVisitor() {
  }

  ParseTreeVisitor.prototype = {
    /**
     * @param {traceur.syntax.trees.ParseTree} tree
     */
    visitAny: function(tree) {
      if (tree === null) {
        return;
      }

      var name = getTreeNameForType(tree.type);
      this['visit' + name](tree);
    },

    /**
     * @param {traceur.syntax.trees.ParseTree} tree
     */
    visit: function(tree) {
      this.visitAny(tree);
    },

    /**
     * @param {Array} list
     */
    visitList: function(list) {
      for (var i = 0; i < list.length; i++) {
        this.visitAny(list[i]);
      }
    },

    /**
     * @param {traceur.syntax.trees.ArgumentList} tree
     */
    visitArgumentList: function(tree) {
      this.visitList(tree.args);
    },

    /**
     * @param {traceur.syntax.trees.ArrayLiteralExpression} tree
     */
    visitArrayLiteralExpression: function(tree) {
      this.visitList(tree.elements);
    },

    /**
     * @param {traceur.syntax.trees.ArrayPattern} tree
     */
    visitArrayPattern: function(tree) {
      this.visitList(tree.elements);
    },

    /**
     * @param {traceur.syntax.trees.AwaitStatement} tree
     */
    visitAwaitStatement: function(tree) {
      this.visitAny(tree.expression);
    },

    /**
     * @param {traceur.syntax.trees.BinaryOperator} tree
     */
    visitBinaryOperator: function(tree) {
      this.visitAny(tree.left);
      this.visitAny(tree.right);
    },

    /**
     * @param {traceur.syntax.trees.Block} tree
     */
    visitBlock: function(tree) {
      this.visitList(tree.statements);
    },

    /**
     * @param {traceur.syntax.trees.BreakStatement} tree
     */
    visitBreakStatement: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.CallExpression} tree
     */
    visitCallExpression: function(tree) {
      this.visitAny(tree.operand);
      this.visitAny(tree.args);
    },

    /**
     * @param {traceur.syntax.trees.CaseClause} tree
     */
    visitCaseClause: function(tree) {
      this.visitAny(tree.expression);
      this.visitList(tree.statements);
    },

    /**
     * @param {traceur.syntax.trees.Catch} tree
     */
    visitCatch: function(tree) {
      this.visitAny(tree.catchBody);
    },

    /**
     * @param {traceur.syntax.trees.ClassDeclaration} tree
     */
    visitClassDeclaration: function(tree) {
      this.visitAny(tree.superClass);
      this.visitList(tree.elements);
    },

    /**
     * @param {traceur.syntax.trees.ClassExpression} tree
     */
    visitClassExpression: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.CommaExpression} tree
     */
    visitCommaExpression: function(tree) {
      this.visitList(tree.expressions);
    },

    /**
     * @param {traceur.syntax.trees.ConditionalExpression} tree
     */
    visitConditionalExpression: function(tree) {
      this.visitAny(tree.condition);
      this.visitAny(tree.left);
      this.visitAny(tree.right);
    },

    /**
     * @param {traceur.syntax.trees.ContinueStatement} tree
     */
    visitContinueStatement: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.DebuggerStatement} tree
     */
    visitDebuggerStatement: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.DefaultClause} tree
     */
    visitDefaultClause: function(tree) {
      this.visitList(tree.statements);
    },

    /**
     * @param {traceur.syntax.trees.DefaultParameter} tree
     */
    visitDefaultParameter: function(tree) {
      this.visitAny(tree.identifier);
      this.visitAny(tree.expression);
    },

    /**
     * @param {traceur.syntax.trees.DoWhileStatement} tree
     */
    visitDoWhileStatement: function(tree) {
      this.visitAny(tree.body);
      this.visitAny(tree.condition);
    },

    /**
     * @param {traceur.syntax.trees.EmptyStatement} tree
     */
    visitEmptyStatement: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.ExportDeclaration} tree
     */
    visitExportDeclaration: function(tree) {
      this.visitAny(tree.declaration);
    },

    /**
     * @param {traceur.syntax.trees.ExportPath} tree
     */
    visitExportPath: function(tree) {
      this.visitAny(tree.moduleExpression);
      this.visitAny(tree.specifier);
    },

    /**
     * @param {traceur.syntax.trees.ExportPathList} tree
     */
    visitExportPathList: function(tree) {
      this.visitList(tree.paths);
    },

    /**
     * @param {traceur.syntax.trees.ExportPathSpecifier} tree
     */
    visitExportPathSpecifier: function(tree) {
      this.visitAny(tree.specifier);
    },

    /**
     * @param {traceur.syntax.trees.ExportPathSpecifierSet} tree
     */
    visitExportPathSpecifierSet: function(tree) {
      this.visitList(tree.specifiers);
    },

    /**
     * @param {traceur.syntax.trees.ExportSpecifier} tree
     */
    visitExportSpecifier: function(tree) {

    },

    /**
     * @param {traceur.syntax.trees.ExportSpecifierSet} tree
     */
    visitExportSpecifierSet: function(tree) {
      this.visitList(tree.specifiers);
    },

    /**
     * @param {traceur.syntax.trees.ExpressionStatement} tree
     */
    visitExpressionStatement: function(tree) {
      this.visitAny(tree.expression);
    },

    /**
     * @param {traceur.syntax.trees.FieldDeclaration} tree
     */
    visitFieldDeclaration: function(tree) {
      this.visitList(tree.declarations);
    },

    /**
     * @param {traceur.syntax.trees.Finally} tree
     */
    visitFinally: function(tree) {
      this.visitAny(tree.block);
    },

    /**
     * @param {traceur.syntax.trees.ForEachStatement} tree
     */
    visitForEachStatement: function(tree) {
      this.visitAny(tree.initializer);
      this.visitAny(tree.collection);
      this.visitAny(tree.body);
    },

    /**
     * @param {traceur.syntax.trees.ForInStatement} tree
     */
    visitForInStatement: function(tree) {
      this.visitAny(tree.initializer);
      this.visitAny(tree.collection);
      this.visitAny(tree.body);
    },

    /**
     * @param {traceur.syntax.trees.ForStatement} tree
     */
    visitForStatement: function(tree) {
      this.visitAny(tree.initializer);
      this.visitAny(tree.condition);
      this.visitAny(tree.increment);
      this.visitAny(tree.body);
    },

    /**
     * @param {traceur.syntax.trees.FormalParameterList} tree
     */
    visitFormalParameterList: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.FunctionDeclaration} tree
     */
    visitFunctionDeclaration: function(tree) {
      this.visitAny(tree.formalParameterList);
      this.visitAny(tree.functionBody);
    },

    /**
     * @param {traceur.syntax.trees.GetAccessor} tree
     */
    visitGetAccessor: function(tree) {
      this.visitAny(tree.body);
    },

    /**
     * @param {traceur.syntax.trees.IdentifierExpression} tree
     */
    visitIdentifierExpression: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.IfStatement} tree
     */
    visitIfStatement: function(tree) {
      this.visitAny(tree.condition);
      this.visitAny(tree.ifClause);
      this.visitAny(tree.elseClause);
    },

    /**
     * @param {traceur.syntax.trees.ImportDeclaration} tree
     */
    visitImportDeclaration: function(tree) {
      this.visitList(tree.importPathList);
    },

    /**
     * @param {traceur.syntax.trees.ImportPath} tree
     */
    visitImportPath: function(tree) {
      if (tree.importSpecifierSet !== null) {
        this.visitList(tree.importSpecifierSet);
      }
    },

    /**
     * @param {traceur.syntax.trees.ImportSpecifier} tree
     */
    visitImportSpecifier: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.LabelledStatement} tree
     */
    visitLabelledStatement: function(tree) {
      this.visitAny(tree.statement);
    },

    /**
     * @param {traceur.syntax.trees.LiteralExpression} tree
     */
    visitLiteralExpression: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.MemberExpression} tree
     */
    visitMemberExpression: function(tree) {
      this.visitAny(tree.operand);
    },

    /**
     * @param {traceur.syntax.trees.MemberLookupExpression} tree
     */
    visitMemberLookupExpression: function(tree) {
      this.visitAny(tree.operand);
      this.visitAny(tree.memberExpression);
    },

    /**
     * @param {traceur.syntax.trees.MissingPrimaryExpression} tree
     */
    visitMissingPrimaryExpression: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.Mixin} tree
     */
    visitMixin: function(tree) {
      this.visitAny(tree.mixinResolves);
    },

    /**
     * @param {traceur.syntax.trees.MixinResolve} tree
     */
    visitMixinResolve: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.MixinResolveList} tree
     */
    visitMixinResolveList: function(tree) {
      this.visitList(tree.resolves);
    },

    /**
     * @param {traceur.syntax.trees.ModuleDeclaration} tree
     */
    visitModuleDeclaration: function(tree) {
      this.visitList(tree.specifiers);
    },

    /**
     * @param {traceur.syntax.trees.ModuleDefinition} tree
     */
    visitModuleDefinition: function(tree) {
      this.visitList(tree.elements);
    },

    /**
     * @param {traceur.syntax.trees.ModuleExpression} tree
     */
    visitModuleExpression: function(tree) {
      this.visitAny(tree.reference);
    },

    /**
     * @param {traceur.syntax.trees.ModuleRequire} tree
     */
    visitModuleRequire: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.ModuleSpecifier} tree
     */
    visitModuleSpecifier: function(tree) {
      this.visitAny(tree.expression);
    },

    /**
     * @param {traceur.syntax.trees.NewExpression} tree
     */
    visitNewExpression: function(tree) {
      this.visitAny(tree.operand);
      this.visitAny(tree.args);
    },

    /**
     * @param {traceur.syntax.trees.NullTree} tree
     */
    visitNullTree: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.ObjectLiteralExpression} tree
     */
    visitObjectLiteralExpression: function(tree) {
      this.visitList(tree.propertyNameAndValues);
    },

    /**
     * @param {traceur.syntax.trees.ObjectPattern} tree
     */
    visitObjectPattern: function(tree) {
      this.visitList(tree.fields);
    },

    /**
     * @param {traceur.syntax.trees.ObjectPatternField} tree
     */
    visitObjectPatternField: function(tree) {
      this.visitAny(tree.element);
    },

    /**
     * @param {traceur.syntax.trees.ParenExpression} tree
     */
    visitParenExpression: function(tree) {
      this.visitAny(tree.expression);
    },

    /**
     * @param {traceur.syntax.trees.PostfixExpression} tree
     */
    visitPostfixExpression: function(tree) {
      this.visitAny(tree.operand);
    },

    /**
     * @param {traceur.syntax.trees.Program} tree
     */
    visitProgram: function(tree) {
      this.visitList(tree.programElements);
    },

    /**
     * @param {traceur.syntax.trees.PropertyNameAssignment} tree
     */
    visitPropertyNameAssignment: function(tree) {
      this.visitAny(tree.value);
    },

    /**
     * @param {traceur.syntax.trees.QualifiedReference} tree
     */
    visitQualifiedReference: function(tree) {
      this.visitAny(tree.moduleExpression);
    },

    /**
     * @param {traceur.syntax.trees.RequiresMember} tree
     */
    visitRequiresMember: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.RestParameter} tree
     */
    visitRestParameter: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.ReturnStatement} tree
     */
    visitReturnStatement: function(tree) {
      this.visitAny(tree.expression);
    },

    /**
     * @param {traceur.syntax.trees.SetAccessor} tree
     */
    visitSetAccessor: function(tree) {
      this.visitAny(tree.body);
    },

    /**
     * @param {traceur.syntax.trees.SpreadExpression} tree
     */
    visitSpreadExpression: function(tree) {
      this.visitAny(tree.expression);
    },

    /**
     * @param {traceur.syntax.trees.SpreadPatternElement} tree
     */
    visitSpreadPatternElement: function(tree) {
      this.visitAny(tree.lvalue);
    },

    /**
     * @param {traceur.syntax.trees.StateMachine} tree
     */
    visitStateMachine: function(tree) {
      throw Error('State machines should not live outside of the' +
          ' GeneratorTransformer.');
    },

    /**
     * @param {traceur.syntax.trees.SuperExpression} tree
     */
    visitSuperExpression: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.SwitchStatement} tree
     */
    visitSwitchStatement: function(tree) {
      this.visitAny(tree.expression);
      this.visitList(tree.caseClauses);
    },

    /**
     * @param {traceur.syntax.trees.ThisExpression} tree
     */
    visitThisExpression: function(tree) {
    },

    /**
     * @param {traceur.syntax.trees.ThrowStatement} tree
     */
    visitThrowStatement: function(tree) {
      this.visitAny(tree.value);
    },

    /**
     * @param {traceur.syntax.trees.TraitDeclaration} tree
     */
    visitTraitDeclaration: function(tree) {
      this.visitList(tree.elements);
    },

    /**
     * @param {traceur.syntax.trees.TryStatement} tree
     */
    visitTryStatement: function(tree) {
      this.visitAny(tree.body);
      this.visitAny(tree.catchBlock);
      this.visitAny(tree.finallyBlock);
    },

    /**
     * @param {traceur.syntax.trees.UnaryExpression} tree
     */
    visitUnaryExpression: function(tree) {
      this.visitAny(tree.operand);
    },

    /**
     * @param {traceur.syntax.trees.VariableDeclaration} tree
     */
    visitVariableDeclaration: function(tree) {
      this.visitAny(tree.lvalue);
      this.visitAny(tree.initializer);
    },

    /**
     * @param {traceur.syntax.trees.VariableDeclarationList} tree
     */
    visitVariableDeclarationList: function(tree) {
      this.visitList(tree.declarations);
    },

    /**
     * @param {traceur.syntax.trees.VariableStatement} tree
     */
    visitVariableStatement: function(tree) {
      this.visitAny(tree.declarations);
    },

    /**
     * @param {traceur.syntax.trees.WhileStatement} tree
     */
    visitWhileStatement: function(tree) {
      this.visitAny(tree.condition);
      this.visitAny(tree.body);
    },

    /**
     * @param {traceur.syntax.trees.WithStatement} tree
     */
    visitWithStatement: function(tree) {
      this.visitAny(tree.expression);
      this.visitAny(tree.body);
    },

    /**
     * @param {traceur.syntax.trees.YieldStatement} tree
     */
    visitYieldStatement: function(tree) {
      this.visitAny(tree.expression);
    }
  };

  // Export
  return {
    ParseTreeVisitor: ParseTreeVisitor
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('util', function() {
  'use strict';

  /**
   * Builds strings by appending them.
   * @constructor
   */
  function StringBuilder() {
    this.strings_ = [];
    this.length = 0;
  }

  StringBuilder.prototype = {
    append: function(str) {
      str = str.toString();
      this.length += str.length;
      this.strings_.push(str);
      return this;
    },

    toString: function() {
      return this.strings_.join('');
    },

    // Instead of supporting charAt and deleteCharAt, implement lastChar and
    // deleteLastChar. These can be implemented in constant time with no
    // additional data structures

    lastChar: function() {
      var last = this.strings_[this.strings_.length - 1];
      if (last) {
        last = last[last.length - 1];
      }
      return last;
    },

    deleteLastChar: function() {
      var lastString = this.strings_.length - 1;
      var last = this.strings_[lastString];
      if (last) {
        this.strings_[lastString] = last.substring(0, last.length - 1);
      }
    }
  };

  return {
    StringBuilder: StringBuilder
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics', function() {
  'use strict';

  var IdentifierToken = traceur.syntax.IdentifierToken;
  var ParseTreeType = traceur.syntax.ParseTreeType;
  var ParseTreeVisitor = traceur.syntax.ParseTreeVisitor;
  var TokenType = traceur.syntax.TokenType;
  var Block = traceur.syntax.trees.Block;
  var Catch = traceur.syntax.trees.Catch;
  var ForInStatement = traceur.syntax.trees.ForInStatement;
  var ForStatement = traceur.syntax.trees.ForStatement;
  var FunctionDeclaration = traceur.syntax.trees.FunctionDeclaration;
  var ObjectPatternField = traceur.syntax.trees.ObjectPatternField;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var VariableDeclarationList = traceur.syntax.trees.VariableDeclarationList;
  var VariableDeclaration = traceur.syntax.trees.VariableDeclaration;

  /**
   * Finds the identifiers that are bound in a given scope. Identifiers
   * can be bound by function declarations, formal parameter lists,
   * variable declarations, and catch headers.
   * @param {boolean} inFunctionScope
   * @param {Block=} scope
   * @extends {ParseTreeVisitor}
   * @constructor
   */
  function VariableBinder(includeFunctionScope, scope) {
    ParseTreeVisitor.call(this);

    // Should we include:
    // * all "var" declarations
    // * all block scoped declarations occurring in the top level function block.
    this.includeFunctionScope_ = includeFunctionScope;

    // Block within which we are looking for declarations:
    // * block scoped declaration occurring in this block.
    // If function != null this refers to the top level function block.
    this.scope_ = scope || null;

    // Block currently being processed
    this.block_ = null;

    this.identifiers_ = Object.create(null);
  }

  // TODO: Add entry more entry points:
  //    for..in statment
  //    for statement

  /**
   * Gets the identifiers bound in {@code tree}. The tree should be a block
   * statement. This means if {@code tree} is:
   *
   * <pre>
   * { function f(x) { var y; } }
   * </pre>
   *
   * Then only {@code "f"} is bound; {@code "x"} and {@code "y"} are bound in
   * the separate lexical scope of {@code f}. Note that only const/let bound
   * variables (such as {@code "f"} in this example) are returned. Variables
   * declared with "var" are only returned when {@code includeFunctionScope} is
   * set to true.
   *
   * If {@code tree} was instead:
   * <pre>
   * { var z = function f(x) { var y; }; }
   * </pre>
   *
   * Then only {@code "z"} is bound
   *
   * @param {Block} tree
   * @param {boolean=} includeFunctionScope
   * @return {Object}
   */
  VariableBinder.variablesInBlock = function(tree,
      includeFunctionScope) {
    var binder = new VariableBinder(includeFunctionScope, tree);
    binder.visitAny(tree);
    return binder.identifiers_;
  };

  /**
   * Gets the identifiers bound in the context of a function,
   * {@code tree}, other than the function name itself. For example, if
   * {@code tree} is:
   *
   * <pre>
   * function f(x) { var y; f(); }
   * </pre>
   *
   * Then a set containing only {@code "x"} and {@code "y"} is returned. Note
   * that we treat {@code "f"} as free in the body of {@code f}, because
   * AlphaRenamer uses this fact to determine if the function name is shadowed
   * by another name in the body of the function.
   *
   * <p>Only identifiers that are bound <em>throughout</em> the
   * specified tree are returned, for example:
   *
   * <pre>
   * function f() {
   *   try {
   *   } catch (x) {
   *     function g(y) { }
   *   }
   * }
   * </pre>
   *
   * Reports nothing as being bound, because {@code "x"} is only bound in the
   * scope of the catch block; {@code "g"} is let bound to the catch block, and
   * {@code "y"} is only bound in the scope of {@code g}.
   *
   * <p>{@code "arguments"} is only reported as bound if it is
   * explicitly bound in the function. If it is not explicitly bound,
   * {@code "arguments"} is implicitly bound during function
   * invocation.
   *
   * @param {FunctionDeclaration} tree
   * @return {Object}
   */
  VariableBinder.variablesInFunction = function(tree) {
    var binder = new VariableBinder(true, tree.functionBody);
    binder.bindVariablesInFunction_(tree);
    return binder.identifiers_;
  };

  var proto = ParseTreeVisitor.prototype;
  
  traceur.inherits(VariableBinder, ParseTreeVisitor, {
    __proto__: proto,

    /** @param {FunctionDeclaration} tree */
    bindVariablesInFunction_: function(tree) {
      var parameters = tree.formalParameterList.parameters;
      for (var i = 0; i < parameters.length; i++) {
        this.bindParameter_(parameters[i]);
      }
      this.visitAny(tree.functionBody);
    },

    /** @param {Block} tree */
    visitBlock: function(tree) {
      // Save and set current block
      var parentBlock = this.block_;
      this.block_ = tree;

      // visit the statements
      tree.statements.forEach(function(s) {
        if (s.type == ParseTreeType.FUNCTION_DECLARATION) {
          this.bindFunctionDeclaration_(s);
        } else {
          this.visitAny(s);
        }
      }, this);

      // restore current block
      this.block_ = parentBlock;
    },

    /** @param {FunctionDeclaration} tree */
    bindFunctionDeclaration_: function(tree) {
      // functions follow the binding rules of 'let'
      if (tree.name != null && this.block_ == this.scope_) {
        this.bind_(tree.name);
      }
      // We don't recurse into function bodies, because they create
      // their own lexical scope.
    },

    /** @param {FunctionDeclaration} tree */
    visitFunctionDeclaration: function(tree) {
      // We don't recurse into function bodies, because they create
      // their own lexical scope.
    },

    /** @param {ForEachStatement} tree */
    visitForEachStatement: function(tree) {
      throw new Error('foreach statements should be transformed before this pass');
    },

    /** @param {ForInStatement} tree */
    visitForInStatement: function(tree) {
      if (tree.initializer != null &&
          tree.initializer.type == ParseTreeType.VARIABLE_DECLARATION_LIST) {
        this.visitForDeclarations_(tree.initializer);
      } else {
        this.visitAny(tree.initializer);
      }

      // visit the rest of the for..in statement
      this.visitAny(tree.collection);
      this.visitAny(tree.body);
    },

    /** @param {ForStatement} tree */
    visitForStatement: function(tree) {
      if (tree.initializer != null &&
          tree.initializer.type == ParseTreeType.VARIABLE_DECLARATION_LIST) {
        this.visitForDeclarations_(tree.initializer);
      } else {
        this.visitAny(tree.initializer);
      }

      // visit the rest of the for statement
      this.visitAny(tree.condition);
      this.visitAny(tree.increment);
      this.visitAny(tree.body);
    },

    /** @param {VariableDeclarationList} declarations */
    visitForDeclarations_: function(declarations) {
      if (declarations.declarationType == TokenType.VAR) {
        this.visitAny(declarations);
      } else {
        // let and const declare in the nested scope, not the outer scope
        // so we need to bypass them (but walk the initializers)
        var decls = declarations.declarations;
        for (var i = 0; i < decls.length; i++) {
          // skipping lvalue, visit only initializer
          this.visitAny(decls[i].initializer);
        }
      }
    },

    /** @param {VariableDeclarationList} tree */
    visitVariableDeclarationList: function(tree) {
      // "var" variables are bound if we are scanning the whole function only
      // "let/const" are bound if (we are scanning block scope or function) AND
      //   the scope currently processed is the scope we care about
      //   (either the block scope being scanned or the top level function scope)
      if ((tree.declarationType == TokenType.VAR && this.includeFunctionScope_) ||
          (tree.declarationType != TokenType.VAR && this.block_ == this.scope_)) {
        // declare the variables
        proto.visitVariableDeclarationList.call(this, tree);
      } else {
        // skipping let/const declarations in nested blocks
        var decls = tree.declarations;
        for (var i = 0; i < decls.length; i++) {
          this.visitAny(decls[i].initializer);
        }
      }
    },

    /** @param {VariableDeclaration} tree */
    visitVariableDeclaration: function(tree) {
      this.bindVariableDeclaration_(tree.lvalue);
      proto.visitVariableDeclaration.call(this, tree);
    },

    /** @param {IdentifierToken} identifier */
    bind_: function(identifier) {
      this.identifiers_[identifier.value] = true;
    },

    /** @param {ParseTree} parameter */
    bindParameter_: function(parameter) {
      if (parameter.isRestParameter()) {
        this.bind_(parameter.identifier);
      } else {
        // Formal parameters are otherwise like variable
        // declarations--identifier expressions and patterns
        this.bindVariableDeclaration_(parameter);
      }
    },

    /** @param {ParseTree} parameter */
    bindVariableDeclaration_: function(tree) {
      switch (tree.type) {
        case ParseTreeType.IDENTIFIER_EXPRESSION:
          this.bind_(tree.identifierToken);
          break;

        case ParseTreeType.ARRAY_PATTERN:
          var i = tree.elements;
          for (var i = 0; i < elements.length; i++) {
            this.bindVariableDeclaration_(elements[i]);
          }
          break;

        case ParseTreeType.SPREAD_PATTERN_ELEMENT:
          this.bindVariableDeclaration_(tree.lvalue);
          break;

        case ParseTreeType.OBJECT_PATTERN:
          var fields = tree.fields;
          for (var i = 0; i < fields.length; i++) {
            this.bindVariableDeclaration_(fields[i]);
          }
          break;

        case ParseTreeType.OBJECT_PATTERN_FIELD:
          var field = tree;
          if (field.element == null) {
            this.bind_(field.identifier);
          } else {
            this.bindVariableDeclaration_(field.element);
          }
          break;

        case ParseTreeType.PAREN_EXPRESSION:
          this.bindVariableDeclaration_(tree.expression);
          break;

        default:
          throw new Error('unreachable');
      }
    }
  });

  return {
    VariableBinder: VariableBinder
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  /** @enum {string} */
  var SymbolType = {
    CLASS: 'CLASS',
    EXPORT: 'EXPORT',
    FIELD: 'FIELD',
    METHOD: 'METHOD',
    MODULE: 'MODULE',
    PROPERTY: 'PROPERTY',
    REQUIRES: 'REQUIRES',
    TRAIT: 'TRAIT'
  };

  return {
    SymbolType: SymbolType
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var assert = traceur.assert;

  /**
   * A symbol is a named program element. Currently symbols include classes, traits, fields,
   * methods and properties.
   *
   * Symbols are plain old data structures only. They have methods for querying their contents, but
   * symbols do not implement more sophisticated semantics than simple data access.
   *
   * @param {SymbolType} type
   * @param {ParseTree} tree
   * @param {string} name
   * @constructor
   */
  function Symbol(type, tree, name) {
    this.type = type;
    this.tree = tree;
    this.name = name;
  }

  Symbol.prototype = {

    /**
     * @return {ClassSymbol}
     */
    asClass: function() {
      assert(this instanceof traceur.semantics.symbols.ClassSymbol);
      return this;
    },

    /**
     * @return {ExportSymbol}
     */
    asExport: function() {
      assert(this instanceof traceur.semantics.symbols.ExportSymbol);
      return this;
    },

    /**
     * @return {FieldSymbol}
     */
    asField: function() {
      assert(this instanceof traceur.semantics.symbols.FieldSymbol);
      return this;
    },

    /**
     * @return {MethodSymbol}
     */
    asMethod: function() {
      assert(this instanceof traceur.semantics.symbols.MethodSymbol);
      return this;
    },

    /**
     * @return {MixinMemberSymbol}
     */
    asMixinMember: function() {
      assert(this instanceof traceur.semantics.symbols.MixinMemberSymbol);
      return this;
    },

    /**
     * @return {ModuleSymbol}
     */
    asModuleSymbol: function() {
      assert(this instanceof traceur.semantics.symbols.ModuleSymbol);
      return this;
    },

    /**
     * @return {PropertySymbol}
     */
    asProperty: function() {
      assert(this instanceof traceur.semantics.symbols.PropertySymbol);
      return this;
    },

    /**
     * @return {RequiresSymbol}
     */
    asRequires: function() {
      assert(this instanceof traceur.semantics.symbols.RequiresSymbol);
      return this;
    },

    /**
     * @return {TraitSymbol}
     */
    asTrait: function() {
      assert(this instanceof traceur.semantics.symbols.TraitSymbol);
      return this;
    },

    /**
     * @return {Array.<ParseTree>}
     */
    getRelatedLocations: function() {
      return [this.tree];
    }
  };

  return {
    Symbol: Symbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var Symbol = traceur.semantics.symbols.Symbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;

  /**
   * Members of an aggregate(class, trait or mixin).
   *
   * @param {SymbolType} type
   * @param {ParseTree} tree
   * @param {string} name
   * @param {AggregateSymbol} containingAggregate
   * @param {boolean} isStatic
   * @constructor
   * @extends {Symbol}
   */
  function MemberSymbol(type, tree, name, containingAggregate, isStatic) {
    Symbol.call(this, type, tree, name);
    this.containingAggregate = containingAggregate;
    this.isStatic = isStatic;
    containingAggregate.addMember(this);
  }

  traceur.inherits(MemberSymbol, Symbol, {
    __proto__: Symbol.prototype,

    /**
     * For most members the implementation is just the member itself. For members which are added
     * by mixing in a trait, the implementation is the trait member which implements the class member.
     *
     * @return {MemberSymbol}
     */
    getImplementation: function() {
      return this;
    },

    /**
     * Is this a requires member, or a mixin of a requires member.
     *
     * @return {boolean}
     */
    isRequires: function() {
      return this.getImplementation().type == SymbolType.REQUIRES;
    },

    /**
     * Return a name suitable for error reporting purposes.
     *
     * @return {string}
     */
    getQualifiedName: function() {
      return this.containingAggregate.name + '.' + name;
    }
  });

  return {
    MemberSymbol: MemberSymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var MemberSymbol = traceur.semantics.symbols.MemberSymbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;
  var PredefinedName = traceur.syntax.PredefinedName;

  /**
   * @param {FunctionDeclaration} tree
   * @param {string} name
   * @param {AggregateSymbol} containingAggregate
   * @param {boolean} isStatic
   * @constructor
   * @extends {MemberSymbol}
   */
  function MethodSymbol(tree, name, containingAggregate, isStatic) {
    MemberSymbol.call(this, SymbolType.METHOD, tree, name, containingAggregate,
                      isStatic);
    this.tree = tree;
  }

  traceur.inherits(MethodSymbol, MemberSymbol, {
    __proto__: MemberSymbol.prototype,

    /**
     * @return {boolean}
     */
    isConstructor: function() {
      return this.name == PredefinedName.NEW;
    }
  });

  return {
    MethodSymbol: MethodSymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var Symbol = traceur.semantics.symbols.Symbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;

  /**
   * @param {string} name
   * @param {ModuleSymbol} parent
   * @param {ModuleDefinition} tree
   * @constructor
   * @extends {Symbol}
   */
  function ModuleSymbol(name, parent, tree) {
    Symbol.call(this, SymbolType.MODULE, tree, name);
    this.children_ = Object.create(null);
    this.exports_ = Object.create(null);
    this.parent = parent;
    this.tree = tree;
  }

  traceur.inherits(ModuleSymbol, Symbol, {
    __proto__: Symbol.prototype,

    /**
     * @param {ModuleSymbol} module
     * @return {void}
     */
    addModule: function(module) {
      this.addModuleWithName(module, module.name);
    },

    /**
     * @param {ModuleSymbol} module
     * @param {string} name
     * @return {void}
     */
    addModuleWithName: function(module, name) {
      this.children_[name] = module;
    },

    /**
     * @param {string} name
     * @return {boolean}
     */
    hasModule: function(name) {
      return name in this.children_;
    },

    /**
     * @param {string} name
     * @return {ModuleSymbol}
     */
    getModule: function(name) {
      return this.children_[name];
    },

    /**
     * @param {string} name
     * @return {boolean}
     */
    hasExport: function(name) {
      return name in this.exports_;
    },

    /**
     * @param {string} name
     * @return {ExportSymbol}
     */
    getExport: function(name) {
      return this.exports_[name];
    },

    /**
     * @param {string} name
     * @param {ExportSymbol} export
     * @return {void}
     */
    addExport: function(name, exp) {
      this.exports_[name] = exp;
    },

    /**
     * @return {Array.<ExportSymbol>}
     */
    getExports: function() {
      var exports = this.exports_;
      return Object.keys(exports).map(function(key) {
        return exports[key];
      });
    }
  });

  return {
    ModuleSymbol: ModuleSymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var Symbol = traceur.semantics.symbols.Symbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;

  /**
   * @param {ParseTree} tree
   * @param {string} name
   * @param {ParseTree=} relatedTree
   * @constructor
   * @extends {Symbol}
   */
  function ExportSymbol(tree, name, relatedTree) {
    Symbol.call(this, SymbolType.EXPORT, tree, name);
    this.relatedTree = relatedTree;
  }

  traceur.inherits(ExportSymbol, Symbol, {
    __proto__: Symbol.prototype
  });

  return {
    ExportSymbol: ExportSymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var MemberSymbol = traceur.semantics.symbols.MemberSymbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;

  /**
   * @param {FieldDeclaration} field
   * @param {VariableDeclaration} tree
   * @param {string} name
   * @param {AggregateSymbol} containingAggregate
   * @constructor
   * @extends {MemberSymbol}
   */
  function FieldSymbol(field, tree, name, containingAggregate) {
    MemberSymbol.call(this, SymbolType.FIELD, tree, name, containingAggregate,
                      field.isStatic);
    this.field = field;
    this.tree = tree;
  }
  
  traceur.inherits(FieldSymbol, MemberSymbol, {
    __proto__: MemberSymbol.prototype,

    /**
     * @return {boolean}
     */
    isConst: function() {
      return this.field.isConst;
    }
  });

  return {
    FieldSymbol: FieldSymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  /**
   * A get or set accessor for a property.
   *
   * @param {PropertySymbol} property
   * @constructor
   */
  function PropertyAccessor(property) {
    this.property = property;
  }

  PropertyAccessor.prototype = {
    /**
     * @return {string}
     */
    getName: function() {
      return this.property.name;
    },

    /**
     * @return {AggregateSymbol}
     */
    getContainingAggregate: function() {
      return this.property.containingAggregate;
    },

    /**
     * @return {boolean}
     */
    isStatic: function() {
      return this.property.isStatic;
    }
  };

  return {
    PropertyAccessor: PropertyAccessor
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var PropertyAccessor = traceur.semantics.symbols.PropertyAccessor;
  var SymbolType = traceur.semantics.symbols.SymbolType;
  var PropertyAccessor = traceur.semantics.symbols.PropertyAccessor;

  /**
   * A get accessor of a property.
   *
   * @param {PropertySymbol} property
   * @param {GetAccessor} tree
   * @constructor
   * @extends {PropertyAccessor}
   */
  function GetAccessor(property, tree) {
    PropertyAccessor.call(this, property);
    this.tree = tree;
  }
  
  traceur.inherits(GetAccessor, PropertyAccessor, {
    __proto__: PropertyAccessor.prototype
  });

  return {
    GetAccessor: GetAccessor
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var PropertyAccessor = traceur.semantics.symbols.PropertyAccessor;
  var SymbolType = traceur.semantics.symbols.SymbolType;
  var PropertyAccessor = traceur.semantics.symbols.PropertyAccessor;

  /**
   * A set property acccessor.
   *
   * @param {PropertySymbol} property
   * @param {SetAccessor} tree
   * @constructor
   * @extends {PropertyAccessor}
   */
  function SetAccessor(property, tree) {
    PropertyAccessor.call(this, property);

    this.tree = tree;
  }
  
  traceur.inherits(SetAccessor, PropertyAccessor, {
    __proto__: PropertyAccessor.prototype
  });

  return {
    SetAccessor: SetAccessor
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var MemberSymbol = traceur.semantics.symbols.MemberSymbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;

  /**
   * A property on a class or trait.
   *
   * @param {ParseTree} tree
   * @param {string} name
   * @param {AggregateSymbol} containingAggregate
   * @param {boolean} isStatic
   * @constructor
   * @extends {MemberSymbol}
   */
  function PropertySymbol(tree, name, containingAggregate, isStatic) {
    MemberSymbol.call(this, SymbolType.PROPERTY, tree, name,
                      containingAggregate, isStatic);
  }
  
  traceur.inherits(PropertySymbol, MemberSymbol, {
    __proto__: MemberSymbol.prototype
  });

  return {
    PropertySymbol: PropertySymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var Symbol = traceur.semantics.symbols.Symbol;
  var PredefinedName = traceur.syntax.PredefinedName;
  var FieldSymbol = traceur.semantics.symbols.FieldSymbol;
  var MethodSymbol = traceur.semantics.symbols.MethodSymbol;

  function values(object) {
    return Object.keys(object).map(function(key) {
      return object[key];
    });
  }

  /**
   * Aggregate State progresses forward, never goes backwards.
   * @enum {number}
   */
  var State = {
    Declared: 1,
    BeginDeclaringMembers: 2,
    MembersDeclared: 3
  };


  /**
   * A base class for ClassSymbol and TraitSymbol. Also has one short-lived derived class MixinSymbol.
   *
   * Aggregates have a state which moves forward from Declared, to SuperClassResolved, to
   * MembersDeclared. An aggregate must transition through all intermediate states on its way to
   * MemberDeclared. An aggregate state never goes backwards.
   *
   * @param {SymbolType} type
   * @param {ParseTree} tree
   * @param {string} name
   * @constructor
   * @extends {Symbol}
   */
  function AggregateSymbol(type, tree, name) {
    Symbol.call(this, type, tree, name);

    this.state_ = State.Declared;
    this.instanceMembers = Object.create(null);
    this.staticMembers = Object.create(null);
    this.mixins = [];
  }

  traceur.inherits(AggregateSymbol, Symbol, {
    __proto__: Symbol.prototype,

    /**
     * @return {boolean}
     */
    isDeclaringMembers: function() {
      return this.state_ == State.BeginDeclaringMembers;
    },

    /**
     * @return {boolean}
     */
    isMembersDeclared: function() {
      return this.state_ == State.MembersDeclared;
    },

    /**
     * @return {void}
     */
    beginDeclaringMembers: function() {
      this.state_ = State.BeginDeclaringMembers;
    },

    /**
     * @return {void}
     */
    endDeclaringMembers: function() {
      if (!this.isDeclaringMembers()) {
        throw new Error();
      }
      this.state_ = State.MembersDeclared;
    },

    /**
     * Returns an instance member with a given name defined in this class or one of this class's base class.
     *
     * @param {string} name
     * @return {MemberSymbol}
     */
    lookupInstanceSymbol: function(name) {
      return this.getInstanceMember(name);
    },

    /**
     * Does this class contain an instance member with name. Does not search base classes.
     *
     * @param {string} name
     * @return {boolean}
     */
    hasInstanceMember: function(name) {
      return name in this.instanceMembers;
    },

    /**
     * Does this class contain a static member with name. Does not search base classes.
     *
     * @param {string} name
     * @return {boolean}
     */
    hasStaticMember: function(name) {
      return name in this.staticMembers;
    },

    /**
     * Returns an instance member defined in this class with a given name. Does not search base classes.
     *
     * @param {string} name
     * @return {MemberSymbol}
     */
    getInstanceMember: function(name) {
      return this.instanceMembers[name];
    },

    /**
     * Returns a static member defined in this class with a given name. Does not search base classes.
     */
    /**
     * @param {string} name
     * @return {MemberSymbol}
     */
    getStaticMember: function(name) {
      return this.staticMembers[name];
    },

    /**
     * @param {MemberSymbol} member
     * @return {void}
     */
    addMember: function(member) {
      var map = member.isStatic ? this.staticMembers : this.instanceMembers;
      delete map[member.name];
      map[member.name] = member;
    },

    /**
     * @return {Array.<MemberSymbol>}
     */
    getInstanceMembers: function() {
      return values(this.instanceMembers);
    },

    /**
     * @return {Array.<MemberSymbol>}
     */
    getStaticMembers: function() {
      return values(this.staticMembers);
    },

    /**
     * @return {Array.<MethodSymbol>}
     */
    getInstanceMethods: function() {
      return this.getInstanceMembers().filter(function(m) {
        return m instanceof MethodSymbol;
      });
    },

    /**
     * @return {Array.<FieldSymbol>}
     */
    getInstanceFields: function() {
      return this.getInstanceMembers().filter(function(m) {
        return m instanceof FieldSymbol;
      });
    },

    /**
     * @return {MethodSymbol}
     */
    getConstructor: function() {
      return this.getInstanceMember(PredefinedName.NEW);
    },

    /**
     * @return {MethodSymbol}
     */
    getStaticConstructor: function() {
      return this.getStaticMember(PredefinedName.NEW);
    },

    /**
     * @return {boolean}
     */
    hasConstructor: function() {
      return !!this.getConstructor();
    }
  });

  return {
    AggregateSymbol: AggregateSymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var AggregateSymbol = traceur.semantics.symbols.AggregateSymbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;

  /**
   * A symbol representing a class definition.
   *
   * Classes can be user defined or predefined(defined by the compiler/DOM).
   *
   * @param {string} name
   * @param {ClassDeclaration} tree
   * @constructor
   * @extends {AggregateSymbol}
   */
  function ClassSymbol(name, tree) {
    AggregateSymbol.call(this, SymbolType.CLASS, tree, name);
    this.tree = tree;
  }
  
  traceur.inherits(ClassSymbol, AggregateSymbol, {
    __proto__: AggregateSymbol.prototype
  });

  return {
    ClassSymbol: ClassSymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var ObjectMap = traceur.util.ObjectMap;
  var ModuleSymbol = traceur.semantics.symbols.ModuleSymbol;

  function addAll(self, other) {
    for (key in other) {
      self[key] = other[key];
    }
  }

  function values(map) {
    return Object.keys(map).map(function(key) {
      return map[key];
    });
  }

  /**
   * The root data structure for all semantic and syntactic information for a
   * single compilation.
   *
   * @constructor
   */
  function Project() {
    this.sourceFiles_ = Object.create(null);
    this.parseTrees_ = new ObjectMap();
    this.rootModule_ = new ModuleSymbol(null, null, null);
  }

  Project.prototype = {
    /**
     * @return {Project}
     */
    createClone: function() {
      var p = new Project();
      addAll(p.sourceFiles_, this.sourceFiles_);
      p.parseTrees_.addAll(this.parseTrees_);
      // push(...)
      p.objectClass_ = objectClass_;
      return p;
    },

    /**
     * @param {string} name
     * @return {boolean}
     */
    hasFile: function(name) {
      return name in this.sourceFiles_;
    },

    /**
     * @param {SourceFile} file
     * @return {void}
     */
    addFile: function(file) {
      this.sourceFiles_[file.name] = file;
    },

    /**
     * @param {string} name
     * @return {SourceFile}
     */
    getFile: function(name) {
      return this.sourceFiles_[name];
    },

    /**
     * @return {Array.<SourceFile>}
     */
    getSourceFiles: function() {
      return values(this.sourceFiles_);
    },

    /**
     * @return {Array.<Program>}
     */
    getSourceTrees: function() {
      return this.parseTrees_.values();
    },

    /**
     * @param {SourceFile} file
     * @param {Program} tree
     * @return {void}
     */
    setParseTree: function(file, tree) {
      if (this.sourceFiles_[file.name] != file) {
        throw new Error();
      }
      this.parseTrees_.put(file, tree);
    },

    /**
     * @param {SourceFile} file
     * @return {Program}
     */
    getParseTree: function(file) {
      return this.parseTrees_.get(file);
    },

    /**
     * @return {ModuleSymbol}
     */
    getRootModule: function() {
      return this.rootModule_;
    }
  };

  return {
    Project: Project
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var AggregateSymbol = traceur.semantics.symbols.AggregateSymbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;

  /**
   * A symbol representing a trait definition.
   *
   * @param {string} name
   * @param {TraitDeclaration} tree
   * @constructor
   * @extends {AggregateSymbol}
   */
  function TraitSymbol(name, tree) {
    AggregateSymbol.call(this, SymbolType.TRAIT, tree, name);

    this.tree = tree;
  }

  traceur.inherits(TraitSymbol, AggregateSymbol, {
    __proto__: AggregateSymbol.prototype
  });

  return {
    TraitSymbol: TraitSymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics.symbols', function() {
  'use strict';

  var MemberSymbol = traceur.semantics.symbols.MemberSymbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;

  /**
   * A requires member of a class or trait.
   *
   * Similar to an abstract member - a requires member is a member that
   * must be implemented either by a derived class (if the member is a class member) or by the mixing
   * in class (if the member is a trait member).
   *
   * @param {ParseTree} tree
   * @param {string|MemberSymbol} nameOrFrom
   * @param {AggregateSymbol} containingAggregate
   * @constructor
   * @extends {MemberSymbol}
   */
  function RequiresSymbol(tree, nameOrFrom, containingAggregate) {
    var name, from;
    if (typeof nameOrFrom == 'string') {
      name = nameOrFrom;
      from = null;
    } else {
      from = nameOrFrom;
      name = from.name;
    }

    MemberSymbol.call(this, SymbolType.REQUIRES, tree, name,
                      containingAggregate, false);
    this.from_ = from;
  }

  traceur.inherits(RequiresSymbol, MemberSymbol, {
    __proto__: MemberSymbol.prototype
  });

  return {
    RequiresSymbol: RequiresSymbol
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics', function() {
  'use strict';

  var PredefinedName = traceur.syntax.PredefinedName;
  var SourceFile = traceur.syntax.SourceFile;
  var Token = traceur.syntax.Token;
  var TokenType = traceur.syntax.TokenType;
  var ClassDeclaration = traceur.syntax.trees.ClassDeclaration;
  var ExportDeclaration = traceur.syntax.trees.ExportDeclaration;
  var FieldDeclaration = traceur.syntax.trees.FieldDeclaration;
  var FunctionDeclaration = traceur.syntax.trees.FunctionDeclaration;
  var GetAccessor = traceur.syntax.trees.GetAccessor;
  var MixinResolve = traceur.syntax.trees.MixinResolve;
  var Mixin = traceur.syntax.trees.Mixin;
  var ModuleDefinition = traceur.syntax.trees.ModuleDefinition;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var Program = traceur.syntax.trees.Program;
  var RequiresMember = traceur.syntax.trees.RequiresMember;
  var SetAccessor = traceur.syntax.trees.SetAccessor;
  var TraitDeclaration = traceur.syntax.trees.TraitDeclaration;
  var VariableDeclaration = traceur.syntax.trees.VariableDeclaration;
  var VariableStatement = traceur.syntax.trees.VariableStatement;
  var ErrorReporter = traceur.util.ErrorReporter;
  var ClassSymbol = traceur.semantics.symbols.ClassSymbol;
  var TraitSymbol = traceur.semantics.symbols.TraitSymbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;
  var MethodSymbol = traceur.semantics.symbols.MethodSymbol;
  var PropertySymbol = traceur.semantics.symbols.PropertySymbol;
  var FieldSymbol = traceur.semantics.symbols.FieldSymbol;
  var AggregateSymbol = traceur.semantics.symbols.AggregateSymbol;
  var GetAccessor = traceur.semantics.symbols.GetAccessor;
  var SetAccessor = traceur.semantics.symbols.SetAccessor;
  var RequiresSymbol = traceur.semantics.symbols.RequiresSymbol;

  /**
   * Analyzes a class or trait and creates an AggregateSymbol. This class just
   * collects data for use later by ClassTransformer. The analysis isn't much
   * more than duplicate member checking--so it could quite possibly be folded
   * into ClassTransformer.
   *
   * @param {ErrorReporter} reporter
   * @constructor
   */
  function ClassAnalyzer(reporter) {
    this.reporter_ = reporter;
  }

  /**
   * Analyzes a class and creates a ClassSymbol
   * @param {ErrorReporter} reporter
   * @param {ClassDeclaration} tree
   * @return {ClassSymbol}
   */
  ClassAnalyzer.analyzeClass = function(reporter, tree) {
    return new ClassAnalyzer(reporter).declareAggregate_(tree, ClassSymbol);
  }

  /**
   * Analyzes a trait and creates a TraitSymbol
   * @param {ErrorReporter} reporter
   * @param {TraitDeclaration} tree
   * @return {TraitSymbol}
   */
  ClassAnalyzer.analyzeTrait = function(reporter, tree) {
    return new ClassAnalyzer(reporter).declareAggregate_(tree, TraitSymbol);
  }

  ClassAnalyzer.prototype = {
    /**
     * @param {ClassDeclaration|TraitDeclaration} tree
     * @param {Function} symbolType
     * @return {AggregateSymbol}
     */
    declareAggregate_: function(tree, symbolType) {
      var symbol = new symbolType(tree.name.value, tree);
      this.declareAggregateMembers_(symbol);
      return symbol;
    },

    /** @param {AggregateSymbol} symbol */
    declareAggregateMembers_: function(symbol) {
      symbol.tree.elements.forEach(function(memberTree) {
        this.declareAggregateMember_(symbol, memberTree);
      }, this);
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {ParseTree} memberTree
     */
    declareAggregateMember_: function(aggregate, memberTree) {
      switch (memberTree.type) {
        case ParseTreeType.FUNCTION_DECLARATION:
          this.declareFunctionMember_(aggregate, memberTree);
          break;
        case ParseTreeType.FIELD_DECLARATION:
          this.declareFieldMembers_(aggregate, memberTree);
          break;
        case ParseTreeType.GET_ACCESSOR:
          this.declareAccessor_(aggregate, memberTree, 'get', GetAccessor);
          break;
        case ParseTreeType.SET_ACCESSOR:
          this.declareAccessor_(aggregate, memberTree, 'set', SetAccessor);
          break;
        case ParseTreeType.MIXIN:
          aggregate.mixins.push(memberTree);
          break;
        case ParseTreeType.REQUIRES_MEMBER:
          this.declareRequiresMember_(aggregate, memberTree);
          break;
        default:
          throw new Error('Unrecognized parse tree in class declaration:' + memberTree.type);
      }
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {RequiresMember} tree
     */
    declareRequiresMember_: function(aggregate, tree) {
      var name = tree.name.value;
      if (!this.checkForDuplicateMemberDeclaration_(aggregate, tree, name, false)) {
        new RequiresSymbol(tree, name, aggregate);
      }
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {FieldDeclaration} tree
     */
    declareFieldMembers_: function(aggregate, tree) {
      tree.declarations.forEach(function(declarationTree) {
        this.declareFieldMember_(aggregate, tree, declarationTree);
      }, this);
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {FieldDeclaration} field
     * @param {VariableDeclaration} tree
     */
    declareFieldMember_: function(aggregate, field, tree) {
      var name = null;
      switch (tree.lvalue.type) {
        case ParseTreeType.IDENTIFIER_EXPRESSION:
          name = tree.lvalue.identifierToken.value;
          break;
        default:
          // TODO: Should destructuring be allowed in a field declaration?
          this.reportError_(tree, 'Cannot use destructuring in a field declaration');
          break;
      }
      if (PredefinedName.NEW == name) {
        this.reportError_(tree, 'Cannot name a field "new"');
        return;
      }
      if (!this.checkForDuplicateMemberDeclaration_(aggregate, tree, name, field.isStatic)) {
        new FieldSymbol(field, tree, name, aggregate);
      }
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {string} kind
     * @param {Function} ctor
     * @param {ParseTree} tree
     */
    declareAccessor_: function(aggregate, tree, kind, ctor) {
      var name = this.getPropertyName_(tree, tree.propertyName);
      if (name == null) {
        return;
      }
      var property = this.getOrCreateProperty_(aggregate, name, tree, tree.isStatic);
      if (property == null) {
        return;
      }
      if (property[kind] != null) {
        this.reportError_(tree, 'Duplicate "%s" accessor "%s"', kind, name);
        this.reportRelatedError_(property[kind].tree);
        return;
      }
      property[kind] = new ctor(property, tree);
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {string} name
     * @param {ParseTree} tree
     * @param {boolean} isStatic
     * @return {PropertySymbol}
     */
    getOrCreateProperty_: function(aggregate, name, tree, isStatic) {
      if (isStatic && !aggregate.hasStaticMember(name) ||
          !isStatic && !aggregate.hasInstanceMember(name)) {
        return new PropertySymbol(tree, name, aggregate, isStatic);
      }
      var member = isStatic ? aggregate.getStaticMember(name) : aggregate.getInstanceMember(name);
      if (member.type != SymbolType.PROPERTY) {
        this.reportDuplicateMember_(aggregate, tree, name);
        return null;
      }
      return member;
    },

    /**
     * @param {ParseTree} tree
     * @param {Token} propertyName
     * @return {string}
     */
    getPropertyName_: function(tree, propertyName) {
      var name;
      switch (propertyName.type) {
        case TokenType.IDENTIFIER:
          name = propertyName.value;
          break;
        case TokenType.STRING:
          name = propertyName.value;
          break;
        case TokenType.NUMBER:
          throw new Error('TODO: Property with numeric names');
        default:
          throw new Error('Unexpected property name type');
      }
      if (name == PredefinedName.NEW) {
        this.reportError_(tree, 'Cannot name a property "new"');
        return null;
      }
      return name;
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {FunctionDeclaration} tree
     * @return {MethodSymbol}
     */
    declareFunctionMember_: function(aggregate, tree) {
      // TODO: validate super constructor call
      var name = tree.name.value;
      if (!this.checkForDuplicateMemberDeclaration_(aggregate, tree, name, tree.isStatic)) {
        return new MethodSymbol(tree, name, aggregate, tree.isStatic);
      }
      return null;
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {ParseTree} tree
     * @param {string} name
     * @param {boolean} isStatic
     * @return {boolean}
     */
    checkForDuplicateMemberDeclaration_: function(aggregate, tree, name, isStatic) {
      if (isStatic && aggregate.hasStaticMember(name) ||
          !isStatic && aggregate.hasInstanceMember(name)) {
        this.reportDuplicateMember_(aggregate, tree, name);
        return true;
      }
      return false;
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {ParseTree} tree
     * @param {string} name
     */
    reportDuplicateMember_: function(aggregate, tree, name) {
      this.reportError_(tree, 'Duplicate member "%s"', name);
      this.reportRelatedError_(aggregate.getInstanceMember(name));
    },

    /**
     * @param {Symbol|ParseTree} treeOrSymbol
     * @param {string} format
     * @param {...Object} var_args
     */
    reportError_: function(treeOrSymbol, format, var_args) {
      if (treeOrSymbol instanceof Symbol) {
        treeOrSymbol = treeOrSymbol.tree;
      }
      var args = Array.prototype.slice.call(arguments, 2);
      this.reporter_.reportError(treeOrSymbol.location.start, format, args);
    },

    /** @param {Symbol|ParseTree} treeOrSymbol*/
    reportRelatedError_: function(treeOrSymbol) {
      var msg = 'Location related to previous error';
      if (treeOrSymbol instanceof Symbol) {
        symbol.getRelatedLocations().forEach(function(loc) {
          this.reportError_(loc, msg);
        }, this);
      } else {
        this.reportError_(tree, msg);
      }
    }
  };

  return {
    ClassAnalyzer: ClassAnalyzer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ParseTreeVisitor = traceur.syntax.ParseTreeVisitor;
  var PredefinedName = traceur.syntax.PredefinedName;
  var Keywords = traceur.syntax.Keywords;
  var TokenType = traceur.syntax.TokenType;
  var StringBuilder = traceur.util.StringBuilder;
  var Keywords = traceur.syntax.Keywords;
  var PredefinedName = traceur.syntax.PredefinedName;

  /**
   * Converts a ParseTree to text.
   * @param {ParseTree} highlighted
   * @param {boolean} showLineNumbers
   * @constructor
   */
  function ParseTreeWriter(highlighted, showLineNumbers) {
    ParseTreeVisitor.call(this);
    this.highlighted_ = highlighted;
    this.showLineNumbers_ = showLineNumbers;
    this.result_ = new StringBuilder();
    this.currentLine_ = new StringBuilder();
  }

  // constants
  var NEW_LINE = '\n';
  var PRETTY_PRINT = true;

  ParseTreeWriter.write = function(tree, var_args) {
    var showLineNumbers;
    var highlighted = null;

    // TODO: can we make this argument order more sane?
    if (arguments.length === 1) {
      showLineNumbers = false;
    } else if (arguments.length === 2) {
      showLineNumbers = arguments[1];
    } else {
      showLineNumbers = arguments[2];
      highlighted = arguments[1];
    }
    var writer = new ParseTreeWriter(highlighted, showLineNumbers);
    writer.visitAny(tree);
    if (writer.currentLine_.length > 0) {
      writer.writeln_();
    }
    return writer.result_.toString();
  }
  
  traceur.inherits(ParseTreeWriter, ParseTreeVisitor, {
    __proto__: ParseTreeVisitor.prototype,

    /**
     * @type {string}
     * @private
     */
    currentLineComment_: null,

    /**
     * @type {number}
     * @private
     */
    indentDepth_: 0,

    /**
     * @param {ParseTree} tree
     */
    visitAny: function(tree) {
      // set background color to red if tree is highlighted
      if (tree != null && tree == this.highlighted_) {
        this.write_('\x1B[41m');
      }

      if (tree != null && tree.location != null &&
          tree.location.start != null && this.showLineNumbers_) {
        this.currentLineComment_ = 'Line: ' + (tree.location.start.line + 1);
      }
      ParseTreeVisitor.prototype.visitAny.call(this, tree);

      // set background color to normal
      if (tree != null && tree == this.highlighted_) {
        this.write_('\x1B[0m');
      }
    },

    /**
     * @param {ArgumentList} tree
     */
    visitArgumentList: function(tree) {
      this.write_(TokenType.OPEN_PAREN);
      this.writeList_(tree.args, TokenType.COMMA, false);
      this.write_(TokenType.CLOSE_PAREN);
    },

    /**
     * @param {ArrayLiteralExpression} tree
     */
    visitArrayLiteralExpression: function(tree) {
      this.write_(TokenType.OPEN_SQUARE);
      this.writeList_(tree.elements, TokenType.COMMA, false);
      this.write_(TokenType.CLOSE_SQUARE);
    },

    /**
     * @param {ArrayPattern} tree
     */
    visitArrayPattern: function(tree) {
      this.write_(TokenType.OPEN_SQUARE);
      this.writeList_(tree.elements, TokenType.COMMA, false);
      this.write_(TokenType.CLOSE_SQUARE);
    },

    /**
     * @param {AwaitStatement} tree
     */
    visitAwaitStatement: function(tree) {
      this.write_(TokenType.AWAIT);
      if (tree.identifier != null) {
        this.write_(tree.identifier);
        this.write_(TokenType.EQUAL);
      }
      this.visitAny(tree.expression);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {BinaryOperator} tree
     */
    visitBinaryOperator: function(tree) {
      this.visitAny(tree.left);
      this.write_(tree.operator);
      this.visitAny(tree.right);
    },

    /**
     * @param {Block} tree
     */
    visitBlock: function(tree) {
      this.write_(TokenType.OPEN_CURLY);
      this.writelnList_(tree.statements);
      this.write_(TokenType.CLOSE_CURLY);
    },

    /**
     * @param {BreakStatement} tree
     */
    visitBreakStatement: function(tree) {
      this.write_(TokenType.BREAK);
      if (tree.name != null) {
        this.write_(tree.name);
      }
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {CallExpression} tree
     */
    visitCallExpression: function(tree) {
      this.visitAny(tree.operand);
      this.visitAny(tree.args);
    },

    /**
     * @param {CaseClause} tree
     */
    visitCaseClause: function(tree) {
      this.write_(TokenType.CASE);
      this.visitAny(tree.expression);
      this.write_(TokenType.COLON);
      this.indentDepth_++;
      this.writelnList_(tree.statements);
      this.indentDepth_--;
    },

    /**
     * @param {Catch} tree
     */
    visitCatch: function(tree) {
      this.write_(TokenType.CATCH);
      this.write_(TokenType.OPEN_PAREN);
      this.write_(tree.exceptionName);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.catchBody);
    },

    /**
     * @param {ClassDeclaration} tree
     */
    visitClassDeclaration: function(tree) {
      this.write_(TokenType.CLASS);
      this.write_(tree.name);
      if (tree.superClass != null) {
        this.write_(TokenType.COLON);
        this.visitAny(tree.superClass);
      }
      this.write_(TokenType.OPEN_CURLY);
      this.writelnList_(tree.elements);
      this.write_(TokenType.CLOSE_CURLY);
    },

    /**
     * @param {ClassExpression} tree
     */
    visitClassExpression: function(tree) {
      this.write_(TokenType.CLASS);
    },

    /**
     * @param {CommaExpression} tree
     */
    visitCommaExpression: function(tree) {
      this.writeList_(tree.expressions, TokenType.COMMA, false);
    },

    /**
     * @param {ConditionalExpression} tree
     */
    visitConditionalExpression: function(tree) {
      this.visitAny(tree.condition);
      this.write_(TokenType.QUESTION);
      this.visitAny(tree.left);
      this.write_(TokenType.COLON);
      this.visitAny(tree.right);
    },

    /**
     * @param {ContinueStatement} tree
     */
    visitContinueStatement: function(tree) {
      this.write_(TokenType.CONTINUE);
      if (tree.name != null) {
        this.write_(tree.name);
      }
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {DebuggerStatement} tree
     */
    visitDebuggerStatement: function(tree) {
      this.write_(TokenType.DEBUGGER);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {DefaultClause} tree
     */
    visitDefaultClause: function(tree) {
      this.write_(TokenType.DEFAULT);
      this.write_(TokenType.COLON);
      this.indentDepth_++;
      this.writelnList_(tree.statements);
      this.indentDepth_--;
    },

    /**
     * @param {DefaultParameter} tree
     */
    visitDefaultParameter: function(tree) {
      this.visitAny(tree.identifier);
      this.write_(TokenType.EQUAL);
      this.visitAny(tree.expression);
    },

    /**
     * @param {DoWhileStatement} tree
     */
    visitDoWhileStatement: function(tree) {
      this.write_(TokenType.DO);
      this.visitAny(tree.body);
      this.write_(TokenType.WHILE);
      this.write_(TokenType.OPEN_PAREN);
      this.visitAny(tree.condition);
      this.write_(TokenType.CLOSE_PAREN);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {EmptyStatement} tree
     */
    visitEmptyStatement: function(tree) {
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {ExportDeclaration} tree
     */
    visitExportDeclaration: function(tree) {
      this.write_(TokenType.EXPORT);
      this.visitAny(tree.declaration);
    },

    /**
     * @param {traceur.syntax.trees.ExportPathList} tree
     */
    visitExportPathList: function(tree) {
      this.writeList_(tree.paths, TokenType.COMMA, false);
    },

    /**
     * @param {traceur.syntax.trees.ExportPath} tree
     */
    visitExportPath: function(tree) {
      if (tree.moduleExpression) {
        this.visitAny(tree.moduleExpression);
        this.write_(TokenType.PERIOD);
      }
      this.visitAny(tree.specifier);
    },

    /**
     * @param {traceur.syntax.trees.ExportPathSpecifier} tree
     */
    visitExportPathSpecifier: function(tree) {
      this.write_(tree.identifier);
      if (tree.specifier) {
        this.write_(TokenType.COLON);
        this.visitAny(tree.specifier);
      }
    },

    /**
     * @param {traceur.syntax.trees.ExportSpecifier} tree
     */
    visitExportSpecifier: function(tree) {
      this.write_(tree.lhs);
      if (tree.rhs) {
        this.write_(TokenType.COLON);
        this.write_(tree.rhs);
      }
    },

    /**
     * @param {traceur.syntax.trees.ExportSpecifierSet} tree
     */
    visitExportSpecifierSet: function(tree) {
      this.write_(TokenType.OPEN_CURLY);
      this.writeList_(tree.specifiers, TokenType.COMMA, false);
      this.write_(TokenType.CLOSE_CURLY);
    },

    /**
     * @param {traceur.syntax.trees.ExportPathSpecifierSet} tree
     */
    visitExportPathSpecifierSet: function(tree) {
      this.write_(TokenType.OPEN_CURLY);
      this.writeList_(tree.specifiers, TokenType.COMMA, false);
      this.write_(TokenType.CLOSE_CURLY);
    },

    /**
     * @param {ExpressionStatement} tree
     */
    visitExpressionStatement: function(tree) {
      this.visitAny(tree.expression);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {FieldDeclaration} tree
     */
    visitFieldDeclaration: function(tree) {
      if (tree.isStatic) {
        this.write_(TokenType.CLASS);
      }
      if (tree.isConst) {
        this.write_(TokenType.CONST);
      }
      this.writeList_(tree.declarations, TokenType.COMMA, false);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {Finally} tree
     */
    visitFinally: function(tree) {
      this.write_(TokenType.FINALLY);
      this.visitAny(tree.block);
    },

    /**
     * @param {ForEachStatement} tree
     */
    visitForEachStatement: function(tree) {
      this.write_(TokenType.FOR);
      this.write_(TokenType.OPEN_PAREN);
      this.visitAny(tree.initializer);
      this.write_(TokenType.COLON);
      this.visitAny(tree.collection);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.body);
    },

    /**
     * @param {ForInStatement} tree
     */
    visitForInStatement: function(tree) {
      this.write_(TokenType.FOR);
      this.write_(TokenType.OPEN_PAREN);
      this.visitAny(tree.initializer);
      this.write_(TokenType.IN);
      this.visitAny(tree.collection);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.body);
    },

    /**
     * @param {ForStatement} tree
     */
    visitForStatement: function(tree) {
      this.write_(TokenType.FOR);
      this.write_(TokenType.OPEN_PAREN);
      this.visitAny(tree.initializer);
      this.write_(TokenType.SEMI_COLON);
      this.visitAny(tree.condition);
      this.write_(TokenType.SEMI_COLON);
      this.visitAny(tree.increment);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.body);
    },

    /**
     * @param {FormalParameterList} tree
     */
    visitFormalParameterList: function(tree) {
      var first = true;

      for (var i = 0; i < tree.parameters.length; i++) {
        var parameter = tree.parameters[i];

        if (first) {
          first = false;
        } else {
          this.write_(TokenType.COMMA);
        }

        this.visitAny(parameter);
      }
    },

    /**
     * @param {FunctionDeclaration} tree
     */
    visitFunctionDeclaration: function(tree) {
      if (tree.isStatic) {
        this.write_(TokenType.CLASS);
      }
      this.write_(Keywords.FUNCTION);
      if (tree.name != null) {
        this.write_(tree.name);
      }
      this.write_(TokenType.OPEN_PAREN);
      this.visitAny(tree.formalParameterList);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.functionBody);
    },

    /**
     * @param {GetAccessor} tree
     */
    visitGetAccessor: function(tree) {
      if (tree.isStatic) {
        this.write_(TokenType.CLASS);
      }
      this.write_(PredefinedName.GET);
      this.write_(tree.propertyName);
      this.write_(TokenType.OPEN_PAREN);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.body);
    },

    /**
     * @param {IdentifierExpression} tree
     */
    visitIdentifierExpression: function(tree) {
      this.write_(tree.identifierToken);
    },

    /**
     * @param {IfStatement} tree
     */
    visitIfStatement: function(tree) {
      this.write_(TokenType.IF);
      this.write_(TokenType.OPEN_PAREN);
      this.visitAny(tree.condition);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.ifClause);
      if (tree.elseClause != null) {
        this.write_(TokenType.ELSE);
        this.visitAny(tree.elseClause);
      }
    },

    /**
     * @param {ImportDeclaration} tree
     */
    visitImportDeclaration: function(tree) {
      this.write_(TokenType.IMPORT);
      this.writeList_(tree.importPathList, TokenType.COMMA, false);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {ImportPath} tree
     */
    visitImportPath: function(tree) {
      this.writeTokenList_(tree.qualifiedPath, TokenType.PERIOD, false);
      switch (tree.kind) {
        case ALL:
          this.write_(TokenType.PERIOD);
          this.write_(TokenType.STAR);
          break;
        case NONE:
          break;
        case SET:
          this.write_(TokenType.PERIOD);
          this.write_(TokenType.OPEN_CURLY);
          this.writeList_(tree.importSpecifierSet, TokenType.COMMA, false);
          this.write_(TokenType.CLOSE_CURLY);
          break;
      }
    },

    /**
     * @param {ImportSpecifier} tree
     */
    visitImportSpecifier: function(tree) {
      this.write_(tree.importedName);
      if (tree.destinationName != null) {
        this.write_(TokenType.COLON);
        this.write_(tree.destinationName);
      }
    },

    /**
     * @param {LabelledStatement} tree
     */
    visitLabelledStatement: function(tree) {
      this.write_(tree.name);
      this.write_(TokenType.COLON);
      this.visitAny(tree.statement);
    },

    /**
     * @param {LiteralExpression} tree
     */
    visitLiteralExpression: function(tree) {
      this.write_(tree.literalToken);
    },

    /**
     * @param {MemberExpression} tree
     */
    visitMemberExpression: function(tree) {
      this.visitAny(tree.operand);
      this.write_(TokenType.PERIOD);
      this.write_(tree.memberName);
    },

    /**
     * @param {MemberLookupExpression} tree
     */
    visitMemberLookupExpression: function(tree) {
      this.visitAny(tree.operand);
      this.write_(TokenType.OPEN_SQUARE);
      this.visitAny(tree.memberExpression);
      this.write_(TokenType.CLOSE_SQUARE);
    },

    /**
     * @param {MissingPrimaryExpression} tree
     */
    visitMissingPrimaryExpression: function(tree) {
      this.write_('MissingPrimaryExpression');
    },

    /**
     * @param {Mixin} tree
     */
    visitMixin: function(tree) {
      this.write_(PredefinedName.MIXIN);
      this.write_(tree.name);
      this.visitAny(tree.mixinResolves);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {MixinResolve} tree
     */
    visitMixinResolve: function(tree) {
      this.write_(tree.from);
      this.write_(TokenType.COLON);
      this.write_(tree.to);
    },

    /**
     * @param {MixinResolveList} tree
     */
    visitMixinResolveList: function(tree) {
      this.write_(TokenType.OPEN_CURLY);
      this.writeList_(tree.resolves, TokenType.COMMA, false);
      this.write_(TokenType.CLOSE_CURLY);
    },

    /**
     * @param {ModuleDeclarationfinitionTree} tree
     */
    visitModuleDeclaration: function(tree) {
      this.write_(PredefinedName.MODULE);
      this.writeList_(tree.specifiers, TokenType.COMMA, false);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {ModuleDefinition} tree
     */
    visitModuleDefinition: function(tree) {
      this.write_(PredefinedName.MODULE);
      this.write_(tree.name);
      this.write_(TokenType.OPEN_CURLY);
      this.writeln_();
      this.writeList_(tree.elements, null, true);
      this.write_(TokenType.CLOSE_CURLY);
      this.writeln_();
    },

    /**
     * @param {ModuleExpression} tree
     */
    visitModuleExpression: function(tree) {
      this.visitAny(tree.reference);
      for (var i = 0; i < tree.identifiers.length; i++) {
        this.write_(TokenType.PERIOD);
        this.write_(tree.identifiers[i]);
      }
    },

    /**
     * @param {ModuleRequire} tree
     */
    visitModuleRequire: function(tree) {
      this.write_(PredefinedName.REQUIRE);
      this.write_(TokenType.OPEN_PAREN);
      this.write_(tree.url);
      this.write_(TokenType.CLOSE_PAREN);
    },

    /**
     * @param {ModuleRequire} tree
     */
    visitModuleSpecifier: function(tree) {
      this.write_(tree.identifier);
      this.write_(TokenType.EQUAL);
      this.visitAny(tree.expression);
    },

    /**
     * @param {NewExpression} tree
     */
    visitNewExpression: function(tree) {
      this.write_(TokenType.NEW);
      this.visitAny(tree.operand);
      this.visitAny(tree.args);
    },

    /**
     * @param {NullTree} tree
     */
    visitNullTree: function(tree) {
    },

    /**
     * @param {ObjectLiteralExpression} tree
     */
    visitObjectLiteralExpression: function(tree) {
      this.write_(TokenType.OPEN_CURLY);
      if (tree.propertyNameAndValues.length > 1)
        this.writeln_();
      this.writelnList_(tree.propertyNameAndValues, TokenType.COMMA);
      if (tree.propertyNameAndValues.length > 1)
        this.writeln_();
      this.write_(TokenType.CLOSE_CURLY);
    },

    /**
     * @param {ObjectPattern} tree
     */
    visitObjectPattern: function(tree) {
      this.write_(TokenType.OPEN_CURLY);
      this.writelnList_(tree.fields, TokenType.COMMA);
      this.write_(TokenType.CLOSE_CURLY);
    },

    /**
     * @param {ObjectPatternField} tree
     */
    visitObjectPatternField: function(tree) {
      this.write_(tree.identifier);
      if (tree.element != null) {
        this.write_(TokenType.COLON);
        this.visitAny(tree.element);
      }
    },

    /**
     * @param {ParenExpression} tree
     */
    visitParenExpression: function(tree) {
      this.write_(TokenType.OPEN_PAREN);
      ParseTreeVisitor.prototype.visitParenExpression.call(this, tree);
      this.write_(TokenType.CLOSE_PAREN);
    },

    /**
     * @param {PostfixExpression} tree
     */
    visitPostfixExpression: function(tree) {
      this.visitAny(tree.operand);
      this.write_(tree.operator);
    },

    /**
     * @param {Program} tree
     */
    visitProgram: function(tree) {
      this.writelnList_(tree.programElements);
    },

    /**
     * @param {PropertyNameAssignment} tree
     */
    visitPropertyNameAssignment: function(tree) {
      this.write_(tree.name);
      this.write_(TokenType.COLON);
      this.visitAny(tree.value);
    },

    /**
     * @param {traceur.syntax.trees.QualifiedReference} tree
     */
    visitQualifiedReference: function(tree) {
      this.visitAny(tree.moduleExpression);
      this.write_(TokenType.PERIOD);
      this.write_(tree.identifier);
    },

    /**
     * @param {RequiresMember} tree
     */
    visitRequiresMember: function(tree) {
      this.write_(PredefinedName.REQUIRES);
      this.write_(tree.name);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {ReturnStatement} tree
     */
    visitReturnStatement: function(tree) {
      this.write_(TokenType.RETURN);
      this.visitAny(tree.expression);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {RestParameter} tree
     */
    visitRestParameter: function(tree) {
      this.write_(TokenType.SPREAD);
      this.write_(tree.identifier);
    },

    /**
     * @param {SetAccessor} tree
     */
    visitSetAccessor: function(tree) {
      if (tree.isStatic) {
        this.write_(TokenType.CLASS);
      }
      this.write_(PredefinedName.SET);
      this.write_(tree.propertyName);
      this.write_(TokenType.OPEN_PAREN);
      this.write_(tree.parameter);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.body);
    },

    /**
     * @param {SpreadExpression} tree
     */
    visitSpreadExpression: function(tree) {
      this.write_(TokenType.SPREAD);
      this.visitAny(tree.expression);
    },

    /**
     * @param {SpreadPatternElement} tree
     */
    visitSpreadPatternElement: function(tree) {
      this.write_(TokenType.SPREAD);
      this.visitAny(tree.lvalue);
    },

    /**
     * @param {StateMachine} tree
     */
    visitStateMachine: function(tree) {
      throw new Error('State machines cannot be converted to source');
    },

    /**
     * @param {SuperExpression} tree
     */
    visitSuperExpression: function(tree) {
      this.write_(TokenType.SUPER);
    },

    /**
     * @param {SwitchStatement} tree
     */
    visitSwitchStatement: function(tree) {
      this.write_(TokenType.SWITCH);
      this.write_(TokenType.OPEN_PAREN);
      this.visitAny(tree.expression);
      this.write_(TokenType.CLOSE_PAREN);
      this.write_(TokenType.OPEN_CURLY);
      this.writelnList_(tree.caseClauses);
      this.write_(TokenType.CLOSE_CURLY);
    },

    /**
     * @param {ThisExpression} tree
     */
    visitThisExpression: function(tree) {
      this.write_(TokenType.THIS);
    },

    /**
     * @param {TraitDeclaration} tree
     */
    visitTraitDeclaration: function(tree) {
      this.write_(PredefinedName.TRAIT);
      this.write_(tree.name);
      this.write_(TokenType.OPEN_CURLY);
      this.visitList(tree.elements);
      this.write_(TokenType.CLOSE_CURLY);
    },

    /**
     * @param {ThrowStatement} tree
     */
    visitThrowStatement: function(tree) {
      this.write_(TokenType.THROW);
      this.visitAny(tree.value);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {TryStatement} tree
     */
    visitTryStatement: function(tree) {
      this.write_(TokenType.TRY);
      this.visitAny(tree.body);
      this.visitAny(tree.catchBlock);
      this.visitAny(tree.finallyBlock);
    },

    /**
     * @param {UnaryExpression} tree
     */
    visitUnaryExpression: function(tree) {
      this.write_(tree.operator);
      this.visitAny(tree.operand);
    },

    /**
     * @param {VariableDeclarationList} tree
     */
    visitVariableDeclarationList: function(tree) {
      this.write_(tree.declarationType);
      this.writeList_(tree.declarations, TokenType.COMMA, false);
    },

    /**
     * @param {VariableDeclaration} tree
     */
    visitVariableDeclaration: function(tree) {
      this.visitAny(tree.lvalue);
      if (tree.initializer != null) {
        this.write_(TokenType.EQUAL);
        this.visitAny(tree.initializer);
      }
    },

    /**
     * @param {VariableStatement} tree
     */
    visitVariableStatement: function(tree) {
      ParseTreeVisitor.prototype.visitVariableStatement.call(this, tree);
      this.write_(TokenType.SEMI_COLON);
    },

    /**
     * @param {WhileStatement} tree
     */
    visitWhileStatement: function(tree) {
      this.write_(TokenType.WHILE);
      this.write_(TokenType.OPEN_PAREN);
      this.visitAny(tree.condition);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.body);
    },

    /**
     * @param {WithStatement} tree
     */
    visitWithStatement: function(tree) {
      this.write_(TokenType.WITH);
      this.write_(TokenType.OPEN_PAREN);
      this.visitAny(tree.expression);
      this.write_(TokenType.CLOSE_PAREN);
      this.visitAny(tree.body);
    },

    /**
     * @param {YieldStatement} tree
     */
    visitYieldStatement: function(tree) {
      this.write_(TokenType.YIELD);
      if (tree.isYieldFor) {
        this.write_(TokenType.FOR);
      }
      this.visitAny(tree.expression);
      this.write_(TokenType.SEMI_COLON);
    },

    writeln_: function() {
      if (this.currentLineComment_ != null) {
        while (this.currentLine_.length < 80) {
          this.currentLine_.append(' ');
        }
        this.currentLine_.append(' // ').append(this.currentLineComment_);
        this.currentLineComment_ = null;
      }
      this.result_.append(this.currentLine_.toString());
      this.result_.append(NEW_LINE);
      this.currentLine_ = new StringBuilder();
    },

    /**
     * @param {Array.<ParseTree>} list
     * @param {TokenType} delimiter
     * @private
     */
    writelnList_: function(list, delimiter) {
      if (delimiter) {
        this.writeList_(list, delimiter, true);
      } else {
        if (list.length > 0)
          this.writeln_();
        this.writeList_(list, null, true);
        if (list.length > 0)
          this.writeln_();
      }
    },

    /**
     * @param {Array.<ParseTree>} list
     * @param {TokenType} delimiter
     * @param {boolean} writeNewLine
     * @private
     */
    writeList_: function(list, delimiter, writeNewLine) {
      var first = true;
      for (var i = 0; i < list.length; i++) {
        var element = list[i];
        if (first) {
          first = false;
        } else {
          if (delimiter != null) {
            this.write_(delimiter);
          }
          if (writeNewLine) {
            this.writeln_();
          }
        }
        this.visitAny(element);
      }
    },

    writeTokenList_: function(list, delimiter, writeNewLine) {
      var first = true;
      for (var i = 0; i < list.length; i++) {
        var element = list[i];
        if (first) {
          first = false;
        } else {
          if (delimiter != null) {
            this.write_(delimiter);
          }
          if (writeNewLine) {
            this.writeln_();
          }
        }
        this.write_(element);
      }
    },

    /**
     * @param {string|Token|TokenType|Keywords} value
     * @private
     */
    write_: function(value) {
      if (value === TokenType.CLOSE_CURLY) {
        this.indentDepth_--;
      }

      // Imperfect but good enough spacing rules to make output readable.
      var spaceBefore = true;
      var spaceAfter = true;
      switch (value) {
        case TokenType.PERIOD:
        case TokenType.OPEN_SQUARE:
        case TokenType.OPEN_PAREN:
        case TokenType.CLOSE_SQUARE:
          spaceBefore = false;
          spaceAfter = false;
          break;
        case TokenType.COLON:
        case TokenType.COMMA:
        case TokenType.SEMI_COLON:
        case TokenType.CLOSE_PAREN:
          spaceBefore = false;
          break;
      }

      if (value != null) {
        if (PRETTY_PRINT) {
          if (this.currentLine_.length == 0) {
            for (var i = 0, indent = this.indentDepth_ * 2; i < indent; ++i) {
              this.currentLine_.append(' ');
            }
          } else {
            if (spaceBefore == false && this.currentLine_.lastChar() == ' ') {
              this.currentLine_.deleteLastChar();
            }
          }
        }
        this.currentLine_.append(value.toString());
        if (spaceAfter) {
          this.currentLine_.append(' ');
        }
      }

      if (value === TokenType.OPEN_CURLY) {
        this.indentDepth_++;
      }
    }
  });

  return {
    ParseTreeWriter: ParseTreeWriter
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax', function() {
  'use strict';

  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var ParseTreeVisitor = traceur.syntax.ParseTreeVisitor;
  var ParseTreeWriter = traceur.codegeneration.ParseTreeWriter;
  var TokenType = traceur.syntax.TokenType;
  var NewExpression = traceur.syntax.trees.NewExpression;

  /*
  TODO: add contextual information to the validator so we can check
  non-local grammar rules, such as:
   * operator precedence
   * expressions with or without "in"
   * return statements must be in a function
   * break must be enclosed in loops or switches
   * continue must be enclosed in loops
   * function declarations must have non-null names
     (optional for function expressions)
  */

  /**
   * Validates a parse tree
   *
   * @constructor
   * @extends {ParseTreeVisitor}
   */
  function ParseTreeValidator() {
    ParseTreeVisitor.call(this);
  }

  /**
   * An error thrown when an invalid parse tree is encountered. This error is
   * used internally to distinguish between errors in the Validator itself vs
   * errors it threw to unwind the call stack.
   *
   * @param {traceur.syntax.trees.ParseTree} tree
   * @param {string} message
   * @constructor
   */
  function ValidationError(tree, message) {
    this.tree = tree;
    this.message = message;
  }
  traceur.inherits(ValidationError, Error, {
    __proto__: Error.prototype
  });

  /**
   * Validates a parse tree.  Validation failures are compiler bugs.
   * When a failure is found, the source file is dumped to standard
   * error output and a runtime exception is thrown.
   *
   * @param {traceur.syntax.trees.ParseTree} tree
   */
  ParseTreeValidator.validate = function(tree) {
    var validator = new ParseTreeValidator();
    try {
      validator.visitAny(tree);
    } catch (e) {
      if (!(e instanceof ValidationError)) {
        throw e;
      }

      var location = null;
      if (e.tree !== null) {
        location = e.tree.location;
      }
      if (location === null) {
        location = tree.location;
      }
      var locationString = location !== null ?
          location.start.toString() :
          '(unknown)';
      throw Error('Parse tree validation failure \'' + e.message + '\' at ' +
          locationString +
          ':\n\n' +
          ParseTreeWriter.write(tree, e.tree, true) +
          '\n');
    }
  };

  traceur.inherits(ParseTreeValidator, ParseTreeVisitor, {
    __proto__: ParseTreeVisitor.prototype,

    /**
     * @param {traceur.syntax.trees.ParseTree} tree
     * @param {string} message
     */
    fail_: function(tree, message) {
      throw new ValidationError(tree, message);
    },

    /**
     * @param {boolean} condition
     * @param {traceur.syntax.trees.ParseTree} tree
     * @param {string} message
     */
    check_: function(condition, tree, message) {
      if (!condition) {
        this.fail_(tree, message);
      }
    },

    /**
     * @param {boolean} condition
     * @param {traceur.syntax.trees.ParseTree} tree
     * @param {string} message
     */
    checkVisit_: function(condition, tree, message) {
      this.check_(condition, tree, message);
      this.visitAny(tree);
    },

    /**
     * @param {traceur.syntax.trees.ArgumentList} tree
     */
    visitArgumentList: function(tree) {
      for (var i = 0; i < tree.args.length; i++) {
        var argument = tree.args[i];
        this.checkVisit_(argument.isAssignmentOrSpread(), argument,
            'assignment or spread expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.ArrayLiteralExpression} tree
     */
    visitArrayLiteralExpression: function(tree) {
      for (var i = 0; i < tree.elements.length; i++) {
        var element = tree.elements[i];
        this.checkVisit_(element.isNull() || element.isAssignmentOrSpread(),
            element, 'assignment or spread expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.ArrayPattern} tree
     */
    visitArrayPattern: function(tree) {
      for (var i = 0; i < tree.elements.length; i++) {
        var element = tree.elements[i];
        this.checkVisit_(element.isNull() ||
            element.isLeftHandSideExpression() ||
            element.isPattern() ||
            element.isSpreadPatternElement(),
            element,
            'null, sub pattern, left hand side expression or spread expected');

        if (element.isSpreadPatternElement()) {
          this.check_(i === (tree.elements.length - 1), element,
              'spread in array patterns must be the last element');
        }
      }
    },

    /**
     * @param {traceur.syntax.trees.AwaitStatement} tree
     */
    visitAwaitStatement: function(tree) {
      this.checkVisit_(tree.expression.isExpression(), tree.expression,
          'await must be expression');
    },

    /**
     * @param {traceur.syntax.trees.BinaryOperator} tree
     */
    visitBinaryOperator: function(tree) {
      switch (tree.operator.type) {
        // assignment
        case TokenType.EQUAL:
        case TokenType.STAR_EQUAL:
        case TokenType.SLASH_EQUAL:
        case TokenType.PERCENT_EQUAL:
        case TokenType.PLUS_EQUAL:
        case TokenType.MINUS_EQUAL:
        case TokenType.LEFT_SHIFT_EQUAL:
        case TokenType.RIGHT_SHIFT_EQUAL:
        case TokenType.UNSIGNED_RIGHT_SHIFT_EQUAL:
        case TokenType.AMPERSAND_EQUAL:
        case TokenType.CARET_EQUAL:
        case TokenType.BAR_EQUAL:
          this.check_(tree.left.isLeftHandSideExpression() ||
              tree.left.isPattern(),
              tree.left,
              'left hand side expression or pattern expected');
          this.check_(tree.right.isAssignmentExpression(),
              tree.right,
              'assignment expression expected');
          break;

        // logical
        case TokenType.AND:
        case TokenType.OR:
        case TokenType.BAR:
        case TokenType.CARET:
        case TokenType.AMPERSAND:

        // equality
        case TokenType.EQUAL_EQUAL:
        case TokenType.NOT_EQUAL:
        case TokenType.EQUAL_EQUAL_EQUAL:
        case TokenType.NOT_EQUAL_EQUAL:

        // relational
        case TokenType.OPEN_ANGLE:
        case TokenType.CLOSE_ANGLE:
        case TokenType.GREATER_EQUAL:
        case TokenType.LESS_EQUAL:
        case TokenType.INSTANCEOF:
        case TokenType.IN:

        // shift
        case TokenType.LEFT_SHIFT:
        case TokenType.RIGHT_SHIFT:
        case TokenType.UNSIGNED_RIGHT_SHIFT:

        // additive
        case TokenType.PLUS:
        case TokenType.MINUS:

        // multiplicative
        case TokenType.STAR:
        case TokenType.SLASH:
        case TokenType.PERCENT:
          this.check_(tree.left.isAssignmentExpression(), tree.left,
              'assignment expression expected');
          this.check_(tree.right.isAssignmentExpression(), tree.right,
              'assignment expression expected');
          break;

        default:
          this.fail_(tree, 'unexpected binary operator');
      }
      this.visitAny(tree.left);
      this.visitAny(tree.right);
    },

    /**
     * @param {traceur.syntax.trees.Block} tree
     */
    visitBlock: function(tree) {
      for (var i = 0; i < tree.statements.length; i++) {
        var statement = tree.statements[i];
        this.checkVisit_(statement.isSourceElement(), statement,
            'statement or function declaration expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.CallExpression} tree
     */
    visitCallExpression: function(tree) {
      this.check_(tree.operand.isLeftHandSideExpression() ||
                  tree.operand.isMemberExpression(),
                  tree.operand,
                  'left hand side expression or member expression expected');
      if (tree.operand instanceof NewExpression) {
        this.check_(tree.operand.args !== null, tree.operand,
            'new args expected');
      }
      this.visitAny(tree.operand);
      this.visitAny(tree.args);
    },

    /**
     * @param {traceur.syntax.trees.CaseClause} tree
     */
    visitCaseClause: function(tree) {
      this.checkVisit_(tree.expression.isExpression(), tree.expression,
          'expression expected');
      for (var i = 0; i < tree.statements.length; i++) {
        var statement = tree.statements[i];
        this.checkVisit_(statement.isStatement(), statement,
            'statement expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.Catch} tree
     */
    visitCatch: function(tree) {
      this.checkVisit_(tree.catchBody.type === ParseTreeType.BLOCK,
          tree.catchBody, 'block expected');
    },

    /**
     * @param {traceur.syntax.trees.ClassDeclaration} tree
     */
    visitClassDeclaration: function(tree) {
      for (var i = 0; i < tree.elements.length; i++) {
        var element = tree.elements[i];
        switch (element.type) {
          case ParseTreeType.FUNCTION_DECLARATION:
          case ParseTreeType.GET_ACCESSOR:
          case ParseTreeType.SET_ACCESSOR:
          case ParseTreeType.MIXIN:
          case ParseTreeType.REQUIRES_MEMBER:
          case ParseTreeType.FIELD_DECLARATION:
            break;
          default:
            this.fail_(element, 'class element expected');
        }
        this.visitAny(element);
      }
    },

    /**
     * @param {traceur.syntax.trees.CommaExpression} tree
     */
    visitCommaExpression: function(tree) {
      for (var i = 0; i < tree.expressions.length; i++) {
        var expression = tree.expressions[i];
        this.checkVisit_(expression.isAssignmentExpression(), expression,
            'expression expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.ConditionalExpression} tree
     */
    visitConditionalExpression: function(tree) {
      this.checkVisit_(tree.condition.isAssignmentExpression(), tree.condition,
          'expression expected');
      this.checkVisit_(tree.left.isAssignmentExpression(), tree.left,
          'expression expected');
      this.checkVisit_(tree.right.isAssignmentExpression(), tree.right,
          'expression expected');
    },

    /**
     * @param {traceur.syntax.trees.DefaultClause} tree
     */
    visitDefaultClause: function(tree) {
      for (var i = 0; i < tree.statements.length; i++) {
        var statement = tree.statements[i];
        this.checkVisit_(statement.isStatement(), statement,
            'statement expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.DoWhileStatement} tree
     */
    visitDoWhileStatement: function(tree) {
      this.checkVisit_(tree.body.isStatement(), tree.body,
          'statement expected');
      this.checkVisit_(tree.condition.isExpression(), tree.condition,
          'expression expected');
    },

    /**
     * @param {traceur.syntax.trees.ExportDeclaration} tree
     */
    visitExportDeclaration: function(tree) {
      var declType = tree.declaration.type;
      this.checkVisit_(
          declType == ParseTreeType.VARIABLE_STATEMENT ||
          declType == ParseTreeType.FUNCTION_DECLARATION ||
          declType == ParseTreeType.MODULE_DEFINITION ||
          declType == ParseTreeType.MODULE_DECLARATION ||
          declType == ParseTreeType.CLASS_DECLARATION ||
          declType == ParseTreeType.TRAIT_DECLARATION ||
          declType == ParseTreeType.EXPORT_PATH_LIST,
          tree.declaration,
          'expected valid export tree');
    },

    /**
     * @param {traceur.syntax.trees.ExportPath} tree
     */
    visitExportPath: function(tree) {
      this.checkVisit_(
          tree.moduleExpression.type == ParseTreeType.MODULE_EXPRESSION,
          tree.moduleExpression,
          'module expression expected');

      var specifierType = tree.specifier.type;
      this.checkVisit_(specifierType == ParseTreeType.EXPORT_SPECIFIER_SET ||
                       specifierType == ParseTreeType.IDENTIFIER_EXPRESSION,
                       tree.specifier,
                       'specifier set or identifier expected');
    },

    /**
     * @param {traceur.syntax.trees.ExportPath} tree
     */
    visitExportPathList: function(tree) {
      this.check_(tree.paths.length > 0, tree,
                  'expected at least one path');
      for (var i = 0; i < tree.paths.length; i++) {
        var path = tree.paths[i];
        var type = path.type;
        this.checkVisit_(
            type == ParseTreeType.EXPORT_PATH ||
            type == ParseTreeType.EXPORT_PATH_SPECIFIER_SET ||
            type == ParseTreeType.IDENTIFIER_EXPRESSION,
            path,
            'expected valid export path');
      }
    },

    /**
     * @param {traceur.syntax.trees.ExportPathSpecifierSet} tree
     */
    visitExportPathSpecifierSet: function(tree) {
      this.check_(tree.specifiers.length > 0, tree,
                  'expected at least one specifier');
      this.visitList(tree.specifiers);
    },

    /**
     * @param {traceur.syntax.trees.ExportSpecifierSet} tree
     */
    visitExportSpecifierSet: function(tree) {
      this.check_(tree.specifiers.length > 0, tree,
          'expected at least one identifier');
      for (var i = 0; i < tree.specifiers.length; i++) {
        var specifier = tree.specifiers[i];
        this.checkVisit_(
            specifier.type == ParseTreeType.EXPORT_SPECIFIER,
            specifier,
            'expected valid export specifier');
      }
    },

    /**
     * @param {traceur.syntax.trees.ExpressionStatement} tree
     */
    visitExpressionStatement: function(tree) {
      this.checkVisit_(tree.expression.isExpression(), tree.expression,
          'expression expected');
    },

    /**
     * @param {traceur.syntax.trees.FieldDeclaration} tree
     */
    visitFieldDeclaration: function(tree) {
      for (var i = 0; i < tree.declarations.length; i++) {
        var declaration = tree.declarations[i];
        this.checkVisit_(
            declaration.type === ParseTreeType.VARIABLE_DECLARATION,
            declaration,
            'variable declaration expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.Finally} tree
     */
    visitFinally: function(tree) {
      this.checkVisit_(tree.block.type === ParseTreeType.BLOCK, tree.block,
          'block expected');
    },

    /**
     * @param {traceur.syntax.trees.ForEachStatement} tree
     */
    visitForEachStatement: function(tree) {
      this.checkVisit_(tree.initializer.declarations.length <= 1,
          tree.initializer,
          'for-each statement may not have more than one variable declaration');
      this.checkVisit_(tree.collection.isExpression(), tree.collection,
          'expression expected');
      this.checkVisit_(tree.body.isStatement(), tree.body,
          'statement expected');
    },

    /**
     * @param {traceur.syntax.trees.ForInStatement} tree
     */
    visitForInStatement: function(tree) {
      if (tree.initializer.type === ParseTreeType.VARIABLE_DECLARATION_LIST) {
        this.checkVisit_(
            tree.initializer.declarations.length <=
                1,
            tree.initializer,
            'for-in statement may not have more than one variable declaration');
      } else {
        this.checkVisit_(tree.initializer.isExpression(),
            tree.initializer, 'variable declaration or expression expected');
      }
      this.checkVisit_(tree.collection.isExpression(), tree.collection,
          'expression expected');
      this.checkVisit_(tree.body.isStatement(), tree.body,
          'statement expected');
    },

    /**
     * @param {traceur.syntax.trees.FormalParameterList} tree
     */
    visitFormalParameterList: function(tree) {
      for (var i = 0; i < tree.parameters.length; i++) {
        var parameter = tree.parameters[i];
        switch (parameter.type) {
          case ParseTreeType.REST_PARAMETER:
            this.checkVisit_(
                i === tree.parameters.length - 1, parameter,
                'rest parameters must be the last parameter in a parameter' +
                ' list');
            // Fall through

          case ParseTreeType.IDENTIFIER_EXPRESSION:
            // TODO(dominicc): Add array and object patterns here when
            // desugaring them is supported.
            break;

          case ParseTreeType.DEFAULT_PARAMETER:
            // TODO(arv): There must not be a parameter after this one that is
            // not a rest or another default parameter.
            break;

          default:
            this.fail_(parameter, 'parameters must be identifiers or rest' +
                ' parameters');
            break;
        }
        this.visitAny(parameter);
      }
    },

    /**
     * @param {traceur.syntax.trees.ForStatement} tree
     */
    visitForStatement: function(tree) {
      if (tree.initializer !== null && !tree.initializer.isNull()) {
        this.checkVisit_(
            tree.initializer.isExpression() ||
            tree.initializer.type === ParseTreeType.VARIABLE_DECLARATION_LIST,
            tree.initializer,
            'variable declaration list or expression expected');
      }
      if (tree.condition !== null) {
        this.checkVisit_(tree.condition.isExpression(), tree.condition,
            'expression expected');
      }
      if (tree.increment !== null) {
        this.checkVisit_(tree.condition.isExpression(), tree.increment,
            'expression expected');
      }
      this.checkVisit_(tree.body.isStatement(), tree.body,
          'statement expected');
    },

    /**
     * @param {traceur.syntax.trees.GetAccessor} tree
     */
    visitGetAccessor: function(tree) {
      this.checkVisit_(tree.body.type === ParseTreeType.BLOCK, tree.body,
          'block expected');
    },

    /**
     * @param {traceur.syntax.trees.IfStatement} tree
     */
    visitIfStatement: function(tree) {
      this.checkVisit_(tree.condition.isExpression(), tree.condition,
          'expression expected');
      this.checkVisit_(tree.ifClause.isStatement(), tree.ifClause,
          'statement expected');
      if (tree.elseClause !== null) {
        this.checkVisit_(tree.elseClause.isStatement(), tree.elseClause,
            'statement expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.LabelledStatement} tree
     */
    visitLabelledStatement: function(tree) {
      this.checkVisit_(tree.statement.isStatement(), tree.statement,
          'statement expected');
    },

    /**
     * @param {traceur.syntax.trees.MemberExpression} tree
     */
    visitMemberExpression: function(tree) {
      this.check_(tree.operand.isMemberExpression(), tree.operand,
          'member expression expected');
      if (tree.operand instanceof NewExpression) {
        this.check_(tree.operand.args !== null, tree.operand,
            'new args expected');
      }
      this.visitAny(tree.operand);
    },

    /**
     * @param {traceur.syntax.trees.MemberLookupExpression} tree
     */
    visitMemberLookupExpression: function(tree) {
      this.check_(tree.operand.isLeftHandSideExpression(), tree.operand,
          'left hand side expression expected');
      if (tree.operand instanceof NewExpression) {
        this.check_(tree.operand.args !== null, tree.operand,
            'new args expected');
      }
      this.visitAny(tree.operand);
    },

    /**
     * @param {traceur.syntax.trees.MissingPrimaryExpression} tree
     */
    visitMissingPrimaryExpression: function(tree) {
      this.fail_(tree, 'parse tree contains errors');
    },

    /**
     * @param {traceur.syntax.trees.MixinResolveList} tree
     */
    visitMixinResolveList: function(tree) {
      for (var i = 0; i < tree.resolves.length; i++) {
        var resolve = tree.resolves[i];
        this.check_(resolve.type === ParseTreeType.MIXIN_RESOLVE, resolve,
            'mixin resolve expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.ModuleDefinition} tree
     */
    visitModuleDeclaration: function(tree) {
      for (var i = 0; i < tree.specifiers.length; i++) {
        var specifier = tree.specifiers[i];
        this.checkVisit_(specifier.type == ParseTreeType.MODULE_SPECIFIER,
                         specifier,
                         'module specifier expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.ModuleDefinition} tree
     */
    visitModuleDefinition: function(tree) {
      for (var i = 0; i < tree.elements.length; i++) {
        var element = tree.elements[i];
        this.checkVisit_(
            (element.isStatement() && element.type !== ParseTreeType.BLOCK) ||
            element.type === ParseTreeType.CLASS_DECLARATION ||
            element.type === ParseTreeType.EXPORT_DECLARATION ||
            element.type === ParseTreeType.IMPORT_DECLARATION ||
            element.type === ParseTreeType.MODULE_DEFINITION ||
            element.type === ParseTreeType.MODULE_DECLARATION ||
            element.type === ParseTreeType.TRAIT_DECLARATION,
            element,
            'module element expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.ModuleRequire} tree
     */
    visitModuleRequire: function(tree) {
      this.check_(tree.url.type == TokenType.STRING, tree.url,
                  'string expected');
    },

    /**
     * @param {traceur.syntax.trees.ModuleSpecifier} tree
     */
    visitModuleSpecifier: function(tree) {
      this.checkVisit_(tree.expression.type == ParseTreeType.MODULE_EXPRESSION,
                       tree.expression,
                       'module expression expected');
    },

    /**
     * @param {traceur.syntax.trees.NewExpression} tree
     */
    visitNewExpression: function(tree) {
      this.checkVisit_(tree.operand.isLeftHandSideExpression(), tree.operand,
          'left hand side expression expected');
      this.visitAny(tree.args);
    },

    /**
     * @param {traceur.syntax.trees.ObjectLiteralExpression} tree
     */
    visitObjectLiteralExpression: function(tree) {
      for (var i = 0; i < tree.propertyNameAndValues.length; i++) {
        var propertyNameAndValue = tree.propertyNameAndValues[i];
        switch (propertyNameAndValue.type) {
          case ParseTreeType.GET_ACCESSOR:
          case ParseTreeType.SET_ACCESSOR:
          case ParseTreeType.PROPERTY_NAME_ASSIGNMENT:
            break;
          default:
            this.fail_(propertyNameAndValue,
                'accessor or property name assignment expected');
        }
        this.visitAny(propertyNameAndValue);
      }
    },

    /**
     * @param {traceur.syntax.trees.ObjectPattern} tree
     */
    visitObjectPattern: function(tree) {
      for (var i = 0; i < tree.fields.length; i++) {
        var field = tree.fields[i];
        this.checkVisit_(field.type === ParseTreeType.OBJECT_PATTERN_FIELD,
            field,
            'object pattern field expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.ObjectPatternField} tree
     */
    visitObjectPatternField: function(tree) {
      if (tree.element !== null) {
        this.checkVisit_(tree.element.isLeftHandSideExpression() ||
            tree.element.isPattern(),
            tree.element,
            'left hand side expression or pattern expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.ParenExpression} tree
     */
    visitParenExpression: function(tree) {
      if (tree.expression.isPattern()) {
        this.visitAny(tree.expression);
      } else {
        this.checkVisit_(tree.expression.isExpression(), tree.expression,
            'expression expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.PostfixExpression} tree
     */
    visitPostfixExpression: function(tree) {
      this.checkVisit_(tree.operand.isAssignmentExpression(), tree.operand,
          'assignment expression expected');
    },

    /**
     * @param {traceur.syntax.trees.Program} tree
     */
    visitProgram: function(tree) {
      for (var i = 0; i < tree.programElements.length; i++) {
        var programElement = tree.programElements[i];
        this.checkVisit_(programElement.isProgramElement(),
            programElement,
            'global program element expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.PropertyNameAssignment} tree
     */
    visitPropertyNameAssignment: function(tree) {
      this.checkVisit_(tree.value.isAssignmentExpression(), tree.value,
          'assignment expression expected');
    },

    /**
     * @param {traceur.syntax.trees.QualifiedReference} tree
     */
    visitQualifiedReference: function(tree) {
      this.checkVisit_(
          tree.moduleExpression.type == ParseTreeType.MODULE_EXPRESSION,
          tree.moduleExpression,
          'module expression expected');
    },

    /**
     * @param {traceur.syntax.trees.ReturnStatement} tree
     */
    visitReturnStatement: function(tree) {
      if (tree.expression !== null) {
        this.checkVisit_(tree.expression.isExpression(), tree.expression,
            'expression expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.SetAccessor} tree
     */
    visitSetAccessor: function(tree) {
      this.checkVisit_(tree.body.type === ParseTreeType.BLOCK, tree.body,
          'block expected');
    },

    /**
     * @param {traceur.syntax.trees.SpreadExpression} tree
     */
    visitSpreadExpression: function(tree) {
      this.checkVisit_(tree.expression.isAssignmentExpression(),
          tree.expression,
          'assignment expression expected');
    },

    /**
     * @param {traceur.syntax.trees.StateMachine} tree
     */
    visitStateMachine: function(tree) {
      this.fail_(tree, 'State machines are never valid outside of the ' +
          'GeneratorTransformer pass.');
    },

    /**
     * @param {traceur.syntax.trees.SwitchStatement} tree
     */
    visitSwitchStatement: function(tree) {
      this.checkVisit_(tree.expression.isExpression(), tree.expression,
          'expression expected');
      var defaultCount = 0;
      for (var i = 0; i < tree.caseClauses.length; i++) {
        var caseClause = tree.caseClauses[i];
        if (caseClause.type === ParseTreeType.DEFAULT_CLAUSE) {
          ++defaultCount;
          this.checkVisit_(defaultCount <= 1, caseClause,
              'no more than one default clause allowed');
        } else {
          this.checkVisit_(caseClause.type === ParseTreeType.CASE_CLAUSE,
              caseClause, 'case or default clause expected');
        }
      }
    },

    /**
     * @param {traceur.syntax.trees.TraitDeclaration} tree
     */
    visitTraitDeclaration: function(tree) {
      for (var i = 0; i < tree.elements.length; i++) {
        var element = tree.elements[i];
        switch (element.type) {
          case ParseTreeType.FUNCTION_DECLARATION:
          case ParseTreeType.GET_ACCESSOR:
          case ParseTreeType.SET_ACCESSOR:
          case ParseTreeType.MIXIN:
          case ParseTreeType.REQUIRES_MEMBER:
            break;
          default:
            this.fail_(element, 'trait element expected');
        }
        this.visitAny(element);
      }
    },

    /**
     * @param {traceur.syntax.trees.ThrowStatement} tree
     */
    visitThrowStatement: function(tree) {
      if (tree.value === null) {
        return;
      }
      this.checkVisit_(tree.value.isExpression(), tree.value,
          'expression expected');
    },

    /**
     * @param {traceur.syntax.trees.TryStatement} tree
     */
    visitTryStatement: function(tree) {
      this.checkVisit_(tree.body.type === ParseTreeType.BLOCK, tree.body,
          'block expected');
      if (tree.catchBlock !== null && !tree.catchBlock.isNull()) {
        this.checkVisit_(tree.catchBlock.type === ParseTreeType.CATCH,
            tree.catchBlock, 'catch block expected');
      }
      if (tree.finallyBlock !== null && !tree.finallyBlock.isNull()) {
        this.checkVisit_(tree.finallyBlock.type === ParseTreeType.FINALLY,
            tree.finallyBlock, 'finally block expected');
      }
      if ((tree.catchBlock === null || tree.catchBlock.isNull()) &&
          (tree.finallyBlock === null || tree.finallyBlock.isNull())) {
        this.fail_(tree, 'either catch or finally must be present');
      }
    },

    /**
     * @param {traceur.syntax.trees.UnaryExpression} tree
     */
    visitUnaryExpression: function(tree) {
      this.checkVisit_(tree.operand.isAssignmentExpression(), tree.operand,
          'assignment expression expected');
    },

    /**
     * @param {traceur.syntax.trees.VariableDeclaration} tree
     */
    visitVariableDeclaration: function(tree) {
      if (tree.initializer !== null) {
        this.checkVisit_(tree.initializer.isAssignmentExpression(),
            tree.initializer, 'assignment expression expected');
      }
    },

    /**
     * @param {traceur.syntax.trees.WhileStatement} tree
     */
    visitWhileStatement: function(tree) {
      this.checkVisit_(tree.condition.isExpression(), tree.condition,
          'expression expected');
      this.checkVisit_(tree.body.isStatement(), tree.body,
          'statement expected');
    },

    /**
     * @param {traceur.syntax.trees.WithStatement} tree
     */
    visitWithStatement: function(tree) {
      this.checkVisit_(tree.expression.isExpression(), tree.expression,
          'expression expected');
      this.checkVisit_(tree.body.isStatement(), tree.body,
          'statement expected');
    },

    /**
     * @param {traceur.syntax.trees.YieldStatement} tree
     */
    visitYieldStatement: function(tree) {
      if (tree.expression !== null) {
        this.checkVisit_(tree.expression.isExpression(), tree.expression,
            'expression expected');
      }
    }
  });

  // Export
  return {
    ParseTreeValidator: ParseTreeValidator
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var IdentifierToken = traceur.syntax.IdentifierToken;
  var LiteralToken = traceur.syntax.LiteralToken;
  var ParseTreeType = traceur.syntax.ParseTreeType;
  var PredefinedName = traceur.syntax.PredefinedName;
  var Token = traceur.syntax.Token;
  var TokenType = traceur.syntax.TokenType;

  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;

  var ArgumentList = traceur.syntax.trees.ArgumentList;
  var ArrayLiteralExpression = traceur.syntax.trees.ArrayLiteralExpression;
  var ArrayPattern = traceur.syntax.trees.ArrayPattern;
  var BinaryOperator = traceur.syntax.trees.BinaryOperator;
  var Block = traceur.syntax.trees.Block;
  var BreakStatement = traceur.syntax.trees.BreakStatement;
  var CallExpression = traceur.syntax.trees.CallExpression;
  var CaseClause = traceur.syntax.trees.CaseClause;
  var Catch = traceur.syntax.trees.Catch;
  var ClassDeclaration = traceur.syntax.trees.ClassDeclaration;
  var CommaExpression = traceur.syntax.trees.CommaExpression;
  var ConditionalExpression = traceur.syntax.trees.ConditionalExpression;
  var ContinueStatement = traceur.syntax.trees.ContinueStatement;
  var DefaultClause = traceur.syntax.trees.DefaultClause;
  var DefaultParameter = traceur.syntax.trees.DefaultParameter;
  var DoWhileStatement = traceur.syntax.trees.DoWhileStatement;
  var EmptyStatement = traceur.syntax.trees.EmptyStatement;
  var ExpressionStatement = traceur.syntax.trees.ExpressionStatement;
  var FieldDeclaration = traceur.syntax.trees.FieldDeclaration;
  var Finally = traceur.syntax.trees.Finally;
  var ForEachStatement = traceur.syntax.trees.ForEachStatement;
  var ForInStatement = traceur.syntax.trees.ForInStatement;
  var ForStatement = traceur.syntax.trees.ForStatement;
  var FormalParameterList = traceur.syntax.trees.FormalParameterList;
  var FunctionDeclaration = traceur.syntax.trees.FunctionDeclaration;
  var GetAccessor = traceur.syntax.trees.GetAccessor;
  var IdentifierExpression = traceur.syntax.trees.IdentifierExpression;
  var IfStatement = traceur.syntax.trees.IfStatement;
  var LabelledStatement = traceur.syntax.trees.LabelledStatement;
  var LiteralExpression = traceur.syntax.trees.LiteralExpression;
  var MemberExpression = traceur.syntax.trees.MemberExpression;
  var MemberLookupExpression = traceur.syntax.trees.MemberLookupExpression;
  var Mixin = traceur.syntax.trees.Mixin;
  var MixinResolveList = traceur.syntax.trees.MixinResolveList;
  var NewExpression = traceur.syntax.trees.NewExpression;
  var ObjectLiteralExpression = traceur.syntax.trees.ObjectLiteralExpression;
  var ObjectPattern = traceur.syntax.trees.ObjectPattern;
  var ObjectPatternField = traceur.syntax.trees.ObjectPatternField;
  var ParenExpression = traceur.syntax.trees.ParenExpression;
  var PostfixExpression = traceur.syntax.trees.PostfixExpression;
  var Program = traceur.syntax.trees.Program;
  var PropertyNameAssignment = traceur.syntax.trees.PropertyNameAssignment;
  var RestParameter = traceur.syntax.trees.RestParameter;
  var ReturnStatement = traceur.syntax.trees.ReturnStatement;
  var YieldStatement = traceur.syntax.trees.YieldStatement;
  var SetAccessor = traceur.syntax.trees.SetAccessor;
  var SpreadExpression = traceur.syntax.trees.SpreadExpression;
  var SpreadPatternElement = traceur.syntax.trees.SpreadPatternElement;
  var SwitchStatement = traceur.syntax.trees.SwitchStatement;
  var ThisExpression = traceur.syntax.trees.ThisExpression;
  var ThrowStatement = traceur.syntax.trees.ThrowStatement;
  var TraitDeclaration = traceur.syntax.trees.TraitDeclaration;
  var TryStatement = traceur.syntax.trees.TryStatement;
  var UnaryExpression = traceur.syntax.trees.UnaryExpression;
  var VariableDeclarationList = traceur.syntax.trees.VariableDeclarationList;
  var VariableDeclaration = traceur.syntax.trees.VariableDeclaration;
  var VariableStatement = traceur.syntax.trees.VariableStatement;
  var WhileStatement = traceur.syntax.trees.WhileStatement;
  var WithStatement = traceur.syntax.trees.WithStatement;

  // Helpers so we can use these on Arguments objects.
  var slice = Array.prototype.slice.call.bind(Array.prototype.slice);
  var map = Array.prototype.map.call.bind(Array.prototype.map);

  // Tokens

  /**
   * @param {TokenType} operator
   * @return {Token}
   */
  function createOperatorToken(operator) {
    return new Token(operator, null);
  }

  /**
   * @param {string} identifier
   * @return {IdentifierToken}
   */
  function createIdentifierToken(identifier) {
    return new IdentifierToken(null, identifier);
  }

  /**
   * @param {string} propertyName
   * @return {Token}
   */
  function createPropertyNameToken(propertyName) {
    // TODO: properties with non identifier names
    return createIdentifierToken(propertyName);
  }

  function createStringLiteralToken(value) {
    // TODO: escape string literal token
    return new LiteralToken(TokenType.STRING, '"' + value + '"', null);
  }

  function createBooleanLiteralToken(value) {
    return new Token(value ? TokenType.TRUE : TokenType.FALSE, null);
  }

  function createNullLiteralToken() {
    return new LiteralToken(TokenType.NULL, 'null', null);
  }


  function createNumberLiteralToken(value) {
    return new LiteralToken(TokenType.NUMBER, String(value), null);
  }

  // Token lists

  /**
   * @return {Array.<string>}
   */
  function createEmptyParameters() {
    return [];
  }

  /**
   * @param {IdentifierToken|FormalParameterList} parameter
   * @return {Array.<string>}
   */
  function createParameters(parameter) {
    if (parameter instanceof IdentifierToken)
      return [parameter.value];

    var builder = [];

    parameter.parameters.forEach(function(parameter) {
      if (!parameter.isRestParameter()) {
        // TODO: array and object patterns
        builder.push(parameter.identifierToken.value);
      }
    });

    return builder;
  }

  /**
   * Either creates an array from the arguments, or if the first argument is an
   * array, creates a new array with its elements followed by the other
   * arguments.
   *
   * TODO(jmesserly): this API is a bit goofy. Can we replace it with something
   * simpler? In most use cases, square brackets could replace calls to this.
   *
   * @param {Array.<ParseTree>|ParseTree} statementsOrHead
   * @param {...ParseTree} var_args
   * @return {Array.<ParseTree>}
   */
  function createStatementList(statementsOrHead, var_args) {
    if (statementsOrHead instanceof Array) {
      var result = statementsOrHead.slice();
      result.push.apply(result, slice(arguments, 1));
      return result;
    }
    return slice(arguments);
  }

  /**
   * TODO(arv): Make this less overloaded.
   *
   * @param {string|number|IdentifierToken|Array.<string>} arg0
   * @param {...string} var_args
   * @return {FormalParameterList}
   */
  function createParameterList(arg0, var_args) {
    if (typeof arg0 == 'string') {
      // var_args of strings
      var parameterList = map(arguments, createIdentifierExpression);
      return new FormalParameterList(null, parameterList);
    }

    if (typeof arg0 == 'number')
      return createParameterListHelper(arg0, false);

    if (arg0 instanceof IdentifierToken) {
      return new FormalParameterList(
          null, [createIdentifierExpression(arg0)]);
    }

    // Array.<string>
    var builder = arg0.map(createIdentifierExpression);
    return new FormalParameterList(null, builder);
  }

  /**
   * Helper for building parameter lists with and without rest params.
   * @param {number} numberOfParameters
   * @param {boolean} hasRestParams
   * @return {FormalParameterList}
   */
  function createParameterListHelper(numberOfParameters, hasRestParams) {
    var builder = [];

    for (var index = 0; index < numberOfParameters; index++) {
      var parameterName = PredefinedName.getParameterName(index);
      var isRestParameter = index == numberOfParameters - 1 && hasRestParams;
      builder.push(
          isRestParameter ?
              createRestParameter(parameterName) :
              createIdentifierExpression(parameterName));
    }

    return new FormalParameterList(null, builder);
  }

  /**
   * @param {number} numberOfParameters
   * @return {FormalParameterList}
   */
  function createParameterListWithRestParams(numberOfParameters) {
    return createParameterListHelper(numberOfParameters, true);
  }

  /**
   * Creates an expression that refers to the {@code index}-th
   * parameter by its predefined name.
   *
   * @see PredefinedName#getParameterName
   *
   * @param {number} index
   * @return {IdentifierExpression}
   */
  function createParameterReference(index) {
    return createIdentifierExpression(PredefinedName.getParameterName(index));
  }

  /**
   * @return {FormalParameterList}
   */
  function createEmptyParameterList() {
    return new FormalParameterList(null, []);
  }

  // Tree Lists

  function createEmptyList() {
    // TODO(arv): Remove
    return [];
  }

  // Trees

  /**
   * @param {Array.<ParseTree>|ParseTree|number} numberListOrFirst
   * @param {...ParseTree} var_args
   * @return {ArgumentList}
   */
  function createArgumentList(numberListOrFirst, var_args) {
    if (typeof numberListOrFirst == 'number') {
      return createArgumentListFromParameterList(
          createParameterList(numberListOrFirst));
    }

    var list;
    if (numberListOrFirst instanceof Array)
      list = numberListOrFirst;
    else
      list = slice(arguments);

    return new ArgumentList(null, list);
  }

  /**
   * @param {FormalParameterList} formalParameterList
   * @return {ArgumentList}
   */
  function createArgumentListFromParameterList(formalParameterList) {
    var builder = formalParameterList.parameters.map(function(parameter) {
      if (parameter.isRestParameter()) {
        return createSpreadExpression(
            createIdentifierExpression(
                parameter.identifier));
      } else {
        // TODO: implement pattern -> array, object literal translation
        return parameter;
      }
    });

    return new ArgumentList(null, builder);
  }

  /**
   * @return {ArgumentList}
   */
  function createEmptyArgumentList() {
    return new ArgumentList(null, createEmptyList());
  }

  /**
   * @param {Array.<ParseTree>} list
   * @return {ArrayLiteralExpression}
   */
  function createArrayLiteralExpression(list) {
    return new ArrayLiteralExpression(null, list);
  }

  /**
   * @return {ArrayLiteralExpression}
   */
  function createEmptyArrayLiteralExpression() {
    return createArrayLiteralExpression(createEmptyList());
  }

  /**
   * @param {Array.<ParseTree>} list
   * @return {ArrayPattern}
   */
  function createArrayPattern(list) {
    return new ArrayPattern(null, list);
  }

  /**
   * @param {ParseTree} lhs
   * @param {ParseTree} rhs
   * @return {BinaryOperator}
   */
  function createAssignmentExpression(lhs, rhs) {
    return new BinaryOperator(null, lhs,
        createOperatorToken(TokenType.EQUAL), rhs);
  }

  /**
   * @return {BinaryOperator}
   */
  function createBinaryOperator(left, operator, right) {
    return new BinaryOperator(null, left, operator, right);
  }

  /**
   * @return {EmptyStatement}
   */
  function createEmptyStatement() {
    return new EmptyStatement(null);
  }

  /**
   * @return {Block}
   */
  function createEmptyBlock() {
    return createBlock(createEmptyList());
  }

  /**
   * @param {Array.<ParseTree>|ParseTree} statements
   * @param {...ParseTree} var_args
   * @return {Block}
   */
  function createBlock(statements) {
    if (statements instanceof ParseTree)
      statements = slice(arguments);
    return new Block(null, statements);
  }

  /**
   * @param {Array.<ParseTree>|ParseTree} statements
   * @param {...ParseTree} var_args
   * @return {ParseTree}
   */
  function createScopedStatements(statements) {
    if (statements instanceof ParseTree)
      statements = slice(arguments);
    return createScopedBlock(createBlock(statements));
  }

  /**
   * @param {Block} block
   * @return {ParseTree}
   */
  function createScopedBlock(block) {
    return createExpressionStatement(createScopedExpression(block));
  }

  /**
   * @param {Block} block
   * @return {CallExpression}
   */
  function createScopedExpression(block) {
    return createCallCall(
        createParenExpression(
            createFunctionExpression(createEmptyParameterList(), block)),
        createThisExpression());
  }

  /**
   * @param {ParseTree} operand
   * @param {ArgumentList=} opt_args
   * @return {CallExpression}
   */
  function createCallExpression(operand, opt_args) {
    var args = opt_args || createEmptyArgumentList();
    return new CallExpression(null, operand, args);
  }

  /**
   * @param {ParseTree} func
   * @param {ParseTree} thisTree
   * @return {CallExpression}
   */
  function createBoundCall(func, thisTree) {
    return createCallExpression(
        createMemberExpression(
            func.type == ParseTreeType.FUNCTION_DECLARATION ?
                createParenExpression(func) :
                func,
            PredefinedName.BIND),
        createArgumentList(thisTree));
  }

  /**
   * @param {string} aggregateName
   * @param {string} propertyName
   * @return {CallExpression}
   */
  function createLookupGetter(aggregateName, propertyName) {
    // TODO(arv): Use ES5 method instead of relying on propriatary extensions.
    return createCallExpression(
        createMemberExpression(
            aggregateName,
            PredefinedName.PROTOTYPE,
            PredefinedName.LOOKUP_GETTER),
        createArgumentList(createStringLiteral(propertyName)));
  }

  /**
   * @return {BreakStatement}
   */
  function createBreakStatement() {
    return new BreakStatement(null, null);
  }

  // function.call(this, arguments)
  /**
   * @param {ParseTree} func
   * @param {ParseTree} thisExpression
   * @param {ParseTree|Array.<ParseTree>} args
   * @param {...ParseTree} var_args
   * @return {CallExpression}
   */
  function createCallCall(func, thisExpression, args, var_args) {
    if (args instanceof ParseTree)
      args = slice(arguments, 2);

    var builder = [];

    builder.push(thisExpression);
    builder.push.apply(builder, args);

    return createCallExpression(
        createMemberExpression(func, PredefinedName.CALL),
        createArgumentList(builder));
  }

  /**
   * @param {ParseTree} func
   * @param {ParseTree} thisExpression
   * @param {...ParseTree} var_args
   * @return {ParseTree}
   */
  function createCallCallStatement(func, thisExpression, var_args) {
    var args = slice(arguments, 2);
    return createExpressionStatement(
        createCallCall(func, thisExpression, args));
  }

  /**
   * @param {ParseTree} expression
   * @param {Array.<ParseTree>} statements
   * @return {CaseClause}
   */
  function createCaseClause(expression, statements) {
    return new CaseClause(null, expression, statements);
  }

  /**
   * @param {IdentifierToken} exceptionName
   * @param {ParseTree} catchBody
   * @return {Catch}
   */
  function createCatch(exceptionName, catchBody) {
    return new Catch(null, exceptionName, catchBody);
  }

  /**
   * @param {IdentifierToken} name
   * @param {ParseTree} superClass
   * @param {Array.<ParseTree>} elements
   * @return {ClassDeclaration}
   */
  function createClassDeclaration(name, superClass, elements) {
    return new ClassDeclaration(null, name, superClass, elements);
  }

  /**
   * @param {Array.<ParseTree>} expressions
   * @return {CommaExpression}
   */
  function createCommaExpression(expressions) {
    return new CommaExpression(null, expressions);
  }

  /**
   * @param {ParseTree} condition
   * @param {ParseTree} left
   * @param {ParseTree} right
   * @return {ConditionalExpression}
   */
  function createConditionalExpression(condition, left, right) {
    return new ConditionalExpression(null, condition, left, right);
  }

  /**
   * @return {ContinueStatement}
   */
  function createContinueStatement() {
    return new ContinueStatement(null, null);
  }

  /**
   * @param {Array.<ParseTree>} statements
   * @return {DefaultClause}
   */
  function createDefaultClause(statements) {
    return new DefaultClause(null, statements);
  }

  /**
   * @param {IdentifierExpression} identifier
   * @param {ParseTree} expression
   * @return {DefaultParameter}
   */
  function createDefaultParameter(identifier, expression) {
    return new DefaultParameter(null, identifier, expression);
  }

  /**
   * @param {ParseTree} body
   * @param {ParseTree} condition
   * @return {DoWhileStatement}
   */
  function createDoWhileStatement(body, condition) {
    return new DoWhileStatement(null, body, condition);
  }

  /**
   * @param {ParseTree} lhs
   * @param {ParseTree} rhs
   * @return {ExpressionStatement}
   */
  function createAssignmentStatement(lhs, rhs) {
    return createExpressionStatement(createAssignmentExpression(lhs, rhs));
  }

  /**
   * @param {ParseTree} operand
   * @param {ArgumentList=} opt_args
   * @return {ExpressionStatement}
   */
  function createCallStatement(operand, opt_args) {
    if (opt_args) {
      return createExpressionStatement(
          createCallExpression(operand, opt_args));
    }
    return createExpressionStatement(createCallExpression(operand));
  }

  /**
   * @param {ParseTree} expression
   * @return {ExpressionStatement}
   */
  function createExpressionStatement(expression) {
    return new ExpressionStatement(null, expression);
  }

  /**
   * @param {boolean} isStatic
   * @param {boolean} isConst
   * @param {Array.<VariableDeclaration} expression
   * @return {FieldDeclaration}
   */
  function createFieldDeclaration(isStatic, isConst, declarations) {
    return new FieldDeclaration(null, isStatic, isConst, declarations);
  }

  /**
   * @param {ParseTree} block
   * @return {Finally}
   */
  function createFinally(block) {
    return new Finally(null, block);
  }

  /**
   * @param {VariableDeclarationList} initializer
   * @param {ParseTree} collection
   * @param {ParseTree} body
   * @return {ForEachStatement}
   */
  function createForEachStatement(initializer, collection, body) {
    return new ForEachStatement(null, initializer, collection, body);
  }

  /**
   * @param {ParseTree} initializer
   * @param {ParseTree} collection
   * @param {ParseTree} body
   * @return {ForInStatement}
   */
  function createForInStatement(initializer, collection, body) {
    return new ForInStatement(null, initializer, collection, body);
  }

  /**
   * @param {ParseTree} variables
   * @param {ParseTree} condition
   * @param {ParseTree} increment
   * @param {ParseTree} body
   * @return {ForStatement}
   */
  function createForStatement(variables, condition, increment, body) {
    return new ForStatement(null, variables, condition, increment, body);
  }

  /**
   * @param {Array.<string>|FormalParameterList} formalParameterList
   * @param {Block} functionBody
   * @return {FunctionDeclaration}
   */
  function createFunctionExpressionFormals(formalParameters, functionBody) {
    if (formalParameters instanceof Array)
      formalParameters = createParameterList(formalParameters);
    return new FunctionDeclaration(null, null, false, formalParameters,
        functionBody);
  }

  /**
   * @param {string|IdentifierToken} name
   * @param {FormalParameterList} formalParameterList
   * @param {Block} functionBody
   * @return {FunctionDeclaration}
   */
  function createFunctionDeclaration(name, formalParameterList, functionBody) {
    if (typeof name == 'string')
      name = createIdentifierToken(name);
    return new FunctionDeclaration(null, name, false, formalParameterList,
        functionBody);
  }

  /**
   * @param {FormalParameterList} formalParameterList
   * @param {Block} functionBody
   * @return {FunctionDeclaration}
   */
  function createFunctionExpression(formalParameterList, functionBody) {
    return new FunctionDeclaration(null, null, false, formalParameterList,
        functionBody);
  }

  // [static] get propertyName () { ... }
  /**
   * @param {string|Token} propertyName
   * @param {boolean} isStatic
   * @param {Block} body
   * @return {GetAccessor}
   */
  function createGetAccessor(propertyName, isStatic, body) {
    if (typeof propertyName == 'string')
      propertyName = createPropertyNameToken(propertyName);
    return new GetAccessor(null, propertyName, isStatic, body);
  }

  /**
   * @param {string|IdentifierToken} identifier
   * @return {IdentifierExpression}
   */
  function createIdentifierExpression(identifier) {
    if (typeof identifier == 'string')
      identifier = createIdentifierToken(identifier);
    return new IdentifierExpression(null, identifier);
  }

  /**
   * @return {IdentifierExpression}
   */
  function createUndefinedExpression() {
    return createIdentifierExpression(PredefinedName.UNDEFINED);
  }

  /**
   * @param {ParseTree} condition
   * @param {ParseTree} ifClause
   * @param {ParseTree=} opt_elseClause
   * @return {IfStatement}
   */
  function createIfStatement(condition, ifClause, opt_elseClause) {
    return new IfStatement(null, condition, ifClause,
        opt_elseClause || null);
  }

  /**
   * @param {IdentifierToken} name
   * @param {ParseTree} statement
   * @return {LabelledStatement}
   */
  function createLabelledStatement(name, statement) {
    return new LabelledStatement(null, name, statement);
  }

  /**
   * @param {string} value
   * @return {ParseTree}
   */
  function createStringLiteral(value) {
    return new LiteralExpression(null, createStringLiteralToken(value));
  }

  /**
   * @param {boolean} value
   * @return {ParseTree}
   */
  function createBooleanLiteral(value) {
    return new LiteralExpression(null, createBooleanLiteralToken(value));
  }

  /**
   * @return {ParseTree}
   */
  function createTrueLiteral() {
    return createBooleanLiteral(true);
  }

  /**
   * @return {ParseTree}
   */
  function createFalseLiteral() {
    return createBooleanLiteral(false);
  }

  /**
   * @return {ParseTree}
   */
  function createNullLiteral() {
    return new LiteralExpression(null, createNullLiteralToken());
  }

  /**
   * @param {number} value
   * @return {ParseTree}
   */
  function createNumberLiteral(value) {
    return new LiteralExpression(null, createNumberLiteralToken(value));
  }

  /**
   * @param {string|IdentifierToken|ParseTree} operand
   * @param {string|IdentifierToken} memberName
   * @param {...string|IdentifierToken} memberNames
   * @return {MemberExpression}
   */
  function createMemberExpression(operand, memberName, memberNames) {
    if (typeof operand == 'string' || operand instanceof IdentifierToken)
      operand = createIdentifierExpression(operand);
    if (typeof memberName == 'string')
      memberName = createIdentifierToken(memberName);

    var tree = new MemberExpression(null, operand, memberName);
    for (var i = 2; i < arguments.length; i++) {
      tree = createMemberExpression(tree, arguments[i]);
    }
    return tree;
  }

  /**
   * @return {MemberLookupExpression}
   */
  function createMemberLookupExpression(operand,  memberExpression) {
    return new MemberLookupExpression(null, operand, memberExpression);
  }

  /**
   * @param {IdentifierToken|string=} opt_memberName
   * @return {ParseTree}
   */
  function createThisExpression(memberName) {
    if (memberName)
      return createMemberExpression(createThisExpression(), memberName);
    return new ThisExpression(null);
  }

  /**
   * @param {IdentifierToken} name
   * @param {MixinResolveList} mixinResolves
   * @return {Mixin}
   */
  function createMixin(name, mixinResolves) {
    return new Mixin(null, name, mixinResolves);
  }

  /**
   * @param {Array.<ParseTree>} resolves
   * @return {MixinResolveList}
   */
  function createMixinResolveList(resolves) {
    return new MixinResolveList(null, resolves);
  }

  /**
   * @param {ParseTree} operand
   * @param {ArgumentList} args
   * @return {NewExpression}
   */
  function createNewExpression(operand, args) {
    return new NewExpression(null, operand, args);
  }

  /**
   * @param {ParseTree} value
   * @return {ParseTree}
   */
  function createObjectFreeze(value) {
    // Object.freeze(value)
    return createCallExpression(
        createMemberExpression(PredefinedName.OBJECT, PredefinedName.FREEZE),
        createArgumentList(value));
  }

  /**
   * @param {Array.<ParseTree>|ParseTree} propertyNameAndValues
   * @param {...ParseTree} var_args
   * @return {ObjectLiteralExpression}
   */
  function createObjectLiteralExpression(propertyNameAndValues) {
    if (propertyNameAndValues instanceof ParseTree)
      propertyNameAndValues = slice(arguments);
    return new ObjectLiteralExpression(null, propertyNameAndValues);
  }

  /**
   * @param {Array.<ParseTree>} list
   * @return {ObjectPattern}
   */
  function createObjectPattern(list) {
    return new ObjectPattern(null, list);
  }

  /**
   * @param {IdentifierToken} identifier
   * @param {ParseTree} element
   * @return {ObjectPatternField}
   */
  function createObjectPatternField(identifier, element) {
    return new ObjectPatternField(null, identifier, element);
  }

  /**
   * @param {ParseTree} expression
   * @return {ParenExpression}
   */
  function createParenExpression(expression) {
    return new ParenExpression(null, expression);
  }

  /**
   * @param {ParseTree} operand
   * @param {ParseTree} operator
   * @return {PostfixExpression}
   */
  function createPostfixExpression(operand, operator) {
    return new PostfixExpression(null, operand, operator);
  }

  /**
   * @param {Array.<ParseTree>} programElements
   * @return {Program}
   */
  function createProgram(programElements) {
    return new Program(null, programElements);
  }

  /**
   * @param {string|IdentifierToken} identifier
   * @param {ParseTree} value
   * @return {PropertyNameAssignment}
   */
  function createPropertyNameAssignment(identifier, value) {
    if (typeof identifier == 'string')
      identifier = createIdentifierToken(identifier);
    return new PropertyNameAssignment(null, identifier, value);
  }

  /**
   * @param {string|IdentifierToken} identifier
   * @return {RestParameter}
   */
  function createRestParameter(identifier) {
    if (typeof identifier == 'string')
      identifier = createIdentifierToken(identifier);
    return new RestParameter(null, identifier);
  }

  /**
   * @param {ParseTree} expression
   * @return {ReturnStatement}
   */
  function createReturnStatement(expression) {
    return new ReturnStatement(null, expression);
  }

  /**
   * @param {ParseTree} expression
   * @param {boolean} isYieldFor
   * @return {YieldStatement}
   */
  function createYieldStatement(expression, isYieldFor) {
    return new YieldStatement(null, expression, isYieldFor);
  }

  /**
   * @param {string|Token} propertyName
   * @param {boolean} isStatic
   * @param {string|IdentifierToken} parameter
   * @param {Block} body
   * @return {SetAccessor}
   */
  function createSetAccessor(propertyName, isStatic, parameter, body) {
    if (typeof propertyName == 'string')
      propertyName = createPropertyNameToken(propertyName);
    if (typeof parameter == 'string')
      parameter = createIdentifierToken(parameter);
    return new SetAccessor(null, propertyName, isStatic, parameter, body);
  }

  /**
   * @param {ParseTree} expression
   * @return {SpreadExpression}
   */
  function createSpreadExpression(expression) {
    return new SpreadExpression(null, expression);
  }

  /**
   * @param {ParseTree} lvalue
   * @return {SpreadPatternElement}
   */
  function createSpreadPatternElement(lvalue) {
    return new SpreadPatternElement(null, lvalue);
  }

  /**
   * @param {ParseTree} expression
   * @param {Array.<ParseTree>} caseClauses
   * @return {SwitchStatement}
   */
  function createSwitchStatement(expression, caseClauses) {
    return new SwitchStatement(null, expression, caseClauses);
  }

  /**
   * @param {ParseTree} value
   * @return {ThrowStatement}
   */
  function createThrowStatement(value) {
    return new ThrowStatement(null, value);
  }

  /**
   * @param {IdentifierToken} name
   * @param {Array.<ParseTree>} elements
   * @return {TraitDeclaration}
   */
  function createTraitDeclaration(name, elements) {
    return new TraitDeclaration(null, name, elements);
  }

  /**
   * @param {ParseTree} body
   * @param {ParseTree} catchOrFinallyBlock
   * @param {ParseTree=} opt_finallyBlock
   * @return {TryStatement}
   */
  function createTryStatement(body, catchOrFinallyBlock, opt_finallyBlock) {
    // TODO(arv): Remove 2 params case and enforce a catchBlack (may be null).
    var catchBlock, finallyBlock;
    if (arguments.length > 2) {
      catchBlock = arguments[1];
      finallyBlock = arguments[2];
    } else {
      catchBlock = null;
      finallyBlock = arguments[1];
    }

    return new TryStatement(null, body, catchBlock, finallyBlock);
  }

  /**
   * @param {Token} operator
   * @param {ParseTree} operand
   * @return {UnaryExpression}
   */
  function createUnaryExpression(operator, operand) {
    return new UnaryExpression(null, operator, operand);
  }

  /**
   * @return {ParseTree}
   */
  function createUseStrictDirective() {
    return createExpressionStatement(createStringLiteral('use strict'));
  }

  /**
   * @param {TokenType} binding
   * @param {IdentifierToken|Array.<VariableDeclaration>} identifierOrDeclarations
   * @param {ParseTree=} initializer
   * @return {VariableDeclarationList}
   */
  function createVariableDeclarationList(binding, identifierOrDeclarations, initializer) {
    if (identifierOrDeclarations instanceof Array) {
      var declarations = identifierOrDeclarations;
      return new VariableDeclarationList(null, binding, declarations);
    }

    var identifier = identifierOrDeclarations;
    if (typeof identifier == 'string')
      identifier = createIdentifierToken(identifier);

    return createVariableDeclarationList(
        binding, [createVariableDeclaration(identifier, initializer)]);
  }

  /**
   * @param {string|IdentifierToken|ParseTree} identifier
   * @param {ParseTree} initializer
   * @return {VariableDeclaration}
   */
  function createVariableDeclaration(identifier, initializer) {
    if (typeof identifier == 'string' || identifier instanceof IdentifierToken)
      identifier = createIdentifierExpression(identifier);
    return new VariableDeclaration(null, identifier, initializer);
  }

  /**
   * @param {VariableDeclarationList|TokenType} listOrBinding
   * @param {string|IdentifierToken=} identifier
   * @param {ParseTree=} initializer
   * @return {VariableStatement}
   */
  function createVariableStatement(listOrBinding, identifier, initializer) {
    if (listOrBinding instanceof VariableDeclarationList)
      return new VariableStatement(null, listOrBinding);
    var binding = listOrBinding;
    if (typeof identifier == 'string')
      identifier = createIdentifierToken(identifier);
    var list = createVariableDeclarationList(binding, identifier, initializer);
    return createVariableStatement(list);
  }

  /**
   * @param {ParseTree} condition
   * @param {ParseTree} body
   * @return {WhileStatement}
   */
  function createWhileStatement(condition, body) {
    return new WhileStatement(null, condition, body);
  }

  /**
   * @param {ParseTree} expression
   * @param {ParseTree} body
   * @return {WithStatement}
   */
  function createWithStatement(expression, body) {
    return new WithStatement(null, expression, body);
  }

  /**
   * @param {number} state
   * @return {ExpressionStatement}
   */
  function createAssignStateStatement(state) {
    return createAssignmentStatement(
        createIdentifierExpression(PredefinedName.STATE),
        createNumberLiteral(state));
  }

  return {
    ParseTreeFactory: {
      createArgumentList: createArgumentList,
      createArgumentListFromParameterList: createArgumentListFromParameterList,
      createArrayLiteralExpression: createArrayLiteralExpression,
      createArrayPattern: createArrayPattern,
      createAssignStateStatement: createAssignStateStatement,
      createAssignmentExpression: createAssignmentExpression,
      createAssignmentStatement: createAssignmentStatement,
      createBinaryOperator: createBinaryOperator,
      createBlock: createBlock,
      createBooleanLiteral: createBooleanLiteral,
      createBooleanLiteralToken: createBooleanLiteralToken,
      createBoundCall: createBoundCall,
      createBreakStatement: createBreakStatement,
      createCallCall: createCallCall,
      createCallCallStatement: createCallCallStatement,
      createCallExpression: createCallExpression,
      createCallStatement: createCallStatement,
      createCaseClause: createCaseClause,
      createCatch: createCatch,
      createClassDeclaration: createClassDeclaration,
      createCommaExpression: createCommaExpression,
      createConditionalExpression: createConditionalExpression,
      createContinueStatement: createContinueStatement,
      createDefaultClause: createDefaultClause,
      createDefaultParameter: createDefaultParameter,
      createDoWhileStatement: createDoWhileStatement,
      createEmptyArgumentList: createEmptyArgumentList,
      createEmptyArrayLiteralExpression: createEmptyArrayLiteralExpression,
      createEmptyBlock: createEmptyBlock,
      createEmptyList: createEmptyList,
      createEmptyParameterList: createEmptyParameterList,
      createEmptyParameters: createEmptyParameters,
      createEmptyStatement: createEmptyStatement,
      createExpressionStatement: createExpressionStatement,
      createFalseLiteral: createFalseLiteral,
      createFieldDeclaration: createFieldDeclaration,
      createFinally: createFinally,
      createForEachStatement: createForEachStatement,
      createForInStatement: createForInStatement,
      createForStatement: createForStatement,
      createFunctionDeclaration: createFunctionDeclaration,
      createFunctionExpression: createFunctionExpression,
      createFunctionExpressionFormals: createFunctionExpressionFormals,
      createGetAccessor: createGetAccessor,
      createIdentifierExpression: createIdentifierExpression,
      createIdentifierToken: createIdentifierToken,
      createIfStatement: createIfStatement,
      createLabelledStatement: createLabelledStatement,
      createLookupGetter: createLookupGetter,
      createMemberExpression: createMemberExpression,
      createMemberLookupExpression: createMemberLookupExpression,
      createMixin: createMixin,
      createMixinResolveList: createMixinResolveList,
      createNewExpression: createNewExpression,
      createNullLiteral: createNullLiteral,
      createNullLiteralToken: createNullLiteralToken,
      createNumberLiteral: createNumberLiteral,
      createNumberLiteralToken: createNumberLiteralToken,
      createObjectFreeze: createObjectFreeze,
      createObjectLiteralExpression: createObjectLiteralExpression,
      createObjectPattern: createObjectPattern,
      createObjectPatternField: createObjectPatternField,
      createOperatorToken: createOperatorToken,
      createParameterList: createParameterList,
      createParameterListWithRestParams: createParameterListWithRestParams,
      createParameterReference: createParameterReference,
      createParameters: createParameters,
      createParenExpression: createParenExpression,
      createPostfixExpression: createPostfixExpression,
      createProgram: createProgram,
      createPropertyNameAssignment: createPropertyNameAssignment,
      createPropertyNameToken: createPropertyNameToken,
      createRestParameter: createRestParameter,
      createReturnStatement: createReturnStatement,
      createScopedBlock: createScopedBlock,
      createScopedExpression: createScopedExpression,
      createScopedStatements: createScopedStatements,
      createSetAccessor: createSetAccessor,
      createSpreadExpression: createSpreadExpression,
      createSpreadPatternElement: createSpreadPatternElement,
      createStatementList: createStatementList,
      createStringLiteral: createStringLiteral,
      createStringLiteralToken: createStringLiteralToken,
      createSwitchStatement: createSwitchStatement,
      createThisExpression: createThisExpression,
      createThrowStatement: createThrowStatement,
      createTraitDeclaration: createTraitDeclaration,
      createTrueLiteral: createTrueLiteral,
      createTryStatement: createTryStatement,
      createUnaryExpression: createUnaryExpression,
      createUndefinedExpression: createUndefinedExpression,
      createUseStrictDirective: createUseStrictDirective,
      createVariableDeclaration: createVariableDeclaration,
      createVariableDeclarationList: createVariableDeclarationList,
      createVariableStatement: createVariableStatement,
      createWhileStatement: createWhileStatement,
      createWithStatement: createWithStatement,
      createYieldStatement: createYieldStatement
    }
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createArgumentList = ParseTreeFactory.createArgumentList;
  var createArrayLiteralExpression = ParseTreeFactory.createArrayLiteralExpression;
  var createArrayPattern = ParseTreeFactory.createArrayPattern;
  var createBinaryOperator = ParseTreeFactory.createBinaryOperator;
  var createBlock = ParseTreeFactory.createBlock;
  var createCallExpression = ParseTreeFactory.createCallExpression;
  var createCaseClause = ParseTreeFactory.createCaseClause;
  var createCatch = ParseTreeFactory.createCatch;
  var createClassDeclaration = ParseTreeFactory.createClassDeclaration;
  var createCommaExpression = ParseTreeFactory.createCommaExpression;
  var createConditionalExpression = ParseTreeFactory.createConditionalExpression;
  var createDefaultClause = ParseTreeFactory.createDefaultClause;
  var createDefaultParameter = ParseTreeFactory.createDefaultParameter;
  var createDoWhileStatement = ParseTreeFactory.createDoWhileStatement;
  var createExpressionStatement = ParseTreeFactory.createExpressionStatement;
  var createExpressionStatement = ParseTreeFactory.createExpressionStatement;
  var createFieldDeclaration = ParseTreeFactory.createFieldDeclaration;
  var createFinally = ParseTreeFactory.createFinally;
  var createForEachStatement = ParseTreeFactory.createForEachStatement;
  var createForInStatement = ParseTreeFactory.createForInStatement;
  var createForStatement = ParseTreeFactory.createForStatement;
  var createFunctionDeclaration = ParseTreeFactory.createFunctionDeclaration;
  var createGetAccessor = ParseTreeFactory.createGetAccessor;
  var createIfStatement = ParseTreeFactory.createIfStatement;
  var createLabelledStatement = ParseTreeFactory.createLabelledStatement;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createMemberLookupExpression = ParseTreeFactory.createMemberLookupExpression;
  var createMixin = ParseTreeFactory.createMixin;
  var createMixinResolveList = ParseTreeFactory.createMixinResolveList;
  var createNewExpression = ParseTreeFactory.createNewExpression;
  var createObjectLiteralExpression = ParseTreeFactory.createObjectLiteralExpression;
  var createObjectPattern = ParseTreeFactory.createObjectPattern;
  var createObjectPatternField = ParseTreeFactory.createObjectPatternField;
  var createParenExpression = ParseTreeFactory.createParenExpression;
  var createPostfixExpression = ParseTreeFactory.createPostfixExpression;
  var createPropertyNameAssignment = ParseTreeFactory.createPropertyNameAssignment;
  var createReturnStatement = ParseTreeFactory.createReturnStatement;
  var createSetAccessor = ParseTreeFactory.createSetAccessor;
  var createSpreadExpression = ParseTreeFactory.createSpreadExpression;
  var createSpreadPatternElement = ParseTreeFactory.createSpreadPatternElement;
  var createSwitchStatement = ParseTreeFactory.createSwitchStatement;
  var createThrowStatement = ParseTreeFactory.createThrowStatement;
  var createTraitDeclaration = ParseTreeFactory.createTraitDeclaration;
  var createTryStatement = ParseTreeFactory.createTryStatement;
  var createUnaryExpression = ParseTreeFactory.createUnaryExpression;
  var createVariableDeclaration = ParseTreeFactory.createVariableDeclaration;
  var createVariableDeclarationList = ParseTreeFactory.createVariableDeclarationList;
  var createVariableStatement = ParseTreeFactory.createVariableStatement;
  var createWhileStatement = ParseTreeFactory.createWhileStatement;
  var createWithStatement = ParseTreeFactory.createWithStatement;
  var createYieldStatement = ParseTreeFactory.createYieldStatement;

  var AwaitStatement = traceur.syntax.trees.AwaitStatement;
  var ExportDeclaration = traceur.syntax.trees.ExportDeclaration;
  var ExportPathList = traceur.syntax.trees.ExportPathList;
  var ExportPath = traceur.syntax.trees.ExportPath;
  var ExportPathSpecifierSet = traceur.syntax.trees.ExportPathSpecifierSet;
  var ExportPathSpecifier = traceur.syntax.trees.ExportPathSpecifier;
  var ExportSpecifier = traceur.syntax.trees.ExportSpecifier;
  var ExportSpecifierSet = traceur.syntax.trees.ExportSpecifierSet;
  var ImportDeclaration = traceur.syntax.trees.ImportDeclaration;
  var ImportPath = traceur.syntax.trees.ImportPath;
  var ModuleDeclaration = traceur.syntax.trees.ModuleDeclaration;
  var ModuleDefinition = traceur.syntax.trees.ModuleDefinition;
  var ModuleExpression = traceur.syntax.trees.ModuleExpression;
  var ModuleSpecifier = traceur.syntax.trees.ModuleSpecifier;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var Program = traceur.syntax.trees.Program;
  var QualifiedReference = traceur.syntax.trees.QualifiedReference;

  var getTreeNameForType = traceur.syntax.trees.getTreeNameForType;

  /**
   * A base class for transforming parse trees.
   *
   * The ParseTreeTransformer walks every node and gives derived classes the opportunity
   * (but not the obligation) to transform every node in a tree. By default the ParseTreeTransformer
   * performs the identity transform.
   */
  function ParseTreeTransformer() {}

  ParseTreeTransformer.prototype = {

    /**
     * @param {ParseTree} tree
     * @return {ParseTree}
     */
    transformAny: function(tree) {
      if (tree == null) {
        return null;
      }

      var name = getTreeNameForType(tree.type);
      return this['transform' + name](tree);
    },

    /**
     * @param {Array.<ParseTree>} list
     * @return {Array.<ParseTree>}
     */
    transformList: function(list) {
      if (list == null || list.length == 0) {
        return list;
      }

      var builder = null;

      for (var index = 0; index < list.length; index++) {
        var element = list[index];
        var transformed = this.transformAny(element);

        if (builder != null || element != transformed) {
          if (builder == null) {
            builder = list.slice(0, index);
          }
          builder.push(transformed);
        }
      }

      return builder || list;
    },

    /**
     * @param {ParseTree} tree
     * @return {ParseTree}
     */
    toSourceElement: function(tree) {
      return tree.isSourceElement() ? tree : createExpressionStatement(tree);
    },

    /**
     * @param {Array.<ParseTree>} list
     * @return {Array.<ParseTree>}
     */
    transformSourceElements: function(list) {
      if (list == null || list.length == 0) {
        return list;
      }

      var builder = null;

      for (var index = 0; index < list.length; index++) {
        var element = list[index];
        var transformed = this.toSourceElement(this.transformAny(element));

        if (builder != null || element != transformed) {
          if (builder == null) {
            builder = list.slice(0, index);
          }
          builder.push(transformed);
        }
      }

      return builder || list;
    },

    /**
     * @param {ArgumentList} tree
     * @return {ParseTree}
     */
    transformArgumentList: function(tree) {
      var args = this.transformList(tree.args);
      if (args == tree.args) {
        return tree;
      }
      return createArgumentList(args);
    },

    /**
     * @param {ArrayLiteralExpression} tree
     * @return {ParseTree}
     */
    transformArrayLiteralExpression: function(tree) {
      var elements = this.transformList(tree.elements);
      if (elements == tree.elements) {
        return tree;
      }
      return createArrayLiteralExpression(elements);
    },

    /**
     * @param {ArrayPattern} tree
     * @return {ParseTree}
     */
    transformArrayPattern: function(tree) {
      var elements = this.transformList(tree.elements);
      if (elements == tree.elements) {
        return tree;
      }
      return createArrayPattern(elements);
    },

    /**
     * @param {AwaitStatement} tree
     * @return {ParseTree}
     */
    transformAwaitStatement: function(tree) {
      var expression = this.transformAny(tree.expression);
      if (tree.expression == expression) {
        return tree;
      }
      return new AwaitStatement(null, tree.identifier, expression);
    },

    /**
     * @param {BinaryOperator} tree
     * @return {ParseTree}
     */
    transformBinaryOperator: function(tree) {
      var left = this.transformAny(tree.left);
      var right = this.transformAny(tree.right);
      if (left == tree.left && right == tree.right) {
        return tree;
      }
      return createBinaryOperator(left, tree.operator, right);
    },

    /**
     * @param {Block} tree
     * @return {ParseTree}
     */
    transformBlock: function(tree) {
      var elements = this.transformList(tree.statements);
      if (elements == tree.statements) {
        return tree;
      }
      return createBlock(elements);
    },

    /**
     * @param {BreakStatement} tree
     * @return {ParseTree}
     */
    transformBreakStatement: function(tree) {
      return tree;
    },

    /**
     * @param {CallExpression} tree
     * @return {ParseTree}
     */
    transformCallExpression: function(tree) {
      var operand = this.transformAny(tree.operand);
      var args = this.transformAny(tree.args);
      if (operand == tree.operand && args == tree.args) {
        return tree;
      }
      return createCallExpression(operand, args);
    },

    /**
     * @param {CaseClause} tree
     * @return {ParseTree}
     */
    transformCaseClause: function(tree) {
      var expression = this.transformAny(tree.expression);
      var statements = this.transformList(tree.statements);
      if (expression == tree.expression && statements == tree.statements) {
        return tree;
      }
      return createCaseClause(expression, statements);
    },

    /**
     * @param {Catch} tree
     * @return {ParseTree}
     */
    transformCatch: function(tree) {
      var catchBody = this.transformAny(tree.catchBody);
      if (catchBody == tree.catchBody) {
        return tree;
      }
      return createCatch(tree.exceptionName, catchBody);
    },

    /**
     * @param {ClassDeclaration} tree
     * @return {ParseTree}
     */
    transformClassDeclaration: function(tree) {
      var superClass = this.transformAny(tree.superClass);
      var elements = this.transformList(tree.elements);

      if (superClass == tree.superClass && elements == tree.elements) {
        return tree;
      }
      return createClassDeclaration(tree.name, superClass, elements);
    },

    /**
     * @param {ClassExpression} tree
     * @return {ParseTree}
     */
    transformClassExpression: function(tree) {
      return tree;
    },

    /**
     * @param {CommaExpression} tree
     * @return {ParseTree}
     */
    transformCommaExpression: function(tree) {
      var expressions = this.transformList(tree.expressions);
      if (expressions == tree.expressions) {
        return tree;
      }
      return createCommaExpression(expressions);
    },

    /**
     * @param {ConditionalExpression} tree
     * @return {ParseTree}
     */
    transformConditionalExpression: function(tree) {
      var condition = this.transformAny(tree.condition);
      var left = this.transformAny(tree.left);
      var right = this.transformAny(tree.right);
      if (condition == tree.condition && left == tree.left && right == tree.right) {
        return tree;
      }
      return createConditionalExpression(condition, left, right);
    },

    /**
     * @param {ContinueStatement} tree
     * @return {ParseTree}
     */
    transformContinueStatement: function(tree) {
      return tree;
    },

    /**
     * @param {DebuggerStatement} tree
     * @return {ParseTree}
     */
    transformDebuggerStatement: function(tree) {
      return tree;
    },

    /**
     * @param {DefaultClause} tree
     * @return {ParseTree}
     */
    transformDefaultClause: function(tree) {
      var statements = this.transformList(tree.statements);
      if (statements == tree.statements) {
        return tree;
      }
      return createDefaultClause(statements);
    },

    /**
     * @param {DefaultParameter} tree
     * @return {ParseTree}
     */
    transformDefaultParameter: function(tree) {
      var expression = this.transformAny(tree.expression);
      if (expression == tree.expression) {
        return tree;
      }
      return createDefaultParameter(tree.identifier, expression);
    },

    /**
     * @param {DoWhileStatement} tree
     * @return {ParseTree}
     */
    transformDoWhileStatement: function(tree) {
      var body = this.transformAny(tree.body);
      var condition = this.transformAny(tree.condition);
      if (body == tree.body && condition == tree.condition) {
        return tree;
      }
      return createDoWhileStatement(body, condition);
    },

    /**
     * @param {EmptyStatement} tree
     * @return {ParseTree}
     */
    transformEmptyStatement: function(tree) {
      return tree;
    },

    /**
     * @param {ExportDeclaration} tree
     * @return {ParseTree}
     */
    transformExportDeclaration: function(tree) {
      var declaration = this.transformAny(tree.declaration);
      if (tree.declaration == declaration) {
        return tree;
      }
      return new ExportDeclaration(null, declaration);
    },

    /**
     * @param {ExportPathList} tree
     * @return {ParseTree}
     */
    transformExportPathList: function(tree) {
      var paths = this.transformList(tree.paths);
      if (paths == tree.paths) {
        return tree;
      }

      return new ExportPathList(null, paths);
    },

    /**
     * @param {ExportPath} tree
     * @return {ParseTree}
     */
    transformExportPath: function(tree) {
      var moduleExpresion = this.transformAny(tree.moduleExpresion);
      var specifier = this.transformAny(tree.specifier);
      if (moduleExpresion == tree.moduleExpresion &&
          specifier == tree.specifier) {
        return tree;
      }
      return new ExportPath(null, moduleExpresion, specifier);
    },

    /**
     * @param {ExportSpecifier} tree
     * @return {ParseTree}
     */
    transformExportSpecifier: function(tree) {
      return tree;
    },

    /**
     * @param {ExportSpecifierSet} tree
     * @return {ParseTree}
     */
    transformExportSpecifierSet: function(tree) {
      var specifiers = this.transformList(tree.specifiers);
      if (specifiers == tree.specifiers) {
        return tree;
      }

      return new ExportSpecifierSet(null, specifiers);
    },

    /**
     * @param {ExportPathSpecifierSet} tree
     * @return {ParseTree}
     */
    transformExportPathSpecifierSet: function(tree) {
      var specifiers = this.transformList(tree.specifiers);
      if (specifiers == tree.specifiers) {
        return tree;
      }

      return new ExportPathSpecifierSet(null, specifiers);
    },

    /**
     * @param {ExportPathSpecifier} tree
     * @return {ParseTree}
     */
    transformExportPathSpecifier: function(tree) {
      return tree;
    },

    /**
     * @param {ExpressionStatement} tree
     * @return {ParseTree}
     */
    transformExpressionStatement: function(tree) {
      var expression = this.transformAny(tree.expression);
      if (expression == tree.expression) {
        return tree;
      }
      return createExpressionStatement(expression);
    },

    /**
     * @param {FieldDeclaration} tree
     * @return {ParseTree}
     */
    transformFieldDeclaration: function(tree) {
      var declarations = this.transformList(tree.declarations);
      if (declarations == tree.declarations) {
        return tree;
      }
      return createFieldDeclaration(tree.isStatic, tree.isConst, declarations);
    },

    /**
     * @param {Finally} tree
     * @return {ParseTree}
     */
    transformFinally: function(tree) {
      var block = this.transformAny(tree.block);
      if (block == tree.block) {
        return tree;
      }
      return createFinally(block);
    },

    /**
     * @param {ForEachStatement} tree
     * @return {ParseTree}
     */
    transformForEachStatement: function(tree) {
      var initializer = this.transformAny(tree.initializer);
      var collection = this.transformAny(tree.collection);
      var body = this.transformAny(tree.body);
      if (initializer == tree.initializer && collection == tree.collection &&
          body == tree.body) {
        return tree;
      }
      return createForEachStatement(initializer,
                                    collection, body);
    },

    /**
     * @param {ForInStatement} tree
     * @return {ParseTree}
     */
    transformForInStatement: function(tree) {
      var initializer = this.transformAny(tree.initializer);
      var collection = this.transformAny(tree.collection);
      var body = this.transformAny(tree.body);
      if (initializer == tree.initializer && collection == tree.collection &&
          body == tree.body) {
        return tree;
      }
      return createForInStatement(initializer, collection, body);
    },

    /**
     * @param {ForStatement} tree
     * @return {ParseTree}
     */
    transformForStatement: function(tree) {
      var initializer = this.transformAny(tree.initializer);
      var condition = this.transformAny(tree.condition);
      var increment = this.transformAny(tree.increment);
      var body = this.transformAny(tree.body);
      if (initializer == tree.initializer && condition == tree.condition &&
          increment == tree.increment && body == tree.body) {
        return tree;
      }
      return createForStatement(initializer, condition, increment, body);
    },

    /**
     * @param {FormalParameterList} tree
     * @return {ParseTree}
     */
    transformFormalParameterList: function(tree) {
      return tree;
    },

    /**
     * @param {FunctionDeclaration} tree
     * @return {ParseTree}
     */
    transformFunctionDeclaration: function(tree) {
      var parameters =
          this.transformAny(tree.formalParameterList);
      var functionBody = this.transformAny(tree.functionBody);
      if (parameters == tree.formalParameterList &&
          functionBody == tree.functionBody) {
        return tree;
      }
      return createFunctionDeclaration(tree.name, parameters, functionBody);
    },

    /**
     * @param {GetAccessor} tree
     * @return {ParseTree}
     */
    transformGetAccessor: function(tree) {
      var body = this.transformAny(tree.body);
      if (body == tree.body) {
        return tree;
      }
      return createGetAccessor(tree.propertyName, tree.isStatic, body);
    },

    /**
     * @param {IdentifierExpression} tree
     * @return {ParseTree}
     */
    transformIdentifierExpression: function(tree) {
      return tree;
    },

    /**
     * @param {IfStatement} tree
     * @return {ParseTree}
     */
    transformIfStatement: function(tree) {
      var condition = this.transformAny(tree.condition);
      var ifClause = this.transformAny(tree.ifClause);
      var elseClause = this.transformAny(tree.elseClause);
      if (condition == tree.condition && ifClause == tree.ifClause && elseClause == tree.elseClause) {
        return tree;
      }
      return createIfStatement(condition, ifClause, elseClause);
    },

    /**
     * @param {ImportDeclaration} tree
     * @return {ParseTree}
     */
    transformImportDeclaration: function(tree) {
      var importPathList = this.transformList(tree.importPathList);
      if (importPathList == tree.importPathList) {
        return tree;
      }
      return new ImportDeclaration(null, importPathList);
    },

    /**
     * @param {ImportPath} tree
     * @return {ParseTree}
     */
    transformImportPath: function(tree) {
      if (tree.importSpecifierSet != null) {
        var importSpecifierSet = this.transformList(tree.importSpecifierSet);
        if (importSpecifierSet != tree.importSpecifierSet) {
          return new ImportPath(null, tree.qualifiedPath,
              importSpecifierSet);
        }
      }

      return tree;
    },

    /**
     * @param {ImportSpecifier} tree
     * @return {ParseTree}
     */
    transformImportSpecifier: function(tree) {
      return tree;
    },

    /**
     * @param {LabelledStatement} tree
     * @return {ParseTree}
     */
    transformLabelledStatement: function(tree) {
      var statement = this.transformAny(tree.statement);
      if (statement == tree.statement) {
        return tree;
      }
      return createLabelledStatement(tree.name, statement);
    },

    /**
     * @param {LiteralExpression} tree
     * @return {ParseTree}
     */
    transformLiteralExpression: function(tree) {
      return tree;
    },

    /**
     * @param {MemberExpression} tree
     * @return {ParseTree}
     */
    transformMemberExpression: function(tree) {
      var operand = this.transformAny(tree.operand);
      if (operand == tree.operand) {
        return tree;
      }
      return createMemberExpression(operand, tree.memberName);
    },

    /**
     * @param {MemberLookupExpression} tree
     * @return {ParseTree}
     */
    transformMemberLookupExpression: function(tree) {
      var operand = this.transformAny(tree.operand);
      var memberExpression = this.transformAny(tree.memberExpression);
      if (operand == tree.operand &&
          memberExpression == tree.memberExpression) {
        return tree;
      }
      return createMemberLookupExpression(operand, memberExpression);
    },

    /**
     * @param {MissingPrimaryExpression} tree
     * @return {ParseTree}
     */
    transformMissingPrimaryExpression: function(tree) {
      throw new Error('Should never transform trees that had errors during parse');
    },

    /**
     * @param {Mixin} tree
     * @return {ParseTree}
     */
    transformMixin: function(tree) {
      var mixinResolves = this.transformAny(tree.mixinResolves);
      if (mixinResolves == tree.mixinResolves) {
        return tree;
      }
      return createMixin(tree.name, mixinResolves);
    },

    /**
     * @param {MixinResolve} tree
     * @return {ParseTree}
     */
    transformMixinResolve: function(tree) {
      return tree;
    },

    /**
     * @param {MixinResolveList} tree
     * @return {ParseTree}
     */
    transformMixinResolveList: function(tree) {
      var resolves = this.transformList(tree.resolves);
      if (resolves == tree.resolves) {
        return tree;
      }
      return createMixinResolveList(resolves);
    },

    /**
     * @param {ModuleDeclaration} tree
     * @return {ParseTree}
     */
    transformModuleDeclaration: function(tree) {
      var specifiers = this.transformList(tree.specifiers);
      if (specifiers == tree.specifiers) {
        return tree;
      }

      return new ModuleDeclaration(null, specifiers);
    },

    /**
     * @param {ModuleDefinition} tree
     * @return {ParseTree}
     */
    transformModuleDefinition: function(tree) {
      var elements = this.transformList(tree.elements);
      if (elements == tree.elements) {
        return tree;
      }

      return new ModuleDefinition(null, tree.name, elements);
    },

    /**
     * @param {ModuleExpression} tree
     * @return {ParseTree}
     */
    transformModuleExpression: function(tree) {
      var reference = this.transformAny(tree.reference);
      if (reference == tree.reference) {
        return tree;
      }
      return new ModuleExpression(null, reference, tree.identifiers);
    },

    /**
     * @param {ModuleRequire} tree
     * @return {ParseTree}
     */
    transformModuleRequire: function(tree) {
      return tree;
    },

    /**
     * @param {ModuleSpecifier} tree
     * @return {ParseTree}
     */
    transformModuleSpecifier: function(tree) {
      var expression = this.transformAny(tree.expression);
      if (expression == tree.expression) {
        return tree;
      }
      return new ModuleSpecifier(null, tree.identifier, expression);
    },

    /**
     * @param {NewExpression} tree
     * @return {ParseTree}
     */
    transformNewExpression: function(tree) {
      var operand = this.transformAny(tree.operand);
      var args = this.transformAny(tree.args);

      if (operand == tree.operand && args == tree.args) {
        return tree;
      }
      return createNewExpression(operand, args);
    },

    /**
     * @param {NullTree} tree
     * @return {ParseTree}
     */
    transformNullTree: function(tree) {
      return tree;
    },

    /**
     * @param {ObjectLiteralExpression} tree
     * @return {ParseTree}
     */
    transformObjectLiteralExpression: function(tree) {
      var propertyNameAndValues = this.transformList(tree.propertyNameAndValues);
      if (propertyNameAndValues == tree.propertyNameAndValues) {
        return tree;
      }
      return createObjectLiteralExpression(propertyNameAndValues);
    },

    /**
     * @param {ObjectPattern} tree
     * @return {ParseTree}
     */
    transformObjectPattern: function(tree) {
      var fields = this.transformList(tree.fields);
      if (fields == tree.fields) {
        return tree;
      }
      return createObjectPattern(fields);
    },

    /**
     * @param {ObjectPatternField} tree
     * @return {ParseTree}
     */
    transformObjectPatternField: function(tree) {
      var element = this.transformAny(tree.element);
      if (element == tree.element) {
        return tree;
      }
      return createObjectPatternField(tree.identifier, element);
    },

    /**
     * @param {ParenExpression} tree
     * @return {ParseTree}
     */
    transformParenExpression: function(tree) {
      var expression = this.transformAny(tree.expression);
      if (expression == tree.expression) {
        return tree;
      }
      return createParenExpression(expression);
    },

    /**
     * @param {PostfixExpression} tree
     * @return {ParseTree}
     */
    transformPostfixExpression: function(tree) {
      var operand = this.transformAny(tree.operand);
      if (operand == tree.operand) {
        return tree;
      }
      return createPostfixExpression(operand, tree.operator);
    },

    /**
     * @param {Program} tree
     * @return {ParseTree}
     */
    transformProgram: function(tree) {
      var elements = this.transformList(tree.programElements);
      if (elements == tree.programElements) {
        return tree;
      }
      return new Program(null, elements);
    },

    /**
     * @param {PropertyNameAssignment} tree
     * @return {ParseTree}
     */
    transformPropertyNameAssignment: function(tree) {
      var value = this.transformAny(tree.value);
      if (value == tree.value) {
        return tree;
      }
      return createPropertyNameAssignment(tree.name, value);
    },

    /**
     * @param {QualifiedReference} tree
     * @return {ParseTree}
     */
    transformQualifiedReference: function(tree) {
      var moduleExpression = this.transformAny(tree.moduleExpression);
      if (moduleExpression == tree.moduleExpression) {
        return tree;
      }
      return new QualifiedReference(null, moduleExpression, tree.identifier);
    },

    /**
     * @param {RequiresMember} tree
     * @return {ParseTree}
     */
    transformRequiresMember: function(tree) {
      return tree;
    },

    /**
     * @param {RestParameter} tree
     * @return {ParseTree}
     */
    transformRestParameter: function(tree) {
      return tree;
    },

    /**
     * @param {ReturnStatement} tree
     * @return {ParseTree}
     */
    transformReturnStatement: function(tree) {
      var expression = this.transformAny(tree.expression);
      if (expression == tree.expression) {
        return tree;
      }
      return createReturnStatement(expression);
    },

    /**
     * @param {SetAccessor} tree
     * @return {ParseTree}
     */
    transformSetAccessor: function(tree) {
      var body = this.transformAny(tree.body);
      if (body == tree.body) {
        return tree;
      }
      return createSetAccessor(tree.propertyName, tree.isStatic, tree.parameter, body);
    },

    /**
     * @param {SpreadExpression} tree
     * @return {ParseTree}
     */
    transformSpreadExpression: function(tree) {
      var expression = this.transformAny(tree.expression);
      if (expression == tree.expression) {
        return tree;
      }
      return createSpreadExpression(expression);
    },

    /**
     * @param {SpreadPatternElement} tree
     * @return {ParseTree}
     */
    transformSpreadPatternElement: function(tree) {
      var lvalue = this.transformAny(tree.lvalue);
      if (lvalue == tree.lvalue) {
        return tree;
      }
      return createSpreadPatternElement(lvalue);
    },

    /**
     * @param {StateMachine} tree
     * @return {ParseTree}
     */
    transformStateMachine: function(tree) {
      throw new Error();
    },

    /**
     * @param {SuperExpression} tree
     * @return {ParseTree}
     */
    transformSuperExpression: function(tree) {
      return tree;
    },

    /**
     * @param {SwitchStatement} tree
     * @return {ParseTree}
     */
    transformSwitchStatement: function(tree) {
      var expression = this.transformAny(tree.expression);
      var caseClauses = this.transformList(tree.caseClauses);
      if (expression == tree.expression && caseClauses == tree.caseClauses) {
        return tree;
      }
      return createSwitchStatement(expression, caseClauses);
    },

    /**
     * @param {ThisExpression} tree
     * @return {ParseTree}
     */
    transformThisExpression: function(tree) {
      return tree;
    },

    /**
     * @param {ThrowStatement} tree
     * @return {ParseTree}
     */
    transformThrowStatement: function(tree) {
      var value = this.transformAny(tree.value);
      if (value == tree.value) {
        return tree;
      }
      return createThrowStatement(value);
    },

    /**
     * @param {TraitDeclaration} tree
     * @return {ParseTree}
     */
    transformTraitDeclaration: function(tree) {
      var elements = this.transformList(tree.elements);
      if (elements == tree.elements) {
        return tree;
      }
      return createTraitDeclaration(tree.name, elements);
    },

    /**
     * @param {TryStatement} tree
     * @return {ParseTree}
     */
    transformTryStatement: function(tree) {
      var body = this.transformAny(tree.body);
      var catchBlock = this.transformAny(tree.catchBlock);
      var finallyBlock = this.transformAny(tree.finallyBlock);
      if (body == tree.body && catchBlock == tree.catchBlock &&
          finallyBlock == tree.finallyBlock) {
        return tree;
      }
      return createTryStatement(body, catchBlock, finallyBlock);
    },

    /**
     * @param {UnaryExpression} tree
     * @return {ParseTree}
     */
    transformUnaryExpression: function(tree) {
      var operand = this.transformAny(tree.operand);
      if (operand == tree.operand) {
        return tree;
      }
      return createUnaryExpression(tree.operator, operand);
    },

    /**
     * @param {VariableDeclaration} tree
     * @return {ParseTree}
     */
    transformVariableDeclaration: function(tree) {
      var lvalue = this.transformAny(tree.lvalue);
      var initializer = this.transformAny(tree.initializer);
      if (lvalue == tree.lvalue && initializer == tree.initializer) {
        return tree;
      }
      return createVariableDeclaration(lvalue, initializer);
    },

    /**
     * @param {VariableDeclarationList} tree
     * @return {ParseTree}
     */
    transformVariableDeclarationList: function(tree) {
      var declarations = this.transformList(tree.declarations);
      if (declarations == tree.declarations) {
        return tree;
      }
      return createVariableDeclarationList(tree.declarationType, declarations);
    },

    /**
     * @param {VariableStatement} tree
     * @return {ParseTree}
     */
    transformVariableStatement: function(tree) {
      var declarations = this.transformAny(tree.declarations);
      if (declarations == tree.declarations) {
        return tree;
      }
      return createVariableStatement(declarations);
    },

    /**
     * @param {WhileStatement} tree
     * @return {ParseTree}
     */
    transformWhileStatement: function(tree) {
      var condition = this.transformAny(tree.condition);
      var body = this.transformAny(tree.body);
      if (condition == tree.condition && body == tree.body) {
        return tree;
      }
      return createWhileStatement(condition, body);
    },

    /**
     * @param {WithStatement} tree
     * @return {ParseTree}
     */
    transformWithStatement: function(tree) {
      var expression = this.transformAny(tree.expression);
      var body = this.transformAny(tree.body);
      if (expression == tree.expression && body == tree.body) {
        return tree;
      }
      return createWithStatement(expression, body);
    },

    /**
     * @param {YieldStatement} tree
     * @return {ParseTree}
     */
    transformYieldStatement: function(tree) {
      var expression = this.transformAny(tree.expression);
      var isYieldFor = tree.isYieldFor;
      if (expression == tree.expression) {
        return tree;
      }
      return createYieldStatement(expression, isYieldFor);
    }
  };

  return {
    ParseTreeTransformer: ParseTreeTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var VariableBinder = traceur.semantics.VariableBinder;
  var variablesInFunction = VariableBinder.variablesInFunction;
  var variablesInBlock = VariableBinder.variablesInBlock;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var PredefinedName = traceur.syntax.PredefinedName;
  var Block = traceur.syntax.trees.Block;
  var Catch = traceur.syntax.trees.Catch;
  var FunctionDeclaration = traceur.syntax.trees.FunctionDeclaration;
  var IdentifierExpression = traceur.syntax.trees.IdentifierExpression;
  var ParseTree = traceur.syntax.trees.ParseTree;

  /**
   * Replaces one identifier with another identifier (alpha
   * renaming). This transformation is safe to use for renaming a
   * declared variable ({@code var}, {@code const} or {@code let}) or
   * formal parameter, if the variable's scope isn't dynamically limited
   * using the {@code with} statement, nor its name observed with
   * {@code eval} or in a property binding, and so on.
   *
   * Creates an {@code AlphaRenamer} that will replace uses of the
   * identifier {@code oldName} with {@code newName}.
   *
   * @param {string} oldName
   * @param {string} newName
   * @extends {ParseTreeTransformer}
   * @constructor
   */
  function AlphaRenamer(oldName, newName) {
    ParseTreeTransformer.call(this);
    this.oldName_ = oldName;
    this.newName_ = newName;
    Object.freeze(this);
  }

  /**
   * Alpha-renames {@code oldName} to {@code newName} in {@code tree}
   * and returns the new {@code ParseTree}.
   *
   * <p>Renaming is applied throughout the lexical scope of the
   * variable. If the old name is freshly bound alpha-renaming doesn't
   * propagate there; for example, renaming {@code "a"} to {@code "b"}
   * in the following program:
   *
   * <pre>
   * function a(a) {
   *   ...
   * }
   * </pre>
   * Will produce:
   * <pre>
   * function b(a) {
   *   ...
   * }
   * </pre>
   *
   * @param {ParseTree} tree the tree to substitute names in.
   * @param {string} oldName the identifier to be replaced.
   * @param {string} newName the identifier that will appear instead of {@code oldName}.
   * @return {ParseTree} a copy of {@code tree} with replacements.
   */
  AlphaRenamer.rename = function(tree, oldName, newName) {
    return new AlphaRenamer(oldName, newName).transformAny(tree);
  };

  var proto = ParseTreeTransformer.prototype;
  traceur.inherits(AlphaRenamer, ParseTreeTransformer, {
    __proto__: proto,

    /**
     * @param {Block} tree
     * @return {ParseTree}
     */
    transformBlock: function(tree) {
      if (this.oldName_ in variablesInBlock(tree)) {
        // the old name is bound in the block, skip rename
        return tree;
      } else {
        return proto.transformBlock.call(this, tree);
      }
    },

    /**
     * @param {IdentifierExpression} tree
     * @return {ParseTree}
     */
    transformIdentifierExpression: function(tree) {
      if (this.oldName_ == tree.identifierToken.value) {
        return createIdentifierExpression(this.newName_);
      } else {
        return tree;
      }
    },

    /**
     * @param {FunctionDeclaration} tree
     * @return {ParseTree}
     */
    transformFunctionDeclaration: function(tree) {
      if (this.oldName_ == tree.name) {
        // it is the function that is being renamed
        tree = createFunctionDeclaration(this.newName_,
            tree.formalParameterList, tree.functionBody);
      }

      if (// this.oldName_ is rebound in the new nested scope, so don't recurse
          this.oldName_ in variablesInFunction(tree) ||
          // 'arguments' is implicitly bound in function bodies; don't recurse
          PredefinedName.ARGUMENTS == this.oldName_) {
        return tree;
      } else {
        return proto.transformFunctionDeclaration.call(this, tree);
      }
    },

    /**
     * @param {Catch} tree
     * @return {ParseTree}
     */
    transformCatch: function(tree) {
      if (this.oldName_ == tree.exceptionName.value) {
        // this.oldName_ is rebound in the catch block, so don't recurse
        return tree;
      } else {
        return proto.transformCatch.call(this, tree);
      }
    }
  });

  return {
    AlphaRenamer: AlphaRenamer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var AlphaRenamer = traceur.codegeneration.AlphaRenamer;

  var PredefinedName = traceur.syntax.PredefinedName;
  var TokenType = traceur.syntax.TokenType;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var ArrayPattern = traceur.syntax.trees.ArrayPattern;
  var BinaryOperator = traceur.syntax.trees.BinaryOperator;
  var ObjectPatternField = traceur.syntax.trees.ObjectPatternField;
  var ObjectPattern = traceur.syntax.trees.ObjectPattern;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var VariableDeclarationList = traceur.syntax.trees.VariableDeclarationList;
  var VariableDeclaration = traceur.syntax.trees.VariableDeclaration;

  var createArgumentList = ParseTreeFactory.createArgumentList;
  var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
  var createBlock = ParseTreeFactory.createBlock;
  var createCallCall = ParseTreeFactory.createCallCall;
  var createCallExpression = ParseTreeFactory.createCallExpression;
  var createFunctionExpression = ParseTreeFactory.createFunctionExpression;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createMemberLookupExpression = ParseTreeFactory.createMemberLookupExpression;
  var createNumberLiteral = ParseTreeFactory.createNumberLiteral;
  var createParameterList = ParseTreeFactory.createParameterList;
  var createParameterReference = ParseTreeFactory.createParameterReference;
  var createParenExpression = ParseTreeFactory.createParenExpression;
  var createReturnStatement = ParseTreeFactory.createReturnStatement;
  var createThisExpression = ParseTreeFactory.createThisExpression;
  var createVariableDeclaration = ParseTreeFactory.createVariableDeclaration;
  var createVariableDeclarationList = ParseTreeFactory.createVariableDeclarationList;

  /**
   * Collects assignments in the desugaring of a pattern.
   * @param {ParseTree} rvalue
   * @constructor
   */
  function Desugaring(rvalue) {
    this.rvalue = rvalue;
  }

  /**
   * Collects assignments as assignment statements. This is the
   * desugaring for assignment statements.
   * @param {ParseTree} rvalue
   * @constructor
   * @extends {Desugaring}
   */
  function AssignmentStatementDesugaring(rvalue) {
    Desugaring.call(this, rvalue);
    this.statements = [];
  }
  traceur.inherits(AssignmentStatementDesugaring, Desugaring, {
    __proto__: Desugaring.prototype,
    assign: function(lvalue, rvalue) {
      this.statements.push(createAssignmentStatement(lvalue, rvalue));
    }
  });

  /**
   * Collects assignments as variable declarations. This is the
   * desugaring for 'var', 'const' declarations.
   * @param {ParseTree} rvalue
   * @constructor
   * @extends {Desugaring}
   */
  function VariableDeclarationDesugaring(rvalue) {
    Desugaring.call(this, rvalue);
    this.declarations = [];
  }
  traceur.inherits(VariableDeclarationDesugaring, Desugaring, {
    __proto__: Desugaring.prototype,
    assign: function(lvalue, rvalue) {
      this.declarations.push(createVariableDeclaration(lvalue, rvalue));
    }
  });

  /**
   * Desugars destructuring assignment.
   *
   * @see <a href="http://wiki.ecmascript.org/doku.php?id=harmony:destructuring#assignments">harmony:destructuring</a>
   * @constructor
   * @extends {ParseTreeTransformer}
   */
  function DestructuringTransformer() {
  }

  /**
   * @param {ParseTree} tree
   * @return {ParseTree}
   */
  DestructuringTransformer.transformTree = function(tree) {
    return new DestructuringTransformer().transformAny(tree);
  };

  var proto = ParseTreeTransformer.prototype;
  traceur.inherits(DestructuringTransformer, ParseTreeTransformer, {
    __proto__: proto,

    /**
     * @param {ArrayPattern} tree
     * @return {ParseTree}
     */
    transformArrayPattern: function(tree) {
      // Patterns should be desugared by their parent nodes.
      throw new Error('unreachable');
    },

    /**
     * @param {ObjectPattern} tree
     * @return {ParseTree}
     */
    transformObjectPattern: function(tree) {
      // Patterns should be desugard by their parent nodes.
      throw new Error('unreachable');
    },

    /**
     * Transforms:
     *   [a, [b, c]] = x
     * From an assignment expression into:
     *   (function (rvalue) {
     *     a = rvalue[0];
     *     [b, c] = rvalue[1];
     *   }).call(this, x);
     *
     * Nested patterns are desugared by recursive calls to transform.
     *
     * @param {BinaryOperator} tree
     * @return {ParseTree}
     */
    transformBinaryOperator: function(tree) {
      if (tree.operator.type == TokenType.EQUAL && tree.left.isPattern()) {
        return this.transformAny(this.desugarAssignment_(tree.left, tree.right));
      } else {
        return proto.transformBinaryOperator.call(this, tree);
      }
    },

    /**
     * @param {ParseTree} lvalue
     * @param {ParseTree} rvalue
     * @return {ParseTree}
     */
    desugarAssignment_: function(lvalue, rvalue) {
      var desugaring =
          new AssignmentStatementDesugaring(createParameterReference(0));
      this.desugarPattern_(desugaring, lvalue);
      desugaring.statements.push(createReturnStatement(desugaring.rvalue));

      var func = createFunctionExpression(
          createParameterList(
              PredefinedName.getParameterName(0),
              PredefinedName.CAPTURED_ARGUMENTS),
          AlphaRenamer.rename(
              createBlock(desugaring.statements),
              PredefinedName.ARGUMENTS,
              PredefinedName.CAPTURED_ARGUMENTS));

      return createCallCall(
          createParenExpression(func),
          createThisExpression(),
          rvalue,
          createIdentifierExpression(PredefinedName.ARGUMENTS));
    },

    /**
     * Transforms:
     *   [a, [b, c]] = x
     * From a variable declaration list into:
     *   tmp = x, a = x[0], [b, c] = x[1]
     *
     * We do it this way (as opposed to a block with a declaration and
     * initialization statements) so that we can translate const
     * declarations, which must be initialized at declaration.
     *
     * Nested patterns are desugared by recursive calls to transform.
     *
     * @param {VariableDeclarationList} tree
     * @return {ParseTree}
     */
    transformVariableDeclarationList: function(tree) {
      if (!this.destructuringInDeclaration_(tree)) {
        // No lvalues to desugar.
        return proto.transformVariableDeclarationList.call(this, tree);
      }

      // Desugar one level of patterns.
      var desugaredDeclarations = [];
      tree.declarations.forEach(function(declaration) {
        if (declaration.lvalue.isPattern()) {
          desugaredDeclarations.push.apply(desugaredDeclarations,
              this.desugarVariableDeclaration_(declaration));
        } else {
          desugaredDeclarations.push(declaration);
        }
      }, this);

      // Desugar more.
      return this.transformVariableDeclarationList(
          createVariableDeclarationList(
              tree.declarationType,
              desugaredDeclarations));
    },

    /**
     * @param {VariableDeclarationList} tree
     * @return {boolean}
     */
    destructuringInDeclaration_: function(tree) {
      return tree.declarations.some(function(declaration) {
        return declaration.lvalue.isPattern();
      });
    },

    /**
     * @param {VariableDeclaration} tree
     * @return {Array.<VariableDeclaration>}
     */
    desugarVariableDeclaration_: function(tree) {
      var desugaring =
          new VariableDeclarationDesugaring(
              createIdentifierExpression(this.gensym_(tree.lvalue)));
      // Evaluate the rvalue and store it in a temporary.
      desugaring.assign(desugaring.rvalue, tree.initializer);
      this.desugarPattern_(desugaring, tree.lvalue);
      return desugaring.declarations;
    },

    /**
     * @param {Desugaring} desugaring
     * @param {ParseTree} tree
     */
    desugarPattern_: function(desugaring, tree) {
      switch (tree.type) {
        case ParseTreeType.ARRAY_PATTERN: {
          var pattern = tree;

          for (var i = 0; i < pattern.elements.length; i++) {
            var lvalue = pattern.elements[i];
            if (lvalue.isNull()) {
              // A skip, for example [a,,c]
              continue;
            } else if (lvalue.isSpreadPatternElement()) {
              // Rest of the array, for example [x, ...y] = [1, 2, 3]
              desugaring.assign(
                  lvalue.lvalue,
                  createCallExpression(
                      createMemberExpression(
                          PredefinedName.ARRAY, PredefinedName.PROTOTYPE,
                          PredefinedName.SLICE, PredefinedName.CALL),
                      createArgumentList(
                          desugaring.rvalue,
                          createNumberLiteral(i))));
            } else {
              desugaring.assign(
                  lvalue,
                  createMemberLookupExpression(
                      desugaring.rvalue,
                      createNumberLiteral(i)));
            }
          }
          break;
        }

        case ParseTreeType.OBJECT_PATTERN: {
          var pattern = tree;

          pattern.fields.forEach(function(field) {
            var lookup =
                createMemberExpression(desugaring.rvalue, field.identifier);
            desugaring.assign(
                field.element == null ?
                    // Just 'a' is sugar for 'a: a'
                    createIdentifierExpression(field.identifier) :
                    field.element,
                lookup);
          });
          break;
        }

        case ParseTreeType.PAREN_EXPRESSION:
          this.desugarPattern_(desugaring, tree.expression);
          break;

        default:
          throw new Error('unreachable');
      }
    },

    /**
     * Generates a deterministic and (hopefully) unique identifier based
     * on the lvalue identifiers in tree.
     * @param {ParseTree} tree
     * @return {string}
     */
    gensym_: function(tree) {
      var ids = this.collectLvalueIdentifiers_(Object.create(null), tree);
      ids = Object.keys(ids).sort();
      return 'destructuring$' + ids.join('$');
    },

    /**
     * Helper for gensym_.
     * @param {Object} identifiers
     * @param {ParseTree} tree
     * @return {Object}
     */
    collectLvalueIdentifiers_: function(identifiers, tree) {

      switch (tree.type) {
        case ParseTreeType.IDENTIFIER_EXPRESSION:
          identifiers[tree.identifierToken.value] = true;
          break;

        case ParseTreeType.ARRAY_PATTERN:
          tree.elements.forEach(function(e) {
            this.collectLvalueIdentifiers_(identifiers, e);
          }, this);
          break;

        case ParseTreeType.OBJECT_PATTERN:
          tree.fields.forEach(function(f) {
            if (f.element == null) {
              identifiers[f.identifier.value] = true;
            } else {
              this.collectLvalueIdentifiers_(identifiers, f.element);
            }
          }, this);
          break;

        case ParseTreeType.PAREN_EXPRESSION:
          this.collectLvalueIdentifiers_(identifiers,
              tree.expression);
          break;

        default:
          throw new Error('unreachable');
      }

      return identifiers;
    }

  });

  return {
    DestructuringTransformer: DestructuringTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;
  var PredefinedName = traceur.syntax.PredefinedName;

  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var FormalParameterList = traceur.syntax.trees.FormalParameterList;

  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createVariableStatement = ParseTreeFactory.createVariableStatement;
  var createConditionalExpression =
      ParseTreeFactory.createConditionalExpression;
  var createBinaryOperator = ParseTreeFactory.createBinaryOperator;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createOperatorToken = ParseTreeFactory.createOperatorToken;
  var createNumberLiteral = ParseTreeFactory.createNumberLiteral;
  var createMemberLookupExpression =
      ParseTreeFactory.createMemberLookupExpression;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createFunctionDeclaration = ParseTreeFactory.createFunctionDeclaration;
  var createBlock = ParseTreeFactory.createBlock;

  /**
   * Desugars default parameters.
   *
   * @see <a href="http://wiki.ecmascript.org/doku.php?id=harmony:parameter_default_values">harmony:parameter_default_values</a>
   * @constructor
   * @extends {ParseTreeTransformer}
   */
  function DefaultParametersTransformer() {
    ParseTreeTransformer.call(this);
  }

  /**
   * @param {ParseTree} tree
   * @return {ParseTree}
   */
  DefaultParametersTransformer.transformTree = function(tree) {
    return new DefaultParametersTransformer().transformAny(tree);
  };

  traceur.inherits(DefaultParametersTransformer,  ParseTreeTransformer, {
    __proto__: ParseTreeTransformer.prototype,

    transformFunctionDeclaration: function(tree) {
      var transformedTree = ParseTreeTransformer.prototype.
          transformFunctionDeclaration.call(this, tree);
      if (this.hasDefaultParameters_(transformedTree.formalParameterList)) {
        return this.desugarDefaultParameters_(tree);
      }
      return transformedTree;
    },

    hasDefaultParameters_: function(params) {
      return params.parameters.some(function(param) {
        return param.type == ParseTreeType.DEFAULT_PARAMETER;
      });
    },

    desugarDefaultParameters_: function(tree) {

      // Desugar default parameters as follows:
      //
      // function f(x, y = expr1, z = expr2) {}
      //
      // function f(x) {
      //   var y = arguments.length > 0 ? arguments[1] : expr1;
      //   var z = arguments.length > 1 ? arguments[2] : expr2;
      // }

      var params = tree.formalParameterList.parameters.filter(function(param) {
        return param.type != ParseTreeType.DEFAULT_PARAMETER;
      });

      var parametersWithoutDefault =
          new FormalParameterList(
              tree.formalParameterList.location, params);

      var statements = [];

      for (var i = 0; i < tree.formalParameterList.parameters.length; i++) {
        var param = tree.formalParameterList.parameters[i];
        if (param.type == ParseTreeType.DEFAULT_PARAMETER) {
          var defaultParam = param;
          // var y = arguments.length > i ? arguments[i] : expr;
          statements.push(
              createVariableStatement(
              TokenType.VAR,
              defaultParam.identifier.identifierToken,
              createConditionalExpression(
                  createBinaryOperator(
                      createMemberExpression(PredefinedName.ARGUMENTS,
                                             PredefinedName.LENGTH),
                      createOperatorToken(TokenType.CLOSE_ANGLE),
                      createNumberLiteral(i)),
                  createMemberLookupExpression(
                      createIdentifierExpression(PredefinedName.ARGUMENTS),
                      createNumberLiteral(i)),
                  defaultParam.expression)));
        }
      }

      statements.push.apply(statements, tree.functionBody.statements);

      return createFunctionDeclaration(
          tree.name, parametersWithoutDefault,
          createBlock(statements));
    }
  });

  return {
    DefaultParametersTransformer: DefaultParametersTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;

  var createArgumentList = traceur.codegeneration.ParseTreeFactory.createArgumentList;
  var createBlock = traceur.codegeneration.ParseTreeFactory.createBlock;
  var createCallExpression = traceur.codegeneration.ParseTreeFactory.createCallExpression;
  var createFunctionDeclaration = traceur.codegeneration.ParseTreeFactory.createFunctionDeclaration;
  var createIdentifierExpression = traceur.codegeneration.ParseTreeFactory.createIdentifierExpression;
  var createMemberExpression = traceur.codegeneration.ParseTreeFactory.createMemberExpression;
  var createNumberLiteral = traceur.codegeneration.ParseTreeFactory.createNumberLiteral;
  var createVariableStatement = traceur.codegeneration.ParseTreeFactory.createVariableStatement;

  var PredefinedName = traceur.syntax.PredefinedName;
  var TokenType = traceur.syntax.TokenType;

  var FormalParameterList = traceur.syntax.trees.FormalParameterList;

  /**
   * Desugars rest parameters.
   *
   * @see <a href="http://wiki.ecmascript.org/doku.php?id=harmony:rest_parameters">harmony:rest_parameters</a>
   * @constructor
   * @extends {ParseTreeTransformer}
   */
  function RestParameterTransformer() {
    ParseTreeTransformer.call(this);
  }

  RestParameterTransformer.transformTree = function(tree) {
    return new RestParameterTransformer().transformAny(tree);
  };

  function hasRestParameter(formalParameterList) {
    var parameters = formalParameterList.parameters;
    return parameters.length > 0 &&
        parameters[parameters.length - 1].isRestParameter();
  }

  function getRestParameter(formalParameterList) {
    var parameters = formalParameterList.parameters;
    return parameters[parameters.length - 1];
  }
  
  traceur.inherits(RestParameterTransformer, ParseTreeTransformer, {
    __proto__: ParseTreeTransformer.prototype,

    transformFunctionDeclaration: function(tree) {
      if (hasRestParameter(tree.formalParameterList)) {
        return this.desugarRestParameters_(tree);
      } else {
        return ParseTreeTransformer.prototype.transformFunctionDeclaration.
            call(this, tree);
      }
    },

    /**
     * @param {FunctionDeclaration} tree
     * @private
     * @return {ParseTree}
     */
    desugarRestParameters_: function(tree) {

      // Desugar rest parameters as follows:
      //
      // function f(x, ...y) {}
      //
      // function f(x) {
      //   var y = Array.prototype.slice.call(arguments, 1);
      // }

      var parametersWithoutRestParam =
          new FormalParameterList(
              tree.formalParameterList.location,
              tree.formalParameterList.parameters.slice(
                  0,
                  tree.formalParameterList.parameters.length - 1));

      var sliceExpression = createCallExpression(
          createMemberExpression(PredefinedName.ARRAY, PredefinedName.PROTOTYPE,
                                 'slice', PredefinedName.CALL),
          createArgumentList(
              createIdentifierExpression(PredefinedName.ARGUMENTS),
              createNumberLiteral(
                  tree.formalParameterList.parameters.length - 1)));

      var variable = createVariableStatement(
          TokenType.VAR,
          getRestParameter(tree.formalParameterList).identifier.value,
          sliceExpression);

      var statements = [];
      statements.push(variable);
      statements.push.apply(statements, tree.functionBody.statements);

      return createFunctionDeclaration(
          tree.name, parametersWithoutRestParam,
          this.transformAny(createBlock(statements)));
    }
  });

  return {
    RestParameterTransformer: RestParameterTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var createArgumentList = traceur.codegeneration.ParseTreeFactory.createArgumentList;
  var createArrayLiteralExpression = traceur.codegeneration.ParseTreeFactory.createArrayLiteralExpression;
  var createBlock = traceur.codegeneration.ParseTreeFactory.createBlock;
  var createBooleanLiteral = traceur.codegeneration.ParseTreeFactory.createBooleanLiteral;
  var createCallExpression = traceur.codegeneration.ParseTreeFactory.createCallExpression;
  var createFunctionExpression = traceur.codegeneration.ParseTreeFactory.createFunctionExpression;
  var createMemberExpression = traceur.codegeneration.ParseTreeFactory.createMemberExpression;
  var createMemberLookupExpression = traceur.codegeneration.ParseTreeFactory.createMemberLookupExpression;
  var createNullLiteral = traceur.codegeneration.ParseTreeFactory.createNullLiteral;
  var createParameterList = traceur.codegeneration.ParseTreeFactory.createParameterList;
  var createParameterReference = traceur.codegeneration.ParseTreeFactory.createParameterReference;
  var createParenExpression = traceur.codegeneration.ParseTreeFactory.createParenExpression;
  var createReturnStatement = traceur.codegeneration.ParseTreeFactory.createReturnStatement;

  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;

  var APPLY = traceur.syntax.PredefinedName.APPLY;
  var ARRAY = traceur.syntax.PredefinedName.ARRAY;
  var CALL = traceur.syntax.PredefinedName.CALL;
  var RUNTIME = traceur.syntax.PredefinedName.RUNTIME;
  var SLICE = traceur.syntax.PredefinedName.SLICE;
  var SPREAD = traceur.syntax.PredefinedName.SPREAD;
  var SPREAD_NEW = traceur.syntax.PredefinedName.SPREAD_NEW;
  var TRACEUR = traceur.syntax.PredefinedName.TRACEUR;

  var ParseTreeType = traceur.syntax.trees.ParseTreeType;

  function hasSpreadMember(trees) {
    return trees.some(function(tree) {
      return tree.type == ParseTreeType.SPREAD_EXPRESSION;
    });
  }

  /**
   * Array.prototype.slice.call(tree)
   */
  function toArray(tree) {
    return createCallExpression(createMemberExpression(
        ARRAY, PROTOTYPE, SLICE, CALL),
        createArgumentList(tree));
  }

  function getExpandFunction() {
    // traceur.runtime.spread
    return createMemberExpression(TRACEUR, RUNTIME, SPREAD);
  }

  function desugarArraySpread(tree) {
    // [a, ...b, c]
    //
    // (expandFunction)([false, a, true, b, false, c])
    return createExpandCall(tree.elements);
  }

  function createInterleavedArgumentsArray(elements) {
    var args = [];
    elements.forEach(function(element) {
      if (element.type == ParseTreeType.SPREAD_EXPRESSION) {
        args.push(createBooleanLiteral(true));
        args.push(element.expression);
      } else {
        args.push(createBooleanLiteral(false));
        args.push(element);
      }
    });
    return createArrayLiteralExpression(args);
  }

  function createExpandCall(elements) {
    var args = createInterleavedArgumentsArray(elements);
    return createCallExpression(
        getExpandFunction(),
        createArgumentList(args));
  }

  function desugarCallSpread(tree) {
    if (tree.operand.type == ParseTreeType.MEMBER_EXPRESSION) {
      // expr.fun(a, ...b, c)
      //
      // expr.fun.apply(expr, (expandFunction)([false, a, true, b, false, c]))
      //
      // (function($0, $1) {
      //   return $0.fun.apply($0, $1);
      // })(expr, (expandFunction)([false, a, true, b, false, c]))

      var expression = tree.operand;
      return desugarSpreadMethodCall(
          tree,
          expression.operand,
          createMemberExpression(
              createParameterReference(0),
              expression.memberName));

    } else if (tree.operand.type == ParseTreeType.MEMBER_LOOKUP_EXPRESSION) {
      // expr[fun](a, ...b, c)
      //
      // expr[fun].apply(expr, (expandFunction)([false, a, true, b, false, c]))
      //
      // (function($0, $1) {
      //   return $0[fun].apply($0, $1);
      // })(expr, (expandFunction)([false, a, true, b, false, c]))

      var lookupExpression = tree.operand;
      return desugarSpreadMethodCall(
          tree,
          lookupExpression.operand,
          createMemberLookupExpression(
              createParameterReference(0),
              lookupExpression.memberExpression));
    }
    // f(a, ..b, c)
    //
    // f.apply(null, (expandFunction)([false, a, true, b, false, c])

    // TODO(arv): Should this be apply([[Global]], ...) instead?

    return createCallExpression(createMemberExpression(tree.operand, APPLY),
        createArgumentList(createNullLiteral(), createExpandCall(tree.args.args)));
  }

  function desugarSpreadMethodCall(tree, operand, memberLookup) {
    // (function ($0, $1) {
    //   return memberLookup.apply($0, $1);
    // })(operand, expandCall(arguments))

    var body = createBlock(
        createReturnStatement(
            createCallExpression(
                createMemberExpression(
                    memberLookup,
                    APPLY),
                createArgumentList(
                    createParameterReference(0),
                    createParameterReference(1)))));

    var func = createParenExpression(
        createFunctionExpression(createParameterList(2), body));

    return createCallExpression(
        func,
        createArgumentList(
            operand,
            createExpandCall(tree.args.args)));
  }

  function desugarNewSpread(tree) {
    // new Fun(a, ...b, c)
    //
    // traceur.runtime.newWithSpread(Fun, [false, a, true, b, false, c])
    return createCallExpression(
        createMemberExpression(TRACEUR, RUNTIME, SPREAD_NEW),
        createArgumentList(
            tree.operand,
            createInterleavedArgumentsArray(tree.args.args)));
  }

  /**
   * Desugars spread in arrays.
   * TODO(arv): spread in array patterns
   *
   * @see <a href="http://wiki.ecmascript.org/doku.php?id=harmony:spread">harmony:spread</a>
   *
   * @extends {ParseTreeTransformer}
   * @constructor
   */
  function SpreadTransformer() {}

  SpreadTransformer.transformTree = function(tree) {
    return new SpreadTransformer().transformAny(tree);
  };
  
  traceur.inherits(SpreadTransformer, ParseTreeTransformer, {
    __proto__: ParseTreeTransformer.prototype,

    transformArrayLiteralExpression: function(tree) {
      if (hasSpreadMember(tree.elements)) {
        return desugarArraySpread(tree);
      }
      return ParseTreeTransformer.prototype.
          transformArrayLiteralExpression.call(this, tree);
    },

    transformCallExpression: function(tree) {
      if (hasSpreadMember(tree.args.args)) {
        return desugarCallSpread(tree);
      }
      return ParseTreeTransformer.prototype.transformCallExpression.
          call(this, tree);
    },

    transformNewExpression: function(tree) {
      if (tree.args != null && hasSpreadMember(tree.args.args)) {
        return desugarNewSpread(tree);
      }
      return ParseTreeTransformer.prototype.transformNewExpression.
          call(this, tree);
    }
  });

  return {
    SpreadTransformer: SpreadTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  function UniqueIdentifierGenerator() {
    this.identifierIndex = 0;
  }

  UniqueIdentifierGenerator.prototype = {
    /**
     * @return {string}
     */
    generateUniqueIdentifier: function() {
      return '$__' + this.identifierIndex++;
    }
  };

  // Export
  return {
    UniqueIdentifierGenerator: UniqueIdentifierGenerator
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var PredefinedName = traceur.syntax.PredefinedName;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createBlock = ParseTreeFactory.createBlock;
  var createCallExpression = ParseTreeFactory.createCallExpression;
  var createCallStatement = ParseTreeFactory.createCallStatement;
  var createFinally = ParseTreeFactory.createFinally;
  var createIfStatement = ParseTreeFactory.createIfStatement;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createTryStatement = ParseTreeFactory.createTryStatement;
  var createVariableStatement = ParseTreeFactory.createVariableStatement;
  var createWhileStatement = ParseTreeFactory.createWhileStatement;

  /**
   * Desugars foreach statement.
   * @param {UniqueIdentifierGenerator} identifierGenerator
   * @constructor
   */
  function ForEachTransformer(identifierGenerator) {
    ParseTreeTransformer.call(this);
    this.identifierGenerator_ = identifierGenerator;
    Object.freeze(this);
  }

  /*
   * @param {UniqueIdentifierGenerator} identifierGenerator
   * @param {ParseTree} tree
   */
  ForEachTransformer.transformTree = function(identifierGenerator, tree) {
    return new ForEachTransformer(identifierGenerator).transformAny(tree);
  };

  traceur.inherits(ForEachTransformer, ParseTreeTransformer, {
    __proto__: ParseTreeTransformer.prototype,

    // for ( initializer : collection ) statement
    //
    // let $it = collection.__iterator__();
    // try {
    //   while ($it.moveNext()) {
    //     initializer = $it.current;
    //     statement
    //   }
    // } finally {
    //   if ($it.close)
    //     $it.close();
    // }
    /**
     * @param {ForEachStatement} original
     * @return {ParseTree}
     */
    transformForEachStatement: function(original) {
      var tree = ParseTreeTransformer.prototype.transformForEachStatement.call(
          this, original);

      //   let $it = collection.__iterator__();
      // TODO: use 'var' instead of 'let' to enable yield's from within foreach statements
      var iter = this.identifierGenerator_.generateUniqueIdentifier();
      var initializer = createVariableStatement(TokenType.VAR, iter,
          createCallExpression(createMemberExpression(tree.collection, PredefinedName.ITERATOR)));

      // {
      //   initializer = $it.current;
      //   statement
      // }
      var body = createBlock(
          createVariableStatement(
              tree.initializer.declarationType,
              tree.initializer.declarations[0].lvalue.identifierToken,
              createMemberExpression(iter, PredefinedName.CURRENT)),
          tree.body);

      // while ($it.moveNext()) { body }
      var loop = createWhileStatement(createCallExpression(
          createMemberExpression(iter, PredefinedName.MOVE_NEXT)), body);

      // if ($it.close)
      //   $it.close();
      var finallyBody = createIfStatement(
          createMemberExpression(iter, PredefinedName.CLOSE),
          createCallStatement(createMemberExpression(iter, PredefinedName.CLOSE)));

      return createBlock(initializer,
          createTryStatement(createBlock(loop), null, createFinally(createBlock(finallyBody))));
    }
  });

  return {
    ForEachTransformer: ForEachTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var PredefinedName = traceur.syntax.PredefinedName;
  var Program = traceur.syntax.trees.Program;
  var TokenType = traceur.syntax.TokenType;

  var CLASS_DECLARATION = traceur.syntax.trees.ParseTreeType.CLASS_DECLARATION;
  var EXPORT_DECLARATION = traceur.syntax.trees.ParseTreeType.EXPORT_DECLARATION;
  var EXPORT_PATH_LIST = traceur.syntax.trees.ParseTreeType.EXPORT_PATH_LIST;
  var EXPORT_PATH_SPECIFIER = traceur.syntax.trees.ParseTreeType.EXPORT_PATH_SPECIFIER;
  var EXPORT_SPECIFIER = traceur.syntax.trees.ParseTreeType.EXPORT_SPECIFIER;
  var FUNCTION_DECLARATION = traceur.syntax.trees.ParseTreeType.FUNCTION_DECLARATION;
  var IDENTIFIER_EXPRESSION = traceur.syntax.trees.ParseTreeType.IDENTIFIER_EXPRESSION;
  var IMPORT_DECLARATION = traceur.syntax.trees.ParseTreeType.IMPORT_DECLARATION;
  var MODULE_DECLARATION = traceur.syntax.trees.ParseTreeType.MODULE_DECLARATION;
  var MODULE_DEFINITION = traceur.syntax.trees.ParseTreeType.MODULE_DEFINITION;
  var MODULE_REQUIRE = traceur.syntax.trees.ParseTreeType.MODULE_REQUIRE;
  var QUALIFIED_REFERENCE = traceur.syntax.trees.ParseTreeType.QUALIFIED_REFERENCE;
  var TRAIT_DECLARATION = traceur.syntax.trees.ParseTreeType.TRAIT_DECLARATION;
  var VARIABLE_STATEMENT = traceur.syntax.trees.ParseTreeType.VARIABLE_STATEMENT;

  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;

  var createArgumentList = traceur.codegeneration.ParseTreeFactory.createArgumentList;
  var createBlock = traceur.codegeneration.ParseTreeFactory.createBlock;
  var createCallCall = traceur.codegeneration.ParseTreeFactory.createCallCall;
  var createCallExpression = traceur.codegeneration.ParseTreeFactory.createCallExpression;
  var createEmptyParameterList = traceur.codegeneration.ParseTreeFactory.createEmptyParameterList;
  var createExpressionStatement = traceur.codegeneration.ParseTreeFactory.createExpressionStatement;
  var createFunctionExpression = traceur.codegeneration.ParseTreeFactory.createFunctionExpression;
  var createGetAccessor = traceur.codegeneration.ParseTreeFactory.createGetAccessor;
  var createIdentifierExpression = traceur.codegeneration.ParseTreeFactory.createIdentifierExpression;
  var createMemberExpression = traceur.codegeneration.ParseTreeFactory.createMemberExpression;
  var createNullLiteral = traceur.codegeneration.ParseTreeFactory.createNullLiteral;
  var createObjectFreeze = traceur.codegeneration.ParseTreeFactory.createObjectFreeze;
  var createObjectLiteralExpression = traceur.codegeneration.ParseTreeFactory.createObjectLiteralExpression;
  var createParameterList = traceur.codegeneration.ParseTreeFactory.createParameterList;
  var createParenExpression = traceur.codegeneration.ParseTreeFactory.createParenExpression;
  var createPropertyNameAssignment = traceur.codegeneration.ParseTreeFactory.createPropertyNameAssignment;
  var createReturnStatement = traceur.codegeneration.ParseTreeFactory.createReturnStatement;
  var createScopedExpression = traceur.codegeneration.ParseTreeFactory.createScopedExpression;
  var createStringLiteral = traceur.codegeneration.ParseTreeFactory.createStringLiteral;
  var createThisExpression = traceur.codegeneration.ParseTreeFactory.createThisExpression;
  var createTrueLiteral = traceur.codegeneration.ParseTreeFactory.createTrueLiteral;
  var createUseStrictDirective = traceur.codegeneration.ParseTreeFactory.createUseStrictDirective;
  var createVariableDeclaration = traceur.codegeneration.ParseTreeFactory.createVariableDeclaration;
  var createVariableDeclarationList = traceur.codegeneration.ParseTreeFactory.createVariableDeclarationList;
  var createVariableStatement = traceur.codegeneration.ParseTreeFactory.createVariableStatement;

  /**
   * This creates the code that defines the getter for an export.
   * @param {ExportSymbol} symbol
   * @return {ParseTree}
   */
  function getGetterExport(symbol) {
    // Object.defineProperty(this, 'NAME', {
    //   get: function() { return <returnExpression>; },
    //   enumerable: true
    // });
    var name = symbol.name;
    var tree = symbol.tree;
    var returnExpression;
    switch (tree.type) {
      case EXPORT_SPECIFIER:
        returnExpression = transformQualifiedReferenceParts(symbol.relatedTree,
            tree.rhs || tree.lhs);
        break;
      case EXPORT_PATH_SPECIFIER:
        returnExpression = new ModuleTransformer().transformAny(tree.specifier);
        break;
      case IDENTIFIER_EXPRESSION:
        if (!symbol.relatedTree)
          returnExpression = tree;
        else
          returnExpression = transformQualifiedReferenceParts(symbol.relatedTree,
              tree.identifierToken);
        break;
      case QUALIFIED_REFERENCE:
        returnExpression = new ModuleTransformer().transformAny(tree);
        break;
      default:
        returnExpression = createIdentifierExpression(name);
        break;
    }

    // function() { return <returnExpression>; }
    var fun = createFunctionExpression(
        createEmptyParameterList(),
        createBlock(
            createReturnStatement(returnExpression)));
    // { get: ... }
    var objectLiteral = createObjectLiteralExpression(
        createPropertyNameAssignment(PredefinedName.GET, fun),
        createPropertyNameAssignment(PredefinedName.ENUMERABLE,
        createTrueLiteral()));

    return createExpressionStatement(
        createCallExpression(
            createMemberExpression(PredefinedName.OBJECT,
                PredefinedName.DEFINE_PROPERTY),
            createArgumentList(
                createThisExpression(),
                createStringLiteral(name),
                objectLiteral)));
  }

  /**
   * Transforms a module expression and an identifier. This is used to create
   * a member expression for something like a.b.c.{d, e, f}.
   * @param {ParseTree} moduleExpression
   * @param {IdentifierToken} identifierToken
   * @return {ParseTree}
   */
  function transformQualifiedReferenceParts(moduleExpression, identifierToken) {
    var operand = new ModuleTransformer().transformAny(moduleExpression);
    return createMemberExpression(operand, identifierToken);
  }

  /**
   * @constructor
   * @extends {ParseTreeTransformer}
   */
  function ModuleTransformer() {
    ParseTreeTransformer.call(this);
  }
  
  traceur.inherits(ModuleTransformer, ParseTreeTransformer, {
    __proto__: ParseTreeTransformer.prototype,

    /**
     * @param {ModuleExpression} tree
     * @return {ParseTree}
     */
    transformModuleExpression: function(tree) {
      var reference = tree.reference;
      if (reference.type == MODULE_REQUIRE) {
        throw Error('Not implemented');
      }

      if (tree.identifiers.length == 0)
        return reference;

      return createMemberExpression(reference, tree.identifiers);
    },

    /**
     * @param {ModuleSpecifier} tree
     * @return {VariableDeclaration}
     */
    transformModuleSpecifier: function(tree) {
      var expression = this.transformAny(tree.expression);
      return createVariableDeclaration(tree.identifier, expression);
    },

    /**
     * @param {QualifiedReference} tree
     * @return {ParseTree}
     */
    transformQualifiedReference: function(tree) {
      return transformQualifiedReferenceParts(tree.moduleExpression,
          tree.identifier);
    }
  });

  /**
   * @param {Project} project
   * @param {Program} tree
   * @return {Program}
   */
  ModuleTransformer.transform = function(project, tree) {
    var module = project.getRootModule();
    var elements = tree.programElements.map(function(element) {
      switch (element.type) {
        case MODULE_DEFINITION:
          return transformDefinition(module, element);
        case MODULE_DECLARATION:
          return transformDeclaration(module, element);
        default:
          return element;
      }
    });
    return new Program(tree.location, elements);
  };

  /**
   * @param {ModuleSymbol} parent
   * @param {ModuleDefinition} tree
   * @return {ParseTree}
   */
  function transformDefinition(parent, tree) {
    var module = parent.getModule(tree.name.value);

    var statements = [];

    // use strict
    statements.push(createUseStrictDirective());

    // Add exports
    module.getExports().forEach(function(exp) {
      // Object.defineProperty(this, 'export_name', ...)
      statements.push(getGetterExport(exp));
    });

    // Object.freeze(this)
    statements.push(
        createExpressionStatement(createObjectFreeze(createThisExpression())));

    // Add original body statements
    tree.elements.forEach(function(element) {
      switch (element.type) {
        case MODULE_DECLARATION:
          statements.push(transformDeclaration(module, element));
          break;
        case MODULE_DEFINITION:
          statements.push(transformDefinition(module, element));
          break;
        case EXPORT_DECLARATION:
          var declaration = element.declaration;
          switch (declaration.type) {
            case MODULE_DEFINITION:
              statements.push(transformDefinition(module, declaration));
              break;
            case MODULE_DECLARATION:
              statements.push(transformDeclaration(module, declaration));
              break;
            case EXPORT_PATH_LIST:
              // These do not generate any statement here. It is all taken
              // care of in the export getter.
              break;
            case CLASS_DECLARATION:
            case FUNCTION_DECLARATION:
            case TRAIT_DECLARATION:
            case VARIABLE_STATEMENT:
              statements.push(declaration);
              break;
            default:
              throw new Error('unreachable');
          }
          break;
        case IMPORT_DECLARATION:
          throw new Error('Not implemented');
          break;
        default:
          // class, trait, statement, function declaration
          statements.push(element);
      }
    });

    // return this
    statements.push(createReturnStatement(createThisExpression()));

    // Object.create(null)
    var thisObject = createCallExpression(
        createMemberExpression(PredefinedName.OBJECT,
        PredefinedName.CREATE),
        createArgumentList(createNullLiteral()));

    // const M = (function() { statements }).call(thisObject);
    // TODO(arv): const is not allowed in ES5 strict
    return createVariableStatement(TokenType.VAR, module.name,
        createCallCall(
            createParenExpression(
                createFunctionExpression(createEmptyParameterList(),
                                         createBlock(statements))),
            thisObject));
  }

  /**
   * @param {ModuleSymbol} parent
   * @param {ModuleDeclaration} tree
   * @return {ParseTree}
   */
  function transformDeclaration(parent, tree) {
    // module m = n, o = p.q, ...;
    // module m = require('url').n.o.p;

    var transformer = new ModuleTransformer();
    var list = tree.specifiers.map(transformer.transformAny, transformer);

    // const a = b.c, d = e.f;
    // TODO(arv): const is not allowed in ES5 strict
    var variableDeclarationList = createVariableDeclarationList(TokenType.VAR,
                                                                list);

    return createVariableStatement(variableDeclarationList);
  }

  return {
    ModuleTransformer: ModuleTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;

  var PredefinedName = traceur.syntax.PredefinedName;
  var TokenType = traceur.syntax.TokenType;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var FunctionDeclaration = traceur.syntax.trees.FunctionDeclaration;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createArrayLiteralExpression = ParseTreeFactory.createArrayLiteralExpression;
  var createCallCall = ParseTreeFactory.createCallCall;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createStringLiteral = ParseTreeFactory.createStringLiteral;
  var createThisExpression = ParseTreeFactory.createThisExpression;

  var MethodSymbol = traceur.semantics.symbols.MethodSymbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;

  /**
   * Transforms method bodies.
   *
   * Includes:
   *  - static
   *  - 'super' keyword
   *
   * @param {ErrorReporter} reporter
   * @param {AggregateSymbol|MethodSymbol} symbol
   * @constructor
   * @extends {ParseTreeTransformer}
   */
  function FunctionTransformer(reporter, symbol) {
    ParseTreeTransformer.call(this);
    if (symbol instanceof MethodSymbol) {
      this.method_ = symbol;
      symbol = symbol.containingAggregate;
    }
    this.reporter_ = reporter;
    this.aggregate_ = symbol;
    Object.freeze(this);
  }

  var proto = ParseTreeTransformer.prototype;
  traceur.inherits(FunctionTransformer, ParseTreeTransformer, {
    __proto__: proto,

    /**
     * @param {FunctionDeclaration} tree
     * @return {ParseTree}
     */
    transformFunctionDeclaration: function(tree) {
      var nested = new FunctionTransformer(this.context_);
      return new FunctionDeclaration(
          null,
          tree.name,
          tree.isStatic,
          tree.formalParameterList,
          nested.transformBlock(tree.functionBody));
    },

    /**
     * @param {CallExpression} tree
     * @return {ParseTree}
     */
    transformCallExpression: function(tree) {
      if (tree.operand.type == ParseTreeType.SUPER_EXPRESSION &&
          this.method_ && !this.method_.isStatic) {
        // We have: super(args)

        // This becomes a call into the current method, which might be the
        // constructor.

        var methodName = this.method_.name;
        if (methodName == PredefinedName.NEW) {
          methodName = PredefinedName.CONSTRUCTOR;
        }

        // traceur.runtime.superCall(this, class, "name", <args>)
        return createCallCall(
            createMemberExpression(
                PredefinedName.TRACEUR,
                PredefinedName.RUNTIME,
                PredefinedName.SUPER_CALL),
            createThisExpression(),
            createIdentifierExpression(this.aggregate_.name),
            createStringLiteral(methodName),
            createArrayLiteralExpression(tree.args.args));
      }

      if (tree.operand.type == ParseTreeType.MEMBER_EXPRESSION &&
          tree.operand.operand.type == ParseTreeType.SUPER_EXPRESSION) {
        // We have: super.member(args)

        var memberExpression = tree.operand;
        this.validateSuperMember_(memberExpression);

        // traceur.runtime.superCall(this, class, "name", <args>)
        return createCallCall(
            createMemberExpression(
                PredefinedName.TRACEUR,
                PredefinedName.RUNTIME,
                PredefinedName.SUPER_CALL),
            createThisExpression(),
            createIdentifierExpression(this.aggregate_.name),
            createStringLiteral(memberExpression.memberName.value),
            createArrayLiteralExpression(tree.args.args));
      }

      return proto.transformCallExpression.call(this, tree);
    },

    /**
     * @param {MemberExpression} tree
     * @return {ParseTree}
     */
    transformMemberExpression: function(tree) {
      switch (tree.operand.type) {
        case ParseTreeType.SUPER_EXPRESSION:
          this.validateSuperMember_(tree);
          // traceur.runtime.superGet(this, class, "name")
          return createCallCall(
              createMemberExpression(
                  PredefinedName.TRACEUR,
                  PredefinedName.RUNTIME,
                  PredefinedName.SUPER_GET),
              createThisExpression(),
              createIdentifierExpression(this.aggregate_.name),
              createStringLiteral(tree.memberName.value));
        case ParseTreeType.CLASS_EXPRESSION:
          var classSymbol = getClassExpression(tree.operand);
          if (classSymbol == null) {
            return null;
          }
          var memberName = tree.memberName.value;
          var member = classSymbol.getStaticMember(memberName);
          if (member == null) {
            this.reportError_(tree, 'Class "%s" does not contain a member named "%s"', classSymbol.name, memberName);
            return null;
          }
          return proto.transformMemberExpression.call(this, tree);
        default:
          return proto.transformMemberExpression.call(this, tree);
      }
    },

    /** @param {MemberExpression} tree */
    validateSuperMember_: function(memberExpression) {
      if (this.aggregate_ == null) {
        this.reportError_(memberExpression.operand, '"super" expression not allowed outside a class declaration');
      }
      if (this.aggregate_.type != SymbolType.CLASS) {
        this.reportError_(memberExpression.operand, '"super" expressions may only be used inside class members.');
      }
    },

    /**
     * @param {SuperExpression} tree
     * @return {ParseTree}
     */
    transformSuperExpression: function(tree) {
      // TODO: super.property = ...;
      // TODO: super.property op= ...;
      this.reportError_(tree, '"super" may only be used on the LHS of a member access expression before a call (TODO wording)');
      return tree;
    },

    /**
     * @param {ClassExpression} tree
     * @return {ParseTree}
     */
    transformClassExpression: function(tree) {
      var classSymbol = this.getClassExpression_(tree);
      if (classSymbol == null) {
        return null;
      }
      return createIdentifierExpression(classSymbol.name);
    },

    /**
     * @param {ClassExpression } tree
     * @return {ClassSymbol}
     */
    getClassExpression_: function(tree) {
      if (this.aggregate_ == null || this.aggregate_.type != SymbolType.CLASS) {
        this.reportError_(tree, 'Cannot use "class" primary expressions outside of a class declaration.');
        return null;
      }
      return this.aggregate_;
    },

    /**
     * @param {ParseTree} tree
     * @param {string} format
     * @param {...Object} var_args
     */
    reportError_: function(tree, format, var_args) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = tree.location.start;
      this.reporter_.reportError.apply(this.reporter_, args);
    }
  });

  return {
    FunctionTransformer: FunctionTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var PredefinedName = traceur.syntax.PredefinedName;
  var Program = traceur.syntax.trees.Program;
  var ClassAnalyzer = traceur.semantics.ClassAnalyzer;
  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var FunctionTransformer = traceur.codegeneration.FunctionTransformer;
  var ClassSymbol = traceur.semantics.symbols.ClassSymbol;
  var SymbolType = traceur.semantics.symbols.SymbolType;
  var MethodSymbol = traceur.semantics.symbols.MethodSymbol;
  var PropertySymbol = traceur.semantics.symbols.PropertySymbol;
  var FieldSymbol = traceur.semantics.symbols.FieldSymbol;
  var AggregateSymbol = traceur.semantics.symbols.AggregateSymbol;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createArgumentList = ParseTreeFactory.createArgumentList;
  var createArrayLiteralExpression = ParseTreeFactory.createArrayLiteralExpression;
  var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
  var createBlock = ParseTreeFactory.createBlock;
  var createBooleanLiteral = ParseTreeFactory.createBooleanLiteral;
  var createCallExpression = ParseTreeFactory.createCallExpression;
  var createCallStatement = ParseTreeFactory.createCallStatement;
  var createClass = ParseTreeFactory.createClass;
  var createEmptyParameterList = ParseTreeFactory.createEmptyParameterList;
  var createEmptyParameters = ParseTreeFactory.createEmptyParameters;
  var createFunctionDeclaration = ParseTreeFactory.createFunctionDeclaration;
  var createFunctionExpression = ParseTreeFactory.createFunctionExpression;
  var createFunctionExpressionFormals = ParseTreeFactory.createFunctionExpressionFormals;
  var createGetAccessor = ParseTreeFactory.createGetAccessor;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createNullLiteral = ParseTreeFactory.createNullLiteral;
  var createObjectLiteralExpression = ParseTreeFactory.createObjectLiteralExpression;
  var createParameters = ParseTreeFactory.createParameters;
  var createPropertyNameAssignment = ParseTreeFactory.createPropertyNameAssignment;
  var createSetAccessor = ParseTreeFactory.createSetAccessor;
  var createStringLiteral = ParseTreeFactory.createStringLiteral;
  var createThisExpression = ParseTreeFactory.createThisExpression;
  var createTrueLiteral = ParseTreeFactory.createTrueLiteral;
  var createUndefinedExpression = ParseTreeFactory.createUndefinedExpression;
  var createVariableStatement = ParseTreeFactory.createVariableStatement;

  /**
   * Transforms a Traceur class or trait to JS.
   *
   * @param {ErrorReporter} reporter
   * @constructor
   * @extends {ParseTreeTransformer}
   */
  function ClassTransformer(reporter) {
    this.reporter_ = reporter;
  }

  /**
   * Transforms all classes and traits in the program
   *
   * @param {ErrorReporter} errors
   * @param {Program} tree
   * @return {Program}
   */
  ClassTransformer.transform = function(reporter, tree) {
    return new ClassTransformer(reporter).transformAny(tree);
  };

  function createRequiresExpression() {
    // traceur.truntime.trait.required
    return createMemberExpression(
        PredefinedName.TRACEUR,
        PredefinedName.RUNTIME,
        PredefinedName.TRAIT,
        PredefinedName.REQUIRED);
  }

  var proto = ParseTreeTransformer.prototype;
  traceur.inherits(ClassTransformer, ParseTreeTransformer, {
    __proto__: proto,

    /**
     * Transforms a single trait declaration
     *
     * @param {TraitDeclaration} tree
     * @return {ParseTree}
     */
    transformTraitDeclaration: function(tree) {
      tree = proto.transformTraitDeclaration.call(this, tree);
      var sym = ClassAnalyzer.analyzeTrait(this.reporter_, tree);

      //var <traitName> = traceur.truntime.createTrait(<prototype>, <mixins>)
      return createVariableStatement(
          TokenType.LET,
          sym.name,
          createCallExpression(
              createMemberExpression(
                  PredefinedName.TRACEUR,
                  PredefinedName.RUNTIME,
                  PredefinedName.CREATE_TRAIT),
              createArgumentList(
                  createObjectLiteralExpression(this.transformInstanceMembers_(sym)),
                  this.createMixins_(sym))));
    },

    /**
     * Transforms a single class declaration
     *
     * @param {ClassDeclaration} tree
     * @return {ParseTree}
     */
    transformClassDeclaration: function(tree) {
      tree = proto.transformClassDeclaration.call(this, tree);
      var sym = ClassAnalyzer.analyzeClass(this.reporter_, tree);

      var classInstance = createThisExpression();
      var baseClass = sym.tree.superClass;
      if (!baseClass) {
        baseClass = createNullLiteral();
      }

      // var <className> = traceur.runtime.createClass(base, <new>, <ctor>,
      //     <field init>, <prototype>, <static init>, <mixins>)
      return createVariableStatement(
          TokenType.LET,
          sym.name,
          createCallExpression(
              createMemberExpression(
                  PredefinedName.TRACEUR,
                  PredefinedName.RUNTIME,
                  PredefinedName.CREATE_CLASS),
              createArgumentList(
                  //name
                  createStringLiteral(sym.name),
                  // base
                  baseClass,
                  // $new
                  this.createStaticConstructor_(sym),
                  // ctor
                  this.createConstructor_(sym),
                  // $init
                  this.createFieldInitializerMethod_(sym),
                  // prototype
                  createObjectLiteralExpression(this.transformInstanceMembers_(sym)),
                  // static member decorator
                  // (function that will apply the static members)
                  createFunctionDeclaration(
                      PredefinedName.STATIC,
                      createEmptyParameterList(),
                      createBlock(this.createStaticMembers_(classInstance, sym))),
                  this.createMixins_(sym))));
    },

    /**
     * @param {AggregateSymbol} sym
     * @return {ParseTree}
     */
    createMixins_: function(sym) {
      if (sym.mixins.length == 0) {
        return createNullLiteral();
      }
      return createArrayLiteralExpression(
          sym.mixins.map(this.createMixin_, this));
    },

    /**
     * @param {Mixin} mixin
     * @return {ParseTree}
     */
    createMixin_: function(mixin) {
      var trait = createIdentifierExpression(mixin.name);
      var resolves = mixin.mixinResolves;
      if (!resolves || resolves.resolves.length == 0) {
        return trait;
      }

      resolves = resolves.resolves.map(function(r) {
        return createPropertyNameAssignment(r.from,
            r.to == PredefinedName.REQUIRES ?
                createRequiresExpression() :
                createStringLiteral(r.to));
      });

      return createCallExpression(
          createMemberExpression(
              PredefinedName.TRACEUR,
              PredefinedName.RUNTIME,
              PredefinedName.TRAIT,
              PredefinedName.RESOLVE),
          createArgumentList(
              createObjectLiteralExpression(resolves),
              trait));
    },

    /**
     * @param {ParseTree} classInstance
     * @param {ClassSymbol} sym
     * @return {Array.<ParseTree>}
     */
    createStaticMembers_: function(classInstance, sym) {
      var result = [];

      // do methods first so that static field initializers can reference static methods
      sym.getStaticMembers().forEach(function(member) {
        switch (member.type) {
          case SymbolType.METHOD:
            result.push(this.transformStaticMethodAssignment_(classInstance, member));
            break;
          case SymbolType.PROPERTY:
            result.push(this.transformStaticAccessor_(classInstance, member));
            break;
          case SymbolType.FIELD:
            break;
          case SymbolType.REQUIRES:
          default:
            throw new Error('Unexpected member type');
        }
      }, this);

      // now do static fields
      sym.getStaticMembers().forEach(function(member) {
        switch (member.type) {
          case SymbolType.METHOD:
          case SymbolType.PROPERTY:
            break;
          case SymbolType.FIELD:
            result.push(this.transformStaticField_(classInstance, member));
            break;
          case SymbolType.REQUIRES:
          default:
            throw new Error('Unexpected member type');
        }
      }, this);

      return result;
    },

    /**
     * @param {ParseTree} classInstance
     * @param {PropertySymbol} property
     * @return {ParseTree}
     */
    transformStaticAccessor_: function(classInstance, property) {
      // Object.defineProperty(
      //    ident,
      //    name,
      //    {
      //        get: ...
      //        set: ...
      //        enumerable: true,
      //        configurable: true
      //    }

      var get = property.get;
      var set = property.set;
      var aggregate = property.containingAggregate;

      var fields = [];
      fields.push(createPropertyNameAssignment(PredefinedName.ENUMERABLE, createTrueLiteral()));
      fields.push(createPropertyNameAssignment(PredefinedName.CONFIGURABLE, createTrueLiteral()));

      if (get != null) {
        fields.push(createPropertyNameAssignment(PredefinedName.GET,
            this.transformStaticMethod_(
                aggregate,
                createEmptyParameters(),
                get.tree.body)));
      }

      if (set != null) {
        fields.push(createPropertyNameAssignment(PredefinedName.SET,
            this.transformStaticMethod_(
                aggregate,
                createParameters(set.tree.parameter),
                set.tree.body)));
      }

      return createCallStatement(
          createMemberExpression(PredefinedName.OBJECT, PredefinedName.DEFINE_PROPERTY),
          createArgumentList(
              classInstance,
              createStringLiteral(property.name),
              createObjectLiteralExpression(fields)));
    },

    /**
     * @param {ParseTree} classInstance
     * @param {MethodSymbol} method
     * @return {ParseTree}
     */
    transformStaticMethodAssignment_: function(classInstance, method) {
      // aggregate.method  = function (args) { ... };
      return createAssignmentStatement(
          createMemberExpression(classInstance, method.name),
          this.transformStaticMethod_(
              method.containingAggregate,
              createParameters(method.tree.formalParameterList),
              method.tree.functionBody));
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @param {Array.<string>} formalParameters
     * @param {Block} functionBody
     * @return {FunctionDeclaration}
     */
    transformStaticMethod_: function(aggregate, formalParameters, functionBody) {
      return createFunctionExpressionFormals(
          formalParameters,
          this.createFunctionTransformer_(aggregate).transformBlock(functionBody));
    },

    /**
     * @param {ParseTree} classInstance
     * @param {FieldSymbol} field
     * @return {ParseTree}
     */
    transformStaticField_: function(classInstance, field) {
      var initializer;
      if (field.tree.initializer == null) {
        initializer = createUndefinedExpression();
      } else {
        initializer = this.transformStaticFieldInitializer_(field, field.tree.initializer);
      }
      // aggregate.field = initializer;
      return createAssignmentStatement(
          createMemberExpression(
              classInstance,
              field.name),
          initializer);
    },

    /**
     * @param {FieldSymbol} field
     * @param {ParseTree} tree
     * @return {ParseTree}
     */
    transformStaticFieldInitializer_: function(field, tree) {
      var transformer = this.createFunctionTransformer_(field.containingAggregate);
      return transformer.transformAny(tree);
    },

    /**
     * @param {AggregateSymbol} aggregate
     * @return {Array.<ParseTree>}
     */
    transformInstanceMembers_: function(sym) {
      var result = [];
      sym.getInstanceMembers().forEach(function(member) {
        switch (member.type) {
          case SymbolType.METHOD:
            if (!member.isConstructor()) {
              result.push(this.transformInstanceMethod_(member));
            }
            break;
          case SymbolType.PROPERTY:
            var property = member;
            if (property.get != null) {
              result.push(this.transformInstanceGetAccessor_(property.get));
            }
            if (property.set != null) {
              result.push(this.transformInstanceSetAccessor_(property.set));
            }
            break;
          case SymbolType.FIELD:
            break;
          case SymbolType.REQUIRES:
            result.push(createPropertyNameAssignment(
                member.name, createRequiresExpression()));
            break;
          default:
            throw new Error('Unexpected member type');
        }
      }, this);
      return result;
    },

    /**
     * @param {GetAccessor} aggregate
     * @return {ParseTree}
     */
    transformInstanceGetAccessor_: function(get) {
      var transformer = this.createFunctionTransformer_(get.getContainingAggregate());
      return createGetAccessor(
          get.getName(),
          false,
          transformer.transformBlock(get.tree.body));
    },

    /**
     * @param {GetAccessor} aggregate
     * @return {ParseTree}
     */
    transformInstanceSetAccessor_: function(set) {
      var transformer = this.createFunctionTransformer_(set.getContainingAggregate());
      return createSetAccessor(
          set.getName(),
          false,
          set.tree.parameter,
          transformer.transformBlock(set.tree.body));
    },

    /**
     * @param {MethodSymbol} method
     * @return {ParseTree}
     */
    transformInstanceMethod_: function(method) {
      return createPropertyNameAssignment(
          method.name,
          createFunctionExpression(
              method.tree.formalParameterList,
              this.transformMethodBody_(method)));
    },

    /**
     * @param {MethodSymbol} method
     * @return {Block}
     */
    transformMethodBody_: function(method) {
      var body = method.tree.functionBody;
      return this.createFunctionTransformer_(method).transformBlock(body);
    },

    /**
     * @param {AggregateSymbol} sym
     * @return {ParseTree}
     */
    createFieldInitializerMethod_: function(sym) {
      var init = this.transformFieldInitializers_(sym);
      if (init.length == 0) {
        return createUndefinedExpression();
      }

      return createFunctionDeclaration(
          PredefinedName.INIT,
          createEmptyParameterList(),
          createBlock(init));
    },

    /**
     * @param {AggregateSymbol} sym
     * @return {ParseTree}
     */
    createStaticConstructor_: function(sym) {
      var method = sym.getStaticConstructor();
      if (!method) {
        return createNullLiteral();
      } else {
        var methodTree = method.tree;
        return this.transformStaticMethod_(
            sym,
            createParameters(methodTree.formalParameterList),
            methodTree.functionBody);
      }
    },

    /**
     * @param {AggregateSymbol} sym
     * @return {ParseTree}
     */
    createConstructor_: function(sym) {
      var method = sym.getConstructor();
      if (!method) {
        return createNullLiteral();
      } else {
        return createFunctionExpression(
            method.tree.formalParameterList,
            this.transformMethodBody_(method));
      }
    },

    /**
     * @param {AggregateSymbol} sym
     * @return {Array.<ParseTree>}
     */
    transformFieldInitializers_: function(sym) {

      // this class's field initializers
      var transformer = this.createFunctionTransformer_(sym);
      var results = sym.getInstanceFields().map(function(field) {
        var initializer;
        if (field.tree.initializer == null) {
          initializer = createUndefinedExpression();
        } else {
          initializer = transformer.transformAny(field.tree.initializer);
        }

        // Object.defineProperty(
        //    this,
        //    field.name,
        //    {
        //        value: initializer,
        //        writable: field.isConst,
        //        enumerable: true,
        //        configurable: true
        //    }
        return createCallStatement(
            createMemberExpression(PredefinedName.OBJECT, PredefinedName.DEFINE_PROPERTY),
            createArgumentList(
                createThisExpression(),
                createStringLiteral(field.name),
                createObjectLiteralExpression(
                    createPropertyNameAssignment(PredefinedName.VALUE, initializer),
                    createPropertyNameAssignment(PredefinedName.WRITABLE, createBooleanLiteral(!field.isConst())),
                    createPropertyNameAssignment(PredefinedName.ENUMERABLE, createTrueLiteral()),
                    createPropertyNameAssignment(PredefinedName.CONFIGURABLE, createTrueLiteral()))));
      });

      return results;
    },

    /**
     * Helper to create a FunctionTransformer
     * @param {Symbol} sym
     * @return {FunctionTransformer}
     */
    createFunctionTransformer_: function(sym) {
      return new FunctionTransformer(this.reporter_, sym);
    }
  });

  return {
    ClassTransformer: ClassTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;
  var Block = traceur.syntax.trees.Block;
  var ClassDeclaration = traceur.syntax.trees.ClassDeclaration;
  var ForInStatement = traceur.syntax.trees.ForInStatement;
  var ForStatement = traceur.syntax.trees.ForStatement;
  var FunctionDeclaration = traceur.syntax.trees.FunctionDeclaration;
  var GetAccessor = traceur.syntax.trees.GetAccessor;
  var Mixin = traceur.syntax.trees.Mixin;
  var NullTree = traceur.syntax.trees.NullTree;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var Program = traceur.syntax.trees.Program;
  var SetAccessor = traceur.syntax.trees.SetAccessor;
  var TraitDeclaration = traceur.syntax.trees.TraitDeclaration;
  var VariableDeclarationList = traceur.syntax.trees.VariableDeclarationList;
  var VariableDeclaration = traceur.syntax.trees.VariableDeclaration;
  var VariableStatement = traceur.syntax.trees.VariableStatement;

  var AlphaRenamer = traceur.codegeneration.AlphaRenamer;
  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createAssignmentExpression = ParseTreeFactory.createAssignmentExpression;
  var createBlock = ParseTreeFactory.createBlock;
  var createCatch = ParseTreeFactory.createCatch;
  var createEmptyStatement = ParseTreeFactory.createEmptyStatement;
  var createExpressionStatement = ParseTreeFactory.createExpressionStatement;
  var createFinally = ParseTreeFactory.createFinally;
  var createForInStatement = ParseTreeFactory.createForInStatement;
  var createForStatement = ParseTreeFactory.createForStatement;
  var createFunctionDeclaration = ParseTreeFactory.createFunctionDeclaration;
  var createFunctionExpression = ParseTreeFactory.createFunctionExpression;
  var createGetAccessor = ParseTreeFactory.createGetAccessor;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createIdentifierToken = ParseTreeFactory.createIdentifierToken;
  var createParenExpression = ParseTreeFactory.createParenExpression;
  var createSetAccessor = ParseTreeFactory.createSetAccessor;
  var createThrowStatement = ParseTreeFactory.createThrowStatement;
  var createTryStatement = ParseTreeFactory.createTryStatement;
  var createUndefinedExpression = ParseTreeFactory.createUndefinedExpression;
  var createVariableDeclaration = ParseTreeFactory.createVariableDeclaration;
  var createVariableDeclarationList = ParseTreeFactory.createVariableDeclarationList;
  var createVariableStatement = ParseTreeFactory.createVariableStatement;

  var CONST = TokenType.CONST;
  var LET = TokenType.LET;
  var VAR = TokenType.VAR;

  /**
   * Transforms the block bindings from traceur to js.
   * The scope for let binding is just the containing block which can be achieved
   * in javascript in two ways: nested function or catch block.
   *
   * Nested function only works if there is no control flow passing through the
   * let block (break, continue, return), there is no const variable contained
   * anywhere within the let block and 'this' or 'arguments' are not used.
   * Given how uncommon the let block unaffected by any of these is, all blocks
   * are transformed using catch:
   *
   * try { throw uninitialized; } catch (let_var) { ... }
   *
   * const variables and nested function declarations are handled the same way,
   * the final solution for const is to be implemented.
   *
   * 'var' variables are unaffected by the rewrite because their scope is whole
   * function, and that is not affected by try .. catch blocks.
   *
   * The block binding rewrite pass assumes that deconstructing assignments
   * and variable declarations have already been desugared. See getVariableName_.
   *
   * TODO: Implement const support (currently rewritten exactly as 'let')
   *
   * @extends {ParseTreeTransformer}
   * @constructor
   */
  function BlockBindingTransformer(stateAllocator) {
    ParseTreeTransformer.call(this);
  }

  /**
   * @param {Program} tree
   * @return {Program}
   */
  BlockBindingTransformer.transformTree = function(tree) {
    return new BlockBindingTransformer().transformAny(tree);
  };

  var ScopeType = {
    PROGRAM: 'PROGRAM',
    FUNCTION: 'FUNCTION',
    BLOCK: 'BLOCK'
  };

  /**
   * Represents the link in the scope chain.
   * @param {Scope} parent The parent scope, or null if top level (program) scope.
   * @param {ScopeType} type Scope type: global, function, block.
   * @constructor
   */
  function Scope(parent, type) {
    //
    this.parent = parent;
    this.type = type;
  }
  Scope.prototype = {
    /** Block scoped variables accumulated within the block. */
    blockVariables: null,

    /**
     * Stores a block scoped variable for future processing.
     * @param {string} value
     */
    addBlockScopedVariable: function(value) {
      if (!this.blockVariables) {
        this.blockVariables = Object.create(null);
      }
      this.blockVariables[value] = true;
    }
  };

  /**
   * @param {string} oldName
   * @param {string} newName
   * @constructor
   */
  function Rename(oldName, newName) {
    this.oldName = oldName;
    this.newName = newName;
  }

  /**
   * @param {Array.<Rename>} renames
   * @param {ParseTree} tree
   * @return {ParseTree}
   */
  function renameAll(renames, tree) {
    renames.forEach(function(rename) {
      tree = AlphaRenamer.rename(tree, rename.oldName, rename.newName);
    });
    return tree;
  }

  /**
   * Wraps a statement in a block if needed.
   * @param {ParseTree} statements
   * @return {Block}
   */
  function toBlock(statement) {
    return statement.type == ParseTreeType.BLOCK ? statement : createBlock(statement);
  }

  var proto = ParseTreeTransformer.prototype;
  traceur.inherits(BlockBindingTransformer, ParseTreeTransformer, {
      __proto__: proto,

      /**
       * Current scope (block, program)
       */
      scope_: null,

      /**
       * Creates top level (program) scope.
       * Inside the scope, let/const become vars (const only temporarily),
       * functions are unchanged.
       * @return {Scope}
       */
      createProgramScope_: function() {
        // program scope is never a block/let scope
        return new Scope(this.scope__, ScopeType.PROGRAM);
      },

      /**
       * Creates function level scope.
       * let/const is rewritten, function names are not.
       * @return {Scope}
       */
      createFunctionScope_: function() {
        if (this.scope_ == null) {
          throw new Error('Top level function scope found.');
        }
        // program scope is never a block/let scope
        return new Scope(this.scope_, ScopeType.FUNCTION);
      },

      /**
       * Creates block scope - inside it let/const/function have limited scope.
       * @return {Scope}
       */
      createBlockScope_: function() {
        if (this.scope_ == null) {
          throw new Error('Top level block scope found.');
        }
        // contained within block scope
        return new Scope(this.scope_, ScopeType.BLOCK);
      },

      /**
       * Pushes new scope
       * @param {Scope} scope
       * @return {Scope}
       */
      push_: function(scope) {
        this.scope_ = scope;
        return scope;
      },

      /**
       * Pops scope, tracks proper matching of push_/pop_ operations.
       * @param {Scope} scope
       */
      pop_: function(scope) {
        if (this.scope_ != scope) {
          throw new Error('BlockBindingTransformer scope mismatch');
        }

        this.scope_ = scope.parent;
      },

      // The transform methods override from the base.

      /**
       * Transforms block scope, rewriting all block-scoped variables/functions.
       * @param {Block} tree
       * @return {ParseTree}
       */
      transformBlock: function(tree) {
        // Push new scope.
        var scope = this.push_(this.createBlockScope_());

        // Transform the block contents
        var statements = this.transformSourceElements(tree.statements);

        if (scope.blockVariables != null) {
          // rewrite into catch construct
          tree = toBlock(
              this.rewriteAsCatch_(scope.blockVariables, createBlock(statements)));
        } else if (statements != tree.statements) {
          tree = createBlock(statements);
        }

        this.pop_(scope);
        return tree;
      },

      /**
       * Declares block-scoped variables. Does so by wrapping a block in
       * a try .. catch for each block scoped variable in the set.
       *
       * 'let x = 1;' turns into:
       *
       * try {
       *   throw undefined;
       * } catch (x) {
       *   x = 1;   // let x = 1
       *   ...
       *   }
       * }
       *
       * @param {Object} blockVariables
       * @param {ParseTree} statements
       * @return {ParseTree}
       */
      rewriteAsCatch_: function(blockVariables, statement) {
        // Build the try .. catch structure from within.
        // try {
        //   throw undefined;
        // } catch (<block scoped variable>) {
        //   <block>
        // }
        for (var variable in blockVariables) {
          statement =
              createTryStatement(
                  createBlock(                  // try
                      createThrowStatement(
                          createUndefinedExpression())),
                  createCatch(                  // catch
                      createIdentifierToken(variable),
                      toBlock(statement)),
                  null);                       // finally
        }

        return statement;
      },

      /** Class declarations should have been transformed away. */
      /**
       * @param {ClassDeclaration} tree
       * @return {ParseTree}
       */
      transformClassDeclaration: function(tree) {
        throw new Error('ClassDeclaration should be transformed away.');
      },

      /**
       * Transforms for .. in statement.
       */
      /**
       * @param {ForInStatement} tree
       * @return {ParseTree}
       */
      transformForInStatement: function(tree) {
        // Save it here because tree may change in the variable rewrite
        var treeBody = tree.body;

        var initializer;
        if (tree.initializer != null &&
            tree.initializer.type == ParseTreeType.VARIABLE_DECLARATION_LIST) {

          // for (var/let/const x [ = ...] in ...)
          var variables = tree.initializer;

          // Only one declaration allowed.
          if (variables.declarations.length != 1) {
            throw new Error('for .. in has != 1 variables');
          }

          var variable = variables.declarations[0];
          var variableName = this.getVariableName_(variable);

          switch (variables.declarationType) {
            case LET:
            case CONST: {
              // initializer is illegal in for (const/let x in ...)
              // this should have been caught in the parser.
              if (variable.initializer != null) {
                throw new Error(
                    'const/let in for-in may not have an initializer');
              }

              // Build the result
              // for (var $x in ...) {
              //   let x = $x;
              //   ...
              // }
              // TODO: Use temp allocator.
              initializer = createVariableDeclarationList(
                  TokenType.VAR, '$' + variableName, null);

              // Add the let statement into the block and rewrite it next.
              // It is easier than creating the catch block manually etc.
              treeBody = this.prependToBlock_(
                  createVariableStatement(
                      TokenType.LET,
                      variableName,
                      createIdentifierExpression('$' + variableName)),
                  treeBody);
              break;
            }

            case VAR:
              // No special work for var
              initializer = this.transformVariables_(variables);
              break;

            default:
              throw new Error('Unreachable.');
          }
        } else {
          initializer = this.transformAny(tree.initializer);
        }

        var result = tree;
        var collection = this.transformAny(tree.collection);
        var body = this.transformAny(treeBody);

        if (initializer != tree.initializer ||
            collection != tree.collection ||
            body != tree.body) {
          result = createForInStatement(initializer, collection, body);
        }

        return result;
      },

      /**
       * TODO: Use non-scoped blocks (statement comma) when available.
       * @param {ParseTree} statement
       * @param {ParseTree} body
       * @return {Block}
       */
      prependToBlock_: function(statement, body) {
        if (body.type == ParseTreeType.BLOCK) {
          var block = body;
          var list = [];
          list.push(statement);
          list.push.apply(list, block.statements);
          return createBlock(list);
        } else {
          return createBlock(statement, body);
        }
      },

      /**
       * Transforms the for ( ... ; ... ; ... ) { ... } statement.
       * @param {ForStatement} tree
       * @return {ParseTree}
       */
      transformForStatement: function(tree) {
        var initializer;
        if (tree.initializer != null &&
            tree.initializer.type == ParseTreeType.VARIABLE_DECLARATION_LIST) {

          // for (var/let/const ... ; ; ) { ... }
          var variables = tree.initializer;

          switch (variables.declarationType) {
            case LET:
            case CONST:
              // let/const are rewritten differently so the code below doesn't apply
              return this.transformForLet_(tree, variables);

            case VAR:
              // No special work for var.
              initializer = this.transformVariables_(variables);
              break;

            default:
              throw new Error('Reached unreachable.');
          }
        } else {
          // The non-var case: for (x = ...; ; ) { ... }
          initializer = this.transformAny(tree.initializer);
        }

        // Finish transforming the body.
        var condition = this.transformAny(tree.condition);
        var increment = this.transformAny(tree.increment);
        var body = this.transformAny(tree.body);

        var result = tree;

        if (initializer != tree.initializer ||
            condition != tree.condition ||
            increment != tree.increment ||
            body != tree.body) {
          // Create new for statement.
          result = createForStatement(initializer, condition, increment, body);
        }

        return result;
      },

      /*
       * Transforms the for (let ...; ...; ...) { ... } statement. There are few
       * steps to this:
       *
       * 1. Hoist the declaration out of the for loop (keep as let for further
       *    rewrite)
       * 2. Rename the hoisted declared variables
       * 3. Wrap the for loop body in a try..finally block
       * 4. Before the try block, copy all variables into new block scoped
       *    variables (using original names)
       * 5. In the finally, write-back the to the hoisted variables
       *
       * For example:
       *
       * for (let x = 1, y = x + 2; x + y < 10, x ++, y ++) {
       *  if (condition) {
       *    continue;
       *  }
       * }
       *
       * translates into:
       *
       * {
       *   let $x = 1, $y = $x + 2;     // initializer dependencies
       *   for ( ; $x + $y < 10; $x++, $y++) {
       *     let x = $x, y = $y;
       *     try {
       *       // for loop body
       *       if (condition) {
       *         continue;
       *       }
       *
       *     } finally {
       *       $x = x;    // write-backs into the hoisted variables
       *       $y = y;
       *     }
       *   }
       * }
       * @param {ForStatement} tree
       * @param {VariableDeclarationList} variables
       * @return {ParseTree}
       */
      transformForLet_: function(tree, variables) {

        // Accumulator for 'let x = $x;'
        var copyFwd = [];

        // Accumulator for '$x = x' copybacks
        var copyBak = [];

        // Accumulator for the hoisted declaration: let $x = 1, ...;
        var hoisted = [];

        var renames = [];

        variables.declarations.forEach(function(variable) {
          var variableName = this.getVariableName_(variable);
          var hoistedName = '$' + variableName;

          // perform renames in the initializer
          var initializer = renameAll(renames, variable.initializer);

          // hoisted declaration: let $x = 1
          hoisted.push(createVariableDeclaration(hoistedName, initializer));

          // copy forward: let x = $x;
          copyFwd.push(
              createVariableDeclaration(
                  variableName,
                  createIdentifierExpression(hoistedName)));

          // copy back: $x = x;
          copyBak.push(
              createExpressionStatement(
                  createAssignmentExpression(
                      createIdentifierExpression(hoistedName),
                      createIdentifierExpression(variableName))));

          // Remember rename for the subsequent initializers
          renames.push(new Rename(variableName, hoistedName));
        }, this);

        // 'tree.condition' with renamed variables
        var condition = renameAll(renames, tree.condition);
        // 'tree.increment' with renamed variables
        var increment = renameAll(renames, tree.increment);

        // package it all up
        var transformedForLoop = createBlock(
            // hoisted declaration
            createVariableStatement(
                createVariableDeclarationList(
                    TokenType.LET, hoisted)),
            // for loop
            createForStatement(
                new NullTree(),
                condition,
                increment,
                // body
                createBlock(
                    createVariableStatement(
                        // let x = $x;
                        createVariableDeclarationList(
                            TokenType.LET, copyFwd)),
            // try { ... } finally { copyBak }
            createTryStatement(
                            // try - the original for loop body
                            tree.body,
                            // catch (none)
                            new NullTree(),
                            // finally - the writebacks
                            createFinally(createBlock(copyBak))))));

        // Now transform the rewritten for loop! This is safe to do because the
        return this.transformAny(transformedForLoop);
      },

      /**
       * Transforms a function. Function name in the block scope
       * is scoped to the block only, so the same rewrite applies.
       *
       * @param {FunctionDeclaration} tree
       * @return {ParseTree}
       */
      transformFunctionDeclaration: function(tree) {
        var body = this.transformFunctionBody_(tree.functionBody);

        if (tree.name != null && this.scope_.type == ScopeType.BLOCK) {
          // Named function in a block scope is only scoped to the block.
          // Add function name into variable hash to later 'declare' the
          // block scoped variable for it.
          this.scope_.addBlockScopedVariable(tree.name.value);

          // f = function f( ... ) { ... }
          return createParenExpression(
              createAssignmentExpression(
                  createIdentifierExpression(tree.name),
                  createFunctionDeclaration(tree.name,
                      tree.formalParameterList, body)));
        } else if (body != tree.functionBody) {
          return createFunctionDeclaration(
              tree.name, tree.formalParameterList, body);
        } else {
          return tree;
        }
      },

      /**
       * @param {GetAccessor} tree
       * @return {ParseTree}
       */
      transformGetAccessor: function(tree) {
        var body = this.transformFunctionBody_(tree.body);

        if (body != tree.body) {
          tree = createGetAccessor(tree.propertyName, tree.isStatic, body);
        }

        return tree;
      },

      /**
       * Mixin should be compiled away by now.
       * @param {Mixin} tree
       * @return {ParseTree}
       */
      transformMixin: function(tree) {
        throw new Error('Mixin should be transformed away.');
      },

      /**
       * Transforms the whole program.
       * @param {Program} tree
       * @return {ParseTree}
       */
      transformProgram: function(tree) {
        // Push new scope
        var scope = this.push_(this.createProgramScope_());

        var result = proto.transformProgram.call(this, tree);

        this.pop_(scope);
        return result;
      },

      /**
       * @param {SetAccessor} tree
       * @return {ParseTree}
       */
      transformSetAccessor: function(tree) {
        var body = this.transformFunctionBody_(tree.body);

        if (body != tree.body) {
          tree = createSetAccessor(
              tree.propertyName, tree.isStatic, tree.parameter, body);
        }
        return tree;
      },

      /** Trait should be transformed away by now. */
      /**
       * @param {TraitDeclaration} tree
       * @return {ParseTree}
       */
      transformTraitDeclaration: function(tree) {
        // This should be rewritten away by now.
        throw new Error('Trait should be transformed away.');
      },

      /**
       * Variable declarations are detected earlier and handled elsewhere.
       * @param {VariableDeclaration} tree
       * @return {ParseTree}
       */
      transformVariableDeclaration: function(tree) {
        throw new Error('Should never see variable declaration tree.');
      },

      /**
       * Variable declarations are detected earlier and handled elsewhere.
       * @param {VariableDeclarationList} tree
       * @return {ParseTree}
       */
      transformVariableDeclarationList: function(tree) {
        throw new Error('Should never see variable declaration list.');
      },

      /**
       * Transforms the variable statement. Inside a block const and let
       * are transformed into block-scoped variables.
       * Outside of the block, const stays the same, let becomes regular
       * variable.
       * @param {VariableStatement} tree
       * @return {ParseTree}
       */
      transformVariableStatement: function(tree) {
        if (this.scope_.type == ScopeType.BLOCK) {
          // let/const have block scoped meaning only in block scope.
          switch (tree.declarations.declarationType) {
            case CONST:
            case LET:
              return this.transformBlockVariables_(tree.declarations);

            default:
              break;
          }
        }

        // Default handling.
        var variables = this.transformVariables_(tree.declarations);

        if (variables != tree.declarations) {
          tree = createVariableStatement(variables);
        }

        return tree;
      },

      /**
       * Transforms block scoped variables.
       * Series of declarations become a comma of assignment expressions
       * which is later turned into a statement, minimizing block creation
       * overhead.
       * @param {VariableDeclarationList} tree
       * @return {ParseTree}
       */
      transformBlockVariables_: function(tree) {
        var variables = tree.declarations;
        var comma = [];

        variables.forEach(function(variable) {
          switch (tree.declarationType) {
            case LET:
            case CONST:
              break;
            default:
              throw new Error('Only let/const allowed here.');
          }

          var variableName = this.getVariableName_(variable);

          // Store the block scoped variable for future 'declaration'.
          this.scope_.addBlockScopedVariable(variableName);
          var initializer = this.transformAny(variable.initializer);

          if (initializer != null) {
            // varname = initializer, ...
            comma.push(
                createAssignmentExpression(
                    createIdentifierExpression(variableName),
                    initializer));
          }
        }, this);

        switch (comma.length) {
          case 0:
            return createEmptyStatement();
          case 1:
            return createExpressionStatement(comma[0]);
          default:
            // Turn comma into statements
            for (var i = 0; i < comma.length; i++) {
              comma[i] = createExpressionStatement(comma[i]);
            }
            return createBlock(comma);
        }
      },

      /**
       * Transforms variables unaffected by block scope.
       * @param {VariableDeclarationList} tree
       * @return {VariableDeclarationList}
       */
      transformVariables_: function(tree) {

        var variables = tree.declarations;
        var transformed = null;

        for (var index = 0; index < variables.length; index++) {
          var variable = variables[index];
          var variableName = this.getVariableName_(variable);

          // Transform the initializer.
          var initializer = this.transformAny(variable.initializer);

          if (transformed != null || initializer != variable.initializer) {
            // Variable was rewritten.
            if (transformed == null) {
              transformed = [];
              transformed.push.apply(transformed, variables.slice(0, index));
            }

            // var/const x = <initializer>;
            transformed.push(
                createVariableDeclaration(
                    createIdentifierToken(variableName), initializer));
          }
        }

        // Package up in the declaration list.
        if (transformed != null || tree.declarationType == TokenType.LET) {
          var declarations = transformed != null ? transformed : tree.declarations;
          var declarationType = tree.declarationType == TokenType.LET ?
              TokenType.VAR :
              tree.declarationType;

          tree = createVariableDeclarationList(declarationType, declarations);
        }
        return tree;
      },

      /**
       * @param {Block} tree
       * @return {Block}
       */
      transformFunctionBody_: function(body) {
        // Push new function context
        var scope = this.push_(this.createFunctionScope_());

        body = this.transformBlockStatements_(body);

        this.pop_(scope);
        return body;
      },

      /**
       * @param {Block} tree
       * @return {Block}
       */
      transformBlockStatements_: function(tree) {
        var statements = this.transformSourceElements(tree.statements);

        if (this.scope_.blockVariables != null) {
          // rewrite into catch construct
          tree = toBlock(
              this.rewriteAsCatch_(this.scope_.blockVariables, createBlock(statements)));
        } else if (statements != tree.statements) {
          tree = createBlock(statements);
        }

        return tree;
      },

      /**
       * @param {VariableDeclaration} variable
       * @return {string}
       */
      getVariableName_: function(variable) {
        var lvalue = variable.lvalue;
        if (lvalue.type == ParseTreeType.IDENTIFIER_EXPRESSION) {
          return lvalue.identifierToken.value;
        } else {
          throw new Error('Unexpected destructuring declaration found.');
        }
      }
  });

  return {
    BlockBindingTransformer: BlockBindingTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var PredefinedName = traceur.syntax.PredefinedName;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createArgumentList = ParseTreeFactory.createArgumentList;
  var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
  var createBinaryOperator = ParseTreeFactory.createBinaryOperator;
  var createBlock = ParseTreeFactory.createBlock;
  var createCallStatement = ParseTreeFactory.createCallStatement;
  var createContinueStatement = ParseTreeFactory.createContinueStatement;
  var createEmptyArrayLiteralExpression = ParseTreeFactory.createEmptyArrayLiteralExpression;
  var createForInStatement = ParseTreeFactory.createForInStatement;
  var createForStatement = ParseTreeFactory.createForStatement;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createIfStatement = ParseTreeFactory.createIfStatement;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createMemberLookupExpression = ParseTreeFactory.createMemberLookupExpression;
  var createNumberLiteral = ParseTreeFactory.createNumberLiteral;
  var createOperatorToken = ParseTreeFactory.createOperatorToken;
  var createParenExpression = ParseTreeFactory.createParenExpression;
  var createPostfixExpression = ParseTreeFactory.createPostfixExpression;
  var createUnaryExpression = ParseTreeFactory.createUnaryExpression;
  var createVariableDeclarationList = ParseTreeFactory.createVariableDeclarationList;
  var createVariableStatement = ParseTreeFactory.createVariableStatement;

  /**
   * Desugars for-in loops to be compatible with generators.
   * @param {UniqueIdentifierGenerator} identifierGenerator
   * @constructor
   */
  function ForInTransformPass(identifierGenerator) {
    ParseTreeTransformer.call(this);
    this.identifierGenerator_ = identifierGenerator;
    Object.freeze(this);
  }

  /*
   * @param {UniqueIdentifierGenerator} identifierGenerator
   * @param {ParseTree} tree
   */
  ForInTransformPass.transformTree = function(identifierGenerator, tree) {
    return new ForInTransformPass(identifierGenerator).transformAny(tree);
  };
  traceur.inherits(ForInTransformPass, ParseTreeTransformer, {
    __proto__: ParseTreeTransformer.prototype,

    // for ( var key in object ) statement
    //
    // var $keys = [];
    // var $collection = object;
    // for (var $p in $collection) $keys.push($p);
    // for (var $i = 0; $i < $keys.length; $i++) {
    //   var key;
    //   key = $keys[$i];
    //   if (!(key in $collection))
    //     continue;
    //   statement
    // }
    /**
     * @param {ForInStatement} original
     * @return {ParseTree}
     */
    transformForInStatement: function(original) {
      var tree = original;

      // Transform body first
      var bodyStatements = [];
      var body = this.transformAny(tree.body);
      if (body.type == ParseTreeType.BLOCK) {
        bodyStatements.push.apply(bodyStatements, body.statements);
      } else {
        bodyStatements.push(body);
      }

      var elements = [];

      // var $keys = [];
      var keys = this.identifierGenerator_.generateUniqueIdentifier();
      elements.push(
          createVariableStatement(TokenType.VAR, keys,
          createEmptyArrayLiteralExpression()));

      // var $collection = object;
      var collection = this.identifierGenerator_.generateUniqueIdentifier();
      elements.push(createVariableStatement(TokenType.VAR, collection, tree.collection));

      // for (var $p in $collection) $keys.push($p);
      var p = this.identifierGenerator_.generateUniqueIdentifier();
      elements.push(
          createForInStatement(
              // var $p
              createVariableDeclarationList(TokenType.VAR, p, null),
              // $collection
              createIdentifierExpression(collection),
              // $keys.push($p)
              createCallStatement(
                  createMemberExpression(keys, PredefinedName.PUSH),
                  createArgumentList(createIdentifierExpression(p)))));

      var i = this.identifierGenerator_.generateUniqueIdentifier();

      // $keys[$i]
      var lookup = createMemberLookupExpression(
          createIdentifierExpression(keys),
          createIdentifierExpression(i));

      var originalKey, assignOriginalKey;
      if (tree.initializer.type == ParseTreeType.VARIABLE_DECLARATION_LIST) {
        var decList = tree.initializer;
        originalKey = decList.declarations[0].lvalue;
        // var key = $keys[$i];
        assignOriginalKey = createVariableStatement(decList.declarationType,
            originalKey.identifierToken, lookup);
      } else if (tree.initializer.type == ParseTreeType.IDENTIFIER_EXPRESSION) {
        originalKey = tree.initializer;
        // key = $keys[$i];
        assignOriginalKey = createAssignmentStatement(tree.initializer, lookup);
      } else {
        throw new Error('Invalid left hand side of for in loop');
      }

      var innerBlock = [];

      // var key = $keys[$i];
      innerBlock.push(assignOriginalKey);

      // if (!(key in $collection))
      innerBlock.push(
          createIfStatement(
              createUnaryExpression(
                  createOperatorToken(TokenType.BANG),
                  createParenExpression(
                      createBinaryOperator(
                          originalKey,
                          createOperatorToken(TokenType.IN),
                          createIdentifierExpression(collection)))),
              // continue
              createContinueStatement(),
              null));

      // add original body
      innerBlock.push.apply(innerBlock, bodyStatements);

      // for (var $i = 0; $i < $keys.length; $i++) {
      elements.push(
          createForStatement(
              // var $i = 0
              createVariableDeclarationList(TokenType.VAR, i, createNumberLiteral(0)),
              // $i < $keys.length
              createBinaryOperator(
                  createIdentifierExpression(i),
                  createOperatorToken(TokenType.OPEN_ANGLE),
                  createMemberExpression(keys, PredefinedName.LENGTH)),
              // $i++
              createPostfixExpression(
                  createIdentifierExpression(i),
                  createOperatorToken(TokenType.PLUS_PLUS)),
              // body
              createBlock(innerBlock)));

      return createBlock(elements);
    }
  });

  return {
    ForInTransformPass: ForInTransformPass
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var PredefinedName = traceur.syntax.PredefinedName;
  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createCaseClause = ParseTreeFactory.createCaseClause;
  var createStatementList = ParseTreeFactory.createStatementList;
  var createBreakStatement = ParseTreeFactory.createBreakStatement;
  var createStatementList = ParseTreeFactory.createStatementList;
  var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
  var createAssignStateStatement = ParseTreeFactory.createAssignStateStatement;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createNumberLiteral = ParseTreeFactory.createNumberLiteral;

  /**
   * A State in the generator state machine.
   *
   * The id in the state is unique across all machines in the function body.
   *
   * States are immutable.
   *
   * When knitting StateMachines together the states in one machine may need
   * renumbering in the new machine. replaceState() is used to create an equivalent state with
   * different state ids.
   *
   * @param {number} id
   * @constructor
   */
  function State(id) {
    this.id = id;
  }

  State.INVALID_STATE = -1;

  /**
   * Returns a list of statements which jumps to a given destination state. If transfering control
   * to the destination state requires exiting a try of a try/finally then the finally block must
   * be executed along the way.
   *
   * @param {FinallyState} enclosingFinally
   * @param {number} fallThroughState
   * @return {Array.<ParseTree>}
   */
  State.generateJump = function(enclosingFinally, fallThroughState) {
    return createStatementList(
        State.generateAssignState(enclosingFinally, fallThroughState),
        createBreakStatement());
  }

  /**
   * Returns a list of statements which jumps to a given destination state, through a finally
   * block.
   * @param {number} finallyState
   * @param {number} destination
   * @return {Array.<ParseTree>}
   */
  State.generateJumpThroughFinally = function(finallyState, destination) {
    return createStatementList(
        State.generateAssignStateOutOfFinally_(destination, finallyState),
        createBreakStatement());
  }

  /**
   * @param {FinallyState} enclosingFinally
   * @param {number} fallThroughState
   * @return {Array.<ParseTree>}
   */
  State.generateAssignState = function(enclosingFinally, fallThroughState) {
    var assignState;
    if (isFinallyExit(enclosingFinally, fallThroughState)) {
      assignState = State.generateAssignStateOutOfFinally(enclosingFinally, fallThroughState);
    } else {
      assignState = createStatementList(createAssignStateStatement(fallThroughState));
    }
    return assignState;
  }

  /**
   * @param {FinallyState} enclosingFinally
   * @param {number} fallThroughState
   * @return {boolean}
   */
  function isFinallyExit(enclosingFinally, destination) {
    return enclosingFinally != null && enclosingFinally.tryStates.indexOf(destination) < 0;
  }

  /**
   * Generate code for a jump out of a finally block.
   * @param {FinallyState} enclosingFinally
   * @param {number} destination
   * @return {Array.<ParseTree>}
   */
  State.generateAssignStateOutOfFinally = function(enclosingFinally, destination) {
    return State.generateAssignStateOutOfFinally_(destination, enclosingFinally.finallyState);
  }

  /**
   * @param {number} destination
   * @param {number} enclosingFinally
   * @return {Array.<ParseTree>}
   */
  State.generateAssignStateOutOfFinally_ = function(destination, finallyState) {
    // $state = finallyState;
    // $fallThrough = destination;
    return createStatementList(
        createAssignStateStatement(finallyState),
        createAssignmentStatement(
            createIdentifierExpression(PredefinedName.FINALLY_FALL_THROUGH),
            createNumberLiteral(destination)));
  }

  /**
   * Helper for replaceState.
   * @param {Array.<number>} oldStates
   * @param {number} oldState
   * @param {number} newState
   */
  State.replaceStateList = function(oldStates, oldState,  newState) {
    var states = [];
    for (var i = 0; i < oldStates.length; i++) {
      states.push(State.replaceStateId(oldStates[i], oldState, newState));
    }
    return states;
  }

  /**
   * Helper for replaceState.
   * @param {number} current
   * @param {number} oldState
   * @param {number} newState
   */
  State.replaceStateId = function(current, oldState, newState) {
    return current == oldState ? newState : current;
  }

  /**
   * Helper for replaceState.
   * @param {Array.<TryState>} exceptionBlocks
   * @param {number} oldState
   * @param {number} newState
   * @return {Array.<TryState>}
   */
  State.replaceAllStates = function(exceptionBlocks, oldState, newState) {
    var result = [];
    for (var i = 0; i < exceptionBlocks.length; i++) {
      result.push(exceptionBlocks[i].replaceState(oldState, newState));
    }
    return result;
  }

  State.prototype = {
    /**
     * Transforms a state into a case clause during the final code generation pass
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {CaseClause}
     */
    transformMachineState: function(enclosingFinally, machineEndState, reporter) {
      return createCaseClause(createNumberLiteral(this.id),
          this.transform(enclosingFinally, machineEndState, reporter));
    },

    /**
     * @param {Object} labelSet    set of label strings.
     * @param {number} breakState
     * @return {State}
     */
    transformBreak: function(labelSet, breakState) {
      return this;
    },

    /**
     * @param {Object} labelSet    set of label strings.
     * @param {number} breakState
     * @param {number} continueState
     * @return {State}
     */
    transformBreakOrContinue: function(labelSet, breakState, continueState) {
      return this;
    }
  };

  // Export
  return {
    State: State
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;

  /**
   * @param {number} id
   * @param {number} fallThroughState
   * @param {Array.<ParseTree>} statements
   * @constructor
   * @extends {State}
   */
  function FallThroughState(id, fallThroughState, statements) {
    State.call(this, id);
    this.fallThroughState = fallThroughState;
    this.statements = statements;
  }
  
  traceur.inherits(FallThroughState, State, {
    __proto__: State.prototype,

    /**
     * @param {number} oldState
     * @param {number} newState
     * @return {FallThroughState}
     */
    replaceState: function(oldState, newState) {
      return new FallThroughState(
          State.replaceStateId(this.id, oldState, newState),
          State.replaceStateId(this.fallThroughState, oldState, newState),
          this.statements);
    },

    /**
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {Array.<ParseTree>}
     */
    transform: function(enclosingFinally, machineEndState, reporter) {
      var statements = [];
      statements.push.apply(statements, this.statements);
      statements.push.apply(statements,
          State.generateJump(enclosingFinally, this.fallThroughState));
      return statements;
    }
  });

  return {
    FallThroughState: FallThroughState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;

  var Kind = {
    CATCH: 'catch',
    FINALLY: 'finally'
  };

  /**
   * TryStates represent try catch/finally blocks which contain a yield. They
   * are stored as a forest of trees hung off of the StateMachine.
   *
   * TryStates are immutable.
   *
   * @param {Kind} kind
   * @param {Array.<number>} tryStates
   * @param {TryState} nestedTrys
   * @constructor
   */
  function TryState(kind, tryStates, nestedTrys) {
    this.kind = kind;
    this.tryStates = tryStates;
    this.nestedTrys = nestedTrys;
  }

  TryState.Kind = Kind;
  TryState.prototype = {
    /**
     * Helper for replaceState.
     * @param {number} oldState
     * @param {number} newState
     * @return {Array.<number>}
     */
    replaceAllStates: function(oldState, newState) {
      return State.replaceStateList(this.tryStates, oldState, newState);
    },

    /**
     * Helper for replaceState.
     * @param {number} oldState
     * @param {number} newState
     * @return {Array.<TryState>}
     */
    replaceNestedTrys: function(oldState, newState) {
      var states = [];
      for (var i = 0; i < this.nestedTrys.length; i++) {
        states.push(this.nestedTrys[i].replaceState(oldState, newState));
      }
      return states;
    }
  };

  return {
    TryState: TryState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;
  var FallThroughState = traceur.codegeneration.generator.FallThroughState;
  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createStatementList = ParseTreeFactory.createStatementList;

  /**
   * @param {number} id
   * @param {string} label
   * @constructor
   * @extends {State}
   */
  function BreakState(id, label) {
    State.call(this, id);
    this.label = label;
  }
  
  traceur.inherits(BreakState, State, {
    __proto__: State.prototype,

    /**
     * @param {number} oldState
     * @param {number} newState
     * @return {BreakState}
     */
    replaceState: function(oldState, newState) {
      return new BreakState(State.replaceStateId(this.id, oldState, newState), this.label);
    },

    /**
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {Array.<ParseTree>}
     */
    transform: function(enclosingFinally, machineEndState, reporter) {
      throw new Error('These should be removed before the transform step');
    },

    /**
     * @param {Object} labelSet
     * @param {number} breakState
     * @return {State}
     */
    transformBreak: function(labelSet, breakState) {
      if (this.label == null || this.label in labelSet) {
        return new FallThroughState(this.id, breakState, createStatementList());
      }
      return this;
    },

    /**
     * @param {Object} labelSet
     * @param {number} breakState
     * @param {number} continueState
     * @return {State}
     */
    transformBreakOrContinue: function(labelSet, breakState, continueState) {
      return this.transformBreak(labelSet, breakState);
    }
  });

  return {
    BreakState: BreakState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;
  var TryState = traceur.codegeneration.generator.TryState;

  /**
   * Represents the dispatch portion of a try/catch block in a state machine.
   * @param {string} identifier  The name of the exception variable in the catch.
   * @param {number} catchState  The start of the catch portion of the 'try/catch'.
   * @param {number} fallThroughState  The fall through state of the catch portion of the 'try/catch'.
   * @param {Array.<number>} allStates
   * @param {TryState} nestedTrys
   * @extends {TryState}
   * @constructor
   */
  function CatchState(identifier, catchState, fallThroughState, allStates,
      nestedTrys) {
    TryState.call(this, TryState.Kind.CATCH, allStates, nestedTrys);

    this.identifier = identifier;
    this.catchState = catchState;
    this.fallThroughState = fallThroughState;
  }
  
  traceur.inherits(CatchState, TryState, {
    __proto__: TryState.prototype,

    /**
     * @param {number} oldState
     * @param {number} newState
     * @return {CatchState}
     */
    replaceState: function(oldState, newState) {
      return new CatchState(
          this.identifier,
          State.replaceStateId(this.catchState, oldState, newState),
          State.replaceStateId(this.fallThroughState, oldState, newState),
          this.replaceAllStates(oldState, newState),
          this.replaceNestedTrys(oldState, newState));
    }
  });

  return {
    CatchState: CatchState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;
  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createBlock = ParseTreeFactory.createBlock;
  var createIfStatement = ParseTreeFactory.createIfStatement;

  /**
   * @param {number} id
   * @param {number} ifState
   * @param {number} elseState
   * @param {ParseTree} condition
   * @constructor
   * @extends {State}
   */
  function ConditionalState(id, ifState, elseState, condition) {
    State.call(this, id);
    this.ifState = ifState;
    this.elseState = elseState;
    this.condition = condition;
  }
  
  traceur.inherits(ConditionalState, State, {
    __proto__: State.prototype,

    /**
     * Represents the dispatch portion of an if/else block.
     * ConditionalStates are immutable.
     *
     * @param {number} oldState
     * @param {number} newState
     * @return {ConditionalState}
     */
    replaceState: function(oldState, newState) {
      return new ConditionalState(
          State.replaceStateId(this.id, oldState, newState),
          State.replaceStateId(this.ifState, oldState, newState),
          State.replaceStateId(this.elseState, oldState, newState),
          this.condition);
    },

    /**
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {Array.<ParseTree>}
     */
    transform: function(enclosingFinally, machineEndState, reporter) {
      return [
        createIfStatement(this.condition,
            createBlock(State.generateJump(enclosingFinally, this.ifState)),
            createBlock(State.generateJump(enclosingFinally, this.elseState)))];
    }
  });

  return {
    ConditionalState: ConditionalState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;
  var FallThroughState = traceur.codegeneration.generator.FallThroughState;
  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createStatementList = ParseTreeFactory.createStatementList;

  /**
   * @param {number} id
   * @param {string} label
   * @constructor
   * @extends {State}
   */
  function ContinueState(id, label) {
    State.call(this, id);
    this.label = label;
  }
  
  traceur.inherits(ContinueState, State, {
    __proto__: State.prototype,

    /**
     * @param {number} oldState
     * @param {number} newState
     * @return {ContinueState}
     */
    replaceState: function(oldState, newState) {
      return new ContinueState(State.replaceStateId(this.id, oldState, newState), this.label);
    },

    /**
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {Array.<ParseTree>}
     */
    transform: function(enclosingFinally, machineEndState, reporter) {
      throw new Error('These should be removed before the transform step');
    },

    /**
     * @param {Object} labelSet
     * @param {number} breakState
     * @param {number} continueState
     * @return {State}
     */
    transformBreakOrContinue: function(labelSet, breakState, continueState) {
      if (this.label == null || this.label in labelSet) {
        return new FallThroughState(this.id, continueState, createStatementList());
      }
      return this;
    }
  });

  return {
    ContinueState: ContinueState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;

  /**
   * @param {number} id
   * @constructor
   * @extends {State}
   */
  function EndState(id) {
    State.call(this, id);
  }

  traceur.inherits(EndState, State, {
    __proto__: State.prototype,

    /**
     * @param {number} oldState
     * @param {number} newState
     * @return {EndState}
     */
    replaceState: function(oldState, newState) {
      return new EndState(State.replaceStateId(this.id, oldState, newState));
    },

    /**
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {Array.<ParseTree>}
     */
    transform: function(enclosingFinally, machineEndState, reporter) {
      return State.generateJump(enclosingFinally, machineEndState);
    }
  });

  return {
    EndState: EndState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;

  /**
   * These are a placeholder for the fallthrough off the end of a finally block.
   * They are added so that enclosing try blocks know that jumping to them does not exit their block.
   * The code for them is generated in addFinallyFallThroughDispatches.
   * @param {number} id
   * @constructor
   * @extends {State}
   */
  function FinallyFallThroughState(id) {
    State.call(this, id);
  }

  traceur.inherits(FinallyFallThroughState, State, {
    __proto__: State.prototype,

    /**
     * @param {number} oldState
     * @param {number} newState
     * @return {FinallyFallThroughState}
     */
    replaceState: function(oldState, newState) {
      return new FinallyFallThroughState(State.replaceStateId(this.id, oldState, newState));
    },

    /**
     * Transforms a state into a case clause during the final code generation pass
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {CaseClause}
     */
    transformMachineState: function(enclosingFinally, machineEndState, reporter) {
      return null;
    },

    /**
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {Array.<ParseTree>}
     */
    transform: function(enclosingFinally, machineEndState, reporter) {
      throw new Error('these are generated in addFinallyFallThroughDispatches');
    }
  });

  return {
    FinallyFallThroughState: FinallyFallThroughState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;
  var TryState = traceur.codegeneration.generator.TryState;

  /**
   * Represents the dispatch portion of a try/catch block in a state machine.
   * @param {number} finallyState
   *    The beginning of the finally block of the try/finally.
   * @param {number} fallThroughState
   *    A state reached only by falling off of the end of the finally block of the try/finally.
   * @param {Array.<number>} allStates
   * @param {TryState} nestedTrys
   * @extends {TryState}
   * @constructor
   */
  function FinallyState(finallyState, fallThroughState, allStates, nestedTrys) {
    TryState.call(this, TryState.Kind.FINALLY, allStates, nestedTrys);

    this.finallyState = finallyState;
    this.fallThroughState = fallThroughState;
  }
  
  traceur.inherits(FinallyState, TryState, {
    __proto__: TryState.prototype,

    /**
     * @param {number} oldState
     * @param {number} newState
     * @return {FinallyState}
     */
    replaceState: function(oldState, newState) {
      return new FinallyState(
          State.replaceStateId(this.finallyState, oldState, newState),
          State.replaceStateId(this.fallThroughState, oldState, newState),
          this.replaceAllStates(oldState, newState),
          this.replaceNestedTrys(oldState, newState));
    }
  });

  return {
    FinallyState: FinallyState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var CaseClause = traceur.syntax.trees.CaseClause;
  var DefaultClause = traceur.syntax.trees.DefaultClause;
  var SwitchStatement = traceur.syntax.trees.SwitchStatement;

  var State = traceur.codegeneration.generator.State;
  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createStatementList = ParseTreeFactory.createStatementList;
  var createBreakStatement = ParseTreeFactory.createBreakStatement;

  /**
   * Represents a pair of ParseTree and integer.
   * Immutable.
   *
   * TODO: this came from Pair. Better member names?
   *
   * @param {ParseTree} first
   * @param {number} second
   * @constructor
   */
  function SwitchClause(first, second) {
    this.first = first;
    this.second = second;
    Object.freeze(this);
  }

  /**
   * Represents the dispatch portion of a switch statement that has been added
   * to a StateMachine.
   *
   * SwitchStates are immutable.
   *
   * @param {number} id
   * @param {ParseTree} expression
   * @param {Array.<SwitchClause>} clauses
   * @constructor
   * @extends {State}
   */
  function SwitchState(id, expression, clauses) {
    State.call(this, id);
    this.expression = expression;
    this.clauses = clauses;
  }

  traceur.inherits(SwitchState, State, {
    __proto__: State.prototype,

    /**
     * Represents the dispatch portion of an if/else block.
     * ConditionalStates are immutable.
     *
     * @param {number} oldState
     * @param {number} newState
     * @return {SwitchState}
     */
    replaceState: function(oldState, newState) {
      var clauses = this.clauses.map(function(clause) {
        return new SwitchClause(clause.first,
            State.replaceStateId(clause.second, oldState, newState));
      });
      return new SwitchState(
          State.replaceStateId(this.id, oldState, newState),
          this.expression,
          clauses);
    },

    /**
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {Array.<ParseTree>}
     */
    transform: function(enclosingFinally, machineEndState, reporter) {
      var clauses = [];
      for (var i = 0; i < this.clauses.length; i++) {
        var clause = this.clauses[i];
        if (clause.first == null) {
          clauses.push(new DefaultClause(null,
              State.generateJump(enclosingFinally, clause.second)));
        } else {
          clauses.push(new CaseClause(null, clause.first,
              State.generateJump(enclosingFinally, clause.second)));
        }
      }
      return createStatementList(
          new SwitchStatement(null, this.expression, clauses),
          createBreakStatement());
    }
  });

  return {
    SwitchClause: SwitchClause,
    SwitchState: SwitchState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var PredefinedName = traceur.syntax.PredefinedName;
  var State = traceur.codegeneration.generator.State;
  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createReturnStatement = ParseTreeFactory.createReturnStatement;
  var createTrueLiteral = ParseTreeFactory.createTrueLiteral;

  /**
   * Represents the dispatch portion of a switch statement that has been added
   * to a StateMachine.
   *
   * SwitchStates are immutable.
   *
   * @param {number} id
   * @param {number} fallThroughState
   * @param {ParseTree} expression
   * @constructor
   * @extends {State}
   */
  function YieldState(id, fallThroughState, expression) {
    State.call(this, id);
    this.fallThroughState = fallThroughState;
    this.expression = expression;
  }
  
  traceur.inherits(YieldState, State, {
    __proto__: State.prototype,

    /**
     * @param {number} oldState
     * @param {number} newState
     * @return {YieldState}
     */
    replaceState: function(oldState, newState) {
      return new YieldState(
          State.replaceStateId(this.id, oldState, newState),
          State.replaceStateId(this.fallThroughState, oldState, newState),
          this.expression);
    },

    /**
     * @param {FinallyState} enclosingFinally
     * @param {number} machineEndState
     * @param {ErrorReporter} reporter
     * @return {Array.<ParseTree>}
     */
    transform: function(enclosingFinally, machineEndState, reporter) {
      var result = [];
      // $result.current = expression;
      result.push(createAssignmentStatement(
          createMemberExpression(
              PredefinedName.RESULT,
              PredefinedName.CURRENT),
          this.expression));
      // either:
      //      $state = this.fallThroughState;
      //      return true;
      // or:
      //      $state = enclosingFinally.finallyState;
      //      $fallThrough = this.fallThroughState;
      //      return true;
      result.push.apply(result,
          State.generateAssignState(enclosingFinally, this.fallThroughState));
      result.push(createReturnStatement(createTrueLiteral()));
      return result;
    }
  });

  return {
    YieldState: YieldState
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var State = traceur.codegeneration.generator.State;

  /**
   * Allocates unique state identifiers.
   * @constructor
   */
  function StateAllocator() {
  }

  StateAllocator.prototype = {
    nextState_: State.INVALID_STATE + 1,

    /** @return {number} */
    allocateState: function() {
      return this.nextState_++;
    }
  };

  // Export
  return {
    StateAllocator: StateAllocator
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('syntax.trees', function() {
  'use strict';

  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var TryState = traceur.codegeneration.generator.TryState;

  /**
   * A state machine tree is the result of transforming a set of statements that contain a yield,
   * either directly or indirectly. StateMachine's break many of the design invariants in
   * the compiler around parse trees. They are only valid only as temporary entities during the
   * generator transform pass. They are not convertible (directly) to javascript code.
   *
   * State machine trees include a set of states identified by an integer id. A State represents
   * some executable statements, plus some set of possible transitions to other states.
   *
   * The exceptionBlocks member stores a tree representing the dispatch portion of all
   * try/catch/finally blocks from the original source code. The bodies of the try, catch and finally
   * blocks are transformed to States and added to the main states list.
   *
   * States and StateMachineTrees are created by a bottom up traversal of the original source.
   * When a control transfer statement (if, switch, while, for, try) contains a state machine, the
   * nested statements are converted to StateMachines, then a new machine is created which knits
   * together the states from the nested machines.
   *
   * States and StateMachineTrees are immutable.
   *
   * @param {tnumber} startState
   * @param {tnumber} fallThroughState
   * @param {Array.<State>} states
   * @param {Array.<TryState>} exceptionBlocks
   * @constructor
   * @extends {ParseTree}
   */
  function StateMachine(startState, fallThroughState, states, exceptionBlocks) {
    ParseTree.call(this, ParseTreeType.STATE_MACHINE, null);

    this.startState = startState;
    this.fallThroughState = fallThroughState;
    this.states = states;
    this.exceptionBlocks = exceptionBlocks;

    Object.freeze(this);
  }

  /**
   * @param {TryState.Kind} kind
   * @param {Object} enclosingMap map of state IDs to FinallyState.
   * @param {Array.<TryState>} tryStates
   */
  function addCatchOrFinallyStates(kind, enclosingMap, tryStates) {
    for (var i = 0; i < tryStates.length; i++) {
      var tryState = tryStates[i];
      if (tryState.kind == kind) {
        for (var j = 0; j < tryState.tryStates.length; j++) {
          var id = tryState.tryStates[j];
          enclosingMap[id] = tryState;
        }
      }
      addCatchOrFinallyStates(kind, enclosingMap, tryState.nestedTrys);
    }
  }

  /**
   * @param {Array.<TryState>} tryStates
   * @param {Array.<CatchState>} catches
   */
  function addAllCatchStates(tryStates, catches) {
    for (var i = 0; i < tryStates.length; i++) {
      var tryState = tryStates[i];
      if (tryState.kind == TryState.Kind.CATCH) {
        catches.push(tryState);
      }
      addAllCatchStates(tryState.nestedTrys, catches);
    }
  }

  traceur.inherits(StateMachine, ParseTree, {
    __proto__: ParseTree.prototype,

    /**
     * Does this machine include any try statements.
     * @return {boolean}
     */
    hasExceptionBlocks: function() {
      return this.exceptionBlocks.length > 0;
    },

    /**
     * Returns all the state ids of states in the machine. Note that the fallThroughState is
     * typically not a state in the machine.
     * @return {Array.<number>}
     */
    getAllStateIDs: function() {
      var result = [];
      for (var i = 0; i < this.states.length; i++) {
        result.push(this.states[i].id);
      }
      return result;
    },

    /**
     * Return a map from the states in the machine to their nearest enclosing finally.
     * @return {Object} map of state IDs to FinallyState.
     */
    getEnclosingFinallyMap: function() {
      var enclosingMap = Object.create(null);
      addCatchOrFinallyStates(TryState.Kind.FINALLY, enclosingMap, this.exceptionBlocks);
      return enclosingMap;
    },

    /**
     * Return a map from the states in the machine to their nearest enclosing catch.
     * @return {Object} map of state IDs to CatchState.
     */
    getEnclosingCatchMap: function() {
      var enclosingMap = Object.create(null);
      addCatchOrFinallyStates(TryState.Kind.CATCH, enclosingMap, this.exceptionBlocks);
      return enclosingMap;
    },

    allCatchStates: function() {
      var catches = [];
      addAllCatchStates(this.exceptionBlocks, catches);
      return catches;
    }
  });

  return {
    StateMachine: StateMachine
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var BreakStatement = traceur.syntax.trees.BreakStatement;
  var ContinueStatement = traceur.syntax.trees.ContinueStatement;
  var DoWhileStatement = traceur.syntax.trees.DoWhileStatement;
  var ForEachStatement = traceur.syntax.trees.ForEachStatement;
  var ForStatement = traceur.syntax.trees.ForStatement;
  var FunctionDeclaration = traceur.syntax.trees.FunctionDeclaration;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var SwitchStatement = traceur.syntax.trees.SwitchStatement;
  var WhileStatement = traceur.syntax.trees.WhileStatement;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;

  var BreakState = traceur.codegeneration.generator.BreakState;
  var ContinueState = traceur.codegeneration.generator.ContinueState;
  var State = traceur.codegeneration.generator.State;
  var StateAllocator = traceur.codegeneration.generator.StateAllocator;
  var StateMachine = traceur.syntax.trees.StateMachine;

  var VariableBinder = traceur.semantics.VariableBinder;

  /**
   * Converts statements which do not contain a yield, to a state machine. Always called from a
   * context where the containing block contains a yield. Normally this just wraps the statement into
   * a single state StateMachine. However, if the statement contains a break or continue which
   * exits the statement, then the non-local break/continue must be converted into state machines.
   *
   * Note that parents of non-local break/continue statements are themselves translated into
   * state machines by the caller.
   *
   * @param {StateAllocator} stateAllocator
   * @extends {ParseTreeTransformer}
   * @constructor
   */
  function BreakContinueTransformer(stateAllocator) {
    ParseTreeTransformer.call(this);
    this.transformBreaks_ = true;
    this.stateAllocator_ = stateAllocator;
  }

  /**
   * @param {BreakStatement|ContinueStatement} tree
   * @return {string}
   */
  function safeGetLabel(tree) {
    return tree.name ? tree.name.value : null;
  }

  var proto = ParseTreeTransformer.prototype;
  traceur.inherits(BreakContinueTransformer, ParseTreeTransformer, {
    __proto__: proto,

    /** @return {number} */
    allocateState_: function() {
      return this.stateAllocator_.allocateState();
    },

    /**
     * @param {State} newState
     * @return {StateMachibneTree}
     */
    stateToStateMachine_: function(newState) {
      // TODO: this shouldn't be required, but removing it requires making consumers resilient
      // TODO: to a machine with INVALID fallThroughState
      var fallThroughState = this.allocateState_();
      return new StateMachine(newState.id, fallThroughState, [newState], []);
    },

    /**
     * @param {BreakStatement} tree
     * @return {ParseTree}
     */
    transformBreakStatement: function(tree) {
      return this.transformBreaks_ ?
          this.stateToStateMachine_(new BreakState(this.allocateState_(), safeGetLabel(tree))) :
          tree;
    },

    /**
     * @param {ContinueStatement} tree
     * @return {ParseTree}
     */
    transformContinueStatement: function(tree) {
      return this.stateToStateMachine_(new ContinueState(this.allocateState_(), safeGetLabel(tree)));
    },

    /**
     * @param {DoWhileStatement} tree
     * @return {ParseTree}
     */
    transformDoWhileStatement: function(tree) {
      return tree;
    },

    /**
     * @param {ForEachStatement} tree
     * @return {ParseTree}
     */
    transformForEachStatement: function(tree) {
      return tree;
    },

    /**
     * @param {ForStatement} tree
     * @return {ParseTree}
     */
    transformForStatement: function(tree) {
      return tree;
    },

    /**
     * @param {FunctionDeclaration} tree
     * @return {ParseTree}
     */
    transformFunctionDeclaration: function(tree) {
      return tree;
    },

    /**
     * @param {StateMachine} tree
     * @return {ParseTree}
     */
    transformStateMachine: function(tree) {
      return tree;
    },

    /**
     * @param {SwitchStatement} tree
     * @return {ParseTree}
     */
    transformSwitchStatement: function(tree) {
      var oldState = this.transformBreaks_;
      this.transformBreaks = false;
      var result = proto.transformSwitchStatement.call(this, tree);
      this.transformBreaks_ = oldState;
      return result;
    },

    /**
     * @param {WhileStatement} tree
     * @return {ParseTree}
     */
    transformWhileStatement: function(tree) {
      return tree;
    }
  });
  
  return {
    BreakContinueTransformer: BreakContinueTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var PredefinedName = traceur.syntax.PredefinedName;

  var CaseClause = traceur.syntax.trees.CaseClause;
  var StateMachine = traceur.syntax.trees.StateMachine;
  var SwitchStatement = traceur.syntax.trees.SwitchStatement;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;

  var createArrayLiteralExpression = ParseTreeFactory.createArrayLiteralExpression;
  var createAssignStateStatement = ParseTreeFactory.createAssignStateStatement;
  var createAssignmentExpression = ParseTreeFactory.createAssignmentExpression;
  var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
  var createBinaryOperator = ParseTreeFactory.createBinaryOperator;
  var createBlock = ParseTreeFactory.createBlock;
  var createBoundCall = ParseTreeFactory.createBoundCall;
  var createBreakStatement = ParseTreeFactory.createBreakStatement;
  var createCaseClause = ParseTreeFactory.createCaseClause;
  var createCatch = ParseTreeFactory.createCatch;
  var createDefaultClause = ParseTreeFactory.createDefaultClause;
  var createEmptyParameterList = ParseTreeFactory.createEmptyParameterList;
  var createEmptyStatement = ParseTreeFactory.createEmptyStatement;
  var createExpressionStatement = ParseTreeFactory.createExpressionStatement;
  var createFunctionExpression = ParseTreeFactory.createFunctionExpression;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createIdentifierToken = ParseTreeFactory.createIdentifierToken;
  var createNumberLiteral = ParseTreeFactory.createNumberLiteral;
  var createOperatorToken = ParseTreeFactory.createOperatorToken;
  var createStatementList = ParseTreeFactory.createStatementList;
  var createStringLiteral = ParseTreeFactory.createStringLiteral;
  var createSwitchStatement = ParseTreeFactory.createSwitchStatement;
  var createThisExpression = ParseTreeFactory.createThisExpression;
  var createThrowStatement = ParseTreeFactory.createThrowStatement;
  var createTrueLiteral = ParseTreeFactory.createTrueLiteral;
  var createTryStatement = ParseTreeFactory.createTryStatement;
  var createVariableStatement = ParseTreeFactory.createVariableStatement;
  var createWhileStatement = ParseTreeFactory.createWhileStatement;

  var BreakState = traceur.codegeneration.generator.BreakState;
  var BreakContinueTransformer = traceur.codegeneration.generator.BreakContinueTransformer;
  var CatchState = traceur.codegeneration.generator.CatchState;
  var ConditionalState = traceur.codegeneration.generator.ConditionalState;
  var ContinueState = traceur.codegeneration.generator.ContinueState;
  var EndState = traceur.codegeneration.generator.EndState;
  var FallThroughState = traceur.codegeneration.generator.FallThroughState;
  var FinallyFallThroughState = traceur.codegeneration.generator.FinallyFallThroughState;
  var FinallyState = traceur.codegeneration.generator.FinallyState;
  var ForInTransformPass = traceur.codegeneration.generator.ForInTransformPass;
  var State = traceur.codegeneration.generator.State;
  var StateAllocator = traceur.codegeneration.generator.StateAllocator;
  var StateMachine = traceur.syntax.trees.StateMachine;
  var SwitchState = traceur.codegeneration.generator.SwitchState;
  var SwitchClause = traceur.codegeneration.generator.SwitchClause;
  var TryState = traceur.codegeneration.generator.TryState;
  var YieldState = traceur.codegeneration.generator.YieldState;

  var VariableBinder = traceur.semantics.VariableBinder;

  /**
   * Performs a CPS transformation on a method body.
   *
   * The conversion transformation proceeds bottom up. At the bottom Yield statements are converted
   * to a state machine, then when a transformed child statement is a state machine, the parent
   * statement is converted into a state machine.
   *
   * At the top level the state machine is translated into this method:
   *
   *      (function() {
   *       while (true) {
   *         try {
   *           switch ($state) {
   *           ... converted states ...
   *           case rethrow:
   *             throw $storedException;
   *           }
   *         } catch ($caughtException) {
   *           $storedException = $caughtException;
   *           switch ($state) {
   *           case enclosing_finally:
   *             $state = finally.startState;
   *             $fallThrough = rethrow;
   *             break;
   *           case enclosing_catch:
   *             $state = catch.startState;
   *             break;
   *           case enclosing_catch_around_finally:
   *             $state = finally.startState;
   *             $fallThrough = catch.startState;
   *             break;
   *           default:
   *             throw $storedException;
   *           }
   *         }
   *       }
   *     }).bind($that)
   *
   * Each state in a state machine is identified by an integer which is unique across the entire
   * function body. The state machine merge process may need to perform state id substitution on
   * states of the merged state machines.
   *
   * @param {ErrorReporter} reporter
   * @extends {ParseTreeTransformer}
   * @constructor
   */
  function CPSTransformer(reporter) {
    ParseTreeTransformer.call(this);
    this.reporter = reporter;
    this.stateAllocator_ = new StateAllocator();
    this.labelSet_ = Object.create(null);
  }

  var proto = ParseTreeTransformer.prototype;
  traceur.inherits(CPSTransformer, ParseTreeTransformer, {
    __proto__: proto,

    /** @return {number} */
    allocateState: function() {
      return this.stateAllocator_.allocateState();
    },

    /**
     * If a block contains a statement which has been transformed into a state machine, then
     * all statements are forcibly transformed into a state machine, then the machines are
     * knitted together.
     * @param {Block} tree
     * @return {ParseTree}
     */
    transformBlock: function(tree) {
      // NOTE: tree may contain state machines already ...
      this.clearLabels_();
      var transformedTree = proto.transformBlock.call(this, tree);
      var machine = this.transformStatementList_(transformedTree.statements);
      return machine == null ? transformedTree : machine;
    },

    /**
     * @param {Array.<ParseTree>} someTransformed
     * @return {StateMachine}
     */
    transformStatementList_: function(someTransformed) {
      // This block has undergone some transformation but may only be variable transforms
      // We only need to return a state machine if the block contains a yield which has been converted
      // to a state machine.
      if (!this.containsStateMachine_(someTransformed)) {
        return null;
      }

      // this block contains at least 1 yield statement which has been transformed into a
      // StateMachine. Transform all remaining statements into StateMachines then sequence
      // them together.
      var currentMachine = this.ensureTransformed_(someTransformed[0]);
      for (var index = 1; index < someTransformed.length; index++) {
        currentMachine = this.createSequence_(currentMachine,
            this.ensureTransformed_(someTransformed[index]));
      }

      return currentMachine;
    },

    /**
     * @param {Array.<ParseTree>|SwitchStatement} statements
     * @return {boolean}
     */
    containsStateMachine_: function(statements) {
      if (statements instanceof Array) {
        for (var i = 0; i < statements.length; i++) {
          if (statements[i].type == ParseTreeType.STATE_MACHINE) {
            return true;
          }
        }
        return false;
      }

      traceur.assert(statements instanceof SwitchStatement);
      for (var i = 0; i < statements.caseClauses.length; i++) {
        var clause = statements.caseClauses[i];
        if (clause.type == ParseTreeType.CASE_CLAUSE) {
          if (this.containsStateMachine_(clause.statements)) {
            return true;
          }
        } else {
          if (this.containsStateMachine_(clause.statements)) {
            return true;
          }
        }
      }
      return false;
    },

    /**
     * @param {CaseClause} tree
     * @return {ParseTree}
     */
    transformCaseClause: function(tree) {
      var result = proto.transformCaseClause.call(this, tree);
      var machine = this.transformStatementList_(result.statements);
      return machine == null ?
          result :
          new CaseClause(null, result.expression, createStatementList(machine));
    },

    /**
     * @param {DoWhileStatement} tree
     * @return {ParseTree}
     */
    transformDoWhileStatement: function(tree) {
      var labels = this.clearLabels_();

      var result = proto.transformDoWhileStatement.call(this, tree);
      if (result.body.type != ParseTreeType.STATE_MACHINE) {
        return result;
      }

      // a yield within a do/while loop
      var loopBodyMachine = result.body;
      var startState = loopBodyMachine.startState;
      var conditionState = loopBodyMachine.fallThroughState;
      var fallThroughState = this.allocateState();

      var states = [];

      this.addLoopBodyStates_(loopBodyMachine, conditionState, fallThroughState, labels, states);
      states.push(new ConditionalState(conditionState, startState, fallThroughState,
          result.condition));

      return new StateMachine(startState, fallThroughState, states,
          loopBodyMachine.exceptionBlocks);
    },

    /**
     * @param {StateMachine} loopBodyMachine
     * @param {number} continueState
     * @param {number} breakState
     * @param {Object} labels
     * @param {Array.<State>} states
     */
    addLoopBodyStates_: function(loopBodyMachine, continueState, breakState,
        labels, states) {
      for (var i = 0; i < loopBodyMachine.states.length; i++) {
        var state = loopBodyMachine.states[i];
        states.push(state.transformBreakOrContinue(labels, breakState, continueState));
      }
    },

    /**
     * @param {ForStatement} tree
     * @return {ParseTree}
     */
    transformForStatement: function(tree) {
      var labels = this.clearLabels_();

      var result = proto.transformForStatement.call(this, tree);
      if (result.body.type != ParseTreeType.STATE_MACHINE) {
        return result;
      }

      // a yield within the body of a 'for' statement
      var loopBodyMachine = result.body;

      var incrementState = loopBodyMachine.fallThroughState;
      var conditionState = result.increment == null && result.condition != null ?
          incrementState :
          this.allocateState();
      var startState = result.initializer == null ?
          conditionState :
          this.allocateState();
      var fallThroughState = this.allocateState();

      var states = [];
      if (result.initializer != null) {
        states.push(new FallThroughState(
            startState,
            conditionState,
            createStatementList(createExpressionStatement(result.initializer))));
      }
      if (result.condition != null) {
        states.push(new ConditionalState(
            conditionState,
            loopBodyMachine.startState,
            fallThroughState,
            result.condition));
      } else {
        // alternative is to renumber the loopbodyMachine.fallThrough to loopbodyMachine.start
        states.push(new FallThroughState(conditionState, loopBodyMachine.startState,
            createStatementList()));
      }
      if (result.increment != null) {
        states.push(new FallThroughState(
            incrementState,
            conditionState,
            createStatementList(
                createExpressionStatement(result.increment))));
      }
      this.addLoopBodyStates_(loopBodyMachine, incrementState, fallThroughState, labels, states);
      return new StateMachine(startState, fallThroughState, states,
          loopBodyMachine.exceptionBlocks);
    },

    /**
     * @param {ForInStatement} tree
     * @return {ParseTree}
     */
    transformForInStatement: function(tree) {
      // The only for in statement left is from the ForInTransformPass. Just pass it through.
      return tree;
    },

    /**
     * @param {ForEachStatement} tree
     * @return {ParseTree}
     */
    transformForEachStatement: function(tree) {
      throw new Error('foreach statements should be transformed before this pass');
    },

    /**
     * @param {IfStatement} tree
     * @return {ParseTree}
     */
    transformIfStatement: function(tree) {
      this.clearLabels_();

      var result = proto.transformIfStatement.call(this, tree);
      if (result.ifClause.type != ParseTreeType.STATE_MACHINE &&
          (result.elseClause == null || result.elseClause.type != ParseTreeType.STATE_MACHINE)) {
        return result;
      }

      // if containing a yield
      var ifClause = this.ensureTransformed_(result.ifClause);
      var elseClause = this.ensureTransformed_(result.elseClause);

      var startState = this.allocateState();
      var fallThroughState = ifClause.fallThroughState;
      var ifState = ifClause.startState;
      var elseState = elseClause == null ? fallThroughState : elseClause.startState;

      var states = [];
      var exceptionBlocks = [];

      states.push(new ConditionalState(
          startState,
          ifState,
          elseState,
          result.condition));
      states.push.apply(states, ifClause.states);
      exceptionBlocks.push.apply(exceptionBlocks, ifClause.exceptionBlocks);
      if (elseClause != null) {
        this.replaceAndAddStates_(
            elseClause.states,
            elseClause.fallThroughState,
            fallThroughState,
            states);
        exceptionBlocks.push.apply(exceptionBlocks,
            State.replaceAllStates(elseClause.exceptionBlocks,
            elseClause.fallThroughState, fallThroughState));
      }

      return new StateMachine(startState, fallThroughState, states,
          exceptionBlocks);
    },

    /**
     * @param {Array.<State>} oldStates
     * @param {number} oldState
     * @param {number} newState
     * @param {Array.<State>} newStates
     */
    replaceAndAddStates_: function(oldStates, oldState, newState, newStates) {
      for (var i = 0; i < oldStates.length; i++) {
        newStates.push(oldStates[i].replaceState(oldState, newState));
      }
    },

    /**
     * @param {LabelledStatement} tree
     * @return {ParseTree}
     */
    transformLabelledStatement: function(tree) {
      var oldLabels = this.addLabel_(tree.name.value);

      var result = this.transformAny(tree.statement);

      this.restoreLabels_(oldLabels);

      return result;
    },

    clearLabels_: function() {
      var result = this.labelSet_;
      this.labelSet_ = Object.create(null);
      return result;
    },

    restoreLabels_: function(oldLabels) {
      this.labelSet_ = oldLabels;
    },

    /**
     * Adds a label to the current label set. Returns the OLD label set.
     * @param {string} label
     * @return {Object}
     */
    addLabel_: function(label) {
      var oldLabels = this.labelSet_;

      var labelSet = Object.create(null);
      for (var k in this.labelSet_) {
        labelSet[k] = k;
      }
      labelSet[label] = label;
      this.labelSet_ = labelSet;

      return oldLabels;
    },

    /**
     * @param {SwitchStatement} tree
     * @return {ParseTree}
     */
    transformSwitchStatement: function(tree) {
      var labels = this.clearLabels_();

      var result = proto.transformSwitchStatement.call(this, tree);
      if (!this.containsStateMachine_(result)) {
        return result;
      }

      // a yield within a switch statement
      var startState = this.allocateState();
      var fallThroughState = this.allocateState();
      var nextState = fallThroughState;
      var states = [];
      var clauses = [];
      var tryStates = [];
      var hasDefault = false;

      for (var index = result.caseClauses.length - 1; index >= 0; index--) {
        var clause = result.caseClauses[index];
        if (clause.type == ParseTreeType.CASE_CLAUSE) {
          var caseClause = clause;
          nextState = this.addSwitchClauseStates_(nextState, fallThroughState,
              labels, caseClause.statements, states, tryStates);
          clauses.push(new SwitchClause(caseClause.expression, nextState));
        } else {
          hasDefault = true;
          var defaultClause = clause;
          nextState = this.addSwitchClauseStates_(nextState, fallThroughState,
              labels, defaultClause.statements, states, tryStates);
          clauses.push(new SwitchClause(null, nextState));
        }
      }
      if (!hasDefault) {
        clauses.push(new SwitchClause(null, fallThroughState));
      }
      states.push(new SwitchState(startState, result.expression, clauses.reverse()));

      return new StateMachine(startState, fallThroughState, states.reverse(),
          tryStates);
    },

    /**
     * @param {number} nextState
     * @param {number} fallThroughState
     * @param {Object} labels
     * @param {Array.<ParseTree>} statements
     * @param {Array.<ParseTree>} states
     * @param {Array.<TryState>} tryStates
     * @return {number}
     */
    addSwitchClauseStates_: function(nextState, fallThroughState, labels,
        statements, states, tryStates) {
      var machine = this.ensureTransformedList_(statements);
      for (var i = 0; i < machine.states.length; i++) {
        var state = machine.states[i];
        var transformedState = state.transformBreak(labels, fallThroughState);
        states.push(transformedState.replaceState(machine.fallThroughState, nextState));
      }
      tryStates.push.apply(tryStates, machine.exceptionBlocks);
      return machine.startState;
    },

    /**
     * @param {TryStatement} tree
     * @return {ParseTree}
     */
    transformTryStatement: function(tree) {
      this.clearLabels_();

      var result = proto.transformTryStatement.call(this, tree);
      if (result.body.type != ParseTreeType.STATE_MACHINE && (result.catchBlock == null ||
          result.catchBlock.catchBody.type != ParseTreeType.STATE_MACHINE)) {
        return result;
      }
      // NOTE: yield inside finally caught in FinallyBlock transform methods

      var tryMachine = this.ensureTransformed_(result.body);
      if (result.catchBlock != null) {
        var catchBlock = result.catchBlock;
        var exceptionName = catchBlock.exceptionName.value;
        var catchMachine = this.ensureTransformed_(catchBlock.catchBody);
        var startState = tryMachine.startState;
        var fallThroughState = tryMachine.fallThroughState;

        var catchStart = this.allocateState();

        var states = [];
        states.push.apply(states, tryMachine.states);
        states.push(
            new FallThroughState(
                catchStart,
                catchMachine.startState,
                // exceptionName = $storedException;
                createStatementList(
            createAssignmentStatement(
            createIdentifierExpression(exceptionName),
            createIdentifierExpression(PredefinedName.STORED_EXCEPTION)))));
        this.replaceAndAddStates_(catchMachine.states, catchMachine.fallThroughState, fallThroughState,
            states);

        tryMachine = new StateMachine(
            startState,
            fallThroughState,
            states,
            [new CatchState(
                exceptionName,
                catchStart,
                fallThroughState,
                tryMachine.getAllStateIDs(),
                tryMachine.exceptionBlocks)]);
      }
      if (result.finallyBlock != null) {
        var finallyBlock = result.finallyBlock;
        var finallyMachine = this.ensureTransformed_(finallyBlock.block);
        var startState = tryMachine.startState;
        var fallThroughState = tryMachine.fallThroughState;

        var states = [];
        states.push.apply(states, tryMachine.states);
        states.push.apply(states, finallyMachine.states);
        states.push(new FinallyFallThroughState(finallyMachine.fallThroughState));

        // NOTE: finallyMachine.fallThroughState == FinallyState.fallThroughState is code generated
        // NOTE: in addFinallyFallThroughDispatches
        tryMachine = new StateMachine(
            startState,
            fallThroughState,
            states,
            [new FinallyState(
                finallyMachine.startState,
                finallyMachine.fallThroughState,
                tryMachine.getAllStateIDs(),
                tryMachine.exceptionBlocks)]);
      }

      return tryMachine;
    },

    /**
     * Local variables are lifted out of moveNext to the enclosing function in the generated code.
     * Because of this there's no good way to codegen block scoped let/const variables where there
     * is a yield in the scope of the block scoped variable.
     *
     * @param {VariableStatement} tree
     * @return {ParseTree}
     */
    transformVariableStatement: function(tree) {
      var declarations = this.transformVariableDeclarationList(tree.declarations);
      if (declarations == tree.declarations) {
        return tree;
      }
      if (declarations == null) {
        return createEmptyStatement();
      }
      if (declarations.type == ParseTreeType.VARIABLE_DECLARATION_LIST) {
        // let/const - just transform for now
        return createVariableStatement(declarations);
      }
      return createExpressionStatement(declarations);
    },

    /**
     * This is the initializer of a for loop. Convert into an expression containing the initializers.
     *
     * @param {VariableDeclarationList} tree
     * @return {ParseTree}
     */
    transformVariableDeclarationList: function(tree) {
      if (tree.declarationType == TokenType.VAR) {
        var expressions = [];
        for (var i = 0; i < tree.declarations.length; i++) {
          var declaration = tree.declarations[i];
          if (declaration.initializer != null) {
            expressions.push(createAssignmentExpression(
                this.transformAny(declaration.lvalue),
                this.transformAny(declaration.initializer)));
          }
        }
        var list = expressions;
        if (list.length == 0) {
          return null;
        } else if (list.length == 1) {
          return list[0];
        } else {
          // CONSIDER: a better way to execute a sequence of expressions and discard the results?
          return createArrayLiteralExpression(expressions);
        }
      }
      // let/const - just transform for now
      return proto.transformVariableDeclarationList.call(this, tree);
    },

    /**
     * @param {WhileStatement} tree
     * @return {ParseTree}
     */
    transformWhileStatement: function(tree) {
      var labels = this.clearLabels_();

      var result = proto.transformWhileStatement.call(this, tree);
      if (result.body.type != ParseTreeType.STATE_MACHINE) {
        return result;
      }

      // a yield within a while loop
      var loopBodyMachine = result.body;
      var startState = loopBodyMachine.fallThroughState;
      var fallThroughState = this.allocateState();

      var states = [];

      states.push(new ConditionalState(
          startState,
          loopBodyMachine.startState,
          fallThroughState,
          result.condition));
      this.addLoopBodyStates_(loopBodyMachine, startState, fallThroughState, labels, states);

      return new StateMachine(startState, fallThroughState, states,
          loopBodyMachine.exceptionBlocks);
    },

    /**
     * @param {WithStatement} tree
     * @return {ParseTree}
     */
    transformWithStatement: function(tree) {
      var result = proto.transformWithStatement.call(this, tree);
      if (result.body.type != ParseTreeType.STATE_MACHINE) {
        return result;
      }
      throw new Error('Unreachable - with statement not allowed in strict mode/harmony');
    },

    /**
     * @param {ThisExpression} tree
     * @return {ParseTree}
     */
    transformThisExpression: function(tree) {
      // TODO: this can be removed...
      return createIdentifierExpression(PredefinedName.THAT);
    },

    //      (function() {
    //       while (true) {
    //         try {
    //           switch ($state) {
    //           ... converted states ...
    //           case rethrow:
    //             throw $storedException;
    //           }
    //         } catch ($caughtException) {
    //           $storedException = $caughtException;
    //           switch ($state) {
    //           case enclosing_finally:
    //             $state = finally.startState;
    //             $fallThrough = rethrow;
    //             break;
    //           case enclosing_catch:
    //             $state = catch.startState;
    //             break;
    //           case enclosing_catch_around_finally:
    //             $state = finally.startState;
    //             $fallThrough = catch.startState;
    //             break;
    //           default:
    //             throw $storedException;
    //           }
    //         }
    //       }
    //     }).bind($that)
    /**
     * @param {StateMachine} machine
     * @return {CallExpression}
     */
    generateMachineMethod: function(machine) {
      //  (function() {
      return createBoundCall(
          createFunctionExpression(createEmptyParameterList(),
              //     while (true) {
              createBlock(createWhileStatement(
                  createTrueLiteral(),
                  this.generateMachine(machine)))),
          //       }
          //     }
          // }).bind($that);
          createIdentifierExpression(PredefinedName.THAT));
    },

    /** @return {VariableStatement} */
    generateHoistedThis: function() {
      // Hoist 'this' argument for later bind-ing.
      //   var $that = this;
      return createVariableStatement(TokenType.VAR, PredefinedName.THAT,
          createThisExpression());
    },

    /**
     * @param {StateMachine} machine
     * @return {ParseTree}
     */
    generateMachine: function(machine) {
      var enclosingFinallyState = machine.getEnclosingFinallyMap();
      var enclosingCatchState = machine.getEnclosingCatchMap();
      var rethrowState = this.allocateState();
      var machineEndState = this.allocateState();
      var body =
          //       switch ($state) {
          createSwitchStatement(createIdentifierExpression(PredefinedName.STATE),
          //       ... converted states
          this.transformMachineStates(machine, machineEndState, rethrowState, enclosingFinallyState));

      // try {
      //   ...
      // } catch ($caughtException) {
      //   $storedException = $caughtException;
      //   switch ($state) {
      //   case enclosing_finally:
      //     $state = finally.startState;
      //     $fallThrough = rethrow;
      //     break;
      //   case enclosing_catch:
      //     $state = catch.startState;
      //     break;
      //   case enclosing_catch_around_finally:
      //     $state = finally.startState;
      //     $fallThrough = catch.startState;
      //     break;
      //   default:
      //     throw $storedException;
      //   }
      // }
      var caseClauses = [];
      this.addExceptionCases_(rethrowState, enclosingFinallyState,
          enclosingCatchState, machine.getAllStateIDs(), caseClauses);
      //   default:
      //     throw $storedException;
      caseClauses.push(createDefaultClause(this.machineUncaughtExceptionStatements(rethrowState)));

      // try {
      //   ...
      // } catch ($caughtException) {
      //   $storedException = $caughtException;
      //   switch ($state) {
      body = createTryStatement(
          createBlock(body),
          createCatch(
              createIdentifierToken(PredefinedName.CAUGHT_EXCEPTION),
              createBlock(
                  createAssignmentStatement(
                      createIdentifierExpression(PredefinedName.STORED_EXCEPTION),
                      createIdentifierExpression(PredefinedName.CAUGHT_EXCEPTION)),
                  createSwitchStatement(
                      createIdentifierExpression(PredefinedName.STATE),
                      caseClauses))),
          null);

      return body;
    },

    //   var $state = machine.startState;
    //   var $storedException;
    //   var $finallyFallThrough;
    //   ... lifted local variables ...
    //   ... caught exception variables ...
    /**
     * @param {Block} tree
     * @param {StateMachine} machine
     * @return {Array.<ParseTree>}
     */
    getMachineVariables: function(tree, machine) {

      var statements = [];

      //   var $state = machine.startState;
      statements.push(createVariableStatement(TokenType.VAR, PredefinedName.STATE,
          createNumberLiteral(machine.startState)));

      // var $storedException;
      statements.push(createVariableStatement(TokenType.VAR, PredefinedName.STORED_EXCEPTION, null));

      // var $finallyFallThrough;
      statements.push(
          createVariableStatement(TokenType.VAR, PredefinedName.FINALLY_FALL_THROUGH, null));

      // Lift locals ...
      var liftedIdentifiers =
          VariableBinder.variablesInBlock(tree, true);

      // ... and caught exceptions
      // TODO: this changes the scope of caught exception variables from 'let to 'var'.
      // Fix this once we have 'let' bindings in V8.
      var allCatchStates = machine.allCatchStates();
      for (var i = 0; i < allCatchStates.length; i++) {
        liftedIdentifiers[allCatchStates[i].identifier] = true;
      }

      // Sort identifiers to produce a stable output order
      var liftedIdentifierList = Object.keys(liftedIdentifiers).sort();
      for (var i = 0; i < liftedIdentifierList.length; i++) {
        var liftedIdentifier = liftedIdentifierList[i];
        statements.push(createVariableStatement(TokenType.VAR, liftedIdentifier, null));
      }

      return statements;
    },

    /**
     * @param {number} rethrowState
     * @param {Object} enclosingFinallyState
     * @param {Object} enclosingCatchState
     * @param {Array.<number>} allStates
     * @param {Array.<number>} caseClauses
     */
    addExceptionCases_: function(rethrowState, enclosingFinallyState,
        enclosingCatchState, allStates, caseClauses) {

      for (var i = 0; i < allStates.length; i++) {
        var state = allStates[i];
        var finallyState = enclosingFinallyState[state];
        var catchState = enclosingCatchState[state];
        if (catchState != null && finallyState != null &&
            catchState.tryStates.indexOf(finallyState.finallyState) >= 0) {
          // we have:
          //   try { try { ... } finally {} } catch (e) {}
          //
          // Generate:
          // case state:
          //   $state = finallyState.finallyState;
          //   $fallThrough = catchState.catchState;
          //   break;
          caseClauses.push(
              createCaseClause(
                  createNumberLiteral(state),
                  State.generateJumpThroughFinally(finallyState.finallyState,
                      catchState.catchState)));
        } else if (catchState != null) {
          // we have:
          //   try { ... } catch (e) {}
          // Generate:
          // case state:
          //   $state = catchState.catchState;
          //   break;
          caseClauses.push(
              createCaseClause(
                  createNumberLiteral(state),
                  createStatementList(
                      createAssignStateStatement(catchState.catchState),
                      createBreakStatement())));
        } else if (finallyState != null) {
          // we have:
          //   try { ... } finally {}
          // Generate:
          // case state:
          //   $state = finallyState.startState;
          //   $fallThrough = rethrowState;
          //   break;
          caseClauses.push(
              createCaseClause(
                  createNumberLiteral(state),
                  State.generateJumpThroughFinally(finallyState.finallyState, rethrowState)));
        } else {
          // we have no try's around this state.
          // Generate Nothing.
        }
      }
    },

    /**
     * @param {FunctionDeclaration} tree
     * @return {ParseTree}
     */
    transformFunctionDeclaration: function(tree) {
      this.clearLabels_();
      // nested functions have already been transformed
      return tree;
    },

    /**
     * @param {GetAccessor} tree
     * @return {ParseTree}
     */
    transformGetAccessor: function(tree) {
      // nested functions have already been transformed
      return tree;
    },

    /**
     * @param {SetAccessor} tree
     * @return {ParseTree}
     */
    transformSetAccessor: function(tree) {
      // nested functions have already been transformed
      return tree;
    },

    /**
     * @param {StateMachine} tree
     * @return {ParseTree}
     */
    transformStateMachine: function(tree) {
      return tree;
    },

    /**
     * Converts a statement into a state machine. The statement may not contain a yield
     * statement directly or indirectly.
     * @param {ParseTree} statements
     * @return {StateMachine}
     */
    statementToStateMachine_: function(statement) {
      return this.statementsToStateMachine_([statement]);
    },

    /**
     * Converts a list of statements into a state machine. The statements may not contain a yield
     * statement directly or indirectly.
     * @param {Array.<ParseTree>} statements
     * @return {StateMachine}
     */
    statementsToStateMachine_: function(statements) {
      var startState = this.allocateState();
      var fallThroughState = this.allocateState();
      return this.stateToStateMachine_(
          new FallThroughState(
              startState,
              fallThroughState,
              statements),
          fallThroughState);
    },

    /**
     * @param {State} newState
     * @param {number} fallThroughState
     * @return {StateMachibneTree}
     */
    stateToStateMachine_: function(newState, fallThroughState) {
      return new StateMachine(newState.id, fallThroughState,
          [newState], []);
    },

    /**
     * Transforms all the machine states into a list of case clauses. Adds a rethrow clause if the
     * machine has any try blocks. Also adds a 'default' clause which indicates a compiler bug in
     * the state machine generation.
     * @param {StateMachine} machine
     * @param {number} machineEndState
     * @param {number} rethrowState
     * @param {Object} enclosingFinallyState
     * @return {Array.<ParseTree>}
     */
    transformMachineStates: function(machine, machineEndState, rethrowState,
        enclosingFinallyState) {
      var cases = [];

      for (var i = 0; i < machine.states.length; i++) {
        var state = machine.states[i];
        var stateCase = state.transformMachineState(enclosingFinallyState[state.id],
            machineEndState, this.reporter);
        if (stateCase != null) {
          cases.push(stateCase);
        }
      }

      // add finally fallthrough dispatch states
      this.addFinallyFallThroughDispatches(null, machine.exceptionBlocks, cases);

      // case machine.fallThroughState: return false;
      cases.push(createCaseClause(createNumberLiteral(machine.fallThroughState),
          this.machineFallThroughStatements(machineEndState)));

      // case machineEndState: return false;
      cases.push(createCaseClause(createNumberLiteral(machineEndState),
          this.machineEndStatements()));

      // add top level rethrow exception state
      // case rethrow:
      //   throw $storedException;
      cases.push(createCaseClause(
          createNumberLiteral(rethrowState),
          this.machineRethrowStatements(machineEndState)));

      // default: throw "traceur compiler bug invalid state in state machine";
      cases.push(createDefaultClause(
          [createThrowStatement(
              createBinaryOperator(
                  createStringLiteral('traceur compiler bug: invalid state in state machine'),
                  createOperatorToken(TokenType.PLUS),
                  createIdentifierExpression(PredefinedName.STATE)))]));
      return cases;
    },

    /**
     * @param {FinallyState} enclosingFinallyState
     * @param {Array.<TryState>} tryStates
     * @param {Array.<ParseTree>} cases
     */
    addFinallyFallThroughDispatches: function(enclosingFinallyState, tryStates,
        cases) {

      for (var i = 0; i < tryStates.length; i++) {
        var tryState = tryStates[i];
        if (tryState.kind == TryState.Kind.FINALLY) {
          var finallyState = tryState;

          if (enclosingFinallyState != null) {
            var caseClauses = [];
            var index = 0;
            // CONSIDER: the actual list is much less than enclosingFinallyState.tryStates
            // CONSIDER: it is actually only jump destinations plus catch starts
            for (var j = 0; j < enclosingFinallyState.tryStates.length; j++) {
              var destination = enclosingFinallyState.tryStates[j];
              index++;
              var statements;
              // all but the last case fallthrough to the last case clause
              if (index < enclosingFinallyState.tryStates.length) {
                statements = createStatementList();
              } else {
                statements = createStatementList(
                    // $state = $fallThrough;
                    createAssignmentStatement(
                        createIdentifierExpression(PredefinedName.STATE),
                        createIdentifierExpression(PredefinedName.FINALLY_FALL_THROUGH)),
                    // $fallThrough = INVALID_STATE;
                    createAssignmentStatement(
                        createIdentifierExpression(PredefinedName.FINALLY_FALL_THROUGH),
                        createNumberLiteral(State.INVALID_STATE)),
                    // break;
                    createBreakStatement());
              }
              caseClauses.push(createCaseClause(createNumberLiteral(destination), statements));
            }
            caseClauses.push(createDefaultClause(createStatementList(
                // $state = enclosingFinallyState.startState;
                createAssignStateStatement(enclosingFinallyState.finallyState),
                // break;
                createBreakStatement())));

            // case finally.fallThroughState:
            //   switch ($fallThrough) {
            //   case enclosingFinally.tryStates:
            //   ...
            //     $state = $fallThrough;
            //     $fallThrough = INVALID_STATE;
            //     break;
            //   default:
            //     $state = enclosingFinallyBlock.startState;
            //     break;
            //   }
            //   break;
            cases.push(
                createCaseClause(
                    createNumberLiteral(finallyState.fallThroughState),
                    createStatementList(
                        createSwitchStatement(
                            createIdentifierExpression(PredefinedName.FINALLY_FALL_THROUGH),
                            caseClauses),
                        createBreakStatement())));
          } else {
            // case finally.fallThroughState:
            //   $state = $fallThrough;
            //   break;
            cases.push(
                createCaseClause(
                    createNumberLiteral(finallyState.fallThroughState),
                    createStatementList(
                        createAssignmentStatement(
                            createIdentifierExpression(PredefinedName.STATE),
                            createIdentifierExpression(PredefinedName.FINALLY_FALL_THROUGH)),
                        createBreakStatement())));
          }
          this.addFinallyFallThroughDispatches(
              finallyState,
              finallyState.nestedTrys,
              cases);
        } else {
          this.addFinallyFallThroughDispatches(
              enclosingFinallyState,
              tryState.nestedTrys,
              cases);
        }
      }
    },

    /**
     * Returns a new state machine which will run head, then run tail.
     * @param {StateMachine} head
     * @param {StateMachine} tail
     * @return {StateMachine}
     */
    createSequence_: function(head, tail) {
      var states = [];

      states.push.apply(states, head.states);
      for (var i = 0; i < tail.states.length; i++) {
        var tailState = tail.states[i];
        states.push(tailState.replaceState(tail.startState, head.fallThroughState));
      }

      var exceptionBlocks = [];
      exceptionBlocks.push.apply(exceptionBlocks, head.exceptionBlocks);
      for (var i = 0; i < tail.exceptionBlocks.length; i++) {
        var tryState = tail.exceptionBlocks[i];
        exceptionBlocks.push(tryState.replaceState(tail.startState, head.fallThroughState));
      }

      return new StateMachine(
          head.startState,
          tail.fallThroughState,
          states,
          exceptionBlocks);
    },


    /**
     * transforms break/continue statements and their parents to state machines
     * @param {ParseTree} maybeTransformedStatement
     * @return {ParseTree}
     */
    maybeTransformStatement_: function(maybeTransformedStatement) {
      // Check for block scoped variables in a block containing a yield. There's
      // no way to codegen that with a precompiler but could be implemented directly in a VM.
      if (maybeTransformedStatement.type == ParseTreeType.VARIABLE_STATEMENT &&
          maybeTransformedStatement.declarations.declarationType !=
              TokenType.VAR) {
        this.reporter.reportError(
            maybeTransformedStatement.location != null ?
                maybeTransformedStatement.location.start :
                null,
            'traceur: const/let declaration may not be in a block containing a yield.');
      }

      // transform break/continue statements and their parents to state machines
      var breakContinueTransformed =
          new BreakContinueTransformer(this.stateAllocator_).transformAny(maybeTransformedStatement);
      if (breakContinueTransformed != maybeTransformedStatement) {
        breakContinueTransformed = this.transformAny(breakContinueTransformed);
      }
      return breakContinueTransformed;
    },

    /**
     * Ensure that a statement has been transformed into a state machine.
     * @param {ParseTree} statement
     * @return {StateMachine}
     */
    ensureTransformed_: function(statement) {
      if (statement == null) {
        return null;
      }
      var maybeTransformed = this.maybeTransformStatement_(statement);
      return maybeTransformed.type == ParseTreeType.STATE_MACHINE ?
          maybeTransformed :
          this.statementToStateMachine_(maybeTransformed);
    },

    /**
     * Ensure that a statement has been transformed into a state machine.
     * @param {Array.<ParseTree>} statements
     * @return {StateMachine}
     */
    ensureTransformedList_: function(statements) {
      var maybeTransformedStatements = [];
      var foundMachine = false;
      for (var i = 0; i < statements.length; i++) {
        var statement = statements[i];
        var maybeTransformedStatement = this.maybeTransformStatement_(statement);
        maybeTransformedStatements.push(maybeTransformedStatement);
        if (maybeTransformedStatement.type == ParseTreeType.STATE_MACHINE) {
          foundMachine = true;
        }
      }
      if (!foundMachine) {
        return this.statementsToStateMachine_(statements);
      }

      return this.transformStatementList_(maybeTransformedStatements);
    }
  });

  return {
    CPSTransformer: CPSTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var PredefinedName = traceur.syntax.PredefinedName;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;

  var CPSTransformer = traceur.codegeneration.generator.CPSTransformer;
  var EndState = traceur.codegeneration.generator.EndState;
  var YieldState = traceur.codegeneration.generator.YieldState;
  var StateMachine = traceur.syntax.trees.StateMachine;

  var createAssignStateStatement = ParseTreeFactory.createAssignStateStatement;
  var createBlock = ParseTreeFactory.createBlock;
  var createEmptyParameterList = ParseTreeFactory.createEmptyParameterList;
  var createFalseLiteral = ParseTreeFactory.createFalseLiteral;
  var createFunctionExpression = ParseTreeFactory.createFunctionExpression;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createObjectLiteralExpression = ParseTreeFactory.createObjectLiteralExpression;
  var createPropertyNameAssignment = ParseTreeFactory.createPropertyNameAssignment;
  var createReturnStatement = ParseTreeFactory.createReturnStatement;
  var createStatementList = ParseTreeFactory.createStatementList;
  var createThrowStatement = ParseTreeFactory.createThrowStatement;
  var createVariableStatement = ParseTreeFactory.createVariableStatement;

  /**
   * Desugars generator function bodies. Generator function bodies contain 'yield' statements.
   *
   * At the top level the state machine is translated into this source code:
   *
   * {
   *   var $that = this;
   *   return { __iterator__ : function() {
   *     machine variables
   *     var $result = { moveNext : machineMethod };
   *     return $result;
   *   };
   * }
   *
   * @param {ErrorReporter} reporter
   * @extends {CPSTransformer}
   * @constructor
   */
  function GeneratorTransformer(reporter) {
    CPSTransformer.call(this, reporter);
  }

  /**
   * @param {ErrorReporter} reporter
   * @param {Block} body
   * @return {Block}
   */
  GeneratorTransformer.transformGeneratorBody = function(reporter, body) {
    return new GeneratorTransformer(reporter).transformGeneratorBody(body);
  };
  
  traceur.inherits(GeneratorTransformer, CPSTransformer, {
    __proto__: CPSTransformer.prototype,

    /**
     * Yield statements are translated into a state machine with a single state.
     * @param {YieldStatement} tree
     * @return {ParseTree}
     */
    transformYieldStatement: function(tree) {
      if (tree.expression != null) {
        var startState = this.allocateState();
        var fallThroughState = this.allocateState();
        return this.stateToStateMachine_(
            new YieldState(
                startState,
                fallThroughState,
                this.transformAny(tree.expression)),
            fallThroughState);
      }
      var stateId = this.allocateState();
      return new StateMachine(
          stateId,
          // TODO: this should not be required, but removing requires making consumers resilient
          // TODO: to INVALID fallThroughState
          this.allocateState(),
          [new EndState(stateId)],
          []);
    },

    /**
     * @param {AwaitStatement} tree
     * @return {ParseTree}
     */
    transformAwaitStatement: function(tree) {
      this.reporter.reportError(tree.location.start,
          'Generator function may not have an async statement.');
      return tree;
    },

    /**
     * @param {Finally} tree
     * @return {ParseTree}
     */
    transformFinally: function(tree) {
      var result = CPSTransformer.prototype.transformFinally.call(this, tree);
      if (result.block.type != ParseTreeType.STATE_MACHINE) {
        return result;
      }
      this.reporter.reportError(tree.location.start, 'yield not permitted from within a finally block.');
      return result;
    },

    /**
     * @param {ReturnStatement} tree
     * @return {ParseTree}
     */
    transformReturnStatement: function(tree) {
      this.reporter.reportError(tree.location.start,
          'Generator function may not have a return statement.');
      return tree;
    },

    /**
     * Transform a generator function body - removing yield statements.
     * The transformation is in two stages. First the statements are converted into a single
     * state machine by merging state machines via a bottom up traversal.
     *
     * Then the final state machine is converted into the following code:
     *
     * {
     *   var $that = this;
     *   return { __iterator__ : function() {
     *     machine variables
     *     var $result = { moveNext : machineMethod };
     *     return $result;
     *   };
     * }
     * TODO: add close() method which executes pending finally clauses
     *
     * @param {Block} tree
     * @return {Block}
     */
    transformGeneratorBody: function(tree) {
      // transform to a state machine
      var transformedTree = this.transformAny(tree);
      if (this.reporter.hadError()) {
        return tree;
      }
      var machine = transformedTree;

      var statements = [];

      //     lifted machine variables
      statements.push.apply(statements, this.getMachineVariables(tree, machine));
      //     var $result = { moveNext : machineMethod };
      statements.push(createVariableStatement(
          TokenType.VAR,
          PredefinedName.RESULT,
          createObjectLiteralExpression(
              createPropertyNameAssignment(
                  PredefinedName.MOVE_NEXT,
                  this.generateMachineMethod(machine)))));
      //     return $result;
      statements.push(createReturnStatement(createIdentifierExpression(PredefinedName.RESULT)));

      return createBlock(
          //   var $that = this;
          this.generateHoistedThis(),
          //   return { __iterator__ = function() { ... };
          createReturnStatement(
              createObjectLiteralExpression(createPropertyNameAssignment(
                  PredefinedName.ITERATOR,
                  createFunctionExpression(
                      createEmptyParameterList(),
                      createBlock(statements))))));
    },

    /**
     * @param {number} rethrowState
     * @return {Array.<ParseTree>}
     */
    machineUncaughtExceptionStatements: function(rethrowState) {
      return createStatementList(
          createThrowStatement(createIdentifierExpression(PredefinedName.STORED_EXCEPTION)));
    },

    /**
     * @param {number} machineEndState
     * @return {Array.<ParseTree>}
     */
    machineRethrowStatements: function(machineEndState) {
      return createStatementList(
          createThrowStatement(createIdentifierExpression(PredefinedName.STORED_EXCEPTION)));
    },

    /**
     * @param {number} machineEndState
     * @return {Array.<ParseTree>}
     */
    machineFallThroughStatements: function(machineEndState) {
      return createStatementList(createAssignStateStatement(machineEndState));
    },

    /** @return {Array.<ParseTree>} */
    machineEndStatements: function() {
      return [createReturnStatement(createFalseLiteral())];
    }
  });

  return {
    GeneratorTransformer: GeneratorTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.generator', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;
  var ParseTree = traceur.syntax.trees.ParseTree;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var PredefinedName = traceur.syntax.PredefinedName;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;

  var CPSTransformer = traceur.codegeneration.generator.CPSTransformer;
  var StateMachine = traceur.syntax.trees.StateMachine;
  var AsyncState = traceur.codegeneration.generator.AsyncState;
  var EndState = traceur.codegeneration.generator.EndState;
  var FallThroughState = traceur.codegeneration.generator.FallThroughState;

  var createArgumentList = ParseTreeFactory.createArgumentList;
  var createAssignStateStatement = ParseTreeFactory.createAssignStateStatement;
  var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
  var createBlock = ParseTreeFactory.createBlock;
  var createBreakStatement = ParseTreeFactory.createBreakStatement;
  var createCallExpression = ParseTreeFactory.createCallExpression;
  var createCallStatement = ParseTreeFactory.createCallStatement;
  var createCallback = ParseTreeFactory.createCallback;
  var createEmptyArgumentList = ParseTreeFactory.createEmptyArgumentList;
  var createErrback = ParseTreeFactory.createErrback;
  var createFunctionExpression = ParseTreeFactory.createFunctionExpression;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createNewExpression = ParseTreeFactory.createNewExpression;
  var createNumberLiteral = ParseTreeFactory.createNumberLiteral;
  var createParameterList = ParseTreeFactory.createParameterList;
  var createParameterReference = ParseTreeFactory.createParameterReference;
  var createPromise = ParseTreeFactory.createPromise;
  var createReturnStatement = ParseTreeFactory.createReturnStatement;
  var createStatementList = ParseTreeFactory.createStatementList;
  var createThrowStatement = ParseTreeFactory.createThrowStatement;
  var createUndefinedExpression = ParseTreeFactory.createUndefinedExpression;
  var createVariableStatement = ParseTreeFactory.createVariableStatement;


  /**
   * Desugars async function bodies. Async function bodies contain 'async' statements.
   *
   * At the top level the state machine is translated into this source code:
   *
   * {
   *   var $that = this;
   *   machine variables
   *   var $value;
   *   var $err;
   *   var $continuation = machineMethod;
   *   var $cancel = ...;
   *   var $result = new Deferred($cancel);
   *   var $waitTask;
   *   var $createCallback = function(newState) { function (value) { $state = newState; $value = value; $continuation(); }}
   *   var $createErrback = function(newState) { function (err) { $state = newState; $err = err; $continuation(); }}
   *   $continuation();
   *   return $result.createPromise();
   * }
   *
   * @param {ErrorReporter} reporter
   * @extends {CPSTransformer}
   * @constructor
   */
  function AsyncTransformer(reporter) {
    CPSTransformer.call(this, reporter);
  }

  /**
   * @param {ErrorReporter} reporter
   * @param {Block} body
   * @return {Block}
   */
  AsyncTransformer.transformAsyncBody = function(reporter, body) {
    return new AsyncTransformer(reporter).transformAsyncBody(body);
  };
  
  traceur.inherits(AsyncTransformer, CPSTransformer, {
    __proto__: CPSTransformer.prototype,

    /**
     * Yield statements are translated into a state machine with a single state.
     * @param {YieldStatement} tree
     * @return {ParseTree}
     */
    transformYieldStatement: function(tree) {
      reporter.reportError(tree.location.start,
          'Async function may not have a yield statement.');
      return tree;
    },

    /**
     * @param {AwaitStatement} tree
     * @return {ParseTree}
     */
    transformAwaitStatement: function(tree) {
      var createTaskState = this.allocateState();
      var callbackState = this.allocateState();
      var errbackState = this.allocateState();
      var fallThroughState = this.allocateState();

      var states = [];
      //  case createTaskState:
      //    $waitTask = expression;
      //    $waitTask.then($createCallback(callbackState), $createErrback(errbackState));
      //    return;
      states.push(new FallThroughState(createTaskState, callbackState, createStatementList(
          createAssignmentStatement(
              createIdentifierExpression(PredefinedName.WAIT_TASK),
              tree.expression),
          createCallStatement(
              createMemberExpression(PredefinedName.WAIT_TASK, PredefinedName.THEN),
              createArgumentList(
                  createCallExpression(createIdentifierExpression(PredefinedName.CREATE_CALLBACK),
                      createArgumentList(createNumberLiteral(callbackState))),
                  createCallExpression(createIdentifierExpression(PredefinedName.CREATE_ERRBACK),
                      createArgumentList(createNumberLiteral(errbackState))))),
          createReturnStatement(null))));
      //  case callbackState:
      //    identifier = $value;
      //    $state = fallThroughState;
      //    break;
      var assignment;
      if (tree.identifier != null) {
        assignment = createStatementList(
            createAssignmentStatement(
            createIdentifierExpression(tree.identifier),
            createIdentifierExpression(PredefinedName.$VALUE)));
      } else {
        assignment = createStatementList();
      }
      states.push(new FallThroughState(callbackState, fallThroughState, assignment));
      //  case errbackState:
      //    throw $err;
      states.push(new FallThroughState(errbackState, fallThroughState, createStatementList(
          createThrowStatement(createIdentifierExpression(PredefinedName.ERR)))));

      return new StateMachine(createTaskState, fallThroughState, states, []);
    },

    /**
     * @param {Finally} tree
     * @return {ParseTree}
     */
    transformFinally: function(tree) {
      var result = proto.transformFinally.call(this, tree);
      if (result.block.type != ParseTreeType.STATE_MACHINE) {
        return result;
      }
      // TODO: is this a reasonable restriction?
      reporter.reportError(tree.location.start, 'async not permitted within a finally block.');
      return result;
    },

    /**
     * @param {ReturnStatement} tree
     * @return {ParseTree}
     */
    transformReturnStatement: function(tree) {
      var result = tree.expression;
      if (result == null) {
        result = createUndefinedExpression();
      }
      var startState = this.allocateState();
      var endState = this.allocateState();
      var completeState = new FallThroughState(startState, endState,
          // $result.callback(result);
          createStatementList(this.createCompleteTask_(result)));
      var end = new EndState(endState);
      return new StateMachine(
          startState,
          // TODO: this should not be required, but removing requires making consumers resilient
          // TODO: to INVALID fallThroughState
          this.allocateState(),
          [completeState, end],
          []);
    },

    /**
     * @param {ParseTree} tree
     * @return {ParseTree}
     */
    createCompleteTask_: function(result) {
      return createCallStatement(
          createMemberExpression(PredefinedName.RESULT, PredefinedName.CALLBACK),
          createArgumentList(result));
    },

    /**
     * Transform an async function body - removing async statements.
     * The transformation is in two stages. First the statements are converted into a single
     * state machine by merging state machines via a bottom up traversal.
     *
     * Then the final state machine is converted into the following code:
     *
     * {
     *   var $that = this;
     *   machine variables
     *   var $value;
     *   var $err;
     *   var $continuation = machineMethod;
     *   var $cancel = ...;
     *   var $result = new Deferred($cancel);
     *   var $waitTask;
     *   var $createCallback = function(newState) { return function (value) { $state = newState; $value = value; $continuation(); }}
     *   var $createErrback = function(newState) { return function (err) { $state = newState; $err = err; $continuation(); }}
     *   $continuation();
     *   return $result.createPromise();
     * }
     * TODO: add close() method which executes pending finally clauses
     * @param {Block} tree
     * @return {Block}
     */
    transformAsyncBody: function(tree) {
      // transform to a state machine
      var transformedTree = this.transformAny(tree);
      if (this.reporter.hadError()) {
        return tree;
      }
      var machine = transformedTree;

      var statements = [];

      //   var $that = this;
      statements.push(this.generateHoistedThis());
      //     lifted machine variables
      statements.push.apply(statements, this.getMachineVariables(tree, machine));
      //   var $value;
      statements.push(createVariableStatement(
          TokenType.VAR,
          PredefinedName.$VALUE,
          null));
      //   var $err;
      statements.push(createVariableStatement(
          TokenType.VAR,
          PredefinedName.ERR,
          null));
      // TODO: var $cancel = ...;
      //   var $result = new Deferred();
      statements.push(createVariableStatement(
          TokenType.VAR,
          PredefinedName.RESULT,
          createNewExpression(
              createIdentifierExpression(PredefinedName.DEFERRED),
              createEmptyArgumentList())));
      //   var $waitTask;
      statements.push(createVariableStatement(
          TokenType.VAR,
          PredefinedName.WAIT_TASK,
          null));
      //   var $continuation = machineMethod;
      statements.push(createVariableStatement(
          TokenType.VAR,
          PredefinedName.CONTINUATION,
          this.generateMachineMethod(machine)));
      //   var $createCallback = function(newState) { return function (value) { $state = newState; $value = value; $continuation(); }}
      statements.push(createVariableStatement(
          TokenType.VAR,
          PredefinedName.CREATE_CALLBACK,
          createFunctionExpression(
              createParameterList(PredefinedName.NEW_STATE),
              createBlock(
                  createReturnStatement(
                      createFunctionExpression(
                          createParameterList(1),
                          createBlock(
                              createAssignmentStatement(
                                  createIdentifierExpression(PredefinedName.STATE),
                                  createIdentifierExpression(PredefinedName.NEW_STATE)),
                                  createAssignmentStatement(
                                      createIdentifierExpression(PredefinedName.$VALUE),
                                      createParameterReference(0)),
                                  createCallStatement(createIdentifierExpression(PredefinedName.CONTINUATION)))))))));
      //   var $createErrback = function(newState) { return function (err) { $state = newState; $err = err; $continuation(); }}
      statements.push(createVariableStatement(
          TokenType.VAR,
          PredefinedName.CREATE_ERRBACK,
          createFunctionExpression(
              createParameterList(PredefinedName.NEW_STATE),
              createBlock(
                  createReturnStatement(
                      createFunctionExpression(
                          createParameterList(1),
                          createBlock(
                              createAssignmentStatement(
                                  createIdentifierExpression(PredefinedName.STATE),
                                  createIdentifierExpression(PredefinedName.NEW_STATE)),
                                  createAssignmentStatement(
                                      createIdentifierExpression(PredefinedName.ERR),
                                      createParameterReference(0)),
                                  createCallStatement(createIdentifierExpression(PredefinedName.CONTINUATION)))))))));
      //  $continuation();
      statements.push(createCallStatement(createIdentifierExpression(PredefinedName.CONTINUATION)));
      //  return $result.createPromise();
      statements.push(createReturnStatement(
          createCallExpression(
              createMemberExpression(PredefinedName.RESULT, PredefinedName.CREATE_PROMISE))));

      return createBlock(statements);
    },

    /**
     * @param {number} rethrowState
     * @return {Array.<ParseTree>}
     */
    machineUncaughtExceptionStatements: function(rethrowState) {
      return createStatementList(
          createAssignStateStatement(rethrowState),
          createBreakStatement());
    },

    /** @return {Array.<ParseTree>} */
    machineEndStatements: function() {
      // return;
      return createStatementList(createReturnStatement(null));
    },

    /**
     * @param {number} machineEndState
     * @return {Array.<ParseTree>}
     */
    machineFallThroughStatements: function(machineEndState) {
      // $waitTask.callback(undefined);
      // $state = machineEndState;
      // break;
      return createStatementList(
          this.createCompleteTask_(createUndefinedExpression()),
          createAssignStateStatement(machineEndState),
          createBreakStatement());
    },

    /**
     * @param {number} machineEndState
     * @return {Array.<ParseTree>}
     */
    machineRethrowStatements: function(machineEndState) {
      return createStatementList(
          // $result.errback($storedException);
          createCallStatement(
          createMemberExpression(PredefinedName.RESULT, PredefinedName.ERRBACK),
          createArgumentList(createIdentifierExpression(PredefinedName.STORED_EXCEPTION))),
          // $state = machineEndState
          createAssignStateStatement(machineEndState),
          // break;
          createBreakStatement());
    }
  });

  return {
    AsyncTransformer: AsyncTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ParseTreeVisitor = traceur.syntax.ParseTreeVisitor;
  var FunctionDeclaration = traceur.syntax.trees.FunctionDeclaration;
  var GetAccessor = traceur.syntax.trees.GetAccessor;
  var SetAccessor = traceur.syntax.trees.SetAccessor;

  var ParseTreeTransformer = traceur.codegeneration.ParseTreeTransformer;
  var ForEachTransformer = traceur.codegeneration.ForEachTransformer;

  var ForInTransformPass = traceur.codegeneration.generator.ForInTransformPass;
  var GeneratorTransformer = traceur.codegeneration.generator.GeneratorTransformer;
  var AsyncTransformer = traceur.codegeneration.generator.AsyncTransformer;

  var createForEachStatement = traceur.codegeneration.ParseTreeFactory.createForEachStatement;
  var createVariableDeclarationList = traceur.codegeneration.ParseTreeFactory.createVariableDeclarationList;
  var createYieldStatement = traceur.codegeneration.ParseTreeFactory.createYieldStatement;
  var createIdentifierExpression = traceur.codegeneration.ParseTreeFactory.createIdentifierExpression;

  var TokenType = traceur.syntax.TokenType;

  /**
   * Can tell you if function body contains a yield statement. Does not search into
   * nested functions.
   * @param {ParseTree} tree
   * @extends {ParseTreeVisitor}
   * @constructor
   */
  function YieldFinder(tree) {
    this.visitAny(tree);
  }
  traceur.inherits(YieldFinder, ParseTreeVisitor, {
    __proto__: ParseTreeVisitor.prototype,

    hasYield: false,
    hasYieldFor: false,
    hasForIn: false,
    hasAsync: false,

    /** @return {boolean} */
    hasAnyGenerator: function() {
      return this.hasYield || this.hasAsync;
    },

    /** @param {YieldStatement} tree */
    visitYieldStatement: function(tree) {
      this.hasYield = true;
      this.hasYieldFor = tree.isYieldFor;
    },

    /** @param {AwaitStatement} tree */
    visitAwaitStatement: function(tree) {
      this.hasAsync = true;
    },

    /** @param {ForInStatement} tree */
    visitForInStatement: function(tree) {
      this.hasForIn = true;
      ParseTreeVisitor.prototype.visitForInStatement.call(this, tree);
    },

    // don't visit function children or bodies
    visitFunctionDeclaration: function(tree) {},
    visitSetAccessor: function(tree) {},
    visitGetAccessor: function(tree) {}
  });

  /**
   * This transformer turns "yield for E" into a ForEach that
   * contains a yield and is lowered by the ForEachTransformer.
   */
  function YieldForTransformer(identifierGenerator) {
    ParseTreeTransformer.call(this);
    this.identifierGenerator_ = identifierGenerator;
  }

  YieldForTransformer.transformTree = function(identifierGenerator, tree) {
    return new YieldForTransformer(identifierGenerator).transformAny(tree);
  };
  
  traceur.inherits(YieldForTransformer, ParseTreeTransformer, {
    __proto__: ParseTreeTransformer.prototype,

    transformYieldStatement: function(tree) {
      if (tree.isYieldFor) {
        // yield for E
        //   becomes
        // for (var $TEMP : E) { yield $TEMP; }

        var id = createIdentifierExpression(this.identifierGenerator_.generateUniqueIdentifier());

        var forEach = createForEachStatement(
            createVariableDeclarationList(
                TokenType.VAR,
                id,
                null // initializer
            ),
            tree.expression,
            createYieldStatement(id, false /* isYieldFor */));

        var result = ForEachTransformer.transformTree(
            this.identifierGenerator_,
            forEach);

        return result;
      }

      return tree;
    }
  });

  /**
   * This pass just finds function bodies with yields in them and passes them off to
   * the GeneratorTransformer for the heavy lifting.
   * @param {UniqueIdentifierGenerator} identifierGenerator
   * @param {ErrorReporter} reporter
   * @extends {ParseTreeTransformer}
   * @constructor
   */
  function GeneratorTransformPass(identifierGenerator, reporter) {
    ParseTreeTransformer.call(this);
    this.identifierGenerator_ = identifierGenerator;
    this.reporter_ = reporter;
  }

  GeneratorTransformPass.transformTree = function(identifierGenerator, reporter,
      tree) {
    return new GeneratorTransformPass(identifierGenerator, reporter).transformAny(tree);
  }
  
  traceur.inherits(GeneratorTransformPass, ParseTreeTransformer, {
    __proto__: ParseTreeTransformer.prototype,

    /**
     * @param {FunctionDeclaration} tree
     * @return {ParseTree}
     */
    transformFunctionDeclaration: function(tree) {
      var body = this.transformBody_(tree.functionBody);
      if (body == tree.functionBody) {
        return tree;
      }
      return new FunctionDeclaration(
          null,
          tree.name,
          tree.isStatic,
          tree.formalParameterList,
          body);
    },

    /**
     * @param {Block} tree
     * @return {Block}
     */
    transformBody_: function(tree) {
      var finder = new YieldFinder(tree);

      // transform nested functions
      var body = ParseTreeTransformer.prototype.transformBlock.call(this, tree);

      if (!finder.hasAnyGenerator()) {
        return body;
      }

      // We need to transform for-in loops because the object key iteration cannot be interrupted.
      if (finder.hasForIn) {
        body = ForInTransformPass.transformTree(this.identifierGenerator_, body);
      }

      if (finder.hasYieldFor) {
        body = YieldForTransformer.transformTree(this.identifierGenerator_, body);
      }

      var transformed;
      if (finder.hasYield) {
        transformed = GeneratorTransformer.transformGeneratorBody(this.reporter_, body);
      } else {
        transformed = AsyncTransformer.transformAsyncBody(this.reporter_, body);
      }
      return transformed;
    },

    /**
     * @param {GetAccessor} tree
     * @return {ParseTree}
     */
    transformGetAccessor: function(tree) {
      var body = this.transformBody_(tree.body);
      if (body == tree.body) {
        return tree;
      }
      return new GetAccessor(
          null,
          tree.propertyName,
          tree.isStatic,
          body);
    },

    /**
     * @param {SetAccessor} tree
     * @return {ParseTree}
     */
    transformSetAccessor: function(tree) {
      var body = this.transformBody_(tree.body);
      if (body == tree.body) {
        return tree;
      }
      return new SetAccessor(
          null,
          tree.propertyName,
          tree.isStatic,
          tree.parameter,
          body);
    }
  });

  return {
    GeneratorTransformPass: GeneratorTransformPass
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var global = this;
traceur.define('semantics', function() {
  'use strict';

  var TokenType = traceur.syntax.TokenType;
  var ParseTreeVisitor = traceur.syntax.ParseTreeVisitor;
  var IdentifierExpression = traceur.syntax.trees.IdentifierExpression;
  var IdentifierToken = traceur.syntax.IdentifierToken;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;
  var SourcePosition = traceur.syntax.SourcePosition;
  var PredefinedName = traceur.syntax.PredefinedName;

  /**
   * Finds the identifiers that are not bound in a program. Run this after all
   * module imports have been resolved.
   *
   * This is run after all transformations to simplify the analysis. In
   * particular we can ignore:
   *   - module imports
   *   - block scope (let/const)
   *   - foreach
   *   - generators
   *   - destructuring/rest
   *   - classes/traits
   * as all of these nodes will have been replaced. We assume that synthetic
   * variables (generated by Traceur) will bind correctly, so we don't worry
   * about binding them as well as user defined variables.
   *
   * @param {ErrorReporter} reporter
   * @extends {ParseTreeVisitor}
   * @constructor
   */
  function FreeVariableChecker(reporter) {
    ParseTreeVisitor.call(this);
    this.reporter_ = reporter;
  }

  /**
   * Represents the link in the scope chain.
   * @param {Scope} parent The parent scope, or null if top level scope.
   * @constructor
   */
  function Scope(parent) {
    this.parent = parent;
    this.references = Object.create(null);
    this.declarations = Object.create(null);
  }

  /**
   * Gets the name of an identifier expression or token
   * @param {IdentifierExpression|IdentifierToken|string} name
   * @returns {string}
   */
  function getVariableName(name) {
      if (name instanceof IdentifierExpression) {
        name = name.identifierToken;
      }
      if (name instanceof IdentifierToken) {
        name = name.value;
      }
      return name;
  }

  function getIdentifier(tree) {
    while (tree.type == ParseTreeType.PAREN_EXPRESSION) {
      tree = tree.expression;
    }
    if (tree.type == ParseTreeType.IDENTIFIER_EXPRESSION) {
      return tree;
    }
    return null;
  }

  /**
   * Checks the program for free variables, and reports an error when it
   * encounters any.
   *
   * @param {ErrorReporter} reporter
   * @param {Program} tree
   */
  FreeVariableChecker.checkProgram = function(reporter, tree) {
    new FreeVariableChecker(reporter).visitProgram(tree, global);
  }

  var proto = ParseTreeVisitor.prototype;
  traceur.inherits(FreeVariableChecker, ParseTreeVisitor, {
    __proto__: proto,

    /** Current scope (block, program) */
    scope_: null,

    /**
     * Pushes a scope.
     * @return {Scope}
     */
    pushScope_: function() {
      return this.scope_ = new Scope(this.scope_);
    },

    /**
     * Pops scope, tracks proper matching of push_/pop_ operations.
     * @param {Scope} scope
     */
    pop_: function(scope) {
      if (this.scope_ != scope) {
        throw new Error('FreeVariableChecker scope mismatch');
      }

      this.validateScope_();

      this.scope_ = scope.parent;
    },

    visitBlock: function(tree) {
      // block scope was already dealt with
      this.visitStatements_(tree.statements);
    },

    visitProgram: function(tree, global) {
      var scope = this.pushScope_();

      // Declare variables from the global scope.
      // TODO(jmesserly): this should be done through the module loaders, and by
      // providing the user the option to import URLs like '@dom', but for now
      // just bind against everything in the global scope.
      var object = global;
      while (object) {
        Object.getOwnPropertyNames(object).forEach(this.declareVariable_, this);
        object = Object.getPrototypeOf(object);
      }

      this.visitStatements_(tree.programElements);

      this.pop_(scope);
    },

    visitStatements_: function(statements) {
      statements.forEach(function(s) {
        if (s.type == ParseTreeType.FUNCTION_DECLARATION) {
          // Declare the function's name in the outer scope.
          // We need to do this here, and not inside visitFunctionDeclaration,
          // because function expressions shouldn't have their names added. Only
          // in statement contexts does this happen.
          this.declareVariable_(s.name);
        }
        this.visitAny(s);
      }, this);
    },

    visitFunctionDeclaration: function(tree) {
      var scope = this.pushScope_();

      // Declare the function name, 'arguments' and formal parameters inside the
      // function
      this.declareVariable_(tree.name);
      this.declareVariable_(PredefinedName.ARGUMENTS);
      tree.formalParameterList.parameters.forEach(this.declareVariable_, this);

      this.visitAny(tree.functionBody);

      this.pop_(scope);
    },

    visitGetAccessor: function(tree) {
      var scope = this.pushScope_();

      this.visitAny(tree.body);

      this.pop_(scope);
    },

    visitSetAccessor: function(tree) {
      var scope = this.pushScope_();

      this.declareVariable_(tree.parameter);
      this.visitAny(tree.body);

      this.pop_(scope);
    },

    visitCatch: function(tree) {
      var scope = this.pushScope_();

      this.declareVariable_(tree.exceptionName);

      this.visitAny(tree.catchBody);

      this.pop_(scope);
    },

    visitVariableDeclarationList: function(tree) {
      if (tree.declarationType != TokenType.VAR) {
        throw new Error('let and const should have been rewritten');
      }

      tree.declarations.forEach(function(d) {
        this.declareVariable_(d.lvalue);
        this.visitAny(d.initializer);
      }, this);
    },

    visitIdentifierExpression: function(tree) {
      var name = getVariableName(tree);
      var scope = this.scope_;
      if (!(name in scope.references)) {
        scope.references[name] = tree.location;
      }
    },

    declareVariable_: function(tree) {
      var name = getVariableName(tree);
      if (name) {
        var scope = this.scope_;
        if (!(name in scope.declarations)) {
          scope.declarations[name] = tree.location;
        }
      }
    },

    /**
     * Once we've visited the body of a scope, we check that all variables were
     * declared. If they haven't been, we promote the references to the parent
     * scope (because ES can close over variables, as well as reference them
     * before declaration).
     *
     * At the top level scope we issue errors for any remaining free variables.
     */
    validateScope_: function() {
      var scope = this.scope_;

      // Promote any unresolved references to the parent scope.
      var errors = [];
      for (var name in scope.references) {
        if (!(name in scope.declarations)) {
          var location = scope.references[name];
          if (!scope.parent) {
            if (!location) {
              // If location is null, it means we're getting errors from code we
              // generated. This is an internal error.
              throw new Error('generated variable ' + name + ' is not defined');
            }

            // If we're at the top level scope, then issue an error for
            // remaining free variables.
            errors.push([location.start, '%s is not defined', name]);
          } else if (!(name in scope.parent.references)) {
            scope.parent.references[name] = location;
          }
        }
      }

      if (errors.length) {
        // Issue errors in source order.
        errors.sort(function(x, y) { return x[0].offset - y[0].offset; });
        errors.forEach(function(e) { this.reportError_.apply(this, e); }, this);
      }
    },

    /**
     * @param {SourcePosition} start location
     * @param {string} format
     * @param {...Object} var_args
     */
    reportError_: function(location, format, var_args) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = location;
      this.reporter_.reportError.apply(this.reporter_, args);
    }
  });

  return {
    FreeVariableChecker: FreeVariableChecker
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ObjectMap = traceur.util.ObjectMap;

  var ParseTreeValidator = traceur.syntax.ParseTreeValidator;
  var ProgramTree = traceur.syntax.trees.ProgramTree;
  var UniqueIdentifierGenerator = traceur.codegeneration.UniqueIdentifierGenerator;
  var ForEachTransformer = traceur.codegeneration.ForEachTransformer;
  var RestParameterTransformer = traceur.codegeneration.RestParameterTransformer;
  var DefaultParametersTransformer = traceur.codegeneration.DefaultParametersTransformer;
  var GeneratorTransformPass = traceur.codegeneration.GeneratorTransformPass;
  var DestructuringTransformer = traceur.codegeneration.DestructuringTransformer;
  var SpreadTransformer = traceur.codegeneration.SpreadTransformer;
  var BlockBindingTransformer = traceur.codegeneration.BlockBindingTransformer;
  var TraitTransformer = traceur.codegeneration.TraitTransformer;
  var ClassTransformer = traceur.codegeneration.ClassTransformer;
  var ModuleTransformer = traceur.codegeneration.ModuleTransformer;
  var GeneratorTransformPass = traceur.codegeneration.GeneratorTransformPass;
  var FreeVariableChecker = traceur.semantics.FreeVariableChecker;

  var CLASS_DECLARATION = traceur.syntax.trees.ParseTreeType.CLASS_DECLARATION;
  var TRAIT_DECLARATION = traceur.syntax.trees.ParseTreeType.TRAIT_DECLARATION;

  /**
   * Transforms a Traceur file's ParseTree to a JS ParseTree.
   *
   * @param {ErrorReporter} reporter
   * @param {Project} project
   * @constructor
   */
  function ProgramTransformer(reporter, project) {
    this.project_ = project;
    this.reporter_ = reporter;
    this.results_ = new ObjectMap();
    this.identifierGenerator_ = new UniqueIdentifierGenerator();
    Object.freeze(this);
  }

  /**
   * @param {ErrorReporter} reporter
   * @param {Project} project
   * @return {ObjectMap}
   */
  ProgramTransformer.transform = function(reporter, project) {
    var transformer = new ProgramTransformer(reporter, project);
    transformer.transform_();
    return transformer.results_;
  };

  /**
   * @param {ErrorReporter} reporter
   * @param {Project} project
   * @param {SourceFile} sourceFile
   * @return {ObjectMap}
   */
  ProgramTransformer.transformFile = function(reporter, project, sourceFile) {
    var transformer = new ProgramTransformer(reporter, project);
    transformer.transformFile_(sourceFile);
    return transformer.results_;
  }

  ProgramTransformer.prototype = {
    /**
     * @return {void}
     * @private
     */
    transform_: function() {
      this.project_.getSourceFiles().forEach(function(file) {
        this.transformFile_(file);
      }, this);
    },

    /**
     * @param {SourceFile} file
     * @return {void}
     * @private
     */
    transformFile_: function(file) {
      var result = this.transform(this.project_.getParseTree(file));
      this.results_.put(file, result);
    },

    /**
     * This is the root of the code generation pass.
     * Each pass translates one contruct from Traceur to standard JS constructs.
     * The order of the passes matters.
     *
     * @param {Program} tree
     * @return {ParseTree}
     */
    transform: function(tree) {
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);
        tree = this.transformModules_(tree);
      }
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);
        tree = this.transformAggregates_(tree);
      }
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);
        // foreach must come before destructuring and generator, or anything
        // that wants to use VariableBinder
        tree = ForEachTransformer.transformTree(
            this.identifierGenerator_, tree);
      }
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);
        // rest parameters must come before generator
        tree = RestParameterTransformer.transformTree(tree);
      }
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);
        // default parameters should come after rest parameter to get the
        // expected order in the transformed code.
        tree = DefaultParametersTransformer.transformTree(tree);
      }
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);
        // generator must come after foreach and rest parameters
        tree = GeneratorTransformPass.transformTree(
            this.identifierGenerator_, this.reporter_, tree);
      }
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);
        // destructuring must come after foreach and before block binding
        tree = DestructuringTransformer.transformTree(tree);
      }
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);
        tree = SpreadTransformer.transformTree(tree);
      }
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);
        tree = BlockBindingTransformer.transformTree(tree);
      }
      if (!this.reporter_.hadError()) {
        ParseTreeValidator.validate(tree);

        // Issue errors for any unbound variables
        FreeVariableChecker.checkProgram(this.reporter_, tree);
      }
      return tree;
    },

    /**
     * @param {Program} tree
     * @return {Program}
     * @private
     */
    transformModules_: function(tree) {
      return ModuleTransformer.transform(this.project_, tree);
    },

    /**
     * @param {Program} tree
     * @return {Program}
     * @private
     */
    transformAggregates_: function(tree) {
      return ClassTransformer.transform(this.reporter_, tree);
    }
  };

  return {
    ProgramTransformer: ProgramTransformer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration', function() {
  'use strict';

  var ParseTreeWriter = traceur.codegeneration.ParseTreeWriter;

  /**
   * Writes all the files in the project to a stream.
   */
  function ProjectWriter() {}

  /**
   * @param {traceur.util.ObjectMap} results
   * @return {string}
   */
  ProjectWriter.write = function(results) {
    var sb = [];
    results.keys().forEach(function(file) {
      sb.push('// ' + file.name,
              ParseTreeWriter.write(results.get(file)));
    });
    return sb.join('\n') + '\n';
  }

  return {
    ProjectWriter: ProjectWriter
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.module', function() {
  'use strict';

  var Symbol = traceur.semantics.symbols.Symbol;

  var ParseTreeVisitor = traceur.syntax.ParseTreeVisitor;

  var ParseTree = traceur.syntax.trees.ParseTree;
  var MODULE_DECLARATION = traceur.syntax.trees.ParseTreeType.MODULE_DECLARATION;
  var MODULE_DEFINITION = traceur.syntax.trees.ParseTreeType.MODULE_DEFINITION;
  var MODULE_REQUIRE = traceur.syntax.trees.ParseTreeType.MODULE_REQUIRE;
  var EXPORT_DECLARATION = traceur.syntax.trees.ParseTreeType.EXPORT_DECLARATION;

  /**
   * A specialized parse tree visitor for use with modules.
   * @param {traceur.util.ErrorReporter} reporter
   * @param {ModuleSymbol} module The root of the module system.
   * @constructor
   * @extends {ParseTreeVisitor}
   */
  function ModuleVisitor(reporter, module) {
    ParseTreeVisitor.call(this);
    this.reporter_ = reporter;
    this.currentModule_ = module;
  }
  
  traceur.inherits(ModuleVisitor, ParseTreeVisitor, {
    __proto__: ParseTreeVisitor.prototype,

    get currentModule() {
      return this.currentModule_;
    },

    /**
     * Finds a module by name. This walks the lexical scope chain of the
     * {@code currentModule} and returns first matching module or null if none
     * is found.
     * @param {string} name
     * @return {ModuleSymbol}
     */
    getModuleByName: function(name) {
      var module = this.currentModule;
      while (module) {
        if (module.hasModule(name)) {
          return module.getModule(name);
        }
        module = module.parent;
      }
      return null;
    },

    /**
     * @param {ModuleExpression} tree
     * @param {boolean=} reportErorrors If false no errors are reported.
     * @return {ModuleSymbol}
     */
    getModuleForModuleExpression: function(tree, reportErrors) {
      // require("url").b.c
      if (tree.reference.type == MODULE_REQUIRE) {
        throw Error('Not implemented');
      }

      // a.b.c

      var self = this;
      function getNext(parent, identifierToken) {
        var name = identifierToken.value;

        if (!parent.hasModule(name)) {
          if (reportErrors) {
            self.reportError_(tree, '\'%s\' is not a module', name);
          }
          return null;
        }

        if (!parent.hasExport(name)) {
          if (reportErrors) {
            self.reportError_(tree, '\'%s\' is not exported', name);
          }
          return null;
        }

        return parent.getModule(name);
      }

      var name = tree.reference.identifierToken.value;
      var parent = this.getModuleByName(name);
      if (!parent) {
        if (reportErrors) {
          this.reportError_(tree, '\'%s\' is not a module', name);
        }
        return null;
      }

      for (var i = 0; i < tree.identifiers.length; i++) {
        parent = getNext(parent, tree.identifiers[i]);
        if (!parent) {
          return null;
        }
      }

      return parent;
    },

    // Limit the trees to visit.
    visitFunctionDeclaration: function(tree) {},
    visitSetAccessor: function(tree) {},
    visitGetAccessor: function(tree) {},

    visitModuleElement_: function(element) {
      switch (element.type) {
        case MODULE_DECLARATION:
        case MODULE_DEFINITION:
        case EXPORT_DECLARATION:
          this.visitAny(element);
      }
    },

    visitProgram: function(tree) {
      tree.programElements.forEach(this.visitModuleElement_, this);
    },

    visitModuleDefinition: function(tree) {
      var current = this.currentModule_;
      var name = tree.name.value;
      var module = current.getModule(name);
      traceur.assert(module);
      this.currentModule_ = module;
      tree.elements.forEach(this.visitModuleElement_, this);
      this.currentModule_ = current;
    },

    checkForDuplicateModule_: function(name, tree) {
      var parent = this.currentModule;
      if (parent.hasModule(name)) {
        this.reportError_(tree, 'Duplicate module declaration \'%s\'', name);
        this.reportRelatedError_(parent.getModule(name).tree);
        return false;
      }
      return true;
    },

    /**
     * @param {Symbol|ParseTree} symbolOrTree
     * @param {string} format
     * @param {...Object} var_args
     * @return {void}
     * @private
     */
    reportError_: function(symbolOrTree, format, var_args) {
      var tree;
      if (symbolOrTree instanceof Symbol) {
        tree = symbol.tree;
      } else {
        tree = symbolOrTree;
      }

      var args = Array.prototype.slice.call(arguments);
      args[0] = tree;

      this.reporter_.reportError.apply(this.reporter_, args);
    },

    /**
     * @param {Symbol|ParseTree} symbolOrTree
     * @return {void}
     * @private
     */
    reportRelatedError_: function(symbolOrTree) {
      if (symbolOrTree instanceof ParseTree) {
        this.reportError_(symbolOrTree, 'Location related to previous error');
      } else {
        symbolOrTree.getRelatedLocations().forEach(this.reportRelatedError_,
                                                   this);
      }
    }
  });
  return {
    ModuleVisitor: ModuleVisitor
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.module', function() {
  'use strict';

  var ModuleVisitor = traceur.codegeneration.module.ModuleVisitor;

  var ModuleSymbol = traceur.semantics.symbols.ModuleSymbol;

  /**
   * Visits a parse tree and adds all the module definitions.
   *
   *   module m { ... }
   *
   * @param {traceur.util.ErrorReporter} reporter
   * @param {ModuleSymbol} module The root of the module system.
   * @constructor
   * @extends {ModuleVisitor}
   */
  function ModuleDefinitionVisitor(reporter, module) {
    ModuleVisitor.call(this, reporter, module);
  }

  traceur.inherits(ModuleDefinitionVisitor, ModuleVisitor, {
    __proto__: ModuleVisitor.prototype,

    visitModuleDefinition: function(tree) {
      var name = tree.name.value;
      if (this.checkForDuplicateModule_(name, tree)) {
        var parent = this.currentModule;
        var module = new ModuleSymbol(name, parent, tree);
        parent.addModule(module);
      }

      ModuleVisitor.prototype.visitModuleDefinition.call(this, tree);
    }
  });
  return {
    ModuleDefinitionVisitor: ModuleDefinitionVisitor
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.module', function() {
  'use strict';

  var ModuleVisitor = traceur.codegeneration.module.ModuleVisitor;

  var ExportSymbol = traceur.semantics.symbols.ExportSymbol;

  var IDENTIFIER_EXPRESSION = traceur.syntax.trees.ParseTreeType.IDENTIFIER_EXPRESSION;

  /**
   * Visits a parse tree and adds all the module definitions.
   *
   *   module m { ... }
   *
   * @param {traceur.util.ErrorReporter} reporter
   * @param {ModuleSymbol} module The root of the module system.
   * @constructor
   * @extends {ModuleVisitor}
   */
  function ExportVisitor(reporter, module) {
    ModuleVisitor.call(this, reporter, module);
    this.inExport_ = false;
    this.relatedTree_ = null;
  }
  
  traceur.inherits(ExportVisitor, ModuleVisitor, {
    __proto__: ModuleVisitor.prototype,

    addExport_: function(name, tree) {
      if (!this.inExport_) {
        return;
      }

      traceur.assert(typeof name == 'string');

      var parent = this.currentModule;
      if (parent.hasExport(name)) {
        this.reportError_(tree, 'Duplicate export declaration \'%s\'', name);
        this.reportRelatedError_(parent.getExport(name));
        return;
      }
      parent.addExport(name, new ExportSymbol(tree, name, this.relatedTree_));
    },

    visitClassDeclaration: function(tree) {
      this.addExport_(tree.name.value, tree);
    },

    visitExportDeclaration: function(tree) {
      this.inExport_ = true;
      this.visitAny(tree.declaration);
      this.inExport_ = false;
    },

    visitExportPath: function(tree) {
      this.relatedTree_ = tree.moduleExpression;
      this.visitAny(tree.specifier);
      this.relatedTree_ = null;
    },

    visitExportPathList: function(tree) {
      for (var i = 0; i < tree.paths.length; i++) {
        var path = tree.paths[i];
        if (path.type == IDENTIFIER_EXPRESSION) {
          this.addExport_(path.identifierToken.value, path);
        } else {
          this.visitAny(path);
        }
      }
    },

    visitExportPathSpecifier: function(tree) {
      this.addExport_(tree.identifier.value, tree.specifier);
    },

    visitExportSpecifier: function(tree) {
      this.addExport_(tree.lhs.value, tree);
    },

    visitFunctionDeclaration: function(tree) {
      if (tree.name) {
        this.addExport_(tree.name.value, tree);
      }
    },

    visitIdentifierExpression: function(tree) {
      this.addExport_(tree.identifierToken.value, tree);
    },

    // TODO(arv): visitImport

    visitModuleDefinition: function(tree) {
      this.addExport_(tree.name.value, tree);
      var inExport = this.inExport_;
      this.inExport_ = false;
      ModuleVisitor.prototype.visitModuleDefinition.call(this, tree);
      this.inExport_ = inExport;
    },

    visitModuleSpecifier: function(tree) {
      this.addExport_(tree.identifier.value, tree);
    },

    visitTraitDeclaration: function(tree) {
      this.addExport_(tree.name.value, tree);
    },

    visitVariableDeclaration: function(tree) {
      this.addExport_(tree.lvalue.identifierToken.value, tree);
    }
  });

  return {
    ExportVisitor: ExportVisitor
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.module', function() {
  'use strict';

  var ModuleVisitor = traceur.codegeneration.module.ModuleVisitor;

  /**
   * Visits a parse tree and adds all the module declarations.
   *
   *   module m = n, o = p.q.r
   *
   * @param {traceur.util.ErrorReporter} reporter
   * @param {ModuleSymbol} module The root of the module system.
   * @constructor
   * @extends {ModuleVisitor}
   */
  function ModuleDeclarationVisitor(reporter, module) {
    ModuleVisitor.call(this, reporter, module);
  }
  
  traceur.inherits(ModuleDeclarationVisitor, ModuleVisitor, {
    __proto__: ModuleVisitor.prototype,

    visitModuleSpecifier: function(tree) {
      var name = tree.identifier.value;
      var parent = this.currentModule;
      var module = this.getModuleForModuleExpression(tree.expression);
      if (!module) {
        return;
      }
      parent.addModuleWithName(module, name);
    }
  });

  return {
    ModuleDeclarationVisitor: ModuleDeclarationVisitor
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('codegeneration.module', function() {
  'use strict';

  var ModuleVisitor = traceur.codegeneration.module.ModuleVisitor;

  /**
   * Visits a parse tree and validates all module expressions.
   *
   *   module m = n, o = p.q.r
   *
   * @param {traceur.util.ErrorReporter} reporter
   * @param {ModuleSymbol} module The root of the module system.
   * @constructor
   * @extends {ModuleVisitor}
   */
  function ValidationVisitor(reporter, module) {
    ModuleVisitor.call(this, reporter, module);
  }

  traceur.inherits(ValidationVisitor, ModuleVisitor, {
    __proto__: ModuleVisitor.prototype,

    checkExport_: function(tree, name) {
      if (this.validatingModule_ && !this.validatingModule_.hasExport(name)) {
        this.reportError_(tree, '\'%s\' is not exported', name);
        this.reportRelatedError_(this.validatingModule_);
      }
    },

    /**
     * @param {ModuleSymbol} module
     * @param {ParseTree} tree
     * @param {string=} name
     */
    visitAndValidate_: function(module, tree, name) {
      var validatingModule = this.validatingModule_;
      this.validatingModule_ = module;
      if (name) {
        this.checkExport_(tree, name);
      } else {
        this.visitAny(tree);
      }
      this.validatingModule_ = validatingModule;
    },

    /**
     * @param {traceur.syntax.trees.ExportPath} tree
     */
    visitExportPath: function(tree) {
      this.visitAny(tree.moduleExpression);
      var module = this.getModuleForModuleExpression(tree.moduleExpression);
      this.visitAndValidate_(module, tree.specifier);
    },

    visitExportSpecifier: function(tree) {
      var token = tree.rhs || tree.lhs;
      this.checkExport_(tree, token.value);
    },

    visitIdentifierExpression: function(tree) {
      this.checkExport_(tree, tree.identifierToken.value);
    },

    visitModuleExpression: function(tree) {
      this.getModuleForModuleExpression(tree, true /* reportErrors */);
    },

    /**
     * @param {traceur.syntax.trees.QualifiedReference} tree
     */
    visitQualifiedReference: function(tree) {
      this.visitAny(tree.moduleExpression);
      var module = this.getModuleForModuleExpression(tree.moduleExpression);
      this.visitAndValidate_(module, tree, tree.identifier.value);
    }
  });

  return {
    ValidationVisitor: ValidationVisitor
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

traceur.define('semantics', function() {
  'use strict';

  var ModuleDefinitionVisitor = traceur.codegeneration.module.ModuleDefinitionVisitor;
  var ExportVisitor = traceur.codegeneration.module.ExportVisitor;
  var ModuleDeclarationVisitor = traceur.codegeneration.module.ModuleDeclarationVisitor;
  var ValidationVisitor = traceur.codegeneration.module.ValidationVisitor;

  // TODO(arv): import
  // TODO(arv): Validate that there are no free variables
  // TODO(arv): Validate that the exported reference exists

  /**
   * Builds up all module symbols and validates them.
   *
   * @param {ErrorReporter} reporter
   * @param {Project} project
   * @constructor
   */
  function ModuleAnalyzer(reporter, project) {
    this.reporter_ = reporter;
    this.project_ = project;
  }

  ModuleAnalyzer.prototype = {
    /**
     * @return {void}
     */
    analyze: function() {
      var root = this.project_.getRootModule();
      var visitor = new ModuleDefinitionVisitor(this.reporter_, root);
      this.project_.getSourceTrees().forEach(visitor.visitAny, visitor);

      if (!this.reporter_.hadError()) {
        visitor = new ExportVisitor(this.reporter_, root);
        this.project_.getSourceTrees().forEach(visitor.visitAny, visitor);
      }

      if (!this.reporter_.hadError()) {
        visitor = new ModuleDeclarationVisitor(this.reporter_, root);
        this.project_.getSourceTrees().forEach(visitor.visitAny, visitor);
      }

      if (!this.reporter_.hadError()) {
        visitor = new ValidationVisitor(this.reporter_, root);
        this.project_.getSourceTrees().forEach(visitor.visitAny, visitor);
      }
    },

    /**
     * @param {SourceFile} sourceFile
     * @return {void}
     */
    analyzeFile: function(sourceFile) {
      var root = this.project_.getRootModule();
      var visitor = new ModuleDefinitionVisitor(this.reporter_, root);
      var tree = this.project_.getParseTree(sourceFile);
      visitor.visitAny(tree);

      if (!this.reporter_.hadError()) {
        visitor = new ExportVisitor(this.reporter_, root);
        visitor.visitAny(tree);
      }

      if (!this.reporter_.hadError()) {
        visitor = new ModuleDeclarationVisitor(this.reporter_, root);
        visitor.visitAny(tree);
      }

      if (!this.reporter_.hadError()) {
        visitor = new ValidationVisitor(this.reporter_, root);
        visitor.visitAny(tree);
      }
    }
  };

  return {
    ModuleAnalyzer: ModuleAnalyzer
  };
});
;
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @fileoverview Compiles a Traceur Project. Drives the overall compilation
 * process.
 */

traceur.define('codegeneration', function() {
  'use strict';

  var ProgramTransformer = traceur.codegeneration.ProgramTransformer;
  var Parser = traceur.syntax.Parser;

  var ModuleAnalyzer = traceur.semantics.ModuleAnalyzer;
  var Project = traceur.semantics.symbols.Project;

  /**
   * @param {ErrorReporter} reporter Where to report compile errors.
   * @param {Project} project The project to compile.
   * @return {ObjectMap} A map from input file name to
   *     translated results. Returns null if there was a compile error.
   */
  Compiler.compile = function(reporter, project) {
    return new Compiler(reporter, project).compile_();
  };

  /**
   * @param {ErrorReporter} reporter Where to report compile errors.
   * @param {SourceFile} sourceFile file to compile.
   * @return {ParseTree} A map from input file name to
   *     translated results. Returns null if there was a compile error.
   */
  Compiler.compileFile = function(reporter, sourceFile) {
    var project = new Project();
    project.addFile(sourceFile);
    return new Compiler(reporter, project).compileFile_(sourceFile);
  };

  /**
   * @param {ErrorReporter} reporter
   * @param {Project} project
   * @constructor
   */
  function Compiler(reporter, project) {
    this.reporter_ = reporter;
    this.project_ = project;
  }

  Compiler.prototype = {
    /**
     * @return {ObjectMap}
     * @private
     */
    compile_: function() {
      this.parse_();
      this.analyze_();
      this.transform_();

      if (this.hadError_()) {
        return null;
      }
      return this.results_;
    },

    /**
     * @param {SourceFile} file
     * @return {ParseTree}
     * @private
     */
    compileFile_: function(file) {
      this.parseFile_(file);
      this.analyzeFile_(file);
      this.transformFile_(file);

      if (this.hadError_()) {
        return null;
      }
      return this.results_.get(file);
    },

    /**
     * Transform the analyzed project to standard JS.
     *
     * @return {void}
     * @private
     */
    transform_: function() {
      if (this.hadError_()) {
        return;
      }
      this.results_ = ProgramTransformer.transform(this.reporter_,
                                                   this.project_);
    },

    /**
     * Transform the analyzed project to standard JS.
     *
     * @param {SourceFile} sourceFile
     * @return {void}
     * @private
     */
    transformFile_: function(sourceFile) {
      if (this.hadError_()) {
        return;
      }
      this.results_ = ProgramTransformer.transformFile(this.reporter_,
                                                       this.project_,
                                                       sourceFile);
    },

    /**
     * Build all symbols and perform all semantic checks.
     *
     * @return {void}
     * @private
     */
    analyze_: function() {
      if (this.hadError_()) {
        return;
      }
      var analyzer = new ModuleAnalyzer(this.reporter_, this.project_);
      analyzer.analyze();
    },

    /**
     * Build all symbols and perform all semantic checks.
     *
     * @param {SourceFile} sourceFile
     * @return {void}
     * @private
     */
    analyzeFile_: function(sourceFile) {
      if (this.hadError_()) {
        return;
      }
      var analyzer = new ModuleAnalyzer(this.reporter_, this.project_);
      analyzer.analyzeFile(sourceFile);
    },

    /**
     * Parse all source files in the project.
     *
     * @return {void}
     * @private
     */
    parse_: function() {
      this.project_.getSourceFiles().forEach(this.parseFile_, this);
    },

    /**
     * Parse all source files in the project.
     */
    /**
     * @param {SourceFile} file
     * @return {void}
     * @private
     */
    parseFile_: function(file) {
      if (this.hadError_()) {
        return;
      }

      this.project_.setParseTree(
          file, new Parser(this.reporter_, file).parseProgram(true));
    },

    /**
     * @return {boolean}
     * @private
     */
    hadError_: function() {
      return this.reporter_.hadError();
    }
  };

  return {
    Compiler: Compiler
  };
});
;
// Shim for DOM class declarations to be included before
// including compiled classes which derive from the DOM

function HTMLH1HeadingElement() {}
function HTMLH2HeadingElement() {}
function HTMLH3HeadingElement() {}
function HTMLH4HeadingElement() {}
function HTMLH5HeadingElement() {}
function HTMLH6HeadingElement() {}

try {
  HTMLH1HeadingElement.prototype = HTMLHeadingElement.prototype;
  HTMLH2HeadingElement.prototype = HTMLHeadingElement.prototype;
  HTMLH3HeadingElement.prototype = HTMLHeadingElement.prototype;
  HTMLH4HeadingElement.prototype = HTMLHeadingElement.prototype;
  HTMLH5HeadingElement.prototype = HTMLHeadingElement.prototype;
  HTMLH6HeadingElement.prototype = HTMLHeadingElement.prototype;
} catch (e) {
}


/**
 * The traceur runtime.
 */
var traceur = traceur || {};
traceur.runtime = (function() {
  var map = {};

  // Associates the instance maker with the class.
  // Used below for classes inherited from DOM elements.
  function add(map, name, cls, make) {
    Object.defineProperty(make, '$class', {
      value: cls,
      writable: false,
      enumerable: false,
      configurable: false
    });
    map[name] = make;
  }

  // AUTO-GENERATED
  try {add(map, 'Array', Array, function() {return new Array();});}catch (e) {}
  try {add(map, 'Date', Date, function() {return new Date();});}catch (e) {}
  try {add(map, 'Event', Event, function() {return document.createEvent('Event');});}catch (e) {}
  try {add(map, 'HTMLAnchorElement', HTMLAnchorElement, function() {return document.createElement('a');});}catch (e) {}
  try {add(map, 'HTMLAreaElement', HTMLAreaElement, function() {return document.createElement('area');});}catch (e) {}
  try {add(map, 'HTMLAudioElement', HTMLAudioElement, function() {return document.createElement('audio');});}catch (e) {}
  try {add(map, 'HTMLBRElement', HTMLBRElement, function() {return document.createElement('br');});}catch (e) {}
  try {add(map, 'HTMLBaseElement', HTMLBaseElement, function() {return document.createElement('base');});}catch (e) {}
  try {add(map, 'HTMLBlockquoteElement', HTMLBlockquoteElement, function() {return document.createElement('blockquote');});}catch (e) {}
  try {add(map, 'HTMLBodyElement', HTMLBodyElement, function() {return document.createElement('body');});}catch (e) {}
  try {add(map, 'HTMLButtonElement', HTMLButtonElement, function() {return document.createElement('button');});}catch (e) {}
  try {add(map, 'HTMLCanvasElement', HTMLCanvasElement, function() {return document.createElement('canvas');});}catch (e) {}
  try {add(map, 'HTMLDListElement', HTMLDListElement, function() {return document.createElement('dl');});}catch (e) {}
  try {add(map, 'HTMLDivElement', HTMLDivElement, function() {return document.createElement('div');});}catch (e) {}
  try {add(map, 'HTMLElement', HTMLElement, function() {return document.createElement('span');});}catch (e) {}
  try {add(map, 'HTMLEmbedElement', HTMLEmbedElement, function() {return document.createElement('embed');});}catch (e) {}
  try {add(map, 'HTMLFieldSetElement', HTMLFieldSetElement, function() {return document.createElement('fieldset');});}catch (e) {}
  try {add(map, 'HTMLFormElement', HTMLFormElement, function() {return document.createElement('form');});}catch (e) {}
  try {add(map, 'HTMLH1HeadingElement', HTMLH1HeadingElement, function() {return document.createElement('h1');});}catch (e) {}
  try {add(map, 'HTMLH2HeadingElement', HTMLH2HeadingElement, function() {return document.createElement('h2');});}catch (e) {}
  try {add(map, 'HTMLH3HeadingElement', HTMLH3HeadingElement, function() {return document.createElement('h3');});}catch (e) {}
  try {add(map, 'HTMLH4HeadingElement', HTMLH4HeadingElement, function() {return document.createElement('h4');});}catch (e) {}
  try {add(map, 'HTMLH5HeadingElement', HTMLH5HeadingElement, function() {return document.createElement('h5');});}catch (e) {}
  try {add(map, 'HTMLH6HeadingElement', HTMLH6HeadingElement, function() {return document.createElement('h6');});}catch (e) {}
  try {add(map, 'HTMLHRElement', HTMLHRElement, function() {return document.createElement('hr');});}catch (e) {}
  try {add(map, 'HTMLHeadElement', HTMLHeadElement, function() {return document.createElement('head');});}catch (e) {}
  try {add(map, 'HTMLHeadingElement', HTMLHeadingElement, function() {return document.createElement('h1');});}catch (e) {}
  try {add(map, 'HTMLHtmlElement', HTMLHtmlElement, function() {return document.createElement('html');});}catch (e) {}
  try {add(map, 'HTMLIFrameElement', HTMLIFrameElement, function() {return document.createElement('iframe');});}catch (e) {}
  try {add(map, 'HTMLImageElement', HTMLImageElement, function() {return document.createElement('img');});}catch (e) {}
  try {add(map, 'HTMLInputElement', HTMLInputElement, function() {return document.createElement('input');});}catch (e) {}
  try {add(map, 'HTMLLIElement', HTMLLIElement, function() {return document.createElement('li');});}catch (e) {}
  try {add(map, 'HTMLLabelElement', HTMLLabelElement, function() {return document.createElement('label');});}catch (e) {}
  try {add(map, 'HTMLLegendElement', HTMLLegendElement, function() {return document.createElement('legend');});}catch (e) {}
  try {add(map, 'HTMLLinkElement', HTMLLinkElement, function() {return document.createElement('link');});}catch (e) {}
  try {add(map, 'HTMLMapElement', HTMLMapElement, function() {return document.createElement('map');});}catch (e) {}
  try {add(map, 'HTMLMenuElement', HTMLMenuElement, function() {return document.createElement('menu');});}catch (e) {}
  try {add(map, 'HTMLMetaElement', HTMLMetaElement, function() {return document.createElement('meta');});}catch (e) {}
  try {add(map, 'HTMLMeterElement', HTMLMeterElement, function() {return document.createElement('meter');});}catch (e) {}
  try {add(map, 'HTMLModElement', HTMLModElement, function() {return document.createElement('del');});}catch (e) {}
  try {add(map, 'HTMLOListElement', HTMLOListElement, function() {return document.createElement('ol');});}catch (e) {}
  try {add(map, 'HTMLObjectElement', HTMLObjectElement, function() {return document.createElement('object');});}catch (e) {}
  try {add(map, 'HTMLOptGroupElement', HTMLOptGroupElement, function() {return document.createElement('optgroup');});}catch (e) {}
  try {add(map, 'HTMLOptionElement', HTMLOptionElement, function() {return document.createElement('option');});}catch (e) {}
  try {add(map, 'HTMLOutputElement', HTMLOutputElement, function() {return document.createElement('output');});}catch (e) {}
  try {add(map, 'HTMLParagraphElement', HTMLParagraphElement, function() {return document.createElement('p');});}catch (e) {}
  try {add(map, 'HTMLParamElement', HTMLParamElement, function() {return document.createElement('param');});}catch (e) {}
  try {add(map, 'HTMLPreElement', HTMLPreElement, function() {return document.createElement('pre');});}catch (e) {}
  try {add(map, 'HTMLProgressElement', HTMLProgressElement, function() {return document.createElement('progress');});}catch (e) {}
  try {add(map, 'HTMLQuoteElement', HTMLQuoteElement, function() {return document.createElement('q');});}catch (e) {}
  try {add(map, 'HTMLScriptElement', HTMLScriptElement, function() {return document.createElement('script');});}catch (e) {}
  try {add(map, 'HTMLSelectElement', HTMLSelectElement, function() {return document.createElement('select');});}catch (e) {}
  try {add(map, 'HTMLSourceElement', HTMLSourceElement, function() {return document.createElement('source');});}catch (e) {}
  try {add(map, 'HTMLStyleElement', HTMLStyleElement, function() {return document.createElement('style');});}catch (e) {}
  try {add(map, 'HTMLTableCaptionElement', HTMLTableCaptionElement, function() {return document.createElement('caption');});}catch (e) {}
  try {add(map, 'HTMLTableCellElement', HTMLTableCellElement, function() {return document.createElement('td');});}catch (e) {}
  try {add(map, 'HTMLTableColElement', HTMLTableColElement, function() {return document.createElement('col');});}catch (e) {}
  try {add(map, 'HTMLTableElement', HTMLTableElement, function() {return document.createElement('table');});}catch (e) {}
  try {add(map, 'HTMLTableRowElement', HTMLTableRowElement, function() {return document.createElement('tr');});}catch (e) {}
  try {add(map, 'HTMLTableSectionElement', HTMLTableSectionElement, function() {return document.createElement('tbody');});}catch (e) {}
  try {add(map, 'HTMLTextAreaElement', HTMLTextAreaElement, function() {return document.createElement('textarea');});}catch (e) {}
  try {add(map, 'HTMLTitleElement', HTMLTitleElement, function() {return document.createElement('title');});}catch (e) {}
  try {add(map, 'HTMLUListElement', HTMLUListElement, function() {return document.createElement('ul');});}catch (e) {}
  try {add(map, 'HTMLVideoElement', HTMLVideoElement, function() {return document.createElement('video');});}catch (e) {}
  try {add(map, 'KeyboardEvent', KeyboardEvent, function() {return document.createEvent('KeyboardEvent');});}catch (e) {}
  try {add(map, 'MouseEvent', MouseEvent, function() {return document.createEvent('MouseEvents');});}catch (e) {}
  try {add(map, 'MutationEvent', MutationEvent, function() {return document.createEvent('MutationEvents');});}catch (e) {}
  try {add(map, 'RegExp', RegExp, function() {return new RegExp();});}catch (e) {}
  try {add(map, 'SVGZoomEvent', SVGZoomEvent, function() {return document.createEvent('SVGZoomEvents');});}catch (e) {}
  try {add(map, 'String', String, function() {return new String();});}catch (e) {}
  try {add(map, 'Text', Text, function() {return document.createTextNode('');});}catch (e) {}
  try {add(map, 'TextEvent', TextEvent, function() {return document.createEvent('TextEvent');});}catch (e) {}
  try {add(map, 'UIEvent', UIEvent, function() {return document.createEvent('UIEvents');});}catch (e) {}
  // END AUTO-GENERATED

  /**
   * Combines mixins with the current class, issuing errors for conflicts or
   * missing requires.
   *
   * @param {Object} proto the prototype for the class we're creating.
   * @param {Array.<Object>} mixins the set of traits to mix in.
   * @return {Object} the trait to set into new instances with defineProperties.
   */
  function analyzeMixins(proto, mixins) {
    var trait = traceur.runtime.trait;
    mixins = trait.compose.apply(null, mixins);
    var properties = {};
    Object.getOwnPropertyNames(mixins).forEach(function(name) {
      var pd = mixins[name];
      // check for remaining 'required' properties
      // Note: it's OK for the prototype to provide the properties
      if (pd.required) {
        if (!(name in proto)) {
          throw new TypeError('Missing required property: ' + name);
        }
      } else if (pd.conflict) { // check for remaining conflicting properties
        throw new TypeError('Remaining conflicting property: ' + name);
      } else {
        properties[name] = pd;
      }
    });
    return properties;
  }

  // The createClass function
  // name: the class name
  // base: the base class
  // make: the function to create instance of the class
  //       i.e. function() { document.createEvent('div'); }
  // ctor: the constructor function
  // proto: the prototype object (containing instance methods, properties)
  // initS: the function to initialize class static members
  // mixins: Traits to mixin to this class
  function createClass(name, base, make, ctor, init, proto, initS, mixins) {
    if (base) {
      if (typeof base != 'function') {
        throw new TypeError(
            'Base class of ' + name +
            ' must be a function (' + typeof base + ')');
      }
    } else {
      base = Object;
    }
    make = make || base.$new;

    if (!make && base.name) {
      var dom = map[base.name];
      if (dom && dom.$class === base) {
        make = dom;
      }
    }

    var binit = base.$init;
    var finit = binit ?
        (init ? function() { binit.call(this); init.call(this); } : binit) :
        init;
    if (ctor) {
      proto.constructor = ctor;
    } else {
      ctor = proto.constructor;
    }

    proto.__proto__ = base.prototype;

    if (mixins) {
      mixins = analyzeMixins(proto, mixins);
    }

    function TheClass() {
      var $this = make ? make() : this;
      $this.__proto__ = TheClass.prototype;
      if (mixins) { Object.defineProperties($this, mixins); }
      if (finit) { finit.call($this); }
      if (ctor) { ctor.apply($this, arguments); }
      return $this;
    }

    TheClass.prototype = proto;

    Object.defineProperty(TheClass, '$className', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: false
    });
    if (finit) {
      Object.defineProperty(TheClass, '$init', {
        value: finit,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
    if (make) {
      Object.defineProperty(TheClass, '$new', {
        value: make,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
    if (initS) { initS.call(TheClass); }
    return TheClass;
  }

  function createTrait(parts, mixins) {
    var trait = traceur.runtime.trait;
    parts = trait(parts);
    if (mixins) {
      parts = trait.override(parts, trait.compose.apply(null, mixins));
    }
    return parts;
  }

  function superCall($class, name, args) {
    var proto = Object.getPrototypeOf($class.prototype);
    while (proto) {
      var p = Object.getOwnPropertyDescriptor(proto, name);
      if (p) {
        if (p.hasOwnProperty('value')) {
          return p.value.apply(this, args);
        }
        if (p.hasOwnProperty('get')) {
          return p.get.apply(this, args);
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
    throw new TypeError("Object has no method '" + name + "'.");
  }

  function superGet($class, name) {
    var proto = Object.getPrototypeOf($class.prototype);
    while (proto) {
      var p = Object.getOwnPropertyDescriptor(proto, name);
      if (p) {
        if (p.hasOwnProperty('value')) {
          return p.value;
        }
        if (p.hasOwnProperty('get')) {
          return p.get.call(this);
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
    return undefined;
  }

  // Add iterator support to arrays.
  Object.defineProperty(Array.prototype, '__iterator__', {
    value: function() {
      var index = 0;
      var array = this;
      var current;
      return {
        get current() {
          return current;
        },
        moveNext: function() {
          if (index < array.length) {
            current = array[index++];
            return true;
          }
          return false;
        }
      };
    },
    enumerable: false,
    configurable: true,
    writable: true
  });

  var pushItem = Array.prototype.push.call.bind(Array.prototype.push);
  var pushArray = Array.prototype.push.apply.bind(Array.prototype.push);
  var slice = Array.prototype.slice.call.bind(Array.prototype.slice);

  /**
   * Spreads the elements in {@code items} into a single array.
   * @param {Array} items Array of interleaving booleans and values.
   * @return {Array}
   */
  function spread(items) {
    var retval = [];
    for (var i = 0; i < items.length; i += 2) {
      if (items[i]) {
        if (items[i + 1] == null)
          continue;
        if (typeof items[i + 1] != 'object')
          throw TypeError('Spread expression has wrong type');
        pushArray(retval, slice(items[i + 1]));
      } else {
        pushItem(retval, items[i + 1]);
      }
    }
    return retval;
  }

  /**
   * @param {Function} ctor
   * @param {Array} items Array of interleaving booleans and values.
   * @return {Object}
   */
  function spreadNew(ctor, items) {
    var object = Object.create(ctor.prototype);
    var retval = ctor.apply(object, spread(items));
    return retval && typeof retval == 'object' ? retval : object;
  };

  /**
   * @param {Function} canceller
   * @constructor
   */
  function Deferred(canceller) {
    this.canceller_ = canceller;
    this.listeners_ = [];
  }

  function notify(self) {
    while (self.listeners_.length > 0) {
      var current = self.listeners_.shift();
      var currentResult = undefined;
      try {
        try {
          if (self.result_[1]) {
            if (current.errback)
              currentResult = current.errback.call(undefined, self.result_[0]);
          } else {
            if (current.callback)
              currentResult = current.callback.call(undefined, self.result_[0]);
          }
          current.deferred.callback(currentResult);
        } catch (err) {
          current.deferred.errback(err);
        }
      } catch (unused) {}
    }
  }

  function fire(self, value, isError) {
    if (self.fired_)
      throw new Error('already fired');

    self.fired_ = true;
    self.result_ = [value, isError];
    notify(self);
  }

  Deferred.prototype = {
    fired_: false,
    result_: undefined,

    createPromise: function() {
      return {then: this.then.bind(this), cancel: this.cancel.bind(this)};
    },

    callback: function(value) {
      fire(this, value, false);
    },

    errback: function(err) {
      fire(this, err, true);
    },

    then: function(callback, errback) {
      var result = new Deferred(this.cancel.bind(this));
      this.listeners_.push({
        deferred: result,
        callback: callback,
        errback: errback
      });
      if (this.fired_)
        notify(this);
      return result.createPromise();
    },

    cancel: function() {
      if (this.fired_)
        throw new Error('already finished');
      var result;
      if (this.canceller_) {
        result = this.canceller_(this);
        if (!result instanceof Error)
          result = new Error(result);
      } else {
        result = new Error('cancelled');
      }
      if (!this.fired_) {
        this.result_ = [result, true];
        notify(this);
      }
    }
  };

  // Return the traceur namespace.
  return {
    createClass: createClass,
    createTrait: createTrait,
    Deferred: Deferred,
    spread: spread,
    spreadNew: spreadNew,
    superCall: superCall,
    superGet: superGet
  };
})();

var Deferred = traceur.runtime.Deferred;
;
// Copyright (C) 2010 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// See http://code.google.com/p/es-lab/wiki/Traits
// for background on traits and a description of this library


/**
 * The traceur runtime (trait).
 */
traceur.runtime.trait = (function() {

  var call = Function.prototype.call;

  /**
   * An ad hoc version of bind that only binds the 'this' parameter.
   */
  var bindThis =
      function(fun, self) { return Function.prototype.bind.call(fun, self); }

  var hasOwnProperty = bindThis(call, Object.prototype.hasOwnProperty);
  var slice = bindThis(call, Array.prototype.slice);
  var forEach = bindThis(call, Array.prototype.forEach);
  var freeze = Object.freeze;
  var getPrototypeOf = Object.getPrototypeOf;
  var getOwnPropertyNames = Object.getOwnPropertyNames;
  var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  var defineProperty = Object.defineProperty;
  var defineProperties = Object.defineProperties;
  var Object_create = Object.create;
  var getOwnProperties = Object.getOwnProperties;

  function makeConflictAccessor(name) {
    var accessor = function(var_args) {
      throw new Error('Conflicting property: ' + name);
    };
    freeze(accessor.prototype);
    return freeze(accessor);
  };

  function makeRequiredPropDesc(name) {
    return freeze({
      value: undefined,
      enumerable: false,
      required: true
    });
  }

  function makeConflictingPropDesc(name) {
    var conflict = makeConflictAccessor(name);
    return freeze({
      get: conflict,
      set: conflict,
      enumerable: false,
      conflict: true
    });
  }

  /**
   * Are x and y not observably distinguishable?
   */
  function identical(x, y) {
    if (x === y) {
      // 0 === -0, but they are not identical
      return x !== 0 || 1 / x === 1 / y;
    } else {
      // NaN !== NaN, but they are identical.
      // NaNs are the only non-reflexive value, i.e., if x !== x,
      // then x is a NaN.
      return x !== x && y !== y;
    }
  }

  // Note: isSameDesc should return true if both
  // desc1 and desc2 represent a 'required' property
  // (otherwise two composed required properties would be turned into
  // a conflict)
  function isSameDesc(desc1, desc2) {
    // for conflicting properties, don't compare values because
    // the conflicting property values are never equal
    if (desc1.conflict && desc2.conflict) {
      return true;
    } else {
      return (desc1.get === desc2.get &&
              desc1.set === desc2.set &&
              identical(desc1.value, desc2.value) &&
              desc1.enumerable === desc2.enumerable &&
              desc1.required === desc2.required &&
              desc1.conflict === desc2.conflict);
    }
  }

  function freezeAndBind(meth, self) {
    return freeze(bindThis(meth, self));
  }

  /* makeSet(['foo', ...]) => { foo: true, ...}
   *
   * makeSet returns an object whose own properties represent a set.
   *
   * Each string in the names array is added to the set.
   *
   * To test whether an element is in the set, perform:
   *   hasOwnProperty(set, element)
   */
  function makeSet(names) {
    var set = {};
    forEach(names, function(name) {
      set[name] = true;
    });
    return freeze(set);
  }

  // == singleton object to be used as the placeholder for a required
  // property ==

  var required = freeze({
    toString: function() { return '<Trait.required>'; }
  });

  // == The public API methods ==

  /**
   * var newTrait = trait({ foo:required, ... })
   *
   * @param {Object} object an object record (in principle an object literal).
   * @return {Object} a new trait describing all of the own
   *     properties of the object (both enumerable and non-enumerable).
   *
   * As a general rule, 'trait' should be invoked with an object
   * literal, since the object merely serves as a record
   * descriptor. Both its identity and its prototype chain are
   * irrelevant.
   *
   * Data properties bound to function objects in the argument will be
   * flagged as 'method' properties. The prototype of these function
   * objects is frozen.
   *
   * Data properties bound to the 'required' singleton exported by
   * this module will be marked as 'required' properties.
   *
   * The <tt>trait</tt> function is pure if no other code can witness
   * the side-effects of freezing the prototypes of the methods. If
   * <tt>trait</tt> is invoked with an object literal whose methods
   * are represented as in-place anonymous functions, this should
   * normally be the case.
   */
  function trait(obj) {
    var map = {};
    forEach(getOwnPropertyNames(obj), function(name) {
      var pd = getOwnPropertyDescriptor(obj, name);
      if (pd.value === required) {
        pd = makeRequiredPropDesc(name);
      } else if (typeof pd.value === 'function') {
        pd.method = true;
        if ('prototype' in pd.value) {
          freeze(pd.value.prototype);
        }
      } else {
        if (pd.get && pd.get.prototype) { freeze(pd.get.prototype); }
        if (pd.set && pd.set.prototype) { freeze(pd.set.prototype); }
      }
      map[name] = pd;
    });
    return map;
  }

  /**
   * var newTrait = compose(trait_1, trait_2, ..., trait_N)
   *
   * @param {Object} trait_i a trait object.
   * @return {Object} a new trait containing the combined own properties of
   *          all the trait_i.
   *
   * If two or more traits have own properties with the same name, the new
   * trait will contain a 'conflict' property for that name. 'compose' is
   * a commutative and associative operation, and the order of its
   * arguments is not significant.
   *
   * If 'compose' is invoked with < 2 arguments, then:
   *   compose(trait_1) returns a trait equivalent to trait_1
   *   compose() returns an empty trait
   */
  function compose(var_args) {
    var traits = slice(arguments, 0);
    var newTrait = {};

    forEach(traits, function(trait) {
      forEach(getOwnPropertyNames(trait), function(name) {
        var pd = trait[name];
        if (hasOwnProperty(newTrait, name) &&
            !newTrait[name].required) {

          // a non-required property with the same name was previously
          // defined this is not a conflict if pd represents a
          // 'required' property itself:
          if (pd.required) {
            // skip this property, the required property is
            // now present
            return;
          }

          if (!isSameDesc(newTrait[name], pd)) {
            // a distinct, non-required property with the same name
            // was previously defined by another trait => mark as
            // conflicting property
            newTrait[name] = makeConflictingPropDesc(name);
          } // else,
          // properties are not in conflict if they refer to the same value

        } else {
          newTrait[name] = pd;
        }
      });
    });

    return freeze(newTrait);
  }

  /* var newTrait = exclude(['name', ...], trait)
   *
   * @param names a list of strings denoting property names.
   * @param trait a trait some properties of which should be excluded.
   * @returns a new trait with the same own properties as the original trait,
   *          except that all property names appearing in the first argument
   *          are replaced by required property descriptors.
   *
   * Note: exclude(A, exclude(B,t)) is equivalent to exclude(A U B, t)
   */
  function exclude(names, trait) {
    var exclusions = makeSet(names);
    var newTrait = {};

    forEach(getOwnPropertyNames(trait), function(name) {
      // required properties are not excluded but ignored
      if (!hasOwnProperty(exclusions, name) || trait[name].required) {
        newTrait[name] = trait[name];
      } else {
        // excluded properties are replaced by required properties
        newTrait[name] = makeRequiredPropDesc(name);
      }
    });

    return freeze(newTrait);
  }

  /**
   * var newTrait = override(trait_1, trait_2, ..., trait_N)
   *
   * @return {Object} a new trait with all of the combined properties of the
   *          argument traits.  In contrast to 'compose', 'override'
   *          immediately resolves all conflicts resulting from this
   *          composition by overriding the properties of later
   *          traits. Trait priority is from left to right. I.e. the
   *          properties of the leftmost trait are never overridden.
   *
   *  override is associative:
   *    override(t1,t2,t3) is equivalent to override(t1, override(t2, t3)) or
   *    to override(override(t1, t2), t3)
   *  override is not commutative: override(t1,t2) is not equivalent
   *    to override(t2,t1)
   *
   * override() returns an empty trait
   * override(trait_1) returns a trait equivalent to trait_1
   */
  function override(var_args) {
    var traits = slice(arguments, 0);
    var newTrait = {};
    forEach(traits, function(trait) {
      forEach(getOwnPropertyNames(trait), function(name) {
        var pd = trait[name];
        // add this trait's property to the composite trait only if
        // - the trait does not yet have this property
        // - or, the trait does have the property, but it's a required property
        if (!hasOwnProperty(newTrait, name) || newTrait[name].required) {
          newTrait[name] = pd;
        }
      });
    });
    return freeze(newTrait);
  }

  /**
   * var newTrait = override(dominantTrait, recessiveTrait)
   *
   * @return {Object} a new trait with all of the properties of dominantTrait
   *          and all of the properties of recessiveTrait not in dominantTrait.
   *
   * Note: override is associative:
   *   override(t1, override(t2, t3)) is equivalent to
   *   override(override(t1, t2), t3)
   */
  /*function override(frontT, backT) {
    var newTrait = {};
    // first copy all of backT's properties into newTrait
    forEach(getOwnPropertyNames(backT), function (name) {
      newTrait[name] = backT[name];
    });
    // now override all these properties with frontT's properties
    forEach(getOwnPropertyNames(frontT), function (name) {
      var pd = frontT[name];
      // frontT's required property does not override the provided property
      if (!(pd.required && hasOwnProperty(newTrait, name))) {
        newTrait[name] = pd;
      }
    });

    return freeze(newTrait);
  }*/

  /**
   * var newTrait = rename(map, trait)
   *
   * @param {Object} map an object whose own properties serve as a mapping from
            old names to new names.
   * @param {Object} trait a trait object.
   * @return {Object} a new trait with the same properties as the original
   *         trait, except that all properties whose name is an own property
   *         of map will be renamed to map[name], and a 'required' property
   *         for name will be added instead.
   *
   * rename( {a: 'b'} , t) eqv compose(exclude(['a'],t),
   *                                 { a: { required: true },
   *                                   b: t[a] }).
   *
   * For each renamed property, a required property is generated.  If
   * the map renames two properties to the same name, a conflict is
   * generated.  If the map renames a property to an existing
   * unrenamed property, a conflict is generated.
   *
   * Note: rename(A, rename(B, t)) is equivalent to rename(\n ->
   * A(B(n)), t) Note: rename({...},exclude([...], t)) is not eqv to
   * exclude([...],rename({...}, t))
   */
  function rename(map, trait) {
    var renamedTrait = {};
    forEach(getOwnPropertyNames(trait), function(name) {
      // required props are never renamed
      if (hasOwnProperty(map, name) && !trait[name].required) {
        var alias = map[name]; // alias defined in map
        if (hasOwnProperty(renamedTrait, alias) &&
            !renamedTrait[alias].required) {
          // could happen if 2 props are mapped to the same alias
          renamedTrait[alias] = makeConflictingPropDesc(alias);
        } else {
          // add the property under an alias
          renamedTrait[alias] = trait[name];
        }
        // add a required property under the original name
        // but only if a property under the original name does not exist
        // such a prop could exist if an earlier prop in the trait was
        // previously aliased to this name
        if (!hasOwnProperty(renamedTrait, name)) {
          renamedTrait[name] = makeRequiredPropDesc(name);
        }
      } else { // no alias defined
        if (hasOwnProperty(renamedTrait, name)) {
          // could happen if another prop was previously aliased to name
          if (!trait[name].required) {
            renamedTrait[name] = makeConflictingPropDesc(name);
          }
          // else required property overridden by a previously aliased
          // property and otherwise ignored
        } else {
          renamedTrait[name] = trait[name];
        }
      }
    });

    return freeze(renamedTrait);
  }

  /**
   * var newTrait = resolve({ oldName: 'newName', excludeName:
   * undefined, ... }, trait)
   *
   * This is a convenience function combining renaming and
   * exclusion. It can be implemented as <tt>rename(map,
   * exclude(exclusions, trait))</tt> where map is the subset of
   * mappings from oldName to newName and exclusions is an array of
   * all the keys that map to undefined (or another falsy value).
   *
   * @param {Object} resolutions an object whose own properties serve as a
            mapping from old names to new names, or to undefined if
            the property should be excluded.
   * @param {Object} trait a trait object.
   * @return {Object} a resolved trait with the same own properties as the
   * original trait.
   *
   * In a resolved trait, all own properties whose name is an own property
   * of resolutions will be renamed to resolutions[name] if it is truthy,
   * or their value is changed into a required property descriptor if
   * resolutions[name] is falsy.
   *
   * Note, it's important to _first_ exclude, _then_ rename, since exclude
   * and rename are not associative, for example:
   * rename( {a: 'b'} , exclude(['b'], trait({ a:1,b:2 }))) eqv trait({b:1})
   * exclude(['b'], rename({a: 'b'}, trait({ a:1,b:2 }))) eqv
   * trait({b:Trait.required}).
   *
   * writing resolve({a:'b', b: undefined},trait({a:1,b:2})) makes it
   * clear that what is meant is to simply drop the old 'b' and rename
   * 'a' to 'b'
   */
  function resolve(resolutions, trait) {
    var renames = {};
    var exclusions = [];
    // preprocess renamed and excluded properties
    for (var name in resolutions) {
      if (hasOwnProperty(resolutions, name)) {
        if (resolutions[name]) { // old name -> new name
          renames[name] = resolutions[name];
        } else { // name -> undefined
          exclusions.push(name);
        }
      }
    }
    return rename(renames, exclude(exclusions, trait));
  }

  /**
   * var obj = create(proto, trait)
   *
   * @param {Object} proto denotes the prototype of the completed object.
   * @param {Object} trait a trait object to be turned into a complete object.
   * @return {Object} an object with all of the properties described by the
   *         trait.
   * @throws 'Missing required property' the trait still contains a
   *         required property.
   * @throws 'Remaining conflicting property' if the trait still
   *         contains a conflicting property.
   *
   * Trait.create is like Object.create, except that it generates
   * high-integrity or final objects. In addition to creating a new object
   * from a trait, it also ensures that:
   *    - an exception is thrown if 'trait' still contains required properties
   *    - an exception is thrown if 'trait' still contains conflicting
   *      properties
   *    - the object is and all of its accessor and method properties are frozen
   *    - the 'this' pseudovariable in all accessors and methods of
   *      the object is bound to the composed object.
   *
   *  Use Object.create instead of Trait.create if you want to create
   *  abstract or malleable objects. Keep in mind that for such objects:
   *    - no exception is thrown if 'trait' still contains required properties
   *      (the properties are simply dropped from the composite object)
   *    - no exception is thrown if 'trait' still contains conflicting
   *      properties (these properties remain as conflicting
   *      properties in the composite object)
   *    - neither the object nor its accessor and method properties are frozen
   *    - the 'this' pseudovariable in all accessors and methods of
   *      the object is left unbound.
   */
  function create(proto, trait) {
    var self = Object_create(proto);
    var properties = {};

    forEach(getOwnPropertyNames(trait), function(name) {
      var pd = trait[name];
      // check for remaining 'required' properties
      // Note: it's OK for the prototype to provide the properties
      if (pd.required) {
        if (!(name in proto)) {
          throw new Error('Missing required property: ' + name);
        }
      } else if (pd.conflict) { // check for remaining conflicting properties
        throw new Error('Remaining conflicting property: ' + name);
      } else if ('value' in pd) { // data property
        // freeze all function properties and their prototype
        if (pd.method) { // the property is meant to be used as a method
          // bind 'this' in trait method to the composite object
          properties[name] = {
            value: freezeAndBind(pd.value, self),
            enumerable: pd.enumerable,
            configurable: pd.configurable,
            writable: pd.writable
          };
        } else {
          properties[name] = pd;
        }
      } else { // accessor property
        properties[name] = {
          get: pd.get ? freezeAndBind(pd.get, self) : undefined,
          set: pd.set ? freezeAndBind(pd.set, self) : undefined,
          enumerable: pd.enumerable,
          configurable: pd.configurable
        };
      }
    });

    defineProperties(self, properties);
    return freeze(self);
  }

  /** A shorthand for create(Object.prototype, trait({...}), options) */
  function object(record, options) {
    return create(Object.prototype, trait(record), options);
  }

  /**
   * Tests whether two traits are equivalent. T1 is equivalent to T2 iff
   * both describe the same set of property names and for all property
   * names n, T1[n] is equivalent to T2[n]. Two property descriptors are
   * equivalent if they have the same value, accessors and attributes.
   *
   * @param {Object} trait1 a trait object.
   * @param {Object} trait2 a trait object.
   * @return {boolean} a boolean indicating whether the two argument traits are
   *         equivalent.
   */
  function eqv(trait1, trait2) {
    var names1 = getOwnPropertyNames(trait1);
    var names2 = getOwnPropertyNames(trait2);
    var name;
    if (names1.length !== names2.length) {
      return false;
    }
    for (var i = 0; i < names1.length; i++) {
      name = names1[i];
      if (!trait2[name] || !isSameDesc(trait1[name], trait2[name])) {
        return false;
      }
    }
    return true;
  }

  // if this code is ran in ES3 without an Object.create function, this
  // library will define it on Object:
  if (!Object.create) {
    Object.create = Object_create;
  }
  // ES5 does not by default provide Object.getOwnProperties
  // if it's not defined, the Traits library defines this utility
  // function on Object
  if (!Object.getOwnProperties) {
    Object.getOwnProperties = getOwnProperties;
  }

  // expose the public API of this module
  function Trait(record) {
    // calling Trait as a function creates a new atomic trait
    return trait(record);
  }
  Trait.required = freeze(required);
  Trait.compose = freeze(compose);
  Trait.resolve = freeze(resolve);
  Trait.override = freeze(override);
  Trait.create = freeze(create);
  Trait.eqv = freeze(eqv);
  Trait.object = freeze(object); // not essential, cf. create + trait
  return freeze(Trait);

})();
